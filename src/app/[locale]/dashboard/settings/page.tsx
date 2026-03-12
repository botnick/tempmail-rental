import { getDictionary } from '@/dictionaries';
import { SettingsContent } from '@/components/dashboard/SettingsContent';

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return <SettingsContent dict={dict} />;
}
