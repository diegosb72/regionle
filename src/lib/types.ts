import type { Feature, MultiLineString, MultiPolygon, Polygon } from 'geojson';

/** [longitude, latitude] */
export type LL = [number, number];

/** un = UN member · obs = UN observer · partial = partially recognised · dep = dependency · other = drawn, never asked */
export type Cls = 'un' | 'obs' | 'partial' | 'dep' | 'other';

export interface Named {
  es: string;
  en?: string;
}

export interface Level {
  /** `f` is the finest level; `g1`, `g2` are coarser groupings. */
  k: string;
  /** Number of askable units. */
  n: number;
  es: string;
  en: string;
  /** Singular Spanish label. */
  sg: string;
}

export interface Capital {
  es: string;
  en: string;
  ll?: LL;
  al?: string[];
}

export interface Country {
  id: string;
  a3: string;
  n: Named;
  al?: string[];
  wd?: string;
  fl?: string;
  ct: string;
  sr: string;
  cl: Cls;
  sov?: string;
  ll?: 1;
  pop?: number;
  py?: number;
  ar: number;
  cap?: Capital;
  lp: LL;
  fp: LL[];
  nb?: string[];
  sl?: string[];
  lv: Level[];
  dl: string;
}

export interface Index {
  built: string;
  continents: Record<string, Named>;
  subregions: Record<string, Named>;
  countries: Country[];
}

export type Geo = Feature<Polygon | MultiPolygon>;

/** One thing that can be asked: a subdivision or a whole country. */
export interface Item {
  id: string;
  kind: 'unit' | 'country';
  /** Spanish display name. */
  name: string;
  en: string;
  lo?: string;
  /** Every spelling accepted when typing. */
  answers: string[];
  country: Country;
  /** "provincia", "estado", "país"… */
  type: string;
  /** Name of the group the unit belongs to ("Andalucía"), when there is one. */
  parent?: string;
  geo: Geo;
  lp: LL;
  fp: LL[];
  /** km² */
  area: number;
  /** Ids of deck items sharing a land border. */
  nb: string[];
  /** Ids of deck items reachable by a short sea crossing. */
  sl: string[];
  wd?: string;
}

export interface Extra {
  id: string;
  name: string;
  geo: Geo;
}

export interface Outline {
  id: string;
  geo: MultiLineString;
}

export interface Deck {
  key: string;
  scope: 'regions' | 'countries';
  items: Item[];
  byId: Map<string, Item>;
  /** Drawn but never asked (disputed or special areas). */
  extras: Extra[];
  /** Everything else in the world, drawn muted. */
  context: Geo[];
  /** National outlines of the chosen countries (regions scope), traced from their own subdivisions. */
  outline: Outline[];
  /** Points the initial view has to contain. */
  frame: LL[];
  countries: Country[];
  title: string;
  noun: { one: string; many: string; fem: boolean };
}

export type Section = 'regions' | 'countries' | 'pops';
export type Mode =
  | 'explore'
  | 'pin'
  | 'identify'
  | 'nameall'
  | 'outline'
  | 'travel'
  | 'capital'
  | 'flag'
  | 'exact'
  | 'which'
  | 'hilo'
  | 'rank';

export type Res = 'ok' | 'warn' | 'bad';
