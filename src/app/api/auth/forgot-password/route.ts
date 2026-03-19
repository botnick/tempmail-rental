import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { restRateLimit, rateLimitResponse } from '@/server/middleware/rest-rate-limit';
import { z } from 'zod';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 3 attempts per 1 hour
    const rl = await restRateLimit(req, 'auth.password-reset');
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? undefined;

    // Anti-enumeration: always returns success
    await AuthService.requestPasswordReset(parsed.data.email, { ip });

    return NextResponse.json({ success: true });
  } catch {
    // Always return success for anti-enumeration
    return NextResponse.json({ success: true });
  }
}
