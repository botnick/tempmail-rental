import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { restRateLimit, rateLimitResponse } from '@/server/middleware/rest-rate-limit';
import { z } from 'zod';

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limit: reuse register policy (strict)
    const rl = await restRateLimit(req, 'auth.register');
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? undefined;

    await AuthService.resetPassword(parsed.data.token, parsed.data.password, { ip });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as { code?: string; statusCode?: number; message?: string };
    const status = error.statusCode ?? 400;

    return NextResponse.json(
      { error: error.message ?? 'Password reset failed' },
      { status }
    );
  }
}
