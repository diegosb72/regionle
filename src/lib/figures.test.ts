import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { TOP_MIN, challenger, comparable, countryFigs, countryValue, dealFive, deckFigs, figPlayable, figureOf, fullOf, metricOf, metricsIn, peopled, positionFigs, regionFigOf, tooClose, topOf, topSize, type Fig, type MetricId } from './figures';
import { setLang } from './i18n';
import { mulberry32 } from './text';
import type { Country, Deck, Index, Item } from './types';

const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/data/index.json'), 'utf8')) as Index;
const byId = new Map(index.countries.map((c) => [c.id, c]));
const country = (id: string): Country => byId.get(id)!;

const item = (patch: Partial<Item> & { id: string }): Item =>
  ({ kind: 'unit', shape: 'area', name: patch.id, en: patch.id, answers: [patch.id], proper: [], country: country('ES'), type: 'provincia', lp: [0, 0], fp: [], area: 0, nb: [], sl: [], ...patch }) as unknown as Item;
const deck = (items: Item[], countries: Country[] = [country('ES')]): Deck => ({ items, countries }) as unknown as Deck;
const fig = (id: string, value: number, metric: MetricId = 'pop'): Fig => ({ id, name: id, type: 'país', value, metric, item: item({ id }), answers: { name: id, answers: [id], proper: [] } as unknown as Fig['answers'] });
const asItem = (c: Country): Item => item({ id: c.id, kind: 'country' });
const asAnswers = (c: Country) => ({ name: c.n.es, answers: [c.n.es], proper: [] }) as unknown as Fig['answers'];

beforeEach(() => setLang('es'));

describe('the figures and how they are said', () => {
  it('names each one in the language of the interface', () => {
    expect(metricOf('pop').noun).toBe('población');
    expect(metricOf('density').short(93.7)).toBe('94 hab./km²');
    expect(metricOf('density').short(3.26)).toBe('3,3 hab./km²');
    expect(metricOf('elev').full(8849)).toBe('8849 m de altitud');
    expect(metricOf('area').order).toBe('de mayor a menor superficie');
    expect(metricOf('area').short(505_990)).toBe('506 mil km²');
    expect(metricOf('area').short(468)).toBe('468 km²');
    expect(metricOf('pop').short(47_400_000)).toBe('47,4 M');
    setLang('en');
    expect(metricOf('area').short(505_990)).toBe('506k km²');
    expect(metricOf('pop').short(94_200)).toBe('94.2k');
    expect(metricOf('pop').noun).toBe('population');
    expect(metricOf('elev').more).toBe('Higher');
    expect(metricOf('density').short(93.7)).toBe('94 per km²');
  });

  it('gives the same object every time, one for each language', () => {
    expect(metricOf('area')).toBe(metricOf('area'));
    const es = metricOf('area');
    setLang('en');
    expect(metricOf('area')).not.toBe(es);
  });

  it('says a position with its hemisphere; a longitude is kept with the sign turned, west being the larger', () => {
    expect(metricOf('lat').short(40.4)).toBe('40,4° N');
    expect(metricOf('lat').short(-33.9)).toBe('33,9° S');
    // Madrid lies at 3.7° W: kept as +3.7.
    expect(metricOf('lon').short(3.7)).toBe('3,7° O');
    expect(metricOf('lon').short(-139.7)).toBe('139,7° E');
    setLang('en');
    expect(metricOf('lon').short(3.7)).toBe('3.7° W');
  });
});

