import { ConnectionOptions } from 'bullmq';

const redisUrl =
  process.env.REDIS_URL || `redis://:Welcome%402022@4.188.82.237:6379`;

if (!redisUrl) throw new Error('REDIS_URL is required');

const url = new URL(redisUrl);
export const redisConnection: ConnectionOptions = {
  host: url.hostname,
  port: Number(url.port || 6379),
  username: url.username || undefined,
  password: decodeURIComponent(url.password) || undefined,
  tls: url.protocol === 'rediss:' ? {} : undefined,

  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  keepAlive: 10000,
  connectTimeout: 10000,

  retryStrategy(times: number) {
    return Math.min(times * 200, 2000);
  },
};
