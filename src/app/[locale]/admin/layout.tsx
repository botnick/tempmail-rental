import { getDictionary } from '@/dictionaries';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

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
    <div className="min-h-screen flex bg-base">
      <div className="mesh-bg" />
      <div className="noise-overlay" />

      <AdminSidebar locale={locale} dict={dict as any} />

      <main className="flex-1 relative z-10">
        <div className="max-w-7xl mx-auto p-8 min-h-screen">{children}</div>
      </main>
    </div>
  );
}
