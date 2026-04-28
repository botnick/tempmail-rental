import { prisma } from '../db';
import { PlanStatus, SubscriptionStatus, TopupStatus, PaymentStatus } from '@prisma/client';
import { AuditService } from './audit.service';
import { generateIdempotencyKey } from '../lib/id';

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
        tierName: sub.plan.tierName,
        tierColor: sub.plan.tierColor,
        tierIcon: sub.plan.tierIcon,
        features: Object.fromEntries(
          sub.plan.features.map((f) => [f.featureKey, parseFeatureValue(f.value, f.valueType)])
        ),
      },
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEndsAt: sub.trialEndsAt,
    };
  },

  /**
   * Subscribe a user to a plan.
   *
   * Free plans: subscription is created/replaced as ACTIVE immediately.
   *
   * Paid plans: a PENDING Topup is created for the monthly price + a PAUSED
   * subscription. Admin marks the topup completed via admin/billing →
   * activateSubscription is called from there.
   * (No payment provider integration in this MVP.)
   */
  async subscribe(
    userId: string,
    planSlug: string,
    meta?: { ip?: string; requestId?: string; currency?: string }
  ) {
    const plan = await prisma.plan.findUnique({
      where: { slug: planSlug },
      include: {
        pricing: { where: { billingPeriod: 'monthly' } },
      },
    });
    if (!plan || plan.status !== PlanStatus.ACTIVE) {
      throw new Error(`Plan '${planSlug}' is not active`);
    }
    if (planSlug === 'guest') {
      throw new Error('Cannot subscribe to system plan');
    }

    const currency = meta?.currency ?? 'THB';
    const monthly = plan.pricing.find((p) => p.currency === currency);
    const isFree = !monthly || Number(monthly.amount) === 0;

    // End any current ACTIVE/TRIALING subscriptions first.
    await prisma.subscription.updateMany({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
      },
      data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
    });

    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

    const sub = await prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: isFree ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PAUSED,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        ...(plan.trialDays > 0 && !isFree
          ? {
              trialEndsAt: new Date(
                periodStart.getTime() + plan.trialDays * 24 * 60 * 60 * 1000
              ),
              status: SubscriptionStatus.TRIALING,
            }
          : {}),
      },
    });

    let pendingTopup = null as null | { id: string; amount: string };
    if (!isFree) {
      const idem = generateIdempotencyKey();
      const topup = await prisma.topup.create({
        data: {
          userId,
          amount: monthly.amount,
          currency: monthly.currency,
          status: TopupStatus.PENDING,
          paymentMethod: 'manual',
          idempotencyKey: idem,
          metadata: { subscriptionId: sub.id, planSlug: plan.slug } as object,
        },
      });
      await prisma.paymentTransaction.create({
        data: {
          topupId: topup.id,
          amount: monthly.amount,
          currency: monthly.currency,
          status: PaymentStatus.PENDING,
          provider: 'manual',
          idempotencyKey: `tx_${idem}`,
        },
      });
      pendingTopup = { id: topup.publicId, amount: monthly.amount.toString() };
    }

    await AuditService.log({
      actorId: userId,
      actorType: 'user',
      action: 'plan.subscribe',
      targetType: 'subscription',
      targetId: sub.id,
      after: { planSlug: plan.slug, status: sub.status },
      ipAddress: meta?.ip,
      requestId: meta?.requestId,
    });

    return {
      subscriptionId: sub.publicId,
      planSlug: plan.slug,
      status: sub.status,
      pendingTopup,
    };
  },

  /**
   * Cancel — sets status=CANCELED but lets the user keep features until
   * currentPeriodEnd. After that, a downstream cron should auto-flip them
   * to free; for now we cancel cleanly and they re-subscribe to the free plan.
   */
  async cancelSubscription(
    userId: string,
    meta?: { ip?: string; requestId?: string }
  ) {
    const sub = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
      },
    });
    if (!sub) {
      throw new Error('No active subscription to cancel');
    }
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
    });
    await AuditService.log({
      actorId: userId,
      actorType: 'user',
      action: 'plan.cancel',
      targetType: 'subscription',
      targetId: sub.id,
      ipAddress: meta?.ip,
      requestId: meta?.requestId,
    });
    return { canceled: true, accessUntil: sub.currentPeriodEnd };
  },

  /**
   * Activate a subscription that was waiting for payment.
   * Called from admin billing.markTopupCompleted via the topup's metadata.subscriptionId.
   */
  async activateSubscription(subscriptionId: string) {
    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);
    if (sub.status === SubscriptionStatus.ACTIVE) return { alreadyActive: true };
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.ACTIVE },
    });
    return { activated: true };
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
