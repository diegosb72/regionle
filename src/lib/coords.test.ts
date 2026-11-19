import fs from 'node:fs';
import path from 'node:path';
import { geoContains } from 'd3-geo';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GRID_CELLS, GRID_STEPS, coordDigits, coordOf, coordOptions, extentOf, fmtCoord, fmtDeg, fmtLat, fmtLon, gridLines, gridStep, roundCoord, sayCoord } from './coords';
import { buildDeck, loadIndex, setLoader } from './data';
import { buildCityDeck } from './extra';
import { tolerances } from './geo';
import { setLang } from './i18n';
import { mulberry32 } from './text';
import type { Item, LL } from './types';

let world: string[];

beforeAll(async () => {
  setLoader(async (p) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data', p), 'utf8')));
  const { index } = await loadIndex();
  world = index.countries.filter((c) => c.cl === 'un').map((c) => c.id);
});

/** The corners of a box of the map, as a frame gives them. */
const box = (west: number, south: number, east: number, north: number): LL[] => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
];
const SPAIN = box(-18.2, 27.6, 4.3, 43.8);
const EUROPE = box(-23.5, 34.6, 48.5, 70.9);
/** A frame of the world has points all the way round. */
const WORLD: LL[] = Array.from({ length: 24 }, (_, i) => [[-180 + i * 15, -55], [-180 + i * 15, 83]] as LL[]).flat();

beforeEach(() => setLang('es'));

describe('coordinates as they are written', () => {
  it('give the hemisphere with a letter, and none on the equator or at Greenwich', () => {
    expect(fmtDeg(-3.74, 1)).toBe('3,7°');
    expect(fmtLat(40)).toBe('40° N');
    expect(fmtLat(-33.9, 1)).toBe('33,9° S');
    expect(fmtLat(0)).toBe('0°');
    // What rounds to nothing is nothing: no "0° S".
    expect(fmtLat(-0.04, 1)).toBe('0°');
    expect(fmtLon(-4)).toBe('4° O');
    expect(fmtLon(2.2, 1)).toBe('2,2° E');
    expect(fmtLon(0)).toBe('0°');
    expect(fmtLon(180)).toBe('180°');
    expect(fmtLon(-180)).toBe('180°');
    expect(fmtCoord([-3.7, 40.4], 1)).toBe('40,4° N · 3,7° O');
    expect(fmtCoord([-3.7, 40.4])).toBe('40° N · 4° O');
    expect(sayCoord([-3.7, 40.4])).toBe('40 grados norte, 4 grados oeste');
    expect(sayCoord([1, 0])).toBe('0 grados, 1 grado este');
  });

  it('are written with a W and a point in English', () => {
    setLang('en');
    expect(fmtLon(-4)).toBe('4° W');
    expect(fmtCoord([-3.7, 40.4], 1)).toBe('40.4° N · 3.7° W');
    expect(sayCoord([-3.7, -40.4], 1)).toBe('40.4 degrees south, 3.7 degrees west');
  });

  it('are rounded to what the map can tell apart', () => {
    expect(roundCoord([-3.703, 40.416], 1)).toEqual([-3.7, 40.4]);
    expect(roundCoord([-3.703, 40.416], 0)).toEqual([-4, 40]);
    // Never a negative zero, and a longitude of its own for the far side of the world.
    expect(Object.is(roundCoord([-0.2, -0.3], 0)[0], 0)).toBe(true);
    expect(Object.is(roundCoord([-0.2, -0.3], 0)[1], 0)).toBe(true);
    expect(roundCoord([-179.8, 10], 0)).toEqual([180, 10]);
    expect(roundCoord([181, 10], 0)).toEqual([-179, 10]);
    // Tenths on a map where what counts as right is less than a degree.
    expect(coordDigits(66)).toBe(1);
    expect(coordDigits(15)).toBe(1);
    expect(coordDigits(165)).toBe(0);
    expect(coordDigits(500)).toBe(0);
  });
});

