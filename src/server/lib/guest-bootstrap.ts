/**
 * Server-side guest bootstrap.
 *
 * Used by the landing page server component to ensure the visitor has at
 * least one active guest mailbox + a signed cookie. Idempotent:
 * - If cookie + active mailbox exist → return them
 * - If cookie exists but the mailbox in it is gone (expired/deleted) →
 *   create a new mailbox, append publicId, return updated cookie
 * - If no cookie → mint a fresh one + create first mailbox
 *
 * The cookie is set on the Next response via the cookies() helper in the
 * caller (server component / server action).
 */
import { cookies } from 'next/headers';
import { prisma } from '../db';
import { MailboxStatus } from '@prisma/client';
import { MailboxService } from '../services/mailbox.service';
import {
  GUEST_COOKIE_NAME,
  newGuestPayload,
  verifyGuestCookie,
  signGuestCookie,
  addMailboxToPayload,
  getAnonUserId,
  type GuestSessionPayload,
} from './guest-session';
import { logger } from './logger';
import { env } from '../config/env';

export interface BootstrappedMailbox {
  publicId: string;
  address: string;
  expiresAt: Date | null;
  status: MailboxStatus;
}

export async function ensureGuestMailbox(): Promise<{
  payload: GuestSessionPayload;
  mailbox: BootstrappedMailbox;
}> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  let payload = verifyGuestCookie(existing) ?? newGuestPayload();

  // 1) Try to find an active mailbox that the cookie already owns.
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
      return {
        payload,
        mailbox: {
          publicId: active.publicId,
          address: active.address,
          expiresAt: active.expiresAt,
          status: active.status,
        },
      };
    }
  }

  // 2) Otherwise mint one. Service handles plan-feature lookup + Go backend
  //    creation; we synthesize the Subject inline.
  const anonUserId = await getAnonUserId();
  const result = await MailboxService.createBySubject(
    {},
    {
      kind: 'guest',
      userId: anonUserId,
      publicId: payload.gid,
      tenantId: payload.gid,
      mailboxOwnerIds: payload.mailboxIds,
    },
    { requestId: `guest-bootstrap-${payload.gid}` }
  );

  payload = addMailboxToPayload(payload, result.id);

  // Persist updated cookie.
  cookieStore.set(GUEST_COOKIE_NAME, signGuestCookie(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  logger.info('Guest mailbox bootstrapped', {
    gid: payload.gid,
    mailboxPublicId: result.id,
  });

  return {
    payload,
    mailbox: {
      publicId: result.id,
      address: result.address,
      expiresAt: result.expiresAt,
      status: result.status,
    },
  };
}
