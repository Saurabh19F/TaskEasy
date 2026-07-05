import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/axios';

export interface AuditLog {
  id: string;
  action: string;
  module: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  actorId: string;
  actorName?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AuditLogsFilters {
  module?: string;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export function useAuditLogs(filters: AuditLogsFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v != null) params.set(k, String(v)); });

  return useQuery<{ data: AuditLog[]; total: number; page: number }>({
    queryKey: ['audit-logs', filters],
    queryFn: () => apiGet(`/audit?${params.toString()}`),
    staleTime: 30_000,
  });
}