describe('the grid of a map', () => {
  it('spans what the frame spans, around its own middle', () => {
    expect(extentOf(SPAIN)).toEqual({ south: 27.6, north: 43.8, west: -18.2, east: 4.3 });
    // Across the antimeridian: from 170° E to 170° W there are twenty degrees, not three hundred and forty.
    const pacific = extentOf(box(170, -20, -170, -10));
    expect(pacific.east - pacific.west).toBeCloseTo(20);
    expect(pacific.south).toBe(-20);
    expect(extentOf(WORLD)).toEqual({ south: -55, north: 83, west: -180, east: 180 });
    expect(extentOf([])).toMatchObject({ west: -180, east: 180 });
    // The points of a frame come in no order.
    expect(extentOf([...SPAIN].reverse())).toEqual(extentOf(SPAIN));
  });

  it('is as fine as the map allows without crowding it', () => {
    expect(gridStep(SPAIN)).toBe(2);
    expect(gridStep(EUROPE)).toBe(5);
    expect(gridStep(WORLD)).toBe(30);
    // Belgium is not four degrees across, and Andorra not half of one.
    expect(gridStep(box(2.6, 49.5, 6.4, 51.5))).toBe(0.5);
    expect(gridStep(box(1.41, 42.43, 1.79, 42.66))).toBe(0.1);
    // Russia runs from the Baltic to beyond the antimeridian.
    expect(gridStep(box(19.7, 41.2, -170.5, 77.4))).toBe(15);
    for (const frame of [SPAIN, EUROPE, WORLD]) {
      const { south, north, west, east } = extentOf(frame);
      const step = gridStep(frame);
      expect(GRID_STEPS).toContain(step);
      expect(Math.max(north - south, east - west) / step).toBeLessThanOrEqual(GRID_CELLS);
    }
  });

  it('has a line at every multiple of its step, and a cell to spare around the frame', () => {
    const lines = gridLines(SPAIN, 2);
    const lats = lines.filter((l) => l.kind === 'lat').map((l) => l.at);
    const lons = lines.filter((l) => l.kind === 'lon').map((l) => l.at);
    // The frame runs from 27,6° to 43,8° N and from 18,2° W to 4,3° E: five cells to spare on every side.
    expect(lats).toEqual([18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52]);
    expect(lons[0]).toBe(-28);
    expect(lons[lons.length - 1]).toBe(14);
    expect(lons).toHaveLength(22);
    expect(lons).toContain(0);
    // A parallel keeps its latitude from end to end, and runs past the last meridian on both sides.
    const p40 = lines.find((l) => l.kind === 'lat' && l.at === 40)!;
    expect(p40.points.every((p) => p[1] === 40)).toBe(true);
    expect(p40.points[0][0]).toBeLessThan(-28);
    expect(p40.points[p40.points.length - 1][0]).toBeGreaterThan(14);
    expect(p40.points.length).toBeGreaterThan(50);
    const m0 = lines.find((l) => l.kind === 'lon' && l.at === 0)!;
    expect(m0.points.every((p) => p[0] === 0)).toBe(true);
    expect(m0.points[0][1]).toBeLessThan(18);
  });

  it('goes all the way round on a map of the world, and stops short of the poles', () => {
    const lines = gridLines(WORLD, 30);
    expect(lines.filter((l) => l.kind === 'lat').map((l) => l.at)).toEqual([-60, -30, 0, 30, 60]);
    expect(lines.filter((l) => l.kind === 'lon').map((l) => l.at)).toEqual([180, -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150]);
    for (const l of lines) for (const p of l.points) expect(Math.abs(p[1])).toBeLessThanOrEqual(89);
  });

  it('names its meridians between −180 and 180 on a map across the antimeridian', () => {
    const lines = gridLines(box(170, -20, -170, -10), 5);
    expect(lines.filter((l) => l.kind === 'lon').map((l) => l.at)).toEqual([155, 160, 165, 170, 175, 180, -175, -170, -165, -160, -155]);
  });
});

