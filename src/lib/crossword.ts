/**
 * «Crucigrama» (crossword): the names of some pieces of the map cross each other in a grid, and the player
 * writes them in. Each word has a number, and the map carries that number on its piece: the map is the list
 * of clues. Here: which names a game takes, how they are laid so that they cross, how they are dealt into
 * crosswords, and what the cells and the words of one are.
 *
 * Nothing here knows of the screen: the game is drawn in games/Crossword.tsx.
 */
import type { Lang } from './i18n';
import { gridWord } from './letters';
import { mulberry32, shuffle, type Rng } from './text';
import type { Res } from './types';

/** The widest a crossword is, in cells: what a phone held upright has room for. The longest name is as long. */
export const CW_COLS = 13;
/** The tallest it is. */
export const CW_ROWS = 13;
/** How many names a crossword has at most: a longer game is several, one after another. */
export const CW_PER_BOARD = 10;
/** The shortest name that goes in. */
export const CW_MIN = 3;

export interface CwWord {
  /** The piece of the map. */
  id: string;
  /** Its name, as it is written in the grid. */
  word: string;
}

export interface Cell {
  r: number;
  c: number;
}

export interface CwPlaced extends CwWord {
  /** Where its first letter is. */
  r: number;
  c: number;
  /** Written downwards; otherwise, from left to right. */
  down: boolean;
  /** Its number: the words are counted from 1 in the order their first letters are read. */
  n: number;
}

export interface CwBoard {
  rows: number;
  cols: number;
  /** The words, by their numbers. */
  placed: CwPlaced[];
}

/** Whether a name, as it is written in the grid, can go in a crossword that wide. */
export const fitsCross = (word: string, cols: number = CW_COLS): boolean => word.length >= CW_MIN && word.length <= cols;

/**
 * The names a game is played with: those of the list when there is one, and of them the ones that can be
 * written in a crossword. `left` are the pieces whose names cannot: too long, too short, or not written
 * with letters alone.
 */
export function cwPool<T extends { id: string; name: string }>(items: readonly T[], only: readonly string[] | undefined, lang: Lang, cols: number = CW_COLS): { words: CwWord[]; left: string[] } {
  const list = only ? new Set(only) : null;
  const words: CwWord[] = [];
  const left: string[] = [];
  for (const it of items) {
    if (list && !list.has(it.id)) continue;
    const word = gridWord(it.name, lang);
    if (fitsCross(word, cols)) words.push({ id: it.id, word });
    else left.push(it.id);
  }
  return { words, left };
}

/**
 * How many letters each word of a name has, as a crossword says of an answer of several: «Ciudad Real» is
 * 6 and 4, «Guinea-Bisáu» 6 and 5. What is not a letter parts the words and is not counted.
 */
export function partsOf(name: string): number[] {
  return name
    .normalize('NFC')
    .split(/[^\p{L}\p{M}]+/u)
    .map((part) => [...part.replace(/\p{M}/gu, '')].length)
    .filter((n) => n > 0);
}

/** The cells a word lies on, from its first letter to its last. */
export const cellsOf = (p: Pick<CwPlaced, 'r' | 'c' | 'down' | 'word'>): Cell[] => Array.from({ length: p.word.length }, (_, i) => (p.down ? { r: p.r + i, c: p.c } : { r: p.r, c: p.c + i }));

/* ------------------------------------------------------------------ laying the words */

/** A cell that has a letter while the words are being laid: the letter, and which ways a word goes through it. */
interface Slot {
  ch: string;
  across: boolean;
  down: boolean;
}

interface Draft extends CwWord {
  r: number;
  c: number;
  down: boolean;
}

/** Words laid on a sheet without edges: only how far they reach matters, until they are done. */
interface Lay {
  grid: Map<number, Slot>;
  words: Draft[];
  r0: number;
  r1: number;
  c0: number;
  c1: number;
  crossings: number;
  /** How many of its words were not among the ones that were wanted. */
  spared: number;
}

// Room on every side for the longest word that a sheet may be asked to hold.
const SPAN = 256;
const HALF = SPAN / 2;
const keyOf = (r: number, c: number): number => (r + HALF) * SPAN + (c + HALF);

