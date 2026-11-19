import { afterEach, describe, expect, it } from 'vitest';
import { useStore } from '../lib/store';
import { today } from '../lib/text';
import { JOKER_EVERY, JOKER_MAX, addDays, emptyRec, jokersBefore, streakOf, streakState, withJokers, type DailyRec } from './spec';

const DAY = '2026-11-19';
const done = (): DailyRec => ({ ...emptyRec(), p: [20, 16, 13, 8, 4], k: [1, 4, 2, 3, 1], t: 1 });
const late = (): DailyRec => ({ ...done(), late: 1 });
const joker = (): DailyRec => ({ ...emptyRec(), j: 1 });
/** Days finished on their day, from `from` to `to` days from `DAY` (both counted, negative is before). */
const run = (from: number, to: number, base = DAY): Record<string, DailyRec> => Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [addDays(base, from + i), done()]));

describe('the wildcards of the days in a row', () => {
  it('are won one every seven days in a row, and two are kept at most', () => {
    expect([JOKER_EVERY, JOKER_MAX]).toEqual([7, 2]);
    expect(streakState(run(-5, 0), DAY)).toEqual({ days: 6, jokers: 0, save: null, toNext: 1, longest: 6 });
    expect(streakState(run(-6, 0), DAY)).toEqual({ days: 7, jokers: 1, save: null, toNext: 7, longest: 7 });
    expect(streakState(run(-12, 0), DAY)).toEqual({ days: 13, jokers: 1, save: null, toNext: 1, longest: 13 });
    expect(streakState(run(-13, 0), DAY)).toEqual({ days: 14, jokers: 2, save: null, toNext: 0, longest: 14 });
    // The hand is full: more weeks add nothing.
    expect(streakState(run(-40, 0), DAY)).toMatchObject({ days: 41, jokers: 2, toNext: 0 });
  });

  it('count the days up to today, or up to yesterday while today is still open', () => {
    expect(streakState(run(-3, -1), DAY)).toMatchObject({ days: 3, save: null });
    expect(streakState({}, DAY)).toEqual({ days: 0, jokers: 0, save: null, toNext: 7, longest: 0 });
    // A day finished after its day adds nothing, and a day of the future is not looked at.
    expect(streakState({ ...run(-3, -1), [addDays(DAY, -2)]: late() }, DAY)).toMatchObject({ days: 1 });
    expect(streakState({ ...run(-3, 0), [addDays(DAY, 1)]: done() }, DAY)).toMatchObject({ days: 4 });
    // What is not a date is not a day.
    expect(streakState({ ...run(-2, 0), nonsense: done(), '2026-13-40': done() }, DAY)).toMatchObject({ days: 3 });
  });

  it('can save the days in a row when a day was missed: one for each day with nothing', () => {
    // A week up to the day before yesterday, yesterday missed, today open.
    const week = run(-8, -2);
    expect(streakState(week, DAY)).toEqual({ days: 0, jokers: 1, save: { days: 7, gap: 1 }, toNext: 7, longest: 7 });
    // Two days missed and one wildcard: nothing to save, and the wildcard stays in hand.
    expect(streakState(run(-9, -3), DAY)).toEqual({ days: 0, jokers: 1, save: null, toNext: 7, longest: 7 });
    // Two weeks give two wildcards, enough for two days.
    expect(streakState(run(-16, -3), DAY)).toEqual({ days: 0, jokers: 2, save: { days: 14, gap: 2 }, toNext: 0, longest: 14 });
    expect(streakState(run(-17, -4), DAY)).toMatchObject({ days: 0, jokers: 2, save: null });
    // No wildcard, nothing to save.
    expect(streakState(run(-5, -2), DAY)).toMatchObject({ days: 0, jokers: 0, save: null });
  });

  it('stand in for the days missed once today is finished, and the days in a row go on', () => {
    const before = run(-8, -2);
    const after = withJokers({ ...before, [DAY]: done() }, before, DAY);
    expect(after[addDays(DAY, -1)]).toEqual({ ...emptyRec(), j: 1 });
    // The day a wildcard held adds nothing to the count, and takes the wildcard with it.
    expect(streakState(after, DAY)).toEqual({ days: 8, jokers: 0, save: null, toNext: 6, longest: 8 });
    expect(jokersBefore(after, DAY)).toBe(1);
    expect(streakOf(after, DAY)).toBe(8);
    // What was there is not touched.
    expect(before[addDays(DAY, -1)]).toBeUndefined();
  });

  it('keep what a day missed had been played, and its result when it is finished later', () => {
    const half: DailyRec = { ...emptyRec(), p: [20, 16, null, null, null], k: [1, 4, null, null, null] };
    const before = { ...run(-8, -2), [addDays(DAY, -1)]: half };
    const after = withJokers({ ...before, [DAY]: done() }, before, DAY);
    expect(after[addDays(DAY, -1)]).toEqual({ ...half, j: 1 });
    // Finished after its day: it is still the wildcard that holds it.
    const later = { ...after, [addDays(DAY, -1)]: { ...late(), j: 1 as const } };
    expect(streakState(later, DAY)).toMatchObject({ days: 8, jokers: 0 });
  });

  it('are spent two at a time for two days missed, and are won again as the days go on', () => {
    const before = run(-16, -3);
    const after = withJokers({ ...before, [DAY]: done() }, before, DAY);
    expect([after[addDays(DAY, -1)].j, after[addDays(DAY, -2)].j]).toEqual([1, 1]);
    expect(jokersBefore(after, DAY)).toBe(2);
    expect(streakState(after, DAY)).toEqual({ days: 15, jokers: 0, save: null, toNext: 6, longest: 15 });
    // Six more days make twenty-one in a row: another wildcard.
    const more = { ...after, ...run(1, 6) };
    expect(streakState(more, addDays(DAY, 6))).toEqual({ days: 21, jokers: 1, save: null, toNext: 7, longest: 21 });
  });

  it('do nothing when there are not enough of them: the days in a row start again', () => {
    const before = run(-9, -3);
    const after = withJokers({ ...before, [DAY]: done() }, before, DAY);
    expect(after).toEqual({ ...before, [DAY]: done() });
    expect(streakState(after, DAY)).toEqual({ days: 1, jokers: 1, save: null, toNext: 6, longest: 7 });
    expect(jokersBefore(after, DAY)).toBe(0);
  });

  it('hold nothing when a day is marked and there was no wildcard to pay for it', () => {
    const forged = { ...run(-4, -2), [addDays(DAY, -1)]: joker(), [DAY]: done() };
    expect(streakState(forged, DAY)).toMatchObject({ days: 1, jokers: 0 });
  });
});

