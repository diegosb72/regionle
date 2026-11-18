import { describe, expect, it } from 'vitest';
import { GOALS_MAX, addDays, cleanGoals, daysBetween, goalGame, goalSkills, goalState, goalWithout, isDay, isGoal, nextStep, sameGoal, withMark, type Goal } from './goals';
import { DEFAULT_OPTS, type Stat } from './store';

/** Midday of Wednesday 18 November 2026, wherever the tests run. */
const NOW = new Date(2026, 10, 18, 12, 0, 0).getTime();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const IDS = Array.from({ length: 20 }, (_, i) => `ES-${String(i).padStart(2, '0')}`);

const goal = (patch: Partial<Goal> = {}): Goal => ({ id: 'g1', name: 'España · provincias', section: 'regions', countries: ['ES'], levels: { ES: 'f' }, ids: IDS, skill: 'loc', date: '2026-11-26', made: NOW - DAY, ...patch });
/** Seen `seen` times, right `run` times in a row, the last time `ago` milliseconds ago. */
const stat = (run: number, ago: number, seen = Math.max(1, run)): Stat => [seen, run, run, NOW - ago];
/** The first `n` pieces with the same tally, for one skill. */
const some = (n: number, st: Stat, skill = 'loc', from = 0): Record<string, Stat> => Object.fromEntries(IDS.slice(from, from + n).map((id) => [`${skill}:${id}`, st]));

describe('days of the calendar', () => {
  it('are told from what is not one', () => {
    expect(isDay('2026-11-26')).toBe(true);
    expect(isDay('2028-02-29')).toBe(true);
    for (const bad of ['2026-02-30', '2026-13-01', '26-11-2026', '2026-1-1', '', null, 20261126]) expect(isDay(bad), String(bad)).toBe(false);
  });

  it('are counted whatever the month, the year or the change of hour in between', () => {
    expect(daysBetween('2026-11-18', '2026-11-26')).toBe(8);
    expect(daysBetween('2026-11-18', '2026-11-18')).toBe(0);
    expect(daysBetween('2026-11-18', '2026-11-17')).toBe(-1);
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
    // The clocks go forward on 28 March 2027: a day of 23 hours is still a day.
    expect(daysBetween('2027-03-27', '2027-03-29')).toBe(2);
    expect(addDays('2026-11-18', 14)).toBe('2026-12-02');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });
});

describe('what a goal can be about', () => {
  it('depends on the section', () => {
    expect(goalSkills('countries')).toEqual(['loc', 'name', 'cap', 'flag']);
    expect(goalSkills('regions')).toEqual(['loc', 'name', 'cap']);
    expect(goalSkills('cities')).toEqual(['loc', 'name']);
    expect(goalSkills('physical')).toEqual(['loc', 'name']);
    expect(goalSkills('pops')).toEqual([]);
  });

  it('is the same goal when the pieces and the skill are the same', () => {
    expect(sameGoal(goal(), goal({ id: 'g2', date: '2026-12-01', name: 'Otro' }))).toBe(true);
    expect(sameGoal(goal(), goal({ skill: 'name' }))).toBe(false);
    expect(sameGoal(goal(), goal({ ids: IDS.slice(1) }))).toBe(false);
  });
});

