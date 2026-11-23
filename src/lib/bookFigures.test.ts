/**
 * scripts/data/figures.mjs, which reads the figures The World Factbook gives of each country, run on pages
 * made up here: what it takes for a figure, what it leaves out and why, and what it does with a country
 * that the book has in two pages or says something of in a note.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error a script of the build, written without types
import { PAGES as LIST } from '../../scripts/data/factbook-pages.mjs';

const PAGES = LIST as Record<string, [file: string, sha: string, name?: string][]>;
const SCRIPT = path.join(__dirname, '../../scripts/data/figures.mjs');

/** What a page says, heading by heading: `null` leaves the heading out. */
interface Said {
  net?: string | null;
  name?: string;
  life?: string | null;
  age?: string | null;
  urban?: string | null;
  fert?: string | null;
  /** The heading of each year and what it says. */
  gdp?: Record<string, string> | null;
  dollars?: string | null;
  coast?: string | null;
  coastNote?: string;
  high?: string | null;
  highNote?: string;
}

/** A page as the book writes them, with every figure in its usual words. */
const GOOD = {
  life: '83 years (2024 est.)',
  age: '47.2 years (2025 est.)',
  urban: '81.6% of total population (2023)',
  fert: '1.32 children born/woman (2025 est.)',
  gdp: { 2024: '$48,400 (2024 est.)', 2023: '$47,300 (2023 est.)' } as Record<string, string>,
  dollars: '<b>note:</b> data in 2021 dollars',
  coast: '4,964 km',
  high: 'Pico de Teide (Tenerife) on Canary Islands 3,718 m',
};
/** What the good page gives. */
const READ = { life: 83, gdp: 48400, age: 47.2, urban: 81.6, fert: 1.32, coast: 4964, high: 3718 };

const text = (said: string | null) => (said == null ? undefined : { text: said });

function page(id: string, said: Said = {}): unknown {
  const s = { ...GOOD, ...said };
  return {
    Geography: {
      Coastline: s.coast == null ? undefined : { text: s.coast, ...(s.coastNote ? { note: s.coastNote } : {}) },
      Elevation: { 'highest point': text(s.high), 'lowest point': { text: 'Atlantic Ocean 0 m' }, ...(s.highNote ? { note: s.highNote } : {}) },
    },
    'People and Society': {
      'Life expectancy at birth': { 'total population': text(s.life), male: { text: '80.3 years' } },
      'Median age': { total: text(s.age), male: { text: '45.7 years' } },
      Urbanization: { 'urban population': text(s.urban), 'rate of urbanization': { text: '0.24% annual rate of change (2020-25 est.)' } },
      'Total fertility rate': text(s.fert),
    },
    Economy: s.gdp == null ? {} : { 'Real GDP per capita': { ...Object.fromEntries(Object.entries(s.gdp).map(([year, t]) => [`Real GDP per capita ${year}`, { text: t }])), ...(s.dollars ? { note: s.dollars } : {}) } },
    Communications: { 'Internet country code': s.net === null ? undefined : { text: s.net ?? `.${id === 'GB' ? 'uk' : id.toLowerCase()}` } },
    Government: { 'Country name': { 'conventional short form': { text: s.name ?? id } } },
  };
}

interface Out {
  y: Record<string, number>;
  c: Record<string, Record<string, number> & { y?: Record<string, number> }>;
}
interface Ran {
  out: Out | null;
  report: string;
  error: string;
  dir: string;
  again(): string;
}

