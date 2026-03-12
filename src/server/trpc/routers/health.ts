import { router, publicProcedure } from '../trpc';

export const healthRouter = router({
  check: publicProcedure.query(async ({ ctx }) => {
    const checks: Record<string, string> = {};

    // DB check
    try {
      await ctx.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    const allOk = Object.values(checks).every((v) => v === 'ok');

    return {
      status: allOk ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
  }),
});
