/** «Crucigrama»: which names go in, how they are laid so that they cross, how they are dealt, and what the cells and the words of a crossword are. */
import { describe, expect, it } from 'vitest';
import { CW_COLS, CW_MIN, CW_PER_BOARD, CW_ROWS, cellsOf, cwCells, cwDeal, cwFull, cwKey, cwLayout, cwPool, cwRes, cwRight, cwStep, fitsCross, partsOf, wordAt, type CwBoard, type CwPlaced, type CwWord } from './crossword';

const words = (...names: string[]): CwWord[] => names.map((name) => ({ id: name.toLowerCase(), word: name }));
const PROVINCES = words('LEON', 'TERUEL', 'SORIA', 'LUGO', 'CADIZ', 'HUESCA', 'ZAMORA', 'BADAJOZ', 'ALBACETE', 'GUADALAJARA');
const COUNTRIES = words('CHAD', 'PERU', 'CUBA', 'ITALIA', 'FRANCIA', 'PORTUGAL', 'ALEMANIA', 'MARRUECOS', 'ARGENTINA', 'NUEVAZELANDA');
const MANY = words(
  'ALAVA', 'ALBACETE', 'ALICANTE', 'ALMERIA', 'ASTURIAS', 'AVILA', 'BADAJOZ', 'BARCELONA', 'BURGOS', 'CACERES', 'CADIZ', 'CANTABRIA', 'CASTELLON', 'CEUTA', 'CIUDADREAL', 'CORDOBA', 'CUENCA',
  'GERONA', 'GRANADA', 'GUADALAJARA', 'GUIPUZCOA', 'HUELVA', 'HUESCA', 'JAEN', 'LACORUÑA', 'LARIOJA', 'LASPALMAS', 'LEON', 'LERIDA', 'LUGO', 'MADRID', 'MALAGA', 'MELILLA', 'MURCIA', 'NAVARRA',
  'ORENSE', 'PALENCIA', 'PONTEVEDRA', 'SALAMANCA', 'SEGOVIA', 'SEVILLA', 'SORIA', 'TARRAGONA', 'TERUEL', 'TOLEDO', 'VALENCIA', 'VALLADOLID', 'VIZCAYA', 'ZAMORA', 'ZARAGOZA',
);
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 13);
const at = (word: string, r: number, c: number, down: boolean, n: number, id = word.toLowerCase()): CwPlaced => ({ id, word, r, c, down, n });

/** The letters of a crossword, row by row, with a dot where there is none. Fails when two words disagree on a cell. */
function drawn(board: CwBoard): string[] {
  const rows = Array.from({ length: board.rows }, () => Array<string>(board.cols).fill('.'));
  for (const p of board.placed)
    cellsOf(p).forEach(({ r, c }, i) => {
      expect(r >= 0 && r < board.rows && c >= 0 && c < board.cols, `${p.word} inside`).toBe(true);
      expect(rows[r][c] === '.' || rows[r][c] === p.word[i], `${p.word} at ${r},${c}`).toBe(true);
      rows[r][c] = p.word[i];
    });
  return rows.map((row) => row.join(''));
}

/** Every run of two letters or more along the lines of some rows: where it starts, and what it says. */
function runsOf(rows: string[]): string[] {
  const out: string[] = [];
  rows.forEach((row, r) => {
    for (const m of row.matchAll(/[^.]{2,}/g)) out.push(`${r},${m.index}:${m[0]}`);
  });
  return out.sort();
}
const turned = (rows: string[]): string[] => Array.from({ length: rows[0]?.length ?? 0 }, (_, c) => rows.map((row) => row[c]).join(''));

