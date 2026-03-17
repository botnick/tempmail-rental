import { z } from 'zod';
import { router } from '../../trpc';
import { permissionProcedure } from '../../trpc';
import { PERMISSIONS } from '../../../policy';
import { TRPCError } from '@trpc/server';

const featureSchema = z.object({
  featureKey: z.string().min(1),
  value: z.string().min(1),
  valueType: z.enum(['number', 'boolean', 'string', 'json']).default('number'),
});

const pricingSchema = z.object({
  currency: z.string().min(1).default('THB'),
  amount: z.string().min(1),
  billingPeriod: z.enum(['monthly', 'yearly', 'one_time']),
});

const planCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(500).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'GRANDFATHERED', 'SCHEDULED']).default('ACTIVE'),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  trialDays: z.number().int().min(0).default(0),
  metadata: z.any().optional(),
  features: z.array(featureSchema).default([]),
  pricing: z.array(pricingSchema).default([]),
});

const planUpdateSchema = planCreateSchema.partial().extend({
  id: z.string().min(1),
  features: z.array(featureSchema).optional(),
  pricing: z.array(pricingSchema).optional(),
});

export const adminPlanRouter = router({
  list: permissionProcedure(PERMISSIONS.ADMIN_PLAN_VIEW)
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      status: z.enum(['ACTIVE', 'INACTIVE', 'GRANDFATHERED', 'SCHEDULED']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where = {
        deletedAt: null,
        ...(input.search ? { name: { contains: input.search, mode: 'insensitive' as const } } : {}),
        ...(input.status ? { status: input.status } : {}),
      };

      const [data, total] = await Promise.all([
        ctx.prisma.plan.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: { sortOrder: 'asc' },
          include: {
            features: true,
            pricing: true,
            _count: { select: { subscriptions: true } },
          },
        }),
        ctx.prisma.plan.count({ where }),
      ]);

      return {
        data,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  getById: permissionProcedure(PERMISSIONS.ADMIN_PLAN_VIEW)
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const plan = await ctx.prisma.plan.findUnique({
        where: { id: input.id },
        include: {
          features: true,
          pricing: true,
          _count: { select: { subscriptions: true } },
        },
      });
      if (!plan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });
      }
      return plan;
    }),

  create: permissionProcedure(PERMISSIONS.ADMIN_PLAN_MANAGE)
    .input(planCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const { features, pricing, ...planData } = input;

      // Check slug uniqueness
      const existing = await ctx.prisma.plan.findUnique({ where: { slug: planData.slug } });
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Plan slug already exists' });
      }

      // If marking as default, clear other defaults
      if (planData.isDefault) {
        await ctx.prisma.plan.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      const plan = await ctx.prisma.plan.create({
        data: {
          ...planData,
          features: {
            create: features.map((f) => ({
              featureKey: f.featureKey,
              value: f.value,
              valueType: f.valueType,
            })),
          },
          pricing: {
            create: pricing.map((p) => ({
              currency: p.currency,
              amount: p.amount,
              billingPeriod: p.billingPeriod,
            })),
          },
        },
        include: { features: true, pricing: true },
      });

      return plan;
    }),

  update: permissionProcedure(PERMISSIONS.ADMIN_PLAN_MANAGE)
    .input(planUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, features, pricing, ...planData } = input;

      const existing = await ctx.prisma.plan.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });
      }

      // Check slug uniqueness if slug changed
      if (planData.slug && planData.slug !== existing.slug) {
        const slugExists = await ctx.prisma.plan.findUnique({ where: { slug: planData.slug } });
        if (slugExists) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Plan slug already exists' });
        }
      }

      // If marking as default, clear other defaults
      if (planData.isDefault) {
        await ctx.prisma.plan.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      // Build update in transaction
      const plan = await ctx.prisma.$transaction(async (tx) => {
        // Update plan data
        await tx.plan.update({
          where: { id },
          data: planData,
        });

        // Replace features if provided
        if (features) {
          await tx.planFeature.deleteMany({ where: { planId: id } });
          if (features.length > 0) {
            await tx.planFeature.createMany({
              data: features.map((f) => ({
                planId: id,
                featureKey: f.featureKey,
                value: f.value,
                valueType: f.valueType,
              })),
            });
          }
        }

        // Replace pricing if provided
        if (pricing) {
          await tx.planPricing.deleteMany({ where: { planId: id } });
          if (pricing.length > 0) {
            await tx.planPricing.createMany({
              data: pricing.map((p) => ({
                planId: id,
                currency: p.currency,
                amount: p.amount,
                billingPeriod: p.billingPeriod,
              })),
            });
          }
        }

        return tx.plan.findUnique({
          where: { id },
          include: { features: true, pricing: true },
        });
      });

      return plan;
    }),

  toggleStatus: permissionProcedure(PERMISSIONS.ADMIN_PLAN_MANAGE)
    .input(z.object({
      id: z.string().min(1),
      status: z.enum(['ACTIVE', 'INACTIVE']),
    }))
    .mutation(async ({ input, ctx }) => {
      const plan = await ctx.prisma.plan.findUnique({ where: { id: input.id } });
      if (!plan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });
      }

      return ctx.prisma.plan.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),

  delete: permissionProcedure(PERMISSIONS.ADMIN_PLAN_MANAGE)
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const plan = await ctx.prisma.plan.findUnique({
        where: { id: input.id },
        include: { _count: { select: { subscriptions: true } } },
      });

      if (!plan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });
      }

      // Prevent deletion of plans with active subscriptions
      if (plan._count.subscriptions > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot delete plan with active subscriptions. Deactivate it instead.',
        });
      }

      // Soft delete
      return ctx.prisma.plan.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
    }),
});