const made: string[] = [];
afterAll(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * Runs the script on a made-up world: each country with what its page says (or its pages; `'none'` for one
 * whose page has not been fetched). `more`: other entries of the index, as they come.
 */
function run(world: Record<string, Said | Said[] | 'none'>, more: { id: string; cl: string; pop?: number }[] = [], change?: (pages: Record<string, unknown>) => void): Ran {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cifras-'));
  made.push(dir);
  fs.mkdirSync(path.join(dir, 'data'));
  fs.mkdirSync(path.join(dir, 'src/factbook'), { recursive: true });
  const index = { countries: [...Object.keys(world).map((id) => ({ id, cl: 'un', pop: 1000 })), ...more] };
  fs.writeFileSync(path.join(dir, 'data/index.json'), JSON.stringify(index));
  const pages: Record<string, unknown> = {};
  for (const [id, said] of Object.entries(world)) {
    if (said === 'none') continue;
    const list = Array.isArray(said) ? said : [said];
    for (const [i, [file]] of (PAGES[id] ?? []).entries()) pages[path.basename(file)] = page(id, list[i] ?? list[0]);
  }
  change?.(pages);
  for (const [file, body] of Object.entries(pages)) fs.writeFileSync(path.join(dir, 'src/factbook', file), JSON.stringify(body));
  const args = [SCRIPT, '--data', path.join(dir, 'data'), '--src', path.join(dir, 'src'), '--report', path.join(dir, 'report.txt')];
  const go = () => execFileSync(process.execPath, args, { encoding: 'utf8', stdio: 'pipe' });
  let error = '';
  try {
    go();
  } catch (err) {
    error = String((err as { stderr?: string }).stderr ?? err);
  }
  const file = path.join(dir, 'data/figures.json');
  const report = path.join(dir, 'report.txt');
  return {
    out: fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Out) : null,
    report: fs.existsSync(report) ? fs.readFileSync(report, 'utf8') : '',
    error,
    dir,
    again: go,
  };
}

/** The lines of a report that are about one country. */
const notesOf = (ran: Ran, id: string): string[] => ran.report.split('\n').filter((l) => l.startsWith(`${id} `));

