/** Bingo for a group: which pieces take part, the card each number deals, what a card has when it is checked, and the addresses of the cards. */
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  BINGO_HOWS,
  BINGO_MIN,
  BINGO_SIZES,
  BINGO_SIZE_DEFAULT,
  CARD_MAX,
  HOW_SHARE,
  CARD_OWN,
  PER_PAGE,
  SHEET_DEFAULT,
  SHEET_MAX,
  bingoGame,
  bingoKey,
  bingoPath,
  bingoUrl,
  callOf,
  callable,
  cardOf,
  drawNext,
  gapsOf,
  howName,
  howsOf,
  isHow,
  isSize,
  judge,
  judgeMarks,
  lineName,
  linesOf,
  mapPathOf,
  needOf,
  ownCard,
  parseBingo,
  poolOf,
  sizeFor,
  sizesOf,
  sourceOf,
  tightOf,
  verdictText,
  type Piece,
} from './bingo';
import { buildDeck, loadIndex, setLoader, type World } from './data';
import { deckFor } from './decks';
import { setLang } from './i18n';
import { decodeList } from './lists';
import { BINGO_PATH, canonicalPath, routeOf } from './routes';
import { NOT_EMBEDDED, NOT_GAMES } from './rules';
import { DEFAULT_OPTS, type GameConfig } from './store';
import { mulberry32 } from './text';

beforeEach(() => setLang('es'));

/** Twenty pieces called a, b, c… */
const LETTERS = Array.from({ length: 20 }, (_, i) => String.fromCharCode(97 + i));
const piece = (id: string, patch: Partial<Piece> = {}): Piece => ({ id, kind: 'unit', shape: 'area', country: {}, ...patch });

describe('the sizes of a card', () => {
  it('are three, four and five across, and four unless another is chosen', () => {
    expect(BINGO_SIZES).toEqual([3, 4, 5]);
    expect(BINGO_SIZE_DEFAULT).toBe(4);
    for (const size of BINGO_SIZES) expect(isSize(size)).toBe(true);
    for (const x of [2, 6, '4', null, undefined, 3.5]) expect(isSize(x), String(x)).toBe(false);
  });

  it('each ask of the map a third more pieces than the card has cells', () => {
    expect(BINGO_SIZES.map(needOf)).toEqual([12, 22, 34]);
    // The menus read it from the rules, without the code of the bingo: it is what the smallest card asks.
    expect(BINGO_MIN).toBe(12);
    expect(BINGO_MIN).toBe(needOf(BINGO_SIZES[0]));
  });

  it('are offered where the map has pieces for them', () => {
    expect(sizesOf(0)).toEqual([]);
    expect(sizesOf(11)).toEqual([]);
    expect(sizesOf(12)).toEqual([3]);
    expect(sizesOf(21)).toEqual([3]);
    expect(sizesOf(22)).toEqual([3, 4]);
    expect(sizesOf(33)).toEqual([3, 4]);
    expect(sizesOf(34)).toEqual([3, 4, 5]);
    expect(sizesOf(500)).toEqual([3, 4, 5]);
  });

  it('the one wanted is played where it fits, and the largest that fits where it does not', () => {
    expect(sizeFor(50, 5)).toBe(5);
    expect(sizeFor(50, 4)).toBe(4);
    expect(sizeFor(50, 3)).toBe(3);
    expect(sizeFor(30, 5)).toBe(4);
    expect(sizeFor(19, 5)).toBe(3);
    expect(sizeFor(19, 4)).toBe(3);
    expect(sizeFor(11, 3)).toBeNull();
    // Something that is no size at all: the smallest card there is, or the largest below it.
    expect(sizeFor(50, 2)).toBe(3);
    expect(sizeFor(50, 9)).toBe(5);
  });
});

