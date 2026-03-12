/**
 * Graceful Shutdown Manager
 *
 * Coordinates clean shutdown of all services to prevent:
 * - Dropped in-flight requests
 * - Orphaned DB connections
 * - Stale Redis connections
 * - Lost queue jobs
 *
 * Hooks are executed in reverse registration order (LIFO).
 */

import { logger } from './logger';

type ShutdownHook = () => Promise<void> | void;

const hooks: Array<{ name: string; fn: ShutdownHook }> = [];
let isShuttingDown = false;
const SHUTDOWN_TIMEOUT_MS = 30_000; // 30 seconds max

/**
 * Register a shutdown hook.
 * Hooks run in reverse registration order.
 */
export function onShutdown(name: string, fn: ShutdownHook): void {
  hooks.push({ name, fn });
}

/**
 * Execute graceful shutdown.
 * Called on SIGTERM/SIGINT, runs all hooks with timeout.
 */
export async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('Graceful shutdown initiated', { signal });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Shutdown timeout')), SHUTDOWN_TIMEOUT_MS)
  );

  try {
    // Execute hooks in reverse order
    const reversedHooks = [...hooks].reverse();

    await Promise.race([
      (async () => {
        for (const hook of reversedHooks) {
          try {
            logger.info(`Shutdown: ${hook.name}`);
            await hook.fn();
          } catch (err: unknown) {
            logger.error(`Shutdown hook failed: ${hook.name}`, {
              errorMessage: (err as Error)?.message,
            });
          }
        }
      })(),
      timeoutPromise,
    ]);

    logger.info('Graceful shutdown complete');
  } catch {
    logger.error('Shutdown timed out — forcing exit');
  } finally {
    process.exit(0);
  }
}

// Register signal handlers
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// ─── Default shutdown hooks ─────────────

// Register Prisma disconnect
onShutdown('prisma', async () => {
  const { prisma } = await import('../db');
  await prisma.$disconnect();
});

// Register Redis disconnect
onShutdown('redis', async () => {
  const { closeRedis } = await import('./redis');
  await closeRedis();
});

// Register metrics flush
onShutdown('metrics', async () => {
  const { metrics } = await import('./metrics');
  metrics.flush();
  metrics.destroy();
});
