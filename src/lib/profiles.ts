/**
 * The sheets of the countries: what the gallery of flags shows when the flag of a country is opened
 * (screens/FlagProfile.tsx). Every country that has a flag has one. Its figures are the ones the game
 * already has of every country; what else it says comes in a file of its own
 * (public/data/profiles/<country>.json, made by scripts/data/profiles.mjs):
 *
 *   · what Wikidata and Wikipedia say of it and of its flag — what it is called in full, its motto, its
 *     anthem, since when the flag is flown, its proportions and its colours —, which every sheet has as far
 *     as they say it;
 *   · how the page of Wikipedia of the country and that of its flag begin, shortened, in each language of
 *     the game: what a sheet tells in words while nobody has written of the country;
 *   · and, where somebody has written it (for now, of Brazil alone), what the country is, what its flag
 *     means, what it was at the time of each flag it flew, and the photographs it is shown with.
 */
import { countryFlags, goneFlags, pastFlags, type FlagCard, type FlagsFile } from './flags';
import { L, getLang, nm } from './i18n';
import { nf } from './text';
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

/**
 * The coat of arms of a country — or what it has instead: an emblem, a seal —, as the sheet shows it: one
 * small picture of the drawing Wikimedia Commons has (`<file>-<w>.webp`), with who drew it and on what terms
 * it is given.
 */
