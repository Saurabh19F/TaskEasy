'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Upload, Download, CheckCircle2, XCircle, AlertCircle,
  FileSpreadsheet, ArrowRight, ArrowLeft, RotateCcw,
  ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import { useBulkImport, useBulkImportHistory, BulkImportStep } from '@/hooks/useBulkImport';
import { bulkImportApi, ImportModuleName, ImportModuleInfo, ParsedImportRow } from '@/lib/api';

const STEPS: { id: BulkImportStep; label: string }[] = [
  { id: 'select',    label: 'Select Module' },
  { id: 'download',  label: 'Download Template' },
  { id: 'upload',    label: 'Upload File' },
  { id: 'validate',  label: 'Validate' },
  { id: 'preview',   label: 'Preview' },
  { id: 'importing', label: 'Import' },
  { id: 'result',    label: 'Result' },
];

const STEP_ORDER = STEPS.map((s) => s.id);

function stepIndex(step: BulkImportStep) {
  return STEP_ORDER.indexOf(step);
}

export default function BulkImportPage() {
  const bim = useBulkImport();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const hist = useBulkImportHistory();

  useEffect(() => {
    bim.loadModules();
  }, []);

  useEffect(() => {
    if (showHistory) hist.load();
  }, [showHistory]);

  const currentStepIdx = stepIndex(bim.step);

  const canAccessStep = (id: BulkImportStep) => stepIndex(id) <= currentStepIdx;

  const toggleRow = (n: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  };

  const selectedConfig = bim.selectedModule
    ? bim.modules.find((m) => m.moduleName === bim.selectedModule)
    : null;

  const handleDownloadTemplate = () => {
    if (!bim.selectedModule) return;
    const url = bulkImportApi.getTemplateUrl(bim.selectedModule);
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    a.click();
  };

  const handleDownloadErrors = () => {
    if (!bim.validation) return;
    const url = bulkImportApi.getErrorReportUrl(bim.validation.batchId);
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-contrast">Bulk Import</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Import multiple records at once using an Excel template
          </p>
        </div>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="text-sm text-blue-600 hover:underline"
        >
          {showHistory ? 'Hide history' : 'View import history'}
        </button>
      </div>

      {/* Import History */}
      {showHistory && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="font-medium text-gray-800 dark:text-gray-200 mb-3">Import History</h2>
          {hist.loading && <p className="text-sm text-gray-500">Loading…</p>}
          {hist.error && <p className="text-sm text-red-500">{hist.error}</p>}
          {hist.history && hist.history.data.length === 0 && (
            <p className="text-sm text-gray-500">No imports yet.</p>
          )}
          {hist.history && hist.history.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b dark:border-gray-700">
                    <th className="pb-2 pr-4">Module</th>
                    <th className="pb-2 pr-4">File</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Rows</th>
                    <th className="pb-2 pr-4">Imported</th>
                    <th className="pb-2 pr-4">Failed</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {hist.history.data.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="py-2 pr-4 capitalize">{b.moduleName}</td>
                      <td className="py-2 pr-4 max-w-[160px] truncate" title={b.fileName}>{b.fileName}</td>
                      <td className="py-2 pr-4">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="py-2 pr-4">{b.totalRows}</td>
                      <td className="py-2 pr-4 text-green-600">{b.importedRows}</td>
                      <td className="py-2 pr-4 text-red-500">{b.failedRows}</td>
                      <td className="py-2 text-gray-500">{new Date(b.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Stepper */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Step indicators */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {STEPS.map((s, i) => {
            const active = s.id === bim.step;
            const done = stepIndex(s.id) < currentStepIdx;
            return (
              <div
                key={s.id}
                className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap border-r border-gray-200 dark:border-gray-700 last:border-r-0 flex-shrink-0
                  ${active ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : ''}
                  ${done ? 'text-green-600 dark:text-green-400' : ''}
                  ${!active && !done ? 'text-gray-400 dark:text-gray-500' : ''}
                `}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0
                  ${active ? 'bg-blue-600 text-contrast' : ''}
                  ${done ? 'bg-green-500 text-contrast' : ''}
                  ${!active && !done ? 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400' : ''}
                `}>
                  {done ? '✓' : i + 1}
                </span>
                {s.label}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="p-6">
          {/* Error banner */}
          {bim.error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">{bim.error}</p>
            </div>
          )}

          {/* Step 1: Select module */}
          {bim.step === 'select' && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800 dark:text-gray-200">Choose a module to import</h2>
              {bim.loading && (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {bim.modules.map((m) => (
                  <button
                    key={m.moduleName}
                    onClick={() => bim.selectModule(m.moduleName)}
                    className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left transition-colors"
                  >
                    <FileSpreadsheet className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{m.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Up to {m.maxRows} rows · {m.columns.length} columns</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Download template */}
          {bim.step === 'download' && selectedConfig && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800 dark:text-gray-200">Download the template for <span className="text-blue-600">{selectedConfig.label}</span></h2>
              <p className="text-sm text-gray-500">
                The template includes an Instructions sheet, a Data Entry sheet with sample rows, and a Lookup Values sheet with allowed values.
              </p>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Required columns:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedConfig.columns.filter((c) => c.required).map((c) => (
                    <span key={c.key} className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">{c.header}</span>
                  ))}
                </div>
                {selectedConfig.columns.some((c) => !c.required) && (
                  <>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-3 mb-2">Optional columns:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedConfig.columns.filter((c) => !c.required).map((c) => (
                        <span key={c.key} className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">{c.header}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-contrast rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  <Download className="w-4 h-4" /> Download Template
                </button>
                <button
                  onClick={() => bim.setStep('upload')}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                >
                  Skip <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Upload */}
          {bim.step === 'upload' && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800 dark:text-gray-200">Upload your filled template</h2>
              <div className="mb-3 flex items-center gap-4">
                <label className="text-sm text-gray-600 dark:text-gray-400">Import mode:</label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="valid_only"
                    checked={bim.importMode === 'valid_only'}
                    onChange={() => bim.setImportMode('valid_only')}
                    className="accent-blue-600"
                  />
                  Import valid rows only
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="stop_on_error"
                    checked={bim.importMode === 'stop_on_error'}
                    onChange={() => bim.setImportMode('stop_on_error')}
                    className="accent-blue-600"
                  />
                  Stop on first error
                </label>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                {bim.uploadedFile ? (
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">{bim.uploadedFile.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{(bim.uploadedFile.size / 1024).toFixed(1)} KB · Click to change</p>
                  </div>
                ) : (
                  <>
                    <p className="text-gray-600 dark:text-gray-400">Click to select your Excel file</p>
                    <p className="text-xs text-gray-400 mt-1">.xlsx only · max 5 MB</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) bim.handleFileSelect(f);
                  }}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={bim.validate}
                  disabled={!bim.uploadedFile || bim.loading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-contrast rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {bim.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Validate File
                </button>
                <button
                  onClick={() => bim.setStep('download')}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Validate (loading state) */}
          {bim.step === 'validate' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-gray-600 dark:text-gray-400">Validating your file…</p>
            </div>
          )}

          {/* Step 5: Preview */}
          {bim.step === 'preview' && bim.validation && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800 dark:text-gray-200">Validation Preview</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total Rows" value={bim.validation.totalRows} color="blue" />
                <StatCard label="Valid" value={bim.validation.validRows} color="green" />
                <StatCard label="Invalid" value={bim.validation.invalidRows} color="red" />
                <StatCard label="Will Import" value={bim.importMode === 'valid_only' ? bim.validation.validRows : (bim.validation.invalidRows > 0 ? 0 : bim.validation.totalRows)} color="purple" />
              </div>

              {bim.validation.invalidRows > 0 && (
                <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      {bim.validation.invalidRows} row{bim.validation.invalidRows > 1 ? 's have' : ' has'} errors.
                      {bim.importMode === 'valid_only' ? ' They will be skipped.' : ' Import is blocked.'}
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadErrors}
                    className="text-xs text-amber-700 dark:text-amber-300 underline whitespace-nowrap ml-4"
                  >
                    Download error report
                  </button>
                </div>
              )}

              {/* Row table */}
              <div className="max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-500 w-12">Row</th>
                      <th className="px-3 py-2 text-left text-gray-500">Status</th>
                      <th className="px-3 py-2 text-left text-gray-500">Preview</th>
                      <th className="px-3 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {bim.validation.rows.map((row) => (
                      <>
                        <tr
                          key={row.rowNumber}
                          className={`cursor-pointer ${row.isValid ? 'hover:bg-green-50 dark:hover:bg-green-900/10' : 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20'}`}
                          onClick={() => toggleRow(row.rowNumber)}
                        >
                          <td className="px-3 py-2 text-gray-500">{row.rowNumber}</td>
                          <td className="px-3 py-2">
                            {row.isValid
                              ? <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3 h-3" /> Valid</span>
                              : <span className="flex items-center gap-1 text-red-500"><XCircle className="w-3 h-3" /> {row.errors.length} error{row.errors.length > 1 ? 's' : ''}</span>
                            }
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 truncate max-w-xs">
                            {Object.values(row.rawData).slice(0, 3).map(String).join(' · ')}
                          </td>
                          <td className="px-3 py-2 text-gray-400">
                            {expandedRows.has(row.rowNumber) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </td>
                        </tr>
                        {expandedRows.has(row.rowNumber) && (
                          <tr key={`${row.rowNumber}-detail`} className={row.isValid ? 'bg-green-50/50 dark:bg-green-900/5' : 'bg-red-50/50 dark:bg-red-900/5'}>
                            <td colSpan={4} className="px-3 py-2">
                              {!row.isValid && (
                                <ul className="mb-2 space-y-0.5">
                                  {row.errors.map((e, i) => (
                                    <li key={i} className="flex items-start gap-1 text-red-600 dark:text-red-400">
                                      <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {e}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <div className="flex flex-wrap gap-x-4 gap-y-1">
                                {Object.entries(row.rawData).map(([k, v]) => (
                                  <span key={k} className="text-gray-500 dark:text-gray-400">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">{k}:</span> {String(v) || '—'}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={bim.runImport}
                  disabled={bim.validation.validRows === 0 || bim.loading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-contrast rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {bim.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Import {bim.importMode === 'valid_only' ? bim.validation.validRows : bim.validation.totalRows} Rows
                </button>
                <button
                  onClick={() => bim.setStep('upload')}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                >
                  <ArrowLeft className="w-4 h-4" /> Re-upload
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Importing */}
          {bim.step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
              <p className="text-gray-600 dark:text-gray-400">Importing records…</p>
            </div>
          )}

          {/* Step 7: Result */}
          {bim.step === 'result' && bim.importResult && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800 dark:text-gray-200">Import Complete</h2>
              <div className={`p-4 rounded-lg flex items-start gap-3 ${
                bim.importResult.status === 'COMPLETED' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' :
                bim.importResult.status === 'PARTIAL' ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' :
                'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                {bim.importResult.status === 'COMPLETED'
                  ? <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                  : bim.importResult.status === 'PARTIAL'
                  ? <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                  : <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                }
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200">
                    {bim.importResult.status === 'COMPLETED' ? 'All rows imported successfully' :
                     bim.importResult.status === 'PARTIAL' ? 'Partial import completed' :
                     'Import failed'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {bim.importResult.importedRows} imported · {bim.importResult.failedRows} failed · {bim.importResult.skippedRows} skipped
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total" value={bim.importResult.totalRows} color="blue" />
                <StatCard label="Imported" value={bim.importResult.importedRows} color="green" />
                <StatCard label="Failed" value={bim.importResult.failedRows} color="red" />
                <StatCard label="Skipped" value={bim.importResult.skippedRows} color="gray" />
              </div>

              {(bim.importResult.failedRows > 0 || bim.importResult.skippedRows > 0) && (
                <button
                  onClick={handleDownloadErrors}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <Download className="w-4 h-4" /> Download error report
                </button>
              )}

              <button
                onClick={bim.reset}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-contrast rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                <RotateCcw className="w-4 h-4" /> Start New Import
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    green:  'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    red:    'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
    gray:   'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  };
  return (
    <div className={`rounded-lg p-3 ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-0.5 opacity-80">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    PARTIAL:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    FAILED:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    PENDING:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    IMPORTING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? map.PENDING}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
