/**
 * The hard way of the daily challenge: the same five tests of the day, which are the same for everybody,
 * with fewer aids. There is one result a day, played one way or the other; which one is settled with the
 * first test that is scored.
 *
 *   1 Regionle              the outline is turned, and there are four tries instead of six
 *   2 Pin it                one try at each piece instead of two
 *   3 Route                 no hints
 *   4 Which country?        the continent is not told until the third miss, and the area never
 *   5 Flags and capitals    the answer is typed: there are no options to choose from
 *
 * The points are counted the same way, so a hard result can be set beside a plain one: it is marked.
 */
import { hashStr, mulberry32 } from '../lib/text';
import { GUESSES, type DailyRec } from './spec';

/** Tries at the outline. */
export const HARD_GUESSES = 4;
/** Misses after which the continent of the country to guess is told. */
export const HARD_CLUE_AT = 3;

export const guessesOf = (hard: boolean): number => (hard ? HARD_GUESSES : GUESSES);
/** Tries at each piece to point at. */
export const pinTriesOf = (hard: boolean): number => (hard ? 1 : 2);

/** Degrees either way of upright that still read as upright: a turned outline is never left within them. */
export const TURN_MIN = 50;

/** How far the outline of a day is turned, in whole degrees clockwise: the same for everybody. */
export function hardTurn(date: string): number {
  return TURN_MIN + Math.floor(mulberry32(hashStr(`${date}|turn`))() * (360 - 2 * TURN_MIN + 1));
}

/** How a day is offered before it is begun: the way the challenge finished last was played. */
export function hardByDefault(daily: Record<string, DailyRec | undefined>): boolean {
  let last: DailyRec | undefined;
  for (const rec of Object.values(daily)) if (rec?.t && rec.t > (last?.t ?? 0)) last = rec;
  return last?.h === 1;
}
