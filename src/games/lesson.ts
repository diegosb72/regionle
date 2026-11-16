/**
 * How lessons are put together: which pieces come next and in what order they are asked. Kept apart
 * from the screen so that it can be tested on its own.
 */
import { nearest } from '../lib/geo';
import type { Stat } from '../lib/store';
import { sample, shuffle, type Rng } from '../lib/text';
import type { Deck, Item } from '../lib/types';

/** New pieces per lesson. */
export const LESSON = 5;
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

/**
 * The pieces of the next lesson. Cities come by size, the biggest first. Everything else comes in
 * clusters, so that a lesson is about one corner of the map: the pending piece nearest to what is
 * already known (or the largest, on a new map) and the pending ones around it.
 */
export function pickLesson(pending: Item[], known: Item[], scope: Deck['scope'], size = LESSON): Item[] {
  if (pending.length <= size) return pending;
  if (scope === 'cities') return [...pending].sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0) || (a.id < b.id ? -1 : 1)).slice(0, size);
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
