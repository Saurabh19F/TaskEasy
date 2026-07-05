export type ImportModuleName = 'delegation' | 'workRequest' | 'checklist' | 'fms';
export type ImportMode = 'valid_only' | 'stop_on_error';

export interface ColumnDef {
  key: string;
  header: string;
  required: boolean;
  type: 'string' | 'email' | 'date' | 'number' | 'enum';
  enumValues?: string[];
  description?: string;
  example?: string;
}

export interface LookupSheet {
  title: string;
  headers: string[];
  /** rows fetched dynamically per-tenant at template generation time */
  dynamicRows?: boolean;
}

export interface ImportModuleConfig {
  moduleName: ImportModuleName;
  label: string;
  requiredPermission: string;
  columns: ColumnDef[];
  lookupSheets: LookupSheet[];
  sampleRows: Record<string, unknown>[];
  maxRows: number;
}

export interface ParsedRow {
  rowNumber: number;
  rawData: Record<string, unknown>;
  normalizedData?: Record<string, unknown>;
  errors: string[];
  isValid: boolean;
}

export interface ValidationResult {
  batchId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ParsedRow[];
}

export interface ImportResult {
  batchId: string;
  totalRows: number;
  importedRows: number;
  failedRows: number;
  skippedRows: number;
  status: string;
}
