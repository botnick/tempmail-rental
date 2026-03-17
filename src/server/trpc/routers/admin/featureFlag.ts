import { z } from 'zod';
import { router } from '../../trpc';
import { permissionProcedure } from '../../trpc';
import { PERMISSIONS } from '../../../policy';
import { AuditService } from '../../../services/audit.service';

export const adminFeatureFlagRouter = router({
  list: permissionProcedure(PERMISSIONS.ADMIN_FF_MANAGE)
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(50),
      search: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where = input.search
        ? {
            OR: [
              { key: { contains: input.search, mode: 'insensitive' as const } },
              { name: { contains: input.search, mode: 'insensitive' as const } },
            ],
          }
        : {};

      const [data, total] = await Promise.all([
        ctx.prisma.featureFlag.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: { key: 'asc' },
        }),
        ctx.prisma.featureFlag.count({ where }),
      ]);

      return { data, total, page: input.page, pageSize: input.pageSize };
    }),

  create: permissionProcedure(PERMISSIONS.ADMIN_FF_MANAGE)
    .input(z.object({
      key: z.string().min(2).max(100).regex(/^[a-z0-9._-]+$/),
      name: z.string().min(2).max(200),
      description: z.string().optional(),
      enabled: z.boolean().default(false),
      rolloutPct: z.number().int().min(0).max(100).default(0),
      targetRoles: z.array(z.string()).optional(),
      targetPlans: z.array(z.string()).optional(),
      targetUsers: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const flag = await ctx.prisma.featureFlag.create({
        data: {
          ...input,
          updatedBy: ctx.actor!.userId,
        },
      });

      await AuditService.logAdminAction({
        adminId: ctx.actor!.userId,
        action: 'admin.feature_flag.create',
        targetType: 'feature_flag',
        targetId: flag.id,
        reason: `Created feature flag: ${input.key}`,
        metadata: input,
        requestId: ctx.requestId,
      });

      return flag;
    }),

  update: permissionProcedure(PERMISSIONS.ADMIN_FF_MANAGE)
    .input(z.object({
      id: z.string(),
      name: z.string().min(2).max(200).optional(),
      description: z.string().optional(),
      enabled: z.boolean().optional(),
      rolloutPct: z.number().int().min(0).max(100).optional(),
      targetRoles: z.array(z.string()).optional(),
      targetPlans: z.array(z.string()).optional(),
      targetUsers: z.array(z.string()).optional(),
      reason: z.string().min(5),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, reason, ...data } = input;

      const before = await ctx.prisma.featureFlag.findUnique({ where: { id } });

      const flag = await ctx.prisma.featureFlag.update({
        where: { id },
        data: { ...data, updatedBy: ctx.actor!.userId },
      });

      await AuditService.logAdminAction({
        adminId: ctx.actor!.userId,
        action: 'admin.feature_flag.update',
        targetType: 'feature_flag',
        targetId: flag.id,
        reason,
        metadata: { before, after: data },
        requestId: ctx.requestId,
      });

      return flag;
    }),

  delete: permissionProcedure(PERMISSIONS.ADMIN_FF_MANAGE)
    .input(z.object({ id: z.string(), reason: z.string().min(5) }))
    .mutation(async ({ input, ctx }) => {
      const flag = await ctx.prisma.featureFlag.findUnique({ where: { id: input.id } });
      if (!flag) throw new Error('Feature flag not found');

      await ctx.prisma.featureFlag.delete({ where: { id: input.id } });

      await AuditService.logAdminAction({
        adminId: ctx.actor!.userId,
        action: 'admin.feature_flag.delete',
        targetType: 'feature_flag',
        targetId: input.id,
        reason: input.reason,
        metadata: { deletedFlag: flag },
        requestId: ctx.requestId,
      });

      return { success: true };
    }),

  /** Returns available plans, roles, users, feature keys, and currencies for auto-suggestions */
  listOptions: permissionProcedure(PERMISSIONS.ADMIN_FF_MANAGE)
    .query(async ({ ctx }) => {
      const [plans, roles, users, dbFeatureKeys, dbCurrencies] = await Promise.all([
        ctx.prisma.plan.findMany({
          where: { status: 'ACTIVE' },
          select: { slug: true, name: true },
          orderBy: { sortOrder: 'asc' },
        }),
        ctx.prisma.role.findMany({
          select: { name: true, displayName: true },
          orderBy: { name: 'asc' },
        }),
        ctx.prisma.user.findMany({
          select: { id: true, email: true, displayName: true },
          orderBy: { email: 'asc' },
          take: 200,
        }),
        // Distinct feature keys from DB — labels come from frontend dictionaries
        ctx.prisma.planFeature.findMany({
          select: { featureKey: true, valueType: true },
          distinct: ['featureKey'],
          orderBy: { featureKey: 'asc' },
        }),
        // Distinct currencies from DB
        ctx.prisma.planPricing.findMany({
          select: { currency: true },
          distinct: ['currency'],
          orderBy: { currency: 'asc' },
        }),
      ]);

      // Raw feature keys — just key + valueType from DB, no hardcoded labels
      const featureKeys = dbFeatureKeys.map((fk) => ({
        key: fk.featureKey,
        valueType: fk.valueType || 'number',
      }));

      // Raw currencies from DB
      const currencies = dbCurrencies.map((c) => c.currency);

      return { plans, roles, users, featureKeys, currencies };
    }),
});

