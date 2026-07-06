'use client';

import { useState } from 'react';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { usePlatformRoles } from '@/hooks/usePlatform';
import { platformRolesApi } from '@/lib/platform-api';
import { getPlatformApiError } from '@/lib/platform-axios';

const EMPTY_ROLE = { name: '', description: '', permissions: '' };

export default function PlatformRolesPermissionsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading, isError, refetch } = usePlatformRoles();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteRole, setDeleteRole] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState(EMPTY_ROLE);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Role name is required');
      return;
    }
    setSaving(true);
    try {
      const permissions = form.permissions.split(',').map((p) => p.trim()).filter(Boolean);
      await platformRolesApi.create({ name: form.name, description: form.description, permissions });
      toast.success('Role created');
      setCreateOpen(false);
      setForm(EMPTY_ROLE);
      qc.invalidateQueries({ queryKey: ['platform', 'roles'] });
    } catch (error) {
      toast.error(getPlatformApiError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlatformPageFrame
      title="Roles & Permissions"
      description="Maintain platform roles, permission bundles, and security boundaries."
      actions={<Button leftIcon={<ShieldCheck className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Create Role</Button>}
    >
      <div className="panel-strong p-5">
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
            { key: 'isSystem', header: 'System', render: (value) => <Badge className={value ? 'bg-success/15 text-success-foreground' : undefined}>{value ? 'Yes' : 'No'}</Badge> },
            {
              key: 'id',
              header: 'Actions',
              render: (_, row) =>
                row.isSystem ? (
                  <span className="text-xs text-muted-foreground">System role</span>
                ) : (
                  <Button
                    size="xs"
                    variant="danger"
                    leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setDeleteRole({ id: row.id, name: row.name })}
                  >
                    Delete
                  </Button>
                ),
            },
          ]}
        />
      </div>

      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setForm(EMPTY_ROLE); }} title="Create Role" size="lg" footer={
        <>
          <Button variant="outline" onClick={() => { setCreateOpen(false); setForm(EMPTY_ROLE); }}>Cancel</Button>
          <Button onClick={handleCreate} loading={saving}>Create Role</Button>
        </>
      }>
        <div className="space-y-4">
          <Input label="Role Name" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
          <Input label="Description" value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} />
          <Textarea
            label="Permissions (comma-separated, e.g. platform.companies.read, platform.billing.read)"
            value={form.permissions}
            onChange={(e) => setForm((v) => ({ ...v, permissions: e.target.value }))}
          />
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteRole}
        onClose={() => setDeleteRole(null)}
        title="Delete Role"
        description={deleteRole ? `Are you sure you want to delete the "${deleteRole.name}" role? Users with this role will lose access.` : ''}
        confirmLabel="Delete Role"
        variant="danger"
        onConfirm={async () => {
          if (!deleteRole) return;
          try {
            await platformRolesApi.remove(deleteRole.id);
            toast.success('Role deleted');
            setDeleteRole(null);
            qc.invalidateQueries({ queryKey: ['platform', 'roles'] });
          } catch (error) {
            toast.error(getPlatformApiError(error));
          }
        }}
      />
    </PlatformPageFrame>
  );
}
