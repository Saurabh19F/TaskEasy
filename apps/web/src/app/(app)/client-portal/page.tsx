'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Users, Briefcase, Clock, AlertTriangle, Send, MessageSquare, CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiGet, apiPost, getApiError } from '@/lib/axios';
import { useActiveProjects } from '@/hooks/useProjects';
import { useAuthStore } from '@/store/auth.store';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { StatCard } from '@/components/ui/StatCard';
import { formatDate } from '@/lib/utils';

// ─── Schema ────────────────────────────────────────────────────────────────────

const requestSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  title: z.string().min(3, 'Title is required'),
  description: z.string().min(5, 'Description is required'),
  deadlineDate: z.string().min(1, 'Deadline is required'),
  deadlineTime: z.string().min(1, 'Time is required'),
});
type RequestFormValues = z.infer<typeof requestSchema>;

const commentSchema = z.object({ text: z.string().min(1, 'Comment cannot be empty') });
type CommentFormValues = z.infer<typeof commentSchema>;

// ─── API helpers ───────────────────────────────────────────────────────────────

const clientApi = {
  getWorkRequests: (email?: string) =>
    apiGet<any[]>('/client-portal/work-requests', email ? { email } : undefined),
  createRequest: (data: RequestFormValues) => apiPost<any>('/work-requests', data),
  addComment: (refId: string, refType: string, text: string) =>
    apiPost<any>('/comments', { refId, refType, body: text }),
  getComments: (refId: string) => apiGet<any[]>('/comments', { refId }),
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface WRItem {
  id: string;
  requestId: string;
  title: string | null;
  description: string | null;
  status: string;
  deadlineDate: string;
  project?: { name: string };
  requestedBy?: { name: string };
  createdAt: string;
}

// ─── Comment Modal ─────────────────────────────────────────────────────────────

function CommentModal({ item, onClose }: { item: WRItem | null; onClose: () => void }) {
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', item?.id],
    queryFn: () => clientApi.getComments(item!.id),
    enabled: !!item,
  });
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CommentFormValues>({
    resolver: zodResolver(commentSchema),
  });
  const { mutate: addComment, isPending } = useMutation({
    mutationFn: (v: CommentFormValues) => clientApi.addComment(item!.id, 'WORK_REQUEST', v.text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', item?.id] });
      reset();
      toast.success('Comment added');
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  return (
    <Modal open={!!item} onClose={onClose} title={`Comments — ${item?.title ?? ''}`} size="lg">
      <div className="flex flex-col gap-4">
        <div className="max-h-72 overflow-y-auto flex flex-col gap-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading comments…</p>}
          {!isLoading && comments.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No comments yet. Be the first.</p>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientPortalPage() {
  const [createModal, setCreateModal] = useState(false);
  const [commentTarget, setCommentTarget] = useState<WRItem | null>(null);
  const [tab, setTab] = useState<'requests' | 'projects'>('requests');
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const { data: projects = [] } = useActiveProjects();

  const { data: requests = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['client-portal-requests', user?.email],
    queryFn: () => clientApi.getWorkRequests(user?.email),
    enabled: !!user?.email,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { projectId: '', title: '', description: '', deadlineDate: '', deadlineTime: '18:00' },
  });

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: (v: RequestFormValues) => clientApi.createRequest(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-portal-requests'] });
      setCreateModal(false);
      reset();
      toast.success('Request submitted successfully');
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  // Summary stats
  const total = requests.length;
  const pending = requests.filter((r: WRItem) => r.status === 'PENDING').length;
  const inProgress = requests.filter((r: WRItem) => ['IN_PROGRESS', 'SEND_FOR_APPROVAL'].includes(r.status)).length;
  const completed = requests.filter((r: WRItem) => r.status === 'COMPLETED').length;

  const columns: Column<WRItem>[] = [
    { key: 'requestId', header: 'Request ID', render: (r) => <span className="font-mono text-xs text-primary">{r.requestId}</span> },
    {
      key: 'title',
      header: 'Title',
      render: (r) => <span className="font-medium">{r.title ?? r.description ?? '—'}</span>,
    },
    { key: 'project', header: 'Project', render: (r) => r.project?.name ?? '—' },
    { key: 'deadlineDate', header: 'Deadline', render: (r) => formatDate(r.deadlineDate) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions', header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" icon={<MessageSquare className="h-3.5 w-3.5" />}
            onClick={() => setCommentTarget(r)}>Comment</Button>
        </div>
      ),
    },
  ];

  const projectColumns: Column<any>[] = [
    { key: 'name', header: 'Project', render: (p) => <span className="font-medium">{p.name}</span> },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    { key: 'description', header: 'Description', render: (p) => <span className="text-sm text-muted-foreground">{p.description ?? '—'}</span> },
    { key: 'createdAt', header: 'Created', render: (p) => formatDate(p.createdAt) },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Client Portal
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Submit requests, track status, and communicate with the team.
          </p>
        </div>
        <Button icon={<Send className="h-4 w-4" />} onClick={() => setCreateModal(true)}>
          New Request
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Requests" value={total} icon={Briefcase} color="indigo" />
        <StatCard label="Pending" value={pending} icon={Clock} color="yellow" />
        <StatCard label="In Progress" value={inProgress} icon={AlertTriangle} color="blue" />
        <StatCard label="Completed" value={completed} icon={CheckCircle} color="green" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {(['requests', 'projects'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px
              ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'requests' ? 'My Requests' : 'Project Status'}
          </button>
        ))}
      </div>

      {/* Table */}
      {tab === 'requests' && (
        <DataTable
          columns={columns}
          data={requests}
          loading={isLoading}
          error={isError}
          onRetry={refetch}
          emptyMessage="No requests found. Submit your first request above."
        />
      )}
      {tab === 'projects' && (
        <DataTable
          columns={projectColumns}
          data={projects}
          emptyMessage="No projects found."
        />
      )}

      {/* Create Request Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Submit New Request" size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button form="client-create-form" type="submit" loading={creating} icon={<Send className="h-4 w-4" />}>Submit Request</Button>
          </div>
        }>
        <form id="client-create-form" onSubmit={handleSubmit((v) => create(v))} className="grid gap-4">
          <Select label="Project" {...register('projectId')} error={errors.projectId?.message}>
            <option value="">Select project…</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Input label="Request Title" {...register('title')} placeholder="e.g. Prepare quotation for ABC client" error={errors.title?.message} />
          <Textarea label="Description" {...register('description')} placeholder="Describe your request in detail…" error={errors.description?.message} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Deadline Date" type="date" {...register('deadlineDate')} error={errors.deadlineDate?.message} />
            <Input label="Deadline Time" type="time" {...register('deadlineTime')} error={errors.deadlineTime?.message} />
          </div>
        </form>
      </Modal>

      {/* Comment Modal */}
      <CommentModal item={commentTarget} onClose={() => setCommentTarget(null)} />
    </div>
  );
}
