import { getDictionary } from '@/dictionaries';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { EmailVerificationBanner } from '@/components/dashboard/EmailVerificationBanner';
import { MobileMenuProvider } from '@/components/providers/MobileMenuProvider';
import { MobileHeader } from '@/components/layout/MobileHeader';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return (
    <MobileMenuProvider>
      <div className="min-h-screen flex bg-base">
        <div className="mesh-bg" />
        <div className="noise-overlay" />

        <DashboardSidebar locale={locale} dict={dict as any} />

        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          <MobileHeader />
          <main className="flex-1 p-3 sm:p-5 lg:p-8 overflow-auto">
            <EmailVerificationBanner dict={(dict as any).dashboard ?? {}} />
            {children}
          </main>
        </div>
      </div>
    </MobileMenuProvider>
  );
}
