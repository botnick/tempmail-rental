import { z } from 'zod';
import { router } from '../../trpc';
import { permissionProcedure } from '../../trpc';
import { PERMISSIONS } from '../../../policy';
import { MailboxStatus, TopupStatus, PaymentStatus } from '@prisma/client';

export const adminDashboardRouter = router({
  getStats: permissionProcedure(PERMISSIONS.ADMIN_DASHBOARD_VIEW)
    .query(async ({ ctx }) => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        activeToday,
        activeThisMonth,
        totalMailboxes,
        activeMailboxes,
        pendingTopups,
        totalRevenue,
        recentRiskEvents,
      ] = await Promise.all([
        ctx.prisma.user.count({ where: { deletedAt: null } }),
        ctx.prisma.session.count({ where: { lastActiveAt: { gte: oneDayAgo } } }),
        ctx.prisma.session.count({ where: { lastActiveAt: { gte: thirtyDaysAgo } } }),
        ctx.prisma.mailbox.count(),
        ctx.prisma.mailbox.count({ where: { status: MailboxStatus.ACTIVE } }),
        ctx.prisma.topup.count({ where: { status: TopupStatus.PENDING } }),
        ctx.prisma.paymentTransaction.aggregate({
          _sum: { amount: true },
          where: { status: PaymentStatus.SUCCEEDED },
        }),
        ctx.prisma.riskEvent.count({
          where: { createdAt: { gte: oneDayAgo }, resolvedAt: null },
        }),
      ]);

      return {
        users: {
          total: totalUsers,
          dau: activeToday,
          mau: activeThisMonth,
        },
        mailboxes: {
          total: totalMailboxes,
          active: activeMailboxes,
        },
        billing: {
          pendingTopups,
          totalRevenue: totalRevenue._sum.amount?.toString() ?? '0',
        },
        security: {
          unresolvedRiskEvents: recentRiskEvents,
        },
      };
    }),

  getSignupTrend: permissionProcedure(PERMISSIONS.ADMIN_DASHBOARD_VIEW)
    .input(z.object({ days: z.number().int().min(7).max(90).default(30) }))
    .query(async ({ input, ctx }) => {
      const startDate = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const users = await ctx.prisma.user.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      // Group by date
      const trend: Record<string, number> = {};
      for (const u of users) {
        const date = u.createdAt.toISOString().split('T')[0];
        trend[date] = (trend[date] ?? 0) + 1;
      }

      return Object.entries(trend).map(([date, count]) => ({ date, count }));
    }),
});