/** What makes a crossword a crossword, whatever its words. */
function sound(board: CwBoard, label = ''): void {
  const rows = drawn(board);
  // It is as large as its words reach, and starts at the corner.
  expect(Math.max(0, ...board.placed.map((p) => (p.down ? p.r + p.word.length : p.r + 1))), label).toBe(board.rows);
  expect(Math.max(0, ...board.placed.map((p) => (p.down ? p.c + 1 : p.c + p.word.length))), label).toBe(board.cols);
  if (board.placed.length) {
    expect(Math.min(...board.placed.map((p) => p.r)), label).toBe(0);
    expect(Math.min(...board.placed.map((p) => p.c)), label).toBe(0);
  }
  // What is read along its rows is its words across, and nothing else; along its columns, its words down.
  expect(runsOf(rows), label).toEqual(board.placed.filter((p) => !p.down).map((p) => `${p.r},${p.c}:${p.word}`).sort());
  expect(runsOf(turned(rows)), label).toEqual(board.placed.filter((p) => p.down).map((p) => `${p.c},${p.r}:${p.word}`).sort());
  // Each word has a number of its own, counted in the order their first letters are read.
  expect(board.placed.map((p) => p.n), label).toEqual(board.placed.map((_, i) => i + 1));
  const starts = board.placed.map((p) => p.r * 100 + p.c);
  expect(new Set(starts).size, label).toBe(starts.length);
  expect([...starts].sort((a, b) => a - b), label).toEqual(starts);
  // Every word crosses another, and they all hang together.
  const group = board.placed.map((_, i) => i);
  const find = (i: number): number => (group[i] === i ? i : (group[i] = find(group[i])));
  const owner = new Map<string, number>();
  board.placed.forEach((p, i) => {
    for (const { r, c } of cellsOf(p)) {
      const other = owner.get(cwKey(r, c));
      if (other == null) owner.set(cwKey(r, c), i);
      else group[find(i)] = find(other);
    }
  });
  expect(new Set(board.placed.map((_, i) => find(i))).size, label).toBe(board.placed.length ? 1 : 0);
}

describe('the names of a crossword', () => {
  it('are those of three letters or more that are no longer than the crossword is wide', () => {
    expect(CW_MIN).toBe(3);
    expect(CW_COLS).toBe(13);
    expect(fitsCross('AB')).toBe(false);
    expect(fitsCross('ABC')).toBe(true);
    expect(fitsCross('ABCDEFGHIJKLM')).toBe(true);
    expect(fitsCross('ABCDEFGHIJKLMN')).toBe(false);
    expect(fitsCross('ABCDEFG', 6)).toBe(false);
    expect(fitsCross('ABCDEF', 6)).toBe(true);
    expect(fitsCross('')).toBe(false);
  });

  const items = [
    { id: 'le', name: 'León' },
    { id: 'cr', name: 'Ciudad Real' },
    { id: 'sc', name: 'Santa Cruz de Tenerife' },
    { id: 'ib', name: 'Islas Baleares' },
    { id: 'uk', name: 'UK' },
    { id: 'a4', name: 'Área 4' },
    { id: 'co', name: 'La Coruña' },
  ];

  it('are written with their letters alone, and the others are told apart', () => {
    expect(cwPool(items, undefined, 'es')).toEqual({
      words: [
        { id: 'le', word: 'LEON' },
        { id: 'cr', word: 'CIUDADREAL' },
        { id: 'ib', word: 'ISLASBALEARES' },
        { id: 'co', word: 'LACORUÑA' },
      ],
      left: ['sc', 'uk', 'a4'],
    });
    expect(cwPool(items, undefined, 'en').words.at(-1)).toEqual({ id: 'co', word: 'LACORUNA' });
  });

  it('are those of the list, when the game is of one, and depend on how wide the crossword is', () => {
    expect(cwPool(items, ['le', 'sc', 'zz'], 'es')).toEqual({ words: [{ id: 'le', word: 'LEON' }], left: ['sc'] });
    expect(cwPool(items, [], 'es')).toEqual({ words: [], left: [] });
    expect(cwPool(items, undefined, 'es', 8).words.map((w) => w.id)).toEqual(['le', 'co']);
    expect(cwPool(items, undefined, 'es', 8).left).toEqual(['cr', 'sc', 'ib', 'uk', 'a4']);
  });

  it('say how many letters each of their words has', () => {
    expect(partsOf('León')).toEqual([4]);
    expect(partsOf('Ciudad Real')).toEqual([6, 4]);
    expect(partsOf('Guinea-Bisáu')).toEqual([6, 5]);
    expect(partsOf("Côte d'Ivoire")).toEqual([4, 1, 6]);
    expect(partsOf('  Santa Cruz  de Tenerife ')).toEqual([5, 4, 2, 8]);
    // A letter written with a mark of its own is one letter.
    expect(partsOf('Leo\u0301n')).toEqual([4]);
    // Also when the letter and its mark cannot be written as one sign.
    expect(partsOf('O\u0323\u0300yo\u0323\u0301')).toEqual([3]);
    expect(partsOf('')).toEqual([]);
    expect(partsOf('-')).toEqual([]);
  });
});

