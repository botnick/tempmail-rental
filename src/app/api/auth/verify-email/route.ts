import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { z } from 'zod';

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = verifyEmailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 400 }
      );
    }

    await AuthService.verifyEmail(parsed.data.token);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as { code?: string; statusCode?: number; message?: string };
    const status = error.statusCode ?? 400;

    return NextResponse.json(
      { error: error.message ?? 'Email verification failed' },
      { status }
    );
  }
}
