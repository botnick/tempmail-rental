import { z } from 'zod';
import { router } from '../../trpc';
import { permissionProcedure } from '../../trpc';
import { PERMISSIONS } from '../../../policy';

export const adminBillingRouter = router({
  listTransactions: permissionProcedure(PERMISSIONS.ADMIN_BILLING_VIEW)
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      status: z.enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED']).optional(),
      type: z.enum(['TOPUP', 'SUBSCRIPTION', 'REFUND']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where = {
        ...(input.search ? { referenceId: { contains: input.search, mode: 'insensitive' as const } } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.type ? { type: input.type } : {}),
      };

      const [data, total] = await Promise.all([
        ctx.prisma.paymentTransaction.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            invoice: true,
          },
        }),
        ctx.prisma.paymentTransaction.count({ where }),
      ]);

      return {
        data: data.map((tx) => ({
          ...tx,
          // Extract user from invoice or topup if needed in the future, for now return raw
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),
});
