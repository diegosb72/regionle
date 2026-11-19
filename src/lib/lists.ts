/**
 * Custom lists: pieces chosen one by one ("the twelve for Thursday's exam"). A list remembers the map it
 * was made on, so that it can be played again as it was, and travels in a link that holds all of it.
 */
import { fromBase64Url, toBase64Url } from './challenge';
import type { CityPick } from './extra';
import { LIST_PATH, linkTo } from './routes';
import type { CustomList, GameConfig, Opts } from './store';
import type { Mode, Section } from './types';

export const LIST_SECTIONS: Section[] = ['regions', 'countries', 'cities', 'physical'];
/** Longest list that is kept: beyond this it is the whole map with a few holes. */
export const LIST_MAX = 400;
export const LIST_NAME_MAX = 40;
/** Games that make no sense on a handful of loose pieces. */
const NOT_ON_LISTS: Mode[] = ['travel', 'chain', 'edit'];

export const listPlayable = (mode: Mode): boolean => !NOT_ON_LISTS.includes(mode);

export function newListId(): string {
  return `l${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;
}

/** The game a list asks for: its own map, limited to its pieces. */
export function listConfig(list: CustomList, mode: Mode, opts: Opts): Omit<GameConfig, 'nonce'> {
  return {
    section: list.section,
    mode,
    countries: list.countries,
    levels: list.levels,
    opts: { ...opts, cityPick: list.cityPick ?? opts.cityPick, cityCount: list.cityCount ?? opts.cityCount },
    only: list.ids,
    list: list.name,
  };
}

interface Wire {
  v: 1;
  n: string;
  s: string;
  /** Countries run together when they are all two letters; tokens joined by dots otherwise. */
  c: string;
  l?: Record<string, string>;
  o?: [string, number];
  /** Ids joined by dots; a prefix shared by all of them is written once, in `p`. */
  i: string;
  p?: string;
}

/** Longest prefix ending in "-", "~" or ":" that every id starts with ("ES-" for the Spanish provinces). */
function sharedPrefix(ids: string[]): string {
  if (ids.length < 2) return '';
  let prefix = ids[0];
  for (const id of ids) while (!id.startsWith(prefix)) prefix = prefix.slice(0, -1);
  const cut = Math.max(prefix.lastIndexOf('-'), prefix.lastIndexOf('~'), prefix.lastIndexOf(':'));
  return cut < 0 ? '' : prefix.slice(0, cut + 1);
}

export function encodeList(list: CustomList): string {
  const prefix = sharedPrefix(list.ids);
  const wire: Wire = {
    v: 1,
    n: list.name.trim().slice(0, LIST_NAME_MAX),
    s: list.section,
    c: list.section === 'physical' || list.countries.some((id) => id.length !== 2) ? list.countries.join('.') : list.countries.join(''),
    i: list.ids.map((id) => id.slice(prefix.length)).join('.'),
  };
  if (prefix) wire.p = prefix;
  const levels = Object.fromEntries(Object.entries(list.levels).filter(([id]) => list.countries.includes(id)));
  if (Object.keys(levels).length) wire.l = levels;
  if (list.section === 'cities') wire.o = [list.cityPick ?? 'top', list.cityCount ?? 25];
  return toBase64Url(JSON.stringify(wire));
}

const ID = /^[A-Za-z0-9][A-Za-z0-9~:-]{0,63}$/;

/** A list read from a link: checked piece by piece, since a link can come from anywhere. The id is new. */
export function decodeList(code: string): CustomList | null {
  let wire: Wire;
  try {
    wire = JSON.parse(fromBase64Url(code)) as Wire;
  } catch {
    return null;
  }
  if (!wire || typeof wire !== 'object' || wire.v !== 1) return null;
  if (!LIST_SECTIONS.includes(wire.s as Section)) return null;
  if (typeof wire.c !== 'string' || !wire.c || wire.c.length > 1200 || typeof wire.i !== 'string' || !wire.i || wire.i.length > 20_000) return null;
  const countries = wire.c.includes('.') || wire.s === 'physical' ? wire.c.split('.') : (wire.c.match(/.{1,2}/g) ?? []);
  // Codes of countries, or the words a physical map is made of: "river", "EU", "all", and "in:ES" for the map of one country.
  if (!countries.length || countries.length > 300 || !countries.every((id) => /^(?:[A-Za-z0-9]{1,12}|in:[A-Z]{2})$/.test(id))) return null;
  const prefix = typeof wire.p === 'string' ? wire.p : '';
  const ids = [...new Set(wire.i.split('.').map((id) => prefix + id))];
  if (!ids.length || ids.length > LIST_MAX || !ids.every((id) => ID.test(id))) return null;
  const levels: Record<string, string> = {};
  if (wire.l && typeof wire.l === 'object') for (const [id, lv] of Object.entries(wire.l)) if (typeof lv === 'string' && /^[a-z0-9]{1,3}$/.test(lv) && countries.includes(id)) levels[id] = lv;
  const name = typeof wire.n === 'string' ? wire.n.replace(/\s+/g, ' ').trim().slice(0, LIST_NAME_MAX) : '';
  const list: CustomList = { id: newListId(), name, section: wire.s as Section, countries, levels, ids };
  if (list.section === 'cities' && Array.isArray(wire.o)) {
    const [pick, count] = wire.o;
    if (pick === 'top' || pick === 'caps' || pick === 'regcaps') list.cityPick = pick as CityPick;
    if (typeof count === 'number' && count > 0 && count <= 200) list.cityCount = Math.round(count);
  }
  return list;
}

/** Address of a list, under whatever folder the site is served from. */
export function listUrl(code: string): string {
  return linkTo(`${LIST_PATH}/${code}`);
}

/** Same pieces on the same map: the list a link brings may already be here. */
export function sameList(a: CustomList, b: CustomList): boolean {
  const key = (l: CustomList) => `${l.section}|${[...l.countries].sort().join(',')}|${[...l.ids].sort().join(',')}`;
  return key(a) === key(b);
}
