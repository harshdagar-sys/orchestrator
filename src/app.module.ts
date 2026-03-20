import { Module } from '@nestjs/common';
// import { ConfigModule } from '@nestjs/config';
// import { ScheduleModule } from '@nestjs/schedule';
// import { PrismaModule } from './common/primsa/prisma..module';
// import { LoggerModule } from './common/logger/logger.module';
// import { IngestionJobsModule } from './ingestion-jobs/ingestion-jobs.module';
// import { IngestionJobRunsModule } from './ingestion-job-runs/ingestion-job-runs.module';
// import { SchedulerModule } from './scheduler/scheduler.module';
// import { TenantDataSourceModule } from './tenant-data-sources/tenant-data-source.module';
// import { TenantCsvAssetsModule } from './tenant-csv-assets/tenant-csv-assets.module';
// import { LogsModule } from './orch-logs/logs.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    // ConfigModule.forRoot({
    //   isGlobal: true,
    //   envFilePath: '.env',
    // }),
    // ScheduleModule.forRoot(),
    // LoggerModule,
    // PrismaModule,
    // TenantDataSourceModule,
    // TenantCsvAssetsModule,
    // LogsModule,
    // IngestionJobsModule,
    // IngestionJobRunsModule,
    // SchedulerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