describe('the figures of a country, read from its page of The World Factbook', () => {
  it('reads the seven of a page written as the book writes them, each under the name the game has for it', () => {
    const { out, report, error } = run({ ES: {} });
    expect(error).toBe('');
    expect(out).toEqual({ y: { life: 2024, gdp: 2024, age: 2025, urban: 2023, fert: 2025 }, c: { ES: READ } });
    // In the order the game lists them.
    expect(Object.keys(out!.c.ES)).toEqual(['life', 'gdp', 'age', 'urban', 'fert', 'coast', 'high']);
    expect(notesOf({ report } as Ran, 'ES')).toEqual([]);
  });

  /** One country for each way of saying a figure that is taken, and what is read of it. */
  const TAKEN: [id: string, what: string, said: Said, key: keyof typeof READ, value: number][] = [
    ['ES', 'a coast with its parts in brackets', { coast: '2,234 km (mainland on Red Sea 1,151 km; islands in Red Sea 1,083 km)' }, 'coast', 2234],
    ['FI', 'a coast that says what it leaves out', { coast: '196.8 km (excludes 56 km for the island of Gozo)' }, 'coast', 196.8],
    ['MC', 'a coast of a few kilometres, with decimals', { coast: '4.1 km' }, 'coast', 4.1],
    ['CA', 'a coast of hundreds of thousands', { coast: '202,080 km' }, 'coast', 202080],
    ['CN', 'a summit with something said in brackets before its height', { high: 'Mount Everest (highest peak in Asia and highest point on earth above sea level) 8,849 m' }, 'high', 8849],
    ['AR', 'a summit with a semicolon inside the brackets', { high: 'Cerro Aconcagua (located in the northwestern corner of the province of Mendoza; highest point in South America) 6,962 m' }, 'high', 6962],
    ['NZ', 'a summit followed by a note with other heights', { high: "Aoraki/Mount Cook 3,724 m; note - the mountain's height was 3,764 m until 14 December 1991 when it lost about 10 m" }, 'high', 3724],
    ['IT', 'a summit whose height comes without its unit', { high: 'Mont Blanc 4,810' }, 'high', 4810],
    ['DO', 'a text with the marks of the web in it', { high: '<p>Pico&nbsp;Duarte   3,098 m</p>' }, 'high', 3098],
    ['TK', 'a summit of a few metres', { high: 'unnamed location on Nukunonu 5 m' }, 'high', 5],
    ['JP', 'life expectancy with decimals', { life: '85.2 years (2024 est.)' }, 'life', 85.2],
    ['NE', 'many children', { fert: '6.55 children born/woman (2025 est.)' }, 'fert', 6.55],
    ['SG', 'everybody in towns', { urban: '100% of total population (2023)' }, 'urban', 100],
    ['LU', 'what each makes, of the latest year the page has, whatever the order of its headings', { gdp: { 2022: '$126,600 (2022 est.)', 2024: '$128,200 (2024 est.)', 2023: '$127,100 (2023 est.)' } }, 'gdp', 128200],
    ['BI', 'what each makes, when it is little', { gdp: { 2024: '$800 (2024 est.)' } }, 'gdp', 800],
  ];
  describe('takes', () => {
    let ran: Ran;
    beforeAll(() => {
      ran = run(Object.fromEntries(TAKEN.map(([id, , said]) => [id, said])));
    });
    it.each(TAKEN)('%s: %s', (id, _what, _said, key, value) => {
      expect(ran.error).toBe('');
      expect(ran.out!.c[id][key]).toBe(value);
      // The rest of the page is read as ever.
      expect(ran.out!.c[id]).toEqual({ ...READ, [key]: value });
      expect(notesOf(ran, id)).toEqual([]);
    });
  });

  /** One country for each thing that gives no figure, and what the report says of it. */
  const LEFT: [id: string, what: string, said: Said, key: keyof typeof READ, why: string][] = [
    ['FK', 'life expectancy with the year before the figure', { life: '(2017 est.) 77.9' }, 'life', 'not read · "(2017 est.) 77.9"'],
    ['EH', 'life expectancy of no year', { life: '64.5 years' }, 'life', 'not read · "64.5 years"'],
    ['AD', 'life expectancy that does not say it is an estimate', { life: '83 years (2024)' }, 'life', 'not read · "83 years (2024)"'],
    ['AE', 'a median age of no year', { age: '21.8 years' }, 'age', 'not read · "21.8 years"'],
    ['AF', 'a share of people in towns of no year', { urban: '81.6% of total population' }, 'urban', 'not read · "81.6% of total population"'],
    ['AG', 'children of no year', { fert: '1.32 children born/woman' }, 'fert', 'not read · "1.32 children born/woman"'],
    ['MC', 'what each makes, counted in the dollars of another year', { dollars: '<b>note:</b> data in 2015 dollars' }, 'gdp', 'not read · "note: data in 2015 dollars": not in the dollars of the rest'],
    ['TW', 'what each makes, counted in the dollars of each year', { dollars: '<b>note:</b> data are in current dollars' }, 'gdp', 'not read · "note: data are in current dollars": not in the dollars of the rest'],
    ['NU', 'what each makes, in 2021 dollars said another way', { dollars: '<b>note:</b> data are in 2021 dollars' }, 'gdp', 'not read · "note: data are in 2021 dollars": not in the dollars of the rest'],
    ['GU', 'what each makes, without a word on its dollars', { dollars: null }, 'gdp', 'not read · it does not say in what dollars'],
    ['AL', 'what each makes, under the heading of another year', { gdp: { 2024: '$48,400 (2023 est.)' } }, 'gdp', 'not read · "$48,400 (2023 est.)" under the heading of 2024'],
    ['AM', 'what each makes, written another way', { gdp: { 2024: '48,400 dollars (2024 est.)' } }, 'gdp', 'not read · "48,400 dollars (2024 est.)"'],
    ['SX', 'the coast of an island two countries share', { coast: '58.9 km (for entire island)' }, 'coast', 'not read · "58.9 km (for entire island)": not of the country alone'],
    ['SH', 'a coast given in pieces', { coast: 'Saint Helena: 60 km Ascension Island: NA Tristan da Cunha (island only): 34 km' }, 'coast', 'not read · "Saint Helena: 60 km Ascension Island: NA Tristan da Cunha (island only): 34 km"'],
    ['AO', 'a coast that is a guess', { coast: 'about 500 km' }, 'coast', 'not read · "about 500 km"'],
    ['AR', 'a summit with words after its height', { high: 'Mount X 1,234 m above sea level' }, 'high', 'not read · "Mount X 1,234 m above sea level"'],
    ['AT', 'a summit of no height', { high: 'the top of the island' }, 'high', 'not read · "the top of the island"'],
    ['AU', 'a summit whose only number, without its unit, is not at the end', { high: 'Peak 4 of the range' }, 'high', 'not read · "Peak 4 of the range"'],
    ['AZ', 'life expectancy longer than anybody lives', { life: '120 years (2024 est.)' }, 'life', 'not read · 120: out of what it can be'],
    ['BA', 'life expectancy shorter than any is', { life: '30 years (2024 est.)' }, 'life', 'not read · 30: out of what it can be'],
    ['BB', 'a median age that is too high', { age: '70 years (2025 est.)' }, 'age', 'not read · 70: out of what it can be'],
    ['BD', 'a median age that is too low', { age: '9 years (2025 est.)' }, 'age', 'not read · 9: out of what it can be'],
    ['BE', 'more than everybody in towns', { urban: '101% of total population (2023)' }, 'urban', 'not read · 101: out of what it can be'],
    ['BF', 'too many children', { fert: '12 children born/woman (2025 est.)' }, 'fert', 'not read · 12: out of what it can be'],
    ['BG', 'too few children', { fert: '0.2 children born/woman (2025 est.)' }, 'fert', 'not read · 0.2: out of what it can be'],
    ['BH', 'what each makes, when it is too little to be true', { gdp: { 2024: '$100 (2024 est.)' } }, 'gdp', 'not read · 100: out of what it can be'],
    ['BJ', 'what each makes, when it is too much to be true', { gdp: { 2024: '$300,000 (2024 est.)' } }, 'gdp', 'not read · 300000: out of what it can be'],
    ['BM', 'a coast longer than any', { coast: '300,000 km' }, 'coast', 'not read · 300000: out of what it can be'],
    ['BN', 'a summit higher than Everest', { high: 'Mount Y 9,000 m' }, 'high', 'not read · 9000: out of what it can be'],
    ['BO', 'a summit at sea level', { high: 'the beach 0 m' }, 'high', 'not read · 0: out of what it can be'],
  ];
  describe('leaves out, and says why', () => {
    let ran: Ran;
    beforeAll(() => {
      ran = run(Object.fromEntries(LEFT.map(([id, , said]) => [id, said])));
    });
    it.each(LEFT)('%s: %s', (id, _what, _said, key, why) => {
      expect(ran.error).toBe('');
      const rest: Record<string, number> = { ...READ };
      delete rest[key];
      // Only that figure is lost: the others of the page are as good as ever.
      expect(ran.out!.c[id]).toEqual(rest);
      expect(notesOf(ran, id)).toEqual([`${id} ${key}: ${why}`]);
    });
    it('counts the notes it leaves', () => {
      expect(ran.report.split('\n').filter((l) => /^[A-Z]{2} \w+: /.test(l))).toHaveLength(LEFT.length);
    });
  });

  /** What the book does not say of a country, or says there is none of: no figure, and nothing to tell. */
  const MISSING: [id: string, what: string, said: Said, key: keyof typeof READ][] = [
    ['CH', 'a country without a sea', { coast: '0 km (landlocked)' }, 'coast'],
    ['LI', 'a country without a sea among countries without one', { coast: '0 km (doubly landlocked)' }, 'coast'],
    ['VA', 'a coast the page does not have', { coast: null }, 'coast'],
    ['TK', 'nobody in towns', { urban: '0% of total population (2023)' }, 'urban'],
    ['PN', 'a figure the book says it does not know', { life: 'NA' }, 'life'],
    ['NF', 'a figure the page does not have', { age: null }, 'age'],
    ['CX', 'a page without a word on what each makes', { gdp: null }, 'gdp'],
    ['CC', 'what each makes, with a note and no year', { gdp: {} }, 'gdp'],
    ['WF', 'children the page does not have', { fert: null }, 'fert'],
    ['NR', 'a summit the page does not have', { high: null }, 'high'],
  ];
  describe('has nothing to say of', () => {
    let ran: Ran;
    beforeAll(() => {
      ran = run(Object.fromEntries(MISSING.map(([id, , said]) => [id, said])));
    });
    it.each(MISSING)('%s: %s', (id, _what, _said, key) => {
      expect(ran.error).toBe('');
      const rest: Record<string, number> = { ...READ };
      delete rest[key];
      expect(ran.out!.c[id]).toEqual(rest);
      expect(notesOf(ran, id)).toEqual([]);
    });
  });

  it('finds a heading whatever blanks it has around it', () => {
    const { out, error } = run({ ES: {} }, [], (pages) => {
      const es = pages['sp.json'] as { Geography: Record<string, unknown> };
      es.Geography = { ' Coastline ': es.Geography.Coastline, 'Elevation ': es.Geography.Elevation };
    });
    expect(error).toBe('');
    expect(out!.c.ES).toEqual(READ);
  });

  it('writes nothing of a country none of whose figures could be read', () => {
    const { out, report } = run({ ES: {}, PT: { life: null, age: null, urban: null, fert: null, gdp: null, coast: null, high: null } });
    expect(Object.keys(out!.c)).toEqual(['ES']);
    expect(report).toContain('1 of 2 countries have some');
  });
});

