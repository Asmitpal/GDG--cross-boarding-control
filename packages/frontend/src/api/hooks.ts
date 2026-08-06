import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client.js';
import type {
  HireListItem, HireDetail, CreateHirePayload,
  ApprovalDecisionPayload, RuleConfig, Escalation,
} from './types.js';

// ─── Keys ────────────────────────────────────────────────────────────────────
export const QUERY_KEYS = {
  hires:       ['hires']               as const,
  hire:        (id: string) => ['hires', id] as const,
  escalations: ['escalations']         as const,
  rules:       ['rules']               as const,
};

// ─── Hires ───────────────────────────────────────────────────────────────────

export function useHires() {
  return useQuery({
    queryKey: QUERY_KEYS.hires,
    queryFn:  async () => {
      const { data } = await apiClient.get<{ data: HireListItem[] }>('/hires');
      return data.data;
    },
    refetchInterval: 30_000,
  });
}

export function useHire(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.hire(id),
    queryFn:  async () => {
      const { data } = await apiClient.get<{ data: HireDetail }>(`/hires/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateHire() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateHirePayload) => {
      const { data } = await apiClient.post<{ data: HireDetail }>('/hires', payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.hires });
    },
  });
}

// ─── Approvals ───────────────────────────────────────────────────────────────

export function useApprovalDecision(hireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ApprovalDecisionPayload) => {
      const { data } = await apiClient.post<{ data: HireDetail }>(
        `/hires/${hireId}/approval`,
        payload,
      );
      return data.data;
    },
    onSuccess: (hire) => {
      qc.setQueryData(QUERY_KEYS.hire(hireId), hire);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.hires });
    },
  });
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export function useToggleTask(hireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const { data } = await apiClient.patch(`/tasks/${taskId}`, { completed });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.hire(hireId) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.hires });
    },
  });
}

// ─── Escalations ─────────────────────────────────────────────────────────────

export function useEscalations() {
  return useQuery({
    queryKey: QUERY_KEYS.escalations,
    queryFn:  async () => {
      const { data } = await apiClient.get<{ data: Escalation[] }>('/escalations');
      return data.data;
    },
    refetchInterval: 60_000,
  });
}

// ─── Rules ───────────────────────────────────────────────────────────────────

export function useRules() {
  return useQuery({
    queryKey: QUERY_KEYS.rules,
    queryFn:  async () => {
      const { data } = await apiClient.get<{ data: RuleConfig }>('/rules');
      return data.data;
    },
  });
}

export function useUpdateRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Pick<RuleConfig, 'departments' | 'deviceTiers' | 'sla'>>) => {
      const { data } = await apiClient.put<{ data: RuleConfig }>('/rules', payload);
      return data.data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(QUERY_KEYS.rules, updated);
    },
  });
}
