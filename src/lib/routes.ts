/**
 * The addresses of the game: what comes after `#/` and which screen each one is. Nothing here touches the
 * browser, so that it can be tested as it is.
 */
import { dayNumber, isDate } from '../daily/spec';
import { mapLinkRest, parseMapLink, type MapLink } from './maplink';
import { LANG_PAGE, SCREENS, pageNamed, type ScreenId, type SeoLang } from './seo';
import { today } from './text';
import type { Section } from './types';

/** Address of each section; the same in every language, so that links keep working. Each one has its page too (`seo.ts`). */
export const PATHS: Record<Section, ScreenId> = { regions: 'regiones', countries: 'paises', cities: 'ciudades', physical: 'fisica', pops: 'poblaciones' };

export const PLAY_PATH = 'jugar';
export const DAILY_PATH = 'reto' satisfies ScreenId;
export const DUEL_PATH = 'duelo';
export const LIST_PATH = 'lista';
export const PROGRESS_PATH = 'progreso';
export const SETTINGS_PATH = 'configuracion';
export const ABOUT_PATH = 'acerca' satisfies ScreenId;

export type Route =
  | { kind: 'home' }
  /** `#/regiones`, or `#/regiones/ES:p/capital`: the section with a map and a game already chosen (`maplink.ts`). */
  | { kind: 'section'; section: Section; link?: MapLink }
  | { kind: 'play' }
  /**
   * `#/reto` is today's challenge; `#/reto/2026-11-10`, a past one. What follows the date (`vs`) is the
   * result of whoever sent the link, to set beside one's own. A link for a day that has not come here yet
   * (sent from where it is already tomorrow) opens today's and says which day it was for (`soon`).
   */
  | { kind: 'daily'; date: string; vs?: string; soon?: string }
  /** `#/duelo/<code>`: a game sent by someone else. Without a code, the screen that says how one is sent. */
  | { kind: 'duel'; code: string }
  /** `#/lista/<code>`: a custom list sent by someone else. Without a code, the screen that says how one is made. */
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
  if (section) {
    if (!rest) return { kind: 'section', section };
    const link = parseMapLink(section, rest);
    return link ? { kind: 'section', section, link } : { kind: 'unknown', path };
  }
  switch (head) {
    case PLAY_PATH:
      return rest ? { kind: 'unknown', path } : { kind: 'play' };
    case DAILY_PATH: {
      const slash = rest.indexOf('/');
      const day = slash < 0 ? rest : rest.slice(0, slash);
      const vs = slash < 0 ? '' : rest.slice(slash + 1);
      // A date that is not one, or a day that has not come: today's challenge.
      if (!isDate(day) || dayNumber(day) < 0) return { kind: 'daily', date: now };
      if (day > now) return vs ? { kind: 'daily', date: now, soon: day } : { kind: 'daily', date: now };
      return vs ? { kind: 'daily', date: day, vs } : { kind: 'daily', date: day };
    }
    case DUEL_PATH:
      return { kind: 'duel', code: rest };
    case LIST_PATH:
      return { kind: 'list', code: rest };
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

/** The page an address is of, by the name its last part has: `…/en.html`, `…/regions`. Null for the first page. */
const pageAt = (pathname: string) => pageNamed(/\/([a-z]+)(?:\.html)?$/.exec(pathname)?.[1] ?? '');

/**
 * The language a page is written for: `…/en.html` is the game in English and `…/es.html` in Spanish, and
 * so is the page of each screen (`…/regions.html`, `…/regiones.html`).
 */
export function pageLang(pathname: string): SeoLang | null {
  const page = pageAt(pathname);
  return page ? (typeof page === 'string' ? page : page.lang) : null;
}

/** The screen a page opens when nothing comes after `#`, as its address in the game: `…/regions.html` is `regiones`. */
export function pageScreen(pathname: string): ScreenId | null {
  const page = pageAt(pathname);
  return page && typeof page !== 'string' ? page.screen : null;
}

/** The page of a screen in a language, as a link from any page of the site: `regions.html`. */
export const screenPage = (screen: ScreenId, lang: SeoLang): string => `${SCREENS[screen][lang].file}.html`;

/** The page of a language, as a link from any page of the site: `en.html`. */
export const langPage = (lang: SeoLang): string => LANG_PAGE[lang];

/**
 * Where the game lives, without anything after it: the links that are sent to others start here. The
 * page of one language or of one screen is left out of them, so that they open in the language of whoever
 * gets them.
 */
export function siteRoot(href: string = typeof location === 'undefined' ? '' : location.href): string {
  if (!href) return '';
  try {
    const url = new URL(href);
    url.hash = '';
    url.search = '';
    if (pageAt(url.pathname)) url.pathname = url.pathname.replace(/[^/]+$/, '');
    return url.href;
  } catch {
    return href.split(/[?#]/)[0];
  }
}

/** The whole address of a screen, to be sent to someone. */
export function linkTo(path: string, href?: string): string {
  return `${siteRoot(href)}#/${path}`;
}

/** The whole address of a section with a map and a game chosen, to be sent to someone or kept as a bookmark. */
export function mapLinkUrl(section: Section, link: MapLink, href?: string): string {
  return linkTo(`${PATHS[section]}/${mapLinkRest(section, link)}`, href);
}
