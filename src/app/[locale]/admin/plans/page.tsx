import { getDictionary } from '@/dictionaries';
import { AdminPlansContent } from '@/components/admin/AdminPlansContent';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  return {
    title: `${dict.admin.plans} — ${dict.admin.dashboard} — TempMail`,
  };
}

export default async function AdminPlansPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return <AdminPlansContent dict={dict as any} />;
}
