import { describe, expect, it } from 'vitest';
import { dayGap, historyOf, mixedWith } from './history';
import { mixKey, type Mix } from './mix';
import { INTERVALS } from './review';
import type { Stat } from './store';

const DAY = 864e5;
/** Noon of a day, in the time of whoever runs the test. */
const noon = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();
const NOW = noon(2026, 11, 18);

describe('what is known of a piece', () => {
  it('is told skill by skill, for the skills it was asked about', () => {
    const stats: Record<string, Stat> = {
      // Placed seven times, five of them right first time, twice in a row by now: learnt, and back in a week.
      'loc:IT': [7, 5, 2, NOW - 2 * DAY],
      // Named three times, missed the last: it is being learnt and comes back within minutes.
      'name:IT': [3, 2, 0, NOW - 60_000],
      // Its flag was learnt long ago: it is due.
      'flag:IT': [4, 4, 3, NOW - 30 * DAY],
      // Never asked: a stat with nothing in it is no history.
      'cap:IT': [0, 0, 0, 0],
      'loc:FR': [1, 1, 1, NOW],
    };
    expect(historyOf(stats, 'IT', NOW)).toEqual([
      { skill: 'loc', seen: 7, right: 5, run: 2, last: NOW - 2 * DAY, grade: 'known', due: NOW - 2 * DAY + INTERVALS[2] },
      { skill: 'name', seen: 3, right: 2, run: 0, last: NOW - 60_000, grade: 'learning', due: NOW - 60_000 + INTERVALS[0] },
      { skill: 'flag', seen: 4, right: 4, run: 3, last: NOW - 30 * DAY, grade: 'due', due: NOW - 30 * DAY + INTERVALS[3] },
    ]);
    expect(historyOf(stats, 'ES', NOW)).toEqual([]);
    expect(historyOf({}, 'IT', NOW)).toEqual([]);
  });

  it('never says more right answers than questions', () => {
    expect(historyOf({ 'loc:IT': [2, 5, 1, NOW] }, 'IT', NOW)[0].right).toBe(2);
  });

  it('says what it is taken for, whichever of the two was asked, the most mixed up first', () => {
    const mix: Mix = {
      [mixKey('loc', 'SI', 'SK')]: [3, NOW - DAY],
      [mixKey('loc', 'SK', 'SI')]: [1, NOW - DAY],
      [mixKey('flag', 'SI', 'RU')]: [1, NOW],
      [mixKey('loc', 'LV', 'LT')]: [5, NOW],
    };
    expect(mixedWith(mix, {}, 'SI')).toEqual([
      { skill: 'loc', other: 'SK', times: 4 },
      { skill: 'flag', other: 'RU', times: 1 },
    ]);
    expect(mixedWith(mix, {}, 'SK')).toEqual([{ skill: 'loc', other: 'SI', times: 4 }]);
    expect(mixedWith(mix, {}, 'ES')).toEqual([]);
  });

  it('forgets a mix-up once both are told apart: right twice in a row since', () => {
    const mix: Mix = { [mixKey('loc', 'SI', 'SK')]: [3, NOW - 5 * DAY] };
    expect(mixedWith(mix, { 'loc:SI': [6, 3, 2, NOW - DAY] }, 'SI')).toEqual([]);
    // A run from before the mix-up does not count.
    expect(mixedWith(mix, { 'loc:SI': [6, 3, 2, NOW - 9 * DAY] }, 'SI')).toHaveLength(1);
  });

  it('counts days by the calendar, not by twenty-four hours', () => {
    expect(dayGap(noon(2026, 11, 18), noon(2026, 11, 18) + 6 * 3_600_000)).toBe(0);
    // From late one day to early the next is a day, though hours apart.
    expect(dayGap(new Date(2026, 10, 18, 23, 30).getTime(), new Date(2026, 10, 19, 0, 30).getTime())).toBe(1);
    expect(dayGap(noon(2026, 11, 18), noon(2026, 11, 25))).toBe(7);
    expect(dayGap(noon(2026, 11, 18), noon(2026, 11, 15))).toBe(-3);
    // Across the change of hour in spring and in autumn.
    expect(dayGap(noon(2026, 3, 28), noon(2026, 3, 30))).toBe(2);
    expect(dayGap(noon(2026, 10, 24), noon(2026, 10, 26))).toBe(2);
  });
});
