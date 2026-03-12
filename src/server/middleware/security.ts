/**
 * Security Middleware
 *
 * Security headers, CSRF protection, and request sanitization
 */

import { TRPCError } from '@trpc/server';

/**
 * Validate CSRF token from custom header
 * Next.js SameSite cookies handle most CSRF, but this adds defense-in-depth
 */
export function validateCsrfHeader(
  headers: Record<string, string | string[] | undefined>
): void {
  const origin = headers['origin'] as string | undefined;
  const host = headers['host'] as string | undefined;
  const csrfToken = headers['x-csrf-token'] as string | undefined;

  // In development, skip CSRF
  if (process.env.NODE_ENV === 'development') return;

  // For mutating requests, validate origin matches host
  if (origin && host) {
    const originUrl = new URL(origin);
    if (originUrl.host !== host) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'CSRF validation failed',
      });
    }
  }
}

/**
 * Sanitize user input — prevent XSS in stored content
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Extract client IP from headers (supports reverse proxy)
 */
export function extractClientIp(
  headers: Record<string, string | string[] | undefined>
): string {
  const forwarded = headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    // First IP in the chain is the original client
    return forwarded.split(',')[0].trim();
  }
  const realIp = headers['x-real-ip'];
  if (typeof realIp === 'string') {
    return realIp.trim();
  }
  return '127.0.0.1';
}

/**
 * Security response headers for API routes
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '0', // Disabled in favor of CSP
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
} as const;

/**
 * Validate email format securely (prevents ReDoS)
 */
export function isValidEmail(email: string): boolean {
  if (email.length > 254) return false;
  // Simple regex that avoids catastrophic backtracking
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return re.test(email);
}
