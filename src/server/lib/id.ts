import { nanoid } from 'nanoid';

/** Generate a short public-facing ID (URL-safe, 21 chars) */
export function generatePublicId(): string {
  return nanoid();
}

/** Generate a request ID for tracing */
export function generateRequestId(): string {
  return nanoid(12);
}

/** Generate a secure token (session tokens, etc.) */
export function generateSecureToken(): string {
  return nanoid(48);
}

/** Generate an idempotency key */
export function generateIdempotencyKey(): string {
  return nanoid(32);
}

/** Generate a prefixed ID (e.g., 'aud_abc123') */
export function generateId(prefix: string): string {
  return `${prefix}_${nanoid()}`;
}
