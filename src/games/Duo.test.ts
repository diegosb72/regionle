// @vitest-environment jsdom
/**
 * «Dos jugadores» as it is seen: the two lines for the names where the game is set up, the scoreboard under
 * the header of the game, whose turn the question is, what an answer adds, and the result.
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DUO_KEY, NAME_MAX, namesKept, tally, type Names, type Who } from '../lib/duo';
import { setLang } from '../lib/i18n';
import type { Item, Res } from '../lib/types';
import type { ResultRow } from './common';
import { DuoBoard, DuoGain, DuoNames, DuoResults, DuoTurn } from './Duo';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NAMES: Names = ['Ana', 'Luis'];
const RES: Record<string, Res> = { o: 'ok', w: 'warn', b: 'bad' };
const SPAIN = { id: 'ES', fl: 'es', n: { es: 'España', en: 'Spain' } };
const piece = (id: string, patch: Partial<Item> = {}): Item => ({ id, kind: 'unit', name: `Pieza ${id}`, country: SPAIN, ...patch }) as unknown as Item;
/** The answers of a game in the order they were asked: `o` right at once, `w` right with help, `b` missed. */
const rowsOf = (how: string): ResultRow[] => [...how].map((c, i) => ({ item: piece(`p${i + 1}`), res: RES[c] }));
const scoreOf = (how: string, first: Who = 0) => tally([...how].map((c) => RES[c]), first);

let box: HTMLDivElement;
let root: Root;
const draw = (what: Parameters<Root['render']>[0]) => act(() => root.render(what));
const text = (sel: string): string => (box.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
const texts = (sel: string): string[] => [...box.querySelectorAll(sel)].map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim());
const button = (name: string): HTMLButtonElement => [...box.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === name)!;

beforeEach(() => {
  localStorage.clear();
  setLang('es');
  box = document.createElement('div');
  document.body.append(box);
  root = createRoot(box);
});

afterEach(() => {
  act(() => root.unmount());
  box.remove();
  vi.restoreAllMocks();
});

describe('the names on the setup', () => {
  /** What a person does to a line: the text goes in, and the page is told. */
  const write = (input: HTMLInputElement, value: string) =>
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  const lines = () => [...box.querySelectorAll<HTMLInputElement>('.duo-names input')];

  it('are two lines, one for each player, empty until a name is given', () => {
    draw(createElement(DuoNames));
    expect(texts('.duo-names label > span')).toEqual(['Jugador 1', 'Jugador 2']);
    expect(lines().map((i) => i.value)).toEqual(['', '']);
    expect(lines().map((i) => i.placeholder)).toEqual(['Nombre (opcional)', 'Nombre (opcional)']);
    expect(lines().map((i) => i.maxLength)).toEqual([NAME_MAX, NAME_MAX]);
    expect(box.querySelector('.duo-names')!.getAttribute('aria-label')).toBe('Quién juega');
    // Each line is of its player: the first is the disc and the second the square.
    expect([...box.querySelectorAll('.duo-names label')].map((l) => l.className)).toEqual(['p0', 'p1']);
  });

  it('bring the names kept from the last time', () => {
    localStorage.setItem(DUO_KEY, JSON.stringify(['Ana', 'Luis']));
    draw(createElement(DuoNames));
    expect(lines().map((i) => i.value)).toEqual(['Ana', 'Luis']);
  });

  it('keep each name as it is written, the other one staying as it was', () => {
    draw(createElement(DuoNames));
    write(lines()[0], 'Ana');
    expect(namesKept()).toEqual(['Ana', '']);
    write(lines()[1], 'Luis');
    expect(namesKept()).toEqual(['Ana', 'Luis']);
    expect(lines().map((i) => i.value)).toEqual(['Ana', 'Luis']);
    write(lines()[0], 'Eva');
    expect(namesKept()).toEqual(['Eva', 'Luis']);
  });

  it('show what is being written as it is, and keep it cleaned', () => {
    draw(createElement(DuoNames));
    // A space at the end is the middle of a name that is still being written.
    write(lines()[0], 'Ana ');
    expect(lines()[0].value).toBe('Ana ');
    expect(namesKept()).toEqual(['Ana', '']);
    write(lines()[0], 'Ana  María');
    expect(namesKept()).toEqual(['Ana María', '']);
  });

  it('leave nothing kept once both lines are empty again', () => {
    draw(createElement(DuoNames));
    write(lines()[0], 'Ana');
    write(lines()[0], '');
    expect(localStorage.getItem(DUO_KEY)).toBeNull();
  });

  it('are asked for in English on the page of that language', () => {
    setLang('en');
    draw(createElement(DuoNames));
    expect(texts('.duo-names label > span')).toEqual(['Player 1', 'Player 2']);
    expect(lines()[0].placeholder).toBe('Name (optional)');
    expect(box.querySelector('.duo-names')!.getAttribute('aria-label')).toBe('Who is playing');
  });
});

