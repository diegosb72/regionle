// The review as the player sets it: how far apart the answers come back, and how many a review game asks.

import { afterEach, describe, expect, it } from 'vitest';
import { goalGame, goalState, type Goal } from './goals';
import { PACES, PACE_DAYS, PACE_DEFAULT, REVIEW_MAX, REVIEW_SIZES, dueCount, dueGroups, forecast, gradeOf, intervalOf, isDue, isPace, isReviewSize, reviewConfig, reviewMax, reviewPace, setReviewPrefs } from './review';
import { DEFAULT_OPTS, mergeSaved, useStore, type Stat } from './store';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const NOW = new Date(2026, 10, 16, 12, 0, 0).getTime();
const stat = (run: number, ago: number, seen = Math.max(1, run)): Stat => [seen, run, run, NOW - ago];

afterEach(() => {
  setReviewPrefs({ pace: PACE_DEFAULT, size: REVIEW_MAX });
  useStore.getState().setReviewPace(PACE_DEFAULT);
  useStore.getState().setReviewSize(REVIEW_MAX);
});

describe('the pace of the reviews', () => {
  it('is the usual one until another is chosen', () => {
    expect(reviewPace()).toBe('normal');
    expect(reviewMax()).toBe(30);
    expect(PACES).toEqual(['short', 'normal', 'long']);
    expect(PACE_DAYS.normal).toEqual([1, 3, 7, 16, 35, 75]);
  });

  it('has waits that grow at every pace, and each pace waits longer than the one before', () => {
    for (const pace of PACES) expect([...PACE_DAYS[pace]].sort((a, b) => a - b)).toEqual([...PACE_DAYS[pace]]);
    for (let i = 0; i < PACE_DAYS.normal.length; i++) {
      expect(PACE_DAYS.short[i]).toBeLessThanOrEqual(PACE_DAYS.normal[i]);
      expect(PACE_DAYS.long[i]).toBeGreaterThan(PACE_DAYS.normal[i]);
    }
  });

  it('sets how long an answer waits after each run of right answers', () => {
    setReviewPrefs({ pace: 'short' });
    expect([1, 2, 3, 4, 5, 6, 99].map((run) => intervalOf(run) / DAY)).toEqual([1, 2, 4, 8, 16, 32, 32]);
    setReviewPrefs({ pace: 'long' });
    expect([1, 2, 3, 4, 5, 6, 99].map((run) => intervalOf(run) / DAY)).toEqual([2, 6, 14, 30, 60, 120, 120]);
    setReviewPrefs({ pace: 'normal' });
    expect([1, 2, 3, 4, 5, 6, 99].map((run) => intervalOf(run) / DAY)).toEqual([1, 3, 7, 16, 35, 75, 75]);
  });

  it('brings a miss back the same day at any pace', () => {
    for (const pace of PACES) {
      setReviewPrefs({ pace });
      expect(intervalOf(0)).toBe(10 * MIN);
      expect(intervalOf(-1)).toBe(10 * MIN);
      expect(isDue(stat(0, 11 * MIN), NOW)).toBe(true);
    }
  });

  it('moves what is due without touching what was answered', () => {
    // Right twice in a row, two and a half days ago: it comes back after two days, three or six.
    const stats = { 'loc:ES-AN': stat(2, 2.5 * DAY), 'loc:ES-AR': stat(1, 1.5 * DAY) };
    const where = { 'ES-AN': 'r|ES|g1', 'ES-AR': 'r|ES|g1' };
    const kept = JSON.stringify(stats);
    const due = () => dueCount(dueGroups(stats, where, NOW));
    expect(due()).toBe(1);
    expect(gradeOf(stats['loc:ES-AN'], NOW)).toBe('known');
    setReviewPrefs({ pace: 'short' });
    expect(due()).toBe(2);
    expect(gradeOf(stats['loc:ES-AN'], NOW)).toBe('due');
    setReviewPrefs({ pace: 'long' });
    // At the long pace one right answer waits two days and two wait six: neither is back yet.
    expect(due()).toBe(0);
    expect(gradeOf(stats['loc:ES-AN'], NOW)).toBe('known');
    expect(JSON.stringify(stats)).toBe(kept);
  });

  it('moves the forecast of the days ahead', () => {
    const stats = { 'loc:A': stat(1, 0), 'loc:B': stat(2, 0) };
    expect(forecast(stats, NOW, 7)).toEqual([0, 1, 0, 1, 0, 0, 0]);
    setReviewPrefs({ pace: 'short' });
    expect(forecast(stats, NOW, 7)).toEqual([0, 1, 1, 0, 0, 0, 0]);
    setReviewPrefs({ pace: 'long' });
    expect(forecast(stats, NOW, 7)).toEqual([0, 0, 1, 0, 0, 0, 1]);
  });

  it('takes nothing that is not a pace or a size on offer', () => {
    expect(isPace('short')).toBe(true);
    expect(isPace('faster')).toBe(false);
    expect(isPace(2)).toBe(false);
    expect(isReviewSize(20)).toBe(true);
    expect(isReviewSize(25)).toBe(false);
    expect(isReviewSize('20')).toBe(false);
    setReviewPrefs({ pace: 'faster' as never, size: 7 });
    expect(reviewPace()).toBe('normal');
    expect(reviewMax()).toBe(30);
  });
});

