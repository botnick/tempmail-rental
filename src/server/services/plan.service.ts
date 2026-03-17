import { prisma } from '../db';
import { PlanStatus, SubscriptionStatus } from '@prisma/client';

/**
 * Plan Service — reads plan configuration from DB.
 * All plan limits, features, pricing are config-driven.
 */
export const PlanService = {
  /** List all active plans with pricing and features */
  async listPublicPlans() {
    const plans = await prisma.plan.findMany({
      where: { status: PlanStatus.ACTIVE, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        features: true,
        pricing: true,
      },
    });

    return plans.map((p) => ({
      id: p.publicId,
      slug: p.slug,
      name: p.name,
      description: p.description,
      trialDays: p.trialDays,
      metadata: p.metadata,
      features: Object.fromEntries(
        p.features.map((f) => [f.featureKey, parseFeatureValue(f.value, f.valueType)])
      ),
      pricing: p.pricing.map((pr) => ({
        currency: pr.currency,
        amount: pr.amount.toString(),
        billingPeriod: pr.billingPeriod,
      })),
    }));
  },

  /** Get a single plan by slug */
  async getBySlug(slug: string) {
    const plan = await prisma.plan.findUnique({
      where: { slug },
      include: { features: true, pricing: true },
    });

    if (!plan) return null;

    return {
      id: plan.publicId,
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      features: Object.fromEntries(
        plan.features.map((f) => [f.featureKey, parseFeatureValue(f.value, f.valueType)])
      ),
      pricing: plan.pricing.map((pr) => ({
        currency: pr.currency,
        amount: pr.amount.toString(),
        billingPeriod: pr.billingPeriod,
      })),
    };
  },

  /** Get user's current subscription */
  async getUserSubscription(userId: string) {
    const sub = await prisma.subscription.findFirst({
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

    if (!sub) return null;

    return {
      id: sub.publicId,
      plan: {
        slug: sub.plan.slug,
        name: sub.plan.name,
        features: Object.fromEntries(
          sub.plan.features.map((f) => [f.featureKey, parseFeatureValue(f.value, f.valueType)])
        ),
      },
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEndsAt: sub.trialEndsAt,
    };
  },
};

function parseFeatureValue(value: string, valueType: string): unknown {
  switch (valueType) {
    case 'number':
      return Number(value);
    case 'boolean':
      return value === 'true';
    case 'json':
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}
