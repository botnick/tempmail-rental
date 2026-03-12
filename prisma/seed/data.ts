// prisma/seed/data.ts — Seed data constants (v3)
// Aligned with: 60+ permissions, 9 roles, MFA, step-up auth, approval workflow, quota service

// ── Helpers ─────────────────────────────────────
export const daysAgo = (d: number) => new Date(Date.now() - d * 86400000);
export const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000);
export const minutesAgo = (m: number) => new Date(Date.now() - m * 60000);
export const daysFromNow = (d: number) => new Date(Date.now() + d * 86400000);

// ── Roles (matches policy/permissions.ts ROLES) ─
export const ROLES = [
  { name: 'SUPER_ADMIN', displayName: 'Super Administrator', description: 'Full system access — can approve high-risk actions', isSystem: true },
  { name: 'ADMIN', displayName: 'Administrator', description: 'System management — users, domains, plans, CMS', isSystem: true },
  { name: 'SUPPORT', displayName: 'Support Agent', description: 'Customer support — view users, read billing, audit logs', isSystem: true },
  { name: 'FINANCE', displayName: 'Finance Manager', description: 'Billing operations — refunds, adjustments, invoices', isSystem: true },
  { name: 'SECURITY_AUDITOR', displayName: 'Security Auditor', description: 'Security event monitoring and resolution', isSystem: true },
  { name: 'USER_FREE', displayName: 'Free User', description: 'Free tier', isSystem: false },
  { name: 'USER_PRO', displayName: 'Pro User', description: 'Paid subscriber', isSystem: false },
  { name: 'USER_BUSINESS', displayName: 'Business User', description: 'Business/Enterprise subscriber', isSystem: false },
  { name: 'SYSTEM_SERVICE', displayName: 'System Service', description: 'Internal service accounts (webhooks, cron)', isSystem: true },
];

