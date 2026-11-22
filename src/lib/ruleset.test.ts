/** «Reglas a medida»: which rules a game is played by, where each of them counts, how they are told and what they name. */
import { beforeEach, describe, expect, it } from 'vitest';
import { cleanOpts } from './backup';
import { decodeChallenge, encodeChallenge } from './challenge';
import { readOpts, writeOpts } from './embed';
import { setLang } from './i18n';
import { CLOCKS, FORMAT_MODES, LIVES, TRIES, USUAL_RULES, formatOfGame } from './rules';
import { clockShort, clockText, customRules, livesText, recordName, rulesIn, rulesMark, rulesOf, rulesOfGame, rulesText, triesText, type Rules } from './ruleset';
import { DEFAULT_OPTS, mergeSaved, useStore, type Format, type GameConfig, type Opts } from './store';
import type { Mode } from './types';

const USUAL: Rules = { tries: 3, hints: true, clock: 60, lives: 3 };
const game = (mode: Mode, opts: Partial<Opts> = {}, more: Partial<GameConfig> = {}): GameConfig => ({ section: 'regions', mode, countries: ['ES'], levels: {}, opts: { ...DEFAULT_OPTS, ...opts }, nonce: 7, ...more });
const HARD: Partial<Opts> = { tries: 1, hints: false, clock: 120, lives: 5 };

beforeEach(() => setLang('es'));

describe('the usual rules', () => {
  it('are the ones the game always had', () => {
    expect(USUAL_RULES).toEqual(USUAL);
  });

  it('are the ones a player starts with', () => {
    expect(rulesOf(DEFAULT_OPTS)).toEqual(USUAL);
    expect({ tries: DEFAULT_OPTS.tries, hints: DEFAULT_OPTS.hints, clock: DEFAULT_OPTS.clock, lives: DEFAULT_OPTS.lives }).toEqual(USUAL);
  });

  it('are the ones of a player from before the rules could be set, whose save has none', () => {
    const { tries: _t, hints: _h, clock: _c, lives: _l, ...old } = { ...DEFAULT_OPTS, answer: 'choice' as const, format: 'timed' as const };
    const merged = mergeSaved({ opts: old }, useStore.getState());
    expect(merged.opts).toMatchObject({ ...USUAL, answer: 'choice', format: 'timed' });
    // What was set is kept from one day to the next.
    expect(mergeSaved({ opts: { ...old, tries: 1, lives: 5 } }, useStore.getState()).opts).toMatchObject({ tries: 1, hints: true, clock: 60, lives: 5 });
  });

  it('are among what each rule can be', () => {
    expect(TRIES).toContain(USUAL.tries);
    expect(CLOCKS).toContain(USUAL.clock);
    expect(LIVES).toContain(USUAL.lives);
    expect([...TRIES]).toEqual([1, 2, 3]);
    expect([...CLOCKS]).toEqual([30, 60, 120, 300]);
    expect([...LIVES]).toEqual([1, 3, 5]);
  });
});

describe('the rules some options ask for', () => {
  it('are taken as they are when each is something that rule can be', () => {
    expect(rulesOf({ tries: 1, hints: false, clock: 300, lives: 1 })).toEqual({ tries: 1, hints: false, clock: 300, lives: 1 });
    expect(rulesOf({ tries: 2, hints: true, clock: 30, lives: 5 })).toEqual({ tries: 2, hints: true, clock: 30, lives: 5 });
  });

  it('are the usual ones where nothing is said', () => {
    expect(rulesOf(null)).toEqual(USUAL);
    expect(rulesOf(undefined)).toEqual(USUAL);
    expect(rulesOf({})).toEqual(USUAL);
    expect(rulesOf({ tries: 2 })).toEqual({ ...USUAL, tries: 2 });
  });

  it('are the usual ones where what is said cannot be', () => {
    const odd = { tries: 0, hints: 'no', clock: 61, lives: 4 } as unknown as Partial<Opts>;
    expect(rulesOf(odd)).toEqual(USUAL);
    expect(rulesOf({ tries: 4, clock: 3600, lives: 0 })).toEqual(USUAL);
    expect(rulesOf({ tries: 1.5, clock: Number.NaN, lives: -1 })).toEqual(USUAL);
    expect(rulesOf({ tries: '1', clock: '30', lives: '5' } as unknown as Partial<Opts>)).toEqual(USUAL);
  });
});

