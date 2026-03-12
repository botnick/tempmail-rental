import { z } from 'zod';
import { router } from '../../trpc';
import { permissionProcedure } from '../../trpc';
import { PERMISSIONS } from '../../../policy';
import { AuditService } from '../../../services/audit.service';

/**
 * Allowed CMS config key prefixes.
 * Prevents admin users from writing to arbitrary config keys,
 * limiting the blast radius of a compromised admin account.
 */
const ALLOWED_KEY_PREFIXES = [
  'cms.',
  'seo.',
  'content.',
  'page.',
  'faq.',
  'glossary.',
];

const MAX_VALUE_LENGTH = 50_000; // 50KB max per config value

function isAllowedKey(key: string): boolean {
  return ALLOWED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export const adminCmsRouter = router({
  listContent: permissionProcedure(PERMISSIONS.ADMIN_CMS_LIST)
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      category: z.string().max(100).optional(),
      search: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where = {
        category: input.category ?? 'cms',
        isSecret: false,
        ...(input.search ? { key: { contains: input.search, mode: 'insensitive' as const } } : {}),
      };

      const [data, total] = await Promise.all([
        ctx.prisma.configEntry.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: { key: 'asc' },
        }),
        ctx.prisma.configEntry.count({ where }),
      ]);

      return {
        data,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  updateContent: permissionProcedure(PERMISSIONS.ADMIN_CMS_EDIT)
    .input(z.object({
      key: z.string()
        .min(3, 'Key must be at least 3 characters')
        .max(200, 'Key must be at most 200 characters')
        .regex(/^[a-zA-Z0-9._-]+$/, 'Key may only contain alphanumeric, dot, dash, underscore'),
      value: z.string()
        .max(MAX_VALUE_LENGTH, `Value must be at most ${MAX_VALUE_LENGTH} characters`),
      reason: z.string()
        .min(5, 'Reason must be at least 5 characters')
        .max(500, 'Reason must be at most 500 characters'),
    }))
    .mutation(async ({ input, ctx }) => {
      // permissionProcedure guarantees ctx.actor is not null
      const actor = ctx.actor!;

      // ─── SECURITY: Key whitelist check ───
      if (!isAllowedKey(input.key)) {
        throw new Error(
          `Key "${input.key}" is not in the allowed CMS key namespace. ` +
          `Allowed prefixes: ${ALLOWED_KEY_PREFIXES.join(', ')}`
        );
      }

      const before = await ctx.prisma.configEntry.findUnique({
        where: { key: input.key },
      });

      const entry = await ctx.prisma.configEntry.upsert({
        where: { key: input.key },
        update: { value: input.value, updatedBy: actor.userId },
        create: {
          key: input.key,
          value: input.value,
          category: 'cms',
          updatedBy: actor.userId,
        },
      });

      await AuditService.logAdminAction({
        adminId: actor.userId,
        action: 'admin.cms.update',
        targetType: 'config_entry',
        targetId: entry.id,
        reason: input.reason,
        metadata: {
          before: before ? { value: before.value } : null,
          after: { value: input.value },
        },
        requestId: ctx.requestId,
      });

      return entry;
    }),
});
