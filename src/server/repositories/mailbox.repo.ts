/**
 * Mailbox Repository
 */

import { PrismaClient, MailboxStatus } from '@prisma/client';

export function createMailboxRepository(db: PrismaClient) {
  return {
    async create(data: { id: string; userId: string; address: string; domainId: string; expiresAt: Date }) {
      return db.mailbox.create({ data: { ...data, status: MailboxStatus.ACTIVE } });
    },

    async findById(id: string) {
      return db.mailbox.findUnique({ where: { id }, include: { domain: true } });
    },

    async findByAddress(address: string) {
      return db.mailbox.findFirst({ where: { address, status: MailboxStatus.ACTIVE } });
    },

    async findByUserId(userId: string, params: { skip: number; take: number; status?: MailboxStatus }) {
      const where: Record<string, unknown> = { userId };
      if (params.status) where.status = params.status;
      return db.mailbox.findMany({ where, skip: params.skip, take: params.take, orderBy: { createdAt: 'desc' } });
    },

    async countByUserId(userId: string, status?: MailboxStatus) {
      const where: Record<string, unknown> = { userId };
      if (status) where.status = status;
      return db.mailbox.count({ where });
    },

    async updateStatus(id: string, status: MailboxStatus) {
      return db.mailbox.update({ where: { id }, data: { status } });
    },

    async extendTtl(id: string, newExpiresAt: Date) {
      return db.mailbox.update({ where: { id }, data: { expiresAt: newExpiresAt } });
    },

    async softDelete(id: string) {
      return db.mailbox.update({ where: { id }, data: { status: MailboxStatus.DELETED, deletedAt: new Date() } });
    },

    async countAll(status?: MailboxStatus) {
      return db.mailbox.count(status ? { where: { status } } : undefined);
    },

    async findExpired() {
      return db.mailbox.findMany({
        where: { status: MailboxStatus.ACTIVE, expiresAt: { lt: new Date() } },
        take: 100,
      });
    },
  };
}

export type MailboxRepository = ReturnType<typeof createMailboxRepository>;
