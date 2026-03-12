import { getDictionary } from '@/dictionaries';
import { AdminSecurityContent } from '@/components/admin/AdminSecurityContent';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  return {
    title: `${dict.admin.security} — ${dict.admin.dashboard} — TempMail`,
  };
}

export default async function AdminSecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return <AdminSecurityContent dict={dict as any} />;
}
