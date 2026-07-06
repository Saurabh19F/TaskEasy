'use client';

import { useState } from 'react';
import { DatabaseZap } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Input';
import { usePlatformBackups } from '@/hooks/usePlatform';
import { platformBackupsApi } from '@/lib/platform-api';
import { getPlatformApiError } from '@/lib/platform-axios';
import { formatDate } from '@/lib/utils';

const EMPTY_BACKUP = { scope: 'FULL', frequency: 'ONE_TIME' };

export default function PlatformBackupsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading, isError, refetch } = usePlatformBackups();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_BACKUP);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await platformBackupsApi.create(form);
      toast.success('Backup job created');
      setCreateOpen(false);
      setForm(EMPTY_BACKUP);
      qc.invalidateQueries({ queryKey: ['platform', 'backups'] });
    } catch (error) {
      toast.error(getPlatformApiError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlatformPageFrame
      title="Backups"
      description="Schedule and review full platform or company-wise backups."
      actions={<Button leftIcon={<DatabaseZap className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Create Backup</Button>}
    >
      <div className="panel-strong p-5">
        <DataTable
          data={data}
          loading={isLoading}
          error={isError}
          onRetry={refetch}
          exportFilename="platform-backups"
          rowKey={(row) => row.id}
          columns={[
            { key: 'scope', header: 'Scope' },
            { key: 'frequency', header: 'Frequency' },
            { key: 'status', header: 'Status', render: (value) => <Badge>{value}</Badge> },
            { key: 'storageUrl', header: 'Storage URL', render: (value) => value ?? '—' },
            { key: 'createdAt', header: 'Created', render: (value) => formatDate(value) },
          ]}
        />
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Backup" size="sm" footer={
        <>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} loading={saving}>Create Backup</Button>
        </>
      }>
        <div className="space-y-4">
          <Select label="Scope" value={form.scope} onChange={(e) => setForm((v) => ({ ...v, scope: e.target.value }))}>
            <option value="FULL">Full Platform</option>
            <option value="DATABASE">Database Only</option>
            <option value="FILES">Files Only</option>
          </Select>
          <Select label="Frequency" value={form.frequency} onChange={(e) => setForm((v) => ({ ...v, frequency: e.target.value }))}>
            <option value="ONE_TIME">One-Time</option>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </Select>
        </div>
      </Modal>
    </PlatformPageFrame>
  );
}
