'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Camera, LayoutGrid, List, Target, RefreshCw, X, Check, Filter,
} from 'lucide-react';
import { misApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { FilterBar, FilterValues } from '@/components/ui/FilterBar';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/Badge';
import { useActiveUsers } from '@/hooks/useUsers';
import { useActiveProjects } from '@/hooks/useProjects';
import { useMisDetailed, useSaveWeeklyTarget, useSaveSnapshot } from '@/hooks/useMis';
import { cn, formatDate, isOverdue } from '@/lib/utils';
import type { UserMisCard, MisCategoryRaw } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-cyan-500', 'bg-amber-500',
  'bg-rose-500', 'bg-emerald-500', 'bg-indigo-500',
];

const CATEGORY_TAGS: Record<string, { label: string; bg: string; text: string }> = {
  del: { label: 'DEL', bg: 'bg-orange-100', text: 'text-orange-700' },
  wor: { label: 'WOR', bg: 'bg-blue-100',   text: 'text-blue-700' },
  che: { label: 'CHE', bg: 'bg-purple-100', text: 'text-purple-700' },
  fms: { label: 'FMS', bg: 'bg-green-100',  text: 'text-green-700' },
};

const DRILL_MAP: Record<string, { category: 'delegation' | 'workRequest' | 'checklist' | 'fms'; label: string }> = {
  del: { category: 'delegation',  label: 'Delegation' },
  wor: { category: 'workRequest', label: 'Work Requests' },
  che: { category: 'checklist',   label: 'Checklist' },
  fms: { category: 'fms',        label: 'FMS' },
};

