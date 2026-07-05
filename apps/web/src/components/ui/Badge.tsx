import { cn } from '@/lib/utils';
import {
  Circle, Check, RotateCcw, AlertTriangle, Clock, Lock,
  type LucideIcon,
} from 'lucide-react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'dot';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-4 tracking-wide',
        variant === 'default' && 'border border-border bg-surface-muted text-muted-foreground',
        variant === 'outline' && 'border border-current bg-transparent',
        variant === 'dot' && 'bg-surface-muted text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

function formatBadgeLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface StatusSpec {
  className: string;
  icon: LucideIcon;
  iconClassName?: string;
  label?: string;
}

const STATUS_SPECS: Record<string, StatusSpec> = {
  PENDING: {
    className: 'bg-[rgba(245,158,11,0.10)] text-warning border border-[rgba(245,158,11,0.18)]',
    icon: Circle, iconClassName: 'h-1.5 w-1.5 fill-current',
  },
  IN_PROGRESS: {
    className: 'bg-[rgba(37,99,235,0.10)] text-primary border border-[rgba(37,99,235,0.18)]',
    icon: Circle, iconClassName: 'h-1.5 w-1.5 fill-current',
  },
  SEND_FOR_APPROVAL: {
    className: 'bg-[rgba(37,99,235,0.10)] text-primary border border-[rgba(37,99,235,0.18)]',
    icon: Circle, iconClassName: 'h-1.5 w-1.5 fill-current',
    label: 'For Approval',
  },
  COMPLETED: {
    className: 'bg-[rgba(16,185,129,0.10)] text-success border border-[rgba(16,185,129,0.18)]',
    icon: Check,
  },
  APPROVED: {
    className: 'bg-[rgba(16,185,129,0.10)] text-success border border-[rgba(16,185,129,0.18)]',
    icon: Check,
  },
  REWORK: {
    className: 'bg-[rgba(220,38,38,0.10)] text-danger border border-[rgba(220,38,38,0.18)]',
    icon: RotateCcw,
  },
  ON_TIME: {
    className: 'bg-[rgba(16,185,129,0.10)] text-success border border-[rgba(16,185,129,0.18)]',
    icon: Check,
  },
  LATE: {
    className: 'bg-[rgba(220,38,38,0.10)] text-danger border border-[rgba(220,38,38,0.18)]',
    icon: AlertTriangle,
  },
  OVERDUE: {
    className: 'bg-[rgba(245,158,11,0.12)] text-warning border border-[rgba(245,158,11,0.20)]',
    icon: Clock,
  },
  BLOCKED: {
    className: 'bg-[rgba(220,38,38,0.10)] text-danger border border-[rgba(220,38,38,0.18)]',
    icon: Lock,
  },
  ACTIVE: {
    className: 'bg-[rgba(16,185,129,0.10)] text-success border border-[rgba(16,185,129,0.18)]',
    icon: Check,
  },
  INACTIVE: {
    className: 'bg-surface-muted text-muted-foreground border border-border',
    icon: Circle, iconClassName: 'h-1.5 w-1.5 fill-current',
  },
  ON_LEAVE: {
    className: 'bg-[rgba(245,158,11,0.10)] text-warning border border-[rgba(245,158,11,0.18)]',
    icon: Clock,
  },
  TERMINATED: {
    className: 'bg-[rgba(220,38,38,0.10)] text-danger border border-[rgba(220,38,38,0.18)]',
    icon: AlertTriangle,
  },
  RESIGNED: {
    className: 'bg-surface-muted text-muted-foreground border border-border',
    icon: Circle, iconClassName: 'h-1.5 w-1.5 fill-current',
  },
  PAUSED: {
    className: 'bg-surface-muted text-muted-foreground border border-border',
    icon: Clock,
  },
  CANCELLED: {
    className: 'bg-[rgba(220,38,38,0.08)] text-danger border border-[rgba(220,38,38,0.18)]',
    icon: Circle, iconClassName: 'h-1.5 w-1.5 fill-current',
  },
  REJECTED: {
    className: 'bg-[rgba(220,38,38,0.10)] text-danger border border-[rgba(220,38,38,0.18)]',
    icon: AlertTriangle,
  },
  NOT_STARTED: {
    className: 'bg-surface-muted text-muted-foreground border border-border',
    icon: Circle, iconClassName: 'h-1.5 w-1.5 fill-current',
  },
  SKIPPED: {
    className: 'bg-surface-muted text-muted-foreground border border-border',
    icon: Circle, iconClassName: 'h-1.5 w-1.5 fill-current',
  },
  ON_HOLD: {
    className: 'bg-[rgba(245,158,11,0.10)] text-warning border border-[rgba(245,158,11,0.18)]',
    icon: Clock,
  },
  ARCHIVED: {
    className: 'bg-surface-muted text-muted-foreground border border-border',
    icon: Lock,
  },
  DRAFT: {
    className: 'bg-surface-muted text-muted-foreground border border-border',
    icon: Circle, iconClassName: 'h-1.5 w-1.5 fill-current',
  },
  PUBLISHED: {
    className: 'bg-[rgba(16,185,129,0.10)] text-success border border-[rgba(16,185,129,0.18)]',
    icon: Check,
  },
  LOCKED: {
    className: 'bg-[rgba(220,38,38,0.10)] text-danger border border-[rgba(220,38,38,0.18)]',
    icon: Lock,
  },
  PENDING_VERIFICATION: {
    className: 'bg-[rgba(245,158,11,0.10)] text-warning border border-[rgba(245,158,11,0.18)]',
    icon: Clock,
  },
};

const DEFAULT_SPEC: StatusSpec = {
  className: 'bg-surface-muted text-muted-foreground border border-border',
  icon: Circle,
  iconClassName: 'h-1.5 w-1.5 fill-current',
};

export function StatusBadge({ status }: { status?: string | null }) {
  const normalizedStatus = String(status ?? '').trim().toUpperCase();
  const spec = STATUS_SPECS[normalizedStatus] ?? DEFAULT_SPEC;
  const Icon = spec.icon;
  const label = spec.label ?? (normalizedStatus ? formatBadgeLabel(normalizedStatus) : 'Unknown');

  return (
    <Badge className={spec.className}>
      <Icon className={spec.iconClassName ?? 'h-3 w-3'} />
      {label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority?: string | null }) {
  const normalizedPriority = String(priority ?? '').trim().toUpperCase();
  const styles: Record<string, string> = {
    LOW:      'bg-surface-muted text-muted-foreground border border-border',
    MEDIUM:   'bg-[rgba(37,99,235,0.10)] text-primary border border-[rgba(37,99,235,0.18)]',
    HIGH:     'bg-[rgba(245,158,11,0.10)] text-warning border border-[rgba(245,158,11,0.18)]',
    URGENT:   'bg-[rgba(220,38,38,0.10)] text-danger border border-[rgba(220,38,38,0.18)]',
    CRITICAL: 'bg-[rgba(220,38,38,0.14)] text-danger border border-[rgba(220,38,38,0.24)] font-semibold',
  };
  const label = normalizedPriority ? formatBadgeLabel(normalizedPriority) : 'Unknown';
  return (
    <Badge className={styles[normalizedPriority] ?? 'bg-surface-muted text-muted-foreground border border-border'}>
      {label}
    </Badge>
  );
}
