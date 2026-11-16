/**
 * The daily challenge: everything that is asked on a given day follows from the date alone, so it is
 * the same for everyone and any past day can be played again.
 */
import { hashStr, mulberry32, sample, shuffle } from '../lib/text';
import type { Country, Index, Item, LL } from '../lib/types';

/** Day 0 of the rotation. */
export const EPOCH = '2026-01-01';
export const TESTS = 5;
export const MAX_POINTS = 20;
export const GUESSES = 6;

// ---------------------------------------------------------------------------
// Dates ("2026-11-15", local calendar days)
// ---------------------------------------------------------------------------

function utc(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function isDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = utc(s);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
}

export function addDays(date: string, k: number): string {
  return new Date(utc(date) + k * 86400000).toISOString().slice(0, 10);
}

/** Days since the epoch. */
export function dayNumber(date: string): number {
  return Math.round((utc(date) - utc(EPOCH)) / 86400000);
}

// ---------------------------------------------------------------------------
// Country of the day
// ---------------------------------------------------------------------------

function firstLevel(c: Country): number {
  return (c.lv.find((l) => l.k === c.dl) ?? c.lv[c.lv.length - 1])?.n ?? 0;
}

/** Countries whose regions can be the subject of a day: sovereign, not tiny, with between 8 and 60 first-level pieces. */
export function dailyPool(index: Index): Country[] {
  return index.countries
    .filter((c) => (c.cl === 'un' || c.cl === 'obs' || c.cl === 'partial') && (c.pop ?? 0) >= 250_000 && firstLevel(c) >= 8 && firstLevel(c) <= 60)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Days that must pass before a country comes back. */
const GAP = 30;

const weight = (c: Country) => ((c.pop ?? 0) >= 40e6 ? 3 : (c.pop ?? 0) >= 10e6 ? 2 : 1);

/**
 * One lap of the rotation: every country once, the populous ones two or three times, shuffled and
 * then mended so that nobody comes back within a month (the end of the previous lap included).
 */
function lap(pool: Country[], cycle: number, before: string[]): string[] {
  const bag: string[] = [];
  for (const c of pool) for (let i = 0; i < weight(c); i++) bag.push(c.id);
  const rng = mulberry32(hashStr(`regionle|lap|${cycle}`));
  const order = shuffle(bag, rng);
  const at = (k: number) => (k >= 0 ? order[k] : before[before.length + k]);
  const clash = (i: number, id: string) => {
    for (let k = Math.max(i - GAP, -before.length); k <= Math.min(i + GAP, order.length - 1); k++) if (k !== i && at(k) === id) return true;
    return false;
  };
  for (let pass = 0; pass < 12; pass++) {
    let mended = false;
    for (let i = 0; i < order.length; i++) {
      if (!clash(i, order[i])) continue;
      const start = Math.floor(rng() * order.length);
      for (let step = 0; step < order.length; step++) {
        const j = (start + step) % order.length;
        const a = order[i];
        const b = order[j];
        if (a === b) continue;
        order[i] = b;
        order[j] = a;
        if (!clash(i, b) && !clash(j, a)) {
          mended = true;
          break;
        }
        order[i] = a;
        order[j] = b;
      }
    }
    if (!mended) break;
  }
  return order;
}

const laps = new WeakMap<Country[], string[][]>();

/** The country whose regions are the subject of day `n` (days before the epoch count as day 0). */
export function countryOfDay(pool: Country[], n: number): Country {
  let mine = laps.get(pool);
  if (!mine) laps.set(pool, (mine = []));
  const length = pool.reduce((sum, c) => sum + weight(c), 0);
  const day = Math.max(0, n);
  const cycle = Math.floor(day / length);
  while (mine.length <= cycle) mine.push(lap(pool, mine.length, mine.length ? mine[mine.length - 1].slice(-GAP) : []));
  const id = mine[cycle][day - cycle * length];
  return pool.find((c) => c.id === id)!;
}

// ---------------------------------------------------------------------------
// What each test asks
// ---------------------------------------------------------------------------

const rngFor = (date: string, what: string) => mulberry32(hashStr(`${date}|${what}`));

/** Tests 1 and 2: the mystery region and the five regions to point at. */
export function regionTargets(date: string, ids: string[]): { mystery: string; pins: string[] } {
  const order = shuffle([...ids].sort(), rngFor(date, 'regions'));
  return { mystery: order[0], pins: order.slice(1, 6) };
}

/** Countries that can be guessed or asked in the world-wide tests. */
export function worldPool(index: Index): Country[] {
  return index.countries.filter((c) => c.cl !== 'dep' && c.cl !== 'other').sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Test 4: the country to guess from its population. */
export function whichTarget(date: string, index: Index, avoid: string): Country {
  const list = worldPool(index).filter((c) => c.cl === 'un' && (c.pop ?? 0) >= 1e6 && c.id !== avoid);
  return list[Math.floor(rngFor(date, 'which')() * list.length)];
}

export interface QuickQuestion {
  kind: 'flag' | 'capital';
  id: string;
  /** Four country ids, the right one among them. */
  options: string[];
}

function nearestTo(target: Country, pool: Country[], n: number): Country[] {
  const [lon, lat] = target.lp;
  const cos = Math.cos((lat * Math.PI) / 180);
  return pool
    .filter((c) => c.id !== target.id)
    .map((c) => {
      let dLon = Math.abs(c.lp[0] - lon);
      if (dLon > 180) dLon = 360 - dLon;
      return [Math.hypot(dLon * cos, c.lp[1] - lat), c] as const;
    })
    .sort((a, b) => a[0] - b[0])
    .slice(0, n)
    .map((x) => x[1]);
}

/** Test 5: three flags and two capitals, each with three plausible wrong options from the same part of the world. */
export function quickQuestions(date: string, index: Index, avoid: string[]): QuickQuestion[] {
  const rng = rngFor(date, 'quick');
  const list = worldPool(index).filter((c) => c.cl === 'un' && c.fl && c.cap && !avoid.includes(c.id));
  return sample(list, 5, rng).map((c, i) => {
    const kind = i < 3 ? ('flag' as const) : ('capital' as const);
    const others = sample(nearestTo(c, list, 9), 3, rng);
    return { kind, id: c.id, options: shuffle([c, ...others], rng).map((o) => o.id) };
  });
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const LADDER = [20, 16, 12, 9, 6, 3];

/** Points for guessing at the n-th attempt (tests 1 and 4). */
export function ladder(tries: number, won: boolean): number {
  return won ? (LADDER[Math.max(0, tries - 1)] ?? 3) : 0;
}

/** Points for a route finished with `extra` guesses over the minimum (hints count as one each). */
export function routePoints(extra: number, lost: boolean): number {
  if (lost) return 0;
  return extra <= 0 ? 20 : extra === 1 ? 16 : extra === 2 ? 13 : extra === 3 ? 10 : extra <= 5 ? 7 : 4;
}

export interface DailyRec {
  /** Points of each test; null while it has not been played. */
  p: (number | null)[];
  /** A figure about each test for the summary: attempts used, hits, extra steps (-1 when given up). */
  k: (number | null)[];
  /** When the last test was finished. */
  t?: number;
  /** Finished on a later day: it does not count for the streak. */
  late?: 1;
}

export function emptyRec(): DailyRec {
  return { p: Array<number | null>(TESTS).fill(null), k: Array<number | null>(TESTS).fill(null) };
}

export function totalOf(rec: DailyRec | undefined): number {
  return rec ? rec.p.reduce<number>((sum, x) => sum + (x ?? 0), 0) : 0;
}

export function doneCount(rec: DailyRec | undefined): number {
  return rec ? rec.p.filter((x) => x != null).length : 0;
}

/** Consecutive days finished on their own day, up to today (or yesterday while today is still open). */
export function streakOf(daily: Record<string, DailyRec>, now: string): number {
  const counts = (d: string) => !!daily[d]?.t && !daily[d].late;
  let d = counts(now) ? now : addDays(now, -1);
  let n = 0;
  while (counts(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Geometry of the mystery-region hints
// ---------------------------------------------------------------------------

const RAD = Math.PI / 180;

/** Initial compass bearing from `a` to `b`, in degrees clockwise from north. */
export function bearing(a: LL, b: LL): number {
  const p1 = a[1] * RAD;
  const p2 = b[1] * RAD;
  const dl = (b[0] - a[0]) * RAD;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Index 0–7 of the eight-point compass (N, NE, E…). */
export function compass(deg: number): number {
  return Math.round(deg / 45) % 8;
}

/** Longest distance between two items, in the unit of `dist`: the scale of the "how close" figure. */
export function spanOf(items: Item[], dist: (a: LL, b: LL) => number): number {
  let max = 0;
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) max = Math.max(max, dist(items[i].lp, items[j].lp));
  return max || 1;
}
