'use client';

import { ScrollText } from 'lucide-react';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { usePlatformAuditLogs } from '@/hooks/usePlatform';
import { formatDateTime } from '@/lib/utils';

export default function PlatformAuditLogsPage() {
  const { data = [], isLoading, isError, refetch } = usePlatformAuditLogs();

  return (
    <PlatformPageFrame
      title="Audit Logs"
      description="Search sensitive platform actions, actors, targets, and metadata."
      actions={<ScrollText className="h-5 w-5 text-amber-300" />}
    >
      <div className="rounded-2xl border border-slate-200/10 bg-slate-950/70 p-5 shadow-xl">
        <DataTable
          data={data}
          loading={isLoading}
          error={isError}
          onRetry={refetch}
          exportFilename="platform-audit-logs"
          rowKey={(row) => row.id}
          columns={[
            { key: 'action', header: 'Action', sortable: true },
            { key: 'actorRole', header: 'Role', render: (value) => <Badge className="bg-slate-800 text-slate-200">{value}</Badge> },
            { key: 'targetTenantId', header: 'Tenant', render: (value) => value ?? '—' },
            { key: 'ipAddress', header: 'IP', render: (value) => value ?? '—' },
            { key: 'createdAt', header: 'Time', render: (value) => formatDateTime(value) },
          ]}
        />
      </div>
    </PlatformPageFrame>
  );
}