describe('the year of each figure', () => {
  it('is said once for the year most countries have it of, and in each country that has it of another', () => {
    const { out } = run({
      ES: {},
      DE: {},
      KR: { gdp: { 2023: '$50,000 (2023 est.)', 2022: '$49,000 (2022 est.)' } },
      EH: { urban: '86.8% of total population (2020)', fert: '3.65 children born/woman (2020 est.)' },
      CC: { age: '40 years (2021 est.)', life: '80 years (2023 est.)' },
    });
    expect(out!.y).toEqual({ life: 2024, gdp: 2024, age: 2025, urban: 2023, fert: 2025 });
    expect(out!.c.ES.y).toBeUndefined();
    expect(out!.c.DE.y).toBeUndefined();
    expect(out!.c.KR).toEqual({ ...READ, gdp: 50000, y: { gdp: 2023 } });
    expect(out!.c.EH).toEqual({ ...READ, urban: 86.8, fert: 3.65, y: { urban: 2020, fert: 2020 } });
    expect(out!.c.CC).toEqual({ ...READ, life: 80, age: 40, y: { life: 2023, age: 2021 } });
  });

  it('is the earlier one when two years have as many countries', () => {
    const { out } = run({ ES: {}, DE: { life: '82 years (2023 est.)' } });
    expect(out!.y.life).toBe(2023);
    expect(out!.c.ES.y).toEqual({ life: 2024 });
    expect(out!.c.DE.y).toBeUndefined();
  });

  it('is none for a coast and a summit, which are of no year', () => {
    const { out } = run({ ES: {}, DE: {} });
    expect(Object.keys(out!.y)).toEqual(['life', 'gdp', 'age', 'urban', 'fert']);
  });

  it('is not said of a figure nobody has', () => {
    const { out } = run({ ES: { fert: null }, DE: { fert: null } });
    expect(Object.keys(out!.y)).toEqual(['life', 'gdp', 'age', 'urban']);
  });
});

