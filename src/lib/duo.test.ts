// @vitest-environment jsdom
/** «Dos jugadores»: whose turn each question is, what the answers add up to, who is ahead, and the two names. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DUO_KEY, NAME_MAX, POINTS, cleanName, defaultName, duoRule, keepNames, leader, namesKept, namesShown, otherOf, pointsOf, tally, verdictOf, whoOf, type Names } from './duo';
import { setLang } from './i18n';
import { formatName } from './modes';
import { evenOf } from './rules';
import type { Res } from './types';

const RES: Record<string, Res> = { o: 'ok', w: 'warn', b: 'bad' };
/** Answers in the order they were asked: `o` right at once, `w` right with help, `b` missed. */
const plays = (how: string): Res[] => [...how].map((c) => RES[c]);
const ANA_LUIS: Names = ['Ana', 'Luis'];

beforeEach(() => {
  localStorage.clear();
  setLang('es');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the turns of a game of two', () => {
  it('go from one player to the other, question by question', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => whoOf(i))).toEqual([0, 1, 0, 1, 0, 1]);
  });

  it('start with the second player when that one opens the game', () => {
    expect([0, 1, 2, 3].map((i) => whoOf(i, 1))).toEqual([1, 0, 1, 0]);
    expect([0, 1, 2, 3].map((i) => whoOf(i, 0))).toEqual([0, 1, 0, 1]);
  });

  it('have an other player for each', () => {
    expect(otherOf(0)).toBe(1);
    expect(otherOf(1)).toBe(0);
  });

  it('come in pairs: a game is dealt an even number of questions', () => {
    expect([0, 1, 2, 3, 10, 19, 20, 51].map(evenOf)).toEqual([0, 0, 2, 2, 10, 18, 20, 50]);
    expect(evenOf(-3)).toBe(0);
  });
});

describe('the score of a game of two', () => {
  it('gives two points for a first-time answer, one for an answer with help and none for a miss', () => {
    expect(POINTS).toEqual({ ok: 2, warn: 1, bad: 0 });
  });

  it('adds up what each player answered, in turns', () => {
    const score = tally(plays('owbo'));
    expect(score.of[0]).toEqual({ pts: 2, ok: 1, warn: 0, bad: 1, n: 2 });
    expect(score.of[1]).toEqual({ pts: 3, ok: 1, warn: 1, bad: 0, n: 2 });
    expect(score.rounds).toBe(2);
    expect(score.left).toBe(0);
  });

  it('gives the first answer to whoever opened the game', () => {
    const score = tally(plays('owbo'), 1);
    expect(score.of[1]).toEqual({ pts: 2, ok: 1, warn: 0, bad: 1, n: 2 });
    expect(score.of[0]).toEqual({ pts: 3, ok: 1, warn: 1, bad: 0, n: 2 });
  });

  it('counts every answer while the game is on, also the one the other has not matched yet', () => {
    const score = tally(plays('oow'));
    expect(score.of[0]).toMatchObject({ pts: 3, n: 2 });
    expect(score.of[1]).toMatchObject({ pts: 2, n: 1 });
    expect(score.rounds).toBe(1);
    expect(score.left).toBe(0);
  });

  it('is settled by whole rounds: an answer the other did not get to match is left out', () => {
    const score = tally(plays('oow'), 0, true);
    expect(score.of[0]).toEqual({ pts: 2, ok: 1, warn: 0, bad: 0, n: 1 });
    expect(score.of[1]).toEqual({ pts: 2, ok: 1, warn: 0, bad: 0, n: 1 });
    expect(score.rounds).toBe(1);
    expect(score.left).toBe(1);
    // With the second player opening, the answer left out is that player's.
    const other = tally(plays('oow'), 1, true);
    expect(other.of[1]).toMatchObject({ pts: 2, n: 1 });
    expect(other.left).toBe(1);
  });

  it('is the same either way when every round is whole', () => {
    expect(tally(plays('owbo'), 0, true)).toEqual(tally(plays('owbo')));
    expect(tally(plays('owbo'), 0, true).left).toBe(0);
  });

  it('is nothing for nobody before the first answer', () => {
    const score = tally([]);
    expect(score.of).toEqual([
      { pts: 0, ok: 0, warn: 0, bad: 0, n: 0 },
      { pts: 0, ok: 0, warn: 0, bad: 0, n: 0 },
    ]);
    expect(score.rounds).toBe(0);
    // One answer is not a round, and settled by whole rounds it does not count.
    expect(tally(plays('o'), 0, true).of[0].n).toBe(0);
    expect(tally(plays('o'), 0, true).left).toBe(1);
  });
});

