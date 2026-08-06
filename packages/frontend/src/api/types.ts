// ─── Shared Types ─────────────────────────────────────────────────────────────

export type HireLevel  = 'IC' | 'MANAGER' | 'EXEC';
export type HireStatus = 'AWAITING_APPROVAL' | 'PROVISIONING' | 'BLOCKED' | 'CLEARED';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type TaskOwner      = 'HR' | 'IT' | 'MANAGER';
export type AccessLevel    = 'STANDARD' | 'ELEVATED';
export type TaskStatus     = 'PENDING' | 'AWAITING_APPROVAL' | 'REJECTED' | 'BLOCKED' | 'DONE';

export interface ApprovalRequest {
  id:             string;
  hireId:         string;
  status:         ApprovalStatus;
  hardwareBudget: number;
  resolvedAt:     string | null;
  resolvedBy:     string | null;
  submittedAt:    string;
}

export interface Task {
  id:              string;
  hireId:          string;
  owner:           TaskOwner;
  label:           string;
  system:          string | null;
  accessLevel:     AccessLevel | null;
  requiresApproval: boolean;
  status:          TaskStatus;
  slaHours:        number;
  unlockedAt:      string | null;
  completedAt:     string | null;
  isEscalated:     boolean;
  createdAt:       string;
  updatedAt:       string;
}

export interface Hire {
  id:            string;
  fullName:      string;
  jobTitle:      string;
  department:    string;
  level:         HireLevel;
  startDate:     string;
  managerName:   string;
  managerHandle: string | null;
  status:        HireStatus;
  createdAt:     string;
  updatedAt:     string;
  approval:      ApprovalRequest | null;
  tasks:         Task[];
}

export interface HireListItem extends Hire {
  readiness:     number;
  derivedStatus: HireStatus;
  ownerProgress: Record<TaskOwner, { pct: number; state: 'green' | 'amber' | 'red' }>;
}

export interface HireDetail extends Hire {
  readiness:     number;
  derivedStatus: HireStatus;
  tasksByOwner:  Record<TaskOwner, Task[]>;
  escalations:   Escalation[];
}

export interface Escalation {
  id:           string;
  hireId:       string;
  taskId:       string;
  owner:        TaskOwner;
  overdueHours: number;
  notifiedAt:   string;
  hire:         { fullName: string; jobTitle: string; department: string };
  task:         { label: string; system: string | null; slaHours: number; owner: TaskOwner };
}

export interface RuleConfig {
  id:          string;
  departments: Record<string, { deviceTier: string; extras: string[] }>;
  deviceTiers: Record<string, { label: string; budget: number }>;
  sla:         Record<string, number>;
  updatedAt:   string;
}

export interface CreateHirePayload {
  fullName:      string;
  jobTitle:      string;
  department:    string;
  level:         HireLevel;
  startDate:     string;
  managerName:   string;
  managerHandle?: string;
}

export interface ApprovalDecisionPayload {
  decision:             'APPROVED' | 'REJECTED';
  resolvedBy?:          string;
  hardwareBudget?:      number;
  accessLevelOverrides?: Record<string, AccessLevel>;
}
