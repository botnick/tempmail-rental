/**
 * TempMail webhook receiver.
 *
 * Flow on every incoming message from the Go backend:
 *   1. Verify HMAC signature (or API key fallback)
 *   2. Resolve local Mailbox row by external id
 *   3. Insert MailboxMessage (deduped by externalId)
 *   4. For each attachment: download blob → put R2 → insert MailboxAttachment
 *   5. Publish SSE event keyed by local mailbox.publicId so guest + authed
 *      subscribers both receive it
 *   6. Emit MailboxEvent (type: 'message_received')
 *
 * Persistence is the source of truth — guests reloading the page after a
 * webhook fired must still see the message in their inbox.
 */
import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual, createHash } from 'crypto';
import { sseHub } from '@/server/lib/sse-hub';
import { ConfigService } from '@/server/services/config.service';
import { TempMailService } from '@/server/services/tempmail.service';
import { QuotaService } from '@/server/services/quota.service';
import { QuotaExceededError } from '@/server/lib/errors';
import { prisma } from '@/server/db';
import { putObject, attachmentKey, isStorageConfigured } from '@/server/lib/storage';
import { logger } from '@/server/lib/logger';

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

/**
 * Verify HMAC-SHA256 webhook signature.
 * Header format: X-Webhook-Signature: sha256=<hmac-hex>
 */
