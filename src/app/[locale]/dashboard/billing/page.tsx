import { getDictionary } from '@/dictionaries';
import { BillingContent } from '@/components/dashboard/BillingContent';

export default async function BillingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return <BillingContent dict={dict} />;
}
