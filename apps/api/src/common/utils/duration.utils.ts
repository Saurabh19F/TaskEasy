/**
 * Parse a human-friendly duration string into milliseconds.
 * Supports values such as `500ms`, `15m`, `7d`, or a plain millisecond number.
 */
export function parseDurationToMs(value: string | number | undefined | null, fallbackMs: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }

  const input = String(value ?? '').trim().toLowerCase();
  if (!input) return fallbackMs;

  const numeric = Number(input);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return numeric;
  }

  const match = input.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d|w)$/);
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
}
