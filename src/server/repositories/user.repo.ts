/**
 * User Repository — Data Access Layer
 *
 * All database queries for users, credentials, and roles.
 * Uses Prisma client. No business logic here.
 */

import { PrismaClient, UserStatus } from '@prisma/client';

export function createUserRepository(db: PrismaClient) {
  return {
    async findById(id: string) {
      return db.user.findUnique({ where: { id }, include: { userRoles: { include: { role: true } } } });
    },

    async findByEmail(email: string) {
      return db.user.findUnique({ where: { email } });
    },

    async findByPublicId(publicId: string) {
      return db.user.findUnique({ where: { publicId } });
    },

    async create(data: { email: string; displayName: string; publicId: string }) {
      return db.user.create({ data: { ...data, status: UserStatus.ACTIVE } });
    },

    async updateStatus(id: string, status: UserStatus) {
      return db.user.update({ where: { id }, data: { status } });
    },

    async updateProfile(id: string, data: { displayName?: string; avatarUrl?: string }) {
      return db.user.update({ where: { id }, data });
    },

    async countAll() {
      return db.user.count();
    },

    async countByStatus(status: UserStatus) {
      return db.user.count({ where: { status } });
    },

    async findMany(params: { skip: number; take: number; status?: UserStatus; search?: string }) {
      const where: Record<string, unknown> = {};
      if (params.status) where.status = params.status;
      if (params.search) {
        where.OR = [
          { email: { contains: params.search, mode: 'insensitive' } },
          { displayName: { contains: params.search, mode: 'insensitive' } },
        ];
      }
      return db.user.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      });
    },

    async delete(id: string) {
      return db.user.delete({ where: { id } });
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
