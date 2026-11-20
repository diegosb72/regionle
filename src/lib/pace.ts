/**
 * How long a game takes and how hard it is for this player, said with what the games played tell:
 * the label of a mode (easy, medium, hard) is the same for everyone, and this is not.
 */
import { FORMAT_MODES, LENGTH_MODES, MADE_UP_MODES, ROUND_MODES } from './rules';
import type { Format, Length, SessionRec } from './store';
import type { Mode, Section } from './types';

export interface Pace {
  /** Games of this mode in this section among the ones remembered. */
  games: number;
  /** Milliseconds a question takes this player; null without games. */
  perQuestion: number | null;
  /** Milliseconds a whole game has taken, on average; null without games. */
  perGame: number | null;
  /** Share of the questions answered right first time, 0 to 1; null without games. */
  first: number | null;
}

/** What the remembered games of a mode in a section say. Games without questions say nothing. */
export function paceOf(sessions: readonly SessionRec[], section: Section, mode: Mode): Pace {
  let games = 0;
  let asked = 0;
  let ok = 0;
  let ms = 0;
  for (const s of sessions) {
    if (s.section !== section || s.mode !== mode || !(s.total > 0)) continue;
    games += 1;
    asked += s.total;
    ok += s.ok;
    ms += s.ms > 0 ? s.ms : 0;
  }
  if (!games) return { games: 0, perQuestion: null, perGame: null, first: null };
  return { games, perQuestion: ms > 0 ? ms / asked : null, perGame: ms > 0 ? ms / games : null, first: Math.min(1, ok / asked) };
}

/**
 * Seconds a question takes someone who has not played the mode yet: round figures, there to give an
 * idea of the size of a game. They give way to the player's own pace after the first game.
 */
export const TYPICAL_S: Partial<Record<Mode, number>> = {
  pin: 7,
  identify: 8,
  outline: 9,
  puzzle: 8,
  capital: 8,
  flag: 7,
  blind: 9,
  hotcold: 20,
  bearing: 10,
  coords: 12,
  group: 25,
  whoami: 30,
  border: 9,
  nameall: 5,
  which: 6,
  exact: 15,
  rank: 30,
  compass: 30,
  parent: 7,
  truefalse: 5,
  oddone: 9,
  cards: 5,
  mix: 8,
  listen: 8,
  neighbours: 40,
  regionle: 45,
};

/** A round of "Ordenar" when no number is chosen. */
const RANK_ROUNDS = 10;
/** Statements of "true or false", or questions of "the odd one out", when no number is chosen. */
export const TRUE_FALSE_ROUND = 20;

export interface GameSize {
  mode: Mode;
  /** Things the map holds: regions, countries, cities… */
  units: number;
  length: Length;
  format: Format;
  /** The game is played on a list of the player: it is asked whole. */
  list?: boolean;
}

/** How many questions the game will ask, or null when it has no fixed number (endless, lessons, routes, a clock). */
export function questionsOf({ mode, units, length, format, list }: GameSize): number | null {
  if (units <= 0) return null;
  if (mode === 'nameall') return units;
  if (!LENGTH_MODES.includes(mode)) return null;
  // Against the clock or with lives a game lasts what it lasts; an exam has its questions counted.
  if ((format === 'timed' || format === 'lives') && FORMAT_MODES.includes(mode)) return null;
  if (list) return units;
  if (ROUND_MODES.includes(mode)) return length === 'all' ? RANK_ROUNDS : length === 'endless' ? null : length;
  // Statements are made up as the game goes: as many as are asked for, whatever the countries chosen.
  if (MADE_UP_MODES.includes(mode)) return length === 'all' ? TRUE_FALSE_ROUND : length === 'endless' ? null : length;
  // An exam has an end even where "no end" was the choice for the other games.
  if (length === 'endless') return format === 'exam' && FORMAT_MODES.includes(mode) ? units : null;
  return length === 'all' ? units : Math.min(length, units);
}

export interface Estimate {
  ms: number;
  /** Worked out from the player's own games, not from the round figures. */
  own: boolean;
}

/** How long the game is expected to take; null when there is nothing to judge by. */
export function estimateOf(mode: Mode, questions: number | null, pace: Pace): Estimate | null {
  if (questions != null && questions > 0) {
    if (pace.perQuestion != null) return { ms: questions * pace.perQuestion, own: true };
    const typical = TYPICAL_S[mode];
    return typical ? { ms: questions * typical * 1000, own: false } : null;
  }
  // A game that counts questions and has none to count now is endless, or against the clock, or with
  // lives: it lasts what it lasts.
  if (LENGTH_MODES.includes(mode) || mode === 'nameall') return null;
  // Lessons, routes, higher or lower: what the player's games of the mode have lasted.
  return pace.perGame != null ? { ms: pace.perGame, own: true } : null;
}

/** Whole minutes, never fewer than one: an estimate is not said to the second. */
export function minutesOf(ms: number): number {
  return Math.max(1, Math.round(ms / 60_000));
}

/** The share right first time as a whole percentage. */
export function percentOf(share: number): number {
  return Math.round(Math.max(0, Math.min(1, share)) * 100);
}
