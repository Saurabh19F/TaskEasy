'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Kanban, X, ChevronRight, User, Calendar, Flag, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn, formatDate, isOverdue } from '@/lib/utils';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { useActiveProjects } from '@/hooks/useProjects';
import { apiGet, apiPatch } from '@/lib/axios';
import type { DelegationTask } from '@/types';
import Link from 'next/link';

// ── Column config ─────────────────────────────────────────────────────────────

const COLUMNS = ['PENDING', 'IN_PROGRESS', 'SEND_FOR_APPROVAL', 'REWORK', 'COMPLETED'] as const;
type Col = typeof COLUMNS[number];

const COL_META: Record<Col, { label: string; color: string; dot: string }> = {
  PENDING:           { label: 'Pending',      color: 'border-t-slate-400',  dot: 'bg-slate-400' },
  IN_PROGRESS:       { label: 'In Progress',  color: 'border-t-blue-500',   dot: 'bg-blue-500' },
  SEND_FOR_APPROVAL: { label: 'For Approval', color: 'border-t-amber-500',  dot: 'bg-amber-500' },
  REWORK:            { label: 'Rework',       color: 'border-t-orange-500', dot: 'bg-orange-500' },
  COMPLETED:         { label: 'Completed',    color: 'border-t-green-500',  dot: 'bg-green-500' },
};

// Allowed transitions (can't drag to arbitrary states). Must match
// KanbanService's ALLOWED_MOVES on the backend exactly. Submitting for
// approval, sending for rework, and completing all require mandatory
// remarks and/or approver judgment that a drag-and-drop can't collect —
// those go through the Delegation "Done" button and the Approve/Review
// screen instead, which already handle that correctly.
const ALLOWED_MOVES: Record<Col, Col[]> = {
  PENDING:           ['IN_PROGRESS'],
  IN_PROGRESS:       ['PENDING'],
  SEND_FOR_APPROVAL: [],
  REWORK:            [],
  COMPLETED:         [],
};

// ── Card detail modal ─────────────────────────────────────────────────────────