export interface ProfileArms extends Pick<ProfilePhoto, 'file' | 'w' | 'h' | 'title' | 'by' | 'licence' | 'licenceUrl'> {
  /** What it is, where it is not a coat of arms. */
  kind?: 'emblem' | 'seal';
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

/** A text in one of the two languages, or in both: what is not known in a language is not said in it. */
export type SaidIn = Partial<Said>;

/**
 * How Wikipedia begins to tell of something, shortened: its paragraphs, in each language of the game it was
 * read in. The text is of the authors of the page, under CC BY-SA 4.0: whoever shows it says so, and leads
 * to the page.
 */
export type ProfileLead = Partial<Record<'es' | 'en', string[]>>;

export interface ProfileFile {
  v: number;
  id: string;
  /** What it is called in full, in each language of the game it is known in. */
  official?: SaidIn;
  /** Its official name in its own language, and which language that is: `pt`. */
  local?: string;
  localLang?: string;
  /** Its motto as it is said, the language it is said in, and what it means where that is known. */
  motto?: { text: string; lang: string } & SaidIn;
  /** What its anthem is called. */
  anthem?: SaidIn;
  /** What the country is: written for the game. */
  about?: { es: string[]; en: string[] };
  /** How its page of Wikipedia (`read`) begins: what is shown of it while nobody has written `about`. */
  lead?: ProfileLead;
  flag?: {
    /**
     * Whose flag it is, where it is not its own: a territory that flies that of its country (Réunion, that
     * of France). What follows is then said of that flag, as the sheet of that country says it.
     */
    of?: string;
    /** The day it was adopted on, or the year where the day is not known (`1889-11-19`, `1889`), and the day it was last changed on. */
    adopted?: string;
    changed?: string;
    /** Its height to its width: `7:10`. */
    ratio?: string;
    /** Its colours, by their names. */
    colours?: { es: string[]; en: string[] };
    called?: Said;
    by?: SaidIn;
    text?: { es: string[]; en: string[] };
    /** How the page of Wikipedia of the flag (`readFlag`) begins: what is shown of it while nobody has written `text`. */
    lead?: ProfileLead;
    /** What each part of it means: its name and what is said of it. */
    parts?: { es: [string, string]; en: [string, string] }[];
  };
  /** The oldest first; the last is the flag of today. A sheet that tells nothing of them shows the flags the game has (`flownCards`). */
  times?: ProfileTime[];
  /** The first is the one at the head of the sheet. */
  photos?: ProfilePhoto[];
  /** Its coat of arms. A territory that flies the flag of its country shows none. */
  arms?: ProfileArms;
  /** Where to read more: its page in the Wikipedia of each language, and that of its flag. */
  read?: SaidIn;
  readFlag?: SaidIn;
}

/** Whether a country has a sheet: every one that has a flag to open it from. */
export const hasProfile = (country: Pick<Country, 'fl'> | null | undefined): boolean => !!country?.fl;

export const loadProfile = (id: string): Promise<ProfileFile> => loadFile<ProfileFile>(`profiles/${id}.json`);

/** Where a picture of a photograph is served from. */
export const photoSrc = (file: string, width: number, base: string = import.meta.env.BASE_URL): string => `${base}photos/${file}-${width}.webp`;
/** Every picture of a photograph with its width, for the browser to choose from. */
export const photoSet = (photo: Pick<ProfilePhoto, 'file' | 'sizes'>, base?: string): string => photo.sizes.map((w) => `${photoSrc(photo.file, w, base)} ${w}w`).join(', ');

const COUNTRIES_WORD = /^(paises|countries)$/i;

/** What follows `banderas/` in the address of the sheet of a country: the page of the countries of the gallery, and the country. */
export const profileRest = (id: string): string => `paises/${id}`;

/**
 * The country whose sheet an address of the gallery asks for; none when it names none, or one that has no
 * sheet (`has` says which do: those of the game that have a flag).
 */
export function profileIn(rest: string, has: (id: string) => boolean): string | null {
  const [word = '', code = '', more] = rest.split('/');
  if (more !== undefined || !COUNTRIES_WORD.test(word) || !/^[a-z0-9]{2}$/i.test(code)) return null;
  const id = code.toUpperCase();
  return has(id) ? id : null;
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
export function timeCards(profile: Pick<ProfileFile, 'id' | 'times'>, file: FlagsFile, index: Index, base?: string): (FlagCard | null)[] {
  const past = pastFlags(file, index, base).filter((card) => card.id === profile.id);
  const gone = goneFlags(file, base);
  const now = countryFlags(index, base).find((card) => card.id === profile.id) ?? null;
  return (profile.times ?? []).map((time) => {
    if (time.now) return now;
    if (time.gone) return gone.find((card) => card.id === time.gone) ?? null;
    return past.find((card) => card.years?.[0] === time.past?.[0] && card.years?.[1] === time.past?.[1]) ?? null;
  });
}

/**
 * The flags a country flew before the one it flies, as the game has them, the oldest first: what a sheet
 * that tells nothing of its times shows of them. One whose first year is not known comes before the rest.
 */
export function flownCards(id: string, file: FlagsFile, index: Index, base?: string): FlagCard[] {
  return pastFlags(file, index, base)
    .filter((card) => card.id === id)
    .sort((a, b) => (a.years?.[0] ?? 0) - (b.years?.[0] ?? 0) || (a.years?.[1] ?? 0) - (b.years?.[1] ?? 0));
}

/** The year of a day of a sheet, which may be a year alone: `1889-11-19` and `1889` are both 1889. */
export const yearOfDay = (text: string): number | null => (/^\d{4}(-\d{2}-\d{2})?$/.test(text) ? Number(text.slice(0, 4)) : null);

/** How a day is written in a sheet: `1889-11-19`. */
export const isDay = (text: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(`${text}T00:00:00Z`));

/**
 * Whom a country borders, of those the game has, by their name in the language of the game: the game keeps
 * them by their code, which is no order to read them in (PE before PY, «Perú» before «Paraguay»).
 */
export function neighboursOf(country: Pick<Country, 'nb'>, byId: ReadonlyMap<string, Pick<Country, 'n'>>): string[] {
  const name = (id: string): string => nm(byId.get(id)!.n);
  return (country.nb ?? []).filter((id) => byId.has(id)).sort((a, b) => name(a).localeCompare(name(b), getLang()));
}

/**
 * How many a country borders, as the heading over them says it: countries, territories or both, and one
 * alone by what it is («Limita con un país»).
 */
export function bordersText(states: number, territories: number): string {
  const n = states + territories;
  if (n === 1) return territories ? L('Limita con un territorio', 'Borders one territory') : L('Limita con un país', 'Borders one country');
  if (!territories) return L(`Limita con ${nf(n)} países`, `Borders ${nf(n)} countries`);
  if (!states) return L(`Limita con ${nf(n)} territorios`, `Borders ${nf(n)} territories`);
  return L(`Limita con ${nf(n)} países y territorios`, `Borders ${nf(n)} countries and territories`);
}

/**
 * Whose flags a sheet shows in a row: those of the divisions of the country, all of them or as many as the
 * game has a flag of («Las de 43 de sus 52 provincias»), so that nobody takes the ones shown for all there are.
 */
export function regionsText(shown: number, level: { n: number; es: string; en: string } | undefined): string {
  const [es, en] = level ? [level.es, level.en] : ['regiones', 'regions'];
  if (!level || shown >= level.n) return L(`Las de sus ${nf(shown)} ${es}`, `Those of its ${nf(shown)} ${en}`);
  return L(`${shown === 1 ? 'La' : 'Las'} de ${nf(shown)} de sus ${nf(level.n)} ${es}`, `${shown === 1 ? 'That' : 'Those'} of ${nf(shown)} of its ${nf(level.n)} ${en}`);
}

/** What leads to the flags of the towns of a country: of how many, or of its capital when that is the only one. */
export function townsText(towns: readonly Pick<FlagCard, 'kind'>[]): string {
  if (towns.length === 1) return towns[0].kind === 'capital' ? L('Ver la de su capital', 'See that of its capital') : L('Ver la de una ciudad', 'See that of one city');
  return L(`Ver las de ${nf(towns.length)} ciudades`, `See those of ${nf(towns.length)} cities`);
}
