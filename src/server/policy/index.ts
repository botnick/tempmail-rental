import type { PermissionKey } from './permissions';
import { hasPermission, hasAllPermissions, hasAnyPermission } from './rbac';
import { AuthorizationError } from '../lib/errors';
import type { Actor } from '../lib/types';

/**
 * Policy engine — evaluates authorization rules.
 * All permission checks in the system go through this layer.
 */
export const Policy = {
  /** Require a single permission */
  require(actor: Actor, permission: PermissionKey): void {
    if (!hasPermission(actor.permissions, permission)) {
      throw new AuthorizationError(
        `Permission '${permission}' required`
      );
    }
  },

  /** Require ALL listed permissions */
  requireAll(actor: Actor, permissions: PermissionKey[]): void {
    if (!hasAllPermissions(actor.permissions, permissions)) {
      throw new AuthorizationError(
        `All permissions required: ${permissions.join(', ')}`
      );
    }
  },

  /** Require ANY of the listed permissions */
  requireAny(actor: Actor, permissions: PermissionKey[]): void {
    if (!hasAnyPermission(actor.permissions, permissions)) {
      throw new AuthorizationError(
        `One of these permissions required: ${permissions.join(', ')}`
      );
    }
  },

  /** Resource ownership check — user can only access their own resources */
  requireOwnership(actor: Actor, resourceUserId: string): void {
    if (actor.userId !== resourceUserId) {
      throw new AuthorizationError('Access denied: resource ownership required');
    }
  },

  /** Ownership OR admin permission */
  requireOwnershipOrPermission(
    actor: Actor,
    resourceUserId: string,
    adminPermission: PermissionKey
  ): void {
    if (
      actor.userId !== resourceUserId &&
      !hasPermission(actor.permissions, adminPermission)
    ) {
      throw new AuthorizationError('Access denied');
    }
  },
};

export { PERMISSIONS, ROLES, ADMIN_ROLES } from './permissions';
export type { PermissionKey, RoleSlug } from './permissions';
