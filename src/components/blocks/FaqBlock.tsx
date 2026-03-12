import { JsonLd } from '@/components/seo/JsonLd';

export interface FaqItemType {
  question: string;
  answer: string;
}

export function FaqBlock({ items, title = 'Frequently Asked Questions' }: { items: FaqItemType[], title?: string }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <div className="faq-block my-12 max-w-3xl mx-auto">
      <JsonLd schema={schema} />
      <h2 className="text-2xl sm:text-3xl font-extrabold mb-10 text-center tracking-tight">
        {title}
      </h2>
      <div className="space-y-3">
        {items.map((item, index) => (
          <details
            key={index}
            className="group bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden transition-all duration-300 hover:border-brand/30 hover:bg-white/[0.04]"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <summary className="font-semibold cursor-pointer text-white text-sm sm:text-[1rem] group-open:text-brand transition-colors list-none flex justify-between items-center outline-none p-5 sm:p-6 select-none">
              <span className="flex items-center gap-3 pr-4">
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand/20 to-amber/10 flex items-center justify-center shrink-0 group-open:from-brand group-open:to-amber transition-all duration-300">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand group-open:text-white transition-colors duration-300">
                    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </span>
                {item.question}
              </span>
              <span className="w-6 h-6 rounded-full bg-white/[0.04] flex items-center justify-center shrink-0 transform transition-transform duration-300 group-open:rotate-180 group-open:bg-brand/20">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted group-open:text-brand transition-colors"><path d="m6 9 6 6 6-6"/></svg>
              </span>
            </summary>
            <div className="px-5 sm:px-6 pb-5 sm:pb-6 text-gray-300 text-sm leading-relaxed border-t border-white/[0.08] pt-4 ml-10">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
