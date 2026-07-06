'use client';

import { useState } from 'react';
import { Edit2, Layers3, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { usePlatformPlans } from '@/hooks/usePlatform';
import { platformPlansApi } from '@/lib/platform-api';
import { getPlatformApiError } from '@/lib/platform-axios';
import { formatNumber } from '@/lib/utils';

const EMPTY_PLAN = { name: '', tier: 'STARTER', monthlyPrice: '', yearlyPrice: '', maxUsers: '', maxEmployees: '', maxTasks: '', storageLimitGb: '' };

export default function PlatformPlansPage() {
  const qc = useQueryClient();
  const { data = [], isLoading, isError, refetch } = usePlatformPlans();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<any>(null);
  const [deletePlan, setDeletePlan] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState(EMPTY_PLAN);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Plan name is required');
      return;
    }
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
      toast.success('Plan created');
      setCreateOpen(false);
      setForm(EMPTY_PLAN);
      qc.invalidateQueries({ queryKey: ['platform', 'plans'] });
    } catch (error) {
      toast.error(getPlatformApiError(error));
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

      <div className="panel-strong p-5">
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
            { key: 'status', header: 'Status', render: (value, row) => <Badge className={row.isActive === false ? undefined : 'bg-success/15 text-success-foreground'}>{String(value ?? (row.isActive === false ? 'DISABLED' : 'ACTIVE'))}</Badge> },
            {
              key: 'id',
              header: 'Actions',
              render: (_, row) => (
                <div className="flex gap-2">
                  <Button size="xs" variant="outline" leftIcon={<Edit2 className="h-3.5 w-3.5" />} onClick={() => {
                    setEditPlan(row);
                    setForm({
                      name: row.name ?? '',
                      tier: row.tier ?? 'STARTER',
                      monthlyPrice: String(row.monthlyPrice ?? row.price ?? ''),
                      yearlyPrice: String(row.yearlyPrice ?? ''),
                      maxUsers: String(row.maxUsers ?? ''),
                      maxEmployees: String(row.maxEmployees ?? ''),
                      maxTasks: String(row.maxTasks ?? ''),
                      storageLimitGb: String(row.storageLimitGb ?? ''),
                    });
                  }}>Edit</Button>
                  <Button size="xs" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeletePlan({ id: row.id, name: row.name })}>Delete</Button>
                </div>
              ),
            },
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
            <option value="CUSTOM">Custom</option>
          </Select>
          <Input label="Monthly Price" type="number" value={form.monthlyPrice} onChange={(e) => setForm((v) => ({ ...v, monthlyPrice: e.target.value }))} />
          <Input label="Yearly Price" type="number" value={form.yearlyPrice} onChange={(e) => setForm((v) => ({ ...v, yearlyPrice: e.target.value }))} />
          <Input label="Max Users" type="number" value={form.maxUsers} onChange={(e) => setForm((v) => ({ ...v, maxUsers: e.target.value }))} />
          <Input label="Max Employees" type="number" value={form.maxEmployees} onChange={(e) => setForm((v) => ({ ...v, maxEmployees: e.target.value }))} />
          <Input label="Max Tasks" type="number" value={form.maxTasks} onChange={(e) => setForm((v) => ({ ...v, maxTasks: e.target.value }))} />
          <Input label="Storage (GB)" type="number" value={form.storageLimitGb} onChange={(e) => setForm((v) => ({ ...v, storageLimitGb: e.target.value }))} />
        </div>
      </Modal>
      <Modal open={!!editPlan} onClose={() => { setEditPlan(null); setForm(EMPTY_PLAN); }} title="Edit Plan" size="lg" footer={
        <>
          <Button variant="outline" onClick={() => { setEditPlan(null); setForm(EMPTY_PLAN); }}>Cancel</Button>
          <Button onClick={async () => {
            setSaving(true);
            try {
              await platformPlansApi.update(editPlan.id, {
                ...form,
                monthlyPrice: Number(form.monthlyPrice) || 0,
                yearlyPrice: Number(form.yearlyPrice) || 0,
                maxUsers: Number(form.maxUsers) || 0,
                maxEmployees: Number(form.maxEmployees) || 0,
                maxTasks: Number(form.maxTasks) || 0,
                storageLimitGb: Number(form.storageLimitGb) || 0,
              });
              toast.success('Plan updated');
              setEditPlan(null);
              setForm(EMPTY_PLAN);
              qc.invalidateQueries({ queryKey: ['platform', 'plans'] });
            } catch (error) {
              toast.error(getPlatformApiError(error));
            } finally {
              setSaving(false);
            }
          }} loading={saving}>Save Changes</Button>
        </>
      }>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Plan Name" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
          <Select label="Tier" value={form.tier} onChange={(e) => setForm((v) => ({ ...v, tier: e.target.value }))}>
            <option value="STARTER">Starter</option>
            <option value="PRO">Pro</option>
            <option value="ENTERPRISE">Enterprise</option>
            <option value="CUSTOM">Custom</option>
          </Select>
          <Input label="Monthly Price" type="number" value={form.monthlyPrice} onChange={(e) => setForm((v) => ({ ...v, monthlyPrice: e.target.value }))} />
          <Input label="Yearly Price" type="number" value={form.yearlyPrice} onChange={(e) => setForm((v) => ({ ...v, yearlyPrice: e.target.value }))} />
          <Input label="Max Users" type="number" value={form.maxUsers} onChange={(e) => setForm((v) => ({ ...v, maxUsers: e.target.value }))} />
          <Input label="Max Employees" type="number" value={form.maxEmployees} onChange={(e) => setForm((v) => ({ ...v, maxEmployees: e.target.value }))} />
          <Input label="Max Tasks" type="number" value={form.maxTasks} onChange={(e) => setForm((v) => ({ ...v, maxTasks: e.target.value }))} />
          <Input label="Storage (GB)" type="number" value={form.storageLimitGb} onChange={(e) => setForm((v) => ({ ...v, storageLimitGb: e.target.value }))} />
        </div>
      </Modal>

      <ConfirmModal
        open={!!deletePlan}
        onClose={() => setDeletePlan(null)}
        title="Delete Plan"
        description={deletePlan ? `Are you sure you want to delete the "${deletePlan.name}" plan? Companies on this plan will need to be migrated.` : ''}
        confirmLabel="Delete Plan"
        variant="danger"
        onConfirm={async () => {
          if (!deletePlan) return;
          try {
            await platformPlansApi.remove(deletePlan.id);
            toast.success('Plan deleted');
            setDeletePlan(null);
            qc.invalidateQueries({ queryKey: ['platform', 'plans'] });
          } catch (error) {
            toast.error(getPlatformApiError(error));
          }
        }}
      />
    </PlatformPageFrame>
  );
}
