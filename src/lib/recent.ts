/**
 * The maps played lately, kept so that the first page can offer them again. A session only says what a
 * game was called; this keeps what it takes to start it: which countries, at which level, in which game.
 */
import { PATHS } from './routes';
import { FORMAT_MODES } from './rules';
import type { GameConfig, Opts, SessionRec } from './store';
import type { Mode, Section } from './types';

/**
 * The options that say which game it was, as against how one likes to play: which cities, which figure,
 * what countries are pinned by, against the clock or with lives.
 */
export type RecentOpts = Partial<Pick<Opts, 'cityPick' | 'cityCount' | 'metric' | 'pinBy' | 'format' | 'axis' | 'countdown'>>;

export interface Recent {
  /** When it was last played. */
  t: number;
  section: Section;
  mode: Mode;
  /** Countries, or the tokens of a physical map. */
  countries: string[];
  levels: Record<string, string>;
  o: RecentOpts;
  /** How it went that time: right first time, of how many. */
  ok: number;
  total: number;
}

/** How many are kept: the first page shows a handful. */
export const RECENT_MAX = 6;

/** The options that tell one game from another on the same map; each is kept only where it counts. */
function optsOf(game: GameConfig): RecentOpts {
  const o: RecentOpts = {};
  if (game.section === 'cities') {
    o.cityPick = game.opts.cityPick;
    if (game.opts.cityPick === 'top') o.cityCount = game.opts.cityCount;
  }
  // The figure is the game where there is a choice of them; statements that are true or false are about them all.
  if (game.section === 'pops' && game.mode !== 'truefalse') o.metric = game.opts.metric;
  if (game.mode === 'compass') o.axis = game.opts.axis ?? 'ns';
  if (game.mode === 'nameall' && game.opts.countdown > 0) o.countdown = game.opts.countdown;
  if (game.section === 'countries' && game.mode === 'pin') o.pinBy = game.opts.pinBy;
  if (FORMAT_MODES.includes(game.mode)) o.format = game.opts.format ?? 'normal';
  return o;
}

/**
 * What is kept of a game that has just ended, or null when it is not one to come back to: a review, a
 * challenge received, a round of only what was missed and a custom list are offered elsewhere, each with
 * what is current, and the editor of lists is not a game.
 */
export function recentOf(game: GameConfig, rec: SessionRec): Recent | null {
  if (game.review || game.daily || game.challenge || game.only || game.list || game.listId || game.mode === 'edit') return null;
  if (game.section !== rec.section || game.mode !== rec.mode || !game.countries.length) return null;
  // Levels are those of the regions of a country: the other maps are the same whatever they say.
  const levels: Record<string, string> = {};
  if (game.section === 'regions') for (const id of game.countries) if (game.levels[id]) levels[id] = game.levels[id];
  return { t: rec.t, section: game.section, mode: game.mode, countries: [...game.countries], levels, o: optsOf(game), ok: rec.ok, total: rec.total };
}

/** Two games are the same one when they are the same game on the same map, whatever the order of its countries. */
export function recentKey(r: Recent): string {
  const countries = [...r.countries].sort();
  return [r.section, r.mode, countries.join(','), countries.map((id) => r.levels[id] ?? '').join(','), ...Object.keys(r.o).sort().map((k) => `${k}=${String(r.o[k as keyof RecentOpts])}`)].join('|');
}

/** The list with a game put first; one played again moves up instead of showing twice. */
export function withRecent(list: readonly Recent[], r: Recent, max = RECENT_MAX): Recent[] {
  const key = recentKey(r);
  return [r, ...list.filter((x) => recentKey(x) !== key)].slice(0, max);
}

/** The game to start again: the map and what made it that game, with today's taste for the rest. */
export function recentConfig(r: Recent, opts: Opts): Omit<GameConfig, 'nonce'> {
  return { section: r.section, mode: r.mode, countries: [...r.countries], levels: { ...r.levels }, opts: { ...opts, ...r.o } };
}

/** Whether something read from storage is one of these: what an older or a broken copy holds is dropped. */
export function isRecent(x: unknown): x is Recent {
  const r = x as Partial<Recent> | null;
  return (
    !!r &&
    typeof r === 'object' &&
    typeof r.t === 'number' &&
    typeof r.section === 'string' &&
    Object.hasOwn(PATHS, r.section) &&
    typeof r.mode === 'string' &&
    Array.isArray(r.countries) &&
    r.countries.length > 0 &&
    r.countries.every((id) => typeof id === 'string') &&
    !!r.levels &&
    typeof r.levels === 'object' &&
    !!r.o &&
    typeof r.o === 'object' &&
    typeof r.ok === 'number' &&
    typeof r.total === 'number'
  );
}