// ── Permissions (matches policy/permissions.ts) ──
export const PERMISSIONS = [
  // Account
  { key: 'account.read', displayName: 'View Own Account', module: 'account' },
  { key: 'account.update', displayName: 'Update Own Account', module: 'account' },
  { key: 'account.delete', displayName: 'Delete Own Account', module: 'account' },
  // Mailbox
  { key: 'mailbox.create', displayName: 'Create Mailbox', module: 'mailbox' },
  { key: 'mailbox.read', displayName: 'View Mailboxes', module: 'mailbox' },
  { key: 'mailbox.delete', displayName: 'Delete Mailbox', module: 'mailbox' },
  { key: 'mailbox.extend', displayName: 'Extend Mailbox TTL', module: 'mailbox' },
  // Domain
  { key: 'domain.create', displayName: 'Create Domain', module: 'domain' },
  { key: 'domain.read', displayName: 'View Domains', module: 'domain' },
  { key: 'domain.update', displayName: 'Update Domain', module: 'domain' },
  { key: 'domain.delete', displayName: 'Delete Domain', module: 'domain' },
  { key: 'domain.verify', displayName: 'Verify Domain', module: 'domain' },
  // Billing
  { key: 'billing.read', displayName: 'View Billing', module: 'billing' },
  { key: 'billing.topup', displayName: 'Create Topup', module: 'billing' },
  { key: 'billing.subscribe', displayName: 'Manage Subscription', module: 'billing' },
  // Admin: Dashboard
  { key: 'admin.dashboard.view', displayName: 'View Admin Dashboard', module: 'admin' },
  // Admin: Users
  { key: 'admin.user.list', displayName: 'List Users', module: 'admin' },
  { key: 'admin.user.view', displayName: 'View User Details', module: 'admin' },
  { key: 'admin.user.edit', displayName: 'Edit User', module: 'admin' },
  { key: 'admin.user.suspend', displayName: 'Suspend User', module: 'admin' },
  { key: 'admin.user.delete', displayName: 'Delete User', module: 'admin' },
  { key: 'admin.user.impersonate', displayName: 'Impersonate User', module: 'admin' },
  { key: 'admin.user.grant_credits', displayName: 'Grant Credits', module: 'admin' },
  { key: 'admin.user.assign_role', displayName: 'Assign Role', module: 'admin' },
  // Admin: Mailbox
  { key: 'admin.mailbox.list', displayName: 'List All Mailboxes', module: 'admin' },
  { key: 'admin.mailbox.view', displayName: 'View Mailbox Details', module: 'admin' },
  { key: 'admin.mailbox.quarantine', displayName: 'Quarantine Mailbox', module: 'admin' },
  { key: 'admin.mailbox.restore', displayName: 'Restore Mailbox', module: 'admin' },
  { key: 'admin.mailbox.force_expire', displayName: 'Force Expire Mailbox', module: 'admin' },
  // Admin: Domain
  { key: 'admin.domain.list', displayName: 'List All Domains', module: 'admin' },
  { key: 'admin.domain.create', displayName: 'Create System Domain', module: 'admin' },
  { key: 'admin.domain.edit', displayName: 'Edit Domain', module: 'admin' },
  { key: 'admin.domain.suspend', displayName: 'Suspend Domain', module: 'admin' },
  { key: 'admin.domain.verify', displayName: 'Force Verify Domain', module: 'admin' },
  // Admin: Plans
  { key: 'admin.plan.list', displayName: 'List Plans', module: 'admin' },
  { key: 'admin.plan.create', displayName: 'Create Plan', module: 'admin' },
  { key: 'admin.plan.edit', displayName: 'Edit Plan', module: 'admin' },
  { key: 'admin.plan.deactivate', displayName: 'Deactivate Plan', module: 'admin' },
  // Admin: Billing
  { key: 'admin.billing.view', displayName: 'View All Billing', module: 'admin' },
  { key: 'admin.billing.refund', displayName: 'Process Refund', module: 'admin' },
  { key: 'admin.billing.adjust', displayName: 'Adjust Balance', module: 'admin' },
  // Admin: Security
  { key: 'admin.security.view', displayName: 'View Security Events', module: 'admin' },
  { key: 'admin.security.manage_ip', displayName: 'Manage IP Blocklist', module: 'admin' },
  { key: 'admin.security.revoke_sessions', displayName: 'Revoke Sessions', module: 'admin' },
  { key: 'admin.security.kill_switch', displayName: 'Emergency Kill Switch', module: 'admin' },
  // Admin: Feature Flags
  { key: 'admin.feature_flag.list', displayName: 'List Feature Flags', module: 'admin' },
  { key: 'admin.feature_flag.create', displayName: 'Create Feature Flag', module: 'admin' },
  { key: 'admin.feature_flag.edit', displayName: 'Edit Feature Flag', module: 'admin' },
  { key: 'admin.feature_flag.delete', displayName: 'Delete Feature Flag', module: 'admin' },
  // Admin: CMS
  { key: 'admin.cms.list', displayName: 'List CMS Pages', module: 'admin' },
  { key: 'admin.cms.edit', displayName: 'Edit CMS Pages', module: 'admin' },
  // Admin: SEO
  { key: 'admin.seo.page.list', displayName: 'List SEO Pages', module: 'admin' },
  { key: 'admin.seo.page.create', displayName: 'Create SEO Page', module: 'admin' },
  { key: 'admin.seo.page.edit', displayName: 'Edit SEO Page', module: 'admin' },
  { key: 'admin.seo.page.publish', displayName: 'Publish SEO Page', module: 'admin' },
  { key: 'admin.seo.faq.manage', displayName: 'Manage FAQ', module: 'admin' },
  { key: 'admin.seo.redirect.manage', displayName: 'Manage Redirects', module: 'admin' },
  { key: 'admin.seo.answer.manage', displayName: 'Manage Answer Blocks', module: 'admin' },
  // Admin: Audit
  { key: 'admin.audit.view', displayName: 'View Audit Logs', module: 'admin' },
  { key: 'admin.audit.export', displayName: 'Export Audit Logs', module: 'admin' },
  // Admin: Support
  { key: 'admin.support.view', displayName: 'View Support Notes', module: 'admin' },
  { key: 'admin.support.edit', displayName: 'Edit Support Notes', module: 'admin' },
  // System
  { key: 'system.health', displayName: 'View System Health', module: 'system' },
  { key: 'system.config', displayName: 'View System Config', module: 'system' },
];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'], // all permissions
  ADMIN: [
    'admin.dashboard.view',
    'admin.user.list','admin.user.view','admin.user.edit','admin.user.suspend','admin.user.assign_role',
    'admin.mailbox.list','admin.mailbox.view','admin.mailbox.quarantine','admin.mailbox.restore','admin.mailbox.force_expire',
    'admin.domain.list','admin.domain.create','admin.domain.edit','admin.domain.suspend','admin.domain.verify',
    'admin.plan.list','admin.plan.create','admin.plan.edit','admin.plan.deactivate',
    'admin.billing.view','admin.billing.refund',
    'admin.feature_flag.list','admin.feature_flag.create','admin.feature_flag.edit','admin.feature_flag.delete',
    'admin.cms.list','admin.cms.edit',
    'admin.seo.page.list','admin.seo.page.create','admin.seo.page.edit','admin.seo.page.publish',
    'admin.seo.faq.manage','admin.seo.redirect.manage','admin.seo.answer.manage',
    'admin.audit.view','admin.support.view','admin.support.edit',
    'system.health','system.config',
  ],
  SUPPORT: [
    'admin.dashboard.view',
    'admin.user.list','admin.user.view','admin.user.edit',
    'admin.mailbox.list','admin.mailbox.view',
    'admin.billing.view',
    'admin.audit.view',
    'admin.support.view','admin.support.edit',
  ],
  FINANCE: [
    'admin.dashboard.view',
    'admin.user.list','admin.user.view',
    'admin.billing.view','admin.billing.refund','admin.billing.adjust',
    'admin.user.grant_credits',
    'admin.audit.view',
  ],
  SECURITY_AUDITOR: [
    'admin.dashboard.view',
    'admin.user.list','admin.user.view',
    'admin.security.view','admin.security.manage_ip','admin.security.revoke_sessions',
    'admin.audit.view','admin.audit.export',
  ],
  USER_FREE: ['account.read','account.update','account.delete','mailbox.create','mailbox.read','mailbox.delete','billing.read','billing.topup','domain.read'],
  USER_PRO: ['account.read','account.update','account.delete','mailbox.create','mailbox.read','mailbox.delete','mailbox.extend','domain.create','domain.read','domain.update','domain.delete','domain.verify','billing.read','billing.topup','billing.subscribe'],
  USER_BUSINESS: ['account.read','account.update','account.delete','mailbox.create','mailbox.read','mailbox.delete','mailbox.extend','domain.create','domain.read','domain.update','domain.delete','domain.verify','billing.read','billing.topup','billing.subscribe'],
};

