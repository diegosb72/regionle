import { beforeEach, describe, expect, it } from 'vitest';
import { CLEAR, POINTS, courseDeg, dealLegs, distanceOptions, judgePoint, offPoint, pointName, pointOf, pointShort, roundKm } from './bearings';
import { distanceKm } from './geo';
import { setLang } from './i18n';
import { mulberry32 } from './text';
import type { LL } from './types';

const MADRID: LL = [-3.7038, 40.4168];
const BARCELONA: LL = [2.1734, 41.3851];
const SEVILLE: LL = [-5.9845, 37.3891];
const BILBAO: LL = [-2.935, 43.263];
const CORUNA: LL = [-8.4115, 43.3623];
const VALENCIA: LL = [-0.3763, 39.4699];
const NEW_YORK: LL = [-74.006, 40.7128];
const TOKYO: LL = [139.6917, 35.6895];
const SYDNEY: LL = [151.2093, -33.8688];
const SUVA: LL = [178.4419, -18.1416];
const APIA: LL = [-171.7513, -13.8507];

beforeEach(() => setLang('es'));

describe('the course from one place to another', () => {
  it('is the direction a map with north at the top shows', () => {
    // Barcelona is east of Madrid, and only a little to the north: one degree of latitude for six of longitude.
    expect(pointName(pointOf(courseDeg(MADRID, BARCELONA)))).toBe('este');
    expect(Math.round(courseDeg(MADRID, BARCELONA))).toBe(78);
    expect(pointName(pointOf(courseDeg(MADRID, SEVILLE)))).toBe('suroeste');
    expect(pointName(pointOf(courseDeg(MADRID, BILBAO)))).toBe('norte');
    expect(pointName(pointOf(courseDeg(MADRID, CORUNA)))).toBe('noroeste');
    expect(pointName(pointOf(courseDeg(BILBAO, SEVILLE)))).toBe('sur');
    expect(pointName(pointOf(courseDeg(CORUNA, BILBAO)))).toBe('este');
    expect(pointName(pointOf(courseDeg(BARCELONA, VALENCIA)))).toBe('suroeste');
    // And back is the opposite.
    expect(Math.abs(courseDeg(MADRID, BARCELONA) - courseDeg(BARCELONA, MADRID))).toBeCloseTo(180, 6);
  });

  it('is not the first heading of the shortest way', () => {
    // New York is level with Madrid and Tokyo a little lower: west and east, though a plane sets off north of that.
    expect(courseDeg(MADRID, NEW_YORK)).toBeGreaterThan(268);
    expect(courseDeg(MADRID, NEW_YORK)).toBeLessThan(272);
    expect(pointName(pointOf(courseDeg(MADRID, NEW_YORK)))).toBe('oeste');
    expect(pointName(pointOf(courseDeg(MADRID, TOKYO)))).toBe('este');
    expect(pointName(pointOf(courseDeg(TOKYO, SYDNEY)))).toBe('sur');
  });

  it('goes the short way round where the map is cut', () => {
    // From Fiji to Samoa, across the line where the day changes: east, not west round the whole world.
    const deg = courseDeg(SUVA, APIA);
    expect(deg).toBeGreaterThan(45);
    expect(deg).toBeLessThan(90);
    expect(courseDeg(APIA, SUVA)).toBeCloseTo(deg + 180, 6);
  });

  it('is due north, east, south or west along a meridian or a parallel', () => {
    expect(courseDeg([0, 0], [0, 10])).toBeCloseTo(0, 9);
    expect(courseDeg([0, 40], [10, 40])).toBeCloseTo(90, 9);
    expect(courseDeg([0, 10], [0, -10])).toBeCloseTo(180, 9);
    expect(courseDeg([10, 40], [0, 40])).toBeCloseTo(270, 9);
    // The poles themselves are out of reach of the map it is measured on, and still give an answer.
    expect(courseDeg([0, 0], [50, 90])).toBeLessThan(10);
    expect(Number.isFinite(courseDeg([0, -90], [0, 90]))).toBe(true);
  });
});

