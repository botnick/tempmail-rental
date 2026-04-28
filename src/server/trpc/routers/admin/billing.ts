import { z } from 'zod';
import { router, permissionProcedure } from '../../trpc';
import { PERMISSIONS } from '../../../policy';
import { TRPCError } from '@trpc/server';
import { BillingService } from '../../../services/billing.service';
import { PlanService } from '../../../services/plan.service';
import { AuditService } from '../../../services/audit.service';
import { TopupStatus, PaymentStatus } from '@prisma/client';

/**
 * Admin billing operations.
 *
 * No payment provider integration today — admins manually mark topups
 * completed (after verifying off-platform payment) and can adjust wallets
 * with reasons. Every mutation writes an AuditLog entry.
 */
export const adminBillingRouter = router({
  listTransactions: permissionProcedure(PERMISSIONS.ADMIN_BILLING_VIEW)
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
        status: z
          .enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED'])
          .optional(),
        type: z.enum(['TOPUP', 'SUBSCRIPTION', 'REFUND']).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const where = {
        ...(input.search
          ? { referenceId: { contains: input.search, mode: 'insensitive' as const } }
          : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.type ? { type: input.type } : {}),
      };

      const [data, total] = await Promise.all([
        ctx.prisma.paymentTransaction.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: { createdAt: 'desc' },
          include: { invoice: true },
        }),
        ctx.prisma.paymentTransaction.count({ where }),
      ]);

      return {
        data,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  /**
   * List topups with filters — companion view for the manual mark-paid workflow.
   */
  listTopups: permissionProcedure(PERMISSIONS.ADMIN_BILLING_VIEW)
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        status: z.nativeEnum(TopupStatus).optional(),
        userId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const where = {
        ...(input.status ? { status: input.status } : {}),
        ...(input.userId ? { userId: input.userId } : {}),
      };
      const [data, total] = await Promise.all([
        ctx.prisma.topup.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { email: true, displayName: true } } },
        }),
        ctx.prisma.topup.count({ where }),
      ]);
      return {
        data,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  /**
   * Mark a PENDING topup as completed.
   * Credits the user's wallet, marks the topup + payment transaction
   * SUCCEEDED, and writes an audit entry.
   */
  markTopupCompleted: permissionProcedure(PERMISSIONS.ADMIN_BILLING_VIEW)
    .input(
      z.object({
        topupId: z.string(),
        reason: z.string().min(3).max(500),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const topup = await ctx.prisma.topup.findUnique({
        where: { id: input.topupId },
      });
      if (!topup) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Topup not found' });
      }
      if (topup.status !== TopupStatus.PENDING) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Topup is ${topup.status}, only PENDING can be marked completed`,
        });
      }

      const credit = await BillingService.creditWallet({
        userId: topup.userId,
        amount: Number(topup.amount),
        description: `Topup ${topup.publicId} marked paid by admin`,
        referenceType: 'topup',
        referenceId: topup.id,
        idempotencyKey: `topup_complete_${topup.id}`,
        createdBy: ctx.actor!.userId,
      });

      await ctx.prisma.$transaction([
        ctx.prisma.topup.update({
          where: { id: topup.id },
          data: { status: TopupStatus.COMPLETED, completedAt: new Date() },
        }),
        ctx.prisma.paymentTransaction.updateMany({
          where: { topupId: topup.id },
          data: { status: PaymentStatus.SUCCEEDED },
        }),
      ]);

      // If this topup is linked to a paused subscription (paid plan signup),
      // activate that subscription now.
      const linkedSubId = (topup.metadata as { subscriptionId?: string } | null)
        ?.subscriptionId;
      if (linkedSubId) {
        await PlanService.activateSubscription(linkedSubId);
      }

      // Send receipt email — fire-and-forget.
      try {
        const user = await ctx.prisma.user.findUnique({
          where: { id: topup.userId },
          select: { email: true },
        });
        if (user?.email) {
          const { enqueueJob } = await import('../../../lib/queue');
          await enqueueJob('email.billing_receipt', {
            email: user.email,
            amount: topup.amount.toString(),
            currency: topup.currency,
            topupId: topup.publicId,
          });
        }
      } catch {
        // best-effort
      }

      await AuditService.log({
        actorId: ctx.actor!.userId,
        actorType: 'admin',
        action: 'admin.billing.topup.markCompleted',
        targetType: 'topup',
        targetId: topup.id,
        before: { status: topup.status },
        after: { status: TopupStatus.COMPLETED },
        reason: input.reason,
        ipAddress: ctx.ip ?? undefined,
        requestId: ctx.requestId,
      });

      return { ok: true, credit };
    }),

  /**
   * Refund a completed topup.
   * Debits the user's wallet by the topup amount and marks the topup REFUNDED.
   */
  refundTopup: permissionProcedure(PERMISSIONS.ADMIN_BILLING_VIEW)
    .input(
      z.object({
        topupId: z.string(),
        reason: z.string().min(3).max(500),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const topup = await ctx.prisma.topup.findUnique({
        where: { id: input.topupId },
      });
      if (!topup) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Topup not found' });
      }
      if (topup.status !== TopupStatus.COMPLETED) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Topup is ${topup.status}, only COMPLETED can be refunded`,
        });
      }

      await BillingService.debitWallet({
        userId: topup.userId,
        amount: Number(topup.amount),
        description: `Refund of topup ${topup.publicId}: ${input.reason}`,
        referenceType: 'topup_refund',
        referenceId: topup.id,
        idempotencyKey: `topup_refund_${topup.id}`,
        createdBy: ctx.actor!.userId,
      });

      await ctx.prisma.$transaction([
        ctx.prisma.topup.update({
          where: { id: topup.id },
          data: { status: TopupStatus.REFUNDED },
        }),
        ctx.prisma.paymentTransaction.updateMany({
          where: { topupId: topup.id },
          data: { status: PaymentStatus.REFUNDED },
        }),
      ]);

      await AuditService.log({
        actorId: ctx.actor!.userId,
        actorType: 'admin',
        action: 'admin.billing.topup.refund',
        targetType: 'topup',
        targetId: topup.id,
        before: { status: topup.status },
        after: { status: TopupStatus.REFUNDED },
        reason: input.reason,
        ipAddress: ctx.ip ?? undefined,
        requestId: ctx.requestId,
      });

      return { ok: true };
    }),

  /**
   * Direct manual wallet adjustment.
   * Positive amount = credit, negative = debit. Always requires a reason.
   */
  adjustWallet: permissionProcedure(PERMISSIONS.ADMIN_BILLING_VIEW)
    .input(
      z.object({
        userId: z.string(),
        amount: z.number().refine((n) => n !== 0, 'amount must be non-zero'),
        reason: z.string().min(3).max(500),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const idem = `admin_adjust_${ctx.actor!.userId}_${input.userId}_${Date.now()}`;

      if (input.amount > 0) {
        await BillingService.creditWallet({
          userId: input.userId,
          amount: input.amount,
          description: `Admin adjustment (+): ${input.reason}`,
          referenceType: 'admin_adjustment',
          referenceId: ctx.actor!.userId,
          idempotencyKey: idem,
          createdBy: ctx.actor!.userId,
        });
      } else {
        await BillingService.debitWallet({
          userId: input.userId,
          amount: Math.abs(input.amount),
          description: `Admin adjustment (-): ${input.reason}`,
          referenceType: 'admin_adjustment',
          referenceId: ctx.actor!.userId,
          idempotencyKey: idem,
          createdBy: ctx.actor!.userId,
        });
      }

      await AuditService.log({
        actorId: ctx.actor!.userId,
        actorType: 'admin',
        action: 'admin.billing.wallet.adjust',
        targetType: 'user',
        targetId: input.userId,
        after: { amount: input.amount },
        reason: input.reason,
        ipAddress: ctx.ip ?? undefined,
        requestId: ctx.requestId,
      });

      return { ok: true };
    }),
});
