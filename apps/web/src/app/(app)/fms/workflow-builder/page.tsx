'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ArrowLeft, GitBranch } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getApiError } from '@/lib/axios';
import { fmsApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { useActiveUsers } from '@/hooks/useUsers';
import { useActiveProjects } from '@/hooks/useProjects';

interface Step {
  stepNo: number;
  title: string;
  assigneeId: string;
  description: string;
  formLink: string;
  plannedDate: string;
}

export default function WorkflowBuilderPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: users = [] } = useActiveUsers();
  const { data: projects = [] } = useActiveProjects();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [steps, setSteps] = useState<Step[]>([
    { stepNo: 1, title: '', assigneeId: '', description: '', formLink: '', plannedDate: '' },
  ]);

  useEffect(() => {
    const rawDraft = sessionStorage.getItem('taskeasy:fms-ai-draft');
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft);
      const draftSteps = Array.isArray(draft?.steps) ? draft.steps : [];
      if (draft?.name) setName(String(draft.name));
      if (draft?.description) setDescription(String(draft.description));
      if (draftSteps.length > 0) {
        setSteps(draftSteps.map((step: any, index: number) => ({
          stepNo: Number(step.stepNo ?? step.sequence ?? index + 1),
          title: String(step.title ?? `Step ${index + 1}`),
          assigneeId: '',
          description: String(step.description ?? step.what ?? ''),
          formLink: '',
          plannedDate: '',
        })));
      }
    } catch {
      toast.error('Could not load the AI workflow draft');
    } finally {
      sessionStorage.removeItem('taskeasy:fms-ai-draft');
    }
  }, []);

  const addStep = () =>
    setSteps((s) => [...s, { stepNo: s.length + 1, title: '', assigneeId: '', description: '', formLink: '', plannedDate: '' }]);

  const removeStep = (idx: number) =>
    setSteps((s) => s.filter((_, i) => i !== idx).map((step, i) => ({ ...step, stepNo: i + 1 })));

  const updateStep = (idx: number, field: keyof Step, value: string) =>
    setSteps((s) => s.map((step, i) => i === idx ? { ...step, [field]: value } : step));

  // Creating a workflow only saves the workflow shell (name/description/project).
  // Steps are a separate resource — each one has to be added with its own call
  // once we have the new workflow's id, so a partial failure on one step doesn't
  // lose the others.
  const createMutation = useMutation({
    mutationFn: async () => {
      const workflow = await fmsApi.createWorkflow({
        name,
        description: description || undefined,
        projectId: projectId || undefined,
      });

      const results = await Promise.allSettled(
        steps.map((s) =>
          fmsApi.addStep({
            workflowId: workflow.id,
            title: s.title,
            stepNo: s.stepNo,
            assignedToId: s.assigneeId,
            plannedDate: s.plannedDate,
            formLink: s.formLink || undefined,
            description: s.description || undefined,
          }),
        ),
      );

      const failedCount = results.filter((r) => r.status === 'rejected').length;
      return { failedCount, total: steps.length };
    },
    onSuccess: ({ failedCount, total }) => {
      qc.invalidateQueries({ queryKey: ['fms'] });
      if (failedCount > 0) {
        toast.error(`Workflow created, but ${failedCount} of ${total} step(s) failed to save`);
      } else {
        toast.success('Workflow created');
      }
      router.push('/fms');
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const handleSave = () => {
    if (!name.trim()) { toast.error('Workflow name is required'); return; }
    if (steps.some((s) => !s.title.trim() || !s.assigneeId || !s.plannedDate)) {
      toast.error('All steps need a title, assignee, and planned date');
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-indigo-500" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Workflow Builder</h1>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h2 className="font-semibold text-slate-800 dark:text-slate-200">Workflow Details</h2>
        <Input label="Workflow Name *" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Select label="Project (optional)" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">No project</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">Steps ({steps.length})</h2>
          <Button size="sm" variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={addStep}>
            Add Step
          </Button>
        </div>

        {steps.map((step, idx) => (
          <div key={idx} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-indigo-600">Step {step.stepNo}</span>
              {steps.length > 1 && (
                <button
                  onClick={() => removeStep(idx)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Title *"
                value={step.title}
                onChange={(e) => updateStep(idx, 'title', e.target.value)}
              />
              <Select
                label="Assignee *"
                value={step.assigneeId}
                onChange={(e) => updateStep(idx, 'assigneeId', e.target.value)}
              >
                <option value="">Select user…</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Planned Date *"
                type="date"
                value={step.plannedDate}
                onChange={(e) => updateStep(idx, 'plannedDate', e.target.value)}
              />
              <Input
                label="Form Link (optional)"
                value={step.formLink}
                onChange={(e) => updateStep(idx, 'formLink', e.target.value)}
                placeholder="https://forms.google.com/…"
              />
            </div>
            <Textarea
              label="Description (optional)"
              value={step.description}
              onChange={(e) => updateStep(idx, 'description', e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button onClick={handleSave} loading={createMutation.isPending}>
          Save Workflow
        </Button>
      </div>
    </div>
  );
}
