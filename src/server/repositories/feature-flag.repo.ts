import { PrismaClient } from '@prisma/client';

export function createFeatureFlagRepository(db: PrismaClient) {
  return {
    async findAll() { return db.featureFlag.findMany({ orderBy: { key: 'asc' } }); },
    async findByKey(key: string) { return db.featureFlag.findUnique({ where: { key } }); },
    async create(data: { key: string; enabled: boolean; description: string; targetRules: unknown }) {
      return db.featureFlag.create({ data: data as any });
    },
    async update(key: string, data: { enabled?: boolean; description?: string; targetRules?: unknown }) {
      return db.featureFlag.update({ where: { key }, data: data as any });
    },
    async delete(key: string) { return db.featureFlag.delete({ where: { key } }); },
  };
}
export type FeatureFlagRepository = ReturnType<typeof createFeatureFlagRepository>;
