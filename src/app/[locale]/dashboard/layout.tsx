import { getDictionary } from '@/dictionaries';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';

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
    <div className="min-h-screen flex bg-base">
      <div className="mesh-bg" />
      <div className="noise-overlay" />

      <DashboardSidebar locale={locale} dict={dict as any} />

      <main className="flex-1 p-8 overflow-auto relative z-10">{children}</main>
    </div>
  );
}