describe('the scoreboard of a game of two', () => {
  const board = (how: string, turn: Who | null, first: Who = 0) => draw(createElement(DuoBoard, { names: NAMES, score: scoreOf(how, first), turn }));

  it('shows both players with their points', () => {
    board('owb', 1);
    expect(texts('.duo-seat .duo-name')).toEqual(['Ana', 'Luis']);
    expect(texts('.duo-seat .duo-pts')).toEqual(['2 puntos', '1 punto']);
    expect(box.querySelector('.duo-board')!.getAttribute('role')).toBe('group');
    expect(box.querySelector('.duo-board')!.getAttribute('aria-label')).toBe('Marcador');
    expect([...box.querySelectorAll('.duo-seat')].map((el) => el.classList.contains('p0'))).toEqual([true, false]);
    expect([...box.querySelectorAll('.duo-seat')].map((el) => el.classList.contains('p1'))).toEqual([false, true]);
  });

  it('starts at nothing each', () => {
    board('', 0);
    expect(texts('.duo-seat .duo-pts')).toEqual(['0 puntos', '0 puntos']);
  });

  it('marks whose turn it is, and says so to whoever does not see it', () => {
    board('o', 1);
    const seats = [...box.querySelectorAll('.duo-seat')];
    expect(seats.map((el) => el.classList.contains('on'))).toEqual([false, true]);
    expect(seats.map((el) => el.getAttribute('aria-current'))).toEqual([null, 'true']);
    expect(texts('.duo-seat')).toEqual(['Ana2 puntos', 'Luis(le toca)0 puntos']);
    board('ow', 0);
    expect([...box.querySelectorAll('.duo-seat')].map((el) => el.classList.contains('on'))).toEqual([true, false]);
    expect(texts('.duo-seat')).toEqual(['Ana(le toca)2 puntos', 'Luis1 punto']);
  });

  it('marks nobody when it is nobody’s turn', () => {
    board('ow', null);
    expect(box.querySelectorAll('.duo-seat.on')).toHaveLength(0);
    expect(box.querySelectorAll('[aria-current]')).toHaveLength(0);
  });

  it('gives the points to the second player first when that one opened the game', () => {
    board('o', 0, 1);
    expect(texts('.duo-seat .duo-pts')).toEqual(['0 puntos', '2 puntos']);
  });

  it('is told in English on the page of that language', () => {
    setLang('en');
    board('ow', 0);
    expect(box.querySelector('.duo-board')!.getAttribute('aria-label')).toBe('Scoreboard');
    expect(texts('.duo-seat')).toEqual(['Ana(to play)2 points', 'Luis1 point']);
  });
});

