/**
 * Support Notes Admin tRPC Router
 *
 * Admin CRUD for internal support notes attached to users.
 */

import { z } from 'zod';
import { adminProcedure, router } from '../../trpc';
import { TRPCError } from '@trpc/server';

export const supportNotesRouter = router({
  /** List notes for a specific user */
  list: adminProcedure
    .input(z.object({
      userId: z.string(),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const { userId, page, pageSize } = input;

      const [notes, total] = await Promise.all([
        ctx.prisma.supportNote.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        ctx.prisma.supportNote.count({ where: { userId } }),
      ]);

      return { data: notes, total, page, pageSize };
    }),

  /** Create a new note */
  create: adminProcedure
    .input(z.object({
      userId: z.string(),
      content: z.string().min(1).max(5000),
      type: z.enum(['note', 'escalation', 'resolution']).default('note'),
    }))
    .mutation(async ({ ctx, input }) => {
      const note = await ctx.prisma.supportNote.create({
        data: {
          userId: input.userId,
          authorId: ctx.session.userId,
          content: input.content,
          type: input.type,
        },
      });
      return note;
    }),

  /** Update a note */
  update: adminProcedure
    .input(z.object({
      id: z.string(),
      content: z.string().min(1).max(5000),
      type: z.enum(['note', 'escalation', 'resolution']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const note = await ctx.prisma.supportNote.findUnique({
        where: { id: input.id },
      });

      if (!note) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Note not found' });
      }

      // Only the author can edit their own notes
      if (note.authorId !== ctx.session.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Can only edit own notes' });
      }

      return ctx.prisma.supportNote.update({
        where: { id: input.id },
        data: {
          content: input.content,
          ...(input.type && { type: input.type }),
        },
      });
    }),

  /** Delete a note */
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const note = await ctx.prisma.supportNote.findUnique({
        where: { id: input.id },
      });

      if (!note) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Note not found' });
      }

      await ctx.prisma.supportNote.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