describe('the eight points of the compass', () => {
  it('take 45 degrees each, north astride zero', () => {
    expect([0, 22, 23, 67, 68, 180, 247, 248, 337, 338, 359.9].map(pointOf)).toEqual([0, 0, 1, 1, 2, 4, 5, 6, 7, 0, 0]);
    expect(POINTS.map(pointName)).toEqual(['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste']);
    expect(POINTS.map(pointShort)).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']);
    setLang('en');
    expect(POINTS.map(pointShort)).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
    expect(pointName(7)).toBe('north-west');
  });

  it('measure how far off a course is, the short way round', () => {
    expect(offPoint(10, 0)).toBe(10);
    expect(offPoint(350, 0)).toBe(10);
    expect(offPoint(10, 7)).toBe(55);
    expect(offPoint(180, 0)).toBe(180);
    expect(offPoint(200, 0)).toBe(160);
  });

  it('are right on the point of the course, and close on the one it leans to', () => {
    // North-north-east: north is right, north-east is close and north-west is not.
    expect(judgePoint(15, 0)).toBe('ok');
    expect(judgePoint(15, 1)).toBe('warn');
    expect(judgePoint(15, 7)).toBe('bad');
    expect(judgePoint(15, 4)).toBe('bad');
    // Just west of north.
    expect(judgePoint(350, 0)).toBe('ok');
    expect(judgePoint(350, 7)).toBe('warn');
    expect(judgePoint(350, 1)).toBe('bad');
    // From Madrid to Barcelona: east; north-east is close, south-east is not.
    expect([1, 2, 3].map((p) => judgePoint(78, p as 1 | 2 | 3))).toEqual(['warn', 'ok', 'bad']);
    // Due east: neither of the points beside it is close.
    expect([1, 2, 3].map((p) => judgePoint(90, p as 1 | 2 | 3))).toEqual(['bad', 'ok', 'bad']);
    expect([1, 2, 3].map((p) => judgePoint(86, p as 1 | 2 | 3))).toEqual(['bad', 'ok', 'bad']);
    // For every course one point is right, and at most one more is close.
    for (let deg = 0; deg < 360; deg += 0.7) {
      const all = POINTS.map((p) => judgePoint(deg, p));
      expect(all.filter((r) => r === 'ok'), String(deg)).toHaveLength(1);
      expect(all.filter((r) => r === 'warn').length, String(deg)).toBeLessThanOrEqual(1);
      expect(all[pointOf(deg)], String(deg)).toBe('ok');
    }
  });
});

