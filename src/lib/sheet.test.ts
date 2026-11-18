import fs from 'node:fs';
import path from 'node:path';
import { geoDistance } from 'd3-geo';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildDeck, setLoader } from './data';
import { buildCityDeck } from './extra';
import { PAGE, ROW, circleOf, farGroups, frameOf, landPlaces, layoutOf, numberBox, placeInsets, placeNumbers, readingOrder, type Numbered, type Place, type Spot } from './sheet';
import type { Deck, LL } from './types';

const area = (id: string, x: number, y: number, w = 100, h = 100): Spot => ({ id, kind: 'area', x, y, w, h });
const dot = (id: string, x: number, y: number): Spot => ({ id, kind: 'point', x, y, w: 0, h: 0 });
const BOX: [number, number, number, number] = [0, 0, 1000, 1000];
const FONT = 14;

/** The room each number takes, to see whether two of them are on top of each other. */
const rectOf = (p: Numbered): [number, number, number, number] => {
  const { w, h } = numberBox(p.n, FONT);
  return [p.x - w / 2, p.y - h / 2, p.x + w / 2, p.y + h / 2];
};
const clash = (a: Numbered, b: Numbered) => {
  const [p, q] = [rectOf(a), rectOf(b)];
  return p[0] < q[2] && p[2] > q[0] && p[1] < q[3] && p[3] > q[1];
};
const clashes = (list: Numbered[]) => list.flatMap((a, i) => list.slice(i + 1).filter((b) => clash(a, b)).map((b) => `${a.id}/${b.id}`));

describe('the order the pieces of a sheet are numbered in', () => {
  it('goes as a page is read: in rows from the top, from left to right in each', () => {
    const spots = [area('se', 900, 900), area('nw', 100, 100), area('ne', 900, 120), area('sw', 110, 880)];
    expect(readingOrder(spots)).toEqual(['nw', 'ne', 'sw', 'se']);
  });

  it('puts in one row what lies about level, whichever is a little higher', () => {
    // Nine in three rows of three, none exactly level with its neighbours.
    const spots = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => area(`${r}${c}`, 100 + c * 400, 100 + r * 400 + (c === 1 ? 30 : c === 2 ? -30 : 0))));
    expect(readingOrder(spots)).toEqual(['00', '01', '02', '10', '11', '12', '20', '21', '22']);
  });

  it('is one row for a map that is a line of things, and the same whatever order they come in', () => {
    const spots = [dot('c', 700, 500), dot('a', 100, 500), dot('b', 400, 500)];
    expect(readingOrder(spots)).toEqual(['a', 'b', 'c']);
    expect(readingOrder([...spots].reverse())).toEqual(['a', 'b', 'c']);
    expect(readingOrder([])).toEqual([]);
    expect(readingOrder([dot('x', 5, 5)])).toEqual(['x']);
  });
});

