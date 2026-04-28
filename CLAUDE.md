# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Active plan**: see `C:\Users\n\.claude\plans\snoopy-chasing-feather.md` for the in-progress production-readiness phase plan (P-1 through P7 + W/S/SE/B/N/M phases). Always check that file's "Effort summary" + task list before resuming work.

## Inviolable rules (from user)

- **No hardcoded business values.** Quotas, retention, tier names/colors, defaults — all from DB (`Plan`, `PlanFeature`, `Config`) or env. Magic numbers in service code are forbidden. See `memory/feedback_no_hardcode.md`.
- **No fallback paths.** If a required config is missing, throw a clear "X not seeded" error rather than silently using a default. See `memory/feedback_no_fallback.md`.
- **Commit + document every checkpoint.** After each phase typechecks clean, git commit + update CLAUDE.md/plan/README so the work survives a session boundary. See `memory/feedback_commit_and_handoff.md`.

## Commands

```bash
npm run dev          # Next.js dev server on http://localhost:3000 (Turbopack)
npm run build        # Production build
npm run start        # Run production build
npm run lint         # ESLint (eslint-config-next)
npm run db:seed      # Seed DB via prisma/seed.ts (uses tsx)

npx prisma db push   # Push schema to DB without creating a migration (dev workflow used here)
npx prisma generate  # Regenerate the Prisma client after schema changes
npx prisma studio    # Inspect DB
```

There is **no test runner** configured — do not invent `npm test`. The repo uses `prisma db push` for schema sync (not `migrate dev`); `prisma/migrations/` exists but is not the primary workflow.

`check-api.cjs` and `fix-mfa.mjs` at the repo root are ad-hoc operational scripts, not part of the build.

## High-Level Architecture

This is a Next.js 16 (App Router, React 19) **temporary email SaaS** with a layered backend. The Next.js app is a **frontend + control plane** — actual SMTP/mailbox lifecycle lives in a separate Go mail backend reached over REST (`tempmail.service.ts`), with config (`tempmail.api_url`, `tempmail.api_key`) stored in the DB rather than env. The mail backend repo is excluded via `.gitignore` (`/mailserver`).

### Layers (top → bottom)

```
src/app/[locale]/        Next.js App Router (TH default, EN alt). RSC + client components.
src/middleware.ts        Locale redirect + auth guard for /dashboard /admin + CVE-2025-29927 block
                         (rejects requests with x-middleware-subrequest header).
src/server/trpc/         tRPC v11 router tree (root.ts) + base procedures (trpc.ts).
src/server/services/     16 services — business logic. Procedures call services; services own audit.
src/server/repositories/ 9 repos — Prisma data access. Services compose repos.
prisma/schema.prisma     35+ models. Snake-case @map columns; cuid PKs; soft-delete via deletedAt.
```

### tRPC procedure ladder (`src/server/trpc/trpc.ts`)

All procedures share `loggerMiddleware`. On top:

- `publicProcedure` — no auth.
- `protectedProcedure` — requires session; populates `ctx.session` + `ctx.actor`.
- `adminProcedure` — requires admin role (via `isAdmin(ctx.actor.roles)`).
- `permissionProcedure(PERMISSIONS.X)` — fine-grained RBAC. Use this, **not** `adminProcedure`, for admin endpoints; permission keys are defined in `src/server/policy/permissions.ts` and seeded into the DB `Permission` table.
- `rateLimitedProcedure(policyKey)` / `rateLimitedProtectedProcedure(...)` — Redis sliding-window via `RATE_LIMIT_POLICIES` in `middleware/rate-limit.ts`. Gracefully degrades if Redis is down (logs and allows).

`ctx.actor` is the canonical authorization object: `{ userId, publicId, email, roles, permissions, planSlug }`. Built in `context.ts` from the session cookie/`Authorization: Bearer` header — token is HMAC-hashed (`hashToken`) before DB lookup, never compared in plaintext. `lastActiveAt` updates are throttled per session (60s) to avoid write amplification.

### App router structure

`src/app/[locale]/` — locale segment is mandatory (middleware redirects `/foo` → `/th/foo`). Public marketing pages, `dashboard/`, `admin/` (12 sub-pages), `p/[slug]/` for CMS-managed pages.

`src/app/api/` — non-tRPC HTTP endpoints:
- `api/trpc/[trpc]` — tRPC fetch adapter.
- `api/cron/*` — cron jobs (`domain-recheck`). Auth via `Authorization: Bearer <CRON_SECRET>`.
- `api/webhooks/tempmail` — webhook from Go backend, HMAC-validated.
- `api/auth/*`, `api/tempmail/*`, `api/attachments/*`, etc. — REST shims where SSR or external integration needs raw HTTP.

