import { Worker } from 'bullmq';
import { prisma } from '../db.js';
import { redisConnection, slaMonitorQueue, slackNotifyQueue } from './queues.js';
import { SlackProvider } from '../integrations/SlackProvider.js';
import type { Server as IOServer } from 'socket.io';

export function startSlaMonitorWorker(io: IOServer) {
  // ── Schedule repeating job every 15 minutes ────────────────────────────
  // Add a repeating job (idempotent — BullMQ deduplicates by jobId)
  slaMonitorQueue.add(
    'sla-check',
    {},
    {
      repeat:   { every: 15 * 60 * 1000 },
      jobId:    'sla-monitor-repeating',
      removeOnComplete: { count: 5 },
      removeOnFail:     { count: 20 },
    },
  ).catch(err => console.error('[SlaMonitor] Failed to schedule repeating job:', err));

  // ── Worker ─────────────────────────────────────────────────────────────
  const worker = new Worker(
    'sla-monitor',
    async () => {
      console.log('[SlaMonitor] Running SLA check…');
      const now = new Date();

      // Find all PENDING tasks that are past their SLA window
      const overdueTasks = await prisma.taskGraph.findMany({
        where: {
          status:      'PENDING',
          completedAt: null,
          isEscalated: false,
          unlockedAt:  { not: null },
        },
        include: { hire: true },
      });

      const escalations: Array<{
        hireId:      string;
        taskId:      string;
        owner:       'HR' | 'IT' | 'MANAGER';
        overdueHours: number;
      }> = [];

      for (const task of overdueTasks) {
        if (!task.unlockedAt) continue;
        const elapsedHours = (now.getTime() - task.unlockedAt.getTime()) / 3_600_000;
        const overdueHours = Math.round(elapsedHours - task.slaHours);
        if (overdueHours <= 0) continue;

        escalations.push({
          hireId:      task.hireId,
          taskId:      task.id,
          owner:       task.owner,
          overdueHours,
        });
      }

      if (!escalations.length) {
        console.log('[SlaMonitor] No overdue tasks found.');
        return;
      }

      // Bulk update tasks to BLOCKED + isEscalated
      await prisma.$transaction([
        prisma.taskGraph.updateMany({
          where: { id: { in: escalations.map(e => e.taskId) } },
          data:  { status: 'BLOCKED', isEscalated: true },
        }),
        prisma.sLAEscalation.createMany({
          data: escalations.map(e => ({
            hireId:      e.hireId,
            taskId:      e.taskId,
            owner:       e.owner,
            overdueHours: e.overdueHours,
            notifiedAt:  now,
          })),
          skipDuplicates: true,
        }),
        // Update affected hire statuses
        prisma.hire.updateMany({
          where: { id: { in: [...new Set(escalations.map(e => e.hireId))] } },
          data:  { status: 'BLOCKED' },
        }),
      ]);

      // Emit WebSocket events
      for (const esc of escalations) {
        const task = overdueTasks.find(t => t.id === esc.taskId);
        if (!task) continue;

        io.emit('task:escalated', {
          hireId:      esc.hireId,
          hireName:    task.hire.fullName,
          taskId:      esc.taskId,
          taskLabel:   task.label,
          owner:       esc.owner,
          overdueHours: esc.overdueHours,
          slaHours:    task.slaHours,
          timestamp:   now.toISOString(),
        });

        // Queue Slack notification
        await slackNotifyQueue.add('sla-breach', {
          hireName:    task.hire.fullName,
          taskLabel:   task.label,
          owner:       esc.owner,
          overdueHours: esc.overdueHours,
          slaHours:    task.slaHours,
        });
      }

      console.log(`[SlaMonitor] Escalated ${escalations.length} task(s).`);
    },
    { connection: redisConnection, concurrency: 1 },
  );

  worker.on('completed', () => console.log('[SlaMonitor] Check complete.'));
  worker.on('failed', (job, err) => console.error(`[SlaMonitor] Job failed:`, err));

  // ── Slack notify worker ────────────────────────────────────────────────
  const slackWorker = new Worker(
    'slack-notify',
    async (job) => {
      const { hireName, taskLabel, owner, overdueHours, slaHours } = job.data;
      await SlackProvider.sendSLABreach({ hireName, taskLabel, owner, overdueHours, slaHours });
    },
    { connection: redisConnection, concurrency: 5 },
  );

  slackWorker.on('failed', (job, err) => console.error('[SlackWorker] Failed:', err));

  return { worker, slackWorker };
}