describe('where the numbers of a sheet go', () => {
  it('numbers from one, in the order given', () => {
    const spots = [area('a', 200, 200), area('b', 600, 200), area('c', 400, 700)];
    const placed = placeNumbers(spots, ['b', 'c', 'a'], { font: FONT, box: BOX });
    expect(placed.map((p) => [p.id, p.n])).toEqual([
      ['b', 1],
      ['c', 2],
      ['a', 3],
    ]);
  });

  it('puts a number inside a piece with room for it, on its label point', () => {
    const [p] = placeNumbers([area('a', 320, 410)], ['a'], { font: FONT, box: BOX });
    expect([p.x, p.y]).toEqual([320, 410]);
    expect(p.ring).toBeUndefined();
    expect(p.lead).toBeUndefined();
  });

  it('rings a speck and puts its number beside it, not on top', () => {
    const [p] = placeNumbers([area('a', 500, 500, 2, 2)], ['a'], { font: FONT, box: BOX });
    expect(p.ring).toBeGreaterThan(0);
    // To the east, clear of the ring.
    expect(p.y).toBe(500);
    expect(p.x - numberBox(1, FONT).w / 2).toBeGreaterThan(500 + p.ring!);
    expect(p.lead).toBeUndefined();
  });

  it('puts the number of a city beside its dot', () => {
    const [p] = placeNumbers([dot('a', 500, 500)], ['a'], { font: FONT, box: BOX });
    expect(p.y).toBe(500);
    expect(p.x).toBeGreaterThan(500);
    expect(p.ring).toBeUndefined();
  });

  it('keeps apart the numbers of cities that are close together', () => {
    // Five dots within the width of a number or two.
    const spots = [dot('a', 500, 500), dot('b', 512, 500), dot('c', 500, 512), dot('d', 512, 512), dot('e', 506, 506)];
    const placed = placeNumbers(spots, ['a', 'b', 'c', 'd', 'e'], { font: FONT, box: BOX });
    expect(placed).toHaveLength(5);
    expect(clashes(placed)).toEqual([]);
    // And none of them sits on a dot.
    for (const p of placed) {
      const r = rectOf(p);
      for (const s of spots) expect(s.x > r[0] && s.x < r[2] && s.y > r[1] && s.y < r[3]).toBe(false);
    }
  });

  it('joins with a line the number that had to go further out', () => {
    const spots = [dot('a', 500, 500), dot('b', 512, 500), dot('c', 500, 512), dot('d', 512, 512), dot('e', 506, 506)];
    const placed = placeNumbers(spots, ['a', 'b', 'c', 'd', 'e'], { font: FONT, box: BOX });
    const far = placed.filter((p) => p.lead);
    expect(far.length).toBeGreaterThan(0);
    for (const p of far) {
      const s = spots.find((x) => x.id === p.id)!;
      // It starts at the dot and ends at the edge of the number, not under it.
      expect([p.lead![0], p.lead![1]]).toEqual([s.x, s.y]);
      const r = rectOf(p);
      const [ex, ey] = [p.lead![2], p.lead![3]];
      expect(ex > r[0] + 0.01 && ex < r[2] - 0.01 && ey > r[1] + 0.01 && ey < r[3] - 0.01).toBe(false);
    }
  });

  it('keeps the numbers on the sheet, also for what lies at its edge', () => {
    const spots = [dot('e', 998, 500), dot('s', 500, 998), dot('se', 997, 997), area('n', 500, 1, 1, 1)];
    const placed = placeNumbers(spots, ['e', 's', 'se', 'n'], { font: FONT, box: BOX });
    for (const p of placed) {
      const r = rectOf(p);
      expect(r[0]).toBeGreaterThanOrEqual(0);
      expect(r[1]).toBeGreaterThanOrEqual(0);
      expect(r[2]).toBeLessThanOrEqual(1000);
      expect(r[3]).toBeLessThanOrEqual(1000);
    }
  });

  it('gives a number to everything, however crowded the map', () => {
    // Forty specks on the same spot: there is no room for all, and none is left out.
    const spots = Array.from({ length: 40 }, (_, i) => area(`s${i}`, 500 + (i % 3), 500 + (i % 2), 1, 1));
    const order = spots.map((s) => s.id);
    const placed = placeNumbers(spots, order, { font: FONT, box: BOX });
    expect(placed.map((p) => p.n)).toEqual(order.map((_, i) => i + 1));
  });

  it('moves the number of a big piece off the speck that lies on its label point', () => {
    const spots = [area('big', 500, 500, 300, 300), area('small', 500, 505, 3, 3)];
    const placed = placeNumbers(spots, ['small', 'big'], { font: FONT, box: BOX });
    const big = placed.find((p) => p.id === 'big')!;
    const small = placed.find((p) => p.id === 'small')!;
    // The ring of the speck stays in sight: the number of the big piece goes beside it, still well inside.
    expect([big.x, big.y]).not.toEqual([500, 500]);
    expect(Math.hypot(big.x - 500, big.y - 500)).toBeLessThan(60);
    expect(clash(big, small)).toBe(false);
    const r = rectOf(big);
    expect(500 > r[0] && 500 < r[2] && 505 > r[1] && 505 < r[3]).toBe(false);
    // A line from its label point says the number is that of the piece around it.
    expect(big.lead).toBeDefined();
  });

  it('numbers at the edge of the sheet a piece whose label point lies off it', () => {
    // Russia on the usual map of Europe: its centre is far to the east of what is printed.
    const spots = [area('ru', 1800, 300, 2000, 900), area('pl', 600, 500)];
    const placed = placeNumbers(spots, ['pl', 'ru'], { font: FONT, box: BOX });
    const ru = placed.find((p) => p.id === 'ru')!;
    const r = rectOf(ru);
    expect(r[2]).toBeLessThanOrEqual(1000);
    expect(r[2]).toBeGreaterThan(950);
    expect(ru.y).toBe(300);
    // It is inside its piece, as far as the sheet goes: no ring, no line.
    expect(ru.ring).toBeUndefined();
    expect(ru.lead).toBeUndefined();
  });

  it('writes the number of a river on its label point', () => {
    const [p] = placeNumbers([{ id: 'r', kind: 'line', x: 300, y: 300, w: 400, h: 20 }], ['r'], { font: FONT, box: BOX });
    expect([p.x, p.y]).toEqual([300, 300]);
  });
});

