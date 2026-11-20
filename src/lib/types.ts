import type { Feature, LineString, MultiLineString, MultiPolygon, Point, Polygon } from 'geojson';
import type { ShortEdit } from './text';

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
  /** What the settings say about its short forms, as it stood when the item was built. */
  short?: ShortEdit;
  /** Regions: the country they are in, which is where their short forms are judged on a map of several (see `Matcher`). */
  within?: string;
  country: Country;
  /** "provincia", "estado", "país"… */
  type: string;
  /** Name of the group the unit belongs to ("Andalucía"), when there is one. */
  parent?: string;
  /** What it belongs to, for the game that asks it: the community of a province, the country of a city. */
  belongs?: Belongs;
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
  /**
   * Seas: the smaller seas that are part of it and are drawn as pieces of their own (see lib/seas.ts),
   * whether this map asks them or not. Only where a place is judged with nothing drawn does it matter.
   */
  parts?: Part[];
}

/** A sea that is part of another: its name and its outline. */
export interface Part {
  id: string;
  name: string;
  geo: AnyGeo;
}

/** What something is part of, with all it takes to be an answer: its names and what it is. */
export interface Belongs {
  id: string;
  name: string;
  /** "comunidad autónoma", "país" */
  type: string;
  answers: string[];
  proper: string[];
  short?: ShortEdit;
  /** Its flag, when it is a country. */
  fl?: string;
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
  /** Placing blind with several clicks: each miss says how warm it was. */
  | 'hotcold'
  /** Which way one place lies from another, and how far: nothing of either is on the map. */
  | 'bearing'
  /** A latitude and a longitude are given, and the point is found on a map with its grid drawn. */
  | 'coords'
  /** Not a game: the screen where a custom list is put together. */
  | 'edit'
  /** Not a game either: the map without names, laid out on paper to be printed. */
  | 'print'
  | 'pin'
  | 'identify'
  | 'nameall'
  | 'outline'
  | 'travel'
  | 'puzzle'
  /** A set of pieces that go together is named, and all of them are marked on the map. */
  | 'group'
  | 'neighbours'
  /** A border lights up, and the two pieces it lies between are named. */
  | 'border'
  /** From a piece to one that borders it, and on, never through the same one twice. */
  | 'chain'
  | 'capital'
  | 'flag'
  /** A piece tells about itself, a clue at a time, until its name is given. */
  | 'whoami'
  | 'exact'
  | 'which'
  | 'hilo'
  | 'rank'
  /** Five places put in order by where they lie: from north to south, or from west to east. */
  | 'compass'
  /** What each piece belongs to: the community of a province, the country of a city. */
  | 'parent'
  /** Statements about the countries chosen that are true or false. */
  | 'truefalse'
  /** Four countries, three of which share what the question says: which one does not. */
  | 'oddone'
  /** Cards face down, two for each country (its flag and its name, its capital and the country), turned two at a time. */
  | 'pairs'
  /** A country for each letter that begins a name, each with a clue; a letter can be passed and comes round again. */
  | 'alphabet'
  /** The first ten by a figure, typed from memory. */
  | 'topten'
  /** Flashcards: a card is turned over and the player says whether they knew it. */
  | 'cards'
  /** A medley: each piece is asked about in a different way, by lot. */
  | 'mix'
  /** "Pin it" by ear: the name is said aloud and not written. */
  | 'listen';

export type Res = 'ok' | 'warn' | 'bad';
