import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { HOT_TRIES, heatOf, hotResult, judge, kmOff, marksFor, partAt, sideKm, trendOf } from './blind';
import { buildDeck, setLoader } from './data';
import { buildPhysicalDeck } from './extra';
import { kmToShape, tolerances } from './geo';
import type { AnyGeo, Deck, LL } from './types';

const MADRID: LL = [-3.7038, 40.4168];
const TOLEDO: LL = [-4.0273, 39.8628];
const line = (...coordinates: LL[]): AnyGeo => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });
const dot = (at: LL): AnyGeo => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: at } });
/** A degree of a great circle, in kilometres. */
const DEGREE = 111.19;

/** Out at sea: between Valencia and Ibiza, north of Santander, off Lisbon, south of Almería and east of Sardinia's south. */
const OFF_VALENCIA: LL = [0.4, 39.4];
const OFF_SANTANDER: LL = [-3.8, 44.2];
const OFF_LISBON: LL = [-11.5, 38.7];
const OFF_ALMERIA: LL = [-2.6, 36.2];
const OFF_ALGIERS: LL = [5, 37.6];

let spain: Deck;
let world: Deck;
/** The seas of Spain that are best known, and all of them: only the second map asks the Balearic Sea. */
let seas: Deck;
let everySea: Deck;
let oceans: Deck;

