// queues.module.ts
import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { BullQueue } from './bullmq-queue';
import { INGESTION_QUEUE, SCHEDULED_QUEUE, TRANSFORM_QUEUE } from './queues.tokens';

@Module({
  providers: [
    BullQueue,

    {
      provide: INGESTION_QUEUE,
      useFactory: (qf: BullQueue): Queue => {
        return qf.createQueue(
          process.env.INGESTION_QUEUE_NAME ?? 'ingestion-queue',
        );
      },
      inject: [BullQueue],
    },

    {
      provide: SCHEDULED_QUEUE,
      useFactory: (qf: BullQueue): Queue => {
        return qf.createQueue(
          process.env.SCHEDULED_JOB_QUEUE ?? 'scheduled-job-queue',
        );
      },
      inject: [BullQueue],
    },

    {
      provide: TRANSFORM_QUEUE,
      useFactory: (qf: BullQueue): Queue => {
        return qf.createQueue(
          process.env.TRANSFORM_QUEUE_NAME ?? 'transform-job-run-queue',
        );
      },
      inject: [BullQueue],
    },
  ],
  exports: [INGESTION_QUEUE, SCHEDULED_QUEUE, TRANSFORM_QUEUE],
})
export class QueuesModule {}