describe('how a goal stands', () => {
  it('starts with everything to be seen, shared out among the days, with the eve kept for going over', () => {
    const s = goalState(goal(), {}, NOW);
    expect(s).toMatchObject({ total: 20, seen: 0, known: 0, daysLeft: 8, phase: 'ahead', done: false, shareDone: 0 });
    // Eight days ahead, seven to see new pieces in: three a day.
    expect(s.share).toBe(3);
    expect(s.newLeft).toBe(3);
    expect(s.perDay).toBe(3);
    expect(s.fresh).toEqual(IDS);
    expect(s.pending).toEqual([]);
  });

  it('counts what is seen and what is known for the skill of the goal, and no other', () => {
    const stats = { ...some(6, stat(2, HOUR)), ...some(4, stat(1, HOUR), 'loc', 6), ...some(20, stat(3, HOUR), 'name') };
    const s = goalState(goal(), stats, NOW);
    expect(s.seen).toBe(10);
    expect(s.known).toBe(6);
    expect(s.fresh).toEqual(IDS.slice(10));
    expect(goalState(goal({ skill: 'name' }), stats, NOW)).toMatchObject({ seen: 20, known: 20, done: true });
  });

  it('takes from the share of today what has been seen today', () => {
    const marked = goal({ mark: { day: '2026-11-18', seen: 4 } });
    // Four were seen before today; two more since this morning.
    const s = goalState(marked, some(6, stat(1, 5 * MIN)), NOW);
    // Sixteen were left this morning for seven days: three today, of which two are done.
    expect(s).toMatchObject({ share: 3, shareDone: 2, newLeft: 1 });
    expect(goalState(marked, some(7, stat(1, 5 * MIN)), NOW)).toMatchObject({ share: 3, shareDone: 3, newLeft: 0, perDay: 3 });
    // Going on past the share is allowed, and leaves less for the days to come.
    expect(goalState(marked, some(12, stat(1, 5 * MIN)), NOW)).toMatchObject({ shareDone: 8, newLeft: 0, perDay: 2 });
  });

  it('ignores a mark of another day, or one that says more than there is', () => {
    const stats = some(6, stat(1, 5 * MIN));
    expect(goalState(goal({ mark: { day: '2026-11-17', seen: 2 } }), stats, NOW)).toMatchObject({ shareDone: 0, share: 2 });
    expect(goalState(goal({ mark: { day: '2026-11-18', seen: 15 } }), stats, NOW)).toMatchObject({ shareDone: 0, share: 2 });
  });

  it('brings back what is due, the longest overdue first', () => {
    const stats = { 'loc:ES-00': stat(0, 30 * MIN), 'loc:ES-01': stat(1, 2 * DAY), 'loc:ES-02': stat(2, HOUR), 'loc:ES-03': stat(0, 2 * MIN) };
    const s = goalState(goal(), stats, NOW);
    // A miss of two minutes ago is not asked yet; one known an hour ago is not due.
    expect(s.pending).toEqual(['ES-01', 'ES-00']);
  });

  it('uses every day for new pieces when there are only one or two', () => {
    expect(goalState(goal({ date: '2026-11-20' }), {}, NOW)).toMatchObject({ daysLeft: 2, share: 10, perDay: 10 });
    expect(goalState(goal({ date: '2026-11-19' }), {}, NOW)).toMatchObject({ daysLeft: 1, share: 20, perDay: 0 });
    expect(goalState(goal({ date: '2026-11-21' }), {}, NOW)).toMatchObject({ daysLeft: 3, share: 10 });
  });

  it('goes over whatever is not known on the eve and on the day, due or not', () => {
    const stats = { ...some(5, stat(1, HOUR)), ...some(5, stat(2, HOUR), 'loc', 5) };
    expect(goalState(goal(), stats, NOW).pending).toEqual([]);
    expect(goalState(goal({ date: '2026-11-19' }), stats, NOW).pending).toEqual(IDS.slice(0, 5));
    const day = goalState(goal({ date: '2026-11-18' }), stats, NOW);
    expect(day).toMatchObject({ phase: 'today', daysLeft: 0, newLeft: 10 });
    expect(day.pending).toEqual(IDS.slice(0, 5));
  });

  it('is over after its day, with nothing more to do', () => {
    const s = goalState(goal({ date: '2026-11-17' }), some(8, stat(2, DAY)), NOW);
    expect(s).toMatchObject({ phase: 'over', daysLeft: -1, known: 8, share: 0, newLeft: 0, perDay: 0 });
    expect(nextStep(s)).toBeNull();
  });

  it('is done when every piece is known', () => {
    const s = goalState(goal(), some(20, stat(2, HOUR)), NOW);
    expect(s).toMatchObject({ done: true, known: 20, newLeft: 0, share: 0 });
    expect(nextStep(s)).toBeNull();
  });
});

describe('the mark of the day', () => {
  it('is put once a day, with what had been seen by then', () => {
    const stats = some(4, stat(1, DAY));
    const marked = withMark(goal(), stats, NOW);
    expect(marked.mark).toEqual({ day: '2026-11-18', seen: 4 });
    expect(withMark(marked, some(9, stat(1, MIN)), NOW)).toBe(marked);
    expect(withMark(marked, stats, NOW + DAY).mark).toEqual({ day: '2026-11-19', seen: 4 });
  });
});

