import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { MailboxService, createMailboxSchema, listMailboxesSchema } from '../../services/mailbox.service';

export const mailboxRouter = router({
  create: protectedProcedure
    .input(createMailboxSchema)
    .mutation(async ({ input, ctx }) => {
      return MailboxService.create(input, ctx.actor, {
        ip: ctx.ip ?? undefined,
        requestId: ctx.requestId,
      });
    }),

  list: protectedProcedure
    .input(listMailboxesSchema)
    .query(async ({ input, ctx }) => {
      return MailboxService.listByUser(ctx.actor.userId, input);
    }),

  getMessages: protectedProcedure
    .input(z.object({ mailboxId: z.string() }))
    .query(async ({ input, ctx }) => {
      return MailboxService.getMessages(input.mailboxId, ctx.actor.userId);
    }),

  delete: protectedProcedure
    .input(z.object({ mailboxId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await MailboxService.delete(input.mailboxId, ctx.actor, {
        requestId: ctx.requestId,
      });
      return { success: true };
    }),

  extendTTL: protectedProcedure
    .input(z.object({
      mailboxId: z.string(),
      hours: z.number().int().min(1).max(720),
    }))
    .mutation(async ({ input, ctx }) => {
      return MailboxService.extendTTL(input.mailboxId, input.hours, ctx.actor);
    }),
});
