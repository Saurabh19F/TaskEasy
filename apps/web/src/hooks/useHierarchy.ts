import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { hierarchyApi } from '@/lib/api';
import { getApiError } from '@/lib/axios';

export function useHierarchy() {
  return useQuery({
    queryKey: ['hierarchy'],
    queryFn: hierarchyApi.findAll,
    staleTime: 5 * 60_000,
  });
}

export function useCreateHierarchyGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: hierarchyApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hierarchy'] });
      toast.success('Group created');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useUpdateHierarchyGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      hierarchyApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hierarchy'] });
      toast.success('Group updated');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useDeleteHierarchyGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: hierarchyApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hierarchy'] });
      toast.success('Group deleted');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}
