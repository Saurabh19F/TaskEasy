'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileSpreadsheet, FileText, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { workRequestApi } from '@/lib/api';
import { useWorkRequests, useCreateWorkRequest, useSubmitWorkRequest } from '@/hooks/useWorkRequest';
import { useActiveProjects } from '@/hooks/useProjects';
import { useActiveUsers } from '@/hooks/useUsers';
import { useAuthStore } from '@/store/auth.store';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { FileUpload } from '@/components/ui/FileUpload';
import { FilterBar, type FilterValues } from '@/components/ui/FilterBar';
import { formatDate, isOverdue, exportToExcel, exportToPdf } from '@/lib/utils';
import {
  workRequestSchema,
  type WorkRequestFormValues,
  delegationSubmitSchema,
  type DelegationSubmitFormValues,
} from '@/lib/schemas';
import type { WorkRequest } from '@/types';

const TABS = ['My Pending', 'All Work Requests'] as const;
type Tab = typeof TABS[number];

const STATUS_OPTIONS = ['PENDING', 'SEND_FOR_APPROVAL', 'REWORK', 'COMPLETED'];
const SORT_OPTIONS = [
  { value: 'deadlineDate', label: 'Deadline' },
  { value: 'status', label: 'Status' },
  { value: 'createdAt', label: 'Created Date' },
];

const APPROVER_ROLES = new Set(['ADMIN', 'MANAGER', 'COMPANY_OWNER', 'SAAS_OWNER']);