beforeAll(async () => {
  setLoader(async (p) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data', p), 'utf8')));
  spain = await buildDeck({ scope: 'regions', countries: ['ES'], levels: { ES: 'g1' } });
  world = await buildDeck({ scope: 'countries', countries: ['FJ', 'LU', 'FR', 'RU', 'US', 'NZ'] });
  seas = await buildPhysicalDeck(['sea', 'in:ES']);
  everySea = await buildPhysicalDeck(['sea', 'in:ES', 'all']);
  oceans = await buildPhysicalDeck(['continent']);
});

describe('how far a point is from a shape', () => {
  it('is nothing inside a surface and the way to its edge outside', () => {
    const of = (id: string) => spain.byId.get(id)!.geo;
    expect(kmToShape(MADRID, of('ES-MD'))).toBe(0);
    // Toledo is a short drive south of the edge of the region of Madrid.
    const toledo = kmToShape(TOLEDO, of('ES-MD'));
    expect(toledo).toBeGreaterThan(8);
    expect(toledo).toBeLessThan(30);
    // From Madrid to Andalusia, across La Mancha; to Ceuta, across the sea too; to the Canaries, far out.
    expect(Math.round(kmToShape(MADRID, of('ES-AN')) / 10)).toBe(22);
    expect(Math.round(kmToShape(MADRID, of('ES-CE')) / 10)).toBe(52);
    expect(Math.round(kmToShape(MADRID, of('ES-CN')) / 100)).toBe(15);
  });

  it('is the way to the nearest point of a line, its ends included', () => {
    const equator = line([0, 0], [10, 0]);
    expect(kmToShape([5, 1], equator)).toBeCloseTo(DEGREE, 0);
    expect(kmToShape([5, -2], equator)).toBeCloseTo(2 * DEGREE, 0);
    expect(kmToShape([-1, 0], equator)).toBeCloseTo(DEGREE, 0);
    expect(kmToShape([11, 0], equator)).toBeCloseTo(DEGREE, 0);
    expect(kmToShape([4, 0], equator)).toBeCloseTo(0, 5);
    // Farther north a degree of longitude is shorter: the sheet laid around the point allows for it.
    expect(kmToShape([1, 60], line([0, 60], [0, 70]))).toBeCloseTo(DEGREE / 2, 0);
    expect(kmToShape([3, 4], dot([3, 5]))).toBeCloseTo(DEGREE, 0);
  });

  it('goes the short way round where the map is cut', () => {
    const across = line([179, 0], [-179, 0]);
    expect(kmToShape([180, 1], across)).toBeCloseTo(DEGREE, 0);
    expect(kmToShape([-178, 0], across)).toBeCloseTo(DEGREE, 0);
    // From the other side of the world it is half a world away, not next door.
    expect(kmToShape([0, 0], across)).toBeGreaterThan(19_000);
    const of = (id: string) => world.byId.get(id)!.geo;
    // Fiji lies on both sides of the cut.
    expect(kmToShape([178.44, -18.14], of('FJ'))).toBe(0);
    expect(kmToShape([0, -17], of('FJ'))).toBeGreaterThan(15_000);
    // The far east of Russia is west of Greenwich; Alaska is across the strait from it.
    expect(kmToShape([-173.2, 64.4], of('RU'))).toBeLessThan(15);
    const strait = kmToShape([-169.8, 66.16], of('US'));
    expect(strait).toBeGreaterThan(60);
    expect(strait).toBeLessThan(140);
    // And from the pole, where every meridian meets.
    const pole = kmToShape([0, 90], of('RU'));
    expect(pole).toBeGreaterThan(800);
    expect(pole).toBeLessThan(1100);
  });
});

describe('placing blind', () => {
  it('asks for a click inside a surface, and near what is too small to hit', () => {
    const limit = tolerances(spain.items.map((it) => it.lp));
    expect(limit).toEqual({ ok: 67, warn: 173 });
    const of = (id: string) => spain.byId.get(id)!;
    expect(Math.round(sideKm(of('ES-MD').geo))).toBe(89);
    // Madrid, and La Rioja, the smallest region of the mainland: inside. Just outside is close.
    expect(marksFor(of('ES-MD'), limit)).toEqual({ ok: 0, warn: 22 });
    expect(marksFor(of('ES-RI'), limit)).toEqual({ ok: 0, warn: 22 });
    // Ceuta and Melilla are specks on this map: near enough is right.
    expect(marksFor(of('ES-CE'), limit)).toEqual({ ok: 22, warn: 67 });
    expect(marksFor(of('ES-ML'), limit)).toEqual({ ok: 22, warn: 67 });
    // On a map of the world Luxembourg is a speck too, and France is not.
    const globe = { ok: 500, warn: 1300 };
    expect(marksFor(world.byId.get('LU')!, globe)).toEqual({ ok: 167, warn: 500 });
    expect(marksFor(world.byId.get('FR')!, globe)).toEqual({ ok: 0, warn: 167 });
  });

  it('gives a dot the limits of the map and a line a third of them', () => {
    const limit = { ok: 66, warn: 172 };
    expect(marksFor({ shape: 'point', geo: dot([0, 0]) }, limit)).toEqual(limit);
    expect(marksFor({ shape: 'line', geo: line([0, 0], [10, 0]) }, limit)).toEqual({ ok: 22, warn: 66 });
    // Never tighter than five kilometres, however small the map.
    expect(marksFor({ shape: 'line', geo: line([0, 0], [1, 0]) }, { ok: 9, warn: 23 })).toEqual({ ok: 5, warn: 9 });
  });

  it('measures to the dot, to the line or to the edge, and judges by the marks', () => {
    const of = (id: string) => spain.byId.get(id)!;
    const limit = tolerances(spain.items.map((it) => it.lp));
    const madrid = marksFor(of('ES-MD'), limit);
    expect(judge(kmOff(of('ES-MD'), MADRID), madrid)).toBe('ok');
    expect(judge(kmOff(of('ES-MD'), TOLEDO), madrid)).toBe('warn');
    expect(judge(kmOff(of('ES-AN'), MADRID), marksFor(of('ES-AN'), limit))).toBe('bad');
    // A dot is measured to where it is, whatever shape it is given.
    expect(kmOff({ shape: 'point', geo: dot([9, 9]), lp: [0, 1] }, [0, 0])).toBeCloseTo(DEGREE, 0);
    expect(judge(0, { ok: 0, warn: 22 })).toBe('ok');
    expect(judge(22, { ok: 0, warn: 22 })).toBe('warn');
    expect(judge(22.5, { ok: 0, warn: 22 })).toBe('bad');
  });
});

describe('a sea, placed blind', () => {
  it('takes in the seas that are part of it', () => {
    const med = seas.byId.get('s:mediterranean-sea')!;
    // Whether the map asks them or not: this one has no Balearic Sea to ask.
    expect(seas.byId.has('s:balearic-sea')).toBe(false);
    expect(med.parts!.map((p) => p.id)).toEqual(expect.arrayContaining(['s:balearic-sea', 's:alboran-sea', 's:gulf-of-valencia', 's:adriatic-sea']));
    // The stretch drawn under its name starts south of the Balearic Islands…
    expect(kmToShape(OFF_VALENCIA, med.geo)).toBeGreaterThan(50);
    expect(kmToShape(OFF_ALGIERS, med.geo)).toBe(0);
    // …but off Valencia is the Mediterranean to anybody, and so is the sea of Alborán.
    expect(kmOff(med, OFF_VALENCIA)).toBe(0);
    expect(kmOff(med, OFF_ALMERIA)).toBe(0);
    expect(kmOff(med, OFF_ALGIERS)).toBe(0);
    expect(partAt(med, OFF_VALENCIA)?.id).toBe('s:balearic-sea');
    expect(partAt(med, OFF_ALMERIA)?.name).toBe('Mar de Alborán');
    expect(partAt(med, OFF_ALGIERS)).toBeNull();
    // The Atlantic is not: neither off Lisbon nor in the Bay of Biscay.
    expect(kmOff(med, OFF_LISBON)).toBeGreaterThan(400);
    expect(kmOff(med, OFF_SANTANDER)).toBeGreaterThan(400);
    expect(partAt(med, OFF_LISBON)).toBeNull();
  });

  it('does not work the other way round: the whole is not inside its part', () => {
    const balearic = everySea.byId.get('s:balearic-sea')!;
    expect(balearic.parts!.map((p) => p.id)).toEqual(['s:gulf-of-valencia']);
    // A part that the map draws is the very piece of the map, not a copy of it.
    expect(balearic.parts![0].geo).toBe(everySea.byId.get('s:gulf-of-valencia')!.geo);
    expect(kmOff(balearic, OFF_VALENCIA)).toBe(0);
    expect(kmOff(balearic, OFF_ALGIERS)).toBeGreaterThan(50);
    expect(kmOff(balearic, OFF_ALMERIA)).toBeGreaterThan(50);
    const alboran = everySea.byId.get('s:alboran-sea')!;
    expect(alboran.parts).toBeUndefined();
    expect(kmOff(alboran, OFF_VALENCIA)).toBeGreaterThan(200);
  });

  it('takes the Bay of Biscay for the Atlantic, and not the Mediterranean', () => {
    const atlantic = seas.byId.get('s:atlantic-ocean')!;
    expect(kmOff(atlantic, OFF_LISBON)).toBe(0);
    expect(partAt(atlantic, OFF_LISBON)).toBeNull();
    expect(kmOff(atlantic, OFF_SANTANDER)).toBe(0);
    expect(['s:bay-of-biscay', 's:cantabrian-sea']).toContain(partAt(atlantic, OFF_SANTANDER)?.id);
    expect(kmOff(atlantic, OFF_VALENCIA)).toBeGreaterThan(300);
    expect(kmOff(atlantic, OFF_ALMERIA)).toBeGreaterThan(100);
  });

  it('needs no parts where an ocean is drawn with all its seas', () => {
    const atlantic = oceans.byId.get('s:atlantic-ocean')!;
    expect(atlantic.parts).toBeUndefined();
    // On the map of continents and oceans the Mediterranean answers to the Atlantic, as it is drawn there.
    expect(kmOff(atlantic, OFF_VALENCIA)).toBe(0);
    expect(kmOff(atlantic, OFF_SANTANDER)).toBe(0);
    // What is no sea has no parts either.
    expect(oceans.items.some((it) => it.cat === 'continent' && it.parts)).toBe(false);
  });
});

describe('hot and cold', () => {
  const limit = { ok: 100, warn: 260 };

  it('tells how warm a miss is by how far it fell on that map', () => {
    expect([150, 200, 201, 500, 501, 1000, 1001, 1800, 1801, 9000].map((km) => heatOf(km, limit))).toEqual([4, 4, 3, 3, 2, 2, 1, 1, 0, 0]);
    // The same miss is colder on a smaller map.
    expect(heatOf(300, { ok: 20, warn: 52 })).toBe(1);
    expect(heatOf(300, { ok: 500, warn: 1300 })).toBe(4);
  });

  it('tells whether a click is nearer than the one before', () => {
    expect(trendOf(300, undefined)).toBe(0);
    expect(trendOf(200, 300)).toBe(1);
    expect(trendOf(400, 300)).toBe(-1);
    // Much the same distance is no news.
    expect(trendOf(303, 300)).toBe(0);
    expect(trendOf(294, 300)).toBe(0);
    expect(trendOf(293, 300)).toBe(1);
  });

  it('is right with the first click, half right later and wrong when it is not found', () => {
    expect(hotResult(true, 1)).toBe('ok');
    expect(hotResult(true, 2)).toBe('warn');
    expect(hotResult(true, HOT_TRIES)).toBe('warn');
    expect(hotResult(false, HOT_TRIES)).toBe('bad');
    expect(HOT_TRIES).toBe(6);
  });
});
