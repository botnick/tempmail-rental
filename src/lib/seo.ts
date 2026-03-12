import { Metadata } from 'next';

export const LOCALES = ['th', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'th';

/**
 * SITE_URL must be set in production runtime.
 * During `next build` (NODE_ENV=production but NEXT_PHASE=phase-production-build),
 * we only warn instead of throwing to avoid breaking the build pipeline.
 */
export const SITE_URL = (() => {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url && process.env.NODE_ENV === 'production') {
    const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
    if (isBuild) {
      console.warn(
        '⚠ NEXT_PUBLIC_SITE_URL is not set during build. ' +
        'Canonical URLs will use fallback. Set this in your deployment environment.'
      );
    } else {
      console.error(
        '🚨 CRITICAL: NEXT_PUBLIC_SITE_URL is not set in production runtime. ' +
        'All canonical URLs, hreflang tags, and sitemaps will be incorrect.'
      );
    }
  }
  return url || 'http://localhost:3000';
})();

interface SeoProps {
  title?: string;
  description?: string;
  path?: string;
  locale?: Locale;
  indexable?: boolean;
  openGraph?: Metadata['openGraph'];
}

/**
 * Global utility to generate Next.js Metadata.
 * Ensures all pages have correct canonical URLs, hreflang alternates,
 * and snippet controls as per production-grade SEO specifications.
 */
export function constructMetadata({
  title = 'TempMail — Secure Temporary Email',
  description = 'Create instant, secure temporary email addresses. Protect your privacy with disposable inboxes, custom domains, and premium features.',
  path = '',
  locale = DEFAULT_LOCALE,
  indexable = true,
  openGraph,
}: SeoProps = {}): Metadata {

  // Clean path (remove leading/trailing slashes for clean canonicals)
  const cleanPath = path.replace(/^\/+|\/+$/g, '');
  const urlPath = cleanPath ? `/${cleanPath}` : '';

  // Generate Alternates (canonical + hreflang)
  const languages: Record<string, string> = {
    'x-default': `${SITE_URL}/${DEFAULT_LOCALE}${urlPath}`,
  };

  // Add all locale-specific alternations
  LOCALES.forEach((l) => {
    languages[l] = `${SITE_URL}/${l}${urlPath}`;
  });

  const alternates: Metadata['alternates'] = {
    canonical: `${SITE_URL}/${locale}${urlPath}`,
    languages,
  };

  return {
    title,
    description,
    metadataBase: new URL(SITE_URL),
    alternates,
    robots: {
      index: indexable,
      follow: indexable,
      nocache: !indexable,
      googleBot: {
        index: indexable,
        follow: indexable,
        noimageindex: !indexable,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${locale}${urlPath}`,
      siteName: 'TempMail',
      locale,
      type: 'website',
      ...openGraph,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

/**
 * CMS-driven metadata constructor.
 * Fetches page metadata from the CMS database and merges it
 * with defaults. Falls back to static metadata if CMS page not found.
 *
 * Usage in page.tsx:
 *   export async function generateMetadata({ params }) {
 *     const { locale } = await params;
 *     return constructCmsMetadata('pricing', locale);
 *   }
 */
export async function constructCmsMetadata(
  slug: string,
  locale: Locale,
  fallback?: SeoProps,
): Promise<Metadata> {
  // Dynamic import to avoid circular dependency
  const { CmsService } = await import('@/server/services/cms.service');
  const cmsMeta = await CmsService.getPageMetadata(slug, locale);

  if (!cmsMeta) {
    return constructMetadata({
      ...fallback,
      locale,
      path: `/${slug}`,
    });
  }

  return constructMetadata({
    title: cmsMeta.title ?? fallback?.title,
    description: cmsMeta.description ?? fallback?.description,
    path: `/${slug}`,
    locale,
    indexable: cmsMeta.indexable,
    openGraph: cmsMeta.ogOverrides as Metadata['openGraph'],
  });
}
