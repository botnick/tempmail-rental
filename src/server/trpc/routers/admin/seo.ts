import { z } from 'zod';
import { router, permissionProcedure } from '../../trpc';
import { PERMISSIONS } from '../../../policy';
import { AuditService } from '../../../services/audit.service';
import { TRPCError } from '@trpc/server';
import { revalidateTag } from 'next/cache';
import type { Prisma } from '@prisma/client';

// ──────────────────────────────────────────────
// QUALITY GATE — prevents publishing without required SEO fields
// ──────────────────────────────────────────────
function validatePublishReady(page: {
  slug: string;
  title: string | null;
  metaDescription: string | null;
  locale: string;
}) {
  const errors: string[] = [];
  if (!page.slug) errors.push('Slug is required');
  if (!page.title || page.title.length < 10) errors.push('Title must be at least 10 characters');
  if (!page.metaDescription || page.metaDescription.length < 50)
    errors.push('Meta description must be at least 50 characters');
  if (page.metaDescription && page.metaDescription.length > 160)
    errors.push('Meta description should not exceed 160 characters');
  if (!page.locale) errors.push('Locale is required');
  return errors;
}

// ──────────────────────────────────────────────
// SCHEMAS
// ──────────────────────────────────────────────
const localeSchema = z.enum(['th', 'en']);

