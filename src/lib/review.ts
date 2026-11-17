/**
 * Spaced repetition. Nothing new is stored for it: an answer already leaves behind how many times in a
 * row it was right and when, and that is enough to say when it should be asked again. The run sets the
 * wait: a miss comes back the same day, each right answer pushes the next one further away.
 */
import type { CityPick } from './extra';
import type { GameConfig, Opts, Skill, Stat } from './store';
import type { Mode, Section } from './types';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Wait after a run of 0, 1, 2… right answers. */
export const INTERVALS = [10 * 60_000, DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY, 75 * DAY];

/** Reviews are planned by day, not by the minute: what falls due today can be done from the morning. */
const SLACK = 8 * HOUR;

export function intervalOf(run: number): number {
  return INTERVALS[Math.min(Math.max(0, run), INTERVALS.length - 1)];
}

/** Moment from which an item should be asked again. */
export function dueAt(stat: Stat): number {
  return stat[3] + intervalOf(stat[2]);
}

export function isDue(stat: Stat | undefined, now: number): boolean {
  if (!stat || !stat[0] || !stat[3]) return false;
  return dueAt(stat) - (stat[2] > 0 ? SLACK : 0) <= now;
}

/** How well something is known: never asked, being learnt, known, or known and due for a review. */
export type Grade = 'new' | 'learning' | 'known' | 'due';

export function gradeOf(stat: Stat | undefined, now: number): Grade {
  if (!stat || !stat[0]) return 'new';
  if (stat[2] < 2) return 'learning';
  return isDue(stat, now) ? 'due' : 'known';
}

/** The game that practises each skill. */
export const SKILL_MODE: Record<Skill, Mode> = { loc: 'pin', name: 'identify', cap: 'capital', flag: 'flag', nb: 'neighbours' };

/** Questions of one review game at most: the oldest first, the rest stays for the next one. */
export const REVIEW_MAX = 30;

/** Answers that are due and can be reviewed on one map. */
export interface ReviewGroup {
  key: string;
  section: Section;
  skill: Skill;
  mode: Mode;
  /** Regions and cities of a single country. */
  country?: string;
  /** Level of detail of the regions. */
  level?: string;
  /** Which cities the map held when they were asked. */
  pick?: CityPick;
  /** Countries the due items belong to. */
  countries: string[];
  /** The items, the longest overdue first. */
  ids: string[];
  /** Moment the oldest of them fell due. */
  oldest: number;
}

interface Origin {
  section: Section;
  country?: string;
  level?: string;
  pick?: CityPick;
}

/**
 * Reads "r|ES|g1", "c", "t|ES|top" or "p"; when there is none (answers stored by earlier versions),
 * the id itself says enough for countries and regions.
 */
export function parseOrigin(id: string, origin: string | undefined): Origin | null {
  if (origin) {
    const [kind, country, extra] = origin.split('|');
    if (kind === 'c') return { section: 'countries', country: id };
    if (kind === 'p') return { section: 'physical' };
    if (kind === 't' && country) return { section: 'cities', country, pick: extra === 'caps' || extra === 'regcaps' ? extra : 'top' };
    if (kind === 'r' && country) return { section: 'regions', country, level: extra || undefined };
    return null;
  }
  if (/^[A-Z]{2}$/.test(id)) return { section: 'countries', country: id };
  const m = id.match(/^([A-Z0-9]{2})[-~]/);
  return m ? { section: 'regions', country: m[1] } : null;
}

/**
 * Of the answers a review was going to ask, those about things that are no longer in the data: a city that
 * turned out to be a mistake of the source, a town it had filed under the country next door. They can never
 * come up again and would be due for ever, so the caller drops them.
 *
 * Only what is certain: an answer that says which map it was learnt on, when that map is the one loaded.
 * One stored by an early version, with no map, may belong to another level of the country (a province, on a
 * map of communities), and is left alone.
 */
export function goneFrom(only: readonly string[], has: (id: string) => boolean, where: Record<string, string>, section: string, levelOf: (country: string) => string | undefined): string[] {
  return only.filter((id) => {
    if (has(id) || !where[id]) return false;
    const origin = parseOrigin(id, where[id]);
    if (!origin || origin.section !== section) return false;
    return origin.section !== 'regions' || (!!origin.level && !!origin.country && origin.level === levelOf(origin.country));
  });
}

/**
 * Answers gathered into games that can be played, each on the map it was learnt on: the regions of one
 * country, the countries, the capitals of the world, the cities of one country, the rivers and seas.
 * `pick` says which answers go in and in what order within their game: the lowest number first.
 *
 * A country studied at two levels gives one game, at the level with more answers, and the other waits;
 * with `everyLevel`, a game for each.
 */
