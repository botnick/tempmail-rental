import { z } from 'zod';
import { router } from '../../trpc';
import { permissionProcedure } from '../../trpc';
import { PERMISSIONS } from '../../../policy';
import { AuditService } from '../../../services/audit.service';
import { NotFoundError } from '../../../lib/errors';
import { MailboxStatus } from '@prisma/client';

export const adminMailboxRouter = router({
  list: permissionProcedure(PERMISSIONS.ADMIN_MAILBOX_VIEW)
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      status: z.enum(['ACTIVE', 'EXPIRED', 'QUARANTINED', 'DELETED', 'SUSPENDED']).optional(),
      userId: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where = {
        ...(input.search ? { address: { contains: input.search, mode: 'insensitive' as const } } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.userId ? { user: { publicId: input.userId } } : {}),
      };

      const [data, total] = await Promise.all([
        ctx.prisma.mailbox.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { publicId: true, email: true } },
            domain: { select: { name: true } },
            _count: { select: { messages: true } },
          },
        }),
        ctx.prisma.mailbox.count({ where }),
      ]);

      return {
        data: data.map((m) => ({
          id: m.publicId,
          address: m.address,
          status: m.status,
          riskScore: m.riskScore,
          messageCount: m._count.messages,
          user: m.user,
          domain: m.domain?.name,
          expiresAt: m.expiresAt,
          createdAt: m.createdAt,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  quarantine: permissionProcedure(PERMISSIONS.ADMIN_MAILBOX_MANAGE)
    .input(z.object({
      mailboxId: z.string(),
      reason: z.string().min(5),
    }))
    .mutation(async ({ input, ctx }) => {
      const mailbox = await ctx.prisma.mailbox.findUnique({ where: { publicId: input.mailboxId } });
      if (!mailbox) throw new NotFoundError('Mailbox');

      await ctx.prisma.mailbox.update({
        where: { id: mailbox.id },
        data: { status: MailboxStatus.QUARANTINED },
      });

      await AuditService.logAdminAction({
        adminId: ctx.actor!.userId,
        action: 'admin.mailbox.quarantine',
        targetType: 'mailbox',
        targetId: mailbox.id,
        reason: input.reason,
        requestId: ctx.requestId,
      });

      return { success: true };
    }),

  forceExpire: permissionProcedure(PERMISSIONS.ADMIN_MAILBOX_MANAGE)
    .input(z.object({
      mailboxId: z.string(),
      reason: z.string().min(5),
    }))
    .mutation(async ({ input, ctx }) => {
      const mailbox = await ctx.prisma.mailbox.findUnique({ where: { publicId: input.mailboxId } });
      if (!mailbox) throw new NotFoundError('Mailbox');

      await ctx.prisma.mailbox.update({
        where: { id: mailbox.id },
        data: { status: MailboxStatus.EXPIRED, expiresAt: new Date() },
      });

      await AuditService.logAdminAction({
        adminId: ctx.actor!.userId,
        action: 'admin.mailbox.force_expire',
        targetType: 'mailbox',
        targetId: mailbox.id,
        reason: input.reason,
        requestId: ctx.requestId,
      });

      return { success: true };
    }),

  restore: permissionProcedure(PERMISSIONS.ADMIN_MAILBOX_MANAGE)
    .input(z.object({
      mailboxId: z.string(),
      reason: z.string().min(5),
      extendHours: z.number().int().min(1).default(24),
    }))
    .mutation(async ({ input, ctx }) => {
      const mailbox = await ctx.prisma.mailbox.findUnique({ where: { publicId: input.mailboxId } });
      if (!mailbox) throw new NotFoundError('Mailbox');

      await ctx.prisma.mailbox.update({
        where: { id: mailbox.id },
        data: {
          status: MailboxStatus.ACTIVE,
          expiresAt: new Date(Date.now() + input.extendHours * 60 * 60 * 1000),
        },
      });

      await AuditService.logAdminAction({
        adminId: ctx.actor!.userId,
        action: 'admin.mailbox.restore',
        targetType: 'mailbox',
        targetId: mailbox.id,
        reason: input.reason,
        metadata: { extendHours: input.extendHours },
        requestId: ctx.requestId,
      });

      return { success: true };
    }),

  listMessages: permissionProcedure(PERMISSIONS.ADMIN_MAILBOX_VIEW)
    .input(z.object({
      mailboxId: z.string(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ input, ctx }) => {
      const mailbox = await ctx.prisma.mailbox.findUnique({
        where: { publicId: input.mailboxId },
        select: { id: true, address: true },
      });
      if (!mailbox) throw new NotFoundError('Mailbox');

      const where = { mailboxId: mailbox.id };

      const [messages, total] = await Promise.all([
        ctx.prisma.mailboxMessage.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: { receivedAt: 'desc' },
          select: {
            publicId: true,
            fromAddress: true,
            subject: true,
            bodyText: true,
            isRead: true,
            receivedAt: true,
          },
        }),
        ctx.prisma.mailboxMessage.count({ where }),
      ]);

      return {
        mailboxAddress: mailbox.address,
        data: messages.map((msg) => ({
          id: msg.publicId,
          from: msg.fromAddress,
          subject: msg.subject || '(No Subject)',
          bodyText: msg.bodyText || '',
          isRead: msg.isRead,
          receivedAt: msg.receivedAt,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),
});
