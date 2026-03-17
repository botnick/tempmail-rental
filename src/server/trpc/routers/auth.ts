import { z } from 'zod';
import { router, protectedProcedure, rateLimitedProcedure } from '../trpc';
import { AuthService, registerSchema, loginSchema } from '../../services/auth.service';

export const authRouter = router({
  register: rateLimitedProcedure('auth.register')
    .input(registerSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await AuthService.register(input, {
        ip: ctx.ip ?? undefined,
        userAgent: ctx.userAgent ?? undefined,
        requestId: ctx.requestId,
      });
      return result;
    }),

  login: rateLimitedProcedure('auth.login')
    .input(loginSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await AuthService.login(input, {
        ip: ctx.ip ?? undefined,
        userAgent: ctx.userAgent ?? undefined,
        requestId: ctx.requestId,
      });
      return result;
    }),

  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      await AuthService.logout(ctx.session.sessionId, {
        actorId: ctx.actor.userId,
        requestId: ctx.requestId,
      });
      return { success: true };
    }),

  refresh: rateLimitedProcedure('api.general')
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const result = await AuthService.refreshSession(input.refreshToken, {
        ip: ctx.ip ?? undefined,
        userAgent: ctx.userAgent ?? undefined,
      });
      return result;
    }),

  me: protectedProcedure
    .query(async ({ ctx }) => {
      const [user, credential] = await Promise.all([
        ctx.prisma.user.findUnique({
          where: { id: ctx.actor.userId },
          select: {
            publicId: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            status: true,
            emailVerifiedAt: true,
            createdAt: true,
          },
        }),
        ctx.prisma.userCredential.findUnique({
          where: { userId: ctx.actor.userId },
          select: { totpEnabled: true },
        }),
      ]);
      return {
        ...user,
        roles: ctx.actor.roles,
        planSlug: ctx.actor.planSlug,
        totpEnabled: credential?.totpEnabled ?? false,
      };
    }),

  // ─── Email Verification ────────────────────────

  requestEmailVerification: protectedProcedure
    .mutation(async ({ ctx }) => {
      return AuthService.requestEmailVerification(ctx.actor.userId, {
        requestId: ctx.requestId,
      });
    }),

  verifyEmail: rateLimitedProcedure('api.general')
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      return AuthService.verifyEmail(input.token, {
        requestId: ctx.requestId,
      });
    }),

  // ─── Password Reset ────────────────────────────

  requestPasswordReset: rateLimitedProcedure('auth.password-reset')
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      return AuthService.requestPasswordReset(input.email, {
        ip: ctx.ip ?? undefined,
        requestId: ctx.requestId,
      });
    }),

  resetPassword: rateLimitedProcedure('auth.password-reset')
    .input(z.object({
      token: z.string().min(1),
      newPassword: z.string().min(8).max(128),
    }))
    .mutation(async ({ input, ctx }) => {
      return AuthService.resetPassword(input.token, input.newPassword, {
        ip: ctx.ip ?? undefined,
        requestId: ctx.requestId,
      });
    }),

  // ─── MFA ───────────────────────────────────────

  setupMfa: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { MfaService } = await import('../../services/mfa.service');
      return MfaService.setupMfa(ctx.actor.userId, {
        requestId: ctx.requestId,
      });
    }),

  confirmMfa: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ input, ctx }) => {
      const { MfaService } = await import('../../services/mfa.service');
      return MfaService.confirmMfa(ctx.actor.userId, input.code, {
        requestId: ctx.requestId,
      });
    }),

  disableMfa: protectedProcedure
    .input(z.object({
      password: z.string().min(1),
      totpCode: z.string().length(6),
    }))
    .mutation(async ({ input, ctx }) => {
      // Require re-authentication before disabling MFA
      const { reAuthenticate } = await import('../../services/step-up.service');
      await reAuthenticate(ctx.actor.userId, input.password, {
        ip: ctx.ip ?? undefined,
        requestId: ctx.requestId,
      });

      // Verify TOTP code before disabling
      const { MfaService } = await import('../../services/mfa.service');
      const valid = await MfaService.verifyMfaCode(ctx.actor.userId, input.totpCode);
      if (!valid) {
        throw new Error('Invalid TOTP code');
      }

      return MfaService.disableMfa(ctx.actor.userId, {
        requestId: ctx.requestId,
      });
    }),

  // ─── Re-Authentication ─────────────────────────

  reAuthenticate: protectedProcedure
    .input(z.object({ password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const { reAuthenticate } = await import('../../services/step-up.service');
      return reAuthenticate(ctx.actor.userId, input.password, {
        ip: ctx.ip ?? undefined,
        requestId: ctx.requestId,
      });
    }),
});
