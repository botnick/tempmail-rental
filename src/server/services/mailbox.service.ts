import { z } from 'zod';
import { prisma } from '../db';
import { NotFoundError, QuotaExceededError, ConflictError } from '../lib/errors';
import { AuditService } from './audit.service';
import type { Actor } from '../lib/types';
import { nanoid } from 'nanoid';
import { MailboxStatus, DomainStatus, SubscriptionStatus } from '@prisma/client';
import { TempMailService } from './tempmail.service';

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

    // 3. Determine retention/expiry from plan
    const retentionHours = Number(planLimits.get(FEATURE_KEYS.RETENTION_HOURS) ?? 24);

    // Check if domainId is a local custom domain
    let externalDomainId = input.domainId;
    let fallbackCustomDomain: any = null;
    
    if (input.domainId && input.domainId.startsWith('dom_')) {
      const dbDomain = await prisma.domain.findUnique({
        where: { publicId: input.domainId }
      });
      if (!dbDomain) throw new Error('Domain not found');
      if (dbDomain.status !== 'VERIFIED' && dbDomain.status !== 'ACTIVE') {
        throw new Error('You can only create mailboxes on VERIFIED or ACTIVE domains.');
      }
      // If it exists in external API it should be in metadata
      const domainMetadata = dbDomain.metadata as any;
      if (domainMetadata && domainMetadata.externalId) {
        externalDomainId = domainMetadata.externalId;
      } else {
        // We haven't registered this custom domain with the external API yet
        // In a real app we would call POST /admin/domains here or during verify
        // For now, we clear the external domain ID but remember the chosen domain
        externalDomainId = undefined;
        fallbackCustomDomain = dbDomain;
      }
    }

    // 4. Call TempMail API to create the mailbox
    // domainId here is the EXTERNAL API's domain ID (from /v1/domains)
    const tempMailData = await TempMailService.createMailbox(
      input.username || undefined,
      externalDomainId || undefined,
      actor.userId,
      retentionHours
    );

    // 5. Resolve or create local domain record to satisfy FK
    let localDomain = fallbackCustomDomain;
    
    if (!localDomain) {
      localDomain = await prisma.domain.findFirst({
        where: { name: tempMailData.domain },
      });
      if (!localDomain) {
        localDomain = await prisma.domain.create({
          data: {
            name: tempMailData.domain,
            isSystem: true,
            status: 'ACTIVE',
          },
        });
      }
    }
    
    // Override the address if we have a fallback custom domain that wasn't externally registered
    // Note: The external API actually created `user@public.com`, but we link it internally to `user@custom.com`
    // (This is just a mock behavior. In production, custom domains must be registered via TempMail API).
    const finalAddress = fallbackCustomDomain 
      ? `${tempMailData.localPart}@${fallbackCustomDomain.name}`
      : tempMailData.address;

    // 6. Check local uniqueness
    const existing = await prisma.mailbox.findUnique({
      where: { address: finalAddress },
    });
    if (existing) {
      throw new ConflictError('Address already taken');
    }

    const expiresAt = tempMailData.expiresAt
      ? new Date(tempMailData.expiresAt)
      : new Date(Date.now() + retentionHours * 60 * 60 * 1000);

    // 7. Create local mailbox record
    const mailbox = await prisma.mailbox.create({
      data: {
        userId: actor.userId,
        address: finalAddress,
        domainId: localDomain.id,
        expiresAt,
        status: MailboxStatus.ACTIVE,
        metadata: { externalId: tempMailData.id },
      },
    });

    // 8. Create lifecycle event
    await prisma.mailboxEvent.create({
      data: {
        mailboxId: mailbox.id,
        type: 'created',
        metadata: { address: finalAddress, retentionHours },
      },
    });

    // 9. Audit
    await AuditService.log({
      actorId: actor.userId,
      actorType: 'user',
      action: 'mailbox.create',
      targetType: 'mailbox',
      targetId: mailbox.id,
      after: { address: finalAddress, expiresAt: expiresAt.toISOString() },
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

    const mappedData = await Promise.all(
      data.map(async (m) => {
        let messageCount = m._count.messages;
        const { externalId } = (m.metadata as any) || {};
        
        if (externalId) {
          try {
            const externalMailbox = await TempMailService.getMailbox(externalId);
            messageCount = externalMailbox.messageCount;
          } catch (err) {
            // Silently fallback to 0 if TempMail API fails
          }
        }

        return {
          id: m.publicId,
          address: m.address,
          domain: m.domain?.name,
          status: m.status,
          messageCount,
          expiresAt: m.expiresAt,
          createdAt: m.createdAt,
        };
      })
    );

    return {
      data: mappedData,
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

    const { externalId } = (mailbox.metadata as any) || {};

    if (externalId) {
      try {
        const tempMailRes = await TempMailService.listMessages(externalId);
        return tempMailRes.messages.map((m) => ({
          id: m.id,
          from: m.from,
          subject: m.subject,
          bodyText: '', // Fetched via detail if needed, or included if Botnick lists it
          bodyHtml: '',
          isRead: false,
          receivedAt: new Date(m.receivedAt),
          attachments: [],
        }));
      } catch (err) {
        // Fallback to local DB if TempMail API fails or is unavailable
      }
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

  /** Delete a mailbox (soft delete + external API cleanup) */
  async delete(mailboxPublicId: string, actor: Actor, meta?: { requestId?: string }) {
    const mailbox = await prisma.mailbox.findUnique({
      where: { publicId: mailboxPublicId },
    });

    if (!mailbox || mailbox.userId !== actor.userId) {
      throw new NotFoundError('Mailbox');
    }

    // Delete on external TempMail server (best-effort — don't block local delete)
    const { externalId } = (mailbox.metadata as any) || {};
    if (externalId) {
      try {
        await TempMailService.deleteMailbox(externalId);
      } catch {
        // External API failure should not prevent local cleanup
      }
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

    // Call external TempMail API to renew TTL on the real mail server
    const { externalId } = (mailbox.metadata as any) || {};
    if (externalId) {
      const renewed = await TempMailService.renewMailbox(externalId, hours);
      // Use the expiry from the API response if available
      const newExpiry = renewed.expiresAt ? new Date(renewed.expiresAt) : new Date(
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
    }

    // Fallback: local-only mailbox (no external API)
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
