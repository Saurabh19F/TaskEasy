import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { checklistApi } from '@/lib/api';
import { getApiError } from '@/lib/axios';
import { useAuthStore } from '@/store/auth.store';

export function useChecklistMasters() {
  const { hasHydrated, isAuthenticated, user } = useAuthStore();
  const enabled = hasHydrated && isAuthenticated && !!user?.tenantId;

  return useQuery({
    queryKey: ['checklist', 'masters'],
    queryFn: checklistApi.findMasters,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateChecklistMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: checklistApi.createMaster,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checklist'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Checklist assigned');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useChecklistTasks(params?: Record<string, any>) {
  const { hasHydrated, isAuthenticated, user } = useAuthStore();
  const enabled = hasHydrated && isAuthenticated && !!user?.tenantId;

  return useQuery({
    queryKey: ['checklist', 'tasks', params],
    queryFn: () => checklistApi.findTasks(params),
    enabled,
  });
}

export function useMyPendingChecklists() {
  const { hasHydrated, isAuthenticated, user } = useAuthStore();
  const enabled = hasHydrated && isAuthenticated && !!user?.tenantId;

  return useQuery({
    queryKey: ['checklist', 'my-pending'],
    queryFn: checklistApi.myPending,
    enabled,
  });
}

export function useCompleteChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; remarks: string; attachmentIds?: string[] }) =>
      checklistApi.complete(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checklist'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Checklist submitted for approval');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useBulkCompleteChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: checklistApi.bulkComplete,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['checklist'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`${result.completed} tasks submitted for approval`);
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}
