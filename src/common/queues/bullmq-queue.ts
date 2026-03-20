import { redisConnection } from 'src/common/redis/redis.connection';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AppLogger } from 'src/common/logger/app-logger.service';

@Injectable()
export class BullQueue {
  private readonly connection = redisConnection;
  private readonly ctx = BullQueue.name;

  constructor(private readonly logger: AppLogger) {}

  createQueue(name: string) {
    const queue = new Queue(name, {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    this.logger.log(
      `Queue "${name}" initialized with Redis ${this.redisTarget()}`,
      this.ctx,
    );

    queue.on('error', (error) => {
      this.logger.error(
        `Queue "${name}" emitted error: ${error.message}`,
        error.stack,
        this.ctx,
      );
    });

    void queue.client
      .then((client) => {
        this.logger.log(`Redis client attached for queue "${name}"`, this.ctx);

        client.on('connect', () => {
          this.logger.log(`Redis connect: queue "${name}"`, this.ctx);
        });

        client.on('ready', () => {
          this.logger.log(`Redis ready: queue "${name}"`, this.ctx);
        });

        client.on('reconnecting', (delay: number) => {
          this.logger.warn(
            `Redis reconnecting: queue "${name}", retryInMs=${delay}`,
            this.ctx,
          );
        });

        client.on('error', (error: Error) => {
          this.logger.error(
            `Redis error: queue "${name}": ${error.message}`,
            error.stack,
            this.ctx,
          );
        });

        client.on('end', () => {
          this.logger.warn(`Redis connection ended: queue "${name}"`, this.ctx);
        });
      })
      .catch((error: Error) => {
        this.logger.error(
          `Failed to attach Redis client for queue "${name}": ${error.message}`,
          error.stack,
          this.ctx,
        );
      });

    return queue;
  }

  private redisTarget() {
    const conn = this.connection as {
      host?: string;
      port?: number;
      tls?: unknown;
    };
    const host = conn.host || 'localhost';
    const port = conn.port || 6379;
    const secure = conn.tls ? 'tls' : 'tcp';
    return `${secure}://${host}:${port}`;
  }
}
