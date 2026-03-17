import { z } from 'zod';
import { router } from '../../trpc';
import { permissionProcedure } from '../../trpc';
import { PERMISSIONS } from '../../../policy';
import { AuditService } from '../../../services/audit.service';
import { NotFoundError } from '../../../lib/errors';
import { UserStatus, SubscriptionStatus } from '@prisma/client';

export const adminUserRouter = router({
  list: permissionProcedure(PERMISSIONS.ADMIN_USER_VIEW)
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED', 'PENDING_VERIFICATION', 'DEACTIVATED']).optional(),
      role: z.string().optional(),
      sortBy: z.enum(['createdAt', 'email', 'displayName']).default('createdAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    }))
    .query(async ({ input, ctx }) => {
      const where = {
        deletedAt: null,
        ...(input.search
          ? {
              OR: [
                { email: { contains: input.search, mode: 'insensitive' as const } },
                { displayName: { contains: input.search, mode: 'insensitive' as const } },
                { publicId: { contains: input.search } },
              ],
            }
          : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.role
          ? { userRoles: { some: { role: { name: input.role } } } }
          : {}),
      };

      const [data, total] = await Promise.all([
        ctx.prisma.user.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: { [input.sortBy]: input.sortOrder },
          include: {
            userRoles: { include: { role: { select: { name: true, displayName: true } } } },
            subscriptions: {
              where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] } },
              include: { plan: { select: { name: true, slug: true } } },
              take: 1,
            },
            _count: { select: { mailboxes: true, sessions: true } },
          },
        }),
        ctx.prisma.user.count({ where }),
      ]);

      return {
        data: data.map((u) => ({
          id: u.publicId,
          internalId: u.id,
          email: u.email,
          displayName: u.displayName,
          status: u.status,
          roles: u.userRoles.map((ur) => ur.role),
          plan: u.subscriptions[0]?.plan ?? null,
          mailboxCount: u._count.mailboxes,
          sessionCount: u._count.sessions,
          createdAt: u.createdAt,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  getProfile: permissionProcedure(PERMISSIONS.ADMIN_USER_VIEW)
    .input(z.object({ userId: z.string() }))
    .query(async ({ input, ctx }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { publicId: input.userId },
        include: {
          userRoles: { include: { role: true } },
          subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' } },
          wallet: true,
          _count: { select: { mailboxes: true, auditLogs: true } },
        },
      });

      if (!user) throw new NotFoundError('User');

      return {
        id: user.publicId,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
        emailVerifiedAt: user.emailVerifiedAt,
        roles: user.userRoles.map((ur) => ({
          name: ur.role.name,
          displayName: ur.role.displayName,
          grantedAt: ur.grantedAt,
        })),
        subscriptions: user.subscriptions.map((s) => ({
          plan: s.plan.name,
          status: s.status,
          periodEnd: s.currentPeriodEnd,
        })),
        wallet: user.wallet
          ? { balance: user.wallet.balance.toString(), currency: user.wallet.currency }
          : null,
        stats: {
          mailboxCount: user._count.mailboxes,
          auditLogCount: user._count.auditLogs,
        },
        createdAt: user.createdAt,
        metadata: user.metadata,
      };
    }),

  suspend: permissionProcedure(PERMISSIONS.ADMIN_USER_MANAGE)
    .input(z.object({
      userId: z.string(),
      reason: z.string().min(5, 'Reason required for destructive actions'),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.prisma.user.findUnique({ where: { publicId: input.userId } });
      if (!user) throw new NotFoundError('User');

      const before = { status: user.status };

      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.SUSPENDED },
      });

      // Revoke all sessions
      await ctx.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await AuditService.logAdminAction({
        adminId: ctx.actor!.userId,
        action: 'admin.user.suspend',
        targetType: 'user',
        targetId: user.id,
        reason: input.reason,
        metadata: { before, after: { status: UserStatus.SUSPENDED } },
        requestId: ctx.requestId,
        ipAddress: ctx.ip ?? undefined,
      });

      return { success: true };
    }),

  unsuspend: permissionProcedure(PERMISSIONS.ADMIN_USER_MANAGE)
    .input(z.object({
      userId: z.string(),
      reason: z.string().min(5),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.prisma.user.findUnique({ where: { publicId: input.userId } });
      if (!user) throw new NotFoundError('User');

      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.ACTIVE },
      });

      await AuditService.logAdminAction({
        adminId: ctx.actor!.userId,
        action: 'admin.user.unsuspend',
        targetType: 'user',
        targetId: user.id,
        reason: input.reason,
        requestId: ctx.requestId,
      });

      return { success: true };
    }),

  assignRole: permissionProcedure(PERMISSIONS.ADMIN_USER_MANAGE)
    .input(z.object({
      userId: z.string(),
      roleName: z.string(),
      reason: z.string().min(5),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.prisma.user.findUnique({ where: { publicId: input.userId } });
      if (!user) throw new NotFoundError('User');

      const role = await ctx.prisma.role.findUnique({ where: { name: input.roleName } });
      if (!role) throw new NotFoundError('Role');

      await ctx.prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: {
          userId: user.id,
          roleId: role.id,
          grantedBy: ctx.actor!.userId,
        },
      });

      await AuditService.logAdminAction({
        adminId: ctx.actor!.userId,
        action: 'admin.user.assign_role',
        targetType: 'user',
        targetId: user.id,
        reason: input.reason,
        metadata: { roleName: input.roleName },
        requestId: ctx.requestId,
      });

      return { success: true };
    }),

  grantCredits: permissionProcedure(PERMISSIONS.ADMIN_USER_MANAGE)
    .input(z.object({
      userId: z.string(),
      amount: z.number().positive(),
      reason: z.string().min(5),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.prisma.user.findUnique({ where: { publicId: input.userId } });
      if (!user) throw new NotFoundError('User');

      const { BillingService } = await import('../../../services/billing.service');
      await BillingService.creditWallet({
        userId: user.id,
        amount: input.amount,
        description: `Admin credit grant: ${input.reason}`,
        referenceType: 'admin_grant',
        referenceId: ctx.actor!.userId,
        idempotencyKey: `admin_grant_${ctx.requestId}`,
        createdBy: ctx.actor!.userId,
      });

      await AuditService.logAdminAction({
        adminId: ctx.actor!.userId,
        action: 'admin.user.grant_credits',
        targetType: 'user',
        targetId: user.id,
        reason: input.reason,
        metadata: { amount: input.amount },
        requestId: ctx.requestId,
      });

      return { success: true };
    }),

  forceLogout: permissionProcedure(PERMISSIONS.ADMIN_USER_MANAGE)
    .input(z.object({
      userId: z.string(),
      reason: z.string().min(5),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.prisma.user.findUnique({ where: { publicId: input.userId } });
      if (!user) throw new NotFoundError('User');

      await ctx.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await AuditService.logAdminAction({
        adminId: ctx.actor!.userId,
        action: 'admin.user.force_logout',
        targetType: 'user',
        targetId: user.id,
        reason: input.reason,
        requestId: ctx.requestId,
      });

      return { success: true };
    }),
});
