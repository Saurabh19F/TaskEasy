'use client';

import { ShieldAlert } from 'lucide-react';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { usePlatformSecurityCenter } from '@/hooks/usePlatform';
import { formatDate } from '@/lib/utils';

export default function PlatformSecurityCenterPage() {
  const { data, isLoading, isError, refetch } = usePlatformSecurityCenter();
  const events = data?.events ?? [];

  return (
    <PlatformPageFrame
      title="Security Center"
      description="Monitor failed logins, suspicious activity, device history, and policy settings."
      actions={<ShieldAlert className="h-5 w-5 text-amber-300" />}
    >
      <div className="rounded-2xl border border-slate-200/10 bg-slate-950/70 p-5 shadow-xl">
        <DataTable
          data={events}
          loading={isLoading}
          error={isError}
          onRetry={refetch}
          exportFilename="security-events"
          rowKey={(row) => row.id}
          columns={[
            { key: 'eventType', header: 'Event', sortable: true },
            { key: 'severity', header: 'Severity', render: (value) => <Badge className="bg-slate-800 text-slate-200">{value}</Badge> },
            { key: 'description', header: 'Description' },
            { key: 'ipAddress', header: 'IP', render: (value) => value ?? '—' },
            { key: 'resolved', header: 'Resolved', render: (value) => String(Boolean(value)) },
            { key: 'createdAt', header: 'Created', render: (value) => formatDate(value) },
          ]}
        />
      </div>
    </PlatformPageFrame>
  );
}
