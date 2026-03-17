import { z } from 'zod';
import { prisma } from '../db';
import { NotFoundError, ConflictError, ValidationError } from '../lib/errors';
import { AuditService } from './audit.service';
import type { Actor } from '../lib/types';
import { randomHex } from '../lib/crypto';
import { DomainStatus } from '@prisma/client';
import { verifyOwnership, checkMxRecord, checkSpfRecord, checkAllDns, type DnsCheckResult } from '../lib/dns.utils';

// ─── Input Schemas ──────────────────────────────

export const createDomainSchema = z.object({
  name: z.string().min(4).max(253).regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Invalid domain format'),
});

export const verifyDomainSchema = z.object({
  domainId: z.string(),
});

export const checkDnsSchema = z.object({
  domainId: z.string(),
});

// ─── Types ──────────────────────────────────────

export interface VerifyResult {
  verified: boolean;
  checks: DnsCheckResult;
  error?: string;
}

// ─── Service ────────────────────────────────────

export const DomainService = {
  async create(input: z.infer<typeof createDomainSchema>, actor: Actor, meta?: { requestId?: string }) {
    const existing = await prisma.domain.findUnique({
      where: { name: input.name },
    });

    if (existing) {
      throw new ConflictError('Domain already registered');
    }

    const verificationToken = randomHex(16);

    const domain = await prisma.domain.create({
      data: {
        name: input.name,
        userId: actor.userId,
        status: DomainStatus.PENDING,
        verifications: {
          create: {
            recordType: 'TXT',
            recordName: `_tempmail-verify.${input.name}`,
            recordValue: verificationToken,
            expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
          },
        },
      },
      include: { verifications: true },
    });

    await AuditService.log({
      actorId: actor.userId,
      actorType: 'user',
      action: 'domain.create',
      targetType: 'domain',
      targetId: domain.id,
      after: { name: input.name },
      requestId: meta?.requestId,
    });

    return {
      id: domain.publicId,
      name: domain.name,
      status: domain.status,
      verification: {
        recordType: domain.verifications[0].recordType,
        recordName: domain.verifications[0].recordName,
        recordValue: domain.verifications[0].recordValue,
        expiresAt: domain.verifications[0].expiresAt,
      },
    };
  },

  async listByUser(userId: string) {
    const domains = await prisma.domain.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { mailboxes: true } },
        verifications: { where: { verified: false } },
      },
    });

    return domains.map((d) => ({
      id: d.publicId,
      name: d.name,
      status: d.status,
      isSystem: d.isSystem,
      catchAll: d.catchAll,
      mailboxCount: d._count.mailboxes,
      createdAt: d.createdAt,
      verification: d.verifications[0] ? {
        recordType: d.verifications[0].recordType,
        recordName: d.verifications[0].recordName,
        recordValue: d.verifications[0].recordValue,
      } : null,
    }));
  },

  /**
   * Verify domain ownership via real DNS TXT record lookup.
   *
   * Flow:
   * 1. Find domain + pending verification
   * 2. Check expiry (72h from creation)
   * 3. DNS lookup: _tempmail-verify.<domain> for the expected token
   * 4. If found → mark verified in DB, update domain status, log audit
   * 5. Also check MX + SPF (informational, does not block verify)
   *
   * Resilience: DNS failure = { verified: false } — never crashes
   */
  async verify(domainPublicId: string, actor: Actor): Promise<VerifyResult> {
    const domain = await prisma.domain.findUnique({
      where: { publicId: domainPublicId },
      include: { verifications: { where: { verified: false } } },
    });

    if (!domain || domain.userId !== actor.userId) {
      throw new NotFoundError('Domain');
    }

    if (domain.verifications.length === 0) {
      throw new ValidationError('No pending verifications');
    }

    const verification = domain.verifications[0];

    // Check expiry
    if (verification.expiresAt < new Date()) {
      return {
        verified: false,
        checks: {
          ownership: { found: false, error: 'Verification token expired — please delete and re-add the domain' },
          mx: { found: false, pointsToUs: false },
          spf: { found: false, includesUs: false },
        },
        error: 'expired',
      };
    }

    // Real DNS lookup — isolated, max 3s timeout, circuit breaker protected
    // Run ownership + MX + SPF all in parallel for best latency
    const [ownershipResult, mxResult, spfResult] = await Promise.all([
      verifyOwnership(domain.name, verification.recordValue),
      checkMxRecord(domain.name),
      checkSpfRecord(domain.name),
    ]);

    const dnsChecks: DnsCheckResult = {
      ownership: { found: ownershipResult.verified, error: ownershipResult.error },
      mx: mxResult,
      spf: spfResult,
    };

    if (ownershipResult.verified) {
      // ═══ SUCCESS: Mark verified in DB ═══
      await prisma.$transaction([
        prisma.domainVerification.update({
          where: { id: verification.id },
          data: { verified: true, verifiedAt: new Date() },
        }),
        prisma.domain.update({
          where: { id: domain.id },
          data: { status: DomainStatus.VERIFIED },
        }),
      ]);

      await AuditService.log({
        actorId: actor.userId,
        actorType: 'user',
        action: 'domain.verify',
        targetType: 'domain',
        targetId: domain.id,
        after: { status: 'VERIFIED', mx: mxResult.pointsToUs, spf: spfResult.includesUs },
      });

      return { verified: true, checks: dnsChecks };
    }

    // ═══ FAIL: Token not found — return status, don't throw ═══
    return {
      verified: false,
      checks: dnsChecks,
      error: ownershipResult.error || 'not_found',
    };
  },

  /**
   * Check DNS status for a domain without modifying verification.
   * Returns current state of Ownership TXT, MX, and SPF records.
   * Completely non-destructive — read-only DNS check.
   */
  async checkDns(domainPublicId: string, actor: Actor): Promise<DnsCheckResult> {
    const domain = await prisma.domain.findUnique({
      where: { publicId: domainPublicId },
      include: {
        // Include ALL verifications (not just unverified) so we can re-check ownership
        verifications: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!domain || domain.userId !== actor.userId) {
      throw new NotFoundError('Domain');
    }

    const token = domain.verifications[0]?.recordValue;
    return checkAllDns(domain.name, token);
  },

  /** Delete a domain (soft delete) */
  async delete(domainPublicId: string, actor: Actor, meta?: { requestId?: string }) {
    const domain = await prisma.domain.findUnique({
      where: { publicId: domainPublicId },
    });

    if (!domain || domain.userId !== actor.userId) {
      throw new NotFoundError('Domain');
    }

    await prisma.domain.update({
      where: { id: domain.id },
      data: { 
        deletedAt: new Date(),
        status: DomainStatus.ARCHIVED
      },
    });

    await AuditService.log({
      actorId: actor.userId,
      actorType: 'user',
      action: 'domain.delete',
      targetType: 'domain',
      targetId: domain.id,
      after: { status: 'ARCHIVED' },
      requestId: meta?.requestId,
    });

    return { success: true };
  },
};
