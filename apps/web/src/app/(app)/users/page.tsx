'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Plus, UserX, UserCheck } from 'lucide-react';
import { useUsers, useCreateUser, useToggleUserStatus } from '@/hooks/useUsers';
import { UserFormModal, type UserFormValues } from '@/components/users/UserFormModal';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import { sanitizeUserFormValues } from '@/lib/user-form';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types';

const ALLOWED_ROLES = ['ADMIN', 'COMPANY_OWNER', 'SAAS_OWNER'];

export default function UsersPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = ['ADMIN', 'COMPANY_OWNER', 'SAAS_OWNER'].includes(user?.role ?? '');

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const { data, isLoading, isError, refetch } = useUsers();
  const { mutate: create, isPending: creating } = useCreateUser();
  const { mutate: updateStatus } = useToggleUserStatus();

  const [createModal, setCreateModal] = useState(false);
  const handleCreate = (form: UserFormValues) => {
    create(sanitizeUserFormValues(form) as any, {
      onSuccess: () => {
        setCreateModal(false);
      },
    });
  };

  const columns: Column<User>[] = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'email', header: 'Email', sortable: true },
    { key: 'employeeId', header: 'Employee ID', render: (v) => v ?? '—' },
    { key: 'department', header: 'Department', render: (v) => v ?? '—' },
    { key: 'role', header: 'Role', render: (v) => <span className="text-xs font-medium">{v}</span> },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'createdAt', header: 'Joined', sortable: true, render: (v) => formatDate(v) },
    ...(isAdmin
      ? [{
          key: 'id' as keyof User,
          header: 'Actions',
          render: (_: any, row: User) => (
            <Button
              size="xs"
              variant="outline"
              leftIcon={row.status === 'ACTIVE' ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
              onClick={() => updateStatus({ id: row.id, status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}
            >
              {row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            </Button>
          ),
        }]
      : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-indigo-500" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Users</h1>
        </div>
        {isAdmin && (
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateModal(true)}>
            Add User
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
        exportFilename="users"
        exportTitle="Users"
        rowKey={(r) => r.id}
        emptyMessage="No users found"
      />

      <UserFormModal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="Add User"
        submitLabel="Create"
        mode="create"
        loading={creating}
        onSubmit={handleCreate}
      />
    </div>
  );
}
