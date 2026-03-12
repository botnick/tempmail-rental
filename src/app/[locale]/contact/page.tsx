import Link from 'next/link';
import { BRAND, ROUTES } from '@/config/ui';
import { getDictionary } from '@/dictionaries';
import { constructMetadata } from '@/lib/seo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ContactForm } from '@/components/ContactForm';
import type { Metadata } from 'next';
import { MessageSquare, Mail, Clock, Shield, Globe } from 'lucide-react';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  return constructMetadata({
    title: `${(dict as any).contact.title} — ${BRAND.name}`,
    description: (dict as any).contact.subtitle,
    path: '/contact',
    locale: locale as any,
  });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  const d = dict as any;
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
            {d.nav.login}
          </Link>
        </div>
      </nav>

      <main className="relative z-10 max-w-4xl mx-auto px-6 pt-16 pb-24">
        <div className="animate-fade-in-up text-center mb-14">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand to-amber flex items-center justify-center mx-auto mb-5 shadow-xl shadow-brand/20">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-primary mb-3">{d.contact.title}</h1>
          <p className="text-text-muted max-w-md mx-auto text-sm">{d.contact.subtitle}</p>
        </div>

        {/* Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-14 animate-fade-in-up delay-1">
          <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-6 text-center hover:bg-white/[0.04] hover:border-brand/12 hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand to-amber flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-sm font-bold text-text-primary mb-2">{d.contact.supportTitle}</h3>
            <p className="text-xs text-text-muted mb-3">{d.contact.supportDesc}</p>
            <a href="mailto:support@tempmail.dev" className="text-sm text-brand font-semibold hover:underline">support@tempmail.dev</a>
          </div>

          <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-6 text-center hover:bg-white/[0.04] hover:border-brand/12 hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-deep to-coral flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-sm font-bold text-text-primary mb-2">{d.contact.dpoTitle}</h3>
            <p className="text-xs text-text-muted mb-3">{d.contact.dpoDesc}</p>
            <a href="mailto:dpo@tempmail.dev" className="text-sm text-brand font-semibold hover:underline">dpo@tempmail.dev</a>
          </div>

          <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-6 text-center hover:bg-white/[0.04] hover:border-brand/12 hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber to-gold flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-sm font-bold text-text-primary mb-2">{d.contact.businessTitle}</h3>
            <p className="text-xs text-text-muted mb-3">{d.contact.businessDesc}</p>
            <a href="mailto:business@tempmail.dev" className="text-sm text-brand font-semibold hover:underline">business@tempmail.dev</a>
          </div>
        </div>

        {/* Contact Form */}
        <div className="max-w-xl mx-auto animate-fade-in-up delay-2">
          <div className="bg-white/[0.025] backdrop-blur-2xl border border-border-subtle rounded-3xl p-8">
            <h2 className="text-lg font-bold text-text-primary mb-1">{d.contact.formTitle}</h2>
            <p className="text-xs text-text-muted mb-6">{d.contact.formSubtitle}</p>
            <ContactForm dict={d} />
          </div>
        </div>

        {/* Response Time */}
        <div className="mt-12 max-w-xl mx-auto animate-fade-in-up delay-3">
          <div className="bg-white/[0.015] border border-border-subtle rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-brand shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-text-primary mb-1.5">{d.contact.responseTitle}</h3>
                <ul className="text-xs text-text-muted space-y-1">
                  <li>• {d.contact.responseGeneral}</li>
                  <li>• {d.contact.responseTechnical}</li>
                  <li>• {d.contact.responsePdpa}</li>
                  <li>• {d.contact.responseAbuse}</li>
                </ul>
                <p className="text-[10px] text-text-muted/60 mt-3">{d.contact.businessHours}</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border-subtle px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand to-amber flex items-center justify-center"><Logo className="w-3.5 h-3.5 text-white" /></div>
            <span className="font-bold text-sm text-gradient">{BRAND.name}</span>
          </Link>
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
