/** «Sopa de letras»: how a name is written in the square, how the names are dealt, how a square is made and what a marked line is worth. */
import { describe, expect, it } from 'vitest';
import { WS_DIRS, WS_MIN, WS_PER_BOARD, WS_RUDE, WS_SIDE, cellsOf, fitsGrid, gridWord, lineOf, readingsIn, snapTo, spelled, strayIn, wsBoard, wsDeal, wsMatch, wsPool, wsRes, type Cell, type WsBoard, type WsPlaced, type WsWord } from './wordsearch';

const words = (...names: string[]): WsWord[] => names.map((name) => ({ id: name.toLowerCase(), word: name }));
const PROVINCES = words('LEON', 'TERUEL', 'SORIA', 'LUGO', 'CADIZ', 'HUESCA', 'ZAMORA', 'BADAJOZ', 'ALBACETE', 'GUADALAJARA');
const COUNTRIES = words('CHAD', 'PERU', 'CUBA', 'ITALIA', 'FRANCIA', 'PORTUGAL', 'ALEMANIA', 'MARRUECOS', 'ARGENTINA', 'NUEVAZELANDA');
const SHORT = words('AIN', 'LOT', 'VAR', 'EURE', 'GARD', 'GERS', 'JURA', 'NORD', 'OISE', 'TARN');
const TWELVE = words('ABCDEFGHIJKL', 'BCDEFGHIJKLM', 'CDEFGHIJKLMN', 'DEFGHIJKLMNO', 'EFGHIJKLMNOP', 'FGHIJKLMNOPQ', 'GHIJKLMNOPQR', 'HIJKLMNOPQRS', 'IJKLMNOPQRST', 'JKLMNOPQRSTU', 'KLMNOPQRSTUV', 'LMNOPQRSTUVW');
const SEEDS = Array.from({ length: 120 }, (_, i) => i * 7919 + 13);
const cell = (r: number, c: number): Cell => ({ r, c });
const key = ({ r, c }: Cell): string => `${r},${c}`;

/** A square written by hand: its rows, and the names said to be hidden in it. */
const byHand = (rows: string[], placed: WsPlaced[] = []): WsBoard => ({ side: rows.length, rows, placed });
const at = (word: string, r: number, c: number, dr: number, dc: number, id = word.toLowerCase()): WsPlaced => ({ id, word, r, c, dr, dc });

describe('a name as it is written in the square', () => {
  it('is its letters alone, in capitals, with no spaces, hyphens or apostrophes', () => {
    expect(gridWord('León', 'es')).toBe('LEON');
    expect(gridWord('Ciudad Real', 'es')).toBe('CIUDADREAL');
    expect(gridWord('Baden-Wurtemberg', 'es')).toBe('BADENWURTEMBERG');
    expect(gridWord("Côte d'Ivoire", 'en')).toBe('COTEDIVOIRE');
    expect(gridWord('Côte d’Ivoire', 'en')).toBe('COTEDIVOIRE');
    expect(gridWord('Washington D. C.', 'es')).toBe('WASHINGTONDC');
    expect(gridWord('  Lugo ', 'es')).toBe('LUGO');
  });

  it('has no accents, and keeps the Ñ in Spanish, where it is a letter of its own', () => {
    expect(gridWord('Cádiz', 'es')).toBe('CADIZ');
    expect(gridWord('Guipúzcoa', 'es')).toBe('GUIPUZCOA');
    expect(gridWord('Saint-Étienne', 'es')).toBe('SAINTETIENNE');
    expect(gridWord('La Coruña', 'es')).toBe('LACORUÑA');
    expect(gridWord('A Coruña', 'en')).toBe('ACORUNA');
    expect(gridWord('Łódź', 'en')).toBe('LODZ');
    // Written with a letter and a mark that goes with it, instead of one character for both.
    expect(gridWord('Leo\u0301n', 'es')).toBe('LEON');
    expect(gridWord('Corun\u0303a', 'es')).toBe('CORUÑA');
  });

  it('is nothing when the name has a figure, or a letter that no letter of the alphabet stands for', () => {
    expect(gridWord('Línea 2', 'es')).toBe('');
    expect(gridWord('25 de Mayo', 'es')).toBe('');
    expect(gridWord('Gießen', 'es')).toBe('');
    expect(gridWord('Москва', 'es')).toBe('');
    expect(gridWord('', 'es')).toBe('');
    expect(gridWord(' - ', 'es')).toBe('');
  });

  it('fits when it has from three letters to as many as the side of the square', () => {
    expect(WS_MIN).toBe(3);
    expect(WS_SIDE).toBe(12);
    expect(fitsGrid('')).toBe(false);
    expect(fitsGrid('PO')).toBe(false);
    expect(fitsGrid('AIN')).toBe(true);
    expect(fitsGrid('NUEVAZELANDA')).toBe(true);
    expect(fitsGrid('CASTILLAYLEON')).toBe(false);
    expect(fitsGrid('CASTILLAYLEON', 13)).toBe(true);
    expect(fitsGrid('LUGO', 3)).toBe(false);
  });
});

