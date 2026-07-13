'use client';

import { useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { usePlatformSubscriptions, usePlatformPlans, usePlatformCompanies } from '@/hooks/usePlatform';
import { platformSubscriptionsApi } from '@/lib/platform-api';
import { getPlatformApiError } from '@/lib/platform-axios';
import { formatDate } from '@/lib/utils';

const EMPTY_SUB = { tenantId: '', planId: '', billingCycle: 'MONTHLY' };

export default function PlatformSubscriptionsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading, isError, refetch } = usePlatformSubscriptions();
  const { data: plans = [] } = usePlatformPlans();
  const { data: companies = [] } = usePlatformCompanies();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_SUB);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.tenantId || !form.planId) {
      toast.error('Company and plan are required');
      return;
    }
    setSaving(true);
    try {
      await platformSubscriptionsApi.create(form);
      toast.success('Subscription created');
      setCreateOpen(false);
      setForm(EMPTY_SUB);
      qc.invalidateQueries({ queryKey: ['platform', 'subscriptions'] });
    } catch (error) {
      toast.error(getPlatformApiError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlatformPageFrame
      title="Subscriptions"
      description="Manage trial periods, renewals, billing cycles, and plan changes."
      actions={<Button leftIcon={<ReceiptText className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Create Subscription</Button>}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Active" value={data.filter((s) => String(s.status) === 'ACTIVE').length} icon={ReceiptText} color="green" />
        <StatCard label="Trial" value={data.filter((s) => String(s.status) === 'TRIAL').length} icon={ReceiptText} color="yellow" />
        <StatCard label="Expired" value={data.filter((s) => String(s.status) === 'EXPIRED').length} icon={ReceiptText} color="red" />
      </div>

      <div className="panel-strong p-5">
        <DataTable
          data={data}
          loading={isLoading}
          error={isError}
          onRetry={refetch}
          exportFilename="platform-subscriptions"
          rowKey={(row) => row.id}
          columns={[
            { key: 'tenant', header: 'Company', render: (_value: any, row: any) => row.tenant?.name ?? row.tenantId },
            { key: 'plan', header: 'Plan', render: (value) => value?.name ?? '—' },
            { key: 'status', header: 'Status', render: (value) => <StatusBadge status={value} /> },
            { key: 'currentPeriodStart', header: 'Start', render: (value) => formatDate(value) },
            { key: 'currentPeriodEnd', header: 'End', render: (value) => formatDate(value) },
            { key: 'autoRenew', header: 'Auto Renew', render: (value) => String(Boolean(value)) },
          ]}
        />
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Subscription" size="lg" footer={
        <>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} loading={saving}>Create Subscription</Button>
        </>
      }>
        <div className="grid gap-4 md:grid-cols-2">
          <Select label="Company" value={form.tenantId} onChange={(e) => setForm((v) => ({ ...v, tenantId: e.target.value }))}>
            <option value="">Select company</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </Select>
          <Select label="Plan" value={form.planId} onChange={(e) => setForm((v) => ({ ...v, planId: e.target.value }))}>
            <option value="">Select plan</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select label="Billing Cycle" value={form.billingCycle} onChange={(e) => setForm((v) => ({ ...v, billingCycle: e.target.value }))}>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </Select>
        </div>
      </Modal>
    </PlatformPageFrame>
  );
}
