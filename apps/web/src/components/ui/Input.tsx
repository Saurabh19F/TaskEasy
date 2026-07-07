import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
}

const inputBase =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground ' +
  'placeholder:text-muted-foreground ' +
  'transition-colors duration-100 ' +
  'focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/10 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-surface-muted';

const inputError =
  'border-danger focus:border-danger focus:ring-danger/15';

const labelBase = 'text-sm font-medium text-foreground';

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftElement, rightElement, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className={labelBase}>
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftElement && <div className="pointer-events-none absolute left-3 text-muted-foreground">{leftElement}</div>}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              inputBase,
              leftElement && 'pl-10',
              rightElement && 'pr-10',
              error && inputError,
              className,
            )}
            {...props}
          />
          {rightElement && <div className="absolute right-3 text-muted-foreground">{rightElement}</div>}
        </div>
        {error && <p className="text-xs font-medium text-danger">{error}</p>}
        {!error && helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className={labelBase}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'min-h-[104px] resize-y',
            inputBase,
            error && inputError,
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs font-medium text-danger">{error}</p>}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className, id, children, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className={labelBase}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'h-10',
            inputBase,
            error && inputError,
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs font-medium text-danger">{error}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';
