import { z } from 'zod';
import { router } from '../../trpc';
import { permissionProcedure } from '../../trpc';
import { PERMISSIONS } from '../../../policy';

export const adminPlanRouter = router({
  list: permissionProcedure(PERMISSIONS.ADMIN_PLAN_LIST)
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where = {
        ...(input.search ? { name: { contains: input.search, mode: 'insensitive' as const } } : {}),
      };

      const [data, total] = await Promise.all([
        ctx.prisma.plan.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: { sortOrder: 'asc' },
          include: {
            features: true,
            pricing: true,
          },
        }),
        ctx.prisma.plan.count({ where }),
      ]);

      return {
        data,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),
});
