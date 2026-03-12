/**
 * Permission keys — granular, module-scoped.
 * These map to database Permission.key values.
 * Used in policy middleware and admin UI to build permission-based RBAC.
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
  ADMIN_USER_LIST: 'admin.user.list',
  ADMIN_USER_VIEW: 'admin.user.view',
  ADMIN_USER_EDIT: 'admin.user.edit',
  ADMIN_USER_SUSPEND: 'admin.user.suspend',
  ADMIN_USER_DELETE: 'admin.user.delete',
  ADMIN_USER_IMPERSONATE: 'admin.user.impersonate',
  ADMIN_USER_GRANT_CREDITS: 'admin.user.grant_credits',
  ADMIN_USER_ASSIGN_ROLE: 'admin.user.assign_role',

  // Admin: Mailbox
  ADMIN_MAILBOX_LIST: 'admin.mailbox.list',
  ADMIN_MAILBOX_VIEW: 'admin.mailbox.view',
  ADMIN_MAILBOX_QUARANTINE: 'admin.mailbox.quarantine',
  ADMIN_MAILBOX_RESTORE: 'admin.mailbox.restore',
  ADMIN_MAILBOX_FORCE_EXPIRE: 'admin.mailbox.force_expire',

  // Admin: Domain
  ADMIN_DOMAIN_LIST: 'admin.domain.list',
  ADMIN_DOMAIN_CREATE: 'admin.domain.create',
  ADMIN_DOMAIN_EDIT: 'admin.domain.edit',
  ADMIN_DOMAIN_SUSPEND: 'admin.domain.suspend',
  ADMIN_DOMAIN_VERIFY: 'admin.domain.verify',

  // Admin: Plans
  ADMIN_PLAN_LIST: 'admin.plan.list',
  ADMIN_PLAN_CREATE: 'admin.plan.create',
  ADMIN_PLAN_EDIT: 'admin.plan.edit',
  ADMIN_PLAN_DEACTIVATE: 'admin.plan.deactivate',

  // Admin: Billing
  ADMIN_BILLING_VIEW: 'admin.billing.view',
  ADMIN_BILLING_REFUND: 'admin.billing.refund',
  ADMIN_BILLING_ADJUST: 'admin.billing.adjust',

  // Admin: Security
  ADMIN_SECURITY_VIEW: 'admin.security.view',
  ADMIN_SECURITY_MANAGE_IP: 'admin.security.manage_ip',
  ADMIN_SECURITY_REVOKE_SESSIONS: 'admin.security.revoke_sessions',
  ADMIN_SECURITY_KILL_SWITCH: 'admin.security.kill_switch',

  // Admin: Feature Flags
  ADMIN_FF_LIST: 'admin.feature_flag.list',
  ADMIN_FF_CREATE: 'admin.feature_flag.create',
  ADMIN_FF_EDIT: 'admin.feature_flag.edit',
  ADMIN_FF_DELETE: 'admin.feature_flag.delete',

  // Admin: CMS
  ADMIN_CMS_LIST: 'admin.cms.list',
  ADMIN_CMS_EDIT: 'admin.cms.edit',

  // Admin: SEO & Content
  ADMIN_SEO_PAGE_LIST: 'admin.seo.page.list',
  ADMIN_SEO_PAGE_CREATE: 'admin.seo.page.create',
  ADMIN_SEO_PAGE_EDIT: 'admin.seo.page.edit',
  ADMIN_SEO_PAGE_PUBLISH: 'admin.seo.page.publish',
  ADMIN_SEO_FAQ_MANAGE: 'admin.seo.faq.manage',
  ADMIN_SEO_REDIRECT_MANAGE: 'admin.seo.redirect.manage',
  ADMIN_SEO_ANSWER_MANAGE: 'admin.seo.answer.manage',

  // Admin: Audit
  ADMIN_AUDIT_VIEW: 'admin.audit.view',
  ADMIN_AUDIT_EXPORT: 'admin.audit.export',

  // Admin: Support
  ADMIN_SUPPORT_VIEW: 'admin.support.view',
  ADMIN_SUPPORT_EDIT: 'admin.support.edit',

  // System
  SYSTEM_HEALTH: 'system.health',
  SYSTEM_CONFIG: 'system.config',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** System role slugs */
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  SUPPORT: 'SUPPORT',
  FINANCE: 'FINANCE',
  SECURITY_AUDITOR: 'SECURITY_AUDITOR',
  USER_FREE: 'USER_FREE',
  USER_PRO: 'USER_PRO',
  USER_BUSINESS: 'USER_BUSINESS',
  SYSTEM_SERVICE: 'SYSTEM_SERVICE',
} as const;

export type RoleSlug = (typeof ROLES)[keyof typeof ROLES];

/** Admin role slugs for quick checks */
export const ADMIN_ROLES: readonly string[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.SUPPORT,
  ROLES.FINANCE,
  ROLES.SECURITY_AUDITOR,
] as const;
