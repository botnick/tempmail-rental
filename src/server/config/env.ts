import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  DB_POOL_MAX: z.coerce.number().default(20),
  REDIS_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  ARGON2_SECRET: z.string().min(16),
  APP_URL: z.string().url(),
  APP_NAME: z.string().default('TempMail'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  RESEND_API_KEY: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ADMIN_SESSION_TTL_SECONDS: z.coerce.number().default(28800),
  USER_SESSION_TTL_SECONDS: z.coerce.number().default(604800),
  // Sliding idle window — refresh refused if lastActiveAt older than this.
  // Default 7 days; cron also revokes idle sessions matching this threshold.
  SESSION_IDLE_MAX_DAYS: z.coerce.number().default(7),
  DEFAULT_CURRENCY: z.string().min(3).max(3).default('THB'),
  TZ: z.string().default('Asia/Bangkok'),
  RATE_LIMIT_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),

  CRON_SECRET: z.string().optional(),
  GUEST_TOKEN_SECRET: z.string().min(32).optional(),

  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET: z.string().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
});

function createEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }

  return parsed.data;
}

export const env = createEnv();
export type Env = z.infer<typeof envSchema>;
