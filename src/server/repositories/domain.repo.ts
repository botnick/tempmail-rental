import { PrismaClient, DomainStatus } from '@prisma/client';

export function createDomainRepository(db: PrismaClient) {
  return {
    async create(data: { id: string; userId: string; name: string; isSystem: boolean }) {
      return db.domain.create({ data: { ...data, status: DomainStatus.PENDING } });
    },
    async findById(id: string) { return db.domain.findUnique({ where: { id } }); },
    async findByName(name: string) { return db.domain.findUnique({ where: { name } }); },
    async findByUserId(userId: string) { return db.domain.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }); },
    async findSystemDomains() { return db.domain.findMany({ where: { isSystem: true, status: DomainStatus.VERIFIED } }); },
    async updateStatus(id: string, status: DomainStatus) { return db.domain.update({ where: { id }, data: { status } }); },
    async countAll() { return db.domain.count(); },
    async findMany(params: { skip: number; take: number; status?: DomainStatus }) {
      const where: Record<string, unknown> = {};
      if (params.status) where.status = params.status;
      return db.domain.findMany({ where, skip: params.skip, take: params.take, orderBy: { createdAt: 'desc' } });
    },
  };
}
export type DomainRepository = ReturnType<typeof createDomainRepository>;
