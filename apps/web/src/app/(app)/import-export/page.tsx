'use client';

import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Upload, Download, FileSpreadsheet, Users, FolderKanban,
  CheckSquare, Briefcase, ClipboardList, AlertTriangle, CheckCircle, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { apiGet, apiPost, getApiError } from '@/lib/axios';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';

// ─── Types ─────────────────────────────────────────────────────────────────────

type ModuleKey = 'users' | 'projects' | 'delegation' | 'work-request' | 'checklist';
type ImportStage = 'idle' | 'preview' | 'confirm' | 'done';

interface ModuleConfig {
  label: string;
  icon: React.ReactNode;
  color: 'primary' | 'success' | 'warning' | 'info';
  templateHeaders: string[];
  exportEndpoint: string;
  importEndpoint: string;
}

const MODULES: Record<ModuleKey, ModuleConfig> = {
  users: {
    label: 'Users',
    icon: <Users className="h-5 w-5" />,
    color: 'primary',
    templateHeaders: ['Name', 'Email', 'Phone', 'Password', 'Role', 'Gender', 'DateOfBirth', 'Department', 'Designation', 'JoiningDate', 'EmploymentType'],
    exportEndpoint: '/users/export',
    importEndpoint: '/users/import',
  },
  projects: {
    label: 'Projects',
    icon: <FolderKanban className="h-5 w-5" />,
    color: 'info',
    templateHeaders: ['Name', 'Description', 'Color'],
    exportEndpoint: '/projects/export',
    importEndpoint: '/projects/import',
  },
  delegation: {
    label: 'Delegation',
    icon: <Briefcase className="h-5 w-5" />,
    color: 'warning',
    templateHeaders: ['AssignedTo', 'Project', 'Title', 'Description', 'TargetDate', 'TargetTime', 'Priority'],
    exportEndpoint: '/delegation/export',
    importEndpoint: '/delegation/import',
  },
  'work-request': {
    label: 'Work Requests',
    icon: <ClipboardList className="h-5 w-5" />,
    color: 'success',
    templateHeaders: ['RequestFor', 'Project', 'Title', 'Description', 'DeadlineDate', 'DeadlineTime'],
    exportEndpoint: '/work-requests/export',
    importEndpoint: '/work-requests/import',
  },
  checklist: {
    label: 'Checklists',
    icon: <CheckSquare className="h-5 w-5" />,
    color: 'primary',
    templateHeaders: ['AssignedTo', 'Project', 'Title', 'Frequency', 'StartDate', 'StartTime', 'AttachmentRequired'],
    exportEndpoint: '/checklist/export',
    importEndpoint: '/checklist/import',
  },
};

// ─── Download Template ─────────────────────────────────────────────────────────

function downloadTemplate(key: ModuleKey) {
  const config = MODULES[key];
  const ws = XLSX.utils.aoa_to_sheet([config.templateHeaders]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, config.label);
  XLSX.writeFile(wb, `${key}-template.xlsx`);
}

// ─── Export module data ────────────────────────────────────────────────────────

