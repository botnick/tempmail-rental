/**
 * Guest session — signed cookie + singleton anonymous user row.
 *
 * Anonymous users get a `guest_token` cookie containing { gid, mailboxIds[], createdAt }
 * HMAC-signed with GUEST_TOKEN_SECRET. Mailbox ownership is proven by membership in
 * the cookie's mailboxIds array, so we never need a DB lookup to authorise a guest.
 *
 * In the DB, all guest mailboxes are owned by a singleton system user
 * (anonymous@system.local, status=SUSPENDED so it can never log in). The mailbox.metadata
 * JSON carries `gid` for analytics/abuse tracing. This keeps the
 * Mailbox.userId → User.id FK intact without a separate GuestSession table.
 */
import { createHmac, timingSafeEqual as _timingSafeEqual } from 'crypto';
import { nanoid } from 'nanoid';
import { env } from '../config/env';
import { prisma } from '../db';
import { logger } from './logger';

export interface GuestSessionPayload {
  gid: string;
  mailboxIds: string[]; // Mailbox.publicId values
  createdAt: number;    // unix ms
}

export const GUEST_COOKIE_NAME = 'guest_token';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const MAX_MAILBOX_IDS = 50; // bound cookie size — beyond this, oldest are dropped

const ANON_EMAIL = 'anonymous@system.local';

/** Cached anon user id — resolved once per process. */
let _anonUserIdCache: string | null = null;

// Anonymous visitors share the `free` (Bronze) plan with registered users.
// No separate "guest" plan — registering doesn't gate the tier, only adds
// device-portability, notifications, and upgrade paths.
const ANON_PLAN_SLUG = 'free';

/**
 * Resolve the singleton anonymous user id, ensuring it exists and is
 * subscribed to the seeded `guest` Plan. This makes
 * `MailboxService.getUserPlanLimits(ANON_USER_ID)` return the guest tier's
 * features (max_mailboxes, retention_hours, etc.) — fully DB-driven, no
 * hardcoded fallbacks.
 *
 * Throws if the `guest` plan has not been seeded.
 */
export async function getAnonUserId(): Promise<string> {
  if (_anonUserIdCache) return _anonUserIdCache;

  // Race-safe singleton resolution: try findUnique first, then create on miss
  // catching P2002 (unique violation) for the race where two concurrent
  // requests both saw no row and both tried to insert. Prisma's `upsert` is
  // not atomic against concurrent inserts on the same unique key.
  let user = await prisma.user.findUnique({ where: { email: ANON_EMAIL } });
  if (!user) {
    try {
      user = await prisma.user.create({
        data: {
          email: ANON_EMAIL,
          displayName: 'Anonymous',
          status: 'SUSPENDED',
          metadata: { system: true, role: 'guest_owner' } as object,
        },
      });
    } catch (err) {
      if ((err as { code?: string })?.code === 'P2002') {
        // Another request just inserted it — fetch their row.
        user = await prisma.user.findUnique({ where: { email: ANON_EMAIL } });
        if (!user) throw err;
      } else {
        throw err;
      }
    }
  }

  // Ensure the anon user has an ACTIVE subscription to the `free` Plan
  // (anonymous visitors share the same tier as registered users) so
  // plan-feature lookups resolve via the standard pathway.
  const anonPlan = await prisma.plan.findUnique({ where: { slug: ANON_PLAN_SLUG } });
  if (!anonPlan) {
    throw new Error(
      `Plan (slug='${ANON_PLAN_SLUG}') is not seeded. Run dev_seed.bat or npm run db:seed.`
    );
  }
  const existingSub = await prisma.subscription.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
  });
  if (!existingSub) {
    try {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: anonPlan.id,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
        },
      });
    } catch (err) {
      // Another concurrent caller may have just inserted a duplicate ACTIVE
      // subscription. Treat as already-done.
      if ((err as { code?: string })?.code !== 'P2002') throw err;
    }
  }

  _anonUserIdCache = user.id;
  return user.id;
}

function getSecret(): string {
  const secret = env.GUEST_TOKEN_SECRET;
  if (!secret) {
    throw new Error(
      'GUEST_TOKEN_SECRET is not configured — guest session cookies cannot be signed. Add it to .env.'
    );
  }
  return secret;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

/** Sign and serialize a guest payload to cookie value form: <payload-b64>.<sig-b64> */
export function signGuestCookie(payload: GuestSessionPayload): string {
  const secret = getSecret();
  const json = JSON.stringify(payload);
  const body = base64UrlEncode(Buffer.from(json, 'utf8'));
  const sig = createHmac('sha256', secret).update(body).digest();
  return `${body}.${base64UrlEncode(sig)}`;
}

/** Verify and parse a guest cookie value. Returns null on tamper / malformed input. */
export function verifyGuestCookie(value: string | undefined | null): GuestSessionPayload | null {
  if (!value) return null;
  if (!env.GUEST_TOKEN_SECRET) return null;

  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const [body, sigB64] = parts;

  try {
    const expected = createHmac('sha256', env.GUEST_TOKEN_SECRET).update(body).digest();
    const actual = base64UrlDecode(sigB64);
    if (expected.length !== actual.length) return null;
    if (!_timingSafeEqual(expected, actual)) return null;

    const json = base64UrlDecode(body).toString('utf8');
    const parsed = JSON.parse(json) as GuestSessionPayload;
    if (
      typeof parsed?.gid !== 'string' ||
      !Array.isArray(parsed?.mailboxIds) ||
      typeof parsed?.createdAt !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch (err) {
    logger.debug('verifyGuestCookie failed', { err: (err as Error).message });
    return null;
  }
}

/** Make a fresh empty payload. */
export function newGuestPayload(): GuestSessionPayload {
  return { gid: nanoid(24), mailboxIds: [], createdAt: Date.now() };
}

/** Add a mailbox publicId to the payload, dropping oldest if over cap. Returns a new payload. */
export function addMailboxToPayload(
  payload: GuestSessionPayload,
  mailboxPublicId: string
): GuestSessionPayload {
  if (payload.mailboxIds.includes(mailboxPublicId)) return payload;
  const next = [...payload.mailboxIds, mailboxPublicId];
  if (next.length > MAX_MAILBOX_IDS) next.shift();
  return { ...payload, mailboxIds: next };
}

/** Remove a mailbox from the payload (e.g. after delete). */
export function removeMailboxFromPayload(
  payload: GuestSessionPayload,
  mailboxPublicId: string
): GuestSessionPayload {
  return { ...payload, mailboxIds: payload.mailboxIds.filter((id) => id !== mailboxPublicId) };
}

/** Cookie attributes for Set-Cookie header. */
export function guestCookieAttributes(): string {
  const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SECONDS}${secure}`;
}

/** Format a full Set-Cookie header value for the guest token. */
export function buildGuestSetCookie(value: string): string {
  return `${GUEST_COOKIE_NAME}=${value}; ${guestCookieAttributes()}`;
}

/** Read & verify guest cookie from a Cookie header string. */
export function readGuestCookieFromHeader(cookieHeader: string | null): GuestSessionPayload | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(new RegExp(`${GUEST_COOKIE_NAME}=([^;]+)`));
  if (!m) return null;
  return verifyGuestCookie(m[1]);
}
