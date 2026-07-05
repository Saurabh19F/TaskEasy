import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { workRequestApi } from '@/lib/api';
import { getApiError } from '@/lib/axios';

export function useWorkRequests(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['work-requests', params],
    queryFn: () => workRequestApi.findAll(params),
  });
}

export function useWorkRequest(id: string) {
  return useQuery({
    queryKey: ['work-requests', id],
    queryFn: () => workRequestApi.findOne(id),
    enabled: !!id,
  });
}

export function useCreateWorkRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: workRequestApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-requests'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Work request created');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useSubmitWorkRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; doerRemarks: string; attachmentIds?: string[] }) =>
      workRequestApi.submit(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-requests'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Submitted for approval');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useApproveWorkRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; remarks?: string }) =>
      workRequestApi.approve(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-requests'] });
      qc.invalidateQueries({ queryKey: ['approvals'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Approved');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useReworkWorkRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reworkRemark }: { id: string; reworkRemark: string }) =>
      workRequestApi.rework(id, { reworkRemark }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-requests'] });
      qc.invalidateQueries({ queryKey: ['approvals'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Sent for rework');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}
