/**
 * The flags of the section «Banderas» that do not come with the countries: those of the divisions of the
 * maps and those of the capitals, those that the countries flew before, those of the countries that are no
 * more, of organisations and of peoples, and the signals (public/data/flags.json and the files of
 * docs/flags/commons, written by scripts/data/flags.mjs from Wikidata and Wikimedia Commons). They come in
 * files of their own, and so does this code: only the screen that shows them fetches any of it.
 *
 * A flag is a drawing (SVG) wherever its file in Commons is one; the rest are pictures (WebP). A drawing
 * that is heavy comes with a picture of it as well, which is what a list of flags shows: the drawing is
 * for when one flag is looked at, or worked on.
 */
import { getLang } from './i18n';
import { norm } from './text';
import type { Country, Index } from './types';
import { loadFile } from './world';

/**
 * The flag of a division: its id, its level (0 the finest), its name in Spanish and, when it is another, in
 * English, its file, its width over its height and, for a heavy drawing, the picture that stands for it
 * where it is shown small.
 */
export type RegionRow = [id: string, level: number, es: string, en: string, file: string, ratio: number, small?: string];
/** The flag of a capital: the id of the city, its country, and then as that of a division. */
export type CapitalRow = [id: string, country: string, es: string, en: string, file: string, ratio: number, small?: string];
/** The flag of a city that is the capital of no country: the id of the city, and then as that of a division. */
export type CityRow = [id: string, es: string, en: string, file: string, ratio: number, small?: string];

/**
 * A flag that a country flew before the one it flies: its file, its width over its height, the years it
 * flew between (0 for one that is not known) and, for a heavy drawing, the picture that stands for it.
 */
export type PastRow = [file: string, ratio: number, from: number, to: number, small?: string];
/** The flag of a country that is no more: its Wikidata id, its names, its file, its shape and the years the country lasted between (0 for one that is not known). */
export type GoneRow = [id: string, es: string, en: string, file: string, ratio: number, from: number, to: number, small?: string];
/** The flag of an organisation or of a people: its Wikidata id, its names, its file and its shape. */
export type NamedRow = [id: string, es: string, en: string, file: string, ratio: number, small?: string];
/** A flag that is a signal: its id, the code it is of, its names, its file and its shape. */
export type SignalRow = [id: string, group: string, es: string, en: string, file: string, ratio: number, small?: string];

export interface FlagsFile {
  v: number;
  /** By the country whose map they are of, the coarser levels first and each in the order of the alphabet. */
  regions: Record<string, RegionRow[]>;
  capitals: CapitalRow[];
  /** The other cities, by country and by their Spanish name. */
  cities?: Record<string, CityRow[]>;
  /** By country, the flags it flew before, the oldest first. */
  past?: Record<string, PastRow[]>;
  /** The countries that are no more, by their Spanish name. */
  gone?: GoneRow[];
  organisations?: NamedRow[];
  peoples?: NamedRow[];
  /** The signals, in the order of their codes. */
  signals?: SignalRow[];
  /** What a signal says when it is flown alone, in Spanish and in English, by its id. */
  means?: Record<string, [es: string, en: string]>;
}

/** Who made each file and on what terms it is given. */
export interface CreditsFile {
  v: number;
  /** Each licence: its name and where it is written. */
  licences: [name: string, url: string][];
  /** By the name of the file in the game: its title in Commons, its author and which licence. */
  files: Record<string, [title: string, author: string, licence: number]>;
}

export const loadFlags = (): Promise<FlagsFile> => loadFile<FlagsFile>('flags.json');
export const loadFlagCredits = (): Promise<CreditsFile> => loadFile<CreditsFile>('flag-credits.json');

