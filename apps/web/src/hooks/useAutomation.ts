import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiGet, apiPost, apiPatch, apiDelete, getApiError } from '@/lib/axios';

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  trigger: string;
  conditions: any[];
  actions: any[];
  isActive: boolean;
  createdAt: string;
}

const CACHE_KEY = ['automation-rules'];

export function useAutomationRules() {
  return useQuery<AutomationRule[]>({
    queryKey: CACHE_KEY,
    queryFn: () => apiGet<AutomationRule[]>('/automation/rules'),
    staleTime: 5 * 60_000,
  });
}

export function useCreateAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AutomationRule>) => apiPost<AutomationRule>('/automation/rules', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CACHE_KEY });
      toast.success('Automation rule created');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useToggleAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiPatch<AutomationRule>(`/automation/rules/${id}`, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CACHE_KEY });
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useDeleteAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/automation/rules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CACHE_KEY });
      toast.success('Rule deleted');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}
