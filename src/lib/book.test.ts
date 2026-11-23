/**
 * What The World Factbook says of the countries, as the game has it (public/data/figures.json): that the
 * file is what scripts/data/figures.mjs says it writes, that its figures are what such figures can be, and
 * how the game reads it and names each figure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { bookCount, bookValue, bookYear, type BookFile } from './book';
import { setLang } from './i18n';
import { BOOK_FIGS, COUNTRY_FIGS, isBookFig, metricNoun, metricOrder, type BookFig } from './metricNames';
import type { Index } from './types';
import { eligible } from './world';

const DATA = path.join(__dirname, '../../public/data');
const book = JSON.parse(fs.readFileSync(path.join(DATA, 'figures.json'), 'utf8')) as BookFile;
const index = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8')) as Index;
const byId = new Map(index.countries.map((c) => [c.id, c]));
/** The countries the games of figures are played with. */
const played = index.countries.filter((c) => eligible('pops', c));
const members = played.filter((c) => c.cl === 'un');
const having = (fig: BookFig, of = played) => of.filter((c) => book.c[c.id]?.[fig] != null);

beforeEach(() => setLang('es'));

describe('the file of the figures of The World Factbook', () => {
  it('is about countries the games of figures are played with, in the order the game has them', () => {
    const ids = Object.keys(book.c);
    for (const id of ids) expect(byId.has(id) && eligible('pops', byId.get(id)!), id).toBe(true);
    expect(ids).toEqual(played.filter((c) => book.c[c.id]).map((c) => c.id));
    expect(played).toHaveLength(247);
    expect(ids).toHaveLength(240);
  });

  it('lacks only the countries the book has no page of', () => {
    expect(played.filter((c) => !book.c[c.id]).map((c) => c.id)).toEqual(['AX', 'BQ', 'GF', 'GP', 'MQ', 'RE', 'YT']);
  });

  it('holds nothing but the seven figures, each a number above nothing, and the years that are not the usual ones', () => {
    for (const [id, rec] of Object.entries(book.c)) {
      const keys = Object.keys(rec).filter((k) => k !== 'y');
      expect(keys.length, id).toBeGreaterThan(0);
      // In the order the game lists them.
      expect(keys, id).toEqual(BOOK_FIGS.filter((f) => keys.includes(f)));
      for (const k of keys) {
        const v = rec[k as BookFig];
        expect(typeof v === 'number' && Number.isFinite(v) && v > 0, `${id} ${k}`).toBe(true);
      }
      if (rec.y) {
        expect(Object.keys(rec.y).length, id).toBeGreaterThan(0);
        for (const [k, year] of Object.entries(rec.y)) {
          // Only of a figure the country has, and only when it is not the year of most.
          expect(keys, `${id} ${k}`).toContain(k);
          expect(book.y[k as BookFig], `${id} ${k}`).toBeDefined();
          expect(year, `${id} ${k}`).not.toBe(book.y[k as BookFig]);
          expect(year >= 2015 && year <= 2026, `${id} ${k} ${year}`).toBe(true);
        }
      }
    }
  });

  it('says the year most countries have each figure of, and none for a coast or a summit', () => {
    expect(book.y).toEqual({ life: 2024, gdp: 2024, age: 2025, urban: 2023, fert: 2025 });
    for (const fig of ['life', 'gdp', 'age', 'urban', 'fert'] as const) {
      const odd = having(fig).filter((c) => book.c[c.id].y?.[fig] != null).length;
      // Most are of that year: the others are few.
      expect(odd * 10, fig).toBeLessThan(having(fig).length);
    }
  });

  it('keeps each figure within what such a figure can be', () => {
    const span = (fig: BookFig) => {
      const values = having(fig).map((c) => book.c[c.id][fig]!);
      return [Math.min(...values), Math.max(...values)];
    };
    expect(span('life')).toEqual([54.4, 89.8]);
    expect(span('gdp')).toEqual([800, 132600]);
    expect(span('age')).toEqual([15.3, 57.5]);
    expect(span('urban')).toEqual([9.3, 100]);
    expect(span('fert')).toEqual([0.68, 6.55]);
    expect(span('coast')).toEqual([4.1, 202080]);
    expect(span('high')).toEqual([5, 8849]);
    // What each person makes is a round figure of dollars, and a summit a whole number of metres.
    for (const c of having('gdp')) expect(book.c[c.id].gdp! % 100, c.id).toBe(0);
    for (const c of having('high')) expect(Number.isInteger(book.c[c.id].high), c.id).toBe(true);
  });

  it('has each figure of as many countries as the book gives it of', () => {
    expect(Object.fromEntries(BOOK_FIGS.map((f) => [f, having(f).length]))).toEqual({ life: 225, gdp: 198, age: 227, urban: 226, fert: 226, coast: 189, high: 240 });
  });

  it('has every figure of every member of the United Nations, but what each makes of nine and the coast of those without a sea', () => {
    expect(members).toHaveLength(193);
    for (const fig of ['life', 'age', 'urban', 'fert', 'high'] as const) expect(having(fig, members), fig).toHaveLength(193);
    expect(members.filter((c) => book.c[c.id].gdp == null).map((c) => c.id).sort()).toEqual(['CU', 'ER', 'KP', 'LI', 'MC', 'SS', 'TM', 'VE', 'YE']);
    const dry = members.filter((c) => book.c[c.id].coast == null).map((c) => c.id);
    expect(dry).toHaveLength(43);
    for (const id of ['AD', 'AT', 'BO', 'CH', 'ET', 'KZ', 'LU', 'MN', 'NP', 'PY', 'RS', 'UG']) expect(dry, id).toContain(id);
    // A country on the sea has a coast, however short.
    for (const id of ['ES', 'FR', 'MC', 'JO', 'BA', 'SI', 'CD', 'IQ']) expect(book.c[id].coast, id).toBeGreaterThan(0);
  });

  it('says of some countries what anybody can check', () => {
    expect(book.c.ES).toEqual({ life: 83, gdp: 48400, age: 47.2, urban: 81.6, fert: 1.32, coast: 4964, high: 3718 });
    expect(book.c.JP.life).toBe(85.2);
    expect(book.c.NE.fert).toBe(6.55);
    expect(book.c.KR).toMatchObject({ fert: 0.68, y: { gdp: 2023 } });
    expect(book.c.CA.coast).toBe(202080);
    expect(book.c.MC).toMatchObject({ coast: 4.1, life: 89.8, urban: 100 });
    // Everest is of two countries.
    expect(book.c.CN.high).toBe(8849);
    expect(book.c.NP.high).toBe(8849);
    expect(book.c.US.high).toBe(6190);
    expect(book.c.AR.high).toBe(6962);
    expect(book.c.NZ.high).toBe(3724);
  });

  it('has what was read by hand: France in Europe, the Netherlands in Europe and Malta with Gozo', () => {
    expect(book.c.FR.coast).toBe(3427);
    expect(book.c.FR.high).toBe(4810);
    expect(book.c.NL.high).toBe(322);
    expect(book.c.MT.coast).toBe(252.8);
  });

  it('has of Palestine what its two pages agree on, the sum of their coasts and the higher of their summits', () => {
    expect(book.c.PS).toEqual({ gdp: 3800, urban: 77.6, coast: 40, high: 1020 });
  });

  it('has more than ten countries with everybody in towns, which is why a tie at the end of a list has to be allowed for', () => {
    expect(having('urban').filter((c) => book.c[c.id].urban === 100).map((c) => c.id)).toEqual(['AI', 'BM', 'GI', 'HK', 'KW', 'KY', 'MC', 'MO', 'NR', 'SG', 'SX', 'VA']);
  });

  it('is small enough to be fetched when a game asks for it', () => {
    expect(fs.statSync(path.join(DATA, 'figures.json')).size).toBeLessThan(24_000);
  });
});

