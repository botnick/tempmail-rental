/**
 * GDPR Data Export API
 *
 * Lets authenticated users download all their personal data.
 * Returns a JSON file containing user profile, mailboxes,
 * messages, domains, billing, and audit logs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { hashToken } from '@/server/lib/crypto';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
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

    const userId = session.userId;

    // Fetch all user data in parallel
    const [
      user,
      mailboxes,
      domains,
      wallet,
      ledger,
      subscriptions,
      auditLogs,
      sessions,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          displayName: true,
          avatarUrl: true,
          status: true,
          emailVerifiedAt: true,
          createdAt: true,
          metadata: true,
        },
      }),
      prisma.mailbox.findMany({
        where: { userId, deletedAt: null },
        select: {
          address: true,
          expiresAt: true,
          createdAt: true,
          messages: {
            select: {
              fromAddress: true,
              subject: true,
              bodyText: true,
              receivedAt: true,
            },
            orderBy: { receivedAt: 'desc' },
            take: 500,
          },
        },
      }),
      prisma.domain.findMany({
        where: { userId },
        select: {
          name: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.wallet.findUnique({
        where: { userId },
        select: {
          balance: true,
          currency: true,
        },
      }),
      prisma.walletLedger.findMany({
        where: { wallet: { userId } },
        select: {
          type: true,
          amount: true,
          description: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.subscription.findMany({
        where: { userId },
        select: {
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          plan: {
            select: { name: true, slug: true },
          },
        },
      }),
      prisma.auditLog.findMany({
        where: { actorId: userId },
        select: {
          action: true,
          targetType: true,
          createdAt: true,
          ipAddress: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.session.findMany({
        where: { userId },
        select: {
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          expiresAt: true,
          revokedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      format: 'GDPR Article 20 — Data Portability',
      user,
      mailboxes: mailboxes.map((m) => ({
        address: m.address,
        expiresAt: m.expiresAt,
        createdAt: m.createdAt,
        messageCount: m.messages.length,
        messages: m.messages,
      })),
      domains,
      billing: {
        wallet: wallet ? {
          balance: wallet.balance.toString(),
          currency: wallet.currency,
        } : null,
        transactions: ledger.map((l) => ({
          ...l,
          amount: l.amount.toString(),
        })),
      },
      subscriptions,
      auditLogs,
      sessions,
    };

    const jsonStr = JSON.stringify(exportData, null, 2);

    return new NextResponse(jsonStr, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="gdpr-export-${Date.now()}.json"`,
      },
    });
  } catch (err) {
    console.error('[GDPR Export] Error:', err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
