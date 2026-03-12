/**
 * Security Service
 *
 * Handles risk events, abuse detection, and emergency controls.
 * Integrates with audit logging and rate limiting.
 */

import { generateId } from '../lib/id';
import { type PrismaClient, type Prisma, UserStatus } from '@prisma/client';

export function createSecurityService(db: PrismaClient) {
  return {
    /**
     * Log a risk event (brute-force, suspicious signup, etc.)
     */
    async logRiskEvent(data: {
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      ip: string;
      userId?: string;
      metadata?: Record<string, unknown>;
    }) {
      return db.riskEvent.create({
        data: {
          id: generateId('risk'),
          type: data.type,
          severity: data.severity.toUpperCase(),
          ipAddress: data.ip,
          userId: data.userId ?? null,
          metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    },

    /**
     * Get recent risk events
     */
    async getRecentRiskEvents(params: { take: number; severity?: string }) {
      const where: Record<string, unknown> = {};
      if (params.severity) where.severity = params.severity;
      return db.riskEvent.findMany({
        where,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      });
    },

    /**
     * Check if an IP is on the blocklist
     */
    async isIpBlocked(ip: string): Promise<boolean> {
      const recentEvents = await db.riskEvent.count({
        where: {
          ipAddress: ip,
          severity: { in: ['HIGH', 'CRITICAL'] },
          createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      return recentEvents >= 5;
    },

    /**
     * Emergency: revoke all active sessions system-wide
     */
    async revokeAllSessions() {
      return db.session.updateMany({
        where: { revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },

    /**
     * Emergency: disable all non-admin accounts
     */
    async emergencySuspendAllUsers(reason: string) {
      return db.user.updateMany({
        where: {
          status: UserStatus.ACTIVE,
          userRoles: { none: { role: { name: { in: ['SUPER_ADMIN', 'ADMIN'] } } } },
        },
        data: { status: UserStatus.SUSPENDED },
      });
    },

    /**
     * Get failed login attempts for an IP in the last N minutes
     */
    async getFailedLoginCount(ip: string, windowMinutes: number = 15): Promise<number> {
      return db.riskEvent.count({
        where: {
          ipAddress: ip,
          type: 'auth.login_failed',
          createdAt: { gt: new Date(Date.now() - windowMinutes * 60 * 1000) },
        },
      });
    },
  };
}

export type SecurityService = ReturnType<typeof createSecurityService>;
