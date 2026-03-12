/**
 * Token Utilities
 *
 * Generates various token types with appropriate entropy
 */

import { randomBytes } from 'crypto';

/**
 * Secure random token for auth (32 bytes = 256 bits)
 */
export function generateAuthToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Short verification code (6 digits for email verification)
 */
export function generateVerificationCode(): string {
  const num = randomBytes(4).readUInt32BE(0) % 1000000;
  return num.toString().padStart(6, '0');
}

/**
 * API key with prefix for easy identification
 */
export function generateApiKey(prefix: string = 'tm'): string {
  return `${prefix}_${randomBytes(24).toString('base64url')}`;
}

/**
 * CSRF token
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Idempotency key for payment operations
 */
export function generateIdempotencyKey(): string {
  return `idem_${randomBytes(16).toString('hex')}`;
}
