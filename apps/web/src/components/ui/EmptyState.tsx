import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-[1.35rem] border border-dashed border-border bg-surface-muted/55 px-4 py-12 text-center shadow-[0_16px_48px_-38px_rgba(15,23,42,0.18)]', className)}>
      <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/12 via-primary/8 to-accent/14 text-primary shadow-[0_16px_36px_-28px_rgba(37,99,235,0.24)]">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-base font-semibold tracking-tight text-foreground">{title}</p>
      {description && (
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
