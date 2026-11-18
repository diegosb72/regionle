/**
 * A blank map to print: in which order its pieces are numbered, where each number goes and how big the
 * map comes out on the paper. Nothing here draws: `games/PrintSheet.tsx` does.
 */

import { geoDistance } from 'd3-geo';
import type { LL } from './types';

/** A thing on the sheet, in map units: where its number is anchored and how much room it has. */
export interface Spot {
  id: string;
  kind: 'area' | 'line' | 'point';
  /** Its label point. */
  x: number;
  y: number;
  /** Width and height of its biggest piece of land; 0 for a dot. */
  w: number;
  h: number;
}

export interface Numbered {
  id: string;
  n: number;
  /** Centre of the number. */
  x: number;
  y: number;
  /** Radius of the ring drawn around a piece too small to be seen. */
  ring?: number;
  /** The number had to go away from its piece: the line that joins them, [x0, y0, x1, y1]. */
  lead?: [number, number, number, number];
}

type Box = [number, number, number, number];

/**
 * The order the pieces are numbered in: as a page is read, in rows from the top and from left to right
 * within each row. Whoever fills the sheet in goes down the list and has to find each number on the map:
 * this way the next one is always near the last. (By name the numbers would give the answers away.)
 */
export function readingOrder(spots: readonly Spot[]): string[] {
  if (!spots.length) return [];
  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  let right = -Infinity;
  for (const s of spots) {
    if (s.y < top) top = s.y;
    if (s.y > bottom) bottom = s.y;
    if (s.x < left) left = s.x;
    if (s.x > right) right = s.x;
  }
  const height = bottom - top;
  const width = right - left;
  // As many rows as a grid of square cells with one piece in each would have.
  const rows = Math.max(1, Math.round(Math.sqrt((spots.length * height) / (width || height || 1))));
  const rowOf = (s: Spot) => (height > 0 ? Math.min(rows - 1, Math.floor(((s.y - top) / height) * rows)) : 0);
  return [...spots].sort((a, b) => rowOf(a) - rowOf(b) || a.x - b.x || a.y - b.y || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((s) => s.id);
}

/** Room a number takes, in map units, for digits of height `font`. */
export function numberBox(n: number, font: number): { w: number; h: number } {
  return { w: String(n).length * font * 0.62 + font * 0.34, h: font * 1.16 };
}

/** Radius of the dot a city is drawn with, for digits of height `font`. */
export const dotRadius = (font: number): number => font * 0.34;

const overlaps = (a: Box, b: Box): boolean => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

/** East first, as the names of a map go; then the other sides, then the corners. */
const SIDES: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, -1],
  [-1, -1],
  [1, 1],
  [-1, 1],
];
/** How many times further out a number is tried before it is put where it falls. */
const REACH = 4;

/**
 * Where each number goes. One that fits inside its piece sits on its label point; those of dots and of
 * pieces smaller than a number go beside them, on the first side where nothing else is, and a little
 * further out, joined by a line, where every side is taken. Specks get a ring to be seen at all.
 */
