'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo';
  subLabel?: string;
  onClick?: () => void;
  className?: string;
}

const colorMap = {
  blue:   { bg: 'bg-[rgba(37,99,235,0.10)]',  icon: 'text-primary', value: 'text-primary', ring: 'ring-[rgba(37,99,235,0.18)]' },
  green:  { bg: 'bg-[rgba(16,185,129,0.10)]',  icon: 'text-success', value: 'text-success', ring: 'ring-[rgba(16,185,129,0.18)]' },
  yellow: { bg: 'bg-[rgba(245,158,11,0.10)]',  icon: 'text-warning', value: 'text-warning', ring: 'ring-[rgba(245,158,11,0.18)]' },
  red:    { bg: 'bg-[rgba(220,38,38,0.10)]',    icon: 'text-danger', value: 'text-danger', ring: 'ring-[rgba(220,38,38,0.18)]' },
  purple: { bg: 'bg-[rgba(37,99,235,0.10)]',    icon: 'text-primary', value: 'text-primary', ring: 'ring-[rgba(37,99,235,0.18)]' },
  indigo: { bg: 'bg-[rgba(37,99,235,0.10)]',    icon: 'text-primary', value: 'text-primary', ring: 'ring-[rgba(37,99,235,0.18)]' },
};

function AnimatedValue({ value }: { value: number | string }) {
  const isNumeric = typeof value === 'number' && Number.isFinite(value);
  const [displayValue, setDisplayValue] = useState<string | number>(isNumeric ? 0 : String(value));

  useEffect(() => {
    if (!isNumeric) {
      setDisplayValue(String(value));
      return;
    }

    let frame = 0;
    let start = 0;
    const duration = 720;

    const step = (time: number) => {
      if (!start) start = time;
      const progress = Math.min((time - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round((value as number) * eased);
      setDisplayValue(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [isNumeric, value]);

  return <>{isNumeric ? Number(displayValue).toLocaleString() : displayValue}</>;
}

const MotionCard = motion.div;

export function StatCard({
  label, value, icon: Icon, color = 'indigo', subLabel, onClick, className,
}: StatCardProps) {
  const c = colorMap[color];

  return (
    <MotionCard
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      whileHover={onClick ? { y: -2 } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={cn(
        'section-card p-5 transition-colors duration-150',
        onClick && 'cursor-pointer hover:bg-surface-muted',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={cn('mt-1.5 text-2xl font-semibold tracking-tight', c.value)}>
            <AnimatedValue value={value} />
          </p>
          {subLabel && <p className="mt-2 text-xs text-muted-foreground">{subLabel}</p>}
        </div>
        {Icon && (
          <div className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md',
            c.bg,
          )}>
            <Icon className={cn('h-5 w-5', c.icon)} />
          </div>
        )}
      </div>
    </MotionCard>
  );
}

/** 4-metric module card (Total / Done / Pending / Delayed) */
interface ModuleMetricCardProps {
  label: string;
  total: number;
  done: number;
  pending: number;
  delayed: number;
  icon?: LucideIcon;
  onMetricClick?: (metric: 'total' | 'done' | 'pending' | 'delayed') => void;
}

export function ModuleMetricCard({
  label, total, done, pending, delayed, icon: Icon, onMetricClick,
}: ModuleMetricCardProps) {
  const completion = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="section-card overflow-hidden">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
          {Icon ? (
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
          ) : (
            <div className="h-9 w-9 rounded-md bg-surface-muted" />
          )}
          <div>
            <span className="text-sm font-semibold tracking-tight text-foreground">{label}</span>
            <p className="text-xs text-muted-foreground">Track total flow, completion, and risk.</p>
          </div>
        </div>
        <span className="inline-flex items-center rounded bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          {completion}% complete
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { key: 'total' as const,   label: 'Total',   value: total,   color: 'text-foreground' },
          { key: 'done' as const,    label: 'Done',    value: done,    color: 'text-[#006c49]' },
          { key: 'pending' as const, label: 'Pending', value: pending, color: 'text-[#784b00]' },
          { key: 'delayed' as const, label: 'Delayed', value: delayed, color: 'text-[#ba1a1a]' },
        ].map(({ key, label: mLabel, value, color }) => (
          <div
            key={key}
            onClick={() => onMetricClick?.(key)}
            className={cn(
              'rounded-md border border-border bg-surface px-3 py-3 transition-colors duration-100',
              onMetricClick && 'cursor-pointer hover:bg-surface-muted',
            )}
          >
            <p className={cn('text-xl font-bold tracking-tight', color)}>{value}</p>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">{mLabel}</p>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Completion progress</span>
          <span>{completion}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>
    </div>
  );
}
