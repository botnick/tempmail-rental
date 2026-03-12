import {
  Mail, Shield, Globe, Sparkles, Infinity, Lock, Zap,
  LayoutDashboard, Users, CreditCard, Settings, LogOut, ArrowLeft,
  Diamond, ShieldCheck, Flag, FileText, ClipboardList,
  MessageSquare, Wallet, Clock, AlertTriangle, Activity,
  BarChart3, TrendingUp, Server, Database, Inbox, Plus,
  ArrowUpRight, Search, Filter, MoreHorizontal, ChevronRight,
  ArrowRight, WifiOff, Edit, Trash2, Eye, RotateCcw, UserCheck,
  Ban, Key, DollarSign, Download, Check, X, Flame, Star,
  type LucideIcon,
} from 'lucide-react';

// ──────────────────────────────────────────────
// BRANDING
// ──────────────────────────────────────────────
export const BRAND = {
  name: 'TempMail',
  tagline: 'Secure Temporary Email',
  description: 'สร้างกล่องจดหมายชั่วคราวได้ทันที ปกป้องความเป็นส่วนตัว รองรับโดเมนกำหนดเอง ชื่อผู้ใช้ที่ต้องการ และแผนแบบยืดหยุ่น',
  copyright: `© ${new Date().getFullYear()} TempMail`,
  heroTitle: ['อีเมลชั่วคราว', 'ปลอดภัย & รวดเร็ว'],
  heroCta: 'เริ่มใช้งานฟรี',
  heroCtaSecondary: 'ดูแผนราคา',
  Logo: Mail,
  adminLogo: ShieldCheck,
  // Orange-first gradients
  logoGradient: 'from-brand to-amber',
  adminGradient: 'from-brand-deep to-coral',
} as const;

// ──────────────────────────────────────────────
// ROUTES
// ──────────────────────────────────────────────
export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  pricing: '/pricing',
  dashboard: '/dashboard',
  mailboxes: '/dashboard/mailboxes',
  domains: '/dashboard/domains',
  billing: '/dashboard/billing',
  settings: '/dashboard/settings',
  admin: '/admin',
  adminUsers: '/admin/users',
  adminMailboxes: '/admin/mailboxes',
  adminDomains: '/admin/domains',
  adminPlans: '/admin/plans',
  adminBilling: '/admin/billing',
  adminSecurity: '/admin/security',
  adminFeatureFlags: '/admin/feature-flags',
  adminCms: '/admin/cms',
  adminAudit: '/admin/audit',
  privacy: '/privacy',
  terms: '/terms',
  contact: '/contact',
} as const;

// ──────────────────────────────────────────────
// NAVIGATION
// ──────────────────────────────────────────────
export interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

export const USER_NAV: NavItem[] = [
  { href: ROUTES.dashboard, label: 'แดชบอร์ด', Icon: LayoutDashboard },
  { href: ROUTES.mailboxes, label: 'กล่องจดหมาย', Icon: Mail },
  { href: ROUTES.domains, label: 'โดเมน', Icon: Globe },
  { href: ROUTES.billing, label: 'การเงิน', Icon: CreditCard },
  { href: ROUTES.settings, label: 'ตั้งค่า', Icon: Settings },
];

export const ADMIN_NAV: NavItem[] = [
  { href: ROUTES.admin, label: 'แดชบอร์ด', Icon: LayoutDashboard },
  { href: ROUTES.adminUsers, label: 'ผู้ใช้', Icon: Users },
  { href: ROUTES.adminMailboxes, label: 'กล่องจดหมาย', Icon: Mail },
  { href: ROUTES.adminDomains, label: 'โดเมน', Icon: Globe },
  { href: ROUTES.adminPlans, label: 'แผนราคา', Icon: Diamond },
  { href: ROUTES.adminBilling, label: 'การเงิน', Icon: CreditCard },
  { href: ROUTES.adminSecurity, label: 'ความปลอดภัย', Icon: ShieldCheck },
  { href: ROUTES.adminFeatureFlags, label: 'Feature Flags', Icon: Flag },
  { href: ROUTES.adminCms, label: 'เนื้อหา', Icon: FileText },
  { href: ROUTES.adminAudit, label: 'Audit Logs', Icon: ClipboardList },
];

export const HEADER_NAV = [
  { href: ROUTES.pricing, label: 'ราคา' },
  { href: '#features', label: 'ฟีเจอร์' },
];