function put(lay: Lay, w: CwWord, r: number, c: number, down: boolean, crossings: number): void {
  for (let i = 0; i < w.word.length; i++) {
    const key = down ? keyOf(r + i, c) : keyOf(r, c + i);
    const slot = lay.grid.get(key);
    if (slot) {
      if (down) slot.down = true;
      else slot.across = true;
    } else lay.grid.set(key, { ch: w.word[i], across: !down, down });
  }
  const endR = down ? r + w.word.length - 1 : r;
  const endC = down ? c : c + w.word.length - 1;
  lay.r0 = Math.min(lay.r0, r);
  lay.r1 = Math.max(lay.r1, endR);
  lay.c0 = Math.min(lay.c0, c);
  lay.c1 = Math.max(lay.c1, endC);
  lay.crossings += crossings;
  lay.words.push({ ...w, r, c, down });
}

/**
 * How many words a word would cross if it were written from a cell, or −1 when it cannot be written there:
 * it would leave the box, run into a letter that is not its own, lie along another word or beside one, touch
 * one with either end, or start where another starts (two words with one number).
 */
function crossingsAt(lay: Lay, word: string, r: number, c: number, down: boolean, cols: number, rows: number): number {
  const dr = down ? 1 : 0;
  const dc = down ? 0 : 1;
  const len = word.length;
  if (Math.max(lay.r1, r + dr * (len - 1)) - Math.min(lay.r0, r) + 1 > rows) return -1;
  if (Math.max(lay.c1, c + dc * (len - 1)) - Math.min(lay.c0, c) + 1 > cols) return -1;
  if (lay.grid.has(keyOf(r - dr, c - dc)) || lay.grid.has(keyOf(r + dr * len, c + dc * len))) return -1;
  if (lay.words.some((p) => p.r === r && p.c === c)) return -1;
  let crossings = 0;
  for (let i = 0; i < len; i++) {
    const rr = r + dr * i;
    const cc = c + dc * i;
    const slot = lay.grid.get(keyOf(rr, cc));
    if (slot) {
      if (slot.ch !== word[i] || (down ? slot.down : slot.across)) return -1;
      crossings++;
    } else if (lay.grid.has(keyOf(rr + dc, cc + dr)) || lay.grid.has(keyOf(rr - dc, cc - dr))) return -1;
  }
  return crossings;
}

interface Spot {
  r: number;
  c: number;
  down: boolean;
  crossings: number;
}

/**
 * The best place for a word among the ones where it crosses a word that is laid: where it crosses the most,
 * then where the crossword grows the least, then by lot. Null when there is none.
 */
function bestSpot(lay: Lay, word: string, cols: number, rows: number, rng: Rng): Spot | null {
  let best: Spot | null = null;
  let bestScore = -Infinity;
  const tried = new Set<number>();
  for (const p of lay.words) {
    for (let j = 0; j < p.word.length; j++) {
      for (let i = 0; i < word.length; i++) {
        if (word[i] !== p.word[j]) continue;
        // Across a word that goes down, and down a word that goes across, through the letter they share.
        const down = !p.down;
        const r = p.down ? p.r + j : p.r - i;
        const c = p.down ? p.c - i : p.c + j;
        const key = keyOf(r, c) * 2 + (down ? 1 : 0);
        if (tried.has(key)) continue;
        tried.add(key);
        const crossings = crossingsAt(lay, word, r, c, down, cols, rows);
        if (crossings < 1) continue;
        const endR = down ? r + word.length - 1 : r;
        const endC = down ? c : c + word.length - 1;
        const area = (Math.max(lay.r1, endR) - Math.min(lay.r0, r) + 1) * (Math.max(lay.c1, endC) - Math.min(lay.c0, c) + 1);
        const score = crossings * 1000 - area + rng();
        if (score > bestScore) {
          bestScore = score;
          best = { r, c, down, crossings };
        }
      }
    }
  }
  return best;
}

/**
 * One way of laying some words: the first one across, and each of the others where it crosses best what
 * is laid, going over the ones that found no place each time a word is added. When none of them goes in
 * and the crossword is short of words, one of the spare ones is laid, and they are gone over again. Up to
 * `want` words.
 */
