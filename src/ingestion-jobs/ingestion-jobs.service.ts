import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/primsa/prisma.service';
import {
  CreateIngestionJobDto,
  JobMode,
  JobType,
  ScheduleType,
} from './dto/create-ingestion-job.dto';
import { UpdateIngestionJobDto } from './dto/update-ingestion-job.dto';
import { ListIngestionJobsQuery } from './dto/list-ingestion-jobs.query';
import { Prisma } from '@prisma/client';
import { buildCronFromSchedule } from '../utils/schedule-to-cron';
import { v4 as uuidv4 } from 'uuid';
import { parseCronToSchedule } from 'src/utils/cron-to-schedule';
import { CreateCsvAssetIngestionJobDto } from './dto/create-csv-asset-ingestion-job.dto';
import { Status } from './dto/activate-ingestion-job.dto';
import { CronExpressionParser } from 'cron-parser';
import { CreateInstantApiSyncDto } from './dto/create-instant-api-sync.dto';
import { AppLogger } from 'src/common/logger/app-logger.service';

@Injectable()
export class IngestionJobsService {
  private readonly ctx = IngestionJobsService.name;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) { }

  async createInstantApiSync(
    tenantId: string,
    dto: CreateInstantApiSyncDto,
  ) {
    const dataSource = await this.prisma.tenantDataSource.findUnique({
      where: { id: dto.dataSourceId },
      select: { id: true, tenantId: true, enabled: true },
    });

    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }

    if (dataSource.tenantId !== tenantId) {
      throw new BadRequestException(
        'Data source does not belong to the specified tenant',
      );
    }

    if (!dataSource.enabled) {
      throw new BadRequestException('Data source is disabled');
    }

    return this.prisma.ingestionJob.create({
      data: {
        id: uuidv4(),
        tenantId,
        dataSourceId: dto.dataSourceId,
        csvAssetId: null,
        jobType: JobType.API,
        jobMode: JobMode.INSTANT,
        scheduleType: ScheduleType.ONE_TIME,
        cronExpression: null,
        scheduledAt: new Date(),
        isActive: true,
        createdBy: dto.createdBy ?? null,
      },
    });
  }

  async createCsvAssetJob(
    tenantId: string,
    dto: CreateCsvAssetIngestionJobDto,
  ) {
    const csvAsset = await this.prisma.tenantCsvAsset.findUnique({
      where: { id: dto.csvAssetId },
    });

    if (!csvAsset) {
      throw new NotFoundException('CSV asset not found');
    }

    if (csvAsset.tenantId !== tenantId) {
      throw new BadRequestException(
        'CSV asset does not belong to the specified tenant',
      );
    }

    const scheduledAtDate = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAtDate.getTime())) {
      throw new BadRequestException('scheduledAt must be a valid date-time');
    }

    return this.prisma.ingestionJob.create({
      data: {
        id: uuidv4(),
        tenantId,
        dataSourceId: null,
        csvAssetId: dto.csvAssetId,
        jobType: JobType.CSV,
        jobMode: JobMode.SCHEDULED,
        scheduleType: ScheduleType.ONE_TIME,
        cronExpression: null,
        scheduledAt: scheduledAtDate,
        isActive: true,
        createdBy: dto.createdBy ?? null,
      },
    });
  }

  async create(tenantId: string, dto: CreateIngestionJobDto) {
    try {
      let cronExpression: string | null = null;
      // let scheduleType: ScheduleType | null = null;
      // let scheduledAt: Date | null = null;

      /**
       * If scheduled job → convert
       */
      // if (dto.schedule === JobMode.SCHEDULED) {
      if (!dto.jobType) {
        throw new BadRequestException('jobType is required');
      }
      if (dto.jobType === ScheduleType.CRON) {
        cronExpression = buildCronFromSchedule(dto.scheduleType);
        return this.prisma.ingestionJob.create({
          data: {
            id: uuidv4(),
            tenantId,
            dataSourceId: dto.dataSourceId,
            csvAssetId: null,
            jobType: 'API', // this api use for only API for now, so default to API, we can add CSV later when we implement csv ingestion
            jobMode: 'SCHEDULED', // default to SCHEDULED for now, we can add INSTANT later when we implement instant ingestion

            scheduleType: dto.jobType,
            cronExpression,
            scheduledAt: null,

            isActive: dto.isActive ?? true,
            createdBy: dto.createdBy ?? null,
          },
        });
      }
      else if (dto.jobType === ScheduleType.ONE_TIME) {
        // scheduleType = ScheduleType.ONE_TIME;
        if (!dto.scheduledAt) {
          throw new BadRequestException('scheduledAt is required for ONE_TIME job');
        }

        return this.prisma.ingestionJob.create({
          data: {
            id: uuidv4(),
            tenantId,
            dataSourceId: dto.dataSourceId,
            csvAssetId: null,
            jobType: 'API', // this api use for only API for now, so default to API, we can add CSV later when we implement csv ingestion
            jobMode: 'SCHEDULED', // default to SCHEDULED for now, we can add INSTANT later when we implement instant ingestion

            scheduleType: dto.jobType,
            cronExpression,
            scheduledAt: dto.scheduledAt ?? null,

            isActive: dto.isActive ?? true,
            createdBy: dto.createdBy ?? null,
          },
        });
      }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `create failed: ${message}`,
        error instanceof Error ? error.stack : undefined,
        this.ctx,
      );
      throw error;
    }
  }