export const FOOTER_LINKS = [
  { href: ROUTES.pricing, label: 'ราคา' },
  { href: ROUTES.privacy, label: 'นโยบายความเป็นส่วนตัว' },
  { href: ROUTES.terms, label: 'เงื่อนไขการใช้งาน' },
  { href: ROUTES.contact, label: 'ติดต่อเรา' },
];

// ──────────────────────────────────────────────
// FEATURES — Landing page
// ──────────────────────────────────────────────
export interface FeatureItem {
  Icon: LucideIcon;
  title: string;
  desc: string;
  gradient: string;
}

export const FEATURES: FeatureItem[] = [
  { Icon: Zap, title: 'สร้างทันที', desc: 'กล่องจดหมายชั่วคราวพร้อมใช้ภายในวินาที ไม่ต้องยืนยันตัวตน', gradient: 'from-brand to-amber' },
  { Icon: Shield, title: 'ปลอดภัยจากสแปม', desc: 'ระบบป้องกันสแปมขั้นสูง กรองอีเมลไม่พึงประสงค์อัตโนมัติ', gradient: 'from-brand-deep to-brand' },
  { Icon: Globe, title: 'โดเมนกำหนดเอง', desc: 'ใช้โดเมนของคุณเองเพื่อสร้างอีเมลชั่วคราวรูปแบบเฉพาะ', gradient: 'from-coral to-brand-bright' },
  { Icon: Sparkles, title: 'ชื่อผู้ใช้ที่ต้องการ', desc: 'เลือกชื่อผู้ใช้เองได้ ไม่จำกัดเฉพาะแบบสุ่ม', gradient: 'from-amber to-gold' },
  { Icon: Infinity, title: 'สร้างได้ไม่จำกัด', desc: 'ตามแผนที่เลือกใช้ ไม่มีข้อจำกัดที่ไม่จำเป็น', gradient: 'from-tangerine to-peach' },
  { Icon: Lock, title: 'จัดเก็บยาวนาน', desc: 'เลือกระยะเวลาจัดเก็บตามที่ต้องการ ขยายได้ตามแผน', gradient: 'from-brand to-brand-deep' },
];

// ──────────────────────────────────────────────
// TRUST SIGNALS — Landing page
// ──────────────────────────────────────────────
export const TRUST_SIGNALS = [
  { label: '99.9% Uptime', Icon: Activity },
  { label: 'ข้อมูลเข้ารหัส', Icon: Shield },
  { label: 'ไม่มีโฆษณา', Icon: Eye },
  { label: 'โอเพนซอร์ส', Icon: Star },
];

// ──────────────────────────────────────────────
// PLANS
// ──────────────────────────────────────────────
export interface PlanItem {
  name: string;
  slug: string;
  price: string;
  period: string;
  gradient: string;
  checkGradient: string;
  features: string[];
  cta: string;
  featured: boolean;
}

export const PLANS: PlanItem[] = [
  {
    name: 'ฟรี', slug: 'free', price: '0', period: 'ตลอดไป',
    gradient: 'from-amber to-brand', checkGradient: 'from-amber to-gold',
    features: ['กล่องจดหมาย 3 กล่อง', 'เก็บข้อมูล 24 ชั่วโมง', 'อีเมลรับ 50 ฉบับ/วัน', 'ไม่รองรับโดเมนกำหนดเอง', 'สนับสนุนทั่วไป'],
    cta: 'เริ่มใช้ฟรี', featured: false,
  },
  {
    name: 'Pro', slug: 'pro', price: '199', period: 'บาท/เดือน',
    gradient: 'from-brand to-brand-deep', checkGradient: 'from-brand to-coral',
    features: ['กล่องจดหมาย 50 กล่อง', 'เก็บข้อมูล 7 วัน', 'อีเมลรับไม่จำกัด', 'โดเมนกำหนดเอง 3 โดเมน', 'ชื่อผู้ใช้ที่เลือกเอง', 'API Access', 'สนับสนุนลำดับสูง'],
    cta: 'อัปเกรดเป็น Pro', featured: true,
  },
  {
    name: 'Business', slug: 'business', price: '899', period: 'บาท/เดือน',
    gradient: 'from-coral to-warm-rose', checkGradient: 'from-coral to-brand-bright',
    features: ['กล่องจดหมายไม่จำกัด', 'เก็บข้อมูล 30 วัน', 'อีเมลรับไม่จำกัด', 'โดเมนกำหนดเองไม่จำกัด', 'Webhook Integration', 'ชื่อผู้ใช้สงวน', 'API แบบเต็มรูปแบบ', 'สนับสนุน 24/7'],
    cta: 'เลือก Business', featured: false,
  },
];

