import { Controller, Post, Query, Inject } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { FetchCompleteWatcherService } from './fetch-complete-watcher.service';

@Controller('scheduler')
export class SchedulerController {
  constructor(
    private readonly scheduler: SchedulerService,
    private readonly fetchWatcher: FetchCompleteWatcherService,
  ) {}

  /**
   * Call this from Azure Function / cron every minute.
   * Example: POST /scheduler/tick
   */
  @Post('tick')
  tick(@Query('now') now?: string) {
    // Optional: allow overriding time for testing
    const dt = now ? new Date(now) : new Date();
    return this.scheduler.runDueJobs(dt);
  }

  /**
   * Watch for completed fetch statuses and enqueue to transform queue.
   * Call this periodically (e.g. every 10-30 seconds).
   * Example: POST /scheduler/watch-fetches
   */
  @Post('watch-fetches')
  async watchCompletedFetches() {
    return this.fetchWatcher.watchAndEnqueueCompletedFetches();
  }
}