describe('the pieces a bingo is played with', () => {
  it('are all those of the map, in the order of their ids, whatever order the map has them in', () => {
    const items = ['b', 'C', 'a', 'B', 'c', 'A'].map((id) => piece(id));
    expect(poolOf(items).map((p) => p.id)).toEqual(['A', 'B', 'C', 'a', 'b', 'c']);
    expect(poolOf([...items].reverse()).map((p) => p.id)).toEqual(['A', 'B', 'C', 'a', 'b', 'c']);
    // The list is not touched.
    expect(items.map((p) => p.id)).toEqual(['b', 'C', 'a', 'B', 'c', 'A']);
  });

  it('are those of the list where the game has one', () => {
    const items = ['a', 'b', 'c', 'd'].map((id) => piece(id));
    expect(poolOf(items, ['d', 'b', 'nothing']).map((p) => p.id)).toEqual(['b', 'd']);
    expect(poolOf(items, [])).toEqual([]);
    // Whether a piece has a capital or a flag is nothing to the cards: they are those of the map, however the pieces are called.
    expect(poolOf([piece('a', { capital: ['x'] }), piece('b')]).map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('can each be called on the map and by its name; by its flag, its capital or its outline only if it has one', () => {
    const region = piece('ES-M', { capital: ['Madrid'] });
    const country = piece('ES', { kind: 'country', capital: ['Madrid'], country: { fl: 'es' } });
    const city = piece('c1', { kind: 'city', shape: 'point' });
    const river = piece('r:ebro', { kind: 'feature', shape: 'line' });
    expect(BINGO_HOWS.filter((how) => callable(region, how))).toEqual(['map', 'capital', 'outline', 'name']);
    expect(BINGO_HOWS.filter((how) => callable(country, how))).toEqual(['map', 'flag', 'capital', 'outline', 'name']);
    expect(BINGO_HOWS.filter((how) => callable(city, how))).toEqual(['map', 'name']);
    expect(BINGO_HOWS.filter((how) => callable(river, how))).toEqual(['map', 'name']);
    // A flag is of a country: a region does not borrow that of the country it is in, and a country without one has none.
    expect(callable(piece('ES-M', { country: { fl: 'es' } }), 'flag')).toBe(false);
    expect(callable(piece('XX', { kind: 'country' }), 'flag')).toBe(false);
    expect(callable(piece('ES-M', { capital: [] }), 'capital')).toBe(false);
    for (const how of BINGO_HOWS) expect(isHow(how)).toBe(true);
    for (const x of ['', 'maps', 'Map', 4, null]) expect(isHow(x), String(x)).toBe(false);
  });

  it('are called the ways most of them can be: the few that cannot come by their names', () => {
    expect(HOW_SHARE).toBe(0.75);
    const with_ = (capitals: number) => LETTERS.map((id, i) => piece(id, i < capitals ? { capital: ['x'] } : {}));
    // Fifteen of twenty is three in four: enough. Fourteen is not.
    expect(howsOf(with_(20))).toEqual(['map', 'capital', 'outline', 'name']);
    expect(howsOf(with_(15))).toEqual(['map', 'capital', 'outline', 'name']);
    expect(howsOf(with_(14))).toEqual(['map', 'outline', 'name']);
    expect(gapsOf(with_(20), 'capital')).toBe(0);
    expect(gapsOf(with_(15), 'capital')).toBe(5);
    expect(gapsOf(with_(15), 'flag')).toBe(20);
    expect(gapsOf(with_(15), 'map')).toBe(0);
    expect(howsOf(LETTERS.map((id) => piece(id, { kind: 'city', shape: 'point' })))).toEqual(['map', 'name']);
    expect(howsOf([])).toEqual([]);
  });
});

describe('the card of a number', () => {
  it('has as many pieces as cells, all of the map and none twice', () => {
    for (const size of BINGO_SIZES) {
      const pool = Array.from({ length: needOf(size) }, (_, i) => `p${i}`);
      for (const n of [1, 2, 30, 1000, CARD_MAX]) {
        const card = cardOf(pool, size, n);
        expect(card).toHaveLength(size * size);
        expect(new Set(card).size).toBe(size * size);
        for (const id of card) expect(pool).toContain(id);
      }
    }
  });

  it('is the same card for ever: a sheet that was printed is still good', () => {
    // If these change, every card printed before stops being the card its number deals.
    expect(cardOf(LETTERS, 3, 7).join('')).toBe('mblnsfrha');
    expect(cardOf(LETTERS, 3, 1).join('')).toBe('mftglkrhn');
    expect(cardOf(LETTERS, 4, 7).join('')).toBe('pntehqrjdkcfagom');
    expect(cardOf(LETTERS, 3, 7)).toEqual(cardOf([...LETTERS], 3, 7));
  });

  it('is another card with another number, another size or another map', () => {
    expect(cardOf(LETTERS, 3, 7)).not.toEqual(cardOf(LETTERS, 3, 8));
    expect(cardOf(LETTERS, 4, 7).slice(0, 9)).not.toEqual(cardOf(LETTERS, 3, 7));
    expect(cardOf([...LETTERS, 'u'], 3, 7)).not.toEqual(cardOf(LETTERS, 3, 7));
  });

  it('is like no other among all the numbers there are, on a map of fifty', { timeout: 30_000 }, () => {
    // Two numbers that were dealt from the same seed would be the same card on every map. A map of fifty has
    // so many cards of nine that no two come out alike by chance: alike ones here would be of one seed.
    const pool = Array.from({ length: 50 }, (_, i) => `ES-${i}`);
    const seen = new Set<string>();
    for (let n = 1; n <= CARD_MAX; n++) seen.add(cardOf(pool, 3, n).join(' '));
    expect(seen.size).toBe(CARD_MAX);
    // The larger ones, among the numbers of a school: the sheets and a few hundred phones.
    for (const size of [4, 5]) {
      const some = new Set<string>();
      for (let n = 1; n <= 3000; n++) some.add(cardOf(pool, size, n).join(' '));
      expect(some.size, `size ${size}`).toBe(3000);
    }
  });

  it('has each piece of the map as often as any other', () => {
    const pool = Array.from({ length: 24 }, (_, i) => `p${i}`);
    const times = new Map<string, number>(pool.map((id) => [id, 0]));
    const firsts = new Map<string, number>(pool.map((id) => [id, 0]));
    const cards = 3000;
    for (let n = 1; n <= cards; n++) {
      const card = cardOf(pool, 4, n);
      for (const id of card) times.set(id, times.get(id)! + 1);
      firsts.set(card[0], firsts.get(card[0])! + 1);
    }
    // Sixteen of twenty-four: each piece is on two cards of three, and first on one of twenty-four.
    for (const [id, t] of times) expect(t / cards, id).toBeCloseTo(16 / 24, 1);
    for (const [id, t] of firsts) expect(Math.abs(t - cards / 24), id).toBeLessThan(45);
  });

  it('of a phone that gives itself one is numbered above those of the sheets', () => {
    expect(CARD_OWN).toBe(1000);
    expect(CARD_MAX).toBe(99999);
    expect(ownCard(() => 0)).toBe(1000);
    expect(ownCard(() => 0.9999999)).toBe(99999);
    expect(ownCard(() => 0.5)).toBe(50500);
    const rnd = mulberry32(5);
    for (let i = 0; i < 500; i++) {
      const n = ownCard(rnd);
      expect(Number.isInteger(n) && n >= CARD_OWN && n <= CARD_MAX, String(n)).toBe(true);
    }
    expect(SHEET_DEFAULT).toBeLessThan(CARD_OWN);
    expect(SHEET_MAX % PER_PAGE).toBe(0);
    expect(SHEET_DEFAULT % PER_PAGE).toBe(0);
  });
});

describe('the lines of a card', () => {
  it('are its rows, its columns and its two diagonals', () => {
    expect(linesOf(3)).toEqual([
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [6, 4, 2],
    ]);
    for (const size of BINGO_SIZES) {
      const lines = linesOf(size);
      expect(lines).toHaveLength(size * 2 + 2);
      for (const line of lines) {
        expect(line).toHaveLength(size);
        expect(new Set(line).size).toBe(size);
        for (const cell of line) expect(cell >= 0 && cell < size * size).toBe(true);
      }
      // Every cell is in a row and in a column.
      for (let cell = 0; cell < size * size; cell++) expect(lines.filter((l) => l.includes(cell)).length).toBeGreaterThanOrEqual(2);
    }
    expect(linesOf(4)[8]).toEqual([0, 5, 10, 15]);
    expect(linesOf(4)[9]).toEqual([12, 9, 6, 3]);
  });

  it('are called by what they are and where', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => lineName(3, i))).toEqual(['la fila 1', 'la fila 2', 'la fila 3', 'la columna 1', 'la columna 2', 'la columna 3', 'la diagonal que baja', 'la diagonal que sube']);
    expect(lineName(5, 4)).toBe('la fila 5');
    expect(lineName(5, 5)).toBe('la columna 1');
    expect(lineName(5, 9)).toBe('la columna 5');
    expect(lineName(5, 10)).toBe('la diagonal que baja');
    expect(lineName(5, 11)).toBe('la diagonal que sube');
    setLang('en');
    expect([0, 3, 6, 7].map((i) => lineName(3, i))).toEqual(['row 1', 'column 1', 'the diagonal going down', 'the diagonal going up']);
  });
});

