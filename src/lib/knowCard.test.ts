import { describe, expect, it } from 'vitest';
import { KNOW_GRADES, KNOW_MAP, KNOW_RING, KNOW_RING_BELOW, gradeFill, knowArt, paintKnowCard, type KnowArt, type KnowCardInfo, type KnowPiece } from './knowCard';
import type { Grade } from './review';
import { CARD_SIZE, type Pen } from './shareCard';
import type { Deck, LL } from './types';

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

const info: KnowCardInfo = {
  kicker: 'Lo que ya me sé',
  title: 'Mi mapa del mundo',
  counts: { known: 104, learning: 34, due: 14, new: 46 },
  of: 'de 198 países',
  names: { known: 'sabidos', learning: 'aprendiendo', due: 'toca repasar', new: 'sin ver' },
  day: '20 de noviembre de 2026',
  site: 'diegosb72.github.io/regionle',
};
const texts = (calls: Call[]) => calls.filter((c) => c.op === 'fillText');
const written = (calls: Call[]) => texts(calls).map((c) => String(c.args[0]));
const sizeOf = (c: Call) => Number(/(\d+(?:\.\d+)?)px/.exec(c.font)![1]);
/** A path as the stand-in keeps it: the `d` it was made from. */
const make = (d: string) => ({ d }) as unknown as Path2D;
const piece = (d: string, grade: Grade, x: number, y: number, size: number): KnowPiece => ({ d, grade, x, y, size });

