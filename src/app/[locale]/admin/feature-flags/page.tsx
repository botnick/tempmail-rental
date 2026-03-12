import { getDictionary } from '@/dictionaries';
import { AdminFeatureFlagsContent } from '@/components/admin/AdminFeatureFlagsContent';

export default async function AdminFeatureFlagsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  return <AdminFeatureFlagsContent dict={dict} />;
}
