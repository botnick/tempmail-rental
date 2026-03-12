# 🔌 API Reference

> ระบบ API ทั้งหมดใช้ **tRPC v11** (end-to-end type safety)
> ไม่มี REST endpoints — ทุกอย่างผ่าน tRPC query/mutation

---

## Router Structure

```
appRouter
├── auth                    # Authentication
├── mailbox                 # Mailbox operations
├── content                 # Public content/pages
├── billing                 # User billing
├── domain                  # Domain management
├── health                  # Health check
├── plan                    # Public plan listing
└── admin                   # Admin-only (protected)
    ├── dashboard           # Admin dashboard stats
    ├── user                # User management
    ├── mailbox             # Mailbox admin
    ├── domain              # Domain admin
    ├── billing             # Billing admin
    ├── plan                # Plan management
    ├── cms                 # CMS content editor
    ├── seo                 # SEO/FAQ/Answers/Redirects
    ├── featureFlag         # Feature flag management
    ├── security            # Risk events, sessions
    ├── audit               # Audit log viewer
    └── index               # Admin router aggregator
```

---

## Public Endpoints

### `auth.*`
| Endpoint | Type | Description |
|----------|------|-------------|
| `auth.register` | mutation | สมัครสมาชิก (email, password, displayName) |
| `auth.login` | mutation | เข้าสู่ระบบ (email, password) → set cookies |
| `auth.logout` | mutation | ออกจากระบบ |
| `auth.me` | query | ดึงข้อมูล user ปัจจุบัน + roles + permissions |

### `mailbox.*`
| Endpoint | Type | Description |
|----------|------|-------------|
| `mailbox.list` | query | ดึง mailbox ทั้งหมดของ user |
| `mailbox.create` | mutation | สร้าง mailbox ใหม่ |
| `mailbox.getMessages` | query | ดึงข้อความใน mailbox |
| `mailbox.delete` | mutation | ลบ mailbox |

### `content.*`
| Endpoint | Type | Description |
|----------|------|-------------|
| `content.getPage` | query | ดึงหน้า CMS โดย slug + locale |
| `content.getBlocks` | query | ดึง content blocks |

### `billing.*`, `domain.*`, `plan.*`
| Endpoint | Type | Description |
|----------|------|-------------|
| `billing.myWallet` | query | ดึงข้อมูลกระเป๋าเงิน |
| `billing.myTransactions` | query | ดึง transaction history |
| `domain.list` | query | ดึง domain ที่เป็นของ user |
| `plan.list` | query | ดึง plan ทั้งหมด (public) |

---

## Admin Endpoints (ต้อง login + มี permission)

### `admin.user.*`
| Endpoint | Type | Description | Permission |
|----------|------|-------------|------------|
| `admin.user.list` | query | ดึง user ทั้งหมด (paginated) | `admin.user.view` |
| `admin.user.suspend` | mutation | ระงับ user | `admin.user.manage` |
| `admin.user.unsuspend` | mutation | ปลดแบน user | `admin.user.manage` |
| `admin.user.grantCredits` | mutation | เพิ่มเครดิต | `admin.billing.manage` |
| `admin.user.assignRole` | mutation | กำหนด role | `admin.user.manage` |

### `admin.seo.*`
| Endpoint | Type | Description | Permission |
|----------|------|-------------|------------|
| `admin.seo.listPages` | query | ดึง ContentPage ทั้งหมด | `admin.seo.page.manage` |
| `admin.seo.createPage` | mutation | สร้างหน้า SEO | `admin.seo.page.manage` |
| `admin.seo.listFaqs` | query | ดึง FAQ ทั้งหมด | `admin.seo.faq.manage` |
| `admin.seo.createFaq` | mutation | สร้าง FAQ | `admin.seo.faq.manage` |
| `admin.seo.listAnswers` | query | ดึง Answer Blocks | `admin.seo.answer.manage` |
| `admin.seo.createAnswer` | mutation | สร้าง Answer Block | `admin.seo.answer.manage` |
| `admin.seo.listRedirects` | query | ดึง Redirects | `admin.seo.redirect.manage` |
| `admin.seo.createRedirect` | mutation | สร้าง Redirect | `admin.seo.redirect.manage` |

### `admin.featureFlag.*`
| Endpoint | Type | Description |
|----------|------|-------------|
| `admin.featureFlag.list` | query | ดึง feature flags ทั้งหมด |
| `admin.featureFlag.create` | mutation | สร้าง flag ใหม่ |
| `admin.featureFlag.toggle` | mutation | เปิด/ปิด flag |
| `admin.featureFlag.delete` | mutation | ลบ flag |

---

## Authentication Flow

```
1. Client → POST /api/trpc/auth.login
   Body: { email, password }

2. Server validates → Argon2id verify
   ├─ If MFA enabled → return { requiresMfa: true, challengeId }
   └─ If no MFA → create session

3. Server creates Session record
   ├─ Generate token (nanoid 32 chars)
   ├─ Hash with HMAC-SHA256
   ├─ Set httpOnly cookie: session_token
   └─ Set httpOnly cookie: refresh_token

4. All subsequent requests → cookie auto-sent
   → tRPC middleware reads cookie
   → Validates session in DB
   → Attaches { session, actor, permissions } to context
```

---

## Middleware Stack

```
Request → Next.js Middleware
  ├─ CVE-2025-29927 protection
  ├─ Locale detection + redirect
  ├─ Auth guard (dashboard/admin paths)
  └─ Forward to tRPC

tRPC Context Creation
  ├─ Parse session_token cookie
  ├─ Lookup session in DB
  ├─ Load user + roles + permissions
  └─ Attach to ctx

tRPC Router Middleware
  ├─ authedProcedure → requires valid session
  ├─ adminProcedure → requires admin role
  └─ requirePermission('key') → checks specific permission
```
