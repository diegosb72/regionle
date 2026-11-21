/**
 * The ghost of a map: the best game played on it, kept question by question — how each one went and when it
 * was settled — so that the same questions can be played again with that game moving alongside («Contra tu
 * fantasma»). Here, what a ghost is made of, which games share one and how two games are told apart; where
 * they are kept is lib/ghostKept.ts, and what is drawn of them games/Ghost.tsx.
 *
 * A ghost is of a game on a map with the options that change what is asked: two games that differ in any of
 * them (four options or typing, ten questions or all) have a ghost each.
 */
import { scoreOf } from '../games/quiz';
import { ghostable } from './ghostLazy';
import { asksByFlag, turnsOutlines } from './rules';
import type { GameConfig } from './store';
import { hashStr } from './text';
import type { Country, Mode, Res } from './types';
import { levelOf } from './world';

export interface Ghost {
  /** The seed its questions were dealt with: the same seed deals them again. */
  k: number;
  /** What those questions were, as one figure (`sumOf`): a map that has changed since deals others to the same seed. */
  h: number;
  /** When it was played. */
  t: number;
  /**
   * A figure for each question, in order: the tenths of a second it took since the one before was settled,
   * times three, plus how it went (0 right at the first go, 1 right with help, 2 missed).
   */
  q: number[];
  /** How long the whole game took, in tenths of a second: the round of misses that follows the last question is part of it. */
  d: number;
}

/** A ghost with the name of the game it is of (`ghostKey`). */
export type Kept = [key: string, ghost: Ghost];

/** How many are kept: those of the games played latest. */
export const GHOSTS_KEPT = 40;
/** The longest game a ghost is kept of: a map with more questions than this is played without one. */
export const GHOST_QUESTIONS = 400;
/** The longest a question can be said to have taken, in tenths of a second: a week. */
const WAIT_MAX = 6_048_000;
/** …and the longest a game can: every question of the longest game, at that. */
const GAME_MAX = WAIT_MAX * GHOST_QUESTIONS;

const RES: readonly Res[] = ['ok', 'warn', 'bad'];

/** Games answered on the map, whatever the player has chosen between four options and typing. */
const CLICKED: readonly Mode[] = ['pin', 'puzzle', 'listen'];

/**
 * The name the ghost of a game is kept under, or null when the game has none (`ghostable`): the game, the
 * map and the options that change what is asked or how it is answered, and nothing of how one likes to
 * play. `country` gives a country by its code: the level a map of regions is played at is said by the map
 * itself, so that a game that does not say it and one that does share their ghost.
 */
export function ghostKey(cfg: Omit<GameConfig, 'nonce'>, country: (id: string) => Country | undefined): string | null {
  if (!ghostable(cfg)) return null;
  const { section, mode, opts } = cfg;
  const ids = [...new Set(cfg.countries)].sort();
  const level = (id: string): string => {
    const c = country(id);
    return c ? levelOf(c, cfg.levels).k : (cfg.levels[id] ?? '');
  };
  const pinBy = section === 'countries' && mode === 'pin' ? opts.pinBy : 'name';
  const parts = [
    section === 'regions' ? ids.map((id) => `${id}.${level(id)}`).join(',') : ids.join(','),
    section === 'cities' ? `${opts.cityPick}${opts.cityPick === 'top' ? opts.cityCount : ''}` : '',
    pinBy,
    CLICKED.includes(mode) ? '' : opts.answer,
    // A list is asked whole, whatever the number of questions chosen for the other games.
    cfg.list ? 'all' : String(opts.length),
    turnsOutlines(section, mode) && opts.turned ? 'turned' : '',
    asksByFlag(section, mode, { pinBy }) ? (opts.flagLook ?? 'plain') : 'plain',
    cfg.list ? [...new Set(cfg.only)].sort().join(',') : '',
  ];
  return `${section}|${mode}|${hashStr(parts.join('|')).toString(36)}`;
}

/** The questions of a game, each a word and in order, as one figure. */
export const sumOf = (dealt: readonly string[]): number => hashStr(dealt.join('|'));

/** What a game writes down as it goes: when each question was settled, in milliseconds of its clock, and how. */
export type Trace = readonly (readonly [ms: number, res: Res])[];

/**
 * The ghost a finished game leaves: null when it was not played to the end (one answer for each question
 * dealt), or is too long for one to be kept. `ms` is what its clock said when it ended.
 */
