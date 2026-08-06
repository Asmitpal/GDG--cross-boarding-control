import { prisma } from '../db.js';
import { CreateHireInput } from '../schemas/hireSchema.js';
import type { HireLevel, TaskOwner, TaskStatus, AccessLevel } from '@prisma/client';

// ─── Constants (mirrors prototype defaults) ───────────────────────────────────

const EXTRA_SYSTEMS: Record<string, { label: string; system: string }> = {
  github:     { label: 'Grant GitHub org access',              system: 'GitHub' },
  salesforce: { label: 'Grant Salesforce access',              system: 'Salesforce' },
  adobe:      { label: 'Grant Adobe Creative Cloud license',   system: 'Adobe' },
  hubspot:    { label: 'Grant HubSpot access',                 system: 'HubSpot' },
  zendesk:    { label: 'Grant Zendesk access',                 system: 'Zendesk' },
  netsuite:   { label: 'Grant NetSuite access',                system: 'NetSuite' },
};

interface RuleConfig {
  departments: Record<string, { deviceTier: string; extras: string[] }>;
  deviceTiers: Record<string, { label: string; budget: number }>;
  sla:         Record<string, number>;
}

interface TaskSpec {
  owner:           TaskOwner;
  label:           string;
  system:          string | null;
  requiresApproval: boolean;
  accessLevel:     AccessLevel | null;
  slaHours:        number;
  status:          TaskStatus;
  unlockedAt:      Date | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class TaskGraphService {
  /** Fetch active rule config from DB (falls back to hard-coded defaults) */
  static async getRules(): Promise<RuleConfig> {
    const row = await prisma.ruleConfig.findFirst({ orderBy: { updatedAt: 'desc' } });
    if (!row) {
      return {
        departments: {
          Engineering:       { deviceTier: 'dev',      extras: ['github'] },
          Product:           { deviceTier: 'dev',      extras: ['github'] },
          Design:            { deviceTier: 'design',   extras: ['adobe'] },
          Sales:             { deviceTier: 'standard', extras: ['salesforce'] },
          Marketing:         { deviceTier: 'standard', extras: ['hubspot'] },
          Finance:           { deviceTier: 'standard', extras: ['netsuite'] },
          Legal:             { deviceTier: 'standard', extras: ['netsuite'] },
          People:            { deviceTier: 'standard', extras: [] },
          'Customer Support':{ deviceTier: 'standard', extras: ['zendesk'] },
          Operations:        { deviceTier: 'standard', extras: [] },
        },
        deviceTiers: {
          standard: { label: 'Standard laptop',             budget: 1400 },
          dev:      { label: 'Dev laptop (high-spec)',       budget: 2400 },
          design:   { label: 'Creative workstation laptop',  budget: 3000 },
        },
        sla: { identity: 24, collab: 12, hardware: 48, appAccess: 24, elevated: 12, none: 48 },
      };
    }
    return {
      departments: row.departments as RuleConfig['departments'],
      deviceTiers: row.deviceTiers as RuleConfig['deviceTiers'],
      sla:         row.sla         as RuleConfig['sla'],
    };
  }

  /** Compute hardware budget from department + level */
  static computeHardwareBudget(
    department: string,
    level: HireLevel,
    rules: RuleConfig,
  ): number {
    const deptRule = rules.departments[department] ?? { deviceTier: 'standard' };
    const tier     = rules.deviceTiers[deptRule.deviceTier] ?? rules.deviceTiers['standard'];
    return (tier?.budget ?? 1400) + (level === 'EXEC' ? 500 : 0);
  }

  /** Build the full task spec list for a hire */
  static buildTaskSpecs(
    department: string,
    level: HireLevel,
    rules: RuleConfig,
  ): TaskSpec[] {
    const deptRule = rules.departments[department] ?? { deviceTier: 'standard', extras: [] };
    const tier     = rules.deviceTiers[deptRule.deviceTier] ?? rules.deviceTiers['standard'];
    const sla      = rules.sla;
    const elevated = level !== 'IC';
    const now      = new Date();
    const tasks: TaskSpec[] = [];

    function push(
      owner: TaskOwner,
      label: string,
      system: string | null,
      requiresApproval: boolean,
      slaHours: number,
      accessLevel: AccessLevel | null = null,
    ): void {
      tasks.push({
        owner,
        label,
        system,
        requiresApproval,
        accessLevel,
        slaHours,
        status:     requiresApproval ? 'AWAITING_APPROVAL' : 'PENDING',
        unlockedAt: requiresApproval ? null : now,
      });
    }

    // HR tasks
    push('HR', 'Send offer packet & tax forms',  'Payroll', false, sla['none'] ?? 48);
    push('HR', 'Enroll in benefits',             'Payroll', false, sla['none'] ?? 48);
    push('HR', 'Add to payroll system',          'Payroll', false, sla['none'] ?? 48);
    push('HR', 'Schedule Day-1 orientation',      null,     false, sla['none'] ?? 48);

    // Manager tasks
    push('MANAGER', 'Schedule welcome intro meeting', null, false, sla['collab'] ?? 12);
    push('MANAGER', 'Assign onboarding buddy',        null, false, sla['collab'] ?? 12);
    push('MANAGER', 'Set 30-60-90 check-in schedule', null, false, sla['none']  ?? 48);

    // IT — common
    push('IT', 'Provision company email & SSO', 'Okta',     true, sla['identity'] ?? 24, elevated ? 'ELEVATED' : 'STANDARD');
    push('IT', 'Add to Slack workspace',        'Slack',    false, sla['collab']  ?? 12);
    push('IT', `Order ${tier?.label.toLowerCase() ?? 'standard laptop'}`, 'Hardware', true, sla['hardware'] ?? 48);
    push('IT', 'Provision VPN access',          'Okta',     true, sla['identity'] ?? 24, 'STANDARD');

    // IT — department extras
    for (const key of deptRule.extras ?? []) {
      const ex = EXTRA_SYSTEMS[key];
      if (ex) {
        push('IT', ex.label, ex.system, true, sla['appAccess'] ?? 24, elevated ? 'ELEVATED' : 'STANDARD');
      }
    }

    // IT — elevated review for managers/execs
    if (elevated) {
      push('IT', 'Elevated permissions security review', 'Okta', true, sla['elevated'] ?? 12, 'ELEVATED');
    }

    return tasks;
  }

  /**
   * Create a hire record + approval + full task graph in one transaction.
   * Returns the complete hire with all relations.
   */
  static async createHireWithGraph(input: CreateHireInput) {
    const rules          = await TaskGraphService.getRules();
    const level          = input.level as HireLevel;
    const hardwareBudget = TaskGraphService.computeHardwareBudget(input.department, level, rules);
    const taskSpecs      = TaskGraphService.buildTaskSpecs(input.department, level, rules);

    const hire = await prisma.$transaction(async (tx) => {
      const newHire = await tx.hire.create({
        data: {
          fullName:      input.fullName,
          jobTitle:      input.jobTitle,
          department:    input.department,
          level,
          startDate:     new Date(input.startDate),
          managerName:   input.managerName,
          managerHandle: input.managerHandle,
          status:        'AWAITING_APPROVAL',
          approval: {
            create: {
              status:        'PENDING',
              hardwareBudget,
              submittedAt:   new Date(),
            },
          },
        },
        include: { approval: true },
      });

      await tx.taskGraph.createMany({
        data: taskSpecs.map(spec => ({
          hireId:          newHire.id,
          owner:           spec.owner,
          label:           spec.label,
          system:          spec.system ?? null,
          requiresApproval: spec.requiresApproval,
          status:          spec.status,
          slaHours:        spec.slaHours,
          unlockedAt:      spec.unlockedAt ?? null,
          accessLevel:     spec.accessLevel ?? null,
        })),
      });

      return tx.hire.findUniqueOrThrow({
        where: { id: newHire.id },
        include: { approval: true, tasks: true, escalations: true },
      });
    });

    return hire;
  }

  /** Compute readiness percentage for a hire */
  static computeReadiness(tasks: Array<{ status: string }>): number {
    const live = tasks.filter(t => t.status !== 'REJECTED' && t.status !== 'AWAITING_APPROVAL');
    if (!live.length) return 0;
    const done = live.filter(t => t.status === 'DONE').length;
    return Math.round((done / live.length) * 100);
  }

  /** Derive hire-level status from tasks + approval */
  static deriveHireStatus(
    approvalStatus: string,
    tasks: Array<{ status: string }>,
  ): 'AWAITING_APPROVAL' | 'PROVISIONING' | 'BLOCKED' | 'CLEARED' {
    if (approvalStatus === 'PENDING') return 'AWAITING_APPROVAL';
    const live = tasks.filter(t => t.status !== 'REJECTED');
    if (live.some(t => t.status === 'BLOCKED'))                    return 'BLOCKED';
    if (live.length && live.every(t => t.status === 'DONE'))       return 'CLEARED';
    return 'PROVISIONING';
  }
}