describe('the format of a game of two', () => {
  it('has a name of its own among the formats, in either language', () => {
    expect((['normal', 'timed', 'lives', 'exam', 'duo'] as const).map(formatName)).toEqual(['Normal', 'Contrarreloj', 'Supervivencia', 'Examen', 'Dos jugadores']);
    setLang('en');
    expect((['normal', 'timed', 'lives', 'exam', 'duo'] as const).map(formatName)).toEqual(['Standard', 'Time attack', 'Survival', 'Exam', 'Two players']);
  });
});

describe('who is ahead', () => {
  it('is whoever has more points', () => {
    expect(leader(tally(plays('ob')))).toBe(0);
    expect(leader(tally(plays('bo')))).toBe(1);
    expect(leader(tally(plays('wo')))).toBe(1);
    expect(leader(tally(plays('ow')))).toBe(0);
  });

  it('is both when the points are the same, however they were made', () => {
    expect(leader(tally(plays('oo')))).toBe('tie');
    expect(leader(tally(plays('bb')))).toBe('tie');
    // Two with help are worth one at once.
    expect(leader(tally(plays('wowb')))).toBe('tie');
  });

  it('is nobody when nothing counts yet', () => {
    expect(leader(tally([]))).toBeNull();
    expect(leader(tally(plays('o'), 0, true))).toBeNull();
    // One answer counts while the game is on.
    expect(leader(tally(plays('o')))).toBe(0);
  });
});

describe('the name of a player', () => {
  it('is kept on one line, with its spaces in order', () => {
    expect(cleanName('  Ana  ')).toBe('Ana');
    expect(cleanName('Ana   María')).toBe('Ana María');
    expect(cleanName('Ana\nMari\t\u2028Paz')).toBe('Ana Mari Paz');
    expect(cleanName('\u0007Ana\u007f')).toBe('Ana');
  });

  it('is cut to what fits, by letters and not through the middle of one', () => {
    expect(cleanName('x'.repeat(40))).toBe('x'.repeat(NAME_MAX));
    // The spaces around a name are not letters of it: they take none of its room.
    expect(cleanName(`  ${'x'.repeat(NAME_MAX)}  `)).toBe('x'.repeat(NAME_MAX));
    expect(cleanName('Maximiliano José')).toBe('Maximiliano Jo');
    // A space left at the cut is not kept.
    expect(cleanName('Maria Antonia García')).toBe('Maria Antonia');
    const faces = '😀'.repeat(NAME_MAX + 3);
    expect(Array.from(cleanName(faces))).toHaveLength(NAME_MAX);
    expect(cleanName(faces)).toBe('😀'.repeat(NAME_MAX));
  });

  it('is nothing for what is not a text', () => {
    for (const x of [null, undefined, 7, {}, ['Ana'], true]) expect(cleanName(x), JSON.stringify(x)).toBe('');
    expect(cleanName('   ')).toBe('');
  });
});

describe('the names kept in the browser', () => {
  it('are none before any is given', () => {
    expect(namesKept()).toEqual(['', '']);
  });

  it('are kept as they are cleaned, under a key of their own, and read back', () => {
    // The key is what one version of the game leaves for the next: it does not change.
    expect(DUO_KEY).toBe('regionle:duo');
    expect(keepNames(['  Ana ', 'Luis\n'])).toEqual(['Ana', 'Luis']);
    expect(JSON.parse(localStorage.getItem(DUO_KEY)!)).toEqual(['Ana', 'Luis']);
    expect(namesKept()).toEqual(['Ana', 'Luis']);
    // One alone is kept in its place.
    keepNames(['', 'Luis']);
    expect(namesKept()).toEqual(['', 'Luis']);
    keepNames(['Ana', '']);
    expect(namesKept()).toEqual(['Ana', '']);
  });

  it('leave nothing behind when both are taken away', () => {
    keepNames(['Ana', 'Luis']);
    expect(keepNames(['', '  '])).toEqual(['', '']);
    expect(localStorage.getItem(DUO_KEY)).toBeNull();
  });

  it('are read with care: what is kept may be anything', () => {
    for (const kept of ['{', '"Ana"', '{"0":"Ana"}', 'null', '7']) {
      localStorage.setItem(DUO_KEY, kept);
      expect(namesKept(), kept).toEqual(['', '']);
    }
    localStorage.setItem(DUO_KEY, JSON.stringify(['  Ana  ', 7, 'x']));
    expect(namesKept()).toEqual(['Ana', '']);
    localStorage.setItem(DUO_KEY, JSON.stringify(['x'.repeat(50)]));
    expect(namesKept()).toEqual(['x'.repeat(NAME_MAX), '']);
  });

  it('are given back even where the browser keeps nothing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('no');
    });
    expect(keepNames(['Ana', 'Luis'])).toEqual(['Ana', 'Luis']);
    expect(keepNames(['', ''])).toEqual(['', '']);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('no');
    });
    expect(namesKept()).toEqual(['', '']);
  });
});

