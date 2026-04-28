import { z } from 'zod';
import { prisma } from '../db';
import { hashPassword, verifyPassword } from '../auth/password';
import { generateSecureToken } from '../lib/id';
import { hashToken } from '../lib/crypto';
import { CredentialError, ConflictError, NotFoundError, AppError } from '../lib/errors';
import { AuditService } from './audit.service';
import { ConfigService } from './config.service';
import { logger } from '../lib/logger';
import { PlanStatus, SubscriptionStatus, TokenType } from '@prisma/client';
import { env } from '../config/env';

// ─── Input Schemas ──────────────────────────────

export const registerSchema = z.object({
  email: z.string().email().max(255).toLowerCase(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email().max(255).toLowerCase(),
  password: z.string().min(1).max(128),
});

// ─── Service ────────────────────────────────────

export const AuthService = {
  /**
   * Register a new user.
   * - Hashes password with Argon2id
   * - Creates user + credential + default free role + wallet
   * - Emits audit event
   */
  async register(input: z.infer<typeof registerSchema>, meta?: { ip?: string; userAgent?: string; requestId?: string }) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await hashPassword(input.password);

    // Find default free role
    const freeRole = await prisma.role.findUnique({
      where: { name: 'CUSTOMER' },
    });

    // Find default plan
    const defaultPlan = await prisma.plan.findFirst({
      where: { isDefault: true, status: PlanStatus.ACTIVE },
    });

    const user = await prisma.user.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        credential: {
          create: { passwordHash },
        },
        wallet: {
          create: { balance: 0, currency: env.DEFAULT_CURRENCY },
        },
        ...(freeRole
          ? {
              userRoles: {
                create: { roleId: freeRole.id },
              },
            }
          : {}),
        ...(defaultPlan
          ? {
              subscriptions: {
                create: {
                  planId: defaultPlan.id,
                  status: SubscriptionStatus.ACTIVE,
                  currentPeriodStart: new Date(),
                  currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                },
              },
            }
          : {}),
      },
    });

    await AuditService.log({
      actorId: user.id,
      actorType: 'user',
      action: 'user.register',
      targetType: 'user',
      targetId: user.id,
      ipAddress: meta?.ip ?? undefined,
      userAgent: meta?.userAgent ?? undefined,
      requestId: meta?.requestId,
    });

    logger.info('User registered', { userId: user.id, email: user.email });

    return { userId: user.id, publicId: user.publicId };
  },

  /**
   * Login — verify credentials, create session, return token.
   * Anti-enumeration: always returns the same error for wrong email or wrong password.
   */
  async login(
    input: z.infer<typeof loginSchema>,
    meta?: { ip?: string; userAgent?: string; requestId?: string }
  ) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { credential: true },
    });

    // Anti-enumeration: same error whether user exists or not
    if (!user || !user.credential) {
      throw new CredentialError();
    }

    // Check if account is locked — return same error to prevent enumeration
    if (
      user.credential.lockedUntil &&
      user.credential.lockedUntil > new Date()
    ) {
      logger.warn('Login attempt on locked account', { userId: user.id });
      throw new CredentialError();
    }

    if (user.status !== 'ACTIVE') {
      throw new CredentialError();
    }

    const validPassword = await verifyPassword(
      user.credential.passwordHash,
      input.password
    );

    if (!validPassword) {
      // Increment failed attempts
      const failedAttempts = user.credential.failedAttempts + 1;
      const lockThreshold = await ConfigService.getNumber('auth.lock_threshold', 5);
      const lockDurationMin = await ConfigService.getNumber('auth.lock_duration_minutes', 15);

      await prisma.userCredential.update({
        where: { userId: user.id },
        data: {
          failedAttempts,
          ...(failedAttempts >= lockThreshold
            ? { lockedUntil: new Date(Date.now() + lockDurationMin * 60 * 1000) }
            : {}),
        },
      });

      throw new CredentialError();
    }

    // Reset failed attempts on successful login
    await prisma.userCredential.update({
      where: { userId: user.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    // Check if MFA is enabled
    if (user.credential.totpEnabled) {
      // Generate MFA challenge token (5 min TTL)
      const mfaToken = generateSecureToken();
      const mfaTokenHash = hashToken(mfaToken);

      await prisma.verificationToken.create({
        data: {
          userId: user.id,
          tokenHash: mfaTokenHash,
          type: TokenType.MFA_CHALLENGE,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      logger.info('MFA challenge issued', { userId: user.id });

      return {
        mfaRequired: true as const,
        mfaToken,
        user: {
          id: user.publicId,
          email: user.email,
          displayName: user.displayName,
        },
      };
    }

    // Create session
    const sessionToken = generateSecureToken();
    const refreshToken = generateSecureToken();
    const tokenHash = hashToken(sessionToken);
    const refreshTokenHash = hashToken(refreshToken);

    const isAdmin = await this.checkIsAdmin(user.id);

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        refreshTokenHash,
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
        isAdmin,
        expiresAt: new Date(
          Date.now() +
            (isAdmin ? env.ADMIN_SESSION_TTL_SECONDS * 1000 : env.USER_SESSION_TTL_SECONDS * 1000)
        ),
      },
    });

    await AuditService.log({
      actorId: user.id,
      actorType: 'user',
      action: 'user.login',
      targetType: 'session',
      targetId: session.id,
      ipAddress: meta?.ip ?? undefined,
      userAgent: meta?.userAgent ?? undefined,
      requestId: meta?.requestId,
    });

    return {
      sessionToken,
      refreshToken,
      expiresAt: session.expiresAt,
      user: {
        id: user.publicId,
        email: user.email,
        displayName: user.displayName,
      },
    };
  },

  /**
   * Create a session for a user (used after MFA verification).
   * Does not validate credentials — caller is responsible for authentication.
   */
  async createSessionForUser(userId: string, meta?: { ip?: string; userAgent?: string; requestId?: string }) {
    const sessionToken = generateSecureToken();
    const refreshToken = generateSecureToken();
    const tokenHash = hashToken(sessionToken);
    const refreshTokenHash = hashToken(refreshToken);

    const isAdmin = await this.checkIsAdmin(userId);

    const session = await prisma.session.create({
      data: {
        userId,
        tokenHash,
        refreshTokenHash,
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
        isAdmin,
        expiresAt: new Date(
          Date.now() +
            (isAdmin ? env.ADMIN_SESSION_TTL_SECONDS * 1000 : env.USER_SESSION_TTL_SECONDS * 1000)
        ),
      },
    });

    await AuditService.log({
      actorId: userId,
      actorType: 'user',
      action: 'user.login.mfa',
      targetType: 'session',
      targetId: session.id,
      ipAddress: meta?.ip ?? undefined,
      userAgent: meta?.userAgent ?? undefined,
      requestId: meta?.requestId,
    });

    return {
      sessionToken,
      refreshToken,
      expiresAt: session.expiresAt,
    };
  },

  /** Logout — revoke session */
  async logout(sessionId: string, meta?: { actorId?: string; requestId?: string }) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    if (meta?.actorId) {
      await AuditService.log({
        actorId: meta.actorId,
        actorType: 'user',
        action: 'user.logout',
        targetType: 'session',
        targetId: sessionId,
        requestId: meta.requestId,
      });
    }
  },

  /** Revoke all sessions for a user (force logout everywhere) */
  async revokeAllSessions(userId: string, meta?: { actorId?: string; requestId?: string }) {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await AuditService.log({
      actorId: meta?.actorId ?? userId,
      actorType: meta?.actorId ? 'admin' : 'user',
      action: 'user.revoke_all_sessions',
      targetType: 'user',
      targetId: userId,
      requestId: meta?.requestId,
    });
  },

  /** Check if user has admin role */
  async checkIsAdmin(userId: string): Promise<boolean> {
    const adminRoles = ['SYSTEM_ADMIN', 'ADMIN'];
    const userRole = await prisma.userRole.findFirst({
      where: {
        userId,
        role: { name: { in: adminRoles } },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    return !!userRole;
  },

  /** Refresh token rotation */
  async refreshSession(
    refreshToken: string,
    meta?: { ip?: string; userAgent?: string }
  ) {
    const refreshHash = hashToken(refreshToken);

    const session = await prisma.session.findUnique({
      where: { refreshTokenHash: refreshHash },
    });

    if (!session || session.revokedAt) {
      // If a revoked session's refresh token is reused, revoke ALL sessions
      // for that user (possible token theft)
      if (session?.revokedAt) {
        await this.revokeAllSessions(session.userId);
        logger.warn('Refresh token reuse detected — all sessions revoked', {
          userId: session.userId,
        });
      }
      throw new CredentialError();
    }

    // Sliding idle expiry — refuse refresh if the session has been idle
    // longer than SESSION_IDLE_MAX_DAYS, regardless of refresh-token TTL.
    // Prevents indefinitely-rotated tokens from outliving real activity.
    const idleMs = env.SESSION_IDLE_MAX_DAYS * 24 * 60 * 60 * 1000;
    const idleSince = Date.now() - session.lastActiveAt.getTime();
    if (idleSince > idleMs) {
      await prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      logger.info('Session refused refresh — exceeded idle window', {
        sessionId: session.id,
        userId: session.userId,
        idleDays: Math.round(idleSince / (24 * 60 * 60 * 1000)),
      });
      throw new CredentialError();
    }

    // Revoke old session
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    // Create new session
    const newSessionToken = generateSecureToken();
    const newRefreshToken = generateSecureToken();

    const newSession = await prisma.session.create({
      data: {
        userId: session.userId,
        tokenHash: hashToken(newSessionToken),
        refreshTokenHash: hashToken(newRefreshToken),
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
        isAdmin: session.isAdmin,
        expiresAt: new Date(
          Date.now() +
            (session.isAdmin ? env.ADMIN_SESSION_TTL_SECONDS * 1000 : env.USER_SESSION_TTL_SECONDS * 1000)
        ),
      },
    });

    return {
      sessionToken: newSessionToken,
      refreshToken: newRefreshToken,
      expiresAt: newSession.expiresAt,
    };
  },

  /**
   * Request email verification.
   * Generates a secure token, stores hash in DB, and queues a verification email.
   */
  async requestEmailVerification(userId: string, meta?: { requestId?: string }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    if (user.emailVerifiedAt) {
      return { alreadyVerified: true };
    }

    const token = generateSecureToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Invalidate any existing email verification tokens for this user
    await prisma.verificationToken.updateMany({
      where: {
        userId,
        type: TokenType.EMAIL_VERIFY,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    // Create new verification token
    await prisma.verificationToken.create({
      data: {
        userId,
        tokenHash,
        type: TokenType.EMAIL_VERIFY,
        expiresAt,
      },
    });

    // Queue email job
    try {
      const { enqueueJob } = await import('../lib/queue');
      await enqueueJob('email.verification', {
        userId,
        email: user.email,
        token,
        locale: 'th', // Default locale, overridden by caller
      });
    } catch {
      logger.warn('Failed to enqueue verification email — queue may be unavailable');
    }

    await AuditService.log({
      actorId: userId,
      actorType: 'user',
      action: 'user.email_verification.request',
      targetType: 'user',
      targetId: userId,
      requestId: meta?.requestId,
    });

    logger.info('Email verification requested', { userId });
    if (env.NODE_ENV === 'development') {
      logger.debug('DEV ONLY — Email verification token (do not use in production)', { token });
    }
    return { sent: true };
  },

  /**
   * Verify email with token.
   */
  async verifyEmail(token: string, meta?: { requestId?: string }) {
    const tokenHash = hashToken(token);

    // Find valid token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { tokenHash },
    });

    if (!verificationToken || verificationToken.type !== TokenType.EMAIL_VERIFY) {
      throw new AppError('Invalid or expired verification token', 'INVALID_TOKEN', 400);
    }

    if (verificationToken.usedAt) {
      throw new AppError('Verification token already used', 'TOKEN_USED', 400);
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new AppError('Verification token expired', 'TOKEN_EXPIRED', 400);
    }

    // Mark email as verified and consume the token
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      prisma.verificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await AuditService.log({
      actorId: verificationToken.userId,
      actorType: 'user',
      action: 'user.email_verification.complete',
      targetType: 'user',
      targetId: verificationToken.userId,
      requestId: meta?.requestId,
    });

    logger.info('Email verified', { userId: verificationToken.userId });
    return { verified: true };
  },

  /**
   * Request password reset.
   * Anti-enumeration: always returns success, even if email doesn't exist.
   */
  async requestPasswordReset(email: string, meta?: { ip?: string; requestId?: string }) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Anti-enumeration: don't reveal if user exists
    if (!user) {
      logger.info('Password reset requested for unknown email', { email: email.toLowerCase() });
      return { sent: true };
    }

    const token = generateSecureToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any existing password reset tokens for this user
    await prisma.verificationToken.updateMany({
      where: {
        userId: user.id,
        type: TokenType.PASSWORD_RESET,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    // Create new reset token
    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        type: TokenType.PASSWORD_RESET,
        expiresAt,
      },
    });

    // Queue email job
    try {
      const { enqueueJob } = await import('../lib/queue');
      await enqueueJob('email.password_reset', {
        userId: user.id,
        email: user.email,
        token,
        locale: 'th',
      });
    } catch {
      logger.warn('Failed to enqueue password reset email');
    }

    await AuditService.log({
      actorId: user.id,
      actorType: 'user',
      action: 'user.password_reset.request',
      targetType: 'user',
      targetId: user.id,
      ipAddress: meta?.ip,
      requestId: meta?.requestId,
    });

    return { sent: true };
  },

  /**
   * Reset password using token.
   * Revokes all sessions for security.
   */
  async resetPassword(token: string, newPassword: string, meta?: { ip?: string; requestId?: string }) {
    // Validate new password strength
    if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
      throw new AppError('Password must be between 8 and 128 characters', 'VALIDATION_ERROR', 400);
    }

    const tokenHash = hashToken(token);

    // Find valid token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { tokenHash },
    });

    if (!verificationToken || verificationToken.type !== TokenType.PASSWORD_RESET) {
      throw new AppError('Invalid or expired reset token', 'INVALID_TOKEN', 400);
    }

    if (verificationToken.usedAt) {
      throw new AppError('Reset token already used', 'TOKEN_USED', 400);
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new AppError('Reset token expired', 'TOKEN_EXPIRED', 400);
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.userCredential.update({
        where: { userId: verificationToken.userId },
        data: {
          passwordHash,
          failedAttempts: 0,
          lockedUntil: null,
          passwordChangedAt: new Date(),
        },
      }),
      // Consume the token
      prisma.verificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all sessions for security
      prisma.session.updateMany({
        where: { userId: verificationToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await AuditService.log({
      actorId: verificationToken.userId,
      actorType: 'user',
      action: 'user.password_reset.complete',
      targetType: 'user',
      targetId: verificationToken.userId,
      ipAddress: meta?.ip,
      requestId: meta?.requestId,
    });

    logger.info('Password reset completed — all sessions revoked', {
      userId: verificationToken.userId,
    });

    return { reset: true };
  },
};
