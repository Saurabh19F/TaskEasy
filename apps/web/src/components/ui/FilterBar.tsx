'use client';

import { useState } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import { Button } from './Button';

export type Period = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'LAST_WEEK' | 'CUSTOM';
export type SortDirection = 'asc' | 'desc';

export interface FilterValues {
  period: Period;
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  projectId?: string;
  status?: string;
  search?: string;
  sortBy?: string;
  sortDir?: SortDirection;
}

interface FilterBarProps {
  onFilter: (filters: FilterValues) => void;
  users?: { id: string; name: string }[];
  projects?: { id: string; name: string }[];
  statusOptions?: string[];
  showUserFilter?: boolean;
  showProjectFilter?: boolean;
  showStatusFilter?: boolean;
  showSearchFilter?: boolean;
  showSortFilter?: boolean;
  sortOptions?: { value: string; label: string }[];
  defaultPeriod?: Period;
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'TODAY', label: 'Today' },
  { value: 'THIS_WEEK', label: 'This Week' },
  { value: 'LAST_WEEK', label: 'Last Week' },
  { value: 'CUSTOM', label: 'Custom' },
];

export function FilterBar({
  onFilter, users = [], projects = [],
  statusOptions = [], showUserFilter = true,
  showProjectFilter = true, showStatusFilter = true,
  showSearchFilter = false, showSortFilter = false,
  sortOptions = [], defaultPeriod = 'ALL',
}: FilterBarProps) {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userId, setUserId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const applyFilter = (overrides?: Partial<FilterValues>) => {
    onFilter({ period, dateFrom, dateTo, userId, projectId, status, search, sortBy, sortDir, ...overrides });
  };

  const clearAll = () => {
    setPeriod('ALL');
    setDateFrom('');
    setDateTo('');
    setUserId('');
    setProjectId('');
    setStatus('');
    setSearch('');
    setSortBy('');
    setSortDir('desc');
    onFilter({ period: 'ALL' });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      {/* Icon label */}
      <SlidersHorizontal className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />

      {/* Period pills */}
      <div className="flex flex-wrap gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => { setPeriod(p.value); applyFilter({ period: p.value }); }}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all ${
              period === p.value
                ? 'bg-primary text-contrast shadow-[0_6px_16px_-8px_rgba(37,99,235,0.5)]'
                : 'bg-surface-muted text-muted-foreground hover:bg-surface-strong hover:text-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      {period === 'CUSTOM' && (
        <>
          <input
            type="date"
            className="h-7 w-32 rounded-lg border border-border bg-surface-muted px-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <input
            type="date"
            className="h-7 w-32 rounded-lg border border-border bg-surface-muted px-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </>
      )}

      {showUserFilter && users.length > 0 && (
        <select
          className="h-7 w-36 rounded-lg border border-border bg-surface-muted px-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        >
          <option value="">All Employees</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      )}

      {showProjectFilter && projects.length > 0 && (
        <select
          className="h-7 w-36 rounded-lg border border-border bg-surface-muted px-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}

      {showStatusFilter && statusOptions.length > 0 && (
        <select
          className="h-7 w-32 rounded-lg border border-border bg-surface-muted px-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All Status</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      )}

      {showSortFilter && sortOptions.length > 0 && (
        <>
          <select
            className="h-7 w-36 rounded-lg border border-border bg-surface-muted px-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="">Sort by</option>
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            className="h-7 w-20 rounded-lg border border-border bg-surface-muted px-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value as SortDirection)}
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </>
      )}

      {/* Actions */}
      <div className="ml-auto flex gap-1.5">
        <button
          onClick={() => applyFilter()}
          className="h-7 rounded-lg bg-primary px-3 text-[11px] font-semibold text-contrast transition-colors hover:bg-primary/90"
        >
          Apply
        </button>
        <button
          onClick={clearAll}
          className="flex h-7 items-center gap-1 rounded-lg border border-border bg-surface-muted px-2.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-surface-strong hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      </div>
    </div>
  );
}
