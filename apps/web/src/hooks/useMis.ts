import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { misApi } from '@/lib/api';
import { getApiError } from '@/lib/axios';

export function useMis(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['mis', params],
    queryFn: () => misApi.get(params),
    staleTime: 3 * 60_000,
  });
}

export function useMisDetailed(params: Record<string, any> | null) {
  return useQuery({
    queryKey: ['mis', 'detailed', params],
    queryFn: () => misApi.getDetailed(params!),
    enabled: !!params,
  });
}

export function useMisHistory(userId?: string) {
  return useQuery({
    queryKey: ['mis', 'history', userId],
    queryFn: () => misApi.getHistory(userId),
    staleTime: 5 * 60 * 1000,
    // LE-17 fix: without this guard the query fires immediately with userId=undefined,
    // which makes the API return history for ALL users rather than a specific one.
    enabled: !!userId,
  });
}

export function useSaveWeeklyTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: misApi.saveWeeklyTarget,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mis'] });
      toast.success('Weekly target saved');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useKraMaster(params?: { projectId?: string }) {
  return useQuery({
    queryKey: ['mis', 'kra-master', params],
    queryFn: () => misApi.getKraMaster(params),
    staleTime: 5 * 60_000,
  });
}

export function useSaveSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: misApi.saveSnapshot,
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['mis'] });
      toast.success(res?.message ?? 'Snapshot saved');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}
