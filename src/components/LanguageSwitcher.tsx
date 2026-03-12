'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const LOCALES = ['th', 'en'] as const;
const LOCALE_META = {
  th: { short: 'TH' },
  en: { short: 'EN' },
} as const;

function getLocalePath(pathname: string, newLocale: string): string {
  const segments = pathname.split('/');
  if (LOCALES.includes(segments[1] as any)) {
    segments[1] = newLocale;
  } else {
    segments.splice(1, 0, newLocale);
  }
  return segments.join('/') || '/';
}

export function LanguageSwitcher({ locale }: { locale: string }) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1">
      {LOCALES.map((loc, i) => {
        const meta = LOCALE_META[loc];
        const isActive = loc === locale;
        const href = getLocalePath(pathname, loc);

        return (
          <span key={loc} className="contents">
            {i > 0 && (
              <span className="text-white/10 text-xs select-none">/</span>
            )}
            {isActive ? (
              <span className="text-brand text-xs font-bold cursor-default">
                {meta.short}
              </span>
            ) : (
              <Link
                href={href}
                className="text-text-muted/40 text-xs font-bold hover:text-brand/70 transition-colors duration-150"
              >
                {meta.short}
              </Link>
            )}
          </span>
        );
      })}
    </div>
  );
}
