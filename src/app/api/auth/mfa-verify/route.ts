import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { MfaService } from '@/server/services/mfa.service';
import { restRateLimit, rateLimitResponse } from '@/server/middleware/rest-rate-limit';
import { prisma } from '@/server/db';
import { hashToken } from '@/server/lib/crypto';
import { z } from 'zod';

const mfaVerifySchema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().length(6),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limit: strict
    const rl = await restRateLimit(req, 'auth.login');
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

    const body = await req.json();
    const parsed = mfaVerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      );
    }

    const { mfaToken, code } = parsed.data;

    // Find the MFA challenge token
    const tokenHash = hashToken(mfaToken);
    const challenge = await prisma.verificationToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, publicId: true, email: true, displayName: true } } },
    });

    if (!challenge || challenge.type !== 'MFA_CHALLENGE') {
      return NextResponse.json(
        { error: 'Invalid or expired MFA token' },
        { status: 400 }
      );
    }

    if (challenge.usedAt || challenge.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'MFA token expired. Please log in again.' },
        { status: 400 }
      );
    }

    // Verify TOTP code
    const isValid = await MfaService.verifyMfaCode(challenge.userId, code);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Mark challenge as used
    await prisma.verificationToken.update({
      where: { id: challenge.id },
      data: { usedAt: new Date() },
    });

    // Create session via AuthService helper
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? undefined;
    const userAgent = req.headers.get('user-agent') ?? undefined;

    const session = await AuthService.createSessionForUser(challenge.userId, { ip, userAgent });

    const response = NextResponse.json({
      user: {
        id: challenge.user.publicId,
        email: challenge.user.email,
        displayName: challenge.user.displayName,
      },
      expiresAt: session.expiresAt,
    });

    // Set session cookies
    const sessionMaxAge = Math.ceil((session.expiresAt.getTime() - Date.now()) / 1000);
    response.cookies.set('session_token', session.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: sessionMaxAge,
    });

    response.cookies.set('refresh_token', session.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string };
    return NextResponse.json(
      { error: error.message ?? 'MFA verification failed' },
      { status: error.statusCode ?? 500 }
    );
  }
}