describe('the names of a game', () => {
  const items = [
    { id: 'le', name: 'León' },
    { id: 'tf', name: 'Santa Cruz de Tenerife' },
    { id: 'c', name: 'La Coruña' },
    { id: 'po', name: 'Po' },
    { id: 'te', name: 'Teruel' },
    { id: 'n2', name: 'Nacional 2' },
  ];

  it('are those that can be hidden, and the others are told apart', () => {
    const pool = wsPool(items, undefined, 'es');
    expect(pool.words).toEqual([
      { id: 'le', word: 'LEON' },
      { id: 'c', word: 'LACORUÑA' },
      { id: 'te', word: 'TERUEL' },
    ]);
    expect(pool.left).toEqual(['tf', 'po', 'n2']);
    expect(wsPool(items, undefined, 'en').words[1]).toEqual({ id: 'c', word: 'LACORUNA' });
  });

  it('are those of the list, when the game is of one', () => {
    const pool = wsPool(items, ['te', 'tf', 'nowhere'], 'es');
    expect(pool.words).toEqual([{ id: 'te', word: 'TERUEL' }]);
    expect(pool.left).toEqual(['tf']);
    expect(wsPool(items, [], 'es')).toEqual({ words: [], left: [] });
  });

  it('depend on the side of the square', () => {
    expect(wsPool(items, undefined, 'es', 5).words.map((w) => w.id)).toEqual(['le']);
    expect(wsPool(items, undefined, 'es', 30).words.map((w) => w.id)).toEqual(['le', 'tf', 'c', 'te']);
  });
});

describe('the squares of a game', () => {
  const many = (n: number): WsWord[] => Array.from({ length: n }, (_, i) => ({ id: `p${String(i).padStart(3, '0')}`, word: `NAME${i}` }));
  const sizes = (n: number, length: number | string = 'all', whole = false): number[] => wsDeal(many(n), length, 5, whole).map((b) => b.length);

  it('are one of as many names as were asked for, when they are ten or fewer', () => {
    expect(WS_PER_BOARD).toBe(10);
    expect(sizes(30, 10)).toEqual([10]);
    expect(sizes(30, 3)).toEqual([3]);
    expect(sizes(7, 10)).toEqual([7]);
    expect(sizes(10, 10)).toEqual([10]);
  });

  it('are several for a longer game, none over ten names and as full as each other', () => {
    expect(sizes(60, 20)).toEqual([10, 10]);
    expect(sizes(60, 50)).toEqual([10, 10, 10, 10, 10]);
    expect(sizes(11)).toEqual([6, 5]);
    expect(sizes(25)).toEqual([9, 8, 8]);
    expect(sizes(52)).toEqual([9, 9, 9, 9, 8, 8]);
    expect(sizes(21)).toEqual([7, 7, 7]);
    expect(sizes(60, 20, false)).toEqual([10, 10]);
    for (let n = 0; n <= 75; n++) {
      const dealt = sizes(n);
      expect(dealt.reduce((a, b) => a + b, 0), `${n} names`).toBe(n);
      expect(dealt.length, `${n} names`).toBe(Math.ceil(n / 10));
      if (dealt.length) expect(Math.max(...dealt) - Math.min(...dealt), `${n} names`).toBeLessThanOrEqual(1);
      expect(Math.max(0, ...dealt), `${n} names`).toBeLessThanOrEqual(10);
    }
  });

  it('take every name in a game of a list or of the whole map', () => {
    expect(sizes(25, 'all')).toEqual([9, 8, 8]);
    expect(sizes(25, 10, true)).toEqual([9, 8, 8]);
    expect(sizes(25, 10, false)).toEqual([10]);
  });

  it('are none when there are no names, or none are asked for', () => {
    expect(wsDeal([], 10, 1, false)).toEqual([]);
    expect(wsDeal([], 'all', 1, true)).toEqual([]);
    expect(wsDeal(many(5), 0, 1, false)).toEqual([]);
    expect(wsDeal(many(5), -3, 1, false)).toEqual([]);
  });

  it('deal each name once, by lot: the same for the same seed whatever the order they are given in', () => {
    const pool = many(40);
    const a = wsDeal(pool, 20, 77, false);
    expect(wsDeal([...pool].reverse(), 20, 77, false)).toEqual(a);
    expect(wsDeal(pool, 20, 77, false)).toEqual(a);
    const ids = a.flat().map((w) => w.id);
    expect(new Set(ids).size).toBe(20);
    expect(ids).not.toEqual([...ids].sort());
    const others = new Set(SEEDS.slice(0, 20).map((seed) => wsDeal(pool, 20, seed, false).flat().map((w) => w.id).join()));
    expect(others.size).toBeGreaterThan(15);
    // A shorter game is the start of a longer one with the same seed.
    expect(wsDeal(pool, 10, 77, false)[0]).toEqual(a.flat().slice(0, 10));
  });

  it('can be of another size', () => {
    expect(wsDeal(many(9), 'all', 1, false, 4).map((b) => b.length)).toEqual([3, 3, 3]);
    expect(wsDeal(many(9), 'all', 1, false, 9).map((b) => b.length)).toEqual([9]);
  });
});

