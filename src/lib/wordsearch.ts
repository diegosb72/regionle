/**
 * «Sopa de letras» (word search): the names of some pieces of the map are hidden in a square of letters,
 * and the player marks each one from its first letter to its last. The map says which pieces they are, by
 * lighting them up, and not what they are called. Here: how a name is written in the square, which names
 * a game takes and how they are dealt into squares, how a square is made, what a line of cells that the
 * player marks is worth, and how a name is marked.
 *
 * Nothing here knows of the screen: the game is drawn in games/WordSearch.tsx.
 */
import type { Lang } from './i18n';
import { gridWord } from './letters';
import { mulberry32, shuffle, type Rng } from './text';
import type { Res } from './types';

/** The side of the square, in letters; the longest name that can be hidden in it is as long. */
export const WS_SIDE = 12;
/** How many names a square hides at most: a longer game is several squares, one after another. */
export const WS_PER_BOARD = 10;
/** The shortest name that is hidden: two letters come up by chance all over a square. */
export const WS_MIN = 3;

export type Dir = readonly [number, number];
/**
 * The ways a name is written, as steps of [rows, columns]: from left to right, from top to bottom, and
 * slanting to the right, downwards or upwards. Never backwards: the names are not in sight, and finding
 * them is hard enough.
 */
export const WS_DIRS: readonly Dir[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
];
/** How the way of a name is drawn: along a row or a column twice as often as along each slant. */
const WS_LOTS: readonly Dir[] = [WS_DIRS[0], WS_DIRS[0], WS_DIRS[1], WS_DIRS[1], WS_DIRS[2], WS_DIRS[3]];

/** A name as it is written in the square: its letters alone, in capitals and without accents (lib/letters.ts). */
export { gridWord };

/** Whether a name, as it is written in the square, can be hidden in one of that side. */
export const fitsGrid = (word: string, side: number = WS_SIDE): boolean => word.length >= WS_MIN && word.length <= side;

export interface WsWord {
  /** The piece of the map. */
  id: string;
  /** Its name, as it is written in the square. */
  word: string;
}

/**
 * The names a game is played with: those of the list when there is one, and of them the ones that can be
 * hidden in a square. `left` are the pieces whose names cannot: too long, too short, or not written with
 * letters alone.
 */
export function wsPool<T extends { id: string; name: string }>(items: readonly T[], only: readonly string[] | undefined, lang: Lang, side: number = WS_SIDE): { words: WsWord[]; left: string[] } {
  const list = only ? new Set(only) : null;
  const words: WsWord[] = [];
  const left: string[] = [];
  for (const it of items) {
    if (list && !list.has(it.id)) continue;
    const word = gridWord(it.name, lang);
    if (fitsGrid(word, side)) words.push({ id: it.id, word });
    else left.push(it.id);
  }
  return { words, left };
}

/**
 * The names of a game, dealt into squares: as many as were asked for, by lot, or all of them when the game
 * is of a list or of the whole map. No square has more than `per`, and they are as full as each other, or
 * one name apart. The same squares for the same seed, whatever the order the names are given in.
 */
export function wsDeal(words: readonly WsWord[], length: number | string, seed: number, whole: boolean, per: number = WS_PER_BOARD): WsWord[][] {
  const order = shuffle(
    [...words].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    mulberry32(seed),
  );
  const taken = typeof length === 'number' && !whole ? order.slice(0, Math.max(0, length)) : order;
  const count = Math.ceil(taken.length / per);
  const boards: WsWord[][] = [];
  for (let i = 0, from = 0; i < count; i++) {
    // What is left, shared out among the squares that are left: the first ones take the odd names.
    const size = Math.ceil((taken.length - from) / (count - i));
    boards.push(taken.slice(from, from + size));
    from += size;
  }
  return boards;
}

export interface Cell {
  r: number;
  c: number;
}

export interface WsPlaced extends WsWord {
  /** Where its first letter is, and the step to each of the next ones. */
  r: number;
  c: number;
  dr: number;
  dc: number;
}

export interface WsBoard {
  side: number;
  /** The letters, row by row. */
  rows: string[];
  /** The names that are hidden, in the order they were given. */
  placed: WsPlaced[];
}

/** The cells a name lies on, from its first letter to its last. */
export const cellsOf = (p: Pick<WsPlaced, 'r' | 'c' | 'dr' | 'dc' | 'word'>): Cell[] => Array.from({ length: p.word.length }, (_, i) => ({ r: p.r + p.dr * i, c: p.c + p.dc * i }));

