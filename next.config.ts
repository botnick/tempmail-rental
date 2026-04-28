import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Security Headers
   * Defense-in-depth against XSS, clickjacking, MIME sniffing,
   * and other common web attack vectors.
   */
  headers: async () => [
    {
      // Apply to all routes
      source: '/(.*)',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'X-DNS-Prefetch-Control',
          value: 'on',
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            // Cloudflare Turnstile widget needs to load https://challenges.cloudflare.com.
            // Inline scripts retained for Next.js runtime; unsafe-eval removed.
            "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            // R2 presigned URLs use *.r2.cloudflarestorage.com hosts.
            "img-src 'self' data: blob: https: cid:",
            "connect-src 'self' blob: https://challenges.cloudflare.com https://*.r2.cloudflarestorage.com",
            "frame-src 'self' data: blob: https://challenges.cloudflare.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; '),
        },
      ],
    },
    {
      // Extra X-Robots-Tag for private routes (defense-in-depth)
      source: '/:locale(th|en)/(dashboard|admin)(.*)',
      headers: [
        {
          key: 'X-Robots-Tag',
          value: 'noindex, nofollow, noarchive',
        },
      ],
    },
  ],
};

export default nextConfig;