// ── Plans ────────────────────────────────────────
export const PLANS = [
  {
    slug: 'free', name: 'Free', description: 'เริ่มต้นใช้งานอีเมลชั่วคราวฟรี', isDefault: true, sortOrder: 0, trialDays: 0,
    features: [
      { key: 'max_mailboxes', value: '3', valueType: 'number' },
      { key: 'retention_hours', value: '24', valueType: 'number' },
      { key: 'custom_domain_access', value: 'false', valueType: 'boolean' },
      { key: 'alias_count', value: '0', valueType: 'number' },
      { key: 'custom_username_access', value: 'false', valueType: 'boolean' },
      { key: 'max_message_size_mb', value: '5', valueType: 'number' },
      { key: 'api_access', value: 'false', valueType: 'boolean' },
      { key: 'mfa_access', value: 'false', valueType: 'boolean' },
    ],
    pricing: [
      { currency: 'THB', amount: 0, billingPeriod: 'monthly' },
      { currency: 'USD', amount: 0, billingPeriod: 'monthly' },
    ],
  },
  {
    slug: 'starter', name: 'Starter', description: 'สำหรับผู้ใช้ที่ต้องการมากกว่า', isDefault: false, sortOrder: 1, trialDays: 7,
    features: [
      { key: 'max_mailboxes', value: '10', valueType: 'number' },
      { key: 'retention_hours', value: '168', valueType: 'number' },
      { key: 'custom_domain_access', value: 'false', valueType: 'boolean' },
      { key: 'alias_count', value: '3', valueType: 'number' },
      { key: 'custom_username_access', value: 'true', valueType: 'boolean' },
      { key: 'max_message_size_mb', value: '15', valueType: 'number' },
      { key: 'api_access', value: 'false', valueType: 'boolean' },
      { key: 'mfa_access', value: 'true', valueType: 'boolean' },
    ],
    pricing: [
      { currency: 'THB', amount: 149, billingPeriod: 'monthly' },
      { currency: 'THB', amount: 1490, billingPeriod: 'yearly' },
      { currency: 'USD', amount: 4.99, billingPeriod: 'monthly' },
      { currency: 'USD', amount: 47.88, billingPeriod: 'yearly' },
    ],
  },
  {
    slug: 'pro', name: 'Pro', description: 'สำหรับนักพัฒนาและทีมขนาดเล็ก', isDefault: false, sortOrder: 2, trialDays: 14,
    features: [
      { key: 'max_mailboxes', value: '50', valueType: 'number' },
      { key: 'retention_hours', value: '720', valueType: 'number' },
      { key: 'custom_domain_access', value: 'true', valueType: 'boolean' },
      { key: 'alias_count', value: '10', valueType: 'number' },
      { key: 'custom_username_access', value: 'true', valueType: 'boolean' },
      { key: 'max_message_size_mb', value: '50', valueType: 'number' },
      { key: 'api_access', value: 'true', valueType: 'boolean' },
      { key: 'mfa_access', value: 'true', valueType: 'boolean' },
    ],
    pricing: [
      { currency: 'THB', amount: 399, billingPeriod: 'monthly' },
      { currency: 'THB', amount: 3990, billingPeriod: 'yearly' },
      { currency: 'USD', amount: 12.99, billingPeriod: 'monthly' },
      { currency: 'USD', amount: 119.88, billingPeriod: 'yearly' },
    ],
  },
  {
    slug: 'enterprise', name: 'Enterprise', description: 'สำหรับองค์กรที่ต้องการระบบครบวงจร', isDefault: false, sortOrder: 3, trialDays: 30,
    features: [
      { key: 'max_mailboxes', value: '500', valueType: 'number' },
      { key: 'retention_hours', value: '8760', valueType: 'number' },
      { key: 'custom_domain_access', value: 'true', valueType: 'boolean' },
      { key: 'alias_count', value: '100', valueType: 'number' },
      { key: 'custom_username_access', value: 'true', valueType: 'boolean' },
      { key: 'max_message_size_mb', value: '100', valueType: 'number' },
      { key: 'api_access', value: 'true', valueType: 'boolean' },
      { key: 'mfa_access', value: 'true', valueType: 'boolean' },
    ],
    pricing: [
      { currency: 'THB', amount: 1590, billingPeriod: 'monthly' },
      { currency: 'THB', amount: 14990, billingPeriod: 'yearly' },
      { currency: 'USD', amount: 49.99, billingPeriod: 'monthly' },
      { currency: 'USD', amount: 479.88, billingPeriod: 'yearly' },
    ],
  },
];