describe('how a sheet is laid out', () => {
  /** What the page has for map and list, as the layout takes it: the header is left out. */
  const roomOf = (l: { landscape: boolean }) => (l.landscape ? { w: PAGE.h, h: PAGE.w - 26 } : { w: PAGE.w, h: PAGE.h - 26 });

  it('gives the page to a map with nothing on it, lying down for one much wider than tall', () => {
    expect(layoutOf(2, 0).landscape).toBe(true);
    expect(layoutOf(1.3, 0).landscape).toBe(true);
    expect(layoutOf(0.4, 0).landscape).toBe(false);
    // Square-ish maps stand up, also where lying down would win a few millimetres: it is how a sheet is handed out.
    expect(layoutOf(1, 0).landscape).toBe(false);
    expect(layoutOf(1.2, 0).landscape).toBe(false);
    for (const ratio of [0.25, 0.8, 1, 1.3, 2, 3.5]) {
      const l = layoutOf(ratio, 0);
      const { w, h } = roomOf(l);
      expect(l.mapW).toBeLessThanOrEqual(w + 1e-9);
      expect(l.mapH).toBeLessThanOrEqual(h + 1e-9);
      expect(l.mapW / l.mapH).toBeCloseTo(ratio, 6);
      // It touches one of the two sides of the room there is.
      expect(l.mapW > w - 0.01 || l.mapH > h - 0.01).toBe(true);
      expect(l.split).toBe(false);
    }
  });

  it('puts a short list under the map, on the same page', () => {
    // The nineteen communities of Spain, on a map a little taller than wide.
    const l = layoutOf(0.91, 19);
    expect([l.landscape, l.side, l.split]).toEqual([false, false, false]);
    expect(l.columns).toBe(4);
    expect(l.row).toBe(ROW);
    expect(l.mapH + Math.ceil(19 / 4) * ROW).toBeLessThan(roomOf(l).h);
    expect(l.mapW).toBeGreaterThan(160);
  });

  it('lays the page down and puts the list beside the map where that leaves the map bigger', () => {
    // The fifty-two provinces: under the map they would leave it at little more than half the page.
    const l = layoutOf(0.91, 52);
    expect([l.landscape, l.side, l.split]).toEqual([true, true, false]);
    expect(l.columns).toBe(2);
    // The lines share the height of the page, and can still be written on.
    expect(l.row).toBeGreaterThanOrEqual(6);
    expect(l.row * Math.ceil(52 / 2)).toBeLessThanOrEqual(roomOf(l).h + 1e-9);
    expect(l.mapW + 2 * 42 + 6 + 6).toBeLessThanOrEqual(roomOf(l).w + 1e-9);
    expect(l.mapW).toBeGreaterThan(140);
  });

  it('puts the list beside a tall map without taking anything from it', () => {
    // Chile: the map leaves most of the width of the page free.
    const l = layoutOf(0.3, 16);
    expect([l.landscape, l.side, l.split]).toEqual([false, true, false]);
    expect(l.mapW).toBeCloseTo(layoutOf(0.3, 0).mapW, 6);
    expect(l.columns).toBe(1);
    expect(l.row).toBe(8);
  });

  it('gives the map a page and the list the next one when they cannot share', () => {
    // The countries of the world: two hundred names would leave a map of nothing.
    const l = layoutOf(2.05, 193);
    expect(l.split).toBe(true);
    expect(l.landscape).toBe(true);
    expect(l.mapW).toBe(layoutOf(2.05, 0).mapW);
    expect(l.side).toBe(false);
    expect(l.columns).toBe(5);
  });

  it('never leaves a map that shares its page at much less than what it would be alone', () => {
    for (const ratio of [0.3, 0.6, 0.91, 1.2, 1.6, 2.05]) {
      for (const count of [5, 19, 52, 100, 193, 400]) {
        const l = layoutOf(ratio, count);
        const alone = layoutOf(ratio, 0);
        if (l.split) expect(l.mapW, `${ratio}/${count}`).toBe(alone.mapW);
        else expect(l.mapW, `${ratio}/${count}`).toBeGreaterThanOrEqual(alone.mapW * 0.6 - 1e-9);
        const { w, h } = roomOf(l);
        expect(l.mapW, `${ratio}/${count}`).toBeLessThanOrEqual(w + 1e-9);
        expect(l.mapH, `${ratio}/${count}`).toBeLessThanOrEqual(h + 1e-9);
      }
    }
  });

  it('keeps to the way up that is asked for: the sheets of a print go the same way', () => {
    // The provinces again, for the answers of a sheet whose map stands up.
    const l = layoutOf(0.91, 52, false);
    expect(l.landscape).toBe(false);
    expect(l.split).toBe(false);
    expect(layoutOf(0.91, 0, true).landscape).toBe(true);
    expect(layoutOf(2.05, 193, false).landscape).toBe(false);
  });

  it('writes smaller digits on a map with many pieces', () => {
    expect(layoutOf(1, 19).digit).toBeGreaterThan(layoutOf(1, 52).digit);
    expect(layoutOf(1, 52).digit).toBeGreaterThan(layoutOf(1, 193).digit);
    // Still readable on paper: two millimetres at the least.
    expect(layoutOf(1, 5000).digit).toBeGreaterThanOrEqual(2);
  });
});

