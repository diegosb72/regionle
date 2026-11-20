import { afterEach, describe, expect, it } from 'vitest';
import { NO_DAY, cleanDayDone, nextStep, planOf, stepConfig, withStep, type DayDone } from './dayPlan';
import type { Recent } from './recent';
import { REVIEW_MAX, dueGroups, missGroups, setReviewPrefs } from './review';
import { DEFAULT_OPTS, useStore, type Stat } from './store';
import { today } from './text';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 20, 12).getTime();
const TODAY = today(new Date(NOW));

/** Learnt ten days ago, and due again. */
const due = (): Stat => [3, 3, 2, NOW - 10 * DAY];
/** Missed three times of four, the last a minute ago: not due, and not known. */
const missed = (): Stat => [4, 1, 1, NOW - 60_000];
/** Where the pieces of Spain were learnt: on the map of its communities. */
const inSpain = (...ids: string[]): Record<string, string> => Object.fromEntries(ids.map((id) => [id, 'r|ES|g1']));
/** The lessons of a map, as the first page keeps them. */
const lessons = (patch: Partial<Recent> = {}): Recent => ({ t: NOW - DAY, section: 'regions', mode: 'learn', countries: ['ES'], levels: { ES: 'f' }, o: {}, ok: 10, total: 13, ...patch });

const STATS: Record<string, Stat> = { 'loc:ES-GA': due(), 'loc:ES-AS': due(), 'name:ES-CL': missed() };
const WHERE = inSpain('ES-GA', 'ES-AS', 'ES-CL');
const steps = (kept: DayDone = NO_DAY, recent: Recent[] = [lessons({ left: 37 })], stats = STATS, where = WHERE) => planOf(stats, where, recent, kept, TODAY, NOW);

afterEach(() => setReviewPrefs({ size: REVIEW_MAX }));