describe('a card that is checked', () => {
  const card = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
  const out = (ids: string) => new Set(ids.split(''));

  it('has what has come out, and nothing else', () => {
    const v = judge(card, out('axbyc'), 3);
    expect(v.marked).toEqual([true, true, true, false, false, false, false, false, false]);
    expect(v.lines).toEqual([0]);
    expect(v.full).toBe(false);
    expect(v.left).toBe(6);
    expect(callOf(v)).toBe('line');
    expect(judge(card, out(''), 3)).toEqual({ marked: Array(9).fill(false), lines: [], full: false, left: 9 });
    expect(callOf(judge(card, out('xyz'), 3))).toBe('none');
  });

  it('has a line with a row, a column or a diagonal, and not with as many cells anywhere else', () => {
    expect(judge(card, out('def'), 3).lines).toEqual([1]);
    expect(judge(card, out('beh'), 3).lines).toEqual([4]);
    expect(judge(card, out('aei'), 3).lines).toEqual([6]);
    expect(judge(card, out('gec'), 3).lines).toEqual([7]);
    expect(judge(card, out('abd'), 3).lines).toEqual([]);
    expect(judge(card, out('abdfhi'), 3).lines).toEqual([]);
    // Several at once: the cross has a row and a column.
    expect(judge(card, out('defbh'), 3).lines).toEqual([1, 4]);
    expect(callOf(judge(card, out('abd'), 3))).toBe('none');
  });

  it('is a bingo with every cell, and only then', () => {
    const all = judge(card, out('abcdefghi'), 3);
    expect(all.full).toBe(true);
    expect(all.left).toBe(0);
    expect(all.lines).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(callOf(all)).toBe('bingo');
    const nearly = judge(card, out('abcdefgh'), 3);
    expect(nearly.full).toBe(false);
    expect(nearly.left).toBe(1);
    expect(callOf(nearly)).toBe('line');
  });

  it('is judged the same by the cells its player has marked', () => {
    expect(judgeMarks([true, true, true], 3)).toEqual({ marked: [true, true, true, false, false, false, false, false, false], lines: [0], full: false, left: 6 });
    expect(judgeMarks(Array(16).fill(true), 4).full).toBe(true);
    // Marks beyond the card are not cells of it.
    expect(judgeMarks(Array(30).fill(true), 3).marked).toHaveLength(9);
  });

  it('is told in a sentence: what it has, and what it lacks', () => {
    expect(verdictText(judge(card, out('abcdefghi'), 3), 3, 7)).toBe('El cartón 7 tiene sus 9 casillas.');
    expect(verdictText(judge(card, out('abc'), 3), 3, 7)).toBe('El cartón 7 tiene completa la fila 1. Le faltan 6 casillas para el bingo.');
    expect(verdictText(judge(card, out('defbh'), 3), 3, 12)).toBe('El cartón 12 tiene completas la fila 2 y la columna 2. Le faltan 4 casillas para el bingo.');
    expect(verdictText(judge(card, out('abcdefgh'), 3), 3, 7)).toBe('El cartón 7 tiene completas la fila 1, la fila 2, la columna 1, la columna 2 y la diagonal que sube. Le falta 1 casilla para el bingo.');
    expect(verdictText(judge(card, out('abd'), 3), 3, 4821)).toBe('El cartón 4821 no tiene ninguna línea completa: lleva 3 de 9 casillas.');
    setLang('en');
    expect(verdictText(judge(card, out('abcdefghi'), 3), 3, 7)).toBe('Card 7 has its 9 cells.');
    expect(verdictText(judge(card, out('abc'), 3), 3, 7)).toBe('Card 7 has row 1 complete. It is 6 cells short of bingo.');
    expect(verdictText(judge(card, out('abcdefgh'), 3), 3, 7)).toBe('Card 7 has row 1, row 2, column 1, column 2 and the diagonal going up complete. It is 1 cell short of bingo.');
    expect(verdictText(judge(card, out('abd'), 3), 3, 7)).toBe('Card 7 has no complete line: 3 of its 9 cells have come out.');
  });
});

