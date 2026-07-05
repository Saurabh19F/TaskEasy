'use client';

import { ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { usePlatformAuthStore } from '@/store/platform-auth.store';
import { platformCompaniesApi } from '@/lib/platform-api';

export function ImpersonationBanner() {
  const { impersonation, clearImpersonation } = usePlatformAuthStore();

  if (!impersonation) return null;

  const handleExit = async () => {
    try {
      await platformCompaniesApi.exitImpersonation(impersonation.sessionId);
    } finally {
      clearImpersonation();
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-warning/45 bg-gradient-to-r from-warning/50 to-success/25 px-4 py-2 text-warning-foreground">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-brand" />
        <div>
          <p className="text-sm font-medium">{impersonation.banner}</p>
          <p className="text-xs text-warning-foreground/80">
            Viewing {impersonation.companyName} as {impersonation.targetUser?.name ?? 'company admin'}
          </p>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={handleExit} leftIcon={<X className="h-4 w-4" />}>
        Exit Impersonation
      </Button>
    </div>
  );
}
