import { PrismaClient, LedgerType, TopupStatus } from '@prisma/client';

export function createBillingRepository(db: PrismaClient) {
  return {
    async findWallet(userId: string) { return db.wallet.findUnique({ where: { userId } }); },
    async createWallet(userId: string) { return db.wallet.create({ data: { userId, balance: 0 } }); },
    async updateBalance(userId: string, amount: number, version: number) {
      // Optimistic locking to prevent race conditions
      return db.wallet.updateMany({
        where: { userId, version },
        data: { balance: { increment: amount }, version: { increment: 1 } },
      });
    },
    async createLedgerEntry(data: { id: string; walletId: string; type: LedgerType; amount: number; balanceBefore: number; balanceAfter: number; reference: string; description: string }) {
      return db.walletLedger.create({ data });
    },
    async findLedger(walletId: string, params: { skip: number; take: number }) {
      return db.walletLedger.findMany({ where: { walletId }, skip: params.skip, take: params.take, orderBy: { createdAt: 'desc' } });
    },
    async createTopup(data: { id: string; userId: string; amount: number; method: string; idempotencyKey: string }) {
      return db.topup.create({ data: { ...data, status: TopupStatus.PENDING } });
    },
    async findTopup(id: string) { return db.topup.findUnique({ where: { id } }); },
    async findTopupByIdempotencyKey(key: string) { return db.topup.findFirst({ where: { idempotencyKey: key } }); },
    async updateTopupStatus(id: string, status: TopupStatus) { return db.topup.update({ where: { id }, data: { status } }); },
  };
}
export type BillingRepository = ReturnType<typeof createBillingRepository>;
