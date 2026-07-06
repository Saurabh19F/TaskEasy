'use client';

import { useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { usePlatformTickets, usePlatformCompanies } from '@/hooks/usePlatform';
import { platformSupportApi } from '@/lib/platform-api';
import { getPlatformApiError } from '@/lib/platform-axios';
import { formatDate } from '@/lib/utils';

const EMPTY_TICKET = { tenantId: '', subject: '', description: '', category: 'GENERAL', priority: 'MEDIUM' };

export default function PlatformSupportTicketsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = usePlatformTickets();
  const { data: companies = [] } = usePlatformCompanies();
  const tickets = data?.tickets ?? [];
  const stats = data?.stats ?? {};
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_TICKET);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.subject.trim()) {
      toast.error('Subject is required');
      return;
    }
    setSaving(true);
    try {
      await platformSupportApi.tickets.create(form);
      toast.success('Ticket created');
      setCreateOpen(false);
      setForm(EMPTY_TICKET);
      qc.invalidateQueries({ queryKey: ['platform', 'tickets'] });
    } catch (error) {
      toast.error(getPlatformApiError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlatformPageFrame
      title="Support Tickets"
      description="Centralized support queue for all companies."
      actions={<Button leftIcon={<LifeBuoy className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Create Ticket</Button>}
    >
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard label="Open" value={stats.open ?? 0} icon={LifeBuoy} color="red" />
        <StatCard label="In Progress" value={stats.inProgress ?? 0} icon={LifeBuoy} color="yellow" />
        <StatCard label="Waiting" value={stats.waiting ?? 0} icon={LifeBuoy} color="blue" />
        <StatCard label="Resolved" value={stats.resolved ?? 0} icon={LifeBuoy} color="green" />
        <StatCard label="Closed" value={stats.closed ?? 0} icon={LifeBuoy} color="indigo" />
      </div>

      <div className="panel-strong p-5">
        <DataTable
          data={tickets}
          loading={isLoading}
          error={isError}
          onRetry={refetch}
          exportFilename="support-tickets"
          rowKey={(row) => row.id}
          columns={[
            { key: 'ticketId', header: 'Ticket' },
            { key: 'tenantName', header: 'Company' },
            { key: 'subject', header: 'Subject', sortable: true },
            { key: 'category', header: 'Category' },
            { key: 'priority', header: 'Priority', render: (value) => <StatusBadge status={value} /> },
            { key: 'status', header: 'Status', render: (value) => <StatusBadge status={value} /> },
            { key: 'updatedAt', header: 'Updated', render: (value) => formatDate(value) },
          ]}
        />
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Support Ticket" size="lg" footer={
        <>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} loading={saving}>Create Ticket</Button>
        </>
      }>
        <div className="grid gap-4 md:grid-cols-2">
          <Select label="Company" value={form.tenantId} onChange={(e) => setForm((v) => ({ ...v, tenantId: e.target.value }))}>
            <option value="">Select company</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </Select>
          <Select label="Priority" value={form.priority} onChange={(e) => setForm((v) => ({ ...v, priority: e.target.value }))}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </Select>
          <Select label="Category" value={form.category} onChange={(e) => setForm((v) => ({ ...v, category: e.target.value }))}>
            <option value="GENERAL">General</option>
            <option value="BILLING">Billing</option>
            <option value="TECHNICAL">Technical</option>
            <option value="ACCOUNT">Account</option>
          </Select>
          <Input label="Subject" value={form.subject} onChange={(e) => setForm((v) => ({ ...v, subject: e.target.value }))} />
          <div className="md:col-span-2">
            <Textarea label="Description" value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </PlatformPageFrame>
  );
}
