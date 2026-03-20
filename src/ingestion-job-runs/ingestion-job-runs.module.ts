import { Module } from '@nestjs/common';
import { IngestionJobRunsService } from './ingestion-job-runs.service';
import { IngestionJobRunsController } from './ingestion-job-runs.controller';

@Module({
  controllers: [IngestionJobRunsController],
  providers: [IngestionJobRunsService],
})
export class IngestionJobRunsModule {}
