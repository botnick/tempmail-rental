import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { TRPCContext } from './context';
import type { PermissionKey } from '../policy/permissions';
import { hasPermission, isAdmin } from '../policy/rbac';
import { logger } from '../lib/logger';
import { env } from '../config/env';

/**
 * tRPC initialization with superjson transformer (supports Date, BigInt, etc.)
 */
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Strip internals in production
        stack: env.NODE_ENV === 'development' ? error.stack : undefined,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;

// ─── Middleware ──────────────────────────────────

/** Logging middleware — logs every request */
const loggerMiddleware = middleware(async ({ path, type, next, ctx }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;

  logger.info('tRPC request', {
    requestId: ctx.requestId,
    path,
    type,
    userId: ctx.actor?.userId,
    durationMs: durationMs as unknown as string,
    ok: result.ok as unknown as string,
  });

  return result;
});

/** Auth middleware — requires valid session */
const authMiddleware = middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.actor) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      actor: ctx.actor,
    },
  });
});

/** Admin middleware — requires admin-level role */
const adminMiddleware = middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.actor) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  if (!isAdmin(ctx.actor.roles)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      actor: ctx.actor,
    },
  });
});

// ─── Base Procedures ────────────────────────────

/** Public procedure — no auth required */
export const publicProcedure = t.procedure.use(loggerMiddleware);

/** Protected procedure — requires valid session */
export const protectedProcedure = t.procedure
  .use(loggerMiddleware)
  .use(authMiddleware);

/** Admin procedure — requires admin role */
export const adminProcedure = t.procedure
  .use(loggerMiddleware)
  .use(adminMiddleware);

/**
 * Permission procedure factory — requires a specific permission.
 * Usage: permissionProcedure(PERMISSIONS.ADMIN_USER_VIEW)
 */
export function permissionProcedure(permission: PermissionKey) {
  return t.procedure
    .use(loggerMiddleware)
    .use(authMiddleware)
    .use(
      middleware(async ({ ctx, next }) => {
        if (!hasPermission(ctx.actor!.permissions, permission)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Permission '${permission}' required`,
          });
        }
        return next({ ctx });
      })
    );
}

/**
 * Rate-limited procedure factory.
 * Uses Redis-backed sliding window rate limiting.
 * Applies BEFORE auth — blocks abusive IPs early.
 *
 * Usage: rateLimitedProcedure('auth.login')
 */
export function rateLimitedProcedure(policyKey: string) {
  return t.procedure
    .use(loggerMiddleware)
    .use(
      middleware(async ({ ctx, next }) => {
        // Skip rate limiting if disabled via env
        if (!env.RATE_LIMIT_ENABLED) {
          return next({ ctx });
        }

        try {
          const { getRedis } = await import('../lib/redis');
          const { checkRateLimit, enforceRateLimit, RATE_LIMIT_POLICIES } = await import('../middleware/rate-limit');

          const policy = RATE_LIMIT_POLICIES[policyKey] ?? RATE_LIMIT_POLICIES['api.general'];
          const identifier = ctx.ip ?? 'unknown';
          const redis = getRedis();

          const result = await checkRateLimit(redis, identifier, policy);
          enforceRateLimit(result);
        } catch (err: unknown) {
          // If rate limit check itself throws TOO_MANY_REQUESTS, re-throw
          if (err instanceof TRPCError && err.code === 'TOO_MANY_REQUESTS') {
            throw err;
          }
          // If Redis is down, log but don't block requests (graceful degradation)
          logger.warn('Rate limit check failed — allowing request', {
            policyKey,
            errorMessage: (err as Error)?.message,
          });
        }

        return next({ ctx });
      })
    );
}

/**
 * Rate-limited + authenticated procedure.
 * For endpoints that need both rate limiting and auth.
 */
export function rateLimitedProtectedProcedure(policyKey: string) {
  return rateLimitedProcedure(policyKey).use(authMiddleware);
}

export type TRPCRouter = typeof router;
