import { getDictionary } from '@/dictionaries';
import { AdminMailboxesContent } from '@/components/admin/AdminMailboxesContent';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  return {
    title: `${dict.admin.mailboxes} — ${dict.admin.dashboard} — TempMail`,
  };
}

export default async function AdminMailboxesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  return <AdminMailboxesContent dict={dict} />;
}