describe('the figures of the countries', () => {
  it('are read from the data: people, km², people per km² and where the country lies', () => {
    const es = country('ES');
    expect(countryValue(es, 'pop')).toBe(es.pop);
    expect(countryValue(es, 'area')).toBe(es.ar);
    expect(countryValue(es, 'density')).toBeCloseTo(es.pop! / es.ar);
    expect(countryValue(es, 'lat')).toBe(es.lp[1]);
    expect(countryValue(es, 'lon')).toBe(-es.lp[0]);
    expect(countryValue(es, 'elev')).toBe(0);
  });

  it('put the well known ones where they belong', () => {
    const figs = countryFigs(index.countries.filter((c) => c.cl === 'un'), 'density', asItem, asAnswers);
    const order = topOf(figs, figs.length).map((f) => f.id);
    expect(order[0]).toBe('MC');
    expect(order.indexOf('NL')).toBeLessThan(order.indexOf('ES'));
    expect(order.indexOf('ES')).toBeLessThan(order.indexOf('AU'));
    expect(order.at(-1)).toBe('MN');
  });

  it('leave out the ones the data has no figure for, but never a position', () => {
    const empty = { ...country('ES'), id: 'ZZ', pop: undefined } as Country;
    expect(countryFigs([empty, country('FR')], 'pop', asItem, asAnswers).map((f) => f.id)).toEqual(['FR']);
    expect(countryFigs([empty, country('FR')], 'density', asItem, asAnswers).map((f) => f.id)).toEqual(['FR']);
    // The equator and the Greenwich meridian are figures too.
    const zero = { ...country('ES'), id: 'ZZ', lp: [0, 0] } as Country;
    expect(countryFigs([zero], 'lat', asItem, asAnswers)).toHaveLength(1);
    expect(countryFigs([zero], 'lon', asItem, asAnswers)).toHaveLength(1);
  });

  it('carry the flag and the name of each country', () => {
    const [f] = countryFigs([country('PT')], 'area', asItem, asAnswers);
    expect(f).toMatchObject({ id: 'PT', name: 'Portugal', fl: country('PT').fl, type: 'país', metric: 'area', value: country('PT').ar });
  });
});

describe('the figure of each thing on a map', () => {
  it('is the people of a city, the height of a peak and the size of anything with a surface', () => {
    expect(figureOf(item({ id: 'c', kind: 'city', shape: 'point', pop: 3_200_000 }))).toEqual({ metric: 'pop', value: 3_200_000 });
    expect(figureOf(item({ id: 'p', kind: 'feature', shape: 'point', cat: 'peak', elev: 3479 }))).toEqual({ metric: 'elev', value: 3479 });
    expect(figureOf(item({ id: 'l', kind: 'feature', cat: 'lake', area: 580 }))).toEqual({ metric: 'area', value: 580 });
    expect(figureOf(item({ id: 'u', area: 15_000 }))).toEqual({ metric: 'area', value: 15_000 });
  });

  it('is none for a river, and for what the data gives no size', () => {
    expect(figureOf(item({ id: 'r', kind: 'feature', shape: 'line', cat: 'river', area: 0 }))).toBeNull();
    expect(figureOf(item({ id: 'c', kind: 'city', shape: 'point' }))).toBeNull();
    expect(figureOf(item({ id: 'd', kind: 'feature', cat: 'desert', area: 0 }))).toBeNull();
    expect(figureOf(item({ id: 'p', kind: 'feature', shape: 'point', cat: 'peak', elev: 0 }))).toBeNull();
  });

  it('shows the flag of the country only where the map has several', () => {
    const madrid = item({ id: 'm', kind: 'city', shape: 'point', pop: 3_300_000, country: country('ES'), type: 'ciudad' });
    const paris = item({ id: 'p', kind: 'city', shape: 'point', pop: 2_100_000, country: country('FR'), type: 'ciudad' });
    const one = deckFigs(deck([madrid]));
    expect(one[0].fl).toBeUndefined();
    expect(one[0].sub).toBeUndefined();
    const two = deckFigs(deck([madrid, paris], [country('ES'), country('FR')]));
    expect(two.map((f) => f.fl)).toEqual([country('ES').fl, country('FR').fl]);
    expect(two.map((f) => f.sub)).toEqual(['España', 'Francia']);
  });

  it('never gives a flag to a river or a peak, which belong to no single country', () => {
    const peak = item({ id: 'p', kind: 'feature', shape: 'point', cat: 'peak', elev: 4808, country: country('FR') });
    expect(deckFigs(deck([peak], [country('FR'), country('IT')]))[0]).toMatchObject({ fl: undefined, sub: undefined, metric: 'elev' });
  });

  it('skips what has nothing to compare and keeps the rest in order', () => {
    const list = [item({ id: 'a', area: 10 }), item({ id: 'r', kind: 'feature', shape: 'line', cat: 'river' }), item({ id: 'b', area: 30 })];
    expect(deckFigs(deck(list)).map((f) => f.id)).toEqual(['a', 'b']);
  });
});

