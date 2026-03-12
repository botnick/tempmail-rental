# 🏗️ Architecture Overview

> TempMail เป็น **Secure Temporary Email SaaS** สร้างด้วย Next.js 16 (App Router) + Prisma + tRPC
> ออกแบบเป็น Production-grade ตั้งแต่แรก — ระบบ RBAC, Audit Logging, MFA, Billing, และ SEO/AEO

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Next.js (App Router, Turbopack) | 16.1.6 |
| **Language** | TypeScript | 5.x |
| **UI** | React + Tailwind CSS | 19.2.3 / 3.4.17 |
| **API** | tRPC (end-to-end typesafe) | 11.0.0 |
| **Database** | PostgreSQL via Prisma ORM | Prisma 7.4.2 |
| **Cache** | Redis via ioredis | 5.10.0 |
| **Auth** | Argon2id + HMAC-SHA256 sessions + TOTP MFA | Custom |
| **Rich Text** | TipTap | 3.20.1 |
| **Icons** | Lucide React | 0.577.0 |
| **Validation** | Zod | 4.3.6 |
| **Date** | Day.js | 1.11.19 |
| **Fonts** | LINE Seed Sans TH (local woff2) | Custom |

---

## Directory Structure

```
tempmail/
├── prisma/
│   ├── schema.prisma          # 846 lines, 35+ models
│   ├── seed.ts                # Production-like seed data
│   └── seed/                  # Modular seed helpers
├── public/
│   └── fonts/                 # LINE Seed Sans TH (5 weights)
├── src/
│   ├── app/                   # Next.js App Router pages
│   │   └── [locale]/          # i18n routing (TH, EN)
│   │       ├── page.tsx       # Landing page with SEO cache
│   │       ├── login/         # Auth pages
│   │       ├── register/
│   │       ├── dashboard/     # User dashboard
│   │       ├── admin/         # Admin panel (10 pages)
│   │       ├── pricing/       # Pricing page
│   │       ├── contact/       # Contact form
│   │       ├── privacy/       # Privacy policy
│   │       ├── terms/         # Terms of service
│   │       └── p/[slug]/      # Dynamic CMS/SEO pages
│   ├── components/
│   │   ├── admin/             # 12 admin panel components
│   │   ├── blocks/            # Landing page blocks (FAQ, Answers)
│   │   ├── dashboard/         # 6 user dashboard components
│   │   ├── seo/               # SEO-optimized components
│   │   └── ui/                # 8 shared UI components
│   ├── config/
│   │   └── ui.ts              # Centralized UI dictionary & theme
│   ├── dictionaries/          # i18n: th.json, en.json
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Client utilities
│   ├── middleware.ts           # Auth guard + locale + CVE protection
│   └── server/
│       ├── auth/              # Session, password, tokens, guards
│       ├── config/            # Environment config
│       ├── db/                # Prisma client singleton
│       ├── lib/               # Server utilities
│       ├── middleware/        # Rate limiting, CSRF, audit, security, webhooks
│       ├── policy/            # RBAC + permissions engine
│       ├── repositories/      # 9 data access repositories
│       ├── services/          # 14 business logic services
│       └── trpc/              # tRPC router tree
│           └── routers/
│               ├── admin/     # 12 admin-only routers
│               ├── auth.ts    # Auth endpoints
│               ├── mailbox.ts # Mailbox CRUD
│               └── ...        # 7 public routers
├── tailwind.config.ts         # Custom warm dark theme
├── next.config.ts             # Security headers, i18n rewrites
└── package.json
```

---

## Architecture Layers

```
┌─────────────────────────────────────────────┐
│                  FRONTEND                    │
│  Next.js App Router (RSC + Client Components)│
│  Tailwind CSS + Glassmorphism Dark Theme     │
│  React Query + tRPC Client                   │
└────────────────────┬────────────────────────┘
                     │ tRPC calls
┌────────────────────▼────────────────────────┐
│                 tRPC LAYER                   │
│  Type-safe API with Zod validation           │
│  Context: { db, session, actor, permissions } │
│  Middleware: auth, admin, permission guards   │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│             SERVICE LAYER (14)               │
│  Business logic: Auth, Billing, Mailbox,     │
│  MFA, Quota, Security, Approval, etc.        │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│           REPOSITORY LAYER (9)               │
│  Data access: User, Session, Mailbox,        │
│  Domain, Billing, Config, etc.               │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│              DATA LAYER                      │
│  PostgreSQL (Prisma ORM, 35+ models)         │
│  Redis (Session cache, Rate limiting)        │
└──────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. Config-Driven Architecture
ระบบทั้งหมดขับเคลื่อนด้วย Config — Plans, Features, Permissions ทั้งหมดอยู่ใน DB ไม่ hardcode

### 2. RBAC with Fine-Grained Permissions
ไม่ใช่แค่ Admin/User แต่มี Role → Permission mapping ผ่านตาราง `roles`, `permissions`, `role_permissions`, `user_roles`

### 3. Audit-Heavy Design
ทุก admin action ถูก log ไว้ใน `audit_logs` พร้อม before/after snapshot, IP address, user agent, reason

### 4. Multi-Tenant Ready
รองรับ Custom Domain, Multiple Plans, Feature Flags per role/plan/user

### 5. SEO/AEO First
มี Content Management System สำหรับ FAQ, Answers, Pages, Redirects, Structured Data (JSON-LD), Keyword Clusters
