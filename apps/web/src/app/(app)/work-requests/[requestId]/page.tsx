'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, RotateCcw } from 'lucide-react';
import { workRequestApi } from '@/lib/api';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';
import { getApiError } from '@/lib/axios';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';

export default function WorkRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = ['ADMIN', 'MANAGER', 'COMPANY_OWNER', 'SAAS_OWNER'].includes(user?.role ?? '');

  const { data: req, isLoading } = useQuery({
    queryKey: ['work-requests', requestId],
    queryFn: () => workRequestApi.findOne(requestId),
    enabled: !!requestId,
  });

  const [approveModal, setApproveModal] = useState(false);
  const [reworkModal, setReworkModal] = useState(false);
  const [approveRemarks, setApproveRemarks] = useState('');
  const [reworkRemarks, setReworkRemarks] = useState('');

  const approveMutation = useMutation({
    mutationFn: () => workRequestApi.approve(requestId, { remarks: approveRemarks }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-requests'] });
      toast.success('Request approved');
      router.back();
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const reworkMutation = useMutation({
    mutationFn: () => workRequestApi.rework(requestId, { reworkRemark: reworkRemarks }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-requests'] });
      toast.success('Sent for rework');
      router.back();
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!req) return <div className="text-center py-20 text-slate-500">Request not found.</div>;

  const canApprove = isAdmin && req.status === 'SEND_FOR_APPROVAL';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Work Request Detail</h1>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-mono text-slate-400 mb-1">{req.requestId}</p>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{req.title}</h2>
          </div>
          <StatusBadge status={req.status} />
        </div>

        {req.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400">{req.description}</p>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Requested By</span>
            <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{req.requestedBy?.name}</p>
          </div>
          <div>
            <span className="text-slate-500">Assigned To</span>
            <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{req.requestFor?.name}</p>
          </div>
          <div>
            <span className="text-slate-500">Deadline</span>
            <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{formatDate(req.deadlineDate)}</p>
          </div>
          <div>
            <span className="text-slate-500">Project</span>
            <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{req.project?.name ?? '—'}</p>
          </div>
        </div>

        {req.doerRemarks && (
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-4">
            <p className="text-xs font-medium text-slate-500 mb-1">Completion Remarks</p>
            <p className="text-sm">{req.doerRemarks}</p>
          </div>
        )}

        {canApprove && (
          <div className="flex gap-3 pt-2">
            <Button leftIcon={<CheckCircle className="h-4 w-4" />} onClick={() => setApproveModal(true)}>
              Approve
            </Button>
            <Button variant="outline" leftIcon={<RotateCcw className="h-4 w-4" />} onClick={() => setReworkModal(true)}>
              Request Rework
            </Button>
          </div>
        )}
      </div>

      <Modal open={approveModal} onClose={() => { setApproveModal(false); setApproveRemarks(''); }} title="Approve Request" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => { setApproveModal(false); setApproveRemarks(''); }}>Cancel</Button>
            <Button onClick={() => approveMutation.mutate()} loading={approveMutation.isPending}>
              Confirm
            </Button>
          </>
        }
      >
        <Textarea label="Remarks (optional)" value={approveRemarks} onChange={(e) => setApproveRemarks(e.target.value)} />
      </Modal>

      <Modal open={reworkModal} onClose={() => { setReworkModal(false); setReworkRemarks(''); }} title="Request Rework" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => { setReworkModal(false); setReworkRemarks(''); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => reworkMutation.mutate()} loading={reworkMutation.isPending} disabled={!reworkRemarks.trim()}>
              Send for Rework
            </Button>
          </>
        }
      >
        <Textarea label="Reason *" value={reworkRemarks} onChange={(e) => setReworkRemarks(e.target.value)} />
      </Modal>
    </div>
  );
}
