'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building2, PackageCheck, Clock, CheckCircle,
  AlertTriangle, Send, MessageSquare, FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiGet, apiPost, apiPatch, getApiError } from '@/lib/axios';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { StatCard } from '@/components/ui/StatCard';
import { formatDate } from '@/lib/utils';

// ─── Schemas ───────────────────────────────────────────────────────────────────

const submitSchema = z.object({
  remarks: z.string().min(3, 'Remarks are required'),
  quoteAmount: z.string().optional(),
  quoteDetails: z.string().optional(),
});
type SubmitFormValues = z.infer<typeof submitSchema>;

const commentSchema = z.object({ text: z.string().min(1, 'Comment cannot be empty') });
type CommentFormValues = z.infer<typeof commentSchema>;

// ─── API helpers ───────────────────────────────────────────────────────────────

const vendorApi = {
  getTasks: () => apiGet<{ vendor: any; tasks: any[]; fmsSteps: any[] }>('/vendor-portal/tasks'),
  submitTask: (id: string, data: SubmitFormValues) =>
    apiPatch<any>(`/vendor-portal/tasks/${id}/submit`, { remarks: data.remarks }),
  addComment: (refId: string, text: string) =>
    apiPost<any>('/comments', { refId, refType: 'DELEGATION', body: text }),
  getComments: (refId: string) => apiGet<any[]>('/comments', { refId }),
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface VendorTask {
  id: string;
  requestId: string;
  title: string;
  description: string;
  status: string;
  deadlineDate: string;
  project?: { name: string };
  requestedBy?: { name: string };
  createdAt: string;
}

// ─── Comment Modal ─────────────────────────────────────────────────────────────

function CommentModal({ item, onClose }: { item: VendorTask | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['vendor-comments', item?.id],
    queryFn: () => vendorApi.getComments(item!.id),
    enabled: !!item,
  });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CommentFormValues>({
    resolver: zodResolver(commentSchema),
  });
  const { mutate: addComment, isPending } = useMutation({
    mutationFn: (v: CommentFormValues) => vendorApi.addComment(item!.id, v.text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-comments', item?.id] });
      reset();
      toast.success('Comment added');
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  return (
    <Modal open={!!item} onClose={onClose} title={`Comments — ${item?.title ?? ''}`} size="lg">
      <div className="flex flex-col gap-4">
        <div className="max-h-72 overflow-y-auto flex flex-col gap-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && comments.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No comments yet.</p>
          )}
          {comments.map((c: any) => (
            <div key={c.id} className="rounded-xl border border-border bg-surface/60 p-3">
              <p className="text-xs font-semibold text-primary mb-0.5">{c.author?.name ?? 'You'}</p>
              <p className="text-sm text-foreground">{c.body}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{formatDate(c.createdAt)}</p>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit((v) => addComment(v))} className="flex gap-2">
          <Textarea {...register('text')} placeholder="Write a comment…" className="flex-1 min-h-[60px]" error={errors.text?.message} />
          <Button type="submit" loading={isPending} icon={<Send className="h-3.5 w-3.5" />}>Send</Button>
        </form>
      </div>
    </Modal>
  );
}

// ─── Submit Modal ──────────────────────────────────────────────────────────────

function SubmitModal({
  item,
  onClose,
}: {
  item: VendorTask | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<SubmitFormValues>({
    resolver: zodResolver(submitSchema),
  });
  const { mutate, isPending } = useMutation({
    mutationFn: (v: SubmitFormValues) => vendorApi.submitTask(item!.id, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-tasks'] });
      reset();
      onClose();
      toast.success('Submission sent for approval');
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={`Submit Work — ${item?.title ?? ''}`}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button form="vendor-submit-form" type="submit" loading={isPending} icon={<Send className="h-4 w-4" />}>
            Submit for Approval
          </Button>
        </div>
      }
    >
      <form id="vendor-submit-form" onSubmit={handleSubmit((v) => mutate(v))} className="grid gap-4">
        <Textarea
          label="Completion Remarks"
          {...register('remarks')}
          placeholder="Describe what was done, any notes for the reviewer…"
          error={errors.remarks?.message}
        />
        <Input
          label="Quote Amount (optional)"
          type="text"
          {...register('quoteAmount')}
          placeholder="e.g. ₹15,000"
          error={errors.quoteAmount?.message}
        />
        <Textarea
          label="Quote Details (optional)"
          {...register('quoteDetails')}
          placeholder="Breakdown, terms, conditions…"
          error={errors.quoteDetails?.message}
        />
      </form>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorPortalPage() {
  const [submitTarget, setSubmitTarget] = useState<VendorTask | null>(null);
  const [commentTarget, setCommentTarget] = useState<VendorTask | null>(null);
  const [tab, setTab] = useState<'pending' | 'completed'>('pending');

  const { data: tasks = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['vendor-tasks'],
    queryFn: async () => {
      const response = await vendorApi.getTasks();
      return response.tasks ?? [];
    },
  });

  const pendingTasks = tasks.filter((t: VendorTask) =>
    ['PENDING', 'IN_PROGRESS', 'REWORK'].includes(t.status)
  );
  const completedTasks = tasks.filter((t: VendorTask) =>
    ['COMPLETED', 'SEND_FOR_APPROVAL'].includes(t.status)
  );

  const total = tasks.length;
  const pending = pendingTasks.length;
  const inReview = tasks.filter((t: VendorTask) => t.status === 'SEND_FOR_APPROVAL').length;
  const completed = tasks.filter((t: VendorTask) => t.status === 'COMPLETED').length;

  const sharedColumns = (showSubmit: boolean): Column<VendorTask>[] => [
    {
      key: 'requestId', header: 'Request ID',
      render: (t) => <span className="font-mono text-xs text-primary">{t.requestId}</span>,
    },
    {
      key: 'title', header: 'Title',
      render: (t) => (
        <div>
          <p className="font-medium text-foreground">{t.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>
        </div>
      ),
    },
    { key: 'project', header: 'Project', render: (t) => t.project?.name ?? '—' },
    { key: 'deadline', header: 'Deadline', render: (t) => formatDate(t.deadlineDate) },
    { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
    {
      key: 'actions', header: 'Actions',
      render: (t) => (
        <div className="flex items-center gap-2">
          {showSubmit && t.status !== 'SEND_FOR_APPROVAL' && (
            <Button
              size="sm"
              variant="primary"
              icon={<Send className="h-3.5 w-3.5" />}
              onClick={() => setSubmitTarget(t)}
            >
              Submit
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            onClick={() => setCommentTarget(t)}
          >
            Comment
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> Vendor Portal
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View assigned tasks, submit deliverables, upload documents, and communicate with the team.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Tasks" value={total} icon={FileText} color="indigo" />
        <StatCard label="Pending / Rework" value={pending} icon={Clock} color="yellow" />
        <StatCard label="In Review" value={inReview} icon={AlertTriangle} color="blue" />
        <StatCard label="Completed" value={completed} icon={CheckCircle} color="green" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {(['pending', 'completed'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px
              ${tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            {t === 'pending' ? `Pending / Rework (${pending})` : `Completed (${completed})`}
          </button>
        ))}
      </div>

      {/* Tables */}
      {tab === 'pending' && (
        <DataTable
          columns={sharedColumns(true)}
          data={pendingTasks}
          loading={isLoading}
          error={isError}
          onRetry={refetch}
          emptyMessage="No pending tasks. All caught up!"
        />
      )}
      {tab === 'completed' && (
        <DataTable
          columns={sharedColumns(false)}
          data={completedTasks}
          loading={isLoading}
          emptyMessage="No completed tasks yet."
        />
      )}

      {/* Submit Modal */}
      <SubmitModal item={submitTarget} onClose={() => setSubmitTarget(null)} />

      {/* Comment Modal */}
      <CommentModal item={commentTarget} onClose={() => setCommentTarget(null)} />
    </div>
  );
}
