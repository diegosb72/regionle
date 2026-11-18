/**
 * What the Progress page draws from the days kept (`days.ts`): the calendar of activity, the weeks of the
 * chart, what each month and each year add up to and how what is learnt has grown. Kept apart from
 * `days.ts` so that the first page does not carry it.
 */
import type { DayRec, Days } from './days';
import { addDays } from './goals';

/** How full a day was, from 0 (nothing) to 4, for the shade of its square on the calendar. */
export function dayLevel(rec: DayRec | undefined): 0 | 1 | 2 | 3 | 4 {
  const answers = rec ? Math.max(rec[1], 1) : 0;
  return answers === 0 ? 0 : answers < 10 ? 1 : answers < 30 ? 2 : answers < 60 ? 3 : 4;
}

export interface CalendarDay {
  /** "2026-11-18" */
  day: string;
  rec?: DayRec;
  level: 0 | 1 | 2 | 3 | 4;
  /** A day that has not come yet: the rest of the week of today. */
  future: boolean;
}

/**
 * The squares of the calendar: `weeks` whole weeks from Monday to Sunday, the last one being that of
 * `day`, each week a column from top to bottom.
 */
export function calendarOf(days: Days, day: string, weeks: number): CalendarDay[][] {
  // 0 on a Monday … 6 on a Sunday.
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  const first = addDays(day, -weekday - 7 * (weeks - 1));
  const out: CalendarDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const at = addDays(first, w * 7 + d);
      const rec = days[at];
      col.push({ day: at, rec, level: dayLevel(rec), future: at > day });
    }
    out.push(col);
  }
  return out;
}

/** What some days add up to. */
export interface Span {
  /** Days with something done. */
  days: number;
  games: number;
  answers: number;
  /** Right first time. */
  ok: number;
  ms: number;
  /** Days that met their target. */
  met: number;
  /** The day with most answers; the earliest of them when several tie. */
  top?: { day: string; answers: number };
}

/** What the days from one to another, both included, add up to. */
export function sumDays(days: Days, from: string, to: string): Span {
  const out: Span = { days: 0, games: 0, answers: 0, ok: 0, ms: 0, met: 0 };
  for (const day of Object.keys(days).sort()) {
    if (day < from || day > to) continue;
    const [g, q, ok, ms, met] = days[day];
    out.days++;
    out.games += g;
    out.answers += q;
    out.ok += ok;
    out.ms += ms;
    out.met += met ? 1 : 0;
    if (q > 0 && (!out.top || q > out.top.answers)) out.top = { day, answers: q };
  }
  return out;
}

export interface WeekSum extends Span {
  /** The Monday it starts on. */
  from: string;
}

/** Week by week, from Monday to Sunday: `weeks` of them, the last one being that of `day`. */
export function weeksOf(days: Days, day: string, weeks: number): WeekSum[] {
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  const first = addDays(day, -weekday - 7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) => {
    const from = addDays(first, w * 7);
    return { from, ...sumDays(days, from, addDays(from, 6)) };
  });
}

export interface MonthSum extends Span {
  /** "2026-11" */
  month: string;
}

/** Month by month, the newest first: from the month of `day` back to the oldest with something kept, the empty ones in between included. */
export function monthsOf(days: Days, day: string): MonthSum[] {
  const keys = Object.keys(days).sort();
  const last = day.slice(0, 7);
  const first = keys.length && keys[0].slice(0, 7) < last ? keys[0].slice(0, 7) : last;
  const out: MonthSum[] = [];
  let [y, m] = last.split('-').map(Number);
  for (;;) {
    const month = `${y}-${String(m).padStart(2, '0')}`;
    out.push({ month, ...sumDays(days, `${month}-01`, `${month}-31`) });
    if (month <= first) break;
    if (--m === 0) {
      m = 12;
      y--;
    }
  }
  return out;
}

/** What each year adds up to, the newest first: only the years with something kept, and that of `day`. */
export function yearsOf(days: Days, day: string): (Span & { year: string })[] {
  const years = new Set([day.slice(0, 4), ...Object.keys(days).map((k) => k.slice(0, 4))]);
  return [...years]
    .sort()
    .reverse()
    .map((year) => ({ year, ...sumDays(days, `${year}-01-01`, `${year}-12-31`) }));
}

/**
 * How many answers were learnt, day by day, on the days that wrote it down: the oldest first. Given
 * `now`, today and what is learnt at this moment, that is the last of them whatever today wrote down: an
 * answer can be learnt, or lost, in a game that was left unfinished. It is also where a player from
 * before the figure was kept starts.
 */
export function learntOver(days: Days, now?: { day: string; learnt: number }): { day: string; learnt: number }[] {
  const out: { day: string; learnt: number }[] = [];
  for (const day of Object.keys(days).sort()) {
    if (now && day >= now.day) break;
    const learnt = days[day][5];
    if (learnt != null) out.push({ day, learnt });
  }
  if (now) out.push(now);
  return out;
}

/** A round number at or above `max` to draw a scale up to, and the step between its lines: 0, 50, 100, 150, 200 for 163. */
export function scaleFor(max: number, lines = 4): { top: number; step: number } {
  if (!(max > 0)) return { top: lines, step: 1 };
  const rough = max / lines;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((k) => k * pow).find((k) => k >= rough) ?? 10 * pow);
  const whole = Math.ceil(step);
  return { top: whole * Math.ceil(max / whole), step: whole };
}
