import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { BORDER_SHARE, askable, borderOptions, borderPoints, bordersOf, isBorderId, type Border } from './borders';
import { buildDeck, loadIndex, setLoader } from './data';
import { buildCityDeck } from './extra';
import { setLang } from './i18n';
import { mulberry32 } from './text';
import type { Deck, Item } from './types';

let europe: string[];
let world: string[];

beforeAll(async () => {
  setLoader(async (p) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data', p), 'utf8')));
  setLang('es');
  const { index } = await loadIndex();
  europe = index.countries.filter((c) => c.ct === 'EU' && c.cl === 'un').map((c) => c.id);
  world = index.countries.filter((c) => c.cl === 'un').map((c) => c.id);
});

/** A square piece of land, a degree a side, with a point in the middle of each side. */
const square = (id: string, x: number, y: number): Item =>
  ({
    id,
    shape: 'area',
    geo: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [x, y],
            [x + 0.5, y],
            [x + 1, y],
            [x + 1, y + 0.5],
            [x + 1, y + 1],
            [x + 0.5, y + 1],
            [x, y + 1],
            [x, y + 0.5],
            [x, y],
          ],
        ],
      },
    },
  }) as unknown as Item;

const names = (deck: Deck, b: Border) => [deck.byId.get(b.a)!.name, deck.byId.get(b.b)!.name].sort().join(' – ');

describe('the borders of a map', () => {
  it('are the lines that two outlines share, and nothing else', () => {
    // b is to the east of a, c to the north of b, d touches a at one corner only, and e is far away.
    const borders = bordersOf([square('a', 0, 0), square('b', 1, 0), square('c', 1, 1), square('d', -1, -1), square('e', 9, 9)]);
    expect(borders.map((b) => b.id)).toEqual(['a|b', 'b|c']);
    const ab = borders[0];
    expect(ab).toMatchObject({ a: 'a', b: 'b', mid: [1, 0.5] });
    // One line of three points, whichever way round each outline goes.
    expect(ab.geo.type).toBe('MultiLineString');
    expect(ab.geo.coordinates).toHaveLength(1);
    expect(ab.geo.coordinates[0].map((p) => p.join(',')).sort()).toEqual(['1,0', '1,0.5', '1,1']);
    // A degree of latitude is some 111 km.
    expect(ab.km).toBeGreaterThan(110);
    expect(ab.km).toBeLessThan(112);
    // The land it runs on: a square a degree a side, some 157 km from corner to corner.
    expect(ab.land).toBeGreaterThan(140);
    expect(ab.land).toBeLessThan(160);
    expect(borders[1].geo.coordinates[0].map((p) => p.join(',')).sort()).toEqual(['1,1', '1.5,1', '2,1']);
  });

  it('are the same whatever order the pieces come in', () => {
    const list = [square('a', 0, 0), square('b', 1, 0), square('c', 1, 1)];
    const one = bordersOf(list);
    const other = bordersOf([...list].reverse());
    expect(other.map((b) => b.id)).toEqual(one.map((b) => b.id));
    expect(other.map((b) => Math.round(b.km))).toEqual(one.map((b) => Math.round(b.km)));
  });

  it('tell the id of a border from that of a piece', () => {
    expect(isBorderId('ES|FR')).toBe(true);
    expect(isBorderId('ES-AN|ES-EX')).toBe(true);
    expect(isBorderId('ES')).toBe(false);
    expect(isBorderId('r:volga')).toBe(false);
  });

  it('are those of the data on the map of the communities of Spain', async () => {
    const deck = await buildDeck({ scope: 'regions', countries: ['ES'], levels: { ES: 'g1' } });
    const borders = bordersOf(deck.items);
    // Every pair that the data calls neighbours has a line, and nothing else has one.
    const pairs = new Set<string>();
    for (const it of deck.items) for (const o of it.nb) pairs.add(it.id < o ? `${it.id}|${o}` : `${o}|${it.id}`);
    expect(borders.map((b) => b.id).sort()).toEqual([...pairs].sort());
    expect(borders).toHaveLength(29);
    const all = borders.map((b) => names(deck, b));
    expect(all).toContain('Asturias – Cantabria');
    expect(all).toContain('Andalucía – Extremadura');
    // Islands have none.
    expect(all.some((n) => n.includes('Canarias') || n.includes('Baleares'))).toBe(false);
    for (const b of borders) {
      expect(b.a < b.b, b.id).toBe(true);
      expect(b.km, b.id).toBeGreaterThan(0);
      expect(b.geo.coordinates.every((line) => line.length >= 2), b.id).toBe(true);
    }
    // The drawn length falls short of the real one, and is of its order: Andalusia and Extremadura share some 300 km.
    const ae = borders.find((b) => names(deck, b) === 'Andalucía – Extremadura')!;
    expect(ae.km).toBeGreaterThan(200);
    expect(ae.km).toBeLessThan(400);
  });

  it('leave out, on the map of the world, the ones too short beside the land around them', async () => {
    const deck = await buildDeck({ scope: 'countries', countries: world, levels: {} });
    const borders = bordersOf(deck.items);
    expect(borders.length).toBeGreaterThan(290);
    const asked = borders.filter(askable).map((b) => names(deck, b));
    const left = borders.filter((b) => !askable(b)).map((b) => names(deck, b));
    expect(left).toEqual(expect.arrayContaining(['Corea del Norte – Rusia', 'Francia – Mónaco']));
    expect(left.length).toBeLessThan(8);
    expect(asked).toEqual(expect.arrayContaining(['España – Francia', 'España – Portugal', 'Andorra – España', 'Noruega – Rusia', 'Canadá – Estados Unidos', 'Armenia – Irán']));
    for (const b of borders.filter(askable)) expect(b.km / b.land, names(deck, b)).toBeGreaterThanOrEqual(BORDER_SHARE);
    // The land a border runs on is the part of each side that it touches: for Spain beside Portugal the peninsula, not the Canaries as well.
    const sp = borders.find((b) => names(deck, b) === 'España – Portugal')!;
    expect(sp.land).toBeGreaterThan(800);
    expect(sp.land).toBeLessThan(1300);
    // A border made of several lines is one border: Canada and the United States meet along the 49th parallel and in Alaska.
    const cu = borders.find((b) => names(deck, b) === 'Canadá – Estados Unidos')!;
    expect(cu.geo.coordinates.length).toBeGreaterThan(1);
  });

  it('are only those inside each country on a map of the regions of several', async () => {
    const deck = await buildDeck({ scope: 'regions', countries: ['ES', 'PT'], levels: { ES: 'g1' } });
    const borders = bordersOf(deck.items);
    expect(borders.length).toBeGreaterThan(40);
    for (const b of borders) expect(deck.byId.get(b.a)!.country.id, b.id).toBe(deck.byId.get(b.b)!.country.id);
    // The data knows that Galicia touches the north of Portugal: no line is drawn for it here.
    const galicia = deck.items.find((it) => it.name === 'Galicia')!;
    expect(galicia.nb.some((id) => deck.byId.get(id)!.country.id === 'PT')).toBe(true);
  });

  it('are none where the pieces are dots', async () => {
    expect(bordersOf((await buildCityDeck(['ES'], 'top', 25)).items)).toEqual([]);
  });
});