function attempt(wanted: readonly CwWord[], spare: readonly CwWord[], want: number, cols: number, rows: number, rng: Rng): Lay {
  const lay: Lay = { grid: new Map(), words: [], r0: 0, r1: 0, c0: 0, c1: 0, crossings: 0, spared: 0 };
  if (!wanted.length || want < 1) return lay;
  put(lay, wanted[0], 0, 0, false, 0);
  const left = wanted.slice(1);
  const others = [...spare];
  /** Lays the first of some words that has a place, and takes it off the list. */
  const lay1 = (list: CwWord[]): boolean => {
    for (let k = 0; k < list.length; k++) {
      const spot = bestSpot(lay, list[k].word, cols, rows, rng);
      if (!spot) continue;
      put(lay, list[k], spot.r, spot.c, spot.down, spot.crossings);
      list.splice(k, 1);
      return true;
    }
    return false;
  };
  while (lay.words.length < want) {
    if (lay1(left)) continue;
    if (!lay1(others)) break;
    lay.spared++;
  }
  return lay;
}

/** How many ways of laying the words are tried, to keep the best, when they all go in. */
const TRIES = 24;
/** How many are tried before giving up on getting them all in. */
const TRIES_MOST = 400;

const areaOf = (lay: Lay): number => (lay.r1 - lay.r0 + 1) * (lay.c1 - lay.c0 + 1);

/**
 * Which of two ways of laying the words is the better one: the one with more words, then the one with more
 * of the words that were wanted, then the one whose words cross more, then the smaller one.
 */
const better = (a: Lay, b: Lay): boolean => a.words.length - b.words.length > 0 || (a.words.length === b.words.length && (a.spared < b.spared || (a.spared === b.spared && (a.crossings > b.crossings || (a.crossings === b.crossings && areaOf(a) < areaOf(b))))));

/**
 * A crossword with up to `want` of some words: the ones that come first, as far as they can be made to
 * cross inside the box, and the ones after them in their place when they cannot. Every word crosses
 * another; no two lie side by side, and each has a number of its own. The same crossword for the same
 * words and the same seed.
 */
export function cwLayout(words: readonly CwWord[], want: number, seed: number, cols: number = CW_COLS, rows: number = CW_ROWS): CwBoard {
  const rng = mulberry32(seed);
  const fit = words.filter((w) => w.word.length > 0 && w.word.length <= cols);
  const goal = Math.min(want, fit.length);
  let best: Lay | null = null;
  for (let n = 0; goal > 0 && n < TRIES_MOST && (n < TRIES || best!.words.length < goal); n++) {
    // The words that are wanted go first, in an order drawn by lot; the others are there to take the place of one that cannot go in.
    const wanted = shuffle(fit.slice(0, want), rng);
    // Every other time, the longest of them first: they are the ones with the fewest places to go.
    if (n % 2) wanted.sort((a, b) => b.word.length - a.word.length);
    const lay = attempt(wanted, fit.slice(want), want, cols, rows, rng);
    if (!best || better(lay, best)) best = lay;
  }
  if (!best) return { rows: 0, cols: 0, placed: [] };
  const { r0, c0 } = best;
  const placed = best.words
    .map((w) => ({ id: w.id, word: w.word, r: w.r - r0, c: w.c - c0, down: w.down, n: 0 }))
    .sort((a, b) => a.r - b.r || a.c - b.c)
    .map((w, i) => ({ ...w, n: i + 1 }));
  return { rows: best.r1 - r0 + 1, cols: best.c1 - c0 + 1, placed };
}

/** Some names dealt into so many crosswords, or into more when they do not all go into those. None has more than `per` words. */
function dealInto(names: readonly CwWord[], count: number, per: number, seed: number, cols: number, rows: number): CwBoard[] {
  const boards: CwBoard[] = [];
  let rest = names;
  while (rest.length) {
    // What is left, shared out among the crosswords that are left. When one fell short of its share the last
    // has more to take than a crossword may hold: it takes what it may, and the rest goes into one more.
    const want = Math.min(Math.max(1, per), Math.ceil(rest.length / Math.max(1, count - boards.length)));
    const board = cwLayout(rest, want, (seed ^ Math.imul(boards.length + 1, 0x9e3779b1)) >>> 0, cols, rows);
    if (!board.placed.length) break;
    boards.push(board);
    const used = new Set(board.placed.map((p) => p.id));
    rest = rest.filter((w) => !used.has(w.id));
  }
  return boards;
}

