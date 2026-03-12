import { z } from 'zod';
import { prisma } from '../db';
import { NotFoundError, ConflictError, ValidationError } from '../lib/errors';
import { AuditService } from './audit.service';
import type { Actor } from '../lib/types';
import { randomHex } from '../lib/crypto';
import { DomainStatus } from '@prisma/client';

// ─── Input Schemas ──────────────────────────────

export const createDomainSchema = z.object({
  name: z.string().min(4).max(253).regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Invalid domain format'),
});

export const verifyDomainSchema = z.object({
  domainId: z.string(),
});

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
    }));
  },

  /** Verify domain ownership via DNS TXT record lookup (structure — actual DNS check would be a background job) */
  async verify(domainPublicId: string, actor: Actor) {
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

    // NOTE: In production, this would trigger a DNS lookup background job.
    // For now, we mark it as needing verification and return the record to set.
    return {
      id: domain.publicId,
      name: domain.name,
      verification: domain.verifications[0],
      message: 'Please add the TXT record to your DNS and retry verification.',
    };
  },
};
