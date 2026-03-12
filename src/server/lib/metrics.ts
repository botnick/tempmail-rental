/**
 * Metrics & Observability Hooks
 *
 * Lightweight counters and histograms for production monitoring.
 * Can be plugged into Prometheus, Datadog, or any metrics backend.
 *
 * Usage:
 *   metrics.increment('auth.login.success');
 *   metrics.histogram('api.response_time', durationMs);
 */

import { logger } from './logger';

interface MetricEntry {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: number;
}

class MetricsCollector {
  private counters = new Map<string, number>();
  private histogramData = new Map<string, number[]>();
  private flushIntervalMs = 60_000; // Flush metrics log every 60s
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
      this.flushTimer = setInterval(() => this.flush(), this.flushIntervalMs);
    }
  }

  /** Increment a counter */
  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    const key = this.taggedKey(name, tags);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  /** Record a histogram value (e.g., response time) */
  histogram(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.taggedKey(name, tags);
    const values = this.histogramData.get(key) ?? [];
    values.push(value);
    // Keep last 1000 values to prevent memory issues
    if (values.length > 1000) values.shift();
    this.histogramData.set(key, values);
  }

  /** Record a timing measurement */
  timing(name: string, startMs: number, tags?: Record<string, string>): void {
    this.histogram(name, Date.now() - startMs, tags);
  }

  /** Get current counter value */
  getCounter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  /** Get histogram stats */
  getHistogramStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
  } | null {
    const values = this.histogramData.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sorted.reduce((a, b) => a + b, 0) / sorted.length,
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  /** Flush metrics summary to structured log */
  flush(): void {
    if (this.counters.size === 0 && this.histogramData.size === 0) return;

    const snapshot: Record<string, unknown> = {};

    for (const [key, value] of this.counters) {
      snapshot[`counter.${key}`] = value;
    }

    for (const [key] of this.histogramData) {
      const stats = this.getHistogramStats(key);
      if (stats) {
        snapshot[`histogram.${key}`] = stats;
      }
    }

    logger.info('metrics.flush', snapshot);
  }

  /** Get all metrics as a snapshot for API/dashboard */
  getSnapshot(this: MetricsCollector): { counters: Record<string, number>; histograms: Record<string, ReturnType<MetricsCollector['getHistogramStats']>> } {
    const counters: Record<string, number> = {};
    const histograms: Record<string, ReturnType<MetricsCollector['getHistogramStats']>> = {};

    for (const [key, value] of this.counters) {
      counters[key] = value;
    }
    for (const [key] of this.histogramData) {
      histograms[key] = this.getHistogramStats(key);
    }

    return { counters, histograms };
  }

  /** Reset all metrics */
  reset(): void {
    this.counters.clear();
    this.histogramData.clear();
  }

  /** Stop flush timer */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private taggedKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) return name;
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${tagStr}}`;
  }
}

/** Global metrics instance */
export const metrics = new MetricsCollector();
