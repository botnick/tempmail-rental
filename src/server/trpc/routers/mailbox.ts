import { z } from 'zod';
import {
  router,
  protectedProcedure,
  guestOrAuthedProcedure,
  rateLimitedGuestOrAuthedProcedure,
} from '../trpc';
import {
  MailboxService,
  createMailboxSchema,
  listMailboxesSchema,
} from '../../services/mailbox.service';

export const mailboxRouter = router({
  /**
   * Create a mailbox.
   * - Authed user: uses their plan's quotas + retention.
   * - Guest: 1 active mailbox, 1h retention, scoped to the guest cookie.
   *
   * The route handler that calls this (or the homepage server component) is
   * responsible for appending the new mailbox.publicId into the guest cookie
   * via `addMailboxToPayload` + Set-Cookie.
   */
  create: rateLimitedGuestOrAuthedProcedure('guest.mailbox.create')
    .input(createMailboxSchema)
    .mutation(async ({ input, ctx }) => {
      return MailboxService.createBySubject(input, ctx.subject, {
        ip: ctx.ip ?? undefined,
        requestId: ctx.requestId,
      });
    }),

  list: guestOrAuthedProcedure
    .input(listMailboxesSchema)
    .query(async ({ input, ctx }) => {
      return MailboxService.listBySubject(ctx.subject, input);
    }),

  getMessages: rateLimitedGuestOrAuthedProcedure('guest.mailbox.read')
    .input(z.object({ mailboxId: z.string() }))
    .query(async ({ input, ctx }) => {
      return MailboxService.getMessagesBySubject(input.mailboxId, ctx.subject);
    }),

  delete: guestOrAuthedProcedure
    .input(z.object({ mailboxId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const result = await MailboxService.deleteBySubject(input.mailboxId, ctx.subject, {
        requestId: ctx.requestId,
      });
      return { success: true, publicId: result.publicId };
    }),

  extendTTL: guestOrAuthedProcedure
    .input(
      z.object({
        mailboxId: z.string(),
        hours: z.number().int().min(1).max(720),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return MailboxService.extendTTLBySubject(input.mailboxId, input.hours, ctx.subject);
    }),
});
