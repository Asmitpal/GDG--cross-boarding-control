import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { TaskGraphService } from '../services/TaskGraphService.js';
import { SlackProvider } from '../integrations/SlackProvider.js';
import { CreateHireSchema } from '../schemas/hireSchema.js';
import { ZodError } from 'zod';

const router = Router();

// ─── POST /api/v1/hires ───────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const input = CreateHireSchema.parse(req.body);
    const hire  = await TaskGraphService.createHireWithGraph(input);

    // Notify Slack that an approval is needed
    await SlackProvider.sendApprovalRequest(hire.fullName, hire.jobTitle, hire.managerName);

    res.status(201).json({ data: hire });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation error', issues: err.errors });
      return;
    }
    console.error('[POST /hires]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/hires ────────────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const hires = await prisma.hire.findMany({
      include: { approval: true, tasks: true },
      orderBy: { createdAt: 'desc' },
    });

    const data = hires.map(hire => {
      const readiness = TaskGraphService.computeReadiness(hire.tasks);
      const status    = TaskGraphService.deriveHireStatus(
        hire.approval?.status ?? 'PENDING',
        hire.tasks,
      );
      const ownerProgress = (['HR', 'IT', 'MANAGER'] as const).reduce<Record<string, { pct: number; state: string }>>((acc, owner) => {
        const ownerTasks = hire.tasks.filter(t => t.owner === owner && t.status !== 'REJECTED');
        if (!ownerTasks.length) { acc[owner] = { pct: 100, state: 'green' }; return acc; }
        const done    = ownerTasks.filter(t => t.status === 'DONE').length;
        const blocked = ownerTasks.some(t => t.status === 'BLOCKED');
        const waiting = ownerTasks.some(t => t.status === 'AWAITING_APPROVAL');
        acc[owner] = {
          pct:   Math.round((done / ownerTasks.length) * 100),
          state: blocked ? 'red' : (waiting ? 'amber' : 'green'),
        };
        return acc;
      }, {});

      return { ...hire, readiness, derivedStatus: status, ownerProgress };
    });

    res.json({ data, total: data.length });
  } catch (err) {
    console.error('[GET /hires]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/hires/:id ────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const hire = await prisma.hire.findUnique({
      where:   { id: req.params['id'] },
      include: { approval: true, tasks: { orderBy: { createdAt: 'asc' } }, escalations: { orderBy: { notifiedAt: 'desc' } } },
    });

    if (!hire) { res.status(404).json({ error: 'Hire not found' }); return; }

    const readiness = TaskGraphService.computeReadiness(hire.tasks);
    const status    = TaskGraphService.deriveHireStatus(hire.approval?.status ?? 'PENDING', hire.tasks);

    // Group tasks by owner
    const tasksByOwner = (['HR', 'IT', 'MANAGER'] as const).reduce<Record<string, typeof hire.tasks>>((acc, owner) => {
      acc[owner] = hire.tasks.filter(t => t.owner === owner);
      return acc;
    }, {});

    res.json({ data: { ...hire, readiness, derivedStatus: status, tasksByOwner } });
  } catch (err) {
    console.error('[GET /hires/:id]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
