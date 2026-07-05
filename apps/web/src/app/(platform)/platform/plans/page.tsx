'use client';

import { useState } from 'react';
import { Layers3 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { usePlatformPlans } from '@/hooks/usePlatform';
import { platformPlansApi } from '@/lib/platform-api';
import { formatNumber } from '@/lib/utils';

const EMPTY_PLAN = { name: '', tier: 'STARTER', monthlyPrice: '', yearlyPrice: '', maxUsers: '', maxEmployees: '', maxTasks: '', storageLimitGb: '' };

export default function PlatformPlansPage() {
  const qc = useQueryClient();
  const { data = [], isLoading, isError, refetch } = usePlatformPlans();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_PLAN);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await platformPlansApi.create({
        ...form,
        monthlyPrice: Number(form.monthlyPrice) || 0,
        yearlyPrice: Number(form.yearlyPrice) || 0,
        maxUsers: Number(form.maxUsers) || 0,
        maxEmployees: Number(form.maxEmployees) || 0,
        maxTasks: Number(form.maxTasks) || 0,
        storageLimitGb: Number(form.storageLimitGb) || 0,
      });
      setCreateOpen(false);
      setForm(EMPTY_PLAN);
      qc.invalidateQueries({ queryKey: ['platform', 'plans'] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlatformPageFrame
      title="Plans"
      description="Create, edit, enable, and compare subscription plans across the platform."
      actions={<Button leftIcon={<Layers3 className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Create Plan</Button>}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Plans" value={data.length} icon={Layers3} color="indigo" />
        <StatCard label="Active Plans" value={data.filter((p) => p.isActive !== false).length} icon={Layers3} color="green" />
        <StatCard label="Custom Plans" value={data.filter((p) => String(p.tier).toUpperCase() === 'CUSTOM').length} icon={Layers3} color="purple" />
      </div>

      <div className="rounded-2xl border border-slate-200/10 bg-slate-950/70 p-5 shadow-xl">
        <DataTable
          data={data}
          loading={isLoading}
          error={isError}
          onRetry={refetch}
          exportFilename="platform-plans"
          rowKey={(row) => row.id}
          columns={[
            { key: 'name', header: 'Plan', sortable: true },
            { key: 'tier', header: 'Tier' },
            { key: 'price', header: 'Monthly', render: (value, row) => `$${formatNumber(Number(row.monthlyPrice ?? value ?? 0))}` },
            { key: 'yearlyPrice', header: 'Yearly', render: (value) => (value != null ? `$${formatNumber(Number(value))}` : '—') },
            { key: 'maxUsers', header: 'Users' },
            { key: 'maxEmployees', header: 'Employees', render: (value) => value ?? '—' },
            { key: 'maxTasks', header: 'Tasks', render: (value) => value ?? '—' },
            { key: 'storageLimitGb', header: 'Storage', render: (value) => (value != null ? `${value} GB` : '—') },
            { key: 'status', header: 'Status', render: (value, row) => <Badge className={row.isActive === false ? 'bg-slate-800 text-slate-300' : 'bg-emerald-500/10 text-emerald-300'}>{String(value ?? (row.isActive === false ? 'DISABLED' : 'ACTIVE'))}</Badge> },
          ]}
        />
      </div>
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Plan" size="lg" footer={
        <>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} loading={saving}>Create Plan</Button>
        </>
      }>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Plan Name" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
          <Select label="Tier" value={form.tier} onChange={(e) => setForm((v) => ({ ...v, tier: e.target.value }))}>
            <option value="STARTER">Starter</option>
            <option value="PRO">Pro</option>
            <option value="ENTERPRISE">Enterprise</option>
          </Select>
          <Input label="Monthly Price" type="number" value={form.monthlyPrice} onChange={(e) => setForm((v) => ({ ...v, monthlyPrice: e.target.value }))} />
          <Input label="Yearly Price" type="number" value={form.yearlyPrice} onChange={(e) => setForm((v) => ({ ...v, yearlyPrice: e.target.value }))} />
          <Input label="Max Users" type="number" value={form.maxUsers} onChange={(e) => setForm((v) => ({ ...v, maxUsers: e.target.value }))} />
          <Input label="Max Employees" type="number" value={form.maxEmployees} onChange={(e) => setForm((v) => ({ ...v, maxEmployees: e.target.value }))} />
          <Input label="Max Tasks" type="number" value={form.maxTasks} onChange={(e) => setForm((v) => ({ ...v, maxTasks: e.target.value }))} />
          <Input label="Storage (GB)" type="number" value={form.storageLimitGb} onChange={(e) => setForm((v) => ({ ...v, storageLimitGb: e.target.value }))} />
        </div>
      </Modal>
    </PlatformPageFrame>
  );
}
