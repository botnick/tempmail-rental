import { prisma } from '../db';
import { LRUCache } from 'lru-cache';

/**
 * Config Service — runtime configuration from the config_entries table.
 * Uses LRU cache (60s TTL, max 200 entries) to avoid DB queries on every request.
 * At 10K+ users, this prevents ~20K DB reads/min for config alone.
 */

const cache = new LRUCache<string, { v: string | null }>({
  max: 200,
  ttl: 60_000, // 60 seconds
});

export const ConfigService = {
  async get(key: string): Promise<string | null> {
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached.v;
    }

    const entry = await prisma.configEntry.findUnique({
      where: { key },
    });
    const value = entry?.value ?? null;

    cache.set(key, { v: value });
    return value;
  },

  async getNumber(key: string, defaultValue: number): Promise<number> {
    const val = await this.get(key);
    if (val === null) return defaultValue;
    const num = Number(val);
    return isNaN(num) ? defaultValue : num;
  },

  async getBoolean(key: string, defaultValue: boolean): Promise<boolean> {
    const val = await this.get(key);
    if (val === null) return defaultValue;
    return val === 'true';
  },

  async getJSON<T>(key: string, defaultValue: T): Promise<T> {
    const val = await this.get(key);
    if (val === null) return defaultValue;
    try {
      return JSON.parse(val) as T;
    } catch {
      return defaultValue;
    }
  },

  async set(key: string, value: string, meta?: { category?: string; updatedBy?: string }) {
    await prisma.configEntry.upsert({
      where: { key },
      update: { value, updatedBy: meta?.updatedBy },
      create: {
        key,
        value,
        category: meta?.category ?? 'general',
        updatedBy: meta?.updatedBy,
      },
    });

    // Update cache immediately on write
    cache.set(key, { v: value });
  },

  async getByCategory(category: string) {
    const entries = await prisma.configEntry.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });

    return entries.map((e) => ({
      key: e.key,
      value: e.isSecret ? '[REDACTED]' : e.value,
      valueType: e.valueType,
      category: e.category,
      description: e.description,
      updatedAt: e.updatedAt,
    }));
  },

  /** Clear all cached config entries */
  clearCache() {
    cache.clear();
  },
};
