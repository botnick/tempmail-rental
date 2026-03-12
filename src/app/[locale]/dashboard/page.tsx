import { getDictionary } from '@/dictionaries';
import { DashboardContent } from '@/components/dashboard/DashboardContent';

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return <DashboardContent locale={locale} dict={dict} />;
}
