import { describe, expect, it } from 'vitest';
import { scoreOf } from '../games/quiz';
import { GHOSTS_KEPT, GHOST_QUESTIONS, cleanGhosts, ghostFrom, ghostKey, isGhost, passed, runOf, sumOf, versus, withGhost, type Ghost, type Kept, type Trace } from './ghost';
import { ghostable } from './ghostLazy';
import { DEFAULT_OPTS, type GameConfig, type Opts } from './store';
import { fmtTime } from './text';
import type { Country, Res } from './types';

type Game = Omit<GameConfig, 'nonce'>;
const game = (patch: Partial<Game> = {}, opts: Partial<Opts> = {}): Game => ({ section: 'regions', mode: 'pin', countries: ['ES'], levels: { ES: 'g1' }, ...patch, opts: { ...DEFAULT_OPTS, length: 10, ...opts } });

/** Spain has communities (`g1`) and provinces (`g2`), and is played by its provinces when nothing is said; France has regions alone. */
const WORLD: Record<string, Country> = {
  ES: { id: 'ES', dl: 'g2', lv: [{ k: 'g1' }, { k: 'g2' }] } as unknown as Country,
  FR: { id: 'FR', dl: 'g1', lv: [{ k: 'g1' }] } as unknown as Country,
};
const country = (id: string): Country | undefined => WORLD[id];
const keyOf = (patch: Partial<Game> = {}, opts: Partial<Opts> = {}): string | null => ghostKey(game(patch, opts), country);

/** A trace: an answer every `step` ms, each as it is said to have gone. */
const traceOf = (how: string, step = 2000): Trace => [...how].map((c, i) => [(i + 1) * step, ({ o: 'ok', w: 'warn', b: 'bad' } as Record<string, Res>)[c]] as const);
const QUESTIONS = (n: number): string[] => Array.from({ length: n }, (_, i) => `q${i}`);
/** The ghost of a game of that many questions, each answered as said, that ended a second after the last answer. */
const ghostOf = (how: string, step = 2000, patch: Partial<Ghost> = {}): Ghost => ({ ...ghostFrom(7, QUESTIONS(how.length), traceOf(how, step), how.length * step + 1000, 1_000_000)!, ...patch });

describe('the games a ghost is kept of', () => {
  it('are those that ask one thing after another, played at ease and with an end', () => {
    for (const mode of ['pin', 'identify', 'outline', 'puzzle', 'capital', 'flag', 'fact', 'parent', 'mix', 'listen'] as const) expect(ghostable(game({ mode })), mode).toBe(true);
    for (const mode of ['explore', 'learn', 'nameall', 'cards', 'regionle', 'blind', 'hotcold', 'travel', 'print', 'edit'] as const) expect(ghostable(game({ mode })), mode).toBe(false);
    for (const length of ['all', 10, 20, 50] as const) expect(ghostable(game({}, { length })), String(length)).toBe(true);
    expect(ghostable(game({}, { length: 'endless' }))).toBe(false);
    for (const format of ['timed', 'lives', 'exam'] as const) expect(ghostable(game({}, { format })), format).toBe(false);
    // A state kept from before the formats says nothing of them: a plain game.
    expect(ghostable(game({}, { format: undefined as unknown as Opts['format'] }))).toBe(true);
    expect(ghostable(game({ section: 'pops' }))).toBe(false);
  });

  it('are not a review, a step of the day, a round of misses or a challenge of any kind', () => {
    expect(ghostable(game({ review: true }))).toBe(false);
    expect(ghostable(game({ daily: '2026-11-15' }))).toBe(false);
    expect(ghostable(game({ step: 'review' as unknown as GameConfig['step'] }))).toBe(false);
    expect(ghostable(game({ challenge: { seed: 5 } }))).toBe(false);
    expect(ghostable(game({ weekly: '2026-11-09' }))).toBe(false);
    expect(ghostable(game({ zone: { id: 'eu', date: '2026-11-15' } }))).toBe(false);
    expect(ghostable(game({ occasion: { id: 'constitution', year: 2026 } }))).toBe(false);
    // The misses of a game, asked again: some pieces, and no list they belong to.
    expect(ghostable(game({ only: ['a', 'b'] }))).toBe(false);
  });

  it('are a custom list too, which is asked whole whatever the number of questions chosen', () => {
    expect(ghostable(game({ only: ['a', 'b'], list: 'Examen' }))).toBe(true);
    expect(ghostable(game({ only: ['a', 'b'], list: 'Examen' }, { length: 'endless' }))).toBe(true);
    expect(ghostable(game({ only: [], list: 'Examen' }))).toBe(false);
    expect(ghostable(game({ list: 'Examen' }))).toBe(false);
    // …but not under a clock.
    expect(ghostable(game({ only: ['a', 'b'], list: 'Examen' }, { format: 'timed' }))).toBe(false);
  });
});

