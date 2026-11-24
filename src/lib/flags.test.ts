// The flags of the section «Banderas» that come from Wikimedia Commons: what the gallery makes of their
// list, and the list itself against the files that are published, against the game and against the lists
// it is made from (scripts/data/flags.mjs writes them).

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  capitalFlags,
  cityCounts,
  cityFlags,
  commonsPage,
  countryFlags,
  flagFiles,
  flagSrc,
  flagsPageOf,
  flagsRest,
  goneFlags,
  levelOf,
  namedFlags,
  pastFlags,
  regionCounts,
  regionFlags,
  searchFlags,
  signalFlags,
  yearsText,
  type CreditsFile,
  type FlagsFile,
} from './flags';
import { setLang } from './i18n';
import type { Country, Index } from './types';

const ROOT = process.cwd();
const json = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')) as T;

const FLAGS = json<FlagsFile>('public/data/flags.json');
const CREDITS = json<CreditsFile>('public/data/flag-credits.json');
const INDEX = json<Index>('public/data/index.json');
/** Where the files are: in the folder that is published, and nowhere else. */
const DIR = path.join(ROOT, 'docs/flags/commons');

/** A flag of the list, whatever it is of: what it is called, its file, its shape and the picture that stands for it where it is small. */
interface Row {
  group: 'regions' | 'capitals' | 'cities' | 'past' | 'gone' | 'organisations' | 'peoples' | 'signals';
  id: string;
  es: string;
  en: string;
  file: string;
  ratio: number;
  small?: string;
}
const ROWS: Row[] = [
  ...Object.values(FLAGS.regions).flatMap((rows) => rows.map(([id, , es, en, file, ratio, small]): Row => ({ group: 'regions', id, es, en, file, ratio, small }))),
  ...FLAGS.capitals.map(([id, , es, en, file, ratio, small]): Row => ({ group: 'capitals', id, es, en, file, ratio, small })),
  ...Object.values(FLAGS.cities ?? {}).flatMap((rows) => rows.map(([id, es, en, file, ratio, small]): Row => ({ group: 'cities', id, es, en, file, ratio, small }))),
  ...Object.entries(FLAGS.past ?? {}).flatMap(([country, rows]) => rows.map(([file, ratio, , , small]): Row => ({ group: 'past', id: `${country}:${file}`, es: country, en: '', file, ratio, small }))),
  ...(FLAGS.gone ?? []).map(([id, es, en, file, ratio, , , small]): Row => ({ group: 'gone', id, es, en, file, ratio, small })),
  ...(FLAGS.organisations ?? []).map(([id, es, en, file, ratio, small]): Row => ({ group: 'organisations', id, es, en, file, ratio, small })),
  ...(FLAGS.peoples ?? []).map(([id, es, en, file, ratio, small]): Row => ({ group: 'peoples', id, es, en, file, ratio, small })),
  ...(FLAGS.signals ?? []).map(([id, , es, en, file, ratio, small]): Row => ({ group: 'signals', id, es, en, file, ratio, small })),
];
/** Those that something flies today: of them it is asked that they be that. */
const TODAY = ROWS.filter((row) => row.group === 'regions' || row.group === 'capitals' || row.group === 'cities');

afterEach(() => setLang('es'));

describe('the pages of the gallery', () => {
  it('reads the page that an address names', () => {
    expect(flagsPageOf('')).toEqual({ tab: 'countries' });
    expect(flagsPageOf('paises')).toEqual({ tab: 'countries' });
    expect(flagsPageOf('regiones')).toEqual({ tab: 'regions' });
    expect(flagsPageOf('regiones/ES')).toEqual({ tab: 'regions', country: 'ES' });
    expect(flagsPageOf('regions/us')).toEqual({ tab: 'regions', country: 'US' });
    expect(flagsPageOf('ciudades')).toEqual({ tab: 'cities' });
    expect(flagsPageOf('Cities/br')).toEqual({ tab: 'cities', country: 'BR' });
    expect(flagsPageOf('historicas')).toEqual({ tab: 'history' });
    expect(flagsPageOf('history/ES')).toEqual({ tab: 'history' });
    expect(flagsPageOf('otras')).toEqual({ tab: 'others' });
    expect(flagsPageOf('Others')).toEqual({ tab: 'others' });
  });

  it('still opens the cities by the name their page had when it held only the capitals', () => {
    expect(flagsPageOf('capitales')).toEqual({ tab: 'cities' });
    expect(flagsPageOf('Capitals')).toEqual({ tab: 'cities' });
  });

  it('takes what is nothing as the first page, and a country that cannot be one as none', () => {
    expect(flagsPageOf('nada')).toEqual({ tab: 'countries' });
    expect(flagsPageOf('regiones/España')).toEqual({ tab: 'regions' });
    expect(flagsPageOf('regiones/../x')).toEqual({ tab: 'regions' });
    expect(flagsPageOf('regiones/E')).toEqual({ tab: 'regions' });
    expect(flagsPageOf('ciudades/Madrid')).toEqual({ tab: 'cities' });
  });

  it('writes the address of a page, which reads back as the same page', () => {
    expect(flagsRest({ tab: 'countries' })).toBe('');
    expect(flagsRest({ tab: 'regions' })).toBe('regiones');
    expect(flagsRest({ tab: 'regions', country: 'JP' })).toBe('regiones/JP');
    expect(flagsRest({ tab: 'cities' })).toBe('ciudades');
    expect(flagsRest({ tab: 'cities', country: 'ES' })).toBe('ciudades/ES');
    expect(flagsRest({ tab: 'history' })).toBe('historicas');
    expect(flagsRest({ tab: 'others' })).toBe('otras');
    for (const page of [{ tab: 'countries' }, { tab: 'regions' }, { tab: 'regions', country: 'JP' }, { tab: 'cities' }, { tab: 'cities', country: 'ES' }, { tab: 'history' }, { tab: 'others' }] as const) expect(flagsPageOf(flagsRest(page))).toEqual(page);
  });
});

