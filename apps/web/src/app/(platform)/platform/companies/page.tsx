'use client';

import { useMemo, useState } from 'react';
import { Building2, Copy, Plus, Shield, Slash, Trash2, WalletCards } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { DataTable } from '@/components/ui/DataTable';
import { StatCard } from '@/components/ui/StatCard';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { usePlatformCompanies, usePlatformPlans } from '@/hooks/usePlatform';
import { platformCompaniesApi } from '@/lib/platform-api';
import { getPlatformApiError } from '@/lib/platform-axios';
import { formatDate, formatNumber } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { usePlatformAuthStore } from '@/store/platform-auth.store';

export default function PlatformCompaniesPage() {
  const qc = useQueryClient();
  const { data: companies = [], isLoading, isError, refetch } = usePlatformCompanies();
  const { data: plans = [] } = usePlatformPlans();
  const [createOpen, setCreateOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string; companyName: string } | null>(null);
  const [resetCompanyId, setResetCompanyId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [deleteCompany, setDeleteCompany] = useState<{ id: string; companyName: string } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState({ name: '', ownerName: '', ownerEmail: '', ownerPassword: '', ownerPhone: '', industry: '', planId: '', dbUri: '', dbName: '' });
  const resetCreateForm = () => setForm({ name: '', ownerName: '', ownerEmail: '', ownerPassword: '', ownerPhone: '', industry: '', planId: '', dbUri: '', dbName: '' });

  const counts = useMemo(() => ({
    total: companies.length,
    active: companies.filter((c) => c.status === 'ACTIVE').length,
    trial: companies.filter((c) => c.status === 'TRIAL').length,
    suspended: companies.filter((c) => c.status === 'SUSPENDED').length,
  }), [companies]);

  const handleCreate = async () => {
    if (!form.ownerEmail.trim()) {
      toast.error('Owner email is required');
      return;
    }
    if (!form.ownerPassword.trim()) {
      toast.error('Company admin password is required');
      return;
    }

    setIsCreating(true);
    try {
      const result = await platformCompaniesApi.create(form);
      if (result?.generatedPassword && result?.adminUser?.email) {
        setCreatedCredentials({ email: result.adminUser.email, password: result.generatedPassword, companyName: result.companyName ?? form.name });
      }
      toast.success('Company created');
      setCreateOpen(false);
      resetCreateForm();
      qc.invalidateQueries({ queryKey: ['platform', 'companies'] });
      qc.invalidateQueries({ queryKey: ['platform', 'dashboard'] });
    } catch (error) {
      toast.error(getPlatformApiError(error));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <PlatformPageFrame
      title="Companies"
      description="Manage every tenant from one place: status, plan, modules, billing, impersonation, and audit."
      actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Add Company</Button>}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Companies" value={counts.total} icon={Building2} color="indigo" />
        <StatCard label="Active Companies" value={counts.active} icon={Shield} color="green" />
        <StatCard label="Trial Companies" value={counts.trial} icon={WalletCards} color="yellow" />
        <StatCard label="Suspended Companies" value={counts.suspended} icon={Slash} color="red" />
      </div>

      <div className="panel-strong p-5">
        <DataTable
          data={companies}
          loading={isLoading}
          error={isError}
          onRetry={refetch}
          exportFilename="platform-companies"
          rowKey={(row) => row.id}
          columns={[
            { key: 'companyName', header: 'Company', sortable: true, render: (value, row) => <Link className="font-medium text-primary hover:underline" href={`/platform/companies/${row.id}`}>{value}</Link> },
            { key: 'ownerName', header: 'Owner', render: (value) => value ?? '—' },
            { key: 'email', header: 'Email', render: (value) => value ?? '—' },
            { key: 'industry', header: 'Industry', render: (value) => value ?? '—' },
            { key: 'plan', header: 'Plan', render: (value) => <Badge>{value}</Badge> },
            { key: 'status', header: 'Status', render: (value) => <StatusBadge status={value} /> },
            { key: 'totalUsers', header: 'Users', render: (value) => formatNumber(Number(value ?? 0)) },
            { key: 'totalEmployees', header: 'Employees', render: (value) => formatNumber(Number(value ?? 0)) },
            { key: 'subscriptionEndDate', header: 'Subscription End', render: (value) => formatDate(value) },
          {
              key: 'id',
              header: 'Actions',
              render: (_, row) => (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/platform/companies/${row.id}`}
                    className="inline-flex items-center justify-center rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                  >
                    View
                  </Link>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const res = await platformCompaniesApi.impersonate(row.id, 'Support review');
                        usePlatformAuthStore.getState().setImpersonation({
                          sessionId: res.sessionId,
                          companyId: row.id,
                          companyName: row.companyName,
                          targetUser: res.targetUser,
                          banner: res.banner,
                          accessToken: res.accessToken,
                          refreshToken: res.refreshToken,
                        });
                        toast.success(`Now impersonating ${row.companyName}`);
                        qc.invalidateQueries({ queryKey: ['platform', 'company', row.id] });
                      } catch (error) {
                        toast.error(getPlatformApiError(error));
                      }
                    }}
                  >
                    Impersonate
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => setResetCompanyId(row.id)}>Reset Password</Button>
                  <Button
                    size="xs"
                    variant="danger"
                    leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setDeleteCompany({ id: row.id, companyName: row.companyName })}
                  >
                    Delete
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </div>

      <Modal open={createOpen} onClose={() => { setCreateOpen(false); resetCreateForm(); }} title="Add Company" size="lg" footer={
        <>
          <Button variant="outline" onClick={() => { setCreateOpen(false); resetCreateForm(); }}>Cancel</Button>
          <Button onClick={handleCreate} disabled={isCreating}>{isCreating ? 'Creating...' : 'Create Company'}</Button>
        </>
      }>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Company Name" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
          <Input label="Owner Name" value={form.ownerName} onChange={(e) => setForm((v) => ({ ...v, ownerName: e.target.value }))} />
          <Input label="Owner Email" value={form.ownerEmail} onChange={(e) => setForm((v) => ({ ...v, ownerEmail: e.target.value }))} />
          <Input
            label="Owner Password"
            type="password"
            autoComplete="new-password"
            value={form.ownerPassword}
            helperText="This becomes the primary company admin login password."
            onChange={(e) => setForm((v) => ({ ...v, ownerPassword: e.target.value }))}
          />
          <Input label="Owner Phone" value={form.ownerPhone} onChange={(e) => setForm((v) => ({ ...v, ownerPhone: e.target.value }))} />
          <Input label="Industry" value={form.industry} onChange={(e) => setForm((v) => ({ ...v, industry: e.target.value }))} />
          <Select label="Plan" value={form.planId} onChange={(e) => setForm((v) => ({ ...v, planId: e.target.value }))}>
            <option value="">Select plan</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
          </Select>
          <Input label="MongoDB URI" placeholder="mongodb+srv://user:pass@cluster.mongodb.net" value={form.dbUri} onChange={(e) => setForm((v) => ({ ...v, dbUri: e.target.value }))} />
          <Input label="Database Name" placeholder="company_db_name" value={form.dbName} onChange={(e) => setForm((v) => ({ ...v, dbName: e.target.value }))} />
        </div>
      </Modal>

      <ConfirmModal
        open={!!resetCompanyId}
        onClose={() => setResetCompanyId(null)}
        title="Reset Company Admin Password"
        description="This will generate a temporary password for the primary company admin account."
        confirmLabel="Reset Password"
        onConfirm={async () => {
          if (!resetCompanyId) return;
          try {
            const result = await platformCompaniesApi.resetAdminPassword(resetCompanyId);
            setResetResult({ email: companies.find((c) => c.id === resetCompanyId)?.email ?? 'admin', tempPassword: result.tempPassword });
            toast.success('Password reset successfully');
          } catch (error) {
            toast.error(getPlatformApiError(error));
          }
          setResetCompanyId(null);
          qc.invalidateQueries({ queryKey: ['platform', 'companies'] });
        }}
      />

      <Modal open={!!resetResult} onClose={() => setResetResult(null)} title="Password Reset Complete" size="md" footer={
        <Button onClick={() => setResetResult(null)}>Done</Button>
      }>
        {resetResult && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Share this temporary password with the company admin. They must change it on first login.</p>
            <div className="rounded-xl border border-border bg-surface-muted p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium text-foreground">{resetResult.email}</p>
                </div>
                <button onClick={() => navigator.clipboard.writeText(resetResult.email)} className="text-muted-foreground hover:text-foreground transition-colors" title="Copy email">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Temporary Password</p>
                  <p className="text-sm font-mono font-medium text-warning-foreground">{resetResult.tempPassword}</p>
                </div>
                <button onClick={() => navigator.clipboard.writeText(resetResult.tempPassword)} className="text-muted-foreground hover:text-foreground transition-colors" title="Copy password">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleteCompany}
        onClose={() => setDeleteCompany(null)}
        title="Delete Company"
        description={
          deleteCompany
            ? `This will permanently delete ${deleteCompany.companyName} and all tenant workflow data. This cannot be undone.`
            : 'This will permanently delete the company and all tenant workflow data. This cannot be undone.'
        }
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete Company'}
        variant="danger"
        loading={isDeleting}
        onConfirm={async () => {
          if (!deleteCompany) return;
          setIsDeleting(true);
          try {
            await platformCompaniesApi.remove(deleteCompany.id);
            toast.success('Company deleted');
            setDeleteCompany(null);
            qc.invalidateQueries({ queryKey: ['platform', 'companies'] });
            qc.invalidateQueries({ queryKey: ['platform', 'dashboard'] });
          } catch (error) {
            toast.error(getPlatformApiError(error));
          } finally {
            setIsDeleting(false);
          }
        }}
      />

      <Modal open={!!createdCredentials} onClose={() => setCreatedCredentials(null)} title="Company Created Successfully" size="md" footer={
        <Button onClick={() => setCreatedCredentials(null)}>Done</Button>
      }>
        {createdCredentials && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{createdCredentials.companyName}</strong> has been created. Share these login credentials with the company admin:
            </p>
            <div className="rounded-xl border border-border bg-surface-muted p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium text-foreground">{createdCredentials.email}</p>
                </div>
                <button onClick={() => navigator.clipboard.writeText(createdCredentials.email)} className="text-muted-foreground hover:text-foreground transition-colors" title="Copy email">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Password</p>
                  <p className="text-sm font-mono font-medium text-warning-foreground">{createdCredentials.password}</p>
                </div>
                <button onClick={() => navigator.clipboard.writeText(createdCredentials.password)} className="text-muted-foreground hover:text-foreground transition-colors" title="Copy password">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="text-xs text-warning-foreground">
              Save these credentials now. The password cannot be retrieved later.
            </p>
          </div>
        )}
      </Modal>
    </PlatformPageFrame>
  );
}
