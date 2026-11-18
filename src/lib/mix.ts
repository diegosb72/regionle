/**
 * What gets taken for what. A wrong answer that is the name of another piece of the same map says more
 * than a miss: Huesca was asked and Teruel was clicked. Those pairs are kept, so that they can be shown
 * and practised together until they are told apart.
 */
import { SKILL_MODE, parseOrigin, type ReviewGroup } from './review';
import type { Skill, Stat } from './store';

/** "skill:asked>given" → [times, the last time]. */
export type Mix = Record<string, [number, number]>;

/** Pairs kept at most: beyond it, the ones that are settled and the oldest go. */
export const MIX_MAX = 400;

/** No id has it: ids are codes, hashes and slugs. */
const SEP = '>';

export const mixKey = (skill: Skill, asked: string, given: string): string => `${skill}:${asked}${SEP}${given}`;

/** A key is "skill:asked>given", and an id can hold a colon itself ("r:volga"): the skill is what comes before the first. */
export function readMixKey(key: string): { skill: Skill; asked: string; given: string } | null {
  const colon = key.indexOf(':');
  const sep = key.indexOf(SEP, colon + 1);
  if (colon < 1 || sep < 0) return null;
  const skill = key.slice(0, colon) as Skill;
  const asked = key.slice(colon + 1, sep);
  const given = key.slice(sep + 1);
  return skill in SKILL_MODE && asked && given && asked !== given ? { skill, asked, given } : null;
}

/**
 * Whether a mix-up still stands: the piece asked about has not been got right twice in a row since.
 * Answers that came before the mix-up do not count, however good the run was.
 */
export function isLive(entry: readonly [number, number], stat: Stat | undefined): boolean {
  return !stat || stat[2] < 2 || stat[3] <= entry[1];
}

/** One more time `given` was the answer to a question about `asked`. */
export function withMix(mix: Mix, stats: Record<string, Stat>, skill: Skill, asked: string, given: string, now: number): Mix {
  if (asked === given) return mix;
  const key = mixKey(skill, asked, given);
  const out: Mix = { ...mix, [key]: [(mix[key]?.[0] ?? 0) + 1, now] };
  const keys = Object.keys(out);
  if (keys.length <= MIX_MAX) return out;
  // Too many: what has been told apart since goes first, then what was mixed up longest ago.
  const settled = (k: string) => {
    const r = readMixKey(k);
    return !r || !isLive(out[k], stats[`${r.skill}:${r.asked}`]);
  };
  const order = keys.filter((k) => k !== key).sort((a, b) => Number(settled(b)) - Number(settled(a)) || out[a][1] - out[b][1]);
  for (const k of order.slice(0, keys.length - MIX_MAX)) delete out[k];
  return out;
}

/** Two pieces taken for each other, whichever of them was asked. */
export interface MixPair {
  skill: Skill;
  /** The one that was asked about more often of the two when they were mixed up. */
  a: string;
  b: string;
  times: number;
  last: number;
}

/** The pairs that still stand, the ones mixed up most first; of two mixed up as often, the latest. */
export function livePairs(mix: Mix, stats: Record<string, Stat>): MixPair[] {
  const pairs = new Map<string, MixPair & { asked: Record<string, number>; live: boolean }>();
  for (const [key, entry] of Object.entries(mix)) {
    const r = readMixKey(key);
    if (!r) continue;
    const [x, y] = r.asked < r.given ? [r.asked, r.given] : [r.given, r.asked];
    const pk = `${r.skill}:${x}${SEP}${y}`;
    let p = pairs.get(pk);
    if (!p) {
      p = { skill: r.skill, a: x, b: y, times: 0, last: 0, asked: {}, live: false };
      pairs.set(pk, p);
    }
    p.times += entry[0];
    p.last = Math.max(p.last, entry[1]);
    p.asked[r.asked] = (p.asked[r.asked] ?? 0) + entry[0];
    if (isLive(entry, stats[`${r.skill}:${r.asked}`])) p.live = true;
  }
  return [...pairs.values()]
    .filter((p) => p.live)
    .map(({ asked, live, ...p }) => {
      void live;
      return (asked[p.b] ?? 0) > (asked[p.a] ?? 0) ? { ...p, a: p.b, b: p.a } : p;
    })
    .sort((p, q) => q.times - p.times || q.last - p.last || (p.a < q.a ? -1 : 1));
}

/** The pairs of one map, to be practised together in the game of their skill. */
export interface MixGroup extends ReviewGroup {
  pairs: MixPair[];
}

/**
 * The pairs that still stand, map by map, as games that can be played: the map they were mixed up on, the
 * game of that skill and only those pieces. The maps with more mix-ups come first.
 */
export function mixGroups(mix: Mix, stats: Record<string, Stat>, where: Record<string, string>): MixGroup[] {
  const groups = new Map<string, MixGroup & { seen: Set<string>; times: number }>();
  for (const p of livePairs(mix, stats)) {
    // Both were on the same map; the one asked about is the one that is sure to say which.
    const origin = parseOrigin(p.a, where[p.a]) ?? parseOrigin(p.b, where[p.b]);
    if (!origin) continue;
    const { section, country, level, pick } = origin;
    const one = section === 'regions' || (section === 'cities' && pick !== 'caps');
    const key = ['mix', section, p.skill, ...(one ? [country] : []), ...(section === 'cities' ? [pick] : []), ...(level ? [level] : [])].join(':');
    let g = groups.get(key);
    if (!g) {
      g = { key, section, skill: p.skill, mode: SKILL_MODE[p.skill], country: one ? country : undefined, level, pick: section === 'cities' ? pick : undefined, countries: [], ids: [], oldest: p.last, pairs: [], seen: new Set(), times: 0 };
      groups.set(key, g);
    }
    g.pairs.push(p);
    g.times += p.times;
    g.oldest = Math.min(g.oldest, p.last);
    for (const id of [p.a, p.b]) {
      if (!g.ids.includes(id)) g.ids.push(id);
      const c = parseOrigin(id, where[id])?.country;
      if (c) g.seen.add(c);
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.times - a.times || b.pairs.length - a.pairs.length || (a.key < b.key ? -1 : 1))
    .map(({ seen, times, ...g }) => {
      void times;
      return { ...g, countries: [...seen].sort() };
    });
}

/** How many times two pieces have been taken for each other, in either direction. */
export function timesMixed(mix: Mix, skill: Skill, a: string, b: string): number {
  return (mix[mixKey(skill, a, b)]?.[0] ?? 0) + (mix[mixKey(skill, b, a)]?.[0] ?? 0);
}

/** `mix` without anything about the given ids. */
export function dropMix(mix: Mix, ids: readonly string[]): Mix {
  const gone = new Set(ids);
  return Object.fromEntries(
    Object.entries(mix).filter(([k]) => {
      const r = readMixKey(k);
      return !!r && !gone.has(r.asked) && !gone.has(r.given);
    }),
  );
}

/** What can be trusted of a value read from storage or from a backup. */
export function cleanMix(value: unknown): Mix {
  if (!value || typeof value !== 'object') return {};
  const out: Mix = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (!readMixKey(k) || !Array.isArray(v)) continue;
    const [times, last] = v as unknown[];
    if (typeof times === 'number' && Number.isFinite(times) && times >= 1 && typeof last === 'number' && Number.isFinite(last)) out[k] = [Math.floor(times), last];
  }
  return out;
}
