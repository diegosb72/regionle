import { describe, expect, it } from 'vitest';
import { TRUE_FALSE_ROUND, TYPICAL_S, estimateOf, minutesOf, paceOf, percentOf, questionsOf, type GameSize } from './pace';
import { LENGTH_MODES } from './rules';
import type { SessionRec } from './store';

const played = (patch: Partial<SessionRec> = {}): SessionRec => ({ t: 1, section: 'regions', mode: 'pin', label: 'España', total: 20, ok: 15, warn: 2, bad: 3, ms: 100_000, ...patch });
const size = (patch: Partial<GameSize> = {}): GameSize => ({ mode: 'pin', units: 52, length: 'all', format: 'normal', ...patch });

describe('what the games played say about a mode', () => {
  it('is nothing before the first game', () => {
    expect(paceOf([], 'regions', 'pin')).toEqual({ games: 0, perQuestion: null, perGame: null, first: null });
  });

  it('adds up the games of that mode in that section, and no others', () => {
    const list = [played(), played({ total: 10, ok: 5, ms: 80_000 }), played({ mode: 'identify' }), played({ section: 'countries' })];
    const pace = paceOf(list, 'regions', 'pin');
    expect(pace.games).toBe(2);
    expect(pace.perQuestion).toBe(6000);
    expect(pace.perGame).toBe(90_000);
    expect(pace.first).toBeCloseTo(20 / 30);
  });

  it('leaves out games that asked nothing, and has no pace without a clock', () => {
    expect(paceOf([played({ total: 0, ok: 0, ms: 5000 })], 'regions', 'pin').games).toBe(0);
    const pace = paceOf([played({ ms: 0 })], 'regions', 'pin');
    expect(pace).toMatchObject({ games: 1, perQuestion: null, perGame: null });
    expect(pace.first).toBe(0.75);
  });
});

describe('how many questions an exam has', () => {
  it('is counted like a game at ease, unlike the clock and the lives', () => {
    expect(questionsOf(size({ mode: 'pin', units: 52, length: 'all', format: 'exam' }))).toBe(52);
    expect(questionsOf(size({ mode: 'capital', units: 52, length: 20, format: 'exam' }))).toBe(20);
    expect(questionsOf(size({ mode: 'pin', units: 52, length: 'all', format: 'timed' }))).toBeNull();
    expect(questionsOf(size({ mode: 'pin', units: 52, length: 'all', format: 'lives' }))).toBeNull();
  });

  it('has an end where no end was chosen for the other games', () => {
    expect(questionsOf(size({ mode: 'identify', units: 19, length: 'endless', format: 'exam' }))).toBe(19);
    expect(questionsOf(size({ mode: 'identify', units: 19, length: 'endless', format: 'normal' }))).toBeNull();
    // A format means nothing to a game that has none.
    expect(questionsOf(size({ mode: 'regionle', units: 19, length: 'endless', format: 'exam' }))).toBeNull();
  });
});

describe('how many statements true or false makes', () => {
  it('is the number chosen whatever the countries, and twenty when none is', () => {
    expect(questionsOf(size({ mode: 'truefalse', units: 5, length: 50 }))).toBe(50);
    expect(questionsOf(size({ mode: 'truefalse', units: 193, length: 10 }))).toBe(10);
    expect(questionsOf(size({ mode: 'truefalse', units: 193, length: 'all' }))).toBe(TRUE_FALSE_ROUND);
    expect(TRUE_FALSE_ROUND).toBe(20);
    expect(questionsOf(size({ mode: 'truefalse', units: 193, length: 'endless' }))).toBeNull();
  });

  it('is the same for the odd one out, whose questions are made up as the game goes too', () => {
    expect(questionsOf(size({ mode: 'oddone', units: 5, length: 50 }))).toBe(50);
    expect(questionsOf(size({ mode: 'oddone', units: 193, length: 'all' }))).toBe(TRUE_FALSE_ROUND);
    expect(questionsOf(size({ mode: 'oddone', units: 193, length: 'endless' }))).toBeNull();
    // Four names to read and a reason to find: it takes longer than saying true or false.
    expect(TYPICAL_S.oddone!).toBeGreaterThan(TYPICAL_S.truefalse!);
  });

  it('is nothing to count in pairs, which lasts until every card has its other half', () => {
    expect(questionsOf(size({ mode: 'pairs', units: 193, length: 20 }))).toBeNull();
    expect(LENGTH_MODES).not.toContain('pairs');
    // What it lasts is what the games played have lasted.
    expect(estimateOf('pairs', null, { games: 0, perQuestion: null, perGame: null, first: null })).toBeNull();
    expect(estimateOf('pairs', null, { games: 2, perQuestion: 9000, perGame: 72_000, first: 0.75 })).toEqual({ ms: 72_000, own: true });
  });

  it('is a letter for each initial in the alphabet, however many countries there are and whatever the length chosen', () => {
    expect(questionsOf(size({ mode: 'alphabet', units: 193, length: 10, letters: 23 }))).toBe(23);
    expect(questionsOf(size({ mode: 'alphabet', units: 44, length: 'endless', letters: 16 }))).toBe(16);
    // Not known, it is not made up from the countries.
    expect(questionsOf(size({ mode: 'alphabet', units: 193, length: 'all' }))).toBeNull();
    expect(questionsOf(size({ mode: 'alphabet', units: 0, length: 'all', letters: 3 }))).toBeNull();
    expect(LENGTH_MODES).not.toContain('alphabet');
    // A clue to read and a name to type: before the first game, a round figure for each letter.
    expect(estimateOf('alphabet', 23, { games: 0, perQuestion: null, perGame: null, first: null })).toEqual({ ms: 23 * TYPICAL_S.alphabet! * 1000, own: false });
    expect(estimateOf('alphabet', 23, { games: 1, perQuestion: 8000, perGame: 150_000, first: 0.8 })).toEqual({ ms: 184_000, own: true });
    // No other game counts letters.
    expect(questionsOf(size({ mode: 'pin', units: 52, length: 'all', letters: 9 }))).toBe(52);
  });

  it('is four groups in connections, whatever the countries, where there are enough of them for a board', () => {
    expect(questionsOf(size({ mode: 'connect', units: 193, length: 50 }))).toBe(4);
    expect(questionsOf(size({ mode: 'connect', units: 16, length: 'endless' }))).toBe(4);
    expect(questionsOf(size({ mode: 'connect', units: 15, length: 'all' }))).toBeNull();
    expect(LENGTH_MODES).not.toContain('connect');
    // A group is four countries to put together and what they share to find out: far longer than a question.
    expect(TYPICAL_S.connect!).toBeGreaterThan(TYPICAL_S.alphabet! * 3);
    expect(estimateOf('connect', 4, { games: 0, perQuestion: null, perGame: null, first: null })).toEqual({ ms: 4 * TYPICAL_S.connect! * 1000, own: false });
  });

  it('is a round of five for each question of north to south, like the other game of putting in order', () => {
    expect(questionsOf(size({ mode: 'compass', units: 52, length: 'all' }))).toBe(questionsOf(size({ mode: 'rank', units: 52, length: 'all' })));
    expect(questionsOf(size({ mode: 'compass', units: 52, length: 20 }))).toBe(20);
    expect(questionsOf(size({ mode: 'compass', units: 52, length: 'endless' }))).toBeNull();
  });

  it('has an idea of how long they take before the first game', () => {
    expect(estimateOf('truefalse', 20, paceOf([], 'pops', 'truefalse'))).toEqual({ ms: 20 * TYPICAL_S.truefalse! * 1000, own: false });
    expect(estimateOf('parent', 41, paceOf([], 'regions', 'parent'))?.ms).toBe(41 * TYPICAL_S.parent! * 1000);
  });
});

