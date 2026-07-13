'use client';

import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { usePlatformNotifications } from '@/hooks/usePlatform';
import { platformNotificationsApi } from '@/lib/platform-api';
import { getPlatformApiError } from '@/lib/platform-axios';
import { formatDate } from '@/lib/utils';

const EMPTY_NOTIF = { title: '', message: '', audience: 'ALL', type: 'INFO', channel: 'IN_APP' };

export default function PlatformNotificationsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading, isError, refetch } = usePlatformNotifications();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_NOTIF);
  const [saving, setSaving] = useState(false);

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    setSaving(true);
    try {
      await platformNotificationsApi.send(form);
      toast.success('Notification sent');
      setCreateOpen(false);
      setForm(EMPTY_NOTIF);
      qc.invalidateQueries({ queryKey: ['platform', 'notifications'] });
    } catch (error) {
      toast.error(getPlatformApiError(error));
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
      <div className="panel-strong p-5">
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
            { key: 'channel', header: 'Channel', render: (value) => <Badge>{value}</Badge> },
            { key: 'status', header: 'Status', render: (value) => {
              const cls = value === 'SENT' || value === 'DELIVERED'
                ? 'bg-success/15 text-success-foreground'
                : value === 'FAILED'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : value === 'PENDING' || value === 'SCHEDULED'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
              return <Badge className={cls}>{value}</Badge>;
            } },
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