function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const provided = signature.replace(/^sha256=/, '');
    if (expected.length !== provided.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

/** Webhook payload shape (mirrors Go backend). */
interface WebhookPayload {
  mailboxId: string; // Go-side external id
  messageId: string; // Go-side external id
  from: string;
  to?: string;
  subject?: string;
  textBody?: string;
  htmlBody?: string;
  receivedAt?: string;
  size?: number;
  attachments?: Array<{
    id: string; // Go-side external attachment id
    filename: string;
    contentType: string;
    sizeBytes: number;
  }>;
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    // ── Auth ────────────────────────────────────────
    const webhookSecret = await ConfigService.get('tempmail.webhook_secret');
    const signatureHeader = req.headers.get('x-webhook-signature');

    if (webhookSecret) {
      if (!signatureHeader) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      }
      if (!verifySignature(rawBody, signatureHeader, webhookSecret)) {
        logger.warn('TempMail Webhook HMAC signature mismatch');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else {
      const configuredApiKey = await ConfigService.get('tempmail.api_key');
      if (!configuredApiKey) {
        logger.error('TempMail Webhook: no auth method configured (need webhook_secret or api_key)');
        return NextResponse.json({ error: 'Webhook auth not configured' }, { status: 500 });
      }
      const apiKeyHeader =
        req.headers.get('x-api-key') ||
        req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
      if (
        !apiKeyHeader ||
        apiKeyHeader.length !== configuredApiKey.length ||
        !timingSafeEqual(Buffer.from(apiKeyHeader), Buffer.from(configuredApiKey))
      ) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // ── Parse ───────────────────────────────────────
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (!payload.mailboxId || !payload.messageId || !payload.from) {
      return NextResponse.json(
        { error: 'Missing required fields (mailboxId, messageId, from)' },
        { status: 400 }
      );
    }

    // ── Resolve local mailbox ───────────────────────
    // Mailbox.metadata.externalId stores the Go-side id when the local
    // mailbox was created.
    const candidates = await prisma.mailbox.findMany({
      where: {
        metadata: { path: ['externalId'], equals: payload.mailboxId },
      },
      take: 1,
    });
    const localMailbox = candidates[0];
    if (!localMailbox) {
      logger.warn('Webhook for unknown mailbox', { externalMailboxId: payload.mailboxId });
      // 200 — Go backend should not retry forever; we ack and drop.
      return NextResponse.json({ accepted: false, reason: 'unknown_mailbox' });
    }

    // ── Idempotent persist ──────────────────────────
    const existing = await prisma.mailboxMessage.findUnique({
      where: { externalId: payload.messageId },
    });
    if (existing) {
      logger.debug('Webhook duplicate — already persisted', {
        externalMessageId: payload.messageId,
      });
      return NextResponse.json({ accepted: true, deduped: true });
    }

    // ── Per-mailbox message rate quota ──────────────
    // Enforced before persist. If the mailbox owner is over their plan's
    // message_rate_per_min, the message is dropped (400) and Go side will
    // see a non-2xx and stop retrying.
    try {
      await QuotaService.enforceMessageRateQuota(localMailbox.id);
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        logger.warn('Webhook dropped — message rate quota exceeded', {
          mailboxId: localMailbox.id,
          externalMessageId: payload.messageId,
        });
        return NextResponse.json(
          { accepted: false, reason: 'quota_exceeded', detail: err.message },
          { status: 429 }
        );
      }
      throw err;
    }

    const message = await prisma.mailboxMessage.create({
      data: {
        externalId: payload.messageId,
        mailboxId: localMailbox.id,
        fromAddress: payload.from,
        subject: payload.subject ?? null,
        bodyText: payload.textBody ?? null,
        bodyHtml: payload.htmlBody ?? null,
        size: payload.size ?? 0,
        receivedAt: payload.receivedAt ? new Date(payload.receivedAt) : new Date(),
      },
    });

    // ── Attachment ingest into R2 ───────────────────
    let attachmentsPersisted = 0;
    if (payload.attachments && payload.attachments.length > 0) {
      if (!isStorageConfigured()) {
        logger.warn('Attachments present but R2 storage not configured — skipping ingest', {
          messageId: message.id,
          attachmentCount: payload.attachments.length,
        });
      } else {
        for (const att of payload.attachments) {
          try {
            // Plan-driven attachment size limit (max_message_size_mb).
            await QuotaService.enforceAttachmentSize(localMailbox.id, att.sizeBytes);

            const blob = await TempMailService.fetchAttachmentBlob(att.id);
            const filenameHash = createHash('sha256')
              .update(blob.bytes)
              .digest('hex')
              .slice(0, 16);
            const key = attachmentKey(
              localMailbox.id,
              payload.messageId,
              filenameHash,
              blob.filename
            );
            await putObject(key, blob.bytes, blob.contentType);
            await prisma.mailboxAttachment.create({
              data: {
                messageId: message.id,
                filename: blob.filename,
                contentType: blob.contentType,
                size: blob.size,
                storageKey: key,
                scanStatus: 'pending',
              },
            });
            attachmentsPersisted++;
          } catch (err) {
            if (err instanceof QuotaExceededError) {
              logger.warn('Attachment skipped — exceeds plan size limit', {
                attachmentId: att.id,
                size: att.sizeBytes,
                detail: err.message,
              });
              continue;
            }
            logger.error('Attachment ingest failed', {
              attachmentId: att.id,
              messageId: message.id,
              err: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }

    // ── Mailbox event + counter ─────────────────────
    await prisma.$transaction([
      prisma.mailbox.update({
        where: { id: localMailbox.id },
        data: { messageCount: { increment: 1 } },
      }),
      prisma.mailboxEvent.create({
        data: {
          mailboxId: localMailbox.id,
          type: 'message_received',
          metadata: {
            messagePublicId: message.publicId,
            from: payload.from,
            subject: payload.subject,
            attachmentsPersisted,
          },
        },
      }),
    ]);

    // ── SSE fan-out (keyed by LOCAL publicId) ──────
    await sseHub.publishEvent(localMailbox.publicId, {
      type: 'new_message',
      data: {
        messagePublicId: message.publicId,
        from: payload.from,
        subject: payload.subject,
        receivedAt: message.receivedAt.toISOString(),
        hasAttachments: attachmentsPersisted > 0,
      },
    });

    logger.info('Webhook ingested', {
      mailboxPublicId: localMailbox.publicId,
      messagePublicId: message.publicId,
      attachmentsPersisted,
    });

    return NextResponse.json({
      accepted: true,
      messageId: message.publicId,
      attachmentsPersisted,
    });
  } catch (error) {
    logger.error('TempMail Webhook error', {
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
