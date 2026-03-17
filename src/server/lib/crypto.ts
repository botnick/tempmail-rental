import { createHmac, randomBytes, timingSafeEqual as _timingSafeEqual } from 'crypto';
import { env } from '../config/env';

/** Hash a session token for storage (HMAC-SHA256 with SESSION_SECRET) */
export function hashToken(token: string): string {
  return createHmac('sha256', env.SESSION_SECRET).update(token).digest('hex');
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
  return _timingSafeEqual(bufA, bufB);
}

