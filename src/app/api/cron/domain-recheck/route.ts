/**
 * Domain DNS Re-verification — External Cron Endpoint
 *
 * Called by external cron services (e.g. cron-job.org)
 * Secured via CRON_SECRET header to prevent unauthorized execution.
 *
 * GET /api/cron/domain-recheck
 *
 * Headers:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Response: { success, dns, subscriptions, errors }
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import {
  recheckDomainDns,
  suspendExpiredSubscriptionDomains,
  reactivateSubscribedDomains,
  DOMAIN_CRON_KEYS,
  DOMAIN_CRON_DEFAULTS,
} from '@/server/cron/domain-recheck';
import { ConfigService } from '@/server/services/config.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // ─── Auth: CRON_SECRET ──────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured on server' },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';

  if (
    !token ||
    token.length !== cronSecret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret))
  ) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  // ─── Check if cron is enabled via admin settings ─────────────────
  const enabled = await ConfigService.getBoolean(
    DOMAIN_CRON_KEYS.ENABLED,
    DOMAIN_CRON_DEFAULTS[DOMAIN_CRON_KEYS.ENABLED],
  );

  if (!enabled) {
    return NextResponse.json({
      success: true,
      skipped: true,
      message: 'Domain cron is disabled via admin settings',
    });
  }

  // ─── Run all three tasks ─────────────────────────────────────────
  try {
    const [dnsResult, suspendResult, reactivateResult] = await Promise.all([
      recheckDomainDns(),
      suspendExpiredSubscriptionDomains(),
      reactivateSubscribedDomains(),
    ]);

    return NextResponse.json({
      success: true,
      dns: {
        checked: dnsResult.checked,
        downgraded: dnsResult.downgraded,
        errors: dnsResult.errors,
      },
      subscriptions: {
        suspended: suspendResult.suspended,
        reactivated: reactivateResult.reactivated,
        errors: [...suspendResult.errors, ...reactivateResult.errors],
      },
    });
  } catch (err: any) {
    console.error('[cron/domain-recheck] Error:', err);
    return NextResponse.json(
      { error: 'Internal cron error' },
      { status: 500 },
    );
  }
}
