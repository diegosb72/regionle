/**
 * What the games of the section «Banderas» are played with: some flags, said by a word in the address of
 * the game (`paises-EU`, `regiones-ES`, `capitales`…), and the cards that are made of them. The gallery
 * shows every flag there is; a game takes those that can be asked, and knows which of them must never be
 * set side by side:
 *
 *  · The countries are the States: the members of the United Nations, its observers and those that are
 *    recognised in part. The territories that have a flag of their own (Greenland, Puerto Rico, Hong Kong…)
 *    are a set apart, so that a game of «countries of the world» is not one of islands few have heard of.
 *  · A territory drawn with the flag of its country (the French ones, Svalbard, the Caribbean
 *    Netherlands…) is not asked: its flag is that of another, and is asked under the name of that one.
 *  · Two flags that are the same picture (Ajman and Dubai, Nariño and Vichada; Chad and Romania, as far as
 *    a card can show them) are both asked, and are never two of the answers to one question.
 *  · Neither are two that are called the same (the city of Kiev and its province): what is asked is a name.
 */
import { capitalFlags, cityCounts, cityFlags, countryFlags, goneFlags, levelOf, namedFlags, regionFlags, signalFlags, type FlagCard, type FlagsFile, type FlagsPage } from './flags';
import { L, getLang, nm } from './i18n';
import { SAME_FLAG } from './pairs';
import { fold } from './text';
import type { Cls, Index } from './types';
import { loadFile } from './world';

/** Some flags to play with. */
export type FlagSet =
  /** Those of the countries: of the world or of one continent. */
  | { kind: 'countries'; continent?: string }
  /** Those of the territories and dependencies that have one of their own. */
  | { kind: 'territories' }
  /** Those of the divisions of a country: all of them, or those of one level of its map (0 the finest). */
  | { kind: 'regions'; country: string; level?: number }
  /** Those of the capitals of the countries. */
  | { kind: 'capitals' }
  /** Those of the cities of a country, its capital among them. */
  | { kind: 'cities'; country: string }
  /** Those of the countries that are no more. */
  | { kind: 'gone' }
  | { kind: 'organisations' }
  | { kind: 'peoples' }
  /** The flags of the International Code of Signals: a letter or a number each. */
  | { kind: 'signals' };

export type FlagSetKind = FlagSet['kind'];

/** The word each kind goes by in an address: the same in every language, so that links keep working. */
const WORD: Record<FlagSetKind, string> = {
  countries: 'paises',
  territories: 'territorios',
  regions: 'regiones',
  capitals: 'capitales',
  cities: 'ciudades',
  gone: 'desaparecidos',
  organisations: 'organizaciones',
  peoples: 'pueblos',
  signals: 'senales',
};
const KIND = Object.fromEntries(Object.entries(WORD).map(([kind, word]) => [word, kind])) as Record<string, FlagSetKind>;

/** Some flags as an address says them: `paises`, `paises-EU`, `regiones-ES`, `regiones-ES-1`, `ciudades-ES`, `capitales`… */
export function flagSetText(set: FlagSet): string {
  if (set.kind === 'countries') return set.continent ? `${WORD.countries}-${set.continent}` : WORD.countries;
  if (set.kind === 'regions') return set.level == null ? `${WORD.regions}-${set.country}` : `${WORD.regions}-${set.country}-${set.level}`;
  if (set.kind === 'cities') return `${WORD.cities}-${set.country}`;
  return WORD[set.kind];
}

/** The flags that a word of an address says; null when it says none. Whether there are such flags is for `deckOf` to tell. */
export function flagSetOf(text: string): FlagSet | null {
  const [word = '', code = '', more = '', ...rest] = text.split('-');
  const kind = KIND[word.toLowerCase()];
  // A word that goes on after what there is to say names nothing: it is not read as its beginning.
  if (!kind || rest.length) return null;
  const land = /^[A-Za-z][A-Za-z0-9]$/.test(code) ? code.toUpperCase() : '';
  if (kind === 'countries') return !code ? { kind } : land && !more ? { kind, continent: land } : null;
  if (kind === 'territories') return code ? null : { kind };
  if (kind === 'regions') {
    if (!land) return null;
    if (!more) return { kind, country: land };
    return /^[0-2]$/.test(more) ? { kind, country: land, level: Number(more) } : null;
  }
  if (kind === 'cities') return land && !more ? { kind, country: land } : null;
  return code ? null : { kind };
}

