/**
 * Cron API Route — Trigger maintenance tasks
 *
 * Can be called by:
 * - Vercel Cron (via vercel.json)
 * - Railway / external scheduler
 * - Internal setInterval (via instrumentation.ts)
 *
 * Protected by CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from 'next/server';
import { CronService } from '@/server/services/cron.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await CronService.runAll();

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (err) {
    console.error('[cron] Failed:', err);
    return NextResponse.json(
      { error: 'Cron execution failed' },
      { status: 500 }
    );
  }
}
