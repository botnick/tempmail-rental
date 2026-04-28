/**
 * Attachment Download
 *
 * Verifies ownership (authed user OR guest cookie) → returns 302 redirect to a
 * Cloudflare R2 presigned URL with Content-Disposition: attachment so the
 * browser triggers a download without exposing R2 credentials.
 *
 * Returns 503 if R2 is not configured — no fallback to local disk.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { hashToken } from '@/server/lib/crypto';
import { presignDownload, isStorageConfigured } from '@/server/lib/storage';
import { readGuestCookieFromHeader } from '@/server/lib/guest-session';
import { logger } from '@/server/lib/logger';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: 'Attachment storage is not configured' },
      { status: 503 }
    );
  }

  const { id } = await params;

  const attachment = await prisma.mailboxAttachment.findUnique({
    where: { id },
    include: {
      message: {
        include: {
          mailbox: {
            select: { id: true, userId: true, publicId: true },
          },
        },
      },
    },
  });

  if (!attachment) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  }

  if (attachment.scanStatus === 'malicious') {
    return NextResponse.json(
      { error: 'This attachment has been flagged as malicious' },
      { status: 403 }
    );
  }

  // ── Auth: authed session OR guest cookie ─────────────
  const sessionToken = req.cookies.get('session_token')?.value;
  let authorized = false;

  if (sessionToken) {
    const tokenHash = hashToken(sessionToken);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      select: { userId: true, revokedAt: true, expiresAt: true },
    });
    if (
      session &&
      !session.revokedAt &&
      session.expiresAt >= new Date() &&
      attachment.message.mailbox.userId === session.userId
    ) {
      authorized = true;
    }
  }

  if (!authorized) {
    const guest = readGuestCookieFromHeader(req.headers.get('cookie'));
    if (guest && guest.mailboxIds.includes(attachment.message.mailbox.publicId)) {
      authorized = true;
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = await presignDownload(
      attachment.storageKey,
      attachment.filename,
      attachment.contentType
    );
    return NextResponse.redirect(url, 302);
  } catch (err) {
    logger.error('Presigned URL generation failed', {
      attachmentId: attachment.id,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Download generation failed' }, { status: 500 });
  }
}
