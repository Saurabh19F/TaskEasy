// ─── Date utilities ───────────────────────────────────────────────────────────

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...opts,
  }).format(new Date(date));
}

export function isOverdue(date: string | Date): boolean {
  return new Date(date) < new Date();
}

export function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / 86_400_000);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ─── String utilities ─────────────────────────────────────────────────────────

export function truncate(str: string, maxLen: number): string {
  return str.length <= maxLen ? str : `${str.slice(0, maxLen)}…`;
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// ─── Number utilities ─────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function percentage(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

// ─── Grade colors ─────────────────────────────────────────────────────────────

export function gradeColor(grade: string): string {
  const map: Record<string, string> = {
    A_PLUS: '#16a34a',
    A: '#22c55e',
    B: '#3b82f6',
    C: '#f59e0b',
    D: '#ef4444',
  };
  return map[grade] ?? '#94a3b8';
}

// ─── Priority sort weight ─────────────────────────────────────────────────────

export function priorityWeight(priority: string): number {
  const map: Record<string, number> = {
    CRITICAL: 5, URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1,
  };
  return map[priority] ?? 0;
}
