'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, ClipboardList, FileSpreadsheet, FileText, Plus, Search, X } from 'lucide-react';
import {
  useDelegation,
  useMyPendingDelegation,
  useSubmitDelegation,
  useCreateDelegationBulk,
} from '@/hooks/useDelegation';
import { FileUpload } from '@/components/ui/FileUpload';
import { useAuthStore } from '@/store/auth.store';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea, Select, Input } from '@/components/ui/Input';
import { formatDate, isOverdue, exportToExcel, exportToPdf } from '@/lib/utils';
import { useActiveProjects } from '@/hooks/useProjects';
import { useActiveUsers } from '@/hooks/useUsers';
import {
  delegationBulkSchema,
  type DelegationBulkFormValues,
  delegationSubmitSchema,
  type DelegationSubmitFormValues,
} from '@/lib/schemas';
import { FilterBar, type FilterValues, type Period } from '@/components/ui/FilterBar';
import type { DelegationTask } from '@/types';

const tabs = ['My Pending', 'All Delegations'] as const;
type Tab = typeof tabs[number];

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL'] as const;
const STATUS_OPTIONS = ['PENDING', 'SEND_FOR_APPROVAL', 'REWORK', 'COMPLETED', 'IN_PROGRESS'];
const SORT_OPTIONS = [
  { value: 'DUE_DATE', label: 'Due Date' },
  { value: 'PROJECT', label: 'Project' },
  { value: 'ASSIGNEE', label: 'User' },
  { value: 'STATUS', label: 'Status' },
  { value: 'CREATED_AT', label: 'Created Date' },
];

const createTask = () => ({
  title: '',
  description: '',
  targetDate: '',
  targetTime: '',
  priority: 'MEDIUM' as const,
  attachmentIds: [] as string[],
});

const createFormDefaults = (): DelegationBulkFormValues => ({
  delegatedToIds: [],
  projectId: '',
  tasks: [createTask()],
});

// ─── AssigneePicker ────────────────────────────────────────────────────────────

