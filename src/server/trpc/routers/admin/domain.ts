import { z } from 'zod';
import { router } from '../../trpc';
import { permissionProcedure } from '../../trpc';
import { PERMISSIONS } from '../../../policy';

export const adminDomainRouter = router({
  list: permissionProcedure(PERMISSIONS.ADMIN_DOMAIN_LIST)
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      status: z.enum(['VERIFIED', 'PENDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where = {
        ...(input.search ? { name: { contains: input.search, mode: 'insensitive' as const } } : {}),
        ...(input.status ? { status: input.status } : {}),
      };

      const [data, total] = await Promise.all([
        ctx.prisma.domain.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { publicId: true, email: true } },
            _count: { select: { mailboxes: true } },
          },
        }),
        ctx.prisma.domain.count({ where }),
      ]);

      return {
        data: data.map((d) => ({
          id: d.id,
          name: d.name,
          status: d.status,
          user: d.user,
          mailboxCount: d._count.mailboxes,
          createdAt: d.createdAt,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),
});
