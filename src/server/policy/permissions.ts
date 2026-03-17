/**
 * Permission keys — granular, module-scoped.
 * These map to database Permission.key values.
 * Used in policy middleware and admin UI to build permission-based RBAC.
 *
 * Streamlined v2: 28 permissions (consolidated from 55)
 */
export const PERMISSIONS = {
  // Account
  ACCOUNT_READ: 'account.read',
  ACCOUNT_UPDATE: 'account.update',
  ACCOUNT_DELETE: 'account.delete',

  // Mailbox
  MAILBOX_CREATE: 'mailbox.create',
  MAILBOX_READ: 'mailbox.read',
  MAILBOX_DELETE: 'mailbox.delete',
  MAILBOX_EXTEND: 'mailbox.extend',

  // Domain
  DOMAIN_CREATE: 'domain.create',
  DOMAIN_READ: 'domain.read',
  DOMAIN_UPDATE: 'domain.update',
  DOMAIN_DELETE: 'domain.delete',
  DOMAIN_VERIFY: 'domain.verify',

  // Billing
  BILLING_READ: 'billing.read',
  BILLING_TOPUP: 'billing.topup',
  BILLING_SUBSCRIBE: 'billing.subscribe',

  // Admin: Dashboard
  ADMIN_DASHBOARD_VIEW: 'admin.dashboard.view',

  // Admin: Users
  ADMIN_USER_VIEW: 'admin.user.view',
  ADMIN_USER_MANAGE: 'admin.user.manage',

  // Admin: Mailbox
  ADMIN_MAILBOX_VIEW: 'admin.mailbox.view',
  ADMIN_MAILBOX_MANAGE: 'admin.mailbox.manage',

  // Admin: Domain
  ADMIN_DOMAIN_VIEW: 'admin.domain.view',
  ADMIN_DOMAIN_MANAGE: 'admin.domain.manage',

  // Admin: Plans
  ADMIN_PLAN_VIEW: 'admin.plan.view',
  ADMIN_PLAN_MANAGE: 'admin.plan.manage',

  // Admin: Billing
  ADMIN_BILLING_VIEW: 'admin.billing.view',

  // Admin: SEO & Content (all SEO ops consolidated)
  ADMIN_SEO_MANAGE: 'admin.seo.manage',

  // Admin: Feature Flags (all FF ops consolidated)
  ADMIN_FF_MANAGE: 'admin.ff.manage',

  // Admin: Security
  ADMIN_SECURITY_VIEW: 'admin.security.view',
  ADMIN_SECURITY_MANAGE: 'admin.security.manage',

  // Admin: Audit
  ADMIN_AUDIT_VIEW: 'admin.audit.view',

  // Admin: RBAC
  ADMIN_RBAC_VIEW: 'admin.rbac.view',
  ADMIN_RBAC_MANAGE: 'admin.rbac.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** System role slugs */
export const ROLES = {
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
  ADMIN: 'ADMIN',
  CUSTOMER: 'CUSTOMER',
} as const;

export type RoleSlug = (typeof ROLES)[keyof typeof ROLES];

/** Admin role slugs for quick checks */
export const ADMIN_ROLES: readonly string[] = [
  ROLES.SYSTEM_ADMIN,
  ROLES.ADMIN,
] as const;
