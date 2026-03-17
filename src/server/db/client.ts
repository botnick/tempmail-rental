import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { env } from '../config/env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,         // Kill long-running queries
    idle_in_transaction_session_timeout: 60_000,
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown — prevents connection leaks on restart/deploy
if (typeof process !== 'undefined') {
  const shutdown = async () => {
    await prisma.$disconnect();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export type { PrismaClient };
