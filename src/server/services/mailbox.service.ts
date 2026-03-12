import { z } from 'zod';
import { prisma } from '../db';
import { NotFoundError, QuotaExceededError, ConflictError } from '../lib/errors';
import { AuditService } from './audit.service';
import type { Actor } from '../lib/types';
import { nanoid } from 'nanoid';
import { MailboxStatus, DomainStatus, SubscriptionStatus } from '@prisma/client';

// ─── Input Schemas ──────────────────────────────

export const createMailboxSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-z0-9._-]+$/, 'Invalid username format').optional(),
  domainId: z.string().optional(),
});

export const listMailboxesSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  status: z.enum(['ACTIVE', 'EXPIRED', 'QUARANTINED', 'DELETED', 'SUSPENDED']).optional(),
});

// ─── Feature Keys (from plan_features table) ────

const FEATURE_KEYS = {
  MAX_MAILBOXES: 'max_mailboxes',
  RETENTION_HOURS: 'retention_hours',
  CUSTOM_DOMAIN: 'custom_domain_access',
  ALIAS_COUNT: 'alias_count',
  CUSTOM_USERNAME: 'custom_username_access',
} as const;

// ─── Service ────────────────────────────────────

export const MailboxService = {
  /**
   * Create a new mailbox.
   * Checks plan quotas before creation — all limits come from DB.
   */
  async create(
    input: z.infer<typeof createMailboxSchema>,
    actor: Actor,
    meta?: { ip?: string; requestId?: string }
  ) {
    // 1. Resolve user's plan limits from DB
    const planLimits = await this.getUserPlanLimits(actor.userId);

    // 2. Check mailbox quota
    const currentCount = await prisma.mailbox.count({
      where: { userId: actor.userId, status: { notIn: [MailboxStatus.DELETED] } },
    });

    const maxMailboxes = Number(planLimits.get(FEATURE_KEYS.MAX_MAILBOXES) ?? 3);
    if (currentCount >= maxMailboxes) {
      throw new QuotaExceededError('mailboxes');
    }

    // 3. Resolve domain
    let domain: { id: string; name: string } | null = null;
    if (input.domainId) {
      // Custom domain access check
      const customDomainAllowed = planLimits.get(FEATURE_KEYS.CUSTOM_DOMAIN) === 'true';
      if (!customDomainAllowed) {
        throw new QuotaExceededError('custom_domain_access');
      }

      const d = await prisma.domain.findUnique({
        where: { id: input.domainId },
      });
      if (!d || d.status !== DomainStatus.ACTIVE) {
        throw new NotFoundError('Domain');
      }
      domain = { id: d.id, name: d.name };
    } else {
      // Use default system domain
      const systemDomain = await prisma.domain.findFirst({
        where: { isSystem: true, status: DomainStatus.ACTIVE },
      });
      if (!systemDomain) {
        throw new NotFoundError('No system domain configured');
      }
      domain = { id: systemDomain.id, name: systemDomain.name };
    }

    // 4. Generate or validate username
    const username = input.username ?? nanoid(10).toLowerCase();
    const address = `${username}@${domain.name}`;

    // Check uniqueness
    const existing = await prisma.mailbox.findUnique({
      where: { address },
    });
    if (existing) {
      throw new ConflictError('Address already taken');
    }

    // 5. Determine retention/expiry
    const retentionHours = Number(planLimits.get(FEATURE_KEYS.RETENTION_HOURS) ?? 24);
    const expiresAt = new Date(Date.now() + retentionHours * 60 * 60 * 1000);

    // 6. Create mailbox
    const mailbox = await prisma.mailbox.create({
      data: {
        userId: actor.userId,
        address,
        domainId: domain.id,
        expiresAt,
        status: MailboxStatus.ACTIVE,
      },
    });

    // 7. Create lifecycle event
    await prisma.mailboxEvent.create({
      data: {
        mailboxId: mailbox.id,
        type: 'created',
        metadata: { address, retentionHours },
      },
    });

    // 8. Audit
    await AuditService.log({
      actorId: actor.userId,
      actorType: 'user',
      action: 'mailbox.create',
      targetType: 'mailbox',
      targetId: mailbox.id,
      after: { address, expiresAt: expiresAt.toISOString() },
      ipAddress: meta?.ip ?? undefined,
      requestId: meta?.requestId,
    });

    return {
      id: mailbox.publicId,
      address: mailbox.address,
      expiresAt: mailbox.expiresAt,
      status: mailbox.status,
    };
  },

  /** List user's mailboxes with pagination */
  async listByUser(
    userId: string,
    input: z.infer<typeof listMailboxesSchema>
  ) {
    const where = {
      userId,
      ...(input.status ? { status: input.status as MailboxStatus } : { status: { not: MailboxStatus.DELETED } }),
    };

    const [data, total] = await Promise.all([
      prisma.mailbox.findMany({
        where,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          domain: { select: { name: true } },
          _count: { select: { messages: true } },
        },
      }),
      prisma.mailbox.count({ where }),
    ]);

    return {
      data: data.map((m) => ({
        id: m.publicId,
        address: m.address,
        domain: m.domain?.name,
        status: m.status,
        messageCount: m._count.messages,
        expiresAt: m.expiresAt,
        createdAt: m.createdAt,
      })),
      total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.ceil(total / input.pageSize),
    };
  },

  /** Get messages for a mailbox (with ownership check) */
  async getMessages(mailboxPublicId: string, userId: string) {
    const mailbox = await prisma.mailbox.findUnique({
      where: { publicId: mailboxPublicId },
    });

    if (!mailbox || mailbox.userId !== userId) {
      throw new NotFoundError('Mailbox');
    }

    const messages = await prisma.mailboxMessage.findMany({
      where: { mailboxId: mailbox.id },
      orderBy: { receivedAt: 'desc' },
      take: 50,
      include: {
        attachments: {
          select: { id: true, filename: true, contentType: true, size: true, scanStatus: true },
        },
      },
    });

    return messages.map((m) => ({
      id: m.publicId,
      from: m.fromAddress,
      subject: m.subject,
      bodyText: m.bodyText,
      bodyHtml: m.bodyHtml,
      isRead: m.isRead,
      receivedAt: m.receivedAt,
      attachments: m.attachments,
    }));
  },

  /** Delete a mailbox (soft delete) */
  async delete(mailboxPublicId: string, actor: Actor, meta?: { requestId?: string }) {
    const mailbox = await prisma.mailbox.findUnique({
      where: { publicId: mailboxPublicId },
    });

    if (!mailbox || mailbox.userId !== actor.userId) {
      throw new NotFoundError('Mailbox');
    }

    await prisma.mailbox.update({
      where: { id: mailbox.id },
      data: { status: MailboxStatus.DELETED, deletedAt: new Date() },
    });

    await prisma.mailboxEvent.create({
      data: { mailboxId: mailbox.id, type: 'deleted' },
    });

    await AuditService.log({
      actorId: actor.userId,
      actorType: 'user',
      action: 'mailbox.delete',
      targetType: 'mailbox',
      targetId: mailbox.id,
      requestId: meta?.requestId,
    });
  },

  /** Extend mailbox TTL */
  async extendTTL(mailboxPublicId: string, hours: number, actor: Actor) {
    const mailbox = await prisma.mailbox.findUnique({
      where: { publicId: mailboxPublicId },
    });

    if (!mailbox || mailbox.userId !== actor.userId) {
      throw new NotFoundError('Mailbox');
    }

    const newExpiry = new Date(
      (mailbox.expiresAt ?? new Date()).getTime() + hours * 60 * 60 * 1000
    );

    await prisma.mailbox.update({
      where: { id: mailbox.id },
      data: { expiresAt: newExpiry },
    });

    await prisma.mailboxEvent.create({
      data: {
        mailboxId: mailbox.id,
        type: 'extended',
        metadata: { hoursAdded: hours, newExpiry: newExpiry.toISOString() },
      },
    });

    return { expiresAt: newExpiry };
  },

  // ─── Internal Helpers ─────────────────────────

  /** Resolve plan feature limits for a user from DB (not hardcoded) */
  async getUserPlanLimits(userId: string): Promise<Map<string, string>> {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
      },
      include: {
        plan: {
          include: { features: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const limits = new Map<string, string>();

    if (subscription) {
      for (const feature of subscription.plan.features) {
        limits.set(feature.featureKey, feature.value);
      }
    }

    return limits;
  },
};
