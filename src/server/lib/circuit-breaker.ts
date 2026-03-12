/**
 * Circuit Breaker — External Service Resilience
 *
 * Prevents cascade failures when external services (payment
 * providers, email services, etc.) go down.
 *
 * States:
 * - CLOSED: normal operation, requests pass through
 * - OPEN: circuit tripped, requests fail fast
 * - HALF_OPEN: testing if service recovered
 */

import { logger } from './logger';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
  name: string;
  failureThreshold: number;   // failures before opening (default: 5)
  resetTimeoutMs: number;     // time before half-open test (default: 30s)
  halfOpenMaxAttempts: number; // test attempts in half-open (default: 1)
}

interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailure: Date | null = null;
  private lastSuccess: Date | null = null;
  private nextAttemptAt: Date | null = null;
  private readonly options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeoutMs: options.resetTimeoutMs ?? 30_000,
      halfOpenMaxAttempts: options.halfOpenMaxAttempts ?? 1,
      name: options.name,
    };
  }

  /**
   * Execute a function through the circuit breaker.
   * @param fn — The async function to execute
   * @param fallback — Optional fallback to return when circuit is open
   */
  async execute<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.nextAttemptAt && new Date() >= this.nextAttemptAt) {
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker half-open', { name: this.options.name });
      } else {
        if (fallback) return fallback();
        throw new Error(`Circuit breaker OPEN: ${this.options.name} — service unavailable`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.lastSuccess = new Date();

    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failures = 0;
      logger.info('Circuit breaker closed — service recovered', {
        name: this.options.name,
      });
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = new Date();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttemptAt = new Date(Date.now() + this.options.resetTimeoutMs);
      logger.warn('Circuit breaker re-opened from half-open', {
        name: this.options.name,
      });
      return;
    }

    if (this.failures >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptAt = new Date(Date.now() + this.options.resetTimeoutMs);
      logger.error('Circuit breaker OPENED', {
        name: this.options.name,
        failures: String(this.failures),
        resetAfterMs: String(this.options.resetTimeoutMs),
      });
    }
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
    };
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.nextAttemptAt = null;
  }
}

// ─── Pre-configured circuit breakers ─────────────

export const paymentCircuit = new CircuitBreaker({
  name: 'payment-provider',
  failureThreshold: 3,
  resetTimeoutMs: 60_000,
  halfOpenMaxAttempts: 1,
});

export const emailCircuit = new CircuitBreaker({
  name: 'email-provider',
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenMaxAttempts: 2,
});

export const externalApiCircuit = new CircuitBreaker({
  name: 'external-api',
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenMaxAttempts: 1,
});
