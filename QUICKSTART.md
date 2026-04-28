# คู่มือเริ่มใช้งานเร็ว ๆ

ไฟล์ `.bat` ทุกตัวอยู่ที่ root ของ project ดับเบิลคลิกได้เลยจาก File Explorer

## ครั้งแรกของเครื่องนี้

ดับเบิลคลิก **`setup.bat`**  
จะทำให้:
1. ตรวจ Node 20+
2. ตรวจไฟล์ `.env` (ต้องมี `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `ARGON2_SECRET`, `GUEST_TOKEN_SECRET`)
3. `npm install`
4. `npx prisma db push --accept-data-loss` (apply schema)
5. `npx prisma generate`
6. `npm run db:seed` (สร้าง roles, permissions, plans รวม Guest tier, demo users)

ใช้เวลาประมาณ 1–3 นาที ขึ้นกับเน็ต

## ใช้งานทุกวัน

ดับเบิลคลิก **`start.bat`**  
รัน dev server → เปิดเบราว์เซอร์ที่ `http://localhost:3000`  
หน้าหลักจะสร้าง mailbox ชั่วคราวให้ทันทีโดยไม่ต้อง login

ปิดด้วย Ctrl+C

## สั่งงานอื่น ๆ

| ไฟล์ | ใช้ตอนไหน |
|-----|-----------|
| `start.bat` | เปิด dev server (ใช้บ่อยสุด) |
| `build.bat` | ทดสอบ production build + start prod server |
| `seed.bat` | seed ใหม่หลังเพิ่ม plan/permission ใหม่ |
| `cron.bat` | trigger cron job ด้วยมือเพื่อทดสอบ (`expire` / `all` / ทั้งคู่) |
| `setup.bat` | ติดตั้งใหม่หลัง schema เปลี่ยน หรือ DB ว่าง |

## บัญชีทดสอบ (จาก seed)

password ทุกบัญชี: `Tempmail@2026`

| email | สิทธิ์ |
|-------|--------|
| `admin@tempmail.dev` | SYSTEM_ADMIN (MFA) |
| `ops@tempmail.dev` | ADMIN |
| `support@tempmail.dev` | ADMIN |
| `somchai.dev@gmail.com` | CUSTOMER |
| `enterprise@bigcorp.co.th` | CUSTOMER (Enterprise plan) |

## Service ที่ optional (ตั้งทีหลังได้)

ถ้ายังไม่ตั้งใน `.env`, feature นั้น ๆ ปิดใช้งานเงียบ ๆ:

| ENV | ฟีเจอร์ที่ unlock |
|-----|------------------|
| `RESEND_API_KEY` | ส่ง email จริง (verify, reset, welcome, billing) — ไม่ตั้ง = log ลง console |
| `R2_ACCOUNT_ID` + R2 keys | Download attachment จริง — ไม่ตั้ง = `/api/attachments/[id]` คืน 503 |
| `TURNSTILE_SITE_KEY` + secret | CAPTCHA บน guest signup |
| `SMTP_*` | Email fallback ถ้าไม่ใช้ Resend |

## ปัญหาที่พบบ่อย

**`Plan features not configured for user X`** ตอนสร้าง mailbox  
→ ยังไม่ได้รัน seed → กด `seed.bat`

**Build error เกี่ยวกับ Prisma**  
→ schema เปลี่ยนแต่ client ยังไม่ regen → กด `setup.bat` (จะ generate ใหม่)

**`/api/cron/expire` คืน 401**  
→ `CRON_SECRET` ใน `.env` ไม่ตรงกับที่ส่ง → ใช้ `cron.bat` ที่อ่าน secret จาก `.env` อัตโนมัติ
