// prisma/seed.ts — Main seed orchestrator (v3)
// Aligned with: MFA, step-up auth, approval workflow, quota service, 60+ permissions, 9 roles

import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import argon2 from 'argon2';
import {
  ROLES, PERMISSIONS, ROLE_PERMISSIONS, PLANS, USERS, DOMAINS,
  CONFIG_ENTRIES, FEATURE_FLAGS, EMAIL_TEMPLATES,
  daysAgo, hoursAgo, minutesAgo, daysFromNow,
} from './seed/data';
import {
  CONTENT_PAGES, FAQ_ITEMS, GLOSSARY_TERMS, ANSWER_BLOCKS,
  KEYWORD_CLUSTERS, INTENT_CLUSTERS, INTERNAL_LINK_MODULES,
  REDIRECTS, STRUCTURED_DATA,
} from './seed/cms-data';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const PASSWORD = 'Tempmail@2026';

async function hashPw(pw: string) {
  return argon2.hash(pw, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });
}

// ── 1. ROLES & PERMISSIONS (60+ granular permissions, 9 roles) ──
async function seedRoles() {
  console.log('  → Roles & Permissions...');
  const roleMap = new Map<string, string>();
  for (const r of ROLES) {
    const role = await prisma.role.upsert({ where: { name: r.name }, update: {}, create: r });
    roleMap.set(r.name, role.id);
  }
  const permMap = new Map<string, string>();
  for (const p of PERMISSIONS) {
    const perm = await prisma.permission.upsert({ where: { key: p.key }, update: {}, create: p });
    permMap.set(p.key, perm.id);
  }
  for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap.get(roleName)!;
    const keys = permKeys[0] === '*' ? PERMISSIONS.map(p => p.key) : permKeys;
    for (const key of keys) {
      const permId = permMap.get(key);
      if (!permId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permId } },
        update: {}, create: { roleId, permissionId: permId },
      });
    }
  }
  console.log(`    ${roleMap.size} roles, ${permMap.size} permissions`);
  return roleMap;
}

// ── 2. PLANS & PRICING ──
async function seedPlans() {
  console.log('  → Plans & Pricing...');
  const planMap = new Map<string, string>();
  for (const p of PLANS) {
    const plan = await prisma.plan.upsert({
      where: { slug: p.slug }, update: {},
      create: {
        slug: p.slug, name: p.name, description: p.description,
        isDefault: p.isDefault, sortOrder: p.sortOrder, trialDays: p.trialDays, status: 'ACTIVE',
        features: { create: p.features.map(f => ({ featureKey: f.key, value: f.value, valueType: f.valueType })) },
        pricing: { create: p.pricing.map(pr => ({ currency: pr.currency, amount: pr.amount, billingPeriod: pr.billingPeriod })) },
      },
    });
    planMap.set(p.slug, plan.id);
  }
  return planMap;
}

// ── 3. USERS + CREDENTIALS + MFA + WALLETS + SUBSCRIPTIONS ──
async function seedUsers(roleMap: Map<string, string>, planMap: Map<string, string>) {
  console.log('  → Users, Credentials, MFA, Wallets, Subscriptions...');
  const hash = await hashPw(PASSWORD);
  const userMap = new Map<string, string>();

  for (const u of USERS) {
    const created = daysAgo(u.daysAgo);
    const walletBalance = u.plan === 'free' ? 0
      : u.plan === 'enterprise' ? Math.floor(Math.random() * 20000) + 5000
      : Math.floor(Math.random() * 5000) + 200;

    const user = await prisma.user.upsert({
      where: { email: u.email }, update: {},
      create: {
        email: u.email, displayName: u.displayName, status: u.status, createdAt: created,
        emailVerifiedAt: u.status === 'ACTIVE' ? daysAgo(u.daysAgo - 1) : undefined,
        credential: {
          create: {
            passwordHash: hash,
            passwordChangedAt: created,
            totpEnabled: u.mfa,
            totpSecret: u.mfa ? 'JBSWY3DPEHPK3PXP' : null, // demo TOTP secret for MFA users
          },
        },
        wallet: { create: { balance: walletBalance, currency: 'THB' } },
        userRoles: { create: { roleId: roleMap.get(u.role)!, grantedAt: created } },
        subscriptions: {
          create: {
            planId: planMap.get(u.plan)!, status: 'ACTIVE',
            currentPeriodStart: daysAgo(30),
            currentPeriodEnd: daysFromNow(u.plan === 'free' ? 365 : 30),
            ...(u.plan !== 'free' && PLANS.find(p => p.slug === u.plan)?.trialDays ? {
              trialEndsAt: daysAgo(u.daysAgo - (PLANS.find(p => p.slug === u.plan)?.trialDays ?? 0)),
            } : {}),
          },
        },
      },
    });
    userMap.set(u.email, user.id);
  }
  const mfaCount = USERS.filter(u => u.mfa).length;
  console.log(`    ${userMap.size} users (${mfaCount} with MFA)`);
  return userMap;
}

