'use client';

import { useState, useCallback } from 'react';
import {
  bulkImportApi,
  ImportModuleName,
  ImportMode,
  ValidationResult,
  ImportResult,
  ImportModuleInfo,
  ImportBatchSummary,
} from '@/lib/api';
import { PaginatedResponse } from '@/types';

export type BulkImportStep =
  | 'select'
  | 'download'
  | 'upload'
  | 'validate'
  | 'preview'
  | 'importing'
  | 'result';

export function useBulkImport() {
  const [step, setStep] = useState<BulkImportStep>('select');
  const [modules, setModules] = useState<ImportModuleInfo[]>([]);
  const [selectedModule, setSelectedModule] = useState<ImportModuleName | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('valid_only');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadModules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bulkImportApi.listModules();
      setModules(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load modules');
    } finally {
      setLoading(false);
    }
  }, []);

  const selectModule = useCallback((name: ImportModuleName) => {
    setSelectedModule(name);
    setValidation(null);
    setImportResult(null);
    setUploadedFile(null);
    setError(null);
    setStep('download');
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    setUploadedFile(file);
    setStep('upload');
  }, []);

  const validate = useCallback(async () => {
    if (!selectedModule || !uploadedFile) return;
    setLoading(true);
    setError(null);
    setStep('validate');
    try {
      const result = await bulkImportApi.validate(selectedModule, uploadedFile, importMode);
      setValidation(result);
      setStep('preview');
    } catch (e: any) {
      setError(e?.message ?? 'Validation failed');
      setStep('upload');
    } finally {
      setLoading(false);
    }
  }, [selectedModule, uploadedFile, importMode]);

  const runImport = useCallback(async () => {
    if (!validation) return;
    setLoading(true);
    setError(null);
    setStep('importing');
    try {
      const result = await bulkImportApi.importBatch(validation.batchId);
      setImportResult(result);
      setStep('result');
    } catch (e: any) {
      setError(e?.message ?? 'Import failed');
      setStep('preview');
    } finally {
      setLoading(false);
    }
  }, [validation]);

  const reset = useCallback(() => {
    setStep('select');
    setSelectedModule(null);
    setUploadedFile(null);
    setValidation(null);
    setImportResult(null);
    setError(null);
  }, []);

  return {
    step, setStep,
    modules, loadModules,
    selectedModule, selectModule,
    importMode, setImportMode,
    uploadedFile, handleFileSelect,
    validation,
    importResult,
    loading, error,
    validate, runImport, reset,
  };
}

export function useBulkImportHistory(params?: { module?: ImportModuleName; page?: number }) {
  const [history, setHistory] = useState<PaginatedResponse<ImportBatchSummary> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bulkImportApi.getHistory(params);
      setHistory(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [params?.module, params?.page]);

  return { history, load, loading, error };
}
