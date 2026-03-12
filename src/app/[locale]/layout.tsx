import type { Metadata } from 'next';
import { TRPCProvider } from '@/lib/trpc';
import { ToastProvider } from '@/components/ui/Toast';
import { LOCALES } from '@/lib/seo';
import { GlobalSchema } from '@/components/seo/GlobalSchema';
import { notFound } from 'next/navigation';
import '../globals.css';

export const metadata: Metadata = {
  title: 'TempMail — Secure Temporary Email',
  description: 'Create instant, secure temporary email addresses. Protect your privacy with disposable inboxes, custom domains, and premium features.',
  keywords: ['temp mail', 'temporary email', 'disposable email', 'privacy', 'secure inbox'],
  openGraph: {
    title: 'TempMail — Secure Temporary Email',
    description: 'Create instant, secure temporary email addresses.',
    type: 'website',
  },
};

/**
 * Generate static params for locale routes.
 * This enables SSG for SEO-critical pages (better Core Web Vitals).
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  
  // ─── SECURITY: Validate locale to prevent path traversal/injection ───
  if (!LOCALES.includes(locale as any)) {
    notFound();
  }
  
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
      </head>
      <body suppressHydrationWarning>
        <GlobalSchema locale={locale} />
        <TRPCProvider>
          <ToastProvider>{children}</ToastProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
