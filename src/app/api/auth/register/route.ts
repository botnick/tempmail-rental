import { NextRequest, NextResponse } from 'next/server';
import { AuthService, registerSchema, loginSchema } from '@/server/services/auth.service';

export async function POST(req: NextRequest) {
  try {
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

    // Auto-login after registration
    const loginResult = await AuthService.login(
      { email: parsed.data.email, password: parsed.data.password },
      { ip, userAgent }
    );

    const response = NextResponse.json({
      user: loginResult.user,
      expiresAt: loginResult.expiresAt,
    });

    response.cookies.set('session_token', loginResult.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
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
    return NextResponse.json(
      { error: error.message ?? 'Registration failed' },
      { status }
    );
  }
}
