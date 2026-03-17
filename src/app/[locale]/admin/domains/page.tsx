import { getDictionary } from '@/dictionaries';
import { AdminDomainsContent } from '@/components/admin/AdminDomainsContent';

export default async function AdminDomainsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return <AdminDomainsContent dict={dict} />;
}
