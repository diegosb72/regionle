/**
 * What was done each day. The sessions are no good for this: only the latest are kept. The run of days in
 * a row and the daily target are read from here; the calendar, the charts and the summary of each month
 * and year are drawn from it in `dayview.ts`, which only the Progress page loads.
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
