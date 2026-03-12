import { getDictionary } from '@/dictionaries';
import { AdminCmsContent } from '@/components/admin/AdminCmsContent';

export default async function AdminCmsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return <AdminCmsContent dict={dict as any} />;
}
