import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { PlanService } from '../../services/plan.service';

export const planRouter = router({
  list: publicProcedure.query(async () => {
    return PlanService.listPublicPlans();
  }),

  mySubscription: protectedProcedure.query(async ({ ctx }) => {
    return PlanService.getUserSubscription(ctx.actor.userId);
  }),

  /**
   * Subscribe to a plan.
   *
   * Free plan → immediately ACTIVE.
   * Paid plan → subscription created PAUSED + a PENDING topup. Admin marks
   * the topup completed in /admin/billing to activate.
   */
  subscribe: protectedProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        currency: z.string().min(3).max(3).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return PlanService.subscribe(ctx.actor.userId, input.slug, {
        ip: ctx.ip ?? undefined,
        requestId: ctx.requestId,
        currency: input.currency,
      });
    }),

  cancel: protectedProcedure.mutation(async ({ ctx }) => {
    return PlanService.cancelSubscription(ctx.actor.userId, {
      ip: ctx.ip ?? undefined,
      requestId: ctx.requestId,
    });
  }),
});
