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
    'bg-primary text-contrast shadow-sm ' +
    'hover:bg-primary/90 ' +
    'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
    'active:translate-y-px',

  secondary:
    'bg-surface text-foreground border border-border shadow-sm ' +
    'hover:bg-surface-muted ' +
    'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',

  ghost:
    'bg-transparent text-foreground ' +
    'hover:bg-surface-muted ' +
    'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',

  outline:
    'bg-transparent text-foreground border border-border ' +
    'hover:bg-surface-muted ' +
    'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',

  danger:
    'bg-danger text-contrast shadow-sm ' +
    'hover:bg-danger/90 ' +
    'focus-visible:ring-2 focus-visible:ring-danger/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
    'active:translate-y-px',

  destructive:
    'bg-danger text-contrast shadow-sm ' +
    'hover:bg-danger/90 ' +
    'focus-visible:ring-2 focus-visible:ring-danger/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
    'active:translate-y-px',

  success:
    'bg-success text-contrast shadow-sm ' +
    'hover:bg-success/90 ' +
    'focus-visible:ring-2 focus-visible:ring-success/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',

  warning:
    'bg-warning text-contrast shadow-sm ' +
    'hover:bg-warning/90 ' +
    'focus-visible:ring-2 focus-visible:ring-warning/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',

  info:
    'bg-brand text-contrast shadow-sm ' +
    'hover:bg-brand/90 ' +
    'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
};

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  xs: 'h-7 px-2.5 text-xs rounded-md',
  sm: 'h-8 px-3 text-xs rounded-md',
  md: 'h-9 px-4 text-sm rounded-md',
  lg: 'h-10 px-5 text-sm rounded-md',
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
