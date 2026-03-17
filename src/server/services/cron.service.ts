/**
 * Cron Service — Periodic Maintenance Tasks
 *
 * Handles scheduled cleanup:
 * - Expired mailbox deletion
 * - Stale session cleanup
 * - Expired verification token cleanup
 */

import { prisma } from '../db';
import { logger } from '../lib/logger';

export const CronService = {
  /**
   * Delete mailboxes past their expiry date.
   * Also calls external API to remove the mailbox if applicable.
   */
  async cleanupExpiredMailboxes(): Promise<{ deleted: number }> {
    const now = new Date();

    const expired = await prisma.mailbox.findMany({
      where: {
        expiresAt: { lt: now },
        deletedAt: null,
      },
      select: { id: true, address: true },
    });

    if (expired.length === 0) {
      logger.info('[cron] No expired mailboxes to clean up');
      return { deleted: 0 };
    }

    // Soft-delete expired mailboxes
    const result = await prisma.mailbox.updateMany({
      where: {
        id: { in: expired.map((m) => m.id) },
        deletedAt: null,
      },
      data: { deletedAt: now },
    });

    logger.info('[cron] Cleaned up expired mailboxes', {
      count: result.count,
      addresses: expired.map((m) => m.address),
    });

    return { deleted: result.count };
  },

  /**
   * Revoke sessions that have expired (past expiresAt).
   */
  async cleanupExpiredSessions(): Promise<{ revoked: number }> {
    const now = new Date();

    const result = await prisma.session.updateMany({
      where: {
        expiresAt: { lt: now },
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    if (result.count > 0) {
      logger.info('[cron] Revoked expired sessions', { count: result.count });
    }

    return { revoked: result.count };
  },

  /**
   * Delete used or expired verification tokens older than 24 hours.
   */
  async cleanupExpiredTokens(): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await prisma.verificationToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null }, createdAt: { lt: cutoff } },
        ],
      },
    });

    if (result.count > 0) {
      logger.info('[cron] Deleted expired/used verification tokens', { count: result.count });
    }

    return { deleted: result.count };
  },

  /**
   * Run all maintenance tasks.
   */
  async runAll(): Promise<{
    mailboxes: { deleted: number };
    sessions: { revoked: number };
    tokens: { deleted: number };
  }> {
    const [mailboxes, sessions, tokens] = await Promise.allSettled([
      this.cleanupExpiredMailboxes(),
      this.cleanupExpiredSessions(),
      this.cleanupExpiredTokens(),
    ]);

    return {
      mailboxes: mailboxes.status === 'fulfilled' ? mailboxes.value : { deleted: 0 },
      sessions: sessions.status === 'fulfilled' ? sessions.value : { revoked: 0 },
      tokens: tokens.status === 'fulfilled' ? tokens.value : { deleted: 0 },
    };
  },
};
