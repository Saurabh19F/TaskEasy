import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-primary text-contrast shadow-[0_12px_28px_-16px_rgba(37,99,235,0.55)] ' +
    'hover:bg-primary/90 hover:shadow-[0_14px_32px_-16px_rgba(37,99,235,0.60)] ' +
    'focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ' +
    'active:translate-y-px',

  secondary:
    'bg-surface text-foreground border border-border shadow-sm ' +
    'hover:border-primary/25 hover:bg-surface-muted ' +
    'focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background',

  ghost:
    'bg-transparent text-foreground ' +
    'hover:bg-surface-muted ' +
    'focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background',

  outline:
    'bg-transparent text-foreground border border-border ' +
    'hover:border-primary/25 hover:bg-surface-muted ' +
    'focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background',

  danger:
    'bg-danger text-contrast shadow-[0_12px_28px_-16px_rgba(220,38,38,0.45)] ' +
    'hover:bg-danger/90 ' +
    'focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-background ' +
    'active:translate-y-px',

  destructive:
    'bg-danger text-contrast shadow-[0_12px_28px_-16px_rgba(220,38,38,0.45)] ' +
    'hover:bg-danger/90 ' +
    'focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-background ' +
    'active:translate-y-px',

  success:
    'bg-success text-contrast shadow-[0_12px_28px_-16px_rgba(16,185,129,0.45)] ' +
    'hover:bg-success/90 ' +
    'focus:ring-2 focus:ring-success focus:ring-offset-2 focus:ring-offset-background',

  warning:
    'bg-warning text-contrast shadow-[0_12px_28px_-16px_rgba(245,158,11,0.42)] ' +
    'hover:bg-warning/90 ' +
    'focus:ring-2 focus:ring-warning focus:ring-offset-2 focus:ring-offset-background',

  info:
    'bg-brand text-contrast shadow-[0_12px_28px_-16px_rgba(15,23,42,0.35)] ' +
    'hover:bg-brand/90 ' +
    'focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background',
};

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  xs: 'h-7 px-2.5 text-xs rounded-lg',
  sm: 'h-8 px-3 text-xs rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-11 px-5 text-sm rounded-xl',
};

const MotionButton = motion.button as any;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      leftIcon,
      rightIcon,
      className,
      disabled,
      children,
      ...props
    },
    ref,
  ) => (
    <MotionButton
      ref={ref}
      disabled={disabled || loading}
      /* Snappy 150ms per Kinetic spec — no bouncy spring */
      whileTap={disabled || loading ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.10, ease: 'easeOut' }}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-150',
        'focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (leftIcon ?? icon)}
      {children}
      {!loading && rightIcon}
    </MotionButton>
  ),
);

Button.displayName = 'Button';
