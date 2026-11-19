import { describe, expect, it } from 'vitest';
import { addDays, emptyRec, type DailyRec } from './spec';
import { BANDS, RECENT, bandLabel, bandOf, dailyStats, extremes } from './stats';

const DAY = '2026-11-19';
const rec = (p: number[], extra: Partial<DailyRec> = {}): DailyRec => ({ p, k: [1, 1, 1, 1, 1], t: 1, ...extra });
const at = (k: number): string => addDays(DAY, k);

describe('the bands of the totals', () => {
  it('are five, twenty points wide, and the last takes the hundred', () => {
    expect(BANDS).toBe(5);
    expect([0, 19, 20, 39, 40, 59, 60, 79, 80, 99, 100].map(bandOf)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4]);
    expect([0, 1, 2, 3, 4].map(bandLabel)).toEqual(['0–19', '20–39', '40–59', '60–79', '80–100']);
    // A total out of range (a file put together by hand) still falls in a band.
    expect([bandOf(-5), bandOf(250)]).toEqual([0, 4]);
  });
});

describe('the figures of the daily challenge', () => {
  it('are empty with nothing finished', () => {
    const none = dailyStats({}, DAY);
    expect(none).toMatchObject({ played: 0, late: 0, mean: 0, best: null, bands: [0, 0, 0, 0, 0], recent: null, streak: 0, longest: 0, jokers: 0, held: 0, since: null });
    expect(none.tests).toHaveLength(5);
    // A challenge left halfway is not a result.
    expect(dailyStats({ [DAY]: { ...emptyRec(), p: [20, 16, null, null, null] } }, DAY).played).toBe(0);
  });

  it('count what was finished, on its day or later, and average it', () => {
    const daily = {
      [at(-3)]: rec([20, 20, 20, 20, 20]),
      [at(-2)]: rec([20, 16, 13, 8, 4]),
      [at(-1)]: rec([0, 4, 0, 3, 8], { late: 1 }),
      [at(0)]: rec([20, 20, 20, 20, 20]),
    };
    const s = dailyStats(daily, DAY);
    expect(s.played).toBe(4);
    expect(s.late).toBe(1);
    expect(s.mean).toBeCloseTo((100 + 61 + 15 + 100) / 4);
    // The best total, on the first day it was reached.
    expect(s.best).toEqual({ date: at(-3), total: 100 });
    expect(s.bands).toEqual([1, 0, 0, 1, 2]);
    expect(s.since).toBe(at(-3));
    // Yesterday was finished late: the days in a row are today's alone.
    expect(s).toMatchObject({ streak: 1, longest: 2, jokers: 0, held: 0 });
  });

  it('say how each test goes: its average, its full marks and its blanks', () => {
    const s = dailyStats({ [at(-2)]: rec([20, 16, 13, 8, 4]), [at(-1)]: rec([20, 8, 0, 8, 0]), [at(0)]: rec([20, 12, 20, 2, 0]) }, DAY);
    expect(s.tests.map((t) => Math.round(t.mean * 10) / 10)).toEqual([20, 12, 11, 6, 1.3]);
    expect(s.tests.map((t) => t.full)).toEqual([3, 0, 1, 0, 0]);
    expect(s.tests.map((t) => t.zero)).toEqual([0, 0, 1, 0, 2]);
    expect(extremes(s.tests, s.played)).toEqual({ best: 0, worst: 4 });
  });

  it('tell the best test from the worst only when there is something to tell', () => {
    const even = dailyStats({ [at(-2)]: rec([12, 12, 12, 12, 12]), [at(-1)]: rec([12, 12, 12, 12, 12]), [at(0)]: rec([12, 12, 12, 12, 12]) }, DAY);
    expect(extremes(even.tests, even.played)).toBeNull();
    const few = dailyStats({ [at(-1)]: rec([20, 0, 0, 0, 0]), [at(0)]: rec([20, 0, 0, 0, 0]) }, DAY);
    expect(extremes(few.tests, few.played)).toBeNull();
  });

  it('average the latest challenges apart once more than seven were played', () => {
    const seven = Object.fromEntries(Array.from({ length: RECENT }, (_, i) => [at(-i), rec([20, 20, 20, 20, 20])]));
    expect(dailyStats(seven, DAY).recent).toBeNull();
    // Three poor days long ago, then seven perfect ones.
    const daily = { ...seven, [at(-20)]: rec([0, 0, 0, 0, 0]), [at(-21)]: rec([0, 0, 0, 0, 0]), [at(-22)]: rec([0, 0, 0, 0, 0]) };
    const s = dailyStats(daily, DAY);
    expect(s.played).toBe(10);
    expect(s.mean).toBe(70);
    expect(s.recent).toBe(100);
  });

  it('count the wildcards in hand and the days they held', () => {
    const daily: Record<string, DailyRec> = {};
    for (let k = -16; k <= 0; k++) daily[at(k)] = rec([20, 16, 13, 8, 4]);
    // The day before yesterday was missed and a wildcard held it.
    daily[at(-2)] = { ...emptyRec(), j: 1 };
    const s = dailyStats(daily, DAY);
    expect(s).toMatchObject({ played: 16, streak: 16, longest: 16, jokers: 1, held: 1 });
  });

  it('pass over what is not a result', () => {
    const daily = { [DAY]: rec([20, 16, 13, 8, 4]), nonsense: rec([20, 20, 20, 20, 20]), '2026-02-30': rec([20, 20, 20, 20, 20]), [at(-1)]: { t: 5 } as unknown as DailyRec };
    const s = dailyStats(daily, DAY);
    expect(s.played).toBe(1);
    expect(s.mean).toBe(61);
  });
});