// ── Users ────────────────────────────────────────
export const USERS = [
  // Admin team
  { email: 'admin@tempmail.dev', displayName: 'กิตติพัฒน์ ศรีสวัสดิ์', role: 'SUPER_ADMIN', plan: 'enterprise', status: 'ACTIVE' as const, daysAgo: 90, mfa: true },
  { email: 'ops@tempmail.dev', displayName: 'นฤมล ชัยสิทธิ์', role: 'ADMIN', plan: 'enterprise', status: 'ACTIVE' as const, daysAgo: 85, mfa: true },
  { email: 'support@tempmail.dev', displayName: 'Sarah Mitchell', role: 'SUPPORT', plan: 'pro', status: 'ACTIVE' as const, daysAgo: 75, mfa: false },
  { email: 'finance@tempmail.dev', displayName: 'ปราณี วงษ์ชัย', role: 'FINANCE', plan: 'pro', status: 'ACTIVE' as const, daysAgo: 80, mfa: true },
  { email: 'security@tempmail.dev', displayName: 'James Chen', role: 'SECURITY_AUDITOR', plan: 'pro', status: 'ACTIVE' as const, daysAgo: 70, mfa: true },
  // Pro users
  { email: 'somchai.dev@gmail.com', displayName: 'สมชาย ใจดี', role: 'USER_PRO', plan: 'pro', status: 'ACTIVE' as const, daysAgo: 60, mfa: true },
  { email: 'natthaporn.k@outlook.com', displayName: 'ณัฐพร เกษมสุข', role: 'USER_PRO', plan: 'pro', status: 'ACTIVE' as const, daysAgo: 45, mfa: false },
  { email: 'alex.johnson@proton.me', displayName: 'Alex Johnson', role: 'USER_PRO', plan: 'pro', status: 'ACTIVE' as const, daysAgo: 55, mfa: true },
  // Business users
  { email: 'enterprise@bigcorp.co.th', displayName: 'วิชัย องค์กรใหญ่', role: 'USER_BUSINESS', plan: 'enterprise', status: 'ACTIVE' as const, daysAgo: 40, mfa: true },
  { email: 'dev-team@startup.io', displayName: 'Dev Team Lead', role: 'USER_BUSINESS', plan: 'enterprise', status: 'ACTIVE' as const, daysAgo: 30, mfa: true },
  // Starter users
  { email: 'wipawan.s@gmail.com', displayName: 'วิภาวรรณ สุขสวัสดิ์', role: 'USER_PRO', plan: 'starter', status: 'ACTIVE' as const, daysAgo: 40, mfa: false },
  { email: 'mike.torres@yahoo.com', displayName: 'Mike Torres', role: 'USER_PRO', plan: 'starter', status: 'ACTIVE' as const, daysAgo: 35, mfa: false },
  { email: 'rungnapa.t@hotmail.com', displayName: 'รุ่งนภา ทองเจริญ', role: 'USER_PRO', plan: 'starter', status: 'ACTIVE' as const, daysAgo: 28, mfa: false },
  { email: 'david.kim@gmail.com', displayName: 'David Kim', role: 'USER_PRO', plan: 'starter', status: 'ACTIVE' as const, daysAgo: 20, mfa: false },
  // Free users
  { email: 'tanawat.p@gmail.com', displayName: 'ธนวัฒน์ ประเสริฐ', role: 'USER_FREE', plan: 'free', status: 'ACTIVE' as const, daysAgo: 50, mfa: false },
  { email: 'jessica.wong@gmail.com', displayName: 'Jessica Wong', role: 'USER_FREE', plan: 'free', status: 'ACTIVE' as const, daysAgo: 42, mfa: false },
  { email: 'kanchana.r@outlook.com', displayName: 'กาญจนา รุ่งเรือง', role: 'USER_FREE', plan: 'free', status: 'ACTIVE' as const, daysAgo: 38, mfa: false },
  { email: 'tom.harris@gmail.com', displayName: 'Tom Harris', role: 'USER_FREE', plan: 'free', status: 'ACTIVE' as const, daysAgo: 30, mfa: false },
  { email: 'siriporn.w@gmail.com', displayName: 'ศิริพร วงศ์สวัสดิ์', role: 'USER_FREE', plan: 'free', status: 'ACTIVE' as const, daysAgo: 25, mfa: false },
  { email: 'anong.k@hotmail.com', displayName: 'อนงค์ เกียรติยศ', role: 'USER_FREE', plan: 'free', status: 'ACTIVE' as const, daysAgo: 18, mfa: false },
  { email: 'chris.brown@outlook.com', displayName: 'Chris Brown', role: 'USER_FREE', plan: 'free', status: 'ACTIVE' as const, daysAgo: 12, mfa: false },
  { email: 'pawit.s@gmail.com', displayName: 'ภวิศ สมบูรณ์', role: 'USER_FREE', plan: 'free', status: 'ACTIVE' as const, daysAgo: 8, mfa: false },
  { email: 'nina.petrov@gmail.com', displayName: 'Nina Petrov', role: 'USER_FREE', plan: 'free', status: 'ACTIVE' as const, daysAgo: 5, mfa: false },
  { email: 'kamol.j@gmail.com', displayName: 'กมล จันทร์เพ็ญ', role: 'USER_FREE', plan: 'free', status: 'ACTIVE' as const, daysAgo: 3, mfa: false },
  // Churned / suspended / banned
  { email: 'banned.spammer@mail.com', displayName: 'SpamBot3000', role: 'USER_FREE', plan: 'free', status: 'BANNED' as const, daysAgo: 65, mfa: false },
  { email: 'suspended.user@outlook.com', displayName: 'ปิยะ ละเมิด', role: 'USER_FREE', plan: 'free', status: 'SUSPENDED' as const, daysAgo: 47, mfa: false },
  { email: 'deactivated@old.com', displayName: 'Deactivated User', role: 'USER_FREE', plan: 'free', status: 'DEACTIVATED' as const, daysAgo: 80, mfa: false },
];

