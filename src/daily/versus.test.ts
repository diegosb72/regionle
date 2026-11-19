import { describe, expect, it } from 'vitest';
import { routeOf } from '../lib/routes';
import { useStore } from '../lib/store';
import { RIVALS_MAX, RIVAL_DAYS, addDays, cleanRivals, isRival, withRival, type Rival } from './spec';
import { bestOf, decodeResult, encodeResult, ranking } from './versus';

const DAY = '2026-11-19';
const ana: Rival = { n: 'Ana', p: [16, 20, 13, 12, 12] };
const luis: Rival = { n: 'Luis', p: [20, 8, 7, 12, 8] };
const unnamed = (n: number, of: number) => (of > 1 ? `Rival ${n}` : 'Rival');

describe('the result a link carries', () => {
  it('is five signs, one for the points of each test, and the name after a dot', () => {
    expect(encodeResult([20, 16, 13, 8, 4])).toBe('kgd84');
    expect(encodeResult([0, 0, 0, 0, 0])).toBe('00000');
    expect(encodeResult([20, 20, 20, 20, 20], 'Ana')).toBe('kkkkk.QW5h');
    // A test not played counts nothing, and points out of range are brought into it.
    expect(encodeResult([20, null, 13, 99, -3])).toBe('k0dk0');
  });

  it('comes back as it went, with names of any alphabet', () => {
    for (const name of ['Ana', 'María José', 'Łukasz', '太郎', 'Zoë 🌍', '']) {
      const code = encodeResult([20, 16, 13, 8, 4], name);
      expect(code).toMatch(/^[0-9a-k]{5}(\.[A-Za-z0-9_-]+)?$/);
      expect(decodeResult(code)).toEqual({ n: name, p: [20, 16, 13, 8, 4] });
    }
  });

  it('keeps a name short and on one line', () => {
    expect(decodeResult(encodeResult([1, 2, 3, 4, 5], '  Ana \n  María  '))).toEqual({ n: 'Ana María', p: [1, 2, 3, 4, 5] });
    expect(decodeResult(encodeResult([1, 2, 3, 4, 5], 'x'.repeat(80)))!.n).toHaveLength(24);
    // What is not shown is not part of a name.
    expect(decodeResult(encodeResult([1, 2, 3, 4, 5], 'A\u202eB\u200bC'))!.n).toBe('A B C');
  });

  it('is nothing when it is not a result', () => {
    for (const bad of ['', 'kgd8', 'kgd844', 'KGD84', 'kgd8z', 'kgd84.', 'kgd84.QW5h.x', 'kgd84/QW5h', '<b>', 'kgd84.%%']) expect(decodeResult(bad), bad).toBeNull();
    // A name that is not text leaves the points standing.
    expect(decodeResult('kgd84._w')).toEqual({ n: '', p: [20, 16, 13, 8, 4] });
  });
});

describe('the address of a day with a result', () => {
  const now = '2026-11-19';
  it('gives the day and what follows it', () => {
    expect(routeOf('reto/2026-11-19/kgd84.QW5h', now)).toEqual({ kind: 'daily', date: '2026-11-19', vs: 'kgd84.QW5h' });
    expect(routeOf('reto/2026-11-10/kgd84', now)).toEqual({ kind: 'daily', date: '2026-11-10', vs: 'kgd84' });
    expect(routeOf('reto/2026-11-10', now)).toEqual({ kind: 'daily', date: '2026-11-10' });
    expect(routeOf('reto/2026-11-10/', now)).toEqual({ kind: 'daily', date: '2026-11-10' });
  });

  it("opens today's when the day has not come here yet, and says which day it was for", () => {
    expect(routeOf('reto/2026-11-20/kgd84', now)).toEqual({ kind: 'daily', date: now, soon: '2026-11-20' });
    expect(routeOf('reto/2026-11-20', now)).toEqual({ kind: 'daily', date: now });
    // A date that is not one carries no result either.
    expect(routeOf('reto/ayer/kgd84', now)).toEqual({ kind: 'daily', date: now });
    expect(routeOf('reto/2025-12-31/kgd84', now)).toEqual({ kind: 'daily', date: now });
  });
});

