# ✨ Features

> สรุปฟีเจอร์ทั้งหมดของ TempMail — แบ่งตาม Module

---

## 🎯 Core Features

### Temporary Email
- สร้าง email ชั่วคราวแบบสุ่ม (human-readable names เช่น `sunset-ocean-42`)
- ตั้เวลาหมดอายุ (24 ชม. ถึง 1 ปี ขึ้นกับ plan)
- รับ email เข้า inbox (text + HTML)
- ไฟล์แนบพร้อม malware scanning (pending/clean/malicious)
- Mailbox aliases
- Event logging (created, expired, message_received, etc.)

### User Dashboard
- **Dashboard Overview**: สถิติ mailboxes, messages, subscription
- **Mailbox Management**: สร้าง/ลบ/ดู mailboxes + messages
- **Domain Management**: Custom domains + DNS verification
- **Billing**: Wallet balance, transaction history, top-up
- **Settings**: Profile, password change, MFA setup

### Landing Page
- Premium dark theme + warm orange accents
- Animated hero section
- FAQ section (ดึงจาก DB, cached)
- Answer blocks สำหรับ AI search engines
- Responsive design

---

## 🌏 Internationalization (i18n)

- **Locales**: Thai (TH), English (EN)
- **Default**: Thai
- **Routing**: `/{locale}/path` (e.g., `/th/dashboard`, `/en/pricing`)
- **Dictionary**: `src/dictionaries/th.json` (~27KB), `en.json` (~15KB)
- **Middleware**: Auto-redirect to default locale
- **Coverage**: ทุก UI string, error messages, admin panel labels

---

## 🎨 Design System

### Theme
- **Base Color**: `#0d0a07` (warm near-black)
- **Surface**: `#161210`
- **Elevated**: `#1e1914`
- **Brand**: `#f97316` (orange) with variants (bright, deep, glow, soft)
- **Accent Colors**: Teal, Sky (complement orange)
- **Text**: Primary `#fef3e2`, Secondary `#d4b896`, Muted `#8b7355`

### Typography
- **Font**: LINE Seed Sans TH (5 weights: Thin, Regular, Bold, ExtraBold, Heavy)
- **Local loading**: woff2 from `/public/fonts/`

### Effects
- Glassmorphism modals (backdrop-blur + translucent bg)
- Warm mesh background (animated radial gradients)
- Noise overlay texture
- Micro-animations (fade-in, slide-in, zoom-in)
- Custom scrollbar (orange accent)

---

## 📊 Admin Panel Features

### Dashboard
- Total users, active mailboxes, revenue stats

### User Management
- Search + paginated list
- Suspend / unsuspend accounts
- Assign roles (dropdown with all roles)
- Grant wallet credits
- View user details

### SEO Management
- **Pages**: CRUD for ContentPage (slug, title, metaDescription)
- **FAQ**: CRUD with rich text editor for answers
- **Answers**: CRUD for AI-optimized answer blocks
- **Redirects**: 301/302 redirect management

### CMS
- Edit config values (site name, descriptions, etc.)
- Audit trail per config change

### Feature Flags
- Create flags with targeting (roles, plans, specific users)
- Toggle enable/disable
- Rollout percentage (0-100%)

### Security
- Risk events viewer (type, severity, IP, resolution)
- Active sessions viewer

### Audit Log
- Full audit trail (who did what, when, from where)
- Before/after snapshots

---

## ⚡ Performance

### Landing Page Cache
- Server-side caching ของ FAQ + Answers
- Semi-static rendering (update เมื่อ admin แก้ไข)
- ลด DB queries สำหรับ high-traffic landing page

### Database Optimization
- Strategic indexes ทุกตาราง (เช่น `[userId]`, `[status]`, `[createdAt]`)
- Optimistic locking สำหรับ Wallet (version field)
- Idempotency keys ป้องกัน duplicate transactions

---

## 📄 Legal Pages

- **Privacy Policy** (`/privacy`) — ไม่อ้างอิงกฎหมายเฉพาะ, neutral language
- **Terms of Service** (`/terms`) — Production-ready
- **Contact Us** (`/contact`) — Contact form with tRPC endpoint

---

## 🔮 Future Plans (Roadmap)

### Short-term
- [ ] Mail server integration (Haraka/Postfix สำหรับรับ email จริง)
- [ ] Payment gateway integration (Stripe/Omise)
- [ ] Email notification system
- [ ] API key สำหรับ external access

### Medium-term
- [ ] Custom domain SSL certificates
- [ ] Webhook notifications เมื่อรับ email ใหม่
- [ ] Mobile responsive improvements
- [ ] Email forwarding rules

### Long-term
- [ ] Multi-region deployment
- [ ] GraphQL API (alongside tRPC)
- [ ] Plugin system สำหรับ extensions
- [ ] AI-powered spam filtering
- [ ] Chrome extension
