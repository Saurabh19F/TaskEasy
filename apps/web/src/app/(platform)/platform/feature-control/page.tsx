'use client';

import { useState } from 'react';
import { ToggleLeft, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { usePlatformCompanies } from '@/hooks/usePlatform';
import { platformCompaniesApi } from '@/lib/platform-api';

const MODULES = [
  'Task Management',
  'Employee Management',
  'Attendance',
  'Office Timing',
  'Office Week',
  'Punch In / Punch Out',
  'Leave Management',
  'Payroll',
  'Asset Management',
  'Reports',
  'CRM',
  'AI Assistant',
  'File Upload',
  'Notifications',
  'Support Tickets',
  'Advanced Analytics',
];

function CompanyModuleRow({ company }: { company: any }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modules, setModules] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    MODULES.forEach((m) => { map[m] = false; });
    if (company.raw?.tenantFeatureFlags) {
      company.raw.tenantFeatureFlags.forEach((f: any) => { if (f.feature in map) map[f.feature] = Boolean(f.enabled); });
    }
    return map;
  });

  const enabledCount = Object.values(modules).filter(Boolean).length;

  const handleToggle = (module: string) => {
    setModules((prev) => ({ ...prev, [module]: !prev[module] }));
  };

  const handleToggleAll = (enabled: boolean) => {
    setModules((prev) => {
      const next = { ...prev };
      MODULES.forEach((m) => { next[m] = enabled; });
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await platformCompaniesApi.updateModules(company.id, modules);
      qc.invalidateQueries({ queryKey: ['platform', 'companies'] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200/10 bg-slate-950/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/30 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div>
            <span className="font-medium" style={{ color: 'rgb(var(--contrast))' }}>{company.companyName}</span>
            <span className="ml-3 text-sm" style={{ color: 'rgb(var(--contrast) / 0.65)' }}>{company.plan}</span>
          </div>
          <StatusBadge status={company.status} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: 'rgb(var(--contrast) / 0.65)' }}>{enabledCount}/{MODULES.length} enabled</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-contrast-65" /> : <ChevronDown className="h-4 w-4 text-contrast-65" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-200/10 px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <button onClick={() => handleToggleAll(true)} className="text-xs text-blue-400 hover:text-blue-300">Enable All</button>
              <span className="text-slate-600">|</span>
              <button onClick={() => handleToggleAll(false)} className="text-xs text-red-400 hover:text-red-300">Disable All</button>
            </div>
            <Button size="sm" onClick={handleSave} loading={saving} leftIcon={<Save className="h-3.5 w-3.5" />}>
              Save Changes
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((module) => (
              <label
                key={module}
                className="flex items-center gap-3 rounded-lg border border-slate-200/10 px-3 py-2.5 cursor-pointer hover:bg-slate-800/30 transition-colors"
              >
                <div className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors"
                  style={{ backgroundColor: modules[module] ? 'rgb(34 197 94)' : 'rgb(71 85 105)' }}
                >
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                    style={{ transform: modules[module] ? 'translateX(18px)' : 'translateX(3px)' }}
                  />
                  <input
                    type="checkbox"
                    checked={modules[module]}
                    onChange={() => handleToggle(module)}
                    className="sr-only"
                  />
                </div>
                <span className="text-sm" style={{ color: 'rgb(var(--contrast) / 0.65)' }}>{module}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlatformFeatureControlPage() {
  const { data = [], isLoading } = usePlatformCompanies();

  return (
    <PlatformPageFrame
      title="Feature Control"
      description="Enable or disable modules per company and enforce plan-level access rules."
      actions={<ToggleLeft className="h-5 w-5 text-amber-300" />}
    >
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading companies...</div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No companies found.</div>
      ) : (
        <div className="space-y-3">
          {data.map((company: any) => (
            <CompanyModuleRow key={company.id} company={company} />
          ))}
        </div>
      )}
    </PlatformPageFrame>
  );
}
