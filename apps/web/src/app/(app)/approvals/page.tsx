'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, GitPullRequest, XCircle, FileSpreadsheet, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { approvalApi, checklistApi, delegationApi, workRequestApi } from '@/lib/api';
import { getApiError } from '@/lib/axios';
import { useAuthStore } from '@/store/auth.store';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';
import { formatDate, formatDateTime, exportToExcel, exportToPdf } from '@/lib/utils';
import type { ApprovalItemType, ApprovalMySubmissions, ApprovalQueueItem } from '@/types';

const APPROVER_ROLES = ['ADMIN', 'MANAGER', 'COMPANY_OWNER', 'SAAS_OWNER'];
const TRACKING_ROLES = ['EMPLOYEE', 'TEAM_LEAD', 'VIEWER'];

type ApprovalTab = 'new' | 'rework';
type TrackStatusItem = {
  id: string;
  type: ApprovalItemType;
  taskId?: string;
  title: string;
  status: string;
  projectName?: string;
  dueDate?: string;
  lastUpdatedAt?: string;
  remarks?: string | null;
};

function flattenSubmissions(data: ApprovalMySubmissions | undefined): TrackStatusItem[] {
  if (!data) return [];

  const items: TrackStatusItem[] = [
    ...data.delegations.map((item) => ({
      id: item.id,
      type: 'DELEGATION' as const,
      taskId: item.taskId,
      title: item.title,
      status: item.status,
      projectName: item.project?.name,
      dueDate: item.targetDate,
      lastUpdatedAt: item.actualDate ?? item.createdAt,
      remarks: item.doerRemarks ?? item.reworkRemark ?? item.finalRemarks ?? null,
    })),
    ...data.workRequests.map((item) => ({
      id: item.id,
      type: 'WORK_REQUEST' as const,
      taskId: item.requestId,
      title: item.title,
      status: item.status,
      projectName: item.project?.name,
      dueDate: item.deadlineDate,
      lastUpdatedAt: item.createdAt,
      remarks: item.doerRemarks ?? null,
    })),
    ...data.checklists.map((item) => ({
      id: item.id,
      type: 'CHECKLIST' as const,
      taskId: item.taskId,
      title: item.title,
      status: item.status,
      projectName: item.project?.name,
      dueDate: item.plannedDate,
      lastUpdatedAt: item.actualDate ?? item.plannedDate,
      remarks: item.remarks ?? null,
    })),
  ];

  return items.sort((a, b) => {
    const aTime = a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : 0;
    const bTime = b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : 0;
    return bTime - aTime;
  });
}

