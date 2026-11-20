import { describe, expect, it } from 'vitest';
import { HAND_COLOURS, type HandRow } from './hand';
import { HAND_LEGEND, handFill, handFrame, legendRows, paintHandCard, type HandCardInfo } from './handCard';
import { KNOW_RING, KNOW_RING_BELOW, type KnowArt, type KnowPiece } from './knowCard';
import { CARD_SIZE, type Pen } from './shareCard';

interface Call {
  op: string;
  args: unknown[];
  font: string;
  fill: string;
  stroke: string;
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
        calls.push({ op: key, args, font: state.font, fill: String(state.fillStyle), stroke: String(state.strokeStyle), align: state.textAlign });
      };
    },
    set(target, key: string, value) {
      target[key] = value;
      return true;
    },
  }) as unknown as Pen;
  return { pen, calls };
}

const NAMES = ['Naranja', 'Azul claro', 'Verde', 'Amarillo', 'Azul', 'Rosa'];
const row = (colour: number, count: number, label = ''): HandRow => ({ colour, label, count });
const info = (rows: HandRow[]): HandCardInfo => ({ kicker: 'Pintado a mano', title: 'Mundo · 198 países', rows, names: NAMES, day: '20 de noviembre de 2026', site: 'diegosb72.github.io/regionle' });
const texts = (calls: Call[]) => calls.filter((c) => c.op === 'fillText');
const written = (calls: Call[]) => texts(calls).map((c) => String(c.args[0]));
const sizeOf = (c: Call) => Number(/(\d+(?:\.\d+)?)px/.exec(c.font)![1]);
const at = (calls: Call[], text: string) => texts(calls).find((c) => c.args[0] === text)!.args as [string, number, number];
/** A path as the stand-in keeps it: the `d` it was made from. */
const make = (d: string) => ({ d }) as unknown as Path2D;
const piece = (id: string, x: number, y: number, size: number): KnowPiece => ({ id, d: id, grade: 'new', x, y, size });
const hex = (colour: number) => HAND_COLOURS[colour - 1].hex;

