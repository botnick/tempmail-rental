/**
 * SSE stream for live mailbox updates.
 *
 * Auth: accepts either an authenticated session cookie OR a valid
 * guest_token cookie that owns the mailbox. Admins (SYSTEM_ADMIN/ADMIN)
 * may listen to any mailbox.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sseHub, SSEClient } from '@/server/lib/sse-hub';
import { randomUUID } from 'crypto';
import { prisma } from '@/server/db';
import { hashToken } from '@/server/lib/crypto';
import { readGuestCookieFromHeader } from '@/server/lib/guest-session';
import { logger } from '@/server/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mailboxId = searchParams.get('mailboxId');
  if (!mailboxId) {
    return NextResponse.json({ error: 'mailboxId is required' }, { status: 400 });
  }

  // Fetch the target mailbox once — used by both auth paths.
  const mailbox = await prisma.mailbox.findUnique({
    where: { publicId: mailboxId },
    select: { id: true, publicId: true, userId: true },
  });
  if (!mailbox) {
    return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });
  }

  let authorized = false;
  let principalId: string | null = null;

  // Path 1: authed session
  const sessionToken = request.cookies.get('session_token')?.value;
  if (sessionToken) {
    const tokenHash = hashToken(sessionToken);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      select: {
        userId: true,
        revokedAt: true,
        expiresAt: true,
        user: { select: { status: true } },
      },
    });
    if (
      session &&
      !session.revokedAt &&
      session.expiresAt >= new Date() &&
      session.user.status === 'ACTIVE'
    ) {
      if (mailbox.userId === session.userId) {
        authorized = true;
        principalId = session.userId;
      } else {
        // Admin listen-anywhere
        const adminRole = await prisma.userRole.findFirst({
          where: {
            userId: session.userId,
            role: { name: { in: ['SYSTEM_ADMIN', 'ADMIN'] } },
          },
        });
        if (adminRole) {
          authorized = true;
          principalId = session.userId;
        }
      }
    }
  }

  // Path 2: guest cookie owns this mailbox
  if (!authorized) {
    const guest = readGuestCookieFromHeader(request.headers.get('cookie'));
    if (guest && guest.mailboxIds.includes(mailbox.publicId)) {
      authorized = true;
      principalId = `guest:${guest.gid}`;
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Access denied to this mailbox' }, { status: 403 });
  }

  if (!sseHub.canAcceptClient(mailboxId)) {
    return NextResponse.json(
      { error: 'Too many SSE connections for this mailbox' },
      { status: 429 }
    );
  }

  const clientId = randomUUID();
  let sseClient: SSEClient | null = null;

  const stream = new ReadableStream({
    start(controller) {
      sseClient = { id: clientId, controller };
      sseHub.addClient(mailboxId, sseClient);
      const connectPayload = `event: connected\ndata: {"status":"ok","clientId":"${clientId}"}\n\n`;
      try {
        controller.enqueue(new TextEncoder().encode(connectPayload));
      } catch {
        // ignore
      }
    },
    cancel() {
      if (sseClient) sseHub.removeClient(mailboxId, sseClient);
    },
  });

  logger.info('SSE client authenticated', { clientId, principal: principalId, mailboxId });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
