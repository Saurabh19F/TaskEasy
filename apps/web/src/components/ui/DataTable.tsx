'use client';

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, FileSpreadsheet, FileText, Search, AlertTriangle, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportToExcel, exportToPdf } from '@/lib/utils';
import { Button } from './Button';
import { Input } from './Input';
import { EmptyState } from './EmptyState';

export interface Column<T = any> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  /** True (or an error/message) when the query backing this table failed to load. */
  error?: boolean | string | null;
  /** Re-fetch handler surfaced as a "Retry" action in the error state. */
  onRetry?: () => void;
  exportFilename?: string;
  exportTitle?: string;
  /** Pass the full unpaginated dataset when you want exports to cover all pages.
   *  When omitted, exports use only the currently sorted/filtered visible data. */
  allData?: T[];
  searchable?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyAction?: React.ReactNode;
  /** Extra buttons/elements rendered in the toolbar alongside Excel/PDF */
  headerActions?: React.ReactNode;
  rowKey?: (row: T) => string;
  pageSize?: number;
}

export function DataTable<T extends Record<string, any>>({
  columns, data, loading = false,
  error = false, onRetry,
  exportFilename, exportTitle, allData,
  searchable = true, emptyMessage = 'No data available',
  emptyDescription, emptyIcon, emptyAction,
  headerActions,
  rowKey, pageSize = 25,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => String(row[col.key] ?? '').toLowerCase().includes(q)),
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  const handleExcelExport = () => {
    if (!exportFilename) return;
    // NOTE: sort/filter here is page-local; server-side pagination callers should
    // handle sorting server-side and pass allData for full-dataset exports.
    const exportData = allData ?? sorted;
    const rows = exportData.map((row) =>
      Object.fromEntries(columns.map((c) => [c.header, row[c.key]])),
    );
    exportToExcel(rows, exportFilename);
  };

  const handlePdfExport = () => {
    if (!exportFilename) return;
    const exportData = allData ?? sorted;
    const headers = columns.map((c) => c.header);
    const rows = exportData.map((row) => columns.map((c) => String(row[c.key] ?? '')));
    exportToPdf(headers, rows, exportFilename, exportTitle);
  };

  const SortIcon = ({ col }: { col: Column }) => {
    if (!col.sortable) return null;
    if (sortKey !== col.key) return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5 text-indigo-500" />
      : <ChevronDown className="h-3.5 w-3.5 text-indigo-500" />;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar — only render when there's something to show */}
      {(searchable || exportFilename || headerActions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-2.5">
          {searchable && (
            <Input
              className="max-w-md"
              placeholder="Search records, names, IDs, or projects"
              leftElement={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {headerActions}
            {exportFilename && !error && (
              <>
                <Button variant="secondary" size="sm" leftIcon={<FileSpreadsheet className="h-4 w-4 text-success" />} onClick={handleExcelExport}>
                  Excel
                </Button>
                <Button variant="secondary" size="sm" leftIcon={<FileText className="h-4 w-4 text-danger" />} onClick={handlePdfExport}>
                  PDF
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-border bg-surface-muted">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={cn(
                      'whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground',
                      col.sortable && 'cursor-pointer select-none transition-colors hover:text-foreground',
                      col.className,
                    )}
                  >
                    <div className="flex items-center gap-1">
                      {col.header}
                      <SortIcon col={col} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded-full bg-surface-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle className="h-6 w-6 text-red-400" />
                      <p className="text-sm font-medium text-foreground/80">
                        {typeof error === 'string' ? error : 'Failed to load data'}
                      </p>
                      {onRetry && (
                        <Button
                          variant="outline"
                          size="xs"
                          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                          onClick={onRetry}
                        >
                          Retry
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-0">
                    <EmptyState
                      icon={emptyIcon}
                      title={search.trim() ? 'No matching results' : emptyMessage}
                      description={search.trim() ? `Nothing matches "${search}". Try a different search.` : emptyDescription}
                      action={!search.trim() ? emptyAction : undefined}
                    />
                  </td>
                </tr>
              ) : (
                paged.map((row, i) => (
                  <tr
                    key={rowKey ? rowKey(row) : i}
                    className="transition-colors hover:bg-surface-muted/70"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn('px-4 py-3 text-foreground/90', col.className)}>
                        {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && sorted.length > pageSize && (
          <div className="flex items-center justify-between border-t border-border bg-surface-muted px-4 py-2.5">
            <span className="hero-chip-muted">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}
            </span>
            <div className="flex gap-1">
              <Button variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <Button variant="secondary" size="xs" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
