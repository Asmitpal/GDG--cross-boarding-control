import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { TaskGraphService } from '../services/TaskGraphService.js';
import { ToggleTaskSchema } from '../schemas/taskSchema.js';
import { ZodError } from 'zod';
import type { Server as IOServer } from 'socket.io';

export function createTasksRouter(io: IOServer): Router {
  const router = Router();

  // ─── PATCH /api/v1/tasks/:id ────────────────────────────────────────────
  router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const input = ToggleTaskSchema.parse(req.body);
      const task  = await prisma.taskGraph.findUnique({ where: { id: req.params['id'] } });

      if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
      if (task.status === 'AWAITING_APPROVAL' || task.status === 'REJECTED') {
        res.status(409).json({ error: 'Cannot toggle a task in this state' });
        return;
      }

      const now       = new Date();
      const completed = input.completed ? now : null;

      // Recompute status
      let newStatus: 'DONE' | 'PENDING' | 'BLOCKED' = 'PENDING';
      if (completed) {
        newStatus = 'DONE';
      } else if (task.unlockedAt) {
        const elapsedHours = (Date.now() - task.unlockedAt.getTime()) / 3_600_000;
        newStatus = elapsedHours > task.slaHours ? 'BLOCKED' : 'PENDING';
      }

      const updated = await prisma.taskGraph.update({
        where: { id: task.id },
        data:  { completedAt: completed, status: newStatus },
      });

      // Recompute hire-level status
      const allTasks = await prisma.taskGraph.findMany({ where: { hireId: task.hireId } });
      const hire     = await prisma.hire.findUnique({ where: { id: task.hireId }, include: { approval: true } });
      if (hire) {
        const derivedStatus = TaskGraphService.deriveHireStatus(
          hire.approval?.status ?? 'PENDING',
          allTasks,
        );
        await prisma.hire.update({ where: { id: task.hireId }, data: { status: derivedStatus } });
        io.emit('hire:updated', { hireId: task.hireId, status: derivedStatus });
      }

      res.json({ data: updated });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Validation error', issues: err.errors });
        return;
      }
      console.error('[PATCH /tasks/:id]', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
