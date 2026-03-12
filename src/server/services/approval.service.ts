/**
 * Approval Service — High-Risk Action Governance
 *
 * Provides a workflow for actions that require a second approver
 * before execution. Uses the existing AdminAction model which has
 * requiresApproval, approvedBy, and approvedAt fields.
 *
 * Flow:
 * 1. Requester calls `requestApproval(...)` → AdminAction created with requiresApproval=true
 * 2. Approver calls `approveAction(...)` → approvedBy/approvedAt set
 * 3. System calls `executeIfApproved(...)` → checks approval status before executing
 *
 * Rules:
 * - Approver cannot be the same person as requester for high-risk actions
 * - Rejection is recorded with reason
 * - Full audit trail for request → approval/rejection → execution
 */

import { prisma } from '../db';
import { AuditService } from './audit.service';
import { AppError, AuthorizationError } from '../lib/errors';
import { logger } from '../lib/logger';

/** Actions that require approval before execution */
export const APPROVAL_REQUIRED_ACTIONS = new Set([
  'admin.billing.adjust',
  'admin.billing.refund',
  'admin.pricing.change',
  'admin.user.mass_suspend',
  'admin.domain.suspend',
  'admin.security.kill_switch',
  'admin.user.role_elevate_admin',
  'admin.config.high_risk_change',
]);

/** Whether an action requires approval */
export function requiresApproval(action: string): boolean {
  return APPROVAL_REQUIRED_ACTIONS.has(action);
}

export const ApprovalService = {
  /**
   * Request approval for a high-risk action.
   * Creates a pending AdminAction record.
   */
  async requestApproval(params: {
    adminId: string;
    action: string;
    targetType?: string;
    targetId?: string;
    reason: string;
    metadata?: Record<string, unknown>;
    requestId?: string;
  }) {
    const adminAction = await prisma.adminAction.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        reason: params.reason,
        requiresApproval: true,
        metadata: params.metadata as object,
      },
    });

    await AuditService.logAdminAction({
      adminId: params.adminId,
      action: `${params.action}.requested`,
      targetType: params.targetType,
      targetId: params.targetId,
      reason: params.reason,
      metadata: { approvalRequestId: adminAction.id },
      requestId: params.requestId,
    });

    logger.info('Approval requested', {
      approvalId: adminAction.id,
      action: params.action,
      requestedBy: params.adminId,
    });

    return { id: adminAction.id, status: 'pending' };
  },

  /**
   * Approve a pending action.
   * Enforces: approver ≠ requester for safety.
   */
  async approveAction(params: {
    approvalId: string;
    approverId: string;
    requestId?: string;
  }) {
    const action = await prisma.adminAction.findUnique({
      where: { id: params.approvalId },
    });

    if (!action) {
      throw new AppError('Approval request not found', 'NOT_FOUND', 404);
    }

    if (action.approvedAt) {
      throw new AppError('Already processed', 'CONFLICT', 409);
    }

    if (!action.requiresApproval) {
      throw new AppError('This action does not require approval', 'VALIDATION', 400);
    }

    // Self-approval prevention
    if (action.adminId === params.approverId) {
      throw new AuthorizationError(
        'Self-approval is not allowed — a different admin must approve'
      );
    }

    await prisma.adminAction.update({
      where: { id: params.approvalId },
      data: {
        approvedBy: params.approverId,
        approvedAt: new Date(),
      },
    });

    await AuditService.logAdminAction({
      adminId: params.approverId,
      action: `${action.action}.approved`,
      targetType: action.targetType ?? undefined,
      targetId: action.targetId ?? undefined,
      reason: `Approved action by ${action.adminId}: ${action.reason}`,
      metadata: { approvalRequestId: params.approvalId },
      requestId: params.requestId,
    });

    logger.info('Action approved', {
      approvalId: params.approvalId,
      action: action.action,
      approvedBy: params.approverId,
    });

    return { id: params.approvalId, status: 'approved' };
  },

  /**
   * Reject a pending action.
   * Records rejection reason in metadata.
   */
  async rejectAction(params: {
    approvalId: string;
    rejectedBy: string;
    rejectionReason: string;
    requestId?: string;
  }) {
    const action = await prisma.adminAction.findUnique({
      where: { id: params.approvalId },
    });

    if (!action) {
      throw new AppError('Approval request not found', 'NOT_FOUND', 404);
    }

    if (action.approvedAt) {
      throw new AppError('Already processed', 'CONFLICT', 409);
    }

    // Mark as rejected by setting approvedBy but no approvedAt — and store rejection in metadata
    await prisma.adminAction.update({
      where: { id: params.approvalId },
      data: {
        requiresApproval: false, // Close the request
        metadata: {
          ...(action.metadata as object ?? {}),
          rejected: true,
          rejectedBy: params.rejectedBy,
          rejectedAt: new Date().toISOString(),
          rejectionReason: params.rejectionReason,
        },
      },
    });

    await AuditService.logAdminAction({
      adminId: params.rejectedBy,
      action: `${action.action}.rejected`,
      targetType: action.targetType ?? undefined,
      targetId: action.targetId ?? undefined,
      reason: params.rejectionReason,
      metadata: { approvalRequestId: params.approvalId },
      requestId: params.requestId,
    });

    logger.info('Action rejected', {
      approvalId: params.approvalId,
      action: action.action,
      rejectedBy: params.rejectedBy,
    });

    return { id: params.approvalId, status: 'rejected' };
  },

  /**
   * Check if an action is approved and safe to execute.
   * Returns the AdminAction if approved, throws otherwise.
   */
  async assertApproved(approvalId: string) {
    const action = await prisma.adminAction.findUnique({
      where: { id: approvalId },
    });

    if (!action) {
      throw new AppError('Approval request not found', 'NOT_FOUND', 404);
    }

    if (!action.approvedAt || !action.approvedBy) {
      throw new AppError(
        'Action not yet approved — approval required before execution',
        'PRECONDITION_FAILED',
        412
      );
    }

    // Check if rejected
    const meta = action.metadata as Record<string, unknown> | null;
    if (meta?.rejected) {
      throw new AppError('Action was rejected and cannot be executed', 'FORBIDDEN', 403);
    }

    return action;
  },

  /**
   * List pending approval requests.
   */
  async listPending(options?: { take?: number; skip?: number }) {
    const [items, total] = await Promise.all([
      prisma.adminAction.findMany({
        where: {
          requiresApproval: true,
          approvedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: options?.take ?? 50,
        skip: options?.skip ?? 0,
      }),
      prisma.adminAction.count({
        where: {
          requiresApproval: true,
          approvedAt: null,
        },
      }),
    ]);

    return { items, total };
  },
};