describe('which page is of which country', () => {
  it('is checked by the internet code the page says the country has', () => {
    const { out, error } = run({ ES: { net: '.fr' } });
    expect(out).toBeNull();
    expect(error).toContain('europe/sp.json no es la página de ES');
  });

  it('takes a code that the page gives among others', () => {
    const { out, error } = run({ BL: { net: '.bl; note - .gp, the internet country code for Guadeloupe, and .fr, the internet country code for France, might also be encountered' } });
    expect(error).toBe('');
    expect(out!.c.BL).toEqual(READ);
  });

  it('knows the United Kingdom by the code it uses, which is not the one of its name', () => {
    expect(run({ GB: {} }).out!.c.GB).toEqual(READ);
    expect(run({ GB: { net: '.gb' } }).error).toContain('europe/uk.json no es la página de GB');
  });

  it('knows by its name a country whose page gives no code', () => {
    expect(PAGES.GS[0][2]).toBe('South Georgia and South Sandwich Islands');
    expect(run({ GS: { net: null, name: 'South Georgia and South Sandwich Islands' } }).out!.c.GS).toEqual(READ);
    expect(run({ GS: { net: null, name: 'Georgia' } }).error).toContain('south-america/sx.json no es la página de GS');
    // The code would not do: the list says the page is told by its name.
    expect(run({ GS: { net: '.gs', name: 'Somewhere else' } }).error).toContain('no es la página de GS');
  });

  it('stops when a page has not been fetched, and says how to fetch it', () => {
    const { out, error } = run({ ES: 'none' });
    expect(out).toBeNull();
    expect(error).toContain('Falta la página de ES (europe/sp.json)');
    expect(error).toContain('npm run data:fetch');
  });

  it('says which countries the book has no page of, and gives them no figure', () => {
    expect(PAGES.AX).toBeUndefined();
    const { out, report, error } = run({ ES: {}, AX: {}, RE: {} });
    expect(error).toBe('');
    expect(Object.keys(out!.c)).toEqual(['ES']);
    expect(report).toContain('\nWithout a page: AX RE\n');
    expect(report.split('\n')[0]).toMatch(/^Figures of The World Factbook: 1 of 3 countries have some · figures\.json 0\.\d kB$/);
  });

  it('says so when every country has its page', () => {
    expect(run({ ES: {} }).report).toContain('\nWithout a page: none\n');
  });

  it('reads only the countries the games of figures are played with: not what is no country, nor where nobody lives', () => {
    // Neither has its page here, and neither is missed.
    const { out, report, error } = run({ ES: {} }, [
      { id: 'BV', cl: 'dep', pop: 0 },
      { id: 'HM', cl: 'dep' },
      { id: 'PT', cl: 'other', pop: 1000 },
    ]);
    expect(error).toBe('');
    expect(Object.keys(out!.c)).toEqual(['ES']);
    expect(report).toContain('1 of 1 countries have some');
    expect(report).toContain('\nWithout a page: none\n');
  });

  it('writes the countries in the order the game has them', () => {
    const { out } = run({ PT: {}, ES: {}, AD: {} });
    expect(Object.keys(out!.c)).toEqual(['PT', 'ES', 'AD']);
  });

  it('has a page, and only one, for every country but Palestine, each under a name of its own', () => {
    const files = Object.values(PAGES).flatMap((pages) => pages.map(([file]) => file));
    expect(Object.keys(PAGES)).toHaveLength(242);
    expect(files).toHaveLength(243);
    expect(new Set(files.map((f) => path.basename(f))).size).toBe(files.length);
    expect(Object.entries(PAGES).filter(([, pages]) => pages.length !== 1).map(([id]) => id)).toEqual(['PS']);
    for (const pages of Object.values(PAGES)) for (const [file, sha] of pages) expect(`${file} ${sha}`).toMatch(/^[a-z-]+\/[a-z]{2}\.json [0-9a-f]{40}$/);
    expect(Object.keys(PAGES)).toEqual([...Object.keys(PAGES)].sort());
  });
});

