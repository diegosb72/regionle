/**
 * Two pieces of a map set against each other by their size: which is the larger and by how much, said in a
 * sentence, and the bar that tells how long a stretch of the drawing is. What draws them is in geo.ts
 * (`overlaid`); the tool is in Explore.
 */
import { L } from './i18n';
import { fmtArea, joiner, nf, sig } from './text';
import { KM_PER_MILE, area, distUnit, getUnits } from './units';

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
 * A surface the game has no figure for, measured on its outline: two figures of it, round in the unit of the
 * player, and said as what it is. "unos 580.000 km²" · "about 220,000 sq mi".
 */
export function roughArea(km2: number): string {
  const round = sig(area(km2), 2) / area(1);
  return L(`unos ${fmtArea(round)}`, `about ${fmtArea(round)}`);
}

/**
 * "Brasil es 17 veces más grande que España." · "Francia es un 28 % más grande que España." ·
 * "Italia y Polonia son casi igual de grandes." Nothing when there is nothing to compare.
 *
 * `rough`: the surfaces were measured on the outlines of the map, not taken from a figure, and the sentence
 * says no more than they can: "unas 17 veces", "alrededor de un 25 %" (to the nearest five).
 *
 * `label`: the names are of rivers, ranges and seas, which in a sentence would want an article the game does
 * not have and a verb in the plural for some ("los Alpes son…"): they are written as on a label, with
 * nothing that has to agree with them. "Alpes: 6,9 veces la superficie de Pirineos."
 */
export function sizeLine(a: { name: string; area: number }, b: { name: string; area: number }, how: { rough?: boolean; label?: boolean } = {}): string {
  const verdict = compareSizes(a.area, b.area);
  if (!verdict) return '';
  const both = bothNames(a.name, b.name);
  if (verdict.kind === 'same') return how.label ? L(`${both}: casi la misma superficie.`, `${both}: almost the same area.`) : L(`${both} son casi igual de grandes.`, `${both} are almost the same size.`);
  const [big, small] = verdict.big === 0 ? [a.name, b.name] : [b.name, a.name];
  if (verdict.kind === 'percent') {
    const more = (verdict.ratio - 1) * 100;
    const es = how.rough ? `alrededor de un ${Math.round(more / 5) * 5} %` : `un ${Math.round(more)} %`;
    const en = how.rough ? `about ${Math.round(more / 5) * 5}%` : `${Math.round(more)}%`;
    return how.label ? L(`${big}: ${es} más de superficie que ${small}.`, `${big}: ${en} more area than ${small}.`) : L(`${big} es ${es} más grande que ${small}.`, `${big} is ${en} larger than ${small}.`);
  }
  const times = timesText(verdict.ratio);
  const es = how.rough ? `unas ${times} veces` : `${times} veces`;
  const en = how.rough ? `about ${times} times` : `${times} times`;
  return how.label ? L(`${big}: ${es} la superficie de ${small}.`, `${big}: ${en} the area of ${small}.`) : L(`${big} es ${es} más grande que ${small}.`, `${big} is ${en} the size of ${small}.`);
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
