import { NextRequest, NextResponse } from 'next/server';
import { sseHub, SSEClient } from '@/server/lib/sse-hub';
import { randomUUID } from 'crypto';
import { prisma } from '@/server/db';
import { hashToken } from '@/server/lib/crypto';
import { logger } from '@/server/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mailboxId = searchParams.get('mailboxId');

  if (!mailboxId) {
    return NextResponse.json({ error: 'mailboxId is required' }, { status: 400 });
  }

  // ── Auth: verify session cookie ────────────────────────
  const sessionToken = request.cookies.get('session_token')?.value;

  if (!sessionToken) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const tokenHash = hashToken(sessionToken);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    select: { userId: true, revokedAt: true, expiresAt: true, user: { select: { status: true } } },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    session.user.status !== 'ACTIVE'
  ) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  // ── Verify mailbox ownership ───────────────────────────
  const mailbox = await prisma.mailbox.findFirst({
    where: {
      publicId: mailboxId,
      domain: { userId: session.userId },
    },
    select: { id: true },
  });

  if (!mailbox) {
    // Also allow admin users to listen
    const adminRole = await prisma.userRole.findFirst({
      where: {
        userId: session.userId,
        role: { name: { in: ['SYSTEM_ADMIN', 'ADMIN'] } },
      },
    });

    if (!adminRole) {
      return NextResponse.json({ error: 'Access denied to this mailbox' }, { status: 403 });
    }
  }

  // ── Check connection limit ─────────────────────────
  if (!sseHub.canAcceptClient(mailboxId)) {
    return NextResponse.json(
      { error: 'Too many SSE connections for this mailbox' },
      { status: 429 }
    );
  }

  // ── Proceed with SSE stream ────────────────────────────
  const clientId = randomUUID();

  let controllerRef: ReadableStreamDefaultController | null = null;
  let sseClient: SSEClient | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
      sseClient = {
        id: clientId,
        controller,
      };

      // Add client to the hub
      sseHub.addClient(mailboxId, sseClient);

      // Send initial connection successful event
      const connectPayload = `event: connected\ndata: {"status":"ok","clientId":"${clientId}"}\n\n`;
      try {
        controller.enqueue(new TextEncoder().encode(connectPayload));
      } catch (e) {
        // Ignored
      }
    },
    cancel() {
      // Cleanup when client disconnects
      if (sseClient) {
        sseHub.removeClient(mailboxId, sseClient);
      }
    },
  });

  logger.info('SSE client authenticated', { clientId, userId: session.userId, mailboxId });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}

