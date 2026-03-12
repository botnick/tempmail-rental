import { type FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { prisma } from '../db';
import { generateRequestId } from '../lib/id';
import { hashToken } from '../lib/crypto';
import { resolveUserPermissions, resolveUserRoles } from '../policy/rbac';
import type { Actor } from '../lib/types';

export interface TRPCContext {
  prisma: typeof prisma;
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  session: {
    userId: string;
    sessionId: string;
    isAdmin: boolean;
  } | null;
  actor: Actor | null;
}

/**
 * Creates tRPC context for each request.
 * Resolves session from Authorization header bearer token.
 */
export async function createContext(
  opts: FetchCreateContextFnOptions
): Promise<TRPCContext> {
  const requestId = generateRequestId();
  const ip =
    opts.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    opts.req.headers.get('x-real-ip') ??
    null;
  const userAgent = opts.req.headers.get('user-agent') ?? null;

  // Extract session token from cookie or Authorization header
  const cookieHeader = opts.req.headers.get('cookie') ?? '';
  const sessionToken = extractSessionToken(cookieHeader, opts.req.headers.get('authorization'));

  let session: TRPCContext['session'] = null;
  let actor: Actor | null = null;

  if (sessionToken) {
    const tokenHash = hashToken(sessionToken);

    const dbSession = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            subscriptions: {
              where: { status: { in: ['ACTIVE', 'TRIALING'] } },
              include: { plan: true },
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (
      dbSession &&
      !dbSession.revokedAt &&
      dbSession.expiresAt > new Date() &&
      dbSession.user.status === 'ACTIVE'
    ) {
      const roles = await resolveUserRoles(dbSession.userId);
      const permissions = await resolveUserPermissions(dbSession.userId);

      session = {
        userId: dbSession.userId,
        sessionId: dbSession.id,
        isAdmin: dbSession.isAdmin,
      };

      actor = {
        userId: dbSession.userId,
        publicId: dbSession.user.publicId,
        email: dbSession.user.email,
        roles,
        permissions,
        planSlug: dbSession.user.subscriptions[0]?.plan.slug ?? null,
      };

      // Update last active (fire-and-forget)
      prisma.session
        .update({
          where: { id: dbSession.id },
          data: { lastActiveAt: new Date() },
        })
        .catch(() => {});
    }
  }

  return {
    prisma,
    requestId,
    ip,
    userAgent,
    session,
    actor,
  };
}

function extractSessionToken(
  cookieHeader: string,
  authHeader: string | null
): string | null {
  // Try Authorization: Bearer <token>
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Try session cookie
  const match = cookieHeader.match(/session_token=([^;]+)/);
  return match?.[1] ?? null;
}
