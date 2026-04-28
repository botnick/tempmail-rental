/**
 * Guest bootstrap — issues / refreshes the guest_token cookie and ensures
 * the visitor has at least one active anonymous mailbox.
 *
 * GET  → idempotent: read existing cookie + return active mailbox, or mint
 *        a new mailbox + set/update cookie. The homepage's <GuestInbox />
 *        calls this on mount.
 *
 * Cannot live in a server-component RSC because Next 16 forbids cookie
 * mutation outside Route Handlers / Server Actions / middleware.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { MailboxStatus } from '@prisma/client';
import { MailboxService } from '@/server/services/mailbox.service';
import {
  GUEST_COOKIE_NAME,
  newGuestPayload,
  verifyGuestCookie,
  signGuestCookie,
  addMailboxToPayload,
  getAnonUserId,
} from '@/server/lib/guest-session';
import { env } from '@/server/config/env';
import { logger } from '@/server/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  try {
    let payload =
      verifyGuestCookie(req.cookies.get(GUEST_COOKIE_NAME)?.value) ?? newGuestPayload();

    // 1) Try to reuse an active mailbox already in the cookie.
    if (payload.mailboxIds.length > 0) {
      const active = await prisma.mailbox.findFirst({
        where: {
          publicId: { in: payload.mailboxIds },
          status: MailboxStatus.ACTIVE,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (active) {
        const res = NextResponse.json({
          mailbox: {
            publicId: active.publicId,
            address: active.address,
            expiresAt: active.expiresAt,
            status: active.status,
          },
        });
        // Refresh cookie max-age (sliding expiry).
        res.cookies.set(GUEST_COOKIE_NAME, signGuestCookie(payload), cookieOptions());
        return res;
      }
    }

    // 2) Otherwise mint a new mailbox.
    const anonUserId = await getAnonUserId();
    const created = await MailboxService.createBySubject(
      {},
      {
        kind: 'guest',
        userId: anonUserId,
        publicId: payload.gid,
        tenantId: payload.gid,
        mailboxOwnerIds: payload.mailboxIds,
      },
      { ip: req.headers.get('x-forwarded-for') ?? undefined, requestId: `guest-${payload.gid}` }
    );

    payload = addMailboxToPayload(payload, created.id);

    const res = NextResponse.json({
      mailbox: {
        publicId: created.id,
        address: created.address,
        expiresAt: created.expiresAt,
        status: created.status,
      },
    });
    res.cookies.set(GUEST_COOKIE_NAME, signGuestCookie(payload), cookieOptions());

    logger.info('Guest mailbox bootstrapped', {
      gid: payload.gid,
      mailboxPublicId: created.id,
    });

    return res;
  } catch (err) {
    logger.error('Guest bootstrap failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error: 'Bootstrap failed',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };
}