async function exportData(key: ModuleKey) {
  try {
    const rows = await apiGet<any[]>(MODULES[key].exportEndpoint);
    if (!rows.length) { toast.error('No data to export'); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, MODULES[key].label);
    XLSX.writeFile(wb, `${key}-export-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`${MODULES[key].label} exported`);
  } catch {
    toast.error('Export failed');
  }
}

// ─── Import Card ───────────────────────────────────────────────────────────────

function ImportCard({ moduleKey }: { moduleKey: ModuleKey }) {
  const config = MODULES[moduleKey];
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<ImportStage>('idle');
  const [preview, setPreview] = useState<{ headers: string[]; rows: any[][] }>({ headers: [], rows: [] });
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null);

  const { mutate: doImport, isPending } = useMutation({
    mutationFn: (data: any[]) => apiPost<any>(MODULES[moduleKey].importEndpoint, { rows: data }),
    onSuccess: (res: any) => {
      const result = { created: res.created ?? 0, errors: res.errors ?? [] };
      setImportResult(result);
      setStage('done');
      if (result.created > 0) toast.success(`${result.created} records imported`);
      if (result.errors.length > 0 && result.created === 0) toast.error('Import failed — see details below');
      else if (result.errors.length > 0) toast(`${result.errors.length} rows had errors`);
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const handleFile = (file: File) => {
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (raw.length < 2) { toast.error('File has no data rows'); return; }

      const headers = (raw[0] as string[]).map(String);
      const rows = raw.slice(1).filter((r) => r.some((v) => v !== '' && v != null));

      const missing = config.templateHeaders.filter(
        (h) => !headers.some((f) => f.toLowerCase() === h.toLowerCase())
      );
      setErrors(missing.length ? [`Missing columns: ${missing.join(', ')}`] : []);
      setPreview({ headers, rows: rows.slice(0, 5) });
      setStage('preview');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirm = () => {
    const file = selectedFile ?? fileRef.current?.files?.[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = (e) => {
      const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonRows: any[] = XLSX.utils.sheet_to_json(ws);
      doImport(jsonRows);
    };
    fr.readAsArrayBuffer(file);
  };

  const reset = () => {
    setStage('idle');
    setPreview({ headers: [], rows: [] });
    setErrors([]);
    setSelectedFile(null);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`rounded-xl p-2 bg-${config.color}/10 text-${config.color}`}>
            {config.icon}
          </div>
          <h3 className="font-semibold text-foreground">{config.label}</h3>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" icon={<Download className="h-3.5 w-3.5" />}
            onClick={() => downloadTemplate(moduleKey)}>
            Template
          </Button>
          <Button size="sm" variant="outline" icon={<Download className="h-3.5 w-3.5" />}
            onClick={() => exportData(moduleKey)}>
            Export
          </Button>
        </div>
      </div>

      {/* Upload zone */}
      {stage === 'idle' && (
        <div
          className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer
                     hover:border-primary/50 hover:bg-primary/5 transition-all"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <FileSpreadsheet className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Drop your Excel file here or <span className="text-primary font-medium">browse</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">Accepts .xlsx / .xls</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      )}

      {/* Preview */}
      {stage === 'preview' && (
        <div className="flex flex-col gap-3">
          {errors.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-700 dark:text-red-400">Validation errors</p>
                {errors.map((e) => <p key={e} className="text-xs text-red-600 dark:text-red-400">{e}</p>)}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Preview (first 5 rows):</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  {preview.headers.map((h) => (
                    <th key={h} className="border border-border bg-muted/40 px-2 py-1 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, ri) => (
                  <tr key={ri} className="even:bg-muted/20">
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-border px-2 py-1">{String(cell ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={reset}>Cancel</Button>
            {errors.length === 0 && (
              <Button size="sm" onClick={handleConfirm} loading={isPending}
                icon={<Upload className="h-3.5 w-3.5" />}>
                Confirm Import
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Done */}
      {stage === 'done' && importResult && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col items-center gap-2 py-2">
            <CheckCircle className={`h-8 w-8 ${importResult.created > 0 ? 'text-green-500' : 'text-slate-400'}`} />
            <p className="text-sm font-medium text-foreground">
              {importResult.created} record{importResult.created !== 1 ? 's' : ''} imported
              {importResult.errors.length > 0 ? `, ${importResult.errors.length} row${importResult.errors.length !== 1 ? 's' : ''} failed` : ''}
            </p>
          </div>
          {importResult.errors.length > 0 && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Row errors:</p>
              {importResult.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600 dark:text-red-400">{e}</p>
              ))}
            </div>
          )}
          <Button size="sm" variant="ghost" onClick={reset} className="self-center">Import Another</Button>
        </div>
      )}

      {isPending && stage !== 'done' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Importing…
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportExportPage() {
  const moduleKeys = Object.keys(MODULES) as ModuleKey[];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-primary" /> Import / Export Center
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Bulk-import data from Excel templates or export current records for each module.
        </p>
      </div>

      {/* Quick tip */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 flex gap-3">
        <AlertTriangle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <p className="font-semibold">How to use</p>
          <p>1. Download the template for the module → fill in your data → upload the file.</p>
          <p>2. Review the preview and fix any validation errors before confirming.</p>
          <p>3. Use Export to download all current records as a spreadsheet.</p>
        </div>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {moduleKeys.map((key) => (
          <ImportCard key={key} moduleKey={key} />
        ))}
      </div>
    </div>
  );
}
