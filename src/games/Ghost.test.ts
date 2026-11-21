// @vitest-environment jsdom
/**
 * «Contra tu fantasma», as the game of questions uses it: which ghost a game is played against, what becomes
 * of it when the game ends, and what is drawn of all that.
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ghostFrom, ghostKey, runOf, sumOf, type Ghost, type Trace } from '../lib/ghost';
import { clearGhosts, ghostOf, ghostsKept, keepGhost, setGhosts } from '../lib/ghostKept';
import { GHOSTS_KEY } from '../lib/ghostLazy';
import { setLang } from '../lib/i18n';
import { DEFAULT_OPTS, type GameConfig } from '../lib/store';
import type { Res } from '../lib/types';
import { GhostBox, GhostOffer, GhostTrack, rivalOf, settle, type GhostEnd, type Race } from './Ghost';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Game = Omit<GameConfig, 'nonce'>;
const CFG: Game = { section: 'regions', mode: 'pin', countries: ['ES'], levels: { ES: 'g1' }, opts: { ...DEFAULT_OPTS, length: 10 } };
const country = () => undefined;
const KEY = ghostKey(CFG, country)!;

/** A map of ten pieces: each seed deals them in an order of its own. */
const dealt = (seed: number): string[] => Array.from({ length: 10 }, (_, i) => `p${(i * 7 + seed) % 10}`);
const race = (seed: number, patch: Partial<Game> = {}): Race => ({ cfg: { ...CFG, ...patch }, country, seed, dealt });
/** A game against the ghost dealt by that seed. */
const against = (seed: number): Race => race(seed, { ghost: { seed } });

const RES: Record<string, Res> = { o: 'ok', w: 'warn', b: 'bad' };
/** What a game writes down: an answer every `step` ms, each as it is said to have gone. */
const traceOf = (how: string, step = 2000): Trace => [...how].map((c, i) => [(i + 1) * step, RES[c]] as const);
/** The ghost of a game dealt by `seed`, a second longer than its answers took. */
const ghostOfGame = (seed: number, how: string, step = 2000, t = NOON): Ghost => ghostFrom(seed, dealt(seed), traceOf(how, step), how.length * step + 1000, t)!;

/** Noon of 15 November 2026, wherever the tests are run. */
const NOON = new Date(2026, 10, 15, 12).getTime();
const DAY = 86_400_000;

const EIGHT = 'oooooooowb';
const TEN = 'oooooooooo';

beforeEach(() => {
  localStorage.clear();
  clearGhosts();
  setLang('es');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the ghost a game is played against', () => {
  it('is the one kept for it, when the game was dealt its questions', () => {
    const ghost = ghostOfGame(7, EIGHT);
    keepGhost(KEY, ghost);
    expect(rivalOf(against(7))).toEqual(ghost);
  });

  it('is none for a game that is not against one', () => {
    keepGhost(KEY, ghostOfGame(7, EIGHT));
    expect(rivalOf(race(7))).toBeNull();
    // …nor for a game that has no ghost at all, whatever it says.
    expect(rivalOf(race(7, { ghost: { seed: 7 }, challenge: { seed: 7 } }))).toBeNull();
    expect(rivalOf(race(7, { ghost: { seed: 7 }, opts: { ...DEFAULT_OPTS, length: 10, format: 'exam' } }))).toBeNull();
  });

  it('is none when no ghost is kept any more, or the one that is kept is another', () => {
    expect(rivalOf(against(7))).toBeNull();
    keepGhost(KEY, ghostOfGame(8, TEN));
    expect(rivalOf(against(7))).toBeNull();
    expect(rivalOf(against(8))).not.toBeNull();
    // The ghost of another game on the same map is not this one's.
    expect(rivalOf({ ...against(8), cfg: { ...CFG, mode: 'identify', ghost: { seed: 8 } } })).toBeNull();
  });

  it('is none when the map no longer deals to its seed the questions it answered', () => {
    keepGhost(KEY, { ...ghostOfGame(7, EIGHT), h: sumOf(['other', 'questions']) });
    expect(rivalOf(against(7))).toBeNull();
    // The same questions, and one more: a map that has grown.
    setGhosts([[KEY, ghostOfGame(7, EIGHT)]]);
    expect(rivalOf({ ...against(7), dealt: (k) => [...dealt(k), 'new'] })).toBeNull();
    expect(rivalOf(against(7))).not.toBeNull();
  });
});

