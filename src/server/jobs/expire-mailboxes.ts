/**
 * Expire mailboxes whose retention window has elapsed.
 *
 * Run periodically via /api/cron/expire (CRON_SECRET-gated). Mark every ACTIVE
 * mailbox with `expiresAt < now` as EXPIRED, emit a MailboxEvent, and best-effort
 * notify the Go backend to purge.
 *
 * Idempotent — re-runs are safe (already-expired rows are skipped by the WHERE
 * clause on status).
 */
import { prisma } from '../db';
import { TempMailService } from '../services/tempmail.service';
import { logger } from '../lib/logger';
import { MailboxStatus } from '@prisma/client';

export interface ExpireResult {
  scanned: number;
  expired: number;
  externalPurges: { ok: number; failed: number };
}

const BATCH_SIZE = 100;

export async function expireMailboxes(): Promise<ExpireResult> {
  const now = new Date();
  let expired = 0;
  let externalOk = 0;
  let externalFailed = 0;
  let scanned = 0;

  // Process in batches to avoid loading the world.
  // We can't `updateMany` + `findMany` afterwards reliably (race), so we pick
  // and update one batch at a time.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await prisma.mailbox.findMany({
      where: {
        status: MailboxStatus.ACTIVE,
        deletedAt: null,
        expiresAt: { lt: now },
      },
      select: { id: true, publicId: true, metadata: true },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;
    scanned += batch.length;

    for (const m of batch) {
      try {
        await prisma.$transaction([
          prisma.mailbox.update({
            where: { id: m.id },
            data: { status: MailboxStatus.EXPIRED },
          }),
          prisma.mailboxEvent.create({
            data: {
              mailboxId: m.id,
              type: 'expired',
              metadata: { reason: 'ttl_elapsed' },
            },
          }),
        ]);
        expired++;

        const externalId = (m.metadata as { externalId?: string } | null)?.externalId;
        if (externalId) {
          try {
            await TempMailService.deleteMailbox(externalId);
            externalOk++;
          } catch {
            externalFailed++;
          }
        }
      } catch (err) {
        logger.error('expireMailboxes — row failed', {
          mailboxId: m.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Avoid infinite loop if the batch all errored without state change.
    if (expired === 0 && batch.length === BATCH_SIZE) break;
  }

  logger.info('[cron] expireMailboxes complete', {
    scanned,
    expired,
    externalOk,
    externalFailed,
  });

  return {
    scanned,
    expired,
    externalPurges: { ok: externalOk, failed: externalFailed },
  };
}
