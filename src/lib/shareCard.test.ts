import { describe, expect, it } from 'vitest';
import { gameCard, tonesOf } from '../games/resultCard';
import { setLang } from './i18n';
import { CARD_SIZE, drawable, fit, paintCard, rowColour, siteLabel, toneColour, wrap, type CardInfo, type Pen } from './shareCard';
import type { Deck } from './types';

interface Call {
  op: string;
  args: unknown[];
  font: string;
  fill: string;
  align: string;
}

/** A stand-in for a canvas: it writes down what it is asked to draw, and measures a text by its letters. */
function recorder(): { pen: Pen; calls: Call[] } {
  const calls: Call[] = [];
  const state = { font: '10px sans-serif', fillStyle: '', strokeStyle: '', lineWidth: 1, lineJoin: 'miter', lineCap: 'butt', textAlign: 'left', textBaseline: 'alphabetic' };
  const px = () => Number(/(\d+(?:\.\d+)?)px/.exec(state.font)?.[1] ?? 10);
  const pen = new Proxy(state as Record<string, unknown>, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (key === 'measureText') return (text: string) => ({ width: text.length * px() * 0.5 });
      return (...args: unknown[]) => {
        calls.push({ op: key, args, font: state.font, fill: String(state.fillStyle), align: state.textAlign });
      };
    },
    set(target, key: string, value) {
      target[key] = value;
      return true;
    },
  }) as unknown as Pen;
  return { pen, calls };
}

const info: CardInfo = {
  kicker: 'Reto del 17 de noviembre de 2026',
  country: 'Nigeria',
  total: 61,
  verdict: 'Bien jugado',
  rows: [
    { name: 'Regionle', points: 20 },
    { name: 'Señalar', points: 16 },
    { name: 'Ruta', points: 13 },
    { name: '¿Qué país?', points: 8 },
    { name: 'Banderas y capitales', points: 0 },
  ],
  streak: '3 días seguidos',
  site: 'diegosb72.github.io/regionle',
};
const texts = (calls: Call[]) => calls.filter((c) => c.op === 'fillText');
const written = (calls: Call[]) => texts(calls).map((c) => String(c.args[0]));

describe('the picture of a day', () => {
  it('says whose result it is, what it was and where to play', () => {
    const { pen, calls } = recorder();
    paintCard(pen, info);
    const said = written(calls);
    for (const text of ['Regionle', 'RETO DEL 17 DE NOVIEMBRE DE 2026', 'Nigeria', '61', '/ 100', 'Bien jugado', 'diegosb72.github.io/regionle', '3 días seguidos']) expect(said).toContain(text);
    for (const row of info.rows) {
      expect(said).toContain(row.name);
      expect(said).toContain(String(row.points));
    }
    // The whole square is painted first.
    expect(calls[0]).toMatchObject({ op: 'fillRect', args: [0, 0, CARD_SIZE, CARD_SIZE] });
  });

  it('keeps every word inside the square, one line under another', () => {
    for (const country of ['Nigeria', 'República Democrática del Congo', 'San Vicente y las Granadinas y otras islas de nombre interminable']) {
      const { pen, calls } = recorder();
      paintCard(pen, { ...info, country }, { flag: {} as CanvasImageSource });
      const lines = texts(calls);
      for (const c of lines) {
        const [text, x, y] = c.args as [string, number, number];
        const width = text.length * Number(/(\d+)px/.exec(c.font)![1]) * 0.5;
        expect(y, text).toBeGreaterThan(40);
        expect(y, text).toBeLessThan(CARD_SIZE - 40);
        if (c.align === 'left') expect(x + width, text).toBeLessThanOrEqual(CARD_SIZE - 40);
        else expect(x - width, text).toBeGreaterThanOrEqual(40);
      }
      // The lines of the tests come one under another, above the address of the game.
      // The last one written: the first test is called like the game, whose name heads the picture.
      const at = (text: string) => ([...lines].reverse().find((c) => c.args[0] === text)!.args as number[])[2];
      const rows = info.rows.map((r) => at(r.name));
      expect([...rows].sort((a, b) => a - b)).toEqual(rows);
      expect(rows[1] - rows[0]).toBeGreaterThanOrEqual(34);
      expect(rows[4]).toBeLessThan(at(info.site) - 50);
      expect(at('Bien jugado')).toBeLessThan(rows[0] - 40);
      expect(calls.filter((c) => c.op === 'drawImage')).toHaveLength(1);
    }
  });

  it('draws the map only when there is one, and leaves the flag and the streak out when there are none', () => {
    const plain = recorder();
    paintCard(plain.pen, { ...info, streak: null });
    expect(written(plain.calls)).not.toContain('3 días seguidos');
    expect(plain.calls.some((c) => c.op === 'drawImage')).toBe(false);
    expect(plain.calls.some((c) => c.op === 'clip')).toBe(false);

    const made: string[] = [];
    const mapped = recorder();
    paintCard(mapped.pen, info, { art: { paths: ['M0 0L10 0L10 10Z', 'M10 0L20 0L20 10Z'], box: [0, 0, 20, 10] }, path: (d) => (made.push(d), {} as Path2D) });
    expect(made).toEqual(['M0 0L10 0L10 10Z', 'M10 0L20 0L20 10Z']);
    expect(mapped.calls.filter((c) => c.op === 'clip')).toHaveLength(1);
    // With the map on its right, the name is given less room than without it.
    const size = (calls: Call[]) => Number(/(\d+)px/.exec(texts(calls).find((c) => String(c.args[0]).startsWith('República'))!.font)![1]);
    const long = { ...info, country: 'República Democrática del Congo' };
    const narrow = recorder();
    paintCard(narrow.pen, long, { art: { paths: ['M0 0L1 1'], box: [0, 0, 1, 1] }, path: () => ({}) as Path2D });
    const wide = recorder();
    paintCard(wide.pen, long);
    expect(size(narrow.calls)).toBeLessThanOrEqual(size(wide.calls));
    expect(written(narrow.calls)).toContain('del Congo');
  });

  it('colours a test as the summary does', () => {
    expect(rowColour(20)).toBe(rowColour(16));
    expect(rowColour(15)).toBe(rowColour(8));
    expect(rowColour(7)).toBe(rowColour(0));
    expect(new Set([rowColour(20), rowColour(10), rowColour(0)]).size).toBe(3);
  });
});

