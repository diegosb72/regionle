/**
 * A direct link to a map and a game: `#/regiones/ES:p+PT/capital` opens the setup of the regions with the
 * provinces of Spain and the districts of Portugal chosen and "Capitales" as the game, ready to start.
 *
 *   #/<section>/<map>[/<game>[/<cities>]]
 *
 *   map     the countries, joined by "+": `ES+FR`. In the regions each may say its level: `ES:p`. On a
 *           physical map, the tokens of the selection instead: `river+lake+EU`, `peak+in:ES`.
 *   game    the id of the game: `pin`, `capital`, `border`…
 *   cities  which cities, in that section: `top25` (10, 25, 50 or 100), `caps`, `regcaps`.
 *
 * Only what names the map and the game travels: how to answer or how many questions is for each player to
 * say. Nothing here knows which countries or games exist: that is checked where the link is opened.
 */
import type { CityPick } from './extra';
import { PHYS_KINDS, PHYS_PLACES } from './phys';
import type { Section } from './types';

export interface MapLink {
  /** Countries, or the tokens of a physical map, in the order they were written. */
  ids: string[];
  /** The level of each country that says one. */
  levels: Record<string, string>;
  mode?: string;
  cityPick?: CityPick;
  cityCount?: number;
}

/** A country as the data name it: two capitals, or a capital and a digit. */
const COUNTRY = /^[A-Z][A-Z0-9]$/;
const LEVEL = /^[a-z][a-z0-9]{0,3}$/;
const MODE = /^[a-z]{2,12}$/;
/** How many cities a map of the most populous ones can have (`CITY_COUNTS`, which lives with the data). */
export const LINK_CITY_COUNTS: readonly number[] = [10, 25, 50, 100];

const physToken = (t: string): boolean => (PHYS_KINDS as readonly string[]).includes(t) || ((PHYS_PLACES as readonly string[]).includes(t) && t !== 'W') || t === 'all' || /^in:[A-Z]{2}$/.test(t);

/** What follows the section in an address, read as a link to a map; null when it is not one. */
export function parseMapLink(section: Section, rest: string): MapLink | null {
  const parts = rest.split('/');
  if (parts.length > 3 || parts.some((p) => !p)) return null;
  const [map, mode, extra] = parts;
  const ids: string[] = [];
  const levels: Record<string, string> = {};
  for (const token of map.split(/[+,]/)) {
    if (section === 'physical') {
      if (!physToken(token)) return null;
      if (!ids.includes(token)) ids.push(token);
      continue;
    }
    const [id, level, more] = token.split(':');
    if (more != null || !COUNTRY.test(id)) return null;
    if (level != null) {
      // Only the regions have levels to choose from.
      if (section !== 'regions' || !LEVEL.test(level)) return null;
      levels[id] = level;
    }
    if (!ids.includes(id)) ids.push(id);
  }
  if (mode != null && !MODE.test(mode)) return null;
  const link: MapLink = { ids, levels };
  if (mode) link.mode = mode;
  if (extra != null) {
    if (section !== 'cities') return null;
    const top = /^top(\d{2,3})$/.exec(extra);
    if (top && LINK_CITY_COUNTS.includes(Number(top[1]))) {
      link.cityPick = 'top';
      link.cityCount = Number(top[1]);
    } else if (extra === 'caps' || extra === 'regcaps') link.cityPick = extra;
    else return null;
  }
  return link;
}

/** What follows the section in the address of a link to a map: `ES:p+PT/capital`. */
export function mapLinkRest(section: Section, link: MapLink): string {
  const map = link.ids.map((id) => (section === 'regions' && link.levels[id] ? `${id}:${link.levels[id]}` : id)).join('+');
  const cities = section === 'cities' && link.cityPick ? (link.cityPick === 'top' ? `top${link.cityCount ?? 25}` : link.cityPick) : '';
  return [map, ...(link.mode ? [link.mode, ...(cities ? [cities] : [])] : [])].join('/');
}
