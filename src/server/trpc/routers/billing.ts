import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { BillingService, topupSchema } from '../../services/billing.service';

export const billingRouter = router({
  getWallet: protectedProcedure
    .query(async ({ ctx }) => {
      return BillingService.getWallet(ctx.actor.userId);
    }),

  getLedger: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    }))
    .query(async ({ input, ctx }) => {
      return BillingService.getLedger(ctx.actor.userId, input.page, input.pageSize);
    }),

  createTopup: protectedProcedure
    .input(topupSchema)
    .mutation(async ({ input, ctx }) => {
      return BillingService.createTopup(input, ctx.actor, {
        requestId: ctx.requestId,
      });
    }),
});