// ── Domains ─────────────────────────────────────
export const DOMAINS = [
  { name: 'tempmail.dev', isSystem: true, status: 'ACTIVE' as const, catchAll: true },
  { name: 'quickmail.cc', isSystem: true, status: 'ACTIVE' as const, catchAll: true },
  { name: 'dropbox.email', isSystem: true, status: 'ACTIVE' as const, catchAll: false },
  { name: 'dev-testing.io', isSystem: false, status: 'VERIFIED' as const, catchAll: false, ownerEmail: 'somchai.dev@gmail.com' },
  { name: 'corp-mail.co.th', isSystem: false, status: 'ACTIVE' as const, catchAll: true, ownerEmail: 'enterprise@bigcorp.co.th' },
  { name: 'secure-inbox.net', isSystem: false, status: 'PENDING' as const, catchAll: false, ownerEmail: 'alex.johnson@proton.me' },
];

// ── Config Entries ──────────────────────────────
export const CONFIG_ENTRIES = [
  { key: 'mail.default_retention_hours', value: '24', valueType: 'number', category: 'mail', description: 'Default mailbox retention (hours)' },
  { key: 'mail.max_message_size_bytes', value: '10485760', valueType: 'number', category: 'mail', description: 'Max inbound message size (10MB)' },
  { key: 'mail.rate_limit_per_hour', value: '100', valueType: 'number', category: 'mail', description: 'Max messages per mailbox per hour' },
  { key: 'security.lockout_threshold', value: '5', valueType: 'number', category: 'security', description: 'Failed login attempts before lockout' },
  { key: 'security.lockout_duration_minutes', value: '15', valueType: 'number', category: 'security', description: 'Account lockout duration (minutes)' },
  { key: 'security.session_ttl_hours', value: '168', valueType: 'number', category: 'security', description: 'User session TTL (7 days)' },
  { key: 'security.admin_session_ttl_minutes', value: '15', valueType: 'number', category: 'security', description: 'Admin session TTL' },
  { key: 'security.step_up_max_age_seconds', value: '300', valueType: 'number', category: 'security', description: 'Step-up auth window (5 minutes)' },
  { key: 'security.mfa_required_admin', value: 'true', valueType: 'boolean', category: 'security', description: 'Require MFA for admin roles' },
  { key: 'security.csrf_enabled', value: 'true', valueType: 'boolean', category: 'security', description: 'Enable CSRF protection' },
  { key: 'billing.min_topup_amount', value: '100', valueType: 'number', category: 'billing', description: 'Minimum topup (THB)' },
  { key: 'billing.max_topup_amount', value: '100000', valueType: 'number', category: 'billing', description: 'Maximum topup (THB)' },
  { key: 'billing.default_currency', value: 'THB', valueType: 'string', category: 'billing', description: 'Default billing currency' },
  { key: 'app.maintenance_mode', value: 'false', valueType: 'boolean', category: 'app', description: 'Enable maintenance mode' },
  { key: 'app.signup_enabled', value: 'true', valueType: 'boolean', category: 'app', description: 'Allow new registrations' },
  { key: 'app.default_locale', value: 'th', valueType: 'string', category: 'app', description: 'Default application locale' },
  { key: 'seo.sitemap_enabled', value: 'true', valueType: 'boolean', category: 'seo', description: 'Enable sitemap' },
  { key: 'seo.robots_txt_enabled', value: 'true', valueType: 'boolean', category: 'seo', description: 'Enable robots.txt' },
  { key: 'quota.mailbox.max', value: '3', valueType: 'number', category: 'quota', description: 'Default free mailbox limit' },
  { key: 'quota.domain.max', value: '0', valueType: 'number', category: 'quota', description: 'Default free domain limit' },
];

