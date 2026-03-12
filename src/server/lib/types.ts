export type { Env } from '../config/env';

/** Actor context available in every request */
export interface Actor {
  userId: string;
  publicId: string;
  email: string;
  roles: string[];
  permissions: string[];
  planSlug: string | null;
}

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
