'use client';

import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { usePlatformSettings } from '@/hooks/usePlatform';
import { platformSettingsApi } from '@/lib/platform-api';
import { getPlatformApiError } from '@/lib/platform-axios';

export default function PlatformSystemSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = usePlatformSettings();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    'platform.name': '',
    'support.email': '',
    'platform.currency': '',
    'platform.timezone': '',
    'maintenance.mode': false,
    'platform.termsUrl': '',
    'platform.privacyUrl': '',
    'cloudinary.cloudName': '',
  });

  useEffect(() => {
    if (data) {
      setForm({
        'platform.name': String(data['platform.name'] ?? 'TaskEasy'),
        'support.email': String(data['support.email'] ?? 'support@taskeasy.com'),
        'platform.currency': String(data['platform.currency'] ?? 'USD'),
        'platform.timezone': String(data['platform.timezone'] ?? 'UTC'),
        'maintenance.mode': Boolean(data['maintenance.mode']),
        'platform.termsUrl': String(data['platform.termsUrl'] ?? ''),
        'platform.privacyUrl': String(data['platform.privacyUrl'] ?? ''),
        'cloudinary.cloudName': String(data['cloudinary.cloudName'] ?? ''),
      });
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await platformSettingsApi.update(form);
      toast.success('Settings saved');
      qc.invalidateQueries({ queryKey: ['platform', 'settings'] });
    } catch (error) {
      toast.error(getPlatformApiError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlatformPageFrame
      title="System Settings"
      description="Manage branding, maintenance mode, integrations, and platform defaults."
      actions={<Button leftIcon={<Settings className="h-4 w-4" />} onClick={handleSave} loading={saving}>Save Changes</Button>}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : isError ? (
        <div className="text-center py-12 text-red-600 dark:text-red-400">Failed to load settings. Please try again later.</div>
      ) : (
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel-strong p-5">
          <h2 className="text-sm font-semibold text-foreground">Branding</h2>
          <div className="mt-4 space-y-4">
            <Input label="Platform Name" value={form['platform.name']} onChange={(e) => setForm((v) => ({ ...v, 'platform.name': e.target.value }))} />
            <Input label="Support Email" value={form['support.email']} onChange={(e) => setForm((v) => ({ ...v, 'support.email': e.target.value }))} />
            <Input label="Default Currency" value={form['platform.currency']} onChange={(e) => setForm((v) => ({ ...v, 'platform.currency': e.target.value }))} />
            <Input label="Default Timezone" value={form['platform.timezone']} onChange={(e) => setForm((v) => ({ ...v, 'platform.timezone': e.target.value }))} />
          </div>
        </div>
        <div className="panel-strong p-5">
          <h2 className="text-sm font-semibold text-foreground">Integrations</h2>
          <div className="mt-4 space-y-4">
            <Select label="Maintenance Mode" value={form['maintenance.mode'] ? 'ON' : 'OFF'} onChange={(e) => setForm((v) => ({ ...v, 'maintenance.mode': e.target.value === 'ON' }))}>
              <option value="OFF">Off</option>
              <option value="ON">On</option>
            </Select>
            <Textarea label="Terms URL" value={form['platform.termsUrl']} onChange={(e) => setForm((v) => ({ ...v, 'platform.termsUrl': e.target.value }))} />
            <Textarea label="Privacy URL" value={form['platform.privacyUrl']} onChange={(e) => setForm((v) => ({ ...v, 'platform.privacyUrl': e.target.value }))} />
            <Input label="Cloudinary Cloud Name" value={form['cloudinary.cloudName']} onChange={(e) => setForm((v) => ({ ...v, 'cloudinary.cloudName': e.target.value }))} />
          </div>
        </div>
      </div>
      )}
    </PlatformPageFrame>
  );
}
