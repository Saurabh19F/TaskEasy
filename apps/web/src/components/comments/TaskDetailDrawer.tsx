'use client';

import { useState } from 'react';
import { X, MessageSquare, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CommentsPanel } from './CommentsPanel';
import { ActivityTimeline, buildTaskTimeline, TimelineEvent } from './ActivityTimeline';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';

type RefType = 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST' | 'FMS_STEP';

interface TaskDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  task: any;
  refType: RefType;
  taskType: 'delegation' | 'work-request';
}

export function TaskDetailDrawer({ open, onClose, task, refType, taskType }: TaskDetailDrawerProps) {
  const [tab, setTab] = useState<'timeline' | 'comments'>('timeline');

  const timelineEvents: TimelineEvent[] = task ? buildTaskTimeline(task, taskType) : [];

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      )}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-[0_40px_100px_-56px_rgba(15,23,42,0.85)] transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border bg-surface-strong px-4 py-4">
          <div className="min-w-0">
            <p className="mb-0.5 font-mono text-xs text-muted-foreground">{task?.taskId ?? task?.requestId}</p>
            <h2 className="line-clamp-2 font-semibold tracking-tight text-foreground">
              {task?.title}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {task?.status && <StatusBadge status={task.status} />}
              {task?.priority && <PriorityBadge priority={task.priority} />}
            </div>
          </div>
          <button onClick={onClose} className="mt-0.5 shrink-0 rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Meta row */}
        {task && (
          <div className="flex items-center gap-4 border-b border-border bg-surface-muted/50 px-4 py-2.5 text-xs text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground/80">Assignee:</span>{' '}
              {task.delegatedTo?.name ?? task.requestFor?.name ?? '—'}
            </span>
            <span>
              <span className="font-semibold text-foreground/80">Due:</span>{' '}
              {formatDate(task.targetDate ?? task.deadlineDate)}
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border bg-surface">
          {(['timeline', 'comments'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors',
                tab === t
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'timeline' ? <Clock className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
              {t === 'timeline' ? 'Activity' : 'Comments'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'timeline' ? (
            <div className="p-4">
              <ActivityTimeline events={timelineEvents} />
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {task && <CommentsPanel refId={task.id} refType={refType} />}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