// ──────────────────────────────────────────────
// STATS
// ──────────────────────────────────────────────
export interface StatItem {
  label: string;
  key: string;
  Icon: LucideIcon;
  gradient: string;
}

export const ADMIN_STATS: StatItem[] = [
  { label: 'ผู้ใช้ทั้งหมด', key: 'totalUsers', Icon: Users, gradient: 'from-brand to-amber' },
  { label: 'DAU', key: 'dau', Icon: Activity, gradient: 'from-amber to-gold' },
  { label: 'MAU', key: 'mau', Icon: BarChart3, gradient: 'from-brand-deep to-brand' },
  { label: 'กล่องจดหมาย', key: 'activeMailboxes', Icon: Mail, gradient: 'from-tangerine to-peach' },
  { label: 'อีเมลวันนี้', key: 'emailsToday', Icon: MessageSquare, gradient: 'from-coral to-brand-bright' },
  { label: 'รายได้รวม', key: 'totalRevenue', Icon: Wallet, gradient: 'from-success to-accent-teal' },
  { label: 'Topup ที่รอ', key: 'pendingTopups', Icon: Clock, gradient: 'from-warning to-amber' },
  { label: 'แจ้งเตือนความเสี่ยง', key: 'riskAlerts', Icon: AlertTriangle, gradient: 'from-danger to-coral' },
];

export const USER_STATS: StatItem[] = [
  { label: 'กล่องจดหมาย', key: 'mailboxes', Icon: Mail, gradient: 'from-brand to-amber' },
  { label: 'ข้อความทั้งหมด', key: 'messages', Icon: MessageSquare, gradient: 'from-brand-deep to-coral' },
  { label: 'โดเมนของฉัน', key: 'domains', Icon: Globe, gradient: 'from-tangerine to-peach' },
  { label: 'ยอดคงเหลือ', key: 'balance', Icon: Wallet, gradient: 'from-success to-accent-teal' },
];

// ──────────────────────────────────────────────
// FEATURE MATRIX
// ──────────────────────────────────────────────
export const FEATURE_MATRIX = [
  { key: 'max_mailboxes', label: 'Max Mailboxes', free: '3', pro: '50', business: 'Unlimited' },
  { key: 'retention_hours', label: 'Retention', free: '24h', pro: '7d', business: '30d' },
  { key: 'custom_domain_access', label: 'Custom Domain', free: '✕', pro: '3', business: 'Unlimited' },
  { key: 'daily_inbound_limit', label: 'Daily Inbound', free: '50', pro: 'Unlimited', business: 'Unlimited' },
  { key: 'alias_count', label: 'Aliases', free: '0', pro: '10', business: 'Unlimited' },
  { key: 'custom_username_access', label: 'Custom Username', free: '✕', pro: '✓', business: '✓' },
  { key: 'api_access', label: 'API Access', free: '✕', pro: '✓', business: '✓' },
  { key: 'webhook_access', label: 'Webhooks', free: '✕', pro: '✕', business: '✓' },
] as const;

// ──────────────────────────────────────────────
// CMS CONTENT GROUPS
// ──────────────────────────────────────────────
export const CMS_GROUPS = [
  { title: 'Landing Page', items: [
    { key: 'cms.hero.title', label: 'Hero Title', fallback: 'อีเมลชั่วคราว ปลอดภัย & รวดเร็ว' },
    { key: 'cms.hero.subtitle', label: 'Hero Subtitle', fallback: 'สร้างกล่องจดหมายชั่วคราวได้ทันที...' },
    { key: 'cms.hero.cta', label: 'CTA Text', fallback: 'เริ่มใช้งานฟรี' },
  ]},
  { title: 'SEO', items: [
    { key: 'cms.seo.title', label: 'Page Title', fallback: 'TempMail — Secure Temporary Email' },
    { key: 'cms.seo.description', label: 'Meta Description', fallback: 'Create instant, secure...' },
    { key: 'cms.seo.keywords', label: 'Keywords', fallback: 'temp mail, temporary email, privacy' },
  ]},
  { title: 'Announcements', items: [
    { key: 'cms.announcement.text', label: 'Text', fallback: '' },
    { key: 'cms.announcement.enabled', label: 'Enabled', fallback: 'false' },
    { key: 'cms.announcement.link', label: 'Link URL', fallback: '' },
  ]},
];

