/**
 * scripts/data/facts.mjs, which writes down the currency, the official languages, the domain and the
 * dialling code of each country, run on a world made up here: what it takes from each source, what it
 * leaves out and why, and what it does with what is mended by hand.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = path.join(__dirname, '../../scripts/data/facts.mjs');

/** A currency as CLDR files it under a country: from when to when it was legal tender, and whether it ever was. */
type Tender = [code: string, when?: { from?: string; to?: string; tender?: false }];
/** A language as CLDR files it under a country: the share of its people who speak it, and how official it is. */
type Spoken = [code: string, share: number, status?: 'official' | 'de_facto_official' | 'official_regional' | 'official_minority'];

/** What the sources say of one country. `cl`: how the game counts it; `geo`: what GeoNames says. */
interface Land {
  cl?: string;
  money?: Tender[];
  speaks?: Spoken[];
  geo?: { tld?: string; currency?: string; phone?: string } | null;
}

/** The names CLDR has, each as [Spanish, English]; `null` for one it lacks in that language. */
const MONEY: Record<string, [string | null, string | null]> = {
  EUR: ['euro', 'euro'],
  ESP: ['peseta española', 'Spanish peseta'],
  USD: ['dólar estadounidense', 'US dollar'],
  PAB: ['balboa panameño', 'Panamanian balboa'],
  MXN: ['peso mexicano', 'Mexican peso'],
  MXV: ['unidad de inversión mexicana', 'Mexican investment unit'],
  ILS: ['nuevo séquel israelí', 'Israeli new shekel'],
  AFN: ['afgani afgano', 'Afghan Afghani'],
  ZWG: ['oro zimbabuense', 'Zimbabwean gold'],
  GBP: ['libra esterlina', 'British pound'],
  NOK: ['corona noruega', 'Norwegian krone'],
  XXA: [null, 'Nameless in Spanish'],
};
const TONGUES: Record<string, [string | null, string | null]> = {
  es: ['español', 'Spanish'],
  ca: ['catalán', 'Catalan'],
  en: ['inglés', 'English'],
  fr: ['francés', 'French'],
  de: ['alemán', 'German'],
  no: ['noruego', 'Norwegian'],
  nb: ['noruego bokmal', 'Norwegian Bokmål'],
  nn: ['noruego nynorsk', 'Norwegian Nynorsk'],
  zh: ['chino', 'Chinese'],
  kk: ['kazajo', 'Kazakh'],
  ru: ['ruso', 'Russian'],
  ar: ['árabe', 'Arabic'],
  he: ['hebreo', 'Hebrew'],
  sr: ['serbio', 'Serbian'],
  pt: ['portugués', 'Portuguese'],
  mwl: ['mirandés', 'Mirandese'],
  sq: ['albanés', 'Albanian'],
  it: ['italiano', 'Italian'],
  na: ['nauruano', 'Nauru'],
  // Without a name in Spanish, and without one at all.
  xx1: [null, 'Onlyenglish'],
  cnr: [null, null],
};

