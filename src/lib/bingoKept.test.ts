// @vitest-environment jsdom
/** What a bingo leaves in the browser: the game of each map on the screen that calls, and the marks and the number of each card on a phone. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BINGO_KEY, DRAWS_MAX, MARKS_MAX, cleanKept, drawOf, keepDraw, keepMarks, keepOwn, lastSet, marksOf, ownOf, type Draw } from './bingoKept';
import { hashStr } from './text';

const SPAIN = 'regiones/ES:f';
const EUROPE = 'paises/ES+PT+FR';
const draw = (patch: Partial<Draw> = {}): Draw => ({ how: 'map', size: 4, out: ['ES-M', 'ES-B'], shown: false, ...patch });
const stored = (): { set: unknown; draws: Record<string, Draw>; marks: Record<string, number[]>; own: Record<string, number> } | null => JSON.parse(localStorage.getItem(BINGO_KEY) ?? 'null');
const store = (kept: unknown): void => localStorage.setItem(BINGO_KEY, typeof kept === 'string' ? kept : JSON.stringify(kept));
const nameOf = (address: string): string => hashStr(address).toString(36);

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('the game of a map on the screen that calls', () => {
  it('is kept as it stands, and read back', () => {
    expect(drawOf(SPAIN)).toBeNull();
    keepDraw(SPAIN, draw());
    expect(drawOf(SPAIN)).toEqual(draw());
    keepDraw(SPAIN, draw({ out: ['ES-M', 'ES-B', 'ES-V'], shown: true }));
    expect(drawOf(SPAIN)).toEqual(draw({ out: ['ES-M', 'ES-B', 'ES-V'], shown: true }));
    // Under a short name, not under its address: a list is a long one.
    expect(Object.keys(stored()!.draws)).toEqual([nameOf(SPAIN)]);
  });

  it('is one for each map', () => {
    keepDraw(SPAIN, draw());
    keepDraw(EUROPE, draw({ how: 'flag', size: 5, out: ['FR'] }));
    expect(drawOf(SPAIN)).toEqual(draw());
    expect(drawOf(EUROPE)).toEqual(draw({ how: 'flag', size: 5, out: ['FR'] }));
  });

  it('is no game with nothing out: only how it was set up stays, for the next one', () => {
    keepDraw(SPAIN, draw({ how: 'capital', size: 3, out: [] }));
    expect(drawOf(SPAIN)).toBeNull();
    expect(lastSet()).toEqual({ how: 'capital', size: 3 });
    // Starting again takes away the game that was there.
    keepDraw(SPAIN, draw());
    expect(drawOf(SPAIN)).not.toBeNull();
    keepDraw(SPAIN, draw({ out: [] }));
    expect(drawOf(SPAIN)).toBeNull();
    expect(stored()!.draws).toEqual({});
  });

  it('remembers how the last one was set up, whatever the map', () => {
    expect(lastSet()).toBeNull();
    keepDraw(SPAIN, draw({ how: 'outline', size: 5 }));
    expect(lastSet()).toEqual({ how: 'outline', size: 5 });
    keepDraw(EUROPE, draw({ how: 'flag', size: 3 }));
    expect(lastSet()).toEqual({ how: 'flag', size: 3 });
  });

  it('gives way to newer ones when there are too many', () => {
    for (let i = 0; i < DRAWS_MAX + 2; i++) keepDraw(`regiones/M${i}`, draw({ out: [`P${i}`] }));
    expect(Object.keys(stored()!.draws)).toHaveLength(DRAWS_MAX);
    expect(drawOf('regiones/M0')).toBeNull();
    expect(drawOf('regiones/M1')).toBeNull();
    expect(drawOf('regiones/M2')).toEqual(draw({ out: ['P2'] }));
    expect(drawOf(`regiones/M${DRAWS_MAX + 1}`)).toEqual(draw({ out: [`P${DRAWS_MAX + 1}`] }));
    // The one that is touched is the latest: it is not the one that gives way.
    keepDraw('regiones/M2', draw({ out: ['P2', 'Q'] }));
    keepDraw('regiones/new', draw());
    expect(drawOf('regiones/M2')).toEqual(draw({ out: ['P2', 'Q'] }));
    expect(drawOf('regiones/M3')).toBeNull();
  });
});

describe('the marks of a card on a phone', () => {
  const CARD = 'bingo/7/4/regiones/ES:f';

  it('are kept by the address of the card, in order and each once', () => {
    expect(marksOf(CARD)).toEqual([]);
    keepMarks(CARD, [5, 0, 5, 12]);
    expect(marksOf(CARD)).toEqual([0, 5, 12]);
    expect(marksOf('bingo/8/4/regiones/ES:f')).toEqual([]);
    keepMarks('bingo/8/4/regiones/ES:f', [3]);
    expect(marksOf(CARD)).toEqual([0, 5, 12]);
    expect(marksOf('bingo/8/4/regiones/ES:f')).toEqual([3]);
  });

  it('leave nothing behind once they are cleared', () => {
    keepMarks(CARD, [1, 2]);
    keepMarks(CARD, []);
    expect(marksOf(CARD)).toEqual([]);
    // With nothing else kept, nothing is left in the browser.
    expect(localStorage.getItem(BINGO_KEY)).toBeNull();
  });

  it('give way to those of newer cards when there are too many', () => {
    for (let i = 1; i <= MARKS_MAX + 1; i++) keepMarks(`bingo/${i}/4/regiones/ES:f`, [i % 16]);
    expect(Object.keys(stored()!.marks)).toHaveLength(MARKS_MAX);
    expect(marksOf('bingo/1/4/regiones/ES:f')).toEqual([]);
    expect(marksOf('bingo/2/4/regiones/ES:f')).toEqual([2]);
    expect(marksOf(`bingo/${MARKS_MAX + 1}/4/regiones/ES:f`)).toEqual([(MARKS_MAX + 1) % 16]);
  });
});

describe('the number a device gives itself', () => {
  it('is kept for each bingo, and is the one it has until it takes another', () => {
    expect(ownOf('4/regiones/ES:f')).toBeNull();
    keepOwn('4/regiones/ES:f', 4831);
    expect(ownOf('4/regiones/ES:f')).toBe(4831);
    expect(ownOf('5/regiones/ES:f')).toBeNull();
    keepOwn('5/regiones/ES:f', 1200);
    keepOwn('4/regiones/ES:f', 9000);
    expect(ownOf('4/regiones/ES:f')).toBe(9000);
    expect(ownOf('5/regiones/ES:f')).toBe(1200);
  });

  it('lives with the marks and the games without any of them touching the others', () => {
    keepOwn('4/regiones/ES:f', 4831);
    keepMarks('bingo/4831/4/regiones/ES:f', [1]);
    keepDraw(SPAIN, draw());
    keepMarks('bingo/4831/4/regiones/ES:f', []);
    expect(ownOf('4/regiones/ES:f')).toBe(4831);
    expect(drawOf(SPAIN)).toEqual(draw());
    expect(lastSet()).toEqual({ how: 'map', size: 4 });
  });
});

describe('what was kept, read with care', () => {
  it('is nothing when it is not what it should be', () => {
    const empty = { set: null, draws: {}, marks: {}, own: {} };
    for (const raw of [null, undefined, 3, 'x', [], [1, 2]]) expect(cleanKept(raw), JSON.stringify(raw)).toEqual(empty);
    expect(cleanKept({})).toEqual(empty);
    expect(cleanKept({ set: 'map', draws: [], marks: 'x', own: null })).toEqual(empty);
    store('{not json');
    expect(drawOf(SPAIN)).toBeNull();
    expect(marksOf('bingo/7/4/regiones/ES:f')).toEqual([]);
    expect(ownOf('4/regiones/ES:f')).toBeNull();
    expect(lastSet()).toBeNull();
  });

  it('is read with the same care from the browser: what was written there by hand or by another version does no harm', () => {
    const card = 'bingo/7/4/regiones/ES:f';
    store(
      JSON.stringify({
        set: { how: 'smell', size: 4 },
        draws: { [nameOf(SPAIN)]: { how: 'map', size: 4, out: ['ES-M', 7, 'ES-M', 'ES-B', '<b>'], shown: 'yes' } },
        marks: { [nameOf(card)]: [3, 3, 'x', 99, 1, -1] },
        own: { [nameOf('4/regiones/ES:f')]: 4831.5, [nameOf('3/regiones/ES:f')]: 4831 },
      }),
    );
    expect(lastSet()).toBeNull();
    expect(drawOf(SPAIN)).toEqual({ how: 'map', size: 4, out: ['ES-M', 'ES-B'], shown: false });
    expect(marksOf(card)).toEqual([1, 3]);
    expect(ownOf('4/regiones/ES:f')).toBeNull();
    expect(ownOf('3/regiones/ES:f')).toBe(4831);
  });

  it('takes a list for nothing where it expects names with what is kept under them', () => {
    const game = { how: 'map', size: 4, out: ['a'], shown: false };
    expect(cleanKept({ draws: [game], marks: [[1, 2]], own: [5000] })).toEqual({ set: null, draws: {}, marks: {}, own: {} });
    expect(cleanKept([{ draws: { k: game } }])).toEqual({ set: null, draws: {}, marks: {}, own: {} });
    expect(cleanKept({ set: ['map', 4] }).set).toBeNull();
    // The same things under names are kept.
    expect(cleanKept({ draws: { k: game }, marks: { k: [1, 2] }, own: { k: 5000 } })).toEqual({ set: null, draws: { k: game }, marks: { k: [1, 2] }, own: { k: 5000 } });
  });

  it('keeps six games and twenty-four cards: a class does not play more maps than that at a time', () => {
    expect(DRAWS_MAX).toBe(6);
    expect(MARKS_MAX).toBe(24);
  });

  it('drops a set-up that is no way of calling or no size', () => {
    expect(cleanKept({ set: { how: 'map', size: 4 } }).set).toEqual({ how: 'map', size: 4 });
    expect(cleanKept({ set: { how: 'sound', size: 4 } }).set).toBeNull();
    expect(cleanKept({ set: { how: 'map', size: 6 } }).set).toBeNull();
    expect(cleanKept({ set: { how: 'map', size: '4' } }).set).toBeNull();
    expect(cleanKept({ set: { how: 'map' } }).set).toBeNull();
    // Nothing else comes along with it.
    expect(cleanKept({ set: { how: 'flag', size: 3, out: ['x'], more: 1 } }).set).toEqual({ how: 'flag', size: 3 });
  });

  it('drops a game that is not one, and of a game what is not a piece', () => {
    const name = nameOf(SPAIN);
    expect(cleanKept({ draws: { [name]: draw() } }).draws).toEqual({ [name]: draw() });
    expect(cleanKept({ draws: { [name]: { ...draw(), how: 'x' } } }).draws).toEqual({});
    expect(cleanKept({ draws: { [name]: { ...draw(), size: 9 } } }).draws).toEqual({});
    expect(cleanKept({ draws: { [name]: { ...draw(), out: 'ES-M' } } }).draws).toEqual({});
    expect(cleanKept({ draws: { [name]: null } }).draws).toEqual({});
    expect(cleanKept({ draws: { 'Not A Name!': draw() } }).draws).toEqual({});
    // Each piece once, in the order it came out; what is not the id of a piece goes.
    expect(cleanKept({ draws: { [name]: { ...draw(), out: ['ES-M', 3, 'ES-B', 'ES-M', '', null, 'r:ebro', 'a b', '<x>'] } } }).draws[name].out).toEqual(['ES-M', 'ES-B', 'r:ebro']);
    // Whether the name is in sight is yes or no.
    expect(cleanKept({ draws: { [name]: { ...draw(), shown: 1 } } }).draws[name].shown).toBe(false);
    expect(cleanKept({ draws: { [name]: { ...draw(), shown: true } } }).draws[name].shown).toBe(true);
  });

  it('keeps no more games, cards or numbers than there is room for: the latest', () => {
    const many = (n: number, value: (i: number) => unknown) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, value(i)]));
    const kept = cleanKept({ draws: many(DRAWS_MAX + 3, () => draw()), marks: many(MARKS_MAX + 3, () => [1]), own: many(MARKS_MAX + 3, () => 5000) });
    expect(Object.keys(kept.draws)).toEqual(Array.from({ length: DRAWS_MAX }, (_, i) => `k${i + 3}`));
    expect(Object.keys(kept.marks)).toHaveLength(MARKS_MAX);
    expect(Object.keys(kept.marks)[0]).toBe('k3');
    expect(Object.keys(kept.own)).toHaveLength(MARKS_MAX);
    expect(Object.keys(kept.own)[0]).toBe('k3');
  });

  it('drops marks that are no cell of a card, and numbers that are no number of one', () => {
    expect(cleanKept({ marks: { a: [0, 24, 25, -1, 2.5, '3', 7, 7] } }).marks).toEqual({ a: [0, 7, 24] });
    expect(cleanKept({ marks: { a: [], b: 'x', c: [99] } }).marks).toEqual({});
    expect(cleanKept({ marks: { 'bad name': [1] } }).marks).toEqual({});
    expect(cleanKept({ own: { a: 1, b: 99999, c: 0, d: 100000, e: 12.5, f: '7', g: null } }).own).toEqual({ a: 1, b: 99999 });
    expect(cleanKept({ own: { 'bad name': 7 } }).own).toEqual({});
  });
});

describe('a browser that keeps nothing', () => {
  it('does not stop the game: nothing is read, and nothing fails when it is written', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('no storage');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('no room');
    });
    expect(drawOf(SPAIN)).toBeNull();
    expect(lastSet()).toBeNull();
    expect(() => keepDraw(SPAIN, draw())).not.toThrow();
    expect(() => keepMarks('bingo/7/4/regiones/ES:f', [1])).not.toThrow();
    expect(() => keepOwn('4/regiones/ES:f', 7)).not.toThrow();
  });
});