describe('where each rule counts', () => {
  it('is in the format it belongs to', () => {
    expect(rulesIn('timed', 'pin', 'type')).toEqual(['clock']);
    expect(rulesIn('lives', 'pin', 'type')).toEqual(['lives']);
    expect(rulesIn('exam', 'pin', 'type')).toEqual([]);
    expect(rulesIn('normal', 'pin', 'type')).toEqual(['tries', 'hints']);
    expect(rulesIn('duo', 'pin', 'type')).toEqual(['tries', 'hints']);
  });

  it('gives several tries on the map, by typing and in a mix, and one among four options', () => {
    for (const mode of ['pin', 'puzzle', 'listen', 'mix'] as Mode[]) {
      expect(rulesIn('normal', mode, 'choice'), mode).toEqual(['tries', 'hints']);
      expect(rulesIn('normal', mode, undefined), mode).toEqual(['tries', 'hints']);
    }
    for (const mode of ['identify', 'outline', 'capital', 'flag', 'parent'] as Mode[]) {
      expect(rulesIn('normal', mode, 'choice'), mode).toEqual(['hints']);
      expect(rulesIn('normal', mode, undefined), mode).toEqual(['hints']);
      expect(rulesIn('normal', mode, 'type'), mode).toEqual(['tries', 'hints']);
      expect(rulesIn('duo', mode, 'choice'), mode).toEqual(['hints']);
    }
  });

  it('covers every game that has formats', () => {
    expect([...FORMAT_MODES].sort()).toEqual(['capital', 'flag', 'identify', 'listen', 'mix', 'outline', 'parent', 'pin', 'puzzle']);
  });
});

describe('the format a game is played in', () => {
  it('is the one its options ask for', () => {
    for (const format of ['normal', 'timed', 'lives', 'exam', 'duo'] as Format[]) expect(formatOfGame(game('pin', { format }))).toBe(format);
    expect(formatOfGame({ mode: 'pin', opts: {} })).toBe('normal');
  });

  it('is plain in a review, a challenge received and the repeat of what was missed', () => {
    expect(formatOfGame(game('pin', { format: 'timed' }, { review: true }))).toBe('normal');
    expect(formatOfGame(game('pin', { format: 'lives' }, { challenge: { seed: 1 } }))).toBe('normal');
    expect(formatOfGame(game('pin', { format: 'exam' }, { only: ['ES-M'] }))).toBe('normal');
    // A list is a map of its own: it is played in whatever format is chosen.
    expect(formatOfGame(game('pin', { format: 'exam' }, { only: ['ES-M'], list: 'Mi lista' }))).toBe('exam');
  });

  it('is plain where the game has no formats', () => {
    expect(formatOfGame(game('regionle', { format: 'timed' }))).toBe('normal');
    expect(formatOfGame(game('border', { format: 'exam' }))).toBe('normal');
  });

  it('is not one of two players in a step of the day', () => {
    const step = { id: 'a', n: 1, of: 3 } as unknown as GameConfig['step'];
    expect(formatOfGame(game('pin', { format: 'duo' }, { step }))).toBe('normal');
    expect(formatOfGame(game('pin', { format: 'timed' }, { step }))).toBe('timed');
    expect(formatOfGame(game('pin', { format: 'duo' }))).toBe('duo');
  });
});

