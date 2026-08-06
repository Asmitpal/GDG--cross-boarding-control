import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config.js';

export const redisConnection = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
});

// ─── Queue definitions ────────────────────────────────────────────────────────

export const slaMonitorQueue = new Queue('sla-monitor', {
  connection: redisConnection,
  defaultJobOptions: { removeOnComplete: 10, removeOnFail: 50 },
});

export const slackNotifyQueue = new Queue('slack-notify', {
  connection: redisConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 10 },
});

export const idpProvisionQueue = new Queue('idp-provision', {
  connection: redisConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 10 },
});

export { Worker, QueueEvents };