// ──────────────────────────────────────────────
// RATE LIMIT POLICIES (display)
// ──────────────────────────────────────────────
export const RATE_LIMIT_POLICIES = [
  { key: 'auth.login', limit: '5 ครั้ง / 15 นาที / IP' },
  { key: 'auth.register', limit: '3 ครั้ง / ชั่วโมง / IP' },
  { key: 'mailbox.create', limit: '10 ครั้ง / ชั่วโมง / user' },
  { key: 'api.general', limit: '100 ครั้ง / นาที / user' },
];

// ──────────────────────────────────────────────
// PROVIDERS
// ──────────────────────────────────────────────
export const PROVIDERS = [
  { name: 'PostgreSQL', Icon: Database, statusKey: 'db' },
  { name: 'Redis', Icon: Server, statusKey: 'redis' },
  { name: 'SMTP Relay', Icon: Mail, statusKey: 'smtp' },
];

// ──────────────────────────────────────────────
// LABELS
// ──────────────────────────────────────────────
export const LABELS = {
  login: 'เข้าสู่ระบบ',
  register: 'สมัครสมาชิก',
  logout: 'ออกจากระบบ',
  backToDashboard: 'กลับไปแดชบอร์ด',
  save: 'บันทึก',
  create: 'สร้าง',
  edit: 'แก้ไข',
  delete: 'ลบ',
  search: 'ค้นหา',
  filter: 'กรอง',
  exportCsv: 'ส่งออก CSV',
  viewAll: 'ดูทั้งหมด',
  noData: 'ไม่มีข้อมูล',
  upgrade: 'อัปเกรด',
  topup: 'เติมเงิน',
  email: 'อีเมล',
  password: 'รหัสผ่าน',
  displayName: 'ชื่อที่แสดง',
  confirmPassword: 'ยืนยันรหัสผ่าน',
  rememberMe: 'จดจำฉัน',
  forgotPassword: 'ลืมรหัสผ่าน?',
  noAccount: 'ยังไม่มีบัญชี?',
  hasAccount: 'มีบัญชีแล้ว?',
  allStatuses: 'สถานะทั้งหมด',
  allRoles: 'Role ทั้งหมด',
} as const;

// ──────────────────────────────────────────────
// STATUS / ROLE OPTIONS
// ──────────────────────────────────────────────
export const USER_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'BANNED', label: 'Banned' },
  { value: 'PENDING_VERIFICATION', label: 'Pending' },
  { value: 'DEACTIVATED', label: 'Deactivated' },
];

export const MAILBOX_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'QUARANTINED', label: 'Quarantined' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'DELETED', label: 'Deleted' },
];

export const ROLE_OPTIONS = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'USER_FREE', label: 'Free' },
  { value: 'USER_PRO', label: 'Pro' },
  { value: 'USER_BUSINESS', label: 'Business' },
];

export const RISK_SEVERITIES = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export const AUDIT_TARGET_TYPES = [
  { value: 'user', label: 'User' },
  { value: 'mailbox', label: 'Mailbox' },
  { value: 'domain', label: 'Domain' },
  { value: 'session', label: 'Session' },
  { value: 'feature_flag', label: 'Feature Flag' },
  { value: 'config_entry', label: 'Config' },
];

// Re-export all icons
export {
  Mail, Shield, Globe, Sparkles, Infinity, Lock, Zap,
  LayoutDashboard, Users, CreditCard, Settings, LogOut, ArrowLeft,
  Diamond, ShieldCheck, Flag, FileText, ClipboardList,
  MessageSquare, Wallet, Clock, AlertTriangle, Activity,
  BarChart3, TrendingUp, Server, Database, Inbox, Plus,
  ArrowUpRight, Search, Filter, MoreHorizontal, ChevronRight,
  ArrowRight, WifiOff, Edit, Trash2, Eye, RotateCcw, UserCheck,
  Ban, Key, DollarSign, Download, Check, X, Flame, Star,
};