describe('the people of the regions', () => {
  const regions = (items: Item[]): Deck => ({ scope: 'regions', items, countries: [country('ES')] }) as unknown as Deck;
  const madrid = item({ id: 'ES-M', area: 8000, people: 7_000_000, peopleYear: 2024 });
  const soria = item({ id: 'ES-SO', area: 10_000, people: 90_000, peopleYear: 2021 });
  const undated = item({ id: 'ES-X', area: 500, people: 1000 });

  it('are the figure of a map of regions when the game asks for them, each with its year', () => {
    expect(deckFigs(regions([madrid, soria, undated]), 'pop').map((f) => [f.id, f.metric, f.value, f.year])).toEqual([
      ['ES-M', 'pop', 7_000_000, 2024],
      ['ES-SO', 'pop', 90_000, 2021],
      ['ES-X', 'pop', 1000, undefined],
    ]);
    expect(deckFigs(regions([madrid, soria]), 'density').map((f) => [f.id, f.metric, f.value, f.year])).toEqual([
      ['ES-M', 'density', 875, 2024],
      ['ES-SO', 'density', 9, 2021],
    ]);
  });

  it('leave the area as the figure when nothing else is asked for, with no year', () => {
    for (const figs of [deckFigs(regions([madrid, soria])), deckFigs(regions([madrid, soria]), 'area')]) {
      expect(figs.map((f) => [f.metric, f.value, f.year])).toEqual([
        ['area', 8000, undefined],
        ['area', 10_000, undefined],
      ]);
    }
  });

  it('are asked only of the regions: a city keeps its own figure, and a region with none is left out', () => {
    const city = item({ id: 'c', kind: 'city', shape: 'point', pop: 300_000, people: 5 });
    const empty = item({ id: 'ES-Y', area: 700 });
    expect(deckFigs(regions([madrid, city, empty]), 'pop').map((f) => [f.id, f.value])).toEqual([
      ['ES-M', 7_000_000],
      ['c', 300_000],
    ]);
    // Nor is there a density where the data give no area to spread the people over.
    expect(deckFigs(regions([item({ id: 'ES-Z', people: 10 })]), 'density')).toEqual([]);
  });

  it('are played only where every region of the map has them: with one missing, the map is played by its area', () => {
    expect(regionFigOf(regions([madrid, soria]), 'pop')).toBe('pop');
    expect(regionFigOf(regions([madrid, soria]), 'density')).toBe('density');
    expect(regionFigOf(regions([madrid, item({ id: 'ES-Y', area: 700 })]), 'pop')).toBe('area');
    expect(regionFigOf(regions([madrid, item({ id: 'ES-Y', area: 700 })]), 'density')).toBe('area');
    // People with no area can be counted, and cannot be spread.
    expect(regionFigOf(regions([madrid, item({ id: 'ES-Z', people: 10 })]), 'pop')).toBe('pop');
    expect(regionFigOf(regions([madrid, item({ id: 'ES-Z', people: 10 })]), 'density')).toBe('area');
    expect(regionFigOf(regions([]), 'pop')).toBe('area');
  });

  it('are not the figure of any other map, nor of a game that asks for nothing or for something unknown', () => {
    expect(regionFigOf({ scope: 'cities', items: [madrid], countries: [country('ES')] } as unknown as Deck, 'pop')).toBe('area');
    expect(regionFigOf(regions([madrid]), undefined)).toBe('area');
    expect(regionFigOf(regions([madrid]), 'area')).toBe('area');
    expect(regionFigOf(regions([madrid]), 'elev' as never)).toBe('area');
  });

  it('can be played in the countries whose divisions carry them, and only when all the countries chosen do', () => {
    expect(peopled([country('ES')])).toBe(true);
    expect(peopled([country('ES'), country('FR'), country('DE')])).toBe(true);
    // Every district of Portugal carries in Wikidata the people of its capital: they do not add up.
    expect(country('PT').rp).toBeUndefined();
    expect(peopled([country('PT')])).toBe(false);
    expect(peopled([country('ES'), country('PT')])).toBe(false);
    expect(peopled([])).toBe(false);
  });

  it('are said with their year', () => {
    const [m, x] = deckFigs(regions([madrid, undated]), 'pop');
    expect(fullOf(m)).toBe('7 millones de habitantes (2024)');
    expect(fullOf(x)).toBe('1000 habitantes');
    expect(fullOf(fig('ES', 47_400_000))).toBe('47,4 millones de habitantes');
    setLang('en');
    expect(fullOf(deckFigs(regions([madrid]), 'pop')[0])).toBe('7 million people (2024)');
  });
});