describe('the drum', () => {
  it('gives every piece once, and then no more', () => {
    const rnd = mulberry32(11);
    const out: string[] = [];
    for (;;) {
      const next = drawNext(LETTERS, out, rnd);
      if (next == null) break;
      expect(out).not.toContain(next);
      out.push(next);
    }
    expect([...out].sort()).toEqual(LETTERS);
    expect(drawNext(LETTERS, out, rnd)).toBeNull();
    expect(drawNext([], [])).toBeNull();
  });

  it('gives any of those left, each as likely as the next', () => {
    expect(drawNext(LETTERS, [], () => 0)).toBe('a');
    expect(drawNext(LETTERS, [], () => 0.999999)).toBe('t');
    expect(drawNext(LETTERS, ['a', 'b'], () => 0)).toBe('c');
    expect(drawNext(LETTERS, LETTERS.slice(0, 19), () => 0.7)).toBe('t');
    // What came out and is not of the map is of no account.
    expect(drawNext(['a', 'b'], ['x', 'a'], () => 0.9)).toBe('b');
    const rnd = mulberry32(3);
    const firsts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      const id = drawNext(LETTERS, [], rnd)!;
      firsts.set(id, (firsts.get(id) ?? 0) + 1);
    }
    expect(firsts.size).toBe(20);
    for (const [id, t] of firsts) expect(Math.abs(t - 200), id).toBeLessThan(60);
  });
});

