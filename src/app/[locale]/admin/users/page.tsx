import { getDictionary } from '@/dictionaries';
import { AdminUsersContent } from '@/components/admin/AdminUsersContent';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  return {
    title: `${dict.admin.users} — ${dict.admin.dashboard} — TempMail`,
  };
}

export default async function AdminUsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  return <AdminUsersContent dict={dict} />;
}