describe('the picture of a map painted by hand', () => {
  it('says what map it is, what each colour stands for and where to play', () => {
    const { pen, calls } = recorder();
    paintHandCard(pen, info([row(1, 13, 'He estado'), row(2, 4), row(5, 120, 'Algún día')]));
    const said = written(calls);
    for (const text of ['Regionle', 'PINTADO A MANO', 'Mundo · 198 países', 'diegosb72.github.io/regionle', '20 de noviembre de 2026']) expect(said).toContain(text);
    // Each colour in use: how many pieces have it, and what it stands for; the name of the colour when the player has not said.
    for (const text of ['13', 'He estado', '4', 'Azul claro', '120', 'Algún día']) expect(said).toContain(text);
    // The colours that are not in use are not in the legend.
    for (const text of ['Naranja', 'Verde', 'Amarillo', 'Rosa']) expect(said).not.toContain(text);
    expect(calls[0]).toMatchObject({ op: 'fillRect', args: [0, 0, CARD_SIZE, CARD_SIZE] });
  });

  it('lays the legend out in two columns, each colour in its turn, under the map and over the foot', () => {
    const rows = [row(1, 1, 'uno'), row(2, 2, 'dos'), row(3, 3, 'tres'), row(4, 4, 'cuatro'), row(5, 5, 'cinco'), row(6, 6, 'seis')];
    const { pen, calls } = recorder();
    paintHandCard(pen, info(rows));
    const frame = handFrame(6);
    const where = rows.map((r) => at(calls, r.label));
    // Two in each line: the odd ones on the left, the even ones in the right half.
    for (const i of [0, 2, 4]) {
      expect(where[i][2]).toBe(where[i + 1][2]);
      expect(where[i][1]).toBeLessThan(CARD_SIZE / 2);
      expect(where[i + 1][1]).toBeGreaterThan(CARD_SIZE / 2);
    }
    expect(where[2][2] - where[0][2]).toBe(HAND_LEGEND.pitch);
    expect(where[4][2] - where[2][2]).toBe(HAND_LEGEND.pitch);
    expect(where[0][2]).toBeGreaterThan(frame.y + frame.h + 20);
    expect(where[4][2] + 20).toBeLessThan(at(calls, 'diegosb72.github.io/regionle')[2] - 52);
    // The square of each is of its colour, and to the left of its figure.
    const squares = calls.filter((c) => c.op === 'fill' && HAND_COLOURS.some((h) => h.hex === c.fill));
    expect(squares.map((c) => c.fill)).toEqual(rows.map((r) => hex(r.colour)));
  });

  it('gives the map the room the legend does not need', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 9].map(legendRows)).toEqual([1, 1, 1, 2, 2, 3, 3, 3]);
    expect(handFrame(1).h).toBeGreaterThan(handFrame(3).h);
    expect(handFrame(3).h).toBeGreaterThan(handFrame(5).h);
    expect(handFrame(1).h - handFrame(6).h).toBe(2 * HAND_LEGEND.pitch);
    for (const n of [1, 3, 6]) {
      const rows = Array.from({ length: n }, (_, i) => row(i + 1, i + 1, `color ${i + 1}`));
      const { pen, calls } = recorder();
      paintHandCard(pen, info(rows));
      const frame = handFrame(n);
      // The frame of the map is drawn where it is said to be…
      const sea = calls.find((c) => c.op === 'fill' && c.fill === '#d8e6e3');
      expect(sea).toBeDefined();
      // …and every row of the legend lies between it and the line over the foot.
      const line = calls.find((c) => c.op === 'fillRect' && c.args[3] === 2)!;
      for (const r of rows) {
        const y = at(calls, r.label)[2];
        expect(y - HAND_LEGEND.square / 2).toBeGreaterThan(frame.y + frame.h);
        expect(y + HAND_LEGEND.square / 2).toBeLessThan(line.args[1] as number);
      }
    }
  });

  it('keeps every word inside the square, however long the names', () => {
    const long: HandCardInfo = {
      ...info([row(1, 1234, 'Donde he estado alguna vez de niña'), row(2, 5678, 'Quiero ir cuando pueda de verdad'), row(3, 9, 'x'.repeat(30))]),
      kicker: 'Pintado a mano y con todavía alguna cosa más que no cabe en una línea de ninguna de las maneras',
      title: 'Estados Unidos · regiones censales y otras divisiones de nombre interminable',
    };
    for (const card of [info([row(1, 13, 'He estado')]), long]) {
      const { pen, calls } = recorder();
      paintHandCard(pen, card);
      for (const c of texts(calls)) {
        const [text, x, y] = c.args as [string, number, number];
        const width = text.length * sizeOf(c) * 0.5;
        expect(y, text).toBeGreaterThan(40);
        expect(y, text).toBeLessThan(CARD_SIZE - 40);
        if (c.align === 'left') expect(x + width, text).toBeLessThanOrEqual(CARD_SIZE - 40);
        else expect(x - width, text).toBeGreaterThanOrEqual(40);
      }
    }
    // A long line of the legend is written smaller, never over the column next to it, and still large enough to be read.
    const { pen, calls } = recorder();
    paintHandCard(pen, long);
    const first = texts(calls).find((c) => c.args[0] === 'Donde he estado alguna vez de niña')!;
    expect(sizeOf(first)).toBeLessThan(26);
    expect(sizeOf(first)).toBeGreaterThanOrEqual(16);
    // The left column ends where the gap between the two starts: half the width between the margins, less half the gap.
    const column = (CARD_SIZE - 2 * 64 - HAND_LEGEND.gap) / 2;
    const end = (first.args[1] as number) + String(first.args[0]).length * sizeOf(first) * 0.5;
    expect(end).toBeLessThanOrEqual(64 + column);
    // And the figure of the column on the right starts after the gap.
    expect(at(calls, '5678')[1]).toBeGreaterThan(64 + column + HAND_LEGEND.gap);
  });

  it('paints each piece with the colour it was given, and leaves the others as land', () => {
    const art: KnowArt = {
      pieces: [piece('ES', 10, 10, 30), piece('FR', 40, 10, 30), piece('PT', 70, 10, 30), piece('IT', 50, 40, 30)],
      around: ['greenland'],
      box: [0, 0, 100, 50],
      whole: false,
    };
    const { pen, calls } = recorder();
    paintHandCard(pen, info([row(1, 1), row(4, 2)]), { art, path: make, fills: { ES: 1, FR: 4, PT: 4, XX: 2 } });
    const fillOf = (id: string) => calls.find((c) => c.op === 'fill' && (c.args[0] as { d?: string } | undefined)?.d === id)!.fill;
    expect(fillOf('ES')).toBe(hex(1));
    expect(fillOf('FR')).toBe(hex(4));
    expect(fillOf('PT')).toBe(hex(4));
    expect(fillOf('IT')).toBe(handFill(undefined));
    expect(handFill(undefined)).not.toBe(hex(1));
    // The land that is not of the map is drawn muted, and in no colour of the palette.
    const around = fillOf('greenland');
    expect(HAND_COLOURS.map((c) => c.hex)).not.toContain(around);
    expect(around).not.toBe(handFill(undefined));
    // What is not a colour paints nothing.
    for (const not of [0, 7, 1.5, NaN]) expect(handFill(not)).toBe(handFill(undefined));
  });

  it('rings a painted speck in its colour, and leaves the specks that are not painted without a ring', () => {
    // A map of 100 by 50 in its frame, with a margin of 22 around: here it is the width that it fills.
    const frame = handFrame(2);
    const k = Math.min((frame.w - 44) / 100, (frame.h - 44) / 50);
    expect(k).toBe((frame.w - 44) / 100);
    const below = (KNOW_RING_BELOW - 0.5) / k;
    const above = (KNOW_RING_BELOW + 0.5) / k;
    const art: KnowArt = {
      pieces: [piece('big', 50, 25, 40), piece('malta', 20, 20, below), piece('andorra', 21, 20, below), piece('monaco', 60, 30, 0.02), piece('nearly', 80, 20, above)],
      around: [],
      box: [0, 0, 100, 50],
      whole: false,
    };
    const { pen, calls } = recorder();
    paintHandCard(pen, info([row(3, 1), row(6, 2)]), { art, path: make, fills: { malta: 3, monaco: 6, nearly: 6 } });
    // A ring is a box with corners as round as it is wide, filled and outlined. The ones on the map come after the
    // sea it is drawn on and before the legend under it (the square of the name of the game, above, has such corners too).
    const sea = calls.findIndex((c) => c.op === 'fill' && c.fill === '#d8e6e3');
    const legend = calls.findIndex((c) => c.op === 'fillText' && c.args[0] === 'Verde');
    expect(sea).toBeGreaterThan(0);
    expect(legend).toBeGreaterThan(sea);
    const onMap = (i: number): boolean => i > sea && i < legend;
    const ringed = calls.filter((c, i) => onMap(i) && c.op === 'fill' && c.args.length === 0 && calls[i - 1]?.op === 'closePath' && calls[i - 2]?.args[4] === KNOW_RING).map((c) => c.fill);
    // Malta and Monaco, each in its colour. Andorra is a speck with no colour: no ring. The one that is nearly a speck is seen as it is.
    expect(ringed).toEqual([hex(3), hex(6)]);
    // Each ring is where its piece is: the middle of the map is the middle of its frame.
    const starts = calls.filter((c, i) => onMap(i) && c.op === 'moveTo' && calls[i + 1]?.op === 'arcTo' && calls[i + 1].args[4] === KNOW_RING).map((c) => c.args as [number, number]);
    const centre = (x: number, y: number): [number, number] => [frame.x + frame.w / 2 + (x - 50) * k, frame.y + frame.h / 2 + (y - 25) * k - KNOW_RING];
    expect(starts).toHaveLength(2);
    for (const [i, [x, y]] of [
      [20, 20],
      [60, 30],
    ].entries()) {
      expect(starts[i][0]).toBeCloseTo(centre(x, y)[0], 6);
      expect(starts[i][1]).toBeCloseTo(centre(x, y)[1], 6);
    }
  });

  it('draws with no map at all, and never with a figure that is not one', () => {
    for (const rows of [[], [row(1, 1)], [row(1, 1), row(2, 2), row(3, 3), row(4, 4), row(5, 5), row(6, 6)]]) {
      const { pen, calls } = recorder();
      paintHandCard(pen, info(rows));
      for (const c of calls) for (const a of c.args) if (typeof a === 'number') expect(Number.isFinite(a), c.op).toBe(true);
      expect(written(calls)).toContain('Mundo · 198 países');
    }
  });
});
