import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { feature } from 'topojson-client';
import { areaKm2, overlaid } from './geo';
import { setLang } from './i18n';
import { SAME_SIZE, TIMES_FROM, bothNames, compareSizes, scaleBar, sizeLine, timesText } from './sizes';
import type { AnyGeo, LL } from './types';
import { KM_PER_MILE, setUnits } from './units';

afterEach(() => {
  setLang('es');
  setUnits('km');
});

describe('two sizes set against each other', () => {
  it('says which is the larger and how many times the other it is', () => {
    expect(compareSizes(8_515_767, 505_990)).toMatchObject({ big: 0, kind: 'times' });
    expect(compareSizes(8_515_767, 505_990)!.ratio).toBeCloseTo(16.83, 2);
    expect(compareSizes(505_990, 8_515_767)).toMatchObject({ big: 1, kind: 'times' });
    expect(compareSizes(505_990, 8_515_767)!.ratio).toBeCloseTo(16.83, 2);
    // Under twice the size, it is told as so much per cent more; within a tenth, as the same.
    expect(compareSizes(150, 100)).toEqual({ big: 0, ratio: 1.5, kind: 'percent' });
    expect(compareSizes(100, 199)!.kind).toBe('percent');
    expect(compareSizes(100, 200)!.kind).toBe('times');
    expect(compareSizes(100, 109)!.kind).toBe('same');
    expect(compareSizes(100, 110.5)!.kind).toBe('percent');
    expect(compareSizes(100, 100)).toEqual({ big: 0, ratio: 1, kind: 'same' });
    expect(SAME_SIZE).toBe(1.1);
    expect(TIMES_FROM).toBe(2);
  });

  it('has nothing to say of what has no surface', () => {
    for (const [a, b] of [
      [0, 100],
      [100, 0],
      [-5, 100],
      [NaN, 100],
      [100, Infinity],
    ])
      expect(compareSizes(a, b), `${a} ${b}`).toBeNull();
    expect(sizeLine({ name: 'A', area: 0 }, { name: 'B', area: 10 })).toBe('');
  });

  it('writes how many times with a decimal only where it says something', () => {
    expect(timesText(2)).toBe('2');
    expect(timesText(2.44)).toBe('2,4');
    expect(timesText(9.96)).toBe('10');
    expect(timesText(16.83)).toBe('17');
    expect(timesText(99.4)).toBe('99');
    // Two figures of a large number: nobody counts to the last unit how many Maltas fit in Russia.
    expect(timesText(254)).toBe('250');
    expect(timesText(1234)).toBe('1200');
    expect(timesText(54_110)).toBe('54.000');
    expect(timesText(999_999)).toBe('1.000.000');
    setLang('en');
    expect(timesText(2.44)).toBe('2.4');
    expect(timesText(54_110)).toBe('54,000');
  });

  it('says it in a sentence, whichever of the two comes first', () => {
    const spain = { name: 'España', area: 505_990 };
    const brazil = { name: 'Brasil', area: 8_515_767 };
    const france = { name: 'Francia', area: 643_801 };
    const italy = { name: 'Italia', area: 301_340 };
    const poland = { name: 'Polonia', area: 312_696 };
    expect(sizeLine(spain, brazil)).toBe('Brasil es 17 veces más grande que España.');
    expect(sizeLine(brazil, spain)).toBe('Brasil es 17 veces más grande que España.');
    expect(sizeLine(spain, france)).toBe('Francia es un 27 % más grande que España.');
    expect(sizeLine(france, italy)).toBe('Francia es 2,1 veces más grande que Italia.');
    // Within a tenth of each other: in the order they were chosen.
    expect(sizeLine(italy, poland)).toBe('Italia y Polonia son casi igual de grandes.');
    // «y» is «e» before the sound of an i.
    expect(sizeLine(poland, italy)).toBe('Polonia e Italia son casi igual de grandes.');
    expect(bothNames('Irlanda', 'Islandia')).toBe('Irlanda e Islandia');
    expect(bothNames('Islandia', 'Hierro')).toBe('Islandia y Hierro');
    setLang('en');
    expect(sizeLine({ name: 'Spain', area: 505_990 }, { name: 'Brazil', area: 8_515_767 })).toBe('Brazil is 17 times the size of Spain.');
    expect(sizeLine({ name: 'Spain', area: 505_990 }, { name: 'France', area: 643_801 })).toBe('France is 27% larger than Spain.');
    expect(sizeLine({ name: 'Italy', area: 301_340 }, { name: 'Poland', area: 312_696 })).toBe('Italy and Poland are almost the same size.');
    expect(bothNames('Poland', 'Italy')).toBe('Poland and Italy');
  });
});

