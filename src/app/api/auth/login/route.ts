import { NextRequest, NextResponse } from 'next/server';
import { AuthService, loginSchema } from '@/server/services/auth.service';
import { restRateLimit, rateLimitResponse } from '@/server/middleware/rest-rate-limit';

export async function POST(req: NextRequest) {
  try {
    // ─── Rate limit: 5 attempts per 15 min ───────────
    const rl = await restRateLimit(req, 'auth.login');
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? undefined;
    const userAgent = req.headers.get('user-agent') ?? undefined;

    const result = await AuthService.login(parsed.data, { ip, userAgent });

    // MFA challenge — return token, don't create session yet
    if ('mfaRequired' in result && result.mfaRequired) {
      return NextResponse.json({
        mfaRequired: true,
        mfaToken: result.mfaToken,
        user: result.user,
      });
    }

    const response = NextResponse.json({
      user: result.user,
      expiresAt: result.expiresAt,
    });

    // Set HttpOnly session cookie — maxAge matches actual session TTL
    const sessionMaxAge = Math.ceil((result.expiresAt.getTime() - Date.now()) / 1000);
    response.cookies.set('session_token', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: sessionMaxAge,
    });

    // Store refresh token in separate cookie
    response.cookies.set('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (err: unknown) {
    const error = err as { code?: string; statusCode?: number; message?: string };
    const status = error.statusCode ?? (error.code === 'CREDENTIAL_ERROR' ? 401 : 500);

    // Sanitize: only return safe messages in production
    const safeMessages: Record<string, string> = {
      CREDENTIAL_ERROR: 'Invalid email or password',
      ACCOUNT_SUSPENDED: 'Account has been suspended',
    };
    const message = safeMessages[error.code ?? ''] ?? 'Login failed';

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