// ── 4. DOMAINS + VERIFICATION + POLICIES ──
async function seedDomains(userMap: Map<string, string>) {
  console.log('  → Domains...');
  const domainMap = new Map<string, string>();
  for (const d of DOMAINS) {
    const userId = 'ownerEmail' in d && d.ownerEmail ? userMap.get(d.ownerEmail) ?? null : null;
    const domain = await prisma.domain.upsert({
      where: { name: d.name }, update: {},
      create: {
        name: d.name, isSystem: d.isSystem, status: d.status, catchAll: d.catchAll, userId,
        ...(d.status === 'PENDING' ? {
          verifications: { create: { recordType: 'TXT', recordName: `_tempmail-verify.${d.name}`, recordValue: `tmpml_${Math.random().toString(36).slice(2, 18)}`, expiresAt: daysFromNow(3) } },
        } : {}),
      },
    });
    domainMap.set(d.name, domain.id);
  }
  for (const name of ['tempmail.dev', 'quickmail.cc']) {
    const id = domainMap.get(name)!;
    await prisma.domainPolicy.upsert({ where: { domainId_policyKey: { domainId: id, policyKey: 'max_mailboxes_per_user' } }, update: {}, create: { domainId: id, policyKey: 'max_mailboxes_per_user', policyValue: '50' } });
    await prisma.domainPolicy.upsert({ where: { domainId_policyKey: { domainId: id, policyKey: 'allow_custom_username' } }, update: {}, create: { domainId: id, policyKey: 'allow_custom_username', policyValue: 'true' } });
  }
  return domainMap;
}