describe('a country the book has in two pages', () => {
  const two = (a: Said, b: Said) => run({ PS: [a, b] });

  it('has the figure both pages give', () => {
    const { out, report } = two({}, {});
    // The coast of the two is the sum of theirs, whatever the other figures are.
    expect(out!.c.PS).toEqual({ ...READ, coast: READ.coast * 2 });
    expect(notesOf({ report } as Ran, 'PS')).toEqual([]);
  });

  it('has for a coast the sum of the two, one of which may have none', () => {
    expect(two({ coast: '40 km' }, { coast: '0 km (landlocked)' }).out!.c.PS.coast).toBe(40);
    expect(two({ coast: '40 km' }, { coast: '10.5 km' }).out!.c.PS.coast).toBe(50.5);
    expect(two({ coast: '0 km (landlocked)' }, { coast: '0 km (landlocked)' }).out!.c.PS.coast).toBeUndefined();
  });

  it('has for a summit the higher of the two', () => {
    expect(two({ high: 'Joz Abu Awdah 105 m' }, { high: 'Khallat al Batrakh 1,020 m' }).out!.c.PS.high).toBe(1020);
    expect(two({ high: 'Khallat al Batrakh 1,020 m' }, { high: 'Joz Abu Awdah 105 m' }).out!.c.PS.high).toBe(1020);
  });

  it('has no figure where the two pages give different ones, and says both', () => {
    const { out, report } = two({ life: '75.5 years (2024 est.)', age: '19.9 years (2025 est.)' }, { life: '76.5 years (2024 est.)', age: '22 years (2025 est.)' });
    expect(out!.c.PS).toEqual({ gdp: READ.gdp, urban: READ.urban, fert: READ.fert, coast: READ.coast * 2, high: READ.high });
    expect(notesOf({ report } as Ran, 'PS')).toEqual(['PS life: not read · its pages differ: 75.5 and 76.5', 'PS age: not read · its pages differ: 19.9 and 22']);
  });

  it('has no figure where the two pages give the same one of different years', () => {
    const { out, report } = two({ urban: '77.6% of total population (2023)' }, { urban: '77.6% of total population (2022)' });
    expect(out!.c.PS.urban).toBeUndefined();
    expect(notesOf({ report } as Ran, 'PS')).toEqual(['PS urban: not read · its pages differ: 77.6 and 77.6']);
  });

  it('has no figure where only one of the pages gives it, and says so', () => {
    const { out, report } = two({}, { fert: null });
    expect(out!.c.PS.fert).toBeUndefined();
    expect(notesOf({ report } as Ran, 'PS')).toEqual(['PS fert: not read · one of its pages does not give it']);
    // Not even a coast or a summit, which would be those of a part of the country.
    const half = two({ coast: null, high: null }, {});
    expect(half.out!.c.PS.coast).toBeUndefined();
    expect(half.out!.c.PS.high).toBeUndefined();
    expect(notesOf(half, 'PS')).toEqual(['PS coast: not read · one of its pages does not give it', 'PS high: not read · one of its pages does not give it']);
  });

  it('has no figure where one of the pages gives it in a way that is not read, and says which', () => {
    const { out, report } = two({}, { dollars: '<b>note:</b> data in 2015 dollars', high: 'Mount Z 9,500 m' });
    expect(out!.c.PS.gdp).toBeUndefined();
    expect(out!.c.PS.high).toBeUndefined();
    expect(notesOf({ report } as Ran, 'PS')).toEqual(['PS gdp: not read · "note: data in 2015 dollars": not in the dollars of the rest', 'PS high: not read · 9500: out of what it can be']);
  });

  it('has nothing to say of what neither page gives', () => {
    const { out, report } = two({ age: null }, { age: null });
    expect(out!.c.PS.age).toBeUndefined();
    expect(notesOf({ report } as Ran, 'PS')).toEqual([]);
  });

  it('checks both pages to be of the country', () => {
    expect(two({}, { net: '.il' }).error).toContain('middle-east/we.json no es la página de PS');
    expect(two({ net: '.il' }, {}).error).toContain('middle-east/gz.json no es la página de PS');
  });
});

