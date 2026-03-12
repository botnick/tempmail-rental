/**
 * Public Content Router
 *
 * Provides read-only access to published CMS content
 * for use in public-facing pages. No auth required.
 */

import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

const localeInput = z.object({
  locale: z.enum(['th', 'en']),
});

export const contentRouter = router({
  /**
   * Get FAQ items by locale and optional category.
   * Used by FaqBlock component.
   */
  getFaqItems: publicProcedure
    .input(localeInput.extend({
      category: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      return ctx.prisma.faqItem.findMany({
        where: {
          locale: input.locale,
          isActive: true,
          ...(input.category ? { category: input.category } : {}),
        },
        orderBy: [{ category: 'asc' }, { order: 'asc' }],
        select: {
          id: true,
          question: true,
          answer: true,
          category: true,
        },
      });
    }),

  /**
   * Get published answer blocks by locale and optional intent.
   * Used by AnswerBlock component.
   */
  getAnswerBlocks: publicProcedure
    .input(localeInput.extend({
      intent: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      return ctx.prisma.answerBlock.findMany({
        where: {
          locale: input.locale,
          status: 'published',
          ...(input.intent ? { intent: input.intent } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          question: true,
          answerText: true,
          answerHtml: true,
          intent: true,
          reviewedAt: true,
        },
      });
    }),

  /**
   * Get a single published content page by slug and locale.
   * Used for CMS-managed dynamic pages.
   */
  getPage: publicProcedure
    .input(localeInput.extend({
      slug: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      return ctx.prisma.contentPage.findFirst({
        where: {
          slug: input.slug,
          locale: input.locale,
          status: 'published',
        },
        include: {
          blocks: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              type: true,
              order: true,
              content: true,
            },
          },
        },
      });
    }),
});