describe('the flags as the gallery shows them', () => {
  const file: FlagsFile = {
    v: 1,
    regions: {
      ES: [
        ['ES-AN', 1, 'Andalucía', 'Andalusia', '0123456789.svg', 1.5],
        ['ES-H', 0, 'Huelva', '', 'abcdefabcd.svg', 1.5, '9876543210.webp'],
        ['ES-BA', 0, 'Badajoz', '', '1111111111.webp', 1.49],
      ],
      JP: [['JP-13', 0, 'Tokio', 'Tokyo', '2222222222.svg', 1.5]],
    },
    capitals: [['cj64n3d', 'IT', 'Roma', 'Rome', '3333333333.svg', 1.5]],
    cities: { IT: [['c1', 'Milán', 'Milan', '4444444444.svg', 1.5], ['c2', 'Turín', 'Turin', '5555555555.svg', 1.5, '5555555550.webp']], ES: [['c3', 'Bilbao', '', '6666666666.svg', 1.5]] },
    past: { ES: [['7777777777.svg', 1.5, 1931, 1939], ['8888888888.svg', 1.5, 0, 1785, '8888888880.webp']], IT: [['9999999999.svg', 1.5, 1861, 0]] },
    gone: [['Q15180', 'Unión Soviética', 'Soviet Union', 'aaaaaaaaaa.svg', 2, 1922, 1991]],
    organisations: [['Q458', 'Unión Europea', 'European Union', 'bbbbbbbbbb.svg', 1.5]],
    peoples: [['Q48199', 'Samis', 'Sámi', 'cccccccccc.svg', 1.35]],
    signals: [
      ['ics-a', 'sea', 'A · Alfa', '', 'dddddddddd.svg', 1],
      ['race-green', 'race', 'Bandera verde', 'Green flag', 'eeeeeeeeee.svg', 1.5],
    ],
    means: { 'ics-a': ['Tengo un buzo sumergido', 'I have a diver down'] },
  };

  it('says where each one is, and shows a heavy drawing small by its picture', () => {
    const cards = regionFlags(file, 'ES', '/x/');
    expect(cards.map((c) => c.key)).toEqual(['region:ES-AN', 'region:ES-H', 'region:ES-BA']);
    expect(cards[0]).toEqual({ key: 'region:ES-AN', kind: 'region', id: 'ES-AN', country: 'ES', name: 'Andalucía', level: 1, src: '/x/flags/commons/0123456789.svg', small: '/x/flags/commons/0123456789.svg', file: '0123456789.svg', ratio: 1.5 });
    expect(cards[1]).toMatchObject({ src: '/x/flags/commons/abcdefabcd.svg', small: '/x/flags/commons/9876543210.webp', file: 'abcdefabcd.svg' });
    expect(cards[2]).toMatchObject({ src: '/x/flags/commons/1111111111.webp', small: '/x/flags/commons/1111111111.webp' });
    expect(regionFlags(file, 'ZZ')).toEqual([]);
    expect(capitalFlags(file, '/x/')).toEqual([{ key: 'capital:cj64n3d', kind: 'capital', id: 'cj64n3d', country: 'IT', name: 'Roma', src: '/x/flags/commons/3333333333.svg', small: '/x/flags/commons/3333333333.svg', file: '3333333333.svg', ratio: 1.5 }]);
    expect(flagSrc('0123456789.svg', './')).toBe('./flags/commons/0123456789.svg');
  });

  it('shows the cities of a country, or those of them all, and counts them with its capitals', () => {
    expect(cityFlags(file, 'IT', '/x/').map((c) => c.key)).toEqual(['city:c1', 'city:c2']);
    expect(cityFlags(file, 'IT', '/x/')[1]).toEqual({ key: 'city:c2', kind: 'city', id: 'c2', country: 'IT', name: 'Turín', src: '/x/flags/commons/5555555555.svg', small: '/x/flags/commons/5555555550.webp', file: '5555555555.svg', ratio: 1.5 });
    expect(cityFlags(file).map((c) => c.id).sort()).toEqual(['c1', 'c2', 'c3']);
    expect(cityFlags(file, 'ZZ')).toEqual([]);
    expect([...cityCounts(file)].sort()).toEqual([['ES', 1], ['IT', 3]]);
    // A list from before there were cities has only its capitals.
    expect([...cityCounts({ v: 1, regions: {}, capitals: file.capitals })]).toEqual([['IT', 1]]);
    expect(cityFlags({ v: 1, regions: {}, capitals: [] })).toEqual([]);
  });

  it('shows the flags of other times with their years: those a country flew, and those of what is no more', () => {
    const past = pastFlags(file, INDEX, '/x/');
    // In the order of the countries of the game, and within each as the list has them.
    expect(past.map((c) => c.key)).toEqual(INDEX.countries.flatMap((c) => (file.past?.[c.id] ?? []).map((row) => `past:${c.id}:${row[0]}`)));
    expect(past.find((c) => c.file === '7777777777.svg')).toEqual({ key: 'past:ES:7777777777.svg', kind: 'past', id: 'ES', country: 'ES', name: 'España', years: [1931, 1939], src: '/x/flags/commons/7777777777.svg', small: '/x/flags/commons/7777777777.svg', file: '7777777777.svg', ratio: 1.5 });
    expect(past.find((c) => c.file === '8888888888.svg')?.small).toBe('/x/flags/commons/8888888880.webp');
    expect(goneFlags(file, '/x/')).toEqual([{ key: 'gone:Q15180', kind: 'gone', id: 'Q15180', country: '', name: 'Unión Soviética', years: [1922, 1991], src: '/x/flags/commons/aaaaaaaaaa.svg', small: '/x/flags/commons/aaaaaaaaaa.svg', file: 'aaaaaaaaaa.svg', ratio: 2 }]);
    expect(pastFlags({ v: 1, regions: {}, capitals: [] }, INDEX)).toEqual([]);
    expect(goneFlags({ v: 1, regions: {}, capitals: [] })).toEqual([]);
  });

  it('writes the years of a flag, and says which is missing when one is', () => {
    expect(yearsText([1931, 1939])).toBe('1931–1939');
    expect(yearsText([1919, 1919])).toBe('1919');
    expect(yearsText([0, 1785])).toBe('hasta 1785');
    expect(yearsText([1861, 0])).toBe('desde 1861');
    expect(yearsText([0, 0])).toBe('');
    expect(yearsText(undefined)).toBe('');
    expect(yearsText([-27, 476])).toBe('27 a. C.–476');
    setLang('en');
    expect(yearsText([0, 1785])).toBe('until 1785');
    expect(yearsText([1861, 0])).toBe('from 1861');
    expect(yearsText([-27, 476])).toBe('27 BC–476');
  });

  it('shows the flags of organisations and of peoples, and the signals with what each says', () => {
    expect(namedFlags(file, 'organisation', '/x/')).toEqual([{ key: 'organisation:Q458', kind: 'organisation', id: 'Q458', country: '', name: 'Unión Europea', src: '/x/flags/commons/bbbbbbbbbb.svg', small: '/x/flags/commons/bbbbbbbbbb.svg', file: 'bbbbbbbbbb.svg', ratio: 1.5 }]);
    expect(namedFlags(file, 'people')[0]).toMatchObject({ key: 'people:Q48199', kind: 'people', name: 'Samis' });
    const signals = signalFlags(file, '/x/');
    expect(signals[0]).toEqual({ key: 'signal:ics-a', kind: 'signal', id: 'ics-a', country: '', name: 'A · Alfa', group: 'sea', means: 'Tengo un buzo sumergido', src: '/x/flags/commons/dddddddddd.svg', small: '/x/flags/commons/dddddddddd.svg', file: 'dddddddddd.svg', ratio: 1 });
    expect(signals[1]).toMatchObject({ group: 'race', name: 'Bandera verde' });
    expect(signals[1].means).toBeUndefined();
    setLang('en');
    expect(signalFlags(file)[0].means).toBe('I have a diver down');
    expect(signalFlags(file)[1].name).toBe('Green flag');
    expect(namedFlags(file, 'people')[0].name).toBe('Sámi');
    expect(signalFlags({ v: 1, regions: {}, capitals: [] })).toEqual([]);
    expect(namedFlags({ v: 1, regions: {}, capitals: [] }, 'organisation')).toEqual([]);
  });

  it('knows every file that the list names, each once', () => {
    expect([...flagFiles(file)].sort()).toEqual(['0123456789.svg', '1111111111.webp', '2222222222.svg', '3333333333.svg', '4444444444.svg', '5555555555.svg', '6666666666.svg', '7777777777.svg', '8888888888.svg', '9999999999.svg', 'aaaaaaaaaa.svg', 'abcdefabcd.svg', 'bbbbbbbbbb.svg', 'cccccccccc.svg', 'dddddddddd.svg', 'eeeeeeeeee.svg']);
  });

  it('names them in the language of the game, in Spanish where there is no other name', () => {
    setLang('en');
    expect(regionFlags(file, 'ES').map((c) => c.name)).toEqual(['Andalusia', 'Huelva', 'Badajoz']);
    expect(capitalFlags(file)[0].name).toBe('Rome');
    setLang('es');
    expect(regionFlags(file, 'JP')[0].name).toBe('Tokio');
  });

  it('shows the flags of the countries, which come with the game, four by three', () => {
    const cards = countryFlags(INDEX, '/x/');
    expect(cards.length).toBe(INDEX.countries.filter((c) => c.fl).length);
    expect(cards.length).toBeGreaterThan(240);
    const spain = cards.find((c) => c.id === 'ES')!;
    expect(spain).toEqual({ key: 'country:ES', kind: 'country', id: 'ES', country: 'ES', name: 'España', src: '/x/flags/es.svg', small: '/x/flags/es.svg', ratio: 4 / 3 });
    setLang('en');
    expect(countryFlags(INDEX).find((c) => c.id === 'ES')!.name).toBe('Spain');
  });

  it('counts the flags of each country by level', () => {
    const counts = regionCounts(file);
    expect(counts.get('ES')).toEqual([2, 1, 0]);
    expect(counts.get('JP')).toEqual([1, 0, 0]);
  });

  it('finds by any word of the name, whatever its accents and its capitals', () => {
    const cards = [...regionFlags(file, 'ES'), ...regionFlags(file, 'JP')];
    expect(searchFlags(cards, 'andalucia').map((c) => c.id)).toEqual(['ES-AN']);
    expect(searchFlags(cards, '  HUEL ').map((c) => c.id)).toEqual(['ES-H']);
    expect(searchFlags(cards, 'a').length).toBe(3);
    expect(searchFlags(cards, 'xyz')).toEqual([]);
    expect(searchFlags(cards, '')).toEqual(cards);
  });

  it('knows which level of a map each number is', () => {
    const spain = INDEX.countries.find((c) => c.id === 'ES') as Country;
    expect(levelOf(spain, 0)?.k).toBe('f');
    expect(levelOf(spain, 1)?.k).toBe('g1');
    expect(levelOf(spain, 2)).toBeUndefined();
    expect(levelOf(undefined, 0)).toBeUndefined();
  });

  it('links to the page of a file in Commons', () => {
    expect(commonsPage('Flag of Andalucía.svg')).toBe('https://commons.wikimedia.org/wiki/File:Flag_of_Andaluc%C3%ADa.svg');
    expect(commonsPage('Flag of Ain (Rhône-Alpes)?.svg')).toBe('https://commons.wikimedia.org/wiki/File:Flag_of_Ain_(Rh%C3%B4ne-Alpes)%3F.svg');
  });
});

