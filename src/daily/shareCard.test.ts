import { describe, expect, it } from 'vitest';
import { CARD_SIZE, fit, paintCard, rowColour, wrap, type CardInfo, type Pen } from './shareCard';

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
