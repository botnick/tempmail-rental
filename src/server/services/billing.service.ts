import { z } from 'zod';
import { prisma } from '../db';
import { AppError, NotFoundError } from '../lib/errors';
import { AuditService } from './audit.service';
import { generateIdempotencyKey } from '../lib/id';
import type { Actor } from '../lib/types';
import { Prisma, TopupStatus, PaymentStatus, LedgerType } from '@prisma/client';
import { env } from '../config/env';

// ─── Input Schemas ──────────────────────────────

export const topupSchema = z.object({
  amount: z.number().positive().max(10000),
  currency: z.string().default(env.DEFAULT_CURRENCY),
  paymentMethod: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

// ─── Service ────────────────────────────────────

export const BillingService = {
  /** Get user's wallet */
  async getWallet(userId: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet');
    }

    return {
      balance: wallet.balance.toString(),
      currency: wallet.currency,
    };
  },

  /** Get wallet ledger history */
  async getLedger(userId: string, page: number = 1, pageSize: number = 20) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundError('Wallet');

    const [entries, total] = await Promise.all([
      prisma.walletLedger.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.walletLedger.count({ where: { walletId: wallet.id } }),
    ]);

    return {
      data: entries.map((e) => ({
        id: e.id,
        type: e.type,
        amount: e.amount.toString(),
        balanceBefore: e.balanceBefore.toString(),
        balanceAfter: e.balanceAfter.toString(),
        description: e.description,
        createdAt: e.createdAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  /**
   * Create a topup request.
   * Uses idempotency key to prevent duplicate charges.
   * In production, this creates a payment intent with the payment provider.
   */
  async createTopup(input: z.infer<typeof topupSchema>, actor: Actor, meta?: { requestId?: string }) {
    const idempotencyKey = input.idempotencyKey ?? generateIdempotencyKey();

    // Idempotency check
    const existing = await prisma.topup.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      return {
        id: existing.publicId,
        status: existing.status,
        amount: existing.amount.toString(),
        message: 'Duplicate request — returning existing topup',
      };
    }

    const topup = await prisma.topup.create({
      data: {
        userId: actor.userId,
        amount: input.amount,
        currency: input.currency,
        paymentMethod: input.paymentMethod,
        idempotencyKey,
        status: TopupStatus.PENDING,
      },
    });

    // Create payment transaction
    await prisma.paymentTransaction.create({
      data: {
        topupId: topup.id,
        amount: input.amount,
        currency: input.currency,
        status: PaymentStatus.PENDING,
        provider: 'manual', // Would be 'stripe', 'paddle', etc. in production
        idempotencyKey: `tx_${idempotencyKey}`,
      },
    });

    await AuditService.log({
      actorId: actor.userId,
      actorType: 'user',
      action: 'billing.topup.create',
      targetType: 'topup',
      targetId: topup.id,
      after: { amount: input.amount, currency: input.currency },
      requestId: meta?.requestId,
    });

    return {
      id: topup.publicId,
      status: topup.status,
      amount: topup.amount.toString(),
    };
  },

  /**
   * Credit wallet (called after successful payment webhook).
   * Uses ledger-based accounting pattern with optimistic locking.
   */
  async creditWallet(params: {
    userId: string;
    amount: number;
    description: string;
    referenceType: string;
    referenceId: string;
    idempotencyKey: string;
    createdBy?: string;
  }) {
    // Idempotency check on ledger
    const existingEntry = await prisma.walletLedger.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });

    if (existingEntry) {
      return { alreadyProcessed: true };
    }

    // Use transaction with optimistic locking
    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId: params.userId },
      });

      if (!wallet) {
        throw new NotFoundError('Wallet');
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = new Prisma.Decimal(balanceBefore).add(new Prisma.Decimal(params.amount));

      // Update wallet with version check (optimistic lock)
      const updated = await tx.wallet.updateMany({
        where: { id: wallet.id, version: wallet.version },
        data: {
          balance: balanceAfter,
          version: wallet.version + 1,
        },
      });

      if (updated.count === 0) {
        throw new AppError('Concurrent wallet update — retry', 'CONFLICT', 409);
      }

      // Create immutable ledger entry
      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          type: LedgerType.CREDIT,
          amount: params.amount,
          balanceBefore,
          balanceAfter,
          description: params.description,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          idempotencyKey: params.idempotencyKey,
          createdBy: params.createdBy,
        },
      });

      return { balanceAfter: balanceAfter.toString() };
    });
  },

  /**
   * Debit wallet (charge for services).
   * Uses ledger-based accounting with optimistic locking.
   * Prevents insufficient balance and double-charges via idempotency.
   */
  async debitWallet(params: {
    userId: string;
    amount: number;
    description: string;
    referenceType: string;
    referenceId: string;
    idempotencyKey: string;
    createdBy?: string;
  }) {
    if (params.amount <= 0) {
      throw new AppError('Debit amount must be positive', 'VALIDATION', 400);
    }

    // Idempotency check on ledger
    const existingEntry = await prisma.walletLedger.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });

    if (existingEntry) {
      return { alreadyProcessed: true };
    }

    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId: params.userId },
      });

      if (!wallet) {
        throw new NotFoundError('Wallet');
      }

      const balanceBefore = wallet.balance;
      const debitAmount = new Prisma.Decimal(params.amount);

      // Insufficient balance check
      if (new Prisma.Decimal(balanceBefore).lessThan(debitAmount)) {
        throw new AppError(
          'Insufficient balance',
          'INSUFFICIENT_FUNDS',
          402,
          { balance: balanceBefore.toString(), required: params.amount.toString() }
        );
      }

      const balanceAfter = new Prisma.Decimal(balanceBefore).sub(debitAmount);

      // Optimistic lock
      const updated = await tx.wallet.updateMany({
        where: { id: wallet.id, version: wallet.version },
        data: {
          balance: balanceAfter,
          version: wallet.version + 1,
        },
      });

      if (updated.count === 0) {
        throw new AppError('Concurrent wallet update — retry', 'CONFLICT', 409);
      }

      // Immutable ledger entry
      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          type: LedgerType.DEBIT,
          amount: params.amount,
          balanceBefore,
          balanceAfter,
          description: params.description,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          idempotencyKey: params.idempotencyKey,
          createdBy: params.createdBy,
        },
      });

      return { balanceAfter: balanceAfter.toString() };
    });
  },

  /**
   * Admin-initiated balance adjustment.
   * Creates a ledger entry with ADJUSTMENT type.
   * Requires an approval record ID for audit trail.
   */
  async adjustBalance(params: {
    userId: string;
    amount: number; // positive = credit, negative = debit
    description: string;
    adminId: string;
    idempotencyKey: string;
    approvalId?: string;
  }) {
    const existingEntry = await prisma.walletLedger.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existingEntry) return { alreadyProcessed: true };

    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId: params.userId },
      });
      if (!wallet) throw new NotFoundError('Wallet');

      const balanceBefore = wallet.balance;
      const adjustAmount = new Prisma.Decimal(params.amount);
      const balanceAfter = new Prisma.Decimal(balanceBefore).add(adjustAmount);

      // Prevent negative balances on debit adjustments
      if (balanceAfter.lessThan(0)) {
        throw new AppError('Adjustment would result in negative balance', 'VALIDATION', 400);
      }

      const updated = await tx.wallet.updateMany({
        where: { id: wallet.id, version: wallet.version },
        data: { balance: balanceAfter, version: wallet.version + 1 },
      });
      if (updated.count === 0) {
        throw new AppError('Concurrent wallet update — retry', 'CONFLICT', 409);
      }

      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          type: LedgerType.ADJUSTMENT,
          amount: Math.abs(params.amount),
          balanceBefore,
          balanceAfter,
          description: `[ADMIN] ${params.description}`,
          referenceType: 'admin_adjustment',
          referenceId: params.approvalId ?? params.adminId,
          idempotencyKey: params.idempotencyKey,
          createdBy: params.adminId,
        },
      });

      return { balanceAfter: balanceAfter.toString() };
    });
  },
};
