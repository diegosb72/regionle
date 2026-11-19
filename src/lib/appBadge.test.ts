import { describe, expect, it } from 'vitest';
import { BADGE_DAYS, BADGE_STEP, badgeAt, badgeSchedule, waitingAt } from './appBadge';
import { dueCount, dueGroups } from './review';
import type { Stat } from './store';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = new Date('2026-11-19T10:00:00Z').getTime();
/** Where each piece was learnt: the communities of Spain. */
const WHERE = Object.fromEntries(['ES-AN', 'ES-AR', 'ES-CL', 'ES-GA', 'ES-MD'].map((id) => [id, 'r|ES|g1']));
/** [times asked, times right first time, run, last time]: a run of 1 comes back after a day, of 2 after three. */
const stat = (run: number, ago: number): Stat => [3, 2, run, NOW - ago] as unknown as Stat;

describe('the number on the icon', () => {
  const stats: Record<string, Stat> = {
    // Missed two hours ago: due since ten minutes after.
    'loc:ES-AN': stat(0, 2 * HOUR),
    // Right once, twenty hours ago: due in four hours — which, with the slack of a planned day, is now.
    'loc:ES-AR': stat(1, 20 * HOUR),
    // Right once, an hour ago: due tomorrow.
    'loc:ES-CL': stat(1, 1 * HOUR),
    // Right twice running, yesterday: due the day after tomorrow.
    'loc:ES-GA': stat(2, 1 * DAY),
    // Never asked: nothing to review.
    'loc:ES-MD': [0, 0, 0, 0] as unknown as Stat,
  };

  it('counts what the first page counts', () => {
    expect(waitingAt(stats, WHERE, NOW)).toBe(dueCount(dueGroups(stats, WHERE, NOW)));
    expect(waitingAt(stats, WHERE, NOW)).toBe(2);
    expect(waitingAt({}, {}, NOW)).toBe(0);
  });

  it('is worked out ahead, a step for each change, for as long as the worker may be on its own', () => {
    const schedule = badgeSchedule(stats, WHERE, NOW);
    expect(schedule[0]).toEqual([NOW, 2]);
    // Three tomorrow, four the day after, and no more to come.
    expect(schedule.map((s) => s[1])).toEqual([2, 3, 4]);
    for (const [at] of schedule) expect((at - NOW) % BADGE_STEP).toBe(0);
    expect(schedule[schedule.length - 1][0]).toBeLessThanOrEqual(NOW + BADGE_DAYS * DAY);
    // Each step is what the count would be then.
    for (const [at, count] of schedule) expect(waitingAt(stats, WHERE, at)).toBe(count);
    // Nothing kept: a single step that says nothing is waiting.
    expect(badgeSchedule({}, {}, NOW)).toEqual([[NOW, 0]]);
  });

  it('is read off the schedule at any moment', () => {
    const schedule = badgeSchedule(stats, WHERE, NOW);
    expect(badgeAt(schedule, NOW - 1)).toBeNull();
    expect(badgeAt(schedule, NOW)).toBe(2);
    expect(badgeAt(schedule, NOW + 1 * HOUR)).toBe(2);
    expect(badgeAt(schedule, NOW + 1 * DAY)).toBe(3);
    expect(badgeAt(schedule, NOW + 3 * DAY)).toBe(4);
    // Long after the last step, the last count stands.
    expect(badgeAt(schedule, NOW + 400 * DAY)).toBe(4);
    expect(badgeAt([], NOW)).toBeNull();
  });
});