const made: string[] = [];
afterAll(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

interface Rec {
  m?: string[];
  l?: string[];
  r?: string[];
  s?: string[];
  d?: string;
  p?: string[];
}
interface Out {
  c: Record<string, Rec>;
  m: Record<string, string[]>;
  l: Record<string, string[]>;
}
interface Ran {
  out: Out | null;
  report: string;
  error: string;
  file: string;
  again(): string;
}

/** A country as plain as they come: one currency, one language, a domain and a code. */
const plain = (id: string, more: Land = {}): Land => ({ money: [['EUR']], speaks: [['es', 99, 'official']], geo: { tld: `.${id.toLowerCase()}`, currency: 'EUR', phone: '34' }, ...more });

/** Runs the script on a made-up world. `names`: what replaces the names CLDR has for a language or a currency. */
function run(world: Record<string, Land>, names: { money?: typeof MONEY; tongues?: typeof TONGUES } = {}): Ran {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'datos-'));
  made.push(dir);
  fs.mkdirSync(path.join(dir, 'data'));
  fs.mkdirSync(path.join(dir, 'src/cldr'), { recursive: true });
  const write = (file: string, body: unknown) => fs.writeFileSync(path.join(dir, file), JSON.stringify(body));
  write('data/index.json', { countries: Object.entries(world).map(([id, land]) => ({ id, cl: land.cl ?? 'un' })) });
  const geo: Record<string, unknown> = {};
  for (const [id, land] of Object.entries(world)) if (land.geo !== null) geo[id] = { tld: '', currency: '', phone: '', ...land.geo };
  write('static.json', { countries: geo });
  const region: Record<string, unknown> = {};
  const territories: Record<string, unknown> = {};
  for (const [id, land] of Object.entries(world)) {
    if (land.money) region[id] = land.money.map(([code, when]) => ({ [code]: { ...(when?.from ? { _from: when.from } : {}), ...(when?.to ? { _to: when.to } : {}), ...(when?.tender === false ? { _tender: 'false' } : {}) } }));
    if (land.speaks) territories[id] = { languagePopulation: Object.fromEntries(land.speaks.map(([code, share, status]) => [code, { _populationPercent: String(share), ...(status ? { _officialStatus: status } : {}) }])) };
  }
  write('src/cldr/currencyData.json', { supplemental: { currencyData: { region } } });
  write('src/cldr/territoryInfo.json', { supplemental: { territoryInfo: territories } });
  const money = { ...MONEY, ...names.money };
  const tongues = { ...TONGUES, ...names.tongues };
  for (const [i, lang] of (['es', 'en'] as const).entries()) {
    const currencies = Object.fromEntries(Object.entries(money).flatMap(([code, pair]) => (pair[i] ? [[code, { displayName: pair[i], ...(lang === 'en' ? { 'displayName-count-one': pair[i] } : {}) }]] : [])));
    write(`src/cldr/currencies-${lang}.json`, { main: { [lang]: { numbers: { currencies } } } });
    const languages = Object.fromEntries(Object.entries(tongues).flatMap(([code, pair]) => (pair[i] ? [[code, pair[i]]] : [])));
    write(`src/cldr/languages-${lang}.json`, { main: { [lang]: { localeDisplayNames: { languages } } } });
  }
  const args = [SCRIPT, '--data', path.join(dir, 'data'), '--src', path.join(dir, 'src'), '--static', path.join(dir, 'static.json'), '--report', path.join(dir, 'report.txt')];
  const go = () => execFileSync(process.execPath, args, { encoding: 'utf8', stdio: 'pipe' });
  let error = '';
  try {
    go();
  } catch (err) {
    error = String((err as { stderr?: string }).stderr ?? err);
  }
  const file = path.join(dir, 'data/facts.json');
  const report = path.join(dir, 'report.txt');
  return { out: fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Out) : null, report: fs.existsSync(report) ? fs.readFileSync(report, 'utf8') : '', error, file, again: go };
}

/** The lines of a report that are about one country. */
const notesOf = (ran: Ran, id: string): string[] => ran.report.split('\n').filter((l) => l.startsWith(`${id} `));