describe('where things lie, as figures', () => {
  const north = item({ id: 'n', lp: [-5.8, 43.4] });
  const south = item({ id: 's', lp: [-4.4, 36.7] });
  const east = item({ id: 'e', lp: [2.2, 41.4] });
  const river = item({ id: 'r', kind: 'feature', shape: 'line', cat: 'river', lp: [0, 40] });

  it('order from north to south by latitude', () => {
    const figs = positionFigs(deck([south, north, east]), 'lat');
    expect(topOf(figs, 3).map((f) => f.id)).toEqual(['n', 'e', 's']);
    expect(figs.every((f) => f.metric === 'lat')).toBe(true);
  });

  it('order from west to east by longitude', () => {
    expect(topOf(positionFigs(deck([south, north, east]), 'lon'), 3).map((f) => f.id)).toEqual(['n', 's', 'e']);
  });

  it('leave lines out: a river is not at one place', () => {
    expect(positionFigs(deck([north, river]), 'lat').map((f) => f.id)).toEqual(['n']);
  });
});

describe('telling figures apart', () => {
  it('takes two too close to call for the same: under 2 % apart, or half a degree', () => {
    expect(tooClose(fig('a', 1000), fig('b', 985))).toBe(true);
    expect(tooClose(fig('a', 1000), fig('b', 970))).toBe(false);
    expect(tooClose(fig('a', 40.2, 'lat'), fig('b', 40.6, 'lat'))).toBe(true);
    expect(tooClose(fig('a', 40.2, 'lat'), fig('b', 41.0, 'lat'))).toBe(false);
    // Either side of the equator, or of Greenwich.
    expect(tooClose(fig('a', -0.2, 'lon'), fig('b', 0.2, 'lon'))).toBe(true);
    expect(tooClose(fig('a', -3, 'lat'), fig('b', 3, 'lat'))).toBe(false);
  });

  it('asks more of two counts of people of different years: the older one has moved since', () => {
    const of = (id: string, value: number, year?: number): Fig => ({ ...fig(id, value), ...(year ? { year } : {}) });
    // The same year: 2 %, as ever.
    expect(tooClose(of('a', 1000, 2020), of('b', 970, 2020))).toBe(false);
    expect(tooClose(of('a', 1000, 2020), of('b', 985, 2020))).toBe(true);
    // A year and a half per cent for each year between them, on top of the 2 %: ten years, 17 %.
    expect(tooClose(of('a', 1000, 2020), of('b', 970, 2010))).toBe(true);
    expect(tooClose(of('a', 1000, 2020), of('b', 840, 2010))).toBe(true);
    expect(tooClose(of('a', 1000, 2020), of('b', 820, 2010))).toBe(false);
    expect(tooClose(of('a', 1000, 2010), of('b', 820, 2020))).toBe(false);
    // Never more than 30 %, however far apart the years.
    expect(tooClose(of('a', 1000, 2024), of('b', 710, 1990))).toBe(true);
    expect(tooClose(of('a', 1000, 2024), of('b', 690, 1990))).toBe(false);
    // A count with no date is taken to be ten years from one that has it.
    expect(tooClose(of('a', 1000, 2020), of('b', 840))).toBe(true);
    expect(tooClose(of('a', 1000), of('b', 820, 2020))).toBe(false);
    // And two with no date are told apart as any two figures.
    expect(tooClose(of('a', 1000), of('b', 970))).toBe(false);
  });

  it('counts the figures of a mixed map, the commonest first', () => {
    expect(metricsIn([fig('a', 1, 'elev'), fig('b', 2, 'area'), fig('c', 3, 'area')])).toEqual(['area', 'elev']);
    expect(metricsIn([])).toEqual([]);
  });

  it('keeps for the games only what has something to be compared with', () => {
    const mixed = [fig('peak', 3000, 'elev'), fig('lake', 500, 'area'), fig('sea', 90_000, 'area')];
    expect(comparable(mixed).map((f) => f.id)).toEqual(['lake', 'sea']);
    expect(figPlayable(mixed)).toBe(true);
    expect(figPlayable([fig('peak', 3000, 'elev'), fig('lake', 500, 'area')])).toBe(false);
    expect(figPlayable([])).toBe(false);
  });
});

