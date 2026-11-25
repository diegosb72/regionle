/**
 * scripts/data/profiles.mjs, which makes the sheets of the countries, run on countries made up here: that
 * every country with a flag gets one with what Wikidata and Wikipedia say of it, what a correction by hand
 * does to that, and what is laid over both where somebody wrote of the country — what it takes from what
 * is written and what from Commons, the pictures it makes of each photograph — and what it refuses: a
 * photograph nobody asked Commons about, one that is not free to show, a text in one language only, a time
 * whose flag the game does not have, a correction that leaves a sheet saying what it should not.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ProfileFile, ProfilePhoto, ProfileTime } from './profiles';

/** A sheet written by hand, as the script leaves it: with its times and its photographs. */
type Written = ProfileFile & { times: ProfileTime[]; photos: ProfilePhoto[] };

// Every test runs the script, which draws pictures: seconds on a machine that is doing other things.
vi.setConfig({ testTimeout: 30_000 });

const SCRIPT = path.join(__dirname, '../../scripts/data/profiles.mjs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'profiles-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

const sha1 = (text: string) => createHash('sha1').update(text).digest('hex');
/** What Commons says of a photograph, and how wide the picture of it that was brought is. */
interface Brought {
  width?: number;
  height?: number;
  licence?: string;
  licenceUrl?: string;
  artist?: string;
  attribution?: boolean;
  /** Its entry says where its picture is, and the picture did not come. */
  lost?: boolean;
  /** Commons has no such file. */
  missing?: boolean;
}
const COMMONS: Record<string, Brought> = {
  'Head.jpg': { width: 1920, height: 960, licence: 'CC BY-SA 4.0', licenceUrl: 'http://creativecommons.org/licenses/by-sa/4.0', artist: 'Ana Pérez', attribution: true },
  'Falls.jpg': { width: 1920, height: 1280, licence: 'CC0', licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  'Small.jpg': { width: 500, height: 400, licence: 'CC BY 2.0', licenceUrl: 'https://creativecommons.org/licenses/by/2.0', artist: 'Somebody who tells at length how the picture was made', attribution: true },
  'Painting.jpg': { width: 1920, height: 1100, licence: 'Public domain', artist: 'A painter' },
  'Mine.jpg': { width: 1920, height: 1280, licence: 'All rights reserved', artist: 'Somebody' },
  'Nobody.jpg': { width: 1920, height: 1280, licence: 'CC BY 4.0', attribution: true },
  'Lost.jpg': { width: 1920, height: 1280, licence: 'CC0', lost: true },
  'Gone.jpg': { missing: true },
};

/**
 * What Wikidata and Wikipedia say of the three, as the workflow brings it: of AA its motto and its anthem
 * and a flag whose day the two do not agree on; of BB nothing; of CC everything, in the box of each page.
 */
const SAID = {
  items: {
    AA: { wd: 'Q1', official: [['aa', 'Aa-land wd']], motto: [['la', 'Semper Aa']], anthem: ['Q11'], flag: ['Q12'], pages: { es: 'Aa', en: 'Aa' } },
    BB: { wd: 'Q2', pages: {} },
    CC: { wd: 'Q3', official: [['fr', 'République de Cc']], anthem: ['Q31', 'Q11'], flag: ['Q32'], pages: { es: 'Cc (país)', en: 'Cc' } },
  },
  flags: {
    Q12: { since: [['1949-12-31', 11]], ratio: ['Q21'], colours: ['Q41', 'Q42'], pages: { es: 'Bandera de Aa', en: 'Flag of Aa' } },
    Q32: { since: [['1960-08-07', 11]], ratio: ['Q22'], colours: ['Q42', 'Q41', 'Q43'], by: ['Q51'], pages: { es: 'Bandera de Cc', en: 'Flag of Cc' } },
  },
  names: {
    Q11: { es: 'Himno de todos', en: 'Anthem of all' },
    Q31: { es: 'la Ccesa', en: 'The Ccaise' },
    Q21: { en: '3:2' },
    Q22: { en: '2:1', es: '2:1' },
    Q41: { es: 'rojo', en: 'red' },
    Q42: { es: 'blanco', en: 'white' },
    Q43: { es: 'oro', en: 'gold' },
    Q51: { es: 'Ana Diseño', en: 'Ana Diseño' },
  },
  boxes: {
    'es:Aa': "{{Ficha de país\n| nombre_oficial = República de Aa (cajas)\n| lema_nacional = ''Semper Aa''<br />(en [[latín]]: «Siempre Aa»)\n}}",
    'en:Aa': '{{Infobox country\n| conventional_long_name = Republic of Aa\n| national_motto = {{lang|la|Semper Aa}}<br />"Always Aa"\n}}',
    'es:Bandera de Aa': '{{Ficha de bandera\n| adopción = 2 de enero de 1950\n| proporción = 2:3\n}}',
    'en:Flag of Aa': '{{Infobox flag\n| adoption = {{start date and age|1950|1|2}}\n| proportion = 2:3\n}}',
    'es:Cc (país)': "{{Ficha de país\n| nombre_oficial = República de Cc<ref>La ley.</ref>\n| lema_nacional = ''Unité, Travail''<br />(en [[Idioma francés|francés]]: «Unidad, Trabajo»)\n}}",
    'en:Cc': "{{Infobox country\n| conventional_long_name = Republic of Cc\n| native_name = {{native name|fr|République de Cc}}\n| national_motto = \"Unité, Travail\"<br />\"Unity, Work\"\n}}",
    'es:Bandera de Cc': '{{Ficha de bandera\n| adopción = {{fecha|7|8|1960}}\n| proporción = 1:2\n}}',
    'en:Flag of Cc': '{{Infobox flag\n| adoption = 7 August 1960\n| proportion = 1:2\n| designer = Somebody else\n}}',
  },
};

let brought = '';
let data = '';
beforeAll(async () => {
  brought = path.join(TMP, 'brought');
  data = path.join(TMP, 'data');
  fs.mkdirSync(brought);
  fs.mkdirSync(data);
  const files: Record<string, unknown> = {};
  for (const [title, one] of Object.entries(COMMONS)) {
    if (one.missing) {
      files[title] = { missing: true };
      continue;
    }
    const name = `${sha1(title)}.1920.jpg`;
    files[title] = { sha1: sha1(title), licence: one.licence, ...(one.licenceUrl ? { licenceUrl: one.licenceUrl } : {}), ...(one.artist ? { artist: one.artist } : {}), ...(one.attribution ? { attribution: true } : {}), picture: `photos/files/${name}` };
    if (!one.lost) await sharp({ create: { width: one.width!, height: one.height!, channels: 3, background: { r: 30, g: 120, b: 90 } } }).jpeg().toFile(path.join(brought, name));
  }
  fs.writeFileSync(path.join(brought, 'photos.json'), JSON.stringify({ files }));
  // Three countries with a flag — of the first two somebody may write by hand — and a patch of ice with none.
  fs.writeFileSync(path.join(data, 'index.json'), JSON.stringify({ countries: [{ id: 'AA', fl: 'aa' }, { id: 'BB', fl: 'bb' }, { id: 'CC', fl: 'cc' }, { id: 'X1' }] }));
  fs.writeFileSync(path.join(data, 'facts.json'), JSON.stringify({ c: { AA: { l: ['aa'] }, CC: { l: ['fr', 'en'] } }, l: { fr: ['francés', 'French'], la: ['latín', 'Latin'] } }));
  fs.writeFileSync(path.join(TMP, 'said.json'), JSON.stringify(SAID));
  // Nothing of how Wikipedia begins to tell of them, unless a test says otherwise.
  fs.writeFileSync(path.join(TMP, 'texts.json'), JSON.stringify({ pages: {} }));
  fs.writeFileSync(
    path.join(data, 'flags.json'),
    JSON.stringify({ regions: {}, capitals: [], gone: [['Q9', 'Reino de Aa', 'Kingdom of Aa', '0000000001.svg', 1.5, 1800, 1900]], past: { AA: [['0000000002.svg', 1.5, 1900, 1950]], BB: [['0000000003.svg', 1.5, 1700, 1750]] } }),
  );
});

const both = (text: string) => ({ es: `${text}.`, en: `${text} (en).` });
/** A sheet as it is written by hand, with everything it has to have. */
const SHEET = () => ({
  id: 'AA',
  official: { es: ' República de Aa ', en: 'Republic of Aa' },
  local: 'Aa-land',
  localLang: 'aa',
  about: { es: ['Uno.', 'Dos.'], en: ['One.', 'Two.'] },
  flag: {
    adopted: '1950-01-02',
    changed: '1990-03-04',
    ratio: '2:3',
    called: both('La roja'),
    by: both('Alguien'),
    text: { es: ['De la bandera.'], en: ['Of the flag.'] },
    parts: [{ es: ['El rojo', 'Es rojo.'], en: ['The red', 'It is red.'] }],
  },
  times: [
    { gone: 'Q9', from: 1800, to: 1900, name: both('Reino'), text: both('Era un reino'), picture: { file: 'Painting.jpg', ...both('Un cuadro') } },
    { past: [1900, 1950], from: 1900, to: 1950, when: both('Medio siglo'), name: both('La de antes'), text: both('Antes') },
    { now: true, from: 1950, name: both('La de hoy'), text: both('Hoy') },
  ] as Record<string, unknown>[],
  photos: [
    { file: 'Head.jpg', focus: [50, 20], ...both('La capital') },
    { file: 'Falls.jpg', ...both('Unas cataratas') },
    { file: 'Small.jpg', by: 'Somebody', ...both('Una foto pequeña') },
  ] as Record<string, unknown>[],
  read: { es: 'https://es.wikipedia.org/wiki/Aa', en: 'https://en.wikipedia.org/wiki/Aa' },
});

let n = 0;
/**
 * Runs the script on the sheets that are given, each under the name of its file. `fixes` are the corrections
 * by hand, `said` what the sources say when it is not what they say above (`null`: nothing was brought),
 * `texts` how Wikipedia begins each page, by `language:title` (`null`: nothing was brought), `heads` the
 * photograph chosen for the head of the sheet of each country, and `flags` what else the script is told.
 */
function run(
  sheets: Record<string, unknown>,
  opts: {
    before?: (dirs: { data: string; photos: string }) => void;
    fixes?: Record<string, unknown>;
    said?: unknown;
    texts?: Record<string, string> | null;
    heads?: Record<string, unknown>;
    flags?: string[];
  } = {},
) {
  const dir = path.join(TMP, `run-${++n}`);
  const [written, mine, photos] = [path.join(dir, 'sheets'), path.join(dir, 'data'), path.join(dir, 'photos')];
  fs.mkdirSync(written, { recursive: true });
  fs.cpSync(data, mine, { recursive: true });
  for (const [name, sheet] of Object.entries(sheets)) fs.writeFileSync(path.join(written, `${name}.json`), JSON.stringify(sheet));
  const fixes = path.join(dir, 'fixes.json');
  if (opts.fixes) fs.writeFileSync(fixes, JSON.stringify({ _: 'Why this file is here.', ...opts.fixes }));
  let said = path.join(TMP, 'said.json');
  if (opts.said !== undefined) {
    said = path.join(dir, 'said.json');
    if (opts.said !== null) fs.writeFileSync(said, JSON.stringify(opts.said));
  }
  let texts = path.join(TMP, 'texts.json');
  if (opts.texts !== undefined) {
    texts = path.join(dir, 'texts.json');
    if (opts.texts !== null) fs.writeFileSync(texts, JSON.stringify({ pages: Object.fromEntries(Object.entries(opts.texts).map(([page, text], i) => [page, { rev: 100 + i, text }])) }));
  }
  // Never the photographs chosen for the countries of the game: those of the test, or none.
  const heads = path.join(dir, 'heads.json');
  if (opts.heads) fs.writeFileSync(heads, JSON.stringify({ _: 'What this file is.', ...opts.heads }));
  opts.before?.({ data: mine, photos });
  let out = '';
  let code = 0;
  try {
    out = execFileSync('node', [SCRIPT, '--sheets', written, '--brought', brought, '--said', said, '--texts', texts, '--fixes', fixes, '--heads', heads, '--data', mine, '--photos', photos, ...(opts.flags ?? [])], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    const failed = err as { status?: number; stderr?: string; stdout?: string };
    code = failed.status ?? 1;
    out = `${failed.stdout ?? ''}${failed.stderr ?? ''}`;
  }
  const pictures = () => (fs.existsSync(photos) ? fs.readdirSync(photos).sort() : []);
  const sheet = (id: string) => JSON.parse(fs.readFileSync(path.join(mine, 'profiles', `${id}.json`), 'utf8')) as Written;
  const files = () => (fs.existsSync(path.join(mine, 'profiles')) ? fs.readdirSync(path.join(mine, 'profiles')).sort() : []);
  return { code, out, pictures, sheet, written: files, photos };
}
/** Every country with a flag has a sheet, whoever was written of. */
const ALL = ['AA.json', 'BB.json', 'CC.json'];
/** What goes wrong when a sheet is changed so: the script stops, says why and writes no sheet. */
function refused(change: (sheet: ReturnType<typeof SHEET>) => void): string {
  const sheet = SHEET();
  change(sheet);
  const r = run({ AA: sheet });
  expect(r.code).not.toBe(0);
  expect(r.written()).toEqual([]);
  return r.out;
}
const name = (title: string) => sha1(title).slice(0, 10);

describe('the sheet of a country, as the script makes it', () => {
  it('says what was written by hand, with the spaces at the ends taken off', () => {
    const r = run({ AA: SHEET() });
    expect(r.code).toBe(0);
    const sheet = r.sheet('AA');
    expect(sheet).toMatchObject({
      v: 1,
      id: 'AA',
      official: { es: 'República de Aa', en: 'Republic of Aa' },
      local: 'Aa-land',
      localLang: 'aa',
      about: { es: ['Uno.', 'Dos.'], en: ['One.', 'Two.'] },
      flag: { adopted: '1950-01-02', changed: '1990-03-04', ratio: '2:3', called: both('La roja'), by: both('Alguien'), text: { es: ['De la bandera.'], en: ['Of the flag.'] }, parts: [{ es: ['El rojo', 'Es rojo.'], en: ['The red', 'It is red.'] }] },
      read: { es: 'https://es.wikipedia.org/wiki/Aa', en: 'https://en.wikipedia.org/wiki/Aa' },
    });
    expect(sheet.times.map(({ picture, ...time }) => time)).toEqual([
      { gone: 'Q9', from: 1800, to: 1900, name: both('Reino'), text: both('Era un reino') },
      { past: [1900, 1950], from: 1900, to: 1950, when: both('Medio siglo'), name: both('La de antes'), text: both('Antes') },
      { now: true, from: 1950, name: both('La de hoy'), text: both('Hoy') },
    ]);
    expect(r.written()).toEqual(ALL);
    expect(r.out).toContain('AA: escrita a mano');
  });

  it('shows each photograph with whose it is, as Commons says, and at the widths of where it goes', () => {
    const r = run({ AA: SHEET() });
    const sheet = r.sheet('AA');
    // The one at the head: every width; with its author, its licence and where that is written, by a safe address.
    expect(sheet.photos[0]).toEqual({ file: name('Head.jpg'), w: 1920, h: 960, sizes: [640, 1280, 1920], title: 'Head.jpg', by: 'Ana Pérez', licence: 'CC BY-SA 4.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0', ...both('La capital'), focus: [50, 20] });
    // One of the gallery: two widths. Nobody is named where Commons names nobody and the licence asks for none.
    expect(sheet.photos[1]).toEqual({ file: name('Falls.jpg'), w: 1920, h: 1280, sizes: [640, 1280], title: 'Falls.jpg', licence: 'CC0', licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', ...both('Unas cataratas') });
    // One narrower than any width is kept as wide as it came, and no wider; its author is the one the sheet names.
    expect(sheet.photos[2]).toMatchObject({ file: name('Small.jpg'), w: 500, h: 400, sizes: [500], by: 'Somebody', licence: 'CC BY 2.0' });
    // That of a time: one width, and no address for terms that have none.
    expect(sheet.times[0].picture).toEqual({ file: name('Painting.jpg'), w: 1920, h: 1100, sizes: [640], title: 'Painting.jpg', by: 'A painter', licence: 'Public domain', ...both('Un cuadro') });
    expect(sheet.times[1].picture).toBeUndefined();
    expect(r.pictures()).toEqual(
      [`${name('Head.jpg')}-640.webp`, `${name('Head.jpg')}-1280.webp`, `${name('Head.jpg')}-1920.webp`, `${name('Falls.jpg')}-640.webp`, `${name('Falls.jpg')}-1280.webp`, `${name('Small.jpg')}-500.webp`, `${name('Painting.jpg')}-640.webp`].sort(),
    );
  });

  it('draws each picture as wide as it says, in the shape of the photograph', async () => {
    const r = run({ AA: SHEET() });
    for (const [file, w, h] of [
      [`${name('Head.jpg')}-640.webp`, 640, 320],
      [`${name('Head.jpg')}-1920.webp`, 1920, 960],
      [`${name('Falls.jpg')}-1280.webp`, 1280, 853],
      [`${name('Small.jpg')}-500.webp`, 500, 400],
    ] as const) {
      const meta = await sharp(path.join(r.photos, file)).metadata();
      expect([meta.format, meta.width, meta.height], file).toEqual(['webp', w, h]);
    }
  });

  it('keeps nothing of what no sheet shows any more: neither a picture nor a sheet', () => {
    const r = run(
      { AA: SHEET() },
      {
        before: ({ data: mine, photos }) => {
          fs.mkdirSync(photos, { recursive: true });
          fs.mkdirSync(path.join(mine, 'profiles'), { recursive: true });
          fs.writeFileSync(path.join(photos, 'ffffffffff-640.webp'), 'old');
          fs.writeFileSync(path.join(mine, 'profiles', 'ZZ.json'), '{}');
        },
      },
    );
    expect(r.code).toBe(0);
    expect(r.pictures()).not.toContain('ffffffffff-640.webp');
    expect(r.written()).toEqual(ALL);
  });

  it('lays what is written over the sheet of each country that has it, and makes a photograph that two show once', () => {
    const other = { ...SHEET(), id: 'BB', times: [{ past: [1700, 1750], from: 1700, to: 1750, name: both('Vieja'), text: both('Vieja') }, { now: true, from: 1750, name: both('Hoy'), text: both('Hoy') }], photos: [{ file: 'Falls.jpg', ...both('Las mismas cataratas') }] };
    const r = run({ AA: SHEET(), BB: other });
    expect(r.code).toBe(0);
    expect(r.written()).toEqual(ALL);
    // At the head of the second it is wanted wider than in the gallery of the first: every width is there, each once.
    expect(r.sheet('BB').photos[0]).toMatchObject({ file: name('Falls.jpg'), sizes: [640, 1280, 1920], es: 'Las mismas cataratas.' });
    expect(r.pictures().filter((file) => file.startsWith(name('Falls.jpg')))).toEqual([`${name('Falls.jpg')}-1280.webp`, `${name('Falls.jpg')}-1920.webp`, `${name('Falls.jpg')}-640.webp`]);
  });
});

describe('the sheet of a country nobody has written of', () => {
  it('is made all the same, of what Wikidata and Wikipedia say of it', () => {
    const r = run({});
    expect(r.code).toBe(0);
    // One for every country with a flag, and none for what has no flag to open it by.
    expect(r.written()).toEqual(ALL);
    expect(r.sheet('CC')).toEqual({
      v: 1,
      id: 'CC',
      official: { es: 'República de Cc', en: 'Republic of Cc' },
      local: 'République de Cc',
      localLang: 'fr',
      motto: { text: 'Unité, Travail', lang: 'fr', es: 'Unidad, Trabajo', en: 'Unity, Work' },
      // Its own before the one it shares with another, each with the capital of a name.
      anthem: { es: 'La Ccesa · Himno de todos', en: 'The Ccaise · Anthem of all' },
      // Wikidata says width to height; the sheet, like the boxes, height to width. Gold is told as yellow.
      flag: { adopted: '1960-08-07', ratio: '1:2', colours: { es: ['rojo', 'amarillo', 'blanco'], en: ['red', 'yellow', 'white'] }, by: { es: 'Ana Diseño', en: 'Ana Diseño' } },
      read: { es: 'https://es.wikipedia.org/wiki/Cc_(pa%C3%ADs)', en: 'https://en.wikipedia.org/wiki/Cc' },
      readFlag: { es: 'https://es.wikipedia.org/wiki/Bandera_de_Cc', en: 'https://en.wikipedia.org/wiki/Flag_of_Cc' },
    });
    // No texts, no times and no photographs: nobody wrote them.
    expect(r.pictures()).toEqual([]);
    // Of what nothing is said, a sheet with nothing but whose it is: the game shows it with what it knows.
    expect(r.sheet('BB')).toEqual({ v: 1, id: 'BB' });
    expect(r.out).toMatch(/3 fichas .*0 escritas a mano; nombre oficial en 2, lema en 2, himno en 2, fecha de la bandera en 2, proporción en 2; texto de Wikipedia del país en 0 y de la bandera en 0/);
  });

  it('takes the day both boxes give when Wikidata gives another, and tells whoever reviews it', () => {
    const r = run({}, { flags: ['--review'] });
    // Wikidata: 31 December 1949. Both Wikipedias: 2 January 1950.
    expect(r.sheet('AA').flag).toMatchObject({ adopted: '1950-01-02', ratio: '2:3', colours: { es: ['rojo', 'blanco'], en: ['red', 'white'] } });
    expect(r.out).toContain('AA: adopted: Wikidata 1949-12-31, en [1950-01-02], es [1950-01-02] → 1950-01-02');
    // Without being asked, nothing of it is said.
    expect(run({}).out).not.toContain('adopted:');
  });

  it('is corrected by hand: what is written replaces what was read, and null takes it away', () => {
    const r = run({}, { fixes: { CC: { motto: null, official: { es: 'Cc' }, flag: { adopted: '1961', by: null }, anthem: { es: 'La Ccesa' } }, BB: { official: { es: 'Reino de Bb', en: 'Kingdom of Bb' } } }, flags: ['--review'] });
    expect(r.code).toBe(0);
    const sheet = r.sheet('CC');
    expect(sheet.motto).toBeUndefined();
    // Only what is named changes: the name in English, the proportions and the colours stay as they were read.
    expect(sheet.official).toEqual({ es: 'Cc', en: 'Republic of Cc' });
    expect(sheet.anthem).toEqual({ es: 'La Ccesa', en: 'The Ccaise · Anthem of all' });
    expect(sheet.flag).toEqual({ adopted: '1961', ratio: '1:2', colours: { es: ['rojo', 'amarillo', 'blanco'], en: ['red', 'yellow', 'white'] } });
    // A country nothing was read of can be told by hand too.
    expect(r.sheet('BB')).toEqual({ v: 1, id: 'BB', official: { es: 'Reino de Bb', en: 'Kingdom of Bb' } });
    expect(r.out).toContain('2 países con correcciones a mano');
    expect(r.out).toContain('AA: adopted');
  });

  it('says of the flag of a territory that flies that of its country what that country says of it', () => {
    const r = run({}, { fixes: { BB: { flag: { of: 'CC', adopted: '1999' } }, CC: { flag: { adopted: '1961' } } } });
    expect(r.code).toBe(0);
    // Whose it is, and what is said of that flag after its own corrections; nothing of what was said of another.
    expect(r.sheet('BB')).toEqual({
      v: 1,
      id: 'BB',
      flag: { of: 'CC', adopted: '1961', ratio: '1:2', colours: { es: ['rojo', 'amarillo', 'blanco'], en: ['red', 'yellow', 'white'] }, by: { es: 'Ana Diseño', en: 'Ana Diseño' } },
      readFlag: { es: 'https://es.wikipedia.org/wiki/Bandera_de_Cc', en: 'https://en.wikipedia.org/wiki/Flag_of_Cc' },
    });
    expect(r.sheet('CC').flag?.of).toBeUndefined();
    // Of a flag written of by hand: its days and its proportions, not the texts of the sheet of that country.
    const hand = run({ AA: SHEET() }, { fixes: { BB: { flag: { of: 'AA' } } } });
    expect(hand.code).toBe(0);
    expect(hand.sheet('BB').flag).toEqual({ of: 'AA', adopted: '1950-01-02', changed: '1990-03-04', ratio: '2:3', by: both('Alguien') });
    expect(hand.sheet('BB').readFlag).toEqual({ es: 'https://es.wikipedia.org/wiki/Bandera_de_Aa', en: 'https://en.wikipedia.org/wiki/Flag_of_Aa' });
  });

  it('is not made of a flag said to be that of no country, of itself, or of one that flies that of another', () => {
    const wrong = (fixes: Record<string, unknown>, sheets: Record<string, unknown> = {}) => {
      const r = run(sheets, { fixes });
      expect(r.code).not.toBe(0);
      expect(r.written()).toEqual([]);
      return r.out;
    };
    expect(wrong({ BB: { flag: { of: 'ZZ' } } })).toContain('BB: its flag is said to be that of «ZZ», which is no other country of the game with a flag');
    expect(wrong({ BB: { flag: { of: 'X1' } } })).toContain('«X1», which is no other country');
    expect(wrong({ BB: { flag: { of: 'BB' } } })).toContain('«BB», which is no other country');
    expect(wrong({ BB: { flag: { of: 'CC' } }, CC: { flag: { of: 'AA' } } })).toContain('whose flag is that of another');
    expect(wrong({ AA: { flag: { of: 'CC' } } }, { AA: SHEET() })).toContain('AA: somebody wrote of its flag, which is said to be that of another country');
  });

  it('is not made of a correction of no country, nor of one that leaves it saying what it should not', () => {
    const wrong = (fixes: Record<string, unknown>) => {
      const r = run({}, { fixes });
      expect(r.code).not.toBe(0);
      expect(r.written()).toEqual([]);
      return r.out;
    };
    expect(wrong({ ZZ: { motto: null } })).toContain('corrects «ZZ», which is no country of the game with a flag');
    expect(wrong({ X1: { motto: null } })).toContain('corrects «X1»');
    expect(wrong({ CC: { flag: { ratio: '1,5' } } })).toContain('CC: the proportions of its flag are not two numbers: 1,5');
    expect(wrong({ CC: { flag: { adopted: 'ayer' } } })).toContain('CC: the day its flag was adopted on is not a day or a year: ayer');
    expect(wrong({ CC: { flag: { adopted: '1960-02-30' } } })).toContain('is not a day or a year');
    expect(wrong({ CC: { flag: { changed: '1950-01-01' } } })).toContain('which is not a day after the one it was adopted on');
    expect(wrong({ BB: { flag: { changed: '1950-01-01' } } })).toContain('BB: its flag is said to be as it is since');
    expect(wrong({ CC: { official: { fr: 'République' } } })).toContain('CC: its official name is not a text in a language of the game');
    expect(wrong({ CC: { official: { es: ' Cc ' } } })).toContain('its official name');
    expect(wrong({ CC: { motto: { text: '' } } })).toContain('CC: its motto has no words');
    expect(wrong({ CC: { motto: { lang: 'French' } } })).toContain('the language of its motto');
    expect(wrong({ CC: { localLang: 'francés' } })).toContain('does not say which language');
    expect(wrong({ BB: { localLang: 'fr' } })).toContain('BB: it names a language of its own and no name in it');
    expect(wrong({ CC: { read: { es: 'https://example.com/Cc' } } })).toContain('«read» is not a page of the Wikipedia of each language');
    expect(wrong({ CC: { flag: { colours: { es: ['rojo'], en: ['red'] } } } })).toContain('the colours of its flag');
  });

  it('is not made when what the sources say was not brought', () => {
    const r = run({}, { said: null });
    expect(r.code).not.toBe(0);
    expect(r.out).toContain('npm run data:fetch -- countries-said');
    expect(r.written()).toEqual([]);
  });
});

describe('the photograph chosen for the head of the sheet of a country nobody has written of', () => {
  const HEAD = () => ({ file: ' Falls.jpg ', focus: [50, 30], ...both('Unas cataratas') });

  it('is at the head of its sheet, with what is seen in it and whose it is, and not as wide as that of a sheet written by hand', () => {
    const r = run({ AA: SHEET() }, { heads: { CC: HEAD() } });
    expect(r.code).toBe(0);
    const name = sha1('Falls.jpg').slice(0, 10);
    expect(r.sheet('CC').photos).toEqual([
      { file: name, w: 1920, h: 1280, sizes: [640, 1280], title: 'Falls.jpg', licence: 'CC0', licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', es: 'Unas cataratas.', en: 'Unas cataratas (en).', focus: [50, 30] },
    ]);
    // It is the only thing somebody chose for that sheet: no text of its own, no times.
    const sheet = r.sheet('CC') as unknown as Record<string, unknown>;
    expect(sheet.about).toBeUndefined();
    expect(sheet.times).toBeUndefined();
    // The same photograph is in the gallery of the sheet written by hand, where it is no wider: each picture is made once.
    expect(r.pictures().filter((file) => file.startsWith(name))).toEqual([`${name}-1280.webp`, `${name}-640.webp`]);
    expect(r.out).toContain('fotografía de cabecera elegida en 1;');
    // The one at the head of the sheet written by hand is kept wider.
    expect(r.pictures()).toContain(`${sha1('Head.jpg').slice(0, 10)}-1920.webp`);
  });

  it('is not used for a country whose sheet is written by hand, which names its own', () => {
    const r = run({ AA: SHEET() }, { heads: { AA: { file: 'Painting.jpg', ...both('Un cuadro') }, BB: { file: 'Painting.jpg', ...both('Un cuadro') } } });
    expect(r.code).toBe(0);
    expect(r.sheet('AA').photos.map((photo) => photo.title)).toEqual(['Head.jpg', 'Falls.jpg', 'Small.jpg']);
    expect(r.sheet('BB').photos.map((photo) => photo.title)).toEqual(['Painting.jpg']);
    expect(r.out).toContain('fotografía de cabecera elegida en 1;');
  });

  it('is none where none was chosen, and the pictures no sheet shows any more are not kept', () => {
    const r = run({}, {
      heads: { CC: HEAD() },
      before: ({ photos }) => {
        fs.mkdirSync(photos, { recursive: true });
        fs.writeFileSync(path.join(photos, '0000000000-640.webp'), 'old');
      },
    });
    expect(r.code).toBe(0);
    expect((r.sheet('BB') as unknown as Record<string, unknown>).photos).toBeUndefined();
    expect(r.pictures()).toEqual([`${sha1('Falls.jpg').slice(0, 10)}-1280.webp`, `${sha1('Falls.jpg').slice(0, 10)}-640.webp`]);
  });

  it('is not made again when its pictures are there: each is named after what it is made from and how wide it is', () => {
    const name = sha1('Falls.jpg').slice(0, 10);
    const r = run({}, {
      heads: { CC: HEAD() },
      before: ({ photos }) => {
        fs.mkdirSync(photos, { recursive: true });
        fs.writeFileSync(path.join(photos, `${name}-640.webp`), 'made before');
      },
    });
    expect(r.code).toBe(0);
    expect(fs.readFileSync(path.join(r.photos, `${name}-640.webp`), 'utf8')).toBe('made before');
    expect(fs.statSync(path.join(r.photos, `${name}-1280.webp`)).size).toBeGreaterThan(100);
  });

  it('has to be one that can be shown: of a country of the game, brought, free, and with what is seen in it in both languages', () => {
    const failed = (heads: Record<string, unknown>) => {
      const r = run({}, { heads });
      expect(r.code).not.toBe(0);
      expect(r.written()).toEqual([]);
      return r.out;
    };
    expect(failed({ ZZ: HEAD() })).toContain('chooses a photograph for «ZZ», which is no country of the game with a flag');
    expect(failed({ CC: { file: 'Falls.jpg', es: 'Unas cataratas' } })).toContain('CC: the photograph «Falls.jpg» has no text in «en»');
    expect(failed({ CC: { ...both('Nada') } })).toContain('CC: a photograph names no file');
    expect(failed({ CC: { file: 'Gone.jpg', ...both('Nada') } })).toContain('Commons was not asked about «Gone.jpg»');
    expect(failed({ CC: { file: 'Lost.jpg', ...both('Nada') } })).toContain('the picture of «Lost.jpg» is not among what was brought');
    expect(failed({ CC: { file: 'Mine.jpg', ...both('Nada') } })).toContain('«Mine.jpg» is given on terms that are not known to be free');
    expect(failed({ CC: { file: 'Nobody.jpg', ...both('Nada') } })).toContain('«Nobody.jpg» has to be attributed and Commons names nobody');
  });
});

describe('how Wikipedia begins to tell of a country and of its flag', () => {
  /** A text longer than a sheet shows: sentences of some sixty characters, each with its number. */
  const long = (what: string, n: number) => Array.from({ length: n }, (_, i) => `${what} tiene una frase número ${i + 1} que dice algo de ella.`).join(' ');
  const TEXTS = {
    'es:Cc (país)': 'Cc (en francés: République de Cc\u200e, AFI: [se.se]), oficialmente República de Cc,\u200b es un país.[1] Tiene dos islas.\nOtro párrafo, que ya no cabe aquí.',
    'en:Cc': 'Cc (French: République de Cc), officially the Republic of Cc, is a country. It has two islands.',
    'es:Bandera de Cc': 'La bandera de Cc es roja, amarilla y blanca. Fue adoptada en 1960.',
    'es:Aa': 'Aa es un país del que alguien ha escrito a mano.',
    'es:Bandera de Aa': 'La bandera de Aa es roja y blanca desde 1950.',
  };

  it('is told in the sheet of whom nobody has written of, shortened, in each language whose page was brought', () => {
    const r = run({}, { texts: TEXTS });
    expect(r.code).toBe(0);
    const sheet = r.sheet('CC');
    // The brackets that say how it is called elsewhere, the place of a note and the marks that are not seen are gone.
    expect(sheet.lead).toEqual({ es: ['Cc, oficialmente República de Cc, es un país. Tiene dos islas.', 'Otro párrafo, que ya no cabe aquí.'], en: ['Cc, officially the Republic of Cc, is a country. It has two islands.'] });
    // Of its flag, the page in Spanish was brought and the one in English was not.
    expect(sheet.flag?.lead).toEqual({ es: ['La bandera de Cc es roja, amarilla y blanca. Fue adoptada en 1960.'] });
    // What else the sheet says is what it said.
    expect(sheet.flag).toMatchObject({ adopted: '1960-08-07', ratio: '1:2' });
    expect(sheet.read).toEqual({ es: 'https://es.wikipedia.org/wiki/Cc_(pa%C3%ADs)', en: 'https://en.wikipedia.org/wiki/Cc' });
    // A country the sheet leads to no page of has nothing to tell.
    expect(r.sheet('BB')).toEqual({ v: 1, id: 'BB' });
    expect(r.out).toMatch(/texto de Wikipedia del país en 2 y de la bandera en 2/);
  });

  it('is cut after as many whole sentences as fit: more of the country than of its flag', () => {
    const r = run({}, { texts: { 'es:Cc (país)': long('La república', 30), 'es:Bandera de Cc': long('La bandera', 30) } });
    const [about, flag] = [r.sheet('CC').lead!.es!, r.sheet('CC').flag!.lead!.es!];
    expect(about).toHaveLength(1);
    expect(flag).toHaveLength(1);
    expect(about[0].length).toBeLessThanOrEqual(640);
    expect(about[0].length).toBeGreaterThan(560);
    expect(flag[0].length).toBeLessThanOrEqual(480);
    expect(flag[0].length).toBeGreaterThan(400);
    for (const text of [about[0], flag[0]]) expect(text).toMatch(/^La (república|bandera) tiene una frase número 1 .* que dice algo de ella\.$/);
  });

  it('is not told where somebody has written: of the country, of its flag, or of both', () => {
    const r = run({ AA: SHEET() }, { texts: TEXTS });
    expect(r.code).toBe(0);
    const sheet = r.sheet('AA');
    expect(sheet.about).toEqual({ es: ['Uno.', 'Dos.'], en: ['One.', 'Two.'] });
    expect(sheet.lead).toBeUndefined();
    expect(sheet.flag?.text).toEqual({ es: ['De la bandera.'], en: ['Of the flag.'] });
    expect(sheet.flag?.lead).toBeUndefined();
    // With nobody having written of it, it is.
    const plain = run({}, { texts: TEXTS }).sheet('AA');
    expect(plain.lead).toEqual({ es: ['Aa es un país del que alguien ha escrito a mano.'] });
    expect(plain.flag?.lead).toEqual({ es: ['La bandera de Aa es roja y blanca desde 1950.'] });
  });

  it('is, of the flag of a territory that flies that of its country, what is told of that flag', () => {
    const r = run({}, { texts: TEXTS, fixes: { BB: { flag: { of: 'CC' } } } });
    expect(r.code).toBe(0);
    expect(r.sheet('BB').flag?.lead).toEqual({ es: ['La bandera de Cc es roja, amarilla y blanca. Fue adoptada en 1960.'] });
    expect(r.sheet('BB').flag?.of).toBe('CC');
    // Of the territory itself there is no page: nothing is told.
    expect(r.sheet('BB').lead).toBeUndefined();
  });

  it('is cut where whoever read it says, or not shown: and what is said of it is no part of the sheet', () => {
    const r = run({}, { texts: TEXTS, fixes: { CC: { leads: { about: { es: 1, en: false }, flag: { es: false } }, motto: null }, BB: { flag: { of: 'CC' } } } });
    expect(r.code).toBe(0);
    const sheet = r.sheet('CC') as unknown as Record<string, unknown> & Written;
    expect(sheet.lead).toEqual({ es: ['Cc, oficialmente República de Cc, es un país.'] });
    expect(sheet.flag?.lead).toBeUndefined();
    expect(sheet.leads).toBeUndefined();
    // The rest of the corrections is laid as it was.
    expect(sheet.motto).toBeUndefined();
    expect(sheet.official).toEqual({ es: 'República de Cc', en: 'Republic of Cc' });
    // What was said of the flag holds for whoever flies it.
    expect(r.sheet('BB').flag?.lead).toBeUndefined();
    // More sentences than it would keep by itself can be asked for too.
    const more = run({}, { texts: { 'es:Cc (país)': long('La república', 30) }, fixes: { CC: { leads: { about: { es: 12 } } } } });
    expect(more.sheet('CC').lead!.es![0]).toMatch(/frase número 12 que dice algo de ella\.$/);
  });

  it('is not made a sheet of when it was not brought', () => {
    const r = run({}, { texts: null });
    expect(r.code).not.toBe(0);
    expect(r.out).toContain('npm run data:fetch -- countries-texts');
    expect(r.written()).toEqual([]);
  });
});

describe('what is written by hand, over what the sources say', () => {
  it('is what the sheet says; what nobody wrote stays as it was read', () => {
    const r = run({ AA: SHEET() });
    const sheet = r.sheet('AA');
    // Written: the name, the days of the flag, its proportions.
    expect(sheet.official).toEqual({ es: 'República de Aa', en: 'Republic of Aa' });
    expect(sheet.local).toBe('Aa-land');
    expect(sheet.flag).toMatchObject({ adopted: '1950-01-02', changed: '1990-03-04', ratio: '2:3', by: both('Alguien') });
    // Read: the motto, the anthem and where to read of the flag.
    expect(sheet.motto).toEqual({ text: 'Semper Aa', lang: 'la', es: 'Siempre Aa', en: 'Always Aa' });
    expect(sheet.anthem).toEqual({ es: 'Himno de todos', en: 'Anthem of all' });
    expect(sheet.readFlag).toEqual({ es: 'https://es.wikipedia.org/wiki/Bandera_de_Aa', en: 'https://en.wikipedia.org/wiki/Flag_of_Aa' });
    // Whoever wrote of the flag told its colours in words: the list of them is not said besides.
    expect(sheet.flag?.colours).toBeUndefined();
  });

  it('is corrected like the rest in what nobody wrote, and not in what somebody did', () => {
    const r = run({ AA: SHEET() }, { fixes: { AA: { motto: null, official: { es: 'Otra cosa' }, anthem: { es: 'Aa, Aa' } } } });
    const sheet = r.sheet('AA');
    expect(sheet.motto).toBeUndefined();
    expect(sheet.anthem).toEqual({ es: 'Aa, Aa', en: 'Anthem of all' });
    expect(sheet.official).toEqual({ es: 'República de Aa', en: 'Republic of Aa' });
  });

  it('needs what Commons says of its photographs; a run with nothing written does not', () => {
    const gone = (dirs: { data: string }) => void dirs;
    const without = path.join(TMP, 'no-photos');
    fs.mkdirSync(without, { recursive: true });
    const args = (sheets: string) => [SCRIPT, '--sheets', sheets, '--brought', without, '--said', path.join(TMP, 'said.json'), '--texts', path.join(TMP, 'texts.json'), '--fixes', path.join(TMP, 'none.json'), '--heads', path.join(TMP, 'none-heads.json'), '--data', path.join(TMP, 'data-np'), '--photos', path.join(TMP, 'photos-np')];
    fs.cpSync(data, path.join(TMP, 'data-np'), { recursive: true });
    const empty = path.join(TMP, 'sheets-none');
    fs.mkdirSync(empty, { recursive: true });
    expect(() => execFileSync('node', args(empty), { stdio: 'pipe' })).not.toThrow();
    const some = path.join(TMP, 'sheets-some');
    fs.mkdirSync(some, { recursive: true });
    fs.writeFileSync(path.join(some, 'AA.json'), JSON.stringify(SHEET()));
    let said = '';
    try {
      execFileSync('node', args(some), { stdio: 'pipe', encoding: 'utf8' });
    } catch (err) {
      said = String((err as { stderr?: string }).stderr);
    }
    expect(said).toContain('npm run data:fetch -- photos');
    gone({ data });
  });
});

describe('what the script will not make a sheet of', () => {
  it('a photograph that Commons was not asked about, has not, or whose picture did not come', () => {
    expect(refused((s) => s.photos.push({ file: 'Never asked.jpg', ...both('Otra') }))).toContain('Commons was not asked about «Never asked.jpg»');
    expect(refused((s) => s.photos.push({ file: 'Gone.jpg', ...both('Otra') }))).toContain('«Gone.jpg»');
    expect(refused((s) => s.photos.push({ file: 'Lost.jpg', ...both('Otra') }))).toContain('the picture of «Lost.jpg» is not among what was brought');
    expect(refused((s) => s.photos.push({ ...both('Sin archivo') }))).toContain('names no file');
    expect(refused((s) => (s.photos = []))).toContain('has no photographs');
  });

  it('a photograph that is not free to show, or that has to be attributed to somebody nobody names', () => {
    expect(refused((s) => s.photos.push({ file: 'Mine.jpg', ...both('Ajena') }))).toContain('not known to be free: All rights reserved');
    expect(refused((s) => s.photos.push({ file: 'Nobody.jpg', ...both('De nadie') }))).toContain('has to be attributed');
    // …unless the sheet says who.
    const sheet = SHEET();
    sheet.photos.push({ file: 'Nobody.jpg', by: 'Luis', ...both('De Luis') });
    const r = run({ AA: sheet });
    expect(r.code).toBe(0);
    expect(r.sheet('AA').photos[3]).toMatchObject({ by: 'Luis', licence: 'CC BY 4.0' });
  });

  it('a text that is not in both languages, paragraph for paragraph', () => {
    expect(refused((s) => (s.photos[1].en = ' '))).toContain('«Falls.jpg» has no text in «en»');
    expect(refused((s) => (s.official.es = ''))).toContain('the official name has no text in «es»');
    expect(refused((s) => s.about.en.pop())).toContain('2 paragraphs in Spanish and 1 in English');
    expect(refused((s) => (s.flag.text.es = []))).toContain('what is said of the flag has no paragraphs in «es»');
    expect(refused((s) => (s.flag.parts[0].en = ['The red']))).toContain('part 1 of the flag');
    expect(refused((s) => delete s.times[1].name)).toContain('the name of time 2');
    expect(refused((s) => (s.read.en = ''))).toContain('where to read more');
    // Its name in its own language is said with which language that is.
    expect(refused((s) => (s.localLang = ''))).toContain('does not say which language');
  });

  it('a flag with no day or no proportions', () => {
    expect(refused((s) => (s.flag.adopted = '1950'))).toContain('no day it was adopted on');
    expect(refused((s) => (s.flag.changed = 'ayer'))).toContain('last changed is not a day');
    expect(refused((s) => (s.flag.ratio = '1,5'))).toContain('no proportions');
  });

  it('a time whose flag the game does not have, or times that are out of order', () => {
    expect(refused((s) => (s.times[0].gone = 'Q404'))).toContain('no flag of «Q404»');
    expect(refused((s) => (s.times[1].past = [1900, 1951]))).toContain('flew from 1900 to 1951');
    expect(refused((s) => (s.times[1] = { from: 1900, name: both('x'), text: both('x') }))).toContain('names no flag');
    expect(refused((s) => s.times.reverse())).toMatch(/is before the one above it|the last of the times/);
    expect(refused((s) => s.times.pop())).toContain('the last of the times, and only that one, is the flag of today');
    expect(refused((s) => (s.times[1] = { now: true, from: 1900, name: both('x'), text: both('x') }))).toContain('the last of the times');
    expect(refused((s) => (s.times[0].to = 1700))).toContain('time 1 has no years');
    expect(refused((s) => (s.times = []))).toContain('has no times');
  });

  it('a sheet of a country the game does not have, or filed under the name of another', () => {
    const r = run({ ZZ: { ...SHEET(), id: 'ZZ' } });
    expect(r.code).not.toBe(0);
    expect(r.out).toContain('ZZ: the game has no such country');
    const wrong = run({ BB: SHEET() });
    expect(wrong.code).not.toBe(0);
    expect(wrong.out).toContain('BB: the file says it is of «AA»');
  });
});