// ── 5. MAILBOXES + MESSAGES + ALIASES + EVENTS ──
async function seedMailboxes(userMap: Map<string, string>, domainMap: Map<string, string>) {
  console.log('  → Mailboxes, Messages, Aliases, Events...');
  const sysDomains = ['tempmail.dev', 'quickmail.cc', 'dropbox.email'];
  const activeUsers = USERS.filter(u => u.status === 'ACTIVE');
  const otpSvcs = ['Shopee', 'Lazada', 'LINE', 'Twitter', 'Discord', 'GitHub', 'Netflix', 'Grab', 'TrueID', 'Agoda'];
  const pubs = ['Tech Weekly TH', 'Dev Digest', 'Product Hunt', 'Bangkok Post', 'Blognone'];
  let mbCount = 0, msgCount = 0, aliasCount = 0;

  for (const u of activeUsers) {
    const userId = userMap.get(u.email)!;
    const n = u.plan === 'free' ? Math.min(3, Math.floor(Math.random() * 3) + 1)
      : u.plan === 'enterprise' ? Math.floor(Math.random() * 12) + 5
      : u.plan === 'starter' ? Math.floor(Math.random() * 5) + 2
      : Math.floor(Math.random() * 8) + 3;

    for (let i = 0; i < n; i++) {
      const dn = sysDomains[Math.floor(Math.random() * sysDomains.length)];
      const uname = `${u.displayName.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'}.${Math.random().toString(36).slice(2, 6)}`;
      const address = `${uname}@${dn}`;
      const expired = Math.random() < 0.15;
      const hrsAgo = Math.floor(Math.random() * 72) + 1;

      try {
        const mb = await prisma.mailbox.create({
          data: {
            userId, address, domainId: domainMap.get(dn)!,
            status: expired ? 'EXPIRED' : 'ACTIVE',
            riskScore: Math.random() < 0.1 ? Math.floor(Math.random() * 30) + 10 : 0,
            expiresAt: expired ? hoursAgo(Math.floor(Math.random() * 12)) : daysFromNow(u.plan === 'free' ? 1 : u.plan === 'enterprise' ? 365 : 7),
            createdAt: hoursAgo(hrsAgo),
          },
        });

        // Events
        await prisma.mailboxEvent.create({ data: { mailboxId: mb.id, type: 'created', createdAt: hoursAgo(hrsAgo), metadata: { address } } });
        if (expired) await prisma.mailboxEvent.create({ data: { mailboxId: mb.id, type: 'expired', createdAt: hoursAgo(Math.floor(Math.random() * 6)) } });

        // Aliases (pro+ users)
        if (['pro', 'enterprise'].includes(u.plan) && Math.random() < 0.3) {
          const aliasAddr = `alias.${Math.random().toString(36).slice(2,6)}@${dn}`;
          try {
            await prisma.mailboxAlias.create({ data: { mailboxId: mb.id, alias: aliasAddr } });
            aliasCount++;
          } catch {}
        }

        // Messages
        const nMsg = Math.floor(Math.random() * 8) + 1;
        for (let m = 0; m < nMsg; m++) {
          const r = Math.random();
          const em = r < 0.30 ? EMAIL_TEMPLATES.otp(String(Math.floor(100000 + Math.random() * 900000)), otpSvcs[Math.floor(Math.random() * otpSvcs.length)])
            : r < 0.45 ? EMAIL_TEMPLATES.welcome(u.displayName.split(' ')[0], otpSvcs[Math.floor(Math.random() * otpSvcs.length)])
            : r < 0.60 ? EMAIL_TEMPLATES.newsletter(`${pubs[Math.floor(Math.random() * pubs.length)]}: Weekly #${Math.floor(Math.random() * 100) + 1}`, pubs[Math.floor(Math.random() * pubs.length)])
            : r < 0.75 ? EMAIL_TEMPLATES.shipping(String(Math.floor(10000000 + Math.random() * 90000000)))
            : r < 0.85 ? EMAIL_TEMPLATES.security_alert(`${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`)
            : r < 0.93 ? EMAIL_TEMPLATES.mfa_enabled(u.displayName.split(' ')[0])
            : EMAIL_TEMPLATES.password_reset(u.displayName.split(' ')[0]);

          const msg = await prisma.mailboxMessage.create({
            data: {
              mailboxId: mb.id, fromAddress: em.from, subject: em.subject,
              bodyText: em.bodyText, bodyHtml: em.bodyHtml,
              size: (em.bodyHtml?.length ?? 0) + em.bodyText.length,
              isRead: Math.random() < 0.6,
              receivedAt: hoursAgo(Math.floor(Math.random() * hrsAgo)),
            },
          });
          msgCount++;

          if (Math.random() < 0.12) {
            await prisma.mailboxAttachment.create({
              data: {
                messageId: msg.id,
                filename: ['invoice.pdf', 'receipt.pdf', 'photo.jpg', 'screenshot.png', 'document.pdf'][Math.floor(Math.random() * 5)],
                contentType: Math.random() < 0.6 ? 'application/pdf' : 'image/jpeg',
                size: Math.floor(Math.random() * 2000000) + 50000,
                storageKey: `attachments/${msg.id}/${Math.random().toString(36).slice(2)}`,
                scanStatus: Math.random() < 0.9 ? 'clean' : 'pending',
              },
            });
          }
        }

        await prisma.mailbox.update({ where: { id: mb.id }, data: { messageCount: nMsg } });
        mbCount++;
      } catch { /* address collision — skip */ }
    }
  }
  console.log(`    ${mbCount} mailboxes, ${msgCount} messages, ${aliasCount} aliases`);
}