const GRADE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  A_PLUS: { label: 'A+', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  A:      { label: 'A',  color: 'text-green-700',   bg: 'bg-green-100' },
  B:      { label: 'B',  color: 'text-yellow-700',  bg: 'bg-yellow-100' },
  C:      { label: 'C',  color: 'text-orange-700',  bg: 'bg-orange-100' },
  D:      { label: 'D',  color: 'text-red-700',     bg: 'bg-red-100' },
  N_A:    { label: '—',  color: 'text-slate-500',   bg: 'bg-slate-100' },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type KpiType = 'completedAsPerPlan' | 'completedOnTime' | 'noDelay';

const KPI_LABELS: Record<KpiType, string> = {
  completedAsPerPlan: 'Completed as per Plan',
  completedOnTime:    'Completed on Time',
  noDelay:            'No Delay in Completing the Work',
};

const PLAN_DATE_FIELD: Record<string, string> = {
  delegation:  'targetDate',
  workRequest: 'deadlineDate',
  checklist:   'plannedDate',
  fms:         'plannedDate',
};

const ACTUAL_DATE_FIELD: Record<string, string> = {
  delegation:  'actualDate',
  workRequest: 'completionDate',
  checklist:   'actualDate',
  fms:         'actualDate',
};

function filterByKpi(data: any[], kpi?: KpiType): any[] {
  if (!kpi) return data;
  switch (kpi) {
    case 'completedAsPerPlan': return data.filter((t) => t.status !== 'COMPLETED');
    case 'completedOnTime':    return data.filter((t) => t.onTimeStatus === 'LATE');
    case 'noDelay':            return data.filter((t) => (t.delayDays ?? 0) > 0);
    default: return data;
  }
}

function getDisplayStatus(task: any, planField: string): string {
  if (task.status !== 'COMPLETED' && task[planField] && new Date(task[planField]) < new Date()) {
    return 'OVERDUE';
  }
  return task.status ?? 'UNKNOWN';
}

interface DrillTarget {
  userId: string;
  name: string;
  category: 'delegation' | 'workRequest' | 'checklist' | 'fms';
  label: string;
  kpi?: KpiType;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctColor(v: number) {
  if (v === 0)   return 'text-green-600';
  if (v >= -20)  return 'text-amber-600';
  return 'text-red-500';
}

function scoreColor(v: number | null | undefined) {
  if (v === null || v === undefined) return 'text-slate-400';
  if (v >= 80) return 'text-green-600';
  if (v >= 60) return 'text-amber-600';
  return 'text-red-500';
}

function fmtKpi(v: number | undefined, unit: '%' | 'd') {
  if (v === undefined || v === null) return '0' + unit;
  return `${v}${unit}`;
}


// ─── Drill-down Modal ─────────────────────────────────────────────────────────

const DRILL_PER_PAGE = 10;

function DrillDownModal({ target, filters, onClose }: {
  target: DrillTarget;
  filters: FilterValues;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);

  const { data: allData = [], isLoading, isError, refetch } = useMisDetailed({
    ...filters,
    userId: target.userId,       // must come after spread so filters.userId can't overwrite it
    category: target.category,
  });

  const planField   = PLAN_DATE_FIELD[target.category]   ?? 'targetDate';
  const actualField = ACTUAL_DATE_FIELD[target.category] ?? 'actualDate';

  const filtered   = filterByKpi(allData as any[], target.kpi);
  const totalPages = Math.max(1, Math.ceil(filtered.length / DRILL_PER_PAGE));
  const pageData   = filtered.slice((page - 1) * DRILL_PER_PAGE, page * DRILL_PER_PAGE);

  const kpiTitle  = target.kpi ? `${KPI_LABELS[target.kpi]} (${target.label})` : target.label;
  const isPerfect = !isLoading && !isError && filtered.length === 0 && !!target.kpi;

  return (
    <Modal open onClose={onClose} size="2xl">
      {/* Custom header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
            {target.label.toUpperCase()}: DRILL DOWN REPORT
          </p>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{kpiTitle}</h2>
          {target.kpi && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-red-500 mt-1">
              <Filter className="h-3.5 w-3.5" />
              Showing tasks causing negative score
            </p>
          )}
        </div>
        <div className="flex items-start gap-2 flex-shrink-0">
          <div className="text-right bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee</p>
            <p className="text-sm font-bold text-indigo-700 mt-0.5">{target.name}</p>
          </div>
          <button
            onClick={onClose}
            className="mt-1 rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="h-48 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="text-center py-12">
          <p className="text-sm text-slate-500">Failed to load data</p>
          <button onClick={() => refetch()} className="mt-2 text-sm text-indigo-600 hover:underline">Retry</button>
        </div>
      )}

      {/* Perfect Score */}
      {isPerfect && (
        <div className="rounded-xl bg-green-50 border border-green-100 py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-3">
            <Check className="h-6 w-6 text-contrast" />
          </div>
          <p className="text-lg font-bold text-green-700">Perfect Score!</p>
          <p className="text-sm text-green-500 mt-1">No negative tasks found for this specific KPI.</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && (!target.kpi || filtered.length > 0) && (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800">
                  {['ID', 'TASK DESCRIPTION', 'PLAN DATE', 'ACTUAL DATE', 'DELAY', 'STATUS'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageData.map((task: any, i: number) => {
                  const planDate   = task[planField];
                  const actualDate = task[actualField];
                  const delay      = task.delayDays ?? 0;
                  const dispStatus = getDisplayStatus(task, planField);
                  return (
                    <tr key={task.id ?? i} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                        {task.taskId ?? (task.id ? String(task.id).slice(-6) : i + 1)}
                      </td>
                      <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium max-w-xs">
                        {task.title ?? task.description ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs whitespace-pre-line">
                        {planDate ? formatDate(planDate) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {actualDate ? formatDate(actualDate) : '-'}
                      </td>
                      <td className={cn('px-4 py-3 text-xs font-bold', delay > 0 ? 'text-red-500' : 'text-slate-400')}>
                        {delay > 0 ? `${delay} Days` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={dispStatus} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="h-8 w-8 rounded-full bg-indigo-600 text-contrast text-sm font-bold flex items-center justify-center">
              {page}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ─── Set Weekly Target Modal ───────────────────────────────────────────────────

function SetTargetModal({ card, onClose }: { card: UserMisCard; onClose: () => void }) {
  const [score, setScore] = useState<number>(card.lastWeekTarget ?? 80);
  const { mutate, isPending } = useSaveWeeklyTarget();

  function handleSave() {
    mutate({ userId: card.userId, targetScore: score });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={`Set Weekly Target — ${card.name}`} size="sm">
      <div className="space-y-4 p-1">
        <p className="text-sm text-slate-500">
          Current score: <span className="font-semibold text-slate-700">{card.score ?? '—'}</span>
        </p>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Target score (0 – 100)</label>
          <input
            type="number" min={0} max={100} value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-contrast font-semibold hover:bg-indigo-700 disabled:opacity-60"
          >
            Save Target
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Employee MIS Card ────────────────────────────────────────────────────────

const EMPTY_RAW: MisCategoryRaw = { total: 0, completed: 0, pending: 0, onTime: 0, late: 0, delayDays: 0 };

const CAT_ROWS: { label: string; key: 'del' | 'wor' | 'che' | 'fms' }[] = [
  { label: 'Delegation',   key: 'del' },
  { label: 'Work Request', key: 'wor' },
  { label: 'Checklist',    key: 'che' },
  { label: 'FMS',          key: 'fms' },
];

function EmployeeMisCard({
  card, idx, onDrill, onSetTarget,
}: {
  card: UserMisCard;
  idx: number;
  onDrill: (t: DrillTarget) => void;
  onSetTarget: (c: UserMisCard) => void;
}) {
  const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  const m = card.metrics;

  // Avg. Score = -(pending/total)*100, matching old app display
  const avgScore = m.total > 0 ? -((m.pending / m.total) * 100) : 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">

      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className={cn('h-10 w-10 rounded-full flex items-center justify-center text-contrast text-sm font-bold flex-shrink-0', avatarColor)}>
            {card.name[0].toUpperCase()}
          </div>
          <div>
            <p className="text-base font-bold text-indigo-700">{card.name}</p>
            <p className={cn('text-sm font-semibold', avgScore < 0 ? 'text-red-500' : 'text-green-600')}>
              Avg. Score: {avgScore.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Last Week Planned Target Score:&nbsp;
              <span className="font-medium text-slate-500">{card.lastWeekTarget ?? '—'}</span>
            </p>
          </div>
        </div>
        <button
          onClick={() => onSetTarget(card)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-contrast text-sm font-semibold hover:bg-indigo-700 transition-colors flex-shrink-0"
        >
          <RefreshCw className="h-4 w-4" />
          Update
        </button>
      </div>

      {/* Summary badges */}
      <div className="flex justify-end gap-2 px-5 py-3 border-b border-slate-100">
        <span className="rounded-full border border-slate-300 text-slate-700 text-xs font-semibold px-3 py-1">
          Total: {m.total}
        </span>
        <span className="rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1">
          Pending: {m.pending}
        </span>
        <span className="rounded-full bg-green-100 text-green-700 text-xs font-semibold px-3 py-1">
          Done: {m.completed}
        </span>
        <span className="rounded-full bg-red-100 text-red-700 text-xs font-semibold px-3 py-1">
          Late: {m.late}
        </span>
      </div>

      {/* Category breakdown table */}
      <div className="px-5 py-3 border-b border-slate-100">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-slate-500 uppercase text-[10px] font-semibold tracking-wide">
              <th className="text-left py-2 pr-2">Category</th>
              <th className="text-center py-2 px-1 bg-slate-100 rounded">Total</th>
              <th className="text-center py-2 px-1">Done</th>
              <th className="text-center py-2 px-1">Pend</th>
              <th className="text-center py-2 px-1">On Time</th>
              <th className="text-center py-2 px-1">Late</th>
              <th className="text-center py-2 px-1">Days</th>
            </tr>
          </thead>
          <tbody>
            {CAT_ROWS.map(({ label, key }) => {
              const r = card.categoryRaw?.[key] ?? EMPTY_RAW;
              const drill = DRILL_MAP[key];
              return (
                <tr
                  key={key}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onDrill({ userId: card.userId, name: card.name, ...drill })}
                >
                  <td className="py-2 pr-2 text-slate-600 font-medium">{label}</td>
                  <td className="py-2 px-1 text-center font-bold text-slate-800">{r.total}</td>
                  <td className="py-2 px-1 text-center font-semibold text-blue-600">{r.completed}</td>
                  <td className="py-2 px-1 text-center font-semibold text-amber-500">{r.pending}</td>
                  <td className="py-2 px-1 text-center font-semibold text-green-600">{r.onTime}</td>
                  <td className="py-2 px-1 text-center font-semibold text-red-500">{r.late}</td>
                  <td className="py-2 px-1 text-center font-semibold text-red-500">{r.delayDays}</td>
                </tr>
              );
            })}
            {/* Total row */}
            <tr className="border-t-2 border-slate-300 bg-indigo-50/60">
              <td className="py-2 pr-2 font-bold text-slate-800 uppercase text-[11px] tracking-wide">Total</td>
              <td className="py-2 px-1 text-center font-bold text-slate-800">{m.total}</td>
              <td className="py-2 px-1 text-center font-bold text-blue-600">{m.completed}</td>
              <td className="py-2 px-1 text-center font-bold text-amber-500">{m.pending}</td>
              <td className="py-2 px-1 text-center font-bold text-green-600">{m.onTime}</td>
              <td className="py-2 px-1 text-center font-bold text-red-500">{m.late}</td>
              <td className="py-2 px-1 text-center font-bold text-red-500">{m.delayDays}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* KPI breakdown rows — per category, 3 KPIs each, clickable */}
      <div className="divide-y divide-slate-50">
        {CAT_ROWS.map(({ key }) => {
          const tag  = CATEGORY_TAGS[key];
          const drill = DRILL_MAP[key];
          const kpis = card.categoryMetrics?.[key] ?? { completedAsPerPlan: 0, completedOnTime: 0, noDelay: 0 };
          return (
            <div key={key}>
              {([
                { kpi: 'completedAsPerPlan' as KpiType, value: kpis.completedAsPerPlan, unit: '%' as const },
                { kpi: 'completedOnTime'    as KpiType, value: kpis.completedOnTime,    unit: '%' as const },
                { kpi: 'noDelay'            as KpiType, value: kpis.noDelay,            unit: 'd' as const },
              ]).map(({ kpi, value, unit }) => (
                <div
                  key={kpi}
                  onClick={() => onDrill({ userId: card.userId, name: card.name, ...drill, kpi })}
                  className="flex items-center gap-3 px-5 py-2 hover:bg-indigo-50 cursor-pointer transition-colors"
                >
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold flex-shrink-0', tag.bg, tag.text)}>
                    {tag.label}
                  </span>
                  <span className="flex-1 text-xs text-slate-500">{KPI_LABELS[kpi]}</span>
                  <span className={cn('text-xs font-semibold flex-shrink-0', pctColor(value))}>
                    {fmtKpi(value, unit)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

    </div>
  );
}

// ─── Detailed Analysis Table ───────────────────────────────────────────────────

function DetailedAnalysisTable({
  cards, onDrill, onSetTarget,
}: {
  cards: UserMisCard[];
  onDrill: (t: DrillTarget) => void;
  onSetTarget: (card: UserMisCard) => void;
}) {
  const columns: Column<UserMisCard>[] = [
    { key: 'name',    header: 'Employee', sortable: true },
    { key: 'role',    header: 'Role',     sortable: true },
    { key: 'metrics', header: 'Total',    render: (m) => m.total },
    { key: 'metrics', header: 'Done',     render: (m) => <span className="text-green-600">{m.completed}</span> },
    { key: 'metrics', header: 'Pending',  render: (m) => <span className="text-amber-600">{m.pending}</span> },
    { key: 'metrics', header: 'Late',     render: (m) => <span className="text-red-500">{m.late}</span> },
    { key: 'metrics', header: 'On-Time %', render: (m) => `${m.onTimePercent}%` },
    { key: 'metrics', header: 'Avg Delay', render: (m) => m.delayDays > 0 ? `${m.delayDays}d` : '—' },
    { key: 'metrics', header: 'Reworks',  render: (m) => m.reworkCount > 0 ? <span className="text-orange-500">{m.reworkCount}</span> : '0' },
    {
      key: 'score', header: 'Score', sortable: true,
      render: (v) => (
        <span className={cn('font-semibold', scoreColor(v))}>
          {v ?? '—'}
        </span>
      ),
    },
    {
      key: 'grade', header: 'Grade',
      render: (v) => {
        const g = GRADE_CONFIG[v] ?? GRADE_CONFIG['N_A'];
        return <span className={cn('rounded px-2 py-0.5 text-xs font-bold', g.color, g.bg)}>{g.label}</span>;
      },
    },
    {
      key: 'lastWeekTarget', header: 'Target',
      render: (v, row) => (
        <button
          onClick={() => onSetTarget(row)}
          className="flex items-center gap-1 text-indigo-600 hover:underline text-sm"
        >
          <Target className="h-3 w-3" />
          {v ?? 'Set'}
        </button>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns as any}
      data={cards}
      rowKey={(r) => r.userId}
      exportFilename="mis-detailed-analysis"
      exportTitle="MIS Detailed Analysis"
      searchable
      emptyMessage="No employee data for the selected filters"
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ['ADMIN', 'MANAGER', 'COMPANY_OWNER', 'SAAS_OWNER'];
type ViewMode = 'cards' | 'table';

export default function MisPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [filters, setFilters] = useState<FilterValues>({ period: 'LAST_WEEK' });
  const [drill, setDrill] = useState<DrillTarget | null>(null);
  const [targetCard, setTargetCard] = useState<UserMisCard | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  const { data: users = [] }    = useActiveUsers();
  const { data: projects = [] } = useActiveProjects();
  const { mutate: saveSnapshot, isPending: snapshotPending } = useSaveSnapshot();

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['mis', filters],
    queryFn: () => misApi.get(filters),
  });

  const cards   = data?.cards ?? [];
  const summary = data?.summary;

  const statCards = [
    {
      value: summary ? `${summary.avgWorkNotDone ?? 0}%` : '—',
      label: 'Avg. Work Not Done',
      badge: 'Not Done',
      badgeColor: 'bg-red-100 text-red-600',
    },
    {
      value: summary ? `${summary.avgWorkDelayed ?? 0}%` : '—',
      label: 'Avg. Work Delayed Pending',
      badge: 'Delayed',
      badgeColor: 'bg-amber-100 text-amber-600',
    },
    {
      value: summary?.avgChecklistPending ?? (isLoading ? '—' : 0),
      label: 'Avg. Checklist Pending',
      badge: 'Checklist',
      badgeColor: 'bg-green-100 text-green-600',
    },
    {
      value: summary?.totalEmployees ?? cards.length,
      label: 'Total Employees',
      badge: 'Active',
      badgeColor: 'bg-cyan-100 text-cyan-600',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">MIS Analytics</h1>
        <button
          onClick={() => saveSnapshot()}
          disabled={snapshotPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-contrast text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          <Camera className="h-4 w-4" />
          {snapshotPending ? 'Saving…' : 'Save Snapshot'}
        </button>
      </div>

      {/* Filters */}
      <FilterBar
        onFilter={setFilters}
        users={users}
        projects={projects}
        showStatusFilter={false}
        defaultPeriod="LAST_WEEK"
      />

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map(({ value, label, badge, badgeColor }) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 shadow-sm p-5 flex items-start justify-between"
          >
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
              <p className="text-xs text-slate-500 mt-1 leading-snug">{label}</p>
            </div>
            <span className={cn('text-xs font-semibold rounded-full px-2 py-0.5 mt-0.5 flex-shrink-0', badgeColor)}>
              {badge}
            </span>
          </div>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <button
            onClick={() => setViewMode('cards')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors',
              viewMode === 'cards'
                ? 'bg-indigo-600 text-contrast'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            Card View
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-semibold border-l border-slate-200 dark:border-slate-700 transition-colors',
              viewMode === 'table'
                ? 'bg-indigo-600 text-contrast'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
            )}
          >
            <List className="h-4 w-4" />
            Detailed Analysis
          </button>
        </div>

        <button
          onClick={() => refetch()}
          title="Refresh"
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
        </button>
      </div>

      {/* Error state */}
      {isError && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-12 text-center">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Failed to load MIS data</p>
          <button onClick={() => refetch()} className="mt-2 text-sm font-medium text-indigo-600 hover:underline">
            Retry
          </button>
        </div>
      )}

      {/* Card view — 2-column grid matching the PDF */}
      {!isError && viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-white h-96 animate-pulse" />
              ))
            : cards.length === 0
            ? (
              <div className="col-span-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-16 text-center">
                <p className="text-sm text-slate-500">No employee data for the selected filters</p>
              </div>
            )
            : cards.map((card, idx) => (
              <EmployeeMisCard
                key={card.userId}
                card={card}
                idx={idx}
                onDrill={setDrill}
                onSetTarget={setTargetCard}
              />
            ))
          }
        </div>
      )}

      {/* Detailed analysis (table) view */}
      {!isError && viewMode === 'table' && !isLoading && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <DetailedAnalysisTable
            cards={cards}
            onDrill={setDrill}
            onSetTarget={setTargetCard}
          />
        </div>
      )}

      {/* Loading state for table view */}
      {!isError && viewMode === 'table' && isLoading && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-64 animate-pulse" />
      )}

      {/* Modals */}
      {drill && (
        <DrillDownModal target={drill} filters={filters} onClose={() => setDrill(null)} />
      )}
      {targetCard && (
        <SetTargetModal card={targetCard} onClose={() => setTargetCard(null)} />
      )}
    </div>
  );
}
