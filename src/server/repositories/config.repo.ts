import { PrismaClient } from '@prisma/client';

export function createConfigRepository(db: PrismaClient) {
  return {
    async get(key: string) { return db.configEntry.findUnique({ where: { key } }); },
    async set(key: string, value: string, updatedBy: string) {
      return db.configEntry.upsert({ where: { key }, create: { key, value, updatedBy }, update: { value, updatedBy } });
    },
    async getAll() { return db.configEntry.findMany({ orderBy: { key: 'asc' } }); },
    async delete(key: string) { return db.configEntry.delete({ where: { key } }); },
  };
}
export type ConfigRepository = ReturnType<typeof createConfigRepository>;
