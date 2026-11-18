import { beforeEach, describe, expect, it } from 'vitest';
import { DAILY_ANSWERS, DAYS_MAX, DAY_GOALS, DAY_GOAL_DEFAULT, cleanDays, dailyWork, daysFrom, goalsMet, isDayGoal, longestStreak, studyStreak, withDay, type Days } from './days';
import { calendarOf, dayLevel, learntOver, monthsOf, scaleFor, sumDays, weeksOf, yearsOf } from './dayview';
import { addDays } from './goals';
import { mergeSaved, useStore, type SessionRec } from './store';
import { today } from './text';

/** Noon of a day, in the time of whoever runs the test: a game played then belongs to that day wherever that is. */
const noon = (day: string): number => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
};

describe('what was done each day', () => {
  it('adds each game to the day it ended on', () => {
    let days: Days = {};
    days = withDay(days, noon('2026-11-18'), { total: 10, ok: 7, ms: 60_000 });
    expect(days).toEqual({ '2026-11-18': [1, 10, 7, 60_000, 0] });
    days = withDay(days, noon('2026-11-18'), { total: 5, ok: 5, ms: 20_000 });
    days = withDay(days, noon('2026-11-19'), { total: 3, ok: 0, ms: 1_000 });
    expect(days).toEqual({ '2026-11-18': [2, 15, 12, 80_000, 0], '2026-11-19': [1, 3, 0, 1_000, 0] });
    // The day is the one of the player's clock, not the one of Greenwich.
    expect(today(new Date(noon('2026-11-18')))).toBe('2026-11-18');
  });

  it('leaves the days it had as they were', () => {
    const before: Days = { '2026-11-18': [1, 10, 7, 60_000, 0] };
    const after = withDay(before, noon('2026-11-18'), { total: 1, ok: 1, ms: 1 });
    expect(before).toEqual({ '2026-11-18': [1, 10, 7, 60_000, 0] });
    expect(after).not.toBe(before);
  });

  it('marks the day once its answers reach the goal, and keeps it marked', () => {
    let days = withDay({}, noon('2026-11-18'), { total: 15, ok: 9, ms: 0 }, 20);
    expect(days['2026-11-18'][4]).toBe(0);
    days = withDay(days, noon('2026-11-18'), { total: 5, ok: 5, ms: 0 }, 20);
    expect(days['2026-11-18']).toEqual([2, 20, 14, 0, 1]);
    // A higher goal chosen later does not take the day back, and neither does having none.
    days = withDay(days, noon('2026-11-18'), { total: 1, ok: 1, ms: 0 }, 100);
    expect(days['2026-11-18'][4]).toBe(1);
    days = withDay(days, noon('2026-11-18'), { total: 1, ok: 1, ms: 0 }, 0);
    expect(days['2026-11-18'][4]).toBe(1);
    // Without a goal no day is ever met, however much is done.
    expect(withDay({}, noon('2026-11-20'), { total: 500, ok: 500, ms: 0 }, 0)['2026-11-20'][4]).toBe(0);
    expect(goalsMet(days)).toBe(1);
    expect(goalsMet({})).toBe(0);
  });

  it('writes down how much was learnt by the end of the day, where it is told', () => {
    let days = withDay({}, noon('2026-11-18'), { total: 10, ok: 7, ms: 1 }, 0, 40);
    expect(days['2026-11-18']).toEqual([1, 10, 7, 1, 0, 40]);
    // The latest figure of the day is the one kept; a game that says nothing leaves the one there was.
    days = withDay(days, noon('2026-11-18'), { total: 1, ok: 1, ms: 1 }, 0, 43);
    expect(days['2026-11-18'][5]).toBe(43);
    days = withDay(days, noon('2026-11-18'), { total: 1, ok: 0, ms: 1 });
    expect(days['2026-11-18']).toEqual([3, 12, 8, 3, 0, 43]);
    // Nothing learnt is a figure too, and is not the same as not knowing.
    expect(withDay({}, noon('2026-11-19'), { total: 1, ok: 0, ms: 1 }, 0, 0)['2026-11-19']).toEqual([1, 1, 0, 1, 0, 0]);
    expect(withDay({}, noon('2026-11-19'), { total: 1, ok: 0, ms: 1 })['2026-11-19']).toEqual([1, 1, 0, 1, 0]);
    expect(learntOver({ ...days, '2026-11-10': [1, 1, 1, 1, 0], '2026-11-12': [1, 1, 1, 1, 0, 0] })).toEqual([
      { day: '2026-11-12', learnt: 0 },
      { day: '2026-11-18', learnt: 43 },
    ]);
    expect(learntOver({})).toEqual([]);
    // Today is what is learnt at this moment, whatever the day wrote down, and there is always a today.
    const kept: Days = { '2026-11-10': [1, 1, 1, 1, 0], '2026-11-12': [1, 1, 1, 1, 0, 0], '2026-11-18': [1, 1, 1, 1, 0, 43], '2026-11-19': [1, 1, 1, 1, 0, 50] };
    expect(learntOver(kept, { day: '2026-11-18', learnt: 45 })).toEqual([
      { day: '2026-11-12', learnt: 0 },
      { day: '2026-11-18', learnt: 45 },
    ]);
    expect(learntOver(kept, { day: '2026-11-15', learnt: 7 })).toEqual([
      { day: '2026-11-12', learnt: 0 },
      { day: '2026-11-15', learnt: 7 },
    ]);
    expect(learntOver({ '2026-11-10': [1, 1, 1, 1, 0] }, { day: '2026-11-18', learnt: 12 })).toEqual([{ day: '2026-11-18', learnt: 12 }]);
    expect(learntOver({}, { day: '2026-11-18', learnt: 0 })).toEqual([{ day: '2026-11-18', learnt: 0 }]);
  });

  it('keeps so many days and lets the oldest go', () => {
    let days: Days = {};
    for (let i = 0; i < DAYS_MAX + 5; i++) days = withDay(days, noon(addDays('2024-01-01', i)), { total: 1, ok: 1, ms: 1 });
    const keys = Object.keys(days).sort();
    expect(keys).toHaveLength(DAYS_MAX);
    expect(keys[0]).toBe(addDays('2024-01-01', 5));
    expect(keys[keys.length - 1]).toBe(addDays('2024-01-01', DAYS_MAX + 4));
  });

  it('offers a few goals to choose from, one of them none', () => {
    expect(DAY_GOALS[0]).toBe(0);
    expect(DAY_GOALS).toContain(DAY_GOAL_DEFAULT);
    expect([...DAY_GOALS].sort((a, b) => a - b)).toEqual([...DAY_GOALS]);
    for (const n of DAY_GOALS) expect(isDayGoal(n)).toBe(true);
    for (const x of [15, -1, '20', null, undefined, NaN]) expect(isDayGoal(x), String(x)).toBe(false);
  });
});