export function ghostFrom(seed: number, dealt: readonly string[], trace: Trace, ms: number, now: number): Ghost | null {
  const n = trace.length;
  if (!n || n !== dealt.length || n > GHOST_QUESTIONS) return null;
  const q: number[] = [];
  let at = 0;
  for (const [when, res] of trace) {
    // Tenths counted from the start, so that what is cut off in one question is not carried into the next.
    const tenth = Math.min(at + WAIT_MAX, Math.max(at, Math.floor(when / 100)));
    q.push((tenth - at) * 3 + RES.indexOf(res));
    at = tenth;
  }
  // The tenths the clock had gone through, and not the nearest one: a game of 20,96 s is one of 0:20 wherever
  // its time is shown, and here too.
  return { k: seed, h: sumOf(dealt), t: now, q, d: Math.min(GAME_MAX, Math.max(at, Math.floor(ms / 100))) };
}

/** A ghost read out: what a game adds up to, and where it was at each moment. */
export interface Run {
  /** How each question went, in order, and the moment it was settled, in milliseconds from the start. */
  res: Res[];
  at: number[];
  ok: number;
  warn: number;
  bad: number;
  /** The score, 0 to 100, as every game gives it. */
  score: number;
  /** How long the game took, to its end. */
  ms: number;
}

export function runOf(ghost: Pick<Ghost, 'q' | 'd'>): Run {
  const run: Run = { res: [], at: [], ok: 0, warn: 0, bad: 0, score: 0, ms: 0 };
  let tenths = 0;
  for (const v of ghost.q) {
    const res = RES[v % 3];
    tenths += Math.floor(v / 3);
    run.res.push(res);
    run.at.push(tenths * 100);
    run[res]++;
  }
  run.score = scoreOf(run.ok, run.warn, run.res.length);
  // A game cannot have ended before its last question was settled.
  run.ms = Math.max(ghost.d, tenths) * 100;
  return run;
}

/** How many questions a game had settled when its clock said `ms`. */
export function passed(run: Pick<Run, 'at'>, ms: number): number {
  let n = 0;
  while (n < run.at.length && run.at[n] <= ms) n++;
  return n;
}

/**
 * Which of two games is the better: the one with the higher score and, with the same score, the one that
 * took less time, by the second, which is what the clock shows. 1 when it is the first, -1 when it is the
 * second, 0 when there is nothing between them.
 */
export function versus(a: Pick<Run, 'score' | 'ms'>, b: Pick<Run, 'score' | 'ms'>): 1 | 0 | -1 {
  if (a.score !== b.score) return a.score > b.score ? 1 : -1;
  const [mine, theirs] = [Math.floor(a.ms / 1000), Math.floor(b.ms / 1000)];
  return mine === theirs ? 0 : mine < theirs ? 1 : -1;
}

const whole = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;

/** Whether something read from the browser, or from a copy, is a ghost. */
export function isGhost(x: unknown): x is Ghost {
  const g = x as Partial<Ghost> | null;
  return (
    !!g &&
    typeof g === 'object' &&
    whole(g.k, 0xffffffff) &&
    whole(g.h, 0xffffffff) &&
    whole(g.t, 1e15) &&
    g.t > 0 &&
    Array.isArray(g.q) &&
    g.q.length > 0 &&
    g.q.length <= GHOST_QUESTIONS &&
    g.q.every((v) => whole(v, WAIT_MAX * 3 + 2)) &&
    whole(g.d, GAME_MAX)
  );
}

const isKey = (x: unknown): x is string => typeof x === 'string' && /^[a-z]{2,12}\|[a-z]{2,12}\|[0-9a-z]{1,8}$/.test(x);

/** What the browser or a copy holds, with only what is a ghost under the name of a game: one for each game, and the first ones of those. */
export function cleanGhosts(raw: unknown): Kept[] {
  if (!Array.isArray(raw)) return [];
  const out: Kept[] = [];
  const seen = new Set<string>();
  for (const pair of raw) {
    if (out.length >= GHOSTS_KEPT) break;
    if (!Array.isArray(pair) || !isKey(pair[0]) || seen.has(pair[0]) || !isGhost(pair[1])) continue;
    seen.add(pair[0]);
    const { k, h, t, q, d } = pair[1];
    out.push([pair[0], { k, h, t, q: [...q], d }]);
  }
  return out;
}

/**
 * The list once a game of `key` has ended. Its ghost goes first, since the ones kept are those of the games
 * played latest; and `mine`, the ghost that game leaves, takes its place when it is the better one or
 * there was none. `stale` says that the ghost that was kept is of questions the map no longer deals: it can
 * be played against no more, and goes whatever the game was like.
 */
export function withGhost(list: readonly Kept[], key: string, mine: Ghost | null, stale = false): Kept[] {
  const had = stale ? null : (list.find(([k]) => k === key)?.[1] ?? null);
  const next = mine && (!had || versus(runOf(mine), runOf(had)) > 0) ? mine : had;
  const rest = list.filter(([k]) => k !== key);
  return next ? [[key, next] as Kept, ...rest].slice(0, GHOSTS_KEPT) : rest;
}
