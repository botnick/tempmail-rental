import { getDictionary } from '@/dictionaries';
import { AdminBillingContent } from '@/components/admin/AdminBillingContent';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  return {
    title: `${dict.admin.billing} — ${dict.admin.dashboard} — TempMail`,
  };
}

export default async function AdminBillingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return <AdminBillingContent dict={dict as any} />;
}