describe('the rules a game is played by', () => {
  it('are the usual ones until something else is asked for', () => {
    for (const mode of FORMAT_MODES) for (const format of ['normal', 'timed', 'lives', 'exam', 'duo'] as Format[]) expect(rulesOfGame(game(mode, { format })), `${mode} ${format}`).toEqual(USUAL);
  });

  it('are the ones asked for, each in its format', () => {
    expect(rulesOfGame(game('pin', { ...HARD, format: 'normal' }))).toEqual({ ...USUAL, tries: 1, hints: false });
    expect(rulesOfGame(game('pin', { ...HARD, format: 'duo' }))).toEqual({ ...USUAL, tries: 1, hints: false });
    expect(rulesOfGame(game('pin', { ...HARD, format: 'timed' }))).toEqual({ ...USUAL, clock: 120 });
    expect(rulesOfGame(game('pin', { ...HARD, format: 'lives' }))).toEqual({ ...USUAL, lives: 5 });
    expect(rulesOfGame(game('pin', { ...HARD, format: 'exam' }))).toEqual(USUAL);
  });

  it('leave the tries as usual where a question takes one', () => {
    expect(rulesOfGame(game('flag', { ...HARD, answer: 'choice' }))).toEqual({ ...USUAL, hints: false });
    expect(rulesOfGame(game('flag', { ...HARD, answer: 'type' }))).toEqual({ ...USUAL, tries: 1, hints: false });
    expect(rulesOfGame(game('mix', { ...HARD, answer: 'choice' }))).toEqual({ ...USUAL, tries: 1, hints: false });
  });

  it('are the usual ones in a review and in a step of the day, whatever the options say', () => {
    expect(rulesOfGame(game('pin', HARD, { review: true }))).toEqual(USUAL);
    expect(rulesOfGame(game('pin', HARD, { step: { id: 'a' } as unknown as GameConfig['step'] }))).toEqual(USUAL);
    expect(rulesOfGame(game('pin', { ...HARD, format: 'timed' }, { step: { id: 'a' } as unknown as GameConfig['step'] }))).toEqual(USUAL);
  });

  it('are the usual ones in the games that are not of questions', () => {
    for (const mode of ['regionle', 'border', 'learn', 'nameall', 'travel', 'cards'] as Mode[]) expect(rulesOfGame(game(mode, { ...HARD, answer: 'type' })), mode).toEqual(USUAL);
  });

  it('are those of a plain game in what is always played plain', () => {
    // The clock asked for is of no account in a challenge, which has none; its tries and its hints are.
    expect(rulesOfGame(game('pin', { ...HARD, format: 'timed' }, { challenge: { seed: 1 } }))).toEqual({ ...USUAL, tries: 1, hints: false });
    expect(rulesOfGame(game('pin', { ...HARD, format: 'lives' }, { only: ['ES-M'] }))).toEqual({ ...USUAL, tries: 1, hints: false });
  });

  it('never hand out the object of the usual ones', () => {
    const got = rulesOfGame(game('pin', {}, { review: true }));
    got.tries = 1;
    expect(USUAL_RULES.tries).toBe(3);
    expect(rulesOfGame(game('pin', {}, { review: true })).tries).toBe(3);
  });
});

describe('rules that are not the usual ones', () => {
  it('are told apart from them', () => {
    expect(customRules(USUAL)).toBe(false);
    expect(customRules({ ...USUAL, tries: 2 })).toBe(true);
    expect(customRules({ ...USUAL, hints: false })).toBe(true);
    expect(customRules({ ...USUAL, clock: 30 })).toBe(true);
    expect(customRules({ ...USUAL, lives: 1 })).toBe(true);
  });

  it('are told in a few words, and the usual ones in none', () => {
    expect(rulesText(USUAL)).toBe('');
    expect(rulesText({ ...USUAL, tries: 1 })).toBe('1 intento');
    expect(rulesText({ ...USUAL, tries: 2 })).toBe('2 intentos');
    expect(rulesText({ ...USUAL, hints: false })).toBe('sin pistas');
    expect(rulesText({ ...USUAL, tries: 1, hints: false })).toBe('1 intento, sin pistas');
    expect(rulesText({ ...USUAL, clock: 120 })).toBe('2 minutos');
    expect(rulesText({ ...USUAL, clock: 30 })).toBe('30 segundos');
    expect(rulesText({ ...USUAL, lives: 5 })).toBe('5 vidas');
    expect(rulesText({ ...USUAL, lives: 1 })).toBe('1 vida');
    expect(rulesText({ tries: 2, hints: false, clock: 300, lives: 1 })).toBe('2 intentos, sin pistas, 5 minutos, 1 vida');
  });

  it('are told in English too', () => {
    setLang('en');
    expect(rulesText({ ...USUAL, tries: 1, hints: false })).toBe('1 try, no hints');
    expect(rulesText({ ...USUAL, tries: 2 })).toBe('2 tries');
    expect(rulesText({ ...USUAL, clock: 300 })).toBe('5 minutes');
    expect(rulesText({ ...USUAL, lives: 1 })).toBe('1 life');
    expect(rulesText({ ...USUAL, lives: 5 })).toBe('5 lives');
  });

  it('say how long the clock runs, in full and in short', () => {
    expect(CLOCKS.map(clockText)).toEqual(['30 segundos', 'un minuto', '2 minutos', '5 minutos']);
    expect(CLOCKS.map(clockShort)).toEqual(['30 s', '1 min', '2 min', '5 min']);
    setLang('en');
    expect(CLOCKS.map(clockText)).toEqual(['30 seconds', 'a minute', '2 minutes', '5 minutes']);
  });

  it('count tries and lives in the singular and in the plural', () => {
    expect(TRIES.map(triesText)).toEqual(['1 intento', '2 intentos', '3 intentos']);
    expect(LIVES.map(livesText)).toEqual(['1 vida', '3 vidas', '5 vidas']);
    setLang('en');
    expect(TRIES.map(triesText)).toEqual(['1 try', '2 tries', '3 tries']);
    expect(LIVES.map(livesText)).toEqual(['1 life', '3 lives', '5 lives']);
  });
});

