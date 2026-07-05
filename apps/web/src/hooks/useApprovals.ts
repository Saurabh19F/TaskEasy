import { useQuery } from '@tanstack/react-query';
import { approvalApi } from '@/lib/api';

export function useApprovalQueue(tab: 'new' | 'rework' = 'new') {
  return useQuery({
    queryKey: ['approvals', 'queue', tab],
    queryFn: () => approvalApi.getQueue(tab),
  });
}

export function useApprovalCount() {
  return useQuery({
    queryKey: ['approvals', 'count'],
    queryFn: approvalApi.getCount,
    staleTime: 60_000,
    refetchInterval: 60_000,
    meta: { silent: true }, // sidebar badge — fails quietly, no toast spam
  });
}

export function useMySubmissions() {
  return useQuery({
    queryKey: ['approvals', 'my-submissions'],
    queryFn: approvalApi.mySubmissions,
  });
}

export function useReworkHistory() {
  return useQuery({
    queryKey: ['approvals', 'rework-history'],
    queryFn: approvalApi.getReworkHistory,
  });
}
