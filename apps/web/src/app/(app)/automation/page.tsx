'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Zap, Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete, getApiError } from '@/lib/axios';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';

// Must match AutomationTrigger in apps/api/src/modules/automation/dto/create-automation-rule.dto.ts —
// the backend's global ValidationPipe (forbidNonWhitelisted) 400s on anything outside this enum.
// All 9 now have a real triggerEvent() call site somewhere in the backend (delegation/work-request/
// checklist/fms services fire the per-action ones directly; escalation.processor.ts's 30-min
// check-sla cron fires the periodic-scan ones: SLA_BREACHED, USER_WORKLOAD_HIGH, PROJECT_HEALTH_LOW,
// APPROVAL_PENDING_TOO_LONG). `live` is kept as a field (rather than deleted) so a future trigger
// added to the enum without a call site yet can be flagged the same way this whole list used to be.
const TRIGGERS: { value: string; label: string; live: boolean }[] = [
  { value: 'TASK_OVERDUE', label: 'Task Overdue', live: true },
  { value: 'TASK_COMPLETED', label: 'Task Completed', live: true },
  { value: 'TASK_CREATED', label: 'Task Created', live: true },
  { value: 'CHECKLIST_MISSED', label: 'Checklist Missed', live: true },
  { value: 'FMS_STEP_COMPLETED', label: 'FMS Step Completed', live: true },
  { value: 'SLA_BREACHED', label: 'SLA Breached', live: true },
  { value: 'USER_WORKLOAD_HIGH', label: 'User Workload High', live: true },
  { value: 'PROJECT_HEALTH_LOW', label: 'Project Health Low', live: true },
  { value: 'APPROVAL_PENDING_TOO_LONG', label: 'Approval Pending Too Long', live: true },
];

// Must match AutomationAction in the same DTO. Only these four are actually implemented in
// AutomationProcessor (apps/api/src/queue/processors/automation.processor.ts) — the rest of the
// backend enum (ESCALATE, CREATE_TASK, CHANGE_STATUS, MARK_CRITICAL, ASSIGN_TO, ADD_COMMENT) is
// logged-only today, so they're intentionally left off this list until they're wired up.
const ACTIONS: { value: string; label: string }[] = [
  { value: 'NOTIFY_USER', label: 'Notify Assignee' },
  { value: 'NOTIFY_MANAGER', label: 'Notify Manager' },
  { value: 'NOTIFY_ADMIN', label: 'Notify Admin' },
  { value: 'SEND_EMAIL', label: 'Send Email' },
];

export default function AutomationPage() {
  const qc = useQueryClient();
  const [createModal, setCreateModal] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', trigger: TRIGGERS[0].value, action: ACTIONS[0].value,
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['automation'],
    queryFn: () => apiGet<any[]>('/automation'),
  });

  const createMutation = useMutation({
    mutationFn: () => apiPost('/automation', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automation'] }); setCreateModal(false); toast.success('Rule created'); },
    onError: (err) => toast.error(getApiError(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => apiPatch(`/automation/${id}/toggle`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation'] }),
    onError: (err) => toast.error(getApiError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/automation/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automation'] }); toast.success('Rule deleted'); },
    onError: (err) => toast.error(getApiError(err)),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-indigo-500" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Automation Rules</h1>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateModal(true)}>
          New Rule
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-20 text-slate-500">No automation rules yet.</div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule: any) => (
            <div
              key={rule.id}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-800 dark:text-slate-200">{rule.name}</p>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${rule.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {rule.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {rule.description && (
                  <p className="text-sm text-slate-500 mt-0.5 truncate">{rule.description}</p>
                )}
                <div className="flex gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>When: <strong className="text-slate-600 dark:text-slate-400">{rule.trigger}</strong></span>
                  <span>→</span>
                  <span>Then: <strong className="text-slate-600 dark:text-slate-400">{rule.action}</strong></span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleMutation.mutate(rule.id)}
                  className="text-slate-400 hover:text-indigo-500 transition-colors"
                  title={rule.isActive ? 'Disable' : 'Enable'}
                >
                  {rule.isActive
                    ? <ToggleRight className="h-5 w-5 text-indigo-500" />
                    : <ToggleLeft className="h-5 w-5" />
                  }
                </button>
                <button
                  onClick={() => deleteMutation.mutate(rule.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="New Automation Rule"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={!form.name.trim()}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Rule Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Select label="Trigger (When)" value={form.trigger} onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value }))}>
            {TRIGGERS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}{t.live ? '' : ' (not yet wired)'}</option>
            ))}
          </Select>
          <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
            Task Created, Task Completed, and FMS Step Completed fire instantly. Checklist Missed is
            checked hourly. Task Overdue, SLA Breached, User Workload High, Project Health Low, and
            Approval Pending Too Long are checked every 30 minutes and fire at most once per day per item.
          </p>
          <Select label="Action (Then)" value={form.action} onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}>
            {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </Select>
        </div>
      </Modal>
    </div>
  );
}
