/**
 * Quota Service — Config-Driven Limits Enforcement
 *
 * Evaluates plan limits and usage quotas at runtime.
 * Fetches limits from PlanFeature table and checks current usage.
 * Prevents quota bypass via DB-checked enforcement.
 *
 * No hardcoded fallback values — every required feature must be seeded on the
 * relevant Plan, otherwise we throw rather than silently substitute.
 */

import { prisma } from '../db';
import { QuotaExceededError, NotFoundError } from '../lib/errors';
import { cacheGetOrSet } from '../lib/cache';

export interface QuotaCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
}

export const QuotaService = {
  /**
   * Get a plan feature value for a user.
   * Uses cache to avoid DB lookups on every request.
   *
   * Throws if the user has no active subscription OR the feature is not
   * defined on their plan. There is no default fallback — fix the seed.
   */
  async getPlanLimit(userId: string, featureKey: string): Promise<number> {
    return cacheGetOrSet(
      `quota:limit:${userId}:${featureKey}`,
      async () => {
        const subscription = await prisma.subscription.findFirst({
          where: { userId, status: 'ACTIVE' },
          include: {
            plan: {
              include: {
                features: {
                  where: { featureKey },
                },
              },
            },
          },
        });

        if (!subscription) {
          throw new Error(
            `No active subscription for user ${userId} — cannot resolve plan feature '${featureKey}'`
          );
        }
        const feature = subscription.plan?.features?.[0];
        if (!feature) {
          throw new Error(
            `Plan '${subscription.plan?.slug}' is missing PlanFeature '${featureKey}' — seed it`
          );
        }
        const numeric = Number(feature.value);
        if (Number.isNaN(numeric)) {
          throw new Error(
            `PlanFeature '${featureKey}' value is non-numeric: '${feature.value}'`
          );
        }
        return numeric;
      },
      600 // 10 min cache
    );
  },

  /**
   * Check if user has quota remaining for a resource.
   */
  async checkQuota(
    userId: string,
    featureKey: string,
    currentUsageQuery: () => Promise<number>
  ): Promise<QuotaCheckResult> {
    const limit = await this.getPlanLimit(userId, featureKey);
    
    // Unlimited
    if (limit === -1) {
      return { allowed: true, current: 0, limit: -1, remaining: Infinity };
    }

    const current = await currentUsageQuery();
    const remaining = Math.max(0, limit - current);
    const allowed = current < limit;

    return { allowed, current, limit, remaining };
  },

  /**
   * Enforce mailbox creation quota.
   * Throws QuotaExceededError if limit reached.
   */
  async enforceMailboxQuota(userId: string): Promise<void> {
    const result = await this.checkQuota(userId, 'max_mailboxes', async () => {
      return prisma.mailbox.count({
        where: {
          userId,
          status: { in: ['ACTIVE'] },
          deletedAt: null,
        },
      });
    });

    if (!result.allowed) {
      throw new QuotaExceededError(
        `mailbox (${result.current}/${result.limit})`
      );
    }
  },

  /**
   * Enforce domain creation quota.
   * Custom domains are gated by the boolean PlanFeature `custom_domain_access`.
   * If false, no custom domains may be created.
   */
  async enforceDomainQuota(userId: string): Promise<void> {
    const subscription = await prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: {
        plan: { include: { features: { where: { featureKey: 'custom_domain_access' } } } },
      },
    });
    if (!subscription) {
      throw new Error(`No active subscription for user ${userId}`);
    }
    const feature = subscription.plan?.features?.[0];
    if (!feature) {
      throw new Error(
        `Plan '${subscription.plan?.slug}' is missing PlanFeature 'custom_domain_access' — seed it`
      );
    }
    if (feature.value !== 'true') {
      throw new QuotaExceededError(
        `Custom domains are not available on the '${subscription.plan.slug}' plan`
      );
    }
    // No numeric ceiling on domain count today — gating is purely access-boolean.
    return;
  },

  /**
   * Enforce per-mailbox message rate quota (messages/min).
   * Throws QuotaExceededError if limit reached.
   * Reads `message_rate_per_min` from the mailbox owner's plan.
   */
  async enforceMessageRateQuota(mailboxId: string): Promise<void> {
    const mailbox = await prisma.mailbox.findUnique({
      where: { id: mailboxId },
      select: { id: true, userId: true },
    });
    if (!mailbox) throw new NotFoundError('Mailbox');

    const limit = await this.getPlanLimit(mailbox.userId, 'message_rate_per_min');
    const since = new Date(Date.now() - 60 * 1000);
    const recent = await prisma.mailboxMessage.count({
      where: { mailboxId: mailbox.id, receivedAt: { gte: since } },
    });
    if (recent >= limit) {
      throw new QuotaExceededError(`message rate (${recent}/${limit} per min)`);
    }
  },

  /**
   * Enforce per-user alias quota.
   * Reads `alias_count` from the user's plan.
   */
  async enforceAliasQuota(userId: string): Promise<void> {
    const limit = await this.getPlanLimit(userId, 'alias_count');
    const current = await prisma.mailboxAlias.count({
      where: { mailbox: { userId } },
    });
    if (current >= limit) {
      throw new QuotaExceededError(`aliases (${current}/${limit})`);
    }
  },

  /**
   * Enforce attachment size limit (MB) on the mailbox owner's plan.
   * Reads `max_message_size_mb` (per-message size cap covers attachments too).
   */
  async enforceAttachmentSize(mailboxId: string, sizeBytes: number): Promise<void> {
    const mailbox = await prisma.mailbox.findUnique({
      where: { id: mailboxId },
      select: { userId: true },
    });
    if (!mailbox) throw new NotFoundError('Mailbox');

    const limitMb = await this.getPlanLimit(mailbox.userId, 'max_message_size_mb');
    if (sizeBytes > limitMb * 1024 * 1024) {
      throw new QuotaExceededError(
        `attachment size (${(sizeBytes / 1024 / 1024).toFixed(1)}MB > ${limitMb}MB)`
      );
    }
  },

  /**
   * Get full quota summary for a user (dashboard display).
   */
  async getQuotaSummary(userId: string) {
    const mailboxLimit = await this.getPlanLimit(userId, 'max_mailboxes');

    const [mailboxCount, domainCount] = await Promise.all([
      prisma.mailbox.count({
        where: { userId, status: 'ACTIVE', deletedAt: null },
      }),
      prisma.domain.count({
        where: { userId, status: { notIn: ['ARCHIVED'] }, deletedAt: null },
      }),
    ]);

    return {
      mailbox: { current: mailboxCount, limit: mailboxLimit },
      domain: { current: domainCount },
    };
  },
};
