import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { projectsApi } from '@/lib/api';
import { getApiError } from '@/lib/axios';
import { useAuthStore } from '@/store/auth.store';

export function useProjects(params?: Record<string, any>) {
  const { hasHydrated, isAuthenticated, user } = useAuthStore();
  return useQuery({
    queryKey: ['projects', params],
    queryFn: () => projectsApi.findAll(params),
    enabled: hasHydrated && isAuthenticated && !!user?.tenantId,
  });
}

export function useActiveProjects() {
  const { hasHydrated, isAuthenticated, user } = useAuthStore();
  return useQuery({
    queryKey: ['projects', 'active'],
    queryFn: projectsApi.findActive,
    enabled: hasHydrated && isAuthenticated && !!user?.tenantId,
    staleTime: 5 * 60_000,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useToggleProjectStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.toggleStatus,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project status updated');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}
