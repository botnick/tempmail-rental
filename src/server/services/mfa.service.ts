/**
 * MFA/TOTP Service
 *
 * Implements Time-based One-Time Password (TOTP) for multi-factor auth.
 * Uses the existing totpSecret and totpEnabled fields in UserCredential.
 *
 * Flow:
 * 1. User calls setupMfa() → generates secret + QR URI
 * 2. User verifies first code via confirmMfa()
 * 3. On login, if totpEnabled=true, user must provide TOTP code
 * 4. Backup codes generated for recovery
 */

import { createHmac } from 'crypto';
import { prisma } from '../db';
import { randomHex } from '../lib/crypto';
import { AppError } from '../lib/errors';
import { AuditService } from './audit.service';
import { logger } from '../lib/logger';

const TOTP_PERIOD = 30; // 30 seconds
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1; // Allow 1 period before/after

/**
 * Generate a random base32 secret for TOTP.
 */
function generateTotpSecret(): string {
  const buffer = Buffer.from(randomHex(20), 'hex');
  return base32Encode(buffer);
}

/**
 * Base32 encode (RFC 4648).
 */
function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let bits = 0;
  let value = 0;

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 31];
  }
  return result;
}

/**
 * Base32 decode.
 */
function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of input.toUpperCase()) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * Generate a TOTP code for a given time.
 */
function generateTotp(secret: string, time?: number): string {
  const now = time ?? Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / TOTP_PERIOD);

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const key = base32Decode(secret);
  const hmac = createHmac('sha1', key).update(counterBuffer).digest();

  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(code % Math.pow(10, TOTP_DIGITS)).padStart(TOTP_DIGITS, '0');
}

/**
 * Verify a TOTP code with time window tolerance.
 */
function verifyTotp(secret: string, code: string): boolean {
  const now = Math.floor(Date.now() / 1000);

  for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
    const testTime = now + i * TOTP_PERIOD;
    if (generateTotp(secret, testTime) === code) {
      return true;
    }
  }
  return false;
}

export const MfaService = {
  /**
   * Setup MFA for a user.
   * Returns secret and otpauth URI for QR code generation.
   */
  async setupMfa(userId: string, meta?: { requestId?: string }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 'NOT_FOUND', 404);

    const credential = await prisma.userCredential.findUnique({
      where: { userId },
    });
    if (credential?.totpEnabled) {
      throw new AppError('MFA already enabled', 'CONFLICT', 409);
    }

    const secret = generateTotpSecret();

    // Store secret (not yet enabled until confirmed)
    await prisma.userCredential.update({
      where: { userId },
      data: { totpSecret: `pending:${secret}` },
    });

    const issuer = encodeURIComponent('TempMail');
    const account = encodeURIComponent(user.email);
    const otpauthUri = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;

    // Generate backup codes
    const backupCodes = Array.from({ length: 8 }, () => randomHex(4));

    logger.info('MFA setup initiated', { userId });

    return { secret, otpauthUri, backupCodes };
  },

  /**
   * Confirm MFA setup by verifying the first code.
   * Enables TOTP on the account.
   */
  async confirmMfa(userId: string, code: string, meta?: { requestId?: string }) {
    const credential = await prisma.userCredential.findUnique({
      where: { userId },
    });

    if (!credential?.totpSecret?.startsWith('pending:')) {
      throw new AppError('No pending MFA setup', 'PRECONDITION_FAILED', 412);
    }

    const secret = credential.totpSecret.replace('pending:', '');

    if (!verifyTotp(secret, code)) {
      throw new AppError('Invalid verification code', 'INVALID_CODE', 400);
    }

    await prisma.userCredential.update({
      where: { userId },
      data: {
        totpSecret: secret,
        totpEnabled: true,
      },
    });

    await AuditService.log({
      actorId: userId,
      actorType: 'user',
      action: 'user.mfa.enable',
      targetType: 'user',
      targetId: userId,
      requestId: meta?.requestId,
    });

    logger.info('MFA enabled', { userId });
    return { enabled: true };
  },

  /**
   * Verify a TOTP code during login.
   */
  async verifyMfaCode(userId: string, code: string): Promise<boolean> {
    const credential = await prisma.userCredential.findUnique({
      where: { userId },
    });

    if (!credential?.totpEnabled || !credential.totpSecret) {
      return true; // MFA not enabled, pass through
    }

    return verifyTotp(credential.totpSecret, code);
  },

  /**
   * Disable MFA for a user (requires re-authentication first).
   */
  async disableMfa(userId: string, meta?: { requestId?: string }) {
    await prisma.userCredential.update({
      where: { userId },
      data: {
        totpSecret: null,
        totpEnabled: false,
      },
    });

    await AuditService.log({
      actorId: userId,
      actorType: 'user',
      action: 'user.mfa.disable',
      targetType: 'user',
      targetId: userId,
      requestId: meta?.requestId,
    });

    logger.info('MFA disabled', { userId });
    return { disabled: true };
  },

  /** Check if user has MFA enabled */
  async isMfaEnabled(userId: string): Promise<boolean> {
    const credential = await prisma.userCredential.findUnique({
      where: { userId },
      select: { totpEnabled: true },
    });
    return credential?.totpEnabled ?? false;
  },
};
