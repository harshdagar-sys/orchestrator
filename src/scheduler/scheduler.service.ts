import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CronExpressionParser } from 'cron-parser';
import { PrismaService } from '../common/primsa/prisma.service';
import { INGESTION_QUEUE } from '../common/queues/queues.tokens';
import { RunType, JobRunStatus, JobMode, ScheduleType } from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import { FetchCompleteWatcherService } from './fetch-complete-watcher.service';
import { AppLogger } from 'src/common/logger/app-logger.service';

type DueJob = {
  id: string;
  tenantId: string;
  jobType: 'CSV' | 'API';
  scheduleType?: 'CRON' | 'ONE_TIME' | null;
  cronExpression?: string | null;
  scheduledAt?: Date | null;
  createdAt: Date;
};

@Injectable()
export class SchedulerService {
  private readonly ctx = SchedulerService.name;
  private isRunning = false;
  constructor(
    private readonly prisma: PrismaService,
    @Inject(INGESTION_QUEUE) private readonly queue: Queue,
    private readonly fetchWatcher: FetchCompleteWatcherService,
    private readonly logger: AppLogger,
  ) { }



  // @Cron('* * * * *') // every 1 minutes
  // async handleCronChunk() {
  //   if (this.isRunning) {
  //     this.logger.warn('Skipping cron tick: previous execution still running chunking', this.ctx);
  //     return;
  //   }

  //   this.isRunning = true;
  //   try {
  //     this.logger.log('Cron triggered - running scheduler tasks Chunking', this.ctx);

  //     try {
  //       const dueJobsResult = await this.runDueJobs(new Date());
  //       this.logger.log(
  //         `runDueJobs success: checked=${dueJobsResult.checked}, due=${dueJobsResult.due}, triggered=${dueJobsResult.triggered}`,
  //         this.ctx,
  //       );
  //     } catch (error) {
  //       const stack = error instanceof Error ? error.stack : undefined;
  //       const msg = error instanceof Error ? error.message : String(error);
  //       this.logger.error('runDueJobs failed', stack ?? msg, this.ctx);
  //     }

  //   } finally {
  //     this.isRunning = false;
  //   }
  // }
  // @Cron('* * * * *') // every 1 minutes
  // async handleCronTranform() {
  //   if (this.isRunning) {
  //     this.logger.warn('Skipping cron tick: previous execution still running Transform', this.ctx);
  //     return;
  //   }

  //   this.isRunning = true;
  //   try {
  //     this.logger.log('Cron triggered - running scheduler tasks Tranform', this.ctx);

