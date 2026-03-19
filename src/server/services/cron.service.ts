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
import { TempMailService } from './tempmail.service';
import { MailboxStatus } from '@prisma/client';

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
   * Reconcile mailboxes: detect ones deleted from Go backend
   * and auto-mark them as EXPIRED locally.
   * Processes in batches to avoid hammering the external API.
   */
  async reconcileOrphanedMailboxes(): Promise<{ synced: number }> {
    const activeMailboxes = await prisma.mailbox.findMany({
      where: {
        status: MailboxStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true, address: true, metadata: true },
      take: 50, // cap per run to limit API calls
    });

    let synced = 0;

    for (const mb of activeMailboxes) {
      const { externalId } = (mb.metadata as any) || {};
      if (!externalId) continue;

      try {
        await TempMailService.getMailbox(externalId);
      } catch (err: any) {
        if (err?.code === 'NOT_FOUND') {
          logger.info('[cron] Orphaned mailbox found, marking expired', {
            mailboxId: mb.id,
            address: mb.address,
            externalId,
          });

          await prisma.mailbox.update({
            where: { id: mb.id },
            data: { status: MailboxStatus.EXPIRED, deletedAt: new Date() },
          });

          await prisma.mailboxEvent.create({
            data: {
              mailboxId: mb.id,
              type: 'expired',
              metadata: { reason: 'reconcile_orphaned' },
            },
          });

          synced++;
        }
        // Other errors (timeout, 500): skip this mailbox, try next run
      }

      // Small delay to avoid hammering the Go backend
      await new Promise((r) => setTimeout(r, 200));
    }

    if (synced > 0) {
      logger.info('[cron] Reconciled orphaned mailboxes', { synced });
    }

    return { synced };
  },

  /**
   * Run all maintenance tasks.
   */
  async runAll(): Promise<{
    mailboxes: { deleted: number };
    sessions: { revoked: number };
    tokens: { deleted: number };
    orphaned: { synced: number };
  }> {
    const [mailboxes, sessions, tokens, orphaned] = await Promise.allSettled([
      this.cleanupExpiredMailboxes(),
      this.cleanupExpiredSessions(),
      this.cleanupExpiredTokens(),
      this.reconcileOrphanedMailboxes(),
    ]);

    return {
      mailboxes: mailboxes.status === 'fulfilled' ? mailboxes.value : { deleted: 0 },
      sessions: sessions.status === 'fulfilled' ? sessions.value : { revoked: 0 },
      tokens: tokens.status === 'fulfilled' ? tokens.value : { deleted: 0 },
      orphaned: orphaned.status === 'fulfilled' ? orphaned.value : { synced: 0 },
    };
  },
};