describe('the results kept of a day', () => {
  it('take a result that can be, and nothing else', () => {
    expect(isRival(ana)).toBe(true);
    for (const bad of [null, 'Ana', {}, { n: 'Ana' }, { n: 'Ana', p: [1, 2, 3, 4] }, { n: 'Ana', p: [1, 2, 3, 4, 21] }, { n: 'Ana', p: [1, 2, 3, 4, 2.5] }, { n: 3, p: [1, 2, 3, 4, 5] }, { n: 'x'.repeat(25), p: [1, 2, 3, 4, 5] }])
      expect(isRival(bad), JSON.stringify(bad)).toBe(false);
  });

  it('grow one by one, and whoever sends again takes the place they had', () => {
    let rivals = withRival({}, DAY, ana);
    rivals = withRival(rivals, DAY, luis);
    expect(rivals[DAY]).toEqual([ana, luis]);
    // Ana sends another result: hers is replaced, and goes last.
    rivals = withRival(rivals, DAY, { n: 'Ana', p: [20, 20, 20, 20, 20] });
    expect(rivals[DAY]).toEqual([luis, { n: 'Ana', p: [20, 20, 20, 20, 20] }]);
    // With no name, the same points are the same result; other points, somebody else.
    rivals = withRival(rivals, DAY, { n: '', p: [1, 2, 3, 4, 5] });
    rivals = withRival(rivals, DAY, { n: '', p: [1, 2, 3, 4, 5] });
    rivals = withRival(rivals, DAY, { n: '', p: [5, 4, 3, 2, 1] });
    expect(rivals[DAY].map((r) => r.n)).toEqual(['Luis', 'Ana', '', '']);
    // Another day has its own list.
    rivals = withRival(rivals, addDays(DAY, -1), ana);
    expect(rivals[addDays(DAY, -1)]).toEqual([ana]);
    expect(rivals[DAY]).toHaveLength(4);
  });

  it('are no more than fit: the oldest give way, by result and by day', () => {
    let rivals: Record<string, Rival[]> = {};
    for (let i = 0; i < RIVALS_MAX + 3; i++) rivals = withRival(rivals, DAY, { n: `P${i}`, p: [i, 0, 0, 0, 0] });
    expect(rivals[DAY]).toHaveLength(RIVALS_MAX);
    expect(rivals[DAY][0].n).toBe('P3');
    expect(rivals[DAY][RIVALS_MAX - 1].n).toBe(`P${RIVALS_MAX + 2}`);
    for (let k = 1; k <= RIVAL_DAYS + 5; k++) rivals = withRival(rivals, addDays(DAY, -k), ana);
    expect(Object.keys(rivals)).toHaveLength(RIVAL_DAYS);
    expect(rivals[DAY]).toHaveLength(RIVALS_MAX);
    expect(rivals[addDays(DAY, -(RIVAL_DAYS + 5))]).toBeUndefined();
  });

  it('are cleaned when read from what was saved', () => {
    expect(cleanRivals(null)).toEqual({});
    expect(cleanRivals('x')).toEqual({});
    expect(cleanRivals({ [DAY]: [ana, { n: 'Mal', p: [99] }, 'x'], nonsense: [ana], '2026-02-30': [ana], '2026-11-18': 'x', '2026-11-17': [] })).toEqual({ [DAY]: [ana] });
  });

  it('live in the store, are dropped one by one, and go with the progress', () => {
    const fresh = useStore.getState();
    try {
      const st = useStore.getState();
      st.addRival(DAY, ana);
      st.addRival(DAY, luis);
      expect(useStore.getState().rivals).toEqual({ [DAY]: [ana, luis] });
      st.dropRival(DAY, 0);
      expect(useStore.getState().rivals).toEqual({ [DAY]: [luis] });
      st.dropRival(DAY, 5);
      expect(useStore.getState().rivals).toEqual({ [DAY]: [luis] });
      // The last one out takes the day with it.
      st.dropRival(DAY, 0);
      expect(useStore.getState().rivals).toEqual({});
      st.addRival(DAY, ana);
      st.resetProgress();
      expect(useStore.getState().rivals).toEqual({});
    } finally {
      useStore.setState(fresh, true);
    }
  });
});

describe('everybody in order', () => {
  it('puts the highest total first and gives those level the same place', () => {
    // Ana 73, Luis 55, and 61 of one's own.
    const rows = ranking([20, 16, 13, 8, 4], [ana, luis], unnamed);
    expect(rows.map((r) => [r.name, r.me, r.total, r.place, r.index])).toEqual([
      ['Ana', false, 73, 1, 0],
      ['', true, 61, 2, -1],
      ['Luis', false, 55, 3, 1],
    ]);
    // Level with Ana: one's own row first, and both first.
    const tie = ranking([16, 20, 13, 12, 12], [ana, luis], unnamed);
    expect(tie.map((r) => [r.me, r.place])).toEqual([
      [true, 1],
      [false, 1],
      [false, 3],
    ]);
  });

  it('lists only the others while the challenge is not finished', () => {
    const rows = ranking(null, [luis, ana], unnamed);
    expect(rows.map((r) => r.name)).toEqual(['Ana', 'Luis']);
    expect(rows.every((r) => !r.me)).toBe(true);
  });

  it('tells results with no name apart by a number when there are several', () => {
    expect(ranking(null, [{ n: '', p: [1, 1, 1, 1, 1] }], unnamed).map((r) => r.name)).toEqual(['Rival']);
    expect(ranking(null, [{ n: '', p: [1, 1, 1, 1, 1] }, ana, { n: '', p: [2, 2, 2, 2, 2] }], unnamed).map((r) => r.name)).toEqual(['Ana', 'Rival 2', 'Rival 1']);
  });

  it('marks the best points of each test, and nobody where all got the same', () => {
    const rows = ranking([20, 16, 13, 8, 12], [ana, luis], unnamed);
    // Regionle 20 (two of them), Señalar 20, Ruta 13 (two), ¿Qué país? 12 (two), and the last 12 (two).
    expect(bestOf(rows)).toEqual([20, 20, 13, 12, 12]);
    expect(bestOf(ranking([16, 20, 13, 12, 12], [ana], unnamed))).toEqual([-1, -1, -1, -1, -1]);
    expect(bestOf(ranking(null, [ana], unnamed))).toEqual([-1, -1, -1, -1, -1]);
  });
});