describe('a name in the cell of a card', () => {
  it('is written smaller the wider its widest word is', () => {
    expect(tightOf('Soria')).toBe(0);
    expect(tightOf('La Rioja')).toBe(0);
    expect(tightOf('Navarra')).toBe(0);
    expect(tightOf('Asturias')).toBe(0);
    expect(tightOf('Zaragoza')).toBe(1);
    expect(tightOf('Barcelona')).toBe(1);
    expect(tightOf('Guadalajara')).toBe(2);
    expect(tightOf('Liechtenstein')).toBe(3);
    // Letters are not all as wide: nine with an "m" take more than ten with three "l" and an "i".
    expect(tightOf('Salamanca')).toBe(2);
    expect(tightOf('Valladolid')).toBe(1);
    expect(tightOf('illinois')).toBe(0);
    expect(tightOf('mammoths')).toBe(2);
    // A word is what cannot be cut: the parts of a name with a hyphen are words of their own.
    expect(tightOf('Castilla-La Mancha')).toBe(1);
    expect(tightOf('Mecklemburgo-Pomerania')).toBe(3);
  });

  it('is written smaller the more lines its words take', () => {
    expect(tightOf('Reino Unido')).toBe(0);
    expect(tightOf('Islas Baleares')).toBe(1);
    expect(tightOf('Santa Cruz de Tenerife')).toBe(2);
    expect(tightOf('San Vicente y las Granadinas')).toBe(3);
  });
});

