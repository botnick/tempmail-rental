import { router, protectedProcedure } from '../trpc';
import { DomainService, createDomainSchema, verifyDomainSchema } from '../../services/domain.service';

export const domainRouter = router({
  create: protectedProcedure
    .input(createDomainSchema)
    .mutation(async ({ input, ctx }) => {
      return DomainService.create(input, ctx.actor, {
        requestId: ctx.requestId,
      });
    }),

  list: protectedProcedure
    .query(async ({ ctx }) => {
      return DomainService.listByUser(ctx.actor.userId);
    }),

  verify: protectedProcedure
    .input(verifyDomainSchema)
    .mutation(async ({ input, ctx }) => {
      return DomainService.verify(input.domainId, ctx.actor);
    }),
});