export function placeNumbers(spots: readonly Spot[], order: readonly string[], opts: { font: number; box: Box; avoid?: readonly Box[] }): Numbered[] {
  const { font, box } = opts;
  const gap = font * 0.18;
  const dot = dotRadius(font);
  const ringR = font * 0.72;
  /**
   * A piece whose label point lies off the sheet (Russia on the usual map of Europe) is numbered where
   * the sheet ends: the nearest place to it that is printed.
   */
  const m = font * 0.9;
  const pull = (v: number, lo: number, hi: number) => (lo + m <= hi - m ? Math.min(Math.max(v, lo + m), hi - m) : (lo + hi) / 2);
  const byId = new Map(spots.map((s) => [s.id, { ...s, x: pull(s.x, box[0], box[2]), y: pull(s.y, box[1], box[3]) }]));
  /** Too small to be made out on paper. */
  const speck = (s: Spot) => s.kind === 'area' && Math.max(s.w, s.h) < font * 1.2;
  // Where no number may go: the boxes that hold the far pieces of the map.
  const taken: Box[] = [...(opts.avoid ?? [])];
  // What must stay in sight whatever the numbers do: the dots and the rings.
  for (const s of byId.values()) {
    if (s.kind === 'point') taken.push([s.x - dot, s.y - dot, s.x + dot, s.y + dot]);
    else if (speck(s)) taken.push([s.x - ringR, s.y - ringR, s.x + ringR, s.y + ringR]);
  }
  const rectAt = (x: number, y: number, w: number, h: number): Box => [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
  const inside = (r: Box) => r[0] >= box[0] && r[1] >= box[1] && r[2] <= box[2] && r[3] <= box[3];
  const free = (r: Box) => inside(r) && !taken.some((t) => overlaps(r, t));
  const clamp = (x: number, y: number, w: number, h: number): [number, number] => [
    Math.min(Math.max(x, box[0] + w / 2), Math.max(box[0] + w / 2, box[2] - w / 2)),
    Math.min(Math.max(y, box[1] + h / 2), Math.max(box[1] + h / 2, box[3] - h / 2)),
  ];

  const out = new Map<string, Numbered>();
  const numberOf = new Map(order.map((id, i) => [id, i + 1]));
  /** A number fits in a piece that is at least about its own size: its edge may be touched, not left behind. */
  const fits = (s: Spot, w: number, h: number) => s.kind === 'area' && s.w >= w * 0.9 && s.h >= h * 0.9;

  // First the ones that go inside their piece: nothing else may take that place.
  const beside: Spot[] = [];
  for (const id of order) {
    const s = byId.get(id);
    if (!s) continue;
    const n = numberOf.get(id)!;
    const { w, h } = numberBox(n, font);
    if (s.kind === 'line' || fits(s, w, h)) {
      const r = rectAt(s.x, s.y, w, h);
      if (free(r)) {
        taken.push(r);
        out.set(id, { id, n, x: s.x, y: s.y });
        continue;
      }
    }
    beside.push(s);
  }

  for (const s of beside) {
    const n = numberOf.get(s.id)!;
    const { w, h } = numberBox(n, font);
    const ring = speck(s) ? ringR : undefined;
    // What the number must leave in sight around the label point: the dot, the ring, or a bit of the piece.
    const r0 = s.kind === 'point' ? dot : ring ? ringR : s.kind === 'line' ? 0 : Math.min(Math.min(s.w, s.h) / 2, font * 0.6);
    let done: Numbered | null = null;
    for (let k = 0; k < REACH && !done; k++) {
      for (const [dx, dy] of SIDES) {
        // A corner is as far as a side: both offsets are shortened.
        const f = dx && dy ? 0.72 : 1;
        const x = s.x + dx * f * (r0 + gap + w / 2 + k * h);
        const y = s.y + dy * f * (r0 + gap + h / 2 + k * h);
        const r = rectAt(x, y, w, h);
        if (!free(r)) continue;
        taken.push(r);
        done = { id: s.id, n, x, y, ring };
        // Next to its dot or its ring a number needs nothing else. Further out, or beside a piece with
        // neither, a line says whose it is.
        if (k > 0 || (s.kind === 'area' && !ring)) done.lead = leadOf(s.x, s.y, r);
        break;
      }
    }
    if (!done) {
      // Nowhere is free: to the east, on top of whatever is there. A crowded map is read with patience.
      const [x, y] = clamp(s.x + r0 + gap + w / 2, s.y, w, h);
      taken.push(rectAt(x, y, w, h));
      done = { id: s.id, n, x, y, ring };
    }
    out.set(s.id, done);
  }
  return order.map((id) => out.get(id)).filter((p): p is Numbered => !!p);
}

/** The line from a label point to the edge of the box its number is in. */
function leadOf(x: number, y: number, r: Box): [number, number, number, number] {
  const cx = (r[0] + r[2]) / 2;
  const cy = (r[1] + r[3]) / 2;
  const dx = cx - x;
  const dy = cy - y;
  // How much of the way is outside the box: the line stops at its edge.
  const tx = dx ? Math.max(0, 1 - (r[2] - r[0]) / 2 / Math.abs(dx)) : 0;
  const ty = dy ? Math.max(0, 1 - (r[3] - r[1]) / 2 / Math.abs(dy)) : 0;
  const t = Math.max(tx, ty);
  return [x, y, x + dx * t, y + dy * t];
}

/** What can be written on, in millimetres, on A4 and on Letter alike with 12 mm of margin. */
export const PAGE = { w: 186, h: 250 };
/** Title, name and date above the map, and the line of credit below. */
const HEADER = 26;
/** A line of the list to write a name on, in millimetres; beside the map it gives a little to fit. */
export const ROW = 7;
const ROW_MIN = 6;
const ROW_MAX = 8;
/** A column of the list: a number and room to write a name. */
const COL = 42;
const COL_GAP = 6;
const LIST_GAP = 6;

export interface SheetLayout {
  /** The page lies down. */
  landscape: boolean;
  /** Printed size of the map, in millimetres. */
  mapW: number;
  mapH: number;
  /** The list stands beside the map and not under it. */
  side: boolean;
  /** Columns of the list of names. */
  columns: number;
  /** Height of a line of the list, in millimetres. */
  row: number;
  /** The list does not fit on the page of the map without leaving it too small: it starts a page of its own. */
  split: boolean;
  /** Height of a digit on the map, in millimetres. */
  digit: number;
}

/**
 * How the sheet is laid out for a map `ratio` times as wide as tall with `count` numbered pieces
 * (0: a map with nothing on it). Every way of fitting map and list on one page is tried (the page up or
 * lying down, the list under the map or beside it) and the one with the biggest map wins. Where even that
 * leaves the map at little more than half of what the page allows, the map takes the page and the list
 * the next one. `landscape` asks for a given way up: the sheets of one print go the same way.
 */
export function layoutOf(ratio: number, count: number, landscape?: boolean): SheetLayout {
  const digit = count > 90 ? 2 : count > 40 ? 2.3 : 2.7;
  const ways = landscape == null ? [false, true] : [landscape];
  const room = (lying: boolean) => ({ w: lying ? PAGE.h : PAGE.w, h: (lying ? PAGE.w : PAGE.h) - HEADER });
  const fit = (w: number, h: number) => {
    const mapW = Math.min(w, h * ratio);
    return { mapW, mapH: mapW / ratio };
  };
  /** Columns that fit across a page with the list under the map. */
  const across = (lying: boolean) => Math.max(1, Math.floor((room(lying).w + COL_GAP) / (COL + COL_GAP)));
  /**
   * The biggest map wins, but not by a hair: a sheet is handed out standing up with its list under the
   * map, and it takes a clearly bigger map to do otherwise.
   */
  const worth = (o: { mapW: number; landscape: boolean; side?: boolean }) => o.mapW * (o.landscape ? 1 : 1.08) * (o.side ? 1 : 1.04);
  // The map with the page to itself.
  const alone = ways.map((lying) => ({ landscape: lying, ...fit(room(lying).w, room(lying).h) })).sort((a, b) => worth(b) - worth(a))[0];
  if (count <= 0) return { ...alone, side: false, columns: across(alone.landscape), row: ROW, split: false, digit };

  const options: Omit<SheetLayout, 'split' | 'digit'>[] = [];
  for (const lying of ways) {
    const { w, h } = room(lying);
    const columns = across(lying);
    const under = Math.ceil(count / columns) * ROW + LIST_GAP;
    if (h - under > 20) options.push({ landscape: lying, side: false, columns, row: ROW, ...fit(w, h - under) });
    for (let c = 1; c <= 3; c++) {
      const beside = c * COL + (c - 1) * COL_GAP + LIST_GAP;
      // The lines share out the height of the page, within what a hand can write in.
      const row = Math.min(ROW_MAX, h / Math.ceil(count / c));
      if (row < ROW_MIN || w - beside < 30) continue;
      options.push({ landscape: lying, side: true, columns: c, row, ...fit(w - beside, h) });
    }
  }
  const best = options.sort((a, b) => worth(b) - worth(a))[0];
  if (best && best.mapW >= alone.mapW * 0.6) return { ...best, split: false, digit };
  return { ...alone, side: false, columns: across(alone.landscape), row: ROW, split: true, digit };
}

/** The part of the map that is printed: the framed box with some air around it, kept inside what can be drawn. */
export function frameOf(box: Box, limits: Box, pad = 0.05): Box {
  const m = Math.max(box[2] - box[0], box[3] - box[1]) * pad;
  const out: Box = [Math.max(limits[0], box[0] - m), Math.max(limits[1], box[1] - m), Math.min(limits[2], box[2] + m), Math.min(limits[3], box[3] + m)];
  // A single dot, or bad data: something that can still be drawn.
  if (!(out[2] - out[0] > 0) || !(out[3] - out[1] > 0)) return [box[0] - 1, box[1] - 1, box[0] + 1, box[1] + 1];
  return out;
}

const DEG = 180 / Math.PI;

/**
 * The smallest circle on the globe that holds some points: its centre and its radius in degrees. Worked
 * out by walking from the middle of the points towards whichever is furthest, a shorter step each time
 * (Bădoiu and Clarkson): the mean of the points would do for pieces spread evenly, and is pulled far off
 * by an island that brings as many points as a mainland.
 */
export function circleOf(points: readonly LL[]): { centre: LL; radius: number } {
  if (!points.length) return { centre: [0, 0], radius: 0 };
  const vs = points.map(([lon, lat]) => {
    const a = lon / DEG;
    const b = lat / DEG;
    return [Math.cos(b) * Math.cos(a), Math.cos(b) * Math.sin(a), Math.sin(b)];
  });
  const unit = (v: number[]) => {
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / len, v[1] / len, v[2] / len];
  };
  let c = unit(vs.reduce((sum, v) => [sum[0] + v[0], sum[1] + v[1], sum[2] + v[2]], [0, 0, 0]));
  const furthest = () => {
    let best = vs[0];
    let low = Infinity;
    for (const v of vs) {
      const dot = v[0] * c[0] + v[1] * c[1] + v[2] * c[2];
      if (dot < low) {
        low = dot;
        best = v;
      }
    }
    return { v: best, dot: low };
  };
  for (let k = 1; k <= 120; k++) {
    const { v } = furthest();
    c = unit([c[0] + (v[0] - c[0]) / (k + 1), c[1] + (v[1] - c[1]) / (k + 1), c[2] + (v[2] - c[2]) / (k + 1)]);
  }
  return { centre: [Math.atan2(c[1], c[0]) * DEG, Math.asin(Math.max(-1, Math.min(1, c[2]))) * DEG], radius: Math.acos(Math.max(-1, Math.min(1, furthest().dot))) * DEG };
}