describe('a player from before the calendar', () => {
  it('starts with what the sessions kept and the daily challenges completed add up to', () => {
    const days = daysFrom(
      [
        { t: noon('2026-11-10'), total: 10, ok: 8, ms: 30_000 },
        { t: noon('2026-11-10'), total: 20, ok: 20, ms: 50_000 },
        { t: noon('2026-11-12'), total: 5, ok: 1, ms: 9_000 },
      ],
      {
        // Completed on the 12th, with 61 points of 100: eight of its thirteen questions.
        '2026-11-12': { p: [20, 16, 13, 8, 4], t: noon('2026-11-12') },
        // A day of the calendar played later counts on the day it was played.
        '2026-11-01': { p: [20, 20, 20, 20, 20], t: noon('2026-11-13') },
        // One left half way is no day's work yet.
        '2026-11-14': { p: [20, null, null, null, null] },
      },
    );
    expect(days).toEqual({
      '2026-11-10': [2, 30, 28, 80_000, 0],
      '2026-11-12': [2, 5 + DAILY_ANSWERS, 1 + 8, 9_000, 0],
      '2026-11-13': [1, DAILY_ANSWERS, DAILY_ANSWERS, 0, 0],
    });
    expect(daysFrom([])).toEqual({});
  });

  it('counts a daily challenge as its thirteen questions, right in proportion to its points', () => {
    expect(dailyWork([20, 20, 20, 20, 20])).toEqual({ total: 13, ok: 13, ms: 0 });
    expect(dailyWork([0, 0, 0, 0, 0])).toEqual({ total: 13, ok: 0, ms: 0 });
    expect(dailyWork([10, 10, 10, 10, 10])).toEqual({ total: 13, ok: 7, ms: 0 });
    expect(dailyWork([20, null, undefined])).toEqual({ total: 13, ok: 3, ms: 0 });
    expect(dailyWork([])).toEqual({ total: 13, ok: 0, ms: 0 });
  });
});

