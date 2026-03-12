import Link from 'next/link';
import { BRAND, ROUTES } from '@/config/ui';
import { getDictionary } from '@/dictionaries';
import { constructMetadata } from '@/lib/seo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { RegisterForm } from '@/components/RegisterForm';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  return constructMetadata({
    title: `${dict.auth.registerTitle} — ${BRAND.name}`,
    description: dict.auth.registerSubtitle,
    path: '/register',
    locale: locale as any,
    indexable: false,
  });
}

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  const Logo = BRAND.Logo;

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <div className="mesh-bg" />
      <div className="noise-overlay" />

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        <div className="flex justify-between items-center mb-4">
          <Link href={`/${locale}`} className="flex items-center gap-2.5 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand to-amber flex items-center justify-center shadow-lg shadow-brand/20 transition-transform duration-300 group-hover:scale-110">
              <Logo className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gradient">{BRAND.name}</span>
          </Link>
          <LanguageSwitcher locale={locale} />
        </div>

        <div className="bg-white/[0.03] backdrop-blur-2xl border border-border-subtle rounded-3xl p-8">
          <RegisterForm locale={locale} dict={dict.auth} />
        </div>

        <p className="text-center text-sm text-text-muted mt-6">
          {dict.auth.hasAccount}{' '}
          <Link href={`/${locale}${ROUTES.login}`} className="text-brand font-semibold hover:underline">{dict.auth.loginButton}</Link>
        </p>
      </div>
    </div>
  );
}
