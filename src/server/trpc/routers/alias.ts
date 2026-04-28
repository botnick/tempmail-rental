/**
 * Mailbox Alias tRPC Router
 *
 * Lets users create and manage aliases for their mailboxes.
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import { QuotaService } from '../../services/quota.service';
import { QuotaExceededError } from '../../lib/errors';

export const aliasRouter = router({
  /** List aliases for a mailbox */
  list: protectedProcedure
    .input(z.object({ mailboxId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const mailbox = await ctx.prisma.mailbox.findFirst({
        where: { id: input.mailboxId, userId: ctx.session.userId, deletedAt: null },
      });

      if (!mailbox) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Mailbox not found' });
      }

      return ctx.prisma.mailboxAlias.findMany({
        where: { mailboxId: input.mailboxId },
        orderBy: { createdAt: 'desc' },
      });
    }),

  /** Create a new alias */
  create: protectedProcedure
    .input(z.object({
      mailboxId: z.string(),
      alias: z.string().email().max(255),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const mailbox = await ctx.prisma.mailbox.findFirst({
        where: { id: input.mailboxId, userId: ctx.session.userId, deletedAt: null },
      });

      if (!mailbox) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Mailbox not found' });
      }

      // Check if alias already exists
      const existing = await ctx.prisma.mailboxAlias.findUnique({
        where: { alias: input.alias },
      });

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Alias already in use' });
      }

      // Plan-driven alias quota.
      try {
        await QuotaService.enforceAliasQuota(ctx.session.userId);
      } catch (err) {
        if (err instanceof QuotaExceededError) {
          throw new TRPCError({ code: 'FORBIDDEN', message: err.message });
        }
        throw err;
      }

      return ctx.prisma.mailboxAlias.create({
        data: {
          mailboxId: input.mailboxId,
          alias: input.alias,
        },
      });
    }),

  /** Delete an alias */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const alias = await ctx.prisma.mailboxAlias.findUnique({
        where: { id: input.id },
        include: { mailbox: { select: { userId: true } } },
      });

      if (!alias || alias.mailbox.userId !== ctx.session.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Alias not found' });
      }

      await ctx.prisma.mailboxAlias.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
