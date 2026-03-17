import { prisma } from '../db';
import { LRUCache } from 'lru-cache';
import type { PermissionKey } from './permissions';
import { ADMIN_ROLES } from './permissions';
import { logger } from '../lib/logger';

/**
 * RBAC — Role-Based Access Control
 *
 * 2-layer caching strategy for 10K+ concurrent users:
 *   L1: LRU in-memory (0.001ms) — bounded, per-process
 *   L2: Redis (0.5-2ms)         — shared across processes
 *   L3: Database (5-50ms)       — source of truth
 *
 * Cache invalidation:
 *   - TTL-based: L1 = 60s, L2 = 300s
 *   - On-demand: call invalidateRbacCache(userId) on role changes
 */

const REDIS_TTL_SECONDS = 300; // 5 minutes

// L1: In-memory LRU cache
const permissionCache = new LRUCache<string, string[]>({
  max: 5000,     // support 5K unique users in cache
  ttl: 60_000,   // 60 seconds
});

const roleCache = new LRUCache<string, string[]>({
  max: 5000,
  ttl: 60_000,
});

/**
 * Resolves effective permissions for a user by aggregating all role-permission mappings.
 * Uses 2-layer cache: LRU → Redis → DB
 */
export async function resolveUserPermissions(userId: string): Promise<string[]> {
  // L1: Check LRU
  const l1 = permissionCache.get(userId);
  if (l1) return l1;

  // L2: Check Redis
  try {
    const { getRedis } = await import('../lib/redis');
    const redis = getRedis();
    const cached = await redis.get(`rbac:perms:${userId}`);
    if (cached) {
      const perms = JSON.parse(cached) as string[];
      permissionCache.set(userId, perms); // warm L1
      return perms;
    }
  } catch {
    // Redis down — fallback to DB
  }

  // L3: Database
  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  const permissions = new Set<string>();
  for (const ur of userRoles) {
    for (const rp of ur.role.rolePermissions) {
      permissions.add(rp.permission.key);
    }
  }

  const result = Array.from(permissions);

  // Write back to L1 + L2
  permissionCache.set(userId, result);
  try {
    const { getRedis } = await import('../lib/redis');
    const redis = getRedis();
    await redis.setex(`rbac:perms:${userId}`, REDIS_TTL_SECONDS, JSON.stringify(result));
  } catch {
    // Redis down — L1 cache still works
  }

  return result;
}

/** Resolve role slugs for a user (2-layer cached) */
export async function resolveUserRoles(userId: string): Promise<string[]> {
  // L1: Check LRU
  const l1 = roleCache.get(userId);
  if (l1) return l1;

  // L2: Check Redis
  try {
    const { getRedis } = await import('../lib/redis');
    const redis = getRedis();
    const cached = await redis.get(`rbac:roles:${userId}`);
    if (cached) {
      const roles = JSON.parse(cached) as string[];
      roleCache.set(userId, roles); // warm L1
      return roles;
    }
  } catch {
    // Redis down — fallback to DB
  }

  // L3: Database
  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { role: true },
  });

  const result = userRoles.map((ur) => ur.role.name);

  // Write back to L1 + L2
  roleCache.set(userId, result);
  try {
    const { getRedis } = await import('../lib/redis');
    const redis = getRedis();
    await redis.setex(`rbac:roles:${userId}`, REDIS_TTL_SECONDS, JSON.stringify(result));
  } catch {
    // Redis down — L1 cache still works
  }

  return result;
}

/**
 * Invalidate RBAC cache for a user.
 * Call this when user roles/permissions change (admin actions).
 */
export async function invalidateRbacCache(userId: string): Promise<void> {
  // Clear L1
  permissionCache.delete(userId);
  roleCache.delete(userId);

  // Clear L2
  try {
    const { getRedis } = await import('../lib/redis');
    const redis = getRedis();
    await redis.del(`rbac:perms:${userId}`, `rbac:roles:${userId}`);
  } catch {
    logger.warn('Failed to invalidate RBAC Redis cache', { userId });
  }
}

/** Check if user has a specific permission */
export function hasPermission(
  userPermissions: string[],
  required: PermissionKey
): boolean {
  return userPermissions.includes(required);
}

/** Check if user has ALL specified permissions */
export function hasAllPermissions(
  userPermissions: string[],
  required: PermissionKey[]
): boolean {
  return required.every((p) => userPermissions.includes(p));
}

/** Check if user has ANY of the specified permissions */
export function hasAnyPermission(
  userPermissions: string[],
  required: PermissionKey[]
): boolean {
  return required.some((p) => userPermissions.includes(p));
}

/** Check if user holds an admin-level role */
export function isAdmin(userRoles: string[]): boolean {
  return userRoles.some((role) => ADMIN_ROLES.includes(role));
}