describe('a crossword', () => {
  it('is its words crossing each other, with nothing else read along its rows and columns', () => {
    for (const list of [PROVINCES, COUNTRIES])
      for (const seed of SEEDS) {
        const board = cwLayout(list, 10, seed);
        sound(board, `seed ${seed}`);
        expect(board.rows, `seed ${seed}`).toBeLessThanOrEqual(CW_ROWS);
        expect(board.cols, `seed ${seed}`).toBeLessThanOrEqual(CW_COLS);
        expect(board.placed.map((p) => p.id).sort(), `seed ${seed}`).toEqual(list.map((w) => w.id).sort());
      }
  });

  it('writes words from left to right and downwards, and both ways are used', () => {
    let down = 0;
    let across = 0;
    for (const seed of SEEDS) for (const p of cwLayout(PROVINCES, 10, seed).placed) p.down ? down++ : across++;
    expect(down).toBeGreaterThan(100);
    expect(across).toBeGreaterThan(100);
  });

  it('is the same for the same words and the same seed, and another with another seed', () => {
    expect(cwLayout(PROVINCES, 10, 7)).toEqual(cwLayout(PROVINCES, 10, 7));
    const shapes = new Set(SEEDS.map((seed) => JSON.stringify(cwLayout(PROVINCES, 10, seed).placed.map((p) => [p.word, p.r, p.c, p.down]))));
    expect(shapes.size).toBeGreaterThan(20);
  });

  it('has as many words as were wanted, the first ones: the rest are left for another', () => {
    for (const seed of SEEDS.slice(0, 15)) {
      const board = cwLayout(MANY, 8, seed);
      sound(board);
      expect(board.placed.map((p) => p.id).sort()).toEqual(
        MANY.slice(0, 8)
          .map((w) => w.id)
          .sort(),
      );
    }
    expect(cwLayout(MANY, 1, 3).placed).toEqual([at('ALAVA', 0, 0, false, 1)]);
    expect(cwLayout(MANY, 0, 3)).toEqual({ rows: 0, cols: 0, placed: [] });
    expect(cwLayout([], 5, 3)).toEqual({ rows: 0, cols: 0, placed: [] });
  });

  it('takes a word from further on in the place of one that cannot cross the others', () => {
    // XYZ shares no letter with the rest: the word after the three that were wanted goes in instead.
    const list = words('LEON', 'XYZ', 'LUGO', 'ELDA', 'TERUEL');
    for (const seed of SEEDS.slice(0, 15)) {
      const board = cwLayout(list, 3, seed);
      sound(board);
      expect(board.placed.map((p) => p.word).sort()).toEqual(['ELDA', 'LEON', 'LUGO']);
    }
    // With nothing to take its place, the crossword is short of a word.
    expect(cwLayout(words('LEON', 'XYZ', 'LUGO'), 3, 1).placed.map((p) => p.word).sort()).toEqual(['LEON', 'LUGO']);
    // And a word that crosses nothing is still a crossword, of one word.
    expect(cwLayout(words('XYZ'), 3, 1)).toEqual({ rows: 1, cols: 3, placed: [at('XYZ', 0, 0, false, 1)] });
  });

  it('stays inside its box: a word longer than it is tall goes across, and one longer than it is wide stays out', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const board = cwLayout(words('ABCDEFGH', 'AIJKLMNO', 'HPQRSTUV', 'BWXYZABC'), 4, seed, 8, 5);
      sound(board);
      expect(board.cols).toBeLessThanOrEqual(8);
      expect(board.rows).toBeLessThanOrEqual(5);
      expect(board.placed.every((p) => !p.down)).toBe(true);
    }
    expect(cwLayout(words('ABCDEFGHI', 'LEON'), 2, 1, 8, 5).placed.map((p) => p.word)).toEqual(['LEON']);
    // A box too small for two words to cross has one.
    expect(cwLayout(words('LEON', 'LUGO'), 2, 1, 4, 1).placed).toHaveLength(1);
    expect(cwLayout(words('LEON', 'LUGO'), 2, 1, 4, 4).placed).toHaveLength(2);
  });

  it('never starts two words in one cell: each has its number', () => {
    // Two words that share only their first letter cannot cross.
    for (const seed of SEEDS.slice(0, 10)) expect(cwLayout(words('ABC', 'ADE'), 2, seed).placed).toHaveLength(1);
    // With a letter further on in common, they do.
    for (const seed of SEEDS.slice(0, 10)) sound(cwLayout(words('ABC', 'DAE'), 2, seed));
    expect(cwLayout(words('ABC', 'DAE'), 2, 1).placed).toHaveLength(2);
  });

  it('never lays two words side by side or end to end', () => {
    // Words full of the same letters have every chance of touching.
    const alike = words('ANA', 'NANA', 'ANANA', 'NAAN', 'ANNA', 'NANAN');
    for (const seed of SEEDS) sound(cwLayout(alike, 6, seed), `seed ${seed}`);
  });

  it('keeps, of the ways it tried, one in which the words cross a good deal and take little room', () => {
    let crossings = 0;
    let area = 0;
    for (const seed of SEEDS) {
      const board = cwLayout(PROVINCES, 10, seed);
      const cells = new Set(board.placed.flatMap((p) => cellsOf(p).map(({ r, c }) => cwKey(r, c))));
      const crossed = board.placed.reduce((n, p) => n + p.word.length, 0) - cells.size;
      // Ten words that hang together cross nine times at least.
      expect(crossed).toBeGreaterThanOrEqual(9);
      crossings += crossed;
      area += board.rows * board.cols;
    }
    // Of the ways that were tried, one in which some word crosses two others: once in each crossword, on
    // average. (Kept by lot among the ways with ten words, it is once in two.)
    expect(crossings / SEEDS.length).toBeGreaterThan(9.8);
    // The box is of 169 cells: they take a good deal less. (With the largest of the ways that cross as much, 146.)
    expect(area / SEEDS.length).toBeLessThan(141);
  });
});