describe('whose turn the question is', () => {
  it('is said over it, in the colour of that player', () => {
    draw(createElement(DuoTurn, { names: NAMES, who: 0 }));
    expect(text('.duo-turn')).toBe('Turno de Ana');
    expect(box.querySelector('.duo-turn')!.classList.contains('p0')).toBe(true);
    expect(box.querySelector('.duo-turn b')!.textContent).toBe('Ana');
    draw(createElement(DuoTurn, { names: NAMES, who: 1 }));
    expect(text('.duo-turn')).toBe('Turno de Luis');
    expect(box.querySelector('.duo-turn')!.classList.contains('p1')).toBe(true);
    expect(box.querySelector('.duo-turn')!.classList.contains('p0')).toBe(false);
  });

  it('is said aloud when it changes hands', () => {
    draw(createElement(DuoTurn, { names: NAMES, who: 0 }));
    expect(box.querySelector('.duo-turn')!.getAttribute('role')).toBe('status');
  });

  it('is said the English way in English', () => {
    setLang('en');
    draw(createElement(DuoTurn, { names: NAMES, who: 1 }));
    expect(text('.duo-turn')).toBe('Luis’s turn');
  });
});

describe('what an answer adds', () => {
  const gain = (who: Who, res: Res, last = false) => draw(createElement(DuoGain, { names: NAMES, who, res, last }));

  it('is two points at once, one with help and nothing for a miss, and who plays next', () => {
    gain(0, 'ok');
    expect(text('.duo-gain')).toBe('Ana suma 2 puntos. Ahora le toca a Luis.');
    gain(1, 'warn');
    expect(text('.duo-gain')).toBe('Luis suma 1 punto. Ahora le toca a Ana.');
    gain(0, 'bad');
    expect(text('.duo-gain')).toBe('Ana no suma. Ahora le toca a Luis.');
  });

  it('names nobody to play next after the last question', () => {
    gain(1, 'ok', true);
    expect(text('.duo-gain')).toBe('Luis suma 2 puntos.');
    gain(1, 'bad', true);
    expect(text('.duo-gain')).toBe('Luis no suma.');
  });

  it('is said in English on the page of that language', () => {
    setLang('en');
    gain(0, 'warn');
    expect(text('.duo-gain')).toBe('Ana scores 1 point. Luis plays next.');
    gain(1, 'bad', true);
    expect(text('.duo-gain')).toBe('Luis scores nothing.');
  });
});