describe('the four things said of a country, put together from GeoNames and CLDR', () => {
  it('writes each under its letter, and the names of what it has in the two languages', () => {
    const ran = run({ ES: plain('ES', { speaks: [['es', 99, 'official'], ['ca', 16, 'official_regional'], ['en', 28]] }), GB: plain('GB', { money: [['GBP']], speaks: [['en', 98, 'official']], geo: { tld: '.uk', currency: 'GBP', phone: '44' } }) });
    expect(ran.error).toBe('');
    expect(ran.out!.c.ES).toEqual({ m: ['EUR'], l: ['es'], r: ['ca'], s: ['en'], d: '.es', p: ['34'] });
    expect(Object.keys(ran.out!.c.ES)).toEqual(['m', 'l', 'r', 's', 'd', 'p']);
    expect(ran.out!.c.GB).toEqual({ m: ['GBP'], l: ['en'], d: '.uk', p: ['44'] });
    // A currency: its name, and what it is called without saying whose it is; then the other names it is typed by.
    expect(ran.out!.m).toEqual({ EUR: ['euro', 'euro', 'euro', 'euro'], GBP: ['libra esterlina', 'British pound', 'libra', 'pound', 'pound sterling', 'sterling'] });
    // A language: its two names and the others it is typed by. Only those that are official somewhere: not one that is only spoken.
    expect(ran.out!.l).toEqual({ ca: ['catalán', 'Catalan'], en: ['inglés', 'English'], es: ['español', 'Spanish', 'castellano', 'Castilian'] });
    expect(notesOf(ran, 'ES')).toEqual([]);
  });

  it('leaves out the countries the game only draws, and the country that has nothing', () => {
    const ran = run({ ES: plain('ES'), AQ: plain('AQ', { cl: 'other' }), BV: { cl: 'dep', geo: {} } });
    expect(ran.error).toBe('');
    expect(Object.keys(ran.out!.c)).toEqual(['ES']);
    expect(ran.report).toContain('Facts of the countries: 1 of 2 have some');
    expect(ran.report).toContain('With nothing: BV');
  });

  it('writes the file again only when what it says has changed', () => {
    const ran = run({ ES: plain('ES') });
    const before = fs.statSync(ran.file).mtimeMs;
    const said = ran.again();
    expect(fs.statSync(ran.file).mtimeMs).toBe(before);
    expect(said).toContain('currency: 1 of 1 countries, 1 different');
    expect(said).toContain('language: 1 of 1 countries, 1 different');
  });

  it('stops when a source has not been fetched, and says how to bring it', () => {
    const ran = run({ ES: plain('ES') });
    fs.rmSync(path.join(path.dirname(ran.file), '../src/cldr/territoryInfo.json'));
    expect(() => ran.again()).toThrow(/Falta .*territoryInfo\.json: ejecuta antes «npm run data:fetch»/);
  });
});

