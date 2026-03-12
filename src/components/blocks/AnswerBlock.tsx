import DOMPurify from 'isomorphic-dompurify';

interface AnswerBlockProps {
  question: string;
  answerText: string;
  answerHtml?: string;
  lastReviewedAt?: Date | string;
  authorUrl?: string;
  trustSignal?: string;
}

/**
 * A specialized Answer Block designed for Generative Engine Optimization (GEO).
 * This structure provides AI search agents (ChatGPT, Perplexity, Gemini)
 * with a clean, citation-friendly paragraph containing direct factual answers.
 *
 * SECURITY: All HTML content is sanitized via DOMPurify to prevent stored XSS.
 */
export function AnswerBlock({
  question,
  answerText,
  answerHtml,
  lastReviewedAt,
  authorUrl,
  trustSignal,
}: AnswerBlockProps) {
  // Sanitize HTML to prevent stored XSS from CMS content
  const sanitizedHtml = DOMPurify.sanitize(answerHtml || answerText, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h3', 'h4', 'span', 'code'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  });

  return (
    <div className="answer-block group relative rounded-2xl border border-white/[0.08] hover:border-brand/25 bg-white/[0.03] backdrop-blur-xl transition-all duration-500">
      <div className="p-6 lg:p-8">
        {/* Question */}
        <div className="flex items-start gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-amber flex items-center justify-center shrink-0 mt-0.5 shadow-lg shadow-brand/20 group-hover:scale-110 transition-transform duration-300">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h2 className="text-lg lg:text-xl font-bold text-white leading-tight">{question}</h2>
        </div>

        {/* Answer */}
        <div
          className="text-gray-300 leading-relaxed text-sm lg:text-[1rem] pl-11 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:text-white [&_strong]:font-semibold [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1.5 [&_code]:bg-white/[0.08] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />

        {/* Trust signals */}
        {(lastReviewedAt || authorUrl || trustSignal) && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-6 pt-4 border-t border-white/[0.06] text-xs text-text-muted pl-11">
            {trustSignal && (
              <span className="font-semibold text-brand flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                {trustSignal}
              </span>
            )}
            {lastReviewedAt && (
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                Last reviewed: {new Date(lastReviewedAt).toLocaleDateString()}
              </span>
            )}
            {authorUrl && (
              <a href={authorUrl} className="flex items-center gap-1.5 hover:text-brand transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Verified Editor
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
