import { getDictionary } from '@/dictionaries';
import { AdminRbacContent } from '@/components/admin/AdminRbacContent';

export default async function AdminRbacPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  return <AdminRbacContent dict={dict} />;
}
