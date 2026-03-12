import { getDictionary } from '@/dictionaries';
import { Globe, Construction } from 'lucide-react';

export default async function AdminDomainsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return (
    <div>
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{dict.admin.domains}</h1>
        <p className="text-sm text-text-muted">{dict.admin.domainsSubtitle}</p>
      </div>
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-16 text-center animate-fade-in-up delay-1">
        <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto mb-4">
          <Construction className="w-7 h-7 text-brand" />
        </div>
        <h3 className="text-sm font-bold text-text-primary mb-1">{dict.admin.comingSoon}</h3>
        <p className="text-xs text-text-muted">{dict.admin.domainsSubtitle}</p>
      </div>
    </div>
  );
}
