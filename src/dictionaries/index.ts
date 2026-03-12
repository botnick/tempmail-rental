/**
 * i18n Dictionary Loader
 *
 * Server-side dictionary loading for Next.js App Router.
 * Uses dynamic import with type safety.
 *
 * Usage in page.tsx:
 *   const dict = await getDictionary(locale);
 *   return <h1>{dict.brand.heroTitle[0]}</h1>
 */

import type { Locale } from '@/lib/seo';

// Type inferred from the Thai dictionary (source of truth)
export type Dictionary = typeof import('./th.json');

const dictionaries: Record<string, () => Promise<Dictionary>> = {
  th: () => import('./th.json').then((m) => m.default as unknown as Dictionary),
  en: () => import('./en.json').then((m) => m.default as unknown as Dictionary),
};

/**
 * Load a translation dictionary for the given locale.
 * Falls back to Thai if locale is not found.
 */
export async function getDictionary(locale: string): Promise<Dictionary> {
  const loader = dictionaries[locale] ?? dictionaries['th'];
  return loader();
}
