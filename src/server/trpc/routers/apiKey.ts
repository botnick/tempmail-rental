/**
 * API Key tRPC Router
 *
 * User-facing API key management.
 * Supports generating, listing, and revoking API keys.
 * Keys are hashed before storage; plaintext is only shown once on creation.
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { prisma } from '@/server/db';
import { hashToken } from '@/server/lib/crypto';
import { TRPCError } from '@trpc/server';
import crypto from 'crypto';

const API_KEY_PREFIX = 'tmr_';

export const apiKeyRouter = router({
  /** List all API keys for the current user */
  list: protectedProcedure.query(async ({ ctx }) => {
    const keys = await prisma.apiKey.findMany({
      where: { userId: ctx.session.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        revokedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    return keys;
  }),

  /** Generate a new API key */
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      expiresInDays: z.number().min(1).max(365).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const rawKey = API_KEY_PREFIX + crypto.randomBytes(32).toString('hex');
      const keyHash = hashToken(rawKey);
      const prefix = rawKey.slice(0, 12) + '...';

      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      // Atomic count+create to prevent race condition exceeding 10-key limit
      const apiKey = await prisma.$transaction(async (tx) => {
        const activeCount = await tx.apiKey.count({
          where: { userId: ctx.session.userId, revokedAt: null },
        });
        if (activeCount >= 10) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Maximum of 10 active API keys allowed',
          });
        }

        return tx.apiKey.create({
          data: {
            userId: ctx.session.userId,
            name: input.name,
            keyHash,
            prefix,
            expiresAt,
          },
        });
      });

      // Return the plaintext key — only shown once
      return {
        id: apiKey.id,
        name: apiKey.name,
        key: rawKey,
        prefix,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      };
    }),

  /** Revoke an API key */
  revoke: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const key = await prisma.apiKey.findFirst({
        where: { id: input.id, userId: ctx.session.userId },
      });

      if (!key) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'API key not found' });
      }
      if (key.revokedAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'API key already revoked' });
      }

      await prisma.apiKey.update({
        where: { id: input.id },
        data: { revokedAt: new Date() },
      });

      return { success: true };
    }),
});