describe('a game that ends without a ghost alongside', () => {
  it('is the first ghost of its map when it is played to the end', () => {
    const end = settle(race(7), traceOf(EIGHT), 21_400, null, NOON)!;
    expect(end).toMatchObject({ how: 'first', other: null, now: 'mine', seed: 7, when: NOON });
    expect(end.mine).toMatchObject({ score: 85, ok: 8, warn: 1, bad: 1, ms: 21_400 });
    expect(ghostOf(KEY)).toEqual({ k: 7, h: sumOf(dealt(7)), t: NOON, q: [60, 60, 60, 60, 60, 60, 60, 60, 61, 62], d: 214 });
    expect(JSON.parse(localStorage.getItem(GHOSTS_KEY)!)).toEqual(ghostsKept());
  });

  it('says nothing and leaves nothing when it is left before the end and there is no ghost', () => {
    expect(settle(race(7), traceOf('ooo'), 9000, null, NOON)).toBeNull();
    expect(settle(race(7), [], 0, null, NOON)).toBeNull();
    expect(ghostsKept()).toEqual([]);
    expect(localStorage.getItem(GHOSTS_KEY)).toBeNull();
  });

  it('says nothing and leaves nothing when it is a game that has no ghost', () => {
    for (const patch of [{ challenge: { seed: 7 } }, { review: true }, { mode: 'cards' as const }, { opts: { ...DEFAULT_OPTS, format: 'timed' as const } }]) {
      expect(settle(race(7, patch), traceOf(TEN), 20_000, null, NOON)).toBeNull();
    }
    expect(ghostsKept()).toEqual([]);
  });

  it('takes the place of the ghost there was when it is the better game', () => {
    const old = ghostOfGame(7, EIGHT, 2000, NOON - DAY);
    keepGhost(KEY, old);
    const end = settle(race(9), traceOf(TEN, 3000), 31_000, null, NOON)!;
    expect(end).toMatchObject({ how: 'better', now: 'mine', seed: 9, when: NOON - DAY });
    expect(end.mine).toMatchObject({ score: 100, ms: 31_000 });
    expect(end.other).toEqual(runOf(old));
    expect(ghostOf(KEY)).toMatchObject({ k: 9, t: NOON, d: 310 });
    // The same score in less time is better too, by the second.
    const faster = settle(race(11), traceOf(TEN, 2900), 30_000, null, NOON + 5)!;
    expect(faster).toMatchObject({ how: 'better', now: 'mine', seed: 11 });
  });

  it('leaves the ghost there was when it is no better, and says which one it is', () => {
    const old = ghostOfGame(7, TEN, 2000, NOON - DAY);
    keepGhost(KEY, old);
    for (const [how, ms] of [[EIGHT, 5000], [TEN, 21_000], [TEN, 21_900], [TEN, 60_000]] as const) {
      const end = settle(race(9), traceOf(how, 400), ms, null, NOON)!;
      expect(end, `${how} in ${ms}`).toMatchObject({ how: 'kept', now: 'other', seed: 7, when: NOON - DAY });
      expect(end.mine?.ms).toBe(ms);
      expect(end.other).toEqual(runOf(old));
    }
    expect(ghostOf(KEY)).toEqual(old);
  });

  it('tells of the ghost there is when it is left before the end', () => {
    const old = ghostOfGame(7, EIGHT, 2000, NOON - DAY);
    keepGhost(KEY, old);
    expect(settle(race(9), traceOf('oo'), 5000, null, NOON)).toEqual({ how: 'kept', mine: null, other: runOf(old), when: NOON - DAY, now: 'other', seed: 7 });
    expect(ghostOf(KEY)).toEqual(old);
  });

  it('does not say which game is the ghost when another tab has changed it meanwhile', () => {
    const old = ghostOfGame(7, EIGHT, 2000, NOON - DAY);
    keepGhost(KEY, old);
    // Written by another tab, whose word has not come yet: a better ghost than the one this page knows of.
    const elsewhere = ghostOfGame(12, TEN, 1000, NOON - 5);
    localStorage.setItem(GHOSTS_KEY, JSON.stringify([[KEY, elsewhere]]));
    expect(settle(race(9), traceOf(TEN, 3000), 31_000, null, NOON)).toMatchObject({ how: 'kept', now: null, seed: 12 });
    expect(ghostOf(KEY)).toEqual(elsewhere);
    // …or has deleted them all, and the game here was left before its end: there is none.
    localStorage.removeItem(GHOSTS_KEY);
    expect(settle(race(9), traceOf('oo'), 5000, null, NOON)).toMatchObject({ how: 'kept', mine: null, now: null, seed: null });
    expect(ghostOf(KEY)).toBeNull();
  });

  it('drops a ghost of questions the map no longer deals, and takes its place if it is played to the end', () => {
    const stale = { ...ghostOfGame(7, TEN), h: 12345 };
    setGhosts([[KEY, stale]]);
    // Left before the end: the ghost that cannot be played against goes, and nothing is said.
    expect(settle(race(9), traceOf('oo'), 5000, null, NOON)).toBeNull();
    expect(ghostsKept()).toEqual([]);
    // Played to the end, however badly: it is the first ghost of the map as it is now.
    setGhosts([[KEY, stale]]);
    expect(settle(race(9), traceOf('bbbbbbbbbb'), 25_000, null, NOON)).toMatchObject({ how: 'first', now: 'mine', seed: 9, other: null });
    expect(ghostOf(KEY)).toMatchObject({ k: 9, h: sumOf(dealt(9)) });
  });
});

