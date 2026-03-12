import { getDictionary } from '@/dictionaries';
import { AdminDashboardContent } from '@/components/admin/AdminDashboardContent';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  return {
    title: `${dict.admin.dashboard} — TempMail`,
  };
}

export default async function AdminDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  return <AdminDashboardContent dict={dict} />;
}
