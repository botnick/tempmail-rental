/**
 * Audit Repository
 */

import { PrismaClient } from '@prisma/client';

export function createAuditRepository(db: PrismaClient) {
  return {
    async create(data: {
      id: string; actorId: string | null; actorIp: string;
      action: string; targetType: string; targetId: string | null;
      before: unknown; after: unknown; metadata: unknown; requestId: string;
    }) {
      return db.auditLog.create({ data: data as any });
    },

    async findMany(params: {
      skip: number; take: number;
      action?: string; targetType?: string; actorId?: string;
      from?: Date; to?: Date;
    }) {
      const where: Record<string, unknown> = {};
      if (params.action) where.action = { contains: params.action };
      if (params.targetType) where.targetType = params.targetType;
      if (params.actorId) where.actorId = params.actorId;
      if (params.from || params.to) {
        where.timestamp = {};
        if (params.from) (where.timestamp as any).gte = params.from;
        if (params.to) (where.timestamp as any).lte = params.to;
      }
      return db.auditLog.findMany({
        where, skip: params.skip, take: params.take,
        orderBy: { createdAt: 'desc' },
      });
    },

    async count(params: { action?: string; targetType?: string; actorId?: string }) {
      const where: Record<string, unknown> = {};
      if (params.action) where.action = { contains: params.action };
      if (params.targetType) where.targetType = params.targetType;
      if (params.actorId) where.actorId = params.actorId;
      return db.auditLog.count({ where });
    },
  };
}

export type AuditRepository = ReturnType<typeof createAuditRepository>;
