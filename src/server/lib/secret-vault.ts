/**
 * Secret vault — AES-256-GCM at-rest encryption for sensitive ConfigEntry values
 * (api keys, webhook secrets, third-party tokens).
 *
 * Encryption key: derived from `SESSION_SECRET` via HKDF-like SHA-256 ("config-vault" salt).
 * This avoids requiring an additional CONFIG_ENCRYPTION_KEY env while still using a
 * derived key separate from the session-token HMAC namespace.
 *
 * Stored ciphertext layout: `gcm.v1.<iv-b64>.<ciphertext-b64>.<tag-b64>`
 * Plaintext is detected by missing the `gcm.v1.` prefix — supports lazy migration of
 * legacy plaintext rows: callers see plaintext via decrypt() until they call encrypt()
 * + persist.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from '../config/env';

const PREFIX = 'gcm.v1.';
const ALGO = 'aes-256-gcm';
const IV_LEN = 12; // GCM standard
const KEY_LEN = 32; // 256 bits

let _key: Buffer | null = null;

function getKey(): Buffer {
  if (_key) return _key;
  // HKDF-extract-style: SHA-256(SESSION_SECRET || 'config-vault') as the AES key.
  // This binds the vault key to SESSION_SECRET; rotating SESSION_SECRET implicitly
  // rotates the vault key. Existing encrypted rows would need re-encryption — admin
  // task; document in handoff.
  _key = createHash('sha256').update(env.SESSION_SECRET).update('config-vault').digest();
  if (_key.length !== KEY_LEN) {
    throw new Error('Vault key derivation produced wrong length');
  }
  return _key;
}

export function isCiphertext(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX.replace(/\.$/, ''),
    iv.toString('base64'),
    enc.toString('base64'),
    tag.toString('base64'),
  ].join('.');
}

export function decrypt(value: string): string {
  if (!isCiphertext(value)) {
    // Legacy plaintext row — return as-is. Caller should re-save to migrate.
    return value;
  }
  const parts = value.split('.');
  // gcm.v1.<iv>.<ct>.<tag> → 5 parts after split
  if (parts.length !== 5) {
    throw new Error('Malformed ciphertext');
  }
  const [, , ivB64, ctB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
  return dec.toString('utf8');
}