describe('the records of the paced formats', () => {
  it('keep the name they always had for the usual rule', () => {
    expect(recordName('timed', USUAL)).toBe('timed');
    expect(recordName('lives', USUAL)).toBe('lives');
    // The rule of the other format is not theirs.
    expect(recordName('timed', { ...USUAL, lives: 5 })).toBe('timed');
    expect(recordName('lives', { ...USUAL, clock: 120 })).toBe('lives');
  });

  it('have a name of their own for each length of the clock and each number of lives', () => {
    expect(CLOCKS.map((clock) => recordName('timed', { ...USUAL, clock }))).toEqual(['timed30', 'timed', 'timed120', 'timed300']);
    expect(LIVES.map((lives) => recordName('lives', { ...USUAL, lives }))).toEqual(['lives1', 'lives', 'lives5']);
  });

  it('never share a name: no one is the beginning of another followed by a colon', () => {
    const names = [...CLOCKS.map((clock) => recordName('timed', { ...USUAL, clock })), ...LIVES.map((lives) => recordName('lives', { ...USUAL, lives }))];
    expect(new Set(names).size).toBe(names.length);
    for (const a of names) for (const b of names) if (a !== b) expect(`${b}:pin:x`.startsWith(`${a}:`), `${a} ${b}`).toBe(false);
  });
});

describe('the mark the rules leave in the name of a ghost', () => {
  it('is nothing for the usual ones', () => {
    expect(rulesMark(USUAL)).toBe('');
  });

  it('tells each set of rules from the others', () => {
    const marks = new Set<string>();
    let n = 0;
    for (const tries of TRIES) for (const hints of [true, false]) for (const clock of CLOCKS) for (const lives of LIVES) {
      marks.add(rulesMark({ tries, hints, clock, lives }));
      n++;
    }
    expect(marks.size).toBe(n);
    expect(rulesMark({ ...USUAL, tries: 1, hints: false })).toBe('t1h0');
  });
});

