/**
 * Distances and bearings: with nothing drawn on the map, which way one place lies from another and how
 * far it is. The questions are dealt here; the game that asks them is games/Bearings.tsx.
 */
import { distanceKm } from './geo';
import { L } from './i18n';
import { nf } from './text';
import { dist, distUnit } from './units';
import type { LL, Res } from './types';

const RAD = Math.PI / 180;

/**
 * The course to keep from `a` to reach `b`, in degrees clockwise from north: the line that crosses every
 * meridian at the same angle, which is what "rumbo" means at sea and what a map with north at the top
 * shows. It is not the first heading of the shortest way, which from Madrid to Tokyo sets off to the
 * north-east: Tokyo is to the east.
 */
export function courseDeg(a: LL, b: LL): number {
  // Mercator's stretched latitude: on that map the course is a straight line.
  const up = (p: LL) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-89.5, Math.min(89.5, p[1])) * RAD) / 2));
  // The short way round the globe.
  const across = (((b[0] - a[0] + 540) % 360) - 180) * RAD;
  return (Math.atan2(across, up(b) - up(a)) / RAD + 360) % 360;
}

/** The eight points of the compass, clockwise from north. */
export const POINTS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
export type Point = (typeof POINTS)[number];

/** The point a course belongs to. */
export function pointOf(deg: number): Point {
  return (Math.round(deg / 45) % 8) as Point;
}

export const pointName = (p: Point): string =>
  [L('norte', 'north'), L('noreste', 'north-east'), L('este', 'east'), L('sureste', 'south-east'), L('sur', 'south'), L('suroeste', 'south-west'), L('oeste', 'west'), L('noroeste', 'north-west')][p];

/** As written on a compass: in Spanish the west is "O". */
export const pointShort = (p: Point): string => [L('N', 'N'), L('NE', 'NE'), L('E', 'E'), L('SE', 'SE'), L('S', 'S'), L('SO', 'SW'), L('O', 'W'), L('NO', 'NW')][p];

/** Degrees between a course and one of the eight points: 0 to 180. */
export function offPoint(deg: number, p: Point): number {
  const d = Math.abs(deg - p * 45) % 360;
  return d > 180 ? 360 - d : d;
}

/** A point beside the right one is close when the course leans towards it by this much: within 35° of it. */
const LEANING = 35;

/**
 * Right on the point the course belongs to. Close on the one beside it, when the course leans that way:
 * Barcelona lies east of Madrid and somewhat to the north, so "north-east" is close and "south-east" is
 * wrong. For something due east, both are wrong.
 */
export function judgePoint(deg: number, p: Point): Res {
  const off = offPoint(deg, p);
  return off <= 22.5 ? 'ok' : off <= LEANING ? 'warn' : 'bad';
}

/** A distance as it is said: to the nearest hundred, ten or five kilometres, by how long it is. */
export function roundKm(km: number): number {
  if (km >= 1000) return Math.round(km / 100) * 100;
  if (km >= 200) return Math.round(km / 10) * 10;
  if (km >= 50) return Math.round(km / 5) * 5;
  return Math.max(1, Math.round(km));
}

/** The same in the unit of the player, with it: "about 440 km" is "about 275 mi", not "273 mi". */
export function saidDist(km: number): string {
  return `${nf(roundKm(dist(km)))} ${distUnit()}`;
}

/** How much longer each option is than the one before. */
const STEP = 1.6;
/** The longest way there is between two places: half the way round the world. */
export const HALF_WORLD = 20000;

/**
 * Four distances to choose from, the shortest first: the true one and three that are each some 60 % apart
 * from the next. Where the true one falls among them is drawn by lot, so that it is not always the second.
 * None is longer than `maxKm`, what the map allows: 25,000 km is no distance between two places on Earth.
 * It works as well in miles, with both figures in miles: the options are then round numbers of miles.
 */
export function distanceOptions(km: number, rand: () => number, maxKm = HALF_WORLD): { options: number[]; right: number } {
  const truth = roundKm(km);
  /** How many options fit above the true one. */
  const above = Math.max(0, Math.floor(Math.log(Math.max(maxKm, km) / km) / Math.log(STEP) + 1e-9));
  // Under a way of a kilometre or two there is no room for shorter ones either.
  const hi = Math.max(0, Math.min(3, truth - 1));
  const lo = Math.min(hi, Math.max(0, 3 - above));
  const right = lo + Math.min(hi - lo, Math.floor(rand() * (hi - lo + 1)));
  const options = [0, 1, 2, 3].map((i) => (i === right ? truth : roundKm(km * STEP ** (i - right))));
  // Very short distances round to the same figure: each option is at least one more than the one before.
  for (let i = right + 1; i < 4; i++) options[i] = Math.max(options[i], options[i - 1] + 1);
  for (let i = right - 1; i >= 0; i--) options[i] = Math.max(1, Math.min(options[i], options[i + 1] - 1));
  return { options, right };
}

export type LegAsk = 'dir' | 'dist';

/** One question: what is asked of `to`, seen from `from`. */
export interface Leg {
  from: string;
  to: string;
  ask: LegAsk;
  /** The course from one to the other. */
  deg: number;
  km: number;
}

/** A course this near the middle of its point is asked; one between two points would be a coin toss. */
export const CLEAR = 10;
/** Two surfaces are well apart when their centres are this many times as far as they are wide, on average. */
const ROOM = 1.5;

/** Something on the map: where its centre is and, for a surface, its km². */
export interface Place {
  id: string;
  lp: LL;
  area?: number;
}

/**
 * The questions of a game: each place of `order` is asked about once, seen from another one of the map,
 * drawn by lot. With `both`, a course and a distance take turns.
 *
 * Not from just anywhere, while there is a choice:
 * - two places closer than `minKm` are hardly apart on that map;
 * - two surfaces that touch, or nearly, lie every which way from each other: Sweden is east of Norway for
 *   anyone, and north-east from centre to centre;
 * - across the line where a map of the world is cut, the short way is not the one the map shows;
 * - and a course that falls between two points of the compass has no fair answer.
 */
export function dealLegs(places: readonly Place[], order: readonly string[], ask: 'both' | LegAsk, minKm: number, rand: () => number): Leg[] {
  const byId = new Map(places.map((p) => [p.id, p]));
  const side = (p: Place) => Math.sqrt(p.area ?? 0);
  const legs: Leg[] = [];
  let before = '';
  order.forEach((id, i) => {
    const to = byId.get(id);
    if (!to) return;
    const kind: LegAsk = ask === 'both' ? (i % 2 ? 'dist' : 'dir') : ask;
    const others = places
      .filter((p) => p.id !== id)
      .map((p) => {
        const km = distanceKm(p.lp, to.lp);
        return { id: p.id, km, deg: courseDeg(p.lp, to.lp), roomy: km >= (ROOM * (side(p) + side(to))) / 2 && Math.abs(p.lp[0] - to.lp[0]) <= 180 };
      });
    if (!others.length) return;
    const apart = others.filter((o) => o.km >= minKm);
    const roomy = apart.filter((o) => o.roomy);
    const clear = roomy.filter((o) => offPoint(o.deg, pointOf(o.deg)) <= CLEAR);
    let pool = [...(kind === 'dir' ? [clear] : []), roomy, apart, others].find((list) => list.length)!;
    // Not from the same place twice running, where there is a choice.
    if (pool.length > 1) pool = pool.filter((o) => o.id !== before);
    const from = pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
    before = from.id;
    legs.push({ from: from.id, to: id, ask: kind, deg: from.deg, km: from.km });
  });
  return legs;
}
