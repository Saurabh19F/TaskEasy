'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, RotateCcw } from 'lucide-react';
import { delegationApi } from '@/lib/api';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useApproveDelegation, useReworkDelegation } from '@/hooks/useDelegation';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Textarea, Input } from '@/components/ui/Input';

export default function DelegationDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = ['ADMIN', 'MANAGER', 'COMPANY_OWNER', 'SAAS_OWNER'].includes(user?.role ?? '');

  const { data: task, isLoading } = useQuery({
    queryKey: ['delegation', taskId],
    queryFn: () => delegationApi.findOne(taskId),
    enabled: !!taskId,
  });

  const [approveModal, setApproveModal] = useState(false);
  const [reworkModal, setReworkModal] = useState(false);
  const [rating, setRating] = useState('');
  const [approveRemarks, setApproveRemarks] = useState('');
  const [reworkRemark, setReworkRemark] = useState('');

  const { mutate: approve, isPending: approving } = useApproveDelegation();
  const { mutate: rework, isPending: reworking } = useReworkDelegation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!task) {
    return <div className="text-center py-20 text-slate-500">Task not found.</div>;
  }

  const canApprove = isAdmin && task.status === 'SEND_FOR_APPROVAL';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Task Detail</h1>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-mono text-slate-400 mb-1">{task.taskId}</p>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{task.title}</h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
          </div>
        </div>

        {task.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400">{task.description}</p>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Assigned To</span>
            <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{task.delegatedTo?.name}</p>
          </div>
          <div>
            <span className="text-slate-500">Assigned By</span>
            <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{task.delegatedBy?.name}</p>
          </div>
          <div>
            <span className="text-slate-500">Due Date</span>
            <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{formatDate(task.targetDate)}</p>
          </div>
          <div>
            <span className="text-slate-500">Project</span>
            <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{task.project?.name ?? '—'}</p>
          </div>
          {task.onTimeStatus && (
            <div>
              <span className="text-slate-500">On-Time Status</span>
              <p className={`font-medium mt-0.5 ${task.onTimeStatus === 'ON_TIME' ? 'text-green-600' : 'text-red-500'}`}>
                {task.onTimeStatus}
              </p>
            </div>
          )}
          {task.delayDays > 0 && (
            <div>
              <span className="text-slate-500">Delay</span>
              <p className="font-medium text-red-500 mt-0.5">{task.delayDays} day(s)</p>
            </div>
          )}
        </div>

        {task.doerRemarks && (
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-4">
            <p className="text-xs font-medium text-slate-500 mb-1">Completion Remarks</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">{task.doerRemarks}</p>
          </div>
        )}

        {task.reworkRemark && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-4">
            <p className="text-xs font-medium text-amber-600 mb-1">Rework Reason</p>
            <p className="text-sm text-amber-800 dark:text-amber-300">{task.reworkRemark}</p>
          </div>
        )}

        {task.finalRemarks && (
          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4">
            <p className="text-xs font-medium text-green-600 mb-1">Approval Remarks</p>
            <p className="text-sm text-green-800 dark:text-green-300">{task.finalRemarks}</p>
          </div>
        )}

        {canApprove && (
          <div className="flex gap-3 pt-2">
            <Button
              leftIcon={<CheckCircle className="h-4 w-4" />}
              onClick={() => setApproveModal(true)}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              leftIcon={<RotateCcw className="h-4 w-4" />}
              onClick={() => setReworkModal(true)}
            >
              Request Rework
            </Button>
          </div>
        )}
      </div>

      {/* Approve Modal */}
      <Modal
        open={approveModal}
        onClose={() => setApproveModal(false)}
        title="Approve Task"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setApproveModal(false)}>Cancel</Button>
            <Button
              onClick={() => approve(
                { id: task.id, remarks: approveRemarks, rating: rating ? Number(rating) : undefined },
                { onSuccess: () => { setApproveModal(false); router.back(); } },
              )}
              loading={approving}
            >
              Confirm Approval
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Textarea
            label="Remarks (optional)"
            value={approveRemarks}
            onChange={(e) => setApproveRemarks(e.target.value)}
          />
          <Input
            type="number"
            label="Rating 1-5 (optional)"
            min="1"
            max="5"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          />
        </div>
      </Modal>

      {/* Rework Modal */}
      <Modal
        open={reworkModal}
        onClose={() => setReworkModal(false)}
        title="Request Rework"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setReworkModal(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rework(
                { id: task.id, reworkRemark },
                { onSuccess: () => { setReworkModal(false); router.back(); } },
              )}
              loading={reworking}
              disabled={!reworkRemark.trim()}
            >
              Send for Rework
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason for rework *"
          value={reworkRemark}
          onChange={(e) => setReworkRemark(e.target.value)}
          placeholder="Describe what needs to be corrected…"
        />
      </Modal>
    </div>
  );
}
