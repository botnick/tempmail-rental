import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { hashToken } from '@/server/lib/crypto';

/**
 * POST /api/admin/test-tempmail
 * Server-side proxy to test TempMail API connection (avoids CORS).
 * Admin-only — verified via session cookie + RBAC role check.
 */
export async function POST(req: NextRequest) {
  // ── Auth: verify session cookie ──────────────────────────
  const sessionToken = req.cookies.get('session_token')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tokenHash = hashToken(sessionToken);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          status: true,
          userRoles: {
            include: { role: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    session.user.status !== 'ACTIVE'
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check admin role via RBAC
  const roleNames = session.user.userRoles.map((ur) => ur.role.name);
  if (!roleNames.includes('ADMIN') && !roleNames.includes('SYSTEM_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Proxy test connection ────────────────────────────────
  try {
    const { apiUrl, apiKey } = await req.json();

    if (!apiUrl || typeof apiUrl !== 'string') {
      return NextResponse.json({ status: 'error', message: 'apiUrl is required' }, { status: 400 });
    }

    const base = apiUrl.trim().replace(/\/$/, '');

    // ── SSRF protection: validate URL ─────────────────────
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(`${base}/v1/domains`);
    } catch {
      return NextResponse.json({ status: 'error', message: 'Invalid URL format' }, { status: 400 });
    }

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ status: 'error', message: 'Only http/https URLs allowed' }, { status: 400 });
    }

    // Block private/internal IP ranges
    const hostname = parsedUrl.hostname;
    const privatePatterns = [
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^0\./,
      /^localhost$/i,
      /^\[?::1\]?$/,
    ];
    if (privatePatterns.some((p) => p.test(hostname))) {
      return NextResponse.json({ status: 'error', message: 'Internal addresses are not allowed' }, { status: 400 });
    }

    const headers: HeadersInit = { 'Accept': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(parsedUrl.toString(), {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const body = await res.json();
      const count = body?.count ?? body?.domains?.length ?? '?';
      return NextResponse.json({ status: 'ok', count });
    } else {
      const text = await res.text().catch(() => '');
      return NextResponse.json({
        status: 'error',
        message: `HTTP ${res.status} — ${res.statusText}`,
        body: text.slice(0, 200),
      });
    }
  } catch (err: any) {
    const isTimeout = err.name === 'AbortError';
    return NextResponse.json({
      status: 'error',
      message: isTimeout ? 'Connection timed out (8s)' : (err.message ?? 'Connection failed'),
    });
  }
}
