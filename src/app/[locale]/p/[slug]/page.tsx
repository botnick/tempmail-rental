import { notFound } from 'next/navigation';
import { constructCmsMetadata } from '@/lib/seo';
import { CmsService } from '@/server/services/cms.service';
import type { Locale } from '@/lib/seo';
import type { Metadata } from 'next';
import DOMPurify from 'isomorphic-dompurify';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BRAND } from '@/config/ui';
import { getDictionary } from '@/dictionaries';
import { unstable_cache } from 'next/cache';

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  return constructCmsMetadata(slug, locale as Locale, {
    title: `${slug} — ${BRAND.name}`,
    description: BRAND.description,
  });
}

export default async function CmsContentPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const dict = await getDictionary(locale);
  const getCachedPage = unstable_cache(
    () => CmsService.getPage(slug, locale as Locale),
    ['cms-page', slug, locale],
    { tags: ['cms-content'], revalidate: 3600 }
  );
  const page = await getCachedPage();

  if (!page) {
    notFound();
  }

  const Logo = BRAND.Logo;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="mesh-bg" />
      <div className="noise-overlay" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-5 max-w-7xl mx-auto">
        <Link href={`/${locale}`} className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 bg-gradient-to-br from-brand to-amber rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-2 shadow-lg shadow-brand/20">
            <Logo className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gradient tracking-tight">{BRAND.name}</span>
        </Link>
        <Link href={`/${locale}`} className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {dict.nav.home ?? 'Home'}
        </Link>
      </nav>

      {/* Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-24">
        <article className="animate-fade-in-up">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4 text-text-primary">
            {page.title}
          </h1>
          {page.metaDescription && (
            <p className="text-lg text-text-secondary mb-10 leading-relaxed max-w-2xl">
              {page.metaDescription}
            </p>
          )}

          <div className="space-y-8">
            {page.blocks.map((block: any) => {
              if (block.type === 'html' || block.type === 'richtext') {
                const sanitized = DOMPurify.sanitize(
                  typeof block.content === 'string' ? block.content : (block.content?.html ?? ''),
                  {
                    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'code', 'pre', 'blockquote', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'div', 'section'],
                    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'width', 'height', 'id'],
                  }
                );
                return (
                  <div
                    key={block.id}
                    className="prose prose-invert prose-orange max-w-none text-text-secondary leading-relaxed [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-text-primary [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-text-primary [&_h3]:mt-8 [&_h3]:mb-3 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-2 [&_a]:text-brand [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-brand/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:bg-white/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_pre]:bg-white/[0.04] [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:overflow-x-auto [&_hr]:border-border-subtle"
                    dangerouslySetInnerHTML={{ __html: sanitized }}
                  />
                );
              }

              if (block.type === 'text' || block.type === 'markdown') {
                const text = typeof block.content === 'string' ? block.content : (block.content?.text ?? '');
                return (
                  <div key={block.id} className="text-text-secondary leading-relaxed whitespace-pre-wrap">
                    {text}
                  </div>
                );
              }

              if (block.type === 'heading') {
                const headingText = typeof block.content === 'string' ? block.content : (block.content?.text ?? '');
                return (
                  <h2 key={block.id} className="text-2xl font-bold text-text-primary mt-10 mb-4">
                    {headingText}
                  </h2>
                );
              }

              // Fallback: render content as text
              return (
                <div key={block.id} className="text-text-secondary leading-relaxed">
                  {typeof block.content === 'string' ? block.content : JSON.stringify(block.content)}
                </div>
              );
            })}
          </div>
        </article>

        {/* Back Link */}
        <div className="mt-16 pt-8 border-t border-border-subtle">
          <Link href={`/${locale}`} className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-brand transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {dict.nav.home ?? 'Home'}
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border-subtle px-6 py-10">
        <div className="max-w-6xl mx-auto text-center">
          <div className="text-xs text-text-muted/50">{BRAND.copyright}</div>
        </div>
      </footer>
    </div>
  );
}
