/**
 * CSRF Protection — Double-Submit Cookie Pattern
 *
 * For mutation endpoints using cookie-based auth:
 * 1. Server sets a random CSRF token in a cookie
 * 2. Client reads cookie and sends token in X-CSRF-Token header
 * 3. Server verifies header matches cookie
 *
 * Note: tRPC mutations over HTTP POST already have some CSRF
 * protection via Content-Type: application/json (browsers won't
 * send this cross-origin without CORS). This adds defense-in-depth.
 */

import { TRPCError } from '@trpc/server';
import { randomHex } from '../lib/crypto';
import { logger } from '../lib/logger';

const CSRF_COOKIE_NAME = '__csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a new CSRF token.
 */
export function generateCsrfToken(): string {
  return randomHex(CSRF_TOKEN_LENGTH);
}

/**
 * Validate CSRF token from request.
 * Compares cookie value against header value.
 */
export function validateCsrfToken(
  cookieToken: string | undefined,
  headerToken: string | undefined
): boolean {
  if (!cookieToken || !headerToken) return false;
  if (cookieToken.length !== headerToken.length) return false;

  // Timing-safe comparison
  const { timingSafeEqual } = require('crypto');
  try {
    return timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(headerToken)
    );
  } catch {
    return false;
  }
}

/**
 * CSRF middleware for tRPC mutations.
 * Skips GET requests (queries) and non-cookie auth.
 */
export function csrfGuard(opts: {
  cookieToken?: string;
  headerToken?: string;
  method?: string;
}): void {
  // Skip for GET requests (tRPC queries)
  if (opts.method === 'GET') return;

  // Skip if no cookie auth is being used
  if (!opts.cookieToken) return;

  if (!validateCsrfToken(opts.cookieToken, opts.headerToken)) {
    logger.warn('CSRF validation failed', {
      hasCookie: String(!!opts.cookieToken),
      hasHeader: String(!!opts.headerToken),
    });
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'CSRF validation failed',
    });
  }
}

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME };
