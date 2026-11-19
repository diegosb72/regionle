/**
 * The daily challenge: everything that is asked on a given day follows from the date alone, so it is
 * the same for everyone and any past day can be played again.
 */
import { hashStr, mulberry32, namesEcho, namesOverlap, sample, shuffle } from '../lib/text';
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

/** Is the capital of a country in its name ("Ciudad de México", "Brasilia")? Judged in both languages: the day is the same for everyone. */
export function capitalGivenAway(c: Country): boolean {
  if (!c.cap) return false;
  const same = (cap: string, name: string) => namesOverlap(cap, name) || namesEcho(cap, name);
  return same(c.cap.es, c.n.es) || same(c.cap.en, c.n.en ?? c.n.es);
}

/** Test 5: three flags and two capitals, each with three plausible wrong options from the same part of the world. */
export function quickQuestions(date: string, index: Index, avoid: string[]): QuickQuestion[] {
  const rng = rngFor(date, 'quick');
  const list = worldPool(index).filter((c) => c.cl === 'un' && c.fl && c.cap && !avoid.includes(c.id));
  const picked = sample(list, 5, rng);
  // The last two are asked by their capital, unless the capital is in the name of the country: among four
  // options it would answer itself, so that country is asked by its flag and an earlier one takes its place.
  const byCapital = new Set<number>();
  for (let i = picked.length - 1; i >= 0 && byCapital.size < 2; i--) if (!capitalGivenAway(picked[i])) byCapital.add(i);
  return picked.map((c, i) => {
    const kind = byCapital.has(i) ? ('capital' as const) : ('flag' as const);
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
  /** Nobody finished it on its day and a wildcard stood in for it: the days in a row go through it. */
  j?: 1;
  /** Played the hard way (see daily/hard.ts): settled with the first test that was scored. */
  h?: 1;
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

/** The result somebody sent by link, to set beside one's own: their name, if they gave one, and the points of each test. */
export interface Rival {
  n: string;
  p: number[];
  /** They played it the hard way. */
  h?: 1;
}
/** How many results are kept for a day, and for how many days. */
export const RIVALS_MAX = 8;
export const RIVAL_DAYS = 60;
export const NAME_MAX = 24;

export const isRival = (r: unknown): r is Rival => {
  const x = r as Rival | null;
  if (!x || typeof x !== 'object' || typeof x.n !== 'string' || x.n.length > NAME_MAX || (x.h !== undefined && x.h !== 1)) return false;
  return Array.isArray(x.p) && x.p.length === TESTS && x.p.every((n) => Number.isInteger(n) && n >= 0 && n <= 20);
};

/** What is kept of the results others sent, cleaned: only days, only results that can be, and no more than fit. */
export function cleanRivals(raw: unknown): Record<string, Rival[]> {
  const out: Record<string, Rival[]> = {};
  if (!raw || typeof raw !== 'object') return out;
  const all = raw as Record<string, unknown>;
  for (const d of Object.keys(all).filter(isDate).sort().slice(-RIVAL_DAYS)) {
    const list = Array.isArray(all[d]) ? (all[d] as unknown[]).filter(isRival).slice(-RIVALS_MAX) : [];
    if (list.length) out[d] = list;
  }
  return out;
}

/**
 * One more result for a day. Whoever sends theirs again takes the place they had (by name; with no name,
 * when the points are the same), and the oldest give way when there are too many.
 */
export function withRival(rivals: Record<string, Rival[]>, date: string, rival: Rival): Record<string, Rival[]> {
  const same = (r: Rival) => r.n === rival.n && (r.n !== '' || r.p.join() === rival.p.join());
  return cleanRivals({ ...rivals, [date]: [...(rivals[date] ?? []).filter((r) => !same(r)), rival] });
}

/** A wildcard is won every so many days in a row, and no more than so many are kept. */
export const JOKER_EVERY = 7;
export const JOKER_MAX = 2;

/** How the days in a row stand on a given day. Nothing of it is kept: it all follows from the results. */
export interface Streak {
  /** Days finished on their own day in a row, up to today (or yesterday while today is still open). */
  days: number;
  /** Wildcards in hand. */
  jokers: number;
  /**
   * With today still open and the days before it missed: the days in a row that finishing today's
   * challenge keeps, and the wildcards it takes, one for each day missed.
   */
  save: { days: number; gap: number } | null;
  /** Days in a row still to go for the next wildcard; 0 when no more fit in the hand. */
  toNext: number;
  /** The longest the days in a row have ever been. */
  longest: number;
}

const onItsDay = (rec: DailyRec | undefined): boolean => !!rec?.t && !rec.late;

/**
 * The days in a row and the wildcards, read from the results from the first day to `now`. A day finished
 * on its day adds one; every seventh in a row wins a wildcard; a day a wildcard stood in for (`j`) takes
 * one from the hand and adds nothing, but the row goes on through it.
 */
export function streakState(daily: Record<string, DailyRec>, now: string): Streak {
  let days = 0;
  let jokers = 0;
  let longest = 0;
  let last = '';
  const held = Object.keys(daily)
    .filter((d) => isDate(d) && d <= now && (onItsDay(daily[d]) || daily[d]?.j === 1))
    .sort();
  for (const d of held) {
    if (last && addDays(last, 1) !== d) days = 0;
    if (onItsDay(daily[d])) {
      days++;
      if (days % JOKER_EVERY === 0 && jokers < JOKER_MAX) jokers++;
    } else if (jokers > 0) jokers--;
    // A day marked with no wildcard to pay for it (a file put together by hand) holds nothing.
    else days = 0;
    if (days > longest) longest = days;
    last = d;
  }
  // Days with nothing between the last one that holds and today.
  const gap = last ? dayNumber(now) - dayNumber(last) - 1 : 0;
  const alive = !!last && gap <= 0;
  const save = !alive && days > 0 && gap <= jokers ? { days, gap } : null;
  const kept = alive ? days : (save?.days ?? 0);
  return { days: alive ? days : 0, jokers, save, toNext: jokers < JOKER_MAX ? JOKER_EVERY - (kept % JOKER_EVERY) : 0, longest };
}

/** Consecutive days finished on their own day, up to today (or yesterday while today is still open). */
export function streakOf(daily: Record<string, DailyRec>, now: string): number {
  return streakState(daily, now).days;
}

/**
 * The results once a challenge has been finished on its day: the days missed just before it are given to
 * the wildcards in hand, when these are enough for all of them, and the days in a row go on.
 */
export function withJokers(daily: Record<string, DailyRec>, before: Record<string, DailyRec>, date: string): Record<string, DailyRec> {
  const save = streakState(before, date).save;
  if (!save) return daily;
  const next = { ...daily };
  for (let k = 1; k <= save.gap; k++) {
    const d = addDays(date, -k);
    next[d] = { ...(next[d] ?? emptyRec()), j: 1 };
  }
  return next;
}

/** How many days in a row just before `date` a wildcard stood in for. */
export function jokersBefore(daily: Record<string, DailyRec>, date: string): number {
  let n = 0;
  while (daily[addDays(date, -(n + 1))]?.j === 1 && !onItsDay(daily[addDays(date, -(n + 1))])) n++;
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
