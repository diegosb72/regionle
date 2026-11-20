/**
 * How lessons are put together: which pieces come next and in what order they are asked. Kept apart
 * from the screen so that it can be tested on its own.
 */
import { nearest } from '../lib/geo';
import { getLang } from '../lib/i18n';
import type { LessonOrder, Opts, Stat } from '../lib/store';
import { sample, shuffle, type Rng } from '../lib/text';
import type { Deck, Item } from '../lib/types';

/** New pieces per lesson, unless the player asks for another size. */
export const LESSON = 5;
/** The sizes a lesson can be asked to have. */
export const LESSON_SIZES: readonly number[] = [3, 5, 8, 10];
/**
 * The orders the new pieces can come in: corner by corner of the map, from the largest to the smallest
 * (the most populous first, among cities) or by their names. As it is kept, `auto` is whatever suits the map.
 */
export const LESSON_ORDERS: readonly Opts['lessonOrder'][] = ['auto', 'near', 'size', 'abc'];
/** Pieces learnt earlier that come back at the end of a lesson. */
export const OLD = 3;

export interface Q {
  id: string;
  kind: 'pin' | 'name';
  /** Asked with four options (the first time a name is asked) or the way the player has chosen. */
  easy?: boolean;
}

/** Has the piece been through a lesson, or its equivalent in other games: placed and named right the last time? */
export function isIntroduced(stats: Record<string, Stat>, id: string): boolean {
  return (stats[`loc:${id}`]?.[2] ?? 0) >= 1 && (stats[`name:${id}`]?.[2] ?? 0) >= 1;
}

/** The size of a lesson as it was asked for, or the usual one when what is kept is none of the sizes there are. */
export const lessonSize = (asked?: number): number => (asked != null && LESSON_SIZES.includes(asked) ? asked : LESSON);

/** The orders a map can be learnt in. Rivers, peaks and seas have no one size to be put in order by. */
export const lessonOrders = (scope: Deck['scope']): LessonOrder[] => (scope === 'physical' ? ['near', 'abc'] : ['near', 'size', 'abc']);

/**
 * The order the lessons of a map follow: the one asked for, where the map has it, and otherwise the one
 * that suits it. Cities come by size, the biggest first; everything else, corner by corner.
 */
export function lessonOrder(scope: Deck['scope'], asked?: Opts['lessonOrder']): LessonOrder {
  if (asked && asked !== 'auto' && lessonOrders(scope).includes(asked)) return asked;
  return scope === 'cities' ? 'size' : 'near';
}

/** The size of a city is its people; that of anything else, its surface. */
const sizeOf = (scope: Deck['scope'], it: Item): number => (scope === 'cities' ? (it.pop ?? 0) : it.area);

/**
 * The pieces of the next lesson, in the order they are shown. By size or by name they are simply the next
 * ones of the list. Corner by corner they come in clusters, so that a lesson is about one part of the
 * map: the pending piece nearest to what is already known (or the largest, on a new map) and the pending
 * ones around it.
 */
export function pickLesson(pending: Item[], known: Item[], scope: Deck['scope'], size = LESSON, order: LessonOrder = lessonOrder(scope)): Item[] {
  if (order === 'size') return [...pending].sort((a, b) => sizeOf(scope, b) - sizeOf(scope, a) || (a.id < b.id ? -1 : 1)).slice(0, size);
  if (order === 'abc') {
    const names = new Intl.Collator(getLang(), { sensitivity: 'base', numeric: true });
    return [...pending].sort((a, b) => names.compare(a.name, b.name) || (a.id < b.id ? -1 : 1)).slice(0, size);
  }
  if (pending.length <= size) return pending;
  let seed: Item;
  if (known.length) {
    const lon = known.reduce((n, it) => n + it.lp[0], 0) / known.length;
    const lat = known.reduce((n, it) => n + it.lp[1], 0) / known.length;
    seed = nearest({ id: '', lp: [lon, lat] }, pending, 1)[0];
  } else if (scope === 'physical') seed = pending[0];
  else seed = pending.reduce((best, it) => (it.area > best.area ? it : best), pending[0]);
  return [seed, ...nearest(seed, pending, size - 1)];
}

/** Questions of a lesson: where each new piece is, what each is called, and a mixed round with old ones. */
export function lessonQueue(fresh: string[], old: string[], rng: Rng = Math.random): Q[] {
  const mixed = shuffle([...sample(fresh, Math.min(fresh.length, OLD), rng), ...sample(old, OLD, rng)], rng).map((id, i): Q => ({ id, kind: i % 2 ? 'pin' : 'name' }));
  return [...shuffle(fresh, rng).map((id): Q => ({ id, kind: 'pin' })), ...shuffle(fresh, rng).map((id): Q => ({ id, kind: 'name', easy: true })), ...mixed];
}
