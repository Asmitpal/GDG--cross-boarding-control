import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { UpdateRulesSchema } from '../schemas/taskSchema.js';
import { ZodError } from 'zod';

const router = Router();

// ─── GET /api/v1/rules ───────────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = await prisma.ruleConfig.findFirst({ orderBy: { updatedAt: 'desc' } });
    if (!config) { res.status(404).json({ error: 'No rule config found' }); return; }
    res.json({ data: config });
  } catch (err) {
    console.error('[GET /rules]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/v1/rules ───────────────────────────────────────────────────────
router.put('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const input   = UpdateRulesSchema.parse(req.body);
    const current = await prisma.ruleConfig.findFirst({ orderBy: { updatedAt: 'desc' } });

    let updated;
    if (current) {
      updated = await prisma.ruleConfig.update({
        where: { id: current.id },
        data: {
          ...(input.departments && { departments: input.departments }),
          ...(input.deviceTiers && { deviceTiers: input.deviceTiers }),
          ...(input.sla         && { sla:         input.sla         }),
        },
      });
    } else {
      updated = await prisma.ruleConfig.create({
        data: {
          departments: input.departments ?? {},
          deviceTiers: input.deviceTiers ?? {},
          sla:         input.sla         ?? {},
        },
      });
    }

    res.json({ data: updated });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation error', issues: err.errors });
      return;
    }
    console.error('[PUT /rules]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