/** Where a flag is served from. */
export const flagSrc = (file: string, base: string = import.meta.env.BASE_URL): string => `${base}flags/commons/${file}`;
/** The page of a file in Wikimedia Commons, where its author and its licence are. */
export const commonsPage = (title: string): string => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title.replace(/ /g, '_'))}`;

export type FlagKind = 'country' | 'region' | 'capital' | 'city' | 'past' | 'gone' | 'organisation' | 'people' | 'signal';

/** A flag as the gallery shows it. */
export interface FlagCard {
  /** What tells it from any other: its kind and the id of what flies it. */
  key: string;
  kind: FlagKind;
  /** The id of what flies it: a country, a division or a city; the Wikidata id of what the maps do not have; the id of a signal. */
  id: string;
  /** The country it is, is in or was of; none for what is no country's. */
  country: string;
  name: string;
  /** Its name in the other language, where it is another: an answer typed in either is right. */
  alt?: string;
  /** The years it flew between (a flag of other times) or its country lasted between (one that is no more): 0 for one that is not known. */
  years?: [from: number, to: number];
  /** Signals: the code it is of. */
  group?: string;
  /** Signals: what it says when it is flown alone. */
  means?: string;
  /** Divisions: 0 for the finest level of the map, 1 and 2 for the groups above it. */
  level?: number;
  /** The address of the flag: a drawing wherever there is one. */
  src: string;
  /** The address to show it small from: the same one, but for a heavy drawing, which has a picture for that. */
  small: string;
  /** Its file among those of Commons; none for the flag of a country, which comes with the game. */
  file?: string;
  /** Its width over its height. */
  ratio: number;
}

const named = (es: string, en: string): string => (getLang() === 'en' && en ? en : es);
/** The name in the language that is not on screen, where there is one and it is another. */
const other = (es: string, en: string): { alt?: string } => {
  const alt = getLang() === 'en' ? es : en;
  return alt && alt !== named(es, en) ? { alt } : {};
};

/** The flags of the divisions of a country, the coarser levels first. */
export function regionFlags(file: FlagsFile, country: string, base?: string): FlagCard[] {
  return (file.regions[country] ?? []).map(([id, level, es, en, name, ratio, small]) => ({ key: `region:${id}`, kind: 'region', id, country, name: named(es, en), ...other(es, en), level, src: flagSrc(name, base), small: flagSrc(small ?? name, base), file: name, ratio }));
}

/** The flags of the capitals. */
export function capitalFlags(file: FlagsFile, base?: string): FlagCard[] {
  return file.capitals.map(([id, country, es, en, name, ratio, small]) => ({ key: `capital:${id}`, kind: 'capital', id, country, name: named(es, en), ...other(es, en), src: flagSrc(name, base), small: flagSrc(small ?? name, base), file: name, ratio }));
}

/** The flags of the cities of a country that are the capital of none, or of every country with none named. */
export function cityFlags(file: FlagsFile, country?: string, base?: string): FlagCard[] {
  const of = (id: string): FlagCard[] =>
    (file.cities?.[id] ?? []).map(([city, es, en, name, ratio, small]) => ({ key: `city:${city}`, kind: 'city' as const, id: city, country: id, name: named(es, en), ...other(es, en), src: flagSrc(name, base), small: flagSrc(small ?? name, base), file: name, ratio }));
  return country ? of(country) : Object.keys(file.cities ?? {}).flatMap(of);
}

/** How many flags of cities each country has: those of its capitals and those of the rest. */
export function cityCounts(file: FlagsFile): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of file.capitals) counts.set(row[1], (counts.get(row[1]) ?? 0) + 1);
  for (const [country, rows] of Object.entries(file.cities ?? {})) counts.set(country, (counts.get(country) ?? 0) + rows.length);
  return counts;
}

/** The flags that the countries flew before, each under the name of its country: by country, the oldest first. */
export function pastFlags(file: FlagsFile, index: Index, base?: string): FlagCard[] {
  return index.countries.flatMap((c) =>
    (file.past?.[c.id] ?? []).map(([name, ratio, from, to, small]) => ({
      key: `past:${c.id}:${name}`,
      kind: 'past' as const,
      id: c.id,
      country: c.id,
      name: getLang() === 'en' ? (c.n.en ?? c.n.es) : c.n.es,
      years: [from, to] as [number, number],
      src: flagSrc(name, base),
      small: flagSrc(small ?? name, base),
      file: name,
      ratio,
    })),
  );
}

/** The flags of the countries that are no more. */
export function goneFlags(file: FlagsFile, base?: string): FlagCard[] {
  return (file.gone ?? []).map(([id, es, en, name, ratio, from, to, small]) => ({ key: `gone:${id}`, kind: 'gone', id, country: '', name: named(es, en), ...other(es, en), years: [from, to], src: flagSrc(name, base), small: flagSrc(small ?? name, base), file: name, ratio }));
}

/** The flags of the organisations, or those of the peoples. */
export function namedFlags(file: FlagsFile, kind: 'organisation' | 'people', base?: string): FlagCard[] {
  return ((kind === 'organisation' ? file.organisations : file.peoples) ?? []).map(([id, es, en, name, ratio, small]) => ({ key: `${kind}:${id}`, kind, id, country: '', name: named(es, en), ...other(es, en), src: flagSrc(name, base), small: flagSrc(small ?? name, base), file: name, ratio }));
}

/** The flags that are signals, with what each says. */
export function signalFlags(file: FlagsFile, base?: string): FlagCard[] {
  return (file.signals ?? []).map(([id, group, es, en, name, ratio, small]) => {
    const means = file.means?.[id];
    return { key: `signal:${id}`, kind: 'signal', id, country: '', name: named(es, en), ...other(es, en), group, ...(means ? { means: named(means[0], means[1]) } : {}), src: flagSrc(name, base), small: flagSrc(small ?? name, base), file: name, ratio };
  });
}

/** A year as it is written: one before our era says so. */
const year = (y: number): string => (y < 0 ? (getLang() === 'en' ? `${-y} BC` : `${-y} a. C.`) : String(y));

/** The years of a flag as they are written: «1931–1939», «hasta 1939» when the first is not known, «desde 1931» when the last is not; nothing with neither. */
export function yearsText(years: readonly [number, number] | undefined): string {
  if (!years) return '';
  const [from, to] = years;
  if (from && to) return from === to ? year(from) : `${year(from)}–${year(to)}`;
  if (to) return getLang() === 'en' ? `until ${year(to)}` : `hasta ${year(to)}`;
  if (from) return getLang() === 'en' ? `from ${year(from)}` : `desde ${year(from)}`;
  return '';
}

/** Every file of Commons that the list of flags names, each once. */
export function flagFiles(file: FlagsFile): Set<string> {
  const names = new Set<string>();
  for (const row of Object.values(file.regions).flat()) names.add(row[4]);
  for (const row of file.capitals) names.add(row[4]);
  for (const row of Object.values(file.cities ?? {}).flat()) names.add(row[3]);
  for (const row of Object.values(file.past ?? {}).flat()) names.add(row[0]);
  for (const row of file.gone ?? []) names.add(row[3]);
  for (const row of [...(file.organisations ?? []), ...(file.peoples ?? [])]) names.add(row[3]);
  for (const row of file.signals ?? []) names.add(row[4]);
  return names;
}

/** The flags of the countries, which come with the game, all drawn four by three. */
export function countryFlags(index: Index, base: string = import.meta.env.BASE_URL): FlagCard[] {
  return index.countries
    .filter((c) => c.fl)
    .map((c) => ({ key: `country:${c.id}`, kind: 'country' as const, id: c.id, country: c.id, name: getLang() === 'en' ? (c.n.en ?? c.n.es) : c.n.es, ...other(c.n.es, c.n.en ?? ''), src: `${base}flags/${c.fl}.svg`, small: `${base}flags/${c.fl}.svg`, ratio: 4 / 3 }));
}

/** How many flags of divisions each country has, by level. */
export function regionCounts(file: FlagsFile): Map<string, number[]> {
  const counts = new Map<string, number[]>();
  for (const [country, rows] of Object.entries(file.regions)) {
    const n = [0, 0, 0];
    for (const row of rows) n[row[1]] = (n[row[1]] ?? 0) + 1;
    counts.set(country, n);
  }
  return counts;
}

/** The level of a map that the gallery calls `level`: 0 is the finest (`f`), 1 and 2 the groups above it (`g1`, `g2`). */
export function levelOf(country: Country | undefined, level: number) {
  const key = level === 0 ? 'f' : `g${level}`;
  return country?.lv?.find((l) => l.k === key);
}

/** The flags whose name has every word that was typed, whatever its accents and its capitals. */
export function searchFlags(cards: readonly FlagCard[], typed: string): FlagCard[] {
  const words = norm(typed).split(' ').filter(Boolean);
  if (!words.length) return [...cards];
  return cards.filter((card) => {
    const name = norm(card.name);
    return words.every((word) => name.includes(word));
  });
}

/**
 * A page of the gallery: the flags of the countries, those of the divisions of one country, those of the
 * cities (of the capitals, with no country named, or of the cities of one), those of other times (of the
 * countries that are no more, and the ones that those of today flew before) or the others (organisations,
 * peoples and signals).
 */
export type FlagsPage = { tab: 'countries' } | { tab: 'regions'; country?: string } | { tab: 'cities'; country?: string } | { tab: 'history' } | { tab: 'others' };

const TAB_WORD: Record<FlagsPage['tab'], string> = { countries: 'paises', regions: 'regiones', cities: 'ciudades', history: 'historicas', others: 'otras' };
/** The words an address may name a page by: those of both languages, and `capitales`, which is what the page of the cities was called when it had only those. */
const WORD_TAB: Record<string, FlagsPage['tab']> = {
  paises: 'countries',
  countries: 'countries',
  regiones: 'regions',
  regions: 'regions',
  ciudades: 'cities',
  cities: 'cities',
  capitales: 'cities',
  capitals: 'cities',
  historicas: 'history',
  history: 'history',
  otras: 'others',
  others: 'others',
};

/** The page of the gallery that what follows `banderas/` in an address names: `regiones/ES`. With nothing known, the countries. */
export function flagsPageOf(rest: string): FlagsPage {
  const [word = '', code = ''] = rest.split('/');
  const tab = WORD_TAB[word.toLowerCase()] ?? 'countries';
  if (tab !== 'regions' && tab !== 'cities') return { tab };
  return /^[A-Za-z][A-Za-z0-9]$/.test(code) ? { tab, country: code.toUpperCase() } : { tab };
}

/**
 * What follows `banderas/` in the address of a page of the gallery. Every page has its word, the first
 * one too: `banderas` alone is where the games of the section are chosen (lib/routes.ts, `flagsScreen`).
 */
export function flagsRest(page: FlagsPage): string {
  return (page.tab === 'regions' || page.tab === 'cities') && page.country ? `${TAB_WORD[page.tab]}/${page.country}` : TAB_WORD[page.tab];
}
