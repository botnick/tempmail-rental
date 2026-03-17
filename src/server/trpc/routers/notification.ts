/**
 * Notification tRPC Router
 *
 * User-facing in-app notification management.
 * Supports listing, marking as read, dismissing, and fetching unread count.
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { prisma } from '@/server/db';
import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';

export const notificationRouter = router({
  /** List notifications for the current user */
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().optional(),
      unreadOnly: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const where: Prisma.NotificationWhereInput = { userId: ctx.session.userId };
      if (input.unreadOnly) where.readAt = null;
      if (input.cursor) {
        const cursorDate = new Date(input.cursor);
        if (isNaN(cursorDate.getTime())) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid cursor' });
        }
        where.createdAt = { lt: cursorDate };
      }

      const items = await prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: input.limit + 1,
      });

      const hasMore = items.length > input.limit;
      const results = hasMore ? items.slice(0, -1) : items;

      return {
        items: results,
        nextCursor: hasMore ? results[results.length - 1]?.createdAt.toISOString() : undefined,
      };
    }),

  /** Get unread notification count */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await prisma.notification.count({
      where: { userId: ctx.session.userId, readAt: null, dismissedAt: null },
    });
    return { count };
  }),

  /** Mark a notification as read */
  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.notification.updateMany({
        where: { id: input.id, userId: ctx.session.userId },
        data: { readAt: new Date() },
      });
      return { success: true };
    }),

  /** Mark all notifications as read */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await prisma.notification.updateMany({
      where: { userId: ctx.session.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }),

  /** Dismiss a notification */
  dismiss: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.notification.updateMany({
        where: { id: input.id, userId: ctx.session.userId },
        data: { dismissedAt: new Date() },
      });
      return { success: true };
    }),
});
