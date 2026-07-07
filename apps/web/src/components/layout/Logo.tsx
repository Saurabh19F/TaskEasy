'use client';

import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: { icon: 'h-7 w-7', text: 'text-[15px]', tag: 'text-[7px]' },
  md: { icon: 'h-9 w-9', text: 'text-xl', tag: 'text-[8px]' },
  lg: { icon: 'h-14 w-14', text: 'text-3xl', tag: 'text-xs' },
};

export function Logo({ className, iconOnly = false, size = 'md' }: LogoProps) {
  const s = sizes[size];
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoIcon className={cn('flex-shrink-0', s.icon)} />
      {!iconOnly && (
        <div className="min-w-0">
          <span className={cn('block font-bold tracking-tight text-primary', s.text)}>
            Task<span className="text-primary/80">Easy</span>
          </span>
        </div>
      )}
    </div>
  );
}

export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 56 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="20" y="2" width="16" height="8" rx="2" stroke="currentColor" strokeWidth="2.5" className="text-primary" />
      <rect x="10" y="6" width="36" height="48" rx="4" stroke="currentColor" strokeWidth="2.5" className="text-primary" />
      <rect x="17" y="16" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2" className="text-primary" />
      <polyline points="18.5,19.5 20,21 23,17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
      <line x1="27" y1="19" x2="40" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary/50" />
      <rect x="17" y="27" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2" className="text-primary" />
      <polyline points="18.5,30.5 20,32 23,28.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
      <line x1="27" y1="30" x2="40" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary/50" />
      <rect x="17" y="38" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2" className="text-primary" />
      <polyline points="18.5,41.5 20,43 23,39.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
      <line x1="27" y1="41" x2="40" y2="41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary/50" />
    </svg>
  );
}
