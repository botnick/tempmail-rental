import { getDictionary } from '@/dictionaries';
import { AdminSeoContent } from '@/components/admin/AdminSeoContent';

export default async function AdminSeoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return <AdminSeoContent dict={dict as any} />;
}
