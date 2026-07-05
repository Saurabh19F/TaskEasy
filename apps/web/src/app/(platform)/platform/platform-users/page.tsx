'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Users2 } from 'lucide-react';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { usePlatformUsers } from '@/hooks/usePlatform';
import { platformUsersApi } from '@/lib/platform-api';
import { formatDate } from '@/lib/utils';

export default function PlatformUsersPage() {
  const qc = useQueryClient();
  const { data = [], isLoading, isError, refetch } = usePlatformUsers();

  return (
    <PlatformPageFrame
      title="Platform Users"
      description="Create and manage SaaS operator accounts, roles, and permissions."
      actions={<Button leftIcon={<Users2 className="h-4 w-4" />}>Create User</Button>}
    >
      <div className="rounded-2xl border border-slate-200/10 bg-slate-950/70 p-5 shadow-xl">
        <DataTable
          data={data}
          loading={isLoading}
          error={isError}
          onRetry={refetch}
          exportFilename="platform-users"
          rowKey={(row) => row.id}
          columns={[
            { key: 'name', header: 'Name', sortable: true },
            { key: 'email', header: 'Email' },
            { key: 'role', header: 'Role', render: (value) => <Badge className="bg-slate-800 text-slate-200">{value}</Badge> },
            { key: 'status', header: 'Status', render: (value) => <Badge className="bg-emerald-500/10 text-emerald-300">{value}</Badge> },
            { key: 'lastLoginAt', header: 'Last Login', render: (value) => formatDate(value) },
            {
              key: 'id',
              header: 'Actions',
              render: (_, row) => (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={async () => {
                    const result = await platformUsersApi.resetPassword(row.id);
                    window.alert(`Temporary password for ${row.email}: ${result.tempPassword}`);
                    qc.invalidateQueries({ queryKey: ['platform', 'users'] });
                  }}
                >
                  Reset Password
                </Button>
              ),
            },
          ]}
        />
      </div>
    </PlatformPageFrame>
  );
}
