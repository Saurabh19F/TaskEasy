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
      <div className="panel-strong p-5">
        <DataTable
          data={data}
          loading={isLoading}
          error={isError}
          onRetry={refetch}
          exportFilename="platform-audit-logs"
          rowKey={(row) => row.id}
          columns={[
            { key: 'action', header: 'Action', sortable: true },
            { key: 'actorRole', header: 'Role', render: (value) => <Badge>{value}</Badge> },
            { key: 'targetTenantId', header: 'Tenant', render: (value) => value ?? '—' },
            { key: 'ipAddress', header: 'IP', render: (value) => value ?? '—' },
            { key: 'createdAt', header: 'Time', render: (value) => formatDateTime(value) },
          ]}
        />
      </div>
    </PlatformPageFrame>
  );
}
