/**
 * "Fronteras": the land borders of a map, each one the line along which the outlines of two of its pieces
 * run together. The pieces of a map are cut from one drawing, so two that touch share the very same
 * points along their border: the lines are found by looking for them, with no arithmetic to go wrong.
 */
import type { MultiLineString, Position } from 'geojson';
import { distanceKm, spanKm } from './geo';
import type { Rng } from './text';
import type { Item, LL } from './types';

export interface Border {
  /** The ids of its two pieces, the lesser first, with a bar between them: "ES|FR". */
  id: string;
  a: string;
  b: string;
  geo: MultiLineString;
  /** Its length as it is drawn, which falls short of the real one: a drawn border cuts every corner. */
  km: number;
  /**
   * How far across the land it runs on is, in kilometres: the larger of the two sides, and of each side
   * the part that the border is on (for Spain beside Portugal the peninsula, not the Canaries as well).
   * A border much shorter than that is a speck beside what has to be recognised.
   */
  land: number;
  /** Somewhere about the middle of it. */
  mid: LL;
}

/** Is this id the id of a border, and not that of a piece? */
export const isBorderId = (id: string): boolean => id.includes('|');

const idOf = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

function ringsOf(item: Item): Position[][] {
  const g = item.geo.geometry;
  return g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : [];
}

/** How far across an outline is: measured on some of its points, which is as good and much quicker. */
function across(ring: Position[]): number {
  const step = Math.max(1, Math.floor(ring.length / 48));
  const points: LL[] = [];
  for (let i = 0; i < ring.length; i += step) points.push([ring[i][0], ring[i][1]]);
  return spanKm(points);
}

/**
 * A border shorter than this share of the land it runs on is not asked: to show it, the map has to come
 * so close that neither side can be told (France beside Monaco, Russia beside North Korea).
 */
export const BORDER_SHARE = 0.015;

/** Is a border long enough, beside the land around it, to be asked about? */
export const askable = (border: Border): boolean => border.km >= border.land * BORDER_SHARE;

/**
 * Every border between two pieces of a map. Pieces drawn from different files (the regions of two
 * countries) do not share their points, and have no border here: only the ones inside each country do.
 */
export function bordersOf(items: readonly Item[]): Border[] {
  /** Every outline of the map, whose piece it is, and how far across it is (worked out when asked). */
  const rings: Position[][] = [];
  const owners: number[] = [];
  const spans: (number | undefined)[] = [];
  const spanOf = (r: number) => (spans[r] ??= across(rings[r]));
  /** Each stretch between two points of an outline, and the outline it was first seen on. */
  const seen = new Map<string, number>();
  const found = new Map<string, { a: string; b: string; lines: Position[][]; ring: number; at: number; land: number }>();
  items.forEach((item, owner) => {
    if (item.shape !== 'area') return;
    for (const ring of ringsOf(item)) {
      const r = rings.length;
      rings.push(ring);
      owners.push(owner);
      for (let i = 0; i + 1 < ring.length; i++) {
        const p = ring[i];
        const q = ring[i + 1];
        // The same stretch whichever way round the outline goes.
        const key = p[0] < q[0] || (p[0] === q[0] && p[1] < q[1]) ? `${p[0]},${p[1]};${q[0]},${q[1]}` : `${q[0]},${q[1]};${p[0]},${p[1]}`;
        const first = seen.get(key);
        if (first == null) {
          seen.set(key, r);
          continue;
        }
        if (owners[first] === owner) continue;
        const id = idOf(items[owners[first]].id, item.id);
        let border = found.get(id);
        if (!border) found.set(id, (border = { a: id.slice(0, id.indexOf('|')), b: id.slice(id.indexOf('|') + 1), lines: [], ring: -1, at: -1, land: 0 }));
        // Stretches that follow one another along the outline are one line.
        if (border.ring === r && border.at === i - 1) border.lines[border.lines.length - 1].push(q);
        else {
          border.lines.push([p, q]);
          border.land = Math.max(border.land, spanOf(first), spanOf(r));
        }
        border.ring = r;
        border.at = i;
      }
    }
  });
  const out: Border[] = [];
  for (const [id, { a, b, lines, land }] of found) {
    let km = 0;
    let longest = lines[0];
    for (const line of lines) {
      for (let i = 0; i + 1 < line.length; i++) km += distanceKm(line[i] as LL, line[i + 1] as LL);
      if (line.length > longest.length) longest = line;
    }
    const m = longest[Math.floor(longest.length / 2)];
    out.push({ id, a, b, geo: { type: 'MultiLineString', coordinates: lines }, km, land, mid: [m[0], m[1]] });
  }
  return out.sort((x, y) => (x.id < y.id ? -1 : 1));
}

/** A handful of points along a border, its ends among them: enough to frame it. */
export function borderPoints(border: Border, about = 24): LL[] {
  const out: LL[] = [];
  const total = border.geo.coordinates.reduce((n, line) => n + line.length, 0);
  const step = Math.max(1, Math.floor(total / about));
  for (const line of border.geo.coordinates) {
    for (let i = 0; i < line.length; i += step) out.push([line[i][0], line[i][1]]);
    const last = line[line.length - 1];
    out.push([last[0], last[1]]);
  }
  return out;
}

/**
 * The borders offered for one that is asked, itself among them, in no order that tells. The wrong ones
 * are borders that could be mistaken for it, and chosen so that no name gives the answer away by coming
 * up more than the rest: one that shares the first piece, one that shares the second, and one that
 * shares neither and lies close by.
 */
export function borderOptions(border: Border, all: readonly Border[], rand: Rng, count = 4): Border[] {
  const others = all.filter((o) => o.id !== border.id);
  const pick = <T,>(list: T[]): T | undefined => list[Math.floor(rand() * list.length)];
  const has = (o: Border, id: string) => o.a === id || o.b === id;
  const near = (list: Border[]) => [...list].sort((x, y) => distanceKm(x.mid, border.mid) - distanceKm(y.mid, border.mid) || (x.id < y.id ? -1 : 1));
  const chosen: Border[] = [];
  const take = (o: Border | undefined) => {
    if (o && !chosen.includes(o) && chosen.length < count - 1) chosen.push(o);
  };
  take(pick(others.filter((o) => has(o, border.a) && !has(o, border.b))));
  take(pick(others.filter((o) => has(o, border.b) && !has(o, border.a))));
  // The third touches one of the wrong ones where it can, so that their pieces come up twice as well.
  const apart = others.filter((o) => !has(o, border.a) && !has(o, border.b));
  const third = chosen.flatMap((c) => [c.a, c.b]).filter((id) => id !== border.a && id !== border.b);
  take(near(apart.filter((o) => third.some((id) => has(o, id))))[0] ?? near(apart)[0]);
  // Where the map is too small for that, whatever lies closest.
  for (const o of near(others)) take(o);
  const options = [border, ...chosen];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}
