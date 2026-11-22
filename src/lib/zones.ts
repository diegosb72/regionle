/**
 * The challenges of the day of a continent or of a country: ten questions a day, drawn by lot among the ways
 * a piece can be asked, about the countries of a continent or about the regions of a country. Like the
 * challenge of the week (lib/weekly.ts), each is a game put in order by a seed, here made from the zone and
 * the day, so it is the same for everyone. What is kept of them is in lib/datedKept.ts.
 */
import { USUAL_RULES } from './rules';
import { addDays } from '../daily/spec';
import type { ZoneRec } from './datedKept';
import type { GameConfig, Opts } from './store';
import { hashStr } from './text';
import type { Country, Index } from './types';
import { levelOf } from './world';

/** How many questions a challenge has: every zone has pieces enough for them. */
export const ZONE_LENGTH = 10;
/** The continents with a challenge, in the order they are shown. */
export const ZONE_PARTS: readonly string[] = ['EU', 'AS', 'AF', 'AM', 'OC'];
/** How many countries the first page keeps in sight, and for how many days after one was last played. */
export const ZONE_SHOWN = 8;
export const ZONE_DAYS = 30;

const sovereign = (c: Country): boolean => c.cl === 'un' || c.cl === 'obs' || c.cl === 'partial';

/** A zone is kept by a name of its own: a continent and a country can share their two letters (AF, AS, AM). */
export const partZone = (part: string): string => `p:${part}`;
export const countryZone = (id: string): string => `c:${id}`;

/** The countries with a challenge: the sovereign ones whose map, at the level it opens with, has pieces for ten questions. */
export function zoneCountries(index: Index): Country[] {
  return index.countries.filter((c) => sovereign(c) && c.lv.length > 0 && levelOf(c).n >= ZONE_LENGTH);
}

export interface Zone {
  id: string;
  /** The continent, by its code; or the country. */
  part?: string;
  country?: Country;
}

/** What a zone is; null when there is no such continent or country, or it has no challenge. */
export function zoneOf(id: string, index: Index): Zone | null {
  const code = id.slice(2);
  if (id.startsWith('p:')) return ZONE_PARTS.includes(code) ? { id, part: code } : null;
  const country = id.startsWith('c:') ? zoneCountries(index).find((c) => c.id === code) : undefined;
  return country ? { id, country } : null;
}

/** The seed that puts the questions of a zone in order on a day. */
export const zoneSeed = (id: string, date: string): number => hashStr(`regionle|zone|${id}|${date}`) % 2_147_483_647;

/**
 * The game of a zone on a day; null when the zone has no challenge. As in the challenge of the week, what
 * changes the questions is settled, and the level of a country is the one its map opens with, whatever the
 * player has chosen for it elsewhere.
 */
export function zoneGame(id: string, date: string, index: Index, opts: Opts): Omit<GameConfig, 'nonce'> | null {
  const zone = zoneOf(id, index);
  if (!zone) return null;
  const settled: Opts = { ...opts, answer: 'choice', length: ZONE_LENGTH, pinBy: 'name', turned: false, flagLook: 'plain', format: 'normal', ...USUAL_RULES };
  const game = { mode: 'mix' as const, opts: settled, challenge: { seed: zoneSeed(id, date) }, zone: { id, date } };
  if (zone.country) return { ...game, section: 'regions', countries: [zone.country.id], levels: { [zone.country.id]: levelOf(zone.country).k } };
  return {
    ...game,
    section: 'countries',
    countries: index.countries
      .filter((c) => sovereign(c) && c.ct === zone.part)
      .map((c) => c.id)
      .sort(),
    levels: {},
  };
}

/** Whether the challenge of a zone is done on a day. */
export const zoneDone = (rec: ZoneRec | undefined, date: string): rec is ZoneRec => rec?.d === date;

/** The days in a row a zone has been played, as long as they can still go on: today or yesterday was the last. */
export const zoneRun = (rec: ZoneRec | undefined, date: string): number => (rec && (rec.d === date || rec.d === addDays(date, -1)) ? rec.run : 0);

/**
 * The countries the first page keeps in sight: those played within the last month, the latest first, and no
 * more than a handful. One left alone for longer goes back among the rest, where it can be picked again.
 */
export function zonesShown(zones: Record<string, ZoneRec>, date: string): string[] {
  const since = addDays(date, -ZONE_DAYS);
  return Object.entries(zones)
    .filter(([id, rec]) => id.startsWith('c:') && rec.d > since)
    .sort((a, b) => (a[1].d !== b[1].d ? (a[1].d < b[1].d ? 1 : -1) : a[0] < b[0] ? -1 : 1))
    .slice(0, ZONE_SHOWN)
    .map(([id]) => id);
}
