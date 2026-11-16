import { describe, expect, it } from 'vitest';
import { nearest, spanKm, tolerances } from './geo';
import { migrateSaved, totalsOf, type SessionRec } from './store';
import { hintMax, letterHint, nameWithin, namesEcho, namesOverlap } from './text';

describe('names that give each other away', () => {
  it('spots a capital that is in the name of its place', () => {
    expect(namesOverlap('Madrid', 'Comunidad de Madrid')).toBe(true);
    expect(namesOverlap('Murcia', 'Región de Murcia')).toBe(true);
    expect(namesOverlap('Ciudad de Guatemala', 'Guatemala')).toBe(true);
    expect(namesOverlap('Ciudad de México', 'México')).toBe(true);
    expect(namesOverlap('San Salvador', 'El Salvador')).toBe(true);
    expect(namesOverlap('Santo Tomé', 'Santo Tomé y Príncipe')).toBe(true);
    expect(namesOverlap('Las Palmas de Gran Canaria', 'Las Palmas')).toBe(true);
    expect(namesOverlap('Oklahoma City', 'Oklahoma')).toBe(true);
    expect(namesOverlap('LUXEMBURGO', 'luxemburgo')).toBe(true);
  });

  it('tells which of two names is inside the other', () => {
    expect(nameWithin('Madrid', 'Comunidad de Madrid')).toBe(true);
    expect(nameWithin('Comunidad de Madrid', 'Madrid')).toBe(false);
    expect(nameWithin('Leribe', 'Leribe')).toBe(true);
    // "Marne" does not hold "Châlons-sur-Marne": typing the department is not typing its prefecture.
    expect(nameWithin('Châlons-sur-Marne', 'Marne')).toBe(false);
    expect(nameWithin('de la', 'Castilla-La Mancha')).toBe(false);
  });

  it('lets through the capitals that have to be known', () => {
    expect(namesOverlap('Sevilla', 'Andalucía')).toBe(false);
    expect(namesOverlap('Vitoria', 'Álava')).toBe(false);
    expect(namesOverlap('Santo Domingo', 'República Dominicana')).toBe(false);
    expect(namesOverlap('San José', 'Costa Rica')).toBe(false);
    // Typing "Valencia" or "Brasilia" still takes knowing them…
    expect(namesOverlap('Valencia', 'Comunidad Valenciana')).toBe(false);
    expect(namesOverlap('Brasilia', 'Brasil')).toBe(false);
    expect(namesOverlap('Las Palmas de Gran Canaria', 'Canarias')).toBe(false);
    // …and a name made only of little words gives nothing away.
    expect(namesOverlap('La', 'De la')).toBe(false);
  });

  it('hears the likeness that would single out the answer among four options', () => {
    expect(namesEcho('Valencia', 'Comunidad Valenciana')).toBe(true);
    expect(namesEcho('Las Palmas de Gran Canaria', 'Canarias')).toBe(true);
    expect(namesEcho('Brasilia', 'Brasil')).toBe(true);
    expect(namesEcho('Argel', 'Argelia')).toBe(true);
    expect(namesEcho('Indianápolis', 'Indiana')).toBe(true);
    expect(namesEcho('Santiago de Compostela', 'Galicia')).toBe(false);
    expect(namesEcho('Toledo', 'Castilla-La Mancha')).toBe(false);
    expect(namesEcho('Santo Domingo', 'República Dominicana')).toBe(false);
    expect(namesEcho('Pontoise', "Val-d'Oise")).toBe(false);
    // Short words are too common to mean anything: "San" is not a likeness.
    expect(namesEcho('San Juan', 'San Luis')).toBe(false);
    expect(namesEcho('Río Gallegos', 'Río Negro')).toBe(false);
  });
});

