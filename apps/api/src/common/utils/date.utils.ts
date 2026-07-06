import { isBefore, isAfter, startOfDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export interface CompanyCalendar {
  timezone: string;
  workingDays: number[]; // 1=Mon, 2=Tue, ... 7=Sun
  workingHoursStart: string; // "09:00"
  workingHoursEnd: string;   // "18:00"
  holidays: Date[];
}

/**
 * Calculate working-day delay between planned and actual completion.
 * Excludes weekends, holidays, and non-working hours.
 */
export function calculateDelay(
  plannedDate: Date,
  actualDate: Date,
  calendar: CompanyCalendar,
): { delayDays: number; onTimeStatus: 'ON_TIME' | 'LATE' } {
  const { timezone } = calendar;

  const planned = toZonedTime(plannedDate, timezone);
  const actual = toZonedTime(actualDate, timezone);

  if (!isAfter(actual, planned)) {
    return { delayDays: 0, onTimeStatus: 'ON_TIME' };
  }

  // Count working days between planned and actual
  let workingDaysDelayed = 0;
  let current = startOfDay(planned);
  const end = startOfDay(actual);

  while (isBefore(current, end)) {
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    const dayOfWeek = current.getDay() === 0 ? 7 : current.getDay(); // 1-7
    const isWorkingDay = calendar.workingDays.includes(dayOfWeek);
    const isHoliday = calendar.holidays.some(
      (h) => startOfDay(toZonedTime(h, timezone)).getTime() === startOfDay(current).getTime(),
    );
    if (isWorkingDay && !isHoliday) {
      workingDaysDelayed++;
    }
  }

  return {
    delayDays: workingDaysDelayed,
    onTimeStatus: workingDaysDelayed > 0 ? 'LATE' : 'ON_TIME',
  };
}

/**
 * Check if a task is overdue (planned date passed, not yet completed).
 * Both timestamps are compared in UTC — plannedDate is already stored as
 * UTC in the DB, and Date.now() is UTC. The timezone param is kept for
 * signature compatibility but the comparison is timezone-agnostic.
 * (Previously `now` was shifted to the tenant timezone but `plannedDate`
 * was not, producing an incorrect comparison offset by the UTC offset.)
 */
export function isOverdue(plannedDate: Date, status: string, _timezone?: string): boolean {
  if (['COMPLETED', 'CANCELLED'].includes(status)) return false;
  return isAfter(new Date(), plannedDate);
}

/**
 * Convert a frontend date string (YYYY-MM-DD) + time string (HH:mm)
 * to a UTC Date safely, interpreting the wall-clock time in the given
 * company timezone.
 *
 * FIX (BUG-03): Previously used `new Date(y, m, d, h, min)` which
 * constructs a date in the Node process's local timezone (often UTC in
 * Docker). `fromZonedTime` then re-interpreted those same numeric values
 * as IST/etc., producing a double-shift. The correct approach is to build
 * a plain ISO string — its components are unambiguously the wall-clock
 * time — and let `fromZonedTime` convert that single representation from
 * the tenant timezone to UTC.
 */
export function parseFrontendDateTime(
  dateStr: string,
  timeStr: string,
  timezone: string,
): Date {
  // e.g. "2026-12-31T17:00:00" treated as wall-clock time in `timezone`
  const localIso = `${dateStr}T${timeStr}:00`;
  return fromZonedTime(localIso, timezone);
}

/**
 * Get the next occurrence date for a recurring checklist frequency.
 *
 * NOTE: ONE_TIME is intentionally not advanced here — a one-time checklist
 * has exactly one planned occurrence (its master's startDate) and must never
 * be re-generated. Callers (ChecklistGeneratorService) must check for
 * ONE_TIME *before* calling this function and skip masters that already
 * have a task. This function returns `from` unchanged for ONE_TIME as a
 * safety net so that even a caller that forgets that check cannot spin into
 * generating a new task every single day forever.
 */
export function getNextPlannedDate(frequency: string, from: Date): Date {
  const next = new Date(from);
  switch (frequency) {
    case 'DAILY':       next.setDate(next.getDate() + 1); break;
    case 'WEEKLY':      next.setDate(next.getDate() + 7); break;
    case 'FORTNIGHTLY': next.setDate(next.getDate() + 14); break;
    case 'MONTHLY':     next.setMonth(next.getMonth() + 1); break;
    case 'QUARTERLY':   next.setMonth(next.getMonth() + 3); break;
    case 'HALF_YEARLY': next.setMonth(next.getMonth() + 6); break;
    case 'YEARLY':      next.setFullYear(next.getFullYear() + 1); break;
    case 'ONE_TIME':    return new Date(from);
    default:            next.setDate(next.getDate() + 1);
  }
  return next;
}

export function isHolidayDate(date: Date, holidays: Date[], timezone = 'UTC'): boolean {
  const d = startOfDay(toZonedTime(date, timezone));
  return holidays.some(
    (h) => startOfDay(toZonedTime(h, timezone)).getTime() === d.getTime(),
  );
}

export function skipToNextWorkingDay(
  date: Date,
  workingDays: number[],
  holidays: Date[],
  timezone = 'UTC',
): Date {
  let current = new Date(date);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const dayOfWeek = current.getDay() === 0 ? 7 : current.getDay();
    if (workingDays.includes(dayOfWeek) && !isHolidayDate(current, holidays, timezone)) {
      return current;
    }
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
  }
}

export function getPeriodRange(
  period: string,
  timezone = 'UTC',
): { from: Date; to: Date } | null {
  const now = toZonedTime(new Date(), timezone);
  const today = startOfDay(now);

  switch (period) {
    case 'ALL':
      return { from: new Date('2000-01-01T00:00:00.000Z'), to: new Date('2099-12-31T23:59:59.999Z') };

    case 'TODAY':
      return { from: today, to: new Date(today.getTime() + 86400000 - 1) };

    case 'THIS_WEEK': {
      const dayOfWeek = now.getDay(); // 0=Sun
      const monday = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 86400000);
      const sunday = new Date(monday.getTime() + 6 * 86400000 + 86400000 - 1);
      return { from: monday, to: sunday };
    }

    case 'LAST_WEEK': {
      const dayOfWeek = now.getDay();
      const thisMonday = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 86400000);
      const lastMonday = new Date(thisMonday.getTime() - 7 * 86400000);
      const lastSunday = new Date(thisMonday.getTime() - 1);
      return { from: lastMonday, to: lastSunday };
    }

    case 'THIS_MONTH': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { from: firstDay, to: lastDay };
    }

    case 'LAST_MONTH': {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from: firstDay, to: lastDay };
    }

    default:
      return null;
  }
}
