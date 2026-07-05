'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, User, CheckCircle2, GitBranch, Activity } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { fmsApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export interface FlowMapStep {
  sequence: number;
  title: string;
  description?: string;
  role?: string;
  actionType?: string;
  tatHours?: number;
  fieldCount?: number;
  status?: string;
  assigneeName?: string;
  plannedDate?: string;
  actualDate?: string;
  remarks?: string;
}

interface FmsFlowMapModalProps {
  open: boolean;
  onClose: () => void;
  flowName?: string;
  steps?: FlowMapStep[];
  workflowId?: string;
  showWorkflowSelector?: boolean;
  initialWorkflowId?: string;
}

// ── Arrow connector between step cards ────────────────────────────────────────

function Arrow() {
  return (
    <div className="flex items-center shrink-0 self-center">
      <div className="w-8 h-0.5 bg-emerald-400" />
      <svg width="10" height="14" viewBox="0 0 10 14" className="text-emerald-400 -ml-0.5">
        <path d="M0 0 L10 7 L0 14 Z" fill="currentColor" />
      </svg>
    </div>
  );
}

// ── Step status helpers ───────────────────────────────────────────────────────

function stepStyle(status: string | undefined, isCurrent: boolean) {
  if (status === 'COMPLETED')
    return { card: 'bg-green-50 dark:bg-green-900/20 border-green-400', badge: 'bg-green-500 text-contrast', label: 'DONE' };
  if (isCurrent)
    return { card: 'bg-blue-50 dark:bg-blue-900/20 border-blue-500', badge: 'bg-blue-600 text-contrast', label: 'LIVE' };
  if (status === 'LATE')
    return { card: 'bg-red-50 dark:bg-red-900/20 border-red-400', badge: 'bg-red-500 text-contrast', label: 'LATE' };
  return { card: 'bg-slate-50 dark:bg-slate-800/60 border-slate-300 dark:border-slate-600', badge: 'bg-slate-400 text-contrast', label: 'PENDING' };
}

// ── Single step card ──────────────────────────────────────────────────────────

function StepCard({ step, isCurrent }: { step: FlowMapStep; isCurrent: boolean }) {
  const style = stepStyle(step.status, isCurrent);
  return (
    <div className={`relative flex flex-col shrink-0 w-52 rounded-xl border-2 ${style.card} p-3 shadow-sm`}>
      {/* Step # badge */}
      <span className="absolute -top-3 -left-2 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-contrast shadow">
        {step.sequence}
      </span>

      {/* Title + status badge */}
      <div className="flex items-start justify-between gap-1 mb-1.5 mt-1">
        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight line-clamp-2">{step.title}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${style.badge}`}>
          {style.label}
        </span>
      </div>

      {/* Description */}
      {step.description && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">{step.description}</p>
      )}

      {/* Details */}
      <div className="space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
        {step.role && <p><span className="text-slate-400">Role:</span> {step.role}</p>}
        {step.actionType && <p><span className="text-slate-400">Action:</span> {step.actionType}</p>}
        {step.assigneeName && (
          <p className="flex items-center gap-1">
            <User className="h-3 w-3 text-slate-400 shrink-0" />
            {step.assigneeName}
          </p>
        )}
        <p>
          <span className="text-slate-400">Status:</span>{' '}
          <span className={step.status === 'COMPLETED' ? 'text-green-600 font-medium' : step.status === 'LATE' ? 'text-red-600 font-medium' : 'text-amber-600 font-medium'}>
            {step.status?.toLowerCase() ?? 'pending'}
          </span>
        </p>
        {step.plannedDate && (
          <p><span className="text-slate-400">Due:</span> {formatDate(step.plannedDate)}</p>
        )}
        {step.actualDate && (
          <p><span className="text-slate-400">Done:</span> {formatDate(step.actualDate)}</p>
        )}
        {step.tatHours != null && step.tatHours > 0 && (
          <p className="flex items-center gap-1 mt-1">
            <Clock className="h-3 w-3 text-amber-500 shrink-0" />
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {step.tatHours >= 24 ? `${Math.round(step.tatHours / 24)}d` : `${step.tatHours}h`} TAT
            </span>
          </p>
        )}
        {step.fieldCount != null && step.fieldCount > 0 && (
          <p className="text-emerald-600 dark:text-emerald-400 font-medium">{step.fieldCount} field{step.fieldCount !== 1 ? 's' : ''}</p>
        )}
        {step.remarks && (
          <p><span className="text-slate-400">Remark:</span> {step.remarks}</p>
        )}
      </div>
    </div>
  );
}