const pageCreateSchema = z.object({
  slug: z.string().min(2).max(200).regex(/^[a-z0-9-]+$/),
  locale: localeSchema,
  type: z.string().max(50).default('page'),
  title: z.string().min(10).max(200),
  metaDescription: z.string().min(50).max(160),
  canonicalUrl: z.string().url().optional(),
  indexable: z.boolean().default(true),
  schemaType: z.string().max(50).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const pageUpdateSchema = z.object({
  id: z.string(),
  slug: z.string().min(2).max(200).regex(/^[a-z0-9-]+$/).optional(),
  title: z.string().min(10).max(200).optional(),
  metaDescription: z.string().min(50).max(160).optional(),
  canonicalUrl: z.string().url().nullable().optional(),
  indexable: z.boolean().optional(),
  schemaType: z.string().max(50).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const faqCreateSchema = z.object({
  question: z.string().min(10).max(500),
  answer: z.string().min(20).max(5000),
  locale: localeSchema,
  category: z.string().max(50).optional(),
  order: z.number().int().min(0).default(0),
});

const redirectCreateSchema = z.object({
  sourcePath: z.string().min(1).max(500).regex(/^\//),
  destinationPath: z.string().min(1).max(500).regex(/^\//),
  isPermanent: z.boolean().default(true),
  description: z.string().max(200).optional(),
});

const answerCreateSchema = z.object({
  question: z.string().min(10).max(500),
  answerText: z.string().min(20).max(5000),
  answerHtml: z.string().max(10000).optional(),
  locale: localeSchema,
  intent: z.string().max(50).optional(),
});

// ──────────────────────────────────────────────
// ROUTER
// ──────────────────────────────────────────────
export const adminSeoRouter = router({

  // ─── CONTENT PAGES ──────────────────────────

  listPages: permissionProcedure(PERMISSIONS.ADMIN_SEO_PAGE_LIST)
    .input(z.object({
      locale: localeSchema.optional(),
      status: z.string().optional(),
      take: z.number().int().min(1).max(100).default(50),
      skip: z.number().int().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      const where: Prisma.ContentPageWhereInput = {};
      if (input.locale) where.locale = input.locale;
      if (input.status) where.status = input.status;

      const [items, total] = await Promise.all([
        ctx.prisma.contentPage.findMany({
          where,
          take: input.take,
          skip: input.skip,
          orderBy: { updatedAt: 'desc' },
          include: { blocks: { select: { id: true, type: true, order: true } } },
        }),
        ctx.prisma.contentPage.count({ where }),
      ]);

      return { items, total };
    }),

  createPage: permissionProcedure(PERMISSIONS.ADMIN_SEO_PAGE_CREATE)
    .input(pageCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.actor!;

      // Check unique slug+locale
      const existing = await ctx.prisma.contentPage.findUnique({
        where: { slug_locale: { slug: input.slug, locale: input.locale } },
      });
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Page with slug "${input.slug}" already exists for locale "${input.locale}"`,
        });
      }

      const page = await ctx.prisma.contentPage.create({
        data: {
          slug: input.slug,
          locale: input.locale,
          type: input.type,
          title: input.title,
          metaDescription: input.metaDescription,
          canonicalUrl: input.canonicalUrl,
          indexable: input.indexable,
          schemaType: input.schemaType,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          status: 'draft',
          authorId: actor.userId,
        },
      });

      await AuditService.logAdminAction({
        adminId: actor.userId,
        action: 'admin.seo.page.create',
        targetType: 'content_page',
        targetId: page.id,
        reason: `Created page: ${input.slug} (${input.locale})`,
        requestId: ctx.requestId,
      });

      return page;
    }),

  updatePage: permissionProcedure(PERMISSIONS.ADMIN_SEO_PAGE_EDIT)
    .input(pageUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.actor!;
      const { id, ...data } = input;

      const before = await ctx.prisma.contentPage.findUnique({ where: { id } });
      if (!before) throw new TRPCError({ code: 'NOT_FOUND', message: 'Page not found' });

      const page = await ctx.prisma.contentPage.update({
        where: { id },
        data: {
          ...data,
          metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : undefined,
        },
      });

      await AuditService.logAdminAction({
        adminId: actor.userId,
        action: 'admin.seo.page.update',
        targetType: 'content_page',
        targetId: page.id,
        reason: `Updated page: ${page.slug} (${page.locale})`,
        metadata: { before: { title: before.title, status: before.status } },
        requestId: ctx.requestId,
      });

      return page;
    }),

  publishPage: permissionProcedure(PERMISSIONS.ADMIN_SEO_PAGE_PUBLISH)
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.actor!;

      const page = await ctx.prisma.contentPage.findUnique({ where: { id: input.id } });
      if (!page) throw new TRPCError({ code: 'NOT_FOUND', message: 'Page not found' });

      // ─── QUALITY GATE ───
      const errors = validatePublishReady(page);
      if (errors.length > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Cannot publish: ${errors.join('; ')}`,
        });
      }

      // Create version snapshot before publishing
      const versionCount = await ctx.prisma.contentPageVersion.count({
        where: { pageId: page.id },
      });

      await ctx.prisma.contentPageVersion.create({
        data: {
          pageId: page.id,
          versionNumber: versionCount + 1,
          title: page.title,
          content: {},
          metadata: page.metadata ?? undefined,
          createdBy: actor.userId,
        },
      });

      const updated = await ctx.prisma.contentPage.update({
        where: { id: input.id },
        data: {
          status: 'published',
          publishedAt: new Date(),
          lastReviewedAt: new Date(),
        },
      });

      await AuditService.logAdminAction({
        adminId: actor.userId,
        action: 'admin.seo.page.publish',
        targetType: 'content_page',
        targetId: page.id,
        reason: `Published page: ${page.slug} (${page.locale})`,
        requestId: ctx.requestId,
      });

      revalidateTag('cms-content', 'max');
      return updated;
    }),

  archivePage: permissionProcedure(PERMISSIONS.ADMIN_SEO_PAGE_EDIT)
    .input(z.object({ id: z.string(), reason: z.string().min(5) }))
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.actor!;

      const page = await ctx.prisma.contentPage.update({
        where: { id: input.id },
        data: { status: 'archived' },
      });

      await AuditService.logAdminAction({
        adminId: actor.userId,
        action: 'admin.seo.page.archive',
        targetType: 'content_page',
        targetId: page.id,
        reason: input.reason,
        requestId: ctx.requestId,
      });

      revalidateTag('cms-content', 'max');
      return page;
    }),

  // ─── FAQ ITEMS ──────────────────────────────

  listFaq: permissionProcedure(PERMISSIONS.ADMIN_SEO_FAQ_MANAGE)
    .input(z.object({
      locale: localeSchema.optional(),
      category: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where: Prisma.FaqItemWhereInput = {};
      if (input.locale) where.locale = input.locale;
      if (input.category) where.category = input.category;

      return ctx.prisma.faqItem.findMany({
        where,
        orderBy: [{ category: 'asc' }, { order: 'asc' }],
      });
    }),

  createFaq: permissionProcedure(PERMISSIONS.ADMIN_SEO_FAQ_MANAGE)
    .input(faqCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.actor!;

      const faq = await ctx.prisma.faqItem.create({ data: input });

      await AuditService.logAdminAction({
        adminId: actor.userId,
        action: 'admin.seo.faq.create',
        targetType: 'faq_item',
        targetId: faq.id,
        reason: `Created FAQ: ${input.question.substring(0, 50)}`,
        requestId: ctx.requestId,
      });

      revalidateTag('cms-content', 'max');
      return faq;
    }),

  updateFaq: permissionProcedure(PERMISSIONS.ADMIN_SEO_FAQ_MANAGE)
    .input(z.object({
      id: z.string(),
      question: z.string().min(10).max(500).optional(),
      answer: z.string().min(20).max(5000).optional(),
      category: z.string().max(50).nullable().optional(),
      order: z.number().int().min(0).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.actor!;
      const { id, ...data } = input;

      const faq = await ctx.prisma.faqItem.update({ where: { id }, data });

      await AuditService.logAdminAction({
        adminId: actor.userId,
        action: 'admin.seo.faq.update',
        targetType: 'faq_item',
        targetId: faq.id,
        reason: `Updated FAQ: ${faq.question.substring(0, 50)}`,
        requestId: ctx.requestId,
      });

      revalidateTag('cms-content', 'max');
      return faq;
    }),

  deleteFaq: permissionProcedure(PERMISSIONS.ADMIN_SEO_FAQ_MANAGE)
    .input(z.object({ id: z.string(), reason: z.string().min(5) }))
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.actor!;

      await ctx.prisma.faqItem.delete({ where: { id: input.id } });

      await AuditService.logAdminAction({
        adminId: actor.userId,
        action: 'admin.seo.faq.delete',
        targetType: 'faq_item',
        targetId: input.id,
        reason: input.reason,
        requestId: ctx.requestId,
      });

      revalidateTag('cms-content', 'max');
      return { success: true };
    }),

  // ─── REDIRECTS ──────────────────────────────

  listRedirects: permissionProcedure(PERMISSIONS.ADMIN_SEO_REDIRECT_MANAGE)
    .input(z.object({
      take: z.number().int().min(1).max(100).default(50),
    }))
    .query(async ({ input, ctx }) => {
      return ctx.prisma.redirect.findMany({
        where: { isActive: true },
        take: input.take,
        orderBy: { createdAt: 'desc' },
      });
    }),

  createRedirect: permissionProcedure(PERMISSIONS.ADMIN_SEO_REDIRECT_MANAGE)
    .input(redirectCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.actor!;

      // Check for duplicate source path
      const existing = await ctx.prisma.redirect.findUnique({
        where: { sourcePath: input.sourcePath },
      });
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Redirect for "${input.sourcePath}" already exists`,
        });
      }

      const redirect = await ctx.prisma.redirect.create({ data: input });

      await AuditService.logAdminAction({
        adminId: actor.userId,
        action: 'admin.seo.redirect.create',
        targetType: 'redirect',
        targetId: redirect.id,
        reason: `Redirect: ${input.sourcePath} → ${input.destinationPath}`,
        requestId: ctx.requestId,
      });

      return redirect;
    }),

  deleteRedirect: permissionProcedure(PERMISSIONS.ADMIN_SEO_REDIRECT_MANAGE)
    .input(z.object({ id: z.string(), reason: z.string().min(5) }))
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.actor!;

      await ctx.prisma.redirect.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      await AuditService.logAdminAction({
        adminId: actor.userId,
        action: 'admin.seo.redirect.delete',
        targetType: 'redirect',
        targetId: input.id,
        reason: input.reason,
        requestId: ctx.requestId,
      });

      return { success: true };
    }),

  updateRedirect: permissionProcedure(PERMISSIONS.ADMIN_SEO_REDIRECT_MANAGE)
    .input(z.object({
      id: z.string(),
      sourcePath: z.string().min(1).max(500).regex(/^\//).optional(),
      destinationPath: z.string().min(1).max(500).regex(/^\//).optional(),
      isPermanent: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.actor!;
      const { id, ...data } = input;

      const redirect = await ctx.prisma.redirect.update({
        where: { id },
        data,
      });

      await AuditService.logAdminAction({
        adminId: actor.userId,
        action: 'admin.seo.redirect.update',
        targetType: 'redirect',
        targetId: redirect.id,
        reason: `Updated redirect: ${redirect.sourcePath} → ${redirect.destinationPath}`,
        requestId: ctx.requestId,
      });

      revalidateTag('cms-content', 'max');
      return redirect;
    }),

  // ─── ANSWER BLOCKS ──────────────────────────

  listAnswers: permissionProcedure(PERMISSIONS.ADMIN_SEO_ANSWER_MANAGE)
    .input(z.object({
      locale: localeSchema.optional(),
      status: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where: Prisma.AnswerBlockWhereInput = {};
      if (input.locale) where.locale = input.locale;
      if (input.status) where.status = input.status;

      return ctx.prisma.answerBlock.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
      });
    }),

  createAnswer: permissionProcedure(PERMISSIONS.ADMIN_SEO_ANSWER_MANAGE)
    .input(answerCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.actor!;

      const answer = await ctx.prisma.answerBlock.create({
        data: {
          ...input,
          status: 'draft',
        },
      });

      await AuditService.logAdminAction({
        adminId: actor.userId,
        action: 'admin.seo.answer.create',
        targetType: 'answer_block',
        targetId: answer.id,
        reason: `Created answer: ${input.question.substring(0, 50)}`,
        requestId: ctx.requestId,
      });

      revalidateTag('cms-content', 'max');
      return answer;
    }),

  updateAnswer: permissionProcedure(PERMISSIONS.ADMIN_SEO_ANSWER_MANAGE)
    .input(z.object({
      id: z.string(),
      question: z.string().min(10).max(500).optional(),
      answerText: z.string().min(20).max(5000).optional(),
      answerHtml: z.string().max(10000).nullable().optional(),
      intent: z.string().max(50).nullable().optional(),
      status: z.enum(['draft', 'published']).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.actor!;
      const { id, ...data } = input;

      const updateData: Record<string, unknown> = { ...data };
      if (data.status === 'published') {
        updateData.reviewedAt = new Date();
      }

      const answer = await ctx.prisma.answerBlock.update({
        where: { id },
        data: updateData,
      });

      await AuditService.logAdminAction({
        adminId: actor.userId,
        action: 'admin.seo.answer.update',
        targetType: 'answer_block',
        targetId: answer.id,
        reason: `Updated answer: ${answer.question.substring(0, 50)}`,
        requestId: ctx.requestId,
      });

      revalidateTag('cms-content', 'max');
      return answer;
    }),

  deleteAnswer: permissionProcedure(PERMISSIONS.ADMIN_SEO_ANSWER_MANAGE)
    .input(z.object({ id: z.string(), reason: z.string().min(5) }))
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.actor!;

      await ctx.prisma.answerBlock.delete({ where: { id: input.id } });

      await AuditService.logAdminAction({
        adminId: actor.userId,
        action: 'admin.seo.answer.delete',
        targetType: 'answer_block',
        targetId: input.id,
        reason: input.reason,
        requestId: ctx.requestId,
      });

      revalidateTag('cms-content', 'max');
      return { success: true };
    }),
});