describe('a square', () => {
  it('has twelve rows of twelve letters, and every name in it where it says', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const board = wsBoard(PROVINCES, seed);
      expect(board.side).toBe(12);
      expect(board.rows).toHaveLength(12);
      for (const row of board.rows) expect(row).toMatch(/^[A-ZÑ]{12}$/);
      expect(board.placed.map((p) => p.id)).toEqual(PROVINCES.map((w) => w.id));
      for (const p of board.placed) {
        expect(spelled(board.rows, cellsOf(p)), `${p.word} @${seed}`).toBe(p.word);
        for (const { r, c } of cellsOf(p)) {
          expect(r >= 0 && r < 12, `${p.word} @${seed}`).toBe(true);
          expect(c >= 0 && c < 12, `${p.word} @${seed}`).toBe(true);
        }
      }
    }
  });

  it('writes names from left to right, downwards and slanting to the right: never backwards', () => {
    expect(WS_DIRS).toEqual([
      [0, 1],
      [1, 0],
      [1, 1],
      [-1, 1],
    ]);
    const used = new Map<string, number>();
    for (const seed of SEEDS) {
      for (const p of wsBoard(PROVINCES, seed).placed) {
        const way = `${p.dr},${p.dc}`;
        used.set(way, (used.get(way) ?? 0) + 1);
        expect(p.dc === 1 || (p.dc === 0 && p.dr === 1), `${p.word} @${seed}: ${way}`).toBe(true);
      }
    }
    expect([...used.keys()].sort()).toEqual(['-1,1', '0,1', '1,0', '1,1']);
    // Along a row or a column twice as often as along each slant: two thirds of the names.
    const total = [...used.values()].reduce((a, b) => a + b, 0);
    const straight = ((used.get('0,1') ?? 0) + (used.get('1,0') ?? 0)) / total;
    expect(straight).toBeGreaterThan(0.58);
    expect(straight).toBeLessThan(0.76);
    expect((used.get('0,1') ?? 0) / total).toBeGreaterThan(0.24);
    expect((used.get('1,0') ?? 0) / total).toBeGreaterThan(0.24);
    expect((used.get('1,1') ?? 0) / total).toBeGreaterThan(0.1);
    expect((used.get('-1,1') ?? 0) / total).toBeGreaterThan(0.1);
  });

  it('is the same for the same names and the same seed, and another with another seed', () => {
    expect(wsBoard(PROVINCES, 42)).toEqual(wsBoard(PROVINCES, 42));
    expect(wsBoard(PROVINCES, 42).rows).not.toEqual(wsBoard(PROVINCES, 43).rows);
    expect(wsBoard(PROVINCES, 42).rows).not.toEqual(wsBoard(COUNTRIES, 42).rows);
    expect(new Set(SEEDS.slice(0, 30).map((seed) => wsBoard(PROVINCES, seed).rows.join())).size).toBe(30);
  });

  it('puts the names in different places from one square to another', () => {
    const starts = new Set(SEEDS.map((seed) => wsBoard(PROVINCES, seed).placed.find((p) => p.word === 'LUGO')!).map((p) => `${p.r},${p.c}`));
    expect(starts.size).toBeGreaterThan(60);
  });

  it('lets names cross where they share a letter, and never run along each other', () => {
    let crossed = 0;
    for (const list of [COUNTRIES, PROVINCES, words('LEON', 'NAVARRA', 'ARABA', 'ALAVA', 'AVILA', 'LALIN', 'NOIA', 'ARONA', 'ONA', 'ANOIA')]) {
      for (const seed of SEEDS) {
        const seen = new Map<string, string>();
        for (const p of wsBoard(list, seed).placed) {
          const way = `${p.dr},${p.dc}`;
          for (const c of cellsOf(p)) {
            const before = seen.get(key(c));
            if (before == null) seen.set(key(c), way);
            else {
              crossed++;
              // Two names through one cell go different ways: LEONAVARRA along a row is not two names in sight.
              expect(before.split(' '), `${p.word} @${seed}`).not.toContain(way);
              seen.set(key(c), `${before} ${way}`);
            }
          }
        }
      }
    }
    expect(crossed).toBeGreaterThan(100);
  });

  it('is filled with the letters of its names and a few common ones', () => {
    const allowed = new Set([...PROVINCES.flatMap((w) => [...w.word]), ...'AEIOULNRSTCDMP']);
    const seen = new Set<string>();
    for (const seed of SEEDS.slice(0, 30)) for (const row of wsBoard(PROVINCES, seed).rows) for (const ch of row) seen.add(ch);
    for (const ch of seen) expect(allowed.has(ch), ch).toBe(true);
    // Every one of them comes up: the filling says nothing of which letters are of a name.
    expect(seen.size).toBe(allowed.size);
    // A letter that only one name has is not alone in the square.
    const zs = SEEDS.slice(0, 30).map((seed) => wsBoard(words('ZAMORA', 'LEON', 'SORIA'), seed).rows.join('').split('Z').length - 1);
    expect(zs.filter((n) => n > 1).length).toBeGreaterThan(15);
  });

  it('has each name once: the filling does not write it again, either way', () => {
    for (const list of [PROVINCES, COUNTRIES, SHORT]) {
      for (const seed of SEEDS) {
        const board = wsBoard(list, seed);
        for (const w of list) expect(readingsIn(board.rows, [w.word]), `${w.word} @${seed}`).toHaveLength(1);
        expect(strayIn(board), `@${seed}`).toEqual([]);
      }
    }
  });

  it('would have names written twice without that care', () => {
    // The same squares before the filling is looked over: three letters come up by chance all the time.
    let twice = 0;
    for (const seed of SEEDS) {
      const board = wsBoard(SHORT, seed);
      const loose = board.rows.map((row) => [...row]);
      // Letters drawn with no care at all, where no name lies.
      const fixed = new Set(board.placed.flatMap((p) => cellsOf(p).map(key)));
      let n = seed;
      for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) if (!fixed.has(`${r},${c}`)) loose[r][c] = 'AINLOTVR'[(n = (n * 31 + 7) % 1009) % 8];
      if (strayIn({ rows: loose.map((row) => row.join('')), placed: board.placed }).length) twice++;
    }
    expect(twice).toBeGreaterThan(100);
  });

  it('spells none of the words a class would laugh at', () => {
    const teasing = words('CACAO', 'PECULO', 'TORPEDO', 'DISPUTA', 'POLLO', 'TETERA', 'PENEDO', 'CONOR', 'ACULO', 'APEDO');
    let kept = 0;
    for (const seed of SEEDS) {
      const board = wsBoard(teasing, seed);
      const rude = readingsIn(board.rows, WS_RUDE);
      // What a name itself spells stays: the name is what it is.
      for (const hit of rude) {
        const inside = board.placed.some((p) => {
          const own = new Set(cellsOf(p).map(key));
          return hit.cells.every((c) => own.has(key(c)));
        });
        expect(inside, `${hit.word} @${seed}`).toBe(true);
        kept++;
      }
    }
    // CACA in CACAO, CULO in PECULO and ACULO, PEDO in TORPEDO and APEDO, PUTA in DISPUTA, TETA… is not in TETERA, PENE in PENEDO, CONO in CONOR.
    expect(kept).toBe(SEEDS.length * 8);
    expect(WS_RUDE.every((w) => w.length >= 4 && /^[A-ZÑ]+$/.test(w))).toBe(true);
    expect(new Set(WS_RUDE).size).toBe(WS_RUDE.length);
  });

  it('holds ten names of twelve letters, each along a line of its own', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const board = wsBoard(TWELVE.slice(0, 10), seed);
      expect(board.placed).toHaveLength(10);
      for (const p of board.placed) expect(spelled(board.rows, cellsOf(p)), `${p.word} @${seed}`).toBe(p.word);
    }
  });

  it('falls back on a row for each name when they fit no other way', () => {
    for (const seed of SEEDS.slice(0, 12)) {
      const board = wsBoard(TWELVE, seed);
      expect(board.placed).toHaveLength(12);
      for (const p of board.placed) expect(spelled(board.rows, cellsOf(p)), `${p.word} @${seed}`).toBe(p.word);
      expect(new Set(board.placed.map((p) => `${p.r}|${p.c}|${p.dr}|${p.dc}`)).size).toBe(12);
    }
    // A row each, in an order that is drawn by lot.
    const board = wsBoard(TWELVE, 3);
    expect(board.placed.every((p) => p.dr === 0 && p.dc === 1 && p.c === 0)).toBe(true);
    expect(board.placed.map((p) => p.r)).not.toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect([...board.placed.map((p) => p.r)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('gives each name a row when they cannot be scattered, as many as there are rows, and stays inside the square', () => {
    // Four names of three letters that share none cannot lie on a square of three rows: three of them do.
    const four = words('ABC', 'DEF', 'GHI', 'JKL');
    const orders = new Set<string>();
    for (const seed of SEEDS.slice(0, 20)) {
      const board = wsBoard(four, seed, 3);
      expect(board.placed.map((p) => p.word)).toEqual(['ABC', 'DEF', 'GHI']);
      expect(board.rows.map((row) => row.length)).toEqual([3, 3, 3]);
      expect(board.placed.every((p) => p.dr === 0 && p.dc === 1 && p.c === 0)).toBe(true);
      expect([...board.placed.map((p) => p.r)].sort((a, b) => a - b)).toEqual([0, 1, 2]);
      for (const p of board.placed) expect(spelled(board.rows, cellsOf(p))).toBe(p.word);
      orders.add(board.placed.map((p) => p.r).join(''));
    }
    // Which row each one gets is drawn by lot.
    expect(orders.size).toBeGreaterThan(3);
    // A shorter name starts anywhere it fits along its row, and no further.
    const starts = new Set<number>();
    for (const seed of SEEDS.slice(0, 40)) {
      const board = wsBoard(words('AB', 'CDE', 'FGH', 'IJK'), seed, 3);
      expect(board.placed.map((p) => p.word)).toEqual(['AB', 'CDE', 'FGH']);
      expect(board.rows.map((row) => row.length)).toEqual([3, 3, 3]);
      for (const p of board.placed) expect(spelled(board.rows, cellsOf(p))).toBe(p.word);
      starts.add(board.placed[0].c);
    }
    expect([...starts].sort()).toEqual([0, 1]);
  });

  it('is not filled with a letter as often as the names have it: names full of As do not make rows of As', () => {
    const list = words('ALAVA', 'ALMANSA', 'ARANDA', 'ATACAMA', 'CANADA', 'GRANADA', 'MALAGA', 'PANAMA', 'SAHARA', 'ZARAGOZA');
    let filling = 0;
    let as = 0;
    for (const seed of SEEDS.slice(0, 20)) {
      const board = wsBoard(list, seed);
      const own = new Set(board.placed.flatMap((p) => cellsOf(p).map(key)));
      board.rows.forEach((row, r) =>
        [...row].forEach((ch, c) => {
          if (own.has(key(cell(r, c)))) return;
          filling++;
          if (ch === 'A') as++;
        }),
      );
    }
    // Half the letters of these names are As: drawn as often as the names have them, so would be the filling.
    expect(as / filling).toBeLessThan(0.15);
    expect(as).toBeGreaterThan(0);
  });

  it('can hold one name, or none', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const board = wsBoard(words('LEON'), seed);
      expect(board.placed).toHaveLength(1);
      expect(readingsIn(board.rows, ['LEON']), `@${seed}`).toHaveLength(1);
      expect(new Set(board.rows.join('')).size).toBeGreaterThan(8);
    }
    const empty = wsBoard([], 9);
    expect(empty.placed).toEqual([]);
    expect(empty.rows).toHaveLength(12);
    for (const row of empty.rows) expect(row).toMatch(/^[AEIOULNRSTCDMP]{12}$/);
  });

  it('can hold two names that are written alike, each in its place', () => {
    const twins = [...words('LEON', 'TERUEL'), { id: 'valencia-es', word: 'VALENCIA' }, { id: 'valencia-ve', word: 'VALENCIA' }];
    for (const seed of SEEDS.slice(0, 40)) {
      const board = wsBoard(twins, seed);
      const [a, b] = board.placed.filter((p) => p.word === 'VALENCIA');
      expect([a.id, b.id]).toEqual(['valencia-es', 'valencia-ve']);
      expect(cellsOf(a).map(key)).not.toEqual(cellsOf(b).map(key));
      expect(readingsIn(board.rows, ['VALENCIA']), `@${seed}`).toHaveLength(2);
      expect(strayIn(board), `@${seed}`).toEqual([]);
    }
  });

  it('can be of another side', () => {
    const board = wsBoard(words('LEON', 'LUGO'), 4, 6);
    expect(board.side).toBe(6);
    expect(board.rows.map((r) => r.length)).toEqual([6, 6, 6, 6, 6, 6]);
    for (const p of board.placed) expect(spelled(board.rows, cellsOf(p))).toBe(p.word);
  });
});

