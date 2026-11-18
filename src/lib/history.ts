/**
 * What the player knows of one piece: how each kind of question about it has gone, when it comes back
 * and what it gets taken for. Nothing is kept for this: it is read from the answers and the mix-ups.
 */
import { livePairs, type Mix } from './mix';
import { dueAt, gradeOf, type Grade } from './review';
import type { Skill, Stat } from './store';

/** In the order they are told: where it is, what it is called, and what goes with it. */
export const HISTORY_SKILLS: readonly Skill[] = ['loc', 'name', 'cap', 'flag', 'nb'];

export interface SkillHistory {
  skill: Skill;
  /** Times it was asked, and of them the times it was right first time. */
  seen: number;
  right: number;
  /** Right answers in a row up to now. */
  run: number;
  /** When it was last asked. */
  last: number;
  grade: Exclude<Grade, 'new'>;
  /** From when it should be asked again. */
  due: number;
}

/** The history of a piece, skill by skill: only the skills it has been asked about. */
export function historyOf(stats: Record<string, Stat>, id: string, now: number): SkillHistory[] {
  const out: SkillHistory[] = [];
  for (const skill of HISTORY_SKILLS) {
    const stat = stats[`${skill}:${id}`];
    const grade = gradeOf(stat, now);
    if (!stat || grade === 'new') continue;
    out.push({ skill, seen: stat[0], right: Math.min(stat[1], stat[0]), run: stat[2], last: stat[3], grade, due: dueAt(stat) });
  }
  return out;
}

export interface MixedWith {
  skill: Skill;
  /** The other piece of the pair. */
  other: string;
  times: number;
}

/** The pieces this one is still taken for, or that are taken for it: the ones mixed up most first. */
export function mixedWith(mix: Mix, stats: Record<string, Stat>, id: string): MixedWith[] {
  return livePairs(mix, stats)
    .filter((p) => p.a === id || p.b === id)
    .map((p) => ({ skill: p.skill, other: p.a === id ? p.b : p.a, times: p.times }));
}

/** Whole days from one moment to another by the calendar of whoever reads: 0 the same day, 1 the next, -1 the one before. */
export function dayGap(from: number, to: number): number {
  const a = new Date(from);
  const b = new Date(to);
  return Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() - new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) / 864e5);
}
