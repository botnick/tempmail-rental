// prisma/seed/data.ts — Seed data constants (v4)
// Aligned with: 28 permissions, 3 roles (SYSTEM_ADMIN, ADMIN, CUSTOMER)

// ── Helpers ─────────────────────────────────────
export const daysAgo = (d: number) => new Date(Date.now() - d * 86400000);
export const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000);
export const minutesAgo = (m: number) => new Date(Date.now() - m * 60000);
export const daysFromNow = (d: number) => new Date(Date.now() + d * 86400000);

// ── Roles (matches policy/permissions.ts ROLES) ─
export const ROLES = [
  { name: 'SYSTEM_ADMIN', displayName: 'System Administrator', description: 'Full system access — all permissions, all modules', isSystem: true },
  { name: 'ADMIN', displayName: 'Administrator', description: 'System management — users, domains, plans, billing, security', isSystem: true },
  { name: 'CUSTOMER', displayName: 'Customer', description: 'Standard user — permissions gated by subscription plan', isSystem: false },
];

// ── Permissions (matches policy/permissions.ts — streamlined v2) ──
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
  // Admin: Users (view = list+detail, manage = suspend+grant+assign+logout)
  { key: 'admin.user.view', displayName: 'View Users', module: 'admin' },
  { key: 'admin.user.manage', displayName: 'Manage Users', module: 'admin' },
  // Admin: Mailbox (view = list+detail, manage = quarantine+restore+expire)
  { key: 'admin.mailbox.view', displayName: 'View Mailboxes', module: 'admin' },
  { key: 'admin.mailbox.manage', displayName: 'Manage Mailboxes', module: 'admin' },
  // Admin: Domain
  { key: 'admin.domain.view', displayName: 'View Domains', module: 'admin' },
  { key: 'admin.domain.manage', displayName: 'Manage Domains', module: 'admin' },
  // Admin: Plans (view = list+detail, manage = create+edit+deactivate+delete)
  { key: 'admin.plan.view', displayName: 'View Plans', module: 'admin' },
  { key: 'admin.plan.manage', displayName: 'Manage Plans', module: 'admin' },
  // Admin: Billing
  { key: 'admin.billing.view', displayName: 'View Billing & Transactions', module: 'admin' },
  // Admin: SEO & Content (all ops consolidated)
  { key: 'admin.seo.manage', displayName: 'Manage SEO & Content', module: 'admin' },
  // Admin: Feature Flags (all ops consolidated)
  { key: 'admin.ff.manage', displayName: 'Manage Feature Flags', module: 'admin' },
  // Admin: Security
  { key: 'admin.security.view', displayName: 'View Security Events', module: 'admin' },
  { key: 'admin.security.manage', displayName: 'Manage Security', module: 'admin' },
  // Admin: Audit
  { key: 'admin.audit.view', displayName: 'View Audit Logs', module: 'admin' },
  // Admin: RBAC
  { key: 'admin.rbac.view', displayName: 'View Roles & Permissions', module: 'admin' },
  { key: 'admin.rbac.manage', displayName: 'Manage Roles & Permissions', module: 'admin' },
];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SYSTEM_ADMIN: ['*'], // all permissions
  ADMIN: [
    'admin.dashboard.view',
    'admin.user.view', 'admin.user.manage',
    'admin.mailbox.view', 'admin.mailbox.manage',
    'admin.domain.view', 'admin.domain.manage',
    'admin.plan.view', 'admin.plan.manage',
    'admin.billing.view',
    'admin.seo.manage',
    'admin.ff.manage',
    'admin.security.view', 'admin.security.manage',
    'admin.audit.view',
    'admin.rbac.view', 'admin.rbac.manage',
  ],
  // Customer gets all user-facing permissions; actual limits enforced by plan quotas
  CUSTOMER: [
    'account.read', 'account.update', 'account.delete',
    'mailbox.create', 'mailbox.read', 'mailbox.delete', 'mailbox.extend',
    'domain.create', 'domain.read', 'domain.update', 'domain.delete', 'domain.verify',
    'billing.read', 'billing.topup', 'billing.subscribe',
  ],
};

