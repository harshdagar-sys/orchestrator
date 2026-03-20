import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { PrismaService } from '../common/primsa/prisma.service';
import { QueuesModule } from 'src/common/queues/queues.module';
import { FetchCompleteWatcherService } from './fetch-complete-watcher.service';

@Module({
  imports: [QueuesModule],
  controllers: [SchedulerController],
  providers: [SchedulerService, PrismaService, FetchCompleteWatcherService],
})
export class SchedulerModule {}
