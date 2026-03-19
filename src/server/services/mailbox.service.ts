import { z } from 'zod';
import { prisma } from '../db';
import { NotFoundError, QuotaExceededError, ConflictError } from '../lib/errors';
import { AuditService } from './audit.service';
import type { Actor } from '../lib/types';
import { nanoid } from 'nanoid';
import { MailboxStatus, DomainStatus, SubscriptionStatus } from '@prisma/client';
import { TempMailService } from './tempmail.service';
import { logger } from '../lib/logger';

// ─── Input Schemas ──────────────────────────────

export const createMailboxSchema = z.object({
  username: z.string()
    .min(1, 'Username must be at least 1 character')         // RFC 5321
    .max(30, 'Username must be at most 30 characters')       // practical limit
    .regex(/^[a-z0-9._-]+$/, 'Only lowercase letters, numbers, dots, hyphens and underscores')
    .refine(v => /^[a-z0-9]/.test(v), 'Must start with a letter or number')   // RFC 5322
    .refine(v => /[a-z0-9]$/.test(v), 'Must end with a letter or number')     // RFC 5322
    .refine(v => !/\.{2,}/.test(v), 'Consecutive dots not allowed')           // RFC 5322
    .refine(v => !/[-_]{2,}/.test(v), 'Consecutive hyphens/underscores not allowed')
    .optional(),
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

    // Check if domainId is a local custom domain (lookup by publicId in DB)
    let externalDomainId = input.domainId;
    let fallbackCustomDomain: any = null;
    
    if (input.domainId) {
      // Try to find as a local custom domain by publicId
      const dbDomain = await prisma.domain.findUnique({
        where: { publicId: input.domainId }
      });
      
      if (dbDomain) {
        // It's a local custom domain
        if (dbDomain.status !== 'VERIFIED' && dbDomain.status !== 'ACTIVE') {
          throw new Error('Domain not found or inactive');
        }
        // Use externalId from metadata to talk to Go backend
        let domainMetadata = dbDomain.metadata as any;
        if (domainMetadata && domainMetadata.externalId) {
          externalDomainId = domainMetadata.externalId;
        } else {
          // Auto-register on Go backend first
          console.log(`[MAILBOX-CREATE] Domain ${dbDomain.name} has no externalId, auto-registering...`);
          const { DomainService } = await import('./domain.service');
          await DomainService.registerOnGoBackend(dbDomain.name, dbDomain.id, dbDomain.userId ?? undefined);
          
          // Re-read to get the externalId
          const updated = await prisma.domain.findUnique({ where: { id: dbDomain.id } });
          domainMetadata = updated?.metadata as any;
          if (domainMetadata && domainMetadata.externalId) {
            externalDomainId = domainMetadata.externalId;
            console.log(`[MAILBOX-CREATE] Got externalId: ${externalDomainId}`);
          } else {
            throw new Error(`Failed to register domain ${dbDomain.name} with mail server. Please try again.`);
          }
        }
        fallbackCustomDomain = dbDomain;
      }
      // If not found in DB, assume it's a Go backend domain ID (from public domains list)
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
    
    // Use the address from Go API directly (now always on the correct domain)
    const finalAddress = tempMailData.address;

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
        let effectiveStatus = m.status;
        const { externalId } = (m.metadata as any) || {};
        
        if (externalId && m.status === MailboxStatus.ACTIVE) {
          try {
            const externalMailbox = await TempMailService.getMailbox(externalId);
            messageCount = externalMailbox.messageCount;
          } catch (err: any) {
            // Mailbox deleted from Go backend → auto-mark as EXPIRED locally
            if (err?.code === 'NOT_FOUND') {
              logger.warn('[mailbox] Orphaned mailbox detected, marking expired', {
                mailboxId: m.id,
                address: m.address,
                externalId,
              });
              effectiveStatus = MailboxStatus.EXPIRED;
              // Fire-and-forget: update DB in background
              prisma.mailbox.update({
                where: { id: m.id },
                data: { status: MailboxStatus.EXPIRED, deletedAt: new Date() },
              }).catch(() => {});
              prisma.mailboxEvent.create({
                data: {
                  mailboxId: m.id,
                  type: 'expired',
                  metadata: { reason: 'orphaned_external_deleted' },
                },
              }).catch(() => {});
            }
            // Other errors: silently fallback to local count
          }
        }

        return {
          id: m.publicId,
          address: m.address,
          domain: m.domain?.name,
          status: effectiveStatus,
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
      } catch (err: any) {
        // Mailbox no longer exists on Go backend
        if (err?.code === 'NOT_FOUND') {
          logger.warn('[mailbox] getMessages: external mailbox not found', {
            mailboxId: mailbox.id,
            externalId,
          });
          // Auto-mark mailbox expired
          await prisma.mailbox.update({
            where: { id: mailbox.id },
            data: { status: MailboxStatus.EXPIRED, deletedAt: new Date() },
          });
        } else {
          logger.warn('[mailbox] getMessages: external API failed', {
            mailboxId: mailbox.id,
            error: err?.message,
          });
        }
        // Fallback to local DB
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
      try {
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
      } catch (err: any) {
        // Mailbox no longer exists on Go backend
        if (err?.code === 'NOT_FOUND') {
          logger.warn('[mailbox] extendTTL: external mailbox not found, marking expired', {
            mailboxId: mailbox.id,
            externalId,
          });
          await prisma.mailbox.update({
            where: { id: mailbox.id },
            data: { status: MailboxStatus.EXPIRED, deletedAt: new Date() },
          });
          await prisma.mailboxEvent.create({
            data: {
              mailboxId: mailbox.id,
              type: 'expired',
              metadata: { reason: 'external_mailbox_not_found' },
            },
          });
          throw new NotFoundError('Mailbox no longer exists on mail server');
        }
        throw err; // Re-throw other errors (timeout, etc.)
      }
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
