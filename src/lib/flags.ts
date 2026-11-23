/**
 * The flags of the section «Banderas» that do not come with the countries: those of the divisions of the
 * maps and those of the capitals (public/data/flags.json and the files of docs/flags/commons, written by
 * scripts/data/flags.mjs from Wikidata and Wikimedia Commons). They come in files of their own, and so does
 * this code: only the screen that shows them fetches any of it.
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

export interface FlagsFile {
  v: number;
  /** By the country whose map they are of, the coarser levels first and each in the order of the alphabet. */
  regions: Record<string, RegionRow[]>;
  capitals: CapitalRow[];
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

export type FlagKind = 'country' | 'region' | 'capital';

/** A flag as the gallery shows it. */
export interface FlagCard {
  /** What tells it from any other: its kind and the id of what flies it. */
  key: string;
  kind: FlagKind;
  /** The id of what flies it: a country, a division or a city. */
  id: string;
  /** The country it is, or is in. */
  country: string;
  name: string;
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

/** The flags of the divisions of a country, the coarser levels first. */
export function regionFlags(file: FlagsFile, country: string, base?: string): FlagCard[] {
  return (file.regions[country] ?? []).map(([id, level, es, en, name, ratio, small]) => ({ key: `region:${id}`, kind: 'region', id, country, name: named(es, en), level, src: flagSrc(name, base), small: flagSrc(small ?? name, base), file: name, ratio }));
}

/** The flags of the capitals. */
export function capitalFlags(file: FlagsFile, base?: string): FlagCard[] {
  return file.capitals.map(([id, country, es, en, name, ratio, small]) => ({ key: `capital:${id}`, kind: 'capital', id, country, name: named(es, en), src: flagSrc(name, base), small: flagSrc(small ?? name, base), file: name, ratio }));
}

/** The flags of the countries, which come with the game, all drawn four by three. */
export function countryFlags(index: Index, base: string = import.meta.env.BASE_URL): FlagCard[] {
  return index.countries
    .filter((c) => c.fl)
    .map((c) => ({ key: `country:${c.id}`, kind: 'country' as const, id: c.id, country: c.id, name: getLang() === 'en' ? (c.n.en ?? c.n.es) : c.n.es, src: `${base}flags/${c.fl}.svg`, small: `${base}flags/${c.fl}.svg`, ratio: 4 / 3 }));
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

/** A page of the gallery: the flags of the countries, those of the divisions of one country, or those of the capitals. */
export type FlagsPage = { tab: 'countries' } | { tab: 'regions'; country?: string } | { tab: 'capitals' };

const TAB_WORD: Record<FlagsPage['tab'], string> = { countries: 'paises', regions: 'regiones', capitals: 'capitales' };
const WORD_TAB: Record<string, FlagsPage['tab']> = { paises: 'countries', countries: 'countries', regiones: 'regions', regions: 'regions', capitales: 'capitals', capitals: 'capitals' };

/** The page that what follows `banderas/` in an address names: `regiones/ES`. With nothing, or nothing known, the countries. */
export function flagsPageOf(rest: string): FlagsPage {
  const [word = '', code = ''] = rest.split('/');
  const tab = WORD_TAB[word.toLowerCase()] ?? 'countries';
  if (tab !== 'regions') return { tab };
  return /^[A-Za-z][A-Za-z0-9]$/.test(code) ? { tab, country: code.toUpperCase() } : { tab };
}

/** What follows `banderas/` in the address of a page; nothing for the first one. */
export function flagsRest(page: FlagsPage): string {
  if (page.tab === 'countries') return '';
  return page.tab === 'regions' && page.country ? `${TAB_WORD.regions}/${page.country}` : TAB_WORD[page.tab];
}
