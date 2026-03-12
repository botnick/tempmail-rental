import { getDictionary } from '@/dictionaries';
import { AdminAuditContent } from '@/components/admin/AdminAuditContent';

export default async function AdminAuditPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  return <AdminAuditContent dict={dict} />;
}