describe('the picture of a game', () => {
  const game = () => gameCard('Regiones · Señalar', 'España · comunidades autónomas', '¡Muy bien!', { ok: 13, warn: 1, bad: 1 }, 92_000, '18 de noviembre de 2026', 'diegosb72.github.io/regionle');

  it('says what was played and where, the score and how the answers went', () => {
    const card = game();
    // Thirteen right at once and one with help, of fifteen: 13.5 of 15.
    expect(card).toMatchObject({ kicker: 'Regiones · Señalar', country: 'España · comunidades autónomas', total: 90, unit: '%', verdict: '¡Muy bien!', streak: '18 de noviembre de 2026' });
    expect(card.rows).toEqual([
      { name: 'A la primera', points: 13, of: 15, tone: 'ok', text: '13' },
      { name: 'Con ayuda', points: 1, of: 15, tone: 'warn', text: '1' },
      { name: 'Fallos', points: 1, of: 15, tone: 'bad', text: '1' },
      { name: 'Tiempo', points: 0, text: '1:32', bar: false },
    ]);
    // A game with no clock has no line for the time.
    expect(gameCard('Cifras', 'Verdadero o falso', 'Partida terminada', { ok: 2, warn: 0, bad: 2 }, undefined, 'hoy', 'x').rows.map((r) => r.name)).toEqual(['A la primera', 'Con ayuda', 'Fallos']);
    setLang('en');
    try {
      expect(game().rows.map((r) => r.name)).toEqual(['First time', 'With help', 'Misses', 'Time']);
    } finally {
      setLang('es');
    }
  });

  it('writes the score as a percentage, and each line with its own figure and colour', () => {
    const { pen, calls } = recorder();
    paintCard(pen, game());
    const said = written(calls);
    for (const text of ['REGIONES · SEÑALAR', '90', '%', '¡Muy bien!', 'A la primera', 'Con ayuda', 'Fallos', 'Tiempo', '13', '1:32', '18 de noviembre de 2026']) expect(said, text).toContain(text);
    expect(said).not.toContain('/ 100');
    // Three bars, each as long as its share of the answers and in the colour of its kind; none for the time.
    const bars = calls.filter((c) => c.op === 'fill' && [toneColour('ok'), toneColour('warn'), toneColour('bad')].includes(c.fill)).map((c) => c.fill);
    expect(bars).toEqual([toneColour('ok'), toneColour('warn'), toneColour('bad')]);
    const tracks = calls.filter((c) => c.op === 'fill' && c.fill === '#e6decd');
    expect(tracks).toHaveLength(3);
  });

  it('leaves a kind of answer with none without its bar filled, and never divides by nothing', () => {
    const { pen, calls } = recorder();
    paintCard(pen, gameCard('Cifras', 'Verdadero o falso', 'Partida terminada', { ok: 0, warn: 0, bad: 2 }, undefined, 'hoy', 'x'));
    expect(calls.filter((c) => c.op === 'fill' && c.fill === toneColour('bad'))).toHaveLength(1);
    expect(calls.filter((c) => c.op === 'fill' && c.fill === toneColour('ok'))).toHaveLength(0);
    const empty = recorder();
    paintCard(empty.pen, gameCard('Cifras', 'x', 'Sin preguntas', { ok: 0, warn: 0, bad: 0 }, undefined, 'hoy', 'x'));
    expect(written(empty.calls)).toContain('0');
  });

  it('paints each piece of the map by how its answer went', () => {
    const fills: string[] = [];
    const { pen } = recorder();
    const watch = new Proxy(pen, {
      get(target, key: string) {
        if (key === 'fill') return (path?: unknown) => (path ? fills.push(String((target as unknown as { fillStyle: string }).fillStyle)) : undefined);
        return (target as unknown as Record<string, unknown>)[key];
      },
      set(target, key: string, value) {
        (target as unknown as Record<string, unknown>)[key] = value;
        return true;
      },
    });
    paintCard(watch, game(), { art: { paths: ['a', 'b', 'c', 'd'], box: [0, 0, 10, 10], tones: ['ok', 'warn', 'bad', undefined] }, path: () => ({}) as Path2D });
    expect(fills).toEqual(['#8fd1a9', '#f3cf6f', '#f0957c', '#fdf6e3']);
    // With nothing said about the pieces, all of them are land.
    fills.length = 0;
    paintCard(watch, game(), { art: { paths: ['a', 'b'], box: [0, 0, 10, 10] }, path: () => ({}) as Path2D });
    expect(fills).toEqual(['#fdf6e3', '#fdf6e3']);
  });

  it('keeps the worst answer of a piece asked more than once', () => {
    const row = (id: string, res: 'ok' | 'warn' | 'bad') => ({ item: { id }, res });
    expect(tonesOf([row('a', 'ok'), row('b', 'bad'), row('a', 'warn'), row('b', 'ok'), row('c', 'ok')])).toEqual({ a: 'warn', b: 'bad', c: 'ok' });
    expect(tonesOf([])).toEqual({});
  });

  it('draws a map of surfaces only', () => {
    const deck = (shapes: string[]) => ({ items: shapes.map((shape) => ({ shape })) }) as unknown as Deck;
    expect(drawable(deck(['area', 'area']))).toBe(true);
    expect(drawable(deck(['area', 'point']))).toBe(false);
    expect(drawable(deck(['line']))).toBe(false);
    expect(drawable(deck([]))).toBe(false);
  });
});