const same = (a: Cell, b: Cell): boolean => a.r === b.r && a.c === b.c;

/** Whether some cells are the ones a name lies on, from whichever end they are given. */
function liesOn(p: WsPlaced, cells: readonly Cell[]): boolean {
  if (cells.length !== p.word.length || !cells.length) return false;
  const first = { r: p.r, c: p.c };
  const last = { r: p.r + p.dr * (p.word.length - 1), c: p.c + p.dc * (p.word.length - 1) };
  const a = cells[0];
  const b = cells[cells.length - 1];
  return (same(a, first) && same(b, last)) || (same(a, last) && same(b, first));
}

type Grid = string[][];
interface Laid {
  grid: Grid;
  placed: WsPlaced[];
}

const emptyGrid = (side: number): Grid => Array.from({ length: side }, () => Array<string>(side).fill(''));

/** The ways the names that go through each cell are written, as a bit for each of `WS_DIRS`. */
type Ways = number[][];
const bitOf = (dr: number, dc: number): number => 1 << WS_DIRS.findIndex((d) => d[0] === dr && d[1] === dc);

/**
 * Whether a word can be written from a cell in a direction: inside the square, over nothing but its own
 * letters, and across the names it meets, never along one of them. Two names along the same line would
 * run into each other (LEONAVARRA), and two that are written alike would lie on the very same cells.
 */
function free(grid: Grid, ways: Ways, word: string, r: number, c: number, [dr, dc]: Dir): boolean {
  const side = grid.length;
  const endR = r + dr * (word.length - 1);
  const endC = c + dc * (word.length - 1);
  if (endR < 0 || endR >= side || endC < 0 || endC >= side) return false;
  const bit = bitOf(dr, dc);
  for (let i = 0; i < word.length; i++) {
    const at = grid[r + dr * i][c + dc * i];
    if (at && (at !== word[i] || ways[r + dr * i][c + dc * i] & bit)) return false;
  }
  return true;
}

function write(grid: Grid, ways: Ways, p: WsPlaced): void {
  const bit = bitOf(p.dr, p.dc);
  cellsOf(p).forEach(({ r, c }, i) => {
    grid[r][c] = p.word[i];
    ways[r][c] |= bit;
  });
}

/**
 * The names written into an empty square, each where the lot says among the places it fits; names may
 * cross where they share a letter. The longest go first: they have the fewest places to go. Null when one
 * of them is left with no place.
 */
function scatter(words: readonly WsWord[], side: number, rng: Rng): Laid | null {
  const grid = emptyGrid(side);
  const taken: Ways = Array.from({ length: side }, () => Array<number>(side).fill(0));
  const placed: WsPlaced[] = new Array(words.length);
  const order = words.map((w, i) => ({ w, i })).sort((a, b) => b.w.word.length - a.w.word.length || a.i - b.i);
  for (const { w, i } of order) {
    // The way it is written is drawn first, and then the place: a long name, which has one place along a
    // slant and twelve along a row, would otherwise almost never slant.
    const ways = WS_LOTS.map((dir) => {
      const spots: [number, number][] = [];
      for (let r = 0; r < side; r++) for (let c = 0; c < side; c++) if (free(grid, taken, w.word, r, c, dir)) spots.push([r, c]);
      return { dir, spots };
    }).filter((way) => way.spots.length > 0);
    if (!ways.length) return null;
    const way = ways[Math.floor(rng() * ways.length)];
    const [r, c] = way.spots[Math.floor(rng() * way.spots.length)];
    placed[i] = { ...w, r, c, dr: way.dir[0], dc: way.dir[1] };
    write(grid, taken, placed[i]);
  }
  return { grid, placed };
}

/** The way that never fails: each name along a row of its own. It takes as many names as the square has rows. */
function inRows(words: readonly WsWord[], side: number, rng: Rng): Laid {
  const grid = emptyGrid(side);
  const rows = shuffle(
    Array.from({ length: side }, (_, r) => r),
    rng,
  );
  const placed = words.slice(0, side).map((w, i) => {
    const p: WsPlaced = { ...w, r: rows[i], c: Math.floor(rng() * (side - w.word.length + 1)), dr: 0, dc: 1 };
    cellsOf(p).forEach(({ r, c }, k) => (grid[r][c] = p.word[k]));
    return p;
  });
  return { grid, placed };
}

/**
 * Words a class would laugh at, or worse, which the letters that fill the square must not spell by chance.
 * Both languages are looked for in every square. Four letters or more: shorter ones cannot be kept out.
 */
