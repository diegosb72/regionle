/**
 * The addresses of the game: what comes after `#/` and which screen each one is. Nothing here touches the
 * browser, so that it can be tested as it is.
 */
import { dayNumber, isDate } from '../daily/spec';
import { mapLinkRest, parseMapLink, type MapLink } from './maplink';
import { LANG_PAGE, SCREENS, mapPageNamed, pageNamed, type ScreenId, type SeoLang } from './seo';
import { today } from './text';
import type { Section } from './types';

/** Address of each section; the same in every language, so that links keep working. Each one has its page too (`seo.ts`). */
export const PATHS: Record<Section, ScreenId> = { regions: 'regiones', countries: 'paises', cities: 'ciudades', physical: 'fisica', pops: 'poblaciones' };

export const PLAY_PATH = 'jugar';
export const DAILY_PATH = 'reto' satisfies ScreenId;
export const DUEL_PATH = 'duelo';
export const LIST_PATH = 'lista';
/** Homework with a receipt (lib/task.ts): what a teacher sets, and what whoever did it sends back. */
export const TASK_PATH = 'tarea';
export const RECEIPT_PATH = 'justificante';
/** The cards of a bingo (lib/bingo.ts): the one of a player, or a sheet of them to print. */
export const BINGO_PATH = 'bingo';
/** The game alone, to be put inside another page (lib/embed.ts). */
export const EMBED_PATH = 'incrustar';
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
  /** `#/tarea/<title>/<game>`: a map and a game set as homework. With nothing after it, the screen that says how one is set. */
  | { kind: 'task'; rest: string }
  /** `#/justificante/<code>`: how somebody did an assignment. Without a code, the receipts opened on this device. */
  | { kind: 'receipt'; code: string }
  /** `#/bingo/7/4/regiones/ES:p`: the card with that number, of that size, of the bingo of a map. With nothing after it, the screen that says how one is played. */
  | { kind: 'bingo'; rest: string }
  /**
   * `#/incrustar/regiones/ES:f/pin`: a map and a game with nothing around them, for an `<iframe>` in another
   * page. What follows is read where it is played (lib/embed.ts): this file is in the first load.
   */
  | { kind: 'embed'; rest: string }
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
  task: TASK_PATH,
  tareas: TASK_PATH,
  homework: TASK_PATH,
  receipt: RECEIPT_PATH,
  justificantes: RECEIPT_PATH,
  embed: EMBED_PATH,
  incrusta: EMBED_PATH,
  iframe: EMBED_PATH,
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

const KNOWN = new Set<string>(['', ...Object.values(PATHS), PLAY_PATH, DAILY_PATH, DUEL_PATH, LIST_PATH, TASK_PATH, RECEIPT_PATH, BINGO_PATH, EMBED_PATH, PROGRESS_PATH, SETTINGS_PATH, ABOUT_PATH]);

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
    case TASK_PATH:
      return { kind: 'task', rest };
    case RECEIPT_PATH:
      return { kind: 'receipt', code: rest };
    case BINGO_PATH:
      return { kind: 'bingo', rest };
    case EMBED_PATH:
      return { kind: 'embed', rest };
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

/**
 * The page an address is of, by the name its last part has: `…/en.html`, `…/regions`, `…/map-es-spain.html`.
 * Null for the first page.
 */
const pageAt = (pathname: string) => {
  const name = /\/([a-z0-9-]+)(?:\.html)?$/.exec(pathname)?.[1] ?? '';
  return pageNamed(name) ?? mapPageNamed(name);
};

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
  return page && typeof page !== 'string' && 'screen' in page ? page.screen : null;
}

/** The country whose map a page is of, and the language the page is written in (`…/map-es-spain.html`). Null for any other page. */
export function mapAt(pathname: string): { map: string; lang: SeoLang } | null {
  const page = pageAt(pathname);
  return page && typeof page !== 'string' && 'map' in page ? page : null;
}

/**
 * The address of the game that the page of a map opens when nothing comes after `#`: the regions of its
 * country, at their finest (`…/map-es-spain.html` is `regiones/ES:f`). Null for any other page.
 */
export function pageMap(pathname: string): string | null {
  const page = mapAt(pathname);
  return page ? `${PATHS.regions}/${page.map}:f` : null;
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