export default function ApprovalsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<ApprovalTab>('new');
  const [actionItem, setActionItem] = useState<ApprovalQueueItem | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'rework' | null>(null);
  const [approveRemarks, setApproveRemarks] = useState('');
  const [reworkRemarks, setReworkRemarks] = useState('');
  const qc = useQueryClient();

  const role = String(user?.role ?? '').toUpperCase();
  const isApprover = APPROVER_ROLES.includes(role);
  const canTrack = TRACKING_ROLES.includes(role);

  useEffect(() => {
    if (user && !isApprover && !canTrack) {
      router.replace('/dashboard');
    }
  }, [canTrack, isApprover, router, user]);

  const queueQuery = useQuery({
    queryKey: ['approvals', 'queue', tab],
    queryFn: () => approvalApi.getQueue(tab),
    enabled: isApprover,
  });

  const submissionsQuery = useQuery({
    queryKey: ['approvals', 'my-submissions'],
    queryFn: approvalApi.mySubmissions,
    enabled: !isApprover && canTrack,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['approvals'] });
    qc.invalidateQueries({ queryKey: ['delegation'] });
    qc.invalidateQueries({ queryKey: ['work-requests'] });
    qc.invalidateQueries({ queryKey: ['checklist'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const { mutate: approve, isPending: approving } = useMutation({
    mutationFn: async (): Promise<void> => {
      const item = actionItem;
      if (!item) return;
      if (item.type === 'DELEGATION') {
        await delegationApi.approve(item.id, { remarks: approveRemarks });
        return;
      }
      if (item.type === 'WORK_REQUEST') {
        await workRequestApi.approve(item.id, { remarks: approveRemarks });
        return;
      }
      await checklistApi.approve(item.id, { remarks: approveRemarks });
    },
    onSuccess: () => {
      invalidate();
      setActionItem(null);
      setApproveRemarks('');
      toast.success('Approved');
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const { mutate: rework, isPending: reworking } = useMutation({
    mutationFn: async (): Promise<void> => {
      const item = actionItem;
      if (!item) return;
      if (item.type === 'DELEGATION') {
        await delegationApi.rework(item.id, { reworkRemark: reworkRemarks });
        return;
      }
      if (item.type === 'WORK_REQUEST') {
        await workRequestApi.rework(item.id, { reworkRemark: reworkRemarks });
        return;
      }
      await checklistApi.rework(item.id, { reworkRemark: reworkRemarks });
    },
    onSuccess: () => {
      invalidate();
      setActionItem(null);
      setReworkRemarks('');
      toast.success('Sent for rework');
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const openAction = (item: ApprovalQueueItem, type: 'approve' | 'rework') => {
    setActionItem(item);
    setActionType(type);
    setApproveRemarks('');
    setReworkRemarks('');
  };

  const approvalColumns: Column<ApprovalQueueItem>[] = [
    { key: 'taskId', header: 'ID', sortable: true, render: (v) => v ?? '—' },
    { key: 'title', header: 'Title', sortable: true },
    {
      key: 'type',
      header: 'Type',
      render: (v) => <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{v}</span>,
    },
    { key: 'projectName', header: 'Project', render: (v) => v ?? '—' },
    { key: 'submittedBy', header: 'Submitted By', render: (v) => v?.name ?? '—' },
    { key: 'submittedAt', header: 'Submitted At', render: (v) => v ? formatDateTime(v) : '—' },
    { key: 'targetDate', header: 'Due Date', render: (v) => v ? formatDate(v) : '—' },
    { key: 'doerRemarks', header: 'Remarks', render: (v) => <span className="text-slate-500 line-clamp-2 max-w-xs">{v || '—'}</span> },
    { key: 'reworkCount', header: 'Rework #', render: (v) => v ?? 0 },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'id',
      header: 'Actions',
      render: (_, row) => (
        <div className="flex gap-2">
          <Button
            size="xs"
            variant="primary"
            leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
            onClick={() => openAction(row, 'approve')}
          >
            Approve
          </Button>
          <Button
            size="xs"
            variant="danger"
            leftIcon={<XCircle className="h-3.5 w-3.5" />}
            onClick={() => openAction(row, 'rework')}
          >
            Rework
          </Button>
        </div>
      ),
    },
  ];

  const trackItems = flattenSubmissions(submissionsQuery.data);
  const trackingColumns: Column<TrackStatusItem>[] = [
    { key: 'taskId', header: 'ID', sortable: true, render: (v) => v ?? '—' },
    { key: 'title', header: 'Title', sortable: true },
    {
      key: 'type',
      header: 'Type',
      render: (v) => <span className="text-xs font-medium text-cyan-700 dark:text-cyan-300">{v.replace(/_/g, ' ')}</span>,
    },
    { key: 'projectName', header: 'Project', render: (v) => v ?? '—' },
    { key: 'dueDate', header: 'Due Date', render: (v) => v ? formatDate(v) : '—' },
    { key: 'lastUpdatedAt', header: 'Last Update', render: (v) => v ? formatDateTime(v) : '—' },
    { key: 'remarks', header: 'Notes', render: (v) => <span className="text-slate-500 line-clamp-2 max-w-xs">{v || '—'}</span> },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
  ];

  return (
    <div className="space-y-5">
      {isApprover ? (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex w-fit rounded-2xl border border-border bg-surface p-1">
            {(['new', 'rework'] as ApprovalTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all capitalize ${
                  tab === t
                    ? 'bg-gradient-to-r from-indigo-600 to-cyan-500 text-contrast shadow-[0_16px_30px_-22px_rgba(79,70,229,0.95)]'
                    : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                }`}
              >
                {t === 'new' ? 'New Submissions' : 'Rework Submissions'}
              </button>
            ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<FileSpreadsheet className="h-4 w-4 text-green-600" />}
                onClick={() => exportToExcel(
                  (queueQuery.data?.data ?? []).map((r: any) => ({
                    Title: r.title,
                    Type: r.type,
                    'Submitted By': r.submittedBy?.name ?? '',
                    'Due Date': r.dueDate ? formatDate(r.dueDate) : '',
                    Status: r.status,
                  })),
                  `approvals-${tab}`,
                )}
              >
                Excel
              </Button>
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<FileText className="h-4 w-4 text-red-500" />}
                onClick={() => exportToPdf(
                  ['Title', 'Type', 'Submitted By', 'Due Date', 'Status'],
                  (queueQuery.data?.data ?? []).map((r: any) => [
                    r.title,
                    r.type,
                    r.submittedBy?.name ?? '',
                    r.dueDate ? formatDate(r.dueDate) : '',
                    r.status,
                  ]),
                  `approvals-${tab}`,
                  `${tab === 'new' ? 'New' : 'Rework'} Submissions`,
                )}
              >
                PDF
              </Button>
            </div>
          </div>

          <DataTable
            columns={approvalColumns}
            data={queueQuery.data?.data ?? []}
            loading={queueQuery.isLoading}
            error={queueQuery.isError}
            onRetry={queueQuery.refetch}
            searchable={false}
            emptyMessage={tab === 'new' ? 'No items are waiting for approval' : 'No rework submissions right now'}
          />

          <Modal
            open={!!actionItem}
            onClose={() => setActionItem(null)}
            title={actionType === 'approve' ? 'Approve Task' : 'Send for Rework'}
            size="sm"
            footer={
              <>
                <Button variant="outline" onClick={() => setActionItem(null)}>Cancel</Button>
                <Button
                  variant={actionType === 'approve' ? 'primary' : 'danger'}
                  loading={approving || reworking}
                  disabled={actionType === 'rework' && !reworkRemarks.trim()}
                  onClick={() => actionType === 'approve' ? approve() : rework()}
                >
                  {actionType === 'approve' ? 'Confirm Approval' : 'Send Rework'}
                </Button>
              </>
            }
          >
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
              Task: <strong>{actionItem?.title}</strong>
            </p>
            {actionType === 'approve' ? (
              <Textarea
                label="Final Remarks (optional)"
                value={approveRemarks}
                onChange={(e) => setApproveRemarks(e.target.value)}
                placeholder="Optional approval notes…"
              />
            ) : (
              <Textarea
                label="Rework Instructions *"
                value={reworkRemarks}
                onChange={(e) => setReworkRemarks(e.target.value)}
                placeholder="What needs to be corrected?"
              />
            )}
          </Modal>
        </>
      ) : (
        <DataTable
          columns={trackingColumns}
          data={trackItems}
          loading={submissionsQuery.isLoading}
          error={submissionsQuery.isError}
          onRetry={submissionsQuery.refetch}
          exportFilename="track-status"
          exportTitle="My Submission Status"
          emptyMessage="You do not have any tracked submissions yet"
        />
      )}
    </div>
  );
}