describe('the coordinates a piece is asked by', () => {
  const named = (items: readonly Item[], digits: 0 | 1) => new Map(items.map((it) => [it.name, coordOf(it, digits)]));

  it('are whole degrees on a map of the world, and always a point of the piece itself', async () => {
    const deck = await buildDeck({ scope: 'countries', countries: world, levels: {} });
    // What counts as right on the world is some five hundred kilometres: a degree is fine enough.
    expect(coordDigits(tolerances(deck.frame).ok)).toBe(0);
    const at = named(deck.items, 0);
    expect(at.get('España')).toEqual({ ll: [-4, 39], digits: 0 });
    expect(at.get('Canadá')).toEqual({ ll: [-110, 55], digits: 0 });
    expect(at.get('Australia')!.digits).toBe(0);
    // A country that a whole degree would miss is given in tenths.
    expect(at.get('Andorra')).toEqual({ ll: [1.6, 42.5], digits: 1 });
    expect(at.get('Singapur')!.digits).toBe(1);
    expect(at.get('Liechtenstein')!.digits).toBe(1);
    // And one that tenths would miss too is not asked: Monaco is two kilometres across.
    expect(at.get('Mónaco')).toBeNull();
    expect(at.get('San Marino')).toBeNull();
    expect(at.get('Nauru')).toBeNull();
    const none = [...at].filter(([, c]) => !c).map(([name]) => name);
    expect(none.length).toBeLessThan(10);
    for (const it of deck.items) {
      const c = coordOf(it, 0);
      if (c) expect(geoContains(it.geo, c.ll), it.name).toBe(true);
    }
    // No two pieces are asked by the same point.
    const points = [...at.values()].filter((c) => c).map((c) => c!.ll.join('|'));
    expect(new Set(points).size).toBe(points.length);
  });

  it('are tenths of a degree on the map of a country', async () => {
    const deck = await buildDeck({ scope: 'regions', countries: ['ES'], levels: { ES: 'g1' } });
    expect(coordDigits(tolerances(deck.frame).ok)).toBe(1);
    const at = named(deck.items, 1);
    expect(at.get('Castilla y León')).toEqual({ ll: [-4.7, 41.8], digits: 1 });
    // A point on one of the islands, not in the sea between them.
    const canaries = deck.items.find((it) => it.name === 'Canarias')!;
    expect(geoContains(canaries.geo, at.get('Canarias')!.ll)).toBe(true);
    // Never whole degrees here, even where they would fall inside.
    for (const c of at.values()) if (c) expect(c.digits).toBe(1);
    expect(at.get('Melilla')).toBeNull();
  });

  it('are where a city is, to the tenth of a degree, whatever the map', async () => {
    const deck = await buildCityDeck(['ES'], 'top', 25);
    const bilbao = deck.items.find((it) => it.name === 'Bilbao')!;
    expect(coordOf(bilbao, 0)).toEqual({ ll: [-2.9, 43.3], digits: 1 });
    expect(coordOf(bilbao, 1)).toEqual({ ll: [-2.9, 43.3], digits: 1 });
    // A river is a line: it has no point to be asked by.
    expect(coordOf({ ...bilbao, shape: 'line' }, 1)).toBeNull();
  });
});