describe('a game that ends against its ghost', () => {
  const rival = ghostOfGame(7, EIGHT, 2000, NOON - DAY);
  beforeEach(() => {
    keepGhost(KEY, rival);
  });

  it('wins with a higher score, and is the ghost from then on', () => {
    const end = settle(against(7), traceOf(TEN, 5000), 51_000, rival, NOON)!;
    expect(end).toMatchObject({ how: 'won', now: 'mine', seed: 7, when: NOON - DAY });
    expect(end.mine).toMatchObject({ score: 100, ms: 51_000 });
    expect(end.other).toEqual(runOf(rival));
    expect(ghostOf(KEY)).toMatchObject({ k: 7, t: NOON, d: 510 });
  });

  it('wins with the same score in less time, by the second', () => {
    expect(settle(against(7), traceOf(EIGHT, 1900), 20_999, rival, NOON)).toMatchObject({ how: 'won', now: 'mine' });
  });

  it('ties with the same score in the same second, and the ghost stays', () => {
    expect(settle(against(7), traceOf(EIGHT, 1900), 21_999, rival, NOON)).toMatchObject({ how: 'tie', now: 'other', seed: 7 });
    expect(settle(against(7), traceOf(EIGHT, 1900), 21_000, rival, NOON)).toMatchObject({ how: 'tie', now: 'other' });
    expect(ghostOf(KEY)).toEqual(rival);
  });

  it('tells which game is the ghost by the game and not by its figures', () => {
    // The same questions, the same time and the same moment as the ghost: a tie, and the ghost is still the other one.
    expect(settle(against(7), traceOf(EIGHT, 2000), 21_000, rival, rival.t)).toMatchObject({ how: 'tie', now: 'other', seed: 7 });
    expect(settle(against(7), traceOf('oooooooobb', 2000), 21_000, rival, rival.t)).toMatchObject({ how: 'lost', now: 'other' });
    // …and a game without the ghost alongside that is no better is not said to have taken its place.
    expect(settle(race(7), traceOf(EIGHT, 2000), 21_000, null, rival.t)).toMatchObject({ how: 'kept', now: 'other' });
    expect(ghostOf(KEY)).toEqual(rival);
  });

  it('loses with a lower score however fast, or with the same score in more time', () => {
    expect(settle(against(7), traceOf('oooooooobb', 100), 2000, rival, NOON)).toMatchObject({ how: 'lost', now: 'other', seed: 7 });
    expect(settle(against(7), traceOf(EIGHT, 2000), 22_000, rival, NOON)).toMatchObject({ how: 'lost', now: 'other' });
    expect(ghostOf(KEY)).toEqual(rival);
  });

  it('does not count when it is left before the end', () => {
    expect(settle(against(7), traceOf('ooooo'), 11_000, rival, NOON)).toEqual({ how: 'left', mine: null, other: runOf(rival), when: NOON - DAY, now: 'other', seed: 7 });
    expect(settle(against(7), [], 0, rival, NOON)).toMatchObject({ how: 'left', mine: null });
    expect(ghostOf(KEY)).toEqual(rival);
  });

  it('is judged against the ghost it was played against, even if another tab has kept another since', () => {
    const elsewhere = ghostOfGame(12, TEN, 1000, NOON - 5);
    setGhosts([[KEY, elsewhere]]);
    // Better than the ghost it raced, and no better than the one the map has now.
    const end = settle(against(7), traceOf(TEN, 5000), 51_000, rival, NOON)!;
    expect(end).toMatchObject({ how: 'won', now: null, seed: 12 });
    expect(ghostOf(KEY)).toEqual(elsewhere);
    // …and when it loses, the ghost is not said to be still the one it raced.
    expect(settle(against(7), traceOf('bbbbbbbbbb'), 9000, rival, NOON)).toMatchObject({ how: 'lost', now: null, seed: 12 });
    // With no ghost left at all (the progress was deleted meanwhile), the game is the ghost.
    clearGhosts();
    expect(settle(against(7), traceOf('bbbbbbbbbb'), 9000, rival, NOON)).toMatchObject({ how: 'lost', now: 'mine', seed: 7 });
    // …unless it was left before the end: then there is none, and nothing is said of which one it is.
    clearGhosts();
    expect(settle(against(7), traceOf('ooooo'), 11_000, rival, NOON)).toMatchObject({ how: 'left', mine: null, now: null, seed: null });
    expect(ghostOf(KEY)).toBeNull();
  });
});

