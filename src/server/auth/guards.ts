/**
 * Auth Guards — Additional security checks beyond basic auth
 *
 * These are used in tRPC middleware chain for extra validation
 */

import { TRPCError } from '@trpc/server';

/**
 * Guard: Account must not be suspended
 */
export function guardAccountActive(status: string): void {
  if (status === 'SUSPENDED') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Account suspended',
    });
  }
  if (status === 'BANNED') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Account banned',
    });
  }
  if (status === 'DEACTIVATED') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Account deactivated',
    });
  }
}

/**
 * Guard: Must be email-verified for sensitive operations
 */
export function guardEmailVerified(emailVerified: boolean): void {
  if (!emailVerified) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Email verification required',
    });
  }
}

/**
 * Guard: Must own the resource
 */
export function guardOwnership(
  resourceOwnerId: string,
  actorId: string
): void {
  if (resourceOwnerId !== actorId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Access denied',
    });
  }
}

/**
 * Guard: Rate limit check (to be wired with Redis)
 */
export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
  remaining: number;
}
