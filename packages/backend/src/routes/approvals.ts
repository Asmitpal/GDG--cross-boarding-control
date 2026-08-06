import { Router, Request, Response } from 'express';
import { ApprovalService } from '../services/ApprovalService.js';
import { ApprovalDecisionSchema } from '../schemas/approvalSchema.js';
import { ZodError } from 'zod';
import type { Server as IOServer } from 'socket.io';

export function createApprovalsRouter(io: IOServer): Router {
  const router = Router({ mergeParams: true });

  // ─── POST /api/v1/hires/:id/approval ───────────────────────────────────
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const input = ApprovalDecisionSchema.parse(req.body);
      const hire  = await ApprovalService.processDecision(req.params['id']!, input, io);

      io.emit('hire:updated', { hireId: req.params['id'], status: hire?.status });
      res.json({ data: hire });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Validation error', issues: err.errors });
        return;
      }
      if (err instanceof Error && err.message.includes('not found')) {
        res.status(404).json({ error: err.message });
        return;
      }
      if (err instanceof Error && err.message.includes('already been resolved')) {
        res.status(409).json({ error: err.message });
        return;
      }
      console.error('[POST /approval]', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