describe('the coordinates offered for a marked point', () => {
  const same = (a: LL, b: LL) => a[0] === b[0] && a[1] === b[1];
  const SPAIN: LL = [-4.7, 41.8];

  it('are four, the right ones among them, each a cell of the grid away from them at the least', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const options = coordOptions(SPAIN, 2, 1, mulberry32(seed));
      expect(options, String(seed)).toHaveLength(4);
      expect(new Set(options.map((o) => o.join('|'))).size).toBe(4);
      expect(options.filter((o) => same(o, SPAIN))).toHaveLength(1);
      for (const o of options) {
        if (same(o, SPAIN)) continue;
        expect(Math.abs(o[1] - SPAIN[1]) >= 2 || Math.abs(o[0] - SPAIN[0]) >= 2, `${seed}: ${o}`).toBe(true);
        expect(Math.abs(o[1])).toBeLessThanOrEqual(85);
        expect(Math.abs(o[0])).toBeLessThanOrEqual(180);
        // Tenths, as the point is given: no option stands out by its decimals.
        expect(Math.round(o[0] * 10) / 10).toBe(o[0]);
        expect(Math.round(o[1] * 10) / 10).toBe(o[1]);
      }
    }
  });

  it('cannot be told by counting what the options share', () => {
    // Whoever picks "the latitude and the longitude that come up most" gets nowhere: every option has as much in common with the rest.
    for (const [ll, step, digits] of [
      [SPAIN, 2, 1],
      [[6, 52], 5, 0],
      [[-110, 55], 30, 0],
      [[151.2, -33.9], 0.5, 1],
    ] as [LL, number, number][]) {
      for (let seed = 1; seed <= 60; seed++) {
        const options = coordOptions(ll, step, digits, mulberry32(seed));
        const times = (i: 0 | 1, v: number) => options.filter((o) => o[i] === v).length;
        const scores = options.map((o) => times(0, o[0]) + times(1, o[1]));
        expect(new Set(scores).size, `${ll} ${seed}: ${JSON.stringify(options)}`).toBe(1);
      }
    }
  });

  it('are every slip in turn: a line off, the other hemisphere, one number for the other', () => {
    const seen = new Set<string>();
    const places = new Set<number>();
    for (let seed = 1; seed <= 80; seed++) {
      const options = coordOptions(SPAIN, 2, 1, mulberry32(seed));
      places.add(options.findIndex((o) => same(o, SPAIN)));
      const wrong = options.filter((o) => !same(o, SPAIN));
      if (wrong.some((o) => same(o, [4.7, 41.8]))) seen.add('east for west');
      else if (wrong.some((o) => same(o, [-4.7, -41.8]))) seen.add('south for north');
      else if (wrong.some((o) => same(o, [-41.8, 4.7]))) seen.add('one for the other');
      else {
        // Lines off alone: the same hemispheres, and each number either right or a line or two away.
        seen.add('lines');
        for (const o of wrong) {
          expect(o[0]).toBeLessThan(0);
          expect(o[1]).toBeGreaterThan(0);
          expect([0, 2, 4]).toContain(Math.round(Math.abs(o[0] - SPAIN[0]) * 10) / 10);
          expect([0, 2, 4]).toContain(Math.round(Math.abs(o[1] - SPAIN[1]) * 10) / 10);
        }
      }
    }
    expect([...seen].sort()).toEqual(['east for west', 'lines', 'one for the other', 'south for north']);
    expect(places.size).toBe(4);
    // The same game offers the same ones in the same order.
    const text = (seed: number) => coordOptions(SPAIN, 2, 1, mulberry32(seed)).map((o) => o.join('|')).join(' ');
    expect(text(7)).toBe(text(7));
    expect(new Set([1, 2, 3, 4, 5, 6].map(text)).size).toBeGreaterThan(3);
  });

  it('keep a line off on the map where there is room for it', () => {
    // Galicia, at the top of a map that ends at 43,8° N and begins at 18,2° O.
    const inside = ([lon, lat]: LL) => lat >= 27.6 && lat <= 43.8 && lon >= -18.2 && lon <= 4.3;
    const galicia: LL = [-8, 42.8];
    const lats = new Set<number>();
    const lons = new Set<number>();
    for (let seed = 1; seed <= 80; seed++) {
      for (const o of coordOptions(galicia, 2, 1, mulberry32(seed), inside)) {
        // What keeps the hemispheres and the order is a line off: it is on the map.
        if (o[0] < 0 && o[1] > 20) {
          expect(inside(o), `${seed}: ${o}`).toBe(true);
          lats.add(o[1]);
          lons.add(o[0]);
        }
      }
    }
    // No parallel north of Galicia fits; both sides do along the parallel, a line off or two.
    expect([...lats].sort()).toEqual([38.8, 40.8, 42.8]);
    expect([...lons].sort((a, b) => a - b)).toEqual([-12, -10, -8, -6, -4]);
    // Without a map to keep to, the lines go either way.
    const free = new Set<number>();
    for (let seed = 1; seed <= 80; seed++) for (const o of coordOptions(galicia, 2, 1, mulberry32(seed))) if (o[0] < 0 && o[1] > 20) free.add(o[1]);
    expect([...free].sort()).toEqual([38.8, 40.8, 42.8, 44.8, 46.8]);
    // A map with no room at all still gets its four.
    for (let seed = 1; seed <= 20; seed++) expect(coordOptions(galicia, 2, 1, mulberry32(seed), () => false)).toHaveLength(4);
  });

  it('are still four where a slip is no slip, and stop short of the poles', () => {
    // Where the equator meets Greenwich there is no other side, and nothing to take for what.
    for (let seed = 1; seed <= 30; seed++) {
      const options = coordOptions([0, 0], 10, 0, mulberry32(seed));
      expect(options).toHaveLength(4);
      expect(new Set(options.map((o) => o.join('|'))).size).toBe(4);
      expect(options.filter((o) => same(o, [0, 0]))).toHaveLength(1);
    }
    // A degree east of Greenwich on a grid of five: the other side is too near to be told on the map.
    for (let seed = 1; seed <= 30; seed++) expect(coordOptions([1, 47], 5, 0, mulberry32(seed)).some((o) => same(o, [-1, 47]))).toBe(false);
    // Canada: a longitude of 110° is no latitude, and none goes past 85°.
    for (let seed = 1; seed <= 30; seed++) {
      const options = coordOptions([-110, 55], 30, 0, mulberry32(seed));
      expect(options).toHaveLength(4);
      for (const o of options) expect(Math.abs(o[1])).toBeLessThanOrEqual(85);
    }
    for (let seed = 1; seed <= 30; seed++) {
      const options = coordOptions([20, 78], 10, 0, mulberry32(seed));
      expect(options).toHaveLength(4);
      for (const o of options) expect(Math.abs(o[1])).toBeLessThanOrEqual(85);
    }
    // The far side of the world: no longitude past 180°.
    for (let seed = 1; seed <= 30; seed++) {
      const options = coordOptions([178, -18], 5, 0, mulberry32(seed));
      expect(options).toHaveLength(4);
      for (const o of options) expect(Math.abs(o[0])).toBeLessThanOrEqual(180);
    }
  });
});
