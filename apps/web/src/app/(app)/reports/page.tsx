'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useActiveUsers } from '@/hooks/useUsers';
import { useActiveProjects } from '@/hooks/useProjects';
import { FilterBar, FilterValues } from '@/components/ui/FilterBar';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { cn, formatDate } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

type ReportTab = 'performance' | 'delegation' | 'work-requests' | 'checklist' | 'projects';

const TABS: { key: ReportTab; label: string }[] = [
  { key: 'performance',   label: 'Performance' },
  { key: 'delegation',    label: 'Delegation' },
  { key: 'work-requests', label: 'Work Request' },
  { key: 'checklist',     label: 'Checklist' },
  { key: 'projects',      label: 'Project' },
];

const STATUS_OPTIONS = ['PENDING', 'IN_PROGRESS', 'SEND_FOR_APPROVAL', 'COMPLETED', 'REWORK', 'LATE'];

const ALLOWED_ROLES = ['ADMIN', 'MANAGER', 'COMPANY_OWNER', 'SAAS_OWNER'];

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-teal-500', 'bg-slate-400',
  'bg-indigo-500', 'bg-rose-500', 'bg-amber-500',
];

// ─── Employee summary card ─────────────────────────────────────────────────────

interface EmpPerf {
  name?: string;
  totalTasks?: number;
  completed?: number;
  pending?: number;
  onTimePercent?: number;
  reworkCount?: number;
  score?: number;
  grade?: string;
  avgDelay?: number;
}

function EmployeePerfCard({ emp, idx }: { emp: EmpPerf; idx: number }) {
  const initial = (emp.name ?? '?')[0].toUpperCase();
  const avatarBg = AVATAR_COLORS[idx % AVATAR_COLORS.length];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-contrast text-sm font-bold flex-shrink-0', avatarBg)}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{emp.name ?? '—'}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            GRADE: <span className="font-medium text-slate-600 dark:text-slate-300">{emp.grade ?? '—'}</span>
          </p>
          <p className="text-[11px] text-slate-400">
            SCORE: <span className="font-medium text-slate-600 dark:text-slate-300">{emp.score ?? '—'}</span>
          </p>
        </div>
      </div>

      {/* Performance placeholder */}
      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2 mb-3 text-center">
        <p className="text-xs font-medium text-slate-400">Performance</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">No Data</p>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2 py-2">
          <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{emp.completed ?? 0}</p>
          <p className="text-[11px] text-slate-400">Completed</p>
        </div>
        <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 px-2 py-2">
          <p className="text-lg font-bold text-orange-500">{emp.pending ?? 0}</p>
          <p className="text-[11px] text-orange-400">Pending</p>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2 py-2">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{emp.onTimePercent ?? 0}%</p>
          <p className="text-[11px] text-slate-400">On Time</p>
        </div>
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-2 py-2">
          <p className="text-sm font-bold text-red-500">{emp.reworkCount ?? 0}</p>
          <p className="text-[11px] text-red-400">Issues</p>
          <p className="text-[9px] text-red-300">Reworks</p>
        </div>
      </div>
    </div>
  );
}

// ─── Performance tab ──────────────────────────────────────────────────────────