/** The same set, whatever the order its parts were written in. */
export const sameSet = (a: FlagSet, b: FlagSet): boolean => flagSetText(a) === flagSetText(b);

/**
 * The pictures that are the same as another (public/data/alike/same.json, which scripts/data/flags-alike.mjs
 * writes): each list is one picture under the names of its files.
 */
export interface SameFile {
  v: number;
  same: string[][];
}
export const loadSame = (): Promise<SameFile> => loadFile<SameFile>('alike/same.json');

/** For each file that is the same picture as another, the first of them. */
export function sameMap(file: SameFile | null | undefined): Map<string, string> {
  const head = new Map<string, string>();
  for (const list of file?.same ?? []) for (const name of list) head.set(name, list[0]);
  return head;
}

/** A flag as a game holds it. */
export interface DeckCard extends FlagCard {
  /** What its picture is, as far as the eye can tell: two cards with the same are never set side by side. */
  look: string;
  /** Its name as it is compared: two cards called the same are never set side by side either. */
  said: string;
  /** What it answers to when its name is typed: its names in both languages and, a country, the others it goes by. */
  answers: string[];
}

/** Whether two cards cannot be told apart by what a question shows: they are the same picture, or go by the same name. */
export const twins = (a: DeckCard, b: DeckCard): boolean => a.look === b.look || a.said === b.said;

/** What a country is for these games: a State, whatever its recognition. */
const STATES: readonly Cls[] = ['un', 'obs', 'partial'];

/** The fewest flags a game can be played with: a question shows four. */
export const FLAG_SET_MIN = 4;

/** The flags of a set as the gallery has them, before a game takes its pick. */
function cardsOf(set: FlagSet, index: Index, file: FlagsFile, base?: string): FlagCard[] {
  switch (set.kind) {
    case 'countries': {
      const where = new Map(index.countries.map((c) => [c.id, c]));
      return countryFlags(index, base).filter((card) => {
        const c = where.get(card.id);
        return !!c && STATES.includes(c.cl) && (!set.continent || c.ct === set.continent);
      });
    }
    case 'territories': {
      const where = new Map(index.countries.map((c) => [c.id, c]));
      // A territory that flies the flag of its country has none of its own to be asked.
      return countryFlags(index, base).filter((card) => where.get(card.id)?.cl === 'dep' && !SAME_FLAG[card.id]);
    }
    case 'regions': {
      const all = regionFlags(file, set.country, base);
      return set.level == null ? all : all.filter((card) => card.level === set.level);
    }
    case 'capitals':
      return capitalFlags(file, base);
    case 'cities':
      return [...capitalFlags(file, base).filter((card) => card.country === set.country), ...cityFlags(file, set.country, base)];
    case 'gone':
      return goneFlags(file, base);
    case 'organisations':
      return namedFlags(file, 'organisation', base);
    case 'peoples':
      return namedFlags(file, 'people', base);
    case 'signals':
      return signalFlags(file, base).filter((card) => card.group === 'sea');
  }
}

/**
 * The cards a set is played with, in the order of the data: each flag once, with what tells whether two
 * of them can share a question. `same` is `sameMap` of the pictures that are the same as another.
 *
 * A place that is on two levels of its map is one card: the community of Asturias and its only province,
 * which are called the same, and the region of Brussels and its «Bruselas-Capital», which are not, and
 * which answers to both names.
 */
