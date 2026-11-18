/**
 * A goal with a date: "the provinces of Spain, by Thursday the 26th". It is a map, what is to be known
 * about its pieces and a day. Nothing else is stored for it: what has been answered already says how
 * much is known, and the days that are left say how much there is to do today.
 */
import type { CityPick } from './extra';
import { REVIEW_MAX, SKILL_MODE, dueAt, isDue } from './review';
import type { GameConfig, Opts, Skill, Stat } from './store';
import { today } from './text';
import type { Section } from './types';

/** What a goal can be about: where the pieces are, what they are called, their capitals or their flags. */
export type GoalSkill = Exclude<Skill, 'nb'>;

/** How much had been seen when a day began: the share of that day is worked out from it. */
export interface GoalMark {
  day: string;
  seen: number;
}

export interface Goal {
  id: string;
  /** What it is called: "España · provincias", or the name of the list it was made from. */
  name: string;
  section: Section;
  /** The map it is played on, as a custom list keeps it. */
  countries: string[];
  levels: Record<string, string>;
  cityPick?: CityPick;
  cityCount?: number;
  /** The pieces to be known. */
  ids: string[];
  skill: GoalSkill;
  /** The day it is for: "2026-11-26". */
  date: string;
  /** When it was set. */
  made: number;
  mark?: GoalMark;
}

/** Goals kept at a time, and pieces in each: more than that is not studied against a date. */
export const GOALS_MAX = 5;
export const GOAL_IDS_MAX = 600;

const DAY = 86_400_000;
const utc = (day: string): number => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Whether a text is a day of the calendar written "2026-11-26". */
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = utc(value);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === value;
}

/** Days of the calendar from one day to another: 8 from the 18th to the 26th, negative backwards. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / DAY);
}

/** The day `n` days after another. */
export function addDays(day: string, n: number): string {
  return new Date(utc(day) + n * DAY).toISOString().slice(0, 10);
}

/** What can be asked about the pieces of each section. */
export function goalSkills(section: Section): GoalSkill[] {
  return section === 'countries' ? ['loc', 'name', 'cap', 'flag'] : section === 'regions' ? ['loc', 'name', 'cap'] : section === 'pops' ? [] : ['loc', 'name'];
}

