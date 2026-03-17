import Link from 'next/link';
import { BRAND, ROUTES } from '@/config/ui';
import { constructMetadata } from '@/lib/seo';
import { getDictionary } from '@/dictionaries';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PricingPageContent } from '@/components/PricingPageContent';
import type { Metadata } from 'next';
import { Mail } from 'lucide-react';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  return constructMetadata({
    title: `${dict.pricing.title} — ${BRAND.name}`,
    description: dict.pricing.subtitle,
    path: '/pricing',
    locale: locale as any,
  });
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  const Logo = BRAND.Logo;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="mesh-bg" />
      <div className="noise-overlay" />

      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-5 max-w-7xl mx-auto">
        <Link href={`/${locale}`} className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-amber flex items-center justify-center shadow-lg shadow-brand/20 transition-transform duration-300 group-hover:scale-110">
            <Logo className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gradient">{BRAND.name}</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher locale={locale} />
          <Link href={`/${locale}${ROUTES.login}`} className="px-5 py-2 text-sm font-semibold text-brand border border-brand/30 rounded-xl hover:bg-brand/10 transition-all duration-300">
            {dict.nav.login}
          </Link>
        </div>
      </nav>

      <div className="relative z-10 text-center pt-20 pb-16 px-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
          <span className="text-gradient">{dict.pricing.title}</span>{dict.pricing.titleSuffix}
        </h1>
        <p className="text-text-muted max-w-md mx-auto text-sm">{dict.pricing.subtitle}</p>
      </div>

      {/* Dynamic plans from DB */}
      <PricingPageContent locale={locale} dict={{ pricing: dict.pricing, nav: dict.nav, admin: dict.admin }} />
    </div>
  );
}
