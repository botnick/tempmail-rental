/**
 * Domain DNS Re-verification Cron
 *
 * Two responsibilities:
 *
 * 1. DNS Re-check: Periodically re-checks DNS ownership for VERIFIED/ACTIVE domains.
 *    If the ownership TXT record is gone, the domain is downgraded to PENDING.
 *
 * 2. Subscription Enforcement: Suspends custom domains when subscriptions expire.
 *    When re-subscribed, SUSPENDED domains auto-restore to VERIFIED (not deleted).
 *    This way users never lose their DNS config — they just can't receive emails.
 *
 * Design:
 * - Settings read from DB (ConfigEntry) with env fallback — admin-configurable
 * - Runs in small batches to minimize server load
 * - Uses resilient dns.utils — circuit breaker, timeout, no crashes
 * - Logs changes via AuditService for traceability
 * - Completely non-blocking — errors are caught and logged, never thrown
 *
 * @module cron/domain-recheck
 */

import { prisma } from '../db';
import { DomainStatus } from '@prisma/client';
import { verifyOwnership } from '../lib/dns.utils';
import { AuditService } from '../services/audit.service';
import { ConfigService } from '../services/config.service';

// ─── Config Keys ────────────────────────────────────────────────────

export const DOMAIN_CRON_KEYS = {
  ENABLED: 'domain_cron_enabled',
  BATCH_SIZE: 'domain_cron_batch_size',
  RECHECK_INTERVAL_HOURS: 'domain_cron_recheck_interval_hours',
  FAILURE_THRESHOLD: 'domain_cron_failure_threshold',
  CRON_INTERVAL_MINUTES: 'domain_cron_interval_minutes',
} as const;

/** Default values (used as fallback if not in DB) */
export const DOMAIN_CRON_DEFAULTS = {
  [DOMAIN_CRON_KEYS.ENABLED]: true,
  [DOMAIN_CRON_KEYS.BATCH_SIZE]: 5,
  [DOMAIN_CRON_KEYS.RECHECK_INTERVAL_HOURS]: 24,
  [DOMAIN_CRON_KEYS.FAILURE_THRESHOLD]: 2,
  [DOMAIN_CRON_KEYS.CRON_INTERVAL_MINUTES]: 360, // 6 hours
} as const;

const CUSTOM_DOMAIN_FEATURE_KEY = 'custom_domain_access';

// ─── Config Reader ─────────────────────────────────────────────────

/** Read all cron settings (DB first → env fallback → hardcoded default) */
async function getCronConfig() {
  const [enabled, batchSize, recheckHours, failureThreshold, intervalMinutes] = await Promise.all([
    ConfigService.getBoolean(DOMAIN_CRON_KEYS.ENABLED, DOMAIN_CRON_DEFAULTS[DOMAIN_CRON_KEYS.ENABLED]),
    ConfigService.getNumber(DOMAIN_CRON_KEYS.BATCH_SIZE, DOMAIN_CRON_DEFAULTS[DOMAIN_CRON_KEYS.BATCH_SIZE]),
    ConfigService.getNumber(DOMAIN_CRON_KEYS.RECHECK_INTERVAL_HOURS, DOMAIN_CRON_DEFAULTS[DOMAIN_CRON_KEYS.RECHECK_INTERVAL_HOURS]),
    ConfigService.getNumber(DOMAIN_CRON_KEYS.FAILURE_THRESHOLD, DOMAIN_CRON_DEFAULTS[DOMAIN_CRON_KEYS.FAILURE_THRESHOLD]),
    ConfigService.getNumber(DOMAIN_CRON_KEYS.CRON_INTERVAL_MINUTES, DOMAIN_CRON_DEFAULTS[DOMAIN_CRON_KEYS.CRON_INTERVAL_MINUTES]),
  ]);

  return { enabled, batchSize, recheckHours, failureThreshold, intervalMinutes };
}

// ─── 1) DNS Re-check ───────────────────────────────────────────────

