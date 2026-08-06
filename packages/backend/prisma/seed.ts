import { PrismaClient } from '@prisma/client';

const DEFAULT_DEPT_RULES: Record<string, { deviceTier: string; extras: string[] }> = {
  Engineering:      { deviceTier: 'dev',      extras: ['github'] },
  Product:          { deviceTier: 'dev',      extras: ['github'] },
  Design:           { deviceTier: 'design',   extras: ['adobe'] },
  Sales:            { deviceTier: 'standard', extras: ['salesforce'] },
  Marketing:        { deviceTier: 'standard', extras: ['hubspot'] },
  Finance:          { deviceTier: 'standard', extras: ['netsuite'] },
  Legal:            { deviceTier: 'standard', extras: ['netsuite'] },
  People:           { deviceTier: 'standard', extras: [] },
  'Customer Support': { deviceTier: 'standard', extras: ['zendesk'] },
  Operations:       { deviceTier: 'standard', extras: [] },
};

const DEFAULT_DEVICE_TIERS: Record<string, { label: string; budget: number }> = {
  standard: { label: 'Standard laptop',              budget: 1400 },
  dev:      { label: 'Dev laptop (high-spec)',        budget: 2400 },
  design:   { label: 'Creative workstation laptop',   budget: 3000 },
};

const DEFAULT_SLA: Record<string, number> = {
  identity:  24,
  collab:    12,
  hardware:  48,
  appAccess: 24,
  elevated:  12,
  none:      48,
};

const SAMPLE_HIRES = [
  {
    fullName:      'Priya Nair',
    jobTitle:      'Senior Backend Engineer',
    department:    'Engineering',
    level:         'IC' as const,
    startDate:     new Date('2026-08-18'),
    managerName:   'Jordan Lee',
    managerHandle: '@jordanl',
  },
  {
    fullName:      'Marcus Chen',
    jobTitle:      'Head of Design',
    department:    'Design',
    level:         'MANAGER' as const,
    startDate:     new Date('2026-08-25'),
    managerName:   'Sarah Kim',
    managerHandle: '@sarahk',
  },
  {
    fullName:      'Aisha Okonkwo',
    jobTitle:      'VP of Sales',
    department:    'Sales',
    level:         'EXEC' as const,
    startDate:     new Date('2026-09-01'),
    managerName:   'David Torres',
    managerHandle: '@davidT',
  },
];