/** A piece of the map on the globe: its label point and the points that frame it. */
export interface Place {
  id: string;
  lp: LL;
  fp: readonly LL[];
  /** km², where it is known: what is put in a box has to be a small part of the whole. */
  area?: number;
  /** How many asked things it stands for (an island with three cities on it); one when not said. */
  count?: number;
}

/** Pieces further apart than this many degrees are never taken as lying together. */
const LINK_MAX = 6;
/** Far pieces go in the same box when there is less than this many degrees between them. */
const BOX_LINK = 1.5;
/** More boxes than this are no longer a map with a few far islands: it is left as it is. */
const INSETS_MAX = 6;
/**
 * How many times smaller the circle that holds the rest has to be for the boxes to be worth it. Alaska and
 * Hawaii make the United States 1,8 times as wide; Tobago makes Trinidad 1,56 times, and stays where it is.
 */
const WORTH = 1.65;
/** Beyond this many pieces the search is not worth its cost. */
const FAR_MAX = 1200;

/** Sets of pieces with less than `link` degrees between one and the next. */
function linked(places: readonly Place[], reach: ReadonlyMap<string, number>, link: number): Place[][] {
  const n = places.length;
  const parent = places.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (find(i) === find(j)) continue;
      if (geoDistance(places[i].lp, places[j].lp) * DEG - reach.get(places[i].id)! - reach.get(places[j].id)! <= link) parent[find(i)] = find(j);
    }
  }
  const byRoot = new Map<number, Place[]>();
  places.forEach((p, i) => {
    const root = find(i);
    const list = byRoot.get(root);
    if (list) list.push(p);
    else byRoot.set(root, [p]);
  });
  return [...byRoot.values()];
}