describe('what is read from storage', () => {
  it('keeps the days that are days, with whole tallies', () => {
    expect(
      cleanDays({
        '2026-11-18': [2, 15, 12, 80_000, 1],
        // What was learnt by then stays where it was written down, a nought included.
        '2026-11-10': [1, 4, 4, 100, 0, 37.9],
        '2026-11-09': [1, 4, 4, 100, 0, 0],
        '2026-11-08': [1, 4, 4, 100, 0, 'x'],
        // From a copy without the goal: not met.
        '2026-11-17': [1, 4, 4, 100],
        // More right than asked cannot be.
        '2026-11-16': [1, 4, 9, 100, 0],
        '2026-11-15': [1.9, 4.2, 1, 100, 7],
        // Not days, or days with nothing done.
        '2026-13-40': [1, 1, 1, 1, 0],
        hoy: [1, 1, 1, 1, 0],
        '2026-11-14': [0, 0, 0, 0, 0],
        '2026-11-13': 'x',
        '2026-11-12': [1, 2],
        '2026-11-11': [1, -5, 'a', null, 0],
      }),
    ).toEqual({
      '2026-11-18': [2, 15, 12, 80_000, 1],
      '2026-11-10': [1, 4, 4, 100, 0, 37],
      '2026-11-09': [1, 4, 4, 100, 0, 0],
      '2026-11-08': [1, 4, 4, 100, 0],
      '2026-11-17': [1, 4, 4, 100, 0],
      '2026-11-16': [1, 4, 4, 100, 0],
      '2026-11-15': [1, 4, 1, 100, 1],
      '2026-11-11': [1, 0, 0, 0, 0],
    });
    for (const junk of [null, undefined, 3, 'x', []]) expect(cleanDays(junk)).toEqual({});
  });

  it('keeps no more days than the game does', () => {
    const many: Record<string, number[]> = {};
    for (let i = 0; i < DAYS_MAX + 3; i++) many[addDays('2024-01-01', i)] = [1, 1, 1, 1, 0];
    const kept = Object.keys(cleanDays(many)).sort();
    expect(kept).toHaveLength(DAYS_MAX);
    expect(kept[0]).toBe(addDays('2024-01-01', 3));
  });
});

describe('days in a row', () => {
  const on = (...list: string[]): Days => Object.fromEntries(list.map((d) => [d, [1, 1, 1, 1, 0]]));

  it('are counted back from today', () => {
    const days = on('2026-11-14', '2026-11-16', '2026-11-17', '2026-11-18');
    expect(studyStreak(days, '2026-11-18')).toBe(3);
    expect(studyStreak(on('2026-11-18'), '2026-11-18')).toBe(1);
    expect(studyStreak({}, '2026-11-18')).toBe(0);
  });

  it('are not lost by a day that has only begun', () => {
    const days = on('2026-11-16', '2026-11-17');
    // Nothing done yet on the 18th: the two days are still there to be kept.
    expect(studyStreak(days, '2026-11-18')).toBe(2);
    // A whole day missed, and they are gone.
    expect(studyStreak(days, '2026-11-19')).toBe(0);
  });

  it('go across months and years', () => {
    expect(studyStreak(on('2026-12-30', '2026-12-31', '2027-01-01'), '2027-01-01')).toBe(3);
    expect(studyStreak(on('2024-02-28', '2024-02-29', '2024-03-01'), '2024-03-01')).toBe(3);
  });

  it('have a longest run among the days kept', () => {
    expect(longestStreak({})).toBe(0);
    expect(longestStreak(on('2026-11-18'))).toBe(1);
    expect(longestStreak(on('2026-11-01', '2026-11-02', '2026-11-03', '2026-11-10', '2026-11-11'))).toBe(3);
    expect(longestStreak(on('2026-11-01', '2026-11-03', '2026-11-05'))).toBe(1);
    expect(longestStreak(on('2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'))).toBe(4);
  });
});

