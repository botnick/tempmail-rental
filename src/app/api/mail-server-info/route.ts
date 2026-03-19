/**
 * Proxy route to fetch mail server info from the Go backend.
 * Reads mail server URL from DB settings (admin → TempMail config).
 * Returns DNS records (MX) and multi-node info
 * so the frontend can show correct DNS setup instructions.
 *
 * @route GET /api/mail-server-info
 */
import { NextResponse } from 'next/server';
import { ConfigService } from '@/server/services/config.service';

export async function GET() {
  try {
    const apiUrl = await ConfigService.get('tempmail.api_url');

    if (!apiUrl) {
      return NextResponse.json(
        { error: 'Mail server URL not configured. Set it in Admin → TempMail.' },
        { status: 503 },
      );
    }

    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/server-info`, {
      next: { revalidate: 300 }, // cache 5 min
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Mail server returned ${res.status}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[mail-server-info] Failed to fetch:', err.message);
    return NextResponse.json(
      { error: 'Failed to connect to mail server' },
      { status: 502 },
    );
  }
}
