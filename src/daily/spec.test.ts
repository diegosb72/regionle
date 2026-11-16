import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Index } from '../lib/types';
import { addDays, bearing, compass, countryOfDay, dailyPool, dayNumber, emptyRec, isDate, ladder, quickQuestions, regionTargets, routePoints, streakOf, whichTarget } from './spec';

const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as Index;

describe('dates', () => {
  it('counts days from the epoch and back', () => {
    expect(dayNumber('2026-01-01')).toBe(0);
    expect(dayNumber('2026-03-01')).toBe(59);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(isDate('2026-02-30')).toBe(false);
    expect(isDate('2026-11-16')).toBe(true);
    expect(isDate('hoy')).toBe(false);
  });
});

describe('country of the day', () => {
  const pool = dailyPool(index);

  it('draws from countries with a playable first level', () => {
    expect(pool.length).toBeGreaterThan(120);
    for (const c of pool) {
      const n = (c.lv.find((l) => l.k === c.dl) ?? c.lv[c.lv.length - 1]).n;
      expect(n).toBeGreaterThanOrEqual(8);
      expect(n).toBeLessThanOrEqual(60);
    }
    expect(pool.some((c) => c.id === 'ES')).toBe(true);
  });

  it('is the same on every call and never repeats within a month', () => {
    const days = Array.from({ length: 800 }, (_, n) => countryOfDay(pool, n).id);
    expect(countryOfDay(pool, 321).id).toBe(days[321]);
    let worst = Infinity;
    const last = new Map<string, number>();
    days.forEach((id, n) => {
      if (last.has(id)) worst = Math.min(worst, n - last.get(id)!);
      last.set(id, n);
    });
    expect(worst).toBeGreaterThan(30);
    expect(new Set(days).size).toBe(pool.length);
  });

  it('shows populous countries more often', () => {
    const days = Array.from({ length: 2000 }, (_, n) => countryOfDay(pool, n).id);
    const times = (id: string) => days.filter((d) => d === id).length;
    expect(times('IN')).toBeGreaterThan(times('PT'));
  });
});

describe('tests of the day', () => {
  it('picks six different regions, the same for a given date', () => {
    const ids = Array.from({ length: 19 }, (_, i) => `ES-${i}`);
    const a = regionTargets('2026-11-16', ids);
    const b = regionTargets('2026-11-16', [...ids].reverse());
    expect(a).toEqual(b);
    expect(new Set([a.mystery, ...a.pins]).size).toBe(6);
    expect(regionTargets('2026-11-17', ids)).not.toEqual(a);
  });

  it('asks five quick questions with the answer among four options', () => {
    const qs = quickQuestions('2026-11-16', index, ['ES']);
    expect(qs.map((q) => q.kind)).toEqual(['flag', 'flag', 'flag', 'capital', 'capital']);
    for (const q of qs) {
      expect(q.options).toContain(q.id);
      expect(new Set(q.options).size).toBe(4);
      expect(q.id).not.toBe('ES');
    }
    expect(quickQuestions('2026-11-16', index, ['ES'])).toEqual(qs);
  });

  it('picks a country with a known population to guess', () => {
    const c = whichTarget('2026-11-16', index, 'ES');
    expect(c.pop).toBeGreaterThan(1e6);
    expect(c.id).not.toBe('ES');
  });
});

describe('scoring', () => {
  it('gives fewer points for later guesses and none for a miss', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => ladder(n, true))).toEqual([20, 16, 12, 9, 6, 3]);
    expect(ladder(6, false)).toBe(0);
    expect(routePoints(0, false)).toBe(20);
    expect(routePoints(2, false)).toBe(13);
    expect(routePoints(0, true)).toBe(0);
  });

  it('counts a streak of days finished on time', () => {
    const done = () => ({ ...emptyRec(), p: [20, 20, 20, 20, 20], t: 1 });
    const daily = { '2026-11-14': done(), '2026-11-15': done(), '2026-11-16': done(), '2026-11-12': done(), '2026-11-13': { ...done(), late: 1 as const } };
    expect(streakOf(daily, '2026-11-16')).toBe(3);
    expect(streakOf(daily, '2026-11-17')).toBe(3);
    expect(streakOf(daily, '2026-11-18')).toBe(0);
  });
});

describe('compass', () => {
  it('points from one place to another', () => {
    expect(compass(bearing([0, 0], [0, 10]))).toBe(0);
    expect(compass(bearing([0, 0], [10, 0]))).toBe(2);
    expect(compass(bearing([0, 0], [-10, -10]))).toBe(5);
    expect(compass(bearing([-3.7, 40.4], [2.17, 41.38]))).toBe(2);
  });
});
