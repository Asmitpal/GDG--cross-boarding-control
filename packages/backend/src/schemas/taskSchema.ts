import { z } from 'zod';

export const ToggleTaskSchema = z.object({
  completed: z.boolean(),
});

export type ToggleTaskInput = z.infer<typeof ToggleTaskSchema>;

export const UpdateRulesSchema = z.object({
  departments: z.record(z.string(), z.object({
    deviceTier: z.string(),
    extras:     z.array(z.string()),
  })).optional(),
  deviceTiers: z.record(z.string(), z.object({
    label:  z.string(),
    budget: z.number().int().positive(),
  })).optional(),
  sla: z.record(z.string(), z.number().int().positive()).optional(),
});

export type UpdateRulesInput = z.infer<typeof UpdateRulesSchema>;
