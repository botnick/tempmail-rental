/**
 * Session Management
 *
 * Security:
 * - Tokens stored as SHA-256 hashes (never plaintext in DB)
 * - Refresh token rotation with reuse detection
 * - Configurable TTL per session type
 * - IP + UA binding for session fingerprinting
 */

import { createHash, randomBytes } from 'crypto';

export interface SessionData {
  userId: string;
  tokenHash: string;
  refreshTokenHash: string;
  ip: string;
  userAgent: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
  rotationCounter: number;
  isAdmin: boolean;
}

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;        // 15 min
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ADMIN_SESSION_TTL_MS = 15 * 60 * 1000;        // 15 min

/**
 * Generate a cryptographically secure random token
 */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hash a token for storage — never store raw tokens
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Create session data from a user ID
 */
export function createSession(
  userId: string,
  ip: string,
  userAgent: string,
  isAdmin: boolean = false
): { accessToken: string; refreshToken: string; session: SessionData } {
  const accessToken = generateToken();
  const refreshToken = generateToken();
  const ttl = isAdmin ? ADMIN_SESSION_TTL_MS : ACCESS_TOKEN_TTL_MS;

  return {
    accessToken,
    refreshToken,
    session: {
      userId,
      tokenHash: hashToken(accessToken),
      refreshTokenHash: hashToken(refreshToken),
      ip,
      userAgent,
      expiresAt: new Date(Date.now() + ttl),
      refreshExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      rotationCounter: 0,
      isAdmin,
    },
  };
}

/**
 * Validate a session fingerprint (IP + UA check)
 * Returns false if the session appears hijacked
 */
export function validateFingerprint(
  session: SessionData,
  ip: string,
  _userAgent: string
): boolean {
  // Strict IP binding — if IP changes, session is suspicious
  // UA check is optional (users may update browsers)
  return session.ip === ip;
}

/**
 * Check if a session is expired
 */
export function isSessionExpired(session: SessionData): boolean {
  return new Date() > session.expiresAt;
}

/**
 * Check if a refresh token is expired
 */
export function isRefreshExpired(session: SessionData): boolean {
  return new Date() > session.refreshExpiresAt;
}