// ── 6. BILLING (Topups, Invoices, Debits, Adjustments, Ledger) ──
async function seedBilling(userMap: Map<string, string>) {
  console.log('  → Billing (topups, invoices, debits, adjustments)...');
  const paidUsers = USERS.filter(u => u.plan !== 'free' && u.status === 'ACTIVE');
  let topupCount = 0, invoiceCount = 0;

  for (const u of paidUsers) {
    const userId = userMap.get(u.email)!;
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) continue;

    // Topups
    const nTopups = Math.floor(Math.random() * 4) + 1;
    let balance = new Prisma.Decimal(0);

    for (let i = 0; i < nTopups; i++) {
      const amount = [500, 1000, 2000, 5000, 10000][Math.floor(Math.random() * 5)];
      const ok = Math.random() < 0.85;
      const idem = `topup_${userId.slice(0, 8)}_${i}_${Date.now()}`;
      const at = daysAgo(Math.floor(Math.random() * 60) + 1);

      const topup = await prisma.topup.create({
        data: {
          userId, amount, currency: 'THB',
          status: ok ? 'COMPLETED' : (Math.random() < 0.5 ? 'PENDING' : 'FAILED'),
          paymentMethod: ['credit_card', 'promptpay', 'truemoney', 'bank_transfer'][Math.floor(Math.random() * 4)],
          idempotencyKey: idem, createdAt: at,
          completedAt: ok ? new Date(at.getTime() + 60000) : undefined,
        },
      });

      await prisma.paymentTransaction.create({
        data: {
          topupId: topup.id, amount, currency: 'THB',
          status: ok ? 'SUCCEEDED' : (Math.random() < 0.5 ? 'PENDING' : 'FAILED'),
          provider: ['stripe', 'omise', 'manual'][Math.floor(Math.random() * 3)],
          externalId: ok ? `pi_${Math.random().toString(36).slice(2, 26)}` : undefined,
          idempotencyKey: `tx_${idem}`, createdAt: at,
        },
      });

      if (ok) {
        const before = balance;
        balance = balance.add(new Prisma.Decimal(amount));
        await prisma.walletLedger.create({
          data: {
            walletId: wallet.id, type: 'CREDIT', amount,
            balanceBefore: before, balanceAfter: balance,
            description: `เติมเงินผ่าน ${topup.paymentMethod}`,
            referenceType: 'topup', referenceId: topup.id,
            idempotencyKey: `ledger_${idem}`, createdAt: at,
          },
        });
        topupCount++;
      }
    }

    // Debit for subscription
    if (Math.random() < 0.7) {
      const price = u.plan === 'starter' ? 149 : u.plan === 'pro' ? 399 : 1590;
      if (balance.gte(price)) {
        const before = balance;
        balance = balance.sub(new Prisma.Decimal(price));
        await prisma.walletLedger.create({
          data: {
            walletId: wallet.id, type: 'DEBIT', amount: price,
            balanceBefore: before, balanceAfter: balance,
            description: `ชำระค่าแพลน ${u.plan.charAt(0).toUpperCase() + u.plan.slice(1)} — รายเดือน`,
            referenceType: 'subscription', referenceId: userId,
            idempotencyKey: `debit_sub_${userId}_${Date.now()}`, createdAt: daysAgo(1),
          },
        });
      }
    }

    await prisma.wallet.update({ where: { id: wallet.id }, data: { balance, version: nTopups + 1 } });

    // Invoice
    if (Math.random() < 0.6) {
      const price = u.plan === 'starter' ? 149 : u.plan === 'pro' ? 399 : 1590;
      const status = Math.random() < 0.8 ? 'PAID' : (Math.random() < 0.5 ? 'ISSUED' : 'DRAFT');
      await prisma.invoice.create({
        data: {
          userId, amount: price, currency: 'THB', status,
          issuedAt: daysAgo(30), dueAt: daysAgo(15),
          paidAt: status === 'PAID' ? daysAgo(14) : undefined,
          lineItems: [{ description: `แพลน ${u.plan.charAt(0).toUpperCase() + u.plan.slice(1)} — รายเดือน`, amount: price, quantity: 1 }],
        },
      });
      invoiceCount++;
    }
  }
  console.log(`    ${topupCount} topups, ${invoiceCount} invoices`);
}

