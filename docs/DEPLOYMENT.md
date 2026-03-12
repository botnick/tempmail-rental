# 🚀 Deployment & Setup

> วิธีติดตั้ง, รัน development, และ deploy production

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | ≥ 20.x | Runtime |
| **PostgreSQL** | ≥ 15 | Database |
| **Redis** | ≥ 7 | Cache + Rate limiting |
| **npm** | ≥ 10 | Package manager |

---

## Quick Start (Development)

```bash
# 1. Clone
git clone https://github.com/botnick/tempmail-rental.git
cd tempmail

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env

# 4. Edit .env with your database credentials
# DATABASE_URL="postgresql://user:pass@localhost:5432/tempmail"
# REDIS_URL="redis://localhost:6379"
# SESSION_SECRET="your-secret-key-min-32-chars"

# 5. Push schema to database
npx prisma db push

# 6. Generate Prisma client
npx prisma generate

# 7. Seed database (optional — creates test users + data)
npm run db:seed

# 8. Run development server
npm run dev

# 9. Open http://localhost:3000
```

---

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/tempmail"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth
SESSION_SECRET="minimum-32-character-secret-key-here"
SESSION_TTL_HOURS="24"
REFRESH_TTL_DAYS="30"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

---

## Database Setup

```bash
# Push schema (development — ไม่สร้าง migration)
npx prisma db push

# Generate client
npx prisma generate

# Seed data (creates test users, plans, roles, permissions)
npm run db:seed

# Open Prisma Studio (visual DB editor)
npx prisma studio

# Create migration (production)
npx prisma migrate dev --name "description"

# Apply migrations (production)
npx prisma migrate deploy
```

### Test Accounts (from seed)

| Email | Password | Role |
|-------|----------|------|
| `admin@tempmail.dev` | `Tempmail@2026` | SUPER_ADMIN (MFA) |
| `ops@tempmail.dev` | `Tempmail@2026` | ADMIN (MFA) |
| `support@tempmail.dev` | `Tempmail@2026` | Support |
| `finance@tempmail.dev` | `Tempmail@2026` | Finance (MFA) |
| `security@tempmail.dev` | `Tempmail@2026` | Security (MFA) |
| `somchai.dev@gmail.com` | `Tempmail@2026` | Pro User (MFA) |
| `enterprise@bigcorp.co.th` | `Tempmail@2026` | Business (MFA) |
| `tanawat.p@gmail.com` | `Tempmail@2026` | Free User |

---

## npm Scripts

```bash
npm run dev        # Start development server (Turbopack)
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint
npm run db:seed    # Seed database
```

---

## Production Deployment

### Build
```bash
npm run build      # Creates optimized production build
npm run start      # Starts on port 3000
```

### Docker (recommended)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Checklist (Production)
- [ ] `NODE_ENV=production`
- [ ] Strong `SESSION_SECRET` (≥32 chars, random)
- [ ] SSL/TLS enabled (HTTPS)
- [ ] PostgreSQL with connection pooling (PgBouncer)
- [ ] Redis with persistence (AOF)
- [ ] Security headers enabled (already in `next.config.ts`)
- [ ] Rate limiting configured
- [ ] Backup strategy for PostgreSQL

---

## Mail Server

Mail server component อยู่ใน `/mailserver` (separate repo, git-ignored)  
ใช้สำหรับรับ email จริง → forward เข้า TempMail via API

> ⚠️ Mail server ยังอยู่ระหว่างพัฒนา — ตอนนี้ข้อมูลเมลผ่าน seed data
