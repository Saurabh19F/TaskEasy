'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ChevronUp, ChevronDown, Settings2, CheckCircle2, Database, Route } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmsApi } from '@/lib/api';
import { getApiError } from '@/lib/axios';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useActiveUsers } from '@/hooks/useUsers';
import { FmsFlowMapModal, FlowMapStep } from './FmsFlowMapModal';

interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  editable: boolean;
}

interface BuilderStep {
  sequence: number;
  title: string;
  description: string;
  tatValue: number;
  tatUnit: 'hours' | 'days';
  role: string;
  actionType: string;
  assignedToId: string;
  formFields: FormField[];
}

function tatHours(step: BuilderStep): number {
  return step.tatUnit === 'days' ? step.tatValue * 24 : step.tatValue;
}

function defaultStep(seq: number): BuilderStep {
  return {
    sequence: seq,
    title: '',
    description: '',
    tatValue: 1,
    tatUnit: 'days',
    role: 'Employee',
    actionType: 'submit',
    assignedToId: '',
    formFields: [],
  };
}

interface ConfigureFormModalProps {
  step: BuilderStep;
  onClose: () => void;
  onSave: (fields: FormField[]) => void;
}

function ConfigureFormModal({ step, onClose, onSave }: ConfigureFormModalProps) {
  const [fields, setFields] = useState<FormField[]>(step.formFields);

  const updateField = (i: number, key: keyof FormField, val: any) =>
    setFields((f) => f.map((x, idx) => (idx === i ? { ...x, [key]: val } : x)));

  const addField = () =>
    setFields((f) => [
      ...f,
      { id: `field_${Date.now()}`, label: '', type: 'text', required: false, editable: true },
    ]);

  const removeField = (i: number) => setFields((f) => f.filter((_, idx) => idx !== i));

  return (
    <Modal open title={`Configure Form — Step ${step.sequence}: ${step.title || 'Untitled'}`} onClose={onClose} size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onSave(fields); onClose(); }}>Save Fields</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                {['Label', 'Type', 'Required', 'Status', ''].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {fields.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">No fields. Click Add Field below.</td></tr>
              )}
              {fields.map((f, i) => (
                <tr key={i}>
                  <td className="px-2 py-1.5">
                    <input
                      className="w-40 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={f.label}
                      onChange={(e) => updateField(i, 'label', e.target.value)}
                      placeholder="Field label"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      className="rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={f.type}
                      onChange={(e) => updateField(i, 'type', e.target.value)}
                    >
                      {['text', 'number', 'date', 'dropdown', 'boolean', 'file'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input type="checkbox" checked={f.required} onChange={(e) => updateField(i, 'required', e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      className="rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={f.editable ? 'editable' : 'readonly'}
                      onChange={(e) => updateField(i, 'editable', e.target.value === 'editable')}
                    >
                      <option value="editable">Editable</option>
                      <option value="readonly">Read-only</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <button onClick={() => removeField(i)} className="text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button size="sm" variant="outline" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={addField}>
          Add Field
        </Button>
      </div>
    </Modal>
  );
}

type SuccessMode = 'draft' | 'started' | null;

interface FmsBuilderModalProps {
  open: boolean;
  onClose: () => void;
  initialName?: string;
  initialSteps?: any[];
  sheetData?: { headers: string[]; rows: string[][] } | null;
}

export function FmsBuilderModal({ open, onClose, initialName = '', initialSteps = [], sheetData }: FmsBuilderModalProps) {
  const qc = useQueryClient();
  const { data: users = [] } = useActiveUsers();

  const [successMode, setSuccessMode] = useState<SuccessMode>(null);
  const [savedTaskCount, setSavedTaskCount] = useState(0);
  const [flowName, setFlowName] = useState(initialName);
  const [steps, setSteps] = useState<BuilderStep[]>(() => {
    if (initialSteps.length > 0) {
      return initialSteps.map((s: any, i: number) => {
        const formFields: FormField[] = Array.isArray(s.formSchema)
          ? s.formSchema.map((f: any, fi: number) => ({
              id: String(f.id || `field_${i}_${fi}`),
              label: String(f.label || ''),
              type: String(f.type || 'text'),
              required: Boolean(f.required),
              editable: true,
            }))
          : [];
        return {
          sequence: Number(s.sequence ?? s.stepNo ?? i + 1),
          title: String(s.title ?? ''),
          description: String(s.description ?? ''),
          tatValue: Number(s.tatHours ?? 24) >= 24 ? Math.round((s.tatHours ?? 24) / 24) : (s.tatHours ?? 1),
          tatUnit: (Number(s.tatHours ?? 24) >= 24 ? 'days' : 'hours') as 'days' | 'hours',
          role: String(s.role ?? s.assignedRole ?? 'Employee'),
          actionType: String(s.actionType ?? 'submit'),
          assignedToId: '',
          formFields,
        };
      });
    }
    return [defaultStep(1)];
  });

  const [configFormIdx, setConfigFormIdx] = useState<number | null>(null);
  const [showFlowMapPreview, setShowFlowMapPreview] = useState(false);

  const updateStep = useCallback((idx: number, key: keyof BuilderStep, val: any) =>
    setSteps((s) => s.map((step, i) => (i === idx ? { ...step, [key]: val } : step))), []);

  const addStep = () =>
    setSteps((s) => [...s, defaultStep(s.length + 1)]);

  const removeStep = (idx: number) =>
    setSteps((s) => s.filter((_, i) => i !== idx).map((step, i) => ({ ...step, sequence: i + 1 })));

  const moveStep = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    setSteps((s) => {
      const next = [...s];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((step, i) => ({ ...step, sequence: i + 1 }));
    });
  };

  const { mutate: finalizeDraft, isPending: savingDraft } = useMutation({
    mutationFn: () => fmsApi.createWorkflow({ name: flowName, description: '' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fms'] });
      setSuccessMode('draft');
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const { mutate: finalizeAndStart, isPending: starting } = useMutation({
    mutationFn: () =>
      fmsApi.createAndStart({
        name: flowName,
        steps: steps.map((s) => ({
          title: s.title,
          description: s.description,
          assignedToId: s.assignedToId || undefined,
          tatHours: tatHours(s),
          role: s.role,
          actionType: s.actionType,
        })),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['fms'] });
      setSavedTaskCount(res.tasksCreated ?? 0);
      setSuccessMode('started');
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  function handleFinalizeDraft() {
    if (!flowName.trim()) { toast.error('Flow name is required'); return; }
    finalizeDraft();
  }

  function handleFinalizeAndStart() {
    if (!flowName.trim()) { toast.error('Flow name is required'); return; }
    if (steps.some((s) => !s.title.trim())) { toast.error('All steps need a title'); return; }
    if (steps.some((s) => !s.assignedToId)) { toast.error('All steps need an assignee to start'); return; }
    finalizeAndStart();
  }

  const isBusy = savingDraft || starting;

  // ── Success screen ──────────────────────────────────────────────────────────
  if (successMode) {
    const isStarted = successMode === 'started';
    const hasSheet = sheetData && sheetData.rows.length > 0;
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Edit, Assign, Start Flow"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              onClick={onClose}
              className="bg-red-500 hover:bg-red-600 text-contrast border-0"
            >
              Only Save Template
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center text-center py-6 space-y-4">
          {/* Checkmark */}
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-green-200 bg-white">
            <CheckCircle2 className="h-10 w-10 text-green-500" strokeWidth={1.5} />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Template Ready</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isStarted
                ? `Flow template has been saved and ${savedTaskCount} task${savedTaskCount !== 1 ? 's' : ''} assigned.`
                : 'Flow template has been saved.'}
            </p>
          </div>

          {hasSheet && (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Do you want to create one live FMS flow for each Google Sheet row now?
              </p>
              <div className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-left text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Mapping:</span> each selected sheet column will prefill the matching first-step form field.
              </div>
              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-contrast border-0"
                leftIcon={<Database className="h-4 w-4" />}
                onClick={() => {
                  toast.success(`Creating ${sheetData.rows.length} flow${sheetData.rows.length !== 1 ? 's' : ''} from sheet data…`);
                  onClose();
                }}
              >
                Create Flows from Sheet Data
              </Button>
            </>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Edit, Assign, Start Flow"
        size="2xl"
        footer={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={addStep}
              disabled={isBusy}
            >
              Add Step
            </Button>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Route className="h-3.5 w-3.5" />}
              onClick={() => setShowFlowMapPreview(true)}
              disabled={isBusy}
            >
              Flow Map
            </Button>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleFinalizeDraft}
              loading={savingDraft}
              disabled={isBusy}
            >
              Finalize Flow
            </Button>
            <Button
              size="sm"
              onClick={handleFinalizeAndStart}
              loading={starting}
              disabled={isBusy}
              className="bg-green-600 hover:bg-green-700 text-contrast border-0"
            >
              Finalize &amp; Start
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Flow Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Flow Name</label>
            <input
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              placeholder="Enter workflow name…"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Step Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-max w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                  {['#', 'Step', 'Description', 'TAT', '', 'Role', 'Action', 'Assign To', 'Form', 'Editable', 'Read-only', 'Remove'].map((h, i) => (
                    <th key={i} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {steps.map((step, idx) => {
                  const editableCount = step.formFields.filter((f) => f.editable).length;
                  const readonlyCount = step.formFields.filter((f) => !f.editable).length;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                      {/* # */}
                      <td className="px-3 py-2 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{step.sequence}</span>
                          <div className="flex flex-col gap-0">
                            <button onClick={() => moveStep(idx, -1)} disabled={idx === 0}
                              className="text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-20 transition-colors">
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1}
                              className="text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-20 transition-colors">
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Step title */}
                      <td className="px-2 py-2">
                        <input
                          value={step.title}
                          onChange={(e) => updateStep(idx, 'title', e.target.value)}
                          placeholder="Step title…"
                          className="w-44 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      {/* Description */}
                      <td className="px-2 py-2">
                        <input
                          value={step.description}
                          onChange={(e) => updateStep(idx, 'description', e.target.value)}
                          placeholder="Description…"
                          className="w-44 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      {/* TAT value */}
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={1}
                          value={step.tatValue}
                          onChange={(e) => updateStep(idx, 'tatValue', Math.max(1, Number(e.target.value)))}
                          className="w-16 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      {/* TAT unit */}
                      <td className="px-2 py-2">
                        <select
                          value={step.tatUnit}
                          onChange={(e) => updateStep(idx, 'tatUnit', e.target.value)}
                          className="rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="days">Days</option>
                          <option value="hours">Hours</option>
                        </select>
                      </td>

                      {/* Role */}
                      <td className="px-2 py-2">
                        <select
                          value={step.role}
                          onChange={(e) => updateStep(idx, 'role', e.target.value)}
                          className="rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="Employee">Employee</option>
                          <option value="Admin">Admin</option>
                          <option value="Super Admin">Super Admin</option>
                        </select>
                      </td>

                      {/* Action */}
                      <td className="px-2 py-2">
                        <select
                          value={step.actionType}
                          onChange={(e) => updateStep(idx, 'actionType', e.target.value)}
                          className="rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="submit">submit</option>
                          <option value="review">review</option>
                          <option value="approve">approve</option>
                        </select>
                      </td>

                      {/* Assign To */}
                      <td className="px-2 py-2">
                        <select
                          value={step.assignedToId}
                          onChange={(e) => updateStep(idx, 'assignedToId', e.target.value)}
                          className="w-36 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">Select user</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </td>

                      {/* Configure Form */}
                      <td className="px-2 py-2">
                        <button
                          onClick={() => setConfigFormIdx(idx)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1.5 text-xs font-medium text-contrast transition-colors"
                        >
                          <Settings2 className="h-3 w-3" />
                          Configure Form
                          {step.formFields.length > 0 && (
                            <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-contrast">
                              {step.formFields.length}
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Editable count */}
                      <td className="px-3 py-2 text-center">
                        <span className="text-xs font-semibold text-green-600 dark:text-green-400">{editableCount}</span>
                      </td>

                      {/* Read-only count */}
                      <td className="px-3 py-2 text-center">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{readonlyCount}</span>
                      </td>

                      {/* Remove */}
                      <td className="px-3 py-2 text-center">
                        {steps.length > 1 && (
                          <button
                            onClick={() => removeStep(idx)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded bg-red-500 hover:bg-red-600 text-contrast transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {configFormIdx !== null && (
        <ConfigureFormModal
          step={steps[configFormIdx]}
          onClose={() => setConfigFormIdx(null)}
          onSave={(fields) => updateStep(configFormIdx, 'formFields', fields)}
        />
      )}

      {showFlowMapPreview && (
        <FmsFlowMapModal
          open={showFlowMapPreview}
          onClose={() => setShowFlowMapPreview(false)}
          flowName={flowName || 'Flow Preview'}
          steps={steps.map((s): FlowMapStep => ({
            sequence: s.sequence,
            title: s.title || '(untitled)',
            description: s.description,
            role: s.role,
            actionType: s.actionType,
            tatHours: tatHours(s),
            fieldCount: s.formFields.length,
          }))}
        />
      )}
    </>
  );
}
