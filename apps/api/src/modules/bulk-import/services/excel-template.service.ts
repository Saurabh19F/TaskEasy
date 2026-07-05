import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ImportModuleConfig, ColumnDef } from '../interfaces/import.interfaces';

interface TenantLookup {
  users: Array<{ name: string; email: string }>;
  projects?: string[];
}

@Injectable()
export class ExcelTemplateService {
  generate(config: ImportModuleConfig, lookup: TenantLookup): Buffer {
    const wb = XLSX.utils.book_new();

    this.addInstructionsSheet(wb, config);
    this.addDataEntrySheet(wb, config);
    this.addLookupSheet(wb, config, lookup);

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  private addInstructionsSheet(wb: XLSX.WorkBook, config: ImportModuleConfig) {
    const rows: unknown[][] = [
      [`${config.label} — Bulk Import Template`],
      [],
      ['INSTRUCTIONS'],
      ['1. Use the "Data Entry" sheet to enter your data.'],
      ['2. Do not modify the column headers.'],
      [`3. Maximum ${config.maxRows} data rows per import.`],
      ['4. Date format: YYYY-MM-DD (e.g. 2026-07-15).'],
      ['5. Required fields are marked with * in the Data Entry sheet.'],
      ['6. Use the "Lookup Values" sheet for allowed values in dropdown columns.'],
      [],
      ['COLUMN REFERENCE'],
      ['Column', 'Required', 'Type', 'Description', 'Example'],
    ];

    for (const col of config.columns) {
      rows.push([
        col.header + (col.required ? ' *' : ''),
        col.required ? 'Yes' : 'No',
        col.type === 'enum' ? col.enumValues!.join(' | ') : col.type,
        col.description || '',
        col.example || '',
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 30 }, { wch: 40 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Instructions');
  }

  private addDataEntrySheet(wb: XLSX.WorkBook, config: ImportModuleConfig) {
    const headers = config.columns.map((c) => c.header + (c.required ? ' *' : ''));
    const rows: unknown[][] = [headers];

    for (const sample of config.sampleRows) {
      rows.push(config.columns.map((c) => sample[c.key] ?? ''));
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = config.columns.map(() => ({ wch: 25 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Data Entry');
  }

  private addLookupSheet(wb: XLSX.WorkBook, config: ImportModuleConfig, lookup: TenantLookup) {
    const rows: unknown[][] = [['Lookup Values — Reference Only']];

    for (const sheet of config.lookupSheets) {
      rows.push([]);
      rows.push([sheet.title]);
      rows.push(sheet.headers);

      if (sheet.title === 'Users' || sheet.title.toLowerCase().includes('user')) {
        for (const u of lookup.users) {
          rows.push([u.name, u.email]);
        }
      } else if (sheet.title === 'Projects' && lookup.projects) {
        for (const p of lookup.projects) {
          rows.push([p]);
        }
      } else if (sheet.title === 'Priority Values') {
        for (const v of ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) {
          rows.push([v]);
        }
      } else if (sheet.title === 'Frequency Values') {
        for (const v of ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']) {
          rows.push([v]);
        }
      } else {
        const enumCol = config.columns.find((c) =>
          c.type === 'enum' && c.header.toLowerCase().includes(sheet.title.toLowerCase().split(' ')[0]),
        );
        if (enumCol?.enumValues) {
          for (const v of enumCol.enumValues) rows.push([v]);
        }
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Lookup Values');
  }

  generateErrorReport(
    config: ImportModuleConfig,
    rows: Array<{ rowNumber: number; rawData: Record<string, unknown>; errors: string[] }>,
  ): Buffer {
    const wb = XLSX.utils.book_new();

    const headers = ['Row #', ...config.columns.map((c) => c.header), 'Errors'];
    const data: unknown[][] = [headers];

    for (const row of rows) {
      data.push([
        row.rowNumber,
        ...config.columns.map((c) => row.rawData[c.key] ?? ''),
        row.errors.join('; '),
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 8 }, ...config.columns.map(() => ({ wch: 22 })), { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Errors');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
