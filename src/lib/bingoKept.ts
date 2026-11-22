/**
 * What a bingo (lib/bingo.ts) leaves in the browser, under a name of its own and apart from the progress.
 * On the screen that calls: what has come out on each map, so that a page opened again goes on where it
 * was, and how the last game was set up. On the device of a player: the number of the card it gave itself
 * in each bingo, and the cells marked on each card. None of it is progress: it is not in a backup, and it
 * is deleted where it was made («Empezar de nuevo», «Borrar las marcas»).
 */
import { BINGO_SIZES, CARD_MAX, isHow, isSize, type BingoHow, type BingoSize } from './bingo';
import { hashStr } from './text';

export const BINGO_KEY = 'regionle:bingo';

/** How many games, cards and numbers are kept: the oldest give way. */
export const DRAWS_MAX = 6;
export const MARKS_MAX = 24;
/** Pieces a game is kept with, at most: no map has more to call. */
const OUT_MAX = 2000;

/** A game as the screen that calls has it: how it is played, and what has come out, in the order it did. */
export interface Draw {
  how: BingoHow;
  size: BingoSize;
  out: string[];
  /** Whether the name of the last piece out has been shown. */
  shown: boolean;
}

interface Kept {
  /** How the last game was set up here: the next one opens the same way. */
  set: { how: BingoHow; size: BingoSize } | null;
  /** The game of each map, by the short name of its address; the latest touched, last. */
  draws: Record<string, Draw>;
  /** The cells marked on each card, by the short name of its address; the latest touched, last. */
  marks: Record<string, number[]>;
  /** The number this device gave itself in each bingo, by the short name of its address. */
  own: Record<string, number>;
}

const EMPTY: Kept = { set: null, draws: {}, marks: {}, own: {} };
const NAME = /^[a-z0-9]{1,8}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9~:._-]{0,63}$/;

const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

function cleanSet(raw: unknown): Kept['set'] {
  return isObject(raw) && isHow(raw.how) && isSize(raw.size) ? { how: raw.how, size: raw.size } : null;
}

function cleanDraw(raw: unknown): Draw | null {
  const set = cleanSet(raw);
  if (!set || !isObject(raw) || !Array.isArray(raw.out)) return null;
  const out = [...new Set(raw.out.filter((id): id is string => typeof id === 'string' && ID.test(id)))].slice(0, OUT_MAX);
  return { ...set, out, shown: raw.shown === true };
}

/** Whatever was kept, made into what is kept: anything that is not what it should be is dropped. */
export function cleanKept(raw: unknown): Kept {
  if (!isObject(raw)) return EMPTY;
  const draws: Kept['draws'] = {};
  if (isObject(raw.draws)) {
    for (const [name, value] of Object.entries(raw.draws).slice(-DRAWS_MAX)) {
      const draw = NAME.test(name) ? cleanDraw(value) : null;
      if (draw) draws[name] = draw;
    }
  }
  const marks: Kept['marks'] = {};
  if (isObject(raw.marks)) {
    const cells = BINGO_SIZES[BINGO_SIZES.length - 1] ** 2;
    for (const [name, value] of Object.entries(raw.marks).slice(-MARKS_MAX)) {
      if (!NAME.test(name) || !Array.isArray(value)) continue;
      const list = [...new Set(value.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < cells))].sort((a, b) => a - b);
      if (list.length) marks[name] = list;
    }
  }
  const own: Kept['own'] = {};
  if (isObject(raw.own)) {
    for (const [name, n] of Object.entries(raw.own).slice(-MARKS_MAX)) if (NAME.test(name) && typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= CARD_MAX) own[name] = n;
  }
  return { set: cleanSet(raw.set), draws, marks, own };
}

function read(): Kept {
  try {
    const raw = localStorage.getItem(BINGO_KEY);
    return raw ? cleanKept(JSON.parse(raw)) : EMPTY;
  } catch {
    // No storage, or something in it that cannot be read: nothing is kept.
    return EMPTY;
  }
}

function write(next: Kept): void {
  try {
    if (next.set || Object.keys(next.draws).length || Object.keys(next.marks).length || Object.keys(next.own).length) localStorage.setItem(BINGO_KEY, JSON.stringify(next));
    else localStorage.removeItem(BINGO_KEY);
  } catch {
    // No room, or no storage: it lasts as long as the page does.
  }
}

/** The short name an address is kept under. */
const nameOf = (address: string): string => hashStr(address).toString(36);

/** An entry put last among the others, of which only so many stay. */
function put<T>(all: Record<string, T>, name: string, value: T | null, max: number): Record<string, T> {
  const { [name]: _, ...rest } = all;
  const kept = Object.entries(rest).slice(value == null ? -max : -(max - 1));
  return Object.fromEntries(value == null ? kept : [...kept, [name, value]]);
}

/** How the last game was set up on this device; null when none was. */
export const lastSet = (): Kept['set'] => read().set;

/** The game kept of a map (by the address of its cards without what says how it is played), or null. */
export const drawOf = (map: string): Draw | null => read().draws[nameOf(map)] ?? null;

/** A game as it stands now: kept, and its set-up remembered for the next. One with nothing out is not a game yet: only its set-up stays. */
export function keepDraw(map: string, draw: Draw): void {
  const kept = read();
  write({ ...kept, set: { how: draw.how, size: draw.size }, draws: put(kept.draws, nameOf(map), draw.out.length ? draw : null, DRAWS_MAX) });
}

/** The cells marked on a card, by the address of the card. */
export const marksOf = (card: string): number[] => read().marks[nameOf(card)] ?? [];

export function keepMarks(card: string, marks: readonly number[]): void {
  const kept = read();
  const list = [...new Set(marks)].sort((a, b) => a - b);
  write({ ...kept, marks: put(kept.marks, nameOf(card), list.length ? list : null, MARKS_MAX) });
}

/** The number this device gave itself in a bingo (by what follows the number in the address of its cards), or null. */
export const ownOf = (bingo: string): number | null => read().own[nameOf(bingo)] ?? null;

export function keepOwn(bingo: string, n: number): void {
  const kept = read();
  write({ ...kept, own: put(kept.own, nameOf(bingo), n, MARKS_MAX) });
}