describe('the top of a list', () => {
  it('is ten, or half of a short list', () => {
    expect(topSize(193)).toBe(10);
    expect(topSize(20)).toBe(10);
    expect(topSize(19)).toBe(9);
    expect(topSize(TOP_MIN)).toBe(3);
    expect(topSize(1)).toBe(0);
  });

  it('holds the largest first and does not touch the list', () => {
    const list = [fig('a', 5), fig('b', 50), fig('c', 20)];
    expect(topOf(list, 2).map((f) => f.id)).toEqual(['b', 'c']);
    expect(list.map((f) => f.id)).toEqual(['a', 'b', 'c']);
  });

  it('names the ten most populous countries of the world as they are known', () => {
    const figs = countryFigs(index.countries.filter((c) => c.cl === 'un'), 'pop', asItem, asAnswers);
    const top = topOf(figs, 10).map((f) => f.id);
    expect(top.slice(0, 2).sort()).toEqual(['CN', 'IN']);
    expect(top[2]).toBe('US');
    for (const id of ['ID', 'PK', 'NG', 'BR', 'BD', 'RU']) expect(top, id).toContain(id);
  });
});

describe('higher or lower: who comes next', () => {
  const list = [fig('a', 100), fig('b', 150), fig('c', 104), fig('d', 1000), fig('h', 9, 'elev')];
  /** Takes the first of those it is offered, and keeps what it was offered. */
  const all = (seen: Fig[][]) => (l: readonly Fig[]): Fig => {
    seen.push([...l]);
    return l[0];
  };

  it('is of the same figure and never the one on show', () => {
    const seen: Fig[][] = [];
    challenger(list, list[0], 0, [], all(seen));
    expect(seen[0].map((f) => f.id)).toEqual(['b', 'd']);
  });

  it('starts far apart and comes closer as the streak grows', () => {
    const at = (streak: number) => {
      const seen: Fig[][] = [];
      challenger(list, list[0], streak, [], all(seen));
      return seen[0].map((f) => f.id);
    };
    expect(at(0)).toEqual(['b', 'd']);
    expect(at(3)).toEqual(['b', 'd']);
    // From eight in a row, nearly alike: within 3 % to four times.
    expect(at(8)).toEqual(['b', 'c']);
  });

  it('leaves out the ones seen lately while there are others', () => {
    const seen: Fig[][] = [];
    challenger(list, list[0], 0, ['b'], all(seen));
    expect(seen[0].map((f) => f.id)).toEqual(['d']);
    // With everything seen, anything of the same figure will do.
    challenger(list, list[0], 0, ['b', 'c', 'd'], all(seen));
    expect(seen[1].map((f) => f.id)).toEqual(['b', 'c', 'd']);
  });

  it('falls back on what is free when nothing is the right distance away', () => {
    const seen: Fig[][] = [];
    challenger([fig('a', 100), fig('c', 104)], list[0], 0, [], all(seen));
    expect(seen[0].map((f) => f.id)).toEqual(['c']);
  });

  it('does not set against each other two counts that their years alone could tell apart', () => {
    const of = (id: string, value: number, year: number): Fig => ({ ...fig(id, value), year });
    const now = of('a', 1000, 2024);
    // 12 % more people, counted fourteen years before: the two may have changed places since. 12 % more,
    // counted the same year: a fair question from the third in a row.
    const dated = [now, of('old', 1120, 2010), of('same', 1125, 2024), of('far', 3000, 2010)];
    const at = (streak: number, recent: string[] = []) => {
      const seen: Fig[][] = [];
      challenger(dated, now, streak, recent, all(seen));
      return seen[0].map((f) => f.id);
    };
    expect(at(3)).toEqual(['same', 'far']);
    expect(at(8)).toEqual(['same', 'far']);
    // With nothing the right distance away, what is clear comes before what is not…
    expect(at(8, ['same', 'far'])).toEqual(['old']);
    const seen: Fig[][] = [];
    challenger([now, of('old', 1120, 2010), of('huge', 90_000, 2024)], now, 8, [], all(seen));
    expect(seen[0].map((f) => f.id)).toEqual(['huge']);
  });
});

