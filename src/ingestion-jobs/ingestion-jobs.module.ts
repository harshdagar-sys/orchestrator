import { Module } from '@nestjs/common';
import { IngestionJobsService } from './ingestion-jobs.service';
import { IngestionJobsController } from './ingestion-jobs.controller';
import { PrismaService } from '../common/primsa/prisma.service';

@Module({
  controllers: [IngestionJobsController],
  providers: [IngestionJobsService, PrismaService],
  exports: [IngestionJobsService],
})
export class IngestionJobsModule {}
