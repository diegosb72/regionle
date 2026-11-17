/**
 * The addresses of the game: what comes after `#/` and which screen each one is. Nothing here touches the
 * browser, so that it can be tested as it is.
 */
import { dayNumber, isDate } from '../daily/spec';
import { today } from './text';
import type { Section } from './types';

/** Address of each section; the same in every language, so that links keep working. */
export const PATHS: Record<Section, string> = { regions: 'regiones', countries: 'paises', cities: 'ciudades', physical: 'fisica', pops: 'poblaciones' };

export const PLAY_PATH = 'jugar';
export const DAILY_PATH = 'reto';
export const DUEL_PATH = 'duelo';
export const LIST_PATH = 'lista';
export const PROGRESS_PATH = 'progreso';
export const SETTINGS_PATH = 'configuracion';
export const ABOUT_PATH = 'acerca';

export type Route =
  | { kind: 'home' }
  | { kind: 'section'; section: Section }
  | { kind: 'play' }
  /** `#/reto` is today's challenge; `#/reto/2026-11-10`, a past one. */
  | { kind: 'daily'; date: string }
  /** `#/duelo/<code>`: a game sent by someone else. */
  | { kind: 'duel'; code: string }
  /** `#/lista/<code>`: a custom list sent by someone else. */
  | { kind: 'list'; code: string }
  | { kind: 'progress' }
  /** `#/configuracion`, or `#/configuracion/regiones/US` to open the settings on a list. */
  | { kind: 'settings'; path: string }
  | { kind: 'about' }
  /** An address that is nothing: said so, instead of showing the first page as if it had been asked for. */
  | { kind: 'unknown'; path: string };

/**
 * Other ways of writing the first part of an address: the name the section has on screen ("Cifras" lives
 * at `poblaciones`), its English name, a singular, a likely slip. Each one is sent to the address it means.
 */
const ALIASES: Record<string, string> = {
  inicio: '',
  home: '',
  index: '',
  regions: PATHS.regions,
  region: PATHS.regions,
  provincias: PATHS.regions,
  countries: PATHS.countries,
  pais: PATHS.countries,
  cities: PATHS.cities,
  ciudad: PATHS.cities,
  fisico: PATHS.physical,
  physical: PATHS.physical,
  geografiafisica: PATHS.physical,
  poblacion: PATHS.pops,
  cifras: PATHS.pops,
  cifra: PATHS.pops,
  figuras: PATHS.pops,
  figures: PATHS.pops,
  population: PATHS.pops,
  play: PLAY_PATH,
  partida: PLAY_PATH,
  daily: DAILY_PATH,
  challenge: DAILY_PATH,
  diario: DAILY_PATH,
  retodiario: DAILY_PATH,
  duel: DUEL_PATH,
  list: LIST_PATH,
  progress: PROGRESS_PATH,
  settings: SETTINGS_PATH,
  ajustes: SETTINGS_PATH,
  config: SETTINGS_PATH,
  about: ABOUT_PATH,
  acercade: ABOUT_PATH,
  licencia: ABOUT_PATH,
  licencias: ABOUT_PATH,
  licenses: ABOUT_PATH,
  privacidad: ABOUT_PATH,
  privacy: ABOUT_PATH,
};

const KNOWN = new Set<string>(['', ...Object.values(PATHS), PLAY_PATH, DAILY_PATH, DUEL_PATH, LIST_PATH, PROGRESS_PATH, SETTINGS_PATH, ABOUT_PATH]);

function decoded(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * An address as the game writes it: no slashes at either end, and its first part in small letters,
 * without accents and under its own name ("Física/" and "fisico" are `fisica`). What follows the first
 * part is kept as it comes: the codes of a duel or of a list tell capitals from small letters.
 */
export function canonicalPath(raw: string): string {
  const path = raw.split('?')[0].replace(/^\/+|\/+$/g, '');
  if (!path) return '';
  const cut = path.indexOf('/');
  const head = cut < 0 ? path : path.slice(0, cut);
  const rest = cut < 0 ? '' : path.slice(cut).replace(/\/+$/, '');
  // "Geografía-Física" → "geografiafisica".
  const plain = decoded(head)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]/g, '');
  const name = KNOWN.has(plain) ? plain : (ALIASES[plain] ?? head);
  return name ? `${name}${rest}` : rest.replace(/^\/+/, '');
}

/** The screen an address stands for. `now` is today's date, which decides which daily challenges exist. */
export function routeOf(path: string, now: string = today()): Route {
  if (!path) return { kind: 'home' };
  const cut = path.indexOf('/');
  const head = cut < 0 ? path : path.slice(0, cut);
  const rest = cut < 0 ? '' : path.slice(cut + 1);
  const section = (Object.keys(PATHS) as Section[]).find((s) => PATHS[s] === head);
  if (section) return rest ? { kind: 'unknown', path } : { kind: 'section', section };
  switch (head) {
    case PLAY_PATH:
      return rest ? { kind: 'unknown', path } : { kind: 'play' };
    case DAILY_PATH:
      // A date that is not one, or a day that has not come: today's challenge.
      return { kind: 'daily', date: isDate(rest) && dayNumber(rest) >= 0 && rest <= now ? rest : now };
    case DUEL_PATH:
      return rest ? { kind: 'duel', code: rest } : { kind: 'unknown', path };
    case LIST_PATH:
      return rest ? { kind: 'list', code: rest } : { kind: 'unknown', path };
    case PROGRESS_PATH:
      return rest ? { kind: 'unknown', path } : { kind: 'progress' };
    case SETTINGS_PATH:
      return { kind: 'settings', path: rest };
    case ABOUT_PATH:
      return { kind: 'about' };
    default:
      return { kind: 'unknown', path };
  }
}

/** The language a page is written for: `…/en.html` is the game in English, `…/es.html` in Spanish. */
export function pageLang(pathname: string): 'es' | 'en' | null {
  const m = /\/(es|en)(?:\.html)?$/.exec(pathname);
  return m ? (m[1] as 'es' | 'en') : null;
}

/**
 * Where the game lives, without anything after it: the links that are sent to others start here. The
 * page of one language is left out of them, so that they open in the language of whoever gets them.
 */
export function siteRoot(href: string = typeof location === 'undefined' ? '' : location.href): string {
  if (!href) return '';
  try {
    const url = new URL(href);
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/(es|en)(?:\.html)?$/, '/');
    return url.href;
  } catch {
    return href.split(/[?#]/)[0];
  }
}

/** The whole address of a screen, to be sent to someone. */
export function linkTo(path: string, href?: string): string {
  return `${siteRoot(href)}#/${path}`;
}