describe('the session of the day', () => {
  it('proposes what is due, then what is missed most, then a new lesson', () => {
    const plan = steps();
    expect(plan.map((s) => s.step)).toEqual(['review', 'hard', 'new']);
    expect(plan.every((s) => !s.done)).toBe(true);
    // Each step is the game of the map that has the most of it, and says how many answers it asks for.
    expect(plan[0].group).toEqual(dueGroups(STATS, WHERE, NOW)[0]);
    expect(plan[0].n).toBe(2);
    expect(plan[1].group).toEqual(missGroups(STATS, WHERE)[0]);
    expect(plan[1].n).toBe(1);
    // A lesson is as long as the player has set: it says no number.
    expect(plan[2].map).toEqual(lessons({ left: 37 }));
    expect(plan[2].n).toBe(0);
  });

  it('has no step for what there is nothing to do of', () => {
    expect(steps(NO_DAY, [])).toHaveLength(2);
    // With nothing due, it starts at what is missed most.
    expect(steps(NO_DAY, [lessons({ left: 5 })], { 'name:ES-CL': missed() }, inSpain('ES-CL')).map((s) => s.step)).toEqual(['hard', 'new']);
    expect(steps(NO_DAY, [], { 'loc:ES-GA': due() }, inSpain('ES-GA')).map((s) => s.step)).toEqual(['review']);
    expect(steps(NO_DAY, [], {}, {})).toEqual([]);
  });

  it('asks for no more answers than a review is set to', () => {
    const ids = ['AN', 'AR', 'AS', 'CB', 'CL', 'CM', 'CT', 'EX', 'GA', 'IB', 'RI', 'MD'].map((id) => `ES-${id}`);
    const stats = Object.fromEntries(ids.map((id) => [`loc:${id}`, due()]));
    expect(steps(NO_DAY, [], stats, inSpain(...ids))[0].n).toBe(12);
    setReviewPrefs({ size: 10 });
    expect(steps(NO_DAY, [], stats, inSpain(...ids))[0].n).toBe(10);
  });

  it('goes on with the lessons of the map played last that still has something to teach', () => {
    const france = lessons({ t: NOW, countries: ['FR'], levels: { FR: 'g1' }, left: 0 });
    const spain = lessons({ left: 37 });
    // France has nothing left: the lessons of Spain, though played before.
    expect(steps(NO_DAY, [france, spain]).at(-1)?.map).toEqual(spain);
    // Lessons kept before the game wrote down what was left are offered: there may be something.
    const old = lessons();
    expect(steps(NO_DAY, [old]).at(-1)?.map).toEqual(old);
    // Any other game on the map is not a lesson.
    expect(steps(NO_DAY, [lessons({ mode: 'pin' }), france]).map((s) => s.step)).toEqual(['review', 'hard']);
  });

  it('keeps a step done today in its place, ticked, and starts from none another day', () => {
    const kept: DayDone = { day: TODAY, done: ['review'] };
    const plan = steps(kept);
    expect(plan.map((s) => [s.step, s.done])).toEqual([['review', true], ['hard', false], ['new', false]]);
    expect(plan[0].group).toBeUndefined();
    // Done, it stays even when there would be nothing to do for it.
    expect(steps(kept, [], {}, {}).map((s) => [s.step, s.done])).toEqual([['review', true]]);
    // What was done yesterday is not done today.
    expect(steps({ day: today(new Date(NOW - DAY)), done: ['review', 'hard', 'new'] }).every((s) => !s.done)).toBe(true);
  });

  it('goes on at the first step that is not done', () => {
    expect(nextStep(steps())?.step).toBe('review');
    expect(nextStep(steps({ day: TODAY, done: ['review'] }))?.step).toBe('hard');
    // One done out of turn does not move the others.
    expect(nextStep(steps({ day: TODAY, done: ['hard'] }))?.step).toBe('review');
    expect(nextStep(steps({ day: TODAY, done: ['review', 'hard', 'new'] }))).toBeUndefined();
  });

  it('starts each step as its game, marked as a step of the session', () => {
    const [review, hard, fresh] = steps();
    expect(stepConfig(review, DEFAULT_OPTS)).toMatchObject({ section: 'regions', mode: 'pin', countries: ['ES'], levels: { ES: 'g1' }, review: true, step: 'review' });
    expect([...(stepConfig(review, DEFAULT_OPTS)?.only ?? [])].sort()).toEqual(['ES-AS', 'ES-GA']);
    expect(stepConfig(hard, DEFAULT_OPTS)).toMatchObject({ section: 'regions', mode: 'identify', only: ['ES-CL'], step: 'hard' });
    expect(stepConfig(fresh, DEFAULT_OPTS)).toMatchObject({ section: 'regions', mode: 'learn', countries: ['ES'], levels: { ES: 'f' }, step: 'new' });
    // The lessons are those of the whole map: not a review.
    expect(stepConfig(fresh, DEFAULT_OPTS)).not.toHaveProperty('only');
    // A step that is done is not a game to start.
    expect(stepConfig(steps({ day: TODAY, done: ['review'] })[0], DEFAULT_OPTS)).toBeNull();
  });

  it('writes down the steps in their order, and forgets those of another day', () => {
    const one = withStep(NO_DAY, TODAY, 'hard');
    expect(one).toEqual({ day: TODAY, done: ['hard'] });
    expect(withStep(one, TODAY, 'review')).toEqual({ day: TODAY, done: ['review', 'hard'] });
    // Done twice is done once, and nothing changes: the same thing, so that nothing is drawn again for it.
    expect(withStep(one, TODAY, 'hard')).toBe(one);
    expect(withStep(one, '2026-11-21', 'new')).toEqual({ day: '2026-11-21', done: ['new'] });
  });

  it('is kept by the game: a step done today, forgotten with the progress', () => {
    useStore.setState({ dayPlan: NO_DAY });
    useStore.getState().doStep('hard', NOW);
    useStore.getState().doStep('review', NOW);
    expect(useStore.getState().dayPlan).toEqual({ day: TODAY, done: ['review', 'hard'] });
    // Another day starts from none.
    useStore.getState().doStep('new', NOW + 2 * DAY);
    expect(useStore.getState().dayPlan).toEqual({ day: today(new Date(NOW + 2 * DAY)), done: ['new'] });
    useStore.getState().resetProgress();
    expect(useStore.getState().dayPlan).toBe(NO_DAY);
  });

  it('reads what was kept, and takes anything else for a day with nothing done', () => {
    expect(cleanDayDone({ day: '2026-11-20', done: ['new', 'review'] })).toEqual({ day: '2026-11-20', done: ['review', 'new'] });
    // A step there is no such thing as is dropped.
    expect(cleanDayDone({ day: '2026-11-20', done: ['review', 'nap', 3] })).toEqual({ day: '2026-11-20', done: ['review'] });
    for (const broken of [undefined, null, 'x', 7, [], {}, { day: 20261120, done: [] }, { day: 'hoy', done: [] }, { day: '2026-11-20' }, { day: '2026-11-20', done: 'review' }]) expect(cleanDayDone(broken)).toBe(NO_DAY);
  });
});
