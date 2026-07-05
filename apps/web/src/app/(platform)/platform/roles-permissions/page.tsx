'use client';

import { ShieldCheck } from 'lucide-react';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { usePlatformRoles } from '@/hooks/usePlatform';

export default function PlatformRolesPermissionsPage() {
  const { data = [], isLoading, isError, refetch } = usePlatformRoles();

  return (
    <PlatformPageFrame
      title="Roles & Permissions"
      description="Maintain platform roles, permission bundles, and security boundaries."
      actions={<ShieldCheck className="h-5 w-5 text-amber-300" />}
    >
      <div className="rounded-2xl border border-slate-200/10 bg-slate-950/70 p-5 shadow-xl">
        <DataTable
          data={data}
          loading={isLoading}
          error={isError}
          onRetry={refetch}
          searchable={false}
          exportFilename="platform-roles"
          rowKey={(row) => row.id}
          columns={[
            { key: 'name', header: 'Role', sortable: true },
            { key: 'description', header: 'Description', render: (value) => value ?? '—' },
            { key: 'permissions', header: 'Permissions', render: (value) => `${value?.length ?? 0}` },
            { key: 'isSystem', header: 'System', render: (value) => <Badge className={value ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-300'}>{String(Boolean(value))}</Badge> },
          ]}
        />
      </div>
    </PlatformPageFrame>
  );
}
