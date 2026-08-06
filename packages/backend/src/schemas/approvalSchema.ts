import { z } from 'zod';

export const ApprovalDecisionSchema = z.object({
  decision:      z.enum(['APPROVED','REJECTED']),
  resolvedBy:    z.string().min(1).max(120).optional(),
  hardwareBudget: z.number().int().positive().optional(),
  accessLevelOverrides: z.record(z.string(), z.enum(['STANDARD','ELEVATED'])).optional(),
});

export type ApprovalDecisionInput = z.infer<typeof ApprovalDecisionSchema>;