async function main() {
  const prisma = new PrismaClient();

  // ── Rule Config (singleton) ────────────────────────────────────────────
  const existing = await prisma.ruleConfig.findFirst();
  if (!existing) {
    await prisma.ruleConfig.create({
      data: {
        departments: DEFAULT_DEPT_RULES,
        deviceTiers: DEFAULT_DEVICE_TIERS,
        sla:         DEFAULT_SLA,
      },
    });
    console.log('✅  Default RuleConfig seeded');
  }

  // ── Sample hires ───────────────────────────────────────────────────────
  for (const sample of SAMPLE_HIRES) {
    const exists = await prisma.hire.findFirst({ where: { fullName: sample.fullName } });
    if (exists) continue;

    const rule         = DEFAULT_DEPT_RULES[sample.department] ?? { deviceTier: 'standard', extras: [] };
    const tier         = DEFAULT_DEVICE_TIERS[rule.deviceTier]  ?? DEFAULT_DEVICE_TIERS.standard;
    const budgetBonus  = sample.level === 'EXEC' ? 500 : 0;
    const hardwareBudget = tier.budget + budgetBonus;

    const hire = await prisma.hire.create({
      data: {
        fullName:      sample.fullName,
        jobTitle:      sample.jobTitle,
        department:    sample.department,
        level:         sample.level,
        startDate:     sample.startDate,
        managerName:   sample.managerName,
        managerHandle: sample.managerHandle,
        status:        'AWAITING_APPROVAL',
        approval: {
          create: {
            status:        'PENDING',
            hardwareBudget,
            submittedAt:   new Date(),
          },
        },
      },
    });

    const elevated = sample.level !== 'IC';
    const sla = DEFAULT_SLA;
    const taskData = [];

    // HR tasks
    taskData.push({ owner: 'HR', label: 'Send offer packet & tax forms',  system: 'Payroll', requiresApproval: false, slaHours: sla.none, unlockedAt: new Date(), accessLevel: null });
    taskData.push({ owner: 'HR', label: 'Enroll in benefits',             system: 'Payroll', requiresApproval: false, slaHours: sla.none, unlockedAt: new Date(), accessLevel: null });
    taskData.push({ owner: 'HR', label: 'Add to payroll system',          system: 'Payroll', requiresApproval: false, slaHours: sla.none, unlockedAt: new Date(), accessLevel: null });
    taskData.push({ owner: 'HR', label: 'Schedule Day-1 orientation',     system: null,      requiresApproval: false, slaHours: sla.none, unlockedAt: new Date(), accessLevel: null });

    // Manager tasks
    taskData.push({ owner: 'MANAGER', label: 'Schedule welcome intro meeting', system: null, requiresApproval: false, slaHours: sla.collab, unlockedAt: new Date(), accessLevel: null });
    taskData.push({ owner: 'MANAGER', label: 'Assign onboarding buddy',        system: null, requiresApproval: false, slaHours: sla.collab, unlockedAt: new Date(), accessLevel: null });
    taskData.push({ owner: 'MANAGER', label: 'Set 30-60-90 check-in schedule', system: null, requiresApproval: false, slaHours: sla.none,   unlockedAt: new Date(), accessLevel: null });

    // IT tasks
    taskData.push({ owner: 'IT', label: 'Provision company email & SSO', system: 'Okta',     requiresApproval: true,  slaHours: sla.identity, unlockedAt: null, accessLevel: elevated ? 'ELEVATED' : 'STANDARD' });
    taskData.push({ owner: 'IT', label: 'Add to Slack workspace',        system: 'Slack',    requiresApproval: false, slaHours: sla.collab,   unlockedAt: new Date(), accessLevel: null });
    taskData.push({ owner: 'IT', label: `Order ${tier.label.toLowerCase()}`, system: 'Hardware', requiresApproval: true, slaHours: sla.hardware, unlockedAt: null, accessLevel: null });
    taskData.push({ owner: 'IT', label: 'Provision VPN access',          system: 'Okta',     requiresApproval: true,  slaHours: sla.identity, unlockedAt: null, accessLevel: 'STANDARD' });

    for (const key of rule.extras) {
      const extraLabels: Record<string, { label: string; system: string }> = {
        github:     { label: 'Grant GitHub org access',         system: 'GitHub' },
        salesforce: { label: 'Grant Salesforce access',         system: 'Salesforce' },
        adobe:      { label: 'Grant Adobe Creative Cloud license', system: 'Adobe' },
        hubspot:    { label: 'Grant HubSpot access',            system: 'HubSpot' },
        zendesk:    { label: 'Grant Zendesk access',            system: 'Zendesk' },
        netsuite:   { label: 'Grant NetSuite access',           system: 'NetSuite' },
      };
      const ex = extraLabels[key];
      if (ex) taskData.push({ owner: 'IT', label: ex.label, system: ex.system, requiresApproval: true, slaHours: sla.appAccess, unlockedAt: null, accessLevel: elevated ? 'ELEVATED' : 'STANDARD' });
    }

    if (elevated) {
      taskData.push({ owner: 'IT', label: 'Elevated permissions security review', system: 'Okta', requiresApproval: true, slaHours: sla.elevated, unlockedAt: null, accessLevel: 'ELEVATED' });
    }

    await prisma.taskGraph.createMany({
      data: taskData.map(t => ({
        hireId:          hire.id,
        owner:           t.owner as any,
        label:           t.label,
        system:          t.system ?? null,
        requiresApproval: t.requiresApproval,
        status:          t.requiresApproval ? 'AWAITING_APPROVAL' : 'PENDING',
        slaHours:        t.slaHours,
        unlockedAt:      t.unlockedAt ?? null,
        accessLevel:     (t.accessLevel as any) ?? null,
      })),
    });

    console.log(`✅  Seeded hire: ${sample.fullName}`);
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
