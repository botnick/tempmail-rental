import { z } from 'zod';
import { router } from '../../trpc';
import { permissionProcedure } from '../../trpc';
import { PERMISSIONS } from '../../../policy';
import { ConfigService } from '../../../services/config.service';
import { DOMAIN_CRON_KEYS, DOMAIN_CRON_DEFAULTS } from '../../../cron/domain-recheck';

export const adminDomainRouter = router({
  // ─── Cron Settings ─────────────────────────────────────────────
  cronSettings: permissionProcedure(PERMISSIONS.ADMIN_DOMAIN_MANAGE)
    .query(async () => {
      const [enabled, batchSize, recheckHours, failureThreshold, intervalMinutes] = await Promise.all([
        ConfigService.getBoolean(DOMAIN_CRON_KEYS.ENABLED, DOMAIN_CRON_DEFAULTS[DOMAIN_CRON_KEYS.ENABLED]),
        ConfigService.getNumber(DOMAIN_CRON_KEYS.BATCH_SIZE, DOMAIN_CRON_DEFAULTS[DOMAIN_CRON_KEYS.BATCH_SIZE]),
        ConfigService.getNumber(DOMAIN_CRON_KEYS.RECHECK_INTERVAL_HOURS, DOMAIN_CRON_DEFAULTS[DOMAIN_CRON_KEYS.RECHECK_INTERVAL_HOURS]),
        ConfigService.getNumber(DOMAIN_CRON_KEYS.FAILURE_THRESHOLD, DOMAIN_CRON_DEFAULTS[DOMAIN_CRON_KEYS.FAILURE_THRESHOLD]),
        ConfigService.getNumber(DOMAIN_CRON_KEYS.CRON_INTERVAL_MINUTES, DOMAIN_CRON_DEFAULTS[DOMAIN_CRON_KEYS.CRON_INTERVAL_MINUTES]),
      ]);
      return { enabled, batchSize, recheckHours, failureThreshold, intervalMinutes };
    }),

  updateCronSettings: permissionProcedure(PERMISSIONS.ADMIN_DOMAIN_MANAGE)
    .input(z.object({
      enabled: z.boolean().optional(),
      batchSize: z.number().int().min(1).max(50).optional(),
      recheckHours: z.number().int().min(1).max(168).optional(),
      failureThreshold: z.number().int().min(1).max(10).optional(),
      intervalMinutes: z.number().int().min(10).max(1440).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const adminId = ctx.actor?.userId ?? 'admin';
      const meta = { category: 'domain_cron', updatedBy: adminId };

      const promises: Promise<void>[] = [];

      if (input.enabled !== undefined) {
        promises.push(ConfigService.set(DOMAIN_CRON_KEYS.ENABLED, String(input.enabled), meta));
      }
      if (input.batchSize !== undefined) {
        promises.push(ConfigService.set(DOMAIN_CRON_KEYS.BATCH_SIZE, String(input.batchSize), meta));
      }
      if (input.recheckHours !== undefined) {
        promises.push(ConfigService.set(DOMAIN_CRON_KEYS.RECHECK_INTERVAL_HOURS, String(input.recheckHours), meta));
      }
      if (input.failureThreshold !== undefined) {
        promises.push(ConfigService.set(DOMAIN_CRON_KEYS.FAILURE_THRESHOLD, String(input.failureThreshold), meta));
      }
      if (input.intervalMinutes !== undefined) {
        promises.push(ConfigService.set(DOMAIN_CRON_KEYS.CRON_INTERVAL_MINUTES, String(input.intervalMinutes), meta));
      }

      await Promise.all(promises);
      return { success: true };
    }),

  list: permissionProcedure(PERMISSIONS.ADMIN_DOMAIN_VIEW)
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
          isSystem: d.isSystem,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  create: permissionProcedure(PERMISSIONS.ADMIN_DOMAIN_MANAGE)
    .input(z.object({ name: z.string().min(4).max(253) }))
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.prisma.domain.findUnique({
        where: { name: input.name },
      });
      if (existing) {
        throw new Error('Domain already exists');
      }

      await ctx.prisma.domain.create({
        data: {
          name: input.name,
          status: 'ACTIVE',
          userId: null,
          isSystem: true,
        },
      });

      return { success: true };
    }),

  sync: permissionProcedure(PERMISSIONS.ADMIN_DOMAIN_MANAGE)
    .mutation(async ({ ctx }) => {
      const { TempMailService } = await import('../../../services/tempmail.service');
      const apiDomains = await TempMailService.listDomains();
      
      let added = 0;
      for (const d of apiDomains.domains) {
        const existing = await ctx.prisma.domain.findUnique({ where: { name: d.domainName } });
        if (!existing) {
          await ctx.prisma.domain.create({
            data: {
              name: d.domainName,
              status: 'ACTIVE',
              isSystem: true,
            }
          });
          added++;
        }
      }
      return { success: true, added };
    }),

  delete: permissionProcedure(PERMISSIONS.ADMIN_DOMAIN_MANAGE)
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const domain = await ctx.prisma.domain.findUnique({ where: { id: input.id } });
      if (!domain) {
        throw new Error('Domain not found');
      }

      await ctx.prisma.domain.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