describe('what can be read in a square', () => {
  const rows = ['LEONX', 'XUXOX', 'XXGXE', 'XNXOL', 'OXXXX'];

  it('is found along rows, columns and slants, either way, with the cells from the first letter to the last', () => {
    expect(readingsIn(rows, ['LEON'])).toEqual([{ word: 'LEON', cells: [cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3)] }]);
    expect(readingsIn(rows, ['LUGO'])).toEqual([{ word: 'LUGO', cells: [cell(0, 0), cell(1, 1), cell(2, 2), cell(3, 3)] }]);
    // Backwards along a row, upwards along a column, and up a slant to the right.
    expect(readingsIn(rows, ['NOEL'])).toEqual([{ word: 'NOEL', cells: [cell(0, 3), cell(0, 2), cell(0, 1), cell(0, 0)] }]);
    expect(readingsIn(rows, ['LE'])).toEqual([
      { word: 'LE', cells: [cell(0, 0), cell(0, 1)] },
      { word: 'LE', cells: [cell(3, 4), cell(2, 4)] },
    ]);
    expect(readingsIn(rows, ['ONG'])).toEqual([{ word: 'ONG', cells: [cell(4, 0), cell(3, 1), cell(2, 2)] }]);
    expect(readingsIn(rows, ['GNO'])).toEqual([{ word: 'GNO', cells: [cell(2, 2), cell(3, 1), cell(4, 0)] }]);
    expect(readingsIn(rows, ['OGU'])).toEqual([{ word: 'OGU', cells: [cell(3, 3), cell(2, 2), cell(1, 1)] }]);
    for (const hit of readingsIn(rows, ['LEON', 'LUGO', 'NOEL', 'LE', 'ONG', 'GNO', 'OGU', 'EL', 'NO'])) expect(spelled(rows, hit.cells)).toBe(hit.word);
  });

  it('is not read across a cell that has no letter', () => {
    expect(
      readingsIn(
        [
          ['L', '', 'E'],
          ['', '', ''],
          ['', '', ''],
        ],
        ['LE', 'EL'],
      ),
    ).toEqual([]);
  });

  it('counts each place once, also for a word that reads the same both ways', () => {
    expect(readingsIn(['ANA', 'XXX', 'XXX'], ['ANA'])).toEqual([{ word: 'ANA', cells: [cell(0, 0), cell(0, 1), cell(0, 2)] }]);
    expect(readingsIn(['ANANA', 'XXXXX', 'XXXXX', 'XXXXX', 'XXXXX'], ['ANA'])).toHaveLength(2);
    expect(readingsIn(['AA', 'AA'], ['AA'])).toHaveLength(6);
    expect(readingsIn(['AB', 'BA'], ['AB'])).toHaveLength(4);
    expect(readingsIn(rows, ['LEON', 'LEON'])).toHaveLength(1);
    expect(readingsIn(rows, [''])).toEqual([]);
    expect(readingsIn(rows, ['ZZZ'])).toEqual([]);
    expect(readingsIn([], ['A'])).toEqual([]);
  });

  it('is astray when it is a name written again, or a word of the list, and not where the names were hidden', () => {
    const board = byHand(rows, [at('LEON', 0, 0, 0, 1), at('LUGO', 0, 0, 1, 1)]);
    expect(strayIn(board)).toEqual([]);
    // The same letters with nothing said to be hidden there: nothing to be astray.
    expect(strayIn(byHand(rows))).toEqual([]);
    // LEON a second time, upwards along the last column.
    const twice = byHand(['LEONX', 'XUXXN', 'XXGXO', 'XXXOE', 'XXXXL'], [at('LEON', 0, 0, 0, 1), at('LUGO', 0, 0, 1, 1)]);
    expect(strayIn(twice)).toEqual([{ word: 'LEON', cells: [cell(4, 4), cell(3, 4), cell(2, 4), cell(1, 4)] }]);
    expect(strayIn(byHand(['CACAX', 'XXXXX', 'XXXXX', 'XXXXX', 'ODEPX']))).toEqual([
      { word: 'CACA', cells: [cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3)] },
      { word: 'PEDO', cells: [cell(4, 3), cell(4, 2), cell(4, 1), cell(4, 0)] },
    ]);
    // A name that reads the same both ways lies where it was hidden whichever end it is read from.
    expect(strayIn(byHand(['ORURO', 'XXXXX', 'XXXXX', 'XXXXX', 'XXXXX'], [at('ORURO', 0, 0, 0, 1)]))).toEqual([]);
  });
});