describe('the points that frame a border', () => {
  it('are a handful of its points, with the ends of each of its lines', async () => {
    const deck = await buildDeck({ scope: 'countries', countries: europe, levels: {} });
    const border = bordersOf(deck.items).find((b) => names(deck, b) === 'España – Portugal')!;
    const points = borderPoints(border);
    expect(points.length).toBeGreaterThan(8);
    expect(points.length).toBeLessThan(80);
    const keys = new Set(points.map((p) => p.join(',')));
    for (const line of border.geo.coordinates) {
      expect(keys.has(line[0].join(','))).toBe(true);
      expect(keys.has(line[line.length - 1].join(','))).toBe(true);
    }
    // It runs from the Miño to the Guadiana: some five degrees from north to south.
    const lats = points.map((p) => p[1]);
    expect(Math.max(...lats) - Math.min(...lats)).toBeGreaterThan(4);
  });
});

describe('the borders offered as an answer', () => {
  it('are four, the right one among them, with no piece that gives it away', async () => {
    const deck = await buildDeck({ scope: 'countries', countries: europe, levels: {} });
    const all = bordersOf(deck.items).filter(askable);
    const right = all.find((b) => names(deck, b) === 'Alemania – Francia')!;
    for (let seed = 1; seed <= 25; seed++) {
      const options = borderOptions(right, all, mulberry32(seed));
      expect(options).toHaveLength(4);
      expect(new Set(options.map((o) => o.id)).size).toBe(4);
      expect(options).toContain(right);
      const wrong = options.filter((o) => o !== right);
      const has = (o: Border, id: string) => o.a === id || o.b === id;
      // One shares the first piece, one the second, and one neither.
      expect(wrong.filter((o) => has(o, right.a) && !has(o, right.b)), String(seed)).toHaveLength(1);
      expect(wrong.filter((o) => has(o, right.b) && !has(o, right.a)), String(seed)).toHaveLength(1);
      expect(wrong.filter((o) => !has(o, right.a) && !has(o, right.b)), String(seed)).toHaveLength(1);
      // So each side of the answer comes up twice, as do the sides of some wrong option.
      const count = new Map<string, number>();
      for (const o of options) for (const id of [o.a, o.b]) count.set(id, (count.get(id) ?? 0) + 1);
      expect(count.get(right.a)).toBe(2);
      expect(count.get(right.b)).toBe(2);
    }
    // The same game offers the same ones in the same order, and another game does not always.
    const ids = (seed: number) => borderOptions(right, all, mulberry32(seed)).map((o) => o.id).join(' ');
    expect(ids(3)).toBe(ids(3));
    expect(new Set(Array.from({ length: 25 }, (_, i) => ids(i + 1))).size).toBeGreaterThan(5);
    // The right one is not always in the same place.
    expect(new Set(Array.from({ length: 25 }, (_, i) => borderOptions(right, all, mulberry32(i + 1)).indexOf(right))).size).toBe(4);
  });

  it('are as many as the map has where it has fewer than four', async () => {
    const deck = await buildDeck({ scope: 'countries', countries: ['ES', 'PT', 'FR'], levels: {} });
    const all = bordersOf(deck.items);
    expect(all.map((b) => names(deck, b)).sort()).toEqual(['España – Francia', 'España – Portugal']);
    const options = borderOptions(all[0], all, mulberry32(1));
    expect(options).toHaveLength(2);
    expect(options).toContain(all[0]);
    expect(borderOptions(all[0], [all[0]], mulberry32(1))).toEqual([all[0]]);
  });
});