describe('the rules, where the options travel', () => {
  it('come back from a copy only if each is something that rule can be', () => {
    expect(cleanOpts({ tries: 1, hints: false, clock: 120, lives: 5 }, DEFAULT_OPTS)).toMatchObject({ tries: 1, hints: false, clock: 120, lives: 5 });
    expect(cleanOpts({ tries: 7, hints: 'no', clock: 45, lives: 2 }, DEFAULT_OPTS)).toMatchObject(USUAL);
    expect(cleanOpts({ tries: 2 }, { ...DEFAULT_OPTS, tries: 1, lives: 5 })).toMatchObject({ tries: 2, lives: 5 });
  });

  it('go in the address of a game inside another page, and nothing of them when they are the usual ones', () => {
    expect(writeOpts(DEFAULT_OPTS)).toBe('');
    const sent = writeOpts({ ...DEFAULT_OPTS, ...HARD } as Opts);
    expect(readOpts(sent)).toMatchObject({ tries: 1, hints: false });
    expect(readOpts('tries=1;hints=0;clock=120;lives=5')).toMatchObject({ tries: 1, hints: false, clock: 120, lives: 5 });
    expect(readOpts('tries=9;clock=61;lives=4;hints=2')).toMatchObject(USUAL);
  });

  it('go in that address only where the format goes by them: what was left set for another format is not named', () => {
    const all = { ...DEFAULT_OPTS, ...HARD } as Opts;
    expect(writeOpts(all).split(';').sort()).toEqual(['hints=0', 'tries=1']);
    expect(writeOpts({ ...all, format: 'timed' }).split(';').sort()).toEqual(['clock=120', 'format=timed']);
    expect(writeOpts({ ...all, format: 'lives' }).split(';').sort()).toEqual(['format=lives', 'lives=5']);
    expect(writeOpts({ ...all, format: 'exam' })).toBe('format=exam');
    // A game of two is played as a plain one inside another page: by its tries and its hints.
    expect(writeOpts({ ...all, format: 'duo' }).split(';').sort()).toEqual(['hints=0', 'tries=1']);
    // The usual rule of the format is not named either.
    expect(writeOpts({ ...all, format: 'timed', clock: 60 })).toBe('format=timed');
    // What comes back is the same game: the rules that were not named are the usual ones, and they did not count.
    for (const format of ['normal', 'timed', 'lives', 'exam'] as const) {
      const back = readOpts(writeOpts({ ...all, format }));
      expect(rulesOfGame({ mode: 'pin', opts: back }), format).toEqual(rulesOfGame({ mode: 'pin', opts: { ...all, format } }));
    }
  });

  it('go in a challenge sent by link: the tries and the hints, which are those of a plain game', () => {
    const sent = decodeChallenge(encodeChallenge(game('pin', { tries: 1, hints: false, clock: 120, lives: 5 })))!;
    expect(sent.opts).toMatchObject({ tries: 1, hints: false });
    expect(sent.opts.clock).toBeUndefined();
    expect(sent.opts.lives).toBeUndefined();
    expect(decodeChallenge(encodeChallenge(game('pin', { tries: 2 })))!.opts).toMatchObject({ tries: 2, hints: true });
    expect(decodeChallenge(encodeChallenge(game('pin', { hints: false })))!.opts).toMatchObject({ tries: 3, hints: false });
  });

  it('settle the rules of whoever opens a challenge: the usual ones when it says nothing', () => {
    const plain = decodeChallenge(encodeChallenge(game('pin')))!;
    expect(plain.opts).toMatchObject({ tries: 3, hints: true });
    // The receiver likes one try and no hints: the challenge is still played as it was sent.
    expect(rulesOfGame(game('pin', { ...HARD, ...plain.opts }, { challenge: { seed: plain.seed } }))).toEqual(USUAL);
  });

  it('leave a challenge with the usual rules as short as it always was', () => {
    const wire = (g: GameConfig) => JSON.parse(atob(encodeChallenge(g).replace(/-/g, '+').replace(/_/g, '/'))) as { o: unknown[] };
    expect(wire(game('pin')).o).toHaveLength(5);
    expect(wire(game('pin', { turned: true })).o).toHaveLength(7);
    expect(wire(game('pin', { tries: 1 })).o).toEqual(['type', 'all', 'name', 'top', 25, 0, 'plain', 1, 1]);
    expect(wire(game('pin', { hints: false, turned: true, flagLook: 'grey' })).o).toEqual(['type', 'all', 'name', 'top', 25, 1, 'grey', 3, 0]);
  });

  it('take from a challenge only tries that can be', () => {
    const code = (o: unknown[]) => btoa(JSON.stringify({ s: 'regions', m: 'pin', c: 'ES', k: 5, o, v: 2 }));
    expect(decodeChallenge(code(['type', 'all', 'name', 'top', 25, 0, 'plain', 9, 0]))!.opts).toMatchObject({ tries: 3, hints: false });
    expect(decodeChallenge(code(['type', 'all', 'name', 'top', 25, 0, 'plain', 2, 7]))!.opts).toMatchObject({ tries: 2, hints: true });
    expect(decodeChallenge(code(['type', 'all', 'name', 'top', 25, 0, 'plain', '1', '0']))!.opts).toMatchObject({ tries: 3, hints: true });
  });
});
