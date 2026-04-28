import Link from 'next/link';
import { BRAND, ROUTES } from '@/config/ui';
import { constructMetadata } from '@/lib/seo';
import { getDictionary } from '@/dictionaries';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LandingMobileNav } from '@/components/layout/LandingMobileNav';
import type { Metadata } from 'next';
import { Mail, Zap, ArrowRight, ChevronRight, Clock, Shield, Globe, Sparkles, Infinity, Lock, Activity, Eye, Star } from 'lucide-react';
import { CmsService } from '@/server/services/cms.service';
import { FaqBlock } from '@/components/blocks/FaqBlock';
import { AnswerBlock } from '@/components/blocks/AnswerBlock';
import { unstable_cache } from 'next/cache';
import { GuestInbox } from './_components/GuestInbox';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  return constructMetadata({
    title: dict.meta.title,
    description: dict.meta.description,
    path: '/',
    locale: locale as any,
  });
}

const FEATURE_ICONS = [Zap, Shield, Globe, Sparkles, Infinity, Lock];
const FEATURE_KEYS = ['instant', 'spam', 'domain', 'username', 'unlimited', 'retention'] as const;
const FEATURE_GRADIENTS = [
  'linear-gradient(135deg, #f97316, #f59e0b)',
  'linear-gradient(135deg, #ea580c, #f97316)',
  'linear-gradient(135deg, #f87171, #fb923c)',
  'linear-gradient(135deg, #f59e0b, #eab308)',
  'linear-gradient(135deg, #ff8c42, #ffb088)',
  'linear-gradient(135deg, #f97316, #ea580c)',
];

