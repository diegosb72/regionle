/**
 * Placing blind: the map shows nothing of what is asked and a click says where it is thought to be. How
 * that click is judged depends on the shape of the thing: a city is a dot, a river a line and a region a
 * surface; and on the size of the map: forty kilometres are a bad miss in Belgium and nothing in the world.
 */
import { geoArea, geoContains } from 'd3-geo';
import { distanceKm, kmToShape } from './geo';
import type { AnyGeo, Item, LL, Part, Res } from './types';

/** What `tolerances` gives for a map: how close counts as right and as nearly right for a dot. */
export interface Limits {
  ok: number;
  warn: number;
}

/** Kilometres within which a click is right and within which it is close. `ok` 0: it has to fall inside. */
export interface Marks {
  ok: number;
  warn: number;
}

/** Side, in kilometres, of the square that would hold a surface: how big a target it is. */
export function sideKm(geo: AnyGeo): number {
  return Math.sqrt(geoArea(geo)) * 6371;
}

/**
 * What counts for one thing on a map with those limits.
 * - A dot: the limits as they are.
 * - A line: it is a long target, so it has to be closer — a third of what a dot is allowed.
 * - A surface: inside it; just outside is close. One too small to be hit on that map (Ceuta on the map of
 *   Spain, Luxembourg on the map of the world) is judged like a line.
 */
export function marksFor(item: Pick<Item, 'shape' | 'geo'>, limit: Limits): Marks {
  if (item.shape === 'point') return { ok: limit.ok, warn: limit.warn };
  const tight = Math.max(5, Math.round(limit.ok / 3));
  if (item.shape === 'line' || sideKm(item.geo) < tight) return { ok: tight, warn: limit.ok };
  return { ok: 0, warn: tight };
}

/**
 * Kilometres from a click to the thing: to the dot, to the line, to the edge of the surface (0 inside it).
 * A sea is taken with the seas that are part of it: off Valencia is inside the Mediterranean.
 */
export function kmOff(item: Pick<Item, 'shape' | 'geo' | 'lp' | 'parts'>, at: LL): number {
  if (item.shape === 'point') return distanceKm(at, item.lp);
  let km = kmToShape(at, item.geo);
  for (const part of item.parts ?? []) {
    if (km === 0) break;
    km = Math.min(km, kmToShape(at, part.geo));
  }
  return km;
}

/**
 * The part of a sea that a click fell in, when it is not the stretch drawn under the name of the whole:
 * the Balearic Sea, for a click off Valencia when the Mediterranean was asked.
 */
export function partAt(item: Pick<Item, 'shape' | 'geo' | 'parts'>, at: LL): Part | null {
  if (item.shape !== 'area' || !item.parts?.length || geoContains(item.geo, at)) return null;
  return item.parts.find((part) => geoContains(part.geo, at)) ?? null;
}

export function judge(km: number, marks: Marks): Res {
  return km <= marks.ok ? 'ok' : km <= marks.warn ? 'warn' : 'bad';
}

/** Hot and cold: clicks allowed to find one thing. */
export const HOT_TRIES = 6;

/** How warm a click is, from freezing to burning. */
export type Heat = 0 | 1 | 2 | 3 | 4;

/**
 * How warm a miss is: by how far it fell, measured in what the map allows a dot (3 % of its span).
 * Burning within twice that, hot within five times, mild within ten, cold within eighteen; freezing beyond.
 */
export function heatOf(km: number, limit: Limits): Heat {
  const n = km / limit.ok;
  return n <= 2 ? 4 : n <= 5 ? 3 : n <= 10 ? 2 : n <= 18 ? 1 : 0;
}

/** Whether a click is nearer or farther than the one before; 0 for the first one and for a tie. */
export function trendOf(km: number, before: number | undefined): -1 | 0 | 1 {
  if (before == null) return 0;
  // Less than one part in fifty is no change worth telling.
  if (Math.abs(km - before) <= Math.max(1, before * 0.02)) return 0;
  return km < before ? 1 : -1;
}

/** How a search ended: found with the first click, found later, or not found. */
export function hotResult(found: boolean, clicks: number): Res {
  return !found ? 'bad' : clicks <= 1 ? 'ok' : 'warn';
}
