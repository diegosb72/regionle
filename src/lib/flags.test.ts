// The flags of the divisions and of the capitals: what the gallery makes of their list, and the list
// itself against the files that are published and against the game (scripts/data/flags.mjs writes them).

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { capitalFlags, commonsPage, countryFlags, flagSrc, flagsPageOf, flagsRest, levelOf, regionCounts, regionFlags, searchFlags, type CreditsFile, type FlagsFile } from './flags';
import { setLang } from './i18n';
import type { Country, Index } from './types';

const ROOT = process.cwd();
const json = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')) as T;

const FLAGS = json<FlagsFile>('public/data/flags.json');
const CREDITS = json<CreditsFile>('public/data/flag-credits.json');
const INDEX = json<Index>('public/data/index.json');
/** Where the files are: in the folder that is published, and nowhere else. */
const DIR = path.join(ROOT, 'docs/flags/commons');
const ROWS = [...Object.values(FLAGS.regions).flat(), ...FLAGS.capitals];

afterEach(() => setLang('es'));

describe('the pages of the gallery', () => {
  it('reads the page that an address names', () => {
    expect(flagsPageOf('')).toEqual({ tab: 'countries' });
    expect(flagsPageOf('paises')).toEqual({ tab: 'countries' });
    expect(flagsPageOf('regiones')).toEqual({ tab: 'regions' });
    expect(flagsPageOf('regiones/ES')).toEqual({ tab: 'regions', country: 'ES' });
    expect(flagsPageOf('regions/us')).toEqual({ tab: 'regions', country: 'US' });
    expect(flagsPageOf('capitales')).toEqual({ tab: 'capitals' });
    expect(flagsPageOf('Capitals/ES')).toEqual({ tab: 'capitals' });
  });

  it('takes what is nothing as the first page, and a country that cannot be one as none', () => {
    expect(flagsPageOf('nada')).toEqual({ tab: 'countries' });
    expect(flagsPageOf('regiones/España')).toEqual({ tab: 'regions' });
    expect(flagsPageOf('regiones/../x')).toEqual({ tab: 'regions' });
    expect(flagsPageOf('regiones/E')).toEqual({ tab: 'regions' });
  });

  it('writes the address of a page, which reads back as the same page', () => {
    expect(flagsRest({ tab: 'countries' })).toBe('');
    expect(flagsRest({ tab: 'regions' })).toBe('regiones');
    expect(flagsRest({ tab: 'regions', country: 'JP' })).toBe('regiones/JP');
    expect(flagsRest({ tab: 'capitals' })).toBe('capitales');
    for (const page of [{ tab: 'countries' }, { tab: 'regions' }, { tab: 'regions', country: 'JP' }, { tab: 'capitals' }] as const) expect(flagsPageOf(flagsRest(page))).toEqual(page);
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
  const main = new Set(ROWS.map((row) => row[4]));
  const small = new Set(ROWS.map((row) => row[6]).filter((name): name is string => !!name));

  it('has thousands of flags, of more than a hundred countries', () => {
    expect(FLAGS.v).toBe(1);
    expect(Object.values(FLAGS.regions).flat().length).toBeGreaterThan(1900);
    expect(Object.keys(FLAGS.regions).length).toBeGreaterThan(110);
    expect(FLAGS.capitals.length).toBeGreaterThan(130);
  });

  it('names files that are published, and no file is published that it does not name', () => {
    expect(published.length).toBeGreaterThan(2000);
    expect([...main, ...small].sort()).toEqual(published);
    // Nothing of them is kept a second time, where the build would copy it from.
    expect(fs.existsSync(path.join(ROOT, 'public/flags'))).toBe(false);
  });

  it('names each file after what it holds', () => {
    for (const name of published) expect(name).toMatch(/^[0-9a-f]{10}\.(svg|webp)$/);
  });

  it('gives a drawing wherever there is one, and a picture for the small sizes only to a heavy drawing', () => {
    const drawings = [...main].filter((name) => name.endsWith('.svg'));
    // Four of every five files are drawings: the rest are photographs, drawings with words and a few monsters.
    expect(drawings.length / main.size).toBeGreaterThan(0.8);
    for (const row of ROWS) {
      const [, , , , name, , light] = row;
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
    for (const [id, , es, en, , ratio] of ROWS) {
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

  it('tells of capitals the game has, once each', () => {
    const cities = json<{ c: Record<string, { i: string; k?: number }[]> }>('public/data/cities.json').c;
    for (const [id, country] of FLAGS.capitals) expect(cities[country]?.some((c) => c.i === id && (c.k ?? 0) >= 2), `${id} in ${country}`).toBe(true);
    expect(new Set(FLAGS.capitals.map((row) => row[0])).size).toBe(FLAGS.capitals.length);
  });

  it('says whose every file is and on what terms, all of them free', () => {
    expect(CREDITS.v).toBe(1);
    expect(Object.keys(CREDITS.files).sort()).toEqual([...main].sort());
    for (const [name, [title, author, licence]] of Object.entries(CREDITS.files)) {
      expect(title, name).toMatch(/\.(svg|png|gif|jpe?g)$/i);
      expect(typeof author, name).toBe('string');
      // No markup left of the page the author was read from.
      expect(/<[a-z/]/i.test(author), name).toBe(false);
      expect(CREDITS.licences[licence], name).toBeDefined();
    }
    for (const [name, url] of CREDITS.licences) {
      expect(name).toMatch(/^(public domain|pd\b|cc0|cc by(-sa)? \d|cc-by|copyrighted free use|attribution\b|fal\b|free art|ogl\b|open government)/i);
      expect(url === '' || /^https?:\/\//.test(url), name).toBe(true);
    }
    // Every licence of the list is the licence of some file.
    expect(new Set(Object.values(CREDITS.files).map((file) => file[2])).size).toBe(CREDITS.licences.length);
  });

  it('has the flags that were looked for by hand', () => {
    const of = (country: string, id: string) => FLAGS.regions[country]?.find((row) => row[0] === id);
    for (const [country, id] of [['FR', 'FR-COR'], ['CZ', 'CZ-PL'], ['CZ', 'CZ-ZL'], ['JP', 'JP-34'], ['UZ', 'UZ-QR']]) expect(of(country, id), id).toBeDefined();
    const title = (id: string) => CREDITS.files[FLAGS.capitals.find((row) => row[0] === id)![4]][0];
    expect(title('cj64n3d')).toBe('Flag of Rome.svg');
    expect(title('cj64n3x')).toBe('Flag of Paris.svg');
  });

  it('has no flag that says it is a proposal, or one of other years', () => {
    const titles = Object.values(CREDITS.files).map((file) => file[0]);
    // Jujuy's is the flag of the Civil Freedom: what is «unofficial» is that drawing of it.
    const doubted = titles.filter((name) => /\b(proposed|proposal|hypothetical|fictional|logo|gonfalone|antiga|former)\b|\buntil \d{4}|\bbefore \d{4}/i.test(name) && !/Civil Freedom/.test(name));
    expect(doubted).toEqual([]);
    // The provinces of the Canaries have none: the ones there are of them are proposals.
    const spain = FLAGS.regions.ES.map((row) => row[0]);
    for (const id of ['ES-GC', 'ES-TF', 'ES-GI', 'ES-L']) expect(spain, id).not.toContain(id);
    for (const id of ['ES-AN', 'ES-CN', 'ES-M', 'ES-SE', 'ES-B']) expect(spain, id).toContain(id);
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
