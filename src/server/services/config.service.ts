import { prisma } from '../db';
import { LRUCache } from 'lru-cache';
import { encrypt, decrypt, isCiphertext } from '../lib/secret-vault';

/**
 * Config Service — runtime configuration from the config_entries table.
 *
 * Sensitive entries (`isSecret=true`) are encrypted at rest with AES-256-GCM
 * via secret-vault. They are decrypted on read into the in-memory LRU cache
 * (60s TTL) and never echoed back to clients via getByCategory().
 */

const cache = new LRUCache<string, { v: string | null }>({
  max: 200,
  ttl: 60_000,
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
    let value: string | null = entry?.value ?? null;

    if (entry && value !== null && entry.isSecret && isCiphertext(value)) {
      value = decrypt(value);
    }

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

  /**
   * Write a config value. If the existing row (or `meta.isSecret` override)
   * marks the entry as sensitive, the value is encrypted before persistence.
   */
  async set(
    key: string,
    value: string,
    meta?: { category?: string; updatedBy?: string; isSecret?: boolean; description?: string }
  ) {
    const existing = await prisma.configEntry.findUnique({ where: { key } });
    const isSecret = meta?.isSecret ?? existing?.isSecret ?? false;
    const persisted = isSecret ? encrypt(value) : value;

    await prisma.configEntry.upsert({
      where: { key },
      update: {
        value: persisted,
        updatedBy: meta?.updatedBy,
        ...(meta?.isSecret !== undefined ? { isSecret: meta.isSecret } : {}),
        ...(meta?.description !== undefined ? { description: meta.description } : {}),
      },
      create: {
        key,
        value: persisted,
        category: meta?.category ?? 'general',
        updatedBy: meta?.updatedBy,
        isSecret,
        description: meta?.description,
      },
    });

    // Cache the PLAIN value so subsequent reads don't need decrypt.
    cache.set(key, { v: value });
  },

  async getByCategory(category: string) {
    const entries = await prisma.configEntry.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });

    return entries.map((e) => ({
      key: e.key,
      // Never echo secret values to API consumers — even decrypted.
      value: e.isSecret ? '[REDACTED]' : e.value,
      isSecret: e.isSecret,
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