function TaskModal({ task, onClose }: { task: DelegationTask; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="h-4 w-4 text-slate-500" />
        </button>

        <div className="space-y-1">
          <p className="text-xs font-mono text-slate-400">{task.taskId}</p>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{task.title}</h2>
          {task.description && (
            <p className="text-sm text-slate-600 dark:text-slate-400">{task.description}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</p>
            <StatusBadge status={task.status} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Priority</p>
            <PriorityBadge priority={task.priority} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1"><User className="h-3 w-3" /> Assignee</p>
            <p className="font-medium text-slate-700 dark:text-slate-300">{task.delegatedTo?.name ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1"><Calendar className="h-3 w-3" /> Due Date</p>
            <p className={cn('font-medium', isOverdue(task.targetDate) && task.status !== 'COMPLETED' ? 'text-red-500' : 'text-slate-700 dark:text-slate-300')}>
              {formatDate(task.targetDate)}
              {isOverdue(task.targetDate) && task.status !== 'COMPLETED' && (
                <AlertCircle className="inline h-3.5 w-3.5 ml-1 text-red-500" />
              )}
            </p>
          </div>
          {task.project && (
            <div className="space-y-1 col-span-2">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Project</p>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: task.project.color ?? '#6366f1' }} />
                <p className="font-medium text-slate-700 dark:text-slate-300">{task.project.name}</p>
              </div>
            </div>
          )}
        </div>

        {task.doerRemarks && (
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Doer Remarks</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">{task.doerRemarks}</p>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <Link
            href={`/delegation?id=${task.id}`}
            className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-medium"
            onClick={onClose}
          >
            Open full task <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Kanban card ───────────────────────────────────────────────────────────────

function KanbanCard({
  task,
  onDragStart,
  onClick,
}: {
  task: DelegationTask;
  onDragStart: (id: string) => void;
  onClick: (task: DelegationTask) => void;
}) {
  const overdue = isOverdue(task.targetDate) && task.status !== 'COMPLETED';

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
      onClick={() => onClick(task)}
      className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 space-y-2.5 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 transition-all select-none"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-mono text-slate-400 shrink-0">{task.taskId}</p>
        <PriorityBadge priority={task.priority} />
      </div>

      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug">
        {task.title}
      </p>

      {task.project && (
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: task.project.color ?? '#6366f1' }} />
          <span className="text-xs text-slate-500 truncate">{task.project.name}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-indigo-300 shrink-0">
            {task.delegatedTo?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <span className="text-xs text-slate-500 truncate max-w-[80px]">{task.delegatedTo?.name}</span>
        </div>
        <span className={cn('text-xs', overdue ? 'text-red-500 font-medium' : 'text-slate-400')}>
          {overdue && <AlertCircle className="inline h-3 w-3 mr-0.5" />}
          {formatDate(task.targetDate)}
        </span>
      </div>
    </div>
  );
}

// ── Drop column ───────────────────────────────────────────────────────────────

function KanbanColumn({
  col,
  tasks,
  isOver,
  canDrop,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onCardClick,
}: {
  col: Col;
  tasks: DelegationTask[];
  isOver: boolean;
  canDrop: boolean;
  onDragOver: (col: Col) => void;
  onDragLeave: () => void;
  onDrop: (col: Col) => void;
  onDragStart: (id: string) => void;
  onCardClick: (task: DelegationTask) => void;
}) {
  const { label, color, dot } = COL_META[col];

  return (
    <div className="flex-shrink-0 w-64 flex flex-col">
      {/* Column header */}
      <div className={cn('rounded-t-xl border-t-4 bg-slate-100 dark:bg-slate-800/80 px-3 py-2.5 mb-2', color)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full', dot)} />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
          </div>
          <span className="rounded-full bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs px-2 py-0.5 font-medium">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          'flex-1 min-h-[300px] rounded-b-xl space-y-2 p-2 transition-colors duration-150',
          isOver && canDrop && 'bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-300 dark:ring-indigo-700',
          isOver && !canDrop && 'bg-red-50 dark:bg-red-900/10',
        )}
        onDragOver={(e) => { e.preventDefault(); onDragOver(col); }}
        onDragLeave={onDragLeave}
        onDrop={(e) => { e.preventDefault(); onDrop(col); }}
      >
        {tasks.length === 0 && (
          <div className={cn('flex items-center justify-center h-20 rounded-lg border-2 border-dashed text-xs text-slate-500 dark:text-slate-400', isOver && canDrop ? 'border-indigo-300 dark:border-indigo-600' : 'border-slate-200 dark:border-slate-700')}>
            Drop here
          </div>
        )}
        {tasks.map((task) => (
          <KanbanCard key={task.id} task={task} onDragStart={onDragStart} onClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function KanbanPage() {
  const qc = useQueryClient();
  const { data: projects = [] } = useActiveProjects();
  const [projectFilter, setProjectFilter] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggedStatus, setDraggedStatus] = useState<Col | null>(null);
  const [overCol, setOverCol] = useState<Col | null>(null);
  const [selectedTask, setSelectedTask] = useState<DelegationTask | null>(null);

  const { data: board, isLoading } = useQuery({
    queryKey: ['kanban', projectFilter],
    queryFn: () =>
      apiGet<{ board: Record<Col, DelegationTask[]> }>(
        '/kanban/board',
        projectFilter ? { projectId: projectFilter } : undefined,
      ),
    staleTime: 30_000,
  });

  const moveMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      apiPatch(`/kanban/tasks/${taskId}/move`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban'] });
      qc.invalidateQueries({ queryKey: ['delegation'] });
      toast.success('Task moved');
    },
    onError: () => toast.error('Could not move task'),
  });

  const handleDragStart = useCallback((taskId: string) => {
    setDraggedId(taskId);
    // Find what column this task is currently in
    const currentCol = COLUMNS.find((col) =>
      board?.board?.[col]?.some((t) => t.id === taskId),
    ) ?? null;
    setDraggedStatus(currentCol);
  }, [board]);

  const handleDrop = useCallback((col: Col) => {
    if (!draggedId || !draggedStatus) return;
    if (!ALLOWED_MOVES[draggedStatus].includes(col)) {
      toast.error(`Can't move from ${COL_META[draggedStatus].label} to ${COL_META[col].label}`);
      setDraggedId(null);
      setDraggedStatus(null);
      setOverCol(null);
      return;
    }
    moveMutation.mutate({ taskId: draggedId, status: col });
    setDraggedId(null);
    setDraggedStatus(null);
    setOverCol(null);
  }, [draggedId, draggedStatus, moveMutation]);

  const canDropInto = (col: Col) =>
    draggedStatus ? ALLOWED_MOVES[draggedStatus].includes(col) : false;

  return (
    <div className="space-y-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-2">
          <Kanban className="h-5 w-5 text-indigo-500" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Kanban Board</h1>
          <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">Delegation Tasks</span>
        </div>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Board */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col}
              col={col}
              tasks={board?.board?.[col] ?? []}
              isOver={overCol === col}
              canDrop={canDropInto(col)}
              onDragOver={(c) => setOverCol(c)}
              onDragLeave={() => setOverCol(null)}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
              onCardClick={setSelectedTask}
            />
          ))}
        </div>
      )}

      {/* Task detail modal */}
      {selectedTask && (
        <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
