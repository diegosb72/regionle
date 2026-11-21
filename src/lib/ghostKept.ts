/**
 * Where the ghosts (lib/ghost.ts) are kept: in the browser, under a name of their own. Apart from the rest of
 * what the game keeps, which is written again with every answer: a ghost is a figure for each question of a
 * game, and forty of them are a lot to write that often.
 */
import { useSyncExternalStore } from 'react';
import { cleanGhosts, withGhost, type Ghost, type Kept } from './ghost';
import { GHOSTS_KEY } from './ghostLazy';

/** What is kept, as it was last read or written; null until it is read, and when another tab has written it. */
let list: Kept[] | null = null;
const listeners = new Set<() => void>();

function read(): Kept[] {
  try {
    const raw = localStorage.getItem(GHOSTS_KEY);
    return raw ? cleanGhosts(JSON.parse(raw)) : [];
  } catch {
    // No storage, or something in it that is not a list: there are no ghosts.
    return [];
  }
}

function write(next: Kept[]): void {
  list = next;
  try {
    if (next.length) localStorage.setItem(GHOSTS_KEY, JSON.stringify(next));
    else localStorage.removeItem(GHOSTS_KEY);
  } catch {
    // No room, or no storage: the ghosts last as long as the page does.
  }
  for (const tell of listeners) tell();
}

// Another tab of the game keeps its own ghosts in the same place: what it writes is read again here.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== null && e.key !== GHOSTS_KEY) return;
    list = null;
    for (const tell of listeners) tell();
  });
}

/** Every ghost that is kept, with the name of its game; those of the games played latest first. */
export const ghostsKept = (): Kept[] => (list ??= read());

/** The ghost of a game, by the name it is kept under (`ghostKey`). */
export const ghostOf = (key: string): Ghost | null => ghostsKept().find(([k]) => k === key)?.[1] ?? null;

/**
 * A game of `key` has ended, and `mine` is the ghost it leaves, if it leaves one (`withGhost`). Returns the
 * ghost of that game as it stands afterwards: `mine` itself when it is the one that is kept.
 */
export function keepGhost(key: string, mine: Ghost | null, stale = false): Ghost | null {
  // Read again first: another tab may have kept a ghost since.
  write(withGhost(read(), key, mine, stale));
  return ghostOf(key);
}

/** The ghosts of a copy take the place of the ones here. */
export function setGhosts(raw: unknown): void {
  write(cleanGhosts(raw));
}

export function clearGhosts(): void {
  write([]);
}

const subscribe = (tell: () => void): (() => void) => {
  listeners.add(tell);
  return () => listeners.delete(tell);
};

/** The ghosts that are kept, for a screen that shows one and has to follow what becomes of it. */
export const useGhosts = (): Kept[] => useSyncExternalStore(subscribe, ghostsKept, ghostsKept);
