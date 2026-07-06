'use client';

import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { usePlatformSecurityCenter } from '@/hooks/usePlatform';
import { platformSecurityApi } from '@/lib/platform-api';
import { getPlatformApiError } from '@/lib/platform-axios';
import { formatDate } from '@/lib/utils';

export default function PlatformSecurityCenterPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = usePlatformSecurityCenter();
  const events = data?.events ?? [];
  const unresolvedCount = events.filter((e) => !e.resolved).length;

  return (
    <PlatformPageFrame
      title="Security Center"
      description="Monitor failed logins, suspicious activity, device history, and policy settings."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Events" value={events.length} icon={ShieldAlert} color="indigo" />
        <StatCard label="Unresolved" value={unresolvedCount} icon={ShieldAlert} color="red" />
        <StatCard label="Resolved" value={events.length - unresolvedCount} icon={ShieldCheck} color="green" />
      </div>

      <div className="panel-strong p-5">
        <DataTable
          data={events}
          loading={isLoading}
          error={isError}
          onRetry={refetch}
          exportFilename="security-events"
          rowKey={(row) => row.id}
          columns={[
            { key: 'eventType', header: 'Event', sortable: true },
            { key: 'severity', header: 'Severity', render: (value) => <Badge>{value}</Badge> },
            { key: 'description', header: 'Description' },
            { key: 'ipAddress', header: 'IP', render: (value) => value ?? '—' },
            { key: 'resolved', header: 'Resolved', render: (value) => <Badge className={value ? 'bg-success/15 text-success-foreground' : 'bg-danger/15 text-danger'}>{value ? 'Yes' : 'No'}</Badge> },
            { key: 'createdAt', header: 'Created', render: (value) => formatDate(value) },
            {
              key: 'id',
              header: 'Actions',
              render: (_, row) =>
                !row.resolved ? (
                  <Button
                    size="xs"
                    variant="outline"
                    leftIcon={<ShieldCheck className="h-3.5 w-3.5" />}
                    onClick={async () => {
                      try {
                        await platformSecurityApi.resolveEvent(row.id);
                        toast.success('Event resolved');
                        qc.invalidateQueries({ queryKey: ['platform', 'security-center'] });
                      } catch (error) {
                        toast.error(getPlatformApiError(error));
                      }
                    }}
                  >
                    Resolve
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Resolved</span>
                ),
            },
          ]}
        />
      </div>
    </PlatformPageFrame>
  );
}
