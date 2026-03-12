import { z } from 'zod';
import { router } from '../../trpc';
import { permissionProcedure } from '../../trpc';
import { PERMISSIONS } from '../../../policy';

export const adminAuditRouter = router({
  list: permissionProcedure(PERMISSIONS.ADMIN_AUDIT_VIEW)
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(50),
      actorId: z.string().optional(),
      action: z.string().optional(),
      targetType: z.string().optional(),
      targetId: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where = {
        ...(input.actorId ? { actorId: input.actorId } : {}),
        ...(input.action ? { action: { contains: input.action } } : {}),
        ...(input.targetType ? { targetType: input.targetType } : {}),
        ...(input.targetId ? { targetId: input.targetId } : {}),
        ...(input.startDate || input.endDate
          ? {
              createdAt: {
                ...(input.startDate ? { gte: new Date(input.startDate) } : {}),
                ...(input.endDate ? { lte: new Date(input.endDate) } : {}),
              },
            }
          : {}),
      };

      const [data, total] = await Promise.all([
        ctx.prisma.auditLog.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            actor: { select: { publicId: true, email: true, displayName: true } },
          },
        }),
        ctx.prisma.auditLog.count({ where }),
      ]);

      return {
        data: data.map((log) => ({
          id: log.id,
          actor: log.actor,
          actorType: log.actorType,
          action: log.action,
          targetType: log.targetType,
          targetId: log.targetId,
          before: log.before,
          after: log.after,
          reason: log.reason,
          ipAddress: log.ipAddress,
          requestId: log.requestId,
          createdAt: log.createdAt,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),
});
