import { getDictionary } from '@/dictionaries';
import { AdminTempMailContent } from '@/components/admin/AdminTempMailContent';

export default async function AdminTempMailPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return <AdminTempMailContent dict={dict as any} />;
}