describe('the crosswords of a game', () => {
  const sizes = (boards: CwBoard[]): number[] => boards.map((b) => b.placed.length);
  const ids = (boards: CwBoard[]): string[] => boards.flatMap((b) => b.placed.map((p) => p.id)).sort();

  it('are one of as many names as were asked for, when they are ten or fewer', () => {
    expect(CW_PER_BOARD).toBe(10);
    for (const seed of SEEDS.slice(0, 10)) {
      const boards = cwDeal(MANY, 10, seed, false);
      expect(sizes(boards)).toEqual([10]);
      sound(boards[0]);
    }
    expect(sizes(cwDeal(MANY, 4, 1, false))).toEqual([4]);
    expect(sizes(cwDeal(MANY, 1, 1, false))).toEqual([1]);
  });

  it('are several for a longer game, none over ten words and as full as each other', () => {
    for (const seed of SEEDS.slice(0, 6)) {
      expect(sizes(cwDeal(MANY, 20, seed, false))).toEqual([10, 10]);
      expect(sizes(cwDeal(MANY, 25, seed, false))).toEqual([9, 8, 8]);
      const all = cwDeal(MANY, 'all', seed, false);
      expect(sizes(all)).toEqual([10, 10, 10, 10, 10]);
      for (const board of all) sound(board);
      expect(ids(all)).toEqual(MANY.map((w) => w.id).sort());
    }
  });

  it('take every name in a game of a list or of the whole map, and as many as there are when more are asked for', () => {
    expect(sizes(cwDeal(PROVINCES, 5, 1, true))).toEqual([10]);
    expect(sizes(cwDeal(PROVINCES, 'all', 1, false))).toEqual([10]);
    expect(sizes(cwDeal(PROVINCES, 'endless', 1, false))).toEqual([10]);
    expect(sizes(cwDeal(PROVINCES, 50, 1, false))).toEqual([10]);
  });

  it('are none when there are no names, or none are asked for', () => {
    expect(cwDeal([], 10, 1, false)).toEqual([]);
    expect(cwDeal(PROVINCES, 0, 1, false)).toEqual([]);
    expect(cwDeal(PROVINCES, -3, 1, false)).toEqual([]);
  });

  it('deal each name once, by lot: the same for the same seed whatever the order they are given in', () => {
    const one = cwDeal(MANY, 20, 5, false);
    expect(cwDeal([...MANY].reverse(), 20, 5, false)).toEqual(one);
    expect(new Set(ids(one)).size).toBe(20);
    const picks = new Set(SEEDS.slice(0, 12).map((seed) => ids(cwDeal(MANY, 10, seed, false)).join()));
    expect(picks.size).toBeGreaterThan(8);
  });

  it('are dealt into one more, with fewer words each, when the names do not all cross in as few', () => {
    // Eight names in a box of five by five, where a crossword holds three or four of them.
    const eight = words('SORIA', 'AVILA', 'CADIZ', 'CEUTA', 'ALAVA', 'LEON', 'LUGO', 'JAEN');
    let lone = 0;
    for (const seed of SEEDS) {
      const boards = cwDeal(eight, 'all', seed, false, 8, 5, 5);
      expect(ids(boards), `seed ${seed}`).toEqual(eight.map((w) => w.id).sort());
      for (const board of boards) sound(board, `seed ${seed}`);
      expect(boards.length, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      if (Math.min(...sizes(boards)) < 2) lone++;
    }
    // Not four, three and one: three crosswords that are worth playing, nearly always.
    expect(lone).toBeLessThanOrEqual(2);
  });

  it('have no more words than a crossword may, even after one that fell short of its share', () => {
    // Two names that cross nothing, and four that cross each other: when the first two come out first, the
    // first crossword is one of them alone, and the five names left are not for two crosswords of three and two.
    const six = words('ZZZ', 'YYY', 'ABCD', 'BCDA', 'CDAB', 'DABC');
    let short = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const boards = cwDeal(six, 'all', seed, false, 2);
      expect(ids(boards), `seed ${seed}`).toEqual(six.map((w) => w.id).sort());
      expect(Math.max(...sizes(boards)), `seed ${seed}`).toBeLessThanOrEqual(2);
      if (sizes(boards)[0] === 1) short++;
    }
    expect(short).toBeGreaterThan(0);
  });

  it('give a name that crosses none of the others a crossword of its own', () => {
    const boards = cwDeal(words('LEON', 'LUGO', 'XYZ'), 'all', 1, false);
    expect(sizes(boards).sort()).toEqual([1, 2]);
    expect(ids(boards)).toEqual(['leon', 'lugo', 'xyz']);
  });

  it('leave out a name that is longer than the crossword is wide', () => {
    expect(ids(cwDeal(words('LEON', 'LUGO', 'ABCDEFGHIJKLMN'), 'all', 1, false))).toEqual(['leon', 'lugo']);
    expect(cwDeal(words('ABCDEFGHIJKLMN'), 'all', 1, false)).toEqual([]);
  });
});