### Config-driven by design

Plans, plan features, permissions, feature flags, SEO content, and even external service URLs (`tempmail.api_url`) live in DB tables, not env / constants. When adding a "limit" or "feature toggle," prefer `plan_features` / `feature_flags` / `Config` over hardcoding.

### Audit trail is mandatory

Admin and security-relevant mutations write to `audit_logs` with before/after JSON snapshots, IP, user agent, and reason. Use `AuditService` from inside services (not from the tRPC layer) so refactors don't accidentally drop audit calls.

### Auth specifics

- Passwords: Argon2id with `ARGON2_SECRET` pepper (min 16 chars).
- Sessions: nanoid token → HMAC-SHA256 hash stored; cookie is `httpOnly`/`secure`/`sameSite=lax`. Admin and user sessions have separate TTLs (`ADMIN_SESSION_TTL_SECONDS=28800`, `USER_SESSION_TTL_SECONDS=604800`).
- MFA: TOTP (`mfa.service.ts`); step-up re-auth for sensitive ops (`step-up.service.ts`).

### Guest sessions (anonymous tempmail)

- HMAC-signed cookie `guest_token` (see `src/server/lib/guest-session.ts`) carrying `{ gid, mailboxIds[], createdAt }`. Verified ownership of a mailbox is proven by the cookie's `mailboxIds` containing that mailbox.publicId — no DB lookup needed for authz.
- All guest mailboxes are owned by a singleton `anonymous@system.local` user (status=SUSPENDED). The `gid` is threaded through to the Go backend as `tenantId` for per-guest rate limiting on the mail server.
- Quota for guests: subscribed to a seeded `guest` Plan with its own PlanFeature rows. **Never hardcode guest limits** — edit the `guest` plan in `prisma/seed/data.ts` instead.
- `Subject` (in `src/server/lib/types.ts`) unifies authed users + guests for service-layer code. Use `guestOrAuthedProcedure` from `trpc.ts` and `assertMailboxOwnership` to enforce per-call ownership in routers.

### Webhook ingest (canonical inbox)

- Go backend posts to `/api/webhooks/tempmail` → HMAC-verified → message inserted into `MailboxMessage` (deduped by `externalId`) → attachments downloaded via `TempMailService.fetchAttachmentBlob` and uploaded to R2 (`src/server/lib/storage.ts`) → `MailboxAttachment` row → SSE event published with **local mailbox.publicId**.
- `MailboxService.getMessagesBySubject` reads from local DB only — DB is source of truth, never round-trips to Go on read.

### Rank system

- Implemented as 3 columns on `Plan`: `tierName`, `tierColor`, `tierIcon`. No separate `Rank` table. Edited via admin Plans UI; rendered by `RankBadge` component (planned).

### Real-time

Live inbox updates use SSE (`src/server/lib/sse-hub.ts`) — there's no WebSocket layer. Events are fanned out from the webhook handler.

### Validated env

`src/server/config/env.ts` parses `process.env` through Zod at boot. The schema is the source of truth for which env vars exist and their types — extend it when adding new env-driven config rather than reading `process.env` directly.

## Conventions Worth Knowing

- **i18n**: dictionaries live in `src/dictionaries/{th,en}.json`. UI strings flow through `src/config/ui.ts`. Default locale is `th`.
- **Styling**: Tailwind 3 with a custom warm-dark palette in `tailwind.config.ts`. Shared UI primitives in `src/components/ui/`; admin/dashboard composites under `src/components/admin/` and `src/components/dashboard/`.
- **Errors**: throw `TRPCError` (auth/permission boundary) or domain errors from `src/server/lib/errors.ts` (`NotFoundError`, `QuotaExceededError`, `ConflictError`); services map domain errors at their boundaries.
- **Logging**: `src/server/lib/logger.ts` (Pino structured). Always include `requestId` from ctx.
- **Security headers / CSP**: configured in `next.config.ts`. `/dashboard` and `/admin` get `X-Robots-Tag: noindex` from both `next.config.ts` and `middleware.ts` for defense-in-depth.

## Reference Docs

The `docs/` folder has detailed write-ups (some sections are in Thai):
`ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `ADMIN_PANEL.md`, `SECURITY.md`, `FEATURES.md`, `DEPLOYMENT.md`. Consult these before doing anything cross-cutting (e.g., adding a permission, touching the audit pipeline, changing the Go backend integration).
