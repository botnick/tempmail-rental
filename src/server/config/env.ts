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
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ADMIN_SESSION_TTL_SECONDS: z.coerce.number().default(28800),
  USER_SESSION_TTL_SECONDS: z.coerce.number().default(604800),
  DEFAULT_CURRENCY: z.string().min(3).max(3).default('THB'),
  TZ: z.string().default('Asia/Bangkok'),
  RATE_LIMIT_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
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