describe('what is read by hand', () => {
  const FRANCE: Said = { coast: '4,853 km', coastNote: '<strong>metropolitan France: </strong>3,427 km' };
  const NETHERLANDS: Said = { high: 'Mount Scenery (on the island of Saba in the Caribbean) 862 m', highNote: '<strong>note:</strong> the highest point on continental Netherlands is Vaalserberg at 322 m' };
  const MALTA: Said = { coast: '196.8 km (excludes 56 km for the island of Gozo)' };

  it('is the coast of France in Europe, which the page gives in a note', () => {
    const ran = run({ FR: FRANCE });
    expect(ran.out!.c.FR).toEqual({ ...READ, coast: 3427 });
    expect(notesOf(ran, 'FR')).toEqual(['FR coast: 3427, by hand, from "metropolitan France: 3,427 km"']);
  });

  it('is the highest point of the Netherlands in Europe, which the page names in a note', () => {
    const ran = run({ NL: NETHERLANDS });
    expect(ran.out!.c.NL).toEqual({ ...READ, high: 322 });
    expect(notesOf(ran, 'NL')).toEqual(['NL high: 322, by hand, from "the highest point on continental Netherlands is Vaalserberg at 322 m"']);
  });

  it('is the coast of Malta with that of Gozo, which the page leaves out', () => {
    const ran = run({ MT: MALTA });
    expect(ran.out!.c.MT).toEqual({ ...READ, coast: 252.8 });
    expect(notesOf(ran, 'MT')).toEqual(['MT coast: 252.8, by hand, from "196.8 km (excludes 56 km for the island of Gozo)"']);
  });

  it('stops when the page no longer says what was read in it', () => {
    expect(run({ FR: { coast: '4,853 km' } }).error).toContain('La página de FR ya no dice «metropolitan France: 3,427 km»');
    expect(run({ FR: { coast: '4,853 km', coastNote: '<strong>metropolitan France: </strong>3,500 km' } }).error).toContain('La página de FR ya no dice');
    expect(run({ NL: { high: 'Vaalserberg 322 m' } }).error).toContain('La página de NL ya no dice «the highest point on continental Netherlands is Vaalserberg at 322 m»');
    expect(run({ MT: { coast: '252.8 km' } }).error).toContain('La página de MT ya no dice «196.8 km (excludes 56 km for the island of Gozo)»');
    expect(run({ MT: { coast: '252.8 km' } }).out).toBeNull();
  });

  it('changes nothing else of those pages, nor anything of the others', () => {
    const ran = run({ FR: FRANCE, NL: NETHERLANDS, MT: MALTA, ES: { coastNote: '<strong>metropolitan France: </strong>3,427 km', highNote: '<strong>note:</strong> the highest point on continental Netherlands is Vaalserberg at 322 m' } });
    expect(ran.out!.c.ES).toEqual(READ);
    expect(ran.out!.c.FR.high).toBe(READ.high);
    expect(ran.out!.c.NL.coast).toBe(READ.coast);
    expect(ran.out!.c.MT.high).toBe(READ.high);
  });
});

