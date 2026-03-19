# 📧 TempMail — Secure Temporary Email SaaS

> **Production-grade temporary email service** built with Next.js 16, Prisma, tRPC, and PostgreSQL.  
> Features enterprise-level security (Argon2id, RBAC, MFA, Audit Logging), Go-powered mail backend integration, a full admin panel, SEO/AEO optimization, and a premium dark UI with glassmorphism design.

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.1.6-000?logo=next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript" />
  <img src="https://img.shields.io/badge/Prisma-7.4.2-2D3748?logo=prisma" />
  <img src="https://img.shields.io/badge/tRPC-11.0-398CCB" />
  <img src="https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql" />
  <img src="https://img.shields.io/badge/Redis-7+-DC382D?logo=redis" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?logo=tailwindcss" />
  <img src="https://img.shields.io/badge/Go_Backend-1.21+-00ADD8?logo=go" />
</p>

---

## ⚡ Quick Start

```bash
git clone https://github.com/botnick/tempmail-rental.git
cd tempmail-rental
npm install
cp .env.example .env          # Edit with your DB credentials
npx prisma db push
npx prisma generate
npm run db:seed                # Optional: seed test data
npm run dev                    # Open http://localhost:3000
```

> 📖 Full setup instructions → [**docs/DEPLOYMENT.md**](docs/DEPLOYMENT.md)

---

## 🏗️ Architecture

Full-stack TypeScript application with **5 distinct layers** + Go mail backend:

```
Frontend (React 19 + Tailwind)
    ↓ tRPC (type-safe API)
API Layer (tRPC v11 + Zod validation)
    ↓
Service Layer (16 services)
    ↓
Repository Layer (9 repositories)
    ↓
Data Layer (PostgreSQL + Redis)
    ↕ REST API
Go Mail Backend (SMTP, mailbox lifecycle, webhooks)
```

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| API | tRPC v11 (end-to-end typesafe) |
| Database | PostgreSQL + Prisma ORM (35+ models) |
| Cache | Redis (ioredis) |
| Auth | Argon2id + HMAC-SHA256 sessions + TOTP MFA |
| Mail Backend | Go SDK (mailbox CRUD, message relay, webhooks) |
| UI | Tailwind CSS + Glassmorphism dark theme |
| Editor | TipTap rich text editor |
| i18n | Thai 🇹🇭 / English 🇬🇧 |

> 📖 Full architecture details → [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md)

---

## ✨ Features

### Core
- 📬 **Temporary Email** — Create disposable emails with human-readable usernames
- 📥 **Inbox** — Receive, read, delete emails + attachments with real-time SSE updates
- 🌐 **Custom Domains** — Add your own domain with automated DNS verification & cron recheck
- 💳 **Billing** — Wallet system + invoices + payment transactions
- 📦 **Plans** — Free / Pro / Business tiers with feature limits & quota enforcement
- 🔄 **Mailbox Sync** — Resilient sync with Go backend (auto-expire on 404, reconciliation)

### Admin Panel (12 sections)
- 📊 Dashboard overview with live stats
- 👤 User management (suspend, role assign, grant credits)
- 📬 Mailbox & TempMail management
- 🌐 Domain management (public/private, DNS verification, tenant ownership)
- 🔍 SEO management (meta tags, keywords, structured data)
- 📝 CMS management (FAQ, Answers, Redirects, Pages)
- 🚩 Feature flags with targeting rules
- 💰 Plans & billing configuration
- 🛡️ RBAC roles & permissions management (role CRUD)
- 🔒 Security events + Audit trail
- 💲 Billing overview

### Security
- 🔑 Argon2id password hashing
- 🍪 Secure httpOnly session cookies
- 📱 TOTP Multi-Factor Authentication
- 🛡️ RBAC with fine-grained permissions (role CRUD, permission matrix)
- 📋 Complete audit logging (before/after snapshots)
- 🚫 CVE-2025-29927 mitigation
- ⚡ Rate limiting + CSRF protection
- 🔐 Webhook HMAC signature validation
- 🔄 Step-up authentication for sensitive operations
- 📧 Email verification & password reset flows

### SEO/AEO
- 📄 Content pages with version history
- ❓ FAQ management (JSON-LD structured data)
- 🤖 Answer blocks optimized for AI search engines
- 🔄 URL redirect management (301/302)
- 🏷️ Keyword clusters + intent mapping

