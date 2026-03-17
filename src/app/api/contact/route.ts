import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { restRateLimit, rateLimitResponse } from '@/server/middleware/rest-rate-limit';
import { logger } from '@/server/lib/logger';

const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  subject: z.string().min(1).max(100),
  message: z.string().min(10).max(5000),
});

export async function POST(req: NextRequest) {
  try {
    // ─── Rate limit: 3 requests per 15 min ───────────
    const rl = await restRateLimit(req, 'contact.submit');
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

    const body = await req.json();
    const data = contactSchema.parse(body);

    // Store as audit log entry (no dedicated table needed)
    await prisma.auditLog.create({
      data: {
        actorType: 'anonymous',
        action: 'contact.submit',
        targetType: 'contact_form',
        targetId: data.email,
        before: undefined,
        after: data as any,
        reason: `[${data.subject}] ${data.name}: ${data.message.slice(0, 200)}`,
        ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: err.issues },
        { status: 400 }
      );
    }
    logger.error('Contact form error', { error: err instanceof Error ? err : new Error(String(err)) });
    return NextResponse.json(
      { error: 'Failed to submit' },
      { status: 500 }
    );
  }
}
