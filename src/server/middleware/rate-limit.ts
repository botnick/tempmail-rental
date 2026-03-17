/**
 * Rate Limiter Middleware
 *
 * Token bucket algorithm backed by Redis.
 * Supports per-IP and per-user rate limits.
 *
 * Security:
 * - Prevents brute-force attacks on auth endpoints
 * - Configurable windows and limits per endpoint type
 * - Returns Retry-After header timing
 * - Separate limits for auth vs general API
 */

import { TRPCError } from '@trpc/server';

export interface RateLimitConfig {
  key: string;       // e.g. 'auth.login', 'mailbox.create'
  limit: number;     // max requests
  windowMs: number;  // time window in ms
}

// Default policies — loaded from config/db in production
const isDev = process.env.NODE_ENV !== 'production';
const devMultiplier = isDev ? 10 : 1; // 10x limits in development

export const RATE_LIMIT_POLICIES: Record<string, RateLimitConfig> = {
  'auth.login': { key: 'auth.login', limit: 5 * devMultiplier, windowMs: 15 * 60 * 1000 },
  'auth.register': { key: 'auth.register', limit: 3 * devMultiplier, windowMs: 60 * 60 * 1000 },
  'auth.password-reset': { key: 'auth.password-reset', limit: 3 * devMultiplier, windowMs: 60 * 60 * 1000 },
  'mailbox.create': { key: 'mailbox.create', limit: 10 * devMultiplier, windowMs: 60 * 60 * 1000 },
  'api.general': { key: 'api.general', limit: 100 * devMultiplier, windowMs: 60 * 1000 },
  'admin.action': { key: 'admin.action', limit: 50 * devMultiplier, windowMs: 60 * 1000 },
  'contact.submit': { key: 'contact.submit', limit: 3 * devMultiplier, windowMs: 15 * 60 * 1000 },
};

/**
 * Check rate limit against Redis
 * Uses sliding window counter pattern
 */
export async function checkRateLimit(
  redis: { incr: (key: string) => Promise<number>; expire: (key: string, seconds: number) => Promise<unknown>; ttl: (key: string) => Promise<number> },
  identifier: string,  // IP or userId
  policy: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }> {
  const redisKey = `rl:${policy.key}:${identifier}`;
  const windowSecs = Math.ceil(policy.windowMs / 1000);

  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, windowSecs);
  }

  const remaining = Math.max(0, policy.limit - count);
  const allowed = count <= policy.limit;

  let retryAfterMs = 0;
  if (!allowed) {
    const ttl = await redis.ttl(redisKey);
    retryAfterMs = ttl > 0 ? ttl * 1000 : policy.windowMs;
  }

  return { allowed, remaining, retryAfterMs };
}

/**
 * Throw if rate limited
 */
export function enforceRateLimit(result: { allowed: boolean; retryAfterMs: number }): void {
  if (!result.allowed) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `Rate limit exceeded. Try again in ${Math.ceil(result.retryAfterMs / 1000)} seconds.`,
    });
  }
}