// ── 7. CONFIG & FEATURE FLAGS ──
async function seedConfig() {
  console.log('  → Config & Feature Flags...');
  for (const c of CONFIG_ENTRIES) await prisma.configEntry.upsert({ where: { key: c.key }, update: {}, create: c });
  for (const f of FEATURE_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: f.key }, update: {},
      create: {
        key: f.key, name: f.name, description: f.description,
        enabled: f.enabled, rolloutPct: f.rolloutPct,
        targetPlans: 'targetPlans' in f ? f.targetPlans : undefined,
        targetRoles: 'targetRoles' in f ? f.targetRoles : undefined,
      },
    });
  }
}

// ── 8. SECURITY — Audit Logs, Risk Events, Admin Actions (with Approval Workflow), Support Notes ──
async function seedSecurity(userMap: Map<string, string>) {
  console.log('  → Audit Logs, Risk Events, Approval Workflow, Admin Actions, Support Notes...');
  const adminId = userMap.get('admin@tempmail.dev')!;
  const opsId = userMap.get('ops@tempmail.dev')!;
  const supportId = userMap.get('support@tempmail.dev')!;
  const financeId = userMap.get('finance@tempmail.dev')!;
  const securityId = userMap.get('security@tempmail.dev')!;
  const ips = ['203.150.44.12', '182.232.168.55', '110.170.25.101', '89.207.132.173', '45.77.198.22', '103.245.165.1'];
  const uas = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Safari/605.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile/22A3354',
    'Mozilla/5.0 (Linux; Android 15) Chrome/126.0 Mobile',
  ];
  const rIp = () => ips[Math.floor(Math.random() * ips.length)];
  const rUa = () => uas[Math.floor(Math.random() * uas.length)];

  // ─── Audit logs ───
  const logs = [
    ...USERS.filter(u => u.status === 'ACTIVE').slice(0, 15).flatMap(u => [
      { actorId: userMap.get(u.email)!, actorType: 'user', action: 'user.register', targetType: 'user', targetId: userMap.get(u.email)!, createdAt: daysAgo(u.daysAgo), ipAddress: rIp(), userAgent: rUa() },
      { actorId: userMap.get(u.email)!, actorType: 'user', action: 'user.login', targetType: 'session', createdAt: daysAgo(Math.floor(Math.random() * 7)), ipAddress: rIp(), userAgent: rUa() },
    ]),
    // MFA events
    ...USERS.filter(u => u.mfa).map(u => (
      { actorId: userMap.get(u.email)!, actorType: 'user', action: 'user.mfa.enable', targetType: 'user', targetId: userMap.get(u.email)!, createdAt: daysAgo(u.daysAgo - 2), ipAddress: rIp(), userAgent: rUa() }
    )),
    // Email verification
    ...USERS.filter(u => u.status === 'ACTIVE').slice(0, 10).map(u => (
      { actorId: userMap.get(u.email)!, actorType: 'user', action: 'user.email_verification.complete', targetType: 'user', targetId: userMap.get(u.email)!, createdAt: daysAgo(u.daysAgo - 1) }
    )),
    // Password reset
    { actorId: userMap.get('jessica.wong@gmail.com')!, actorType: 'user', action: 'user.password_reset.complete', targetType: 'user', targetId: userMap.get('jessica.wong@gmail.com')!, createdAt: daysAgo(4), ipAddress: rIp() },
    // Admin re-auth
    { actorId: adminId, actorType: 'admin', action: 'admin.reauth.success', targetType: 'user', targetId: adminId, createdAt: daysAgo(2), ipAddress: rIp(), userAgent: rUa() },
    // Admin actions
    { actorId: adminId, actorType: 'admin', action: 'admin.user.suspend', targetType: 'user', targetId: userMap.get('suspended.user@outlook.com')!, createdAt: daysAgo(30), ipAddress: rIp(), userAgent: rUa(), reason: 'TOS violation — abuse reports' },
    { actorId: adminId, actorType: 'admin', action: 'admin.user.ban', targetType: 'user', targetId: userMap.get('banned.spammer@mail.com')!, createdAt: daysAgo(55), ipAddress: rIp(), userAgent: rUa(), reason: 'Spam bot — mass mailbox creation' },
    { actorId: adminId, actorType: 'admin', action: 'admin.config.update', targetType: 'config', createdAt: daysAgo(20), ipAddress: rIp(), reason: 'Adjusted rate limits' },
    { actorId: securityId, actorType: 'admin', action: 'admin.security.revoke_sessions', targetType: 'user', targetId: userMap.get('jessica.wong@gmail.com')!, createdAt: daysAgo(5), ipAddress: rIp(), reason: 'Suspicious geolocation — sessions revoked' },
    { actorId: financeId, actorType: 'admin', action: 'billing.topup.create', targetType: 'topup', createdAt: daysAgo(10), ipAddress: rIp(), reason: 'Manual topup for VIP customer' },
  ];
  for (const l of logs) await prisma.auditLog.create({ data: l });

  // ─── Admin Actions (with Approval Workflow) ───
  const actions = [
    // Standard actions
    { adminId, action: 'user.suspend', targetType: 'user', targetId: userMap.get('suspended.user@outlook.com')!, reason: 'พบรายงานฝ่าฝืน TOS หลายครั้ง', createdAt: daysAgo(30) },
    { adminId, action: 'user.ban', targetType: 'user', targetId: userMap.get('banned.spammer@mail.com')!, reason: 'สแปมบอท — สร้าง mailbox 500+ ใน 1 ชั่วโมง', createdAt: daysAgo(55) },
    { adminId, action: 'config.update', targetType: 'config', reason: 'อัปเดต rate limit 50→100/ชม.', createdAt: daysAgo(20) },
    { adminId, action: 'domain.add_system', targetType: 'domain', reason: 'เพิ่ม dropbox.email', createdAt: daysAgo(60) },
    // Approval-required actions (approved)
    { adminId, action: 'admin.billing.adjust', targetType: 'wallet', targetId: userMap.get('somchai.dev@gmail.com')!, reason: 'ชดเชยปัญหา downtime 2 ชั่วโมง', requiresApproval: true, approvedBy: opsId, approvedAt: daysAgo(14), createdAt: daysAgo(15) },
    { adminId, action: 'admin.pricing.change', targetType: 'plan', reason: 'ปรับราคา THB ตลาดไทย', requiresApproval: true, approvedBy: opsId, approvedAt: daysAgo(39), createdAt: daysAgo(40) },
    // Approval-required (pending — waiting for approval)
    { adminId: financeId, action: 'admin.billing.refund', targetType: 'topup', reason: 'คืนเงิน topup ที่ถูกเรียกเก็บซ้ำ', requiresApproval: true, createdAt: daysAgo(2) },
    // Approval-required (rejected)
    { adminId: supportId, action: 'admin.user.mass_suspend', targetType: 'user', reason: 'ระงับผู้ใช้ IP 45.77.198.22 ทั้งหมด', requiresApproval: true, createdAt: daysAgo(18),
      metadata: { rejected: true, rejectedBy: adminId, rejectedAt: daysAgo(17).toISOString(), rejectionReason: 'ข้อมูลไม่เพียงพอ ต้องตรวจสอบเพิ่ม' } },
  ];
  for (const a of actions) await prisma.adminAction.create({ data: a as any });

  // ─── Risk Events ───
  const risks = [
    { type: 'brute_force', severity: 'high', ipAddress: '89.207.132.173', metadata: { attempts: 47, windowMin: 5, blocked: true }, createdAt: daysAgo(15) },
    { type: 'brute_force', severity: 'medium', ipAddress: '45.77.198.22', metadata: { attempts: 12, windowMin: 10 }, createdAt: daysAgo(8) },
    { type: 'brute_force', severity: 'low', ipAddress: '103.245.165.1', metadata: { attempts: 6, windowMin: 30 }, createdAt: daysAgo(3) },
    { type: 'suspicious_signup', severity: 'medium', userId: userMap.get('banned.spammer@mail.com'), ipAddress: '89.207.132.173', metadata: { signupsFromIp: 23, timespan: '30min' }, createdAt: daysAgo(65) },
    { type: 'abuse', severity: 'high', userId: userMap.get('suspended.user@outlook.com'), ipAddress: '110.170.25.101', metadata: { reason: 'Mass mailbox creation', count: 127 }, createdAt: daysAgo(32) },
    { type: 'abuse', severity: 'critical', ipAddress: '45.77.198.22', metadata: { reason: 'DDoS attempt', rps: 15000 }, createdAt: daysAgo(20), resolvedAt: daysAgo(20), resolvedBy: adminId },
    { type: 'account_takeover', severity: 'high', userId: userMap.get('jessica.wong@gmail.com'), ipAddress: '89.207.132.173', metadata: { reason: 'Unusual geolocation', from: 'TH', to: 'RU' }, createdAt: daysAgo(5), resolvedAt: daysAgo(5), resolvedBy: securityId },
    { type: 'suspicious_signup', severity: 'low', ipAddress: '103.245.165.1', metadata: { disposableEmailUsed: true, signupsFromIp: 3 }, createdAt: daysAgo(10) },
    ...Array.from({ length: 12 }, (_, i) => ({
      type: ['brute_force', 'suspicious_signup', 'abuse'][Math.floor(Math.random() * 3)] as string,
      severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as string,
      ipAddress: rIp(), metadata: { automated: true, source: 'rate_limiter', ruleId: `rl_${i}` },
      createdAt: daysAgo(Math.floor(Math.random() * 60)),
    })),
  ];
  for (const r of risks) await prisma.riskEvent.create({ data: r });

  // ─── Support Notes ───
  const notes = [
    { userId: userMap.get('somchai.dev@gmail.com')!, authorId: supportId, content: 'ผู้ใช้สอบถามวิธีตั้งค่า custom domain ส่งคู่มือทาง email แล้ว', type: 'note', createdAt: daysAgo(30) },
    { userId: userMap.get('wipawan.s@gmail.com')!, authorId: supportId, content: 'ผู้ใช้แจ้งไม่ได้รับอีเมล ตรวจสอบพบ DNS propagation delay แก้ไขแล้วใน 2 ชม.', type: 'resolution', createdAt: daysAgo(20) },
    { userId: userMap.get('jessica.wong@gmail.com')!, authorId: securityId, content: 'พบ login จาก IP ผิดปกติ (RU) ติดต่อผู้ใช้ ยืนยันไม่ใช่ตน revoke sessions + เปลี่ยน password', type: 'escalation', createdAt: daysAgo(5) },
    { userId: userMap.get('suspended.user@outlook.com')!, authorId: adminId, content: 'พบรายงานสแปม mailbox หลายรายการ ระงับบัญชีตรวจสอบ', type: 'escalation', createdAt: daysAgo(31) },
    { userId: userMap.get('mike.torres@yahoo.com')!, authorId: supportId, content: 'ผู้ใช้สอบถามอัปเกรด Starter → Pro อธิบายฟีเจอร์และราคา', type: 'note', createdAt: daysAgo(12) },
    { userId: userMap.get('enterprise@bigcorp.co.th')!, authorId: supportId, content: 'ลูกค้า Enterprise ขอ custom domain corp-mail.co.th ดำเนินการและ verify DNS แล้ว', type: 'resolution', createdAt: daysAgo(25) },
    { userId: userMap.get('dev-team@startup.io')!, authorId: supportId, content: 'ทีมพัฒนาสอบถาม API v2 access แนะนำ webhook notifications ที่กำลังพัฒนา', type: 'note', createdAt: daysAgo(8) },
    { userId: userMap.get('natthaporn.k@outlook.com')!, authorId: supportId, content: 'ผู้ใช้ขอเปิด MFA แต่ยังไม่ได้ตั้งค่า แนะนำขั้นตอนและส่ง QR code guide', type: 'note', createdAt: daysAgo(14) },
  ];
  for (const n of notes) await prisma.supportNote.create({ data: n });
  console.log(`    ${logs.length} audit logs, ${risks.length} risk events, ${actions.length} admin actions, ${notes.length} support notes`);
}

