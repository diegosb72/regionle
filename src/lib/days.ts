/**
 * What was done each day. The sessions are no good for this: only the latest are kept. The calendar of
 * activity, the run of days in a row, the daily target, the charts of how it goes and the summary of
 * each month and year are all read from here.
 */
import { addDays, daysBetween, isDay } from './goals';
import { today } from './text';

/**
 * [games finished, questions answered, right first time, milliseconds played, 1 once the target of the day
 * was met, answers learnt when the last game of the day ended]. The last one is missing on the days from
 * before it was written down.
 */
export type DayRec = [number, number, number, number, number, number?];
export type Days = Record<string, DayRec>;

/** Days kept: two years of calendar and some more; the oldest go first. */
export const DAYS_MAX = 800;

/** Answers a day to aim at, for the player to choose from; 0 is no goal at all. */
export const DAY_GOALS = [0, 10, 20, 50, 100] as const;
export const DAY_GOAL_DEFAULT = 20;

/** The daily challenge is five tests that add up to thirteen questions: one, five, one, one and five. */
export const DAILY_ANSWERS = 13;

export const isDayGoal = (n: unknown): n is number => typeof n === 'number' && (DAY_GOALS as readonly number[]).includes(n);

/** What a game adds to its day. */
export interface DayWork {
  total: number;
  ok: number;
  ms: number;
}

/**
 * The days with a game added to the day it ended on. A target met stays met: changing the target later
 * does not take back the days that reached the one there was. `learnt` is how many answers are learnt now
 * that the game has ended.
 */
export function withDay(days: Days, t: number, work: DayWork, goal = 0, learnt?: number): Days {
  const key = today(new Date(t));
  const [g, q, ok, ms, met, known] = days[key] ?? [0, 0, 0, 0, 0];
  const answers = q + Math.max(0, work.total);
  const rec: DayRec = [g + 1, answers, ok + Math.max(0, work.ok), ms + Math.max(0, work.ms), met || (goal > 0 && answers >= goal) ? 1 : 0];
  const now = learnt ?? known;
  if (now != null) rec.push(now);
  const next: Days = { ...days, [key]: rec };
  const keys = Object.keys(next);
  if (keys.length > DAYS_MAX) for (const old of keys.sort().slice(0, keys.length - DAYS_MAX)) delete next[old];
  return next;
}

/** A completed daily challenge, as the work of the day it was finished on: its questions, and of them the share its points say. */
export const dailyWork = (points: readonly (number | null | undefined)[]): DayWork => {
  const sum = points.reduce<number>((n, p) => n + (p ?? 0), 0);
  return { total: DAILY_ANSWERS, ok: Math.round((DAILY_ANSWERS * Math.max(0, Math.min(100, sum))) / 100), ms: 0 };
};

/**
 * Where a player from before the calendar starts: what the sessions still kept and the daily challenges
 * completed add up to, day by day. No day counts as a goal met: there was no goal then.
 */
export function daysFrom(sessions: readonly (DayWork & { t: number })[], daily: Record<string, { p?: (number | null)[]; t?: number }> = {}): Days {
  let days: Days = {};
  for (const r of sessions) if (r && Number.isFinite(r.t)) days = withDay(days, r.t, { total: Number(r.total) || 0, ok: Number(r.ok) || 0, ms: Number(r.ms) || 0 });
  for (const d of Object.values(daily)) if (d && typeof d.t === 'number' && Number.isFinite(d.t)) days = withDay(days, d.t, dailyWork(d.p ?? []));
  return days;
}

/** What is read from storage or from a backup, with anything that is not a day and its tallies left out. */
export function cleanDays(value: unknown): Days {
  const out: Days = {};
  if (!value || typeof value !== 'object') return out;
  for (const [key, rec] of Object.entries(value as Record<string, unknown>)) {
    if (!isDay(key) || !Array.isArray(rec) || rec.length < 4) continue;
    const [g, q, ok, ms, met, learnt] = rec.map((x) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.floor(x) : 0));
    // What was learnt by then is kept where it was written down, a nought included.
    if (g > 0) out[key] = typeof rec[5] === 'number' ? [g, q, Math.min(ok, q), ms, met ? 1 : 0, learnt] : [g, q, Math.min(ok, q), ms, met ? 1 : 0];
  }
  const keys = Object.keys(out);
  if (keys.length > DAYS_MAX) for (const old of keys.sort().slice(0, keys.length - DAYS_MAX)) delete out[old];
  return out;
}

/**
 * Days in a row with something done, up to `day`. A day that has only begun does not break the run: with
 * nothing done yet today, it is the run that ended yesterday, still there to be kept.
 */
export function studyStreak(days: Days, day: string): number {
  let at = days[day] ? day : addDays(day, -1);
  let n = 0;
  while (days[at]) {
    n++;
    at = addDays(at, -1);
  }
  return n;
}

/** The longest run of days in a row among those kept. */
export function longestStreak(days: Days): number {
  let best = 0;
  let run = 0;
  let prev = '';
  for (const key of Object.keys(days).sort()) {
    run = prev && daysBetween(prev, key) === 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = key;
  }
  return best;
}

/** How many of the days kept met their goal. */
export const goalsMet = (days: Days): number => Object.values(days).reduce((n, rec) => n + (rec[4] ? 1 : 0), 0);

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

/** How many answers were learnt, day by day, on the days that wrote it down: the oldest first. */
export function learntOver(days: Days): { day: string; learnt: number }[] {
  const out: { day: string; learnt: number }[] = [];
  for (const day of Object.keys(days).sort()) {
    const learnt = days[day][5];
    if (learnt != null) out.push({ day, learnt });
  }
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