export const WS_RUDE: readonly string[] = ['CACA', 'CULO', 'PEDO', 'PUTA', 'PUTO', 'POLLA', 'COÑO', 'CONO', 'MIERDA', 'JODER', 'TETA', 'PENE', 'PICHA', 'FUCK', 'SHIT', 'CUNT', 'COCK', 'DICK', 'PISS', 'ARSE', 'TITS', 'ANUS', 'CRAP'];

/** Every line of a square that a word can be read along: its rows, its columns and its slants, as cells. */
function linesOf(side: number): Cell[][] {
  const lines: Cell[][] = [];
  const run = (r: number, c: number, dr: number, dc: number): void => {
    const line: Cell[] = [];
    for (; r >= 0 && r < side && c >= 0 && c < side; r += dr, c += dc) line.push({ r, c });
    lines.push(line);
  };
  for (let i = 0; i < side; i++) {
    run(i, 0, 0, 1);
    run(0, i, 1, 0);
    run(i, 0, 1, 1);
    run(i, 0, -1, 1);
    if (i > 0) {
      run(0, i, 1, 1);
      run(side - 1, i, -1, 1);
    }
  }
  return lines;
}

export interface Reading {
  word: string;
  /** The cells it lies on, from its first letter to its last. */
  cells: Cell[];
}

/** Every place some words can be read in a square: along any row, column or slant, and either way. */
export function readingsIn(rows: readonly (string | readonly string[])[], words: readonly string[]): Reading[] {
  const found: Reading[] = [];
  const list = [...new Set(words)].filter((w) => w.length > 0);
  for (const line of linesOf(rows.length)) {
    const text = line.map(({ r, c }) => rows[r][c] || ' ').join('');
    const back = [...text].reverse().join('');
    for (const word of list) {
      for (let i = text.indexOf(word); i > -1; i = text.indexOf(word, i + 1)) found.push({ word, cells: line.slice(i, i + word.length) });
      // A word that reads the same both ways is one reading, not two.
      if (word === [...word].reverse().join('')) continue;
      for (let i = back.indexOf(word); i > -1; i = back.indexOf(word, i + 1)) found.push({ word, cells: line.slice(line.length - i - word.length, line.length - i).reverse() });
    }
  }
  return found;
}

/**
 * What should not be read in a square and is: a word of `WS_RUDE`, or a name that is hidden in it, written
 * a second time by the letters around. Not the names where they were hidden.
 */
export function strayIn(board: Pick<WsBoard, 'rows' | 'placed'>): Reading[] {
  return strays(board.rows, board.placed);
}

function strays(rows: readonly (string | readonly string[])[], placed: readonly WsPlaced[]): Reading[] {
  const names = new Set(placed.map((p) => p.word));
  return readingsIn(rows, [...WS_RUDE, ...names]).filter((hit) => !(names.has(hit.word) && placed.some((p) => p.word === hit.word && liesOn(p, hit.cells))));
}

/**
 * Letters that go into the filling whatever the names are: the vowels and the most usual consonants. With
 * few names, their own letters alone would say little else.
 */
const COMMON = 'AEIOULNRSTCDMP';

/**
 * A square with the names written in it and the rest filled with letters: each letter that some name has,
 * as likely as any other, so that a Z or a J does not give a name away; and the usual ones, twice as likely
 * when a name has them too. Not as often as the names have them: with names full of As, the filling would
 * be rows of As. A letter of the filling that helps to spell what should not be read (`strayIn`) is drawn
 * again. `blots` is what is still read then that another square could avoid: what is spelled by the
 * letters of several names, which no letter of the filling can undo. A name inside another one (NIGER in
 * NIGERIA) is no blot: it is what it is.
 */
