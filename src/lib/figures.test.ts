import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BookFile } from './book';
import { BOOK_FIGS, TOP_MIN, challenger, comparable, countryFigs, countryValue, dealFive, deckFigs, figPlayable, figureOf, fullOf, hintRange, judgeFigure, metricOf, metricsIn, peopled, positionFigs, regionFigOf, tooClose, topOf, topSize, type Fig, type MetricId } from './figures';
import { setLang } from './i18n';
import { mulberry32 } from './text';
import type { Country, Deck, Index, Item } from './types';
import { KM_PER_MILE, setUnits } from './units';

const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/data/index.json'), 'utf8')) as Index;
const byId = new Map(index.countries.map((c) => [c.id, c]));
const country = (id: string): Country => byId.get(id)!;

const item = (patch: Partial<Item> & { id: string }): Item =>
  ({ kind: 'unit', shape: 'area', name: patch.id, en: patch.id, answers: [patch.id], proper: [], country: country('ES'), type: 'provincia', lp: [0, 0], fp: [], area: 0, nb: [], sl: [], ...patch }) as unknown as Item;
const deck = (items: Item[], countries: Country[] = [country('ES')]): Deck => ({ items, countries }) as unknown as Deck;
const fig = (id: string, value: number, metric: MetricId = 'pop'): Fig => ({ id, name: id, type: 'país', value, metric, item: item({ id }), answers: { name: id, answers: [id], proper: [] } as unknown as Fig['answers'] });
const asItem = (c: Country): Item => item({ id: c.id, kind: 'country' });
const asAnswers = (c: Country) => ({ name: c.n.es, answers: [c.n.es], proper: [] }) as unknown as Fig['answers'];

const book = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/data/figures.json'), 'utf8')) as BookFile;

beforeEach(() => {
  setLang('es');
  setUnits('km');
});

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

