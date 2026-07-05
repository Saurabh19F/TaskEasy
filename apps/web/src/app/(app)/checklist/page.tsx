'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, FileSpreadsheet, FileText, Plus, Sparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { checklistApi } from '@/lib/api';
import { getApiError } from '@/lib/axios';
import { useActiveProjects } from '@/hooks/useProjects';
import { useActiveUsers } from '@/hooks/useUsers';
import { useAuthStore } from '@/store/auth.store';
import { FileUpload } from '@/components/ui/FileUpload';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { formatDate, exportToExcel, exportToPdf, cn } from '@/lib/utils';
import { FilterBar, type FilterValues } from '@/components/ui/FilterBar';
import { remarksSchema, type RemarksFormValues } from '@/lib/schemas';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ChecklistTask } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'my-pending' | 'team-pending' | 'team-checklists' | 'my-kra' | 'team-kra';

const TABS: { key: Tab; label: string }[] = [
  { key: 'my-pending',      label: 'My Pending Tasks' },
  { key: 'team-pending',    label: 'Team Pending' },
  { key: 'team-checklists', label: 'Team Checklists' },
  { key: 'my-kra',          label: 'My KRA (Master)' },
  { key: 'team-kra',        label: 'Team KRA (Master)' },
];

const FREQUENCIES = [
  'DAILY', 'WEEKLY', 'FORTNIGHTLY', 'MONTHLY',
  'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'ONE_TIME',
];

const ONE_TIME = 'ONE_TIME';

interface ChecklistItem {
  _id: string;
  title: string;
  frequency: string;
  startDate: string;
  startTime: string;
  endDate: string;
  attachmentRequired: boolean;
  days: string[];        // WEEKLY: which days
  extraDates: string[];  // FORTNIGHTLY(3) | MONTHLY(1) | QUARTERLY(1) | HALF_YEARLY(2) | YEARLY(1)
}

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function makeItem(): ChecklistItem {
  return {
    _id: Math.random().toString(36).slice(2),
    title: '',
    frequency: 'FORTNIGHTLY',
    startDate: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endDate: '',
    attachmentRequired: false,
    days: [],
    extraDates: [],
  };
}

// ─── Employee multi-select ────────────────────────────────────────────────────