> 📖 Complete feature list → [**docs/FEATURES.md**](docs/FEATURES.md)

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| 📖 [**Architecture**](docs/ARCHITECTURE.md) | Tech stack, project structure, architectural layers, design decisions |
| 🗄️ [**Database**](docs/DATABASE.md) | 35+ Prisma models, ER diagram, all enums, field descriptions |
| 🔌 [**API Reference**](docs/API.md) | tRPC router tree, all endpoints, auth flow, middleware stack |
| 🔗 [**API Integration**](docs/API_INTEGRATION.md) | Go backend SDK integration, endpoints mapping, webhook flow |
| 🛡️ [**Admin Panel**](docs/ADMIN_PANEL.md) | 12 admin sections, UI components, permission system |
| 🔒 [**Security**](docs/SECURITY.md) | Auth, RBAC, middleware, password policy, audit trail |
| ✨ [**Features**](docs/FEATURES.md) | All features, i18n, design system, performance, roadmap |
| 🚀 [**Deployment**](docs/DEPLOYMENT.md) | Setup guide, env vars, Docker, production checklist |

---

## 🗂️ Project Structure

```
tempmail-rental/
├── docs/                  # 📚 Project documentation
├── prisma/
│   ├── schema.prisma      # 846 lines, 35+ models
│   └── seed.ts            # Production-like seed data
├── public/fonts/          # LINE Seed Sans TH (5 weights)
├── src/
│   ├── app/[locale]/      # Next.js pages (9 routes)
│   │   ├── admin/         # 12 admin sub-pages
│   │   ├── dashboard/     # User dashboard
│   │   ├── forgot-password/  # Password reset flow
│   │   └── p/[slug]/      # Dynamic CMS pages
│   ├── components/        # 40+ React components
│   │   ├── admin/         # 12 admin page components
│   │   ├── blocks/        # Content block components
│   │   ├── dashboard/     # 8 dashboard components
│   │   ├── layout/        # Mobile nav, headers
│   │   ├── providers/     # Context providers
│   │   ├── seo/           # SEO components
│   │   └── ui/            # 10 shared UI components
│   ├── config/ui.ts       # Centralized UI dictionary
│   ├── dictionaries/      # TH + EN translations
│   ├── middleware.ts       # Auth + locale + CVE protection
│   └── server/
│       ├── auth/          # Session, password, MFA
│       ├── cron/          # Domain recheck jobs
│       ├── lib/           # DNS utils, SSE hub
│       ├── middleware/     # Rate limit, CSRF, audit
│       ├── policy/        # RBAC + permissions
│       ├── repositories/  # 9 data access layers
│       ├── services/      # 16 business logic services
│       └── trpc/          # tRPC router (25 routers)
└── tailwind.config.ts     # Custom warm dark theme
```

---

## 🎨 Design

Premium dark theme with warm orange accents:
- **Color**: Warm near-black base (`#0d0a07`) + Orange brand (`#f97316`)
- **Font**: LINE Seed Sans TH (locally loaded, 5 weights)
- **Effects**: Glassmorphism modals, animated mesh background, noise overlay
- **Admin Modals**: Backdrop blur + warm glow shadow + translucent cards
- **Responsive**: Mobile-first with dedicated mobile navigation

---

## 🛠️ Tech Stack

<table>
<tr><td><strong>Frontend</strong></td><td>React 19, Next.js 16, Tailwind CSS 3, TipTap, Lucide Icons</td></tr>
<tr><td><strong>API</strong></td><td>tRPC v11, Zod v4, SuperJSON</td></tr>
<tr><td><strong>Database</strong></td><td>PostgreSQL, Prisma ORM 7</td></tr>
<tr><td><strong>Cache</strong></td><td>Redis (ioredis)</td></tr>
<tr><td><strong>Auth</strong></td><td>Argon2id, HMAC-SHA256 sessions, TOTP MFA</td></tr>
<tr><td><strong>Mail Backend</strong></td><td>Go SDK (REST API + Webhooks)</td></tr>
<tr><td><strong>Observability</strong></td><td>Pino structured logging</td></tr>
<tr><td><strong>Utils</strong></td><td>Day.js, nanoid, DOMPurify, clsx, class-variance-authority</td></tr>
</table>

---

## 📜 License

Private project — All rights reserved.

---

<p align="center">
  <sub>Built with ❤️ and ☕ — TempMail SaaS Platform</sub>
</p>