  //     try {
  //       const watchResult = await this.fetchWatcher.watchAndEnqueueCompletedFetches();
  //       this.logger.log(
  //         `watchCompletedFetches success: checked=${watchResult.checked}, enqueued=${watchResult.enqueued} currentTime=${new Date().toISOString()}`,
  //         this.ctx,
  //       );
  //     } catch (error) {
  //       const stack = error instanceof Error ? error.stack : undefined;
  //       const msg = error instanceof Error ? error.message : String(error);
  //       this.logger.error('watchCompletedFetches failed', stack ?? msg, this.ctx);
  //     }
  //   } finally {
  //     this.isRunning = false;
  //   }
  // }
  @Cron('* * * * *') // every 1 minute
  async handleScheduler() {
    const tickStart = Date.now();
    const now = new Date();

    this.logger.log(
      `Scheduler tick STARTED at ${now.toISOString()}`,
      this.ctx,
    );

    const tasks = [
      {
        name: 'runDueJobs',
        handler: async () => {
          const start = Date.now();
          this.logger.log(
            `runDueJobs STARTED at ${new Date().toISOString()}`,
            this.ctx,
          );

          const result = await this.runDueJobs(now);

          const duration = Date.now() - start;
          this.logger.log(
            `runDueJobs COMPLETED in ${duration} ms | C checked=${result.checked}, C due=${result.due}, C triggered=${result.triggered}`,
            this.ctx,
          );

          return result;
        },
      },
      // {
      //   name: 'watchAndEnqueueCompletedFetches',
      //   handler: async () => {
      //     const start = Date.now();
      //     this.logger.log(
      //       `watchAndEnqueueCompletedFetches STARTED at ${new Date().toISOString()}`,
      //       this.ctx,
      //     );

      //     const result =
      //       await this.fetchWatcher.watchAndEnqueueCompletedFetches();

      //     const duration = Date.now() - start;
      //     this.logger.log(
      //       `watchAndEnqueueCompletedFetches COMPLETED in ${duration} ms | T checked=${result.checked}, T enqueued=${result.enqueued}`,
      //       this.ctx,
      //     );

      //     return result;
      //   },
      // },
    ];

    const results = await Promise.allSettled(
      tasks.map((task) => task.handler()),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `${tasks[index].name} FAILED at ${new Date().toISOString()}`,
          result.reason?.stack || result.reason,
          this.ctx,
        );
      }
    });

    const totalDuration = Date.now() - tickStart;

    this.logger.log(
      `Scheduler tick COMPLETED in ${totalDuration} ms at ${new Date().toISOString()}`,
      this.ctx,
    );
  }
  /**
   * Called by endpoint or timer every minute.
   * Creates JobRuns and enqueues "fetch.run" (or similar) instruction jobs.
   */
  async runDueJobs(now = new Date()) {
    // 1) fetch scheduled & active jobs
    const jobs = (await this.prisma.ingestionJob.findMany({
      where: {
        isActive: true,
        // jobMode: JobMode.SCHEDULED,
        scheduleType: { in: [ScheduleType.CRON, ScheduleType.ONE_TIME] },
      },
      select: {
        id: true,
        tenantId: true,
        jobType: true,
        scheduleType: true,
        cronExpression: true,
        scheduledAt: true,
        createdAt: true,
      },
    })) as DueJob[];

    const due: DueJob[] = [];

    for (const job of jobs) {
      // 2) skip if already has an active run (QUEUED/FETCH_STARTED)
      const activeRun = await this.prisma.ingestionJobRun.findFirst({
        where: {
          jobId: job.id,
          status: { in: [JobRunStatus.QUEUED, JobRunStatus.FETCH_STARTED] },
        },
        select: { id: true },
      });
      if (activeRun) continue;

      // 3) Decide if due
      if (job.scheduleType === ScheduleType.ONE_TIME) {
        if (job.scheduledAt && job.scheduledAt <= now) due.push(job); 
        this.logger.debug(`Job ${job.id} scheduled at ${job.scheduledAt} is not due yet, now=${now.toISOString()}`, this.ctx);
        continue;
      }

      if (job.scheduleType === ScheduleType.CRON) {
        if (!job.cronExpression) continue;

        // Determine last run time (if any)
        const lastRun = await this.prisma.ingestionJobRun.findFirst({
          where: { jobId: job.id },
          orderBy: { createdAt: 'desc' },
          select: { startedAt: true, createdAt: true },
        });

        const last = lastRun?.startedAt ?? lastRun?.createdAt ?? job.createdAt ?? new Date(0);

        // Check whether there exists at least one cron occurrence between last and now
        // We do: compute next occurrence after last, if <= now => due
        try {
          const interval = CronExpressionParser.parse(job.cronExpression, {
            currentDate: last,
            tz: 'UTC',
          });
          const next = interval.next().toDate();
          if (next <= now) due.push(job);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);

          this.logger.warn(`Invalid cron for job ${job.id}: ${message}`, this.ctx);
        }
      }
    }

    // 4) Create runs + enqueue
    const results: Array<Awaited<ReturnType<typeof this.createRunAndEnqueue>>> =
      [];
    for (const job of due) {
      const created = await this.createRunAndEnqueue(job, now);
      results.push(created);
    }

    return {
      checked: jobs.length,
      due: due.length,
      triggered: results.filter((r) => r.enqueued).length,
      results,
    };
  }

  private async createRunAndEnqueue(job: DueJob, now: Date) {
    // Create JobRun first so we have a durable record.
    const run = await this.prisma.ingestionJobRun.create({
      data: {
        jobId: job.id,
        runType: RunType.SCHEDULED,
        status: JobRunStatus.QUEUED,
        startedAt: null,
        finishedAt: null,
        totalRecords: null,
        processedRecords: null,
        failedRecords: null,
        errorMessage: null,

        // If you added two-phase fields, you can set these too:
        // fetchStatus: 'QUEUED',
        // syncStatus: 'QUEUED',
        // fetchStartedAt: null,
        // syncStartedAt: null,
      },
      select: { id: true },
    });

    const payload = {
      jobId: job.id,
      jobRunId: run.id,
      tenantId: job.tenantId,
      jobType: job.jobType, // API / CSV
      // The worker will load TenantDataSource/CsvAsset config from DB
      triggeredAt: now.toISOString(),
    };

    try {
      // Enqueue an instruction job.
      // Name/label tells worker what to do (fetch phase).
      await this.queue.add('fetch.run', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });
      this.logger.debug(`Enqueued job ${job.id} run ${run.id} of type ${payload.jobType} ${new Date().toISOString()}`, this.ctx);

      if (job.scheduleType === ScheduleType.ONE_TIME) {
        await this.prisma.ingestionJob.update({
          where: { id: job.id },
          data: { isActive: false, status: 'COMPLETED' },
        });
      }

      return { jobId: job.id, jobRunId: run.id, enqueued: true };
    } catch (err: any) {
      // If enqueue fails, mark run failed
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.ingestionJobRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorMessage: `Failed to enqueue fetch.run: ${message}`,
        },
      });

      return {
        jobId: job.id,
        jobRunId: run.id,
        enqueued: false,
        error: message,
      };
    }
  }
}