describe('the address of the cards of a bingo', () => {
  const SPAIN = { section: 'regions' as const, link: { ids: ['ES'], levels: { ES: 'f' } } };

  it('says whose card it is, the size and the map', () => {
    const key = bingoKey(4, SPAIN);
    expect(key).toBe('4/regiones/ES:f');
    expect(mapPathOf(SPAIN)).toBe('regiones/ES:f');
    expect(mapPathOf({ list: 'abc' })).toBe('lista/abc');
    expect(bingoPath(7, key)).toBe('bingo/7/4/regiones/ES:f');
    expect(bingoPath('1-30', key)).toBe('bingo/1-30/4/regiones/ES:f');
    expect(bingoPath('-', key)).toBe('bingo/-/4/regiones/ES:f');
    expect(bingoUrl(7, key, 'https://example.org/juego/regiones.html#/regiones')).toBe('https://example.org/juego/#/bingo/7/4/regiones/ES:f');
    expect(bingoKey(5, { section: 'countries', link: { ids: ['ES', 'PT', 'FR'], levels: {} } })).toBe('5/paises/ES+PT+FR');
    // The game is not named: every card is of a bingo. Only the cities need it, to say after it which ones they are.
    expect(bingoKey(3, { section: 'regions', link: { ids: ['ES'], levels: {}, mode: 'pin' } })).toBe('3/regiones/ES');
    expect(bingoKey(3, { section: 'cities', link: { ids: ['ES'], levels: {}, cityPick: 'top', cityCount: 50 } })).toBe('3/ciudades/ES/bingo/top50');
    expect(bingoKey(3, { section: 'cities', link: { ids: ['ES', 'FR'], levels: {}, cityPick: 'caps' } })).toBe('3/ciudades/ES+FR/bingo/caps');
    expect(bingoKey(3, { section: 'physical', link: { ids: ['sea', 'lake', 'EU'], levels: {} } })).toBe('3/fisica/sea+lake+EU');
    expect(bingoKey(3, { list: 'abc' })).toBe('3/lista/abc');
  });

  it('is read back as it was written', () => {
    const b = parseBingo('7/4/regiones/ES:f')!;
    expect(b.who).toEqual({ kind: 'card', n: 7 });
    expect(b.size).toBe(4);
    expect(b.key).toBe('4/regiones/ES:f');
    expect(b.what).toMatchObject({ kind: 'map', section: 'regions', link: { ids: ['ES'], levels: { ES: 'f' } } });
    expect(parseBingo('99999/5/paises/ES+PT')!).toMatchObject({ who: { kind: 'card', n: 99999 }, size: 5, what: { kind: 'map', section: 'countries', link: { ids: ['ES', 'PT'] } } });
    expect(parseBingo('1/3/ciudades/ES/bingo/top50')!.what).toMatchObject({ kind: 'map', section: 'cities', link: { ids: ['ES'], cityPick: 'top', cityCount: 50 } });
    expect(parseBingo('1/3/fisica/sea+lake+EU')!.what).toMatchObject({ kind: 'map', section: 'physical', link: { ids: ['sea', 'lake', 'EU'] } });
    expect(parseBingo('1/3/lista/abc')!).toMatchObject({ size: 3, what: { kind: 'list', code: 'abc' }, key: '3/lista/abc' });
    for (const size of BINGO_SIZES) expect(parseBingo(bingoPath(3, bingoKey(size, SPAIN)).slice(BINGO_PATH.length + 1))).toMatchObject({ size, key: bingoKey(size, SPAIN) });
  });

  it('is for a card, for a sheet of them, or for whoever opens it', () => {
    const who = (text: string) => parseBingo(`${text}/4/regiones/ES`)?.who ?? null;
    expect(who('1')).toEqual({ kind: 'card', n: 1 });
    expect(who('4821')).toEqual({ kind: 'card', n: 4821 });
    expect(who('-')).toEqual({ kind: 'own' });
    expect(who('1-30')).toEqual({ kind: 'sheet', from: 1, to: 30 });
    expect(who('7-7')).toEqual({ kind: 'sheet', from: 7, to: 7 });
    expect(who('31-60')).toEqual({ kind: 'sheet', from: 31, to: 60 });
    // A sheet has so many cards at most: it ends where it has to.
    expect(who('1-500')).toEqual({ kind: 'sheet', from: 1, to: SHEET_MAX });
    expect(who('100-9999')).toEqual({ kind: 'sheet', from: 100, to: 100 + SHEET_MAX - 1 });
    expect(who('48213')).toEqual({ kind: 'card', n: 48213 });
    // What follows the dash has to be a number as well: one that is not would make a sheet with no end.
    for (const bad of ['1-x', '1-07', '1-5.5', '1-100000', '1-1e2', '3-0x10']) expect(who(bad), bad).toBeNull();
    for (const bad of ['', '0', '07', '100000', '-1', '1-', '30-1', '1-2-3', 'x', '1.5', '1-0', '0-5', '--', '1 ']) expect(who(bad), bad).toBeNull();
  });

  it('is nothing when it does not say all of it', () => {
    for (const bad of [
      '',
      '7',
      '7/4',
      '7/4/regiones',
      '7/regiones/ES',
      '7/6/regiones/ES',
      '7/2/regiones/ES',
      '7/44/regiones/ES',
      '7/x/regiones/ES',
      // A size is written one way: the marks and the number of a card are kept by its address.
      '7/04/regiones/ES',
      '7/4.0/regiones/ES',
      '7/4x/regiones/ES',
      '7/4e0/regiones/ES',
      '7/ 4/regiones/ES',
      // The way the pieces are called is not of the cards.
      '7/map4/regiones/ES',
      '7/4/nada/ES',
      '7/4/regiones/españa',
      '7/4/regiones//ES',
      '7/4/lista',
      // The options of a game are not of a bingo.
      '7/4/regiones/ES/answer=choice',
      '7/4/regiones/ES/pin/tries=1',
      // The figures have no map.
      '7/4/poblaciones',
    ]) {
      expect(parseBingo(bad), bad).toBeNull();
    }
  });

  it('is a screen of its own', () => {
    expect(BINGO_PATH).toBe('bingo');
    expect(routeOf('bingo')).toEqual({ kind: 'bingo', rest: '' });
    expect(routeOf('bingo/7/4/regiones/ES:f')).toEqual({ kind: 'bingo', rest: '7/4/regiones/ES:f' });
    expect(canonicalPath('Bingo/7/4/regiones/ES:f')).toBe('bingo/7/4/regiones/ES:f');
  });

  it('is not the address of a game put inside another page, nor a game that leaves progress', () => {
    expect(NOT_EMBEDDED).toContain('bingo');
    expect(NOT_GAMES).toContain('bingo');
  });
});

