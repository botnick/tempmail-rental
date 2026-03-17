/**
 * Email Handler — Sends transactional emails via SMTP (Nodemailer)
 *
 * Handles job types:
 * - email.verification   → Email address verification link
 * - email.password_reset  → Password reset link
 *
 * In development mode without SMTP config, logs email content to console.
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { registerJobHandler, type JobPayload } from './queue';
import { logger } from './logger';
import { env } from '../config/env';

// ─── Transporter (lazy singleton) ────────────────────────
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    logger.warn('SMTP not configured — emails will be logged to console');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return transporter;
}

/** Sender address */
const getFrom = () => env.SMTP_FROM ?? `noreply@${env.APP_URL.replace(/https?:\/\//, '')}`;

// ─── Email Templates ─────────────────────────────────────

/**
 * Wrap email body in a styled HTML layout.
 */
function emailLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0d0f14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0f14;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <span style="font-size:24px;font-weight:800;color:#f59e0b;letter-spacing:-0.5px;">${env.APP_NAME}</span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:#16181f;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:36px 32px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="color:#6b7280;font-size:12px;margin:0;">
                &copy; ${new Date().getFullYear()} ${env.APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function verificationEmailHtml(token: string): string {
  const link = `${env.APP_URL}/th/verify-email?token=${encodeURIComponent(token)}`;
  return emailLayout('ยืนยันอีเมล', `
    <h1 style="color:#f3f4f6;font-size:22px;font-weight:800;margin:0 0 12px;">ยืนยันอีเมลของคุณ</h1>
    <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 28px;">
      คลิกปุ่มด้านล่างเพื่อยืนยันที่อยู่อีเมลของคุณ ลิงก์นี้จะหมดอายุใน 24 ชั่วโมง
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="border-radius:12px;background:linear-gradient(135deg,#f59e0b,#d97706);">
          <a href="${link}" target="_blank"
             style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">
            ยืนยันอีเมล
          </a>
        </td>
      </tr>
    </table>
    <p style="color:#6b7280;font-size:12px;margin:24px 0 0;word-break:break-all;">
      หากปุ่มไม่ทำงาน ให้คัดลอกลิงก์นี้:<br/>
      <a href="${link}" style="color:#f59e0b;">${link}</a>
    </p>
  `);
}

function passwordResetEmailHtml(token: string): string {
  const link = `${env.APP_URL}/th/reset-password?token=${encodeURIComponent(token)}`;
  return emailLayout('รีเซ็ตรหัสผ่าน', `
    <h1 style="color:#f3f4f6;font-size:22px;font-weight:800;margin:0 0 12px;">รีเซ็ตรหัสผ่าน</h1>
    <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 28px;">
      เราได้รับคำขอรีเซ็ตรหัสผ่านของคุณ คลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="border-radius:12px;background:linear-gradient(135deg,#f59e0b,#d97706);">
          <a href="${link}" target="_blank"
             style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">
            รีเซ็ตรหัสผ่าน
          </a>
        </td>
      </tr>
    </table>
    <p style="color:#6b7280;font-size:12px;margin:24px 0 0;">
      หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน คุณสามารถเพิกเฉยอีเมลนี้ได้
    </p>
    <p style="color:#6b7280;font-size:12px;margin:8px 0 0;word-break:break-all;">
      <a href="${link}" style="color:#f59e0b;">${link}</a>
    </p>
  `);
}

// ─── Send Helper ─────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const transport = getTransporter();

  if (!transport) {
    // Dev fallback: log to console
    logger.info('📧 [DEV EMAIL]', { to, subject });
    logger.debug('Email HTML preview', { html: html.slice(0, 300) + '...' });
    return;
  }

  await transport.sendMail({
    from: `${env.APP_NAME} <${getFrom()}>`,
    to,
    subject,
    html,
  });

  logger.info('Email sent', { to, subject });
}

// ─── Job Handlers ────────────────────────────────────────

async function handleVerificationEmail(payload: JobPayload): Promise<void> {
  const { email, token } = payload.data as { email: string; token: string };

  if (!email || !token) {
    throw new Error('Missing email or token in verification job payload');
  }

  const html = verificationEmailHtml(token);
  await sendEmail(email, `[${env.APP_NAME}] ยืนยันอีเมลของคุณ`, html);
}

async function handlePasswordResetEmail(payload: JobPayload): Promise<void> {
  const { email, token } = payload.data as { email: string; token: string };

  if (!email || !token) {
    throw new Error('Missing email or token in password reset job payload');
  }

  const html = passwordResetEmailHtml(token);
  await sendEmail(email, `[${env.APP_NAME}] รีเซ็ตรหัสผ่าน`, html);
}

// ─── Register Handlers ───────────────────────────────────

export function registerEmailHandlers(): void {
  registerJobHandler('email.verification', handleVerificationEmail);
  registerJobHandler('email.password_reset', handlePasswordResetEmail);
  logger.info('Email handlers registered');
}