describe('a line of cells', () => {
  it('goes from one cell to another along a row, a column or a slant, both among them', () => {
    expect(lineOf(cell(2, 1), cell(2, 4))).toEqual([cell(2, 1), cell(2, 2), cell(2, 3), cell(2, 4)]);
    expect(lineOf(cell(2, 4), cell(2, 1))).toEqual([cell(2, 4), cell(2, 3), cell(2, 2), cell(2, 1)]);
    expect(lineOf(cell(0, 3), cell(2, 3))).toEqual([cell(0, 3), cell(1, 3), cell(2, 3)]);
    expect(lineOf(cell(2, 3), cell(0, 3))).toEqual([cell(2, 3), cell(1, 3), cell(0, 3)]);
    expect(lineOf(cell(1, 1), cell(3, 3))).toEqual([cell(1, 1), cell(2, 2), cell(3, 3)]);
    expect(lineOf(cell(3, 3), cell(1, 1))).toEqual([cell(3, 3), cell(2, 2), cell(1, 1)]);
    expect(lineOf(cell(3, 1), cell(1, 3))).toEqual([cell(3, 1), cell(2, 2), cell(1, 3)]);
    expect(lineOf(cell(1, 3), cell(3, 1))).toEqual([cell(1, 3), cell(2, 2), cell(3, 1)]);
    expect(lineOf(cell(5, 5), cell(5, 5))).toEqual([cell(5, 5)]);
  });

  it('is none between two cells that are not in line', () => {
    expect(lineOf(cell(0, 0), cell(1, 2))).toBeNull();
    expect(lineOf(cell(0, 0), cell(2, 1))).toBeNull();
    expect(lineOf(cell(4, 4), cell(1, 5))).toBeNull();
    expect(lineOf(cell(3, 0), cell(0, 11))).toBeNull();
  });

  it('follows the finger: it ends at the cell in line that is nearest to it', () => {
    const from = cell(5, 5);
    // On a line already: there.
    expect(snapTo(from, cell(5, 9), 12)).toEqual(cell(5, 9));
    expect(snapTo(from, cell(1, 5), 12)).toEqual(cell(1, 5));
    expect(snapTo(from, cell(8, 8), 12)).toEqual(cell(8, 8));
    expect(snapTo(from, cell(2, 8), 12)).toEqual(cell(2, 8));
    expect(snapTo(from, cell(8, 2), 12)).toEqual(cell(8, 2));
    expect(snapTo(from, cell(3, 3), 12)).toEqual(cell(3, 3));
    expect(snapTo(from, from, 12)).toEqual(from);
    // A little off a row or a column: along it, as far as the finger went.
    expect(snapTo(from, cell(6, 10), 12)).toEqual(cell(5, 10));
    expect(snapTo(from, cell(4, 0), 12)).toEqual(cell(5, 0));
    expect(snapTo(from, cell(11, 6), 12)).toEqual(cell(11, 5));
    expect(snapTo(from, cell(0, 4), 12)).toEqual(cell(0, 5));
    expect(snapTo(from, cell(7, 11), 12)).toEqual(cell(5, 11));
    // Nearer to a slant: along it.
    expect(snapTo(from, cell(8, 9), 12)).toEqual(cell(9, 9));
    expect(snapTo(from, cell(9, 8), 12)).toEqual(cell(9, 9));
    expect(snapTo(from, cell(2, 9), 12)).toEqual(cell(1, 9));
    expect(snapTo(from, cell(7, 2), 12)).toEqual(cell(8, 2));
    expect(snapTo(from, cell(8, 11), 12)).toEqual(cell(10, 10));
    expect(snapTo(cell(0, 0), cell(1, 2), 12)).toEqual(cell(2, 2));
    expect(snapTo(cell(0, 0), cell(1, 3), 12)).toEqual(cell(0, 3));
  });

  it('never leaves the square', () => {
    // Along a slant the square ends before the finger does.
    expect(snapTo(cell(9, 5), cell(11, 9), 12)).toEqual(cell(11, 7));
    expect(snapTo(cell(1, 9), cell(0, 11), 12)).toEqual(cell(0, 10));
    expect(snapTo(cell(10, 10), cell(11, 11), 12)).toEqual(cell(11, 11));
    expect(snapTo(cell(2, 2), cell(5, 4), 5)).toEqual(cell(4, 4));
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 12; c++) {
        for (const from of [cell(0, 0), cell(11, 11), cell(3, 8), cell(11, 0), cell(6, 6)]) {
          const end = snapTo(from, cell(r, c), 12);
          expect(end.r >= 0 && end.r < 12 && end.c >= 0 && end.c < 12, `${key(from)} → ${r},${c}`).toBe(true);
          expect(lineOf(from, end), `${key(from)} → ${r},${c}`).not.toBeNull();
          // A cell that is in line is where the line ends.
          if (lineOf(from, cell(r, c))) expect(end).toEqual(cell(r, c));
        }
      }
    }
  });

  it('spells the letters of its cells in the order they are given', () => {
    const rows = ['LEON', 'UXXX', 'GXXX', 'OXXX'];
    expect(spelled(rows, lineOf(cell(0, 0), cell(0, 3))!)).toBe('LEON');
    expect(spelled(rows, lineOf(cell(0, 3), cell(0, 0))!)).toBe('NOEL');
    expect(spelled(rows, lineOf(cell(0, 0), cell(3, 0))!)).toBe('LUGO');
    expect(spelled(rows, [])).toBe('');
    expect(spelled(rows, [cell(9, 9), cell(0, 0)])).toBe('L');
  });
});

