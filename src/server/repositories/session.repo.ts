/**
 * Session Repository — Data Access Layer
 */

import { PrismaClient } from '@prisma/client';

export function createSessionRepository(db: PrismaClient) {
  return {
    async create(data: {
      id: string;
      userId: string;
      tokenHash: string;
      refreshTokenHash: string;
      ipAddress?: string;
      userAgent?: string;
      expiresAt: Date;
      isAdmin?: boolean;
    }) {
      return db.session.create({ data });
    },

    async findByTokenHash(tokenHash: string) {
      return db.session.findFirst({
        where: { tokenHash, revokedAt: null },
        include: { user: true },
      });
    },

    async findByRefreshTokenHash(refreshTokenHash: string) {
      return db.session.findFirst({
        where: { refreshTokenHash, revokedAt: null },
      });
    },

    async rotateTokens(id: string, data: {
      tokenHash: string;
      refreshTokenHash: string;
      expiresAt: Date;
    }) {
      return db.session.update({
        where: { id },
        data,
      });
    },

    async revoke(id: string) {
      return db.session.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
    },

    async revokeAllForUser(userId: string) {
      return db.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },

    async deleteExpired() {
      return db.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
    },

    async countActiveForUser(userId: string) {
      return db.session.count({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      });
    },
  };
}

export type SessionRepository = ReturnType<typeof createSessionRepository>;