describe('the part of the map a sheet prints', () => {
  const LIMITS: [number, number, number, number] = [-500, -500, 1500, 1500];

  it('leaves some air around what is framed', () => {
    expect(frameOf([0, 0, 1000, 500], LIMITS)).toEqual([-50, -50, 1050, 550]);
  });

  it('does not go beyond what can be drawn', () => {
    expect(frameOf([-490, 0, 1490, 1000], LIMITS)).toEqual([-500, -99, 1500, 1099]);
  });

  it('is still something for a map of a single dot', () => {
    const f = frameOf([10, 10, 10, 10], LIMITS);
    expect(f[2] - f[0]).toBeGreaterThan(0);
    expect(f[3] - f[1]).toBeGreaterThan(0);
  });
});

describe('the smallest circle that holds some points', () => {
  const DEG = 180 / Math.PI;

  it('is centred between two points, half their distance wide', () => {
    const c = circleOf([
      [0, 0],
      [10, 0],
    ]);
    expect(c.centre[0]).toBeCloseTo(5, 1);
    expect(c.centre[1]).toBeCloseTo(0, 1);
    expect(c.radius).toBeCloseTo(5, 1);
  });

  it('is not pulled towards where most of the points are', () => {
    // Fifty points on one spot and one far away: the mean would sit on the fifty.
    const points: LL[] = [...Array.from({ length: 50 }, (): LL => [0, 40]), [20, 40]];
    const c = circleOf(points);
    expect(c.radius).toBeLessThan(8);
    expect(c.radius).toBeGreaterThan(7.5);
    for (const p of points) expect(geoDistance(c.centre, p) * DEG).toBeLessThanOrEqual(c.radius + 1e-6);
  });

  it('holds every point, across the line where the day changes too', () => {
    const points: LL[] = [
      [179, -17],
      [-178, -18],
      [177, -19],
      [-179.5, -16],
    ];
    const c = circleOf(points);
    for (const p of points) expect(geoDistance(c.centre, p) * DEG).toBeLessThanOrEqual(c.radius + 1e-6);
    expect(c.radius).toBeLessThan(4);
    expect(circleOf([]).radius).toBe(0);
    expect(circleOf([[3, 4]]).radius).toBeCloseTo(0, 4);
  });
});