// ── 9. CMS / SEO ──
async function seedCMS(userMap: Map<string, string>) {
  console.log('  → CMS Pages, FAQ, Glossary, SEO...');
  const authorId = userMap.get('admin@tempmail.dev')!;

  for (const pg of CONTENT_PAGES) {
    const exists = await prisma.contentPage.findUnique({ where: { slug_locale: { slug: pg.slug, locale: pg.locale } } });
    if (exists) continue;
    const cp = await prisma.contentPage.create({
      data: {
        slug: pg.slug, locale: pg.locale, type: pg.type, status: pg.status,
        title: pg.title, metaDescription: pg.metaDescription,
        indexable: pg.indexable, schemaType: pg.schemaType, authorId,
        publishedAt: daysAgo(30), lastReviewedAt: daysAgo(7),
        blocks: { create: pg.blocks.map(b => ({ type: b.type, order: b.order, content: b.content })) },
      },
    });
    await prisma.contentPageVersion.create({ data: { pageId: cp.id, versionNumber: 1, title: pg.title, content: pg.blocks, createdBy: authorId } });
  }

  for (const f of FAQ_ITEMS) {
    const exists = await prisma.faqItem.findFirst({ where: { question: f.question, locale: f.locale } });
    if (!exists) await prisma.faqItem.create({ data: f });
  }
  for (const g of GLOSSARY_TERMS) {
    await prisma.glossaryTerm.upsert({ where: { slug_locale: { slug: g.slug, locale: g.locale } }, update: {}, create: g });
  }
  for (const a of ANSWER_BLOCKS) {
    const exists = await prisma.answerBlock.findFirst({ where: { question: a.question, locale: a.locale } });
    if (!exists) await prisma.answerBlock.create({ data: { ...a, answerHtml: `<p>${a.answerText}</p>` } });
  }

  const intentMap = new Map<string, string>();
  for (const ic of INTENT_CLUSTERS) {
    const e = await prisma.intentCluster.findFirst({ where: { name: ic.name } });
    const intent = e ?? await prisma.intentCluster.create({ data: ic });
    intentMap.set(ic.name, intent.id);
  }
  for (const kc of KEYWORD_CLUSTERS) {
    const e = await prisma.keywordCluster.findFirst({ where: { name: kc.name, locale: kc.locale } });
    if (!e) {
      const iid = kc.locale === 'en'
        ? intentMap.get(kc.name.includes('privacy') ? 'trust' : kc.name.includes('developer') ? 'transactional' : 'informational')
        : intentMap.get('informational');
      await prisma.keywordCluster.create({ data: { ...kc, intentId: iid } });
    }
  }

  for (const lm of INTERNAL_LINK_MODULES) {
    const e = await prisma.internalLinkModule.findFirst({ where: { name: lm.name } });
    if (!e) await prisma.internalLinkModule.create({ data: lm });
  }
  for (const r of REDIRECTS) await prisma.redirect.upsert({ where: { sourcePath: r.sourcePath }, update: {}, create: r });
  for (const sd of STRUCTURED_DATA) {
    const e = await prisma.structuredDataEntry.findFirst({ where: { schemaType: sd.schemaType, pageSlug: sd.pageSlug ?? null, locale: sd.locale } });
    if (!e) await prisma.structuredDataEntry.create({ data: sd });
  }
}

