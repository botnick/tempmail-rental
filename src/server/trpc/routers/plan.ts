import { router, publicProcedure, protectedProcedure } from '../trpc';
import { PlanService } from '../../services/plan.service';

export const planRouter = router({
  list: publicProcedure
    .query(async () => {
      return PlanService.listPublicPlans();
    }),

  mySubscription: protectedProcedure
    .query(async ({ ctx }) => {
      return PlanService.getUserSubscription(ctx.actor.userId);
    }),
});
