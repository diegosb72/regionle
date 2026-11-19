import { describe, expect, it } from 'vitest';
import { useStore } from '../lib/store';
import { today } from '../lib/text';
import { HARD_CLUE_AT, HARD_GUESSES, TURN_MIN, guessesOf, hardByDefault, hardTurn, pinTriesOf } from './hard';
import { EPOCH, GUESSES, addDays, isRival, ladder, type DailyRec } from './spec';
import { dailyStats } from './stats';
import { decodeResult, encodeResult, ranking } from './versus';

const rec = (t: number, extra: Partial<DailyRec> = {}): DailyRec => ({ p: [20, 16, 13, 8, 4], k: [1, 4, 2, 3, 1], t, ...extra });

describe('the hard way of the daily challenge', () => {
  it('has four tries at the outline, which the screen spells out, and one at each piece to point at', () => {
    // "en cuatro intentos" · "in four tries" (daily/Daily.tsx).
    expect(HARD_GUESSES).toBe(4);
    expect(guessesOf(true)).toBe(4);
    expect(guessesOf(false)).toBe(GUESSES);
    expect(pinTriesOf(true)).toBe(1);
    expect(pinTriesOf(false)).toBe(2);
    expect(HARD_CLUE_AT).toBe(3);
    // The points of a guess are the same either way: the fourth try is worth what it always was.
    expect([1, 2, 3, 4].map((n) => ladder(n, true))).toEqual([20, 16, 12, 9]);
  });

  it('turns the outline of the day the same for everybody, and never leaves it nearly upright', () => {
    const turns = new Set<number>();
    for (let k = 0; k < 400; k++) {
      const date = addDays(EPOCH, k);
      const turn = hardTurn(date);
      expect(Number.isInteger(turn)).toBe(true);
      expect(turn).toBeGreaterThanOrEqual(TURN_MIN);
      expect(turn).toBeLessThanOrEqual(360 - TURN_MIN);
      expect(hardTurn(date)).toBe(turn);
      turns.add(turn);
    }
    // Not the same turn day after day.
    expect(turns.size).toBeGreaterThan(150);
  });

  it('is offered first to whoever finished the last challenge that way', () => {
    expect(hardByDefault({})).toBe(false);
    expect(hardByDefault({ '2026-11-17': rec(100) })).toBe(false);
    expect(hardByDefault({ '2026-11-17': rec(100, { h: 1 }) })).toBe(true);
    // The one finished last counts, whatever day it was of: an old day played afterwards, the plain way.
    expect(hardByDefault({ '2026-11-17': rec(100, { h: 1 }), '2026-11-10': rec(200) })).toBe(false);
    expect(hardByDefault({ '2026-11-17': rec(100), '2026-11-10': rec(200, { h: 1 }) })).toBe(true);
    // A day begun the hard way and not finished says nothing yet; nor does a day a wildcard held.
    expect(hardByDefault({ '2026-11-17': rec(100), '2026-11-18': { p: [12, null, null, null, null], k: [3, null, null, null, null], h: 1 } })).toBe(false);
    expect(hardByDefault({ '2026-11-17': rec(100, { h: 1 }), '2026-11-18': { p: [null, null, null, null, null], k: [null, null, null, null, null], j: 1 } })).toBe(true);
  });
});

describe('how a day is played', () => {
  it('is settled with the first test that is scored, and kept to the end', () => {
    const fresh = useStore.getState();
    try {
      const day = today();
      const other = addDays(day, -3);
      const st = useStore.getState();
      st.setDaily(day, 0, 12, 3, true);
      expect(useStore.getState().daily[day]).toMatchObject({ p: [12, null, null, null, null], h: 1 });
      // The rest of the day is hard whatever is said afterwards.
      st.setDaily(day, 1, 8, 2, false);
      st.setDaily(day, 2, 13, 2);
      st.setDaily(day, 3, 9, 4, true);
      st.setDaily(day, 4, 12, 3, true);
      const done = useStore.getState().daily[day];
      expect(done.h).toBe(1);
      expect(done.p).toEqual([12, 8, 13, 9, 12]);
      expect(done.t).toBeGreaterThan(0);

      // A day begun the plain way does not turn hard halfway.
      st.setDaily(other, 0, 20, 1);
      st.setDaily(other, 1, 16, 4, true);
      expect(useStore.getState().daily[other].h).toBeUndefined();
      expect(useStore.getState().daily[other].p).toEqual([20, 16, null, null, null]);
    } finally {
      useStore.setState(fresh, true);
    }
  });

  it('is counted among the figures', () => {
    const daily = { '2026-11-16': rec(1, { h: 1 }), '2026-11-17': rec(2), '2026-11-18': rec(3, { h: 1 }), '2026-11-19': { p: [12, null, null, null, null], k: [3, null, null, null, null], h: 1 as const } };
    const s = dailyStats(daily, '2026-11-19');
    expect(s.played).toBe(3);
    expect(s.hard).toBe(2);
    expect(dailyStats({ '2026-11-17': rec(2) }, '2026-11-19').hard).toBe(0);
  });
});

describe('a hard result sent by link', () => {
  it('says so after the points', () => {
    expect(encodeResult([20, 16, 13, 8, 4], '', true)).toBe('kgd84x');
    expect(encodeResult([20, 16, 13, 8, 4], 'Ana', true)).toBe('kgd84x.QW5h');
    expect(decodeResult('kgd84x')).toEqual({ n: '', p: [20, 16, 13, 8, 4], h: 1 });
    expect(decodeResult('kgd84x.QW5h')).toEqual({ n: 'Ana', p: [20, 16, 13, 8, 4], h: 1 });
    // A plain one says nothing, as before.
    expect(decodeResult('kgd84.QW5h')).toEqual({ n: 'Ana', p: [20, 16, 13, 8, 4] });
    for (const bad of ['kgd84xx', 'kgd84X', 'kgd8x', 'xkgd84', 'kgd84.x.QW5h']) expect(decodeResult(bad), bad).toBeNull();
  });

  it('is kept and marked in the table, where its points count like any others', () => {
    expect(isRival({ n: 'Ana', p: [1, 2, 3, 4, 5], h: 1 })).toBe(true);
    expect(isRival({ n: 'Ana', p: [1, 2, 3, 4, 5], h: 2 })).toBe(false);
    expect(isRival({ n: 'Ana', p: [1, 2, 3, 4, 5], h: true })).toBe(false);
    const rows = ranking([20, 16, 13, 8, 4], [{ n: 'Ana', p: [16, 20, 13, 12, 12] }, { n: 'Luis', p: [20, 8, 7, 12, 8], h: 1 }], () => 'Rival', true);
    expect(rows.map((r) => [r.me ? 'me' : r.name, r.total, r.place, r.hard])).toEqual([
      ['Ana', 73, 1, false],
      ['me', 61, 2, true],
      ['Luis', 55, 3, true],
    ]);
    expect(ranking([20, 16, 13, 8, 4], [], () => 'Rival')[0].hard).toBe(false);
  });
});