describe('the distances to choose from', () => {
  it('are said in round figures', () => {
    expect([3.4, 23.4, 87, 437, 504.6, 1234, 12345, 0.2].map(roundKm)).toEqual([3, 23, 85, 440, 500, 1200, 12300, 1]);
  });

  it('are four, in order, with the true one anywhere among them', () => {
    const km = distanceKm(MADRID, BARCELONA);
    const seen = new Set<number>();
    const rand = mulberry32(7);
    for (let n = 0; n < 60; n++) {
      const { options, right } = distanceOptions(km, rand);
      seen.add(right);
      expect(options).toHaveLength(4);
      expect(options[right]).toBe(roundKm(km));
      expect([...options].sort((a, b) => a - b)).toEqual(options);
      expect(new Set(options).size).toBe(4);
      // Far enough apart to be told from one another: each at least half as long again as the one before.
      for (let i = 1; i < 4; i++) expect(options[i] / options[i - 1]).toBeGreaterThan(1.5);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
    expect(distanceOptions(505, () => 0).options).toEqual([510, 810, 1300, 2100]);
    expect(distanceOptions(505, () => 0.999).options).toEqual([125, 195, 320, 510]);
  });

  it('never go past what the map allows', () => {
    // 15,700 km: anything longer than half the way round the world is no distance at all.
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const { options, right } = distanceOptions(15700, () => r);
      expect(right).toBe(3);
      expect(options).toEqual([3800, 6100, 9800, 15700]);
    }
    // 9,000 km: one longer option fits, and no more.
    expect(distanceOptions(9000, () => 0).options).toEqual([3500, 5600, 9000, 14400]);
    expect(distanceOptions(9000, () => 0.99).options).toEqual([2200, 3500, 5600, 9000]);
    // On a map that spans 1,000 km, nothing over 1,300 is offered.
    const seen = new Set<number>();
    const rand = mulberry32(11);
    for (let n = 0; n < 80; n++) {
      const { options, right } = distanceOptions(505, rand, 1300);
      seen.add(right);
      expect(options[3]).toBeLessThanOrEqual(1300);
      expect(options[right]).toBe(510);
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
    // The longest distance on the map is still asked, with only shorter ones beside it.
    expect(distanceOptions(1290, () => 0, 1300).right).toBe(3);
    // A map smaller than the distance asked cannot be: the true one is then the longest.
    expect(distanceOptions(500, () => 0, 100).right).toBe(3);
  });

  it('stay apart and above zero for a very short way', () => {
    for (const km of [0.4, 1, 2, 3, 7]) {
      for (const r of [0, 0.3, 0.6, 0.9]) {
        const { options, right } = distanceOptions(km, () => r);
        expect(new Set(options).size, `${km} ${r}`).toBe(4);
        expect(options[0], `${km} ${r}`).toBeGreaterThanOrEqual(1);
        expect([...options].sort((a, b) => a - b), `${km} ${r}`).toEqual(options);
        expect(options[right], `${km} ${r}`).toBeGreaterThanOrEqual(Math.max(1, Math.round(km)));
      }
    }
  });
});

describe('the questions of a game', () => {
  const places = [
    { id: 'madrid', lp: MADRID },
    { id: 'barcelona', lp: BARCELONA },
    { id: 'seville', lp: SEVILLE },
    { id: 'bilbao', lp: BILBAO },
    { id: 'coruna', lp: CORUNA },
    { id: 'valencia', lp: VALENCIA },
    // A stone's throw from Madrid.
    { id: 'getafe', lp: [-3.7327, 40.3057] as LL },
  ];
  const ids = places.map((p) => p.id);
  const at = (id: string) => places.find((p) => p.id === id)!.lp;

  it('ask about each place once, from another one, a course and a distance in turn', () => {
    const legs = dealLegs(places, ids, 'both', 50, mulberry32(3));
    expect(legs.map((l) => l.to)).toEqual(ids);
    expect(legs.map((l) => l.ask)).toEqual(['dir', 'dist', 'dir', 'dist', 'dir', 'dist', 'dir']);
    for (const l of legs) {
      expect(l.from).not.toBe(l.to);
      expect(l.km).toBeCloseTo(distanceKm(at(l.from), at(l.to)), 6);
      expect(l.deg).toBeCloseTo(courseDeg(at(l.from), at(l.to)), 6);
    }
    expect(dealLegs(places, ids, 'dir', 50, mulberry32(3)).every((l) => l.ask === 'dir')).toBe(true);
    expect(dealLegs(places, ids, 'dist', 50, mulberry32(3)).every((l) => l.ask === 'dist')).toBe(true);
    // The same lot, the same game.
    expect(dealLegs(places, ids, 'both', 50, mulberry32(3))).toEqual(legs);
    expect(dealLegs(places, ids, 'both', 50, mulberry32(4))).not.toEqual(legs);
  });

  it('never set two places that are hardly apart against each other, nor a course between two points', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const legs = dealLegs(places, ids, 'dir', 50, mulberry32(seed));
      for (const l of legs) {
        expect(l.km, `${l.from} → ${l.to}`).toBeGreaterThanOrEqual(50);
        // Where no course is that clear, any place far enough will do.
        const clearest = Math.min(...places.filter((p) => p.id !== l.to && distanceKm(p.lp, at(l.to)) >= 50).map((p) => offPoint(courseDeg(p.lp, at(l.to)), pointOf(courseDeg(p.lp, at(l.to))))));
        if (clearest <= CLEAR) expect(offPoint(l.deg, pointOf(l.deg)), `${l.from} → ${l.to}`).toBeLessThanOrEqual(CLEAR);
      }
    }
  });

  it('do not look from the same place twice running, where there is another as good', () => {
    // Four places on one parallel, 170 km from each to the next: every course is due east or west.
    const line = [0, 2, 4, 6].map((lon) => ({ id: `p${lon}`, lp: [lon, 40] as LL }));
    for (let seed = 1; seed <= 40; seed++) {
      const legs = dealLegs(line, ['p0', 'p2', 'p4', 'p6', 'p0', 'p4'], 'dir', 50, mulberry32(seed));
      expect(legs).toHaveLength(6);
      legs.forEach((l, i) => i && expect(l.from, String(seed)).not.toBe(legs[i - 1].from));
    }
  });

  it('leave alone two surfaces that touch, while there are others', () => {
    // Three squares of 100 km a side in a row, 100 km from centre to centre, and one far to the north.
    const row = [
      { id: 'a', lp: [0, 40] as LL, area: 10000 },
      { id: 'b', lp: [1.17, 40] as LL, area: 10000 },
      { id: 'c', lp: [2.34, 40] as LL, area: 10000 },
      { id: 'd', lp: [1.17, 44] as LL, area: 10000 },
    ];
    for (let seed = 1; seed <= 30; seed++) {
      for (const l of dealLegs(row, ['a', 'b', 'c', 'd'], 'dist', 30, mulberry32(seed))) {
        // Neighbours are 100 km apart; it takes 150 for squares of that size.
        expect(l.km, `${l.from} → ${l.to}`).toBeGreaterThan(150);
      }
    }
    // The same places as dots: any pair will do.
    const dots = row.map(({ id, lp }) => ({ id, lp }));
    const near = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) for (const l of dealLegs(dots, ['a', 'b', 'c', 'd'], 'dist', 30, mulberry32(seed))) if (l.km < 150) near.add(`${l.from}${l.to}`);
    expect(near.size).toBeGreaterThan(0);
    // Two that touch and nothing else: they are asked all the same.
    expect(dealLegs(row.slice(0, 2), ['a', 'b'], 'dir', 30, mulberry32(1)).map((l) => l.from)).toEqual(['b', 'a']);
  });

  it('do not ask across the line where the map of the world is cut, while there are others', () => {
    const pacific = [
      { id: 'suva', lp: SUVA },
      { id: 'apia', lp: APIA },
      { id: 'sydney', lp: SYDNEY },
      { id: 'tokyo', lp: TOKYO },
      { id: 'honolulu', lp: [-157.8583, 21.3069] as LL },
      { id: 'papeete', lp: [-149.5665, -17.5334] as LL },
    ];
    for (let seed = 1; seed <= 30; seed++) {
      const legs = dealLegs(pacific, ['apia', 'suva'], 'dist', 30, mulberry32(seed));
      // Samoa is on the left edge of that map, with Hawaii and Tahiti; Fiji on the right one, with Sydney and Tokyo.
      expect(legs[0].from, String(seed)).toMatch(/honolulu|papeete/);
      expect(legs[1].from, String(seed)).toMatch(/sydney|tokyo/);
    }
    // With nobody else on its side, Samoa is asked about from across the line.
    expect(dealLegs(pacific.slice(0, 4), ['apia'], 'dist', 30, mulberry32(2))[0].from).toMatch(/suva|sydney|tokyo/);
  });

  it('ask only about what they are told to, from anywhere on the map', () => {
    const legs = dealLegs(places, ['seville', 'nowhere', 'bilbao'], 'both', 50, mulberry32(9));
    expect(legs.map((l) => l.to)).toEqual(['seville', 'bilbao']);
    // The turn is that of the place in the list, whatever was left out.
    expect(legs.map((l) => l.ask)).toEqual(['dir', 'dir']);
  });

  it('make do with what there is on a map of two places, and ask nothing on a map of one', () => {
    const two = [places[0], places[6]];
    const legs = dealLegs(two, ['madrid', 'getafe'], 'both', 50, mulberry32(1));
    expect(legs.map((l) => [l.from, l.to])).toEqual([
      ['getafe', 'madrid'],
      ['madrid', 'getafe'],
    ]);
    expect(dealLegs([places[0]], ['madrid'], 'both', 50, mulberry32(1))).toEqual([]);
  });
});
