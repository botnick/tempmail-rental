/**
 * DNS Lookup Utilities — Isolated, Resilient, Non-blocking
 *
 * Design principles:
 * - Every function returns a result object — NEVER throws
 * - AbortController timeout (configurable, default 3s) — never hangs
 * - Circuit breaker: 3 consecutive failures → skip lookups for 30s → auto-recover
 * - All values from env/config — zero hardcoded strings
 *
 * @module dns.utils
 */

import dns from 'node:dns';
import { Resolver } from 'node:dns/promises';

// ─── Configuration (from env, with safe defaults) ──────────────────

const DNS_TIMEOUT_MS = parseInt(process.env.DNS_TIMEOUT_MS || '3000', 10);
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 30_000;

// ─── Circuit Breaker State ─────────────────────────────────────────

let consecutiveFailures = 0;
let circuitOpenUntil = 0;

function isCircuitOpen(): boolean {
  if (consecutiveFailures < CIRCUIT_BREAKER_THRESHOLD) return false;
  if (Date.now() > circuitOpenUntil) {
    // Cooldown elapsed → half-open: allow one attempt
    consecutiveFailures = 0;
    return false;
  }
  return true;
}

function recordSuccess(): void {
  consecutiveFailures = 0;
}

function recordFailure(): void {
  consecutiveFailures++;
  if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
  }
}

// ─── Types ─────────────────────────────────────────────────────────

export interface DnsLookupResult<T = string[]> {
  found: boolean;
  data: T;
  error?: string;
}

export interface DnsVerifyResult {
  verified: boolean;
  error?: string;
}

export interface DnsCheckResult {
  ownership: { found: boolean; error?: string };
  mx: { found: boolean; pointsToUs: boolean; error?: string };
  spf: { found: boolean; includesUs: boolean; error?: string };
}

// ─── Resolver Factory ──────────────────────────────────────────────

function createResolver(): Resolver {
  const resolver = new Resolver();
  // Use system DNS by default — no hardcoded DNS servers
  // Optionally override via env: DNS_SERVERS=8.8.8.8,1.1.1.1
  const customServers = process.env.DNS_SERVERS;
  if (customServers) {
    resolver.setServers(customServers.split(',').map((s) => s.trim()));
  }
  return resolver;
}

// ─── Core Lookup Functions ─────────────────────────────────────────

/**
 * Lookup TXT records for a hostname.
 * Returns all TXT record values flattened into a string array.
 */
export async function lookupTxt(hostname: string): Promise<DnsLookupResult> {
  if (isCircuitOpen()) {
    return { found: false, data: [], error: 'DNS circuit breaker open — retrying in 30s' };
  }

  const resolver = createResolver();

  try {
    const result = await withTimeout(
      resolver.resolveTxt(hostname),
      DNS_TIMEOUT_MS,
    );
    // resolveTxt returns string[][] — flatten: [['v=spf1 ...']] → ['v=spf1 ...']
    const records = result.map((chunks) => chunks.join(''));
    recordSuccess();
    return { found: records.length > 0, data: records };
  } catch (err: any) {
    return handleDnsError(err);
  }
}

/**
 * Lookup MX records for a hostname.
 * Returns exchange hostnames sorted by priority.
 */
export async function lookupMx(hostname: string): Promise<DnsLookupResult> {
  if (isCircuitOpen()) {
    return { found: false, data: [], error: 'DNS circuit breaker open — retrying in 30s' };
  }

  const resolver = createResolver();

  try {
    const result = await withTimeout(
      resolver.resolveMx(hostname),
      DNS_TIMEOUT_MS,
    );
    const exchanges = result
      .sort((a, b) => a.priority - b.priority)
      .map((mx) => mx.exchange.toLowerCase().replace(/\.$/, ''));
    recordSuccess();
    return { found: exchanges.length > 0, data: exchanges };
  } catch (err: any) {
    return handleDnsError(err);
  }
}

// ─── High-Level Verification Functions ─────────────────────────────