describe('the name the ghost of a game is kept under', () => {
  it('is null for a game that has none', () => {
    expect(keyOf({ mode: 'explore' })).toBeNull();
    expect(keyOf({}, { format: 'exam' })).toBeNull();
    expect(keyOf({ challenge: { seed: 1 } })).toBeNull();
  });

  it('says the section and the game, and is short whatever the map', () => {
    expect(keyOf()).toMatch(/^regions\|pin\|[0-9a-z]{1,7}$/);
    const world = Array.from({ length: 251 }, (_, i) => `C${i}`);
    expect(keyOf({ section: 'countries', mode: 'flag', countries: world, levels: {} })).toMatch(/^countries\|flag\|[0-9a-z]{1,7}$/);
    // What is kept under it is read back only if the name is one of these.
    expect(cleanGhosts([[keyOf(), ghostOf('ooo')]])).toHaveLength(1);
  });

  it('is the same however the countries are listed', () => {
    const a = keyOf({ countries: ['ES', 'FR'], levels: { ES: 'g1', FR: 'g1' } });
    expect(keyOf({ countries: ['FR', 'ES'], levels: { FR: 'g1', ES: 'g1' } })).toBe(a);
    expect(keyOf({ countries: ['FR', 'ES', 'FR'], levels: { FR: 'g1', ES: 'g1' } })).toBe(a);
    expect(keyOf({ countries: ['ES'], levels: { ES: 'g1' } })).not.toBe(a);
  });

  it('takes the level a map of regions is played at from the map: said or not, it is the same game', () => {
    // Spain is played by its provinces when nothing is said.
    expect(keyOf({ levels: {} })).toBe(keyOf({ levels: { ES: 'g2' } }));
    expect(keyOf({ levels: {} })).not.toBe(keyOf({ levels: { ES: 'g1' } }));
    // A level the country does not have is the one it is played at; and the level of a country that is not on the map says nothing.
    expect(keyOf({ levels: { ES: 'g9' } })).toBe(keyOf({ levels: { ES: 'g2' } }));
    expect(keyOf({ levels: { ES: 'g1', FR: 'g1' } })).toBe(keyOf({ levels: { ES: 'g1' } }));
    // A country the world does not know is taken at the level the game says.
    expect(keyOf({ countries: ['XX'], levels: { XX: 'g1' } })).not.toBe(keyOf({ countries: ['XX'], levels: { XX: 'g2' } }));
    // Elsewhere the levels are not what is played.
    expect(keyOf({ section: 'countries', levels: { ES: 'g1' } })).toBe(keyOf({ section: 'countries', levels: {} }));
  });

  it('tells apart what changes the questions: the game, the map and how long it is', () => {
    const keys = [
      keyOf(),
      keyOf({ mode: 'identify' }),
      keyOf({ section: 'countries' }),
      keyOf({ countries: ['FR'], levels: { FR: 'g1' } }),
      keyOf({ levels: { ES: 'g2' } }),
      keyOf({}, { length: 20 }),
      keyOf({}, { length: 50 }),
      keyOf({}, { length: 'all' }),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('tells four options from typing, except where the answer is given on the map', () => {
    for (const mode of ['identify', 'outline', 'capital', 'flag', 'parent', 'mix'] as const) expect(keyOf({ mode }, { answer: 'choice' }), mode).not.toBe(keyOf({ mode }, { answer: 'type' }));
    for (const mode of ['pin', 'puzzle', 'listen'] as const) expect(keyOf({ mode }, { answer: 'choice' }), mode).toBe(keyOf({ mode }, { answer: 'type' }));
  });

  it('tells apart what countries are pinned by, turned outlines and the look of the flags, each where it counts', () => {
    const countries = { section: 'countries', levels: {} } as const;
    expect(keyOf({ ...countries, mode: 'pin' }, { pinBy: 'flag' })).not.toBe(keyOf({ ...countries, mode: 'pin' }, { pinBy: 'name' }));
    expect(keyOf({ ...countries, mode: 'pin' }, { pinBy: 'capital' })).not.toBe(keyOf({ ...countries, mode: 'pin' }, { pinBy: 'flag' }));
    // Regions are pinned by name alone, and another game than "pin it" asks what it asks.
    expect(keyOf({ mode: 'pin' }, { pinBy: 'flag' })).toBe(keyOf({ mode: 'pin' }, { pinBy: 'name' }));
    expect(keyOf({ ...countries, mode: 'identify' }, { pinBy: 'flag' })).toBe(keyOf({ ...countries, mode: 'identify' }, { pinBy: 'name' }));

    expect(keyOf({ mode: 'outline' }, { turned: true })).not.toBe(keyOf({ mode: 'outline' }, { turned: false }));
    expect(keyOf({ mode: 'mix' }, { turned: true })).not.toBe(keyOf({ mode: 'mix' }, { turned: false }));
    expect(keyOf({ mode: 'pin' }, { turned: true })).toBe(keyOf({ mode: 'pin' }, { turned: false }));
    // A medley of cities has no outlines to turn.
    expect(keyOf({ section: 'cities', mode: 'mix' }, { turned: true })).toBe(keyOf({ section: 'cities', mode: 'mix' }, { turned: false }));

    expect(keyOf({ ...countries, mode: 'flag' }, { flagLook: 'grey' })).not.toBe(keyOf({ ...countries, mode: 'flag' }, { flagLook: 'plain' }));
    expect(keyOf({ ...countries, mode: 'flag' }, { flagLook: 'blur' })).not.toBe(keyOf({ ...countries, mode: 'flag' }, { flagLook: 'grey' }));
    expect(keyOf({ ...countries, mode: 'pin' }, { pinBy: 'flag', flagLook: 'grey' })).not.toBe(keyOf({ ...countries, mode: 'pin' }, { pinBy: 'flag', flagLook: 'plain' }));
    expect(keyOf({ ...countries, mode: 'pin' }, { pinBy: 'name', flagLook: 'grey' })).toBe(keyOf({ ...countries, mode: 'pin' }, { pinBy: 'name', flagLook: 'plain' }));
    expect(keyOf({ ...countries, mode: 'capital' }, { flagLook: 'grey' })).toBe(keyOf({ ...countries, mode: 'capital' }, { flagLook: 'plain' }));
    // A state kept from before the looks says nothing of them: plain flags.
    expect(keyOf({ ...countries, mode: 'flag' }, { flagLook: undefined as unknown as Opts['flagLook'] })).toBe(keyOf({ ...countries, mode: 'flag' }, { flagLook: 'plain' }));
  });

  it('tells apart what the game of the facts asks for, and what a country is pinned by', () => {
    const countries = { section: 'countries' as const, levels: {}, countries: ['ES', 'FR'] };
    // Its currencies and its languages have a ghost each.
    const keys = (['currency', 'language', 'domain', 'dial'] as const).map((fact) => keyOf({ ...countries, mode: 'fact' }, { fact }));
    expect(new Set(keys).size).toBe(4);
    for (const key of keys) expect(key).toMatch(/^countries\|fact\|[0-9a-z]+$/);
    // A state kept from before the game says nothing of it: the currency, which the game opens with.
    expect(keyOf({ ...countries, mode: 'fact' }, { fact: undefined as unknown as Opts['fact'] })).toBe(keys[0]);
    // Another game asks what it asks, whatever was chosen for this one.
    expect(keyOf({ ...countries, mode: 'capital' }, { fact: 'dial' })).toBe(keyOf({ ...countries, mode: 'capital' }, { fact: 'currency' }));
    expect(keyOf({ ...countries, mode: 'pin' }, { fact: 'dial' })).toBe(keyOf({ ...countries, mode: 'pin' }, { fact: 'currency' }));
    // A country found by its domain is not one found by its dialling code, nor by its name.
    const pins = (['name', 'capital', 'flag', 'domain', 'dial'] as const).map((pinBy) => keyOf({ ...countries, mode: 'pin' }, { pinBy }));
    expect(new Set(pins).size).toBe(5);
  });

  it('tells apart which cities are on the map, and how many only where they are the biggest', () => {
    const cities = { section: 'cities', levels: {} } as const;
    expect(keyOf(cities, { cityPick: 'top', cityCount: 10 })).not.toBe(keyOf(cities, { cityPick: 'top', cityCount: 25 }));
    expect(keyOf(cities, { cityPick: 'caps', cityCount: 10 })).toBe(keyOf(cities, { cityPick: 'caps', cityCount: 25 }));
    expect(keyOf(cities, { cityPick: 'caps' })).not.toBe(keyOf(cities, { cityPick: 'regcaps' }));
    expect(keyOf(cities, { cityPick: 'top', cityCount: 10 })).not.toBe(keyOf(cities, { cityPick: 'caps', cityCount: 10 }));
    expect(keyOf({}, { cityPick: 'caps', cityCount: 10 })).toBe(keyOf({}, { cityPick: 'top', cityCount: 25 }));
  });

  it('takes nothing of how one likes to play', () => {
    const plain = keyOf({ mode: 'identify' }, { answer: 'type' });
    expect(keyOf({ mode: 'identify' }, { answer: 'type', suggest: true, labels: false, wiki: false, blind: true, metric: 'area', countdown: 60, cardAsk: 'flag', pairs: 12 })).toBe(plain);
    // A game against a ghost is the same game as the one that left it.
    expect(keyOf({ mode: 'identify', ghost: { seed: 9 } }, { answer: 'type' })).toBe(plain);
  });

  it('tells apart the rules of the game, each where it counts', () => {
    const plain = keyOf();
    const keys = [plain, keyOf({}, { tries: 1 }), keyOf({}, { tries: 2 }), keyOf({}, { hints: false }), keyOf({}, { tries: 1, hints: false }), keyOf({}, { tries: 2, hints: false })];
    expect(new Set(keys).size).toBe(keys.length);
    // The clock and the lives are those of other formats, which leave no ghost.
    expect(keyOf({}, { clock: 120, lives: 5 })).toBe(plain);
    // Among four options a question takes one try whatever the rules say: the hints still count.
    const picked = keyOf({ mode: 'flag', section: 'countries' }, { answer: 'choice' });
    expect(keyOf({ mode: 'flag', section: 'countries' }, { answer: 'choice', tries: 1 })).toBe(picked);
    expect(keyOf({ mode: 'flag', section: 'countries' }, { answer: 'choice', hints: false })).not.toBe(picked);
    expect(keyOf({ mode: 'flag', section: 'countries' }, { answer: 'type', tries: 1 })).not.toBe(keyOf({ mode: 'flag', section: 'countries' }, { answer: 'type' }));
    // Rules that cannot be are the usual ones.
    expect(keyOf({}, { tries: 9, hints: 'no' as unknown as boolean })).toBe(plain);
  });

  it('is, for the usual rules, the one it was before the rules could be set', () => {
    // Taken from version 1.33.0: the ghosts kept by then are found under these names.
    expect(keyOf()).toBe('regions|pin|1ngm9m7');
    expect(ghostKey({ section: 'countries', mode: 'flag', countries: ['ES', 'FR'], levels: {}, opts: { ...DEFAULT_OPTS, answer: 'choice' } }, country)).toBe('countries|flag|k97nkw');
    // Options kept by then said nothing of the rules.
    const { tries: _tries, hints: _hints, clock: _clock, lives: _lives, ...before } = { ...DEFAULT_OPTS, length: 10 as const };
    expect([_tries, _hints, _clock, _lives]).toEqual([3, true, 60, 3]);
    expect(ghostKey({ section: 'regions', mode: 'pin', countries: ['ES'], levels: { ES: 'g1' }, opts: before as Opts }, country)).toBe('regions|pin|1ngm9m7');
  });

  it('tells a list from the whole map and from another list, whatever their names', () => {
    const list = keyOf({ only: ['b', 'a'], list: 'Examen' });
    expect(list).not.toBe(keyOf());
    expect(keyOf({ only: ['a', 'b', 'a'], list: 'Otro nombre' })).toBe(list);
    expect(keyOf({ only: ['a', 'c'], list: 'Examen' })).not.toBe(list);
    // A list is asked whole: the number of questions chosen for the other games is not its own.
    expect(keyOf({ only: ['a', 'b'], list: 'Examen' }, { length: 50 })).toBe(list);
    expect(keyOf({ only: ['a', 'b'], list: 'Examen' }, { length: 'all' })).toBe(list);
  });
});

describe('the ghost a game leaves', () => {
  it('holds, for each question, how long it took and how it went', () => {
    const ghost = ghostFrom(42, ['a', 'b', 'c'], [[1500, 'ok'], [4000, 'warn'], [4200, 'bad']], 9000, 123_456)!;
    expect(ghost).toEqual({ k: 42, h: sumOf(['a', 'b', 'c']), t: 123_456, q: [15 * 3, 25 * 3 + 1, 2 * 3 + 2], d: 90 });
    expect(runOf(ghost)).toEqual({ res: ['ok', 'warn', 'bad'], at: [1500, 4000, 4200], ok: 1, warn: 1, bad: 1, score: scoreOf(1, 1, 3), ms: 9000 });
  });

  it('is left only by a game played to the end: an answer for each question dealt', () => {
    expect(ghostFrom(1, ['a', 'b', 'c'], traceOf('oo'), 9000, 5)).toBeNull();
    expect(ghostFrom(1, ['a', 'b'], traceOf('ooo'), 9000, 5)).toBeNull();
    expect(ghostFrom(1, [], [], 0, 5)).toBeNull();
    expect(ghostFrom(1, ['a', 'b', 'c'], traceOf('owb'), 9000, 5)).not.toBeNull();
  });

  it('is not left by a game too long for one to be kept', () => {
    const long = 'o'.repeat(GHOST_QUESTIONS);
    expect(ghostFrom(1, QUESTIONS(GHOST_QUESTIONS), traceOf(long, 100), 99_000, 5)).not.toBeNull();
    expect(ghostFrom(1, QUESTIONS(GHOST_QUESTIONS + 1), traceOf(`${long}o`, 100), 99_000, 5)).toBeNull();
  });

  it('counts the tenths from the start: what is cut off in a question is not carried into the next', () => {
    // An answer every 149 ms: each is a tenth and a bit, and a hundred of them are 14,9 seconds, not ten.
    const trace: Trace = Array.from({ length: 100 }, (_, i) => [(i + 1) * 149, 'ok'] as const);
    const run = runOf(ghostFrom(1, QUESTIONS(100), trace, 14_900, 5)!);
    expect(run.at[99]).toBe(14_900);
    for (let i = 0; i < 100; i++) {
      const late = (i + 1) * 149 - run.at[i];
      expect(late).toBeGreaterThanOrEqual(0);
      expect(late).toBeLessThan(100);
    }
  });

  it('took the time its clock showed, to the second, whatever the fraction it ended on', () => {
    for (const ms of [0, 99, 949, 950, 999, 1000, 20_949, 20_950, 20_960, 20_999, 21_000, 59_999, 60_000, 3_599_999, 3_600_000]) {
      // A game that ends as its last question is answered, and one that goes on after it.
      for (const last of [ms, Math.floor(ms / 2)]) {
        const ghost = ghostFrom(1, ['a'], [[last, 'ok']], ms, 5)!;
        expect(fmtTime(runOf(ghost).ms), `${ms} ms, the last answer at ${last}`).toBe(fmtTime(ms));
        expect(versus(runOf(ghost), { score: 100, ms }), `${ms} ms`).toBe(0);
      }
    }
  });

  it('never goes back in time, and does not end before its last answer', () => {
    const ghost = ghostFrom(1, ['a', 'b', 'c'], [[3000, 'ok'], [1000, 'ok'], [-50, 'bad']], 100, 5)!;
    expect(runOf(ghost).at).toEqual([3000, 3000, 3000]);
    expect(ghost.d).toBe(30);
    expect(runOf(ghost).ms).toBe(3000);
    // A ghost that says it ended before its last answer is read as ending with it.
    expect(runOf({ q: [30, 30], d: 5 }).ms).toBe(2000);
    expect(runOf({ q: [30, 30], d: 50 }).ms).toBe(5000);
  });

  it('says of no question that it took more than a week, and catches up with the clock as it can', () => {
    const week = 7 * 86_400_000;
    const ghost = ghostFrom(1, ['a', 'b', 'c'], [[week * 2, 'ok'], [week * 2 + 1000, 'ok'], [week * 2 + 2000, 'ok']], week * 3, 5)!;
    expect(isGhost(ghost)).toBe(true);
    expect(runOf(ghost).at).toEqual([week, week * 2, week * 2 + 2000]);
    expect(runOf(ghost).ms).toBe(week * 3);
    // A game as long as the longest one that can be told of is still a ghost.
    const longest = ghostFrom(1, ['a'], [[1000, 'ok']], week * 1000, 5)!;
    expect(isGhost(longest)).toBe(true);
    expect(runOf(longest).ms).toBe(week * GHOST_QUESTIONS);
  });

  it('adds up to the score every game gives', () => {
    expect(runOf(ghostOf('oooooooowb')).score).toBe(85);
    expect(runOf(ghostOf('oooooooowb'))).toMatchObject({ ok: 8, warn: 1, bad: 1, ms: 21_000 });
    expect(runOf(ghostOf('bbb')).score).toBe(0);
    expect(runOf(ghostOf('www')).score).toBe(50);
    expect(runOf(ghostOf('o')).score).toBe(100);
  });

  it('says how far it had got at each moment', () => {
    const run = runOf(ghostOf('ooo', 2000));
    expect(passed(run, 0)).toBe(0);
    expect(passed(run, 1999)).toBe(0);
    expect(passed(run, 2000)).toBe(1);
    expect(passed(run, 5999)).toBe(2);
    expect(passed(run, 6000)).toBe(3);
    expect(passed(run, 1e9)).toBe(3);
    expect(passed({ at: [] }, 100)).toBe(0);
  });
});

describe('which of two games is the better', () => {
  const run = (score: number, ms: number) => ({ score, ms });
  it('is the one with the higher score, however long it took', () => {
    expect(versus(run(90, 99_000), run(85, 5000))).toBe(1);
    expect(versus(run(85, 5000), run(90, 99_000))).toBe(-1);
  });

  it('is, with the same score, the one that took less, by the second the clock shows', () => {
    expect(versus(run(90, 59_000), run(90, 60_000))).toBe(1);
    expect(versus(run(90, 61_000), run(90, 60_000))).toBe(-1);
    // 1:00,0 and 1:00,9 are both shown as 1:00.
    expect(versus(run(90, 60_000), run(90, 60_900))).toBe(0);
    expect(versus(run(90, 60_900), run(90, 60_000))).toBe(0);
    expect(versus(run(90, 59_999), run(90, 60_000))).toBe(1);
    expect(versus(run(0, 0), run(0, 0))).toBe(0);
  });
});

describe('what is read back as a ghost', () => {
  const good = ghostOf('owb');
  it('is a ghost whole, and nothing else', () => {
    expect(isGhost(good)).toBe(true);
    for (const bad of [null, undefined, 'x', 5, [], {}, { ...good, k: -1 }, { ...good, k: 1.5 }, { ...good, k: '7' }, { ...good, k: 2 ** 32 }, { ...good, h: -1 }, { ...good, h: 2 ** 32 }, { ...good, t: 0 }, { ...good, t: -5 }, { ...good, t: NaN }, { ...good, t: 1.5 }, { ...good, t: '5' }, { ...good, t: Infinity }, { ...good, t: 2e15 }]) {
      expect(isGhost(bad), JSON.stringify(bad)).toBe(false);
    }
    for (const q of [undefined, 'x', [], [1.5], [-1], ['1'], [NaN], [6_048_000 * 3 + 3], Array(GHOST_QUESTIONS + 1).fill(3)]) expect(isGhost({ ...good, q }), JSON.stringify(q)?.slice(0, 40)).toBe(false);
    expect(isGhost({ ...good, q: [6_048_000 * 3 + 2] })).toBe(true);
    expect(isGhost({ ...good, q: Array(GHOST_QUESTIONS).fill(3) })).toBe(true);
    for (const d of [undefined, -1, 1.5, '9', Infinity]) expect(isGhost({ ...good, d }), String(d)).toBe(false);
    expect(isGhost({ ...good, d: 0 })).toBe(true);
  });

  it('keeps one for each game, under names that are names of games', () => {
    const other = ghostOf('ooo');
    const raw = [
      ['regions|pin|abc123', good],
      ['regions|pin|abc123', other],
      ['regions|pin', good],
      ['REGIONS|pin|abc', good],
      ['regions|pin|abc def', good],
      [5, good],
      ['countries|flag|z9', { ...good, q: 'x' }],
      'junk',
      null,
      ['countries|flag|z9'],
      ['countries|flag|z9', other, 'more'],
    ];
    expect(cleanGhosts(raw)).toEqual([
      ['regions|pin|abc123', good],
      ['countries|flag|z9', other],
    ]);
    for (const junk of [null, undefined, 'x', 5, {}, { 0: ['regions|pin|abc', good] }]) expect(cleanGhosts(junk)).toEqual([]);
  });

  it('takes a ghost by what it is made of, and nothing that comes with it', () => {
    const [[, back]] = cleanGhosts([['regions|pin|abc', { ...good, extra: 'x', __proto__: { evil: true } }]]);
    expect(back).toEqual(good);
    expect(Object.keys(back).sort()).toEqual(['d', 'h', 'k', 'q', 't']);
    expect(back.q).not.toBe(good.q);
  });

  it('keeps no more than there is room for: the first ones', () => {
    const many = Array.from({ length: GHOSTS_KEPT + 5 }, (_, i) => [`regions|pin|k${i}`, good] as Kept);
    const kept = cleanGhosts(many);
    expect(kept).toHaveLength(GHOSTS_KEPT);
    expect(kept[0][0]).toBe('regions|pin|k0');
    expect(kept[GHOSTS_KEPT - 1][0]).toBe(`regions|pin|k${GHOSTS_KEPT - 1}`);
  });
});

describe('the ghosts once a game has ended', () => {
  const A = 'regions|pin|a';
  const B = 'regions|pin|b';
  const slow = ghostOf('oooooooowb', 3000, { t: 1 });
  const fast = ghostOf('oooooooowb', 2000, { t: 2 });
  const best = ghostOf('oooooooooo', 5000, { t: 3 });
  const worst = ghostOf('oooooooobb', 500, { t: 4 });

  it('keep the first game of a map as its ghost', () => {
    expect(withGhost([], A, slow)).toEqual([[A, slow]]);
    expect(withGhost([[B, fast]], A, slow)).toEqual([
      [A, slow],
      [B, fast],
    ]);
  });

  it('keep the better of the two: the higher score, then the shorter time', () => {
    expect(withGhost([[A, slow]], A, best)).toEqual([[A, best]]);
    expect(withGhost([[A, slow]], A, fast)).toEqual([[A, fast]]);
    expect(withGhost([[A, fast]], A, slow)).toEqual([[A, fast]]);
    expect(withGhost([[A, best]], A, fast)).toEqual([[A, best]]);
    expect(withGhost([[A, fast]], A, worst)).toEqual([[A, fast]]);
    // A tie leaves the one there was: the ghost is to be beaten.
    const twin = { ...fast, t: 99 };
    expect(withGhost([[A, fast]], A, twin)[0][1]).toBe(fast);
  });

  it('put the game played last at the front, whether or not it left a ghost', () => {
    const list: Kept[] = [
      [B, fast],
      [A, slow],
    ];
    expect(withGhost(list, A, null).map(([k]) => k)).toEqual([A, B]);
    expect(withGhost(list, A, worst)).toEqual([
      [A, slow],
      [B, fast],
    ]);
    expect(withGhost(list, A, best)).toEqual([
      [A, best],
      [B, fast],
    ]);
    // A game with no ghost that leaves none changes nothing.
    expect(withGhost(list, 'regions|pin|c', null)).toEqual(list);
    // What was given is not touched.
    expect(list.map(([k]) => k)).toEqual([B, A]);
  });

  it('drop a ghost of questions the map no longer deals, whatever the game was like', () => {
    const list: Kept[] = [
      [B, fast],
      [A, best],
    ];
    expect(withGhost(list, A, null, true)).toEqual([[B, fast]]);
    expect(withGhost(list, A, worst, true)).toEqual([
      [A, worst],
      [B, fast],
    ]);
    expect(withGhost(list, A, worst, false)[0]).toEqual([A, best]);
  });

  it('keep those of the games played latest, and no more', () => {
    const full = Array.from({ length: GHOSTS_KEPT }, (_, i) => [`regions|pin|k${i}`, slow] as Kept);
    const next = withGhost(full, A, fast);
    expect(next).toHaveLength(GHOSTS_KEPT);
    expect(next[0]).toEqual([A, fast]);
    expect(next[GHOSTS_KEPT - 1][0]).toBe(`regions|pin|k${GHOSTS_KEPT - 2}`);
    // One that is already there takes nobody's place.
    const again = withGhost(full, `regions|pin|k${GHOSTS_KEPT - 1}`, null);
    expect(again).toHaveLength(GHOSTS_KEPT);
    expect(again[0][0]).toBe(`regions|pin|k${GHOSTS_KEPT - 1}`);
    expect(again[GHOSTS_KEPT - 1][0]).toBe(`regions|pin|k${GHOSTS_KEPT - 2}`);
  });
});
