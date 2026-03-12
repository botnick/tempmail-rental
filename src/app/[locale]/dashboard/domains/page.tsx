import { getDictionary } from '@/dictionaries';
import { DomainList } from '@/components/dashboard/DomainList';

export default async function DomainsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return <DomainList dict={dict} />;
}
