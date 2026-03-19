import { getDictionary } from '@/dictionaries';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { MobileMenuProvider } from '@/components/providers/MobileMenuProvider';
import { MobileHeader } from '@/components/layout/MobileHeader';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
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

        <AdminSidebar locale={locale} dict={dict as any} />

        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          <MobileHeader />
          <main className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 min-h-screen">{children}</div>
          </main>
        </div>
      </div>
    </MobileMenuProvider>
  );
}
