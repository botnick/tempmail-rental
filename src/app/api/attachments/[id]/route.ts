/**
 * Attachment Download API
 *
 * Downloads a specific mailbox message attachment.
 * Verifies that the authenticated user owns the mailbox.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { hashToken } from '@/server/lib/crypto';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Cookie-based session auth
    const sessionToken = req.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenHash = hashToken(sessionToken);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      select: { userId: true, revokedAt: true, expiresAt: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Find attachment with ownership check
    const attachment = await prisma.mailboxAttachment.findUnique({
      where: { id },
      include: {
        message: {
          include: {
            mailbox: {
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // Verify ownership
    if (attachment.message.mailbox.userId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check scan status
    if (attachment.scanStatus === 'malicious') {
      return NextResponse.json(
        { error: 'This attachment has been flagged as malicious' },
        { status: 403 }
      );
    }

    // TODO: Implement actual storage download (S3, R2, etc.) using storageKey
    return NextResponse.json({
      id: attachment.id,
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
      scanStatus: attachment.scanStatus,
      message: 'Storage download not yet configured',
    });
  } catch (err) {
    console.error('[Attachment Download] Error:', err);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
