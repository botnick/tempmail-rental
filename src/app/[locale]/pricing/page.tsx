import Link from 'next/link';
import { BRAND, ROUTES, FEATURE_MATRIX } from '@/config/ui';
import { constructMetadata } from '@/lib/seo';
import { getDictionary } from '@/dictionaries';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import type { Metadata } from 'next';
import { ChevronRight, Check, Flame, Mail } from 'lucide-react';

const PLAN_SLUGS = ['free', 'pro', 'business'] as const;
const PLAN_PRICES = { free: '0', pro: '199', business: '899' };
const PLAN_GRADIENTS = {
  free: { card: 'bg-border-subtle', check: 'from-amber to-gold', cta: 'text-text-secondary border border-border-warm hover:bg-brand/5 hover:text-text-primary hover:border-brand/30' },
  pro: { card: 'bg-gradient-to-br from-brand to-amber shadow-2xl shadow-brand/15 scale-[1.03]', check: 'from-brand to-coral', cta: 'text-white bg-gradient-to-r from-brand to-amber hover:shadow-lg hover:shadow-brand/30 hover:-translate-y-0.5' },
  business: { card: 'bg-border-subtle', check: 'from-coral to-brand-bright', cta: 'text-text-secondary border border-border-warm hover:bg-brand/5 hover:text-text-primary hover:border-brand/30' },
};

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

      <div className="relative z-10 max-w-5xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLAN_SLUGS.map((slug, i) => {
            const plan = dict.pricing.plans[slug];
            const g = PLAN_GRADIENTS[slug];
            const featured = slug === 'pro';
            return (
              <div key={slug} className={`rounded-3xl p-[1.5px] animate-fade-in-up ${g.card}`} style={{ animationDelay: `${i * 100}ms` }}>
                <div className="bg-surface rounded-3xl p-7 h-full flex flex-col">
                  {featured && (
                    <span className="self-start text-[10px] font-bold uppercase tracking-wider text-brand bg-brand/10 border border-brand/20 px-3 py-1 rounded-full mb-4 flex items-center gap-1">
                      <Flame className="w-3 h-3" />
                      {dict.pricing.popular}
                    </span>
                  )}
                  <h3 className="text-lg font-extrabold mb-1 text-text-primary">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-extrabold tracking-tight text-text-primary">฿{PLAN_PRICES[slug]}</span>
                  </div>
                  <p className="text-xs text-text-muted mb-6">
                    {slug === 'free' ? dict.pricing.forever : dict.pricing.perMonth}
                  </p>

                  <ul className="space-y-3 flex-1 mb-8">
                    {plan.features.map((f: string, j: number) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm text-text-secondary">
                        <div className={`w-[18px] h-[18px] rounded-full bg-gradient-to-br ${g.check} flex items-center justify-center shrink-0 mt-0.5`}>
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link href={`/${locale}${ROUTES.register}`} className={`w-full py-3 text-sm font-bold rounded-xl text-center transition-all duration-300 flex items-center justify-center gap-2 ${g.cta}`}>
                    {plan.cta}
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-20 bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden animate-fade-in-up delay-3">
          <div className="p-6 border-b border-border-subtle">
            <h2 className="text-base font-bold text-text-primary">{dict.pricing.compare}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-widest text-text-muted font-semibold">Feature</th>
                  <th className="text-center px-4 py-3 text-[10px] uppercase tracking-widest text-text-muted font-semibold">{dict.pricing.plans.free.name}</th>
                  <th className="text-center px-4 py-3 text-[10px] uppercase tracking-widest text-brand font-semibold">{dict.pricing.plans.pro.name}</th>
                  <th className="text-center px-4 py-3 text-[10px] uppercase tracking-widest text-text-muted font-semibold">{dict.pricing.plans.business.name}</th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_MATRIX.map((row) => (
                  <tr key={row.key} className="border-b border-border-subtle/50 hover:bg-brand/[0.02] transition-colors">
                    <td className="px-6 py-3 text-sm text-text-secondary font-medium">{row.label}</td>
                    <td className="text-center px-4 py-3 text-sm text-text-muted">{row.free}</td>
                    <td className="text-center px-4 py-3 text-sm text-brand font-semibold">{row.pro}</td>
                    <td className="text-center px-4 py-3 text-sm text-text-muted">{row.business}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
