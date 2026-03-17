/**
 * REST API Route Rate Limiter
 *
 * Provides rate limiting for non-tRPC API routes (login, register, contact, etc.)
 * Uses Redis sliding window counter — same pattern as tRPC rate limiter.
 *
 * Usage:
 *   const { allowed, retryAfterSec } = await restRateLimit(req, 'auth.login');
 *   if (!allowed) return rateLimitResponse(retryAfterSec);
 */

import { NextResponse } from 'next/server';
import { getRedis } from '../lib/redis';
import { RATE_LIMIT_POLICIES, type RateLimitConfig } from './rate-limit';
import { logger } from '../lib/logger';

/**
 * Extract client IP from request headers.
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Check rate limit for a REST API route.
 * Returns { allowed, retryAfterSec, remaining }.
 *
 * @param req - The incoming request
 * @param policyKey - Key from RATE_LIMIT_POLICIES (e.g. 'auth.login')
 */
export async function restRateLimit(
  req: Request,
  policyKey: string
): Promise<{ allowed: boolean; retryAfterSec: number; remaining: number }> {
  const policy = RATE_LIMIT_POLICIES[policyKey];
  if (!policy) {
    logger.warn(`Rate limit policy not found: ${policyKey}`);
    return { allowed: true, retryAfterSec: 0, remaining: 999 };
  }

  try {
    const redis = getRedis();
    const ip = getClientIp(req);
    const redisKey = `rl:${policy.key}:${ip}`;
    const windowSecs = Math.ceil(policy.windowMs / 1000);

    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, windowSecs);
    }

    const remaining = Math.max(0, policy.limit - count);
    const allowed = count <= policy.limit;

    let retryAfterSec = 0;
    if (!allowed) {
      const ttl = await redis.ttl(redisKey);
      retryAfterSec = ttl > 0 ? ttl : windowSecs;
    }

    return { allowed, retryAfterSec, remaining };
  } catch (err) {
    // If Redis is down, DENY by default (fail-closed for security routes)
    logger.error('Rate limiter Redis error — denying request (fail-closed)', {
      policyKey,
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return { allowed: false, retryAfterSec: 60, remaining: 0 };
  }
}

/**
 * Generate a 429 Too Many Requests response.
 */
export function rateLimitResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
      },
    }
  );
}
