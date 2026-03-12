/**
 * Audit Middleware
 *
 * Automatically logs all mutating tRPC operations
 * Creates immutable audit trail with before/after snapshots
 */

import { generateId } from '../lib/id';

export interface AuditEntry {
  id: string;
  timestamp: Date;
  actorId: string | null;
  actorIp: string;
  action: string;
  targetType: string;
  targetId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  requestId: string;
}

/**
 * Create an audit log entry
 */
export function createAuditEntry(params: {
  actorId: string | null;
  actorIp: string;
  action: string;
  targetType: string;
  targetId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  requestId: string;
}): AuditEntry {
  return {
    id: generateId('aud'),
    timestamp: new Date(),
    actorId: params.actorId,
    actorIp: params.actorIp,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId ?? null,
    before: params.before ?? null,
    after: params.after ?? null,
    metadata: params.metadata ?? {},
    requestId: params.requestId,
  };
}

/**
 * Redact sensitive fields from audit snapshots
 */
const SENSITIVE_KEYS = new Set([
  'password', 'passwordHash', 'token', 'secret',
  'refreshToken', 'apiKey', 'argon2Hash',
]);

export function redactSensitiveFields(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      redacted[key] = redactSensitiveFields(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}
