import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';

const router = Router();

// ─── GET /api/v1/escalations ─────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const escalations = await prisma.sLAEscalation.findMany({
      include: {
        hire: { select: { fullName: true, jobTitle: true, department: true } },
        task: { select: { label: true, system: true, slaHours: true, owner: true } },
      },
      orderBy: { notifiedAt: 'desc' },
      take: 100,
    });

    res.json({ data: escalations, total: escalations.length });
  } catch (err) {
    console.error('[GET /escalations]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
