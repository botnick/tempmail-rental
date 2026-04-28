import { z } from 'zod';
import { prisma } from '../db';
import { NotFoundError, QuotaExceededError, ConflictError } from '../lib/errors';
import { AuditService } from './audit.service';
import type { Actor, Subject } from '../lib/types';
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
   *
   * `meta.tenantId` overrides the Go-backend tenant id (defaults to actor.userId).
   * For anonymous guest mailboxes, pass tenantId = guestGid so Go-side rate limits
   * key on the guest, not on the singleton anonymous owner row.
   *
   * `meta.guestGid`, when present, is stored in mailbox.metadata for abuse tracing.
   */
  async create(
    input: z.infer<typeof createMailboxSchema>,
    actor: Actor,
    meta?: {
      ip?: string;
      requestId?: string;
      tenantId?: string;
      guestGid?: string;
      /** When set, count current mailboxes by these publicIds instead of by actor.userId.
       * Used for guests so quota is per-cookie (per-gid), not per-anon-user (which is global). */
      countByPublicIds?: ReadonlyArray<string>;
    }
  ) {
    // 1. Resolve plan limits from DB. For the singleton anonymous user this
    //    resolves to the `guest` plan's features (seeded). Authed users get
    //    their actual subscription's plan features.
    const planLimits = await this.getUserPlanLimits(actor.userId);

    const maxMailboxesRaw = planLimits.get(FEATURE_KEYS.MAX_MAILBOXES);
    const retentionHoursRaw = planLimits.get(FEATURE_KEYS.RETENTION_HOURS);
    if (maxMailboxesRaw == null || retentionHoursRaw == null) {
      // No plan feature found — refuse to fall back to magic numbers.
      throw new Error(
        `Plan features not configured for user ${actor.userId}: missing ${FEATURE_KEYS.MAX_MAILBOXES} or ${FEATURE_KEYS.RETENTION_HOURS}. Seed plan features.`
      );
    }
    const maxMailboxes = Number(maxMailboxesRaw);
    const retentionHours = Number(retentionHoursRaw);

    // 2. Check mailbox quota — scope by cookie for guests, by userId for users.
    const currentCount = meta?.countByPublicIds
      ? await prisma.mailbox.count({
          where: {
            publicId: { in: [...meta.countByPublicIds] },
            status: { notIn: [MailboxStatus.DELETED] },
          },
        })
      : await prisma.mailbox.count({
          where: { userId: actor.userId, status: { notIn: [MailboxStatus.DELETED] } },
        });

    if (currentCount >= maxMailboxes) {
      throw new QuotaExceededError('mailboxes');
    }

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
    const tenantId = meta?.tenantId ?? actor.userId;
    const tempMailData = await TempMailService.createMailbox(
      input.username || undefined,
      externalDomainId || undefined,
      tenantId,
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
        metadata: meta?.guestGid
          ? { externalId: tempMailData.id, guestGid: meta.guestGid }
          : { externalId: tempMailData.id },
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

  // ─── Guest-aware variants ────────────────────────
  // These accept a Subject (authed user OR guest cookie) and enforce ownership
  // via the cookie's mailboxOwnerIds for guests, or mailbox.userId for users.

  /**
   * Create a mailbox for the given subject. Returns the new mailbox publicId so
   * the caller (route handler) can append it to the guest cookie.
   *
   * For guests we reuse the existing `create()` by synthesising an Actor that
   * points at the singleton anonymous user. The Go-backend tenantId is the gid
   * so per-guest rate limits apply on the mail server side.
   */
  /**
   * Create a mailbox for a Subject (guest or authed user).
   *
   * For guests, limits & retention are pulled from the `guest` Plan in DB
   * (seeded once; admin-tunable). The mailbox quota count is scoped to the
   * cookie's mailboxOwnerIds — NOT to userId — because the singleton anonymous
   * user is shared across every guest globally and we must not aggregate.
   *
   * No hardcoded numbers — everything is plan-driven.
   */
  async createBySubject(
    input: z.infer<typeof createMailboxSchema>,
    subject: Subject,
    meta?: { ip?: string; requestId?: string }
  ) {
    const actor: Actor = {
      userId: subject.userId,
      publicId: subject.publicId,
      email: '',
      roles: [],
      permissions: [],
      planSlug: null,
    };
    return this.create(input, actor, {
      ip: meta?.ip,
      requestId: meta?.requestId,
      tenantId: subject.tenantId,
      guestGid: subject.kind === 'guest' ? subject.publicId : undefined,
      // For guests, scope the quota count by the cookie's mailboxOwnerIds so
      // they don't share a global counter with every other guest. The limit
      // value itself comes from the `guest` Plan's PlanFeature (max_mailboxes).
      countByPublicIds: subject.kind === 'guest' ? subject.mailboxOwnerIds : undefined,
    });
  },

  /** Lookup a mailbox by publicId; throw NotFoundError if subject does not own it. */
  async _findOwned(mailboxPublicId: string, subject: Subject) {
    const mailbox = await prisma.mailbox.findUnique({
      where: { publicId: mailboxPublicId },
    });
    if (!mailbox) throw new NotFoundError('Mailbox');

    if (subject.kind === 'user') {
      if (mailbox.userId !== subject.userId) throw new NotFoundError('Mailbox');
    } else {
      // guest: ownership is proven by cookie membership
      if (!subject.mailboxOwnerIds.includes(mailbox.publicId)) {
        throw new NotFoundError('Mailbox');
      }
    }
    return mailbox;
  },

  /**
   * List mailboxes owned by a subject.
   * Authed users: by mailbox.userId.
   * Guests: by `mailbox.publicId IN cookie.mailboxIds` — no ANON_USER_ID broad scan.
   */
  async listBySubject(subject: Subject, input: z.infer<typeof listMailboxesSchema>) {
    if (subject.kind === 'user') {
      return this.listByUser(subject.userId, input);
    }
    // Guest: filter strictly by mailboxOwnerIds (publicIds) from the cookie.
    const ids = [...subject.mailboxOwnerIds];
    if (ids.length === 0) {
      return { data: [], total: 0, page: input.page, pageSize: input.pageSize, totalPages: 0 };
    }
    const where = {
      publicId: { in: ids },
      ...(input.status
        ? { status: input.status as MailboxStatus }
        : { status: { not: MailboxStatus.DELETED } }),
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

  /**
   * Get messages for a mailbox owned by subject.
   *
   * Local DB is the source of truth — webhook ingest persists every message
   * with attachments mirrored to R2. We do NOT round-trip to the Go backend
   * here, so reads stay fast and work offline of the mail server.
   */
  async getMessagesBySubject(mailboxPublicId: string, subject: Subject) {
    const mailbox = await this._findOwned(mailboxPublicId, subject);
    const messages = await prisma.mailboxMessage.findMany({
      where: { mailboxId: mailbox.id },
      orderBy: { receivedAt: 'desc' },
      take: 50,
      include: {
        attachments: {
          select: {
            id: true,
            filename: true,
            contentType: true,
            size: true,
            scanStatus: true,
          },
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

  /** Delete a mailbox owned by subject. Returns the publicId for cookie cleanup. */
  async deleteBySubject(
    mailboxPublicId: string,
    subject: Subject,
    meta?: { requestId?: string }
  ) {
    const mailbox = await this._findOwned(mailboxPublicId, subject);
    const { externalId } = (mailbox.metadata as any) || {};
    if (externalId) {
      try {
        await TempMailService.deleteMailbox(externalId);
      } catch {
        // External best-effort.
      }
    }
    await prisma.mailbox.update({
      where: { id: mailbox.id },
      data: { status: MailboxStatus.DELETED, deletedAt: new Date() },
    });
    await prisma.mailboxEvent.create({ data: { mailboxId: mailbox.id, type: 'deleted' } });
    await AuditService.log({
      actorId: subject.kind === 'user' ? subject.userId : null,
      actorType: subject.kind === 'user' ? 'user' : 'system',
      action: 'mailbox.delete',
      targetType: 'mailbox',
      targetId: mailbox.id,
      metadata: subject.kind === 'guest' ? { guestGid: subject.publicId } : undefined,
      requestId: meta?.requestId,
    });
    return { publicId: mailbox.publicId };
  },

  /** Extend mailbox TTL — subject-aware. */
  async extendTTLBySubject(mailboxPublicId: string, hours: number, subject: Subject) {
    const mailbox = await this._findOwned(mailboxPublicId, subject);
    const { externalId } = (mailbox.metadata as any) || {};
    if (externalId) {
      try {
        const renewed = await TempMailService.renewMailbox(externalId, hours);
        const newExpiry = renewed.expiresAt
          ? new Date(renewed.expiresAt)
          : new Date((mailbox.expiresAt ?? new Date()).getTime() + hours * 60 * 60 * 1000);
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
        if (err?.code === 'NOT_FOUND') {
          await prisma.mailbox.update({
            where: { id: mailbox.id },
            data: { status: MailboxStatus.EXPIRED, deletedAt: new Date() },
          });
          throw new NotFoundError('Mailbox no longer exists on mail server');
        }
        throw err;
      }
    }
    const newExpiry = new Date((mailbox.expiresAt ?? new Date()).getTime() + hours * 60 * 60 * 1000);
    await prisma.mailbox.update({ where: { id: mailbox.id }, data: { expiresAt: newExpiry } });
    return { expiresAt: newExpiry };
  },
};
