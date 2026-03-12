/**
 * Quota Service — Config-Driven Limits Enforcement
 *
 * Evaluates plan limits and usage quotas at runtime.
 * Fetches limits from PlanFeature table and checks current usage.
 * Prevents quota bypass via DB-checked enforcement.
 */

import { prisma } from '../db';
import { QuotaExceededError, NotFoundError } from '../lib/errors';
import { cacheGetOrSet } from '../lib/cache';
import { logger } from '../lib/logger';

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
   */
  async getPlanLimit(userId: string, featureKey: string): Promise<number> {
    return cacheGetOrSet(
      `quota:limit:${userId}:${featureKey}`,
      async () => {
        // Find user's active subscription
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

        if (!subscription?.plan?.features?.[0]) {
          // Default free-tier limits
          const defaults: Record<string, number> = {
            'mailbox.max': 3,
            'mailbox.retention_hours': 24,
            'domain.max': 0,
            'message.max_per_day': 50,
            'alias.max': 1,
          };
          return defaults[featureKey] ?? 0;
        }

        return Number(subscription.plan.features[0].value) || 0;
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
    const result = await this.checkQuota(userId, 'mailbox.max', async () => {
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
   */
  async enforceDomainQuota(userId: string): Promise<void> {
    const result = await this.checkQuota(userId, 'domain.max', async () => {
      return prisma.domain.count({
        where: {
          userId,
          status: { notIn: ['ARCHIVED'] },
          deletedAt: null,
        },
      });
    });

    if (!result.allowed) {
      throw new QuotaExceededError(
        `domain (${result.current}/${result.limit})`
      );
    }
  },

  /**
   * Get full quota summary for a user (dashboard display).
   */
  async getQuotaSummary(userId: string) {
    const [mailboxLimit, domainLimit] = await Promise.all([
      this.getPlanLimit(userId, 'mailbox.max'),
      this.getPlanLimit(userId, 'domain.max'),
    ]);

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
      domain: { current: domainCount, limit: domainLimit },
    };
  },
};
