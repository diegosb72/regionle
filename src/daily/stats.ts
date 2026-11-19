/**
 * Figures of the daily challenge, read from the results that are kept: how many were finished, how they
 * went and which of the five tests goes best. Nothing here is stored.
 */
import { TESTS, isDate, streakState, totalOf, type DailyRec } from './spec';

/** The totals are sorted into five bands: 0–19, 20–39, 40–59, 60–79 and 80–100. */
export const BAND = 20;
export const BANDS = 5;
export const bandOf = (total: number): number => Math.max(0, Math.min(BANDS - 1, Math.floor(total / BAND)));
/** "80–100", "0–19". */
export const bandLabel = (band: number): string => `${band * BAND}–${band === BANDS - 1 ? 100 : band * BAND + BAND - 1}`;

/** How many of the latest challenges the "lately" figure looks at. */
export const RECENT = 7;

export interface TestStats {
  /** Points of this test on average, of 20. */
  mean: number;
  /** Times it got the twenty points. */
  full: number;
  /** Times it got none. */
  zero: number;
}

export interface DailyStats {
  /** Challenges finished, on their day or later. */
  played: number;
  /** Of them, those finished after their day. */
  late: number;
  /** How many of them were played the hard way. */
  hard: number;
  /** Points on average, of 100. */
  mean: number;
  /** The best total, and the first day it was reached. */
  best: { date: string; total: number } | null;
  /** How many totals fell in each band. */
  bands: number[];
  /** Each of the five tests. */
  tests: TestStats[];
  /** The average of the latest challenges, once more than those have been played. */
  recent: number | null;
  /** Days in a row today, the longest they have been, and the wildcards in hand and spent. */
  streak: number;
  longest: number;
  jokers: number;
  held: number;
  /** The first day with a challenge finished. */
  since: string | null;
}

const average = (list: readonly number[]): number => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);

export function dailyStats(daily: Record<string, DailyRec>, now: string): DailyStats {
  const dates = Object.keys(daily)
    .filter((d) => isDate(d) && !!daily[d]?.t && Array.isArray(daily[d].p))
    .sort();
  const totals = dates.map((d) => totalOf(daily[d]));
  const bands = Array.from({ length: BANDS }, () => 0);
  for (const t of totals) bands[bandOf(t)]++;
  let best: DailyStats['best'] = null;
  dates.forEach((date, i) => {
    if (!best || totals[i] > best.total) best = { date, total: totals[i] };
  });
  const tests: TestStats[] = Array.from({ length: TESTS }, (_, i) => {
    const points = dates.map((d) => daily[d].p[i] ?? 0);
    return { mean: average(points), full: points.filter((p) => p >= 20).length, zero: points.filter((p) => p <= 0).length };
  });
  const run = streakState(daily, now);
  return {
    played: dates.length,
    late: dates.filter((d) => daily[d].late).length,
    hard: dates.filter((d) => daily[d].h === 1).length,
    mean: average(totals),
    best,
    bands,
    tests,
    recent: dates.length > RECENT ? average(totals.slice(-RECENT)) : null,
    streak: run.days,
    longest: run.longest,
    jokers: run.jokers,
    held: Object.keys(daily).filter((d) => isDate(d) && daily[d]?.j === 1 && !(daily[d].t && !daily[d].late)).length,
    since: dates[0] ?? null,
  };
}

/**
 * The test that goes best and the one that goes worst, by their averages: `null` while there is too little
 * to say (fewer than three challenges) or when they all go the same.
 */
export function extremes(tests: readonly TestStats[], played: number): { best: number; worst: number } | null {
  if (played < 3 || !tests.length) return null;
  let best = 0;
  let worst = 0;
  tests.forEach((t, i) => {
    if (t.mean > tests[best].mean) best = i;
    if (t.mean < tests[worst].mean) worst = i;
  });
  return tests[best].mean - tests[worst].mean >= 1 ? { best, worst } : null;
}
