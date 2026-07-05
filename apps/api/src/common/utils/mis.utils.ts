export type MisGrade = 'A_PLUS' | 'A' | 'B' | 'C' | 'D' | 'N_A';

export interface MisMetrics {
  total: number;
  completed: number;
  late: number;
  onTime: number;
  reworkCount: number;
  delayDays: number;
}

/**
 * Scoring formula:
 *   onTimePercent  → 50% weight
 *   completionRate → 30% weight
 *   reworkPenalty  → -10% per rework (capped at -20%)
 *   delayPenalty   → -1% per avg delay day (capped at -20%)
 *
 * Final score 0-100.
 */
/**
 * Returns null when total=0 so callers can distinguish "no data" from
 * "genuinely poor performance" (BUG-10 fix — previously returned 0 which
 * mapped to grade D, unfairly penalising employees with no assigned tasks).
 */
export function calculateMisScore(metrics: MisMetrics): number | null {
  if (metrics.total === 0) return null;

  const completionRate = (metrics.completed / metrics.total) * 100;
  const onTimePercent = metrics.total > 0
    ? (metrics.onTime / metrics.total) * 100
    : 0;

  const reworkPenalty = Math.min(metrics.reworkCount * 10, 20);
  const avgDelay = metrics.completed > 0 ? metrics.delayDays / metrics.completed : 0;
  const delayPenalty = Math.min(avgDelay, 20);

  const score =
    onTimePercent * 0.5 +
    completionRate * 0.3 -
    reworkPenalty -
    delayPenalty;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function scoreToGrade(score: number | null): MisGrade {
  if (score === null) return 'N_A';
  if (score >= 90) return 'A_PLUS';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}
