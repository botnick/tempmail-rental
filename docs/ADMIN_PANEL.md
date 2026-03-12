# 🛡️ Admin Panel

> หน้า Admin เข้าถึงได้ที่ `/admin` — ต้อง login ด้วย account ที่มี Admin role
> UI ใช้ dark theme + glassmorphism + warm orange accents

---

## Admin Pages (10 หน้า)

| หน้า | Route | Component | Description |
|------|-------|-----------|-------------|
| **Dashboard** | `/admin` | `AdminDashboardContent` | สถิติภาพรวม: users, mailboxes, revenue |
| **Users** | `/admin/users` | `AdminUsersContent` | จัดการ user: suspend, unsuspend, grant credits, assign role |
| **Mailboxes** | `/admin/mailboxes` | `AdminMailboxesContent` | ดู/จัดการ mailboxes ทั้งระบบ |
| **Domains** | `/admin/domains` | `AdminDomainsContent` | จัดการ domains + verification |
| **SEO** | `/admin/seo` | `AdminSeoContent` | SEO Pages, FAQ, Answers, Redirects (4 tabs) |
| **CMS** | `/admin/cms` | `AdminCmsContent` | แก้ไข config values (site name, descriptions) |
| **Billing** | `/admin/billing` | `AdminBillingContent` | ดู transactions, invoices |
| **Plans** | `/admin/plans` | `AdminPlansContent` | จัดการแพ็คเกจ pricing |
| **Security** | `/admin/security` | `AdminSecurityContent` | Risk events, active sessions |
| **Audit Log** | `/admin/audit` | `AdminAuditContent` | ดู audit trail ทั้งหมด |
| **Feature Flags** | `/admin/feature-flags` | `AdminFeatureFlagsContent` | เปิด/ปิด features |

---

## UI Components

| Component | Description |
|-----------|-------------|
| `AdminSidebar` | Navigation sidebar (collapsible on mobile) |
| `ConfirmModal` | Modal ยืนยันก่อน destructive action |
| `RichTextEditor` | TipTap editor สำหรับ FAQ/Answer (WP-style toolbar) |
| `StatCard` | การ์ดแสดงสถิติ |
| `StatusBadge` | Badge แสดงสถานะ (active/suspended/etc.) |
| `EmptyState` | แสดงเมื่อไม่มีข้อมูล |
| `Skeleton` | Loading skeleton |
| `Toast` | Notification toast |

---

## SEO Panel (4 Tabs)

### Tab 1: หน้าเว็บ (Pages)
- สร้าง/แก้ไข/ลบ ContentPage
- Fields: slug, locale, title, metaDescription
- Filter by locale

### Tab 2: คำถามที่พบบ่อย (FAQ)
- CRUD สำหรับ FaqItem
- **Rich Text Editor** สำหรับ Answer
- Fields: question, answer (HTML), category, locale

### Tab 3: การเปลี่ยนเส้นทาง (Redirects)
- จัดการ URL redirects (301/302)
- Fields: sourcePath, destinationPath, isPermanent

### Tab 4: คำตอบ (Answers)
- CRUD สำหรับ AnswerBlock (optimized for AI search)
- **Rich Text Editor** สำหรับ Answer
- Fields: question, answer (HTML), intent, locale

---

## Admin Layout

```
┌─────────────────────────────────────────────┐
│  Admin Sidebar ┃  Main Content Area          │
│                ┃                             │
│  🏠 Dashboard  ┃  ┌─────────────────────┐    │
│  👤 Users      ┃  │  Page Header        │    │
│  📬 Mailboxes  ┃  │  + Tab Navigation   │    │
│  🌐 Domains    ┃  │                     │    │
│  🔍 SEO        ┃  │  Content / Table    │    │
│  📝 CMS        ┃  │  + CRUD Modals     │    │
│  💰 Billing    ┃  │                     │    │
│  📦 Plans      ┃  └─────────────────────┘    │
│  🛡️ Security   ┃                             │
│  📋 Audit Log  ┃                             │
│  🚩 Flags      ┃                             │
│                ┃                             │
│  ← กลับ       ┃                             │
│  🔓 ออกจากระบบ ┃                             │
└─────────────────────────────────────────────┘
```

---

## Permission System

Admin actions ถูกควบคุมด้วย permissions ดังนี้:

```
admin.user.view          → ดู user list
admin.user.manage        → suspend/unsuspend/assign role
admin.billing.manage     → grant credits, manage billing
admin.mailbox.view       → ดู mailboxes
admin.mailbox.manage     → delete/quarantine mailboxes
admin.domain.view        → ดู domains
admin.domain.manage      → approve/suspend domains
admin.seo.page.manage    → CRUD pages
admin.seo.faq.manage     → CRUD FAQ
admin.seo.answer.manage  → CRUD answers
admin.seo.redirect.manage → CRUD redirects
admin.cms.manage         → แก้ไข CMS config
admin.security.view      → ดู risk events
admin.audit.view         → ดู audit logs
admin.feature.manage     → จัดการ feature flags
admin.plan.manage        → จัดการ plans
```
