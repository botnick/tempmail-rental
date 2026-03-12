import { JsonLd } from '@/components/seo/JsonLd';

/**
 * Global Organization + WebSite JSON-LD structured data.
 * This should be rendered once per page (typically in the root layout)
 * to establish site-wide schema identity.
 *
 * Includes:
 * - Organization schema (brand, logo, social profiles)
 * - WebSite schema with SearchAction for sitelinks
 */
export function GlobalSchema({ locale = 'th' }: { locale?: string }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'TempMail',
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    description: 'Secure temporary email platform for privacy protection',
    foundingDate: '2026',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@tempmail.dev',
      contactType: 'customer service',
      availableLanguage: ['Thai', 'English'],
    },
    sameAs: [],
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'TempMail',
    url: siteUrl,
    inLanguage: locale === 'th' ? 'th-TH' : 'en-US',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/${locale}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <>
      <JsonLd schema={organizationSchema} />
      <JsonLd schema={websiteSchema} />
    </>
  );
}
