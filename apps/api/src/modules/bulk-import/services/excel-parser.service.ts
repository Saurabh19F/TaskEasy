import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ImportModuleConfig, ParsedRow } from '../interfaces/import.interfaces';

@Injectable()
export class ExcelParserService {
  parse(buffer: Buffer, config: ImportModuleConfig): ParsedRow[] {
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    } catch {
      throw new BadRequestException('Invalid Excel file. Please use the provided template.');
    }

    const sheet = wb.Sheets['Data Entry'];
    if (!sheet) {
      throw new BadRequestException('Sheet "Data Entry" not found. Please use the provided template.');
    }

    const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (raw.length < 2) return [];

    const headerRow = (raw[0] as string[]).map((h) => String(h).replace(/\s*\*$/, '').trim());
    const expectedHeaders = config.columns.map((c) => c.header);

    const missing = expectedHeaders.filter((h) => !headerRow.includes(h));
    if (missing.length > 0) {
      throw new BadRequestException(`Missing columns: ${missing.join(', ')}. Please use the provided template.`);
    }

    const colIndex: Record<string, number> = {};
    for (const col of config.columns) {
      colIndex[col.key] = headerRow.indexOf(col.header);
    }

    const parsed: ParsedRow[] = [];

    for (let i = 1; i < raw.length; i++) {
      const rowArr = raw[i] as unknown[];

      const allEmpty = config.columns.every((c) => {
        const val = rowArr[colIndex[c.key]];
        return val === undefined || val === null || String(val).trim() === '';
      });
      if (allEmpty) continue;

      const rowData: Record<string, unknown> = {};
      for (const col of config.columns) {
        const raw = rowArr[colIndex[col.key]];
        rowData[col.key] = this.coerce(raw, col.type);
      }

      parsed.push({
        rowNumber: i + 1,
        rawData: rowData,
        errors: [],
        isValid: false,
      });
    }

    if (parsed.length > config.maxRows) {
      throw new BadRequestException(`File exceeds maximum of ${config.maxRows} rows.`);
    }

    return parsed;
  }

  private coerce(value: unknown, type: string): unknown {
    if (value === undefined || value === null || value === '') return '';

    if (type === 'date') {
      if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
      }
      const s = String(value).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      return s;
    }

    if (type === 'number') {
      const n = Number(value);
      return isNaN(n) ? value : n;
    }

    return String(value).trim();
  }
}
