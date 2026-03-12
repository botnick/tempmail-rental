/**
 * Redis Caching Layer
 *
 * Provides typed, TTL-based caching backed by Redis.
 * Used for:
 * - Permission/role caching per-session
 * - Config entry caching
 * - Plan feature caching
 * - Rate limit pre-loading
 */

import { getRedis } from './redis';
import { logger } from './logger';

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

/**
 * Get a cached value. Returns null if not found or expired.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedis();
    const raw = await redis.get(`cache:${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    logger.warn('Cache get failed', { key });
    return null;
  }
}

/**
 * Set a cached value with TTL.
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  try {
    const redis = getRedis();
    await redis.set(`cache:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    logger.warn('Cache set failed', { key });
  }
}

/**
 * Delete a cached value.
 */
export async function cacheDel(key: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(`cache:${key}`);
  } catch {
    logger.warn('Cache del failed', { key });
  }
}

/**
 * Delete all cached values matching a prefix pattern.
 * Use sparingly — SCAN-based, not instant.
 */
export async function cacheInvalidatePrefix(prefix: string): Promise<number> {
  try {
    const redis = getRedis();
    let cursor = '0';
    let deleted = 0;

    do {
      const [next, keys] = await redis.scan(
        cursor,
        'MATCH',
        `cache:${prefix}*`,
        'COUNT',
        100
      );
      cursor = next;
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');

    return deleted;
  } catch {
    logger.warn('Cache invalidate prefix failed', { prefix });
    return 0;
  }
}

/**
 * Get-or-set pattern: returns cached value, or calls factory and caches result.
 */
export async function cacheGetOrSet<T>(
  key: string,
  factory: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const value = await factory();
  await cacheSet(key, value, ttlSeconds);
  return value;
}

// ─── Typed cache helpers for specific use cases ─────

/** Cache user permissions (invalidate on role change) */
export async function cacheUserPermissions(
  userId: string,
  permissions: string[]
): Promise<void> {
  await cacheSet(`user:perms:${userId}`, permissions, 600);
}

export async function getCachedUserPermissions(
  userId: string
): Promise<string[] | null> {
  return cacheGet<string[]>(`user:perms:${userId}`);
}

export async function invalidateUserPermissions(
  userId: string
): Promise<void> {
  await cacheDel(`user:perms:${userId}`);
}

/** Cache config entries */
export async function cacheConfigEntry(
  key: string,
  value: string
): Promise<void> {
  await cacheSet(`config:${key}`, value, 1800); // 30 min
}
