import { MetadataRoute } from 'next';
import { SITE_URL, LOCALES } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  // Prevent indexing of non-production environments
  const isProd = process.env.NODE_ENV === 'production';
  
  if (!isProd) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  // Build locale-specific disallow rules for all private paths
  const privatePaths = ['dashboard', 'admin', 'login', 'register'];
  const disallowPaths: string[] = [
    '/api/',
    '/dashboard/',
    '/admin/',
  ];

  // Explicitly block every locale prefix for private routes
  LOCALES.forEach((locale) => {
    privatePaths.forEach((path) => {
      disallowPaths.push(`/${locale}/${path}`);
      disallowPaths.push(`/${locale}/${path}/`);
    });
  });

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: disallowPaths,
      },
      // Block aggressive crawlers from hammering the site
      {
        userAgent: 'AhrefsBot',
        disallow: '/',
      },
      {
        userAgent: 'SemrushBot',
        disallow: '/',
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
