import { Router, Request, Response } from 'express';
import { TaskGraphService } from '../services/TaskGraphService.js';
import { SlackProvider } from '../integrations/SlackProvider.js';
import { HRISWebhookSchema } from '../schemas/hireSchema.js';
import { ZodError } from 'zod';

const router = Router();

// ─── POST /api/v1/webhooks/hris ──────────────────────────────────────────────
// Accepts hire.created events from Workday / BambooHR
router.post('/hris', async (req: Request, res: Response): Promise<void> => {
  try {
    const webhook = HRISWebhookSchema.parse(req.body);

    if (webhook.event !== 'hire.created') {
      res.json({ message: `Event "${webhook.event}" acknowledged but not processed.` });
      return;
    }

    const { data } = webhook;

    // Normalise level and department
    const rawLevel = (data.level ?? 'IC').toUpperCase();
    const level = (['IC', 'MANAGER', 'EXEC'].includes(rawLevel) ? rawLevel : 'IC') as 'IC' | 'MANAGER' | 'EXEC';

    const validDepts = [
      'Engineering','Product','Design','Sales','Marketing',
      'Finance','Legal','People','Customer Support','Operations',
    ];
    const dept = validDepts.find(d => d.toLowerCase() === data.department.toLowerCase()) ?? 'Engineering';

    const hire = await TaskGraphService.createHireWithGraph({
      fullName:      data.fullName,
      jobTitle:      data.jobTitle,
      department:    dept as any,
      level,
      startDate:     data.startDate,
      managerName:   data.managerName,
      managerHandle: data.managerHandle,
    });

    await SlackProvider.sendApprovalRequest(hire.fullName, hire.jobTitle, hire.managerName);

    res.status(201).json({ message: 'Hire created from HRIS webhook', data: { id: hire.id } });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Invalid webhook payload', issues: err.errors });
      return;
    }
    console.error('[HRIS Webhook]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
