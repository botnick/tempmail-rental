import { createHash, randomBytes } from 'crypto';

/** Hash a session token for storage (SHA-256 — fast, appropriate for session lookups) */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Generate cryptographically secure random bytes as hex */
export function randomHex(bytes: number = 32): string {
  return randomBytes(bytes).toString('hex');
}

/** Constant-time comparison to prevent timing attacks */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return require('crypto').timingSafeEqual(bufA, bufB);
}
