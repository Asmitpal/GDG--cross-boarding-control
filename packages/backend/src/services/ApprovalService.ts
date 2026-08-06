import { prisma } from '../db.js';
import { ApprovalDecisionInput } from '../schemas/approvalSchema.js';
import { TaskGraphService } from './TaskGraphService.js';
import { SlackProvider } from '../integrations/SlackProvider.js';
import { idpProvisionQueue } from '../workers/queues.js';
import type { Server as IOServer } from 'socket.io';

export class ApprovalService {
  static async processDecision(
    hireId: string,
    input: ApprovalDecisionInput,
    io: IOServer,
  ) {
    const hire = await prisma.hire.findUnique({
      where: { id: hireId },
      include: { approval: true, tasks: true },
    });

    if (!hire || !hire.approval) {
      throw new Error('Hire or approval not found');
    }

    if (hire.approval.status !== 'PENDING') {
      throw new Error('Approval has already been resolved');
    }

    const now = new Date();

    if (input.decision === 'REJECTED') {
      // Reject all awaiting-approval tasks
      await prisma.$transaction([
        prisma.taskGraph.updateMany({
          where: { hireId, status: 'AWAITING_APPROVAL' },
          data:  { status: 'REJECTED' },
        }),
        prisma.approvalRequest.update({
          where: { hireId },
          data:  { status: 'REJECTED', resolvedAt: now, resolvedBy: input.resolvedBy },
        }),
        prisma.hire.update({
          where: { id: hireId },
          data:  { status: 'BLOCKED' },
        }),
      ]);

      io.emit('hire:updated', { hireId, status: 'BLOCKED' });

    } else {
      // Apply access level overrides
      const overrides = input.accessLevelOverrides ?? {};
      const updateOps = Object.entries(overrides).map(([taskId, level]) =>
        prisma.taskGraph.update({
          where: { id: taskId },
          data:  { accessLevel: level },
        }),
      );

      // Unlock all awaiting-approval tasks
      const unlockOp = prisma.taskGraph.updateMany({
        where: { hireId, status: 'AWAITING_APPROVAL' },
        data:  { status: 'PENDING', unlockedAt: now },
      });

      const budgetUpdate: Record<string, unknown> = {};
      if (input.hardwareBudget) {
        budgetUpdate['hardwareBudget'] = input.hardwareBudget;
      }

      const approvalOp = prisma.approvalRequest.update({
        where: { hireId },
        data:  { status: 'APPROVED', resolvedAt: now, resolvedBy: input.resolvedBy, ...budgetUpdate },
      });

      const hireOp = prisma.hire.update({
        where: { id: hireId },
        data:  { status: 'PROVISIONING' },
      });

      await prisma.$transaction([...updateOps, unlockOp, approvalOp, hireOp]);

      // Queue IdP provisioning jobs for each unlocked IT task
      const itTasks = hire.tasks.filter(t => t.owner === 'IT' && t.system);
      for (const task of itTasks) {
        await idpProvisionQueue.add('provision', {
          hireId,
          taskId:   task.id,
          system:   task.system,
          hireName: hire.fullName,
          level:    hire.level,
        });
      }

      io.emit('hire:updated', { hireId, status: 'PROVISIONING' });
    }

    // Notify Slack
    const updatedHire = await prisma.hire.findUnique({
      where: { id: hireId },
      include: { approval: true, tasks: true },
    });

    if (updatedHire) {
      await SlackProvider.sendApprovalResult(
        updatedHire.fullName,
        input.decision,
        input.resolvedBy,
      );

      // Update hire status in DB based on tasks
      const newStatus = TaskGraphService.deriveHireStatus(
        updatedHire.approval?.status ?? 'PENDING',
        updatedHire.tasks,
      );
      await prisma.hire.update({ where: { id: hireId }, data: { status: newStatus } });
    }

    return prisma.hire.findUnique({
      where: { id: hireId },
      include: { approval: true, tasks: true, escalations: true },
    });
  }
}