describe('the calendar of activity', () => {
  it('shades a day by how much was answered', () => {
    expect(dayLevel(undefined)).toBe(0);
    expect(dayLevel([1, 0, 0, 0, 0])).toBe(1);
    expect(dayLevel([1, 9, 0, 0, 0])).toBe(1);
    expect(dayLevel([1, 10, 0, 0, 0])).toBe(2);
    expect(dayLevel([1, 29, 0, 0, 0])).toBe(2);
    expect(dayLevel([1, 30, 0, 0, 0])).toBe(3);
    expect(dayLevel([1, 59, 0, 0, 0])).toBe(3);
    expect(dayLevel([1, 60, 0, 0, 0])).toBe(4);
    expect(dayLevel([9, 4000, 0, 0, 1])).toBe(4);
  });

  it('is whole weeks from Monday to Sunday, the last one that of today', () => {
    // The 18th of November of 2026 is a Wednesday.
    const days: Days = { '2026-11-18': [1, 12, 9, 1000, 0], '2026-11-09': [3, 70, 60, 9000, 1] };
    const cal = calendarOf(days, '2026-11-18', 3);
    expect(cal).toHaveLength(3);
    for (const week of cal) expect(week).toHaveLength(7);
    expect(cal[0][0].day).toBe('2026-11-02');
    expect(cal[2].map((d) => d.day)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
    // Every column starts on a Monday.
    for (const week of cal) expect(new Date(`${week[0].day}T00:00:00Z`).getUTCDay()).toBe(1);
    // What was done is on its day, and nowhere else.
    expect(cal[2][2]).toEqual({ day: '2026-11-18', rec: [1, 12, 9, 1000, 0], level: 2, future: false });
    expect(cal[1][0]).toEqual({ day: '2026-11-09', rec: [3, 70, 60, 9000, 1], level: 4, future: false });
    expect(cal.flat().filter((d) => d.level > 0)).toHaveLength(2);
    // The days of this week that have not come are told apart.
    expect(cal[2].map((d) => d.future)).toEqual([false, false, false, true, true, true, true]);
    expect(cal[0].some((d) => d.future)).toBe(false);
  });

  it('ends on a whole week when today is a Sunday, and starts one when it is a Monday', () => {
    const sunday = calendarOf({}, '2026-11-22', 2);
    expect(sunday[1][6]).toMatchObject({ day: '2026-11-22', future: false });
    expect(sunday.flat().some((d) => d.future)).toBe(false);
    const monday = calendarOf({}, '2026-11-23', 2);
    expect(monday[1][0]).toMatchObject({ day: '2026-11-23', future: false });
    expect(monday[1].filter((d) => d.future)).toHaveLength(6);
    expect(monday[0][0].day).toBe('2026-11-16');
  });
});

describe('the days the game keeps', () => {
  const session = (patch: Partial<SessionRec> = {}): SessionRec => ({ t: noon('2026-11-18'), section: 'regions', mode: 'pin', label: 'España', total: 10, ok: 7, warn: 1, bad: 2, ms: 30_000, ...patch });

  beforeEach(() => {
    useStore.setState({ game: null, sessions: [], recent: [], tot: {}, best: {}, daily: {}, days: {}, dayGoal: 20, stats: {} });
  });

  it('gain every game that ends, on its day, and the goal of that day once it is reached', () => {
    const st = useStore.getState();
    st.addSession(session());
    expect(useStore.getState().days).toEqual({ '2026-11-18': [1, 10, 7, 30_000, 0, 0] });
    // Two answers learnt by the end of the next game (right first time twice running), and one that is not yet.
    useStore.setState({ stats: { 'loc:ES-M': [2, 2, 2, 1], 'cap:FR': [5, 3, 2, 1], 'loc:ES-B': [3, 1, 1, 1] } });
    st.addSession(session({ total: 12, ok: 12, ms: 5_000 }));
    expect(useStore.getState().days).toEqual({ '2026-11-18': [2, 22, 19, 35_000, 1, 2] });
    // The tallies of a lifetime and the list of sessions go on as before.
    expect(useStore.getState().tot).toMatchObject({ g: 2, q: 22, ok: 19 });
    expect(useStore.getState().sessions).toHaveLength(2);
  });

  it('remember the longest run of days apart, for when the days themselves are gone', () => {
    const st = useStore.getState();
    for (const day of ['2026-11-16', '2026-11-17', '2026-11-18']) st.addSession(session({ t: noon(day) }));
    expect(useStore.getState().best['study:streak']).toBe(3);
    // A gap starts another run, and the longest stays.
    st.addSession(session({ t: noon('2026-11-21') }));
    expect(useStore.getState().best['study:streak']).toBe(3);
    expect(studyStreak(useStore.getState().days, '2026-11-21')).toBe(1);
  });

  it('count the daily challenge on the day it is finished, and not before it is', () => {
    const st = useStore.getState();
    const date = today();
    for (let test = 0; test < 4; test++) st.setDaily(date, test, 20, 1);
    expect(useStore.getState().days).toEqual({});
    st.setDaily(date, 4, 20, 1);
    expect(useStore.getState().days).toEqual({ [date]: [1, DAILY_ANSWERS, DAILY_ANSWERS, 0, 0, 0] });
    expect(useStore.getState().best['study:streak']).toBe(1);
    expect(useStore.getState().best['daily:streak']).toBe(1);
    // A test answered twice is not counted twice.
    st.setDaily(date, 4, 20, 1);
    expect(useStore.getState().days[date][0]).toBe(1);
    // The challenge alone can meet a small goal.
    useStore.setState({ days: {}, daily: {}, dayGoal: 10 });
    for (let test = 0; test < 5; test++) useStore.getState().setDaily(date, test, 10, 1);
    expect(useStore.getState().days[date]).toEqual([1, DAILY_ANSWERS, 7, 0, 1, 0]);
  });

  it('take only the goals that are offered', () => {
    const st = useStore.getState();
    st.setDayGoal(50);
    expect(useStore.getState().dayGoal).toBe(50);
    st.setDayGoal(0);
    expect(useStore.getState().dayGoal).toBe(0);
    st.setDayGoal(37);
    expect(useStore.getState().dayGoal).toBe(DAY_GOAL_DEFAULT);
  });

  it('go with the rest when the progress is cleared, and the goal stays as chosen', () => {
    useStore.setState({ dayGoal: 50 });
    useStore.getState().addSession(session());
    useStore.getState().resetProgress();
    expect(useStore.getState().days).toEqual({});
    expect(useStore.getState().best).toEqual({});
    expect(useStore.getState().dayGoal).toBe(50);
  });

  it('come with a backup, or are made from its sessions when it is from before the calendar', () => {
    const st = useStore.getState();
    expect(st.importData({ stats: {}, sessions: [], days: { '2026-11-10': [2, 30, 28, 80_000, 1], junk: [1, 1, 1, 1, 1] } })).toBe(true);
    expect(useStore.getState().days).toEqual({ '2026-11-10': [2, 30, 28, 80_000, 1] });
    expect(st.importData({ stats: {}, sessions: [session({ t: noon('2026-11-11') }), session({ t: noon('2026-11-11') })], daily: { '2026-11-12': { p: [20, 20, 20, 20, 20], k: [1, 1, 1, 1, 1], t: noon('2026-11-12') } } })).toBe(true);
    expect(useStore.getState().days).toEqual({ '2026-11-11': [2, 20, 14, 60_000, 0], '2026-11-12': [1, DAILY_ANSWERS, DAILY_ANSWERS, 0, 0] });
  });

  it('are made once from what a player from before had, and read as they are from then on', () => {
    const merge = mergeSaved;
    const current = useStore.getState();
    // Saved by a version without the calendar: no days, no goal.
    const old = merge({ sessions: [session({ t: noon('2026-11-11') })], daily: {} }, current);
    expect(old.days).toEqual({ '2026-11-11': [1, 10, 7, 30_000, 0] });
    expect(old.dayGoal).toBe(DAY_GOAL_DEFAULT);
    // Saved by this one: the days are the ones saved, though the sessions say more, and the goal is the one chosen.
    const now = merge({ sessions: [session({ t: noon('2026-11-11') })], days: { '2026-11-01': [1, 5, 5, 100, 0] }, dayGoal: 0 }, current);
    expect(now.days).toEqual({ '2026-11-01': [1, 5, 5, 100, 0] });
    expect(now.dayGoal).toBe(0);
    // Nothing done yet and saved so: it stays empty.
    expect(merge({ sessions: [session()], days: {} }, current).days).toEqual({});
    // A goal that is not offered falls back to the usual one.
    expect(merge({ dayGoal: 33 }, current).dayGoal).toBe(DAY_GOAL_DEFAULT);
  });
});

describe('what some days add up to', () => {
  const days: Days = {
    '2025-12-31': [1, 8, 8, 1_000, 0],
    '2026-10-30': [1, 10, 5, 2_000, 1],
    '2026-11-02': [2, 40, 30, 3_000, 1],
    '2026-11-09': [1, 40, 10, 4_000, 0],
    '2026-11-18': [3, 12, 12, 5_000, 0],
  };

  it('counts between two days, both included, and says which was the fullest', () => {
    expect(sumDays(days, '2026-11-02', '2026-11-18')).toEqual({ days: 3, games: 6, answers: 92, ok: 52, ms: 12_000, met: 1, top: { day: '2026-11-02', answers: 40 } });
    expect(sumDays(days, '2026-11-03', '2026-11-17')).toEqual({ days: 1, games: 1, answers: 40, ok: 10, ms: 4_000, met: 0, top: { day: '2026-11-09', answers: 40 } });
    // Nothing in between: all noughts and no fullest day.
    expect(sumDays(days, '2026-11-10', '2026-11-17')).toEqual({ days: 0, games: 0, answers: 0, ok: 0, ms: 0, met: 0 });
    // A day with a game and no answers is a day played, and never the fullest.
    expect(sumDays({ '2026-11-01': [1, 0, 0, 9, 0] }, '2026-11-01', '2026-11-01')).toEqual({ days: 1, games: 1, answers: 0, ok: 0, ms: 9, met: 0 });
  });

  it('goes week by week, from Monday to Sunday, up to the week of today', () => {
    const weeks = weeksOf(days, '2026-11-18', 4);
    expect(weeks.map((w) => w.from)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16']);
    expect(weeks.map((w) => w.answers)).toEqual([10, 40, 40, 12]);
    expect(weeks.map((w) => w.ok)).toEqual([5, 30, 10, 12]);
    expect(weeks.map((w) => w.days)).toEqual([1, 1, 1, 1]);
    // A week with nothing is there all the same.
    expect(weeksOf({}, '2026-11-18', 2)).toMatchObject([
      { from: '2026-11-09', answers: 0, days: 0 },
      { from: '2026-11-16', answers: 0, days: 0 },
    ]);
  });

  it('goes month by month from this one back to the oldest kept, the empty ones included', () => {
    const months = monthsOf(days, '2026-11-18');
    expect(months.map((m) => m.month)).toEqual(['2026-11', '2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01', '2025-12']);
    expect(months[0]).toMatchObject({ days: 3, games: 6, answers: 92, ok: 52, met: 1, top: { day: '2026-11-02', answers: 40 } });
    expect(months[1]).toMatchObject({ days: 1, answers: 10, met: 1 });
    expect(months[2]).toMatchObject({ days: 0, answers: 0 });
    expect(months[11]).toMatchObject({ days: 1, answers: 8 });
    // Nothing kept: this month alone, empty.
    expect(monthsOf({}, '2026-11-18')).toEqual([{ month: '2026-11', days: 0, games: 0, answers: 0, ok: 0, ms: 0, met: 0 }]);
    // A day kept from a month that has not come (a clock put back) adds no month.
    expect(monthsOf({ '2027-01-05': [1, 1, 1, 1, 0] }, '2026-11-18').map((m) => m.month)).toEqual(['2026-11']);
    // February is counted whole, the 29th included.
    expect(monthsOf({ '2024-02-29': [1, 3, 3, 1, 0], '2024-03-01': [1, 5, 5, 1, 0] }, '2024-03-10').map((m) => [m.month, m.answers])).toEqual([
      ['2024-03', 5],
      ['2024-02', 3],
    ]);
  });

  it('adds up each year with something in it, and this one', () => {
    expect(yearsOf(days, '2026-11-18').map((y) => [y.year, y.days, y.answers])).toEqual([
      ['2026', 4, 102],
      ['2025', 1, 8],
    ]);
    expect(yearsOf({}, '2026-11-18')).toEqual([{ year: '2026', days: 0, games: 0, answers: 0, ok: 0, ms: 0, met: 0 }]);
  });

  it('finds a round scale for a chart', () => {
    expect(scaleFor(163)).toEqual({ top: 200, step: 50 });
    expect(scaleFor(200)).toEqual({ top: 200, step: 50 });
    expect(scaleFor(201)).toEqual({ top: 300, step: 100 });
    expect(scaleFor(90)).toEqual({ top: 100, step: 25 });
    expect(scaleFor(12)).toEqual({ top: 15, step: 5 });
    expect(scaleFor(7)).toEqual({ top: 8, step: 2 });
    expect(scaleFor(3)).toEqual({ top: 3, step: 1 });
    expect(scaleFor(1)).toEqual({ top: 1, step: 1 });
    expect(scaleFor(0)).toEqual({ top: 4, step: 1 });
    expect(scaleFor(4321)).toEqual({ top: 6000, step: 2000 });
    // The top is always at or above what has to fit, and a whole number of steps.
    for (const max of [1, 2, 5, 9, 10, 11, 37, 99, 100, 101, 640, 999, 12_345]) {
      const { top, step } = scaleFor(max);
      expect(top, String(max)).toBeGreaterThanOrEqual(max);
      expect(top % step, String(max)).toBe(0);
      expect(Number.isInteger(step), String(max)).toBe(true);
      expect(top / step, String(max)).toBeLessThanOrEqual(5);
    }
  });
});
