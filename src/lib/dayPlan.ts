/**
 * The session of the day: what the game proposes to do today, in the order that helps most to learn.
 * First what is due for review, then what keeps being missed, then something new: the next lesson of the
 * map that is being learnt.
 *
 * It is not a list kept anywhere. What there is to do is worked out from what has been answered, each
 * time it is looked at; all that is kept is which of its steps have been done today (lib/dayDone.ts).
 */
import { STEPS, type DayDone, type Step } from './dayDone';
import { recentConfig, type Recent } from './recent';
import { dueGroups, missGroups, reviewConfig, reviewMax, type ReviewGroup } from './review';
import type { GameConfig, Opts, Stat } from './store';

export { NO_DAY, STEPS, cleanDayDone, withStep, type DayDone, type Step } from './dayDone';

export interface PlanStep {
  step: Step;
  done: boolean;
  /** Review and hard: the game of the map that has the most of it. */
  group?: ReviewGroup;
  /** New: the map whose lessons go on. */
  map?: Recent;
  /** How many answers the step asks for; none for a lesson, whose size the player sets, nor once done. */
  n: number;
}

/**
 * The steps of today, in order: those that were done, and those there is something to do for. A step with
 * nothing to do and not done is not a step: with nothing due, the session starts at what is missed most.
 */
export function planOf(stats: Record<string, Stat>, where: Record<string, string>, recent: readonly Recent[], kept: DayDone, day: string, now: number): PlanStep[] {
  const done = kept.day === day ? kept.done : [];
  const max = reviewMax();
  const due = dueGroups(stats, where, now)[0];
  const hard = missGroups(stats, where)[0];
  // The lessons of the map played last that still has something to teach; one that says nothing of it is from before.
  const map = recent.find((r) => r.mode === 'learn' && r.left !== 0);
  const live: Partial<Record<Step, PlanStep>> = {
    ...(due ? { review: { step: 'review', done: false, group: due, n: Math.min(due.ids.length, max) } } : {}),
    ...(hard ? { hard: { step: 'hard', done: false, group: hard, n: Math.min(hard.ids.length, max) } } : {}),
    ...(map ? { new: { step: 'new', done: false, map, n: 0 } } : {}),
  };
  return STEPS.flatMap((step): PlanStep[] => (done.includes(step) ? [{ step, done: true, n: 0 }] : live[step] ? [live[step]] : []));
}

/** The step to do next: the first that is not done. */
export const nextStep = (plan: readonly PlanStep[]): PlanStep | undefined => plan.find((s) => !s.done);

/** The game of a step, marked as part of the session so that finishing it counts. */
export function stepConfig(s: PlanStep, opts: Opts): Omit<GameConfig, 'nonce'> | null {
  if (s.group) return { ...reviewConfig(s.group, opts), step: s.step };
  if (s.map) return { ...recentConfig(s.map, opts), step: s.step };
  return null;
}
