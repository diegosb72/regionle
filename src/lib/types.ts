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
  /**
   * The year the population of its divisions is of, in the countries whose divisions carry one: those where
   * the figures of all of them hold together (scripts/data/population.mjs).
   */
  rp?: number;
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
  /** Regions: how many people live there, and the year the figure is of when the source says it. */
  people?: number;
  peopleYear?: number;
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

/**
 * What is said of a country besides its figures (lib/facts.ts): what it pays with, the language that is
 * official in it, its internet domain and its dialling code.
 */
export type FactKind = 'currency' | 'language' | 'domain' | 'dial';

/** How a typed fact was judged: right or not, what it was taken for, and what there is to say about it. */
export interface FactVerdict {
  right: boolean;
  /** What was typed, as the thing it names: "dólar" for "dolar". */
  meant?: string;
  /** What to tell whoever typed it: «.at» is the domain of Austria. */
  note?: string;
}

/**
 * Those four things, as the games ask about them. They come in a file and a piece of code of their own,
 * fetched only by the games that need them, and a map carries them when its game does (`Deck.facts`).
 */
export interface Facts {
  /** The fact as a question gives it for an answer: "euro", "español", ".es", "+34". Nothing where the country has none. */
  said(kind: FactKind, id: string): string;
  /** All a country has of it, in a row, as it is said once the question is settled: "balboa y dólar". */
  all(kind: FactKind, id: string): string;
  /** Whether what is said of another country is true of this one too: here it cannot be a wrong option. */
  holds(kind: FactKind, id: string, said: string): boolean;
  /**
   * How many of these countries could say of themselves what a question gives for this one, itself among
   * them when it is: the dollar is the currency of many, the yen of one. Nothing where the country has none.
   */
  sharedBy(kind: FactKind, id: string, among: readonly string[]): number;
  /**
   * Whether these countries can be asked among four options: each one that is asked needs three different
   * answers of the others that are not true of it as well. Where they are not there, the answer is typed.
   * `only`: the ones a list asks about, on a map that has more; the rest still lend their answers.
   */
  choosable(kind: FactKind, ids: readonly string[], only?: readonly string[]): boolean;
  /**
   * Of these countries, the ones that can be asked: those that have the fact and, where the country is named
   * and the fact is asked for, do not give it away with their name (the French of France); where the fact is
   * `shown` and the country is to be found, those that do not share it with another of them.
   */
  asked(kind: FactKind, ids: readonly string[], shown?: boolean): string[];
  /** Judges what was typed for a country. `among`: the countries of the map, to say whose something else is. */
  check(kind: FactKind, id: string, text: string, among: readonly string[]): FactVerdict;
  /** What the text so far may be on its way to, for the list under the field. */
  suggest(kind: FactKind, text: string): string[];
  /** The words of the question: over the name of a country or, where the fact is `shown`, over the fact. */
  ask(kind: FactKind, shown?: boolean): string;
  /** The lines of the card of a country: what each thing is called, and what it is. */
  card(id: string): [name: string, value: string][];
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
  /** What is said of the countries besides their figures, on the map of a game that asks or shows it (lib/decks.ts). */
  facts?: Facts;
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
  /** A game for a group: one screen calls the pieces of the map, and each player crosses them off a card. */
  | 'bingo'
  /** A name is hidden and found letter by letter: each letter that is not in it puts out a point of a compass rose. */
  | 'hangman'
  /** The names of the pieces that the map lights up, hidden in a square of letters: each is marked from its first letter to its last. */
  | 'wordsearch'
  /** The names of some pieces cross each other in a grid: each word has a number, and the map carries it on its piece. */
  | 'crossword'
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
  /** One thing said of each country is asked for: its currency, its official language, its internet domain or its dialling code. */
  | 'fact'
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
  /** Sixteen countries that go four by four, each four with something in common that is not said. */
  | 'connect'
  /** The first ten by a figure, typed from memory. */
  | 'topten'
  /** Flashcards: a card is turned over and the player says whether they knew it. */
  | 'cards'
  /** A medley: each piece is asked about in a different way, by lot. */
  | 'mix'
  /** "Pin it" by ear: the name is said aloud and not written. */
  | 'listen';

export type Res = 'ok' | 'warn' | 'bad';