// ── MAIN ──
async function main() {
  console.log('🌱 Seeding TempMail database (v3)...\n');
  const t0 = Date.now();

  const roleMap = await seedRoles();
  const planMap = await seedPlans();
  const userMap = await seedUsers(roleMap, planMap);
  const domainMap = await seedDomains(userMap);
  await seedMailboxes(userMap, domainMap);
  await seedBilling(userMap);
  await seedConfig();
  await seedSecurity(userMap);
  await seedCMS(userMap);

  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✅ Seed complete in ${sec}s`);
  console.log(`\n📧 Login credentials (all users):`);
  console.log(`   Password: ${PASSWORD}`);
  console.log(`   Admin:      admin@tempmail.dev  (SUPER_ADMIN, MFA enabled)`);
  console.log(`   Ops:        ops@tempmail.dev    (ADMIN, MFA enabled)`);
  console.log(`   Support:    support@tempmail.dev`);
  console.log(`   Finance:    finance@tempmail.dev (MFA enabled)`);
  console.log(`   Security:   security@tempmail.dev (MFA enabled)`);
  console.log(`   Pro User:   somchai.dev@gmail.com (MFA enabled)`);
  console.log(`   Business:   enterprise@bigcorp.co.th (MFA enabled)`);
  console.log(`   Free User:  tanawat.p@gmail.com\n`);
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
