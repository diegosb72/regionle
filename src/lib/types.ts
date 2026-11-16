import type { Feature, LineString, MultiLineString, MultiPolygon, Point, Polygon } from 'geojson';

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
/** Shape of anything that can be asked: surfaces, rivers (lines) and cities (points). */
export type AnyGeo = Feature<Polygon | MultiPolygon | LineString | MultiLineString | Point>;

/** One thing that can be asked: a subdivision, a whole country, a city or a river, lake, sea… */
export interface Item {
  id: string;
  kind: 'unit' | 'country' | 'city' | 'feature';
  /** How it is drawn: a surface, a line or a dot. */
  shape: 'area' | 'line' | 'point';
  /** Physical features: river, lake, sea, range, desert, island, peak. */
  cat?: string;
  /** Drawn under the land (seas), so that coasts stay clean. */
  under?: boolean;
  /** Cities: inhabitants, and 3 for the capital of the country, 2 for its second capital, 1 for the capital of a region. */
  pop?: number;
  cap?: number;
  /** Names of its capital: the first one is shown, all of them are accepted. */
  capital?: string[];
  /** Display name, in the language of the interface. */
  name: string;
  en: string;
  lo?: string;
  /** Every spelling accepted when typing. */
  answers: string[];
  /**
   * Its names proper in each language there is, the one on show first: where that one has several words,
   * the initials of each are accepted too. Empty for what is named after its kind ("Lago Superior").
   */
  proper: string[];
  country: Country;
  /** "provincia", "estado", "país"… */
  type: string;
  /** Name of the group the unit belongs to ("Andalucía"), when there is one. */
  parent?: string;
  geo: AnyGeo;
  lp: LL;
  fp: LL[];
  /** km² */
  area: number;
  /** Peaks: metres above sea level. */
  elev?: number;
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
  scope: 'regions' | 'countries' | 'cities' | 'physical';
  items: Item[];
  byId: Map<string, Item>;
  /** Drawn but never asked (disputed or special areas). */
  extras: Extra[];
  /** Everything else in the world, drawn muted. */
  context: Geo[];
  /** Land drawn in full colour under the items, never asked: the countries whose cities or rivers are. */
  base?: Geo[];
  /** National outlines of the chosen countries (regions scope), traced from their own subdivisions. */
  outline: Outline[];
  /** Points the initial view has to contain. */
  frame: LL[];
  countries: Country[];
  title: string;
  noun: { one: string; many: string; fem: boolean };
}

export type Section = 'regions' | 'countries' | 'pops' | 'cities' | 'physical';
export type Mode =
  | 'explore'
  | 'learn'
  | 'regionle'
  | 'blind'
  /** Not a game: the screen where a custom list is put together. */
  | 'edit'
  | 'pin'
  | 'identify'
  | 'nameall'
  | 'outline'
  | 'travel'
  | 'puzzle'
  | 'neighbours'
  | 'capital'
  | 'flag'
  | 'exact'
  | 'which'
  | 'hilo'
  | 'rank';

export type Res = 'ok' | 'warn' | 'bad';