// ── Plans ────────────────────────────────────────
// Tier metadata (tierName/tierColor/tierIcon) is the user-facing "Rank" badge
// rebrand of the underlying Plan. Stored on Plan rows so admin can edit
// without code changes; consumed by RankBadge component.
export const PLANS = [
  {
    // System plan — assigned to the singleton anonymous user that owns guest mailboxes.
    // No pricing, not user-selectable. Tunable in DB by admin.
    slug: 'guest', name: 'Guest', description: 'Anonymous browsing — no signup',
    isDefault: false, sortOrder: -1, trialDays: 0,
    tierName: 'Guest', tierColor: '#64748b', tierIcon: 'eye',
    features: [
      { key: 'max_mailboxes', value: '1', valueType: 'number' },
      { key: 'retention_hours', value: '1', valueType: 'number' },
      { key: 'custom_domain_access', value: 'false', valueType: 'boolean' },
      { key: 'alias_count', value: '0', valueType: 'number' },
      { key: 'custom_username_access', value: 'false', valueType: 'boolean' },
      { key: 'max_message_size_mb', value: '2', valueType: 'number' },
      { key: 'message_rate_per_min', value: '10', valueType: 'number' },
      { key: 'api_access', value: 'false', valueType: 'boolean' },
      { key: 'mfa_access', value: 'false', valueType: 'boolean' },
    ],
    pricing: [],
  },
  {
    slug: 'free', name: 'Free', description: 'เริ่มต้นใช้งานอีเมลชั่วคราวฟรี', isDefault: true, sortOrder: 0, trialDays: 0,
    tierName: 'Bronze', tierColor: '#CD7F32', tierIcon: 'shield',
    features: [
      { key: 'max_mailboxes', value: '3', valueType: 'number' },
      { key: 'retention_hours', value: '24', valueType: 'number' },
      { key: 'custom_domain_access', value: 'false', valueType: 'boolean' },
      { key: 'alias_count', value: '0', valueType: 'number' },
      { key: 'custom_username_access', value: 'false', valueType: 'boolean' },
      { key: 'max_message_size_mb', value: '5', valueType: 'number' },
      { key: 'message_rate_per_min', value: '30', valueType: 'number' },
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
    tierName: 'Silver', tierColor: '#C0C0C0', tierIcon: 'star',
    features: [
      { key: 'max_mailboxes', value: '10', valueType: 'number' },
      { key: 'retention_hours', value: '168', valueType: 'number' },
      { key: 'custom_domain_access', value: 'false', valueType: 'boolean' },
      { key: 'alias_count', value: '3', valueType: 'number' },
      { key: 'custom_username_access', value: 'true', valueType: 'boolean' },
      { key: 'max_message_size_mb', value: '15', valueType: 'number' },
      { key: 'message_rate_per_min', value: '120', valueType: 'number' },
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
    tierName: 'Gold', tierColor: '#FFD700', tierIcon: 'crown',
    features: [
      { key: 'max_mailboxes', value: '50', valueType: 'number' },
      { key: 'retention_hours', value: '720', valueType: 'number' },
      { key: 'custom_domain_access', value: 'true', valueType: 'boolean' },
      { key: 'alias_count', value: '10', valueType: 'number' },
      { key: 'custom_username_access', value: 'true', valueType: 'boolean' },
      { key: 'max_message_size_mb', value: '50', valueType: 'number' },
      { key: 'message_rate_per_min', value: '600', valueType: 'number' },
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
    tierName: 'Platinum', tierColor: '#E5E4E2', tierIcon: 'gem',
    features: [
      { key: 'max_mailboxes', value: '500', valueType: 'number' },
      { key: 'retention_hours', value: '8760', valueType: 'number' },
      { key: 'custom_domain_access', value: 'true', valueType: 'boolean' },
      { key: 'alias_count', value: '100', valueType: 'number' },
      { key: 'custom_username_access', value: 'true', valueType: 'boolean' },
      { key: 'max_message_size_mb', value: '100', valueType: 'number' },
      { key: 'message_rate_per_min', value: '6000', valueType: 'number' },
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
  { email: 'admin@tempmail.dev', displayName: 'กิตติพัฒน์ ศรีสวัสดิ์', role: 'SYSTEM_ADMIN', plan: 'enterprise', status: 'ACTIVE' as const, daysAgo: 90, mfa: true },
  { email: 'ops@tempmail.dev', displayName: 'นฤมล ชัยสิทธิ์', role: 'ADMIN', plan: 'enterprise', status: 'ACTIVE' as const, daysAgo: 85, mfa: true },
  { email: 'support@tempmail.dev', displayName: 'Sarah Mitchell', role: 'ADMIN', plan: 'pro', status: 'ACTIVE' as const, daysAgo: 75, mfa: false },
  { email: 'finance@tempmail.dev', displayName: 'ปราณี วงษ์ชัย', role: 'ADMIN', plan: 'pro', status: 'ACTIVE' as const, daysAgo: 80, mfa: true },
  { email: 'security@tempmail.dev', displayName: 'James Chen', role: 'ADMIN', plan: 'pro', status: 'ACTIVE' as const, daysAgo: 70, mfa: true },
  // Pro users
  { email: 'somchai.dev@gmail.com', displayName: 'สมชาย ใจดี', role: 'CUSTOMER', plan: 'pro', status: 'ACTIVE' as const, daysAgo: 60, mfa: true },
  { email: 'natthaporn.k@outlook.com', displayName: 'ณัฐพร เกษมสุข', role: 'CUSTOMER', plan: 'pro', status: 'ACTIVE' as const, daysAgo: 45, mfa: false },
  { email: 'alex.johnson@proton.me', displayName: 'Alex Johnson', role: 'CUSTOMER', plan: 'pro', status: 'ACTIVE' as const, daysAgo: 55, mfa: true },
  // Business users
  { email: 'enterprise@bigcorp.co.th', displayName: 'วิชัย องค์กรใหญ่', role: 'CUSTOMER', plan: 'enterprise', status: 'ACTIVE' as const, daysAgo: 40, mfa: true },
  { email: 'dev-team@startup.io', displayName: 'Dev Team Lead', role: 'CUSTOMER', plan: 'enterprise', status: 'ACTIVE' as const, daysAgo: 30, mfa: true },
  // Starter users
  { email: 'wipawan.s@gmail.com', displayName: 'วิภาวรรณ สุขสวัสดิ์', role: 'CUSTOMER', plan: 'starter', status: 'ACTIVE' as const, daysAgo: 40, mfa: false },
  { email: 'mike.torres@yahoo.com', displayName: 'Mike Torres', role: 'CUSTOMER', plan: 'starter', status: 'ACTIVE' as const, daysAgo: 35, mfa: false },
  { email: 'rungnapa.t@hotmail.com', displayName: 'รุ่งนภา ทองเจริญ', role: 'CUSTOMER', plan: 'starter', status: 'ACTIVE' as const, daysAgo: 28, mfa: false },
  { email: 'david.kim@gmail.com', displayName: 'David Kim', role: 'CUSTOMER', plan: 'starter', status: 'ACTIVE' as const, daysAgo: 20, mfa: false },
  // Free users
  { email: 'tanawat.p@gmail.com', displayName: 'ธนวัฒน์ ประเสริฐ', role: 'CUSTOMER', plan: 'free', status: 'ACTIVE' as const, daysAgo: 50, mfa: false },
  { email: 'jessica.wong@gmail.com', displayName: 'Jessica Wong', role: 'CUSTOMER', plan: 'free', status: 'ACTIVE' as const, daysAgo: 42, mfa: false },
  { email: 'kanchana.r@outlook.com', displayName: 'กาญจนา รุ่งเรือง', role: 'CUSTOMER', plan: 'free', status: 'ACTIVE' as const, daysAgo: 38, mfa: false },
  { email: 'tom.harris@gmail.com', displayName: 'Tom Harris', role: 'CUSTOMER', plan: 'free', status: 'ACTIVE' as const, daysAgo: 30, mfa: false },
  { email: 'siriporn.w@gmail.com', displayName: 'ศิริพร วงศ์สวัสดิ์', role: 'CUSTOMER', plan: 'free', status: 'ACTIVE' as const, daysAgo: 25, mfa: false },
  { email: 'anong.k@hotmail.com', displayName: 'อนงค์ เกียรติยศ', role: 'CUSTOMER', plan: 'free', status: 'ACTIVE' as const, daysAgo: 18, mfa: false },
  { email: 'chris.brown@outlook.com', displayName: 'Chris Brown', role: 'CUSTOMER', plan: 'free', status: 'ACTIVE' as const, daysAgo: 12, mfa: false },
  { email: 'pawit.s@gmail.com', displayName: 'ภวิศ สมบูรณ์', role: 'CUSTOMER', plan: 'free', status: 'ACTIVE' as const, daysAgo: 8, mfa: false },
  { email: 'nina.petrov@gmail.com', displayName: 'Nina Petrov', role: 'CUSTOMER', plan: 'free', status: 'ACTIVE' as const, daysAgo: 5, mfa: false },
  { email: 'kamol.j@gmail.com', displayName: 'กมล จันทร์เพ็ญ', role: 'CUSTOMER', plan: 'free', status: 'ACTIVE' as const, daysAgo: 3, mfa: false },
  // Churned / suspended / banned
  { email: 'banned.spammer@mail.com', displayName: 'SpamBot3000', role: 'CUSTOMER', plan: 'free', status: 'BANNED' as const, daysAgo: 65, mfa: false },
  { email: 'suspended.user@outlook.com', displayName: 'ปิยะ ละเมิด', role: 'CUSTOMER', plan: 'free', status: 'SUSPENDED' as const, daysAgo: 47, mfa: false },
  { email: 'deactivated@old.com', displayName: 'Deactivated User', role: 'CUSTOMER', plan: 'free', status: 'DEACTIVATED' as const, daysAgo: 80, mfa: false },
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
  { key: 'advanced_analytics', name: 'Advanced Analytics', description: 'Detailed usage analytics', enabled: true, rolloutPct: 30, targetRoles: ['SYSTEM_ADMIN','ADMIN'] },
  { key: 'webhook_notifications', name: 'Webhook Notifications', description: 'Webhooks on new messages', enabled: false, rolloutPct: 0 },
  { key: 'mfa_enforcement', name: 'MFA Enforcement', description: 'Require MFA for admin logins', enabled: true, rolloutPct: 100, targetRoles: ['SYSTEM_ADMIN','ADMIN'] },
  { key: 'approval_workflow', name: 'Approval Workflow', description: 'Dual-admin approval for high-risk actions', enabled: true, rolloutPct: 100, targetRoles: ['SYSTEM_ADMIN','ADMIN'] },
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