describe('the figures of The World Factbook and how they are said', () => {
  it('writes each one in its unit', () => {
    expect(metricOf('life').full(83.4)).toBe('83,4 años');
    expect(metricOf('life').short(83)).toBe('83 años');
    expect(metricOf('life').full(1)).toBe('1 año');
    expect(metricOf('age').full(47.2)).toBe('47,2 años');
    expect(metricOf('gdp').full(48_400)).toBe('48.400 $');
    expect(metricOf('gdp').short(800)).toBe('800 $');
    expect(metricOf('urban').full(81.6)).toBe('81,6 %');
    expect(metricOf('urban').short(100)).toBe('100 %');
    expect(metricOf('fert').full(1.32)).toBe('1,32 hijos por mujer');
    expect(metricOf('fert').short(1.32)).toBe('1,32');
    expect(metricOf('coast').full(54_716)).toBe('54.716 km de costa');
    expect(metricOf('coast').short(54_716)).toBe('54.716 km');
    // A short coast has its decimal; a long one would only pretend to.
    expect(metricOf('coast').full(4.1)).toBe('4,1 km de costa');
    expect(metricOf('coast').full(99.94)).toBe('99,9 km de costa');
    expect(metricOf('coast').full(100.4)).toBe('100 km de costa');
    expect(metricOf('high').full(3718)).toBe('3718 m');
    expect(metricOf('high').short(12_345)).toBe('12.345 m');
    setLang('en');
    expect(metricOf('life').full(83.4)).toBe('83.4 years');
    expect(metricOf('life').full(1)).toBe('1 year');
    expect(metricOf('gdp').full(48_400)).toBe('$48,400');
    expect(metricOf('urban').full(81.6)).toBe('81.6%');
    expect(metricOf('fert').full(1.32)).toBe('1.32 children per woman');
    expect(metricOf('coast').full(54_716)).toBe('54,716 km of coast');
    expect(metricOf('high').full(3718)).toBe('3,718 m');
  });

  it('says a coast in miles to whoever counts in miles, and keeps it in kilometres', () => {
    setUnits('mi');
    const coast = metricOf('coast');
    expect(coast.full(4964)).toBe('3084 mi de costa');
    expect(coast.short(100 * KM_PER_MILE)).toBe('100 mi');
    // Under a hundred miles, with its decimal.
    expect(coast.full(160)).toBe('99,4 mi de costa');
    expect(coast.units).toEqual([
      { label: 'mi', factor: KM_PER_MILE },
      { label: 'miles de mi', factor: 1000 * KM_PER_MILE },
    ]);
    expect(coast.defaultUnit).toBe(KM_PER_MILE);
    expect(coast.per).toBe(KM_PER_MILE);
    // A summit is in metres whatever the distances are told in.
    expect(metricOf('high').full(3718)).toBe('3718 m');
    setUnits('km');
    expect(metricOf('coast').units.map((u) => u.label)).toEqual(['km', 'miles de km']);
    expect(metricOf('coast').per).toBe(1);
  });

  it('asks about each in its own words', () => {
    const said = (id: MetricId) => {
      const m = metricOf(id);
      return [m.ask, m.more, m.less, m.exactAsk, m.up, m.down, m.order];
    };
    expect(said('life')).toEqual(['¿Más o menos esperanza de vida?', 'Más esperanza de vida', 'Menos esperanza de vida', '¿Cuál es su esperanza de vida?', 'busca más esperanza de vida', 'busca menos esperanza de vida', 'de mayor a menor esperanza de vida']);
    expect(said('gdp')).toEqual(['¿Más o menos PIB por habitante?', 'Más PIB por habitante', 'Menos PIB por habitante', '¿Cuál es su PIB por habitante?', 'busca más PIB por habitante', 'busca menos PIB por habitante', 'de mayor a menor PIB por habitante']);
    expect(said('age')).toEqual(['¿Mayor o menor edad mediana?', 'Mayor edad mediana', 'Menor edad mediana', '¿Cuál es su edad mediana?', 'busca una edad mediana mayor', 'busca una edad mediana menor', 'de mayor a menor edad mediana']);
    expect(said('urban')).toEqual(['¿Más o menos población urbana?', 'Más población urbana', 'Menos población urbana', '¿Qué parte de su población vive en ciudades?', 'busca más población urbana', 'busca menos población urbana', 'de más a menos población urbana']);
    expect(said('fert')).toEqual(['¿Más o menos hijos por mujer?', 'Más hijos por mujer', 'Menos hijos por mujer', '¿Cuántos hijos tiene una mujer, de media?', 'busca más hijos por mujer', 'busca menos hijos por mujer', 'de más a menos hijos por mujer']);
    expect(said('coast')).toEqual(['¿Más o menos costa?', 'Más costa', 'Menos costa', '¿Cuánto mide su costa?', 'busca más costa', 'busca menos costa', 'de más a menos costa']);
    expect(said('high')).toEqual(['¿Llega más alto o más bajo?', 'Más alto', 'Más bajo', '¿A qué altitud está su punto más alto?', 'busca uno que llegue más alto', 'busca uno que llegue más bajo', 'de mayor a menor altitud máxima']);
    expect(metricOf('urban').compare('Mónaco', 'Singapur')).toBe('¿En Mónaco vive en ciudades una parte mayor o menor de la población que en Singapur?');
    expect(metricOf('age').compare('Japón', 'Níger')).toBe('¿La edad mediana de Japón es mayor o menor que la de Níger?');
    expect(metricOf('high').compare('Nepal', 'Suiza')).toBe('¿Nepal llega más alto o más bajo que Suiza?');
    setLang('en');
    expect(said('life')).toEqual(['A longer or a shorter life expectancy?', 'Longer life expectancy', 'Shorter life expectancy', 'What is its life expectancy?', 'look for a longer life expectancy', 'look for a shorter life expectancy', 'from longest to shortest life expectancy']);
    expect(said('age')).toEqual(['A higher or a lower median age?', 'Higher median age', 'Lower median age', 'What is its median age?', 'look for a higher median age', 'look for a lower median age', 'from highest to lowest median age']);
    expect(metricOf('fert').compare('Niger', 'Japan')).toBe('Do women have more or fewer children in Niger than in Japan?');
    // No question of the seven is the question of another.
    for (const lang of ['es', 'en'] as const) {
      setLang(lang);
      for (const at of [0, 1, 2, 3, 4, 5, 6]) expect(new Set(BOOK_FIGS.map((id) => said(id)[at])).size, `${lang} ${at}`).toBe(BOOK_FIGS.length);
    }
  });

  it('says which of them take «este»: only what each person makes', () => {
    expect(BOOK_FIGS.filter((id) => metricOf(id).masc)).toEqual(['gdp']);
    expect((['pop', 'area', 'density', 'elev'] as const).filter((id) => metricOf(id).masc)).toEqual([]);
  });

  it('is typed in the unit of each: what each person makes, in thousands of dollars or one by one', () => {
    expect(metricOf('gdp').units).toEqual([
      { label: '$', factor: 1 },
      { label: 'miles de $', factor: 1000 },
    ]);
    expect(metricOf('gdp').defaultUnit).toBe(1000);
    expect(metricOf('life').units).toEqual([{ label: 'años', factor: 1 }]);
    expect(metricOf('urban').units).toEqual([{ label: '%', factor: 1 }]);
    expect(metricOf('fert').units).toEqual([{ label: 'hijos por mujer', factor: 1 }]);
    expect(metricOf('high').units).toEqual([{ label: 'm', factor: 1 }]);
    // The unit a game starts with is one of those it offers.
    for (const id of BOOK_FIGS) expect(metricOf(id).units.map((u) => u.factor), id).toContain(metricOf(id).defaultUnit);
  });

  it('judges by how much, and not by what share, the four that lie close together from one country to the next', () => {
    const near = (id: MetricId) => {
      const n = metricOf(id).near;
      return n ? [n.ok, n.close, n.band] : null;
    };
    expect(near('life')).toEqual([2, 5, 10]);
    expect(near('age')).toEqual([2, 5, 10]);
    expect(near('urban')).toEqual([5, 15, 20]);
    expect(near('fert')).toEqual([0.2, 0.5, 1]);
    for (const id of ['gdp', 'coast', 'high', 'pop', 'area', 'density', 'elev'] as const) expect(near(id), id).toBeNull();
    for (const id of ['life', 'age', 'urban', 'fert'] as const) {
      const n = metricOf(id).near!;
      expect(n.ok, id).toBeLessThan(n.close);
      expect(n.close, id).toBeLessThanOrEqual(n.band);
    }
    // A tenth of the years people live, or of their age, would be far wider: nearly any guess would be right.
    for (const id of ['life', 'age'] as const) {
      const values = Object.values(book.c).map((rec) => rec[id]).filter((v): v is number => v != null);
      const middle = [...values].sort((a, b) => a - b)[values.length >> 1];
      expect(metricOf(id).near!.ok * 1.5, id).toBeLessThan(middle * 0.1);
    }
    // And a tenth of a small share, or of few children, would be next to nothing: under a point of the people
    // of the least urban country, and under a tenth of a child where women have fewest.
    const least = (id: 'urban' | 'fert') => Math.min(...Object.values(book.c).map((rec) => rec[id]).filter((v): v is number => v != null));
    expect(least('urban') * 0.1).toBeLessThan(1);
    expect(least('fert') * 0.1).toBeLessThan(0.1);
  });

  it('says a range and a difference of those four', () => {
    expect(metricOf('life').near!.span(80, 90)).toBe('80 y 90 años');
    expect(metricOf('age').near!.span(40, 50)).toBe('40 y 50 años');
    expect(metricOf('urban').near!.span(80, 100)).toBe('el 80 y el 100 %');
    expect(metricOf('fert').near!.span(1, 2)).toBe('1 y 2 hijos por mujer');
    expect(metricOf('life').near!.gap(2)).toBe('2 años');
    expect(metricOf('life').near!.gap(1)).toBe('1 año');
    expect(metricOf('life').near!.gap(15.2)).toBe('15,2 años');
    expect(metricOf('urban').near!.gap(5)).toBe('5 puntos');
    expect(metricOf('urban').near!.gap(1)).toBe('1 punto');
    expect(metricOf('urban').near!.gap(12.4)).toBe('12,4 puntos');
    expect(metricOf('fert').near!.gap(0.2)).toBe('0,2 hijos');
    expect(metricOf('fert').near!.gap(1)).toBe('1 hijo');
    setLang('en');
    expect(metricOf('life').near!.span(80, 90)).toBe('80 and 90 years');
    expect(metricOf('urban').near!.span(80, 100)).toBe('80 and 100%');
    expect(metricOf('fert').near!.span(1, 2)).toBe('1 and 2 children per woman');
    expect(metricOf('life').near!.gap(1)).toBe('1 year');
    expect(metricOf('urban').near!.gap(5)).toBe('5 points');
    expect(metricOf('urban').near!.gap(1)).toBe('1 point');
    expect(metricOf('fert').near!.gap(0.5)).toBe('0.5 children');
    expect(metricOf('fert').near!.gap(1)).toBe('1 child');
  });
});