/**
 * The groups of pieces that lie so far from the rest that the map would be mostly sea to hold them: the
 * Canary Islands, Alaska and Hawaii, the Azores and Madeira. They are printed in boxes of their own, as
 * school maps do, and the rest gets the whole sheet. Empty when the map is fine as it is.
 */
export function farGroups(places: readonly Place[]): string[][] {
  const n = places.length;
  const pointsOf = (list: readonly Place[]): LL[] => list.flatMap((p) => (p.fp.length ? [...p.fp] : [p.lp]));
  const countOf = (list: readonly Place[]) => list.reduce((sum, p) => sum + (p.count ?? 1), 0);
  // A map of two or three things has nothing to gain: it is small already.
  if (n < 2 || n > FAR_MAX || countOf(places) < 4) return [];
  const areaOf = (list: readonly Place[]) => list.reduce((sum, p) => sum + (p.area ?? 0), 0);
  const whole = circleOf(pointsOf(places));
  // How far each piece reaches from its label point.
  const reach = new Map(places.map((p) => [p.id, p.fp.reduce((m, q) => Math.max(m, geoDistance(p.lp, q) * DEG), 0)]));
  // Pieces with less than this between them lie together. Islands near their coast do; the Canaries do not.
  const clusters = linked(places, reach, Math.min(LINK_MAX, Math.max(0.3, whole.radius * 0.2)));
  if (clusters.length < 2) return [];
  clusters.sort((a, b) => countOf(b) - countOf(a) || areaOf(b) - areaOf(a));
  const main = clusters[0];
  const mainCap = circleOf(pointsOf(main));
  const mainCount = countOf(main);
  const mainArea = areaOf(main);
  let kept = [...main];
  // What could go in a box: a few pieces that are a small part of the whole. Two halves of a country
  // (the two Malaysias) are a country. Two archipelagos far from each other get a box each.
  const far: Place[][] = [];
  for (const cluster of clusters.slice(1)) {
    for (const c of linked(cluster, reach, BOX_LINK)) {
      const small = countOf(c) <= Math.max(1, mainCount * 0.25) && (!mainArea || areaOf(c) <= mainArea * 0.3);
      if (small) far.push(c);
      else kept = kept.concat(c);
    }
  }
  // From the nearest: what the map can hold at next to no cost stays on it.
  const away = (c: Place[]) => geoDistance(mainCap.centre, circleOf(pointsOf(c)).centre);
  far.sort((a, b) => away(a) - away(b));
  let keptR = circleOf(pointsOf(kept)).radius;
  const out: Place[][] = [];
  for (const c of far) {
    const withIt = circleOf(pointsOf(kept.concat(c))).radius;
    if (withIt < keptR * 1.08) {
      kept = kept.concat(c);
      keptR = withIt;
    } else out.push(c);
  }
  // Worth it only where the rest comes out clearly bigger: an island a short way off is left where it is.
  if (!out.length || out.length > INSETS_MAX || whole.radius < keptR * WORTH) return [];
  return out.map((c) => c.map((p) => p.id));
}

