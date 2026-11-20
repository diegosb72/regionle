/**
 * What is kept of the session of the day (lib/dayPlan.ts): which of its steps have been done, and on which
 * day. Apart from the rest of it so that the game, which keeps it, carries no more than this from the start.
 */

/** review: what is due · hard: what keeps being missed · new: a lesson of the map being learnt. */
export type Step = 'review' | 'hard' | 'new';
/** In the order they are done. */
export const STEPS: readonly Step[] = ['review', 'hard', 'new'];

/** Which steps have been done, and on which day ("2026-11-20"): another day starts from none. */
export interface DayDone {
  day: string;
  done: Step[];
}
export const NO_DAY: DayDone = { day: '', done: [] };

/** What was kept, made safe: a broken or an older copy is a day with nothing done. */
export function cleanDayDone(raw: unknown): DayDone {
  const r = raw as Partial<DayDone> | null;
  if (!r || typeof r !== 'object' || typeof r.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.day) || !Array.isArray(r.done)) return NO_DAY;
  return { day: r.day, done: STEPS.filter((s) => (r.done as unknown[]).includes(s)) };
}

/** A step done on a day: the steps of another day are forgotten. */
export function withStep(kept: DayDone, day: string, step: Step): DayDone {
  const done = kept.day === day ? kept.done : [];
  return done.includes(step) ? kept : { day, done: STEPS.filter((s) => s === step || done.includes(s)) };
}
