import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fmsApi } from '@/lib/api';
import { getApiError } from '@/lib/axios';
import { useAuthStore } from '@/store/auth.store';

export function useFmsWorkflows() {
  const { hasHydrated, isAuthenticated, user } = useAuthStore();
  return useQuery({
    queryKey: ['fms', 'workflows'],
    queryFn: fmsApi.findWorkflows,
    enabled: hasHydrated && isAuthenticated && !!user?.tenantId,
  });
}

export function useCreateFmsWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fmsApi.createWorkflow,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fms'] });
      toast.success('Workflow created');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useFmsSteps(params?: Record<string, any>) {
  const { hasHydrated, isAuthenticated, user } = useAuthStore();
  return useQuery({
    queryKey: ['fms', 'steps', params],
    queryFn: () => fmsApi.findSteps(params),
    enabled: hasHydrated && isAuthenticated && !!user?.tenantId,
  });
}

export function useAddFmsStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fmsApi.addStep,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fms'] });
      toast.success('Step added');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useCompleteFmsStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; remarks?: string }) =>
      fmsApi.completeStep(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fms'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('FMS step completed');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}