/** The outer ring of a piece of land, as GeoJSON has it. */
type Ring = readonly (readonly number[])[];

/**
 * A map of cities has no pieces that reach anywhere: what lies together or apart is the land they stand
 * on. Each island or mainland with a city on it is a place here, counted for as many cities as it has.
 */
export function landPlaces(rings: readonly Ring[], cities: readonly { id: string; lp: LL }[]): { places: Place[]; landOf: Map<string, string>; boxOf: Map<string, [number, number, number, number]> } {
  const boxes = rings.map((ring) => {
    let w = Infinity;
    let e = -Infinity;
    let south = Infinity;
    let north = -Infinity;
    for (const p of ring) {
      if (p[0] < w) w = p[0];
      if (p[0] > e) e = p[0];
      if (p[1] < south) south = p[1];
      if (p[1] > north) north = p[1];
    }
    return { w, e, south, north, size: (e - w) * (north - south) };
  });
  const landOf = new Map<string, string>();
  const count = new Map<number, number>();
  for (const c of cities) {
    let best = -1;
    let bestScore = Infinity;
    boxes.forEach((b, i) => {
      // How far outside the box of the land the city is; among the boxes it is in, the smallest: an island
      // off a coast lies inside the box of the mainland too.
      const out = Math.max(0, b.w - c.lp[0], c.lp[0] - b.e) + Math.max(0, b.south - c.lp[1], c.lp[1] - b.north);
      const score = out > 0 ? 1e6 + out : b.size;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best < 0) continue;
    landOf.set(c.id, `land:${best}`);
    count.set(best, (count.get(best) ?? 0) + 1);
  }
  const places: Place[] = [];
  const boxOf = new Map<string, [number, number, number, number]>();
  for (const [i, n] of count) {
    const ring = rings[i];
    const b = boxes[i];
    // Sixteen points along its edge say where it is and how far it reaches.
    const fp: LL[] = [];
    for (let k = 0; k < 16; k++) {
      const p = ring[Math.floor((k / 16) * ring.length)];
      fp.push([p[0], p[1]]);
    }
    places.push({ id: `land:${i}`, lp: [(b.w + b.e) / 2, (b.south + b.north) / 2], fp, count: n });
    boxOf.set(`land:${i}`, [b.w, b.south, b.e, b.north]);
  }
  return { places, landOf, boxOf };
}

/** A box asked for: its size on the sheet, and which way from the middle of the map its pieces really lie. */
export interface InsetAsk {
  w: number;
  h: number;
  dx: number;
  dy: number;
}

const grown = (b: Box, m: number): Box => [b[0] - m, b[1] - m, b[2] + m, b[3] + m];

/**
 * Where the boxes of the far pieces go. In a corner of the map on the side they really lie, where one is
 * free of the pieces that are asked; where none is, the map gets a strip more at the bottom and the boxes
 * stand in it, from west to east. Returns the part of the map to print, strip and all, and one box for
 * each asked, in the same order.
 */
export function placeInsets(frame: Box, obstacles: readonly Box[], asks: readonly InsetAsk[]): { frame: Box; boxes: Box[] } {
  if (!asks.length) return { frame, boxes: [] };
  const m = Math.max(frame[2] - frame[0], frame[3] - frame[1]) * 0.015;
  const clear = (r: Box, others: readonly Box[]) => !obstacles.some((o) => overlaps(grown(r, m * 0.5), o)) && !others.some((o) => overlaps(grown(r, m), o));
  const corner = (a: InsetAsk, east: boolean, south: boolean): Box => {
    const x = east ? frame[2] - m - a.w : frame[0] + m;
    const y = south ? frame[3] - m - a.h : frame[1] + m;
    return [x, y, x + a.w, y + a.h];
  };
  // The biggest first: it is the hardest to find room for.
  const bySize = asks.map((_, i) => i).sort((i, j) => asks[j].w * asks[j].h - asks[i].w * asks[i].h);
  const boxes: (Box | null)[] = asks.map(() => null);
  let all = true;
  for (const i of bySize) {
    const a = asks[i];
    const east = a.dx > 0;
    const south = a.dy > 0;
    // Its own corner, then the two beside it, then the one across.
    const tries: [boolean, boolean][] = [
      [east, south],
      Math.abs(a.dx) > Math.abs(a.dy) ? [east, !south] : [!east, south],
      Math.abs(a.dx) > Math.abs(a.dy) ? [!east, south] : [east, !south],
      [!east, !south],
    ];
    const placed = boxes.filter((b): b is Box => !!b);
    const spot = tries.map(([e, s]) => corner(a, e, s)).find((r) => clear(r, placed));
    if (spot) boxes[i] = spot;
    else {
      all = false;
      break;
    }
  }
  if (all) return { frame, boxes: boxes as Box[] };

  // A strip under the map for all of them: boxes here and there would be harder to read than a row.
  const order = asks.map((_, i) => i).sort((i, j) => asks[i].dx - asks[j].dx);
  const width = frame[2] - frame[0];
  const total = order.reduce((sum, i) => sum + asks[i].w, 0) + m * (asks.length + 1);
  // Too many to stand side by side at their size: all of them a little smaller.
  const f = Math.min(1, width / total);
  const tall = Math.max(...asks.map((a) => a.h)) * f;
  const out: Box[] = asks.map(() => [0, 0, 0, 0]);
  let x = frame[0] + m * f;
  const bottom = frame[3] + tall + m;
  for (const i of order) {
    const w = asks[i].w * f;
    const h = asks[i].h * f;
    out[i] = [x, bottom - m - h, x + w, bottom - m];
    x += w + m * f;
  }
  return { frame: [frame[0], frame[1], frame[2], bottom], boxes: out };
}