export default function WorkRequestsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('My Pending');
  const [filters, setFilters] = useState<FilterValues>({ period: 'ALL' });
  const [createModal, setCreateModal] = useState(false);
  const [submitModal, setSubmitModal] = useState<WorkRequest | null>(null);
  const [submitAttachmentIds, setSubmitAttachmentIds] = useState<string[]>([]);

  const { user } = useAuthStore();
  const currentUserId = user?.id ?? user?.sub ?? '';
  const isApprover = APPROVER_ROLES.has(user?.role ?? '');

  const queryParams = useMemo(() => ({
    ...(activeTab === 'My Pending' ? { view: 'for_me', limit: 500 } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    // "My Pending" tab client-side filters by status (PENDING|REWORK), so don't pass
    // a conflicting status to the API or it will return nothing for mismatched selections
    ...(activeTab !== 'My Pending' && filters.status ? { status: filters.status } : {}),
    ...(filters.period && filters.period !== 'ALL' ? { period: filters.period } : {}),
    ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
    ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
  }), [filters, activeTab]);

  const { data: all, isLoading, isError, refetch } = useWorkRequests(queryParams);
  const { data: projects = [] } = useActiveProjects();
  const { data: users = [] } = useActiveUsers();

  const { mutate: create, isPending: creating } = useCreateWorkRequest();
  const { mutate: submit, isPending: submitting } = useSubmitWorkRequest();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WorkRequestFormValues>({
    resolver: zodResolver(workRequestSchema),
    defaultValues: {
      requestForId: '',
      projectId: '',
      title: '',
      description: '',
      deadlineDate: '',
      deadlineTime: '',
    },
  });

  const {
    register: registerSubmit,
    handleSubmit: handleSubmitForm,
    reset: resetSubmit,
    formState: { errors: submitErrors },
  } = useForm<DelegationSubmitFormValues>({
    resolver: zodResolver(delegationSubmitSchema),
    defaultValues: { doerRemarks: '' },
  });

  useEffect(() => {
    if (!createModal) reset();
  }, [createModal, reset]);

  useEffect(() => {
    if (!submitModal) {
      resetSubmit();
      setSubmitAttachmentIds([]);
    }
  }, [submitModal, resetSubmit]);

  const allRows: WorkRequest[] = all?.data ?? [];

  const rows = useMemo(() => {
    if (activeTab === 'My Pending') {
      return allRows.filter(
        (r) =>
          r.requestFor?.id === currentUserId &&
          (r.status === 'PENDING' || r.status === 'REWORK'),
      );
    }
    return allRows;
  }, [activeTab, allRows, currentUserId]);

  function handleCreate(values: WorkRequestFormValues) {
    create(values, { onSuccess: () => { setCreateModal(false); reset(); } });
  }

  function handleSubmitDone(values: DelegationSubmitFormValues) {
    if (!submitModal) return;
    submit(
      { id: submitModal.id, doerRemarks: values.doerRemarks, attachmentIds: submitAttachmentIds },
      { onSuccess: () => setSubmitModal(null) },
    );
  }

  const columns: Column<WorkRequest>[] = [
    { key: 'requestId', header: 'Request ID', sortable: true },
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (v, row) => (v ?? row.description ?? '—') as string,
    },
    { key: 'requestedBy', header: 'Requested By', render: (v) => (v as any)?.name ?? '—' },
    { key: 'requestFor', header: 'Assigned To', render: (v) => (v as any)?.name ?? '—' },
    { key: 'project', header: 'Project', render: (v) => (v as any)?.name ?? '—' },
    {
      key: 'deadlineDate',
      header: 'Deadline',
      sortable: true,
      render: (v) => (
        <span className={isOverdue(v as string) ? 'text-red-500 font-medium' : ''}>
          {formatDate(v as string)}
        </span>
      ),
    },
    {
      key: 'delayDays',
      header: 'Delay',
      render: (v) => {
        const d = v as number;
        if (!d || d <= 0) return <span className="text-emerald-600 text-xs font-medium">On Time</span>;
        return <span className="text-red-500 text-xs font-medium">+{d}d</span>;
      },
    },
    {
      key: 'reworkCount',
      header: 'Reworks',
      render: (v) => {
        const n = v as number;
        return n ? <span className="text-amber-600 text-xs font-medium">{n}</span> : <span className="text-slate-400 text-xs">0</span>;
      },
    },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v as string} /> },
    {
      key: 'id',
      header: 'Actions',
      render: (_, row) => {
        const isAssignee = row.requestFor?.id === currentUserId;
        const canDone = (row.status === 'PENDING' || row.status === 'REWORK');
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
      {/* Tabs + actions */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
              ].join(' ')}
            >
              {tab}
              {tab === 'My Pending' && allRows.filter(r => r.requestFor?.id === currentUserId && (r.status === 'PENDING' || r.status === 'REWORK')).length > 0 && (
                <span className="ml-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs px-1.5 py-0.5">
                  {allRows.filter(r => r.requestFor?.id === currentUserId && (r.status === 'PENDING' || r.status === 'REWORK')).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" leftIcon={<FileSpreadsheet className="h-4 w-4 text-green-600" />}
            onClick={() => exportToExcel(rows.map((r) => ({ ID: r.requestId, Title: r.title, 'Requested By': r.requestedBy?.name, 'Assigned To': r.requestFor?.name, Project: r.project?.name, Status: r.status, Deadline: formatDate(r.deadlineDate) })), 'work-requests')}>
            Excel
          </Button>
          <Button size="sm" variant="secondary" leftIcon={<FileText className="h-4 w-4 text-red-500" />}
            onClick={() => exportToPdf(['ID','Title','Requested By','Assigned To','Project','Status','Deadline'], rows.map((r) => [r.requestId, r.title ?? '', r.requestedBy?.name ?? '', r.requestFor?.name ?? '', r.project?.name ?? '', r.status, formatDate(r.deadlineDate)]), 'work-requests', 'Work Requests Report')}>
            PDF
          </Button>
          {isApprover && (
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateModal(true)}>
              New Request
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        projects={projects}
        users={[]}
        statusOptions={STATUS_OPTIONS}
        sortOptions={SORT_OPTIONS}
        onFilter={setFilters}
        showUserFilter={false}
      />

      {/* Table */}
      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
        searchable={false}
        rowKey={(r) => r.id}
        emptyMessage={
          activeTab === 'My Pending'
            ? 'No pending work requests assigned to you'
            : 'No work requests found'
        }
      />

      {/* Create Modal */}
      <Modal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="Create Work Request"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button onClick={handleSubmit(handleCreate)} loading={creating}>
              Submit Request
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit(handleCreate)}>
          <Select label="Request For *" error={errors.requestForId?.message} {...register('requestForId')}>
            <option value="">Select person…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>
          <Select label="Project *" error={errors.projectId?.message} {...register('projectId')}>
            <option value="">Select project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <Input label="Title *" error={errors.title?.message} {...register('title')} />
          <Textarea label="Description" {...register('description')} />
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              label="Deadline Date *"
              error={errors.deadlineDate?.message}
              {...register('deadlineDate')}
            />
            <Input type="time" label="Deadline Time" {...register('deadlineTime')} />
          </div>
        </form>
      </Modal>

      {/* Submit (Done) Modal */}
      <Modal
        open={!!submitModal}
        onClose={() => setSubmitModal(null)}
        title={`Mark Done — ${submitModal?.requestId ?? ''}`}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setSubmitModal(null)}>Cancel</Button>
            <Button onClick={handleSubmitForm(handleSubmitDone)} loading={submitting}>
              Submit for Approval
            </Button>
          </>
        }
      >
        {submitModal && (
          <form className="space-y-4" onSubmit={handleSubmitForm(handleSubmitDone)}>
            {submitModal.status === 'REWORK' && submitModal.doerRemarks && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3 text-sm text-amber-800 dark:text-amber-300">
                <span className="font-medium">Rework reason: </span>
                {submitModal.doerRemarks}
              </div>
            )}
            <Textarea
              label="Completion Remarks *"
              error={submitErrors.doerRemarks?.message}
              placeholder="What was done?"
              rows={3}
              {...registerSubmit('doerRemarks')}
            />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Proof / Attachments
              </p>
              <FileUpload
                onChange={(ids) => setSubmitAttachmentIds(ids)}
                maxFiles={5}
              />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