describe('the figures of the countries that come from The World Factbook', () => {
  const made: BookFile = { y: { life: 2024, gdp: 2024 }, c: { ES: { life: 83, gdp: 48400, coast: 4964 }, KR: { life: 83.4, gdp: 50000, y: { gdp: 2023 } }, CH: { life: 83.9, gdp: 82000 } } };
  const three = [country('ES'), country('KR'), country('CH')];

  it('are read from the book, each with the year it is of', () => {
    expect(countryFigs(three, 'life', asItem, asAnswers, made).map((f) => [f.id, f.value, f.year])).toEqual([
      ['ES', 83, 2024],
      ['KR', 83.4, 2024],
      ['CH', 83.9, 2024],
    ]);
    // The year of a country that has the figure of another one is its own.
    expect(countryFigs(three, 'gdp', asItem, asAnswers, made).map((f) => [f.id, f.value, f.year])).toEqual([
      ['ES', 48400, 2024],
      ['KR', 50000, 2023],
      ['CH', 82000, 2024],
    ]);
    const [es] = countryFigs(three, 'gdp', asItem, asAnswers, made);
    expect(es).toMatchObject({ id: 'ES', name: 'España', fl: country('ES').fl, type: 'país', metric: 'gdp' });
    expect(fullOf(es)).toBe('48.400 $ (2024)');
  });

  it('leave out the countries the book does not give the figure of', () => {
    // Only one of the three has a sea.
    const coast = countryFigs(three, 'coast', asItem, asAnswers, made);
    expect(coast.map((f) => f.id)).toEqual(['ES']);
    // A coast is of no year, and says none.
    expect(coast[0]).not.toHaveProperty('year');
    expect(fullOf(coast[0])).toBe('4964 km de costa');
    expect(countryFigs(three, 'high', asItem, asAnswers, made)).toEqual([]);
    expect(countryFigs([country('FR')], 'life', asItem, asAnswers, made)).toEqual([]);
  });

  it('are none until the book has come', () => {
    expect(countryFigs(three, 'life', asItem, asAnswers)).toEqual([]);
    expect(countryFigs(three, 'life', asItem, asAnswers, null)).toEqual([]);
  });

  it('are not looked for in the book when the figure is one the countries carry', () => {
    const none: BookFile = { y: {}, c: {} };
    expect(countryFigs(three, 'pop', asItem, asAnswers, none).map((f) => f.value)).toEqual(three.map((c) => c.pop));
    expect(countryFigs(three, 'pop', asItem, asAnswers, made)[0]).not.toHaveProperty('year');
    expect(countryFigs(three, 'area', asItem, asAnswers).map((f) => f.value)).toEqual(three.map((c) => c.ar));
  });

  it('put the well known ones where they belong, with the figures the game has', () => {
    const members = index.countries.filter((c) => c.cl === 'un');
    const first = (id: MetricId, n: number) => topOf(countryFigs(members, id, asItem, asAnswers, book), n).map((f) => f.id);
    expect(first('life', 3)).toEqual(['MC', 'SG', 'JP']);
    expect(first('gdp', 3)).toEqual(['SG', 'LU', 'IE']);
    expect(first('age', 3)).toEqual(['MC', 'JP', 'AD']);
    expect(first('fert', 3)).toEqual(['NE', 'SO', 'AO']);
    expect(first('coast', 4)).toEqual(['CA', 'ID', 'RU', 'PH']);
    expect(first('high', 4)).toEqual(['CN', 'NP', 'PK', 'IN']);
    // No member has a figure of nothing, and the ones without a sea are not in the list of coasts.
    expect(countryFigs(members, 'coast', asItem, asAnswers, book)).toHaveLength(150);
    expect(countryFigs(members, 'high', asItem, asAnswers, book)).toHaveLength(193);
  });
});

