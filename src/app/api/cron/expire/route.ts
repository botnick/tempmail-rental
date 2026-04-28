/**
 * Cron — expire mailboxes past their TTL.
 *
 * Schedule from any external scheduler (Vercel Cron, Railway, GitHub Actions)
 * with header `Authorization: Bearer <CRON_SECRET>`. Safe to run on a
 * 1-minute interval; idempotent.
 */
import { NextRequest, NextResponse } from 'next/server';
import { expireMailboxes } from '@/server/jobs/expire-mailboxes';
import { env } from '@/server/config/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}

async function run(req: NextRequest) {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 503 }
    );
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await expireMailboxes();
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Expire job failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
