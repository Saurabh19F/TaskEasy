import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

// ─── Tailwind class merging ───────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Date formatting ──────────────────────────────────────────────────────────

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return format(d, 'dd MMM yyyy');
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return format(d, 'dd MMM yyyy, hh:mm a');
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return formatDistanceToNow(d, { addSuffix: true });
}

export function isOverdue(date: string | Date): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d || Number.isNaN(d.getTime())) return false;
  return d < new Date();
}

// ─── Status colours ───────────────────────────────────────────────────────────

export const STATUS_COLORS: Record<string, string> = {
  PENDING:              'bg-warning/20 text-warning-foreground',
  IN_PROGRESS:          'bg-primary/15 text-primary',
  SEND_FOR_APPROVAL:    'bg-primary/15 text-primary',
  REWORK:               'bg-brand/15 text-brand',
  COMPLETED:            'bg-success/20 text-success-foreground',
  LATE:                 'bg-danger/15 text-danger',
  ACTIVE:               'bg-success/20 text-success-foreground',
  INACTIVE:             'bg-surface-muted text-muted-foreground',
  PAUSED:               'bg-surface-muted text-muted-foreground',
};

export const PRIORITY_COLORS: Record<string, string> = {
  LOW:      'bg-surface-muted text-muted-foreground',
  MEDIUM:   'bg-primary/15 text-primary',
  HIGH:     'bg-warning/20 text-warning-foreground',
  URGENT:   'bg-brand/15 text-brand',
  CRITICAL: 'bg-brand/20 text-brand font-bold',
};

export const GRADE_COLORS: Record<string, string> = {
  A_PLUS: 'text-success-foreground',
  A:      'text-success-foreground',
  B:      'text-warning-foreground',
  C:      'text-brand',
  D:      'text-danger',
};

// ─── Number helpers ───────────────────────────────────────────────────────────

export function percentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

export function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ─── File size ────────────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Export helpers ───────────────────────────────────────────────────────────

export function exportToExcel(data: Record<string, any>[], filename: string) {
  import('xlsx').then((XLSX) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  });
}

export function exportToPdf(
  columns: string[],
  rows: (string | number)[][],
  filename: string,
  title?: string,
) {
  import('jspdf').then(async ({ default: jsPDF }) => {
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    if (title) {
      doc.setFontSize(14);
      doc.text(title, 14, 16);
    }
    autoTable(doc, {
      head: [columns],
      body: rows,
      startY: title ? 24 : 14,
    });
    doc.save(`${filename}.pdf`);
  });
}
