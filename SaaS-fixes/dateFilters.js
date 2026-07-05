export function parseDateSafe(input) {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;

  const text = String(input).trim();
  if (!text) return null;

  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct;

  const dmy = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]) - 1;
    const y = Number(dmy[3]);
    const parsed = new Date(y, m, d);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

export function toYmdInt(input) {
  const d = parseDateSafe(input);
  if (!d) return null;
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function calculateDelay(targetDate, completionDate) {
  const target = parseDateSafe(targetDate);
  const actual = completionDate ? parseDateSafe(completionDate) : new Date();

  if (!target || !actual) {
    return { delay: 0, status: 'N/A' };
  }

  target.setHours(0, 0, 0, 0);
  actual.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((actual - target) / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? { delay: diffDays, status: 'Late' } : { delay: 0, status: 'On Time' };
}

export function getDateRangeYmd(filters = {}) {
  const now = new Date();
  const period = (filters.period || 'all').toLowerCase();

  const from = new Date(now);
  const to = new Date(now);

  if (period === 'today') {
    return { from: toYmdInt(now), to: toYmdInt(now) };
  }

  // 'week' or 'this_week' = last 7 days including today
  if (period === 'week' || period === 'this_week') {
    from.setDate(now.getDate() - 6);
    return { from: toYmdInt(from), to: toYmdInt(to) };
  }

  // 'last_week' = the full Mon–Sun week before current week
  if (period === 'last_week') {
    const day = now.getDay(); // 0=Sun, 1=Mon...
    const diffToLastSun = day === 0 ? 7 : day;
    const lastSun = new Date(now);
    lastSun.setDate(now.getDate() - diffToLastSun);
    const lastMon = new Date(lastSun);
    lastMon.setDate(lastSun.getDate() - 6);
    return { from: toYmdInt(lastMon), to: toYmdInt(lastSun) };
  }

  // 'month' or 'this_month' = 1st of current month to today
  if (period === 'month' || period === 'this_month') {
    from.setDate(1);
    return { from: toYmdInt(from), to: toYmdInt(to) };
  }

  // 'last_month' = 1st to last day of previous month
  if (period === 'last_month') {
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastOfPrevMonth = new Date(firstOfThisMonth);
    lastOfPrevMonth.setDate(lastOfPrevMonth.getDate() - 1);
    const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1);
    return { from: toYmdInt(firstOfPrevMonth), to: toYmdInt(lastOfPrevMonth) };
  }

  if (period === 'custom') {
    const fromDate = parseDateSafe(filters.fromDate || filters.dateFrom);
    const toDate = parseDateSafe(filters.toDate || filters.dateTo);
    if (fromDate && toDate) {
      return { from: toYmdInt(fromDate), to: toYmdInt(toDate) };
    }
  }

  return { from: null, to: null };
}

export function isDateInRange(input, from, to) {
  if (!from || !to) return true;
  const value = toYmdInt(input);
  if (!value) return false;
  return value >= from && value <= to;
}
