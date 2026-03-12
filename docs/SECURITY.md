# 🔒 Security

> TempMail ออกแบบ Security เป็น Priority #1 — ทุก Layer มี Protection

---

## Authentication

### Password Hashing
- **Algorithm**: Argon2id (memory-hard, GPU-resistant)
- **Library**: `argon2` npm package
- **Config**: Default Argon2id params (time cost, memory cost, parallelism)

### Session Management
- **Token Generation**: `nanoid` (32 characters, crypto-random)
- **Token Storage**: HMAC-SHA256 hash ของ token เก็บใน DB (token ตัวจริงไม่เคยอยู่ใน DB)
- **Cookie**: `httpOnly`, `secure`, `sameSite: lax`
- **Refresh Token**: แยก cookie สำหรับ refresh
- **Expiry**: Configurable (default session + refresh expiry)
- **Admin Sessions**: flag `isAdmin` แยกจาก user sessions

### Multi-Factor Authentication (MFA)
- **Algorithm**: TOTP (Time-based One-Time Password)
- **Service**: `mfa.service.ts` — generate secret, verify token
- **Step-Up Auth**: `step-up.service.ts` — require re-auth สำหรับ sensitive operations

---

## Authorization (RBAC)

### Role System
```
SUPER_ADMIN → ทุก permission
ADMIN       → admin permissions (ยกเว้น destructive)
USER_PRO    → pro features
USER_FREE   → basic features
```

### Permission Guard
```typescript
// ทุก admin endpoint ถูก protect ด้วย:
adminRouter.requirePermission('admin.user.manage')

// ตรวจสอบ permission ของ user:
hasPermission(ctx.actor.permissions, 'admin.user.manage')
```

### Policy Engine (`src/server/policy/`)
- `permissions.ts` — Permission key definitions
- `rbac.ts` — Role-based checking logic
- `index.ts` — Policy aggregator

---

## Middleware Security

### 1. CVE-2025-29927 Mitigation (`middleware.ts`)
```typescript
// ป้องกัน Next.js middleware bypass attack
const subrequestHeader = request.headers.get('x-middleware-subrequest');
if (subrequestHeader) {
  return new NextResponse(null, { status: 403 });
}
```

### 2. Rate Limiting (`rate-limit.ts`)
- ใช้ Redis-backed rate limiting
- Configurable per endpoint
- IP-based + User-based limits

### 3. CSRF Protection (`csrf.ts`)
- Token-based CSRF prevention
- Validates origin + referer headers

### 4. Security Headers (`next.config.ts`)
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-DNS-Prefetch-Control: off
X-XSS-Protection: 1; mode=block
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: (configured)
```

### 5. Webhook Verification (`webhook.ts`)
- HMAC signature verification for incoming webhooks

---

## Account Security

### Password Policy
- Minimum length enforcement
- Strength validation in `password.ts`
- `passwordChangedAt` tracking

### Brute Force Protection
- `failedAttempts` counter in `UserCredential`
- `lockedUntil` datetime — auto-lock after N failures
- Risk events created for suspicious activity

### Risk Event System
- Types: `brute_force`, `suspicious_signup`, `account_takeover`, `abuse`
- Severity: `low`, `medium`, `high`, `critical`
- Admin can view and resolve in Security panel

---

## Audit Trail

ทุกการกระทำสำคัญถูกบันทึกใน `AuditLog`:
- **Who**: actorId + actorType (user/system/admin)
- **What**: action name (e.g., `admin.user.suspend`)
- **Target**: targetType + targetId
- **Before/After**: JSON snapshot ก่อนและหลังเปลี่ยนแปลง
- **Context**: ipAddress, userAgent, requestId
- **Reason**: required สำหรับ destructive admin actions

---

## Content Security
- HTML sanitization ด้วย `isomorphic-dompurify` สำหรับ rich text content
- XSS prevention ใน user-generated content
