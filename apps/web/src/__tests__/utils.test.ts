/**
 * Unit tests for apps/web/src/lib/utils.ts
 * Run with: npx jest src/__tests__/utils.test.ts
 */

import { cn, formatDate, formatDateTime, isOverdue, percentage, formatFileSize } from '@/lib/utils';

// ─── cn() ─────────────────────────────────────────────────────────────────────

describe('cn()', () => {
  it('joins class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('drops falsy values', () => {
    expect(cn('foo', undefined, null as any, false as any, 'bar')).toBe('foo bar');
  });

  it('merges conflicting tailwind classes (last wins)', () => {
    // twMerge: p-2 overrides p-4
    const result = cn('p-4', 'p-2');
    expect(result).toBe('p-2');
  });

  it('handles conditional objects', () => {
    expect(cn({ 'text-red-500': true, 'text-blue-500': false })).toBe('text-red-500');
  });

  it('handles arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });
});

// ─── formatDate() ─────────────────────────────────────────────────────────────

describe('formatDate()', () => {
  it('formats ISO string to dd MMM yyyy', () => {
    expect(formatDate('2024-06-15T00:00:00.000Z')).toBe('15 Jun 2024');
  });

  it('accepts a Date object', () => {
    // Using a fixed UTC date avoids timezone issues
    const d = new Date('2024-01-01T12:00:00.000Z');
    // Result depends on local TZ — just check it's a non-empty string matching the pattern
    expect(formatDate(d)).toMatch(/\d{2} \w{3} \d{4}/);
  });
});

// ─── formatDateTime() ─────────────────────────────────────────────────────────

describe('formatDateTime()', () => {
  it('includes time component', () => {
    const result = formatDateTime('2024-06-15T14:30:00.000Z');
    // Should contain 'Jun 2024' and time in hh:mm a format
    expect(result).toMatch(/Jun 2024/);
    expect(result).toMatch(/\d{2}:\d{2} [AP]M/);
  });
});

// ─── isOverdue() ──────────────────────────────────────────────────────────────

describe('isOverdue()', () => {
  it('returns true for a date in the past', () => {
    expect(isOverdue('2000-01-01T00:00:00.000Z')).toBe(true);
  });

  it('returns false for a date in the future', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
    expect(isOverdue(future)).toBe(false);
  });

  it('accepts a Date object', () => {
    expect(isOverdue(new Date('2000-01-01'))).toBe(true);
  });
});

// ─── percentage() ─────────────────────────────────────────────────────────────

describe('percentage()', () => {
  it('calculates correct percentage', () => {
    expect(percentage(25, 100)).toBe(25);
    expect(percentage(1, 3)).toBe(33);
    expect(percentage(2, 3)).toBe(67);
  });

  it('returns 0 when total is 0', () => {
    expect(percentage(10, 0)).toBe(0);
  });

  it('rounds to nearest integer', () => {
    expect(percentage(1, 6)).toBe(17); // 16.67 → 17
  });
});

// ─── formatFileSize() ─────────────────────────────────────────────────────────

describe('formatFileSize()', () => {
  it('formats bytes below 1 KB', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('formats KB', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  it('formats MB', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('handles exact 1 KB boundary', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });
});
