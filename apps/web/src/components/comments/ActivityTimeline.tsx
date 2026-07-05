'use client';

import { Clock, CheckCircle2, Send, UserPlus, AlertCircle, FileText, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';

export interface TimelineEvent {
  id: string;
  type:
    | 'CREATED'
    | 'ASSIGNED'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REWORK'
    | 'RESUBMITTED'
    | 'COMPLETED'
    | 'COMMENT'
    | 'ATTACHMENT';
  actor: string;
  description: string;
  timestamp: string | Date;
  meta?: Record<string, any>;
}

const EVENT_META: Record<
  TimelineEvent['type'],
  { icon: React.ReactNode; color: string; bg: string }
> = {
  CREATED:    { icon: <FileText className="h-3.5 w-3.5" />,    color: 'text-slate-500',  bg: 'bg-slate-100 dark:bg-slate-700' },
  ASSIGNED:   { icon: <UserPlus className="h-3.5 w-3.5" />,    color: 'text-primary', bg: 'bg-primary/10' },
  SUBMITTED:  { icon: <Send className="h-3.5 w-3.5" />,        color: 'text-warning-foreground', bg: 'bg-warning/25' },
  APPROVED:   { icon: <CheckCircle2 className="h-3.5 w-3.5" />,color: 'text-success-foreground', bg: 'bg-success/22' },
  REWORK:     { icon: <AlertCircle className="h-3.5 w-3.5" />, color: 'text-brand', bg: 'bg-brand/10' },
  RESUBMITTED:{ icon: <Send className="h-3.5 w-3.5" />,        color: 'text-accent', bg: 'bg-accent/12' },
  COMPLETED:  { icon: <CheckCircle2 className="h-3.5 w-3.5" />,color: 'text-success-foreground', bg: 'bg-success/22' },
  COMMENT:    { icon: <MessageSquare className="h-3.5 w-3.5" />,color: 'text-primary', bg: 'bg-primary/10' },
  ATTACHMENT: { icon: <FileText className="h-3.5 w-3.5" />,    color: 'text-accent', bg: 'bg-accent/12' },
};

/**
 * Build a timeline from a DelegationTask or WorkRequest object.
 * Derives events from status timestamps stored on the task.
 */
export function buildTaskTimeline(task: any, type: 'delegation' | 'work-request'): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (task.createdAt) {
    events.push({
      id: 'created',
      type: 'CREATED',
      actor: task.delegatedBy?.name ?? task.requestedBy?.name ?? 'System',
      description: type === 'delegation'
        ? `Task "${task.title}" was created`
        : `Work request "${task.title}" was created`,
      timestamp: task.createdAt,
    });
  }

  if (task.delegatedTo?.name || task.requestFor?.name) {
    events.push({
      id: 'assigned',
      type: 'ASSIGNED',
      actor: task.delegatedBy?.name ?? task.requestedBy?.name ?? 'System',
      description: `Assigned to ${task.delegatedTo?.name ?? task.requestFor?.name}`,
      timestamp: task.createdAt,
    });
  }

  if (task.submittedAt) {
    events.push({
      id: 'submitted',
      type: 'SUBMITTED',
      actor: task.delegatedTo?.name ?? task.requestFor?.name ?? 'Doer',
      description: task.doerRemarks
        ? `Submitted for approval: "${task.doerRemarks}"`
        : 'Submitted for approval',
      timestamp: task.submittedAt,
    });
  }

  if (task.reworkCount > 0 && task.reworkRemark) {
    events.push({
      id: 'rework',
      type: 'REWORK',
      actor: task.delegatedBy?.name ?? task.requestedBy?.name ?? 'Reviewer',
      description: `Sent for rework: "${task.reworkRemark}"`,
      timestamp: task.updatedAt ?? task.submittedAt,
    });
  }

  if (task.approvedAt) {
    events.push({
      id: 'approved',
      type: task.status === 'COMPLETED' ? 'COMPLETED' : 'APPROVED',
      actor: task.approvedBy?.name ?? 'Reviewer',
      description: task.finalRemarks
        ? `Approved — "${task.finalRemarks}"`
        : 'Approved and completed',
      timestamp: task.approvedAt,
    });
  }

  // Sort chronologically
  return events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

interface ActivityTimelineProps {
  events: TimelineEvent[];
  loading?: boolean;
}

export function ActivityTimeline({ events, loading }: ActivityTimelineProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute bottom-0 left-[15px] top-0 w-px bg-border" />

      <div className="space-y-4 pl-10">
        {events.map((event, idx) => {
          const { icon, color, bg } = EVENT_META[event.type] ?? EVENT_META.CREATED;
          return (
            <div key={event.id ?? idx} className="relative">
              {/* Dot */}
              <div className={cn('absolute -left-[34px] flex h-8 w-8 items-center justify-center rounded-full', bg)}>
                <span className={color}>{icon}</span>
              </div>

              <div className="rounded-2xl border border-border bg-surface px-3 py-2.5 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.5)]">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-foreground">
                    {event.actor}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {format(new Date(event.timestamp), 'dd MMM yyyy, hh:mm a')}
                  </span>
                </div>
                <p className="text-sm text-foreground/80">{event.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