// ── Feature Flags ───────────────────────────────
export const FEATURE_FLAGS = [
  { key: 'new_dashboard_ui', name: 'New Dashboard UI', description: 'Redesigned dashboard', enabled: true, rolloutPct: 50, targetPlans: ['pro','enterprise'] },
  { key: 'ai_spam_filter', name: 'AI Spam Filter', description: 'ML-powered spam detection', enabled: true, rolloutPct: 100, targetPlans: ['pro','enterprise'] },
  { key: 'custom_domain_v2', name: 'Custom Domain V2', description: 'Enhanced custom domain management', enabled: true, rolloutPct: 100, targetPlans: ['pro','enterprise'] },
  { key: 'api_v2', name: 'API V2 Access', description: 'Next-gen REST/GraphQL API', enabled: false, rolloutPct: 0 },
  { key: 'dark_mode', name: 'Dark Mode', description: 'Dark theme toggle', enabled: true, rolloutPct: 100 },
  { key: 'bulk_mailbox_create', name: 'Bulk Mailbox Creation', description: 'Create multiple mailboxes at once', enabled: true, rolloutPct: 100, targetPlans: ['enterprise'] },
  { key: 'advanced_analytics', name: 'Advanced Analytics', description: 'Detailed usage analytics', enabled: true, rolloutPct: 30, targetRoles: ['SUPER_ADMIN','ADMIN'] },
  { key: 'webhook_notifications', name: 'Webhook Notifications', description: 'Webhooks on new messages', enabled: false, rolloutPct: 0 },
  { key: 'mfa_enforcement', name: 'MFA Enforcement', description: 'Require MFA for admin logins', enabled: true, rolloutPct: 100, targetRoles: ['SUPER_ADMIN','ADMIN','FINANCE','SECURITY_AUDITOR'] },
  { key: 'approval_workflow', name: 'Approval Workflow', description: 'Dual-admin approval for high-risk actions', enabled: true, rolloutPct: 100, targetRoles: ['SUPER_ADMIN','ADMIN'] },
  { key: 'step_up_auth', name: 'Step-Up Authentication', description: 'Require fresh session for sensitive actions', enabled: true, rolloutPct: 100 },
];