function AssigneePicker({
  users,
  value,
  onChange,
  error,
}: {
  users: { id: string; name: string; email?: string | null }[];
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.email ?? ''].some((f) => f.toLowerCase().includes(q)),
    );
  }, [search, users]);

  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...value, id] : value.filter((x) => x !== id));

  const selectedNames = users.filter((u) => value.includes(u.id)).map((u) => u.name);

  return (
    <div className="space-y-1.5" ref={ref}>
      <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Assign To *
      </label>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-sm transition-colors ${
          open ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
        } bg-surface`}
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {value.length === 0 ? (
            <span className="text-muted-foreground">Select users to assign…</span>
          ) : (
            selectedNames.map((name) => (
              <span
                key={name}
                className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              >
                {name}
              </span>
            ))
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-[min(400px,90vw)] rounded-2xl border border-border bg-surface shadow-xl">
          <div className="border-b border-border p-2">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Search users…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">No users found</p>
            ) : (
              filtered.map((u) => {
                const checked = value.includes(u.id);
                return (
                  <label
                    key={u.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                      checked ? 'bg-primary/8 text-foreground' : 'hover:bg-surface-muted/70'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                      checked={checked}
                      onChange={(e) => toggle(u.id, e.target.checked)}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{u.name}</span>
                      {u.email && (
                        <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                      )}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <span>{value.length} selected</span>
            {value.length > 0 && (
              <button type="button" className="text-primary hover:underline" onClick={() => onChange([])}>
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs font-medium text-brand">{error}</p>}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function matchesPeriod(dateStr: string | undefined, period: Period): boolean {
  if (!dateStr || period === 'ALL') return true;
  const d = new Date(dateStr);
  const now = new Date();
  const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const today = startOfDay(now);
  if (period === 'TODAY') return startOfDay(d).getTime() === today.getTime();
  if (period === 'THIS_WEEK') {
    const day = today.getDay();
    const weekStart = new Date(today); weekStart.setDate(today.getDate() - day);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
    return d >= weekStart && d <= weekEnd;
  }
  if (period === 'LAST_WEEK') {
    const day = today.getDay();
    const thisWeekStart = new Date(today); thisWeekStart.setDate(today.getDate() - day);
    const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart); lastWeekEnd.setDate(thisWeekStart.getDate() - 1);
    return d >= lastWeekStart && d <= lastWeekEnd;
  }
  return true;
}

function applyClientFilters(rows: DelegationTask[], filters: FilterValues): DelegationTask[] {
  return rows.filter((row) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!row.title?.toLowerCase().includes(q)) return false;
    }
    if (filters.status && row.status !== filters.status) return false;
    if (filters.projectId && row.project?.id !== filters.projectId) return false;
    if (filters.userId && row.delegatedTo?.id !== filters.userId) return false;
    if (filters.period && filters.period !== 'ALL' && filters.period !== 'CUSTOM') {
      if (!matchesPeriod(row.targetDate ?? row.createdAt, filters.period)) return false;
    }
    if (filters.period === 'CUSTOM') {
      const d = new Date(row.targetDate ?? row.createdAt ?? '');
      if (filters.dateFrom && d < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && d > new Date(filters.dateTo)) return false;
    }
    return true;
  });
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DelegationPage() {
  const [activeTab, setActiveTab] = useState<Tab>('My Pending');
  const [assignModal, setAssignModal] = useState(false);
  const [bulkFormatModal, setBulkFormatModal] = useState(false);
  const [submitModal, setSubmitModal] = useState<DelegationTask | null>(null);
  const [allFilters, setAllFilters] = useState<FilterValues>({ period: 'ALL' });
  const [pendingFilters, setPendingFilters] = useState<FilterValues>({ period: 'ALL' });
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);

  const { user } = useAuthStore();
  const isAdmin = ['ADMIN', 'MANAGER', 'COMPANY_OWNER', 'SAAS_OWNER'].includes(user?.role ?? '');

  const { data: pending, isLoading: loadingPending, isError: pendingError, refetch: refetchPending } = useMyPendingDelegation();
  const allQueryParams = useMemo(
    () => ({
      limit: 500,
      ...(allFilters.period && allFilters.period !== 'ALL' ? { period: allFilters.period } : {}),
      ...(allFilters.dateFrom ? { dateFrom: allFilters.dateFrom } : {}),
      ...(allFilters.dateTo ? { dateTo: allFilters.dateTo } : {}),
      ...(allFilters.userId ? { assignedToId: allFilters.userId } : {}),
      ...(allFilters.projectId ? { projectId: allFilters.projectId } : {}),
      ...(allFilters.status ? { status: allFilters.status } : {}),
      ...(allFilters.search ? { search: allFilters.search } : {}),
      ...(allFilters.sortBy ? { sortBy: allFilters.sortBy } : {}),
      ...(allFilters.sortDir ? { sortDir: allFilters.sortDir } : {}),
    }),
    [allFilters],
  );
  const { data: all, isLoading: loadingAll, isError: allError, refetch: refetchAll } = useDelegation(
    allQueryParams,
    activeTab === 'All Delegations',
  );

  const { data: projects = [] } = useActiveProjects();
  const { data: users = [] } = useActiveUsers();
  const { mutate: submitTask, isPending: submitting } = useSubmitDelegation();
  const { mutate: createBulk, isPending: creating } = useCreateDelegationBulk();

  const sortedProjects = useMemo(() => [...projects].sort((a, b) => a.name.localeCompare(b.name)), [projects]);
  const sortedUsers = useMemo(() => [...users].sort((a, b) => a.name.localeCompare(b.name)), [users]);

  // ── Assign form (single + multi task) ──
  const assignForm = useForm<DelegationBulkFormValues>({
    resolver: zodResolver(delegationBulkSchema),
    defaultValues: createFormDefaults(),
  });
  const { control, register, handleSubmit, watch, setValue, reset, formState: { errors } } = assignForm;
  const { fields, append, remove } = useFieldArray({ control, name: 'tasks' });
  const delegatedToIds = watch('delegatedToIds');

  // ── Bulk format form (compact table) ──
  const bulkForm = useForm<DelegationBulkFormValues>({
    resolver: zodResolver(delegationBulkSchema),
    defaultValues: createFormDefaults(),
  });
  const {
    control: bulkCtrl,
    register: regBulk,
    handleSubmit: submitBulk,
    watch: watchBulk,
    setValue: setBulkVal,
    reset: resetBulk,
    formState: { errors: bulkErr },
  } = bulkForm;
  const { fields: bulkFields, append: bulkAppend, remove: bulkRemove } = useFieldArray({ control: bulkCtrl, name: 'tasks' });
  const bulkAssigneeIds = watchBulk('delegatedToIds');

  // ── Submit form ──
  const submitForm = useForm<DelegationSubmitFormValues>({
    resolver: zodResolver(delegationSubmitSchema),
    defaultValues: { doerRemarks: '' },
  });
  const { register: regSubmit, handleSubmit: handleSubmitTask, reset: resetSubmit, formState: { errors: submitErrors } } = submitForm;

  useEffect(() => {
    if (!assignModal) { reset(createFormDefaults()); setAttachmentIds([]); }
  }, [assignModal, reset]);

  useEffect(() => {
    if (!bulkFormatModal) { resetBulk(createFormDefaults()); }
  }, [bulkFormatModal, resetBulk]);

  useEffect(() => {
    if (!submitModal) { setAttachmentIds([]); resetSubmit({ doerRemarks: '' }); }
  }, [submitModal, resetSubmit]);

  const onAssign = (values: DelegationBulkFormValues) => {
    createBulk(
      {
        delegatedToIds: values.delegatedToIds,
        projectId: values.projectId,
        tasks: values.tasks.map((t) => ({
          title: t.title,
          description: t.description || undefined,
          targetDate: t.targetDate,
          targetTime: t.targetTime || undefined,
          priority: t.priority,
          attachmentIds: t.attachmentIds ?? [],
        })),
      },
      { onSuccess: () => setAssignModal(false) },
    );
  };

  const onBulkFormat = (values: DelegationBulkFormValues) => {
    createBulk(
      {
        delegatedToIds: values.delegatedToIds,
        projectId: values.projectId,
        tasks: values.tasks.map((t) => ({
          title: t.title,
          description: t.description || undefined,
          targetDate: t.targetDate,
          targetTime: t.targetTime || undefined,
          priority: t.priority,
          attachmentIds: [],
        })),
      },
      { onSuccess: () => setBulkFormatModal(false) },
    );
  };

  const onSubmitTask = (values: DelegationSubmitFormValues) => {
    if (!submitModal) return;
    submitTask(
      { id: submitModal.id, ...values, attachmentIds },
      { onSuccess: () => setSubmitModal(null) },
    );
  };

  const pendingRows = useMemo(() => applyClientFilters(pending ?? [], pendingFilters), [pending, pendingFilters]);
  const activeRows = activeTab === 'My Pending' ? pendingRows : (all?.data ?? []);
  const activeLoading = activeTab === 'My Pending' ? loadingPending : loadingAll;
  const activeError = activeTab === 'My Pending' ? pendingError : allError;
  const activeRetry = activeTab === 'My Pending' ? refetchPending : refetchAll;

  const columns: Column<DelegationTask>[] = [
    { key: 'taskId', header: 'Task ID', sortable: true },
    { key: 'title', header: 'Title', sortable: true },
    { key: 'delegatedTo', header: 'Assigned To', sortable: true, render: (v) => v?.name ?? '—' },
    { key: 'project', header: 'Project', sortable: true, render: (v) => v?.name ?? '—' },
    {
      key: 'targetDate',
      header: 'Due Date',
      sortable: true,
      render: (v) => <span className={isOverdue(v) ? 'font-medium text-red-500' : ''}>{formatDate(v)}</span>,
    },
    { key: 'createdAt', header: 'Created', sortable: true, render: (v) => formatDate(v) },
    { key: 'priority', header: 'Priority', render: (v) => <PriorityBadge priority={v} /> },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'id',
      header: 'Actions',
      render: (_, row) => {
        const isAssignee = row.delegatedTo?.id === (user?.id ?? user?.sub);
        const canDone = (row.status === 'PENDING' || row.status === 'REWORK' || row.status === 'IN_PROGRESS');
        return (
          <div className="flex items-center gap-1.5">
            {canDone && (isAssignee || activeTab === 'My Pending') && (
              <Button size="xs" onClick={() => setSubmitModal(row)}>Done</Button>
            )}
            {row.status === 'SEND_FOR_APPROVAL' && (
              <span className="text-xs text-amber-600 font-medium whitespace-nowrap">Awaiting Approval</span>
            )}
            {row.status === 'COMPLETED' && (
              <span className="text-xs text-green-600 font-medium">Completed</span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      {/* Tabs + Assign Tasks */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700" role="tablist">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<FileSpreadsheet className="h-4 w-4 text-green-600" />}
            onClick={() => exportToExcel(activeRows.map((r: any) => ({ ID: r.taskId, Title: r.title, Assignee: r.delegatedTo?.name, Project: r.project?.name, Status: r.status, Priority: r.priority, Due: formatDate(r.targetDate) })), 'delegation-report')}
          >
            Excel
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<FileText className="h-4 w-4 text-red-500" />}
            onClick={() => exportToPdf(['ID','Title','Assignee','Project','Status','Priority','Due'], activeRows.map((r: any) => [r.taskId, r.title, r.delegatedTo?.name ?? '', r.project?.name ?? '', r.status, r.priority, formatDate(r.targetDate)]), 'delegation-report', 'Delegation Report')}
          >
            PDF
          </Button>
          {isAdmin && (
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAssignModal(true)}>
              Assign Tasks
            </Button>
          )}
        </div>
      </div>

      {/* FilterBar — both tabs */}
      <FilterBar
        onFilter={activeTab === 'My Pending' ? setPendingFilters : setAllFilters}
        users={sortedUsers}
        projects={sortedProjects}
        statusOptions={STATUS_OPTIONS}
        showSearchFilter={false}
        showSortFilter={false}
      />

      <DataTable
        columns={columns}
        data={activeRows}
        loading={activeLoading}
        error={activeError}
        onRetry={activeRetry}
        allData={activeRows}
        searchable={false}
        rowKey={(r) => r.id}
        emptyMessage="No delegation tasks found"
        emptyAction={undefined}
        headerActions={undefined}
      />

      {/* ── Assign Tasks Modal ── */}
      <Modal
        open={assignModal}
        onClose={() => setAssignModal(false)}
        title="Assign Tasks"
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setAssignModal(false)}>Cancel</Button>
            <Button onClick={handleSubmit(onAssign)} loading={creating}>Send All Tasks</Button>
          </>
        }
      >
        <form className="space-y-3" onSubmit={handleSubmit(onAssign)}>
          {/* Assign To + Project side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <AssigneePicker
                users={sortedUsers}
                value={delegatedToIds}
                onChange={(ids) => setValue('delegatedToIds', ids, { shouldValidate: true })}
                error={errors.delegatedToIds?.message}
              />
            </div>
            <Select label="Project" error={errors.projectId?.message} {...register('projectId')}>
              <option value="">Select project…</option>
              {sortedProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>

          {/* Task rows */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Tasks ({fields.length})
              </p>
              <Button type="button" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => append(createTask())}>
                + Task
              </Button>
            </div>

            <div className="space-y-2">
              {fields.map((field, i) => {
                const rowErr = errors.tasks?.[i];
                return (
                  <div key={field.id} className="rounded-lg border border-border bg-surface/95 px-3 py-2 shadow-sm">
                    {/* Task header */}
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">Task {i + 1}</p>
                      <button
                        type="button"
                        disabled={fields.length === 1}
                        onClick={() => remove(i)}
                        className="text-[11px] text-red-400 hover:text-red-600 disabled:opacity-30 transition-colors"
                      >
                        Remove
                      </button>
                    </div>

                    {/* Row 1: Title */}
                    <Input
                      label="Title"
                      error={rowErr?.title?.message}
                      className="mb-2"
                      {...register(`tasks.${i}.title` as any)}
                    />

                    {/* Row 2: Date + Time + Priority */}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <Input type="date" label="Target Date" error={rowErr?.targetDate?.message} {...register(`tasks.${i}.targetDate` as any)} />
                      <Input type="time" label="Time" {...register(`tasks.${i}.targetTime` as any)} />
                      <Select label="Priority" {...register(`tasks.${i}.priority` as any)}>
                        {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </Select>
                    </div>

                    {/* Row 3: Description */}
                    <Textarea label="Description (optional)" rows={1} className="mb-2" {...register(`tasks.${i}.description` as any)} />

                    {/* Row 4: Attachments */}
                    <FileUpload
                      compact
                      label="Attachments"
                      maxFiles={5}
                      onChange={(ids) => setValue(`tasks.${i}.attachmentIds` as any, ids)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Bulk Format Assign Modal ── */}
      <Modal
        open={bulkFormatModal}
        onClose={() => setBulkFormatModal(false)}
        title="Bulk Format Assign"
        size="3xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setBulkFormatModal(false)}>Cancel</Button>
            <Button onClick={submitBulk(onBulkFormat)} loading={creating}>
              Assign {bulkFields.length} Task{bulkFields.length !== 1 ? 's' : ''}
            </Button>
          </>
        }
      >
        <form className="space-y-5" onSubmit={submitBulk(onBulkFormat)}>
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-800 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-indigo-200">
            Fill the assignee and project once, then enter all task rows in the table below. Click <strong>+ Add Row</strong> to add more tasks and assign everything in one click.
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Assign To */}
            <div className="relative sm:col-span-2">
              <AssigneePicker
                users={sortedUsers}
                value={bulkAssigneeIds}
                onChange={(ids) => setBulkVal('delegatedToIds', ids, { shouldValidate: true })}
                error={bulkErr.delegatedToIds?.message}
              />
            </div>

            <Select label="Project" error={bulkErr.projectId?.message} {...regBulk('projectId')}>
              <option value="">Select project…</option>
              {sortedProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>

          {/* Compact table */}
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60">
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">#</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Task Title *</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Target Date *</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Priority</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bulkFields.map((field, i) => {
                  const rowErr = bulkErr.tasks?.[i];
                  return (
                    <tr key={field.id} className="bg-surface hover:bg-surface-muted/40 transition-colors">
                      <td className="px-3 py-2 text-xs font-medium text-muted-foreground">{i + 1}</td>
                      <td className="px-2 py-1.5 min-w-[160px]">
                        <input
                          className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface ${
                            rowErr?.title ? 'border-brand' : 'border-border'
                          }`}
                          placeholder="Task title…"
                          {...regBulk(`tasks.${i}.title` as any)}
                        />
                        {rowErr?.title && <p className="mt-0.5 text-xs text-brand">{rowErr.title.message}</p>}
                      </td>
                      <td className="px-2 py-1.5 min-w-[160px]">
                        <input
                          className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface"
                          placeholder="Optional…"
                          {...regBulk(`tasks.${i}.description` as any)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="date"
                          className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface ${
                            rowErr?.targetDate ? 'border-brand' : 'border-border'
                          }`}
                          {...regBulk(`tasks.${i}.targetDate` as any)}
                        />
                        {rowErr?.targetDate && <p className="mt-0.5 text-xs text-brand">{rowErr.targetDate.message}</p>}
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="time"
                          className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface"
                          {...regBulk(`tasks.${i}.targetTime` as any)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface"
                          {...regBulk(`tasks.${i}.priority` as any)}
                        >
                          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          disabled={bulkFields.length === 1}
                          onClick={() => bulkRemove(i)}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40 dark:hover:bg-red-950/30"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => bulkAppend(createTask())}
          >
            + Add Row
          </Button>
        </form>
      </Modal>

      {/* ── Mark as Done Modal ── */}
      <Modal
        open={!!submitModal}
        onClose={() => setSubmitModal(null)}
        title="Mark as Done"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setSubmitModal(null)}>Cancel</Button>
            <Button onClick={handleSubmitTask(onSubmitTask)} loading={submitting}>
              Submit for Approval
            </Button>
          </>
        }
      >
        <form className="space-y-3" onSubmit={handleSubmitTask(onSubmitTask)}>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Task: <strong>{submitModal?.title}</strong>
          </p>
          <Textarea
            label="Remarks / Completion Notes *"
            error={submitErrors.doerRemarks?.message}
            placeholder="Describe what was done…"
            {...regSubmit('doerRemarks')}
          />
          <FileUpload label="Proof / Attachments" maxFiles={3} onChange={setAttachmentIds} />
        </form>
      </Modal>
    </div>
  );
}