describe('the address of the game as it is read', () => {
  it('drops what is not said aloud', () => {
    expect(siteLabel('https://diegosb72.github.io/regionle/')).toBe('diegosb72.github.io/regionle');
    expect(siteLabel('https://diegosb72.github.io/regionle/index.html#/reto')).toBe('diegosb72.github.io/regionle');
    expect(siteLabel('https://www.example.org/')).toBe('example.org');
    expect(siteLabel('http://127.0.0.1:4173/en.html')).toBe('127.0.0.1:4173');
  });
});

describe('fitting words', () => {
  const pen = { font: '', measureText: (text: string) => ({ width: text.length * 10 }) as TextMetrics };

  it('breaks a text at its spaces', () => {
    expect(wrap(pen, 'uno dos tres cuatro', 80)).toEqual(['uno dos', 'tres', 'cuatro']);
    expect(wrap(pen, 'uno dos tres cuatro', 1000)).toEqual(['uno dos tres cuatro']);
    expect(wrap(pen, '  uno   dos ', 30)).toEqual(['uno', 'dos']);
    // A word longer than the line is left whole.
    expect(wrap(pen, 'interminable y', 50)).toEqual(['interminable', 'y']);
    expect(wrap(pen, '', 50)).toEqual([]);
  });

  it('takes the largest size at which the text fits', () => {
    const sized = { font: '', measureText: (text: string) => ({ width: text.length * Number(/(\d+)px/.exec(sized.font)![1]) * 0.5 }) as TextMetrics };
    const font = (px: number) => `${px}px x`;
    expect(fit(sized, 'Chad', font, 500, 68, 38, 2)).toEqual({ px: 68, lines: ['Chad'] });
    const two = fit(sized, 'Papúa Nueva Guinea', font, 300, 68, 38, 2);
    expect(two.lines).toEqual(['Papúa Nueva', 'Guinea']);
    expect(two.px).toBeLessThan(68);
    expect(two.px).toBeGreaterThan(38);
    // Nothing fits: the smallest size, on as many lines as it takes.
    const many = fit(sized, 'una dos tres cuatro cinco seis siete ocho', font, 120, 68, 38, 2);
    expect(many.px).toBe(38);
    expect(many.lines.length).toBeGreaterThan(2);
  });
});
