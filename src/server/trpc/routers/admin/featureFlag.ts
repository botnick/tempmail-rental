import { z } from 'zod';
import { router } from '../../trpc';
import { permissionProcedure } from '../../trpc';
import { PERMISSIONS } from '../../../policy';
import { AuditService } from '../../../services/audit.service';

export const adminFeatureFlagRouter = router({
  list: permissionProcedure(PERMISSIONS.ADMIN_FF_LIST)
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

  create: permissionProcedure(PERMISSIONS.ADMIN_FF_CREATE)
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

  update: permissionProcedure(PERMISSIONS.ADMIN_FF_EDIT)
    .input(z.object({
      id: z.string(),
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
});