function build(words: readonly WsWord[], side: number, rng: Rng): { board: WsBoard; blots: number } {
  let laid: Laid | null = null;
  for (let attempt = 0; attempt < 30 && !laid; attempt++) laid = scatter(words, side, rng);
  const { grid, placed } = laid ?? inRows(words, side, rng);
  const own = placed.map((p) => new Set(cellsOf(p).map(({ r, c }) => r * side + c)));
  const fixed = new Set(own.flatMap((cells) => [...cells]));
  const bag = [...new Set(placed.flatMap((p) => [...p.word])), ...COMMON];
  const draw = (): string => bag[Math.floor(rng() * bag.length)];
  for (let r = 0; r < side; r++) for (let c = 0; c < side; c++) if (!grid[r][c]) grid[r][c] = draw();
  const loose = (hit: Reading): Cell[] => hit.cells.filter(({ r, c }) => !fixed.has(r * side + c));
  // As many rounds as it takes, within reason: a letter drawn again may spell something else.
  for (let round = 0; round < 400; round++) {
    const cells = strays(grid, placed)
      .map(loose)
      .find((list) => list.length > 0);
    if (!cells) break;
    const { r, c } = cells[Math.floor(rng() * cells.length)];
    const was = grid[r][c];
    for (let tries = 0; tries < 12 && grid[r][c] === was; tries++) grid[r][c] = draw();
  }
  const blots = strays(grid, placed).filter((hit) => !own.some((cells) => hit.cells.every(({ r, c }) => cells.has(r * side + c)))).length;
  return { board: { side, rows: grid.map((row) => row.join('')), placed }, blots };
}

/**
 * A square for some names. The same square for the same names and the same seed. One that spells what it
 * should not with the letters of its names is made again, a few times at most.
 */
export function wsBoard(words: readonly WsWord[], seed: number, side: number = WS_SIDE): WsBoard {
  const rng = mulberry32(seed);
  let best = build(words, side, rng);
  for (let attempt = 1; attempt < 8 && best.blots > 0; attempt++) {
    const other = build(words, side, rng);
    if (other.blots < best.blots) best = other;
  }
  return best.board;
}

/** The cells from one to another, both among them, when they lie along a row, a column or a slant; null when they do not. */
export function lineOf(from: Cell, to: Cell): Cell[] | null {
  const dr = to.r - from.r;
  const dc = to.c - from.c;
  if (dr && dc && Math.abs(dr) !== Math.abs(dc)) return null;
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  return Array.from({ length: steps + 1 }, (_, i) => ({ r: from.r + Math.sign(dr) * i, c: from.c + Math.sign(dc) * i }));
}

/**
 * Where a line that starts at a cell ends when the finger has gone to another: the cell along a row, a
 * column or a slant from the first that is nearest to where the finger is, and inside the square. A drag
 * need not be exact: the line follows the finger and turns only between its eight ways.
 */
export function snapTo(from: Cell, to: Cell, side: number): Cell {
  const dr = to.r - from.r;
  const dc = to.c - from.c;
  const ar = Math.abs(dr);
  const ac = Math.abs(dc);
  if (!ar && !ac) return { ...from };
  // Half way between a row and a slant: 22.5°, whose tangent is √2 − 1.
  const lean = Math.SQRT2 - 1;
  const sr = ar < ac * lean ? 0 : Math.sign(dr);
  const sc = ac < ar * lean ? 0 : Math.sign(dc);
  let steps = sr && sc ? Math.round((ar + ac) / 2) : Math.max(ar, ac);
  const inside = (n: number): boolean => n >= 0 && n < side;
  while (steps > 0 && !(inside(from.r + sr * steps) && inside(from.c + sc * steps))) steps--;
  return { r: from.r + sr * steps, c: from.c + sc * steps };
}

/** The letters of some cells, in the order they are given. */
export const spelled = (rows: readonly string[], cells: readonly Cell[]): string => cells.map(({ r, c }) => rows[r]?.[c] ?? '').join('');

/**
 * What a line of cells that the player marked is worth: the name it spells, read either way, among the
 * ones hidden in the square. The name that lies on those very cells is the one meant; where the letters
 * spell a name somewhere else (one inside another: NIGER in NIGERIA), it is one that has not been found.
 * `again` when the name had been found already. Null when the cells spell none of them.
 */
export function wsMatch(board: WsBoard, found: ReadonlySet<string>, cells: readonly Cell[]): { id: string; again: boolean } | null {
  const text = spelled(board.rows, cells);
  const back = [...text].reverse().join('');
  const alike = board.placed.filter((p) => p.word === text || p.word === back);
  if (!alike.length) return null;
  const here = alike.find((p) => liesOn(p, cells));
  if (here) return { id: here.id, again: found.has(here.id) };
  const fresh = alike.find((p) => !found.has(p.id));
  return fresh ? { id: fresh.id, again: false } : { id: alike[0].id, again: true };
}

/**
 * How a name is marked: right first time when it is found with the map alone, with help when the list of
 * names was in sight, and to review when it is not found.
 */
export const wsRes = (found: boolean, listed: boolean): Res => (found ? (listed ? 'warn' : 'ok') : 'bad');