describe('the cells of a crossword', () => {
  //   L U G O
  //   E . . .
  //   O . . .
  //   N A O S
  const board: CwBoard = { rows: 4, cols: 4, placed: [at('LUGO', 0, 0, false, 1), at('LEON', 0, 0, true, 2, 'x'), at('NAOS', 3, 0, false, 3)] };

  it('are the ones a word goes through, in the order they are read, each with its letter and its words', () => {
    const cells = cwCells(board);
    expect([...cells.keys()]).toEqual(['0,0', '0,1', '0,2', '0,3', '1,0', '2,0', '3,0', '3,1', '3,2', '3,3']);
    expect(cells.get('0,0')).toEqual({ r: 0, c: 0, ch: 'L', across: 0, down: 1, n: 2 });
    expect(cells.get('0,2')).toEqual({ r: 0, c: 2, ch: 'G', across: 0, down: -1, n: 0 });
    expect(cells.get('2,0')).toEqual({ r: 2, c: 0, ch: 'O', across: -1, down: 1, n: 0 });
    expect(cells.get('3,0')).toEqual({ r: 3, c: 0, ch: 'N', across: 2, down: 1, n: 3 });
    expect(cells.get('1,1')).toBeUndefined();
  });

  it('carry the number of the word that starts in them', () => {
    const made = cwLayout(PROVINCES, 10, 4);
    const cells = cwCells(made);
    for (const p of made.placed) expect(cells.get(cwKey(p.r, p.c))?.n).toBe(p.n);
    expect([...cells.values()].filter((cell) => cell.n > 0)).toHaveLength(10);
    // Every cell is in a word, and a cell where two cross is in both.
    for (const cell of cells.values()) expect(cell.across >= 0 || cell.down >= 0).toBe(true);
    expect([...cells.values()].filter((cell) => cell.across >= 0 && cell.down >= 0).length).toBeGreaterThanOrEqual(9);
  });

  it('stand for the word that goes the way that is wanted, or for the other one', () => {
    const cells = cwCells(board);
    expect(wordAt(cells.get('0,0'), false)).toBe(0);
    expect(wordAt(cells.get('0,0'), true)).toBe(1);
    expect(wordAt(cells.get('0,2'), true)).toBe(0);
    expect(wordAt(cells.get('2,0'), false)).toBe(1);
    expect(wordAt(undefined, false)).toBe(-1);
  });

  it('lie along a row or down a column, from the first letter of the word', () => {
    expect(cellsOf(at('LEON', 2, 3, false, 1))).toEqual([
      { r: 2, c: 3 },
      { r: 2, c: 4 },
      { r: 2, c: 5 },
      { r: 2, c: 6 },
    ]);
    expect(cellsOf(at('LEO', 2, 3, true, 1))).toEqual([
      { r: 2, c: 3 },
      { r: 3, c: 3 },
      { r: 4, c: 3 },
    ]);
  });
});

