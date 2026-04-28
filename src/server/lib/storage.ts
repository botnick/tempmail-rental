/**
 * Object storage — Cloudflare R2 via the S3-compatible API.
 *
 * Configuration: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
 * If unset, this module throws — callers must handle (e.g. attachment download
 * route returns 503 "storage not configured" up-front).
 *
 * No fallback to local-disk or in-memory storage on purpose: the user requires
 * a single correct path. Configure R2 properly or leave attachment features off.
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { logger } from './logger';

let _client: S3Client | null = null;

function client(): S3Client {
  if (_client) return _client;
  if (
    !env.R2_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_BUCKET
  ) {
    throw new Error(
      'Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET in .env.'
    );
  }
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

export function isStorageConfigured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET
  );
}

/** Upload an object. Returns the storage key on success. */
export async function putObject(
  key: string,
  body: Uint8Array | Buffer,
  contentType: string
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: env.R2_BUCKET!,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  await client().send(cmd);
  logger.debug('storage.put', { key, size: body.byteLength, contentType });
  return key;
}

/** Generate a presigned URL for downloading an object. Default TTL 5 minutes. */
export async function presignDownload(
  storageKey: string,
  filename: string,
  contentType: string,
  ttlSeconds = 300
): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: env.R2_BUCKET!,
    Key: storageKey,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
    ResponseContentType: contentType,
  });
  return getSignedUrl(client(), cmd, { expiresIn: ttlSeconds });
}

/** Build an S3 key for an attachment. Stable, content-addressed-ish layout. */
export function attachmentKey(
  mailboxId: string,
  messageExternalId: string,
  filenameHash: string,
  filename: string
): string {
  // Strip path separators from filename to keep the key safe.
  const safeName = filename.replace(/[\/\\]/g, '_');
  return `mailboxes/${mailboxId}/messages/${messageExternalId}/${filenameHash}-${safeName}`;
}
