'use client';

import { useState, useEffect, useDeferredValue } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/axios';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

interface AuditLog {
  id: string;
  actorId: string;
  actor?: { name: string; email: string };
  action: string;
  module: string;
  refType?: string;
  refId?: string;
  description: string;
  ipAddress?: string;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'text-green-600 bg-green-50 dark:bg-green-900/20',
  UPDATE: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  DELETE: 'text-red-600 bg-red-50 dark:bg-red-900/20',
  APPROVE: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
  REWORK: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
  REJECT: 'text-red-600 bg-red-50 dark:bg-red-900/20',
  LOGIN: 'text-slate-600 bg-slate-100 dark:bg-slate-800',
  LOGOUT: 'text-slate-600 bg-slate-100 dark:bg-slate-800',
  ROLE_CHANGE: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
  STATUS_CHANGE: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
};

const ALLOWED_ROLES = ['ADMIN', 'COMPANY_OWNER', 'SAAS_OWNER'];

export default function AuditLogsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');

  // SEC-08 fix: only admins may view audit logs
  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  // MI-11 fix: debounce search so we don't fire a request on every keystroke
  const deferredSearch = useDeferredValue(search);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit-logs', deferredSearch],
    queryFn: () => apiGet<{ data: AuditLog[]; meta: any }>('/audit', deferredSearch ? { search: deferredSearch } : undefined),
    enabled: !user || ALLOWED_ROLES.includes(user.role),
  });

  const columns: Column<AuditLog>[] = [
    {
      key: 'actor',
      header: 'User',
      render: (_, row) => (
        <div>
          <p className="font-medium text-sm text-slate-800 dark:text-slate-200">{row.actor?.name ?? row.actorId}</p>
          <p className="text-xs text-slate-500">{row.actor?.email}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (v) => (
        <span className={`text-xs font-mono font-bold rounded px-1.5 py-0.5 ${ACTION_COLORS[v] ?? 'text-slate-600 bg-slate-100'}`}>
          {v}
        </span>
      ),
    },
    {
      key: 'module',
      header: 'Module',
      render: (v, row) => (
        <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
          {v}{row.refType ? ` · ${row.refType}` : ''}
        </span>
      ),
    },
    { key: 'description', header: 'Description' },
    { key: 'ipAddress', header: 'IP Address', render: (v) => v ?? '—' },
    { key: 'createdAt', header: 'Time', sortable: true, render: (v) => formatDate(v) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-indigo-500" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Audit Logs</h1>
      </div>

      <div className="max-w-xs">
        <Input
          placeholder="Search by description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
        exportFilename="audit-logs"
        exportTitle="Audit Logs"
        rowKey={(r) => r.id}
        emptyMessage="No audit logs found"
      />
    </div>
  );
}