describe('the bar that says how far it is across the drawing', () => {
  it('is a round figure, the longest that fits in the room there is', () => {
    // Ten kilometres to the unit, and a hundred units of room: up to a thousand kilometres.
    expect(scaleBar(10, 100)).toEqual({ length: 100, label: '1000 km' });
    expect(scaleBar(10, 99)).toEqual({ length: 50, label: '500 km' });
    expect(scaleBar(10, 49)).toEqual({ length: 20, label: '200 km' });
    expect(scaleBar(10, 19)).toEqual({ length: 10, label: '100 km' });
    expect(scaleBar(0.5, 96)).toEqual({ length: 40, label: '20 km' });
    // Under a kilometre, with its decimal.
    expect(scaleBar(0.01, 96)!.label).toBe('0,5 km');
    for (const [km, room] of [
      [3.3, 96],
      [41, 96],
      [0.07, 96],
      [1234, 60],
    ]) {
      const bar = scaleBar(km, room)!;
      expect(bar.length, `${km}`).toBeLessThanOrEqual(room);
      // Never less than two fifths of the room: the next round figure up would be at most two and a half times as long.
      expect(bar.length, `${km}`).toBeGreaterThanOrEqual(room * 0.4);
      expect(Number(bar.label.replace(/[^\d]/g, '')[0]), bar.label).toSatisfy((d: number) => [1, 2, 5].includes(d));
    }
  });

  it('is told in miles to whoever reads in miles, and is round in miles', () => {
    setUnits('mi');
    const bar = scaleBar(10, 100)!;
    // A thousand kilometres are 621 miles: the bar is of 500.
    expect(bar.label).toBe('500 mi');
    expect(bar.length).toBeCloseTo((500 * KM_PER_MILE) / 10, 6);
  });

  it('is not there when there is no scale to tell', () => {
    for (const [km, room] of [
      [0, 100],
      [-1, 100],
      [NaN, 100],
      [10, 0],
      [Infinity, 10],
    ])
      expect(scaleBar(km, room), `${km} ${room}`).toBeNull();
  });
});

/** The points of a path of straight sides ("M1,2L3,4…Z"), ring by ring, and the surface they hold. */
function drawn(d: string): { area: number; box: [number, number, number, number] } {
  let area = 0;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of d.split('M').filter(Boolean)) {
    const pts = ring
      .replace(/Z/g, '')
      .split('L')
      .map((p) => p.split(',').map(Number) as [number, number]);
    let sum = 0;
    pts.forEach(([x, y], i) => {
      const [nx, ny] = pts[(i + 1) % pts.length];
      sum += x * ny - nx * y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    });
    area += Math.abs(sum) / 2;
  }
  return { area, box: [x0, y0, x1, y1] };
}

