/**
 * Auth Internals — Argon2id Password Hashing
 *
 * Security properties:
 * - Argon2id (hybrid: side-channel + GPU resistant)
 * - Pepper via ARGON2_SECRET env var
 * - Configurable time/memory/parallelism cost
 * - Constant-time comparison to prevent timing attacks
 */

import argon2 from 'argon2';

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,   // 64MB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};

function getPepper(): Buffer | undefined {
  const secret = process.env.ARGON2_SECRET;
  return secret ? Buffer.from(secret, 'utf-8') : undefined;
}

/**
 * Hash a plaintext password using Argon2id with pepper
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, {
    ...ARGON2_OPTIONS,
    secret: getPepper(),
  });
}

/**
 * Verify a plaintext password against an Argon2id hash
 * Returns boolean, safe against timing attacks
 */
export async function verifyPassword(
  hash: string,
  plaintext: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext, {
      secret: getPepper(),
    });
  } catch {
    // If hash is corrupted or incompatible, return false
    return false;
  }
}

/**
 * Check if a hash needs rehashing (e.g. cost params changed)
 */
export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, ARGON2_OPTIONS);
}