/**
 * The names of a game, dealt into crosswords: as many as were asked for, by lot, or all of them when the
 * game is of a list or of the whole map. No crossword has more than `per` words, and they are as full as
 * each other. When the names do not all cross in as few crosswords as that, they are dealt into one more,
 * with fewer words each: two of five rather than one of eight and one of two. A name that crosses none of
 * the others is a crossword of one word. The same crosswords for the same seed, whatever the order the
 * names are given in.
 */
export function cwDeal(words: readonly CwWord[], length: number | string, seed: number, whole: boolean, per: number = CW_PER_BOARD, cols: number = CW_COLS, rows: number = CW_ROWS): CwBoard[] {
  const order = shuffle(
    [...words].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    mulberry32(seed),
  );
  const names = (typeof length === 'number' && !whole ? order.slice(0, Math.max(0, length)) : order).filter((w) => w.word.length > 0 && w.word.length <= cols);
  if (!names.length) return [];
  const least = Math.ceil(names.length / Math.max(1, per));
  const smallest = (boards: CwBoard[]): number => Math.min(...boards.map((b) => b.placed.length));
  let best: CwBoard[] | null = null;
  for (let count = least; count <= Math.min(names.length, least + 2); count++) {
    const boards = dealInto(names, count, per, seed, cols, rows);
    if (!best || smallest(boards) > smallest(best)) best = boards;
    // Every crossword took its share: there is nothing to make up for.
    if (boards.length === count) break;
  }
  return best ?? [];
}

/* ------------------------------------------------------------------ the crossword as it is played */

export interface CwCell extends Cell {
  /** The letter that goes in it. */
  ch: string;
  /** The word that goes through it from left to right, as its place in `placed`; −1 when none does. */
  across: number;
  /** The word that goes through it downwards; −1 when none does. */
  down: number;
  /** The number of the word that starts in it; 0 when none does. */
  n: number;
}

export const cwKey = (r: number, c: number): string => `${r},${c}`;

/** The cells of a crossword that take a letter, by their place («row,column»), in the order they are read. */
export function cwCells(board: CwBoard): Map<string, CwCell> {
  const cells = new Map<string, CwCell>();
  board.placed.forEach((p, index) => {
    cellsOf(p).forEach(({ r, c }, i) => {
      const key = cwKey(r, c);
      const cell = cells.get(key) ?? { r, c, ch: p.word[i], across: -1, down: -1, n: 0 };
      if (p.down) cell.down = index;
      else cell.across = index;
      if (i === 0) cell.n = p.n;
      cells.set(key, cell);
    });
  });
  return new Map([...cells].sort(([, a], [, b]) => a.r - b.r || a.c - b.c));
}

/** The letters that have been written, by the place of their cells. */
export type Written = Readonly<Record<string, string | undefined>>;

/** Whether every cell of a word has a letter. */
export const cwFull = (p: CwPlaced, written: Written): boolean => cellsOf(p).every(({ r, c }) => !!written[cwKey(r, c)]);

/** Whether a word is written, and rightly. */
export const cwRight = (p: CwPlaced, written: Written): boolean => cellsOf(p).every(({ r, c }, i) => written[cwKey(r, c)] === p.word[i]);

/**
 * The word a cell stands for when it is chosen: the one that goes through it the way that is wanted, or
 * the other one when none goes that way. −1 for a cell that is in no word.
 */
export function wordAt(cell: Pick<CwCell, 'across' | 'down'> | undefined, down: boolean): number {
  if (!cell) return -1;
  const first = down ? cell.down : cell.across;
  return first >= 0 ? first : down ? cell.across : cell.down;
}

/**
 * Where the writing goes on from a cell of a word: the next cell of the word that can still be written in,
 * forwards or backwards; the same place when there is none.
 */
export function cwStep(p: CwPlaced, from: number, back: boolean, open: (cell: Cell) => boolean): number {
  const cells = cellsOf(p);
  for (let i = from + (back ? -1 : 1); i >= 0 && i < cells.length; i += back ? -1 : 1) if (open(cells[i])) return i;
  return from;
}

/**
 * How a word is marked: right first time when it was written rightly with nothing given and nothing wrong
 * before, with help otherwise, and to review when it was not written.
 */
export const cwRes = (solved: boolean, clean: boolean): Res => (solved ? (clean ? 'ok' : 'warn') : 'bad');