describe('judging a guess at a figure', () => {
  it('goes by the share the guess is off, for most figures: a tenth is right and three tenths is close', () => {
    const gdp = metricOf('gdp');
    expect(judgeFigure(53_000, 48_400, gdp)).toMatchObject({ res: 'ok', off: 4600 });
    expect(judgeFigure(53_240, 48_400, gdp).res).toBe('ok');
    expect(judgeFigure(53_300, 48_400, gdp).res).toBe('warn');
    expect(judgeFigure(60_000, 48_400, gdp).res).toBe('warn');
    expect(judgeFigure(70_000, 48_400, gdp).res).toBe('bad');
    expect(judgeFigure(30_000, 48_400, gdp)).toMatchObject({ res: 'bad', off: -18_400 });
    expect(judgeFigure(30_000, 48_400, gdp).error).toBeCloseTo(-0.38, 2);
    // A figure with no rule of its own is judged the same way.
    expect(judgeFigure(105, 100, {}).res).toBe('ok');
    expect(judgeFigure(125, 100, {}).res).toBe('warn');
    expect(judgeFigure(131, 100, {}).res).toBe('bad');
  });

  it('goes by how much the guess is off, for the figures that lie close together', () => {
    const life = metricOf('life');
    // Seventy years for Japan is a miss, though it is less than a fifth off.
    expect(judgeFigure(70, 85.2, life).res).toBe('bad');
    expect(judgeFigure(70, 85.2, life).off).toBeCloseTo(-15.2);
    expect(judgeFigure(70, 85.2, life).error).toBeCloseTo(-0.178, 3);
    expect([81, 83, 85].map((g) => judgeFigure(g, 83, life).res)).toEqual(['ok', 'ok', 'ok']);
    expect([78, 80.9, 85.1, 88].map((g) => judgeFigure(g, 83, life).res)).toEqual(['warn', 'warn', 'warn', 'warn']);
    expect([77.9, 88.1, 40, 120].map((g) => judgeFigure(g, 83, life).res)).toEqual(['bad', 'bad', 'bad', 'bad']);
    const urban = metricOf('urban');
    expect([55, 60, 65].map((g) => judgeFigure(g, 60, urban).res)).toEqual(['ok', 'ok', 'ok']);
    expect([45, 54, 66, 75].map((g) => judgeFigure(g, 60, urban).res)).toEqual(['warn', 'warn', 'warn', 'warn']);
    expect([44, 76].map((g) => judgeFigure(g, 60, urban).res)).toEqual(['bad', 'bad']);
    // A small share is not judged any more kindly: nine in a hundred for six is half as much again, and close.
    expect(judgeFigure(9, 6, urban).res).toBe('ok');
    expect(judgeFigure(20, 6, urban).res).toBe('warn');
  });

  it('takes a guess on the very edge, however the numbers are kept', () => {
    const fert = metricOf('fert');
    // As numbers are kept, 1,6 − 1,4 is a hair more than 0,2, and 2,22 − 1,72 a hair more than 0,5.
    expect(1.6 - 1.4).toBeGreaterThan(0.2);
    expect(judgeFigure(1.4, 1.6, fert).res).toBe('ok');
    expect(judgeFigure(1.8, 1.6, fert).res).toBe('ok');
    expect(2.22 - 1.72).toBeGreaterThan(0.5);
    expect(judgeFigure(2.22, 1.72, fert).res).toBe('warn');
    expect(judgeFigure(1.22, 1.72, fert).res).toBe('warn');
    // One hundredth further is further.
    expect(judgeFigure(1.39, 1.6, fert).res).toBe('warn');
    expect(judgeFigure(1.81, 1.6, fert).res).toBe('warn');
    expect(judgeFigure(2.23, 1.72, fert).res).toBe('bad');
    expect(judgeFigure(1.21, 1.72, fert).res).toBe('bad');
    // The years of Angola, too: 64,9 − 62,9 is a hair more than 2.
    expect(64.9 - 62.9).toBeGreaterThan(2);
    expect(judgeFigure(64.9, 62.9, metricOf('life')).res).toBe('ok');
    expect(judgeFigure(67.9, 62.9, metricOf('life')).res).toBe('warn');
    expect(judgeFigure(68, 62.9, metricOf('life')).res).toBe('bad');
  });

  it('calls right whatever is as far as it says is right, and close whatever is as far as it says is close, of every figure the game has', () => {
    /** The decimals each figure is given with, and so the ones a guess on the edge is typed with. */
    const DECIMALS = { life: 1, age: 1, urban: 1, fert: 2 } as const;
    for (const id of ['life', 'age', 'urban', 'fert'] as const) {
      const m = metricOf(id);
      const typed = (v: number) => Number(v.toFixed(DECIMALS[id]));
      for (const rec of Object.values(book.c)) {
        const real = rec[id];
        if (real == null) continue;
        for (const way of [1, -1]) {
          const right = typed(real + way * m.near!.ok);
          const close = typed(real + way * m.near!.close);
          if (right > 0) expect(judgeFigure(right, real, m).res, `${id}: ${right} for ${real}`).toBe('ok');
          if (close > 0) expect(judgeFigure(close, real, m).res, `${id}: ${close} for ${real}`).toBe('warn');
        }
      }
    }
  });

  it('takes no guess of nothing, nor one below it', () => {
    for (const m of [metricOf('life'), metricOf('gdp')]) {
      expect(judgeFigure(0, 83, m)).toEqual({ res: 'bad', error: -1, off: -83 });
      expect(judgeFigure(-5, 83, m)).toEqual({ res: 'bad', error: -1, off: -83 });
      expect(judgeFigure(Number.NaN, 83, m).res).toBe('bad');
      expect(judgeFigure(5, 0, m)).toEqual({ res: 'bad', error: 0, off: 0 });
    }
  });
});