// ── Email Templates ─────────────────────────────
export const EMAIL_TEMPLATES = {
  otp: (code: string, svc: string) => ({
    subject: `รหัสยืนยัน ${svc}: ${code}`,
    from: `noreply@${svc.toLowerCase().replace(/\s/g, '')}.com`,
    bodyText: `รหัสยืนยันของคุณคือ: ${code}\nรหัสนี้จะหมดอายุใน 10 นาที\nหากไม่ได้ร้องขอ กรุณาเพิกเฉย`,
    bodyHtml: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2>รหัสยืนยัน</h2><div style="background:#f5f5f5;padding:20px;text-align:center;font-size:32px;letter-spacing:8px;font-weight:bold">${code}</div><p style="color:#666;font-size:12px">หมดอายุใน 10 นาที</p></div>`,
  }),
  welcome: (name: string, svc: string) => ({
    subject: `ยินดีต้อนรับสู่ ${svc}! 🎉`,
    from: `welcome@${svc.toLowerCase()}.com`,
    bodyText: `สวัสดี ${name}\n\nยินดีต้อนรับสู่ ${svc}!\n\nทีม ${svc}`,
    bodyHtml: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h1>ยินดีต้อนรับ ${name}! 🎉</h1><a href="#" style="display:inline-block;background:#f97316;color:white;padding:12px 24px;border-radius:8px;text-decoration:none">เริ่มต้นใช้งาน</a></div>`,
  }),
  newsletter: (title: string, pub: string) => ({
    subject: title,
    from: `newsletter@${pub.toLowerCase().replace(/\s/g, '')}.com`,
    bodyText: `${title}\n\nไฮไลท์ประจำสัปดาห์จาก ${pub}`,
    bodyHtml: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto"><h1 style="border-bottom:2px solid #333">${title}</h1><p>ไฮไลท์จาก ${pub}...</p></div>`,
  }),
  shipping: (order: string) => ({
    subject: `คำสั่งซื้อ #${order} จัดส่งแล้ว! 📦`,
    from: 'orders@shopee.co.th',
    bodyText: `คำสั่งซื้อ #${order} กำลังจัดส่ง!\nเลขพัสดุ: TH${order}XPR`,
    bodyHtml: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2>พัสดุกำลังจัดส่ง 📦</h2><p>คำสั่งซื้อ #${order}</p><p><strong>เลขพัสดุ:</strong> TH${order}XPR</p></div>`,
  }),
  security_alert: (ip: string) => ({
    subject: '⚠️ พบการเข้าสู่ระบบจากอุปกรณ์ใหม่',
    from: 'security@accounts.google.com',
    bodyText: `พบการเข้าสู่ระบบจาก IP ${ip}\n\nหากไม่ใช่คุณ กรุณารักษาความปลอดภัยบัญชีทันที`,
    bodyHtml: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#d32f2f">⚠️ แจ้งเตือนความปลอดภัย</h2><p>IP: <strong>${ip}</strong></p><a href="#" style="display:inline-block;background:#d32f2f;color:white;padding:12px 24px;border-radius:8px;text-decoration:none">รักษาความปลอดภัยบัญชี</a></div>`,
  }),
  mfa_enabled: (name: string) => ({
    subject: '🔐 เปิดใช้งาน MFA สำเร็จ',
    from: 'security@tempmail.dev',
    bodyText: `สวัสดี ${name}\n\nบัญชีของคุณเปิดใช้งาน MFA เรียบร้อยแล้ว\nการเข้าสู่ระบบครั้งถัดไปจะต้องใช้รหัส TOTP`,
    bodyHtml: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2>🔐 MFA เปิดใช้งานแล้ว</h2><p>สวัสดี ${name}</p><p>บัญชีของคุณมีความปลอดภัยเพิ่มขึ้นด้วย TOTP</p></div>`,
  }),
  password_reset: (name: string) => ({
    subject: '🔑 ร้องขอรีเซ็ตรหัสผ่าน',
    from: 'noreply@tempmail.dev',
    bodyText: `สวัสดี ${name}\n\nคลิกลิงก์ด้านล่างเพื่อรีเซ็ตรหัสผ่าน\nลิงก์นี้จะหมดอายุใน 1 ชั่วโมง`,
    bodyHtml: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2>🔑 รีเซ็ตรหัสผ่าน</h2><p>สวัสดี ${name}</p><a href="#" style="display:inline-block;background:#f97316;color:white;padding:12px 24px;border-radius:8px;text-decoration:none">รีเซ็ตรหัสผ่าน</a><p style="color:#666;font-size:12px">หมดอายุใน 1 ชั่วโมง</p></div>`,
  }),
};