describe('the currency of a country', () => {
  it('is the one that is legal tender on the day the script is of: not one withdrawn before, nor one still to come, nor one that never was tender', () => {
    const ran = run({
      ES: plain('ES', { money: [['EUR', { from: '1999-01-01' }], ['ESP', { from: '1868-10-19', to: '2002-02-28' }]] }),
      MX: plain('MX', { money: [['MXN', { from: '1993-01-01' }], ['MXV', { tender: false }]], geo: { tld: '.mx', currency: 'MXN', phone: '52' } }),
      FR: plain('FR', { money: [['USD', { from: '2999-01-01' }], ['EUR', { from: '1999-01-01' }]] }),
    });
    expect(ran.error).toBe('');
    expect(ran.out!.c.ES.m).toEqual(['EUR']);
    expect(ran.out!.c.MX.m).toEqual(['MXN']);
    expect(ran.out!.c.FR.m).toEqual(['EUR']);
    expect(Object.keys(ran.out!.m)).toEqual(['EUR', 'MXN']);
  });

  it('takes the two of a country that has two, the one GeoNames names first', () => {
    // CLDR lists the newest first: the dollar came to Panama after the balboa.
    const ran = run({ PA: plain('PA', { money: [['USD', { from: '1904-11-18' }], ['PAB', { from: '1903-11-04' }]], geo: { tld: '.pa', currency: 'PAB', phone: '507' } }) });
    expect(ran.out!.c.PA.m).toEqual(['PAB', 'USD']);
    expect(notesOf(ran, 'PA')).toEqual(['PA currency: PAB and USD · both are legal tender']);
  });

  it('believes CLDR where GeoNames, which is older, names one that is no longer tender, and says so', () => {
    const ran = run({ ES: plain('ES', { geo: { tld: '.es', currency: 'ESP', phone: '34' } }) });
    expect(ran.out!.c.ES.m).toEqual(['EUR']);
    expect(notesOf(ran, 'ES')).toEqual(['ES currency: EUR · GeoNames says ESP, which CLDR no longer gives as legal tender']);
  });

  it('gives none to a country CLDR has none in use for, whatever GeoNames says', () => {
    const ran = run({ ES: plain('ES', { money: [['ESP', { to: '2002-02-28' }]], geo: { tld: '.es', currency: 'ESP', phone: '34' } }) });
    expect(ran.out!.c.ES.m).toBeUndefined();
    expect(notesOf(ran, 'ES')).toEqual(['ES currency: none · CLDR gives none in use, GeoNames says ESP']);
    expect(ran.report).toContain('members of the UN without: ES');
  });

  it('calls each for short by the word that says what it is: the first in Spanish, the last in English', () => {
    const ran = run({
      MX: plain('MX', { money: [['MXN']] }),
      IT: plain('IT', { money: [['ILS']] }),
      AF: plain('AF', { money: [['AFN']] }),
      US: plain('US', { money: [['USD']] }),
    });
    expect(ran.error).toBe('');
    expect(ran.out!.m.MXN).toEqual(['peso mexicano', 'Mexican peso', 'peso', 'peso']);
    // "nuevo" says it is the new one, not what it is; and what is typed besides.
    expect(ran.out!.m.ILS).toEqual(['nuevo séquel israelí', 'Israeli new shekel', 'séquel', 'shekel', 'shéquel', 'sheqel', 'nuevo shéquel']);
    // In small letters, as a word in the middle of a sentence.
    expect(ran.out!.m.AFN).toEqual(['afgani afgano', 'Afghan Afghani', 'afgani', 'afghani']);
    expect(ran.out!.m.USD).toEqual(['dólar estadounidense', 'US dollar', 'dólar', 'dollar']);
  });

  it('calls the currency of Zimbabwe by its initials, by hand, and says what the rule would have said', () => {
    const ran = run({ ZW: plain('ZW', { money: [['ZWG'], ['USD']], geo: { tld: '.zw', currency: 'ZWG', phone: '263' } }) });
    expect(ran.out!.m.ZWG).toEqual(['oro zimbabuense', 'Zimbabwean gold', 'ZiG', 'ZiG', 'oro', 'gold', 'Zimbabwe Gold']);
    expect(ran.report).toContain('currency ZWG: called "ZiG" / "ZiG" for short, by hand · the rule says "oro" / "gold"');
  });

  it('stops at a name given by hand that the rule gives already', () => {
    const ran = run({ ZW: plain('ZW', { money: [['ZWG']] }) }, { money: { ZWG: ['ZiG de Zimbabue', 'Zimbabwean ZiG'] } });
    expect(ran.error).toMatch(/La regla ya llama «ZiG» a la moneda ZWG: sobra el nombre que está a mano/);
  });

  it('stops at a currency CLDR has no name for in one of the two languages', () => {
    const ran = run({ ES: plain('ES', { money: [['XXA']] }) });
    expect(ran.error).toMatch(/CLDR no dice cómo se llama la moneda XXA en español/);
  });

  it('stops at another name given by hand that is one of its names already', () => {
    const ran = run({ GB: plain('GB', { money: [['GBP']] }) }, { money: { GBP: ['libra esterlina', 'pound sterling'] } });
    expect(ran.error).toMatch(/«pound sterling» ya es un nombre de GBP: sobra en ALSO_CALLED/);
  });
});

