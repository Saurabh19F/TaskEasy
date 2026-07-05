import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { usersApi } from '@/lib/api';
import { getApiError } from '@/lib/axios';
import { useAuthStore } from '@/store/auth.store';

export function useUsers(params?: Record<string, any>) {
  const { hasHydrated, isAuthenticated, user } = useAuthStore();
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => usersApi.findAll(params),
    enabled: hasHydrated && isAuthenticated && !!user?.tenantId,
  });
}

export function useActiveUsers() {
  const { hasHydrated, isAuthenticated, user } = useAuthStore();
  return useQuery({
    queryKey: ['users', 'active'],
    queryFn: usersApi.findActive,
    enabled: hasHydrated && isAuthenticated && !!user?.tenantId,
    staleTime: 5 * 60_000,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created successfully');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      usersApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useToggleUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) =>
      usersApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User status updated');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User removed');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}