export function deckOf(set: FlagSet, index: Index, file: FlagsFile, same: ReadonlyMap<string, string> = new Map(), base?: string): DeckCard[] {
  const seen = new Map<string, DeckCard>();
  const out: DeckCard[] = [];
  const cards = cardsOf(set, index, file, base);
  const land = set.kind === 'countries' || set.kind === 'territories' ? new Map(index.countries.map((c) => [c.id, c])) : null;
  for (const card of cards) {
    const look = card.kind === 'country' ? (SAME_FLAG[card.id] ?? card.id) : (same.get(card.file ?? '') ?? card.file ?? card.key);
    const said = fold(card.name);
    const c = land?.get(card.id);
    const answers = (c ? [c.n.es, c.n.en ?? '', ...(c.al ?? [])] : [card.name, card.alt ?? '']).filter(Boolean);
    // The same picture under the same name, or of the same place.
    const marks = [`${look}\n${said}`, `${look}\n\n${card.key}`];
    const first = marks.map((mark) => seen.get(mark)).find((one) => !!one);
    if (first) {
      first.answers = [...new Set([...first.answers, ...answers])];
      continue;
    }
    const mine: DeckCard = { ...card, look, said, answers: [...new Set(answers)] };
    for (const mark of marks) seen.set(mark, mine);
    out.push(mine);
  }
  return out;
}

/** What a set is called: «Países de Europa», «Regiones de España», «Capitales del mundo». */
export function flagSetName(set: FlagSet, index: Index): string {
  const land = (id: string): string => {
    const c = index.countries.find((x) => x.id === id);
    return c ? nm(c.n) : id;
  };
  switch (set.kind) {
    case 'countries': {
      const ct = set.continent ? index.continents[set.continent] : undefined;
      if (!ct) return L('Países del mundo', 'Countries of the world');
      return L(`Países de ${nm(ct)}`, set.continent === 'AM' ? 'Countries of the Americas' : `Countries of ${nm(ct)}`);
    }
    case 'territories':
      return L('Territorios y dependencias', 'Territories and dependencies');
    case 'regions': {
      const level = set.level == null ? undefined : levelOf(index.countries.find((c) => c.id === set.country), set.level);
      const what = level ? (getLang() === 'en' ? level.en : level.es) : L('regiones', 'regions');
      return L(`${what[0].toUpperCase()}${what.slice(1)} de ${land(set.country)}`, `${land(set.country)}: ${what}`);
    }
    case 'capitals':
      return L('Capitales del mundo', 'Capitals of the world');
    case 'cities':
      return L(`Ciudades de ${land(set.country)}`, `${land(set.country)}: cities`);
    case 'gone':
      return L('Países que ya no existen', 'Countries that are no more');
    case 'organisations':
      return L('Organizaciones', 'Organisations');
    case 'peoples':
      return L('Pueblos y Estados sin reconocimiento general', 'Peoples and States without general recognition');
    case 'signals':
      return L('Código internacional de señales', 'International Code of Signals');
  }
}

/** A set that can be chosen, with how many cards it is played with. */
export interface SetChoice {
  set: FlagSet;
  /** Its short name, where the kind is already said: «Europa», «España», «Provincias». */
  name: string;
  n: number;
}

/** The flags of a country that can be chosen: all of them and, where its map has flags at more than one level, those of each. */
export interface LandChoice extends SetChoice {
  country: string;
  levels: SetChoice[];
}

/** Every set there is to choose from, by kind; those with too few flags for a game are left out. */
export interface SetMenu {
  countries: SetChoice[];
  territories: SetChoice | null;
  regions: LandChoice[];
  capitals: SetChoice | null;
  cities: SetChoice[];
  gone: SetChoice | null;
  organisations: SetChoice | null;
  peoples: SetChoice | null;
  signals: SetChoice | null;
}