describe('the languages of a country', () => {
  it('are told apart by how official they are: in the whole of it, in part of it, or only spoken', () => {
    const ran = run({
      CH: plain('CH', { speaks: [['fr', 23, 'official'], ['de', 62, 'de_facto_official'], ['it', 8, 'official_regional'], ['sq', 3, 'official_minority'], ['en', 45], ['pt', 4]] }),
      // What makes a language one that could be shown as an answer: being the first of some country.
      GB: plain('GB', { speaks: [['en', 98, 'official']] }),
    });
    expect(ran.error).toBe('');
    // Each list from the most spoken to the least. Portuguese is the first language of no country here: it is not kept.
    expect(ran.out!.c.CH).toMatchObject({ l: ['de', 'fr'], r: ['it', 'sq'], s: ['en'] });
  });

  it('keeps as spoken only what a tenth of the people speak: CLDR lists languages of a handful', () => {
    const ran = run({
      BR: plain('BR', { speaks: [['pt', 91, 'official'], ['es', 0.04], ['en', 10], ['fr', 9.9]] }),
      ES: plain('ES'),
      GB: plain('GB', { speaks: [['en', 98, 'official']] }),
      FR: plain('FR', { speaks: [['fr', 97, 'official']] }),
    });
    expect(ran.error).toBe('');
    expect(ran.out!.c.BR).toMatchObject({ l: ['pt'], s: ['en'] });
  });

  it('puts two that are spoken by as many in the order of their codes', () => {
    const ran = run({ CH: plain('CH', { speaks: [['fr', 50, 'official'], ['de', 50, 'official']] }) });
    expect(ran.out!.c.CH.l).toEqual(['de', 'fr']);
  });

  it('counts as one the languages CLDR tells apart and nobody asked which is official would', () => {
    const ran = run({
      // The two written forms of Norwegian; a language written in two scripts.
      NO: plain('NO', { speaks: [['nb', 100, 'official'], ['nn', 25, 'official'], ['zh_Hant', 2, 'official_regional'], ['zh', 1]] }),
    });
    expect(ran.error).toBe('');
    expect(ran.out!.c.NO).toMatchObject({ l: ['no'], r: ['zh'] });
    expect(ran.out!.c.NO.s).toBeUndefined();
    expect(Object.keys(ran.out!.l)).toEqual(['no', 'zh']);
    // The others it is typed by are those of the language it is counted as.
    expect(ran.out!.l.no).toEqual(['noruego', 'Norwegian', 'bokmål', 'nynorsk']);
  });

  it('passes over what CLDR files as no language at all', () => {
    const ran = run({ ES: plain('ES', { speaks: [['es', 99, 'official'], ['und', 50, 'official']] }) });
    expect(ran.out!.c.ES.l).toEqual(['es']);
  });

  it('leaves out, and says so, a language of part of a country that has no name in one of the two languages', () => {
    const ran = run({ ES: plain('ES', { speaks: [['es', 99, 'official'], ['xx1', 5, 'official_regional'], ['ca', 16, 'official_regional']] }) });
    expect(ran.error).toBe('');
    expect(ran.out!.c.ES.r).toEqual(['ca']);
    expect(notesOf(ran, 'ES')).toEqual(['ES language: xx1 left out · official in part of it, and without a name in Spanish or in English']);
  });

  it('stops at a language of a whole country that has no name', () => {
    const ran = run({ ES: plain('ES', { speaks: [['xx1', 99, 'official']] }) });
    expect(ran.error).toMatch(/CLDR no dice cómo se llama el idioma xx1 en español: hay que ponerle nombre a mano/);
  });

  it('names by hand the ones CLDR does not name, or names oddly, and says which', () => {
    const ran = run({ ME: plain('ME', { speaks: [['sr', 43, 'official']] }), NR: plain('NR', { speaks: [['na', 93, 'official']] }) });
    expect(ran.error).toBe('');
    // Montenegrin has no name in CLDR; Nauruan is called "Nauru" in English there.
    expect(ran.out!.l).toEqual({ cnr: ['montenegrino', 'Montenegrin'], na: ['nauruano', 'Nauruan'] });
    expect(ran.report).toContain('language cnr: called "montenegrino" / "Montenegrin", by hand');
    expect(ran.report).toContain('language na: called "nauruano" / "Nauruan", by hand');
  });

  it('stops at a name given by hand that CLDR gives already', () => {
    const ran = run({ NR: plain('NR', { speaks: [['na', 93, 'official']] }) }, { tongues: { na: ['nauruano', 'Nauruan'] } });
    expect(ran.error).toMatch(/CLDR ya llama «Nauruan» al idioma na: sobra el nombre que está a mano/);
  });

  it('takes away by hand the ones CLDR gives as official where they are not, and they stay among the spoken', () => {
    const ran = run({ IL: plain('IL', { speaks: [['he', 63, 'official'], ['ar', 18, 'official']] }), EG: plain('EG', { speaks: [['ar', 95, 'official']] }) });
    expect(ran.error).toBe('');
    expect(ran.out!.c.IL).toMatchObject({ l: ['he'], s: ['ar'] });
    expect(notesOf(ran, 'IL')).toEqual(['IL language: ar is not official, by hand']);
  });

  it('adds by hand the ones CLDR does not give as official: in the whole of a country, or in part of it', () => {
    const ran = run({
      ME: plain('ME', { speaks: [['sr', 43, 'official']] }),
      PT: plain('PT', { speaks: [['pt', 96, 'official']] }),
    });
    expect(ran.error).toBe('');
    expect(ran.out!.c.ME.l).toEqual(['cnr']);
    expect(ran.out!.c.PT).toMatchObject({ l: ['pt'], r: ['mwl'] });
    expect(notesOf(ran, 'ME')).toEqual(['ME language: sr is not official, by hand', 'ME language: cnr is official, by hand']);
    expect(notesOf(ran, 'PT')).toEqual(['PT language: mwl is official in part of it, by hand']);
  });

  it('puts first by hand the language of the state where another is more spoken', () => {
    const ran = run({ KZ: plain('KZ', { speaks: [['ru', 84, 'official'], ['kk', 80, 'official']] }) });
    expect(ran.out!.c.KZ.l).toEqual(['kk', 'ru']);
    expect(notesOf(ran, 'KZ')).toEqual(['KZ language: kk first, by hand']);
  });

  /** A line by hand that mends nothing is one that a later edition of CLDR has made idle: the run stops at it. */
  const IDLE: [what: string, world: Record<string, Land>, error: RegExp][] = [
    ['a language taken away that CLDR no longer gives as official', { IL: plain('IL', { speaks: [['he', 63, 'official'], ['ar', 18]] }) }, /CLDR ya no da el ar por oficial en IL: sobra la corrección a mano \(NOT_OFFICIAL/],
    ['a language added that CLDR gives as official already', { PE: plain('PE', { speaks: [['es', 84, 'official'], ['ay', 2, 'official']] }) }, /CLDR ya da el ay por oficial en PE: sobra la corrección a mano \(OFFICIAL/],
    ['a language of part of a country that CLDR has as such already', { PT: plain('PT', { speaks: [['pt', 96, 'official'], ['mwl', 1, 'official_regional']] }) }, /CLDR ya da el mwl por oficial en PT, o en parte de él: sobra la corrección a mano \(REGIONAL/],
    ['a language put first that comes first already', { KZ: plain('KZ', { speaks: [['ru', 70, 'official'], ['kk', 80, 'official']] }) }, /El kk ya va el primero en KZ, o no es oficial allí: sobra la corrección a mano \(FIRST/],
    ['a language put first that is not official there', { KZ: plain('KZ', { speaks: [['ru', 84, 'official'], ['kk', 80]] }) }, /El kk ya va el primero en KZ, o no es oficial allí: sobra la corrección a mano \(FIRST/],
  ];
  it.each(IDLE)('stops at %s', (_what, world, error) => {
    const ran = run(world);
    expect(ran.out).toBeNull();
    expect(ran.error).toMatch(error);
  });

  it('says which names given by hand are of something no country here has, and goes on', () => {
    const ran = run({ ES: plain('ES') });
    expect(ran.error).toBe('');
    expect(ran.report).toMatch(/^currency: other names are given by hand to [A-Z ]+, which no country here has$/m);
    expect(ran.report).toMatch(/^language: other names are given by hand to [a-z ]+, which no country here has$/m);
    // The one this world does have is not among them.
    expect(/^language: other names .* to (.*), which/m.exec(ran.report)![1].split(' ')).not.toContain('es');
  });
});

describe('the dialling code and the domain of a country', () => {
  /** What GeoNames writes, and what is kept: the digits, in the groups they are said in. */
  const CODES: [said: string, kept: string[] | undefined][] = [
    ['34', ['34']],
    ['+1-268', ['1 268']],
    ['+1-809 and 1-829', ['1 809', '1 829']],
    [' 7 ', ['7']],
    ['', undefined],
  ];
  it.each(CODES)('reads the code «%s»', (said, kept) => {
    const ran = run({ ES: plain('ES', { geo: { tld: '.es', currency: 'EUR', phone: said } }) });
    expect(ran.error).toBe('');
    expect(ran.out!.c.ES.p).toEqual(kept);
  });

  it.each(['34a', '+', '12345', '1-2-3'])('stops at the code «%s», which it does not understand', (said) => {
    const ran = run({ ES: plain('ES', { geo: { tld: '.es', currency: 'EUR', phone: said } }) });
    expect(ran.error).toMatch(/El prefijo de ES no se entiende/);
  });

  it('gives Kosovo by hand the code GeoNames does not have, and stops the day it has one', () => {
    const ran = run({ XK: plain('XK', { geo: { tld: '', currency: 'EUR', phone: '' } }) });
    expect(ran.out!.c.XK).toEqual({ m: ['EUR'], l: ['es'], p: ['383'] });
    expect(notesOf(ran, 'XK')).toEqual(['XK dial: 383, by hand']);
    expect(run({ XK: plain('XK', { geo: { tld: '', currency: 'EUR', phone: '383' } }) }).error).toMatch(/GeoNames ya da un prefijo de XK \(«383»\): sobra el que está a mano/);
  });

  it('takes a domain of two or three letters after its dot, and stops at anything else', () => {
    expect(run({ ES: plain('ES', { geo: { tld: '.es', phone: '34' } }) }).out!.c.ES.d).toBe('.es');
    expect(run({ ES: plain('ES', { geo: { tld: '', phone: '34' } }) }).out!.c.ES.d).toBeUndefined();
    for (const said of ['es', '.e', '.ES', '.espa']) expect(run({ ES: plain('ES', { geo: { tld: said, phone: '34' } }) }).error).toMatch(/El dominio de ES no se entiende/);
  });

  it('gives neither to a country GeoNames does not have', () => {
    const ran = run({ ES: plain('ES', { geo: null }) });
    expect(ran.error).toBe('');
    expect(ran.out!.c.ES).toEqual({ m: ['EUR'], l: ['es'] });
  });

  it('lists in the report what several countries share: a question that shows it has more than one answer', () => {
    const ran = run({ US: plain('US', { geo: { tld: '.us', phone: '1' } }), CA: plain('CA', { geo: { tld: '.ca', phone: '1' } }), GP: plain('GP', { cl: 'dep', geo: { tld: '.gp', phone: '590' } }), MF: plain('MF', { cl: 'dep', geo: { tld: '.gp', phone: '590' } }) });
    expect(ran.report).toContain('Shared by several:\ndomain .gp: GP MF\ndial 1: US CA\ndial 590: GP MF\n');
  });
});