describe('reading the figures of The World Factbook', () => {
  const made: BookFile = { y: { life: 2024, gdp: 2024 }, c: { ES: { life: 83, gdp: 48400, coast: 4964 }, KR: { life: 83.4, gdp: 50000, y: { gdp: 2023 } }, CH: { life: 83.9 } } };

  it('gives the figure of a country, and nothing where the book has none', () => {
    expect(bookValue(made, 'ES', 'life')).toBe(83);
    expect(bookValue(made, 'ES', 'coast')).toBe(4964);
    expect(bookValue(made, 'CH', 'coast')).toBe(0);
    expect(bookValue(made, 'CH', 'gdp')).toBe(0);
    expect(bookValue(made, 'XX', 'life')).toBe(0);
    // Nor before the book has come.
    expect(bookValue(null, 'ES', 'life')).toBe(0);
    expect(bookValue(undefined, 'ES', 'life')).toBe(0);
  });

  it('gives no figure for what is not a number above nothing', () => {
    const odd = { y: {}, c: { ES: { life: 0, gdp: -5, age: Number.NaN, urban: '81' } } } as unknown as BookFile;
    for (const fig of ['life', 'gdp', 'age', 'urban'] as const) expect(bookValue(odd, 'ES', fig), fig).toBe(0);
  });

  it('gives the year a figure is of: its own where the country has one, that of most where it does not', () => {
    expect(bookYear(made, 'ES', 'gdp')).toBe(2024);
    expect(bookYear(made, 'KR', 'gdp')).toBe(2023);
    expect(bookYear(made, 'KR', 'life')).toBe(2024);
    // A coast is of no year.
    expect(bookYear(made, 'ES', 'coast')).toBeUndefined();
    expect(bookYear(made, 'XX', 'life')).toBe(2024);
  });

  it('counts how many countries of a list have a figure', () => {
    expect(bookCount(made, ['ES', 'KR', 'CH'], 'life')).toBe(3);
    expect(bookCount(made, ['ES', 'KR', 'CH'], 'gdp')).toBe(2);
    expect(bookCount(made, ['ES', 'KR', 'CH', 'XX'], 'coast')).toBe(1);
    expect(bookCount(made, [], 'life')).toBe(0);
    expect(bookCount(book, ['ES', 'FR', 'CH', 'AT'], 'coast')).toBe(2);
    expect(bookCount(book, ['CH', 'BO', 'AT', 'ES'], 'coast')).toBe(1);
  });
});

