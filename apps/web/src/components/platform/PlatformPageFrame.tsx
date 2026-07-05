import type { ReactNode } from 'react';

interface PlatformPageFrameProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PlatformPageFrame({ title, description, actions, children }: PlatformPageFrameProps) {
  return (
    <div className="space-y-6">
      <div className="page-hero">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-label">Platform Control</p>
            <h1 className="page-title mt-1">{title}</h1>
            {description && <p className="page-subtitle">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}