describe('how many questions a game will ask', () => {
  it('is the whole map, or the number chosen when the map has that many', () => {
    expect(questionsOf(size())).toBe(52);
    expect(questionsOf(size({ length: 20 }))).toBe(20);
    expect(questionsOf(size({ length: 50, units: 17 }))).toBe(17);
  });

  it('has no number in an endless game, against the clock or with lives', () => {
    expect(questionsOf(size({ length: 'endless' }))).toBeNull();
    expect(questionsOf(size({ format: 'timed' }))).toBeNull();
    expect(questionsOf(size({ format: 'lives' }))).toBeNull();
    // The clock and the lives are for some games only: elsewhere the option says nothing.
    expect(questionsOf(size({ mode: 'blind', format: 'timed' }))).toBe(52);
  });

  it('is the whole list when a list of the player is in use', () => {
    expect(questionsOf(size({ units: 8, length: 20, list: true }))).toBe(8);
  });

  it('is every piece when the map is filled in from memory, and ten rounds of putting in order', () => {
    expect(questionsOf(size({ mode: 'nameall', length: 10 }))).toBe(52);
    expect(questionsOf(size({ mode: 'rank' }))).toBe(10);
    expect(questionsOf(size({ mode: 'rank', length: 20 }))).toBe(20);
    expect(questionsOf(size({ mode: 'rank', length: 'endless' }))).toBeNull();
  });

  it('has no number where the game is not a count of questions, or the map is empty', () => {
    for (const mode of ['explore', 'learn', 'travel', 'hilo'] as const) expect(questionsOf(size({ mode }))).toBeNull();
    expect(questionsOf(size({ units: 0 }))).toBeNull();
  });
});

describe('how long a game is expected to take', () => {
  const none = paceOf([], 'regions', 'pin');

  it('goes by the pace of the player once there is one', () => {
    const pace = paceOf([played()], 'regions', 'pin');
    expect(estimateOf('pin', 52, pace)).toEqual({ ms: 52 * 5000, own: true });
  });

  it('goes by a round figure before the first game', () => {
    expect(estimateOf('pin', 52, none)).toEqual({ ms: 52 * TYPICAL_S.pin! * 1000, own: false });
  });

  it('is what the games of the player have lasted when the questions cannot be counted', () => {
    const pace = paceOf([played({ mode: 'learn', ms: 180_000 })], 'regions', 'learn');
    expect(estimateOf('learn', null, pace)).toEqual({ ms: 180_000, own: true });
    expect(estimateOf('learn', null, none)).toBeNull();
    expect(estimateOf('travel', 5, none)).toBeNull();
  });

  it('is not said of an endless game or one against the clock, however many have been played', () => {
    const pace = paceOf([played()], 'regions', 'pin');
    expect(estimateOf('pin', null, pace)).toBeNull();
    expect(estimateOf('nameall', null, paceOf([played({ mode: 'nameall' })], 'regions', 'nameall'))).toBeNull();
  });

  it('is said in whole minutes, never fewer than one', () => {
    expect(minutesOf(20_000)).toBe(1);
    expect(minutesOf(89_000)).toBe(1);
    expect(minutesOf(91_000)).toBe(2);
    expect(minutesOf(52 * 7000)).toBe(6);
  });

  it('says the share right first time as a whole percentage', () => {
    expect(percentOf(0.756)).toBe(76);
    expect(percentOf(0)).toBe(0);
    expect(percentOf(1.2)).toBe(100);
  });
});