export function setMenu(index: Index, file: FlagsFile, same: ReadonlyMap<string, string> = new Map()): SetMenu {
  const size = (set: FlagSet): number => deckOf(set, index, file, same).length;
  const one = (set: FlagSet, name: string): SetChoice | null => {
    const n = size(set);
    return n >= FLAG_SET_MIN ? { set, name, n } : null;
  };
  const some = (list: (SetChoice | null)[]): SetChoice[] => list.filter((c): c is SetChoice => !!c);
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, getLang());
  const land = new Map(index.countries.map((c) => [c.id, c]));
  const nameOf = (id: string): string => (land.has(id) ? nm(land.get(id)!.n) : id);

  const regions: LandChoice[] = [];
  for (const country of Object.keys(file.regions)) {
    const all = one({ kind: 'regions', country }, nameOf(country));
    if (!all) continue;
    // A level is offered by itself where the map has another with flags enough: otherwise it is the whole.
    const levels = some(
      [2, 1, 0].map((level) => {
        const said = levelOf(land.get(country), level);
        const what = said ? (getLang() === 'en' ? said.en : said.es) : L(`nivel ${level}`, `level ${level}`);
        return one({ kind: 'regions', country, level }, `${what[0].toUpperCase()}${what.slice(1)}`);
      }),
    );
    regions.push({ ...all, country, levels: levels.length > 1 ? levels : [] });
  }
  return {
    countries: some([one({ kind: 'countries' }, L('Todo el mundo', 'The whole world')), ...Object.entries(index.continents).map(([id, name]) => one({ kind: 'countries', continent: id }, nm(name)))]),
    territories: one({ kind: 'territories' }, L('Territorios', 'Territories')),
    regions: regions.sort(byName),
    capitals: one({ kind: 'capitals' }, L('Capitales del mundo', 'Capitals of the world')),
    cities: some([...cityCounts(file).keys()].map((country) => one({ kind: 'cities', country }, nameOf(country)))).sort(byName),
    gone: one({ kind: 'gone' }, L('Países que ya no existen', 'Countries that are no more')),
    organisations: one({ kind: 'organisations' }, L('Organizaciones', 'Organisations')),
    peoples: one({ kind: 'peoples' }, L('Pueblos', 'Peoples')),
    signals: one({ kind: 'signals' }, L('Código de señales', 'Code of signals')),
  };
}

/**
 * Where the look-alikes of a set are (public/data/alike, which scripts/data/flags-alike.mjs writes): the
 * file, and the group within it, which is that very set. `wider` is the group to fall back on when there is
 * no such group: the level of a map that has no flags of its own to speak of is in that of its country.
 */
export function alikePlace(set: FlagSet): { file: 'countries' | 'regions' | 'cities' | 'others'; group: string; wider?: string } {
  switch (set.kind) {
    case 'countries':
      return { file: 'countries', group: set.continent ?? 'states' };
    case 'territories':
      return { file: 'countries', group: 'territories' };
    case 'regions':
      return set.level == null ? { file: 'regions', group: set.country } : { file: 'regions', group: `${set.country}-${set.level}`, wider: set.country };
    case 'capitals':
      return { file: 'cities', group: 'capitals' };
    case 'cities':
      return { file: 'cities', group: set.country };
    default:
      return { file: 'others', group: set.kind };
  }
}

/** The page of the gallery where the flags of a set are to be seen. */
export function galleryPage(set: FlagSet): FlagsPage {
  switch (set.kind) {
    case 'countries':
    case 'territories':
      return { tab: 'countries' };
    case 'regions':
      return { tab: 'regions', country: set.country };
    case 'capitals':
      return { tab: 'cities' };
    case 'cities':
      return { tab: 'cities', country: set.country };
    case 'gone':
      return { tab: 'history' };
    default:
      return { tab: 'others' };
  }
}

/** The set that a page of the gallery is played with: what is on it or, where it shows several kinds, the first of them. */
export function setOfPage(page: FlagsPage): FlagSet {
  switch (page.tab) {
    case 'countries':
      return { kind: 'countries' };
    case 'regions':
      return page.country ? { kind: 'regions', country: page.country } : { kind: 'countries' };
    case 'cities':
      return page.country ? { kind: 'cities', country: page.country } : { kind: 'capitals' };
    case 'history':
      return { kind: 'gone' };
    default:
      return { kind: 'organisations' };
  }
}