async findAll(tenantId: string, q: ListIngestionJobsQuery) {
  try {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const skip = (page - 1) * limit;

    let dateFilter: Prisma.IngestionJobWhereInput = {};

    if (q.date) {
      const targetDate = new Date(q.date);
      if (Number.isNaN(targetDate.getTime())) {
        throw new BadRequestException('date must be a valid ISO date');
      }

      const startOfDayUtc = new Date(Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
        0, 0, 0, 0
      ));

      const endOfDayUtc = new Date(startOfDayUtc);
      endOfDayUtc.setUTCDate(endOfDayUtc.getUTCDate() + 1);

      dateFilter = {
        OR: [
          {
            scheduleType: 'ONE_TIME',
            scheduledAt: {
              gte: startOfDayUtc,
              lt: endOfDayUtc,
            },
          },
          {
            scheduleType: 'CRON',
          },
        ],
      };
    }

    const where: Prisma.IngestionJobWhereInput = {
      ...(tenantId && { tenantId }),
      ...(q.jobMode && { jobMode: q.jobMode }),
      ...(q.scheduleType && { scheduleType: q.scheduleType }),
      ...dateFilter,
    };

    const [jobs, total] = await Promise.all([
      this.prisma.ingestionJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          runs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              createdAt: true,
              startedAt: true,
              finishedAt: true,
              errorMessage: true,
            },
          },
        },
      }),
      this.prisma.ingestionJob.count({ where }),
    ]);

    // Extra filtering ONLY for CRON jobs
    let finalJobs = jobs;
    if (q.date) {
      const targetDate = new Date(q.date);

      const startOfDayUtc = new Date(Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
        0, 0, 0, 0
      ));

      const endOfDayUtc = new Date(startOfDayUtc);
      endOfDayUtc.setUTCDate(endOfDayUtc.getUTCDate() + 1);

      finalJobs = jobs.filter(job => {
        if (job.scheduleType === 'CRON' && job.cronExpression) {
          return this.hasCronOccurrenceOnDate(
            job.cronExpression,
            startOfDayUtc,
            endOfDayUtc,
          );
        }
        return true; // ONE_TIME already filtered in DB
      });
    }

    return {
      page,
      limit,
      total,
      items: finalJobs,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(
      `findAll failed: ${message}`,
      err instanceof Error ? err.stack : undefined,
      this.ctx,
    );
    throw err;
  }
}

  private hasCronOccurrenceOnDate(
    cronExpression: string,
    startOfDayUtc: Date,
    endOfDayUtc: Date,
  ): boolean {
    try {
      const probeStart = new Date(startOfDayUtc.getTime() - 1000);
      const interval = CronExpressionParser.parse(cronExpression, {
        currentDate: probeStart,
        tz: 'UTC',
      });
      const next = interval.next().toDate();
      return next >= startOfDayUtc && next < endOfDayUtc;
    } catch {
      return false;
    }
  }

  async findOne(id: string) {
    const job = await this.prisma.ingestionJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('IngestionJob not found');
    return job;
  }

  async getStats(tenantId: string) {
    const now = new Date();

    const [
      activeCount,
      deactivatedCount,
      completedCount,
      lastCompletedRun,
      scheduledJobs,
    ] =
      await this.prisma.$transaction([
        this.prisma.ingestionJob.count({
          where: { tenantId, status: 'ACTIVE' },
        }),
        this.prisma.ingestionJob.count({
          where: { tenantId, status: 'DEACTIVATED' },
        }),
        this.prisma.ingestionJob.count({
          where: { tenantId, status: 'COMPLETED' },
        }),
        this.prisma.ingestionJobRun.findFirst({
          where: {
            status: 'COMPLETED',
            job: { tenantId },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            runType: true,
            createdAt: true,
            finishedAt: true,
            syncFinishedAt: true,
            job: {
              select: {
                id: true,
                jobType: true,
              },
            },
          },
        }),
        this.prisma.ingestionJob.findMany({
          where: {
            tenantId,
            status: 'ACTIVE',
            isActive: true,
            jobMode: 'SCHEDULED',
          },
          select: {
            id: true,
            jobType: true,
            scheduleType: true,
            scheduledAt: true,
            cronExpression: true,
          },
        }),
      ]);

    const nextCandidates: Array<{
      jobId: string;
      type: 'CSV' | 'API';
      scheduleType: 'CRON' | 'ONE_TIME';
      time: Date;
    }> = [];

    for (const job of scheduledJobs) {
      if (job.scheduleType === 'ONE_TIME' && job.scheduledAt && job.scheduledAt > now) {
        nextCandidates.push({
          jobId: job.id,
          type: job.jobType,
          scheduleType: 'ONE_TIME',
          time: job.scheduledAt,
        });
        continue;
      }

      if (job.scheduleType === 'CRON' && job.cronExpression) {
        try {
          const interval = CronExpressionParser.parse(job.cronExpression, {
            currentDate: now,
            tz: process.env.TZ ?? 'UTC',
          });
          nextCandidates.push({
            jobId: job.id,
            type: job.jobType,
            scheduleType: 'CRON',
            time: interval.next().toDate(),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Invalid cron for job ${job.id}: ${message}`, this.ctx);
        }
      }
    }

    const nextSync =
      nextCandidates.length > 0
        ? nextCandidates.reduce((earliest, current) =>
            current.time < earliest.time ? current : earliest,
          )
        : null;

    return {
      counts: {
        active: activeCount,
        deactivated: deactivatedCount,
        completed: completedCount,
        total: activeCount + deactivatedCount + completedCount,
      },
      lastSync: lastCompletedRun
        ? {
            jobId: lastCompletedRun.job.id,
            jobRunId: lastCompletedRun.id,
            type: lastCompletedRun.job.jobType,
            runType: lastCompletedRun.runType,
            status: lastCompletedRun.status,
            time:
              lastCompletedRun.syncFinishedAt ??
              lastCompletedRun.finishedAt ??
              lastCompletedRun.createdAt,
          }
        : null,
      nextSync: nextSync
        ? {
            jobId: nextSync.jobId,
            type: nextSync.type,
            scheduleType: nextSync.scheduleType,
            time: nextSync.time,
          }
        : null,
    };
  }

  // async update(id: string, dto: UpdateIngestionJobDto) {
  //   await this.findOne(id);

  //   return this.prisma.ingestionJob.update({
  //     where: { id },
  //     data: {

  //       // normalize optional values
  //       // csvAssetId: dto.csvAssetId ?? undefined,
  //       scheduleType: dto.jobType ?? undefined,
  //       // cronExpression: dto.cronExpression ?? undefined,
  //       scheduledAt: dto.scheduledAt ?? undefined,
  //     },
  //   });
  // }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.ingestionJob.delete({ where: { id } });
    return { deleted: true };
  }

  async activateJob(tenantId: string, jobId: string, status: Status) {
    const job = await this.prisma.ingestionJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('IngestionJob not found');
    if (job.tenantId !== tenantId) {
      throw new BadRequestException('IngestionJob does not belong to the specified tenant');
    }
    return this.prisma.ingestionJob.update({
      where: { id: jobId },
      data: { status: status === Status.ACTIVE ? 'ACTIVE' : 'DEACTIVATED', isActive: status === Status.ACTIVE? true : false },
    });
  }
}
