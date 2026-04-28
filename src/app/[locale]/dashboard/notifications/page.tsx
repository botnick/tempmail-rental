import { getDictionary } from '@/dictionaries';
import { NotificationsContent } from '@/components/dashboard/NotificationsContent';

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  return <NotificationsContent locale={locale} dict={dict} />;
}