describe('the size of a review game', () => {
  const many: Record<string, Stat> = {};
  for (let i = 0; i < 60; i++) many[`loc:${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`] = stat(0, DAY + i * MIN);

  it('is one of four, and the game of a review asks that many at most', () => {
    expect(REVIEW_SIZES).toEqual([10, 20, 30, 50]);
    const [g] = dueGroups(many, {}, NOW);
    expect(g.ids).toHaveLength(60);
    for (const size of REVIEW_SIZES) {
      setReviewPrefs({ size });
      expect(reviewMax()).toBe(size);
      const cfg = reviewConfig(g, DEFAULT_OPTS);
      expect(cfg.only).toHaveLength(size);
      // The longest overdue first, whatever the size.
      expect(cfg.only).toEqual(g.ids.slice(0, size));
    }
  });

  it('is the size of the review of a goal too', () => {
    const ids = Object.keys(many).map((k) => k.slice(4));
    const goal: Goal = { id: 'g', name: 'Examen', date: '2027-01-20', section: 'countries', skill: 'loc', countries: ids, levels: {}, ids, made: NOW };
    const state = goalState(goal, many, NOW);
    expect(state.pending).toHaveLength(60);
    setReviewPrefs({ size: 10 });
    expect(goalGame(goal, state, DEFAULT_OPTS, 'review').only).toHaveLength(10);
    setReviewPrefs({ size: 50 });
    expect(goalGame(goal, state, DEFAULT_OPTS, 'review').only).toHaveLength(50);
  });
});

describe('the review settings of the saved game', () => {
  it('are followed by every count from the moment they change', () => {
    const s = useStore.getState();
    s.setReviewPace('long');
    expect(reviewPace()).toBe('long');
    s.setReviewSize(50);
    expect(reviewMax()).toBe(50);
    s.setReviewPace('whenever' as never);
    expect(useStore.getState().reviewPace).toBe('normal');
    expect(reviewPace()).toBe('normal');
    s.setReviewSize(33);
    expect(useStore.getState().reviewSize).toBe(30);
    expect(reviewMax()).toBe(30);
  });

  it('are the usual ones for whoever saved the game before they existed, and cleaned otherwise', () => {
    const now = useStore.getState();
    expect(mergeSaved({}, now)).toMatchObject({ reviewPace: 'normal', reviewSize: 30 });
    expect(mergeSaved({ reviewPace: 'short', reviewSize: 10 }, now)).toMatchObject({ reviewPace: 'short', reviewSize: 10 });
    expect(mergeSaved({ reviewPace: 'x', reviewSize: 1000 }, now)).toMatchObject({ reviewPace: 'normal', reviewSize: 30 });
  });
});
