/**
 * A game inside another page: `#/incrustar/regiones/ES:f/pin` is that map and that game with nothing around
 * them (no header, no menus), to be put in an `<iframe>` in a blog or in the page of a class.
 *
 *   #/incrustar/<section>/<map>[/<game>[/<cities>]][/<options>]
 *   #/incrustar/lista/<code>[/<game>][/<options>]
 *
 * The map and the game are written as in a link to a map (maplink.ts), and a custom list as in its own
 * link (lists.ts). The options are how the game was set where the address was made, so that whoever plays
 * it there gets the game its author chose: `answer=choice;length=all`. Only what differs from how a game
 * opens for someone new is written, and what is not written is how it opens for someone new: the options
 * of whoever plays are not asked.
 */
import { cleanOpts } from './backup';
import { countriesOf, describeMap } from './describe';
import { L } from './i18n';
import { decodeList, listConfig, listPlayable } from './lists';
import { mapLinkRest, parseMapLink, type MapLink } from './maplink';
import { MODES, type ModeDef } from './modes';
import { PHYS_KINDS } from './phys';
import { EMBED_PATH, LIST_PATH, PATHS, canonicalPath, langPage, siteRoot } from './routes';
import { embeddable } from './rules';
import { DEFAULT_OPTS, type GameConfig, type Opts } from './store';
import type { Mode, Section } from './types';
import { eligible, type World } from './world';

export type EmbedWhat = { kind: 'map'; section: Section; link: MapLink; opts: Opts } | { kind: 'list'; code: string; mode?: string; opts: Opts };

/** What is embedded, as the menus have it: a map and a game, or a list and a game. */
export type EmbedSource = { section: Section; link: MapLink } | { list: string; mode?: string };

/**
 * Options that are not the author's to give. The card of Wikipedia asks another site, which whoever visits
 * a page with a game in it has not been told about: there it is always off. Which cities are played is
 * written with the map.
 */
const NOT_SENT: readonly (keyof Opts)[] = ['wiki', 'cityPick', 'cityCount'];
const MODE = /^[a-z]{2,12}$/;

/** How a game opens inside another page when its address says nothing about it. */
export const EMBED_OPTS: Opts = { ...DEFAULT_OPTS, wiki: false };

/** The options of a game as an address carries them: only those that are not how a game opens. */
export function writeOpts(opts: Opts): string {
  const parts: string[] = [];
  for (const key of Object.keys(DEFAULT_OPTS) as (keyof Opts)[]) {
    if (NOT_SENT.includes(key)) continue;
    const value = opts[key];
    if (value == null || value === DEFAULT_OPTS[key]) continue;
    // A game of two is set up by the two who sit down to it: a box in another page is played as it comes.
    if (key === 'format' && value === 'duo') continue;
    parts.push(`${key}=${typeof value === 'boolean' ? (value ? '1' : '0') : String(value)}`);
  }
  return parts.join(';');
}

/** The options an address carries, each taken only if it is something that option can be. */
export function readOpts(text: string): Opts {
  const raw: Record<string, unknown> = {};
  for (const part of text.split(';')) {
    const cut = part.indexOf('=');
    if (cut < 1) continue;
    const key = part.slice(0, cut) as keyof Opts;
    const value = part.slice(cut + 1);
    if (!Object.hasOwn(DEFAULT_OPTS, key) || NOT_SENT.includes(key)) continue;
    raw[key] = typeof DEFAULT_OPTS[key] === 'boolean' ? (value === '1' ? true : value === '0' ? false : undefined) : /^\d{1,4}$/.test(value) ? Number(value) : value;
  }
  const opts = cleanOpts(raw, EMBED_OPTS);
  return opts.format === 'duo' ? { ...opts, format: EMBED_OPTS.format } : opts;
}

/** What follows `#/` in the address of a game inside another page. */
export function embedPath(source: EmbedSource, opts: Opts): string {
  const sent = writeOpts(opts);
  const body = 'list' in source ? `${LIST_PATH}/${source.list}${source.mode ? `/${source.mode}` : ''}` : `${PATHS[source.section]}/${mapLinkRest(source.section, source.link)}`;
  return `${EMBED_PATH}/${body}${sent ? `/${sent}` : ''}`;
}