describe('the picture of the map of what is known', () => {
  it('says what it is a map of, how much of it is known and where to play', () => {
    const { pen, calls } = recorder();
    paintKnowCard(pen, info);
    const said = written(calls);
    for (const text of ['Regionle', 'LO QUE YA ME SÉ', 'Mi mapa del mundo', '104', 'de 198 países', 'diegosb72.github.io/regionle', '20 de noviembre de 2026']) expect(said).toContain(text);
    // The legend: how many of each grade, and what each is called.
    for (const g of KNOW_GRADES) {
      expect(said).toContain(String(info.counts[g]));
      expect(said).toContain(info.names[g]);
    }
    // The number of the known is written twice: large, and in the legend.
    expect(said.filter((t) => t === '104')).toHaveLength(2);
    expect(Math.max(...texts(calls).filter((c) => c.args[0] === '104').map(sizeOf))).toBeGreaterThan(100);
    // The whole square is painted first.
    expect(calls[0]).toMatchObject({ op: 'fillRect', args: [0, 0, CARD_SIZE, CARD_SIZE] });
  });

  it('keeps every word inside the square, however long the names', () => {
    const long: KnowCardInfo = {
      ...info,
      kicker: 'Lo que ya me sé · Situar en el mapa y todavía alguna cosa más que no cabe en una línea de ninguna manera',
      title: 'Estados Unidos · regiones censales y otras divisiones de nombre interminable',
      counts: { known: 8131, learning: 1204, due: 999, new: 12345 },
      of: 'de 22 679 comunidades autónomas y ciudades autónomas sabidas',
      names: { known: 'sabidas de memoria', learning: 'aprendiendo todavía', due: 'toca repasar pronto', new: 'sin ver nunca' },
    };
    for (const card of [info, long]) {
      const { pen, calls } = recorder();
      paintKnowCard(pen, card);
      for (const c of texts(calls)) {
        const [text, x, y] = c.args as [string, number, number];
        const width = text.length * sizeOf(c) * 0.5;
        expect(y, text).toBeGreaterThan(40);
        expect(y, text).toBeLessThan(CARD_SIZE - 40);
        if (c.align === 'left') expect(x + width, text).toBeLessThanOrEqual(CARD_SIZE - 40);
        else expect(x - width, text).toBeGreaterThanOrEqual(40);
      }
      // No two lines on top of each other: the title under the kicker, the figure under the map, the legend under the bar.
      const at = (text: string) => (texts(calls).find((c) => c.args[0] === text)!.args as [string, number, number])[2];
      const title = texts(calls).find((c) => /^5\d\d /.test(c.font) && c.args[0] !== 'Regionle' && sizeOf(c) >= 30 && sizeOf(c) <= 58)!;
      expect((title.args as [string, number, number])[2]).toBeLessThan(KNOW_MAP.y);
      expect(at(String(card.counts.known))).toBeGreaterThan(KNOW_MAP.y + KNOW_MAP.h);
      expect(at(card.names.known)).toBeGreaterThan(at(String(card.counts.known)));
      expect(at(card.site)).toBeGreaterThan(at(card.names.known) + 40);
    }
    // The long names are written smaller, and still large enough to be read.
    const { pen, calls } = recorder();
    paintKnowCard(pen, long);
    const legend = texts(calls).find((c) => c.args[0] === 'sabidas de memoria')!;
    expect(sizeOf(legend)).toBeLessThan(26);
    expect(sizeOf(legend)).toBeGreaterThanOrEqual(16);
  });

  it('shares a bar out among the grades, as the map is', () => {
    const { pen, calls } = recorder();
    paintKnowCard(pen, info);
    const width = CARD_SIZE - 2 * 64;
    const bar = calls.filter((c) => c.op === 'fillRect' && c.args[3] === 20);
    expect(bar.map((c) => c.fill)).toEqual([gradeFill('known'), gradeFill('learning'), gradeFill('due')]);
    expect(bar.map((c) => Math.round(c.args[2] as number))).toEqual([104, 34, 14].map((n) => Math.round((width * n) / 198)));
    // One after another, from the left margin; what has not been seen is the rest of the bar.
    expect(bar[0].args[0]).toBe(64);
    expect(bar[1].args[0]).toBeCloseTo(64 + (width * 104) / 198, 6);
    expect(bar[2].args[0]).toBeCloseTo(64 + (width * 138) / 198, 6);
    expect((bar[2].args[0] as number) + (bar[2].args[2] as number)).toBeLessThan(64 + width);
  });

  it('leaves a grade with nothing in it out of the bar, and never divides by nothing', () => {
    const none = recorder();
    paintKnowCard(none.pen, { ...info, counts: { known: 0, learning: 0, due: 0, new: 0 } });
    expect(none.calls.filter((c) => c.op === 'fillRect' && c.args[3] === 20)).toHaveLength(0);
    for (const c of none.calls) for (const a of c.args) if (typeof a === 'number') expect(Number.isFinite(a), c.op).toBe(true);

    const one = recorder();
    paintKnowCard(one.pen, { ...info, counts: { known: 5, learning: 0, due: 0, new: 0 } });
    const bar = one.calls.filter((c) => c.op === 'fillRect' && c.args[3] === 20);
    expect(bar).toHaveLength(1);
    expect(bar[0].args[2]).toBe(CARD_SIZE - 2 * 64);
  });

  it('paints each piece by how well it is known, and the legend in the same colours', () => {
    // A map of 100 by 50: three large pieces, each of a grade, and one not seen.
    const art: KnowArt = {
      pieces: [piece('known', 'known', 10, 10, 30), piece('learning', 'learning', 40, 10, 30), piece('due', 'due', 70, 10, 30), piece('new', 'new', 50, 40, 30)],
      around: ['greenland'],
      box: [0, 0, 100, 50],
      whole: false,
    };
    const { pen, calls } = recorder();
    paintKnowCard(pen, info, { art, path: make });
    const filled = calls.filter((c) => c.op === 'fill' && c.args.length === 1).map((c) => [(c.args[0] as unknown as { d: string }).d, c.fill]);
    expect(filled).toEqual([
      ['greenland', '#ebe4d5'],
      ['known', '#8fd1a9'],
      ['learning', '#f3cf6f'],
      ['due', '#f19a55'],
      ['new', '#fdf6e3'],
    ]);
    // Each piece with its outline.
    expect(calls.filter((c) => c.op === 'stroke' && c.args.length === 1)).toHaveLength(5);
    // The land around is not cut where the map is of a part of the world: the map is a window on it.
    expect(calls.filter((c) => c.op === 'clip')).toHaveLength(2);
    // The four squares of the legend, in the order they are told.
    const squares = calls.filter((c, i) => c.op === 'fill' && c.args.length === 0 && calls[i + 1]?.op === 'stroke' && calls[i + 2]?.op === 'fillText');
    expect(squares.map((c) => c.fill)).toEqual(KNOW_GRADES.map((g) => gradeFill(g)));
  });

  it('uses the colours of the palette for colour blindness when the player does', () => {
    expect(KNOW_GRADES.map((g) => gradeFill(g))).toEqual(['#8fd1a9', '#f3cf6f', '#f19a55', '#fdf6e3']);
    expect(KNOW_GRADES.map((g) => gradeFill(g, true))).toEqual(['#74b9ea', '#f0e442', '#cc79a7', '#fdf6e3']);
    const art: KnowArt = { pieces: [piece('known', 'known', 10, 10, 30), piece('due', 'due', 70, 10, 30)], around: [], box: [0, 0, 100, 50], whole: false };
    const { pen, calls } = recorder();
    paintKnowCard(pen, { ...info, cb: true }, { art, path: make });
    const fills = new Set(calls.filter((c) => c.op === 'fill' || c.op === 'fillRect').map((c) => c.fill));
    for (const colour of ['#74b9ea', '#f0e442', '#cc79a7']) expect(fills).toContain(colour);
    for (const colour of ['#8fd1a9', '#f3cf6f', '#f19a55']) expect(fills).not.toContain(colour);
  });

  it('puts a ring on a piece too small to be seen, what is known on top of what is not', () => {
    // The map takes the height of its box: 50 units in 408 points of the picture, a little over eight to one.
    const k = (KNOW_MAP.h - 44) / 50;
    const below = (KNOW_RING_BELOW - 0.5) / k;
    const above = (KNOW_RING_BELOW + 0.5) / k;
    const art: KnowArt = {
      pieces: [piece('big', 'known', 50, 25, 40), piece('speck-known', 'known', 20, 20, below), piece('speck-new', 'new', 21, 20, below), piece('nearly', 'due', 80, 20, above), piece('speck-due', 'due', 60, 30, 0.02)],
      around: [],
      box: [0, 0, 100, 50],
      whole: false,
    };
    const { pen, calls } = recorder();
    paintKnowCard(pen, info, { art, path: make });
    // A ring is a box with corners as round as it is wide, filled and outlined. The ones on the map come after the
    // sea it is drawn on and before the words under it (the square of the name of the game, above, has such corners too).
    const sea = calls.findIndex((c) => c.op === 'fill' && c.fill === '#d8e6e3');
    const firstText = calls.findIndex((c) => c.op === 'fillText' && c.args[0] === '104');
    expect(sea).toBeGreaterThan(0);
    expect(firstText).toBeGreaterThan(sea);
    const onMap = (i: number): boolean => i > sea && i < firstText;
    const rings = calls.filter((c, i) => onMap(i) && c.op === 'arcTo' && c.args[4] === KNOW_RING && calls[i + 4]?.op === 'fill').length;
    expect(rings).toBe(3);
    const colours = calls.filter((c, i) => onMap(i) && c.op === 'fill' && c.args.length === 0 && calls[i - 1]?.op === 'closePath' && calls[i - 2]?.args[4] === KNOW_RING).map((c) => c.fill);
    // What has not been seen first, then what is due, then what is known: the last one drawn is the one on top.
    expect(colours).toEqual([gradeFill('new'), gradeFill('due'), gradeFill('known')]);
    // Each ring is where its piece is: the middle of the map is the middle of its box.
    const starts = calls.filter((c, i) => onMap(i) && c.op === 'moveTo' && calls[i + 1]?.op === 'arcTo' && calls[i + 1].args[4] === KNOW_RING).map((c) => c.args as [number, number]);
    const centre = (x: number, y: number): [number, number] => [KNOW_MAP.x + KNOW_MAP.w / 2 + (x - 50) * k, KNOW_MAP.y + KNOW_MAP.h / 2 + (y - 25) * k - KNOW_RING];
    expect(starts).toHaveLength(3);
    for (const [i, [x, y]] of [
      [21, 20],
      [60, 30],
      [20, 20],
    ].entries()) {
      expect(starts[i][0]).toBeCloseTo(centre(x, y)[0], 6);
      expect(starts[i][1]).toBeCloseTo(centre(x, y)[1], 6);
    }
  });

  it('cuts the land around at the box of the pieces where the whole planet is shown', () => {
    const art: KnowArt = { pieces: [piece('a', 'known', 10, 10, 30)], around: ['antarctica'], box: [0, 0, 100, 50], whole: true };
    const { pen, calls } = recorder();
    paintKnowCard(pen, info, { art, path: make });
    // One clip more than otherwise (the map in its box, the land around in the box of the pieces, the bar): the box itself, corner by corner.
    expect(calls.filter((c) => c.op === 'clip')).toHaveLength(3);
    const clip = calls.findIndex((c, i) => c.op === 'clip' && calls[i - 1]?.op === 'closePath' && calls[i - 2]?.op === 'lineTo');
    expect(calls.slice(clip - 5, clip - 1).map((c) => c.args)).toEqual([
      [0, 0],
      [100, 0],
      [100, 50],
      [0, 50],
    ]);
    // And it is undone before the pieces are drawn: they are never cut.
    const land = calls.findIndex((c) => c.op === 'fill' && (c.args[0] as unknown as { d?: string })?.d === 'antarctica');
    const own = calls.findIndex((c) => c.op === 'fill' && (c.args[0] as unknown as { d?: string })?.d === 'a');
    expect(land).toBeGreaterThan(clip);
    expect(calls.slice(land, own).some((c) => c.op === 'restore')).toBe(true);
  });

  it('draws the sea alone when there is no map to draw', () => {
    for (const extras of [{}, { art: null, path: make }, { art: { pieces: [], around: ['x'], box: [0, 0, 1, 1] as KnowArt['box'], whole: false }, path: make }, { art: { pieces: [piece('a', 'known', 0, 0, 1)], around: [], box: [0, 0, 1, 1] as KnowArt['box'], whole: false } }]) {
      const { pen, calls } = recorder();
      paintKnowCard(pen, info, extras);
      expect(calls.filter((c) => c.op === 'fill' && c.args.length === 1)).toHaveLength(0);
      expect(calls.some((c) => c.op === 'fill' && c.fill === '#d8e6e3')).toBe(true);
      expect(written(calls)).toContain('104');
    }
  });
});

