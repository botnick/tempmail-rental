import { NextRequest, NextResponse } from 'next/server';
import { AuthService, loginSchema } from '@/server/services/auth.service';

export async function POST(req: NextRequest) {
  try {
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

    const response = NextResponse.json({
      user: result.user,
      expiresAt: result.expiresAt,
    });

    // Set HttpOnly session cookie
    response.cookies.set('session_token', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
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
    return NextResponse.json(
      { error: error.message ?? 'Login failed' },
      { status }
    );
  }
}