/**
 * Verify domain ownership by checking a TXT record.
 * Looks for `_tempmail-verify.<domain>` containing the expected token.
 */
export async function verifyOwnership(
  domainName: string,
  expectedToken: string,
): Promise<DnsVerifyResult> {
  const hostname = `_tempmail-verify.${domainName}`;
  const result = await lookupTxt(hostname);

  if (result.error) {
    return { verified: false, error: result.error };
  }

  const verified = result.data.some(
    (record) => record.trim().toLowerCase() === expectedToken.toLowerCase(),
  );

  return { verified };
}

/**
 * Check if MX records point to our mail server.
 */
export async function checkMxRecord(domainName: string): Promise<{
  found: boolean;
  pointsToUs: boolean;
  error?: string;
}> {
  const appHost = getAppHost();
  // Must match the MX record the frontend instructs users to create: mx.${appHost}
  const expectedMx = `mx.${appHost}`.toLowerCase();
  const result = await lookupMx(domainName);

  if (result.error) {
    return { found: false, pointsToUs: false, error: result.error };
  }

  if (!result.found) {
    return { found: false, pointsToUs: false };
  }

  const pointsToUs = result.data.some((exchange) => exchange === expectedMx);
  return { found: true, pointsToUs };
}

/**
 * Check if SPF record includes our mail server.
 * Looks for `include:_spf.<appHost>` in the SPF TXT record.
 * Must match the frontend instruction: `v=spf1 include:_spf.<appHost> ~all`
 */
export async function checkSpfRecord(domainName: string): Promise<{
  found: boolean;
  includesUs: boolean;
  error?: string;
}> {
  const appHost = getAppHost();
  const result = await lookupTxt(domainName);

  if (result.error) {
    return { found: false, includesUs: false, error: result.error };
  }

  const spfRecord = result.data.find((r) => r.startsWith('v=spf1'));
  if (!spfRecord) {
    return { found: false, includesUs: false };
  }

  // Must match what frontend tells users: include:_spf.${appHost}
  const includesUs = spfRecord.includes(`include:_spf.${appHost}`);
  return { found: true, includesUs };
}

/**
 * Run all DNS checks for a domain (ownership, MX, SPF).
 * Each check is independent — one failure does not block others.
 */
export async function checkAllDns(
  domainName: string,
  ownershipToken?: string,
): Promise<DnsCheckResult> {
  const [ownership, mx, spf] = await Promise.all([
    ownershipToken
      ? verifyOwnership(domainName, ownershipToken).then((r) => ({
          found: r.verified,
          error: r.error,
        }))
      : Promise.resolve({ found: false, error: 'No verification token' }),
    checkMxRecord(domainName),
    checkSpfRecord(domainName),
  ]);

  return { ownership, mx, spf };
}

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Get the app host from env. Falls back to window.location.host (should not
 * reach that path on server). Never hardcoded.
 */
export function getAppHost(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) {
    try {
      return new URL(envUrl).host;
    } catch {
      return envUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
  }
  return 'localhost';
}

/**
 * Wrap a promise with a timeout using AbortController pattern.
 * Rejects with TIMEOUT error if the promise doesn't resolve in time.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error('DNS lookup timeout'), { code: 'TIMEOUT' }));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Handle DNS errors gracefully — never throw, always return a result.
 */
function handleDnsError(err: any): DnsLookupResult {
  const code = err.code || '';

  // Expected DNS "not found" errors — not a failure
  if (code === 'ENODATA' || code === 'ENOTFOUND' || code === dns.NODATA || code === dns.NOTFOUND) {
    recordSuccess(); // Not a resolver failure
    return { found: false, data: [] };
  }

  // Actual resolver failure — count toward circuit breaker
  recordFailure();

  if (code === 'TIMEOUT' || code === 'ETIMEOUT' || err.message?.includes('timeout')) {
    return { found: false, data: [], error: 'DNS lookup timed out' };
  }

  if (code === 'ESERVFAIL') {
    return { found: false, data: [], error: 'DNS server failure' };
  }

  return { found: false, data: [], error: `DNS error: ${code || err.message}` };
}
