import { getDictionary } from '@/dictionaries';
import { MessageViewContent } from '@/components/dashboard/MessageViewContent';

export default async function MessageViewPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const dict = await getDictionary(locale);

  return <MessageViewContent messageId={id} dict={dict} locale={locale} />;
}
