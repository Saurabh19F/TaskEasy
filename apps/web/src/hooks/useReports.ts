import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiGet, apiPost, apiDelete, getApiError } from '@/lib/axios';

export interface ReportFilters {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  projectId?: string;
  status?: string;
}

// ── Report data ──────────────────────────────────────────────────────────────

export function useReportData(module: string, filters: ReportFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

  return useQuery<any[]>({
    queryKey: ['report', module, filters],
    queryFn: () => apiGet<any[]>(`/reports/${module}?${params.toString()}`),
    staleTime: 60_000,
  });
}

// ── Saved templates ──────────────────────────────────────────────────────────

export function useReportTemplates() {
  return useQuery<any[]>({
    queryKey: ['report-templates'],
    queryFn: () => apiGet<any[]>('/reports/templates'),
    staleTime: 5 * 60_000,
  });
}

export function useSaveReportTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; module: string; filters: ReportFilters }) =>
      apiPost<any>('/reports/templates', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-templates'] });
      toast.success('Report template saved');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useDeleteReportTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/reports/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-templates'] });
      toast.success('Template deleted');
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}