describe('what the two are called in a game', () => {
  it('is the name each gave', () => {
    expect(namesShown(['Ana', 'Luis'])).toEqual(['Ana', 'Luis']);
  });

  it('is «Jugador 1» and «Jugador 2» for whoever gave none, in the language of the game', () => {
    expect(namesShown(['', ''])).toEqual(['Jugador 1', 'Jugador 2']);
    expect(namesShown(['Ana', ''])).toEqual(['Ana', 'Jugador 2']);
    expect(namesShown(['', 'Luis'])).toEqual(['Jugador 1', 'Luis']);
    expect([defaultName(0), defaultName(1)]).toEqual(['Jugador 1', 'Jugador 2']);
    setLang('en');
    expect(namesShown(['', ''])).toEqual(['Player 1', 'Player 2']);
  });

  it('tells two of the same name apart by a number: a turn has to say whose it is', () => {
    expect(namesShown(['Ana', 'Ana'])).toEqual(['Ana 1', 'Ana 2']);
    expect(namesShown(['ana', 'ANA'])).toEqual(['ana 1', 'ANA 2']);
    // Someone who calls himself what the other is called for want of a name.
    expect(namesShown(['Jugador 2', ''])).toEqual(['Jugador 2 1', 'Jugador 2 2']);
    expect(namesShown(['Ana', 'Anna'])).toEqual(['Ana', 'Anna']);
  });
});

describe('how the points are said', () => {
  it('is in the singular for one alone', () => {
    expect([0, 1, 2, 11].map(pointsOf)).toEqual(['0 puntos', '1 punto', '2 puntos', '11 puntos']);
    setLang('en');
    expect([0, 1, 2].map(pointsOf)).toEqual(['0 points', '1 point', '2 points']);
  });

  it('is told by the rule with the figures the score is made with', () => {
    for (const lang of ['es', 'en'] as const) {
      setLang(lang);
      expect(duoRule()).toContain(`${POINTS.ok} `);
      expect(duoRule()).toMatch(new RegExp(`, ${POINTS.warn}\\.`));
    }
  });
});

describe('what the result of a game of two says first', () => {
  const said = (how: string, done = true, first: 0 | 1 = 0, names = ANA_LUIS) => verdictOf(names, tally(plays(how), first, true), done);

  it('is who wins, and by how much', () => {
    expect(said('oooooooowb')).toEqual({ title: 'Gana Ana', note: '9 puntos a 8.' });
    expect(said('bo')).toEqual({ title: 'Gana Luis', note: '2 puntos a 0.' });
    expect(said('bw')).toEqual({ title: 'Gana Luis', note: '1 punto a 0.' });
    // The one who opened the game is not the one who wins it.
    expect(said('bo', true, 1)).toEqual({ title: 'Gana Ana', note: '2 puntos a 0.' });
  });

  it('is a tie when both end with the same points', () => {
    expect(said('oowwbb')).toEqual({ title: 'Empate', note: 'Los dos acabáis con 3 puntos.' });
    expect(said('bb')).toEqual({ title: 'Empate', note: 'Los dos acabáis con 0 puntos.' });
    expect(said('wwbb').note).toBe('Los dos acabáis con 1 punto.');
  });

  it('is that the game was not finished, and who was ahead, when it was ended early', () => {
    expect(said('obow', false)).toEqual({ title: 'Partida sin terminar', note: 'Iba ganando Ana: 4 puntos a 1 tras 2 rondas.' });
    expect(said('bw', false)).toEqual({ title: 'Partida sin terminar', note: 'Iba ganando Luis: 1 punto a 0 tras 1 ronda.' });
    expect(said('oo', false)).toEqual({ title: 'Partida sin terminar', note: 'Ibais empatados a 2 puntos tras 1 ronda.' });
    // The answer the other did not get to match does not put anybody ahead.
    expect(said('ooo', false).note).toBe('Ibais empatados a 2 puntos tras 1 ronda.');
  });

  it('is that no round was completed when nothing counts', () => {
    expect(said('', false)).toEqual({ title: 'Partida sin terminar', note: 'No se ha completado ninguna ronda.' });
    expect(said('o', false)).toEqual({ title: 'Partida sin terminar', note: 'No se ha completado ninguna ronda.' });
    // A game with no questions has nobody to win it either.
    expect(said('', true).title).toBe('Partida sin terminar');
  });

  it('is said in English on the page of that language', () => {
    setLang('en');
    expect(said('oooooooowb')).toEqual({ title: 'Ana wins', note: '9 points to 8.' });
    expect(said('oo')).toEqual({ title: 'A tie', note: 'You both end with 2 points.' });
    expect(said('obow', false)).toEqual({ title: 'Unfinished game', note: 'Ana was ahead: 4 points to 1 after 2 rounds.' });
    expect(said('oo', false)).toEqual({ title: 'Unfinished game', note: 'You were level on 2 points after 1 round.' });
    expect(said('', false)).toEqual({ title: 'Unfinished game', note: 'No round was completed.' });
  });
});
