import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/axios';

export function usePredictTaskDelays() {
  return useQuery<any[]>({
    queryKey: ['predict-task-delays'],
    queryFn: () => apiGet('/mis/predict/task-delays'),
    staleTime: 5 * 60_000,
  });
}

export function usePredictWorkload() {
  return useQuery<any[]>({
    queryKey: ['predict-workload'],
    queryFn: () => apiGet('/mis/predict/workload'),
    staleTime: 5 * 60_000,
  });
}

export function usePredictProjectHealth() {
  return useQuery<any[]>({
    queryKey: ['predict-project-health'],
    queryFn: () => apiGet('/mis/predict/project-health'),
    staleTime: 5 * 60_000,
  });
}