/** What follows `incrustar/` in an address, read; null when it names neither a map nor a list. */
export function parseEmbed(rest: string): EmbedWhat | null {
  const parts = rest.split('/');
  if (parts.some((p) => !p)) return null;
  // The options are the only part with an equals sign: neither a map, nor a game, nor the code of a list has one.
  const opts = readOpts(parts.length > 1 && parts[parts.length - 1].includes('=') ? parts.pop()! : '');
  const [head, ...tail] = parts;
  if (!head || !tail.length) return null;
  const first = canonicalPath(head);
  if (first === LIST_PATH) {
    const [code, mode, ...more] = tail;
    if (more.length || (mode != null && !MODE.test(mode))) return null;
    return { kind: 'list', code, ...(mode ? { mode } : {}), opts };
  }
  const section = (Object.keys(PATHS) as Section[]).find((s) => PATHS[s] === first);
  if (!section) return null;
  const link = parseMapLink(section, tail.join('/'));
  return link ? { kind: 'map', section, link, opts } : null;
}

/** The whole address of a game inside another page, in a language: the page of that language, so that it is read in it by whoever has not chosen another. */
export function embedSrc(path: string, lang: 'es' | 'en', href?: string): string {
  return `${siteRoot(href)}${langPage(lang)}#/${path}`;
}

/** Heights, in pixels, that the box of a game can be asked to have; the width is that of where it is put. */
export const EMBED_HEIGHTS = [480, 640, 800] as const;
export type EmbedHeight = (typeof EMBED_HEIGHTS)[number];
export const EMBED_HEIGHT_DEFAULT: EmbedHeight = 640;

const attr = (text: string): string => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * What is pasted into the other page. The box may go full screen (the map has a button for it) and write to
 * the clipboard (the links a game gives to be sent), and is not fetched until the reader gets near it.
 */
export function embedCode(src: string, title: string, height: number): string {
  return `<iframe src="${attr(src)}" title="${attr(title)}" width="100%" height="${Math.round(height)}" style="border:0;max-width:100%" loading="lazy" allow="fullscreen; clipboard-write" allowfullscreen></iframe>`;
}

/** A game that an address asks for, checked against what the atlas has. */
export interface EmbedGame {
  cfg: Omit<GameConfig, 'nonce'>;
  /** The map in words, or the name of the list. */
  title: string;
  def: ModeDef;
  /** The same map and game in the whole of the game: what follows `#/`. */
  full: string;
}

/** The game of a section that an address names; the first of the section when it names none, or one that is not played. */
function modeOf(section: Section, id: string | undefined, ok: (mode: Mode) => boolean = () => true): ModeDef {
  const playable = MODES[section].filter((m) => embeddable(m.id) && ok(m.id));
  return playable.find((m) => m.id === id) ?? playable[0];
}

/**
 * The game an address asks for. An address can come from anywhere, and the atlas changes: only the
 * countries that exist and have something to play in that section are taken. Null when nothing is left.
 */
export function embedGame(what: EmbedWhat, world: World): EmbedGame | null {
  if (what.kind === 'list') {
    const list = decodeList(what.code);
    if (!list) return null;
    const countries = list.section === 'physical' ? list.countries : countriesOf(list, world).map((c) => c.id);
    if (!countries.length) return null;
    const def = modeOf(list.section, what.mode, listPlayable);
    return { cfg: listConfig({ ...list, countries }, def.id, what.opts), title: list.name || L('Lista sin nombre', 'Unnamed list'), def, full: `${LIST_PATH}/${what.code}` };
  }
  const { section, link } = what;
  const physical = section === 'physical';
  const ids = physical
    ? link.ids.filter((t) => !t.startsWith('in:') || world.byId.has(t.slice(3)))
    : link.ids.filter((id) => {
        const c = world.byId.get(id);
        return !!c && eligible(section, c);
      });
  if (physical ? !ids.some((t) => (PHYS_KINDS as readonly string[]).includes(t)) : !ids.length) return null;
  const levels = Object.fromEntries(Object.entries(link.levels).filter(([id, level]) => ids.includes(id) && world.byId.get(id)?.lv.some((l) => l.k === level)));
  const def = modeOf(section, link.mode);
  const cities = section === 'cities' && link.cityPick ? { cityPick: link.cityPick, ...(link.cityCount ? { cityCount: link.cityCount } : {}) } : {};
  const opts: Opts = { ...what.opts, ...cities };
  return {
    cfg: { section, mode: def.id, countries: ids, levels, opts },
    title: describeMap({ section, countries: ids, levels, cityPick: opts.cityPick, cityCount: opts.cityCount }, world),
    def,
    full: `${PATHS[section]}/${mapLinkRest(section, { ids, levels, mode: def.id, ...cities })}`,
  };
}