describe('a line that the player marks', () => {
  const board = byHand(['LEONX', 'XUXXX', 'XXGXX', 'XXXOX', 'XXXXX'], [at('LEON', 0, 0, 0, 1), at('LUGO', 0, 0, 1, 1)]);
  const none = new Set<string>();
  const mark = (b: WsBoard, found: Set<string>, from: Cell, to: Cell) => wsMatch(b, found, lineOf(from, to)!);

  it('is a name when it goes from its first letter to its last, or from its last to its first', () => {
    expect(mark(board, none, cell(0, 0), cell(0, 3))).toEqual({ id: 'leon', again: false });
    expect(mark(board, none, cell(0, 3), cell(0, 0))).toEqual({ id: 'leon', again: false });
    expect(mark(board, none, cell(0, 0), cell(3, 3))).toEqual({ id: 'lugo', again: false });
    expect(mark(board, none, cell(3, 3), cell(0, 0))).toEqual({ id: 'lugo', again: false });
  });

  it('is nothing when it is part of a name, a name and something more, or other letters', () => {
    expect(mark(board, none, cell(0, 0), cell(0, 2))).toBeNull();
    expect(mark(board, none, cell(0, 1), cell(0, 3))).toBeNull();
    expect(mark(board, none, cell(0, 0), cell(0, 4))).toBeNull();
    expect(mark(board, none, cell(0, 0), cell(4, 4))).toBeNull();
    expect(mark(board, none, cell(1, 0), cell(1, 3))).toBeNull();
    expect(mark(board, none, cell(0, 0), cell(0, 0))).toBeNull();
    expect(wsMatch(board, none, [])).toBeNull();
  });

  it('says so when the name had been found already', () => {
    expect(mark(board, new Set(['leon']), cell(0, 0), cell(0, 3))).toEqual({ id: 'leon', again: true });
    expect(mark(board, new Set(['leon']), cell(0, 0), cell(3, 3))).toEqual({ id: 'lugo', again: false });
    expect(mark(board, new Set(['leon', 'lugo']), cell(3, 3), cell(0, 0))).toEqual({ id: 'lugo', again: true });
  });

  it('is the name that lies there, of two that are written alike', () => {
    const twins = byHand(['LEONX', 'XXXXX', 'XLEON', 'XXXXX', 'XXXXX'], [at('LEON', 0, 0, 0, 1, 'leon-es'), at('LEON', 2, 1, 0, 1, 'leon-mx')]);
    expect(mark(twins, none, cell(0, 0), cell(0, 3))).toEqual({ id: 'leon-es', again: false });
    expect(mark(twins, none, cell(2, 1), cell(2, 4))).toEqual({ id: 'leon-mx', again: false });
    expect(mark(twins, none, cell(2, 4), cell(2, 1))).toEqual({ id: 'leon-mx', again: false });
    expect(mark(twins, new Set(['leon-es']), cell(2, 1), cell(2, 4))).toEqual({ id: 'leon-mx', again: false });
    expect(mark(twins, new Set(['leon-mx']), cell(2, 1), cell(2, 4))).toEqual({ id: 'leon-mx', again: true });
    expect(mark(twins, new Set(['leon-mx']), cell(0, 0), cell(0, 3))).toEqual({ id: 'leon-es', again: false });
  });

  it('is a name that is written inside another, while it has not been found', () => {
    const inside = byHand(['NIGERIA', 'XXXXXXX', 'XNIGERX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX'], [at('NIGERIA', 0, 0, 0, 1), at('NIGER', 2, 1, 0, 1)]);
    expect(mark(inside, none, cell(0, 0), cell(0, 6))).toEqual({ id: 'nigeria', again: false });
    expect(mark(inside, none, cell(0, 0), cell(0, 4))).toEqual({ id: 'niger', again: false });
    expect(mark(inside, none, cell(0, 4), cell(0, 0))).toEqual({ id: 'niger', again: false });
    expect(mark(inside, new Set(['niger']), cell(0, 0), cell(0, 4))).toEqual({ id: 'niger', again: true });
    expect(mark(inside, new Set(['niger']), cell(2, 1), cell(2, 5))).toEqual({ id: 'niger', again: true });
    expect(mark(inside, new Set(['niger']), cell(0, 0), cell(0, 6))).toEqual({ id: 'nigeria', again: false });
    // Where there are two written alike and one has been found, the letters elsewhere are the other one.
    const three = byHand(['LEONX', 'XXXXX', 'XLEON', 'XXXXX', 'NOELX'], [at('LEON', 0, 0, 0, 1, 'leon-es'), at('LEON', 2, 1, 0, 1, 'leon-mx')]);
    expect(mark(three, new Set(['leon-es']), cell(4, 3), cell(4, 0))).toEqual({ id: 'leon-mx', again: false });
    expect(mark(three, none, cell(4, 0), cell(4, 3))).toEqual({ id: 'leon-es', again: false });
    expect(mark(three, new Set(['leon-es', 'leon-mx']), cell(4, 0), cell(4, 3))).toEqual({ id: 'leon-es', again: true });
  });

  it('finds every name of a square that was made, and nothing else along the lines of the others', () => {
    for (const seed of SEEDS.slice(0, 25)) {
      const made = wsBoard(COUNTRIES, seed);
      const found = new Set<string>();
      for (const p of made.placed) {
        const cells = cellsOf(p);
        expect(wsMatch(made, found, cells), `${p.word} @${seed}`).toEqual({ id: p.id, again: false });
        expect(wsMatch(made, found, [...cells].reverse()), `${p.word} @${seed}`).toEqual({ id: p.id, again: false });
        expect(wsMatch(made, found, cells.slice(1)), `${p.word} @${seed}`).toBeNull();
        expect(wsMatch(made, found, cells.slice(0, -1)), `${p.word} @${seed}`).toBeNull();
        found.add(p.id);
        expect(wsMatch(made, found, cells), `${p.word} @${seed}`).toEqual({ id: p.id, again: true });
      }
    }
  });
});

describe('how a name is marked', () => {
  it('is right first time with the map alone, with help when the names were in sight, and to review when it is not found', () => {
    expect(wsRes(true, false)).toBe('ok');
    expect(wsRes(true, true)).toBe('warn');
    expect(wsRes(false, false)).toBe('bad');
    expect(wsRes(false, true)).toBe('bad');
  });
});
