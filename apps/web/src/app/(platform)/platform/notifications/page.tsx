'use client';

import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { usePlatformNotifications } from '@/hooks/usePlatform';
import { platformNotificationsApi } from '@/lib/platform-api';
import { formatDate } from '@/lib/utils';

const EMPTY_NOTIF = { title: '', message: '', audience: 'ALL', type: 'INFO', channel: 'IN_APP' };

export default function PlatformNotificationsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading, isError, refetch } = usePlatformNotifications();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_NOTIF);
  const [saving, setSaving] = useState(false);

  const handleSend = async () => {
    setSaving(true);
    try {
      await platformNotificationsApi.send(form);
      setCreateOpen(false);
      setForm(EMPTY_NOTIF);
      qc.invalidateQueries({ queryKey: ['platform', 'notifications'] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlatformPageFrame
      title="Notifications"
      description="Broadcast system updates, payment reminders, and security announcements."
      actions={<Button leftIcon={<BellRing className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Send Notification</Button>}
    >
      <div className="rounded-2xl border border-slate-200/10 bg-slate-950/70 p-5 shadow-xl">
        <DataTable
          data={data}
          loading={isLoading}
          error={isError}
          onRetry={refetch}
          exportFilename="platform-notifications"
          rowKey={(row) => row.id}
          columns={[
            { key: 'title', header: 'Title', sortable: true },
            { key: 'audience', header: 'Audience' },
            { key: 'type', header: 'Type' },
            { key: 'channel', header: 'Channel', render: (value) => <Badge className="bg-slate-800 text-slate-200">{value}</Badge> },
            { key: 'status', header: 'Status', render: (value) => <Badge className="bg-emerald-500/10 text-emerald-300">{value}</Badge> },
            { key: 'createdAt', header: 'Created', render: (value) => formatDate(value) },
          ]}
        />
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Send Notification" size="lg" footer={
        <>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleSend} loading={saving}>Send Notification</Button>
        </>
      }>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Title" value={form.title} onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))} />
          <Select label="Audience" value={form.audience} onChange={(e) => setForm((v) => ({ ...v, audience: e.target.value }))}>
            <option value="ALL">All Companies</option>
            <option value="ACTIVE">Active Companies</option>
            <option value="TRIAL">Trial Companies</option>
          </Select>
          <Select label="Type" value={form.type} onChange={(e) => setForm((v) => ({ ...v, type: e.target.value }))}>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="CRITICAL">Critical</option>
            <option value="MAINTENANCE">Maintenance</option>
          </Select>
          <Select label="Channel" value={form.channel} onChange={(e) => setForm((v) => ({ ...v, channel: e.target.value }))}>
            <option value="IN_APP">In-App</option>
            <option value="EMAIL">Email</option>
            <option value="BOTH">Both</option>
          </Select>
          <div className="md:col-span-2">
            <Textarea label="Message" value={form.message} onChange={(e) => setForm((v) => ({ ...v, message: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </PlatformPageFrame>
  );
}
