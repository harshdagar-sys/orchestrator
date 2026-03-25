import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/primsa/prisma.service';
import { TRANSFORM_QUEUE } from '../common/queues/queues.tokens';
import { RunPhaseStatus } from '@prisma/client';
import { AppLogger } from 'src/common/logger/app-logger.service';

type FetchCompleteJob = {
  jobRunId: string;
  tenantId: string;
  jobType: 'CSV' | 'API';
};

@Injectable()
export class FetchCompleteWatcherService {
  private readonly ctx = FetchCompleteWatcherService.name;
  // private readonly logger = new Logger(FetchCompleteWatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(TRANSFORM_QUEUE) private readonly transformQueue: Queue,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Poll database for job runs with fetch_status = COMPLETED
   * and enqueue them to transform-job-run-queue for processing
   */
  async watchAndEnqueueCompletedFetches() {
    try {
      // Find all job runs where status is FETCH_COMPLETED
      const completedFetches = await this.prisma.ingestionJobRun.findMany({
        where: {
          status: 'FETCH_COMPLETED',
        },
        include: {
          job: {
            select: {
              tenantId: true,
              jobType: true,
            },
          },
        },
      });
      this.logger.debug(
        `Completed fetches loaded: count=${completedFetches.length}`,
        this.ctx,
      );

      if (completedFetches.length === 0) {
        this.logger.debug('No completed fetches to process', this.ctx);
        return { checked: 0, enqueued: 0 };
      }

      this.logger.log(
        `Found ${completedFetches.length} completed fetch(es) to enqueue`,
        this.ctx,
      );

      let enqueued = 0;
      const results: any[] = [];

      for (const item of completedFetches) {
        const payload: FetchCompleteJob = {
          jobRunId: item.id,
          tenantId: item.job.tenantId,
          jobType: item.job.jobType as 'CSV' | 'API',
        };

        try {
          // Enqueue to transform queue
          await this.transformQueue.add('transform.run', payload, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
          });

          // Update sync_status to QUEUED to mark it as being processed ----Done in transform worker
          // Update status to CANONICAL_TRANSFORM to mark it as being processed ----Done in transform worker
          //   await this.prisma.ingestionJobRun.update({
          //     where: { id: item.id },
          //     data: {
          //       status: 'CANONICAL_TRANSFORM',
          //       syncStartedAt: new Date(),
          //     },
          //   });

          enqueued++;
          results.push({
            jobRunId: item.id,
            status: 'enqueued',
          });

          this.logger.debug(
            `Enqueued job run ${item.id} to transform queue`,
            this.ctx,
          );
        } catch (err: any) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `Failed to enqueue job run ${item.id}: ${message}`,
            err?.stack,
            this.ctx,
          );

          results.push({
            jobRunId: item.id,
            status: 'failed',
            error: message,
          });
        }
      }

      return {
        checked: completedFetches.length,
        enqueued,
        results,
      };
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Error while watching for completed fetches: ${message}`,
        err?.stack,
        this.ctx,
      );
      throw err;
    }
  }
}
