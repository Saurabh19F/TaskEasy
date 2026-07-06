'use client';

import { useState } from 'react';
import { CheckCircle, CreditCard, DollarSign } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { usePlatformBilling, usePlatformCompanies, usePlatformPlans } from '@/hooks/usePlatform';
import { platformBillingApi } from '@/lib/platform-api';
import { getPlatformApiError } from '@/lib/platform-axios';
import { formatDate, formatNumber } from '@/lib/utils';

const EMPTY_INVOICE = { tenantId: '', planId: '', totalAmount: '', dueDate: '' };

export default function PlatformBillingPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = usePlatformBilling();
  const { data: companies = [] } = usePlatformCompanies();
  const { data: plans = [] } = usePlatformPlans();
  const invoices = data?.invoices ?? [];
  const summary = data?.revenueSummary ?? {};
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_INVOICE);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.tenantId) {
      toast.error('Company is required');
      return;
    }
    setSaving(true);
    try {
      await platformBillingApi.invoices.create({
        ...form,
        totalAmount: Number(form.totalAmount) || 0,
      });
      toast.success('Invoice generated');
      setCreateOpen(false);
      setForm(EMPTY_INVOICE);
      qc.invalidateQueries({ queryKey: ['platform', 'billing'] });
    } catch (error) {
      toast.error(getPlatformApiError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlatformPageFrame
      title="Billing"
      description="Track invoices, failed payments, revenue, and renewal flows."
      actions={<Button leftIcon={<CreditCard className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Generate Invoice</Button>}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Revenue" value={`$${formatNumber(Number(summary.totalRevenue ?? 0))}`} icon={DollarSign} color="green" />
        <StatCard label="Paid Revenue" value={`$${formatNumber(Number(summary.paidRevenue ?? 0))}`} icon={CreditCard} color="blue" />
        <StatCard label="Pending Revenue" value={`$${formatNumber(Number(summary.pendingRevenue ?? 0))}`} icon={CreditCard} color="yellow" />
      </div>

      <div className="panel-strong p-5">
        <DataTable
          data={invoices}
          loading={isLoading}
          error={isError}
          onRetry={refetch}
          exportFilename="platform-invoices"
          rowKey={(row) => row.id}
          columns={[
            { key: 'invoiceNumber', header: 'Invoice', sortable: true },
            { key: 'tenantName', header: 'Company' },
            { key: 'planName', header: 'Plan' },
            { key: 'totalAmount', header: 'Amount', render: (value) => `$${formatNumber(Number(value ?? 0))}` },
            { key: 'paymentStatus', header: 'Status', render: (value) => <StatusBadge status={value} /> },
            { key: 'dueDate', header: 'Due Date', render: (value) => formatDate(value) },
            { key: 'nextBillingDate', header: 'Next Billing', render: (value) => formatDate(value) },
            {
              key: 'id',
              header: 'Actions',
              render: (_, row) => {
                const status = String(row.paymentStatus ?? '').toUpperCase();
                if (status === 'PAID' || status === 'COMPLETED') return <span className="text-xs text-muted-foreground">Paid</span>;
                return (
                  <Button
                    size="xs"
                    variant="outline"
                    leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
                    onClick={async () => {
                      try {
                        await platformBillingApi.invoices.updateStatus(row.id, { paymentStatus: 'PAID' });
                        toast.success('Invoice marked as paid');
                        qc.invalidateQueries({ queryKey: ['platform', 'billing'] });
                      } catch (error) {
                        toast.error(getPlatformApiError(error));
                      }
                    }}
                  >
                    Mark Paid
                  </Button>
                );
              },
            },
          ]}
        />
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Generate Invoice" size="lg" footer={
        <>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} loading={saving}>Generate Invoice</Button>
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
          <Input label="Amount" type="number" value={form.totalAmount} onChange={(e) => setForm((v) => ({ ...v, totalAmount: e.target.value }))} />
          <Input label="Due Date" type="date" value={form.dueDate} onChange={(e) => setForm((v) => ({ ...v, dueDate: e.target.value }))} />
        </div>
      </Modal>
    </PlatformPageFrame>
  );
}
