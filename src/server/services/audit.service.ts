import { prisma } from '../db';
import type { Prisma } from '@prisma/client';
import type { AuditEventPayload } from '../lib/types';
import { logger } from '../lib/logger';

/**
 * Audit Service — immutable audit log writer.
 * Every critical action in the system must emit an audit event through this service.
 *
 * What to log: login, logout, create/delete resources, admin actions, billing events,
 *   permission changes, suspensions, config changes, security events.
 *
 * What NOT to log: read-only queries, health checks, static asset requests.
 */
export const AuditService = {
  async log(payload: AuditEventPayload): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: payload.actorId,
          actorType: payload.actorType,
          action: payload.action,
          targetType: payload.targetType,
          targetId: payload.targetId,
          before: (payload.before ?? undefined) as Prisma.InputJsonValue | undefined,
          after: (payload.after ?? undefined) as Prisma.InputJsonValue | undefined,
          metadata: (payload.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          ipAddress: payload.ipAddress,
          userAgent: payload.userAgent,
          requestId: payload.requestId,
          reason: payload.reason,
        },
      });
    } catch (error) {
      // Audit logging failures must never crash the main flow.
      // Log the failure and alert — but complete the user's request.
      logger.error('Failed to write audit log', {
        error: error as Error,
        action: payload.action,
        actorId: payload.actorId ?? undefined,
      });
    }
  },

  /** Convenience: log an admin action with mandatory reason */
  async logAdminAction(params: {
    adminId: string;
    action: string;
    targetType?: string;
    targetId?: string;
    reason: string;
    requiresApproval?: boolean;
    metadata?: Record<string, unknown>;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await prisma.adminAction.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        reason: params.reason,
        requiresApproval: params.requiresApproval ?? false,
        metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    await this.log({
      actorId: params.adminId,
      actorType: 'admin',
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      requestId: params.requestId,
      reason: params.reason,
    });
  },
};