describe('the map of a deck as the picture draws it', () => {
  const square = (x: number, y: number, side: number): LL[] => [
    [x, y],
    [x, y + side],
    [x + side, y + side],
    [x + side, y],
    [x, y],
  ];
  const item = (id: string, x: number, y: number, side: number, far?: [number, number]) => ({
    id,
    shape: 'area',
    geo: { type: 'Feature', properties: {}, geometry: far ? { type: 'MultiPolygon', coordinates: [[square(x, y, side)], [square(far[0], far[1], 0.2)]] } : { type: 'Polygon', coordinates: [square(x, y, side)] } },
    lp: [x + side / 2, y + side / 2],
    // The points its frame is made of: its own corners, not those of what it has far away.
    fp: square(x, y, side).slice(0, 4),
  });
  const deck = (items: ReturnType<typeof item>[], frame: LL[], context: unknown[] = []): Deck => ({ items, frame, context }) as unknown as Deck;

  it('gives each piece its grade, and takes what has no grade for not seen', () => {
    // Three squares side by side, two degrees each, and a speck: a map of a small country.
    const items = [item('a', 0, 40, 2), item('b', 2, 40, 2), item('c', 4, 40, 2), item('d', 5, 43, 0.05)];
    const frame = items.flatMap((it) => it.fp);
    const art = knowArt(
      deck(items, frame),
      new Map<string, Grade>([
        ['a', 'known'],
        ['b', 'learning'],
        ['c', 'due'],
      ]),
    );
    expect(art.pieces.map((p) => p.grade)).toEqual(['known', 'learning', 'due', 'new']);
    expect(art.whole).toBe(false);
    expect(art.around).toEqual([]);
    for (const p of art.pieces) expect(p.d).toMatch(/^M/);
    // The three squares are as large as each other, and the speck forty times smaller.
    const [a, b, c, d] = art.pieces;
    expect(b.size / a.size).toBeCloseTo(1, 1);
    expect(c.size / a.size).toBeCloseTo(1, 1);
    expect(a.size / d.size).toBeGreaterThan(30);
    // From west to east, at the same height: the middle one is in the middle of the box.
    expect(a.x).toBeLessThan(b.x);
    expect(b.x).toBeLessThan(c.x);
    expect(Math.abs(a.y - c.y)).toBeLessThan(a.size * 0.05);
    // The box holds every piece, and nothing but them.
    const [x0, y0, x1, y1] = art.box;
    for (const p of art.pieces) {
      expect(p.x).toBeGreaterThan(x0);
      expect(p.x).toBeLessThan(x1);
      expect(p.y).toBeGreaterThan(y0);
      expect(p.y).toBeLessThan(y1);
    }
    expect(x1 - x0).toBeLessThan(a.size * 3.4);
    expect(y1 - y0).toBeLessThan(a.size * 2);
  });

  it('measures a piece without what it has far away, as the map of the game does', () => {
    // The same square, alone and with an islet twenty degrees to the south that its frame leaves out.
    const near = item('a', 0, 40, 2);
    const far = item('a', 0, 40, 2, [1, 20]);
    const frame = [...near.fp, [8, 40] as LL, [8, 42] as LL];
    const one = knowArt(deck([near], frame), new Map());
    const two = knowArt(deck([far], frame), new Map());
    expect(two.pieces[0].size).toBeCloseTo(one.pieces[0].size, 6);
    expect(two.pieces[0].x).toBeCloseTo(one.pieces[0].x, 6);
    // The islet is drawn all the same: it is part of the path. The box does not go as far as it: it is the one the game frames.
    expect(two.pieces[0].d.length).toBeGreaterThan(one.pieces[0].d.length);
    expect(two.box[3] - two.box[1]).toBeLessThan(one.pieces[0].size * 3);
  });

  it('says when the whole planet is shown, and brings the land that is not asked', () => {
    const items = [item('a', -100, 40, 20), item('b', 100, -40, 20), item('c', 0, 0, 20), item('d', -60, -40, 20), item('e', 120, 50, 20)];
    const frame: LL[] = [
      [-170, 70],
      [170, 70],
      [170, -55],
      [-170, -55],
      [0, 0],
    ];
    const around = [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [square(-50, 60, 20)] } }];
    const art = knowArt(deck(items, frame, around), new Map());
    expect(art.whole).toBe(true);
    expect(art.pieces).toHaveLength(5);
    expect(art.around).toHaveLength(1);
    expect(art.around[0]).toMatch(/^M/);
    for (const p of art.pieces) expect(p.grade).toBe('new');
  });
});
