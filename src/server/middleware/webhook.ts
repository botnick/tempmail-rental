/**
 * Webhook Signature Validation
 *
 * Validates HMAC signatures on incoming webhook payloads
 * from payment providers (Stripe, Paddle, etc.).
 *
 * Prevents webhook forgery attacks by verifying that the
 * payload was actually sent by the expected provider.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '../lib/logger';

export interface WebhookValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate an HMAC-SHA256 webhook signature.
 *
 * @param payload — Raw request body (string or Buffer)
 * @param signature — Signature from provider header
 * @param secret — Webhook secret key
 * @param encoding — Signature encoding: 'hex' or 'base64'
 */
export function validateWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
  encoding: 'hex' | 'base64' = 'hex'
): WebhookValidationResult {
  if (!payload || !signature || !secret) {
    return { valid: false, error: 'Missing payload, signature, or secret' };
  }

  try {
    const expectedSignature = createHmac('sha256', secret)
      .update(payload)
      .digest(encoding);

    // Handle provider prefixes (e.g., Stripe uses "sha256=...")
    const cleanSignature = signature.replace(/^sha256=/, '').replace(/^v1=/, '');

    if (cleanSignature.length !== expectedSignature.length) {
      return { valid: false, error: 'Signature length mismatch' };
    }

    const valid = timingSafeEqual(
      Buffer.from(cleanSignature),
      Buffer.from(expectedSignature)
    );

    if (!valid) {
      logger.warn('Webhook signature validation failed');
    }

    return { valid };
  } catch (err: unknown) {
    logger.error('Webhook signature validation error', {
      errorMessage: (err as Error)?.message,
    });
    return { valid: false, error: 'Validation error' };
  }
}

/**
 * Validate a webhook with timestamp to prevent replay attacks.
 * Rejects webhooks older than the tolerance window.
 */
export function validateWebhookWithTimestamp(params: {
  payload: string | Buffer;
  signature: string;
  secret: string;
  timestamp: number; // Unix seconds from provider
  toleranceSeconds?: number; // Max age in seconds (default 5 min)
}): WebhookValidationResult {
  const tolerance = params.toleranceSeconds ?? 300;
  const now = Math.floor(Date.now() / 1000);

  if (Math.abs(now - params.timestamp) > tolerance) {
    logger.warn('Webhook timestamp out of tolerance', {
      webhookTime: String(params.timestamp),
      serverTime: String(now),
      toleranceSeconds: String(tolerance),
    });
    return { valid: false, error: 'Webhook timestamp expired — possible replay attack' };
  }

  // Sign: timestamp + '.' + payload
  const signedPayload = `${params.timestamp}.${params.payload}`;
  return validateWebhookSignature(signedPayload, params.signature, params.secret);
}
