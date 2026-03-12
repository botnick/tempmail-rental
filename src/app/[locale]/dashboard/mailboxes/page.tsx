import { getDictionary } from '@/dictionaries';
import { MailboxList } from '@/components/dashboard/MailboxList';

export default async function MailboxesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return <MailboxList dict={dict} />;
}
