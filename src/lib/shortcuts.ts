/**
 * Keys that work on any screen: 1 to 5 open a section, R the daily challenge, P the progress, T changes
 * the theme and ? shows them all. One key each, no modifier: they stand aside while something is being
 * typed, while a map holds the keyboard and during a game, and they can be turned off altogether.
 */
import { DAILY_PATH, PATHS, PROGRESS_PATH } from './routes';
import type { Section } from './types';

/** The sections in the order of the menu: the digit of each is its place in it. */
const ORDER: readonly Section[] = ['regions', 'countries', 'cities', 'physical', 'pops'];

export type Shortcut = { kind: 'go'; path: string } | { kind: 'theme' } | { kind: 'help' };

export interface KeyPress {
  /** `KeyboardEvent.key` */
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  /** The key goes into a field, a list of choices or a map that is being walked with the keyboard. */
  busy?: boolean;
  /** A game or the daily challenge is on screen: its keys are its own, and leaving it by accident costs the game. */
  playing?: boolean;
  /** The player has turned the one-key shortcuts off. */
  off?: boolean;
}

/** What a key does, or null when it is not a shortcut here and now. */
export function shortcutOf(press: KeyPress): Shortcut | null {
  if (press.off || press.busy || press.ctrl || press.meta || press.alt) return null;
  const key = press.key.length === 1 ? press.key.toLowerCase() : press.key;
  // The help takes nobody out of a game: it works during one too. A letter does not: an answer that is
  // typed with the field out of focus must not change the theme or the screen.
  if (key === '?') return { kind: 'help' };
  if (press.playing) return null;
  if (key === 't') return { kind: 'theme' };
  if (key >= '1' && key <= '5' && key.length === 1) return { kind: 'go', path: PATHS[ORDER[Number(key) - 1]] };
  if (key === 'r') return { kind: 'go', path: DAILY_PATH };
  if (key === 'p') return { kind: 'go', path: PROGRESS_PATH };
  return null;
}

/** The keys as they are listed in the help: what is written on each, and where it leads. */
export const SHORTCUT_KEYS = { sections: ORDER.map((section, i) => ({ key: String(i + 1), section })), daily: 'R', progress: 'P', theme: 'T', help: '?' } as const;
