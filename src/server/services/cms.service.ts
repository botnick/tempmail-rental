/**
 * CMS Service
 *
 * Provides server-side data access for CMS content pages,
 * FAQ items, and answer blocks. Used by page routes to
 * fetch CMS-driven metadata and content for SEO.
 */

import { prisma } from '@/server/db';
import type { Locale } from '@/lib/seo';

export const CmsService = {
  /**
   * Get a published content page by slug and locale.
   * Returns null if not found or not published.
   */
  async getPage(slug: string, locale: Locale) {
    return prisma.contentPage.findFirst({
      where: {
        slug,
        locale,
        status: 'published',
      },
      include: {
        blocks: { orderBy: { order: 'asc' } },
      },
    });
  },

  /**
   * Get CMS metadata for a page (used by constructMetadata).
   * Returns title, description, canonical, OG overrides.
   */
  async getPageMetadata(slug: string, locale: Locale) {
    const page = await prisma.contentPage.findFirst({
      where: { slug, locale, status: 'published' },
      select: {
        title: true,
        metaDescription: true,
        canonicalUrl: true,
        indexable: true,
        metadata: true,
        schemaType: true,
      },
    });

    if (!page) return null;

    return {
      title: page.title,
      description: page.metaDescription,
      canonicalUrl: page.canonicalUrl,
      indexable: page.indexable,
      schemaType: page.schemaType,
      ogOverrides: page.metadata as Record<string, unknown> | null,
    };
  },

  /**
   * Get active FAQ items for a locale, optionally filtered by category.
   */
  async getFaqItems(locale: Locale, category?: string) {
    return prisma.faqItem.findMany({
      where: {
        locale,
        isActive: true,
        ...(category ? { category } : {}),
      },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    });
  },

  /**
   * Get published answer blocks for a locale, optionally filtered by intent.
   */
  async getAnswerBlocks(locale: Locale, intent?: string) {
    return prisma.answerBlock.findMany({
      where: {
        locale,
        status: 'published',
        ...(intent ? { intent } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
  },

  /**
   * Look up a redirect by source path. Returns null if not found.
   */
  async getRedirect(sourcePath: string) {
    return prisma.redirect.findFirst({
      where: {
        sourcePath,
        isActive: true,
      },
    });
  },

  /**
   * Get all active redirects (for middleware pre-loading, cached).
   */
  async getAllRedirects() {
    return prisma.redirect.findMany({
      where: { isActive: true },
      select: {
        sourcePath: true,
        destinationPath: true,
        isPermanent: true,
      },
    });
  },
};