describe('finishing the challenge of today', () => {
  const fresh = useStore.getState();
  afterEach(() => useStore.setState(fresh, true));

  it('spends a wildcard on yesterday when it was missed, and writes the longest run down', () => {
    const date = today();
    const before = run(-8, -2, date);
    useStore.setState({ daily: before, best: { 'daily:streak': 7 } });
    const st = useStore.getState();
    for (let test = 0; test < 4; test++) st.setDaily(date, test, 20, 1);
    // Not finished yet: nothing is spent.
    expect(useStore.getState().daily[addDays(date, -1)]).toBeUndefined();
    st.setDaily(date, 4, 20, 1);
    const { daily, best } = useStore.getState();
    expect(daily[addDays(date, -1)]).toEqual({ ...emptyRec(), j: 1 });
    expect(streakState(daily, date)).toMatchObject({ days: 8, jokers: 0 });
    expect(best['daily:streak']).toBe(8);
  });

  it('spends nothing on a challenge of another day, nor when yesterday was played', () => {
    const date = today();
    const past = addDays(date, -1);
    useStore.setState({ daily: run(-9, -3, date) });
    for (let test = 0; test < 5; test++) useStore.getState().setDaily(past, test, 20, 1);
    expect(useStore.getState().daily[past]).toMatchObject({ late: 1 });
    expect(useStore.getState().daily[past].j).toBeUndefined();
    expect(useStore.getState().daily[addDays(date, -2)]).toBeUndefined();

    useStore.setState({ daily: run(-8, -1, date) });
    for (let test = 0; test < 5; test++) useStore.getState().setDaily(date, test, 20, 1);
    const { daily } = useStore.getState();
    expect(Object.values(daily).some((rec) => rec.j)).toBe(false);
    expect(streakState(daily, date)).toMatchObject({ days: 9, jokers: 1 });
  });
});
