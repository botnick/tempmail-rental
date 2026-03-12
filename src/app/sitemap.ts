import { MetadataRoute } from 'next';
import { SITE_URL, LOCALES, DEFAULT_LOCALE } from '@/lib/seo';
import { prisma } from '@/server/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static hub routes that are always present
  const staticRoutes = [
    '', 
    '/pricing', 
    '/privacy', 
    '/terms', 
    '/contact'
  ];

  const sitemapEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => {
    const alternates = LOCALES.reduce((acc, locale) => {
      acc[locale] = `${SITE_URL}/${locale}${route}`;
      return acc;
    }, {} as Record<string, string>);

    return {
      url: `${SITE_URL}/${DEFAULT_LOCALE}${route}`, // canonical default
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: route === '' ? 1 : 0.8,
      alternates: {
        languages: alternates,
      },
    };
  });

  try {
    // Dynamic routes from CMS
    const pages = await prisma.contentPage.findMany({
      where: {
        status: 'published',
        indexable: true
      },
      select: {
        slug: true,
        locale: true,
        updatedAt: true,
      }
    });

    // Group by slug to build alternate languages map
    const pagesBySlug = pages.reduce((acc: Record<string, any[]>, page: any) => {
      if (!acc[page.slug]) acc[page.slug] = [];
      acc[page.slug].push(page);
      return acc;
    }, {});

    for (const [slug, localeGroup] of Object.entries(pagesBySlug)) {
      const localePages = localeGroup as any[];
      const alternates: Record<string, string> = {};
      
      localePages.forEach((p: any) => {
        alternates[p.locale] = `${SITE_URL}/${p.locale}/${slug}`;
      });

      // Usually the default locale or the first available locale will act as the canonical url for this block
      const defaultPage = localePages.find((p: any) => p.locale === DEFAULT_LOCALE) || localePages[0];

      sitemapEntries.push({
        url: `${SITE_URL}/${defaultPage.locale}/${slug}`,
        lastModified: defaultPage.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.7,
        alternates: {
          languages: alternates
        }
      });
    }
  } catch (error) {
    console.error('Failed to fetch CMS pages for sitemap:', error);
  }

  return sitemapEntries;
}
