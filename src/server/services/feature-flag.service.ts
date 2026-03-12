import { prisma } from '../db';
import type { Actor } from '../lib/types';

/**
 * Feature Flag Service — runtime feature toggles.
 * Supports rollout by role, plan, specific users, and percentage.
 */
export const FeatureFlagService = {
  /** Check if a feature is enabled for a given actor */
  async isEnabled(key: string, actor?: Actor | null): Promise<boolean> {
    const flag = await prisma.featureFlag.findUnique({
      where: { key },
    });

    if (!flag) return false;
    if (!flag.enabled) return false;

    // If no targeting rules, flag is globally enabled
    if (!actor) return flag.enabled;

    // Check user-level targeting
    const targetUsers = (flag.targetUsers as string[]) ?? [];
    if (targetUsers.length > 0 && targetUsers.includes(actor.userId)) {
      return true;
    }

    // Check role-level targeting
    const targetRoles = (flag.targetRoles as string[]) ?? [];
    if (targetRoles.length > 0) {
      const hasRole = actor.roles.some((r) => targetRoles.includes(r));
      if (hasRole) return true;
    }

    // Check plan-level targeting
    const targetPlans = (flag.targetPlans as string[]) ?? [];
    if (targetPlans.length > 0 && actor.planSlug) {
      if (targetPlans.includes(actor.planSlug)) return true;
    }

    // Percentage rollout (deterministic based on user ID hash)
    if (flag.rolloutPct > 0 && flag.rolloutPct < 100) {
      const hash = simpleHash(actor.userId + key);
      return (hash % 100) < flag.rolloutPct;
    }

    // If targeting is set but actor doesn't match any criteria
    if (targetUsers.length > 0 || targetRoles.length > 0 || targetPlans.length > 0) {
      return false;
    }

    return flag.enabled;
  },

  /** Get all flags for admin management */
  async listAll() {
    return prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });
  },
};

/** Simple deterministic hash for percentage rollout */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
