import { z } from 'zod';
import { prisma } from '../db';
import { NotFoundError, ConflictError, ValidationError } from '../lib/errors';
import { AuditService } from './audit.service';
import { TempMailService } from './tempmail.service';
import { logger } from '../lib/logger';
import type { Actor } from '../lib/types';
import { randomHex } from '../lib/crypto';
import { DomainStatus } from '@prisma/client';
import { verifyOwnership, checkMxRecord, checkAllDns, type DnsCheckResult } from '../lib/dns.utils';

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

    // If domain exists and is NOT soft-deleted → conflict
    if (existing && !existing.deletedAt) {
      throw new ConflictError('Domain already registered');
    }

    const verificationToken = randomHex(16);

    let domain;

    if (existing && existing.deletedAt) {
      const wasVerified = existing.status === DomainStatus.VERIFIED || existing.status === DomainStatus.ARCHIVED;

      if (wasVerified) {
        // Re-activate previously verified domain — keep VERIFIED, no new token needed
        domain = await prisma.domain.update({
          where: { id: existing.id },
          data: {
            userId: actor.userId,
            status: DomainStatus.VERIFIED,
            deletedAt: null,
          },
          include: { verifications: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });

        // Register domain on Go mail server (best-effort)
        await this.registerOnGoBackend(domain.name, domain.id, actor.userId);
      } else {
        // Re-activate previously unverified domain — needs new verification
        domain = await prisma.domain.update({
          where: { id: existing.id },
          data: {
            userId: actor.userId,
            status: DomainStatus.PENDING,
            deletedAt: null,
            verifications: {
              create: {
                recordType: 'TXT',
                recordName: `_tempmail-verify.${input.name}`,
                recordValue: verificationToken,
                expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
              },
            },
          },
          include: { verifications: { where: { verified: false }, orderBy: { createdAt: 'desc' }, take: 1 } },
        });
      }
    } else {
      domain = await prisma.domain.create({
        data: {
          name: input.name,
          userId: actor.userId,
          status: DomainStatus.PENDING,
          verifications: {
            create: {
              recordType: 'TXT',
              recordName: `_tempmail-verify.${input.name}`,
              recordValue: verificationToken,
              expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
            },
          },
        },
        include: { verifications: true },
      });
    }

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
      verification: domain.verifications?.[0] ? {
        recordType: domain.verifications[0].recordType,
        recordName: domain.verifications[0].recordName,
        recordValue: domain.verifications[0].recordValue,
        expiresAt: domain.verifications[0].expiresAt,
      } : null,
    };
  },

  async listByUser(userId: string) {
    const domains = await prisma.domain.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { mailboxes: true } },
        verifications: { orderBy: { createdAt: 'desc' as const }, take: 1 },
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
   * 5. Also check MX (informational, does not block verify)
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
      // If domain is already VERIFIED, try to register on Go backend
      if (domain.status === DomainStatus.VERIFIED) {
        const mxResult = await checkMxRecord(domain.name);
        await this.registerOnGoBackend(domain.name, domain.id, actor.userId);
        return {
          verified: true,
          checks: {
            ownership: { found: true, error: undefined },
            mx: mxResult,
          },
        };
      }
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
        },
        error: 'expired',
      };
    }

    // Real DNS lookup — isolated, max 3s timeout, circuit breaker protected
    // Run ownership + MX all in parallel for best latency
    const [ownershipResult, mxResult] = await Promise.all([
      verifyOwnership(domain.name, verification.recordValue),
      checkMxRecord(domain.name),
    ]);

    const dnsChecks: DnsCheckResult = {
      ownership: { found: ownershipResult.verified, error: ownershipResult.error },
      mx: mxResult,
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
        after: { status: 'VERIFIED', mx: mxResult.pointsToUs },
      });

      // Register domain on Go mail server (best-effort)
      await this.registerOnGoBackend(domain.name, domain.id, actor.userId);

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
   * Returns current state of Ownership TXT and MX records.
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

  /**
   * Register domain on Go mail server (best-effort).
   * If the API call fails, domain remains VERIFIED locally but won't receive mail.
   */
  async registerOnGoBackend(domainName: string, domainId: string, userId?: string): Promise<void> {
    try {
      console.log(`[GO-REGISTER] Starting registration for domain: ${domainName} (id: ${domainId}, userId: ${userId || 'none'})`);
      
      // Check if domain already exists on Go backend
      const { domains } = await TempMailService.listDomains();
      console.log(`[GO-REGISTER] Found ${domains.length} domains on Go backend`);
      const existing = domains.find(d => d.domainName === domainName);

      if (existing) {
        // Fix: if domain was incorrectly registered as public (no tenantId),
        // delete and recreate with tenantId so Go marks it private.
        // Go API updateDomain does NOT support changing tenantId.
        if (existing.isPublic && userId) {
          try {
            console.log(`[GO-REGISTER] Domain ${domainName} is public on Go backend, recreating with tenantId...`);
            await TempMailService.removeDomain(existing.id);
            const recreated = await TempMailService.addDomain(domainName, userId);
            console.log(`[GO-REGISTER] Domain ${domainName} recreated as private (${recreated.domain.id})`);

            await prisma.domain.update({
              where: { id: domainId },
              data: { metadata: { externalId: recreated.domain.id } },
            });

            logger.info(`Domain ${domainName} recreated as private on Go backend (${recreated.domain.id})`);
            return;
          } catch (err: any) {
            console.warn(`[GO-REGISTER] Failed to recreate domain ${domainName} as private:`, err.message);
          }
        }

        // Already registered correctly — store externalId if not yet stored
        await prisma.domain.update({
          where: { id: domainId },
          data: { metadata: { externalId: existing.id } },
        });

        console.log(`[GO-REGISTER] Domain ${domainName} already registered on Go backend (${existing.id})`);
        logger.info(`Domain ${domainName} already registered on Go backend (${existing.id})`);
        return;
      }

      // Register new domain — pass userId as tenantId so Go marks it private
      console.log(`[GO-REGISTER] Calling POST /v1/domains for: ${domainName} (tenantId: ${userId || 'none'})`);
      const result = await TempMailService.addDomain(domainName, userId);
      console.log(`[GO-REGISTER] SUCCESS! Domain registered with id: ${result.domain.id}, isPublic: ${result.domain.isPublic}`);
      
      // Store externalId for future reference
      await prisma.domain.update({
        where: { id: domainId },
        data: { metadata: { externalId: result.domain.id } },
      });

      logger.info(`Domain ${domainName} registered on Go backend (${result.domain.id})`);
    } catch (error: any) {
      // Log visibly so we can debug
      console.error(`[GO-REGISTER] FAILED to register domain ${domainName}:`, error.message, error.stack);
      logger.error(`Failed to register domain ${domainName} on Go backend: ${error.message}`);
    }
  },
};