describe('what the run leaves written', () => {
  it('says in the report how many countries have each figure, from what to what, and which are of another year', () => {
    const { report } = run({
      ES: {},
      JP: { life: '85.2 years (2024 est.)', coast: '29,751 km', high: 'Fuji 3,776 m' },
      AF: { life: '54.4 years (2023 est.)', coast: '0 km (landlocked)', gdp: { 2023: '$2,000 (2023 est.)' } },
      CH: { coast: '0 km (landlocked)', gdp: { 2022: '$80,000 (2022 est.)' } },
    });
    const lines = report.split('\n');
    expect(lines[0]).toMatch(/^Figures of The World Factbook: 4 of 4 countries have some · figures\.json 0\.\d kB$/);
    expect(lines.slice(2, 9)).toEqual([
      'life: 4 of 4 countries, from 54.4 to 85.2, of 2024 (2023: AF)',
      'gdp: 4 of 4 countries, from 2000 to 80000, of 2024 (2022: CH; 2023: AF)',
      'age: 4 of 4 countries, from 47.2 to 47.2, of 2025',
      'urban: 4 of 4 countries, from 81.6 to 81.6, of 2023',
      'fert: 4 of 4 countries, from 1.32 to 1.32, of 2025',
      'coast: 2 of 4 countries, from 4964 to 29751',
      'high: 4 of 4 countries, from 3718 to 3776',
    ]);
  });

  it('says of a figure nobody has that there is none', () => {
    const { report } = run({ CH: { coast: '0 km (landlocked)' } });
    expect(report).toContain('\ncoast: 0 of 1 countries, none\n');
  });

  it('does not write the file again when it would say the same', () => {
    const ran = run({ ES: {}, DE: {} });
    const file = path.join(ran.dir, 'data/figures.json');
    const before = fs.readFileSync(file, 'utf8');
    const old = new Date('2020-01-01T00:00:00Z');
    fs.utimesSync(file, old, old);
    expect(ran.again()).toContain('2 of 2 countries have some');
    expect(fs.statSync(file).mtime.getTime()).toBe(old.getTime());
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
    // And writes it when a page has changed.
    fs.writeFileSync(path.join(ran.dir, 'src/factbook/sp.json'), JSON.stringify(page('ES', { life: '84 years (2024 est.)' })));
    ran.again();
    expect(fs.statSync(file).mtime.getTime()).toBeGreaterThan(old.getTime());
    expect((JSON.parse(fs.readFileSync(file, 'utf8')) as Out).c.ES.life).toBe(84);
  });

  it('says on the screen what it says in the report, and where the report is', () => {
    const ran = run({ ES: {} });
    const said = ran.again();
    expect(said).toContain('Figures of The World Factbook: 1 of 1 countries have some');
    expect(said).toContain('  life: 1 of 1 countries, from 83 to 83, of 2024\n');
    expect(said).toContain('0 notes in ');
  });
});