function PerformanceTab({ filters }: { filters: FilterValues }) {
  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ['reports', 'performance', filters],
    queryFn: () => reportsApi.performance(filters),
  });

  const rows: EmpPerf[] = data?.data ?? [];

  const columns: Column<EmpPerf>[] = [
    { key: 'name',          header: 'Employee',    sortable: true },
    { key: 'totalTasks',    header: 'Total Tasks' },
    { key: 'completed',     header: 'Completed',
      render: (v) => <span className="text-green-600 font-medium">{v ?? 0}</span> },
    { key: 'pending',       header: 'Pending',
      render: (v) => <span className="text-amber-500 font-medium">{v ?? 0}</span> },
    { key: 'onTimePercent', header: 'On Time %',
      render: (v) => `${v ?? 0}%` },
    { key: 'avgDelay',      header: 'Avg Delay',
      render: (v) => `${v ?? 0} days` },
    { key: 'reworkCount',   header: 'Reworks',
      render: (v) => v > 0 ? <span className="text-red-500 font-medium">{v}</span> : '0' },
    { key: 'score',         header: 'Score',       sortable: true,
      render: (v) => (
        <span className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold',
          (v ?? 0) >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
          : (v ?? 0) >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
          : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
        )}>
          {v ?? 0}/100
        </span>
      ) },
  ];

  return (
    <div className="space-y-5">
      {/* Employee summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-52 rounded-xl border border-slate-200 bg-white animate-pulse" />
            ))
          : rows.map((emp, idx) => (
              <EmployeePerfCard key={emp.name ?? idx} emp={emp} idx={idx} />
            ))
        }
      </div>

      {/* Detailed table */}
      <div>
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-3">
          Detailed Performance Table
        </h2>
        <DataTable
          columns={columns as any}
          data={rows}
          loading={isLoading}
          error={isError}
          onRetry={refetch}
          rowKey={(r) => r.name ?? ''}
          exportFilename="performance-report"
          exportTitle="Performance Report"
          searchable
          emptyMessage="No performance data for selected filters"
        />
      </div>
    </div>
  );
}

// ─── Delegation tab ───────────────────────────────────────────────────────────

function DelegationTab({ filters }: { filters: FilterValues }) {
  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ['reports', 'delegation', filters],
    queryFn: () => reportsApi.delegation(filters),
  });

  const rows = data?.data ?? [];

  const columns: Column<any>[] = [
    { key: 'taskId',      header: 'Task ID',   sortable: true },
    { key: 'title',       header: 'Title',     sortable: true },
    { key: 'delegatedBy', header: 'By',        render: (v) => v?.name ?? '—' },
    { key: 'delegatedTo', header: 'To',        render: (v) => v?.name ?? '—' },
    { key: 'project',     header: 'Project',   render: (v) => v?.name ?? '—' },
    { key: 'targetDate',  header: 'Due',       sortable: true, render: (v) => formatDate(v) },
    { key: 'priority',    header: 'Priority',  render: (v) => <PriorityBadge priority={v} /> },
    { key: 'status',      header: 'Status',    render: (v) => <StatusBadge status={v} /> },
    { key: 'delayDays',   header: 'Delay',     render: (v) => v > 0 ? <span className="text-red-500 font-medium">{v}d</span> : '—' },
    { key: 'reworkCount', header: 'Reworks',   render: (v) => v > 0 ? <span className="text-orange-500">{v}</span> : '0' },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={isLoading}
      error={isError}
      onRetry={refetch}
      rowKey={(r) => r.id ?? r.taskId}
      exportFilename="delegation-report"
      exportTitle="Delegation Report"
      searchable
      emptyMessage="No delegation data for selected filters"
    />
  );
}

// ─── Work Request tab ─────────────────────────────────────────────────────────

function WorkRequestTab({ filters }: { filters: FilterValues }) {
  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ['reports', 'work-requests', filters],
    queryFn: () => reportsApi.workRequests(filters),
  });

  const rows = data?.data ?? [];

  const columns: Column<any>[] = [
    { key: 'requestId',   header: 'ID',           sortable: true },
    { key: 'title',       header: 'Title',         sortable: true },
    { key: 'requestedBy', header: 'Requested By',  render: (v) => v?.name ?? '—' },
    { key: 'requestFor',  header: 'Assigned To',   render: (v) => v?.name ?? '—' },
    { key: 'project',     header: 'Project',       render: (v) => v?.name ?? '—' },
    { key: 'deadlineDate',header: 'Deadline',      render: (v) => formatDate(v) },
    { key: 'status',      header: 'Status',        render: (v) => <StatusBadge status={v} /> },
    { key: 'delayDays',   header: 'Delay',         render: (v) => v > 0 ? <span className="text-red-500 font-medium">{v}d</span> : '—' },
    { key: 'reworkCount', header: 'Reworks',       render: (v) => v > 0 ? <span className="text-orange-500">{v}</span> : '0' },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={isLoading}
      error={isError}
      onRetry={refetch}
      rowKey={(r) => r.id ?? r.requestId}
      exportFilename="work-requests-report"
      exportTitle="Work Request Report"
      searchable
      emptyMessage="No work request data for selected filters"
    />
  );
}

