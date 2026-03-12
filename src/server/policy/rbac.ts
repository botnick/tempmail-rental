import { prisma } from '../db';
import type { PermissionKey } from './permissions';
import { ADMIN_ROLES } from './permissions';

/**
 * Resolves effective permissions for a user by aggregating all role-permission mappings.
 * Results should be cached in Redis per-session for performance.
 */
export async function resolveUserPermissions(userId: string): Promise<string[]> {
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

  return Array.from(permissions);
}

/** Resolve role slugs for a user */
export async function resolveUserRoles(userId: string): Promise<string[]> {
  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { role: true },
  });

  return userRoles.map((ur) => ur.role.name);
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
