import { PrismaClient, SubscriptionStatus, PlanStatus } from '@prisma/client';

export function createPlanRepository(db: PrismaClient) {
  return {
    async findAll() {
      return db.plan.findMany({ where: { status: PlanStatus.ACTIVE }, include: { features: true, pricing: true }, orderBy: { sortOrder: 'asc' } });
    },
    async findBySlug(slug: string) {
      return db.plan.findUnique({ where: { slug }, include: { features: true, pricing: true } });
    },
    async findById(id: string) {
      return db.plan.findUnique({ where: { id }, include: { features: true, pricing: true } });
    },
    async getUserSubscription(userId: string) {
      return db.subscription.findFirst({
        where: { userId, status: SubscriptionStatus.ACTIVE },
        include: { plan: { include: { features: true } } },
        orderBy: { createdAt: 'desc' },
      });
    },
    async createSubscription(data: { id: string; userId: string; planId: string; expiresAt: Date | null; currentPeriodStart: Date; currentPeriodEnd: Date }) {
      return db.subscription.create({ data: { ...data, status: SubscriptionStatus.ACTIVE } });
    },
  };
}
export type PlanRepository = ReturnType<typeof createPlanRepository>;