describe('five to put in order', () => {
  it('are five different things of one figure', () => {
    const figs = [...Array.from({ length: 12 }, (_, i) => fig(`a${i}`, 100 * (i + 1), 'area')), ...Array.from({ length: 7 }, (_, i) => fig(`p${i}`, 1000 + 400 * i, 'elev'))];
    for (let seed = 1; seed <= 40; seed++) {
      const five = dealFive(figs, mulberry32(seed));
      expect(five).toHaveLength(5);
      expect(new Set(five.map((f) => f.id)).size).toBe(5);
      expect(new Set(five.map((f) => f.metric)).size).toBe(1);
    }
  });

  it('draw each figure as often as the map has things of it', () => {
    const figs = [...Array.from({ length: 18 }, (_, i) => fig(`a${i}`, 100 * (i + 1), 'area')), ...Array.from({ length: 2 }, (_, i) => fig(`p${i}`, 1000 + 400 * i, 'elev'))];
    let peaks = 0;
    for (let seed = 1; seed <= 400; seed++) if (dealFive(figs, mulberry32(seed))[0].metric === 'elev') peaks++;
    // One in ten on average.
    expect(peaks).toBeGreaterThan(15);
    expect(peaks).toBeLessThan(80);
  });

  it('avoid two so close that the order would be a guess, where the list allows', () => {
    const figs = [fig('a', 1000), fig('b', 1005), fig('c', 2000), fig('d', 3000), fig('e', 4000), fig('f', 5000), fig('g', 6000)];
    for (let seed = 1; seed <= 60; seed++) {
      const five = dealFive(figs, mulberry32(seed));
      expect(five.filter((f) => f.id === 'a' || f.id === 'b').length, `seed ${seed}`).toBeLessThan(2);
    }
  });

  it('are fewer on a short list, and none without two of a kind', () => {
    expect(dealFive([fig('a', 1), fig('b', 2), fig('c', 3)])).toHaveLength(3);
    expect(dealFive([fig('a', 1, 'elev'), fig('b', 2, 'area')])).toEqual([]);
    expect(dealFive([])).toEqual([]);
  });
});
