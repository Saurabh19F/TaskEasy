import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { delegationApi } from '@/lib/api';
import { getApiError } from '@/lib/axios';

export function useDelegation(params?: Record<string, any>, enabled = true) {
  return useQuery({
    queryKey: ['delegation', params],
    queryFn: () => delegationApi.findAll(params),
    enabled,
  });
}

export function useMyPendingDelegation() {
  return useQuery({
    queryKey: ['delegation', 'my-pending'],
    queryFn: delegationApi.myPending,
  });
}

export function useCreateDelegation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: delegationApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delegation'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Task(s) delegated successfully');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useCreateDelegationBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: delegationApi.bulkCreate,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['delegation'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`${data.length} task(s) delegated successfully`);
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useSubmitDelegation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; doerRemarks: string; attachmentIds?: string[] }) =>
      delegationApi.submit(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delegation'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Submitted for approval');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useApproveDelegation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; remarks?: string; rating?: number }) =>
      delegationApi.approve(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delegation'] });
      qc.invalidateQueries({ queryKey: ['approvals'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Task approved');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useReworkDelegation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reworkRemark }: { id: string; reworkRemark: string }) =>
      delegationApi.rework(id, { reworkRemark }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delegation'] });
      qc.invalidateQueries({ queryKey: ['approvals'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Sent for rework');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}
