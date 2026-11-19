// Miles instead of kilometres: what is shown changes, what is kept and judged does not.

import { afterEach, describe, expect, it } from 'vitest';
import { distanceOptions, roundKm, saidDist } from './bearings';
import { metricOf } from './figures';
import { setLang } from './i18n';
import { mergeSaved, useStore } from './store';
import { fmtArea, fmtDist } from './text';
import { KM2_PER_SQ_MILE, KM_PER_MILE, area, areaUnit, dist, distUnit, distWord, getUnits, setUnits } from './units';

afterEach(() => {
  setUnits('km');
  setLang('es');
  useStore.getState().setMiles(false);
});

describe('the unit of the player', () => {
  it('is the kilometre until miles are asked for', () => {
    expect(getUnits()).toBe('km');
    expect(dist(100)).toBe(100);
    expect(area(100)).toBe(100);
    expect(distUnit()).toBe('km');
    expect(areaUnit()).toBe('km²');
    expect(distWord()).toBe('kilómetros');
  });

  it('turns kilometres into miles and km² into square miles', () => {
    setUnits('mi');
    expect(dist(KM_PER_MILE)).toBeCloseTo(1, 12);
    expect(dist(100)).toBeCloseTo(62.137, 3);
    expect(area(KM2_PER_SQ_MILE)).toBeCloseTo(1, 12);
    expect(area(505_990)).toBeCloseTo(195_364, 0);
    expect(distUnit()).toBe('mi');
    expect(areaUnit()).toBe('mi²');
    expect(distWord()).toBe('millas');
    setLang('en');
    expect(areaUnit()).toBe('sq mi');
    expect(distWord()).toBe('miles');
  });

  it('follows the setting of the store from the moment it changes', () => {
    useStore.getState().setMiles(true);
    expect(getUnits()).toBe('mi');
    useStore.getState().setMiles(false);
    expect(getUnits()).toBe('km');
  });

  it('is off for whoever saved the game before it existed, and kept by whoever turned it on', () => {
    const now = useStore.getState();
    expect(mergeSaved({}, now).miles).toBe(false);
    expect(mergeSaved({ miles: true }, now).miles).toBe(true);
    expect(mergeSaved({ miles: 'yes' }, now).miles).toBe(false);
  });
});

describe('distances and surfaces as they are written', () => {
  it('writes a distance in the unit, whole unless decimals are asked for', () => {
    expect(fmtDist(441)).toBe('441 km');
    expect(fmtDist(12.34, 1)).toBe('12,3 km');
    setUnits('mi');
    expect(fmtDist(441)).toBe('274 mi');
    expect(fmtDist(12.34, 1)).toBe('7,7 mi');
    setLang('en');
    expect(fmtDist(5000)).toBe('3,107 mi');
  });

  it('writes a surface in the unit', () => {
    expect(fmtArea(505_990)).toBe('505.990 km²');
    expect(fmtArea(17_098_246)).toBe('17,1 millones de km²');
    setUnits('mi');
    expect(fmtArea(505_990)).toBe('195.364 mi²');
    expect(fmtArea(17_098_246)).toBe('6,6 millones de mi²');
    expect(fmtArea(2.02)).toBe('0,78 mi²');
    setLang('en');
    expect(fmtArea(505_990)).toBe('195,364 sq mi');
    expect(fmtArea(17_098_246)).toBe('6.6 million sq mi');
  });

  it('says a distance as a round figure of the unit', () => {
    expect(saidDist(441)).toBe('440 km');
    setUnits('mi');
    // 274 miles, said as people say them: not the 440 km turned into 273,4.
    expect(saidDist(441)).toBe('270 mi');
    expect(saidDist(3000)).toBe('1900 mi');
    expect(saidDist(20_000)).toBe('12.400 mi');
  });
});

describe('the figures of the number games', () => {
  it('keeps a surface in km² and shows it in square miles', () => {
    setUnits('mi');
    const m = metricOf('area');
    expect(m.short(505_990)).toBe('195 mil mi²');
    expect(m.full(505_990)).toBe('195.364 mi²');
    expect(m.units.map((u) => u.label)).toEqual(['mi²', 'miles de mi²', 'millones de mi²']);
    // 195 thousand square miles, typed with the unit by default, are the km² of Spain.
    expect(195.364 * m.defaultUnit).toBeCloseTo(505_990, -2);
    expect(m.per).toBeCloseTo(KM2_PER_SQ_MILE, 12);
  });

  it('shows a density per square mile', () => {
    const perKm2 = metricOf('density');
    expect(perKm2.short(94)).toBe('94 hab./km²');
    setUnits('mi');
    const m = metricOf('density');
    expect(m.short(94)).toBe('243 hab./mi²');
    expect(m.full(94)).toBe('243 habitantes por mi²');
    // What is typed per square mile is kept per km².
    expect(243.46 * m.defaultUnit).toBeCloseTo(94, 1);
  });

  it('does not hand out the figures of one unit once the other is chosen', () => {
    const km = metricOf('area');
    setUnits('mi');
    const mi = metricOf('area');
    expect(mi).not.toBe(km);
    expect(metricOf('area')).toBe(mi);
    setUnits('km');
    expect(metricOf('area')).toBe(km);
    expect(km.units.map((u) => u.factor)).toEqual([1, 1e3, 1e6]);
    expect(km.per).toBe(1);
  });

  it('leaves people and heights as they are', () => {
    setUnits('mi');
    expect(metricOf('elev').short(3479)).toBe('3479 m');
    expect(metricOf('pop').short(47_400_000)).toBe('47,4 M');
  });
});

describe('the four distances to choose from', () => {
  it('are round figures of miles when they are dealt in miles', () => {
    setUnits('mi');
    // Madrid to Barcelona: 505 km, 314 miles.
    const { options, right } = distanceOptions(dist(505), () => 0.5, dist(2000));
    expect(options[right]).toBe(310);
    for (const n of options) expect(roundKm(n)).toBe(n);
    expect([...options].sort((a, b) => a - b)).toEqual(options);
    expect(new Set(options).size).toBe(4);
  });
});
