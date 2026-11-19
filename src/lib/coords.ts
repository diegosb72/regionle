/**
 * "Coordenadas": latitudes and longitudes as they are written and as they are drawn. A map gets a grid
 * of parallels and meridians as fine as its size allows; a place is asked by its coordinates, rounded
 * to what can be read off that grid, and an answer is a click judged by how far it falls. Or the place
 * is marked and its coordinates are chosen among four (`coordOptions`).
 */
import { geoContains } from 'd3-geo';
import { L } from './i18n';
import { nf, shuffle, type Rng } from './text';
import type { Item, LL } from './types';

/** Degrees between the lines of a grid, from the finest to the coarsest: every one a multiple of a tenth. */
export const GRID_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30] as const;
/** A grid has at most this many cells across the longer side of its map. */
export const GRID_CELLS = 16;

/** The longitude of `lon` that is nearest to `ref`: 179 beside −179 is −181. */
const beside = (lon: number, ref: number): number => lon - 360 * Math.round((lon - ref) / 360);

export interface Extent {
  south: number;
  north: number;
  /** West and east can lie beyond ±180 on a map across the antimeridian: `west` is always the lesser. */
  west: number;
  east: number;
}

/**
 * The parallels and the meridians between which the points of a frame lie. The longitudes are the
 * shortest stretch of the circle that holds them all, so that a map of the Pacific spans its sixty
 * degrees and not three hundred; a frame with points all the way round is the whole world.
 */