// ── Horizontal flow canvas ────────────────────────────────────────────────────

function FlowCanvas({ steps, flowName }: { steps: FlowMapStep[]; flowName: string }) {
  const currentIdx = steps.findIndex(
    (s) => s.status !== 'COMPLETED' && s.status !== 'LATE',
  );

  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
        <GitBranch className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">No steps to display</p>
      </div>
    );
  }

  const liveStep = currentIdx >= 0 ? steps[currentIdx] : null;
  const completedCount = steps.filter((s) => s.status === 'COMPLETED').length;
  const totalCount = steps.length;

  return (
    <div className="space-y-4">
      {/* Header banner */}
      <div className="rounded-xl bg-gradient-to-r from-slate-800 to-indigo-800 px-5 py-4 text-contrast">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300 mb-1">FMS VISUAL CONTROL</p>
            <p className="text-base font-bold leading-tight">
              {liveStep ? `Live Activity: ${liveStep.title}` : `${flowName} — Complete`}
            </p>
            {liveStep?.description && (
              <p className="text-xs text-slate-300 mt-1 line-clamp-1">{liveStep.description}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <span className="rounded-full border border-indigo-400 bg-indigo-700/60 px-3 py-0.5 text-[11px] font-semibold">
              Current {completedCount + 1}/{totalCount}
            </span>
            <span className="rounded-full border border-slate-500 bg-slate-700/60 px-3 py-0.5 text-[11px] font-semibold text-center">
              Rework 0
            </span>
          </div>
        </div>
      </div>

      {/* Horizontal flow */}
      <div className="overflow-x-auto pb-4">
        <div className="flex items-center gap-0 min-w-max px-4 py-6">
          {/* Start node */}
          <div className="shrink-0 flex items-center justify-center w-24 h-14 rounded-full border-2 border-amber-400 bg-amber-50 dark:bg-amber-900/20 shadow-sm">
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">Start</span>
          </div>

          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center">
              <Arrow />
              <StepCard step={step} isCurrent={idx === currentIdx} />
            </div>
          ))}

          {/* End node */}
          <div className="flex items-center">
            <Arrow />
            <div className={`shrink-0 flex items-center justify-center w-24 h-14 rounded-full border-2 shadow-sm ${
              completedCount === totalCount
                ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                : 'border-slate-300 bg-slate-50 dark:bg-slate-800/60 opacity-50'
            }`}>
              <CheckCircle2 className={`h-5 w-5 ${completedCount === totalCount ? 'text-green-500' : 'text-slate-400'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-400 px-1">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" />Live / Current</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-500 inline-block" />Completed</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" />Late</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-400 inline-block" />Pending</span>
      </div>
    </div>
  );
}

// ── Current Progress table ────────────────────────────────────────────────────

function ProgressTable({ steps }: { steps: FlowMapStep[] }) {
  return (
    <div className="overflow-auto max-h-96 rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-full text-sm divide-y divide-slate-100 dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 sticky top-0">
          <tr>
            {['#', 'Step', 'Assignee', 'TAT', 'Planned', 'Actual', 'Status'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-950/30">
          {steps.map((s, i) => (
            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <td className="px-4 py-2.5 text-slate-500">{s.sequence}</td>
              <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">{s.title}</td>
              <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{s.assigneeName ?? '—'}</td>
              <td className="px-4 py-2.5 text-amber-600 dark:text-amber-400">
                {s.tatHours ? (s.tatHours >= 24 ? `${Math.round(s.tatHours / 24)}d` : `${s.tatHours}h`) : '—'}
              </td>
              <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{s.plannedDate ? formatDate(s.plannedDate) : '—'}</td>
              <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{s.actualDate ? formatDate(s.actualDate) : '—'}</td>
              <td className="px-4 py-2.5">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  s.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                  s.status === 'LATE' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                }`}>
                  {s.status ?? 'PENDING'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatBar({ steps, workflowName }: { steps: FlowMapStep[]; workflowName: string }) {
  const completedCount = steps.filter((s) => s.status === 'COMPLETED').length;
  const currentStep = steps.find((s) => s.status !== 'COMPLETED');
  const currentIdx = steps.indexOf(currentStep!) + 1;
  const lateCount = steps.filter((s) => s.status === 'LATE').length;

  const stats = [
    { label: 'Status', value: completedCount === steps.length ? 'completed' : lateCount > 0 ? 'late' : 'active', color: completedCount === steps.length ? 'text-green-600' : lateCount > 0 ? 'text-red-600' : 'text-indigo-600' },
    { label: 'Total Steps', value: steps.length, color: 'text-slate-800 dark:text-slate-100' },
    { label: 'Current Step', value: currentIdx || steps.length, color: 'text-amber-600' },
    { label: 'Completed', value: `${completedCount}/${steps.length}`, color: 'text-green-600' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">{s.label}</p>
          <p className={`text-lg font-bold ${s.color}`}>{String(s.value)}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function FmsFlowMapModal({
  open, onClose, flowName = '', steps: propSteps, workflowId: propWorkflowId,
  showWorkflowSelector, initialWorkflowId,
}: FmsFlowMapModalProps) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(propWorkflowId ?? initialWorkflowId ?? '');
  const [activeTab, setActiveTab] = useState<'flow' | 'progress'>('flow');

  const activeWorkflowId = propWorkflowId ?? selectedWorkflowId;

  const { data: workflows = [] } = useQuery({
    queryKey: ['fms', 'workflows'],
    queryFn: fmsApi.findWorkflows,
    enabled: open && showWorkflowSelector,
  });

  const { data: pendingData, isLoading: loadingPending } = useQuery({
    queryKey: ['fms', 'flowmap', activeWorkflowId, 'pending'],
    queryFn: () => fmsApi.findSteps({ workflowId: activeWorkflowId, view: 'team-pending', limit: 100 }),
    enabled: open && !!activeWorkflowId && !propSteps,
  });

  const { data: completedData, isLoading: loadingCompleted } = useQuery({
    queryKey: ['fms', 'flowmap', activeWorkflowId, 'completed'],
    queryFn: () => fmsApi.findSteps({ workflowId: activeWorkflowId, view: 'team-completed', limit: 100 }),
    enabled: open && !!activeWorkflowId && !propSteps,
  });

  const selectedWorkflow = workflows.find((w: any) => w.id === activeWorkflowId);
  const displayName = flowName || selectedWorkflow?.name || 'Workflow';

  const liveSteps: FlowMapStep[] = propSteps ?? (() => {
    const pending = (pendingData?.data ?? []).map((t: any) => ({
      sequence: t.stepNo,
      title: t.stepName ?? t.title,
      description: t.what,
      status: t.status,
      assigneeName: t.assignedTo?.name ?? t.person?.name,
      plannedDate: t.plannedDate,
      actualDate: t.actualDate,
      remarks: t.remarks,
    }));
    const completed = (completedData?.data ?? []).map((t: any) => ({
      sequence: t.stepNo,
      title: t.stepName ?? t.title,
      description: t.what,
      status: t.status,
      assigneeName: t.assignedTo?.name ?? t.person?.name,
      plannedDate: t.plannedDate,
      actualDate: t.actualDate,
      remarks: t.remarks,
    }));
    return [...pending, ...completed].sort((a, b) => a.sequence - b.sequence);
  })();

  const isLoading = !propSteps && (loadingPending || loadingCompleted);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Algorithm Flow Map: ${displayName}`}
      size="2xl"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4">
        {/* Workflow selector */}
        {showWorkflowSelector && !propWorkflowId && (
          <select
            value={selectedWorkflowId}
            onChange={(e) => { setSelectedWorkflowId(e.target.value); setActiveTab('flow'); }}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 shadow-sm outline-none focus:border-indigo-500"
          >
            <option value="">Choose a workflow…</option>
            {workflows.map((w: any) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
            <Activity className="h-5 w-5 animate-pulse" />
            <span className="text-sm">Loading flow map…</span>
          </div>
        ) : (!activeWorkflowId && !propSteps) ? (
          <div className="flex flex-col items-center justify-center py-14 text-slate-400 dark:text-slate-500">
            <GitBranch className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Select a workflow to view its flow map</p>
          </div>
        ) : (
          <>
            {/* Stats bar */}
            <StatBar steps={liveSteps} workflowName={displayName} />

            {/* Tabs */}
            <div className="flex gap-2">
              {(['flow', 'progress'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                    activeTab === t
                      ? 'bg-indigo-600 text-contrast shadow'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {t === 'flow' ? 'Flow' : 'Current Progress'}
                </button>
              ))}
            </div>

            {/* Content */}
            {activeTab === 'flow' ? (
              <FlowCanvas steps={liveSteps} flowName={displayName} />
            ) : (
              <ProgressTable steps={liveSteps} />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
