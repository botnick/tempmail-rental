import { z } from 'zod';
import { router } from '../../trpc';
import { permissionProcedure } from '../../trpc';
import { PERMISSIONS } from '../../../policy';
import { AuditService } from '../../../services/audit.service';

export const adminSecurityRouter = router({
  getRiskEvents: permissionProcedure(PERMISSIONS.ADMIN_SECURITY_VIEW)
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      type: z.string().optional(),
      resolved: z.boolean().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where = {
        ...(input.severity ? { severity: input.severity } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(input.resolved !== undefined
          ? input.resolved
            ? { resolvedAt: { not: null } }
            : { resolvedAt: null }
          : {}),
      };

      const [data, total] = await Promise.all([
        ctx.prisma.riskEvent.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { publicId: true, email: true } } },
        }),
        ctx.prisma.riskEvent.count({ where }),
      ]);

      return { data, total, page: input.page, pageSize: input.pageSize };
    }),

  globalRevokeSessions: permissionProcedure(PERMISSIONS.ADMIN_SECURITY_REVOKE_SESSIONS)
    .input(z.object({ reason: z.string().min(10) }))
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.prisma.session.updateMany({
        where: { revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await AuditService.logAdminAction({
        adminId: ctx.actor!.userId,
        action: 'admin.security.global_revoke_sessions',
        reason: input.reason,
        requiresApproval: true,
        metadata: { sessionsRevoked: result.count },
        requestId: ctx.requestId,
        ipAddress: ctx.ip ?? undefined,
      });

      return { sessionsRevoked: result.count };
    }),
});