describe('a word that is being written', () => {
  const lugo = at('LUGO', 0, 0, false, 1);
  const leon = at('LEON', 0, 0, true, 2);

  it('is full when each of its cells has a letter, and right when they are its own', () => {
    expect(cwFull(lugo, {})).toBe(false);
    expect(cwFull(lugo, { '0,0': 'L', '0,1': 'U', '0,2': 'G' })).toBe(false);
    expect(cwFull(lugo, { '0,0': 'L', '0,1': 'U', '0,2': 'G', '0,3': 'O' })).toBe(true);
    expect(cwRight(lugo, { '0,0': 'L', '0,1': 'U', '0,2': 'G', '0,3': 'O' })).toBe(true);
    expect(cwFull(lugo, { '0,0': 'L', '0,1': 'U', '0,2': 'G', '0,3': 'A' })).toBe(true);
    expect(cwRight(lugo, { '0,0': 'L', '0,1': 'U', '0,2': 'G', '0,3': 'A' })).toBe(false);
    expect(cwRight(lugo, { '0,0': 'L', '0,1': 'U', '0,2': 'G' })).toBe(false);
    // The letters of another word are not its own.
    expect(cwFull(leon, { '0,0': 'L', '0,1': 'U', '0,2': 'G', '0,3': 'O' })).toBe(false);
    expect(cwRight(leon, { '0,0': 'L', '1,0': 'E', '2,0': 'O', '3,0': 'N' })).toBe(true);
  });

  it('goes on to its next cell that can be written in, forwards or backwards, and stays when there is none', () => {
    const all = (): boolean => true;
    expect(cwStep(lugo, 0, false, all)).toBe(1);
    expect(cwStep(lugo, 3, false, all)).toBe(3);
    expect(cwStep(lugo, 2, true, all)).toBe(1);
    expect(cwStep(lugo, 0, true, all)).toBe(0);
    // Over the cells that are settled.
    const shut = new Set(['0,1', '0,2']);
    const open = ({ r, c }: { r: number; c: number }): boolean => !shut.has(cwKey(r, c));
    expect(cwStep(lugo, 0, false, open)).toBe(3);
    expect(cwStep(lugo, 3, true, open)).toBe(0);
    expect(cwStep(lugo, 1, false, () => false)).toBe(1);
    expect(cwStep(leon, 1, false, ({ r }) => r === 3)).toBe(3);
  });

  it('is right first time when it was written with nothing given and nothing wrong before, with help otherwise, and to review when it was not', () => {
    expect(cwRes(true, true)).toBe('ok');
    expect(cwRes(true, false)).toBe('warn');
    expect(cwRes(false, true)).toBe('bad');
    expect(cwRes(false, false)).toBe('bad');
  });
});
