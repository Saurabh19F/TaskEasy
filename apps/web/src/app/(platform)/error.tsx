'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[Platform Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/15">
        <AlertTriangle className="h-7 w-7 text-danger" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Something went wrong
        </h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          This platform page hit an unexpected error. You can try again, or head back to the
          platform dashboard.
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-muted-foreground">Reference: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => reset()}>
          Try Again
        </Button>
        <Button
          leftIcon={<Home className="h-4 w-4" />}
          onClick={() => (window.location.href = '/platform/dashboard')}
        >
          Back to Platform Dashboard
        </Button>
      </div>
    </div>
  );
}
