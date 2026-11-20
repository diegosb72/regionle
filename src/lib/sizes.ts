/**
 * Two pieces of a map set against each other by their size: which is the larger and by how much, said in a
 * sentence, and the bar that tells how long a stretch of the drawing is. What draws them is in geo.ts
 * (`overlaid`); the tool is in Explore.
 */
import { L } from './i18n';
import { joiner, nf } from './text';
import { KM_PER_MILE, distUnit, getUnits } from './units';

/** Below this, one is not larger than the other in any way worth telling: "almost the same size". */
export const SAME_SIZE = 1.1;
/** From this on, the larger is so many times the smaller; under it, so much per cent larger. */
export const TIMES_FROM = 2;

export interface SizeVerdict {
  /** Which of the two is the larger: 0, the first; 1, the second. */
  big: 0 | 1;
  /** How many times the smaller the larger is: 1 or more. */
  ratio: number;
  kind: 'same' | 'percent' | 'times';
}

/** Null when either has no surface to speak of. */
export function compareSizes(a: number, b: number): SizeVerdict | null {
  if (!(a > 0) || !(b > 0) || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  const big = a >= b ? 0 : 1;
  const ratio = big === 0 ? a / b : b / a;
  return { big, ratio, kind: ratio < SAME_SIZE ? 'same' : ratio < TIMES_FROM ? 'percent' : 'times' };
}

/** "2,4", "17", "250", "54.000": a decimal only where it says something, and two figures of a large number. */
export function timesText(ratio: number): string {
  if (ratio < 10) return nf(ratio, 1);
  if (ratio < 100) return nf(ratio, 0);
  const tens = 10 ** (Math.floor(Math.log10(ratio)) - 1);
  return nf(Math.round(ratio / tens) * tens);
}

/** "España y Brasil", "Francia e Italia"; "Spain and Brazil". */
export function bothNames(a: string, b: string): string {
  return L(`${a} ${joiner('y', b)} ${b}`, `${a} and ${b}`);
}

/**
 * "Brasil es 17 veces más grande que España." · "Francia es un 28 % más grande que España." ·
 * "Italia y Polonia son casi igual de grandes." Nothing when there is nothing to compare.
 */
export function sizeLine(a: { name: string; area: number }, b: { name: string; area: number }): string {
  const verdict = compareSizes(a.area, b.area);
  if (!verdict) return '';
  if (verdict.kind === 'same') return L(`${bothNames(a.name, b.name)} son casi igual de grandes.`, `${bothNames(a.name, b.name)} are almost the same size.`);
  const [big, small] = verdict.big === 0 ? [a, b] : [b, a];
  if (verdict.kind === 'percent') {
    const more = Math.round((verdict.ratio - 1) * 100);
    return L(`${big.name} es un ${more} % más grande que ${small.name}.`, `${big.name} is ${more}% larger than ${small.name}.`);
  }
  const times = timesText(verdict.ratio);
  return L(`${big.name} es ${times} veces más grande que ${small.name}.`, `${big.name} is ${times} times the size of ${small.name}.`);
}

/**
 * The bar that says how far it is across the drawing: a round figure in the unit of the player (1, 2 or 5,
 * and their tens), the longest that takes no more than `room` units of a drawing where one unit is `km`
 * kilometres. `length` is how long the bar is drawn.
 */
export function scaleBar(km: number, room: number): { length: number; label: string } | null {
  if (!(km > 0) || !(room > 0) || !Number.isFinite(km)) return null;
  const perUnit = getUnits() === 'mi' ? km / KM_PER_MILE : km;
  const most = perUnit * room;
  const tens = 10 ** Math.floor(Math.log10(most));
  const step = [5, 2, 1].find((s) => s * tens <= most) ?? 1;
  const figure = step * tens;
  return { length: figure / perUnit, label: `${nf(figure, figure < 1 ? 1 : 0)} ${distUnit()}` };
}