// ─── Checklist tab ────────────────────────────────────────────────────────────

function ChecklistTab({ filters }: { filters: FilterValues }) {
  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ['reports', 'checklist', filters],
    queryFn: () => reportsApi.checklist(filters),
  });

  const rows = data?.data ?? [];

  const columns: Column<any>[] = [
    { key: 'taskId',     header: 'ID',          sortable: true },
    { key: 'title',      header: 'Title',        sortable: true },
    { key: 'assignedTo', header: 'Assigned To',  render: (v) => v?.name ?? '—' },
    { key: 'project',    header: 'Project',      render: (v) => v?.name ?? '—' },
    { key: 'frequency',  header: 'Frequency' },
    { key: 'plannedDate',header: 'Planned',      render: (v) => formatDate(v) },
    { key: 'actualDate', header: 'Actual',       render: (v) => v ? formatDate(v) : '—' },
    { key: 'status',     header: 'Status',       render: (v) => <StatusBadge status={v} /> },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={isLoading}
      error={isError}
      onRetry={refetch}
      rowKey={(r) => r.id ?? r.taskId}
      exportFilename="checklist-report"
      exportTitle="Checklist Report"
      searchable
      emptyMessage="No checklist data for selected filters"
    />
  );
}

// ─── Project tab ──────────────────────────────────────────────────────────────

function ProjectTab({ filters }: { filters: FilterValues }) {
  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ['reports', 'projects', filters],
    queryFn: () => reportsApi.projects(filters),
  });

  const rows = data?.data ?? [];

  const columns: Column<any>[] = [
    { key: 'name',           header: 'Project',      sortable: true },
    { key: 'totalTasks',     header: 'Total' },
    { key: 'completed',      header: 'Done',
      render: (v) => <span className="text-green-600 font-medium">{v ?? 0}</span> },
    { key: 'pending',        header: 'Pending',
      render: (v) => <span className="text-amber-500 font-medium">{v ?? 0}</span> },
    { key: 'delayed',        header: 'Delayed',
      render: (v) => v > 0 ? <span className="text-red-500 font-medium">{v}</span> : '0' },
    { key: 'completionRate', header: 'Completion %',
      render: (v) => `${v ?? 0}%` },
    { key: 'healthScore',    header: 'Health',
      render: (v) => (
        <span className={cn('font-semibold',
          (v ?? 0) >= 70 ? 'text-green-600'
          : (v ?? 0) >= 40 ? 'text-yellow-600'
          : 'text-red-500',
        )}>
          {v ?? 0}%
        </span>
      ) },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={isLoading}
      error={isError}
      onRetry={refetch}
      rowKey={(r) => r.id ?? r.name}
      exportFilename="projects-report"
      exportTitle="Project Report"
      searchable
      emptyMessage="No project data for selected filters"
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [tab, setTab]         = useState<ReportTab>('performance');
  const [filters, setFilters] = useState<FilterValues>({ period: 'ALL' });
  const { data: users = [] }    = useActiveUsers();
  const { data: projects = [] } = useActiveProjects();

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  return (
    <div className="space-y-0">
      {/* Underline tab bar */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <nav className="flex overflow-x-auto">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0',
                tab === key
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300',
              )}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Filter bar */}
      <div className="pt-4">
        <FilterBar
          onFilter={setFilters}
          users={users}
          projects={projects}
          statusOptions={STATUS_OPTIONS}
          showUserFilter={tab !== 'projects'}
          showStatusFilter={tab !== 'performance' && tab !== 'projects'}
        />
      </div>

      {/* Tab content */}
      <div className="pt-5">
        {tab === 'performance'   && <PerformanceTab  filters={filters} />}
        {tab === 'delegation'    && <DelegationTab   filters={filters} />}
        {tab === 'work-requests' && <WorkRequestTab  filters={filters} />}
        {tab === 'checklist'     && <ChecklistTab    filters={filters} />}
        {tab === 'projects'      && <ProjectTab      filters={filters} />}
      </div>
    </div>
  );
}