describe('what lies far from the rest of a map', () => {
  /** A square piece of one degree with its corners as frame. */
  const piece = (id: string, lon: number, lat: number, size = 1, area = 10_000): Place => ({
    id,
    lp: [lon, lat],
    fp: [
      [lon - size / 2, lat - size / 2],
      [lon + size / 2, lat - size / 2],
      [lon + size / 2, lat + size / 2],
      [lon - size / 2, lat + size / 2],
    ],
    area,
  });
  /** A mainland of twenty pieces side by side. */
  const mainland = Array.from({ length: 20 }, (_, i) => piece(`m${i}`, (i % 5) - 2, 40 + Math.floor(i / 5)));

  it('is nothing on a map whose pieces touch', () => {
    expect(farGroups(mainland)).toEqual([]);
  });

  it('is the islands a long way off, together when they are near each other', () => {
    const far = farGroups([...mainland, piece('i1', -16, 28, 1, 4000), piece('i2', -14.5, 28.5, 1, 4000)]);
    expect(far).toHaveLength(1);
    expect([...far[0]].sort()).toEqual(['i1', 'i2']);
  });

  it('is a group for each of two archipelagos far from each other', () => {
    const far = farGroups([...mainland, piece('a', -28, 38, 1, 2000), piece('b', -17, 32, 1, 800)]);
    expect(far.map((g) => g.join()).sort()).toEqual(['a', 'b']);
  });

  it('leaves where it is an island a short way off the coast', () => {
    expect(farGroups([...mainland, piece('near', 4.5, 40, 1, 5000)])).toEqual([]);
  });

  it('leaves where it is a piece that costs the map next to nothing', () => {
    // Half a degree beyond the corner of a mainland five degrees across.
    expect(farGroups([...mainland, piece('spot', 3.5, 44.5, 0.2, 20)])).toEqual([]);
  });

  it('does not box half a country', () => {
    // Twelve pieces and twelve more ten degrees away: neither is a few islands.
    const two = [...Array.from({ length: 12 }, (_, i) => piece(`w${i}`, i % 4, 3 + Math.floor(i / 4))), ...Array.from({ length: 12 }, (_, i) => piece(`e${i}`, 14 + (i % 4), 3 + Math.floor(i / 4)))];
    expect(farGroups(two)).toEqual([]);
    // Nor a far piece as big as all the rest.
    expect(farGroups([...mainland, piece('huge', -30, 60, 6, 500_000)])).toEqual([]);
  });

  it('has nothing to say about a map of two or three things', () => {
    expect(farGroups([piece('a', 0, 0), piece('b', 40, 0), piece('c', 1, 0)])).toEqual([]);
    expect(farGroups([])).toEqual([]);
  });

  describe('on the maps of the game', () => {
    beforeAll(() => {
      setLoader(async (file) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data', file), 'utf8')));
    });
    const regions = async (id: string, level?: string) => {
      const deck = await buildDeck({ scope: 'regions', countries: [id], levels: level ? { [id]: level } : {} });
      return farGroups(deck.items.map((it) => ({ id: it.id, lp: it.lp, fp: it.fp, area: it.area }))).map((g) =>
        g
          .map((x) => deck.byId.get(x)!.name)
          .sort()
          .join(' + '),
      );
    };
    const cities = async (deck: Deck) => {
      const rings = (deck.base ?? []).flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map((poly) => poly[0])));
      const { places, landOf } = landPlaces(rings, deck.items);
      return farGroups(places).map((lands) =>
        deck.items
          .filter((it) => lands.includes(landOf.get(it.id)!))
          .map((it) => it.name)
          .sort()
          .join(' + '),
      );
    };

    it('boxes the Canary Islands, by provinces and by communities', async () => {
      expect(await regions('ES', 'f')).toEqual(['Las Palmas + Santa Cruz de Tenerife']);
      expect(await regions('ES', 'g1')).toEqual(['Canarias']);
    });

    it('boxes Alaska and Hawaii, the Azores and Madeira, the Galápagos', async () => {
      expect((await regions('US')).sort()).toEqual(['Alaska', 'Hawái']);
      expect((await regions('PT')).sort()).toEqual(['Azores', 'Madeira']);
      expect(await regions('EC')).toEqual(['Galápagos']);
    });

    it('leaves alone the countries whose islands are part of the map', async () => {
      for (const id of ['FR', 'IT', 'GR', 'JP', 'MY', 'AU', 'ID', 'GB', 'DK', 'TT', 'CO', 'IN', 'CL', 'RU']) expect(await regions(id), id).toEqual([]);
    });

    it('boxes the cities of far islands, by the land they stand on', async () => {
      expect(await cities(await buildCityDeck(['ES'], 'top', 25))).toEqual(['Las Palmas de Gran Canaria + Santa Cruz de Tenerife']);
      expect(await cities(await buildCityDeck(['ES'], 'regcaps', 10))).toEqual(['Las Palmas de Gran Canaria + Santa Cruz de Tenerife']);
      expect((await cities(await buildCityDeck(['PT'], 'top', 10))).sort()).toEqual(['Funchal', 'Ponta Delgada']);
    });

    it('leaves alone the cities of one land, however far apart', async () => {
      // No city of the Canaries among the ten largest: the map is the peninsula and nothing is far.
      expect(await cities(await buildCityDeck(['ES'], 'top', 10))).toEqual([]);
      for (const id of ['AU', 'US', 'IT', 'JP', 'GB', 'ID']) expect(await cities(await buildCityDeck([id], 'top', 25)), id).toEqual([]);
    });
  });
});

