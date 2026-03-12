import { prisma } from '../db';

/**
 * Config Service — runtime configuration from the config_entries table.
 * Used for system-level settings that can be changed without deployment.
 */
export const ConfigService = {
  async get(key: string): Promise<string | null> {
    const entry = await prisma.configEntry.findUnique({
      where: { key },
    });
    return entry?.value ?? null;
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
};