describe('the list of flags and its files', () => {
  const published = fs.existsSync(DIR) ? fs.readdirSync(DIR).sort() : [];
  const main = new Set(ROWS.map((row) => row.file));
  const small = new Set(ROWS.map((row) => row.small).filter((name): name is string => !!name));
  const title = (file: string): string => CREDITS.files[file][0];

  it('has thousands of flags: of the maps, of other times, of organisations and peoples, and the signals', () => {
    expect(FLAGS.v).toBe(2);
    expect(Object.values(FLAGS.regions).flat().length).toBeGreaterThan(2000);
    expect(Object.keys(FLAGS.regions).length).toBeGreaterThan(115);
    expect(FLAGS.capitals.length).toBeGreaterThan(140);
    expect(Object.values(FLAGS.cities ?? {}).flat().length).toBeGreaterThan(1400);
    expect(Object.values(FLAGS.past ?? {}).flat().length).toBeGreaterThan(250);
    expect(FLAGS.gone?.length).toBeGreaterThan(180);
    expect(FLAGS.organisations?.length).toBeGreaterThan(40);
    expect(FLAGS.peoples?.length).toBeGreaterThan(25);
    expect(FLAGS.signals?.length).toBeGreaterThan(60);
    expect(main).toEqual(flagFiles(FLAGS));
  });

  it('names files that are published, and no file is published that it does not name', () => {
    expect(published.length).toBeGreaterThan(4000);
    expect([...new Set([...main, ...small])].sort()).toEqual(published);
    // Nothing of them is kept a second time, where the build would copy it from.
    expect(fs.existsSync(path.join(ROOT, 'public/flags'))).toBe(false);
  });

  it('names each file after what it holds', () => {
    for (const name of published) expect(name).toMatch(/^[0-9a-f]{10}\.(svg|webp)$/);
  });

  it('gives a drawing wherever there is one, and a picture for the small sizes only to a heavy drawing', () => {
    const drawings = [...main].filter((name) => name.endsWith('.svg'));
    // More than three of every four files are drawings: the rest are photographs (many a city has its flag in Commons only as one), drawings with words and a few monsters.
    expect(drawings.length / main.size).toBeGreaterThan(0.75);
    for (const { file: name, small: light } of ROWS) {
      const bytes = fs.statSync(path.join(DIR, name)).size;
      if (name.endsWith('.webp')) {
        expect(light, name).toBeUndefined();
        expect(bytes, name).toBeLessThan(150_000);
        continue;
      }
      expect(bytes, name).toBeLessThanOrEqual(750_000);
      expect(!!light, name).toBe(bytes > 100_000);
      if (light) {
        expect(light).toMatch(/\.webp$/);
        expect(fs.statSync(path.join(DIR, light)).size, light).toBeLessThan(150_000);
      }
    }
  });

  it('serves no drawing with anything in it but the drawing', () => {
    for (const name of main) {
      if (!name.endsWith('.svg')) continue;
      const text = fs.readFileSync(path.join(DIR, name), 'utf8');
      expect(text.startsWith('<svg'), name).toBe(true);
      // No code, nothing fetched from elsewhere, no photograph inside and no words for each device to set its own way.
      expect(/<script|<foreignObject|<iframe|\son[a-z]+\s*=|javascript:/i.test(text), name).toBe(false);
      expect(/(?:href|src)\s*=\s*["'](?!#)/i.test(text), name).toBe(false);
      expect(/url\(\s*["']?(?!#)/i.test(text), name).toBe(false);
      expect(/<image\b|<text\b|<tspan\b|@import|@font-face/i.test(text), name).toBe(false);
    }
  });

  it('gives each flag a shape and names that can be shown', () => {
    for (const { id, es, en, ratio } of ROWS) {
      expect(es.trim(), id).toBe(es);
      expect(es.length, id).toBeGreaterThan(0);
      // The name in English is only kept when it is another.
      expect(en, id).not.toBe(es);
      expect(ratio, id).toBeGreaterThan(0.2);
      expect(ratio, id).toBeLessThan(12);
    }
  });

  it('tells of divisions the maps have, at the level they have them, once each and in order', () => {
    for (const [country, rows] of Object.entries(FLAGS.regions)) {
      expect(INDEX.countries.some((c) => c.id === country), country).toBe(true);
      const objects = json<{ objects: Record<string, { geometries: { id: string }[] }> }>(`public/data/r/${country}.json`).objects;
      for (const [id, level] of rows) {
        const key = level === 0 ? 'f' : `g${level}`;
        expect(objects[key]?.geometries.some((g) => String(g.id) === id), `${id} at ${key}`).toBe(true);
      }
      expect(new Set(rows.map((row) => `${row[0]}@${row[1]}`)).size, country).toBe(rows.length);
      // The coarser levels first, and each in the order of the alphabet.
      const sorted = [...rows].sort((a, b) => b[1] - a[1] || a[2].localeCompare(b[2], 'es') || a[0].localeCompare(b[0]));
      expect(rows.map((row) => row[0]), country).toEqual(sorted.map((row) => row[0]));
    }
    expect(Object.keys(FLAGS.regions)).toEqual(Object.keys(FLAGS.regions).sort());
  });

  it('tells of capitals and of cities that the game has, once each, each in its country', () => {
    const cities = json<{ c: Record<string, { i: string; k?: number }[]> }>('public/data/cities.json').c;
    for (const [id, country] of FLAGS.capitals) expect(cities[country]?.some((c) => c.i === id && (c.k ?? 0) >= 2), `${id} in ${country}`).toBe(true);
    expect(new Set(FLAGS.capitals.map((row) => row[0])).size).toBe(FLAGS.capitals.length);
    const seen = new Set<string>();
    for (const [country, rows] of Object.entries(FLAGS.cities ?? {})) {
      expect(rows.length, country).toBeGreaterThan(0);
      for (const [id] of rows) {
        // A city that is the capital of a country is among the capitals, and not here.
        expect(cities[country]?.some((c) => c.i === id && !((c.k ?? 0) >= 2)), `${id} in ${country}`).toBe(true);
        expect(seen.has(id), id).toBe(false);
        seen.add(id);
      }
      expect(rows.map((row) => row[1]), country).toEqual([...rows].sort((a, b) => a[1].localeCompare(b[1], 'es') || a[0].localeCompare(b[0])).map((row) => row[1]));
    }
    expect(Object.keys(FLAGS.cities ?? {})).toEqual(Object.keys(FLAGS.cities ?? {}).sort());
  });

  it('tells of the flags that the countries flew before: of 1700 or later, the oldest first, none twice', () => {
    for (const [country, rows] of Object.entries(FLAGS.past ?? {})) {
      expect(INDEX.countries.some((c) => c.id === country), country).toBe(true);
      expect(rows.length, country).toBeGreaterThan(0);
      expect(new Set(rows.map((row) => row[0])).size, country).toBe(rows.length);
      const start = (row: (typeof rows)[number]) => row[2] || row[3];
      expect(rows.map(start), country).toEqual([...rows].map(start).sort((a, b) => a - b));
      for (const [file, , from, to] of rows) {
        expect(Number.isInteger(from) && Number.isInteger(to), file).toBe(true);
        if (from && to) expect(from, `${country} ${file}`).toBeLessThanOrEqual(to);
        // Before 1700 the flags that are drawn today are what somebody thinks they were like.
        expect(to ? to >= 1700 : !from || from >= 1700, `${country} ${file}`).toBe(true);
        expect(to, file).toBeLessThanOrEqual(new Date().getFullYear());
      }
    }
    // Spain flew the flag of its Second Republic from 1931 to 1939.
    expect(FLAGS.past?.ES?.some((row) => row[2] === 1931 && row[3] === 1939 && /Second Spanish Republic|1931/.test(title(row[0])))).toBe(true);
  });

  it('tells of what the lists name: what is no more with its years, the organisations and the peoples', () => {
    const lists = json<Record<'historical' | 'organisations' | 'peoples', Record<string, { es: string; en: string; from?: number; to?: number }>>>('scripts/data/flags-lists.json');
    const gone = FLAGS.gone ?? [];
    expect(new Set(gone.map((row) => row[0])).size).toBe(gone.length);
    // No two of them by the same flag.
    expect(new Set(gone.map((row) => row[3])).size).toBe(gone.length);
    for (const [id, es, en, , , from, to] of gone) {
      const said = lists.historical[id];
      expect(said, id).toBeDefined();
      expect([es, en || es], id).toEqual([said.es, said.en]);
      expect([from, to], id).toEqual([said.from ?? 0, said.to ?? 0]);
      expect(to, id).toBeGreaterThanOrEqual(1700);
    }
    for (const [name, rows] of [['organisations', FLAGS.organisations ?? []], ['peoples', FLAGS.peoples ?? []]] as const) {
      expect(new Set(rows.map((row) => row[0])).size, name).toBe(rows.length);
      for (const [id, es] of rows) expect(lists[name][id]?.es, id).toBe(es);
      // By their Spanish name.
      expect(rows.map((row) => row[1]), name).toEqual([...rows].sort((a, b) => a[1].localeCompare(b[1], 'es') || a[0].localeCompare(b[0])).map((row) => row[1]));
    }
    expect(gone.map((row) => row[1])).toEqual([...gone].sort((a, b) => a[1].localeCompare(b[1], 'es') || a[0].localeCompare(b[0])).map((row) => row[1]));
    const names = (rows: readonly (readonly [string, string, ...unknown[]])[]) => rows.map((row) => row[1]);
    for (const name of ['Unión Soviética', 'Yugoslavia', 'Checoslovaquia', 'Alemania Oriental', 'Imperio otomano']) expect(names(gone), name).toContain(name);
    for (const name of ['Naciones Unidas', 'Unión Europea', 'OTAN', 'Unión Africana']) expect(names(FLAGS.organisations ?? []), name).toContain(name);
    for (const name of ['Pueblo gitano', 'Kurdos', 'Samis', 'Maoríes']) expect(names(FLAGS.peoples ?? []), name).toContain(name);
    // A thing is in one list and no more.
    const all = [...Object.keys(lists.historical), ...Object.keys(lists.organisations), ...Object.keys(lists.peoples)];
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(id).toMatch(/^Q\d+$/);
  });

  it('tells of the signals that the list of them names, in its order, with what each says', () => {
    const said = json<{ signals: Record<string, { group: string; file: string; es: string; en?: string; means?: { es: string; en: string } }> }>('scripts/data/flags-signals.json').signals;
    const signals = FLAGS.signals ?? [];
    expect(signals.map((row) => row[0])).toEqual(Object.keys(said).filter((id) => signals.some((row) => row[0] === id)));
    // Every one that is named is there: its file is in Commons and is free.
    expect(signals.length).toBe(Object.keys(said).length);
    for (const [id, group, es, en, file] of signals) {
      expect(['sea', 'race', 'other'], id).toContain(group);
      expect([group, es, en || es], id).toEqual([said[id].group, said[id].es, said[id].en ?? said[id].es]);
      expect(title(file), id).toBe(said[id].file);
      expect(FLAGS.means?.[id], id).toEqual(said[id].means ? [said[id].means.es, said[id].means.en] : undefined);
    }
    // The International Code of Signals: twenty-six letters, ten pennants, three repeaters and the answer.
    expect(signals.filter((row) => row[1] === 'sea').length).toBe(40);
    expect(Object.keys(FLAGS.means ?? {}).every((id) => signals.some((row) => row[0] === id))).toBe(true);
  });

  it('says whose every file is and on what terms, all of them free', () => {
    expect(CREDITS.v).toBe(1);
    expect(Object.keys(CREDITS.files).sort()).toEqual([...main].sort());
    for (const [name, [named, author, licence]] of Object.entries(CREDITS.files)) {
      expect(named, name).toMatch(/\.(svg|png|gif|jpe?g|webp)$/i);
      expect(typeof author, name).toBe('string');
      // No markup left of the page the author was read from.
      expect(/<[a-z/]/i.test(author), name).toBe(false);
      expect(CREDITS.licences[licence], name).toBeDefined();
    }
    for (const [name, url] of CREDITS.licences) {
      expect(name).toMatch(/^(public domain|pd\b|cc0|cc by(-sa)? \d|cc-by|copyrighted free use|attribution\b|fal\b|free art|ogl\b|open government|l?gpl\b|gnu (lesser )?general public)/i);
      expect(url === '' || /^https?:\/\//.test(url), name).toBe(true);
    }
    // Every licence of the list is the licence of some file.
    expect(new Set(Object.values(CREDITS.files).map((file) => file[2])).size).toBe(CREDITS.licences.length);
  });

  it('has the flags that were looked for by hand', () => {
    const of = (country: string, id: string) => FLAGS.regions[country]?.find((row) => row[0] === id);
    for (const [country, id] of [['FR', 'FR-COR'], ['CZ', 'CZ-PL'], ['CZ', 'CZ-ZL'], ['JP', 'JP-34'], ['UZ', 'UZ-QR']]) expect(of(country, id), id).toBeDefined();
    const capital = (id: string) => title(FLAGS.capitals.find((row) => row[0] === id)![4]);
    expect(capital('cj64n3d')).toBe('Flag of Rome.svg');
    expect(capital('cj64n3x')).toBe('Flag of Paris.svg');
    const hand = json<Record<string, Record<string, { file: string }>>>('scripts/data/flags-hand.json')['flags-listed'];
    const listed = [...(FLAGS.gone ?? []), ...(FLAGS.organisations ?? []), ...(FLAGS.peoples ?? [])];
    for (const [id, { file }] of Object.entries(hand)) expect(title(listed.find((row) => row[0] === id)![3]), id).toBe(file);
  });

  it('has no flag of today that says it is a proposal, or one of other years', () => {
    const titles = [...new Set(TODAY.map((row) => title(row.file)))];
    // Jujuy's is the flag of the Civil Freedom: what is «unofficial» is that drawing of it.
    const doubted = titles.filter((name) => /\b(proposed|proposal|hypothetical|fictional|logo|gonfalone|antiga|former|emblem|seal)\b|\buntil \d{4}|\bbefore \d{4}/i.test(name) && !/Civil Freedom/.test(name));
    expect(doubted).toEqual([]);
    // The provinces of the Canaries have none: the ones there are of them are proposals.
    const spain = FLAGS.regions.ES.map((row) => row[0]);
    for (const id of ['ES-GC', 'ES-TF', 'ES-GI', 'ES-L']) expect(spain, id).not.toContain(id);
    for (const id of ['ES-AN', 'ES-CN', 'ES-M', 'ES-SE', 'ES-B']) expect(spain, id).toContain(id);
  });

  it('has no flag of other times that nobody flew', () => {
    const old = ROWS.filter((row) => row.group === 'past' || row.group === 'gone').map((row) => title(row.file));
    expect(old.filter((name) => /\b(hypothetical|proposed|proposal|fictional|fictitious|fantasy|reconstruction|reconstructed|attributed|conjectural)\b/i.test(name))).toEqual([]);
  });

  it('shows no division and no city by the flag of a country, and takes from Wikipedia only where it was looked at', () => {
    const today = new Set(INDEX.countries.flatMap((c) => [`Flag of ${c.n.en ?? c.n.es}.svg`, `Flag of the ${c.n.en ?? c.n.es}.svg`]));
    const places = ROWS.filter((row) => row.group === 'regions' || row.group === 'cities').map((row) => title(row.file));
    expect(places.filter((name) => today.has(name))).toEqual([]);
    // Bulgaria, Portugal, Ireland and India: what the box of facts of their divisions shows is not the flag of the division.
    expect(Object.keys(FLAGS.regions)).not.toContain('BG');
    expect(Object.keys(FLAGS.regions)).not.toContain('IE');
    expect(FLAGS.regions.PT.length).toBeLessThan(5);
    expect(FLAGS.regions.IN.length).toBeLessThan(5);
    // Romania: its counties have flags, which Wikidata was not told of.
    expect(FLAGS.regions.RO.length).toBeGreaterThan(35);
  });

  it('shows no city by the flag of its province, and nothing by a flag that was seen to be another\'s', () => {
    // What a name says in brackets or after a comma is where the place is: «Flag of Sochi (Krasnodar krai)».
    const whose = (name: string) =>
      name
        .replace(/\.[a-z]+$/i, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/,.*$/, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const larger = /\b(departments?|departamento|provinces?|provincia|state|estado|governorate|govenorate|governadorat|gobernacion|county|region|emirate|wilaya)\b/i;
    const towns = ROWS.filter((row) => row.group === 'capitals' || row.group === 'cities');
    // «Flag of Aosta» is, byte for byte, «Flag of the Province of Aosta»: one file, which the credits name once.
    const same = new Set(['Flag of the Province of Aosta.svg']);
    expect(towns.filter((row) => larger.test(whose(title(row.file))) && !same.has(title(row.file))).map((row) => `${row.es}: ${title(row.file)}`)).toEqual([]);
    // The departments of Nicaragua were given the flag of their seat, which stays with the city; its two autonomous regions have their own.
    expect(FLAGS.regions.NI.map((row) => row[0]).sort()).toEqual(['NI-AN', 'NI-AS', 'NI-NS']);
    const town = (id: string) => towns.find((row) => row.id === id);
    expect(title(town('cj640f5')!.file)).toBe('Flag of Jinotepe.svg');
    expect(title(town('cj64mcf')!.file)).toBe('Flag of Managua.svg');
    // The Emberá-Wounaan comarca by the flag of Chocó, Luxembourg by a photograph of its town hall, Ngerulmud by the flag of the state it is in, Istanbul by a logo, Cork by the colours of its county, Salinas by a privateer's flag.
    expect(FLAGS.regions.PA.map((row) => row[0])).not.toContain('PA-EM');
    for (const id of ['cj64j45', 'cj64l5d', 'cj64n2z', 'cj64jg5', 'cj646az', 'cj64e77', 'cj64e73', 'cj64clv', 'cj64bbl']) expect(town(id), id).toBeUndefined();
    // A name alone settles nothing: «Bandera del Municipio de Jalapa» is the flag of the department, and stays.
    expect(title(FLAGS.regions.GT.find((row) => row[0] === 'GT-JA')![4])).toBe('Bandera del Municipio de Jalapa.svg');
    // One that is given the flag of another and has one of its own is shown by its own; a city that is a whole governorate keeps the flag of both.
    expect(title(town('cj64lpz')!.file)).toBe('Flag of Surakarta with Radya Laksana.svg');
    expect(title(town('cj64lr3')!.file)).toBe('Flag of Port Said.svg');
  });
});

describe('the build of the pages', () => {
  it('does not empty its folder by itself: the flags are in it', () => {
    const scripts = json<{ scripts: Record<string, string> }>('package.json').scripts;
    expect(scripts['build:pages']).toContain('vite build --outDir docs');
    for (const script of [scripts.build, scripts['build:pages']]) expect(script).not.toContain('emptyOutDir');
    const config = fs.readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8');
    expect(config).toContain('emptyBut(out, COMMONS_AT)');
    expect(config).toContain('emptyOutDir: false');
    expect(config).toContain("path.resolve(process.cwd(), 'docs/flags/commons')");
  });
});
