import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['th', 'en'];
const defaultLocale = 'th';

/**
 * Private paths that require authentication.
 * Users without session_token cookie will be redirected to login.
 */
const AUTH_REQUIRED_PATHS = ['/dashboard', '/admin'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ──────────────────────────────────────────────
  // CVE-2025-29927 MITIGATION
  // ──────────────────────────────────────────────
  const subrequestHeader = request.headers.get('x-middleware-subrequest');
  if (subrequestHeader) {
    return new NextResponse(null, { status: 403 });
  }

  // Skip middleware for static assets and API routes
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return;
  }

  // ──────────────────────────────────────────────
  // LOCALE DETECTION & REDIRECT
  // ──────────────────────────────────────────────
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (!pathnameHasLocale) {
    const locale = defaultLocale;
    request.nextUrl.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(request.nextUrl);
  }

  // Extract locale and path without locale prefix
  const currentLocale = locales.find(
    (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`
  ) ?? defaultLocale;
  const pathWithoutLocale = pathname.replace(new RegExp(`^/${currentLocale}`), '') || '/';

  // ──────────────────────────────────────────────
  // AUTH GUARD — Redirect to login if no session
  // ──────────────────────────────────────────────
  const isAuthRequired = AUTH_REQUIRED_PATHS.some((p) => pathWithoutLocale.startsWith(p));

  if (isAuthRequired) {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      const loginUrl = new URL(`/${currentLocale}/login`, request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Add noindex header for private routes
    const response = NextResponse.next();
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