describe('what is drawn', () => {
  let box: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    box = document.createElement('div');
    document.body.append(box);
    root = createRoot(box);
  });
  afterEach(() => {
    act(() => root.unmount());
    box.remove();
  });
  const draw = (what: Parameters<Root['render']>[0]) => act(() => root.render(what));
  const text = (sel: string): string => (box.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const texts = (sel: string): string[] => [...box.querySelectorAll(sel)].map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim());
  /** The stretches of a lane, as letters: o, w, b and a dot for what is still to come, each with how many questions it is. */
  const lane = (el: Element): string => [...el.querySelectorAll('.ghost-bar i')].map((i) => `${{ ok: 'o', warn: 'w', bad: 'b', todo: '.' }[i.className]}${(i as HTMLElement).style.flexGrow}`).join(' ');
  const button = (label: string): HTMLButtonElement => [...box.querySelectorAll('button')].find((b) => b.textContent === label)!;

  describe('under the header of a game against its ghost', () => {
    const rival = ghostOfGame(7, EIGHT, 2000);

    it('is a lane for each: how every question went, and how far each has got by the clock of the game', () => {
      draw(createElement(GhostTrack, { rival, trace: traceOf('owb', 1000), total: 10, ms: 8500 }));
      const lanes = [...box.querySelectorAll('.ghost-lane')];
      expect(lanes).toHaveLength(2);
      expect(text('.ghost-lane:not(.it) .ghost-who')).toBe('Tú');
      expect(text('.ghost-lane.it .ghost-who')).toBe('Fantasma');
      expect(texts('.ghost-n')).toEqual(['3 / 10', '4 / 10']);
      expect(lane(lanes[0])).toBe('o1 w1 b1 .7');
      expect(lane(lanes[1])).toBe('o4 .6');
      expect(box.querySelector('.ghost-lanes')!.getAttribute('aria-label')).toBe('Tú: 3 de 10 preguntas, 1 a la primera. Tu fantasma: 4 de 10, 4 a la primera.');
    });

    it('moves the ghost with the clock, and stops it at its last answer', () => {
      const at = (ms: number): string => {
        draw(createElement(GhostTrack, { rival, trace: [], total: 10, ms }));
        return `${texts('.ghost-n')[1]} · ${lane(box.querySelector('.ghost-lane.it')!)}`;
      };
      expect(at(0)).toBe('0 / 10 · .10');
      expect(at(1999)).toBe('0 / 10 · .10');
      expect(at(2000)).toBe('1 / 10 · o1 .9');
      expect(at(17_999)).toBe('8 / 10 · o8 .2');
      expect(at(18_000)).toBe('9 / 10 · o8 w1 .1');
      expect(at(20_000)).toBe('10 / 10 · o8 w1 b1');
      expect(at(999_000)).toBe('10 / 10 · o8 w1 b1');
    });

    it('tells one question from the next while they are few, and runs them together when they are many', () => {
      draw(createElement(GhostTrack, { rival, trace: [], total: 10, ms: 0 }));
      expect(box.querySelectorAll('.ghost-bar.few')).toHaveLength(2);
      expect((box.querySelector('.ghost-bar') as HTMLElement).style.getPropertyValue('--n')).toBe('10');
      const long = ghostFrom(7, Array(41).fill('x'), traceOf('o'.repeat(41), 100), 5000, NOON)!;
      draw(createElement(GhostTrack, { rival: long, trace: [], total: 41, ms: 0 }));
      expect(box.querySelectorAll('.ghost-bar.few')).toHaveLength(0);
      const forty = ghostFrom(7, Array(40).fill('x'), traceOf('o'.repeat(40), 100), 5000, NOON)!;
      draw(createElement(GhostTrack, { rival: forty, trace: [], total: 40, ms: 0 }));
      expect(box.querySelectorAll('.ghost-bar.few')).toHaveLength(2);
    });

    it('says so when there is no ghost to play against after all', () => {
      draw(createElement(GhostTrack, { rival: null, trace: traceOf('oo'), total: 10, ms: 5000 }));
      expect(box.querySelector('.ghost-lanes')).toBeNull();
      expect(text('.ghost-none')).toBe('Ya no se puede jugar contra ese fantasma: esta partida va sin él.');
    });

    it('speaks English too', () => {
      setLang('en');
      draw(createElement(GhostTrack, { rival, trace: traceOf('ow', 1000), total: 10, ms: 2000 }));
      expect(texts('.ghost-who')).toEqual(['You', 'Ghost']);
      expect(box.querySelector('.ghost-lanes')!.getAttribute('aria-label')).toBe('You: 2 of 10 questions, 1 right first time. Your ghost: 1 of 10, 1 right first time.');
      draw(createElement(GhostTrack, { rival: null, trace: [], total: 10, ms: 0 }));
      expect(text('.ghost-none')).toBe('That ghost can no longer be played against: this game goes without one.');
    });
  });

  describe('in the results', () => {
    const mine = runOf(ghostOfGame(7, TEN, 3000));
    const other = runOf(ghostOfGame(7, EIGHT, 2000));
    const onRace = vi.fn<(seed: number) => void>();
    const onPlain = vi.fn<() => void>();
    const box_ = (end: GhostEnd, racing: boolean, now = NOON) => draw(createElement(GhostBox, { end, racing, onRace, onPlain, now }));
    beforeEach(() => {
      onRace.mockClear();
      onPlain.mockClear();
    });

    it('sets the two games side by side after a game against the ghost, and marks the better one', () => {
      box_({ how: 'won', mine, other, when: NOON - DAY, now: 'mine', seed: 7 }, true);
      expect(box.querySelector('section.ghost-box')!.getAttribute('data-how')).toBe('won');
      expect(texts('.duel-vs dt')).toEqual(['Tú', 'Tu fantasma']);
      expect(texts('.duel-vs dd')).toEqual(['100 % 0:31', '85 % 0:21']);
      expect(texts('.duel-vs dl > div.best dt')).toEqual(['Tú']);
      expect(text('.ghost-say')).toBe('Esta partida pasa a ser tu fantasma aquí.');
      // The whole of both games, question by question.
      expect(texts('.ghost-box .ghost-n')).toEqual(['10 / 10', '10 / 10']);
      expect([...box.querySelectorAll('.ghost-box .ghost-lane')].map(lane)).toEqual(['o10', 'o8 w1 b1']);
      expect(box.querySelector('.ghost-box .ghost-lanes')!.getAttribute('aria-label')).toBe(
        'Pregunta a pregunta. Tú: 10 a la primera, 0 con ayuda y 0 fallos. Tu fantasma: 8 a la primera, 1 con ayuda y 1 fallos.',
      );
      expect(text('.duel-how')).toBe('Gana quien saca más porcentaje y, con el mismo, quien tarda menos.');

      box_({ how: 'lost', mine: other, other: mine, when: NOON - DAY, now: 'other', seed: 7 }, true);
      expect(texts('.duel-vs dl > div.best dt')).toEqual(['Tu fantasma']);
      expect(text('.ghost-say')).toBe('Tu fantasma sigue siendo tu partida de ayer.');

      box_({ how: 'tie', mine, other: mine, when: NOON - DAY, now: 'other', seed: 7 }, true);
      expect(box.querySelectorAll('.duel-vs dl > div.best')).toHaveLength(0);
      expect(text('.ghost-say')).toBe('Tu fantasma sigue siendo tu partida de ayer.');
    });

    it('never breaks a percentage from its sign', () => {
      box_({ how: 'won', mine, other, when: NOON, now: 'mine', seed: 7 }, true);
      expect(box.querySelector('.duel-vs dd')!.textContent).toContain('100\u00a0%');
    });

    it('says nothing of what the ghost is now when it is neither of the two', () => {
      box_({ how: 'won', mine, other, when: NOON - DAY, now: null, seed: 12 }, true);
      expect(box.querySelector('.ghost-say')).toBeNull();
      expect(texts('.duel-vs dd')).toEqual(['100 % 0:31', '85 % 0:21']);
    });

    it('offers a game without the ghost after one against it', () => {
      box_({ how: 'lost', mine: other, other: mine, when: NOON, now: 'other', seed: 7 }, true);
      expect(texts('.ghost-go button')).toEqual(['Jugar sin fantasma']);
      act(() => button('Jugar sin fantasma').click());
      expect(onPlain).toHaveBeenCalledTimes(1);
      expect(onRace).not.toHaveBeenCalled();
    });

    it('says a game left before the end does not count', () => {
      box_({ how: 'left', mine: null, other, when: NOON - 3 * DAY, now: 'other', seed: 7 }, true);
      expect(box.querySelector('.duel-vs')).toBeNull();
      expect(text('.ghost-say')).toBe('Has dejado la partida antes del final, así que no cuenta: tu fantasma sigue siendo tu partida del 12 de noviembre, con 85 % en 0:21.');
      box_({ how: 'left', mine: null, other, when: NOON - DAY, now: null, seed: 12 }, true);
      expect(text('.ghost-say')).toBe('Has dejado la partida antes del final, así que no cuenta.');
    });

    it('tells a game without a ghost alongside what its map has now, and offers the game against it', () => {
      box_({ how: 'first', mine, other: null, when: NOON, now: 'mine', seed: 7 }, false);
      expect(box.querySelector('.duel-vs')).toBeNull();
      expect(text('.ghost-head')).toBe('Tu fantasma');
      expect(text('.ghost-say')).toBe('Esta partida queda como tu fantasma aquí: 100 % en 0:31.');
      expect(texts('.ghost-go button')).toEqual(['Contra tu fantasma']);
      expect(text('.duel-how')).toBe('Contra tu fantasma juegas sus mismas preguntas, en el mismo orden, y lo ves avanzar a tu lado. Gana quien saca más porcentaje y, con el mismo, quien tarda menos.');
      act(() => button('Contra tu fantasma').click());
      expect(onRace).toHaveBeenCalledWith(7);
      expect(onPlain).not.toHaveBeenCalled();

      box_({ how: 'better', mine, other, when: NOON - DAY, now: 'mine', seed: 9 }, false);
      expect(text('.ghost-say')).toBe('Has mejorado tu fantasma, que era 85 % en 0:21: ahora lo es esta partida, con 100 % en 0:31.');
      act(() => button('Contra tu fantasma').click());
      expect(onRace).toHaveBeenLastCalledWith(9);

      box_({ how: 'kept', mine: other, other: mine, when: NOON, now: 'other', seed: 4 }, false);
      expect(text('.ghost-say')).toBe('Tu fantasma aquí es tu partida de hoy: 100 % en 0:31.');
      box_({ how: 'kept', mine: null, other: mine, when: NOON - 400 * DAY, now: 'other', seed: 4 }, false);
      expect(text('.ghost-say')).toBe('Tu fantasma aquí es tu partida del 11 de octubre de 2025: 100 % en 0:31.');
      act(() => button('Contra tu fantasma').click());
      expect(onRace).toHaveBeenLastCalledWith(4);
    });

    it('offers no game against a ghost that is not there', () => {
      box_({ how: 'kept', mine: null, other, when: NOON, now: 'other', seed: null }, false);
      expect(box.querySelectorAll('.ghost-go button')).toHaveLength(0);
    });

    it('does not call the ghost of the map a game that is no longer it', () => {
      box_({ how: 'kept', mine: other, other: mine, when: NOON, now: null, seed: 12 }, false);
      expect(box.querySelector('.ghost-say')).toBeNull();
      // The one the map has now can be played against all the same.
      act(() => button('Contra tu fantasma').click());
      expect(onRace).toHaveBeenLastCalledWith(12);
    });

    it('speaks English too', () => {
      setLang('en');
      box_({ how: 'lost', mine: other, other: mine, when: NOON - DAY, now: 'other', seed: 7 }, true);
      expect(text('.ghost-head')).toBe('Your ghost');
      expect(texts('.duel-vs dt')).toEqual(['You', 'Your ghost']);
      expect(texts('.duel-vs dd')).toEqual(['85% 0:21', '100% 0:31']);
      expect(text('.ghost-say')).toBe('Your ghost is still your game from yesterday.');
      expect(texts('.ghost-go button')).toEqual(['Play without the ghost']);
      expect(text('.duel-how')).toBe('The higher percentage wins and, with the same one, the shorter time.');
      box_({ how: 'kept', mine: null, other: mine, when: NOON - 3 * DAY, now: 'other', seed: 4 }, false);
      expect(text('.ghost-say')).toBe('Your ghost here is your game of 12 November: 100% in 0:31.');
      expect(texts('.ghost-go button')).toEqual(['Against your ghost']);
    });
  });

  describe('on the setup', () => {
    const onPlay = vi.fn<(seed: number) => void>();
    const offer = (cfg: Game = CFG) => draw(createElement(GhostOffer, { cfg, country, onPlay }));
    beforeEach(() => onPlay.mockClear());

    it('shows the ghost of the game that is chosen, and starts the game against it', () => {
      keepGhost(KEY, ghostOfGame(7, EIGHT, 2000, NOON - 3 * DAY));
      offer();
      expect(text('.ghost-offer p')).toBe('Tu fantasma aquí: 85 % en 0:21 · 12 nov');
      act(() => button('Contra tu fantasma').click());
      expect(onPlay).toHaveBeenCalledWith(7);
    });

    it('shows nothing for a game that has no ghost kept, or cannot have one', () => {
      offer();
      expect(box.innerHTML).toBe('');
      act(() => void keepGhost(KEY, ghostOfGame(7, EIGHT)));
      offer({ ...CFG, mode: 'identify' });
      expect(box.innerHTML).toBe('');
      offer({ ...CFG, opts: { ...CFG.opts, length: 20 } });
      expect(box.innerHTML).toBe('');
      offer({ ...CFG, opts: { ...CFG.opts, format: 'exam' } });
      expect(box.innerHTML).toBe('');
      offer();
      expect(box.querySelector('.ghost-offer')).not.toBeNull();
    });

    it('follows what becomes of the ghost while it is on screen', () => {
      offer();
      expect(box.innerHTML).toBe('');
      act(() => void keepGhost(KEY, ghostOfGame(7, EIGHT)));
      expect(text('.ghost-offer b')).toBe('85 %');
      act(() => void keepGhost(KEY, ghostOfGame(9, TEN)));
      expect(text('.ghost-offer b')).toBe('100 %');
      act(() => button('Contra tu fantasma').click());
      expect(onPlay).toHaveBeenCalledWith(9);
      act(() => clearGhosts());
      expect(box.innerHTML).toBe('');
    });

    it('speaks English too', () => {
      setLang('en');
      keepGhost(KEY, ghostOfGame(7, EIGHT, 2000, NOON - 3 * DAY));
      offer();
      expect(text('.ghost-offer p')).toBe('Your ghost here: 85% in 0:21 · 12 Nov');
      expect(texts('.ghost-offer button')).toEqual(['Against your ghost']);
    });
  });
});
