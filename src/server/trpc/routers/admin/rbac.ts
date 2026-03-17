import { z } from 'zod';
import { router, permissionProcedure } from '../../trpc';
import { PERMISSIONS } from '../../../policy';
import { AuditService } from '../../../services/audit.service';
import { invalidateRbacCache } from '../../../policy/rbac';
import { NotFoundError } from '../../../lib/errors';

/**
 * Admin RBAC Router — manage roles, permissions, and user role assignments.
 * All data is read dynamically from the database — no hardcoded lists.
 */
export const adminRbacRouter = router({
  /**
   * List all roles with permission count and user count.
   */
  listRoles: permissionProcedure(PERMISSIONS.ADMIN_RBAC_VIEW)
    .query(async ({ ctx }) => {
      const roles = await ctx.prisma.role.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              rolePermissions: true,
              userRoles: true,
            },
          },
        },
      });

      return roles.map((r) => ({
        id: r.id,
        name: r.name,
        displayName: r.displayName,
        description: r.description,
        isSystem: r.isSystem,
        permissionCount: r._count.rolePermissions,
        userCount: r._count.userRoles,
        createdAt: r.createdAt,
      }));
    }),

  /**
   * Get role detail with all mapped permissions.
   */
  getRoleDetail: permissionProcedure(PERMISSIONS.ADMIN_RBAC_VIEW)
    .input(z.object({ roleId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const role = await ctx.prisma.role.findUnique({
        where: { id: input.roleId },
        include: {
          rolePermissions: {
            include: {
              permission: {
                select: { id: true, key: true, displayName: true, module: true },
              },
            },
          },
        },
      });

      if (!role) throw new NotFoundError('Role not found');

      return {
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        isSystem: role.isSystem,
        permissions: role.rolePermissions.map((rp) => ({
          id: rp.permission.id,
          key: rp.permission.key,
          displayName: rp.permission.displayName,
          module: rp.permission.module,
        })),
      };
    }),

  /**
   * List all permissions grouped by module (fetched from DB).
   */
  listPermissions: permissionProcedure(PERMISSIONS.ADMIN_RBAC_VIEW)
    .query(async ({ ctx }) => {
      const permissions = await ctx.prisma.permission.findMany({
        orderBy: [{ module: 'asc' }, { key: 'asc' }],
      });

      // Group by module dynamically
      const grouped: Record<string, typeof permissions> = {};
      for (const p of permissions) {
        const mod = p.module ?? 'other';
        if (!grouped[mod]) grouped[mod] = [];
        grouped[mod].push(p);
      }

      return { permissions, grouped };
    }),

  /**
   * List users with their role assignments (paginated, searchable).
   */
  listUserRoles: permissionProcedure(PERMISSIONS.ADMIN_RBAC_VIEW)
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      roleFilter: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where = {
        deletedAt: null,
        ...(input.search
          ? {
              OR: [
                { email: { contains: input.search, mode: 'insensitive' as const } },
                { displayName: { contains: input.search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
        ...(input.roleFilter
          ? { userRoles: { some: { role: { name: input.roleFilter } } } }
          : {}),
      };

      const [users, total] = await Promise.all([
        ctx.prisma.user.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            publicId: true,
            email: true,
            displayName: true,
            status: true,
            userRoles: {
              include: {
                role: { select: { id: true, name: true, displayName: true } },
              },
            },
          },
        }),
        ctx.prisma.user.count({ where }),
      ]);

      return {
        users: users.map((u) => ({
          id: u.id,
          publicId: u.publicId,
          email: u.email,
          displayName: u.displayName,
          status: u.status,
          roles: u.userRoles.map((ur) => ({
            userRoleId: ur.id,
            roleId: ur.role.id,
            roleName: ur.role.name,
            roleDisplayName: ur.role.displayName,
            grantedAt: ur.grantedAt,
            expiresAt: ur.expiresAt,
          })),
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  /**
   * Assign a role to a user.
   */
  assignRole: permissionProcedure(PERMISSIONS.ADMIN_RBAC_MANAGE)
    .input(z.object({
      userId: z.string().min(1),
      roleId: z.string().min(1),
      reason: z.string().min(1).max(500),
      expiresAt: z.string().datetime().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify user exists
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, email: true },
      });
      if (!user) throw new NotFoundError('User not found');

      // Verify role exists
      const role = await ctx.prisma.role.findUnique({
        where: { id: input.roleId },
        select: { id: true, name: true },
      });
      if (!role) throw new NotFoundError('Role not found');

      // Check if already assigned
      const existing = await ctx.prisma.userRole.findFirst({
        where: { userId: input.userId, roleId: input.roleId },
      });
      if (existing) {
        throw new Error('Role is already assigned to this user');
      }

      // Create assignment
      await ctx.prisma.userRole.create({
        data: {
          userId: input.userId,
          roleId: input.roleId,
          grantedBy: ctx.actor!.userId,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
      });

      // Invalidate RBAC cache so new permissions take effect
      await invalidateRbacCache(input.userId);

      // Audit log
      await AuditService.logAdminAction({
        adminId: ctx.actor!.userId,
        action: 'rbac.role.assign',
        targetType: 'user',
        targetId: input.userId,
        reason: input.reason,
        metadata: {
          roleId: role.id,
          roleName: role.name,
          userEmail: user.email,
        },
      });

      return { success: true };
    }),

  /**
   * Revoke a role from a user.
   */
  revokeRole: permissionProcedure(PERMISSIONS.ADMIN_RBAC_MANAGE)
    .input(z.object({
      userRoleId: z.string().min(1),
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      // Find the assignment
      const userRole = await ctx.prisma.userRole.findUnique({
        where: { id: input.userRoleId },
        include: {
          user: { select: { id: true, email: true } },
          role: { select: { id: true, name: true } },
        },
      });
      if (!userRole) throw new NotFoundError('User role assignment not found');

      // Delete assignment
      await ctx.prisma.userRole.delete({
        where: { id: input.userRoleId },
      });

      // Invalidate RBAC cache
      await invalidateRbacCache(userRole.userId);

      // Audit log
      await AuditService.logAdminAction({
        adminId: ctx.actor!.userId,
        action: 'rbac.role.revoke',
        targetType: 'user',
        targetId: userRole.userId,
        reason: input.reason,
        metadata: {
          roleId: userRole.role.id,
          roleName: userRole.role.name,
          userEmail: userRole.user.email,
        },
      });

      return { success: true };
    }),

  /**
   * Update permissions mapped to a role (bulk replace).
   * Reads available permissions from DB — never hardcoded.
   */
  updateRolePermissions: permissionProcedure(PERMISSIONS.ADMIN_RBAC_MANAGE)
    .input(z.object({
      roleId: z.string().min(1),
      permissionIds: z.array(z.string().min(1)),
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify role exists
      const role = await ctx.prisma.role.findUnique({
        where: { id: input.roleId },
        include: {
          rolePermissions: {
            include: { permission: { select: { key: true } } },
          },
        },
      });
      if (!role) throw new NotFoundError('Role not found');

      // Verify all permission IDs exist
      const validPerms = await ctx.prisma.permission.findMany({
        where: { id: { in: input.permissionIds } },
        select: { id: true, key: true },
      });
      if (validPerms.length !== input.permissionIds.length) {
        throw new Error('One or more permission IDs are invalid');
      }

      const beforeKeys = role.rolePermissions.map((rp) => rp.permission.key);
      const afterKeys = validPerms.map((p) => p.key);

      // Transaction: delete old mappings, insert new ones
      await ctx.prisma.$transaction([
        ctx.prisma.rolePermission.deleteMany({
          where: { roleId: input.roleId },
        }),
        ...(input.permissionIds.length > 0
          ? [
              ctx.prisma.rolePermission.createMany({
                data: input.permissionIds.map((permId) => ({
                  roleId: input.roleId,
                  permissionId: permId,
                })),
              }),
            ]
          : []),
      ]);

      // Invalidate RBAC cache for ALL users with this role
      const affectedUsers = await ctx.prisma.userRole.findMany({
        where: { roleId: input.roleId },
        select: { userId: true },
      });
      await Promise.all(
        affectedUsers.map((ur) => invalidateRbacCache(ur.userId))
      );

      // Audit log
      await AuditService.logAdminAction({
        adminId: ctx.actor!.userId,
        action: 'rbac.role.update_permissions',
        targetType: 'role',
        targetId: input.roleId,
        reason: input.reason,
        metadata: {
          roleName: role.name,
          before: beforeKeys,
          after: afterKeys,
          added: afterKeys.filter((k) => !beforeKeys.includes(k)),
          removed: beforeKeys.filter((k) => !afterKeys.includes(k)),
        },
      });

      return { success: true };
    }),

  /**
   * Create a new custom role.
   */
  createRole: permissionProcedure(PERMISSIONS.ADMIN_RBAC_MANAGE)
    .input(z.object({
      name: z.string().min(2).max(50).regex(/^[A-Z][A-Z0-9_]*$/, 'Name must be UPPER_SNAKE_CASE'),
      displayName: z.string().min(2).max(100),
      description: z.string().max(500).optional(),
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check uniqueness
      const existing = await ctx.prisma.role.findUnique({ where: { name: input.name } });
      if (existing) throw new Error('Role name already exists');

      const role = await ctx.prisma.role.create({
        data: {
          name: input.name,
          displayName: input.displayName,
          description: input.description ?? null,
          isSystem: false,
        },
      });

      await AuditService.logAdminAction({
        adminId: ctx.actor!.userId,
        action: 'rbac.role.create',
        targetType: 'role',
        targetId: role.id,
        reason: input.reason,
        metadata: { roleName: role.name, displayName: role.displayName },
      });

      return { success: true, roleId: role.id };
    }),

  /**
   * Update an existing role (displayName, description).
   */
  updateRole: permissionProcedure(PERMISSIONS.ADMIN_RBAC_MANAGE)
    .input(z.object({
      roleId: z.string().min(1),
      displayName: z.string().min(2).max(100),
      description: z.string().max(500).optional(),
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      const role = await ctx.prisma.role.findUnique({ where: { id: input.roleId } });
      if (!role) throw new NotFoundError('Role not found');

      const before = { displayName: role.displayName, description: role.description };

      await ctx.prisma.role.update({
        where: { id: input.roleId },
        data: {
          displayName: input.displayName,
          description: input.description ?? null,
        },
      });

      await AuditService.logAdminAction({
        adminId: ctx.actor!.userId,
        action: 'rbac.role.update',
        targetType: 'role',
        targetId: input.roleId,
        reason: input.reason,
        metadata: {
          roleName: role.name,
          before,
          after: { displayName: input.displayName, description: input.description },
        },
      });

      return { success: true };
    }),

  /**
   * Delete a custom role. System roles cannot be deleted.
   */
  deleteRole: permissionProcedure(PERMISSIONS.ADMIN_RBAC_MANAGE)
    .input(z.object({
      roleId: z.string().min(1),
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      const role = await ctx.prisma.role.findUnique({
        where: { id: input.roleId },
        include: { _count: { select: { userRoles: true } } },
      });
      if (!role) throw new NotFoundError('Role not found');
      if (role.isSystem) throw new Error('Cannot delete system role');
      if (role._count.userRoles > 0) {
        throw new Error(`Cannot delete role — ${role._count.userRoles} user(s) still assigned. Revoke all assignments first.`);
      }

      // Delete permissions mapping, then role
      await ctx.prisma.$transaction([
        ctx.prisma.rolePermission.deleteMany({ where: { roleId: input.roleId } }),
        ctx.prisma.role.delete({ where: { id: input.roleId } }),
      ]);

      await AuditService.logAdminAction({
        adminId: ctx.actor!.userId,
        action: 'rbac.role.delete',
        targetType: 'role',
        targetId: input.roleId,
        reason: input.reason,
        metadata: { roleName: role.name, displayName: role.displayName },
      });

      return { success: true };
    }),

  /**
   * Sync all code-defined permissions into the database.
   *
   * Reads PERMISSIONS and ROLE_PERMISSIONS from seed data,
   * upserts each permission, then ensures role→permission assignments
   * match the code definitions. Existing custom permissions & assignments
   * are NOT removed — this is additive only.
   */
  syncPermissions: permissionProcedure(PERMISSIONS.ADMIN_RBAC_MANAGE)
    .mutation(async ({ ctx }) => {
      const seedData = await import('../../../../../prisma/seed/data') as {
        PERMISSIONS: Array<{ key: string; displayName: string; module: string }>;
        ROLE_PERMISSIONS: Record<string, string[]>;
      };
      const permDefs = seedData.PERMISSIONS;
      const rolePerms = seedData.ROLE_PERMISSIONS;

      let created = 0;
      let updated = 0;
      let assigned = 0;

      // 1. Upsert all permission definitions
      const permMap = new Map<string, string>(); // key → id
      for (const def of permDefs) {
        // Check if permission already exists before upserting
        const existing = await ctx.prisma.permission.findUnique({ where: { key: def.key } });
        const perm = await ctx.prisma.permission.upsert({
          where: { key: def.key },
          create: {
            key: def.key,
            displayName: def.displayName,
            module: def.module,
          },
          update: {
            displayName: def.displayName,
            module: def.module,
          },
        });
        permMap.set(def.key, perm.id);
        if (existing) {
          updated++;
        } else {
          created++;
        }
      }

      // 2. Ensure role→permission assignments
      for (const [roleName, keys] of Object.entries(rolePerms)) {
        if (roleName === 'SYSTEM_ADMIN') continue; // wildcard role, skip

        const role = await ctx.prisma.role.findUnique({ where: { name: roleName } });
        if (!role) continue;

        for (const key of keys) {
          const permId = permMap.get(key);
          if (!permId) continue;

          const existingAssignment = await ctx.prisma.rolePermission.findUnique({
            where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
          });
          if (!existingAssignment) {
            await ctx.prisma.rolePermission.create({
              data: { roleId: role.id, permissionId: permId },
            });
            assigned++;
          }
        }
      }

      // 3. Invalidate RBAC cache for all users with affected roles
      const allUserRoles = await ctx.prisma.userRole.findMany({
        select: { userId: true },
        distinct: ['userId'],
      });
      await Promise.all(
        allUserRoles.map((ur) => invalidateRbacCache(ur.userId))
      );

      // 4. Audit log
      await AuditService.logAdminAction({
        adminId: ctx.actor!.userId,
        action: 'rbac.permissions.sync',
        targetType: 'system',
        targetId: 'permissions',
        reason: 'Admin triggered permission sync from code definitions',
        metadata: { created, updated, assigned, totalDefinitions: permDefs.length },
      });

      return { success: true, created, updated, assigned };
    }),
});
