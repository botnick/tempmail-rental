import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TempMailService } from '../../services/tempmail.service';
import { TRPCError } from '@trpc/server';
import { prisma } from '../../db';

export const tempmailRouter = router({
  getMessage: protectedProcedure
    .input(z.object({
      messageId: z.string(),
      mailboxPublicId: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const mailbox = await prisma.mailbox.findUnique({
        where: { publicId: input.mailboxPublicId },
      });

      if (!mailbox || mailbox.userId !== ctx.actor.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Mailbox not found' });
      }

      const { externalId } = (mailbox.metadata as any) || {};
      if (!externalId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'TempMail not configured for this mailbox' });
      }

      return TempMailService.getMessage(input.messageId);
    }),

  getAttachmentUrl: protectedProcedure
    .input(z.object({
      attachmentId: z.string(),
      mailboxPublicId: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const mailbox = await prisma.mailbox.findUnique({
        where: { publicId: input.mailboxPublicId },
      });

      if (!mailbox || mailbox.userId !== ctx.actor.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Mailbox not found' });
      }

      return TempMailService.getAttachmentUrl(input.attachmentId);
    }),

  listDomains: protectedProcedure
    .query(async () => {
      const result = await TempMailService.listDomains();
      return result.domains.filter((d) => d.isPublic);
    }),

  deleteMessage: protectedProcedure
    .input(z.object({
      messageId: z.string(),
      mailboxPublicId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const mailbox = await prisma.mailbox.findUnique({
        where: { publicId: input.mailboxPublicId },
      });

      if (!mailbox || mailbox.userId !== ctx.actor.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Mailbox not found' });
      }

      return TempMailService.deleteMessage(input.messageId);
    }),
});