function EmployeeSelector({
  users,
  selected,
  onChange,
}: {
  users: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = users.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) && !selected.includes(u.id),
  );
  const selectedUsers = users.filter((u) => selected.includes(u.id));

  return (
    <div ref={ref} className="relative">
      <div
        className="min-h-[38px] w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 flex flex-wrap gap-1 cursor-text"
        onClick={() => setOpen(true)}
      >
        {selectedUsers.map((u) => (
          <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium px-2 py-0.5">
            {u.name}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(selected.filter((id) => id !== u.id)); }}
              className="hover:text-indigo-900 dark:hover:text-indigo-100"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          className="flex-1 min-w-[120px] outline-none bg-transparent text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
          placeholder={selected.length === 0 ? 'Select employees...' : ''}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">No employees found</p>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                onClick={() => { onChange([...selected, u.id]); setSearch(''); }}
              >
                {u.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Single checklist item card ───────────────────────────────────────────────

function ChecklistItemCard({
  item,
  index,
  removable,
  onChange,
  onRemove,
}: {
  item: ChecklistItem;
  index: number;
  removable: boolean;
  onChange: (patch: Partial<ChecklistItem>) => void;
  onRemove: () => void;
}) {
  const id = useId();

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
          Checklist Item #{index + 1}
        </h3>
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            className="h-5 w-5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-500 flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Task Detail */}
        <div>
          <label htmlFor={`${id}-title`} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Task Detail
          </label>
          <textarea
            id={`${id}-title`}
            rows={3}
            value={item.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Enter task description..."
          />
        </div>

        {/* Frequency + date fields */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          {/* Frequency */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Frequency</label>
            <select
              value={item.frequency}
              onChange={(e) => onChange({ frequency: e.target.value, endDate: '', days: [], extraDates: [] })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>{f.charAt(0) + f.slice(1).toLowerCase().replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {/* Start Date (all) */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {item.frequency === ONE_TIME ? 'Due Date' : 'Start Date'}
            </label>
            <input
              type="date"
              value={item.startDate}
              onChange={(e) => onChange({ startDate: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Start Time (all) */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {item.frequency === ONE_TIME ? 'Due Time' : 'Start Time'}
            </label>
            <div className="relative">
              <input
                type="time"
                value={item.startTime}
                onChange={(e) => onChange({ startTime: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 pr-8 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <Clock className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Attachment checkbox */}
          <div className="flex items-center gap-2 pb-1">
            <input
              type="checkbox"
              id={`${id}-attach`}
              checked={item.attachmentRequired}
              onChange={(e) => onChange({ attachmentRequired: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor={`${id}-attach`} className="text-sm text-slate-600 dark:text-slate-400 select-none">
              Attachment Required?
            </label>
          </div>
        </div>

        {/* ── WEEKLY: day-of-week checkboxes ── */}
        {item.frequency === 'WEEKLY' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Day(s)</label>
            <div className="flex flex-wrap gap-4">
              {WEEK_DAYS.map((day) => (
                <label key={day} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={item.days.includes(day)}
                    onChange={(e) => onChange({
                      days: e.target.checked ? [...item.days, day] : item.days.filter((d) => d !== day),
                    })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {day}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── FORTNIGHTLY: 3 date pickers ── */}
        {item.frequency === 'FORTNIGHTLY' && (
          <div>
            <label className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-2">
              Select 3 Dates (Separate Rows Create Schedule)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Date {i + 1}</label>
                  <input
                    type="date"
                    value={item.extraDates[i] ?? ''}
                    onChange={(e) => {
                      const dates = [...item.extraDates];
                      dates[i] = e.target.value;
                      onChange({ extraDates: dates });
                    }}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MONTHLY / QUARTERLY: 1 date picker ── */}
        {(item.frequency === 'MONTHLY' || item.frequency === 'QUARTERLY') && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Date</label>
            <input
              type="date"
              value={item.extraDates[0] ?? ''}
              onChange={(e) => onChange({ extraDates: [e.target.value] })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {/* ── HALF_YEARLY: 2 date pickers ── */}
        {item.frequency === 'HALF_YEARLY' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Date(s)</label>
            <div className="grid grid-cols-2 gap-3">
              {[0, 1].map((i) => (
                <input
                  key={i}
                  type="date"
                  value={item.extraDates[i] ?? ''}
                  onChange={(e) => {
                    const dates = [...item.extraDates];
                    dates[i] = e.target.value;
                    onChange({ extraDates: dates });
                  }}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ))}
            </div>
          </div>
        )}

        {/* ── YEARLY: 1 date picker ── */}
        {item.frequency === 'YEARLY' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Date</label>
            <input
              type="date"
              value={item.extraDates[0] ?? ''}
              onChange={(e) => onChange({ extraDates: [e.target.value] })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Assign Checklist tab ─────────────────────────────────────────────────────

function AssignChecklistTab({ onSuccess }: { onSuccess?: () => void } = {}) {
  const qc = useQueryClient();
  const { data: users = [] }    = useActiveUsers();
  const { data: projects = [] } = useActiveProjects();

  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [projectId, setProjectId]     = useState('');
  const [items, setItems]             = useState<ChecklistItem[]>([makeItem()]);

  const { mutate: createMaster, isPending } = useMutation({
    mutationFn: (data: any) => checklistApi.createMaster(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checklist'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Checklist assigned');
      onSuccess?.();
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  function handleAssignAll() {
    if (employeeIds.length === 0) { toast.error('Select at least one employee'); return; }
    if (!projectId)               { toast.error('Select a project'); return; }

    const invalid = items.findIndex((it) => !it.title.trim());
    if (invalid !== -1) { toast.error(`Add a task detail for Checklist Item #${invalid + 1}`); return; }

    items.forEach((item) => {
      createMaster({
        assignedToIds:      employeeIds,
        projectId,
        title:              item.title,
        frequency:          item.frequency,
        startDate:          item.startDate,
        startTime:          item.startTime,
        endDate:            item.frequency !== ONE_TIME && item.endDate ? item.endDate : undefined,
        attachmentRequired: item.attachmentRequired,
        days:               item.days.length > 0 ? item.days : undefined,
        extraDates:         item.extraDates.filter(Boolean).length > 0 ? item.extraDates.filter(Boolean) : undefined,
      });
    });
  }

  function updateItem(id: string, patch: Partial<ChecklistItem>) {
    setItems((prev) => prev.map((it) => it._id === id ? { ...it, ...patch } : it));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it._id !== id));
  }

  return (
    <div className="space-y-5">
      {/* Top: Employees + Project */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Employees</label>
          <EmployeeSelector users={users} selected={employeeIds} onChange={setEmployeeIds} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select Project...</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {/* Checklist item cards */}
      <div className="space-y-4">
        {items.map((item, idx) => (
          <ChecklistItemCard
            key={item._id}
            item={item}
            index={idx}
            removable={items.length > 1}
            onChange={(patch) => updateItem(item._id, patch)}
            onRemove={() => removeItem(item._id)}
          />
        ))}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, makeItem()])}
          className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Task
        </button>
        <button
          type="button"
          onClick={handleAssignAll}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 text-contrast text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          {isPending ? 'Assigning...' : 'Assign All'}
        </button>
      </div>
    </div>
  );
}

// ─── Pending tasks table (shared by My Pending + Team Pending) ────────────────

function PendingTasksTab({ mine, onRegisterExport }: { mine: boolean; onRegisterExport?: (fns: { excel: () => void; pdf: () => void }) => void }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [selected, setSelected]             = useState<string[]>([]);
  const [doneTask, setDoneTask]             = useState<ChecklistTask | null>(null);
  const [bulkOpen, setBulkOpen]             = useState(false);
  const [doneAttachIds, setDoneAttachIds]   = useState<string[]>([]);
  const [bulkAttachIds, setBulkAttachIds]   = useState<string[]>([]);
  const [filters, setFilters]               = useState<FilterValues>({ period: 'ALL' });

  const { data: projects = [] } = useActiveProjects();
  const { data: users = [] }    = useActiveUsers();

  const apiParams = {
    ...(mine ? {} : { status: filters.status || 'PENDING,LATE,REWORK' }),
    ...(mine && filters.status ? { status: filters.status } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.userId && !mine ? { assignedToId: filters.userId } : {}),
    ...(filters.period && filters.period !== 'ALL' ? { period: filters.period } : {}),
    ...(filters.period === 'CUSTOM' && filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
    ...(filters.period === 'CUSTOM' && filters.dateTo ? { dateTo: filters.dateTo } : {}),
    limit: 500,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['checklist', mine ? 'my-pending' : 'team-pending', apiParams],
    queryFn: mine
      ? () => checklistApi.findTasks({ ...apiParams, assignedToMe: true }).then((r) => r.data)
      : () => checklistApi.findTasks(apiParams).then((r) => r.data),
  });

  const allTasks = (data as ChecklistTask[] | undefined) ?? [];
  const tasks = allTasks;
  const selectedTasks = tasks.filter((t) => selected.includes(t.id));
  const selectedNeedsAttachment = selectedTasks.some((t) => t.attachmentRequired);

  const { register: regDone, handleSubmit: hsDone, reset: rsDone, formState: { errors: eDone } } =
    useForm<RemarksFormValues>({ resolver: zodResolver(remarksSchema), defaultValues: { remarks: '' } });

  const { register: regBulk, handleSubmit: hsBulk, reset: rsBulk, formState: { errors: eBulk } } =
    useForm<RemarksFormValues>({ resolver: zodResolver(remarksSchema), defaultValues: { remarks: '' } });

  const { mutate: complete, isPending: completing } = useMutation({
    mutationFn: (vals: RemarksFormValues) =>
      checklistApi.complete(doneTask!.id, { ...vals, attachmentIds: doneAttachIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checklist'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setDoneTask(null); rsDone(); setDoneAttachIds([]);
      toast.success('Submitted for approval');
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const { mutate: bulkComplete, isPending: bulkCompleting } = useMutation({
    mutationFn: (vals: RemarksFormValues) =>
      checklistApi.bulkComplete({ taskIds: selected, ...vals, attachmentIds: bulkAttachIds }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['checklist'] });
      setSelected([]); setBulkOpen(false); rsBulk(); setBulkAttachIds([]);
      toast.success(`${res.completed} tasks submitted`);
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  useEffect(() => { if (!doneTask) { rsDone(); setDoneAttachIds([]); } }, [doneTask, rsDone]);
  useEffect(() => { if (!bulkOpen) { rsBulk(); setBulkAttachIds([]); } }, [bulkOpen, rsBulk]);

  const canSubmit = (t: ChecklistTask) => ['PENDING', 'LATE', 'REWORK'].includes(t.status);

  const columns: Column<ChecklistTask>[] = [
    {
      key: 'select', header: '',
      render: (_, row) => (
        <input type="checkbox" checked={selected.includes(row.id)} disabled={!canSubmit(row)}
          onChange={(e) => setSelected((s) => e.target.checked ? [...s, row.id] : s.filter((id) => id !== row.id))}
          className="rounded disabled:opacity-40 disabled:cursor-not-allowed" />
      ),
    },
    { key: 'taskId',     header: 'Task ID',    sortable: true },
    { key: 'title',      header: 'Title',      sortable: true },
    { key: 'assignedTo', header: 'Assigned To', render: (v) => v?.name ?? user?.name ?? '—' },
    { key: 'project',    header: 'Project',    render: (v) => v?.name ?? '—' },
    { key: 'frequency',  header: 'Frequency' },
    { key: 'plannedDate',header: 'Planned',    render: (v) => formatDate(v) },
    { key: 'status',     header: 'Status',     render: (v) => <StatusBadge status={v} /> },
    {
      key: 'id', header: 'Action',
      render: (_, row) => (
        <div className="flex items-center gap-1.5">
          {canSubmit(row) && (
            <Button size="xs" onClick={() => setDoneTask(row)}>Done</Button>
          )}
          {row.status === 'SEND_FOR_APPROVAL' && (
            <span className="text-xs text-amber-600 font-medium whitespace-nowrap">Awaiting Approval</span>
          )}
          {row.status === 'COMPLETED' && (
            <span className="text-xs text-green-600 font-medium">Completed</span>
          )}
        </div>
      ),
    },
  ];

  const STATUS_OPTIONS = ['PENDING', 'LATE', 'REWORK', 'SEND_FOR_APPROVAL', 'COMPLETED'];
  const exportName = mine ? 'my-pending-checklists' : 'team-pending-checklists';

  useEffect(() => {
    onRegisterExport?.({
      excel: () => exportToExcel(tasks.map((t) => ({ ID: t.taskId, Title: t.title, 'Assigned To': t.assignedTo?.name ?? '', Project: t.project?.name ?? '', Frequency: t.frequency, Planned: formatDate(t.plannedDate), Status: t.status })), exportName),
      pdf: () => exportToPdf(['ID','Title','Assigned To','Project','Frequency','Planned','Status'], tasks.map((t) => [t.taskId, t.title, t.assignedTo?.name ?? '', t.project?.name ?? '', t.frequency, formatDate(t.plannedDate), t.status]), exportName, 'Checklist Tasks'),
    });
  }, [tasks]);

  return (
    <div className="space-y-4">
      <FilterBar
        onFilter={setFilters}
        projects={projects}
        users={mine ? [] : users}
        statusOptions={STATUS_OPTIONS}
        showUserFilter={!mine}
        showProjectFilter
        showStatusFilter
      />

      {selected.length > 0 && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setBulkOpen(true)}>
            Submit {selected.length} for Approval
          </Button>
        </div>
      )}

      <DataTable
        columns={columns} data={tasks} loading={isLoading} error={isError}
        onRetry={refetch} rowKey={(r) => r.id}
        searchable={false}
        emptyMessage="No pending checklist tasks"
      />

      {/* Submit single modal */}
      <Modal open={!!doneTask} onClose={() => setDoneTask(null)} title="Submit Checklist Task" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDoneTask(null)}>Cancel</Button>
            <Button onClick={hsDone((v) => complete(v))} loading={completing}>Submit for Approval</Button>
          </>
        }
      >
        <form className="space-y-3" onSubmit={hsDone((v) => complete(v))}>
          <p className="text-sm text-slate-600 dark:text-slate-400">{doneTask?.title}</p>
          <Textarea label="Remarks *" error={eDone.remarks?.message} placeholder="Completion notes…" {...regDone('remarks')} />
          {doneTask?.attachmentRequired && (
            <p className="text-xs text-amber-600">Proof attachment is required for this task.</p>
          )}
          <FileUpload label={doneTask?.attachmentRequired ? 'Proof / Attachments' : 'Attachments'} maxFiles={3} onChange={setDoneAttachIds} />
        </form>
      </Modal>

      {/* Bulk submit modal */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title={`Submit ${selected.length} Tasks`} size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={hsBulk((v) => bulkComplete(v))} loading={bulkCompleting}>Submit for Approval</Button>
          </>
        }
      >
        <form onSubmit={hsBulk((v) => bulkComplete(v))} className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Same remarks will apply to all {selected.length} selected tasks.
          </p>
          {selectedNeedsAttachment && (
            <p className="text-xs text-amber-600">One or more tasks require proof attachments.</p>
          )}
          <Textarea label="Remarks *" error={eBulk.remarks?.message} placeholder="Completion notes…" {...regBulk('remarks')} />
          <FileUpload label={selectedNeedsAttachment ? 'Proof / Attachments' : 'Attachments'} maxFiles={5} onChange={setBulkAttachIds} />
        </form>
      </Modal>
    </div>
  );
}

// ─── Team Checklists tab ──────────────────────────────────────────────────────

function TeamChecklistsTab({ onRegisterExport }: { onRegisterExport?: (fns: { excel: () => void; pdf: () => void }) => void } = {}) {
  const [filters, setFilters] = useState<FilterValues>({ period: 'ALL' });
  const { data: projects = [] } = useActiveProjects();
  const { data: users = [] }    = useActiveUsers();

  const apiParams = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.userId ? { assignedToId: filters.userId } : {}),
    ...(filters.period && filters.period !== 'ALL' ? { period: filters.period } : {}),
    ...(filters.period === 'CUSTOM' && filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
    ...(filters.period === 'CUSTOM' && filters.dateTo ? { dateTo: filters.dateTo } : {}),
    limit: 500,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['checklist', 'team-all', apiParams],
    queryFn: () => checklistApi.findTasks(apiParams).then((r) => r.data),
  });

  const allTasks = (data as ChecklistTask[] | undefined) ?? [];
  const tasks = allTasks;

  const columns: Column<ChecklistTask>[] = [
    { key: 'taskId',     header: 'Task ID',    sortable: true },
    { key: 'title',      header: 'Title',      sortable: true },
    { key: 'assignedTo', header: 'Assigned To', render: (v) => v?.name ?? '—' },
    { key: 'project',    header: 'Project',    render: (v) => v?.name ?? '—' },
    { key: 'frequency',  header: 'Frequency' },
    { key: 'plannedDate',header: 'Planned',    render: (v) => formatDate(v) },
    { key: 'actualDate', header: 'Completed',  render: (v) => v ? formatDate(v) : '—' },
    { key: 'status',     header: 'Status',     render: (v) => <StatusBadge status={v} /> },
  ];

  const STATUS_OPTIONS = ['PENDING', 'LATE', 'REWORK', 'SEND_FOR_APPROVAL', 'COMPLETED'];

  useEffect(() => {
    onRegisterExport?.({
      excel: () => exportToExcel(tasks.map((t) => ({ ID: t.taskId, Title: t.title, 'Assigned To': t.assignedTo?.name ?? '', Project: t.project?.name ?? '', Frequency: t.frequency, Planned: formatDate(t.plannedDate), Completed: t.actualDate ? formatDate(t.actualDate) : '', Status: t.status })), 'team-checklists'),
      pdf: () => exportToPdf(['ID','Title','Assigned To','Project','Frequency','Planned','Completed','Status'], tasks.map((t) => [t.taskId, t.title, t.assignedTo?.name ?? '', t.project?.name ?? '', t.frequency, formatDate(t.plannedDate), t.actualDate ? formatDate(t.actualDate) : '', t.status]), 'team-checklists', 'Team Checklists'),
    });
  }, [tasks]);

  return (
    <div className="space-y-4">
      <FilterBar
        onFilter={setFilters}
        projects={projects}
        users={users}
        statusOptions={STATUS_OPTIONS}
        showUserFilter
        showProjectFilter
        showStatusFilter
      />
      <DataTable
        columns={columns} data={tasks} loading={isLoading} error={isError}
        onRetry={refetch} rowKey={(r) => r.id}
        searchable={false}
        emptyMessage="No checklist tasks found"
      />
    </div>
  );
}

// ─── KRA Master tab ───────────────────────────────────────────────────────────

function KraMasterTab({ mine, onRegisterExport }: { mine: boolean; onRegisterExport?: (fns: { excel: () => void; pdf: () => void }) => void }) {
  const { user } = useAuthStore();
  const [filters, setFilters] = useState<FilterValues>({ period: 'ALL' });
  const { data: projects = [] } = useActiveProjects();
  const { data: users = [] }    = useActiveUsers();

  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['checklist', 'masters', mine ? 'mine' : 'team'],
    queryFn: checklistApi.findMasters,
  });

  const baseRows = mine
    ? data.filter((m: any) => m.assignedTo?.id === (user?.id ?? user?.sub) || m.assignedToIds?.includes(user?.id ?? user?.sub))
    : data;

  const rows = baseRows.filter((m: any) => {
    if (filters.projectId && m.project?.id !== filters.projectId) return false;
    if (filters.userId && m.assignedTo?.id !== filters.userId) return false;
    return true;
  });

  const columns: Column<any>[] = [
    { key: 'masterId',    header: 'ID',          sortable: true },
    { key: 'title',       header: 'Title',        sortable: true },
    { key: 'assignedTo',  header: 'Assigned To',  render: (v) => v?.name ?? '—' },
    { key: 'project',     header: 'Project',      render: (v) => v?.name ?? '—' },
    { key: 'frequency',   header: 'Frequency' },
    {
      key: 'isActive', header: 'Status',
      render: (v) => (
        <span className={cn('text-xs font-semibold', v ? 'text-green-600' : 'text-slate-400')}>
          {v ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  const exportName = mine ? 'my-kra-master' : 'team-kra-master';

  useEffect(() => {
    onRegisterExport?.({
      excel: () => exportToExcel(rows.map((m: any) => ({ ID: m.masterId, Title: m.title, 'Assigned To': m.assignedTo?.name ?? '', Project: m.project?.name ?? '', Frequency: m.frequency, Status: m.isActive ? 'Active' : 'Inactive' })), exportName),
      pdf: () => exportToPdf(['ID','Title','Assigned To','Project','Frequency','Status'], rows.map((m: any) => [m.masterId, m.title, m.assignedTo?.name ?? '', m.project?.name ?? '', m.frequency, m.isActive ? 'Active' : 'Inactive']), exportName, 'KRA Master'),
    });
  }, [rows]);

  return (
    <div className="space-y-4">
      <FilterBar
        onFilter={setFilters}
        projects={projects}
        users={mine ? [] : users}
        showUserFilter={!mine}
        showProjectFilter
        showStatusFilter={false}
      />
      <DataTable
        columns={columns} data={rows} loading={isLoading} error={isError}
        onRetry={refetch} rowKey={(r) => r.id}
        searchable={false}
        emptyMessage="No KRA masters found"
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChecklistPage() {
  const [tab, setTab] = useState<Tab>('my-pending');
  const [assignOpen, setAssignOpen] = useState(false);
  const { user } = useAuthStore();
  const isAdmin = ['ADMIN', 'MANAGER', 'COMPANY_OWNER', 'SAAS_OWNER'].includes(user?.role ?? '');

  const exportRef = useRef<{ excel: () => void; pdf: () => void }>({ excel: () => {}, pdf: () => {} });
  const registerExport = (fns: { excel: () => void; pdf: () => void }) => { exportRef.current = fns; };

  const teamTab = ['team-pending', 'team-checklists'].includes(tab) ? tab : '';
  const kraTab  = ['my-kra', 'team-kra'].includes(tab) ? tab : '';

  return (
    <div className="space-y-4">
      {/* Nav: standalone tab + two dropdowns + action button */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-1">
          {/* My Pending — standalone tab */}
          <button
            onClick={() => setTab('my-pending')}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              tab === 'my-pending'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
            )}
          >
            My Pending Tasks
          </button>

          {/* Team dropdown */}
          <div className="relative flex items-center">
            <select
              value={teamTab}
              onChange={(e) => e.target.value && setTab(e.target.value as Tab)}
              className={cn(
                'h-9 appearance-none cursor-pointer border-b-2 bg-transparent pl-4 pr-7 text-sm font-medium transition-colors focus:outline-none',
                teamTab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
              )}
            >
              <option value="" disabled>Team ▾</option>
              <option value="team-pending">Team Pending</option>
              <option value="team-checklists">Team Checklists</option>
            </select>
          </div>

          {/* KRA dropdown */}
          <div className="relative flex items-center">
            <select
              value={kraTab}
              onChange={(e) => e.target.value && setTab(e.target.value as Tab)}
              className={cn(
                'h-9 appearance-none cursor-pointer border-b-2 bg-transparent pl-4 pr-7 text-sm font-medium transition-colors focus:outline-none',
                kraTab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
              )}
            >
              <option value="" disabled>KRA ▾</option>
              <option value="my-kra">My KRA (Master)</option>
              <option value="team-kra">Team KRA (Master)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" leftIcon={<FileSpreadsheet className="h-4 w-4 text-green-600" />} onClick={() => exportRef.current.excel()}>Excel</Button>
          <Button size="sm" variant="secondary" leftIcon={<FileText className="h-4 w-4 text-red-500" />} onClick={() => exportRef.current.pdf()}>PDF</Button>
          {isAdmin && (
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAssignOpen(true)}>
              Assign Checklist
            </Button>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="pt-2">
        {tab === 'my-pending'      && <PendingTasksTab mine onRegisterExport={registerExport} />}
        {tab === 'team-pending'    && <PendingTasksTab mine={false} onRegisterExport={registerExport} />}
        {tab === 'team-checklists' && <TeamChecklistsTab onRegisterExport={registerExport} />}
        {tab === 'my-kra'          && <KraMasterTab mine onRegisterExport={registerExport} />}
        {tab === 'team-kra'        && <KraMasterTab mine={false} onRegisterExport={registerExport} />}
      </div>

      {/* Assign Checklist Modal */}
      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign Checklist"
        size="lg"
      >
        <AssignChecklistTab onSuccess={() => setAssignOpen(false)} />
      </Modal>
    </div>
  );
}
