export type { Env } from '../config/env';

/** Actor context available in every request (authenticated user). */
export interface Actor {
  userId: string;
  publicId: string;
  email: string;
  roles: string[];
  permissions: string[];
  planSlug: string | null;
}

/**
 * Subject — resolved acting principal for guest-or-authed flows.
 * Either a real user (`kind: 'user'`) or an anonymous guest (`kind: 'guest'`).
 *
 * Guests have ownership proven by the cookie's `mailboxOwnerIds` (mailbox publicIds);
 * authed users own anything where mailbox.userId === userId.
 */
export type Subject =
  | {
      kind: 'user';
      userId: string;
      publicId: string;
      tenantId: string;
      mailboxOwnerIds: null;
    }
  | {
      kind: 'guest';
      userId: string;
      publicId: string;
      tenantId: string;
      mailboxOwnerIds: ReadonlyArray<string>;
    };

/** Pagination params */
export interface PaginationInput {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Service result pattern */
export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/** Audit event payload */
export interface AuditEventPayload {
  actorId: string | null;
  actorType: 'user' | 'system' | 'admin';
  action: string;
  targetType?: string;
  targetId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  reason?: string;
}