describe('the land the cities of a map stand on', () => {
  const square = (w: number, s: number, size: number): number[][] => [
    [w, s],
    [w + size, s],
    [w + size, s + size],
    [w, s + size],
    [w, s],
  ];
  const rings = [square(0, 0, 10), square(12, 2, 1), square(-20, -10, 2), square(30, 30, 1)];

  it('is the island for a city on an island, also where the box of a mainland holds it', () => {
    // An island in a bay: inside the box of the mainland ring, and a ring of its own.
    const bay = [square(0, 0, 10), square(4, 4, 1)];
    const { landOf } = landPlaces(bay, [
      { id: 'on-island', lp: [4.5, 4.5] },
      { id: 'on-mainland', lp: [1, 1] },
    ]);
    expect(landOf.get('on-island')).toBe('land:1');
    expect(landOf.get('on-mainland')).toBe('land:0');
  });

  it('counts the cities of each land and leaves out the land with none', () => {
    const { places, landOf, boxOf } = landPlaces(rings, [
      { id: 'a', lp: [2, 2] },
      { id: 'b', lp: [8, 8] },
      { id: 'c', lp: [12.5, 2.5] },
      { id: 'd', lp: [-19, -9] },
    ]);
    expect(places.map((p) => [p.id, p.count]).sort()).toEqual([
      ['land:0', 2],
      ['land:1', 1],
      ['land:2', 1],
    ]);
    expect(landOf.get('d')).toBe('land:2');
    expect(boxOf.get('land:2')).toEqual([-20, -10, -18, -8]);
    for (const p of places) expect(p.fp).toHaveLength(16);
  });

  it('takes the nearest land for a city the coast leaves in the water', () => {
    const { landOf } = landPlaces(rings, [{ id: 'port', lp: [13.2, 2.5] }]);
    expect(landOf.get('port')).toBe('land:1');
  });
});

