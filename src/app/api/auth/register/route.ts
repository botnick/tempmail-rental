import { NextRequest, NextResponse } from 'next/server';
import { AuthService, registerSchema } from '@/server/services/auth.service';
import { restRateLimit, rateLimitResponse } from '@/server/middleware/rest-rate-limit';

export async function POST(req: NextRequest) {
  try {
    // ─── Rate limit: 3 attempts per 1 hour ───────────
    const rl = await restRateLimit(req, 'auth.register');
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? undefined;
    const userAgent = req.headers.get('user-agent') ?? undefined;

    // Register
    await AuthService.register(parsed.data, { ip, userAgent });

    // Auto-login after registration. A freshly-registered account cannot have
    // MFA enabled, so the MFA branch is impossible here — narrow the union.
    const loginResult = await AuthService.login(
      { email: parsed.data.email, password: parsed.data.password },
      { ip, userAgent }
    );

    if ('mfaRequired' in loginResult) {
      return NextResponse.json(
        { error: 'Registration succeeded but auto-login failed unexpectedly' },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      user: loginResult.user,
      expiresAt: loginResult.expiresAt,
    });

    // Session cookie — maxAge matches actual session TTL
    const sessionMaxAge = Math.ceil((loginResult.expiresAt.getTime() - Date.now()) / 1000);
    response.cookies.set('session_token', loginResult.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: sessionMaxAge,
    });

    response.cookies.set('refresh_token', loginResult.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (err: unknown) {
    const error = err as { code?: string; statusCode?: number; message?: string };
    const status = error.statusCode ?? (error.code === 'CONFLICT_ERROR' ? 409 : 500);

    // Sanitize: only return safe messages
    const safeMessages: Record<string, string> = {
      CONFLICT_ERROR: 'An account with this email already exists',
      VALIDATION_ERROR: 'Invalid registration data',
    };
    const message = safeMessages[error.code ?? ''] ?? 'Registration failed';

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