export async function recheckDomainDns(): Promise<{
  checked: number;
  downgraded: string[];
  errors: string[];
}> {
  const result = { checked: 0, downgraded: [] as string[], errors: [] as string[] };
  const config = await getCronConfig();

  if (!config.enabled) return result;

  try {
    const staleThreshold = new Date(Date.now() - config.recheckHours * 60 * 60 * 1000);

    const domains = await prisma.domain.findMany({
      where: {
        status: { in: [DomainStatus.VERIFIED, DomainStatus.ACTIVE] },
        isSystem: false,
        deletedAt: null,
        updatedAt: { lt: staleThreshold }, // L2 fix: only fetch domains due for re-check
      },
      include: {
        verifications: {
          where: { verified: true },
          orderBy: { verifiedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'asc' },
      take: config.batchSize,
    });

    for (const domain of domains) {
      result.checked++;

      const verification = domain.verifications[0];
      if (!verification) continue;

      const metadata = (domain.metadata as Record<string, any>) || {};
      const lastRecheck = metadata.lastDnsRecheck ? new Date(metadata.lastDnsRecheck) : null;

      if (lastRecheck && lastRecheck > staleThreshold) continue;

      try {
        const ownershipResult = await verifyOwnership(domain.name, verification.recordValue);
        const failureCount = ownershipResult.verified ? 0 : (metadata.dnsRecheckFailures || 0) + 1;

        await prisma.domain.update({
          where: { id: domain.id },
          data: {
            metadata: {
              ...metadata,
              lastDnsRecheck: new Date().toISOString(),
              dnsRecheckFailures: failureCount,
            },
          },
        });

        if (!ownershipResult.verified && failureCount >= config.failureThreshold) {
          await prisma.domain.update({
            where: { id: domain.id },
            data: { status: DomainStatus.PENDING },
          });

          await AuditService.log({
            actorId: 'system',
            actorType: 'system',
            action: 'domain.auto_revoke',
            targetType: 'domain',
            targetId: domain.id,
            after: {
              previousStatus: domain.status,
              newStatus: 'PENDING',
              reason: 'DNS ownership TXT record no longer found',
              failureCount,
            },
          });

          result.downgraded.push(domain.name);
        }
      } catch (err: any) {
        result.errors.push(`${domain.name}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Batch error: ${err.message}`);
  }

  return result;
}

// ─── 2) Subscription-based Suspension ──────────────────────────────

export async function suspendExpiredSubscriptionDomains(): Promise<{
  suspended: string[];
  errors: string[];
}> {
  const result = { suspended: [] as string[], errors: [] as string[] };

  try {
    const domainsToCheck = await prisma.domain.findMany({
      where: {
        status: { in: [DomainStatus.VERIFIED, DomainStatus.ACTIVE] },
        isSystem: false,
        deletedAt: null,
        userId: { not: null },
      },
      include: {
        user: {
          include: {
            subscriptions: {
              where: { status: { in: ['ACTIVE', 'TRIALING'] } },
              include: {
                plan: {
                  include: {
                    features: { where: { featureKey: CUSTOM_DOMAIN_FEATURE_KEY } },
                  },
                },
              },
              take: 1,
            },
          },
        },
      },
    });

    for (const domain of domainsToCheck) {
      try {
        const activeSub = domain.user?.subscriptions?.[0];
        const hasCustomDomainAccess = activeSub?.plan?.features?.some(
          (f) => f.featureKey === CUSTOM_DOMAIN_FEATURE_KEY && f.value !== '0' && f.value !== 'false',
        );

        if (!hasCustomDomainAccess) {
          const metadata = (domain.metadata as Record<string, any>) || {};

          await prisma.domain.update({
            where: { id: domain.id },
            data: {
              status: DomainStatus.SUSPENDED,
              metadata: {
                ...metadata,
                previousStatus: domain.status,
                suspendedAt: new Date().toISOString(),
                suspendReason: 'subscription_expired',
              },
            },
          });

          await AuditService.log({
            actorId: 'system',
            actorType: 'system',
            action: 'domain.suspend',
            targetType: 'domain',
            targetId: domain.id,
            after: {
              previousStatus: domain.status,
              newStatus: 'SUSPENDED',
              reason: 'Subscription no longer includes custom domain access',
            },
          });

          result.suspended.push(domain.name);
        }
      } catch (err: any) {
        result.errors.push(`${domain.name}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Suspension batch error: ${err.message}`);
  }

  return result;
}

export async function reactivateSubscribedDomains(): Promise<{
  reactivated: string[];
  errors: string[];
}> {
  const result = { reactivated: [] as string[], errors: [] as string[] };

  try {
    const suspendedDomains = await prisma.domain.findMany({
      where: {
        status: DomainStatus.SUSPENDED,
        isSystem: false,
        deletedAt: null,
        userId: { not: null },
      },
      include: {
        user: {
          include: {
            subscriptions: {
              where: { status: { in: ['ACTIVE', 'TRIALING'] } },
              include: {
                plan: {
                  include: {
                    features: { where: { featureKey: CUSTOM_DOMAIN_FEATURE_KEY } },
                  },
                },
              },
              take: 1,
            },
          },
        },
      },
    });

    for (const domain of suspendedDomains) {
      try {
        const activeSub = domain.user?.subscriptions?.[0];
        const hasCustomDomainAccess = activeSub?.plan?.features?.some(
          (f) => f.featureKey === CUSTOM_DOMAIN_FEATURE_KEY && f.value !== '0' && f.value !== 'false',
        );

        if (hasCustomDomainAccess) {
          const metadata = (domain.metadata as Record<string, any>) || {};
          const restoreStatus = metadata.previousStatus === 'ACTIVE'
            ? DomainStatus.ACTIVE
            : DomainStatus.VERIFIED;

          await prisma.domain.update({
            where: { id: domain.id },
            data: {
              status: restoreStatus,
              metadata: {
                ...metadata,
                previousStatus: undefined,
                suspendedAt: undefined,
                suspendReason: undefined,
                reactivatedAt: new Date().toISOString(),
              },
            },
          });

          await AuditService.log({
            actorId: 'system',
            actorType: 'system',
            action: 'domain.reactivate',
            targetType: 'domain',
            targetId: domain.id,
            after: {
              previousStatus: 'SUSPENDED',
              newStatus: restoreStatus,
              reason: 'Subscription now includes custom domain access',
            },
          });

          result.reactivated.push(domain.name);
        }
      } catch (err: any) {
        result.errors.push(`${domain.name}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Reactivation batch error: ${err.message}`);
  }

  return result;
}

/** Get current cron config for admin display */
export { getCronConfig };