describe('where the boxes of the far pieces go', () => {
  const FRAME: [number, number, number, number] = [0, 0, 1000, 800];
  const within = (b: number[], f: number[]) => b[0] >= f[0] && b[1] >= f[1] && b[2] <= f[2] && b[3] <= f[3];
  const cross = (a: number[], b: number[]) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

  it('is nothing to do without boxes', () => {
    expect(placeInsets(FRAME, [], [])).toEqual({ frame: FRAME, boxes: [] });
  });

  it('is the corner on the side the pieces really lie, where it is free', () => {
    // Pieces in the middle of the map; the far ones lie to the south-west.
    const { frame, boxes } = placeInsets(FRAME, [[300, 200, 700, 600]], [{ w: 200, h: 120, dx: -500, dy: 400 }]);
    expect(frame).toEqual(FRAME);
    expect(boxes).toHaveLength(1);
    const [b] = boxes;
    expect(within(b, FRAME)).toBe(true);
    expect(b[2] - b[0]).toBeCloseTo(200, 6);
    expect(b[3] - b[1]).toBeCloseTo(120, 6);
    // Bottom left.
    expect(b[0]).toBeLessThan(50);
    expect(b[3]).toBeGreaterThan(750);
  });

  it('is another corner when its own is taken by the map', () => {
    // The south-west corner is full of pieces: the box goes to the corner beside it, to the west or to the south.
    const { frame, boxes } = placeInsets(FRAME, [[0, 500, 400, 800]], [{ w: 200, h: 120, dx: -500, dy: 400 }]);
    expect(frame).toEqual(FRAME);
    expect(cross(boxes[0], [0, 500, 400, 800])).toBe(false);
    expect(within(boxes[0], FRAME)).toBe(true);
  });

  it('puts two boxes in two corners, never one on the other', () => {
    const { boxes } = placeInsets(
      FRAME,
      [[300, 200, 700, 600]],
      [
        { w: 200, h: 120, dx: -500, dy: 400 },
        { w: 150, h: 150, dx: -400, dy: 500 },
      ],
    );
    expect(cross(boxes[0], boxes[1])).toBe(false);
    for (const b of boxes) expect(cross(b, [300, 200, 700, 600])).toBe(false);
  });

  it('adds a strip under the map when no corner is free, and stands the boxes in it from west to east', () => {
    const full: [number, number, number, number][] = [[0, 0, 1000, 800]];
    const { frame, boxes } = placeInsets(FRAME, full, [
      { w: 200, h: 120, dx: 300, dy: 400 },
      { w: 150, h: 100, dx: -400, dy: 500 },
    ]);
    // The map keeps its width and grows down by the tallest box and its margins.
    expect([frame[0], frame[1], frame[2]]).toEqual([0, 0, 1000]);
    expect(frame[3]).toBeGreaterThan(800 + 120);
    expect(frame[3]).toBeLessThan(800 + 120 + 40);
    for (const b of boxes) {
      expect(within(b, frame)).toBe(true);
      // Under what the map had: no piece is covered.
      expect(b[1]).toBeGreaterThanOrEqual(800);
    }
    // The one that lies to the west stands to the west.
    expect(boxes[1][0]).toBeLessThan(boxes[0][0]);
    expect(cross(boxes[0], boxes[1])).toBe(false);
  });

  it('makes the boxes of the strip smaller when they do not fit side by side', () => {
    const full: [number, number, number, number][] = [[0, 0, 1000, 800]];
    const asks = [0, 1, 2].map((i) => ({ w: 450, h: 200, dx: i - 1, dy: 1 }));
    const { frame, boxes } = placeInsets(FRAME, full, asks);
    for (const b of boxes) {
      expect(within(b, frame)).toBe(true);
      expect(b[2] - b[0]).toBeLessThan(450);
      // Smaller, and the same shape.
      expect((b[2] - b[0]) / (b[3] - b[1])).toBeCloseTo(450 / 200, 6);
    }
    expect(cross(boxes[0], boxes[1]) || cross(boxes[1], boxes[2])).toBe(false);
  });
});

describe('numbers and the boxes of far pieces', () => {
  it('keep out of each other: no number of the map goes into a box', () => {
    // A dot right beside a box: its number goes to the other side.
    const box: [number, number, number, number] = [510, 480, 700, 560];
    const [p] = placeNumbers([dot('a', 500, 500)], ['a'], { font: FONT, box: BOX, avoid: [box] });
    const r = rectOf(p);
    expect(r[0] < box[2] && r[2] > box[0] && r[1] < box[3] && r[3] > box[1]).toBe(false);
    expect(p.x).toBeLessThan(500);
  });
});
