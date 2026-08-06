import { z } from 'zod';

export const CreateHireSchema = z.object({
  fullName:      z.string().min(2).max(120).trim(),
  jobTitle:      z.string().min(2).max(120).trim(),
  department:    z.enum([
    'Engineering','Product','Design','Sales','Marketing',
    'Finance','Legal','People','Customer Support','Operations',
  ]),
  level:         z.enum(['IC','MANAGER','EXEC']),
  startDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
  managerName:   z.string().min(2).max(120).trim(),
  managerHandle: z.string().max(120).trim().optional(),
});

export type CreateHireInput = z.infer<typeof CreateHireSchema>;

export const HRISWebhookSchema = z.object({
  event:    z.enum(['hire.created','hire.updated']),
  provider: z.enum(['workday','bamboohr','generic']).optional(),
  data:     z.object({
    fullName:      z.string(),
    jobTitle:      z.string(),
    department:    z.string(),
    level:         z.string().optional(),
    startDate:     z.string(),
    managerName:   z.string(),
    managerHandle: z.string().optional(),
  }),
});

export type HRISWebhookInput = z.infer<typeof HRISWebhookSchema>;
