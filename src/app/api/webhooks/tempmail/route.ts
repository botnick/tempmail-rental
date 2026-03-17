import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { sseHub } from '@/server/lib/sse-hub';
import { ConfigService } from '@/server/services/config.service';
import { logger } from '@/server/lib/logger';

/**
 * GET /api/webhooks/tempmail — only POST is accepted
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

/**
 * Verify HMAC-SHA256 webhook signature.
 * TempMail server sends: X-Webhook-Signature: sha256=<hmac-hex>
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

/**
 * Handle incoming Webhook from TempMail Server
 * POST /api/webhooks/tempmail
 *
 * Authentication priority:
 * 1. HMAC Signature (X-Webhook-Signature) — if webhook_secret is configured
 * 2. API Key (X-API-Key / Authorization) — fallback
 */
export async function POST(req: Request) {
  try {
    // Read raw body once for both signature verification and parsing
    const rawBody = await req.text();

    // ─── Auth: HMAC Signature ───────────────────────
    const webhookSecret = await ConfigService.get('tempmail.webhook_secret');
    const signatureHeader = req.headers.get('x-webhook-signature');

    if (webhookSecret) {
      if (!signatureHeader) {
        logger.warn('TempMail Webhook missing X-Webhook-Signature header');
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      }

      if (!verifySignature(rawBody, signatureHeader, webhookSecret)) {
        logger.warn('TempMail Webhook HMAC signature mismatch');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else {
      // ─── Fallback: API Key auth ─────────────────────
      const configuredApiKey = await ConfigService.get('tempmail.api_key');

      if (!configuredApiKey) {
        // Neither HMAC secret nor API key configured — refuse to process
        logger.error('TempMail Webhook: No authentication method configured (webhook_secret or api_key required)');
        return NextResponse.json({ error: 'Webhook auth not configured' }, { status: 500 });
      }

      const apiKeyHeader = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

      if (
        !apiKeyHeader ||
        apiKeyHeader.length !== configuredApiKey.length ||
        !timingSafeEqual(Buffer.from(apiKeyHeader), Buffer.from(configuredApiKey))
      ) {
        logger.warn('TempMail Webhook failed API key authentication');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // ─── Parse payload ──────────────────────────────
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (!payload.mailboxId) {
      return NextResponse.json({ error: 'Missing mailboxId' }, { status: 400 });
    }

    // ─── Publish to SSE Hub ─────────────────────────
    await sseHub.publishEvent(payload.mailboxId as string, {
      type: 'new_message',
      data: payload,
    });

    logger.info(`Webhook processed for mailbox ${payload.mailboxId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('TempMail Webhook Error', { error: error instanceof Error ? error : new Error(String(error)) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