export function newGoalId(): string {
  return `g${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;
}

/** Two goals about the same thing: the same pieces and the same skill. A new one takes the place of the old. */
export function sameGoal(a: Goal, b: Goal): boolean {
  return a.skill === b.skill && a.section === b.section && a.ids.length === b.ids.length && a.ids.every((id, i) => id === b.ids[i]);
}

export interface GoalState {
  total: number;
  /** Asked at least once. */
  seen: number;
  /** Right first time twice in a row. */
  known: number;
  /** Never asked, in the order of the goal. */
  fresh: string[];
  /** To be asked again now: due for review, the longest overdue first. */
  pending: string[];
  /** Days until the date: 0 on the day, negative after it. */
  daysLeft: number;
  /** Before the day, on the day, or after it. */
  phase: 'ahead' | 'today' | 'over';
  /** Everything is known. */
  done: boolean;
  /** New pieces that are today's share, and how many of them have been seen today. */
  share: number;
  shareDone: number;
  /** New pieces still to be seen today. */
  newLeft: number;
  /** New pieces a day from tomorrow on, once today's are done; 0 when none will be left. */
  perDay: number;
}

/**
 * Days there are to see new pieces in, today included. With three days or more ahead, the eve is kept
 * for going over everything.
 */
function learnDays(daysLeft: number): number {
  return daysLeft <= 0 ? 1 : daysLeft >= 3 ? daysLeft - 1 : daysLeft;
}

/** How a goal stands: what is known, what is left and what is today's share of it. */
export function goalState(goal: Goal, stats: Record<string, Stat>, now: number): GoalState {
  const day = today(new Date(now));
  const daysLeft = daysBetween(day, goal.date);
  const phase = daysLeft > 0 ? 'ahead' : daysLeft === 0 ? 'today' : 'over';
  // On the eve and on the day, whatever is not known is gone over, due or not.
  const cram = daysLeft === 0 || daysLeft === 1;
  const fresh: string[] = [];
  const pending: [string, number][] = [];
  let seen = 0;
  let known = 0;
  for (const id of goal.ids) {
    const st = stats[`${goal.skill}:${id}`];
    if (!st || !st[0]) {
      fresh.push(id);
      continue;
    }
    seen++;
    const learnt = st[2] >= 2;
    if (learnt) known++;
    if (isDue(st, now) || (cram && !learnt)) pending.push([id, dueAt(st)]);
  }
  pending.sort((a, b) => a[1] - b[1]);
  const total = goal.ids.length;
  // A mark from another day, or from before the progress was wiped, says nothing about today.
  const start = goal.mark && goal.mark.day === day && goal.mark.seen <= seen ? goal.mark.seen : seen;
  const days = learnDays(daysLeft);
  const share = phase === 'over' ? 0 : Math.ceil((total - start) / days);
  const shareDone = seen - start;
  const newLeft = Math.max(0, Math.min(fresh.length, share - shareDone));
  const later = fresh.length - newLeft;
  return {
    total,
    seen,
    known,
    fresh,
    pending: pending.map((p) => p[0]),
    daysLeft,
    phase,
    done: total > 0 && known === total,
    share,
    shareDone,
    newLeft,
    perDay: later > 0 && phase === 'ahead' ? Math.ceil(later / Math.max(1, days - 1)) : 0,
  };
}

/** The goal with the mark of today: the same object when it already has it. */
export function withMark(goal: Goal, stats: Record<string, Stat>, now: number): Goal {
  const day = today(new Date(now));
  if (goal.mark?.day === day) return goal;
  let seen = 0;
  for (const id of goal.ids) if (stats[`${goal.skill}:${id}`]?.[0]) seen++;
  return { ...goal, mark: { day, seen } };
}

/** What there is to do next for a goal: see new pieces, go over the ones that are due, or nothing. */
export type GoalStep = 'learn' | 'review' | 'exam';

export function nextStep(state: GoalState): 'learn' | 'review' | null {
  if (state.phase === 'over') return null;
  // What is due first: it is short, and the new pieces build on it.
  if (state.pending.length) return 'review';
  return state.newLeft > 0 ? 'learn' : null;
}

/**
 * The game of a step. Where the pieces are and what they are called is taught in lessons, on the map of
 * the goal; capitals and flags are learnt by being asked, a share at a time. What is due is gone over in
 * the game of the skill, and the mock exam is that game as an exam, with every piece of the goal.
 */
export function goalGame(goal: Goal, state: GoalState, opts: Opts, step: GoalStep): Omit<GameConfig, 'nonce'> {
  const mode = SKILL_MODE[goal.skill];
  const base = { section: goal.section, countries: goal.countries, levels: goal.levels };
  const plain: Opts = { ...opts, cityPick: goal.cityPick ?? opts.cityPick, cityCount: goal.cityCount ?? opts.cityCount, length: 'all', format: 'normal' };
  if (step === 'exam') return { ...base, mode, opts: { ...plain, format: 'exam' }, only: goal.ids, list: goal.name };
  if (step === 'review') return { ...base, mode, opts: plain, only: state.pending.slice(0, REVIEW_MAX) };
  if (goal.skill === 'loc' || goal.skill === 'name') return { ...base, mode: 'learn', opts: plain, only: goal.ids, list: goal.name };
  return { ...base, mode, opts: plain, only: state.fresh.slice(0, Math.max(1, state.newLeft)) };
}

/** A goal without the pieces that are no longer in the data; null when none is left. */
export function goalWithout(goal: Goal, gone: ReadonlySet<string>): Goal | null {
  if (!goal.ids.some((id) => gone.has(id))) return goal;
  const ids = goal.ids.filter((id) => !gone.has(id));
  return ids.length ? { ...goal, ids, mark: undefined } : null;
}

const SECTIONS: Section[] = ['regions', 'countries', 'cities', 'physical'];
const SKILLS: GoalSkill[] = ['loc', 'name', 'cap', 'flag'];

/** Whether something read from storage or from a backup is a goal that can be used. */
export function isGoal(x: unknown): x is Goal {
  const g = x as Partial<Goal> | null;
  return (
    !!g &&
    typeof g === 'object' &&
    typeof g.id === 'string' &&
    typeof g.name === 'string' &&
    SECTIONS.includes(g.section as Section) &&
    SKILLS.includes(g.skill as GoalSkill) &&
    Array.isArray(g.countries) &&
    !!g.levels &&
    typeof g.levels === 'object' &&
    Array.isArray(g.ids) &&
    g.ids.length > 0 &&
    g.ids.length <= GOAL_IDS_MAX &&
    g.ids.every((id) => typeof id === 'string') &&
    isDay(g.date) &&
    typeof g.made === 'number' &&
    (g.mark == null || (typeof g.mark === 'object' && isDay(g.mark.day) && typeof g.mark.seen === 'number'))
  );
}

/** The goals that can be trusted of a value read from outside, the newest ones when there are too many. */
export function cleanGoals(value: unknown): Goal[] {
  return Array.isArray(value) ? value.filter(isGoal).slice(-GOALS_MAX) : [];
}