describe('what comes next', () => {
  it('is what is due, then the new pieces, then nothing', () => {
    expect(nextStep(goalState(goal(), { 'loc:ES-00': stat(0, HOUR) }, NOW))).toBe('review');
    expect(nextStep(goalState(goal(), {}, NOW))).toBe('learn');
    const marked = goal({ mark: { day: '2026-11-18', seen: 0 } });
    expect(nextStep(goalState(marked, some(3, stat(1, MIN)), NOW))).toBeNull();
  });

  it('teaches places and names in lessons on the map of the goal', () => {
    const g = goal({ cityPick: 'top', cityCount: 40 });
    const cfg = goalGame(g, goalState(g, {}, NOW), { ...DEFAULT_OPTS, format: 'lives', length: 10 }, 'learn');
    expect(cfg).toMatchObject({ section: 'regions', mode: 'learn', countries: ['ES'], levels: { ES: 'f' }, only: IDS, list: 'España · provincias' });
    expect(cfg.opts).toMatchObject({ format: 'normal', length: 'all', cityPick: 'top', cityCount: 40 });
    expect(goalGame(goal({ skill: 'name' }), goalState(g, {}, NOW), DEFAULT_OPTS, 'learn').mode).toBe('learn');
  });

  it('asks capitals and flags a share at a time', () => {
    const g = goal({ section: 'countries', skill: 'flag', levels: {} });
    const cfg = goalGame(g, goalState(g, {}, NOW), DEFAULT_OPTS, 'learn');
    expect(cfg).toMatchObject({ mode: 'flag', only: IDS.slice(0, 3) });
    expect(cfg.list).toBeUndefined();
    expect(goalGame(goal({ skill: 'cap' }), goalState(goal({ skill: 'cap' }), {}, NOW), DEFAULT_OPTS, 'learn').mode).toBe('capital');
  });

  it('goes over what is due in the game of the skill, as a plain set of questions', () => {
    const stats = some(4, stat(0, HOUR));
    const cfg = goalGame(goal(), goalState(goal(), stats, NOW), { ...DEFAULT_OPTS, format: 'timed' }, 'review');
    expect(cfg).toMatchObject({ mode: 'pin', only: IDS.slice(0, 4) });
    expect(cfg.opts.format).toBe('normal');
    expect(cfg.list).toBeUndefined();
    expect(goalGame(goal({ skill: 'name' }), goalState(goal({ skill: 'name' }), some(2, stat(0, HOUR), 'name'), NOW), DEFAULT_OPTS, 'review')).toMatchObject({ mode: 'identify', only: IDS.slice(0, 2) });
  });

  it('makes the mock exam with every piece, as an exam', () => {
    const cfg = goalGame(goal(), goalState(goal(), {}, NOW), DEFAULT_OPTS, 'exam');
    expect(cfg).toMatchObject({ mode: 'pin', only: IDS, list: 'España · provincias' });
    expect(cfg.opts.format).toBe('exam');
  });
});

describe('what is kept of a goal', () => {
  it('loses the pieces that are no longer in the data, and goes when none is left', () => {
    const g = goal({ mark: { day: '2026-11-18', seen: 3 } });
    expect(goalWithout(g, new Set(['zz']))).toBe(g);
    const less = goalWithout(g, new Set(['ES-00', 'ES-01']))!;
    expect(less.ids).toEqual(IDS.slice(2));
    expect(less.mark).toBeUndefined();
    expect(goalWithout(g, new Set(IDS))).toBeNull();
  });

  it('is read back only when it is well formed', () => {
    expect(isGoal(goal())).toBe(true);
    expect(isGoal(goal({ mark: { day: '2026-11-18', seen: 2 } }))).toBe(true);
    for (const bad of [null, 'x', {}, goal({ date: 'mañana' }), goal({ ids: [] }), goal({ skill: 'nb' as never }), goal({ section: 'pops' }), goal({ mark: { day: 'x', seen: 1 } }), { ...goal(), levels: null }, { ...goal(), ids: [1, 2] }]) {
      expect(isGoal(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it('keeps the newest ones when there are too many', () => {
    const many = Array.from({ length: GOALS_MAX + 2 }, (_, i) => goal({ id: `g${i}` }));
    expect(cleanGoals([...many, 'x', null]).map((g) => g.id)).toEqual(many.slice(-GOALS_MAX).map((g) => g.id));
    expect(cleanGoals(undefined)).toEqual([]);
  });
});