describe('two shapes one over the other', () => {
  const square = (lon: number, lat: number, side: number): AnyGeo => {
    // Sides of many points, so that each is drawn as the arc it is. Clockwise, as d3 wants what is inside.
    const ring: LL[] = [];
    const steps = 20;
    for (let i = 0; i < steps; i++) ring.push([lon, lat + (side * i) / steps]);
    for (let i = 0; i < steps; i++) ring.push([lon + (side * i) / steps, lat + side]);
    for (let i = 0; i < steps; i++) ring.push([lon + side, lat + side - (side * i) / steps]);
    for (let i = 0; i < steps; i++) ring.push([lon + side - (side * i) / steps, lat]);
    ring.push(ring[0]);
    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } } as AnyGeo;
  };

  it('measures a surface on the globe', () => {
    // A degree by a degree on the equator: some 111 km a side.
    expect(areaKm2(square(0, 0, 1))).toBeGreaterThan(12_300);
    expect(areaKm2(square(0, 0, 1))).toBeLessThan(12_400);
    // The same at sixty degrees north is half as wide.
    expect(areaKm2(square(0, 59.5, 1)) / areaKm2(square(0, -0.5, 1))).toBeCloseTo(0.5, 1);
  });

  it('draws both at the same scale, so that what is twice as large looks twice as large', () => {
    const SIZE = 240;
    for (const [a, b] of [
      [square(0, 0, 10), square(100, 0, 5)],
      [square(0, 0, 10), square(100, 50, 10)],
      [square(-70, -40, 4), square(20, 60, 30)],
      [square(10, 60, 20), square(-150, -5, 10)],
    ]) {
      const art = overlaid(a, b, SIZE);
      const [da, db] = [drawn(art.a), drawn(art.b)];
      // The surfaces on the drawing are to each other as the surfaces on the globe.
      expect(da.area / db.area).toBeCloseTo(areaKm2(a) / areaKm2(b), 1);
      // And each unit of the drawing is as many kilometres as it says: a surface in units, times km², is the surface.
      expect((da.area * art.km * art.km) / areaKm2(a)).toBeCloseTo(1, 1);
      // Each with the middle of its box in the middle of the square, and both inside it with its margin.
      for (const { box } of [da, db]) {
        expect((box[0] + box[2]) / 2).toBeCloseTo(SIZE / 2, 0);
        expect((box[1] + box[3]) / 2).toBeCloseTo(SIZE / 2, 0);
        expect(box[0]).toBeGreaterThanOrEqual(SIZE * 0.06 - 0.5);
        expect(box[2]).toBeLessThanOrEqual(SIZE * 0.94 + 0.5);
        expect(box[1]).toBeGreaterThanOrEqual(SIZE * 0.06 - 0.5);
        expect(box[3]).toBeLessThanOrEqual(SIZE * 0.94 + 0.5);
      }
      // The larger of the two takes all the room there is; `spans` says how long each is.
      const spans = [da, db].map(({ box }) => Math.max(box[2] - box[0], box[3] - box[1]));
      expect(Math.max(...spans)).toBeCloseTo(SIZE * 0.88, 0);
      expect(art.spans[0]).toBeCloseTo(spans[0], 0);
      expect(art.spans[1]).toBeCloseTo(spans[1], 0);
    }
  });

  it('is the same whichever comes first, but for which is which', () => {
    const [a, b] = [square(0, 0, 10), square(100, 50, 3)];
    const one = overlaid(a, b, 240);
    const two = overlaid(b, a, 240);
    expect(two.a).toBe(one.b);
    expect(two.b).toBe(one.a);
    expect(two.km).toBeCloseTo(one.km, 9);
    expect(two.spans).toEqual([one.spans[1], one.spans[0]]);
  });

  it('draws the countries of the game as large as they are: Spain and Brazil, Russia and Malta', () => {
    const world = JSON.parse(fs.readFileSync('public/data/world.json', 'utf8'));
    const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as { countries: { id: string; ar?: number }[] };
    const object = world.objects[Object.keys(world.objects)[0]];
    const all = (feature(world, object) as unknown as { features: (AnyGeo & { id?: string; properties: { id?: string } })[] }).features;
    const geo = (id: string): AnyGeo => all.find((f) => (f.id ?? f.properties.id) === id)!;
    const told = (id: string): number => index.countries.find((c) => c.id === id)!.ar!;
    for (const id of ['ES', 'BR', 'RU', 'MT', 'US', 'AU']) {
      expect(geo(id), id).toBeTruthy();
      // What the outline holds is what the data says, give or take the detail of the outline (and Malta is three islets).
      expect(areaKm2(geo(id)) / told(id), id).toBeGreaterThan(id === 'MT' ? 0.6 : 0.93);
      expect(areaKm2(geo(id)) / told(id), id).toBeLessThan(1.07);
    }
    const art = overlaid(geo('ES'), geo('BR'), 240);
    expect(drawn(art.b).area / drawn(art.a).area).toBeGreaterThan(15);
    expect(drawn(art.b).area / drawn(art.a).area).toBeLessThan(18.5);
    // Brazil is some 4300 km from north to south: at 211 units of the drawing, a unit is some twenty kilometres.
    expect(art.km).toBeGreaterThan(18);
    expect(art.km).toBeLessThan(23);
    // Malta beside Russia is a speck: well under the nine units that get a ring.
    const far = overlaid(geo('RU'), geo('MT'), 240);
    expect(far.spans[0]).toBeCloseTo(240 * 0.88, 0);
    expect(far.spans[1]).toBeLessThan(2);
    expect(far.b).toMatch(/^M/);
  });
});
