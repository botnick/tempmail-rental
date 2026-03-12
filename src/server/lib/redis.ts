/**
 * Redis Client — Production-grade singleton
 *
 * Features:
 * - Reconnection with exponential backoff
 * - Error handling with structured logging
 * - Health check method
 * - Graceful shutdown
 * - Lazy connection (doesn't block startup)
 */

import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

let redis: Redis | null = null;

function createRedisClient(): Redis {
  const client = new Redis(env.REDIS_URL, {
    // Connection
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,

    // Reconnection
    retryStrategy(times: number) {
      if (times > 10) {
        logger.error('Redis: max reconnection attempts reached', {
          attempts: String(times),
        });
        return null; // Stop retrying
      }
      // Exponential backoff: 100ms, 200ms, 400ms, ... up to 30s
      const delay = Math.min(times * 100 * Math.pow(2, times - 1), 30_000);
      logger.warn('Redis: reconnecting', {
        attempt: String(times),
        delayMs: String(delay),
      });
      return delay;
    },

    // Performance
    enableOfflineQueue: true,
    connectTimeout: 10_000,
    commandTimeout: 5_000,
  });

  client.on('connect', () => {
    logger.info('Redis: connected');
  });

  client.on('ready', () => {
    logger.info('Redis: ready to accept commands');
  });

  client.on('error', (err) => {
    logger.error('Redis: connection error', {
      error: err,
      errorMessage: err.message,
    });
  });

  client.on('close', () => {
    logger.warn('Redis: connection closed');
  });

  return client;
}

/**
 * Get the Redis client singleton.
 * Creates the client on first call (lazy initialization).
 */
export function getRedis(): Redis {
  if (!redis) {
    redis = createRedisClient();
  }
  return redis;
}

/**
 * Health check — returns true if Redis is connected and responsive.
 */
export async function redisHealthCheck(): Promise<{
  connected: boolean;
  latencyMs: number;
}> {
  try {
    const client = getRedis();
    const start = Date.now();
    await client.ping();
    return { connected: true, latencyMs: Date.now() - start };
  } catch {
    return { connected: false, latencyMs: -1 };
  }
}

/**
 * Graceful shutdown — close Redis connection cleanly.
 * Call this during process shutdown.
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    logger.info('Redis: gracefully disconnected');
  }
}

// Graceful shutdown hooks
if (typeof process !== 'undefined') {
  const shutdown = () => {
    closeRedis().catch(() => {});
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
