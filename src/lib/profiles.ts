/**
 * The sheets of the countries: what the gallery of flags shows when the flag of a country that has one is
 * opened (screens/FlagProfile.tsx). What is written of the country by hand — what it is, what its flag
 * means, what it was at the time of each flag it flew — and the photographs it is shown with come in a file
 * of its own (public/data/profiles/<country>.json, made by scripts/data/profiles.mjs); its figures are the
 * ones the game already has of every country.
 *
 * For now it is a trial, and only Brazil has one.
 */
import { countryFlags, goneFlags, pastFlags, type FlagCard, type FlagsFile } from './flags';
import type { Country, Index } from './types';
import { loadFile } from './world';

/** A text in the two languages of the game. */
export interface Said {
  es: string;
  en: string;
}

/** A photograph of Wikimedia Commons, as a sheet shows it. */
export interface ProfilePhoto {
  /** What its pictures are named after: `<file>-<width>.webp`. */
  file: string;
  /** How wide and how high it was brought: its shape. */
  w: number;
  h: number;
  /** The widths it is kept at, the narrowest first. */
  sizes: number[];
  /** Its title in Commons, where its page says who made it and on what terms it is given. */
  title: string;
  /** Who made it; none for a work that names nobody and need not. */
  by?: string;
  licence: string;
  licenceUrl?: string;
  /** What is seen in it. */
  es: string;
  en: string;
  /** The point of it that stays in sight where it is shown cut, in hundredths of its width and of its height. */
  focus?: [number, number];
}

/** A time of the country, by the flag it flew then: one of other times, that of what it was then, or the one it flies. */
export interface ProfileTime {
  /** The years the country flew it between, as the game has that flag (public/data/flags.json, `past`). */
  past?: [number, number];
  /** What the country was then, by its id among those that are no more (`gone`). */
  gone?: string;
  now?: true;
  from: number;
  to?: number;
  /** When it flew, where the years do not say it well: four days of one November. */
  when?: Said;
  name: Said;
  text: Said;
  picture?: ProfilePhoto;
}

export interface ProfileFile {
  v: number;
  id: string;
  official: Said;
  /** Its official name in its own language, and which language that is: `pt`. */
  local?: string;
  localLang?: string;
  about: { es: string[]; en: string[] };
  flag: {
    /** The days it was adopted and last changed on: `1889-11-19`. */
    adopted: string;
    changed?: string;
    /** Its height to its width: `7:10`. */
    ratio: string;
    called?: Said;
    by?: Said;
    text: { es: string[]; en: string[] };
    /** What each part of it means: its name and what is said of it. */
    parts: { es: [string, string]; en: [string, string] }[];
  };
  /** The oldest first; the last is the flag of today. */
  times: ProfileTime[];
  /** The first is the one at the head of the sheet. */
  photos: ProfilePhoto[];
  read: Said;
}

/** The countries that have a sheet. */
export const PROFILE_LANDS: readonly string[] = ['BR'];
export const hasProfile = (id: string): boolean => PROFILE_LANDS.includes(id);

export const loadProfile = (id: string): Promise<ProfileFile> => loadFile<ProfileFile>(`profiles/${id}.json`);

/** Where a picture of a photograph is served from. */
export const photoSrc = (file: string, width: number, base: string = import.meta.env.BASE_URL): string => `${base}photos/${file}-${width}.webp`;
/** Every picture of a photograph with its width, for the browser to choose from. */
export const photoSet = (photo: Pick<ProfilePhoto, 'file' | 'sizes'>, base?: string): string => photo.sizes.map((w) => `${photoSrc(photo.file, w, base)} ${w}w`).join(', ');

const COUNTRIES_WORD = /^(paises|countries)$/i;

/** What follows `banderas/` in the address of the sheet of a country: the page of the countries of the gallery, and the country. */
export const profileRest = (id: string): string => `paises/${id}`;

/** The country whose sheet an address of the gallery asks for; none when it names none that has one. */
export function profileIn(rest: string): string | null {
  const [word = '', code = '', more] = rest.split('/');
  if (more !== undefined || !COUNTRIES_WORD.test(word)) return null;
  const id = code.toUpperCase();
  return hasProfile(id) ? id : null;
}

/** What a State is: a member of the United Nations, an observer, or one that is recognised in part. */
const STATES: readonly string[] = ['un', 'obs', 'partial'];

/**
 * The place of a country among the States of the world by a figure, the largest first: «5 of 198». None
 * for what is no State or has no such figure; two with the same figure share the place.
 */
export function rankOf(index: Index, id: string, of: (c: Country) => number | undefined): { place: number; among: number } | null {
  const states = index.countries.filter((c) => STATES.includes(c.cl) && (of(c) ?? 0) > 0);
  const mine = states.find((c) => c.id === id);
  if (!mine) return null;
  return { place: states.filter((c) => of(c)! > of(mine)!).length + 1, among: states.length };
}

/** The flag of each time of a sheet, as the gallery has it; none where the game has no such flag. */
export function timeCards(profile: ProfileFile, file: FlagsFile, index: Index, base?: string): (FlagCard | null)[] {
  const past = pastFlags(file, index, base).filter((card) => card.id === profile.id);
  const gone = goneFlags(file, base);
  const now = countryFlags(index, base).find((card) => card.id === profile.id) ?? null;
  return profile.times.map((time) => {
    if (time.now) return now;
    if (time.gone) return gone.find((card) => card.id === time.gone) ?? null;
    return past.find((card) => card.years?.[0] === time.past?.[0] && card.years?.[1] === time.past?.[1]) ?? null;
  });
}

/** How a day is written in a sheet: `1889-11-19`. */
export const isDay = (text: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(`${text}T00:00:00Z`));