describe('how the pieces are called, in words', () => {
  it('has a name for each way', () => {
    expect(BINGO_HOWS.map(howName)).toEqual(['En el mapa', 'Bandera', 'Capital', 'Silueta', 'Nombre']);
    setLang('en');
    expect(BINGO_HOWS.map(howName)).toEqual(['On the map', 'Flag', 'Capital', 'Outline', 'Name']);
  });
});

describe('the cards on the atlas of today', () => {
  let world: World;
  beforeAll(async () => {
    setLoader(async (p) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data', p), 'utf8')));
    world = await loadIndex();
  });
  const game = (patch: Partial<GameConfig>): GameConfig => ({ section: 'regions', mode: 'bingo', countries: ['ES'], levels: { ES: 'f' }, opts: DEFAULT_OPTS, nonce: 1, ...patch });
  /** The pieces of a game as the screen that calls has them, and as whoever opens the address of a card gets them. */
  const bothPools = async (cfg: GameConfig) => {
    const here = poolOf((await deckFor(cfg)).items, cfg.only).map((it) => it.id);
    const key = bingoKey(3, sourceOf(cfg));
    const bingo = parseBingo(`5/${key}`)!;
    const there = bingoGame(bingo.what, world)!;
    const pool = poolOf((await deckFor({ ...there.cfg, nonce: 2 })).items, there.cfg.only).map((it) => it.id);
    return { here, pool, there, key };
  };

  it('are dealt from the same pieces on the screen that calls and on the phone that opens a card', async () => {
    const provinces = await bothPools(game({}));
    expect(provinces.key).toBe('3/regiones/ES:f');
    expect(provinces.here).toHaveLength(52);
    expect(provinces.pool).toEqual(provinces.here);
    expect(provinces.there.cfg.mode).toBe('bingo');
    expect(provinces.there.title).toBe('España · provincias');
    expect(cardOf(provinces.pool, 4, 12)).toEqual(cardOf(provinces.here, 4, 12));
    // Pinned: a sheet printed last year is still good. If this changes, every card that was handed out is another one.
    expect(cardOf(provinces.here, 4, 7)).toEqual(['ES-HU', 'ES-O', 'ES-SS', 'ES-MU', 'ES-OR', 'ES-GU', 'ES-TF', 'ES-LO', 'ES-AV', 'ES-C', 'ES-T', 'ES-B', 'ES-BU', 'ES-M', 'ES-NA', 'ES-BI']);
    expect(cardOf(provinces.here, 4, 1).slice(0, 4)).toEqual(['ES-T', 'ES-OR', 'ES-BA', 'ES-H']);

    const communities = await bothPools(game({ levels: { ES: 'g1' } }));
    expect(communities.key).toBe('3/regiones/ES:g1');
    expect(communities.here).toHaveLength(19);
    expect(communities.pool).toEqual(communities.here);
    expect(cardOf(communities.here, 3, 3)).toEqual(['ES-AS', 'ES-CN', 'ES-RI', 'ES-VC', 'ES-CE', 'ES-IB', 'ES-CT', 'ES-GA', 'ES-EX']);

    const two = await bothPools(game({ countries: ['ES', 'PT'], levels: { ES: 'g1', PT: 'f' } }));
    expect(two.key).toBe('3/regiones/ES:g1+PT:f');
    expect(two.pool).toEqual(two.here);
    expect(two.here.length).toBeGreaterThan(30);
  });

  it('are the same for the countries, the cities and a physical map', async () => {
    const europe = world.index.countries.filter((c) => c.ct === 'EU' && c.cl === 'un').map((c) => c.id);
    const countries = await bothPools(game({ section: 'countries', countries: europe, levels: {} }));
    expect(countries.here.length).toBeGreaterThan(40);
    expect(countries.pool).toEqual(countries.here);

    const cities = await bothPools(game({ section: 'cities', countries: ['ES'], levels: {}, opts: { ...DEFAULT_OPTS, cityPick: 'top', cityCount: 50 } }));
    expect(cities.key).toBe('3/ciudades/ES/bingo/top50');
    // The data has that many cities of Spain, or nearly.
    expect(cities.here.length).toBeGreaterThan(40);
    expect(cities.pool).toEqual(cities.here);
    expect(cities.there.cfg.opts.cityCount).toBe(50);

    const seas = await bothPools(game({ section: 'physical', countries: ['sea', 'lake', 'EU'], levels: {} }));
    expect(seas.key).toBe('3/fisica/sea+lake+EU');
    expect(seas.here.length).toBeGreaterThanOrEqual(BINGO_MIN);
    expect(seas.pool).toEqual(seas.here);
  });

  it('of a list are of its pieces alone, and its address carries the list', async () => {
    const deck = await buildDeck({ scope: 'regions', countries: ['ES'], levels: { ES: 'f' } });
    const only = deck.items
      .map((it) => it.id)
      .sort()
      .slice(0, 14);
    const cfg = game({ only: [...only].reverse(), list: 'Las del examen' });
    const { here, pool, there, key } = await bothPools(cfg);
    expect(here).toEqual(only);
    expect(pool).toEqual(only);
    expect(there.title).toBe('Las del examen');
    expect(there.cfg.list).toBe('Las del examen');
    expect(key.startsWith('3/lista/')).toBe(true);
    expect(decodeList(key.slice('3/lista/'.length))).toMatchObject({ name: 'Las del examen', section: 'regions', countries: ['ES'], levels: { ES: 'f' } });
    // A game on the pieces missed (no list) is a game on its map.
    expect(bingoKey(3, sourceOf(game({ only })))).toBe('3/regiones/ES:f');
  });

  it('are of nothing when the atlas has nothing of what the address names', () => {
    expect(bingoGame(parseBingo('1/3/regiones/ZZ')!.what, world)).toBeNull();
    expect(bingoGame(parseBingo('1/3/lista/abc')!.what, world)).toBeNull();
  });

  it('can be called the ways each map has', async () => {
    const provinces = await deckFor(game({}));
    expect(howsOf(provinces.items)).toEqual(['map', 'capital', 'outline', 'name']);
    expect(gapsOf(provinces.items, 'capital')).toBe(0);
    const europe = world.index.countries.filter((c) => c.ct === 'EU' && c.cl === 'un').map((c) => c.id);
    expect(howsOf((await deckFor(game({ section: 'countries', countries: europe, levels: {} }))).items)).toEqual(['map', 'flag', 'capital', 'outline', 'name']);
    expect(howsOf((await deckFor(game({ section: 'cities', countries: ['ES'], levels: {} }))).items)).toEqual(['map', 'name']);
    expect(howsOf((await deckFor(game({ section: 'physical', countries: ['river', 'EU'], levels: {} }))).items)).toEqual(['map', 'name']);
    expect(howsOf((await deckFor(game({ section: 'physical', countries: ['sea', 'lake', 'EU'], levels: {} }))).items)).toEqual(['map', 'outline', 'name']);
  });
});
