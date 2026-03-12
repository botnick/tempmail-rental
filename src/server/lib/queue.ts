/**
 * Queue System — Lightweight Redis-Based Job Queue
 *
 * Provides async job processing for background work:
 * - Email sending (verification, password reset, notifications)
 * - Webhook delivery
 * - Mailbox cleanup / expiration
 * - Heavy data processing
 *
 * Uses Redis lists with BRPOPLPUSH for reliable processing.
 * Jobs are idempotent and retryable.
 */

import { getRedis } from './redis';
import { logger } from './logger';
import { generateId } from './id';

export interface JobPayload {
  id: string;
  type: string;
  data: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  scheduledAt?: string;
}

/** Job handler function signature */
export type JobHandler = (payload: JobPayload) => Promise<void>;

/** Registry of job handlers */
const handlers = new Map<string, JobHandler>();

/** Register a handler for a job type */
export function registerJobHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
  logger.info('Job handler registered', { jobType: type });
}

/**
 * Enqueue a job for background processing.
 * Returns the job ID for tracking.
 */
export async function enqueueJob(
  type: string,
  data: Record<string, unknown>,
  options?: { maxAttempts?: number; delayMs?: number }
): Promise<string> {
  const redis = getRedis();
  const jobId = generateId('job');
  const now = new Date();

  const payload: JobPayload = {
    id: jobId,
    type,
    data,
    attempts: 0,
    maxAttempts: options?.maxAttempts ?? 3,
    createdAt: now.toISOString(),
    ...(options?.delayMs
      ? { scheduledAt: new Date(now.getTime() + options.delayMs).toISOString() }
      : {}),
  };

  if (options?.delayMs) {
    // Delayed job — use sorted set with score = scheduled timestamp
    await redis.zadd(
      'queue:delayed',
      now.getTime() + options.delayMs,
      JSON.stringify(payload)
    );
  } else {
    // Immediate job — push to queue
    await redis.lpush('queue:pending', JSON.stringify(payload));
  }

  logger.info('Job enqueued', { jobId, jobType: type });
  return jobId;
}

/**
 * Process the next job from the queue.
 * Moves job to processing list, executes handler, then removes.
 * On failure: retries with exponential backoff or moves to dead-letter queue.
 */
export async function processNextJob(): Promise<boolean> {
  const redis = getRedis();

  // Move delayed jobs that are ready
  const now = Date.now();
  const readyJobs = await redis.zrangebyscore('queue:delayed', 0, now);
  for (const raw of readyJobs) {
    await redis.zrem('queue:delayed', raw);
    await redis.lpush('queue:pending', raw);
  }

  // Pop from pending → processing
  const raw = await redis.rpoplpush('queue:pending', 'queue:processing');
  if (!raw) return false;

  let payload: JobPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    logger.error('Invalid job payload in queue', { raw });
    await redis.lrem('queue:processing', 1, raw);
    return true;
  }

  const handler = handlers.get(payload.type);
  if (!handler) {
    logger.error('No handler for job type', { jobType: payload.type, jobId: payload.id });
    await redis.lrem('queue:processing', 1, raw);
    await redis.lpush('queue:dead', raw);
    return true;
  }

  payload.attempts++;

  try {
    await handler(payload);
    await redis.lrem('queue:processing', 1, raw);
    logger.info('Job completed', { jobId: payload.id, jobType: payload.type, attempts: String(payload.attempts) });
  } catch (err: unknown) {
    await redis.lrem('queue:processing', 1, raw);

    if (payload.attempts >= payload.maxAttempts) {
      // Dead-letter queue
      await redis.lpush('queue:dead', JSON.stringify(payload));
      logger.error('Job failed — moved to dead-letter', {
        jobId: payload.id,
        jobType: payload.type,
        attempts: String(payload.attempts),
        errorMessage: (err as Error)?.message,
      });
    } else {
      // Retry with exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, payload.attempts), 60_000);
      await enqueueJob(payload.type, payload.data, {
        maxAttempts: payload.maxAttempts,
        delayMs: backoffMs,
      });
      logger.warn('Job failed — retrying', {
        jobId: payload.id,
        jobType: payload.type,
        attempts: String(payload.attempts),
        retryAfterMs: String(backoffMs),
      });
    }
  }

  return true;
}

/**
 * Start the worker loop.
 * Continuously processes jobs with a configurable poll interval.
 */
export function startWorker(pollIntervalMs: number = 1000): { stop: () => void } {
  let running = true;

  const loop = async () => {
    while (running) {
      try {
        const processed = await processNextJob();
        if (!processed) {
          // No jobs — wait before polling again
          await new Promise((r) => setTimeout(r, pollIntervalMs));
        }
      } catch (err: unknown) {
        logger.error('Worker loop error', { errorMessage: (err as Error)?.message });
        await new Promise((r) => setTimeout(r, pollIntervalMs * 2));
      }
    }
  };

  loop();

  return {
    stop: () => {
      running = false;
      logger.info('Worker stopping');
    },
  };
}

/**
 * Get queue statistics.
 */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  delayed: number;
  dead: number;
}> {
  const redis = getRedis();
  const [pending, processing, delayed, dead] = await Promise.all([
    redis.llen('queue:pending'),
    redis.llen('queue:processing'),
    redis.zcard('queue:delayed'),
    redis.llen('queue:dead'),
  ]);
  return { pending, processing, delayed, dead };
}
