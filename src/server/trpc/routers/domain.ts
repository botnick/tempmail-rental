import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { DomainService, createDomainSchema, verifyDomainSchema, checkDnsSchema } from '../../services/domain.service';

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

  checkDns: protectedProcedure
    .input(checkDnsSchema)
    .query(async ({ input, ctx }) => {
      return DomainService.checkDns(input.domainId, ctx.actor);
    }),

  delete: protectedProcedure
    .input(z.object({ domainId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return DomainService.delete(input.domainId, ctx.actor, {
        requestId: ctx.requestId,
      });
    }),
});