function gather(stats: Record<string, Stat>, where: Record<string, string>, pick: (stat: Stat) => number | null, everyLevel = false): ReviewGroup[] {
  interface Draft extends ReviewGroup {
    /** level → [id, order] */
    per: Map<string, [string, number][]>;
    seen: Set<string>;
  }
  const groups = new Map<string, Draft>();
  for (const [key, stat] of Object.entries(stats)) {
    const order = pick(stat);
    if (order == null) continue;
    const at = key.indexOf(':');
    const skill = key.slice(0, at) as Skill;
    const id = key.slice(at + 1);
    if (!(skill in SKILL_MODE)) continue;
    const origin = parseOrigin(id, where[id]);
    if (!origin) continue;
    const { section, country, pick: cities } = origin;
    const one = section === 'regions' || (section === 'cities' && cities !== 'caps');
    const gk = [section, skill, ...(one ? [country] : []), ...(section === 'cities' ? [cities] : [])].join(':');
    let g = groups.get(gk);
    if (!g) {
      g = { key: gk, section, skill, mode: SKILL_MODE[skill], country: one ? country : undefined, pick: section === 'cities' ? cities : undefined, countries: [], ids: [], oldest: Infinity, per: new Map(), seen: new Set() };
      groups.set(gk, g);
    }
    if (country) g.seen.add(country);
    const level = origin.level ?? '';
    if (!g.per.has(level)) g.per.set(level, []);
    g.per.get(level)!.push([id, order]);
  }
  const out: ReviewGroup[] = [];
  for (const g of groups.values()) {
    const levels = [...g.per.entries()].sort((a, b) => b[1].length - a[1].length);
    const { per, seen, ...group } = g;
    void per;
    for (const [level, list] of everyLevel ? levels : levels.slice(0, 1)) {
      list.sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
      out.push({ ...group, key: everyLevel && level ? `${g.key}:${level}` : g.key, level: level || undefined, ids: list.map((x) => x[0]), oldest: list[0][1], countries: [...seen].sort() });
    }
  }
  return out.sort((a, b) => b.ids.length - a.ids.length || a.oldest - b.oldest || (a.key < b.key ? -1 : 1));
}

/**
 * What is due now, gathered into games that can be played, each on the map it was learnt on. A country
 * studied at two levels is reviewed at the one with more due; the other waits.
 */
export function dueGroups(stats: Record<string, Stat>, where: Record<string, string>, now: number): ReviewGroup[] {
  return gather(stats, where, (stat) => (isDue(stat, now) ? dueAt(stat) : null));
}

/** Times an answer was not right first time. */
export function missesOf(stat: Stat | undefined): number {
  return stat ? Math.max(0, stat[0] - stat[1]) : 0;
}

/**
 * An answer that keeps slipping: missed twice or more and not learnt since. Two right answers in a row
 * take it off the list, however many misses came before.
 */
export function isSlipping(stat: Stat | undefined): boolean {
  return !!stat && missesOf(stat) >= 2 && stat[2] < 2;
}

/**
 * What is missed most, gathered like a review: a game for each map, the most missed first in each and the
 * maps with more of them first. Each level of a country is a game of its own.
 */
export function missGroups(stats: Record<string, Stat>, where: Record<string, string>): ReviewGroup[] {
  // The most missed first; of two missed as often, the one that was asked fewer times.
  return gather(stats, where, (stat) => (isSlipping(stat) ? -missesOf(stat) + Math.min(stat[0], 999) / 1000 : null), true);
}

/** Every answer there is, map by map and level by level; on each map, the one asked longest ago first. */
export function allGroups(stats: Record<string, Stat>, where: Record<string, string>): ReviewGroup[] {
  return gather(stats, where, (stat) => (stat[0] ? stat[3] : null), true);
}

/**
 * The game that reviews a group: its map, the game of that skill and only the questions that are due,
 * `max` of them at most (all of them when what is wanted is the map itself, to read names from it).
 */
export function reviewConfig(group: ReviewGroup, opts: Opts, max = REVIEW_MAX): Omit<GameConfig, 'nonce'> {
  const ids = group.ids.slice(0, max);
  const one = group.country ? [group.country] : null;
  return {
    section: group.section,
    mode: group.mode,
    // Countries and capitals: the map is widened to their continents when it is built (see `deckFor`).
    countries: group.section === 'countries' ? ids : (one ?? group.countries),
    levels: group.country && group.level ? { [group.country]: group.level } : {},
    opts: { ...opts, length: 'all', ...(group.pick ? { cityPick: group.pick } : {}) },
    only: ids,
    review: true,
  };
}

/** How many answers are due in all. */
export function dueCount(groups: ReviewGroup[]): number {
  return groups.reduce((n, g) => n + g.ids.length, 0);
}

/** Number of answers that fall due within the next `days` days, today included, for the forecast. */
export function forecast(stats: Record<string, Stat>, now: number, days: number): number[] {
  const out = new Array<number>(days).fill(0);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  for (const stat of Object.values(stats)) {
    if (!stat[0] || !stat[3]) continue;
    const day = Math.floor((dueAt(stat) - start.getTime()) / DAY);
    if (day < days) out[Math.max(0, day)]++;
  }
  return out;
}