describe('the range a hint gives for a figure', () => {
  it('is one, two or five times a round figure, for most figures', () => {
    const gdp = metricOf('gdp');
    expect(hintRange(48_400, gdp)).toEqual([20_000, 50_000]);
    expect(hintRange(132_600, gdp)).toEqual([100_000, 200_000]);
    expect(hintRange(800, gdp)).toEqual([500, 1000]);
    expect(hintRange(13_900, gdp)).toEqual([10_000, 20_000]);
    expect(hintRange(4964, metricOf('coast'))).toEqual([2000, 5000]);
    expect(hintRange(4.1, metricOf('coast'))).toEqual([2, 5]);
    expect(hintRange(8849, metricOf('high'))).toEqual([5000, 10_000]);
    // The figure is always inside its range.
    for (const id of ['gdp', 'coast', 'high'] as const) {
      for (const rec of Object.values(book.c)) {
        const v = rec[id];
        if (v == null) continue;
        const [lo, hi] = hintRange(v, metricOf(id));
        expect(lo <= v && v <= hi, `${id} ${v}: ${lo}–${hi}`).toBe(true);
      }
    }
  });

  it('is round in miles for a coast told in miles', () => {
    setUnits('mi');
    // 4964 km are 3084 miles: between two and five thousand of them.
    const [lo, hi] = hintRange(4964, metricOf('coast'));
    expect(lo / KM_PER_MILE).toBeCloseTo(2000);
    expect(hi / KM_PER_MILE).toBeCloseTo(5000);
    expect(metricOf('coast').short(lo)).toBe('2000 mi');
  });

  it('is a band of a fixed width for the figures that lie close together', () => {
    const life = metricOf('life');
    expect(hintRange(85.2, life)).toEqual([80, 90]);
    expect(hintRange(54.4, life)).toEqual([50, 60]);
    expect(hintRange(89.8, life)).toEqual([80, 90]);
    expect(hintRange(47.2, metricOf('age'))).toEqual([40, 50]);
    expect(hintRange(81.6, metricOf('urban'))).toEqual([80, 100]);
    expect(hintRange(9.3, metricOf('urban'))).toEqual([0, 20]);
    expect(hintRange(1.32, metricOf('fert'))).toEqual([1, 2]);
    expect(hintRange(0.68, metricOf('fert'))).toEqual([0, 1]);
    expect(hintRange(6.55, metricOf('fert'))).toEqual([6, 7]);
  });

  it('puts a figure on the edge of two bands in the lower one: all the people in towns is between 80 and 100 %', () => {
    expect(hintRange(100, metricOf('urban'))).toEqual([80, 100]);
    expect(hintRange(80, metricOf('urban'))).toEqual([60, 80]);
    expect(hintRange(20, metricOf('urban'))).toEqual([0, 20]);
    expect(hintRange(80, metricOf('life'))).toEqual([70, 80]);
    expect(hintRange(2, metricOf('fert'))).toEqual([1, 2]);
    expect(hintRange(1, metricOf('fert'))).toEqual([0, 1]);
    // However the numbers are kept: 0,3 is three tenths, and no more.
    expect(hintRange(0.1 + 0.2, { near: { ok: 0.01, close: 0.05, band: 0.1, span: () => '', gap: () => '' } })[1]).toBeCloseTo(0.3);
  });

  it('holds every figure the game has of those four', () => {
    for (const id of ['life', 'age', 'urban', 'fert'] as const) {
      const m = metricOf(id);
      for (const rec of Object.values(book.c)) {
        const v = rec[id];
        if (v == null) continue;
        const [lo, hi] = hintRange(v, m);
        expect(lo < v && v <= hi, `${id} ${v}: ${lo}–${hi}`).toBe(true);
        expect(hi - lo, id).toBeCloseTo(m.near!.band);
        expect(lo, id).toBeGreaterThanOrEqual(0);
      }
    }
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

  it('takes for far apart, in a list that lies close together, what is far in that list', () => {
    // How long people live: nobody lives twice as long as anybody, nor 40 % longer than most.
    const lives = [54.4, 60, 66, 72, 78, 83, 85.2, 89.8].map((v) => fig(`v${v}`, v, 'life'));
    const far = Math.cbrt(89.8 / 54.4);
    expect(far).toBeLessThan(1.4);
    const offered = (current: Fig, streak: number, of: Fig[] = lives) => {
      const seen: Fig[][] = [];
      challenger(of, current, streak, [], all(seen));
      return seen[0];
    };
    // From the middle, the two ends: what is 15 % away is not far there.
    expect(offered(lives[3], 0).map((f) => f.value)).toEqual([54.4, 60, 85.2, 89.8]);
    // Whatever is on show has something far from it, and something that is not.
    for (const current of lives) {
      const list = offered(current, 0);
      expect(list.length, current.id).toBeGreaterThan(0);
      expect(list.length, current.id).toBeLessThan(lives.length - 1);
      for (const f of list) expect(Math.max(f.value / current.value, current.value / f.value), `${current.id} ${f.id}`).toBeGreaterThanOrEqual(far);
    }
    // With the figures the game has, too: every member of the United Nations by how long its people live.
    const real = countryFigs(index.countries.filter((c) => c.cl === 'un'), 'life', asItem, asAnswers, { ...book, y: {} });
    const least = Math.min(...real.map((f) => f.value));
    const most = Math.max(...real.map((f) => f.value));
    for (const current of real) {
      const list = offered(current, 0, real);
      expect(list.length, current.id).toBeGreaterThan(0);
      expect(list.length, current.id).toBeLessThan(real.length - 1);
      for (const f of list) expect(Math.max(f.value / current.value, current.value / f.value), `${current.id} ${f.id}`).toBeGreaterThanOrEqual(Math.cbrt(most / least));
    }
  });

  it('never asks for more than 40 % of difference, however wide the list', () => {
    const wide = [1, 10, 100, 1000, 1300, 1500].map((v) => fig(`v${v}`, v));
    const seen: Fig[][] = [];
    challenger(wide, wide[3], 0, [], all(seen));
    // 1500 is half as much again, and far; 1300 is not.
    expect(seen[0].map((f) => f.value)).toEqual([1, 10, 100, 1500]);
  });

  it('comes as close as the list allows when the streak is long', () => {
    // Three that are within 2 % of each other: what is 1 % away is as near as it gets, and is offered.
    const close = [100, 101, 102].map((v) => fig(`v${v}`, v));
    const seen: Fig[][] = [];
    challenger(close, close[0], 8, [], all(seen));
    expect(seen[0].map((f) => f.value)).toEqual([101, 102]);
    challenger(close, close[0], 0, [], all(seen));
    expect(seen[1].map((f) => f.value)).toEqual([101, 102]);
    challenger(close, close[0], 4, [], all(seen));
    expect(seen[2].map((f) => f.value)).toEqual([101, 102]);
  });

  it('keeps to the 40 % where a figure can be nothing or less, as a position on the map', () => {
    const lats = [-30, 10, 13, 20].map((v) => fig(`v${v}`, v, 'lat'));
    const seen: Fig[][] = [];
    challenger(lats, lats[1], 0, [], all(seen));
    // 13 is 30 % more than 10 and not far; 20 is twice as much.
    expect(seen[0].map((f) => f.value)).toEqual([20]);
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
