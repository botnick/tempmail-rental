/**
 * Step-Up Auth & Admin Re-Authentication
 *
 * Provides additional security for sensitive operations:
 * 1. Step-Up Auth: Requires recent authentication for high-risk actions
 * 2. Admin Re-Auth: Forces admin to re-enter password before destructive actions
 *
 * Uses session lastActiveAt + fresh password verification.
 */

import { prisma } from '../db';
import argon2 from 'argon2';
import { TRPCError } from '@trpc/server';
import { AuditService } from './audit.service';
import { logger } from '../lib/logger';
import { middleware } from '../trpc/trpc';

const STEP_UP_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verify if the current session is "fresh" enough for sensitive actions.
 * A session is fresh if it was authenticated within STEP_UP_MAX_AGE_MS.
 */
export function isSessionFresh(sessionCreatedAt: Date): boolean {
  return Date.now() - sessionCreatedAt.getTime() < STEP_UP_MAX_AGE_MS;
}

/**
 * Step-up auth guard.
 * Throws if the session is too old for the requested operation.
 */
export function guardStepUp(sessionCreatedAt: Date): void {
  if (!isSessionFresh(sessionCreatedAt)) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'This action requires recent authentication. Please re-authenticate.',
    });
  }
}

/**
 * Re-authenticate an admin by verifying their password.
 * Returns a short-lived "elevated" token in the session.
 */
export async function reAuthenticate(
  userId: string,
  password: string,
  meta?: { ip?: string; requestId?: string }
): Promise<{ elevated: boolean; elevatedUntil: Date }> {
  const credential = await prisma.userCredential.findUnique({
    where: { userId },
  });

  if (!credential) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Credential not found',
    });
  }

  const valid = await argon2.verify(credential.passwordHash, password);
  if (!valid) {
    await AuditService.log({
      actorId: userId,
      actorType: 'admin',
      action: 'admin.reauth.failed',
      targetType: 'user',
      targetId: userId,
      ipAddress: meta?.ip,
      requestId: meta?.requestId,
    });

    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid password',
    });
  }

  const elevatedUntil = new Date(Date.now() + STEP_UP_MAX_AGE_MS);

  await AuditService.log({
    actorId: userId,
    actorType: 'admin',
    action: 'admin.reauth.success',
    targetType: 'user',
    targetId: userId,
    ipAddress: meta?.ip,
    requestId: meta?.requestId,
  });

  logger.info('Admin re-authentication successful', { userId });

  return { elevated: true, elevatedUntil };
}

/**
 * tRPC middleware factory for step-up auth.
 * Requires the session to be recently created.
 *
 * Usage in router:
 *   stepUpProcedure.mutation(...)
 */
export const stepUpMiddleware = middleware(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  // Query session from DB to check createdAt
  const session = await prisma.session.findUnique({
    where: { id: ctx.session.sessionId },
    select: { createdAt: true },
  });

  if (!session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Session not found',
    });
  }

  guardStepUp(session.createdAt);

  return next({ ctx });
});