describe('the result of a game of two', () => {
  const onAgain = vi.fn();
  const onExit = vi.fn();
  const result = (how: string, patch: Partial<Parameters<typeof DuoResults>[0]> = {}) => draw(createElement(DuoResults, { names: NAMES, rows: rowsOf(how), first: 0, done: true, several: false, onAgain, onExit, ...patch }));

  beforeEach(() => {
    onAgain.mockClear();
    onExit.mockClear();
  });

  it('opens with who won and the points of both', () => {
    // Ana: right, missed, right (4). Luis: with help, right, right (5).
    result('owboo' + 'o');
    expect(text('.results-title')).toBe('Gana Luis');
    expect(text('.results-note')).toBe('5 puntos a 4.');
    expect(texts('.duo-card h3')).toEqual(['Ana', 'Luis']);
    expect(texts('.duo-total')).toEqual(['4 puntos', '5 puntos']);
    expect(texts('.duo-card dl')).toEqual(['A la primera2Con ayuda0Fallos1', 'A la primera2Con ayuda1Fallos0']);
  });

  it('marks the card of the winner, and only that one', () => {
    result('owbooo');
    const cards = [...box.querySelectorAll('.duo-card')];
    expect(cards.map((c) => c.classList.contains('won'))).toEqual([false, true]);
    expect(cards.map((c) => c.querySelectorAll('svg').length)).toEqual([0, 1]);
    expect(cards[1].querySelector('svg')!.getAttribute('aria-label')).toBe('Gana');
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Ana', 'Luis']);
    result('ob');
    expect([...box.querySelectorAll('.duo-card')].map((c) => c.classList.contains('won'))).toEqual([true, false]);
  });

  it('marks neither card in a tie', () => {
    result('oo');
    expect(text('.results-title')).toBe('Empate');
    expect(text('.results-note')).toBe('Los dos acabáis con 2 puntos.');
    expect(box.querySelectorAll('.duo-card.won')).toHaveLength(0);
    expect(box.querySelectorAll('.duo-card svg')).toHaveLength(0);
  });

  it('lists what each answered in the order it was asked, with how it went and what it added', () => {
    result('owbooo');
    const lists = [...box.querySelectorAll('.duo-list')];
    expect(lists).toHaveLength(2);
    expect(lists.map((l) => l.querySelector('summary')!.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['Ana 4 puntos', 'Luis 5 puntos']);
    expect([...lists[0].querySelectorAll('li b')].map((b) => b.textContent)).toEqual(['Pieza p1', 'Pieza p3', 'Pieza p5']);
    expect([...lists[1].querySelectorAll('li b')].map((b) => b.textContent)).toEqual(['Pieza p2', 'Pieza p4', 'Pieza p6']);
    expect([...lists[0].querySelectorAll('li')].map((li) => li.className)).toEqual(['r-ok', 'r-bad', 'r-ok']);
    expect([...lists[1].querySelectorAll('li')].map((li) => li.className)).toEqual(['r-warn', 'r-ok', 'r-ok']);
    expect([...lists[0].querySelectorAll('.duo-got')].map((el) => el.textContent)).toEqual(['a la primera: +2', 'fallo: 0', 'a la primera: +2']);
    expect([...lists[1].querySelectorAll('.duo-got')].map((el) => el.textContent)).toEqual(['con ayuda: +1', 'a la primera: +2', 'a la primera: +2']);
    expect([...lists[1].querySelectorAll('.duo-mark')].map((el) => el.getAttribute('title'))).toEqual(['con ayuda', 'a la primera', 'a la primera']);
    // Both lists are open: there is nothing else to look at.
    expect(lists.every((l) => (l as HTMLDetailsElement).open)).toBe(true);
  });

  it('gives the first answer to the second player when that one opened the game', () => {
    result('ob', { first: 1 });
    expect(text('.results-title')).toBe('Gana Luis');
    const lists = [...box.querySelectorAll('.duo-list')];
    expect([...lists[0].querySelectorAll('li b')].map((b) => b.textContent)).toEqual(['Pieza p2']);
    expect([...lists[1].querySelectorAll('li b')].map((b) => b.textContent)).toEqual(['Pieza p1']);
  });

  it('tells the rule, who opens the next game, and that nothing of it is written down', () => {
    result('ob');
    expect(texts('.duo-how')).toEqual([
      'Una pregunta para cada uno, por turnos. Acertar a la primera vale 2 puntos; con pista o tras un fallo, 1. Gana quien sume más. En la siguiente empieza Luis. Lo que se juega a dos no cuenta para el progreso de nadie.',
    ]);
    result('ob', { first: 1 });
    expect(text('.duo-how')).toContain('En la siguiente empieza Ana.');
  });

  it('plays again, or goes back to choose another game', () => {
    result('ob');
    expect(texts('.results-actions button')).toEqual(['Otra vez', 'Cambiar de juego']);
    act(() => button('Otra vez').click());
    expect(onAgain).toHaveBeenCalledTimes(1);
    expect(onExit).not.toHaveBeenCalled();
    act(() => button('Cambiar de juego').click());
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onAgain).toHaveBeenCalledTimes(1);
  });

  it('leaves the keyboard on the button that plays again, without scrolling to it', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    result('ob');
    expect(document.activeElement).toBe(button('Otra vez'));
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(button('Otra vez').autofocus).toBe(false);
  });

  it('is nobody’s when the game was ended early, and says who was ahead', () => {
    result('obow', { done: false });
    expect(text('.results-title')).toBe('Partida sin terminar');
    expect(text('.results-note')).toBe('Iba ganando Ana: 4 puntos a 1 tras 2 rondas.');
    expect(box.querySelectorAll('.duo-card.won')).toHaveLength(0);
    expect(box.querySelector('.duo-extra')).toBeNull();
    expect(texts('.duo-total')).toEqual(['4 puntos', '1 punto']);
  });

  it('leaves out the answer the other player did not get to match, and says which', () => {
    result('obo', { done: false });
    expect(text('.results-note')).toBe('Iba ganando Ana: 2 puntos a 0 tras 1 ronda.');
    expect(texts('.duo-total')).toEqual(['2 puntos', '0 puntos']);
    expect(text('.duo-extra')).toBe('La última respuesta de Ana (Pieza p3) no cuenta: Luis no llegó a tener ese turno.');
    const lists = [...box.querySelectorAll('.duo-list')];
    expect([...lists[0].querySelectorAll('li b')].map((b) => b.textContent)).toEqual(['Pieza p1']);
    expect([...lists[1].querySelectorAll('li b')].map((b) => b.textContent)).toEqual(['Pieza p2']);
    // The same with the other one opening: the answer left out is Luis's.
    result('obo', { done: false, first: 1 });
    expect(text('.duo-extra')).toBe('La última respuesta de Luis (Pieza p3) no cuenta: Ana no llegó a tener ese turno.');
  });

  it('has no lists when no round was completed', () => {
    result('o', { done: false });
    expect(text('.results-title')).toBe('Partida sin terminar');
    expect(text('.results-note')).toBe('No se ha completado ninguna ronda.');
    expect(box.querySelectorAll('.duo-list')).toHaveLength(0);
    expect(texts('.duo-total')).toEqual(['0 puntos', '0 puntos']);
    expect(text('.duo-extra')).toBe('La última respuesta de Ana (Pieza p1) no cuenta: Luis no llegó a tener ese turno.');
    // It can still be played again.
    expect(texts('.results-actions button')).toEqual(['Otra vez', 'Cambiar de juego']);
  });

  it('says what each piece is of where the map mixes countries, and what the game says of an answer', () => {
    const rows: ResultRow[] = [
      { item: piece('a', { name: 'Sevilla', parent: 'Andalucía' }), res: 'ok' },
      { item: piece('b', { name: 'Porto' }), res: 'bad', note: 'Capitales · Oporto' },
      { item: piece('c', { name: 'Francia', kind: 'country' }), res: 'ok' },
      { item: piece('d', { name: 'Lugo' }), res: 'ok' },
    ];
    result('', { rows, several: true });
    expect(texts('.duo-list li small')).toEqual(['Andalucía', 'Capitales · Oporto', 'España']);
    expect(box.querySelectorAll('.duo-list li .flag')).toHaveLength(4);
    // On a map of one country a piece does not say which: only a country shows its flag.
    result('', { rows, several: false });
    expect(texts('.duo-list li small')).toEqual(['Andalucía', 'Capitales · Oporto']);
    expect(box.querySelectorAll('.duo-list li .flag')).toHaveLength(1);
  });

  it('is told in English on the page of that language', () => {
    setLang('en');
    result('owbooo');
    expect(text('.kicker')).toBe('Result');
    expect(text('.results-title')).toBe('Luis wins');
    expect(text('.results-note')).toBe('5 points to 4.');
    expect(texts('.duo-total')).toEqual(['4 points', '5 points']);
    expect(texts('.duo-card dl')).toEqual(['First time2With help0Misses1', 'First time2With help1Misses0']);
    expect(texts('.results-actions button')).toEqual(['Again', 'Change game']);
    expect(text('.duo-how')).toBe(
      'One question each, by turns. A first-time right answer is worth 2 points; with a hint or after a wrong try, 1. The most points wins. Luis starts the next one. What is played by two counts towards nobody’s progress.',
    );
    expect([...box.querySelectorAll('.duo-list')[1].querySelectorAll('.duo-got')].map((el) => el.textContent)).toEqual(['with help: +1', 'first time: +2', 'first time: +2']);
    result('obo', { done: false });
    expect(text('.duo-extra')).toBe('The last answer of Ana (Pieza p3) does not count: Luis did not get that turn.');
  });
});