describe('letter hints', () => {
  it('shows the first letters and keeps the gaps between words', () => {
    expect(letterHint('Teruel', 2)).toBe('T e _ _ _ _');
    expect(letterHint('País Vasco', 1)).toBe('P _ _ _   _ _ _ _ _');
    expect(letterHint('Castilla-La Mancha', 0)).toBe('_ _ _ _ _ _ _ _ - _ _   _ _ _ _ _ _');
    expect(letterHint("Val-d'Oise", 4)).toBe("V a l - d ' _ _ _ _");
  });

  it('always leaves the last letter for the player', () => {
    expect(hintMax('Teruel')).toBe(5);
    expect(hintMax('La Rioja')).toBe(6);
    expect(hintMax("Côte-d'Or")).toBe(6);
    expect(hintMax('A')).toBe(0);
    expect(letterHint('La Rioja', hintMax('La Rioja'))).toBe('L a   R i o j _');
  });
});

describe('distances on a map', () => {
  const madrid: [number, number] = [-3.7, 40.42];
  const barcelona: [number, number] = [2.17, 41.39];
  const seville: [number, number] = [-5.98, 37.39];
  const tenerife: [number, number] = [-16.25, 28.47];

  it('measures how far apart the farthest points lie', () => {
    expect(spanKm([madrid])).toBe(1);
    expect(spanKm([madrid, barcelona])).toBeGreaterThan(480);
    expect(spanKm([madrid, barcelona])).toBeLessThan(520);
    // The order the points come in does not matter.
    expect(spanKm([madrid, seville, barcelona, tenerife])).toBeCloseTo(spanKm([tenerife, barcelona, madrid, seville]), 6);
    expect(spanKm([madrid, seville, barcelona, tenerife])).toBeGreaterThan(2100);
  });

  it('asks for more precision on a small map than on a big one', () => {
    const spain = tolerances([madrid, seville, barcelona, tenerife]);
    expect(spain.ok).toBeGreaterThan(60);
    expect(spain.ok).toBeLessThan(75);
    expect(spain.warn).toBe(Math.round(spain.ok * 2.6));
    // Never tighter than a city is wide, never looser than a country is.
    expect(tolerances([madrid, [-3.6, 40.5]]).ok).toBe(15);
    expect(tolerances([madrid, [139.7, 35.7], [-58.4, -34.6], [151.2, -33.9]]).ok).toBe(500);
  });

  it('finds the nearest pieces, the target left out', () => {
    const items = [
      { id: 'M', lp: madrid },
      { id: 'B', lp: barcelona },
      { id: 'S', lp: seville },
      { id: 'T', lp: tenerife },
    ];
    expect(nearest(items[0], items, 2).map((x) => x.id)).toEqual(['S', 'B']);
    expect(nearest(items[3], items, 9).map((x) => x.id)).toEqual(['S', 'M', 'B']);
    // Across the date line, Fiji is next to Samoa, not at the other end of the world.
    const pacific = [
      { id: 'FJ', lp: [178, -18] as [number, number] },
      { id: 'WS', lp: [-172, -13.8] as [number, number] },
      { id: 'AU', lp: [134, -25] as [number, number] },
    ];
    expect(nearest(pacific[0], pacific, 1)[0].id).toBe('WS');
  });
});

describe('what an older version saved', () => {
  it('moves the players of version 1 to typing, once', () => {
    const old = { opts: { answer: 'choice', length: 10 }, sel: { regions: ['ES'] } };
    expect(migrateSaved(old, 1)).toEqual({ opts: { answer: 'type', length: 10 }, sel: { regions: ['ES'] } });
    // The object that was read is left as it was.
    expect(old.opts.answer).toBe('choice');
    // Whoever chose four options again in version 2 keeps them.
    expect(migrateSaved({ opts: { answer: 'choice' } }, 2)).toEqual({ opts: { answer: 'choice' } });
    expect(migrateSaved(undefined, 0)).toEqual({});
    expect(migrateSaved({ sel: {} }, 1)).toEqual({ sel: {} });
  });

  it('adds up the tallies of players from before they were kept', () => {
    const rec = (total: number, ok: number, warn: number, ms: number): SessionRec => ({ t: 1, section: 'regions', mode: 'pin', label: 'x', total, ok, warn, bad: total - ok - warn, ms });
    expect(totalsOf([])).toEqual({});
    expect(totalsOf([rec(10, 7, 2, 60_000), rec(5, 5, 0, 20_000)])).toEqual({ g: 2, q: 15, ok: 12, warn: 2, ms: 80_000 });
  });
});