export function extentOf(frame: readonly LL[]): Extent {
  const points = frame.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (!points.length) return { south: -60, north: 80, west: -180, east: 180 };
  let south = Infinity;
  let north = -Infinity;
  for (const [, lat] of points) {
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  const lons = [...new Set(points.map((p) => beside(p[0], 0)))].sort((a, b) => a - b);
  // The widest stretch with no point in it is what the map leaves out: it starts where the map ends.
  let gap = lons[0] + 360 - lons[lons.length - 1];
  let west = lons[0];
  let east = lons[lons.length - 1];
  for (let i = 1; i < lons.length; i++) {
    if (lons[i] - lons[i - 1] > gap) {
      gap = lons[i] - lons[i - 1];
      west = lons[i];
      // The map goes on across the antimeridian, where longitudes start again.
      east = lons[i - 1] + 360;
    }
  }
  // Nothing left out to speak of: the world, from one side of the antimeridian to the other.
  if (gap < 60) return { south, north, west: -180, east: 180 };
  return { south, north, west, east };
}

/** How many degrees apart the lines of a map are drawn: the finest grid that does not crowd it. */
export function gridStep(frame: readonly LL[]): number {
  const { south, north, west, east } = extentOf(frame);
  const side = Math.max(north - south, east - west);
  return GRID_STEPS.find((s) => side / s <= GRID_CELLS) ?? GRID_STEPS[GRID_STEPS.length - 1];
}

export interface GridLine {
  /** A parallel is a line of one latitude; a meridian, of one longitude. */
  kind: 'lat' | 'lon';
  /** Its latitude or its longitude, between −180 and 180. */
  at: number;
  /** The points it is drawn through, from west to east or from south to north. */
  points: LL[];
}

/**
 * The lines of the grid of a map: every parallel and meridian that is a multiple of `step` and crosses
 * the frame or lies around it. No parallel is drawn at a pole, where it would be a dot.
 */
export function gridLines(frame: readonly LL[], step: number): GridLine[] {
  const { south, north, west, east } = extentOf(frame);
  const round = (n: number) => Math.round(n * 1000) / 1000;
  // A screen that is not the shape of the frame shows a good deal more than it: a third again on every side.
  const spare = (Math.ceil(Math.max(north - south, east - west) / step / 3) + 1) * step;
  const whole = east - west + 2 * spare >= 360 - step;
  const s = Math.max(-90 + step, Math.ceil((south - spare) / step - 1e-9) * step);
  const n = Math.min(90 - step, Math.floor((north + spare) / step + 1e-9) * step);
  const w = whole ? -180 : Math.ceil((west - spare) / step - 1e-9) * step;
  const e = whole ? 180 - step : Math.floor((east + spare) / step + 1e-9) * step;
  const out: GridLine[] = [];
  const bit = step / 8;
  // Parallels run a little beyond the last meridian, and meridians beyond the last parallel.
  const x0 = whole ? -180 : w - step;
  const x1 = whole ? 180 : e + step;
  const y0 = Math.max(-89, s - step);
  const y1 = Math.min(89, n + step);
  for (let lat = s; lat <= n + 1e-9; lat += step) {
    const points: LL[] = [];
    for (let lon = x0; lon <= x1 + 1e-9; lon += bit) points.push([round(lon), round(lat)]);
    out.push({ kind: 'lat', at: round(lat), points });
  }
  for (let lon = w; lon <= e + 1e-9; lon += step) {
    const points: LL[] = [];
    for (let lat = y0; lat <= y1 + 1e-9; lat += bit) points.push([round(lon), round(lat)]);
    out.push({ kind: 'lon', at: round(beside(lon, 0) === -180 ? 180 : beside(lon, 0)), points });
  }
  return out;
}

/** How many decimals the coordinates of a map are given with: tenths where a degree is too coarse. */
export function coordDigits(okKm: number): 0 | 1 {
  // Half a degree of rounding is some 55 km: more than what counts as right on a small map.
  return okKm < 110 ? 1 : 0;
}

/**
 * The coordinates a piece is asked by: a point of it, written as roundly as the map allows. Whole degrees
 * are tried where the map is large, then tenths: whichever still falls inside the piece, so that what the
 * answer says is there is there. Null for a piece too small for either (Monaco is two kilometres across),
 * and for a line, which has no point of its own.
 */
export function coordOf(item: Pick<Item, 'geo' | 'lp' | 'shape'>, digits: 0 | 1): { ll: LL; digits: 0 | 1 } | null {
  // A city is a dot: tenths of a degree put it within a few kilometres.
  if (item.shape === 'point') return { ll: roundCoord(item.lp, 1), digits: 1 };
  if (item.shape !== 'area') return null;
  for (const d of digits === 0 ? ([0, 1] as const) : ([1] as const)) {
    const ll = roundCoord(item.lp, d);
    if (geoContains(item.geo, ll)) return { ll, digits: d };
  }
  return null;
}

/** A place as its coordinates name it: rounded, and with its longitude between −180 and 180. */
export function roundCoord(ll: LL, digits: number): LL {
  const f = 10 ** digits;
  const lat = Math.round(ll[1] * f) / f;
  let lon = Math.round(beside(ll[0], 0) * f) / f;
  if (lon === -180) lon = 180;
  // No negative zero: it would be written as "-0".
  return [lon + 0, lat + 0];
}

/** So many degrees, with no side: "40°", "40,4°". */
export function fmtDeg(n: number, digits = 0): string {
  return `${nf(Math.round(Math.abs(n) * 10 ** digits) / 10 ** digits, digits)}°`;
}

/** "40° N", "40,4° N", "0°": the equator is in neither hemisphere. */
export function fmtLat(lat: number, digits = 0): string {
  const deg = fmtDeg(lat, digits);
  return deg === '0°' ? deg : `${deg} ${lat > 0 ? 'N' : 'S'}`;
}

/** "4° O" in Spanish, "4° W" in English, "0°" on the meridian of Greenwich and "180°" on its opposite. */
export function fmtLon(lon: number, digits = 0): string {
  const deg = fmtDeg(lon, digits);
  return deg === '0°' || deg === '180°' ? deg : `${deg} ${lon > 0 ? 'E' : L('O', 'W')}`;
}

/** The two together, latitude first, as they are said: "40° N · 4° O". */
export function fmtCoord(ll: LL, digits = 0): string {
  return `${fmtLat(ll[1], digits)} · ${fmtLon(ll[0], digits)}`;
}

/** The same aloud, for those who do not see them: "40 grados norte, 4 grados oeste". */
export function sayCoord(ll: LL, digits = 0): string {
  const part = (n: number, pos: string, neg: string) => {
    const v = Math.round(Math.abs(n) * 10 ** digits) / 10 ** digits;
    const deg = v === 1 ? L('grado', 'degree') : L('grados', 'degrees');
    return v === 0 || v === 180 ? `${nf(v, digits)} ${deg}` : `${nf(v, digits)} ${deg} ${n > 0 ? pos : neg}`;
  };
  return `${part(ll[1], L('norte', 'north'), L('sur', 'south'))}, ${part(ll[0], L('este', 'east'), L('oeste', 'west'))}`;
}

/**
 * The coordinates offered for a point that is marked: four, the right ones among them, in no order that
 * tells. The wrong ones are the slips that reading a grid invites — a line too far, the other side of the
 * equator or of Greenwich, the latitude taken for the longitude —, and they come in pairs, so that the
 * right ones cannot be told by counting what the options have in common:
 *
 *  - two latitudes by two longitudes, each of them the right one and a wrong one (a line or two off, or
 *    the other hemisphere);
 *  - or the point and another a line off, each written the right way round and the wrong one.
 *
 * Every wrong option is at least a cell of the grid away from the point, so that the map tells them apart.
 * A line off stays on the map (`inside`) where it can: one that falls off it is ruled out at a glance.
 */
export function coordOptions(ll: LL, step: number, digits: number, rand: Rng, inside?: (ll: LL) => boolean): LL[] {
  const right = roundCoord(ll, digits);
  const [lon, lat] = right;
  const key = (p: LL) => `${p[0]}|${p[1]}`;
  // No latitude beyond the last parallel that a map can draw.
  const valid = (p: LL) => Math.abs(p[1]) <= 85 && Math.abs(p[0]) <= 180;
  const far = (p: LL) => Math.abs(p[1] - lat) >= step - 1e-9 || Math.abs(beside(p[0], lon) - lon) >= step - 1e-9;
  /** The latitude (`axis` 1) or the longitude (0) a line or two off: on the map where that can be, on the globe always. */
  const off = (axis: 0 | 1): number => {
    const v = right[axis];
    const unit = Math.max(step, digits ? 0.1 : 1);
    const at = (n: number): LL => (axis ? [lon, v + n * unit] : [v + n * unit, lat]);
    const all = [1, -1, 2, -2].filter((n) => valid(at(n)));
    const seen = inside ? all.filter((n) => inside(at(n))) : all;
    const from = seen.length ? seen : all;
    // One line off is the slip that is made most.
    const one = from.filter((n) => Math.abs(n) === 1);
    const pool = one.length && (one.length === from.length || rand() < 0.65) ? one : from.filter((n) => Math.abs(n) === 2);
    return v + pool[Math.floor(rand() * pool.length)] * unit;
  };
  /** The two numbers the wrong way round, each keeping the letter of its place: 41,8° N · 4,7° O read as 4,7° N · 41,8° O. */
  const swapped = (p: LL): LL => [(p[0] < 0 ? -1 : 1) * Math.abs(p[1]), (p[1] < 0 ? -1 : 1) * Math.abs(p[0])];
  const square = (lat2: number, lon2: number): LL[] => [right, [lon, lat2], [lon2, lat], [lon2, lat2]];
  const lines = () => square(off(1), off(0));
  const designs: (() => LL[])[] = [
    lines,
    // The other side of Greenwich, and a parallel off.
    () => square(off(1), -lon),
    // The other side of the equator, and a meridian off.
    () => square(-lat, off(0)),
    // The latitude taken for the longitude, of the point and of another one a line away.
    () => {
      const other: LL = rand() < 0.5 ? [lon, off(1)] : [off(0), lat];
      // Across the equator or Greenwich the other point would change a letter, and the pairs would no longer match.
      if (other[0] * lon < 0 || other[1] * lat < 0) return [];
      return [right, swapped(right), other, swapped(other)];
    },
  ];
  // A slip that is none here (the equator has no other side) leaves its place to the next; lines off always do.
  for (const design of [...shuffle(designs, rand), lines, lines]) {
    const four = design().map((q) => roundCoord(q, digits));
    if (four.length === 4 && new Set(four.map(key)).size === 4 && four.every(valid) && four.slice(1).every(far)) return shuffle(four, rand);
  }
  return [right];
}
