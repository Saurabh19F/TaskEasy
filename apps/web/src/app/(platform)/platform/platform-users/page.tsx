'use client';

import { useState } from 'react';
import { Copy, Users2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { usePlatformUsers } from '@/hooks/usePlatform';
import { platformUsersApi } from '@/lib/platform-api';
import { getPlatformApiError } from '@/lib/platform-axios';
import { formatDate } from '@/lib/utils';

const EMPTY_USER = { name: '', email: '', password: '', role: 'SUPPORT_AGENT', phone: '' };

export default function PlatformUsersPage() {
  const qc = useQueryClient();
  const { data = [], isLoading, isError, refetch } = usePlatformUsers();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_USER);
  const [saving, setSaving] = useState(false);
  const [resetResult, setResetResult] = useState<{ email: string; tempPassword: string } | null>(null);

  const handleCreate = async () => {
    if (!form.email.trim() || !form.name.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setSaving(true);
    try {
      await platformUsersApi.create(form);
      toast.success('User created');
      setCreateOpen(false);
      setForm(EMPTY_USER);
      qc.invalidateQueries({ queryKey: ['platform', 'users'] });
    } catch (error) {
      toast.error(getPlatformApiError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlatformPageFrame
      title="Platform Users"
      description="Create and manage SaaS operator accounts, roles, and permissions."
      actions={<Button leftIcon={<Users2 className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Create User</Button>}
    >
      <div className="panel-strong p-5">
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
            { key: 'role', header: 'Role', render: (value) => <Badge>{value}</Badge> },
            { key: 'status', header: 'Status', render: (value) => <Badge className="bg-success/15 text-success-foreground">{value}</Badge> },
            { key: 'lastLoginAt', header: 'Last Login', render: (value) => formatDate(value) },
            {
              key: 'id',
              header: 'Actions',
              render: (_, row) => (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const result = await platformUsersApi.resetPassword(row.id);
                      setResetResult({ email: row.email, tempPassword: result.tempPassword });
                      toast.success('Password reset successfully');
                      qc.invalidateQueries({ queryKey: ['platform', 'users'] });
                    } catch (error) {
                      toast.error(getPlatformApiError(error));
                    }
                  }}
                >
                  Reset Password
                </Button>
              ),
            },
          ]}
        />
      </div>

      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setForm(EMPTY_USER); }} title="Create Platform User" size="lg" footer={
        <>
          <Button variant="outline" onClick={() => { setCreateOpen(false); setForm(EMPTY_USER); }}>Cancel</Button>
          <Button onClick={handleCreate} loading={saving}>Create User</Button>
        </>
      }>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Full Name" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} />
          <Input label="Password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))} />
          <Select label="Role" value={form.role} onChange={(e) => setForm((v) => ({ ...v, role: e.target.value }))}>
            <option value="PLATFORM_ADMIN">Platform Admin</option>
            <option value="SUPPORT_AGENT">Support Agent</option>
            <option value="BILLING_MANAGER">Billing Manager</option>
            <option value="SALES_MANAGER">Sales Manager</option>
            <option value="PLATFORM_AUDITOR">Platform Auditor</option>
          </Select>
        </div>
      </Modal>

      <Modal open={!!resetResult} onClose={() => setResetResult(null)} title="Password Reset Complete" size="md" footer={
        <Button onClick={() => setResetResult(null)}>Done</Button>
      }>
        {resetResult && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Share this temporary password with the user.</p>
            <div className="rounded-xl border border-border bg-surface-muted p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium text-foreground">{resetResult.email}</p>
                </div>
                <button onClick={() => navigator.clipboard.writeText(resetResult.email)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Temporary Password</p>
                  <p className="text-sm font-mono font-medium text-warning-foreground">{resetResult.tempPassword}</p>
                </div>
                <button onClick={() => navigator.clipboard.writeText(resetResult.tempPassword)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </PlatformPageFrame>
  );
}