const TRUST_ICONS = [Activity, Shield, Eye, Star];
const TRUST_KEYS = ['uptime', 'encrypted', 'noAds', 'openSource'] as const;

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  const Logo = BRAND.Logo;

  // Fetch CMS content — cached until admin triggers revalidateTag('cms-content')
  const getCachedFaq = unstable_cache(
    () => CmsService.getFaqItems(locale as any).catch(() => []),
    ['landing-faq', locale],
    { tags: ['cms-content'], revalidate: 3600 }
  );
  const getCachedAnswers = unstable_cache(
    () => CmsService.getAnswerBlocks(locale as any).catch(() => []),
    ['landing-answers', locale],
    { tags: ['cms-content'], revalidate: 3600 }
  );
  const [faqItems, answerBlocks] = await Promise.all([
    getCachedFaq(),
    getCachedAnswers(),
  ]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="mesh-bg" />
      <div className="noise-overlay" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-4 sm:px-6 lg:px-12 py-5 max-w-7xl mx-auto">
        <Link href={`/${locale}`} className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 bg-gradient-to-br from-brand to-amber rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-2 shadow-lg shadow-brand/20">
            <Logo className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gradient tracking-tight">{BRAND.name}</span>
        </Link>
        <div className="hidden md:flex items-center gap-1">
          <Link href={`/${locale}${ROUTES.pricing}`} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-brand/5">
            {dict.nav.pricing}
          </Link>
          <Link href="#features" className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-brand/5">
            {dict.nav.features}
          </Link>
          <div className="w-px h-5 bg-border-subtle mx-3" />
          <LanguageSwitcher locale={locale} />
          <div className="w-px h-5 bg-border-subtle mx-1" />
          <Link href={`/${locale}${ROUTES.login}`} className="px-5 py-2 text-sm font-semibold text-brand border border-brand/30 rounded-xl hover:bg-brand/10 hover:border-brand/50 transition-all duration-300">
            {dict.nav.login}
          </Link>
          <Link href={`/${locale}${ROUTES.register}`} className="ml-2 px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 hover:-translate-y-0.5 transition-all duration-300">
            {dict.nav.register}
          </Link>
        </div>
        <LandingMobileNav
          locale={locale}
          links={[
            { href: `/${locale}${ROUTES.pricing}`, label: dict.nav.pricing },
            { href: '#features', label: dict.nav.features },
          ]}
          loginLabel={dict.nav.login}
          loginHref={`/${locale}${ROUTES.login}`}
          registerLabel={dict.nav.register}
          registerHref={`/${locale}${ROUTES.register}`}
        />
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex flex-col items-center text-center px-6 pt-24 lg:pt-32 pb-20 max-w-4xl mx-auto">
        <div className="animate-fade-in-up">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-brand bg-brand/10 border border-brand/20 mb-10">
            <Zap className="w-3.5 h-3.5" />
            {dict.brand.heroBadge}
          </span>
        </div>

        <h1 className="animate-fade-in-up delay-1 text-3xl sm:text-5xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight mb-8">
          {dict.brand.heroTitle[0]}
          <br />
          <span className="text-gradient-vivid">{dict.brand.heroTitle[1]}</span>
        </h1>

        <p className="animate-fade-in-up delay-2 text-base sm:text-lg text-text-secondary max-w-lg mb-12 leading-relaxed">
          {dict.brand.description}
        </p>

        <div className="animate-fade-in-up delay-3 flex flex-col sm:flex-row gap-4 mb-12">
          <Link href={`/${locale}${ROUTES.register}`} className="px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-brand to-amber rounded-2xl hover:shadow-xl hover:shadow-brand/30 hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-2">
            {dict.brand.heroCta}
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href={`/${locale}${ROUTES.pricing}`} className="px-8 py-4 text-base font-semibold text-brand border-2 border-brand/25 rounded-2xl hover:bg-brand/8 hover:border-brand/40 transition-all duration-300 text-center">
            {dict.brand.heroCtaSecondary}
          </Link>
        </div>

        {/* Trust Signals */}
        <div className="animate-fade-in-up delay-4 flex flex-wrap items-center justify-center gap-6 mb-20">
          {TRUST_KEYS.map((key, i) => {
            const Icon = TRUST_ICONS[i];
            return (
              <div key={key} className="flex items-center gap-2 text-xs text-text-muted">
                <Icon className="w-3.5 h-3.5 text-brand-bright" />
                <span className="font-medium">{dict.trust[key]}</span>
              </div>
            );
          })}
        </div>

        {/* Live anonymous inbox. The component calls /api/guest/bootstrap on
            mount to issue/refresh the guest_token cookie and get an active
            mailbox — RSC pages can't write cookies in Next 16 so the
            bootstrap has to happen via a Route Handler. */}
        <div className="animate-fade-in-up delay-5 w-full">
          <GuestInbox locale={locale} dict={dict} />
        </div>
      </main>

      {/* Features */}
      <section id="features" className="relative z-10 px-6 py-28 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            {dict.home.whyTitle} <span className="text-gradient">{BRAND.name}</span>
          </h2>
          <p className="text-text-muted max-w-md mx-auto text-sm">
            {dict.home.whySubtitle}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURE_KEYS.map((key, i) => {
            const Icon = FEATURE_ICONS[i];
            const feature = dict.features[key];
            return (
              <div key={key} className="group bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-7 hover:bg-white/[0.05] hover:border-brand/15 hover:-translate-y-1 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300" style={{ background: FEATURE_GRADIENTS[i] }}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-base font-bold mb-2 text-text-primary">{feature.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ Section */}
      {faqItems.length > 0 && (
        <section className="relative z-10 px-6 py-20 max-w-4xl mx-auto">
          <FaqBlock items={faqItems.map((f: any) => ({ question: f.question, answer: f.answer }))} title={dict.home.faqTitle} />
        </section>
      )}

      {/* Answer Blocks */}
      {answerBlocks.length > 0 && (
        <section className="relative z-10 px-6 py-20 max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-10 text-center tracking-tight">
            {dict.home.answersTitle}
          </h2>
          <div className="space-y-6">
            {answerBlocks.map((block: any) => (
              <AnswerBlock
                key={block.id}
                question={block.question}
                answerText={block.answerText}
                answerHtml={block.answerHtml ?? undefined}
                lastReviewedAt={block.reviewedAt ?? undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="relative z-10 px-6 py-28">
        <div className="relative p-[1.5px] rounded-3xl bg-gradient-to-r from-brand to-amber max-w-2xl mx-auto">
          <div className="bg-surface rounded-3xl p-16 text-center shadow-2xl shadow-brand/8">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-5 tracking-tight">{dict.home.ctaTitle}</h2>
            <p className="text-text-secondary mb-10 text-sm">{dict.home.ctaSubtitle.replace('{name}', BRAND.name)}</p>
            <Link href={`/${locale}${ROUTES.register}`} className="inline-flex items-center gap-2 px-10 py-4 text-base font-bold text-white bg-gradient-to-r from-brand to-amber rounded-2xl hover:shadow-xl hover:shadow-brand/30 hover:-translate-y-1 transition-all duration-300">
              {dict.home.ctaButton}
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border-subtle px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand to-amber flex items-center justify-center">
              <Logo className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm text-gradient">{BRAND.name}</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-text-muted">
            <Link href={`/${locale}${ROUTES.pricing}`} className="hover:text-text-secondary transition-colors">{dict.footer.pricing}</Link>
            <Link href={`/${locale}${ROUTES.privacy}`} className="hover:text-text-secondary transition-colors">{dict.footer.privacy}</Link>
            <Link href={`/${locale}${ROUTES.terms}`} className="hover:text-text-secondary transition-colors">{dict.footer.terms}</Link>
            <Link href={`/${locale}${ROUTES.contact}`} className="hover:text-text-secondary transition-colors">{dict.footer.contact}</Link>
          </div>
          <div className="text-xs text-text-muted/50">{BRAND.copyright}</div>
        </div>
      </footer>
    </div>
  );
}
