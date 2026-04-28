/**
 * Next.js Instrumentation Hook
 *
 * Runs once when the Next.js server starts.
 *
 * IMPORTANT: this hook is invoked under BOTH the Node and Edge runtimes by
 * default. Our background services (Redis, Prisma, queue worker, cron,
 * crypto-based vault) only work under Node, and importing them under Edge
 * spams the dev console with "Node.js API not supported in Edge Runtime"
 * warnings. We gate the entire dynamic-import block behind
 * `process.env.NEXT_RUNTIME === 'nodejs'` so the Edge bundler never walks
 * the import tree.
 *
 * Bootstraps:
 * - Register email job handlers (verify, reset, welcome, billing receipt, expiry warning)
 * - Start queue worker loop
 * - Start cron maintenance loop
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  try {
    const { registerEmailHandlers } = await import('./server/lib/email.handler');
    registerEmailHandlers();

    const { startWorker } = await import('./server/lib/queue');
    const worker = startWorker(2000); // Poll every 2 seconds

    // Start cron maintenance loop (every 5 minutes)
    const { CronService } = await import('./server/services/cron.service');
    const CRON_INTERVAL = 5 * 60 * 1000; // 5 minutes
    const cronTimer = setInterval(async () => {
      try {
        await CronService.runAll();
      } catch (err) {
        console.warn('[cron] Maintenance cycle failed:', (err as Error).message);
      }
    }, CRON_INTERVAL);

    // Graceful shutdown
    const { onShutdown } = await import('./server/lib/shutdown');
    onShutdown('queue-worker', () => {
      worker.stop();
    });
    onShutdown('cron-timer', () => {
      clearInterval(cronTimer);
    });

    console.log('✅ Queue worker started with email handlers');
    console.log('✅ Cron maintenance loop started (every 5 min)');
  } catch (err) {
    // Don't crash the server if Redis is unavailable
    console.warn('⚠️ Failed to start background services:', (err as Error).message);
  }
}

