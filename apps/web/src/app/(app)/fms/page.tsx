'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FmsBuilderModal } from './FmsBuilderModal';
import { FmsFlowMapModal } from './FmsFlowMapModal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GitBranch, CheckCircle, Upload, BarChart2, Sparkles,
  X, AlertTriangle, Clock, CheckCheck, Route, Activity,
  FileSpreadsheet, FileText, ChevronUp, ChevronDown, Trash2, MoreVertical,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fmsApi, aiApi } from '@/lib/api';
import { getApiError } from '@/lib/axios';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea, Input } from '@/components/ui/Input';
import { formatDate, isOverdue, exportToExcel, exportToPdf } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import type { FmsStep } from '@/types';

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += line[i];
    }
  }
  result.push(current);
  return result;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    return headers.reduce((obj: Record<string, string>, h, i) => {
      obj[h.trim()] = (values[i] ?? '').trim();
      return obj;
    }, {});
  });
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color,
}: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FmsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'my-pending' | 'my-completed' | 'team-pending' | 'team-completed'>('my-pending');
  const [doneModal, setDoneModal] = useState<FmsStep | null>(null);
  const [remarks, setRemarks] = useState('');
  const [showMonitor, setShowMonitor] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Analytics state
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Header dropdown state
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showHeaderMenu) return;
    function handleClick(e: MouseEvent) {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setShowHeaderMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showHeaderMenu]);

  // Builder modal state
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderInitialName, setBuilderInitialName] = useState('');
  const [builderInitialSteps, setBuilderInitialSteps] = useState<any[]>([]);

  // Flow Map modal state
  const [showFlowMap, setShowFlowMap] = useState(false);
  const [flowMapWorkflowId, setFlowMapWorkflowId] = useState('');
  const [flowMapWorkflowName, setFlowMapWorkflowName] = useState('');

  // AI state
  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiJobId, setAiJobId] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiPolling, setAiPolling] = useState(false);
  const [aiFlowName, setAiFlowName] = useState('');
  const [aiConfigMode, setAiConfigMode] = useState<'Manual' | 'Sheet'>('Manual');
  const [aiConfigName, setAiConfigName] = useState('');
  const [aiSheetUrl, setAiSheetUrl] = useState('');
  const [aiFields, setAiFields] = useState<{ label: string; type: string; required: boolean }[]>([]);
  const [aiSheetData, setAiSheetData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [aiSelectedRow, setAiSelectedRow] = useState<number | null>(null);
  const [aiSelectedConfig, setAiSelectedConfig] = useState('');
  const [aiSavedConfigs, setAiSavedConfigs] = useState<{ id: string; name: string; url: string; fields: { label: string; type: string; required: boolean }[] }[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('fms-ai-sheet-configs') ?? '[]'); } catch { return []; }
  });
  const [loadingSheet, setLoadingSheet] = useState(false);

  const { user } = useAuthStore();
  const isAdmin = ['ADMIN', 'MANAGER', 'COMPANY_OWNER', 'SAAS_OWNER'].includes(user?.role ?? '');
  const qc = useQueryClient();

  // ── Data queries ─────────────────────────────────────────────────────────────

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['fms', 'steps', tab],
    queryFn: () => fmsApi.findSteps({ view: tab }),
  });

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['fms', 'analytics'],
    queryFn: () => fmsApi.getAnalytics(),
    enabled: showAnalytics,
  });

  const { data: workflows = [], isLoading: workflowsLoading } = useQuery({
    queryKey: ['fms', 'workflows'],
    queryFn: fmsApi.findWorkflows,
    enabled: showMonitor,
  });

  const { data: monitorPending, isLoading: monitorPendingLoading } = useQuery({
    queryKey: ['fms', 'monitor', selectedWorkflowId, 'pending'],
    queryFn: () => fmsApi.findSteps({ workflowId: selectedWorkflowId, view: 'team-pending', limit: 100 }),
    enabled: showMonitor && !!selectedWorkflowId,
  });

  const { data: monitorCompleted, isLoading: monitorCompletedLoading } = useQuery({
    queryKey: ['fms', 'monitor', selectedWorkflowId, 'completed'],
    queryFn: () => fmsApi.findSteps({ workflowId: selectedWorkflowId, view: 'team-completed', limit: 100 }),
    enabled: showMonitor && !!selectedWorkflowId,
  });

  // ── Poll AI job ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!aiJobId || !aiPolling) return;
    const interval = setInterval(async () => {
      try {
        const res = await aiApi.getJobStatus(aiJobId);
        if (res.status === 'completed') {
          setAiResult(res.result);
          setAiPolling(false);
        } else if (res.status === 'failed') {
          toast.error('AI generation failed. Try again.');
          setAiPolling(false);
          setAiJobId(null);
        }
      } catch {
        setAiPolling(false);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [aiJobId, aiPolling]);

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const { mutate: completeStep, isPending: completing } = useMutation({
    mutationFn: () => fmsApi.completeStep(doneModal!.id, { remarks }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fms'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setDoneModal(null);
      setRemarks('');
      toast.success('FMS step completed');
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const { mutate: submitImport, isPending: importing } = useMutation({
    mutationFn: () => fmsApi.importData(importRows),
    onSuccess: (res) => {
      setImportResult(res);
      if (res.created > 0) {
        qc.invalidateQueries({ queryKey: ['fms'] });
        toast.success(`Imported ${res.created} step(s)`);
      }
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const { mutate: generateAi, isPending: generatingAi } = useMutation({
    mutationFn: () => aiApi.generateWorkflow({
      name: aiFlowName.trim() || 'Untitled Flow',
      intent: aiPrompt,
      fields: aiFields.map((f) => f.label).filter(Boolean),
    }),
    onSuccess: (res) => {
      setAiJobId(res.jobId);
      setAiPolling(true);
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const { mutate: autofillFields, isPending: autofilling } = useMutation({
    mutationFn: () => aiApi.autofillFields(aiFlowName.trim() || 'Workflow', aiPrompt),
    onSuccess: (res) => {
      if (res.fields?.length) {
        setAiFields(res.fields.map((label) => ({ label, type: 'text', required: false })));
        toast.success(`${res.fields.length} fields suggested`);
      }
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      setImportRows(rows);
      setImportResult(null);
    };
    reader.readAsText(file);
  }

  function closeImport() {
    setShowImport(false);
    setImportRows([]);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function closeAi() {
    setShowAi(false);
    setAiFlowName('');
    setAiPrompt('');
    setAiJobId(null);
    setAiResult(null);
    setAiPolling(false);
    setAiConfigMode('Manual');
    setAiConfigName('');
    setAiSheetUrl('');
    setAiFields([]);
    setAiSheetData(null);
    setAiSelectedRow(null);
    setAiSelectedConfig('');
    setLoadingSheet(false);
  }

  function openAiDraftInBuilder() {
    const rawSteps = Array.isArray(aiResult?.steps) ? aiResult.steps : [];
    setBuilderInitialName(aiFlowName || aiResult?.name || 'AI Generated Workflow');
    setBuilderInitialSteps(rawSteps);
    setShowAi(false);
    setShowBuilder(true);
    // Also keep sessionStorage for the old page-based builder as fallback
    const steps = rawSteps.map((s: any, i: number) => ({
      ...s,
      stepNo: s.sequence ?? s.stepNo ?? i + 1,
    }));
    sessionStorage.setItem(
      'taskeasy:fms-ai-draft',
      JSON.stringify({
        name: aiFlowName || aiResult?.name || 'AI Generated Workflow',
        description: aiPrompt,
        steps,
      }),
    );
  }

  function handleSaveConfig() {
    if (!aiConfigName.trim()) { toast.error('Enter a configuration name'); return; }
    const newCfg = { id: Date.now().toString(), name: aiConfigName.trim(), url: aiSheetUrl, fields: aiFields };
    const updated = [...aiSavedConfigs.filter((c) => c.name !== aiConfigName.trim()), newCfg];
    setAiSavedConfigs(updated);
    localStorage.setItem('fms-ai-sheet-configs', JSON.stringify(updated));
    toast.success('Configuration saved');
  }

  function handleDeleteConfig() {
    if (!aiSelectedConfig) return;
    const updated = aiSavedConfigs.filter((c) => c.id !== aiSelectedConfig);
    setAiSavedConfigs(updated);
    localStorage.setItem('fms-ai-sheet-configs', JSON.stringify(updated));
    setAiSelectedConfig('');
    toast.success('Configuration deleted');
  }

  function handleSelectConfig(id: string) {
    setAiSelectedConfig(id);
    const cfg = aiSavedConfigs.find((c) => c.id === id);
    if (cfg) { setAiConfigName(cfg.name); setAiSheetUrl(cfg.url); setAiFields(cfg.fields); }
  }

  function handleAddField() {
    setAiFields((prev) => [...prev, { label: '', type: 'text', required: false }]);
  }
  function handleFieldProp(i: number, key: 'label' | 'type' | 'required', val: string | boolean) {
    setAiFields((prev) => prev.map((f, idx) => idx === i ? { ...f, [key]: val } : f));
  }
  function handleRemoveField(i: number) {
    setAiFields((prev) => prev.filter((_, idx) => idx !== i));
  }
  function handleMoveField(i: number, dir: -1 | 1) {
    setAiFields((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function handleLoadFromSheet() {
    if (!aiSheetUrl.trim()) { toast.error('Enter a Google Sheet URL first'); return; }
    const match = aiSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) { toast.error('Invalid Google Sheets URL'); return; }
    const sheetId = match[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    setLoadingSheet(true);
    try {
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error('Could not access sheet — make sure it is shared publicly (Anyone with link → Viewer)');
      const text = await res.text();
      const lines = text.trim().split('\n').filter(Boolean);
      if (!lines.length) throw new Error('Sheet appears to be empty');
      const headers = parseCSVLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, '')).filter(Boolean);
      if (!headers.length) throw new Error('No columns found in the sheet header row');
      const rows = lines.slice(1).map((line) =>
        parseCSVLine(line).map((v) => v.trim().replace(/^"|"$/g, '')),
      );
      setAiFields(headers.map((h) => ({ label: h, type: 'text', required: false })));
      setAiSheetData({ headers, rows });
      setAiSelectedRow(null);
      toast.success(`Loaded ${headers.length} column(s) and ${rows.length} row(s).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load sheet');
    } finally {
      setLoadingSheet(false);
    }
  }

  function handleSelectSheetRow(rowIdx: number) {
    setAiSelectedRow(rowIdx);
    if (!aiSheetData) return;
    const { headers, rows } = aiSheetData;
    const row = rows[rowIdx];
    const rowLines = headers.map((h, i) => `- ${h}: ${row[i] ?? ''}`).join('\n');
    const template =
      `Create an FMS workflow using this Google Sheet row as the business object.\n` +
      `Each selected sheet column must become a form field and the row values must prefill the first step.\n` +
      `Use the actual values below inside activity names/descriptions where they make the workflow clearer.\n\n` +
      `Selected Row Data:\n${rowLines}\n\nAdditional prompt:`;
    setAiPrompt((prev) => {
      const afterAdditional = prev.match(/Additional prompt:([\s\S]*)/)?.[1] ?? '';
      return template + afterAdditional;
    });
  }

  // ── Table columns ─────────────────────────────────────────────────────────────

  const tabs = [
    { key: 'my-pending' as const, label: 'My Pending' },
    { key: 'my-completed' as const, label: 'My Completed' },
    ...(isAdmin ? [
      { key: 'team-pending' as const, label: 'Team Pending' },
      { key: 'team-completed' as const, label: 'Team Completed' },
    ] : []),
  ];

  const selectedWorkflow = workflows.find((workflow: any) => workflow.id === selectedWorkflowId);
  const monitorTasks = [
    ...(monitorPending?.data ?? []),
    ...(monitorCompleted?.data ?? []),
  ].sort((a: FmsStep, b: FmsStep) => a.stepNo - b.stepNo);
  const completedCount = monitorCompleted?.meta?.total ?? monitorTasks.filter((task) => task.status === 'COMPLETED').length;
  const pendingCount = monitorPending?.meta?.total ?? monitorTasks.filter((task) => task.status !== 'COMPLETED').length;
  const lateCount = monitorTasks.filter((task) =>
    task.status !== 'COMPLETED' && new Date(task.plannedDate).getTime() < Date.now(),
  ).length;

  const columns: Column<FmsStep>[] = [
    { key: 'workflow', header: 'Workflow', render: (v) => v?.name ?? '—' },
    { key: 'stepNo', header: 'Step #', sortable: true },
    { key: 'title', header: 'Task', sortable: true },
    { key: 'assignedTo', header: 'Assigned To', render: (v) => v?.name ?? '—' },
    {
      key: 'plannedDate', header: 'Planned', sortable: true,
      render: (v) => (
        <span className={isOverdue(v) && tab.includes('pending') ? 'text-red-500 font-medium' : ''}>
          {formatDate(v)}
        </span>
      ),
    },
    { key: 'actualDate', header: 'Actual', render: (v) => v ? formatDate(v) : '—' },
    { key: 'delayDays', header: 'Delay', render: (v) => v > 0 ? <span className="text-red-500">{v}d</span> : '—' },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'formLink', header: 'Form',
      render: (v) => v
        ? <a href={v} target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline text-xs">Open Form</a>
        : '—',
    },
    {
      key: 'id', header: 'Actions',
      render: (_, row) => {
        const isAssignee = row.assignedTo?.id === (user?.id ?? user?.sub);
        const canDone = row.status === 'PENDING' || row.status === 'REWORK';
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            {canDone && (isAssignee || tab === 'my-pending') && (
              <Button size="xs" leftIcon={<CheckCircle className="h-3.5 w-3.5" />} onClick={() => setDoneModal(row)}>
                Done
              </Button>
            )}
            {row.status === 'COMPLETED' && (
              <span className="text-xs text-green-600 font-medium">Completed</span>
            )}
            <Button
              size="xs"
              variant="outline"
              leftIcon={<Route className="h-3 w-3" />}
              onClick={() => {
                setFlowMapWorkflowId(row.workflow?.id ?? '');
                setFlowMapWorkflowName(row.workflow?.name ?? '');
                setShowFlowMap(true);
              }}
            >
              Flow Map
            </Button>
          </div>
        );
      },
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Tabs + actions */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
        <div className="flex">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-1">
          {isAdmin && (
            <div ref={headerMenuRef} className="relative">
              <button
                onClick={() => setShowHeaderMenu((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <MoreVertical className="h-4 w-4" />
                Actions
              </button>
              {showHeaderMenu && (
                <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[170px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1 overflow-hidden">
                  {[
                    { icon: <Upload className="h-3.5 w-3.5" />, label: 'Import Sheet', onClick: () => { setShowImport(true); setShowHeaderMenu(false); } },
                    { icon: <BarChart2 className="h-3.5 w-3.5" />, label: 'Analytics', onClick: () => { setShowAnalytics(true); setShowHeaderMenu(false); } },
                    { icon: <Activity className="h-3.5 w-3.5" />, label: 'Monitor', onClick: () => { setShowMonitor(true); setShowHeaderMenu(false); } },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.onClick}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <span className="text-slate-400 dark:text-slate-500">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<FileSpreadsheet className="h-4 w-4 text-green-600" />}
            onClick={() => exportToExcel(
              (data?.data ?? []).map((r: FmsStep) => ({
                Workflow: r.workflow?.name ?? '',
                'Step #': r.stepNo,
                Task: r.title,
                'Assigned To': r.assignedTo?.name ?? '',
                Planned: formatDate(r.plannedDate),
                Actual: r.actualDate ? formatDate(r.actualDate) : '',
                'Delay (days)': r.delayDays ?? '',
                Status: r.status,
              })),
              `fms-${tab}`,
            )}
          >
            Excel
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<FileText className="h-4 w-4 text-red-500" />}
            onClick={() => exportToPdf(
              ['Workflow', 'Step #', 'Task', 'Assigned To', 'Planned', 'Actual', 'Delay', 'Status'],
              (data?.data ?? []).map((r: FmsStep) => [
                r.workflow?.name ?? '',
                String(r.stepNo),
                r.title,
                r.assignedTo?.name ?? '',
                formatDate(r.plannedDate),
                r.actualDate ? formatDate(r.actualDate) : '',
                r.delayDays ? `${r.delayDays}d` : '',
                r.status,
              ]),
              `fms-${tab}`,
              'FMS Tasks Report',
            )}
          >
            PDF
          </Button>
          {isAdmin && (
            <Button
              size="sm"
              leftIcon={<Sparkles className="h-3.5 w-3.5" />}
              onClick={() => setShowAi(true)}
            >
              Generate with AI
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
        searchable={false}
        rowKey={(r) => r.id}
        emptyMessage="No FMS tasks found"
      />

      {/* ── Done modal ──────────────────────────────────────────────────────────── */}
      <Modal
        open={!!doneModal}
        onClose={() => setDoneModal(null)}
        title="Complete FMS Step"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDoneModal(null)}>Cancel</Button>
            <Button onClick={() => completeStep()} loading={completing}>Mark Done</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            <p><strong>Workflow:</strong> {doneModal?.workflow?.name}</p>
            <p><strong>Step {doneModal?.stepNo}:</strong> {doneModal?.title}</p>
          </div>
          <Textarea
            label="Remarks (optional)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Any notes…"
          />
        </div>
      </Modal>

      {/* ── Import Sheet modal ──────────────────────────────────────────────────── */}
      <Modal
        open={showImport}
        onClose={closeImport}
        title="Import FMS Steps from CSV"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={closeImport}>Close</Button>
            <Button
              onClick={() => submitImport()}
              loading={importing}
              disabled={importRows.length === 0 || !!importResult}
            >
              Import {importRows.length > 0 ? `(${importRows.length} rows)` : ''}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-4 text-center">
            <Upload className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Select a CSV file with columns:<br />
              <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                workflowName, stepTitle, stepNo, assigneeEmail, plannedDate, what, how, formLink
              </code>
              <br />
              <span className="text-xs text-slate-500 dark:text-slate-400">plannedDate must be YYYY-MM-DD</span>
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="fms-csv-input"
            />
            <label htmlFor="fms-csv-input">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                Choose File
              </Button>
            </label>
          </div>

          {importRows.length > 0 && !importResult && (
            <div className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
              <p className="font-medium text-slate-800 dark:text-slate-200 mb-1">
                Preview — {importRows.length} row(s) ready to import
              </p>
              <p className="text-xs">First row: {JSON.stringify(importRows[0])}</p>
            </div>
          )}

          {importResult && (
            <div className={`rounded-lg p-4 ${importResult.errors.length > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700' : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'}`}>
              <p className="font-medium text-sm text-slate-800 dark:text-slate-200">
                ✅ Imported {importResult.created} step(s) successfully
              </p>
              {importResult.errors.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {importResult.errors.map((e, i) => (
                    <li key={i} className="text-xs text-amber-700 dark:text-amber-300 flex gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      {e}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Workflow Monitor modal ─────────────────────────────────────────────── */}
      <Modal
        open={showMonitor}
        onClose={() => {
          setShowMonitor(false);
          setSelectedWorkflowId('');
        }}
        title="FMS Workflow Monitor"
        size="lg"
        footer={
          <>
            {selectedWorkflowId && (
              <Button
                variant="outline"
                leftIcon={<Route className="h-3.5 w-3.5" />}
                onClick={() => { setFlowMapWorkflowId(selectedWorkflowId); setFlowMapWorkflowName(selectedWorkflow?.name ?? ''); setShowFlowMap(true); }}
              >
                Flow Map
              </Button>
            )}
            <Button onClick={() => setShowMonitor(false)}>Close</Button>
          </>
        }
      >
        <div className="space-y-4">
          <select
            value={selectedWorkflowId}
            onChange={(e) => setSelectedWorkflowId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            disabled={workflowsLoading}
          >
            <option value="">{workflowsLoading ? 'Loading workflows...' : 'Select workflow'}</option>
            {workflows.map((workflow: any) => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.name} ({workflow.status})
              </option>
            ))}
          </select>

          {selectedWorkflowId && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Total Steps" value={monitorTasks.length} color="text-slate-800 dark:text-slate-100" />
                <StatCard label="Completed" value={completedCount} color="text-green-600" />
                <StatCard label="Pending" value={pendingCount} color="text-amber-600" />
                <StatCard label="Late" value={lateCount} color="text-red-600" />
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {selectedWorkflow?.name ?? 'Selected workflow'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedWorkflow?.description || 'Execution steps and task ownership'}
                    </p>
                  </div>
                  <StatusBadge status={selectedWorkflow?.status} />
                </div>

                {monitorPendingLoading || monitorCompletedLoading ? (
                  <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading workflow steps...</div>
                ) : monitorTasks.length > 0 ? (
                  <div className="max-h-80 overflow-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/60">
                        <tr>
                          <th className="px-4 py-2 text-left">Step</th>
                          <th className="px-4 py-2 text-left">Task</th>
                          <th className="px-4 py-2 text-left">Owner</th>
                          <th className="px-4 py-2 text-left">Planned</th>
                          <th className="px-4 py-2 text-left">Actual</th>
                          <th className="px-4 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950/30">
                        {monitorTasks.map((task) => (
                          <tr key={task.id}>
                            <td className="px-4 py-2 text-slate-500">{task.stepNo}</td>
                            <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{task.title}</td>
                            <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{task.assignedTo?.name ?? '—'}</td>
                            <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{formatDate(task.plannedDate)}</td>
                            <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{task.actualDate ? formatDate(task.actualDate) : '—'}</td>
                            <td className="px-4 py-2"><StatusBadge status={task.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">No execution steps found for this workflow</div>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ── Analytics modal ─────────────────────────────────────────────────────── */}
      <Modal
        open={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        title="FMS Analytics"
        size="lg"
        footer={<Button onClick={() => setShowAnalytics(false)}>Close</Button>}
      >
        {analyticsLoading ? (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading analytics…</div>
        ) : analyticsData ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Total Tasks" value={analyticsData.total} color="text-slate-800 dark:text-slate-100" />
              <StatCard label="Completed" value={analyticsData.completed} color="text-green-600" />
              <StatCard label="Pending" value={analyticsData.pending} color="text-amber-600" />
              <StatCard label="Late" value={analyticsData.late} color="text-red-600" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Completion Rate"
                value={`${analyticsData.completionRate}%`}
                color="text-indigo-600"
                sub={`${analyticsData.completed} of ${analyticsData.total} tasks done`}
              />
              <StatCard
                label="On-Time Rate"
                value={`${analyticsData.onTimeRate}%`}
                color="text-teal-600"
                sub={`${analyticsData.onTime} completed on schedule`}
              />
            </div>

            {analyticsData.workflows.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Workflows</p>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  {analyticsData.workflows.map((wf) => (
                    <div key={wf.id} className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-slate-900">
                      <span className="text-sm text-slate-700 dark:text-slate-300">{wf.name}</span>
                      <StatusBadge status={wf.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">No analytics data</div>
        )}
      </Modal>

      {/* ── Generate with AI modal ──────────────────────────────────────────────── */}
      <Modal
        open={showAi}
        onClose={closeAi}
        title="Generate FMS Flow with AI"
        size="lg"
        footer={
          !aiResult ? (
            <>
              <Button
                onClick={() => generateAi()}
                loading={generatingAi || aiPolling}
                disabled={(!aiFlowName.trim() && !aiPrompt.trim()) || aiPolling}
              >
                {aiPolling ? 'Generating…' : 'Generate'}
              </Button>
              <Button variant="outline" onClick={closeAi}>Cancel</Button>
            </>
          ) : (
            <Button variant="outline" onClick={closeAi}>Close</Button>
          )
        }
      >
        {!aiResult ? (
          <div className="space-y-5">
            {/* Flow Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Flow Name</label>
              <Input
                placeholder="e.g. Purchase Approval Flow"
                value={aiFlowName}
                onChange={(e) => setAiFlowName(e.target.value)}
                disabled={aiPolling}
              />
            </div>

            {/* Configuration section */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Configuration (Data Source + Form Fields)
                </span>
                <select
                  value={aiConfigMode}
                  onChange={(e) => setAiConfigMode(e.target.value as 'Manual' | 'Sheet')}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                >
                  <option value="Manual">Manual</option>
                  <option value="Sheet">Sheet</option>
                </select>
              </div>

              {/* Saved config row */}
              <div className="flex items-center gap-2">
                <select
                  value={aiSelectedConfig}
                  onChange={(e) => handleSelectConfig(e.target.value)}
                  className="flex-1 rounded-lg border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 outline-none focus:border-indigo-500"
                >
                  <option value="">Select saved sheet configuration</option>
                  {aiSavedConfigs.map((cfg) => (
                    <option key={cfg.id} value={cfg.id}>{cfg.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleSaveConfig}
                  className="shrink-0 rounded-lg bg-blue-500 hover:bg-blue-600 text-contrast text-xs font-bold px-3 py-2 leading-tight transition-colors"
                >
                  Save<br />Sheet
                </button>
                <button
                  onClick={handleDeleteConfig}
                  disabled={!aiSelectedConfig}
                  className="shrink-0 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-40 text-contrast text-xs font-bold px-3 py-2 leading-tight transition-colors"
                >
                  Delete<br />Saved
                </button>
              </div>

              {/* Config name */}
              <Input
                placeholder="Sheet configuration name (for saving)"
                value={aiConfigName}
                onChange={(e) => setAiConfigName(e.target.value)}
                disabled={aiPolling}
              />

              {/* Sheet URL */}
              <Input
                placeholder="Google Sheet URL (optional)"
                value={aiSheetUrl}
                onChange={(e) => setAiSheetUrl(e.target.value)}
                disabled={aiPolling}
              />

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleLoadFromSheet}
                  disabled={loadingSheet || aiPolling}
                  className="rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-contrast text-sm font-semibold px-4 py-2 transition-colors flex items-center gap-1.5"
                >
                  {loadingSheet ? <><Upload className="h-3.5 w-3.5 animate-pulse" /> Loading…</> : 'Load from Sheet'}
                </button>
                <button
                  onClick={() => autofillFields()}
                  disabled={autofilling || aiPolling}
                  className="rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-contrast text-sm font-semibold px-4 py-2 transition-colors flex items-center gap-1.5"
                >
                  {autofilling ? <><Sparkles className="h-3.5 w-3.5 animate-pulse" /> Thinking…</> : 'AI Autofill Fields'}
                </button>
                <button
                  onClick={handleAddField}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-contrast text-sm font-semibold px-4 py-2 transition-colors"
                >
                  Add Field Manually
                </button>
              </div>

              {/* Fields table */}
              {aiFields.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No fields configured yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Label</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase w-32">Type</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 uppercase w-20">Required</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 uppercase w-16">Remove</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {aiFields.map((field, i) => (
                        <tr key={i} className="bg-white dark:bg-slate-900">
                          <td className="px-2 py-1.5">
                            <input
                              value={field.label}
                              onChange={(e) => handleFieldProp(i, 'label', e.target.value)}
                              placeholder={`Field ${i + 1}`}
                              className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-400"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={field.type}
                              onChange={(e) => handleFieldProp(i, 'type', e.target.value)}
                              className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-400"
                            >
                              {['text', 'number', 'date', 'checkbox', 'dropdown', 'textarea'].map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => handleFieldProp(i, 'required', e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              onClick={() => handleRemoveField(i)}
                              className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-red-500 hover:bg-red-600 text-contrast transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                          <td className="pr-2 py-1.5">
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => handleMoveField(i, -1)}
                                disabled={i === 0}
                                className="disabled:opacity-30 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleMoveField(i, 1)}
                                disabled={i === aiFields.length - 1}
                                className="disabled:opacity-30 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Google Sheet Data preview */}
              {aiSheetData && (
                <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-green-800 dark:text-green-300">Google Sheet Data</p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        {aiSheetData.rows.length} row(s), {aiSheetData.headers.length} column(s). Click Add on a row to prefill this AI flow.
                      </p>
                    </div>
                    <span className="text-xs font-medium text-green-700 dark:text-green-400 whitespace-nowrap">
                      {aiSelectedRow !== null ? `Row ${aiSelectedRow + 1} selected` : 'No row selected'}
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded border border-green-200 dark:border-green-800 bg-white dark:bg-slate-900">
                    <table className="w-full text-xs min-w-max">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-500 whitespace-nowrap">S.No</th>
                          {aiSheetData.headers.map((h, hi) => (
                            <th key={hi} className="px-2 py-1.5 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                          ))}
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-500">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {aiSheetData.rows.map((row, ri) => (
                          <tr
                            key={ri}
                            className={aiSelectedRow === ri ? 'bg-green-50 dark:bg-green-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                          >
                            <td className="px-2 py-1.5 text-slate-500">{ri + 1}</td>
                            {aiSheetData.headers.map((_, ci) => (
                              <td key={ci} className="px-2 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{row[ci] ?? ''}</td>
                            ))}
                            <td className="px-2 py-1.5">
                              <button
                                onClick={() => handleSelectSheetRow(ri)}
                                className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${aiSelectedRow === ri ? 'bg-green-600 text-contrast' : 'bg-indigo-600 hover:bg-indigo-700 text-contrast'}`}
                              >
                                {aiSelectedRow === ri ? 'Selected' : 'Add'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Intent */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Intent</label>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe your process intent..."
                rows={4}
                disabled={aiPolling}
              />
            </div>

            {aiPolling && (
              <div className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-2">
                <Sparkles className="h-4 w-4 animate-pulse" />
                AI is generating your workflow…
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Success banner */}
            <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2">
              <CheckCheck className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                  Workflow generated — {(aiResult?.steps ?? []).length} step{(aiResult?.steps ?? []).length !== 1 ? 's' : ''}
                </p>
                {aiResult?.isPlaceholder && aiResult?.message && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{aiResult.message}</p>
                )}
              </div>
            </div>

            {/* Step list */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {aiFlowName || aiResult?.name || 'Generated Workflow'}
                </p>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
                {(aiResult?.steps ?? []).map((step: any, i: number) => {
                  const role = step.role ?? step.assignedRole;
                  const tat = step.tatHours ?? step.slaHours;
                  const actionType = step.actionType;
                  const fieldCount = Array.isArray(step.formSchema) ? step.formSchema.length : 0;
                  const roleColor =
                    role === 'Super Admin'
                      ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                      : role === 'Admin'
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
                  const actionColor =
                    actionType === 'approve'
                      ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : actionType === 'review'
                      ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400';
                  return (
                    <div key={i} className="flex gap-3 px-4 py-3">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {step.sequence ?? step.stepNo ?? i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{step.title}</p>
                        {step.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{step.description}</p>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {role && (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${roleColor}`}>
                              {role}
                            </span>
                          )}
                          {actionType && (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${actionColor}`}>
                              {actionType}
                            </span>
                          )}
                          {tat > 0 && (
                            <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                              <Clock className="mr-1 h-3 w-3" />{tat}h TAT
                            </span>
                          )}
                          {fieldCount > 0 && (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                              {fieldCount} field{fieldCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click below to assign team members, set TAT, and configure forms before starting the workflow.
            </p>
            <Button leftIcon={<Route className="h-3.5 w-3.5" />} onClick={openAiDraftInBuilder}>
              Edit, Assign &amp; Start Flow
            </Button>
          </div>
        )}
      </Modal>

      {showBuilder && (
        <FmsBuilderModal
          open={showBuilder}
          onClose={() => setShowBuilder(false)}
          initialName={builderInitialName}
          initialSteps={builderInitialSteps}
          sheetData={aiSheetData}
        />
      )}

      {showFlowMap && (
        <FmsFlowMapModal
          open={showFlowMap}
          onClose={() => { setShowFlowMap(false); setFlowMapWorkflowId(''); setFlowMapWorkflowName(''); }}
          workflowId={flowMapWorkflowId || undefined}
          flowName={flowMapWorkflowName || undefined}
          showWorkflowSelector={!flowMapWorkflowId}
        />
      )}
    </div>
  );
}