describe('the names of the figures of The World Factbook', () => {
  it('are seven, and with the three the countries carry they make the ten a game of countries can be about', () => {
    expect(BOOK_FIGS).toEqual(['life', 'gdp', 'age', 'urban', 'fert', 'coast', 'high']);
    expect(COUNTRY_FIGS).toEqual(['pop', 'area', 'density', 'life', 'gdp', 'age', 'urban', 'fert', 'coast', 'high']);
    for (const fig of BOOK_FIGS) expect(isBookFig(fig), fig).toBe(true);
    for (const other of ['pop', 'area', 'density', 'elev', 'lat', 'lon', '', 'LIFE', null, undefined, 7]) expect(isBookFig(other), String(other)).toBe(false);
  });

  it('are said in Spanish', () => {
    expect(BOOK_FIGS.map(metricNoun)).toEqual(['esperanza de vida', 'PIB por habitante', 'edad mediana', 'población urbana', 'fecundidad', 'longitud de costa', 'altitud máxima']);
    expect(BOOK_FIGS.map(metricOrder)).toEqual([
      'de mayor a menor esperanza de vida',
      'de mayor a menor PIB por habitante',
      'de mayor a menor edad mediana',
      'de más a menos población urbana',
      'de más a menos hijos por mujer',
      'de más a menos costa',
      'de mayor a menor altitud máxima',
    ]);
  });

  it('are said in English', () => {
    setLang('en');
    expect(BOOK_FIGS.map(metricNoun)).toEqual(['life expectancy', 'GDP per head', 'median age', 'urban population', 'fertility', 'length of coast', 'highest point']);
    expect(BOOK_FIGS.map(metricOrder)).toEqual([
      'from longest to shortest life expectancy',
      'from highest to lowest GDP per head',
      'from highest to lowest median age',
      'from most to least urban',
      'from most to fewest children per woman',
      'from longest to shortest coast',
      'from the highest top to the lowest',
    ]);
  });

  it('are all different, and none is the name of a figure the game already had', () => {
    for (const lang of ['es', 'en'] as const) {
      setLang(lang);
      const nouns = [...COUNTRY_FIGS, 'elev' as const, 'lat' as const, 'lon' as const].map(metricNoun);
      expect(new Set(nouns).size, lang).toBe(nouns.length);
    }
  });
});
