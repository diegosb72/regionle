/**
 * scripts/data/profiles.mjs, which makes the sheets of the countries, run on countries made up here: that
 * every country with a flag gets one with what Wikidata and Wikipedia say of it, what a correction by hand
 * does to that, and what is laid over both where somebody wrote of the country — what it takes from what
 * is written and what from Commons, the pictures it makes of each photograph —, the coat of arms each sheet
 * shows and whose it says the drawing is, and what it refuses: a
 * photograph nobody asked Commons about, one that is not free to show, a text in one language only, a time
 * whose flag the game does not have, a correction that leaves a sheet saying what it should not. A timeline
 * written on its own is layered over the generated sheet without replacing its photographs or Wikipedia texts.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
// @ts-expect-error — the script is plain JavaScript, with no types of its own
import { maker } from '../../scripts/data/profiles.mjs';
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

/**
 * What Commons says of a coat of arms, and the picture of it that was brought: how wide and how high, and
 * how much of it is drawn (`drawn`: the rest of the picture is see-through, around it).
 */
interface Drawn {
  size?: [number, number];
  drawn?: [number, number];
  licence?: string;
  licenceUrl?: string;
  artist?: string;
  attribution?: boolean;
  lost?: boolean;
  missing?: boolean;
}
const ARMS: Record<string, Drawn> = {
  // Taller than wide once what is around it is cut off.
  'Arms AA.svg': { size: [330, 400], drawn: [200, 300], licence: 'CC BY-SA 3.0', licenceUrl: 'http://creativecommons.org/licenses/by-sa/3.0', artist: 'Vectorised by user:Ana', attribution: true },
  // Drawn to its edges, and wider than tall.
  'National Emblem of BB.svg': { size: [330, 200], licence: 'Public domain', artist: 'Unknown author' },
  'Seal of CC.svg': { size: [330, 330], drawn: [300, 300], licence: 'CC0', artist: 'Sello Rojo' },
  'Given.svg': { size: [330, 330], drawn: [300, 150], licence: 'Attribution', artist: 'C records' },
  'Closed.svg': { size: [330, 330], licence: 'All rights reserved', artist: 'Somebody' },
  'Nameless.svg': { size: [330, 330], licence: 'CC BY 4.0', artist: 'See File history below for details.', attribution: true },
  'Lost.svg': { size: [330, 330], licence: 'CC0', lost: true },
  'Gone.svg': { missing: true },
};

let brought = '';
let data = '';
let arms = '';
beforeAll(async () => {
  brought = path.join(TMP, 'brought');
  data = path.join(TMP, 'data');
  arms = path.join(TMP, 'arms');
  fs.mkdirSync(brought);
  fs.mkdirSync(data);
  fs.mkdirSync(arms);
  const drawings: Record<string, unknown> = {};
  for (const [title, one] of Object.entries(ARMS)) {
    if (one.missing) {
      drawings[title] = { missing: true };
      continue;
    }
    const picture = `arms/files/${sha1(title)}.330.png`;
    drawings[title] = { sha1: sha1(title), mime: 'image/svg+xml', licence: one.licence, ...(one.licenceUrl ? { licenceUrl: one.licenceUrl } : {}), ...(one.artist ? { artist: one.artist } : {}), ...(one.attribution ? { attribution: true } : {}), picture };
    if (one.lost) continue;
    const [w, h] = one.size!;
    const [dw, dh] = one.drawn ?? one.size!;
    const drawing = await sharp({ create: { width: dw, height: dh, channels: 4, background: { r: 190, g: 30, b: 40, alpha: 1 } } }).png().toBuffer();
    await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: drawing }])
      .png()
      .toFile(path.join(arms, path.basename(picture)));
  }
  fs.writeFileSync(path.join(TMP, 'drawings.json'), JSON.stringify(drawings));
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
 * photograph chosen for the head of the sheet of each country, `arms` the files that Wikidata shows each
 * country with (none, unless a test says so; `null`: nothing was brought), and `flags` what else the script is told.
 */
function run(
  sheets: Record<string, unknown>,
  opts: {
    before?: (dirs: { data: string; photos: string }) => void;
    fixes?: Record<string, unknown>;
    said?: unknown;
    texts?: Record<string, string> | null;
    heads?: Record<string, unknown>;
    gallery?: Record<string, unknown>;
    times?: Record<string, unknown>;
    arms?: Record<string, string[]> | null;
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
  const gallery = path.join(dir, 'gallery.json');
  if (opts.gallery) fs.writeFileSync(gallery, JSON.stringify({ _: 'Further photographs for the test.', ...opts.gallery }));
  const times = path.join(dir, 'times.json');
  if (opts.times) fs.writeFileSync(times, JSON.stringify({ _: 'Researched periods of the countries of the test.', ...opts.times }));
  // What was brought of the coats of arms: the pictures of the test, and which of them Wikidata names for each country.
  const named = path.join(dir, 'arms');
  if (opts.arms !== null) {
    fs.cpSync(arms, named, { recursive: true });
    fs.writeFileSync(
      path.join(named, 'arms.json'),
      JSON.stringify({ items: Object.fromEntries(Object.entries(opts.arms ?? {}).map(([id, files]) => [id, { files }])), files: JSON.parse(fs.readFileSync(path.join(TMP, 'drawings.json'), 'utf8')) }),
    );
  }
  opts.before?.({ data: mine, photos });
  let out = '';
  let code = 0;
  try {
    out = execFileSync('node', [SCRIPT, '--sheets', written, '--brought', brought, '--arms', named, '--said', said, '--texts', texts, '--fixes', fixes, '--heads', heads, '--gallery', gallery, '--times', times, '--data', mine, '--photos', photos, ...(opts.flags ?? [])], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
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

  it('adds a bilingual, credited Commons gallery after the chosen head, without changing that head', () => {
    const head = HEAD();
    const r = run({}, { heads: { CC: head }, gallery: { CC: [
      { file: 'Head.jpg', by: 'Ana Pérez', es: 'Un canal', en: 'A channel' },
      { file: 'Painting.jpg', es: 'Una costa antigua', en: 'An old coast' },
    ] } });
    expect(r.code, r.out).toBe(0);
    const photos = r.sheet('CC').photos;
    expect(photos).toHaveLength(3);
    expect(photos[0]).toMatchObject({ title: 'Falls.jpg', file: name('Falls.jpg'), es: head.es, en: head.en, sizes: [640, 1280], focus: head.focus });
    expect(photos.slice(1).map((p) => [p.title, p.es, p.en])).toEqual([
      ['Head.jpg', 'Un canal', 'A channel'],
      ['Painting.jpg', 'Una costa antigua', 'An old coast'],
    ]);
    expect(photos[1]).toMatchObject({ by: 'Ana Pérez', licence: 'CC BY-SA 4.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0', sizes: [640, 1280] });
    expect(photos[2]).toMatchObject({ by: 'A painter', licence: 'Public domain', sizes: [640, 1280] });
    expect(r.pictures()).toEqual([name('Falls.jpg'), name('Head.jpg'), name('Painting.jpg')].flatMap((prefix) => [640, 1280].map((w) => `${prefix}-${w}.webp`)).sort());
    expect(r.sheet('BB').photos).toBeUndefined();
  });

  it('does not accept galleries without a head, with duplicate or unlicensed files, or without bilingual captions', () => {
    const failGallery = (id: string, photos: unknown, heads: Record<string, unknown> = { CC: HEAD() }) => {
      const r = run({}, { heads, gallery: { [id]: photos } });
      expect(r.code).not.toBe(0);
      expect(r.written()).toEqual([]);
      return r.out;
    };
    expect(failGallery('BB', [{ file: 'Head.jpg', ...both('Otra foto') }])).toContain('a gallery needs a chosen head');
    expect(failGallery('CC', [{ file: 'Falls.jpg', ...both('La misma') }])).toContain('must not repeat its head');
    expect(failGallery('CC', [{ file: 'Head.jpg', ...both('Una foto') }, { file: 'Head.jpg', ...both('Otra foto') }])).toContain('must not repeat its head');
    expect(failGallery('CC', [{ file: 'Mine.jpg', ...both('No libre') }])).toContain('terms that are not known to be free');
    expect(failGallery('CC', [{ file: 'Head.jpg', es: 'Una foto' }])).toContain('has no text in «en»');
    expect(failGallery('CC', [{ file: 'Gone.jpg', ...both('No existe') }])).toContain('Commons was not asked about');
  });

  it('keeps the author’s requested credit site beside their name and the licence', () => {
    const r = run({}, { heads: { CC: { file: 'Head.jpg', by: 'Diego Delso, delso.photo', byUrl: 'https://delso.photo/', ...both('Un lugar') } } });
    expect(r.code).toBe(0);
    expect(r.sheet('CC').photos[0]).toMatchObject({ by: 'Diego Delso, delso.photo', byUrl: 'https://delso.photo/', licence: 'CC BY-SA 4.0' });
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
    expect(failed({ CC: { file: 'Head.jpg', byUrl: 'https://example.com/', ...both('Nada') } })).toContain('needs a named author (by) to link a credit site');
    expect(failed({ CC: { file: 'Head.jpg', by: 'A person', byUrl: 'javascript:alert(1)', ...both('Nada') } })).toContain('has no safe https credit site');
  });
});

describe('the coat of arms of a country', () => {
  const drawn = (title: string) => sha1(title).slice(0, 10);
  const armsOf = (r: ReturnType<typeof run>, id: string) => (r.sheet(id) as unknown as { arms?: Record<string, unknown> }).arms;
  const NAMED = { AA: ['Arms AA.svg', 'Seal of CC.svg'], BB: ['National Emblem of BB.svg'], CC: ['Seal of CC.svg'] };

  it('is the one Wikidata names, made to fit a small box with what is around it cut off, and with whose the drawing is', async () => {
    const r = run({}, { arms: NAMED });
    expect(r.code).toBe(0);
    // The first by name of those Wikidata names. What was 200 by 300 in a picture of 330 by 400 fills the box by its height.
    expect(armsOf(r, 'AA')).toEqual({ file: drawn('Arms AA.svg'), w: 176, h: 264, title: 'Arms AA.svg', by: 'Ana', licence: 'CC BY-SA 3.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0' });
    // One that is drawn to its edges is left whole. Nobody is named where Commons names nobody; and it is called what its file is.
    expect(armsOf(r, 'BB')).toEqual({ file: drawn('National Emblem of BB.svg'), w: 264, h: 160, title: 'National Emblem of BB.svg', licence: 'Public domain', kind: 'emblem' });
    expect(armsOf(r, 'CC')).toEqual({ file: drawn('Seal of CC.svg'), w: 264, h: 264, title: 'Seal of CC.svg', by: 'Sello Rojo', licence: 'CC0', kind: 'seal' });
    expect(r.pictures()).toEqual([`${drawn('Arms AA.svg')}-176.webp`, `${drawn('National Emblem of BB.svg')}-264.webp`, `${drawn('Seal of CC.svg')}-264.webp`].sort());
    const made = await sharp(path.join(r.photos, `${drawn('Arms AA.svg')}-176.webp`)).metadata();
    expect([made.format, made.width, made.height]).toEqual(['webp', 176, 264]);
    expect(r.out).toContain('escudo en 3;');
  });

  it('is not made again when its picture is there, and is not kept when no sheet shows it any more', () => {
    const before = ({ photos }: { photos: string }) => {
      fs.mkdirSync(photos, { recursive: true });
      fs.writeFileSync(path.join(photos, `${drawn('Arms AA.svg')}-176.webp`), 'made before');
      fs.writeFileSync(path.join(photos, `${drawn('Seal of CC.svg')}-264.webp`), 'of a sheet that showed it');
    };
    const r = run({}, { arms: { AA: NAMED.AA }, before });
    expect(r.code).toBe(0);
    expect(r.pictures()).toEqual([`${drawn('Arms AA.svg')}-176.webp`]);
    expect(fs.readFileSync(path.join(r.photos, `${drawn('Arms AA.svg')}-176.webp`), 'utf8')).toBe('made before');
  });

  it('is what somebody says by hand: another file, what it is called, who drew it, or none', () => {
    const r = run({}, {
      arms: { AA: ['Arms AA.svg'], BB: ['National Emblem of BB.svg'], CC: ['Nameless.svg'] },
      fixes: { AA: { arms: { file: ' Seal of CC.svg ', kind: 'arms' } }, BB: { arms: null }, CC: { arms: { by: ' Ana y Luis ', kind: 'emblem' } } },
    });
    expect(r.code).toBe(0);
    // Called a coat of arms though its file says seal: nothing is said of what it is, which is what a coat of arms needs.
    expect(armsOf(r, 'AA')).toEqual({ file: drawn('Seal of CC.svg'), w: 264, h: 264, title: 'Seal of CC.svg', by: 'Sello Rojo', licence: 'CC0' });
    expect(armsOf(r, 'BB')).toBeUndefined();
    expect(armsOf(r, 'CC')).toMatchObject({ title: 'Nameless.svg', by: 'Ana y Luis', licence: 'CC BY 4.0', kind: 'emblem' });
    // One for a country that Wikidata names none for; and the terms Commons calls «Attribution» are free ones, with whom to name.
    const chosen = run({}, { fixes: { BB: { arms: { file: 'Given.svg' } } } });
    expect(chosen.code).toBe(0);
    expect(armsOf(chosen, 'BB')).toEqual({ file: drawn('Given.svg'), w: 264, h: 132, title: 'Given.svg', by: 'C records', licence: 'Attribution' });
    expect(armsOf(chosen, 'AA')).toBeUndefined();
  });

  it('is left out where the one Wikidata names cannot be shown, and whoever reviews the sheets is told why', () => {
    const r = run({}, { arms: { AA: ['Closed.svg'], BB: ['Nameless.svg'], CC: ['Lost.svg'] }, flags: ['--review'] });
    expect(r.code).toBe(0);
    for (const id of ['AA', 'BB', 'CC']) expect(armsOf(r, id)).toBeUndefined();
    expect(r.pictures()).toEqual([]);
    expect(r.out).toContain('Sin escudo, aunque Wikidata lo nombra:');
    expect(r.out).toContain('AA: «Closed.svg» is given on terms that are not known to be free: All rights reserved');
    expect(r.out).toContain('BB: «Nameless.svg» has to be attributed and Commons does not say to whom in a few words');
    expect(r.out).toContain('CC: the picture of «Lost.svg» is not among what was brought');
    expect(r.out).toContain('escudo en 0 (3 que Wikidata nombra no se pueden enseñar);');
    const gone = run({}, { arms: { AA: ['Gone.svg'], BB: ['Never asked.svg'] }, flags: ['--review'] });
    expect(gone.code).toBe(0);
    expect(gone.out).toContain('AA: Commons was not asked about «Gone.svg», or has no such file');
    expect(gone.out).toContain('BB: Commons was not asked about «Never asked.svg», or has no such file');
  });

  it('stops the script where the one somebody chose cannot be shown, or is not said as it has to be', () => {
    const failed = (fix: unknown, named: Record<string, string[]> = {}) => {
      const r = run({}, { arms: named, fixes: { AA: { arms: fix } } });
      expect(r.code).not.toBe(0);
      expect(r.written()).toEqual([]);
      return r.out;
    };
    expect(failed({ file: 'Closed.svg' })).toContain('AA: «Closed.svg» is given on terms that are not known to be free');
    expect(failed({ file: 'Never asked.svg' })).toContain('ask for the source «arms»');
    expect(failed({ file: 'Nameless.svg' })).toContain('say who made it (arms.by)');
    expect(failed({ file: 'Lost.svg' })).toContain('npm run data:fetch -- arms');
    // Who drew it or what it is called, of a country that has none to say it of.
    expect(failed({ by: 'Somebody' })).toContain('its coat of arms names no file');
    expect(failed({ kind: 'logo' }, { AA: ['Arms AA.svg'] })).toContain('«logo», which is none of arms, emblem and seal');
  });

  it('is none for a territory that flies the flag of its country, whatever Wikidata names, and nobody may choose it one', () => {
    const r = run({}, { arms: NAMED, fixes: { BB: { flag: { of: 'AA' } } } });
    expect(r.code).toBe(0);
    expect(armsOf(r, 'BB')).toBeUndefined();
    expect(armsOf(r, 'AA')).toBeDefined();
    expect(r.pictures()).not.toContain(`${drawn('National Emblem of BB.svg')}-264.webp`);
    expect(r.out).toContain('escudo en 2;');
    const chosen = run({}, { arms: NAMED, fixes: { BB: { flag: { of: 'AA' }, arms: { file: 'Given.svg' } } } });
    expect(chosen.code).not.toBe(0);
    expect(chosen.out).toContain('BB: somebody chose a coat of arms for it, and it is drawn with the flag of another country');
  });

  it('is shown by the sheet somebody wrote by hand too, beside its photographs', () => {
    const r = run({ AA: SHEET() }, { arms: NAMED });
    expect(r.code).toBe(0);
    expect(armsOf(r, 'AA')).toMatchObject({ title: 'Arms AA.svg', by: 'Ana' });
    expect(r.sheet('AA').photos).toHaveLength(3);
    expect(r.pictures()).toContain(`${drawn('Arms AA.svg')}-176.webp`);
  });

  it('is not made a sheet of when the coats of arms were not brought', () => {
    const r = run({}, { arms: null });
    expect(r.code).not.toBe(0);
    expect(r.out).toContain('npm run data:fetch -- arms');
    expect(r.written()).toEqual([]);
  });
});

describe('who made a drawing, as Commons tells it', () => {
  it('is the name, with nothing of how it is told', () => {
    expect(maker('Sodacan')).toBe('Sodacan');
    expect(maker('User:K21edgo')).toBe('K21edgo');
    expect(maker('en:User:Vino4u')).toBe('Vino4u');
    expect(maker('Pbroks13 ( talk )')).toBe('Pbroks13');
    expect(maker('Fvasconcellos ( talk · contribs )')).toBe('Fvasconcellos');
    expect(maker('Zscout370 at English Wikipedia')).toBe('Zscout370');
    expect(maker('The original uploader was Zscout370 at English Wikipedia .')).toBe('Zscout370');
    expect(maker('Sodacan i The source code of this SVG is valid . This vector image was created with Inkscape by v .')).toBe('Sodacan');
    // A name is not taken for a word of what is said around names.
    expect(maker('SVG-image-maker')).toBe('SVG-image-maker');
    expect(maker('F l a n k e r')).toBe('F l a n k e r');
  });

  it('is every name, one after another, where it tells which part each had', () => {
    expect(maker('Original: Louis Mühlemann Vector: Fenn-O-maniC')).toBe('Louis Mühlemann, Fenn-O-maniC');
    expect(maker('Original design by Nicholas Potin , vectorised by user:Fenn-O-maniC')).toBe('Nicholas Potin, Fenn-O-maniC');
    expect(maker('Vectorized by Froztbyte')).toBe('Froztbyte');
    expect(maker('Redrawn to SVG by DasREDeemr')).toBe('DasREDeemr');
    expect(maker('Sodacan , with some elements by Katepanomegas')).toBe('Sodacan, Katepanomegas');
    expect(maker('Squiresy92 including elements from Sodacan')).toBe('Squiresy92, Sodacan');
    expect(maker('Borb , modified by User:Di (they-them)')).toBe('Borb, Di (they-them)');
    expect(maker("Republic of Côte d'Ivoire vectored by FOX 52")).toBe("Republic of Côte d'Ivoire, FOX 52");
    expect(maker('First version: User:Escondites Second version: User:Cronholm144')).toBe('Escondites, Cronholm144');
    expect(maker('Autor of SVG image: Ivangricenko')).toBe('Ivangricenko');
    expect(maker('Original by Caleb Moore Extracted by Himasaram')).toBe('Caleb Moore, Himasaram');
    expect(maker('upload: User:Rokerismoravee')).toBe('Rokerismoravee');
    expect(maker('FischX and Zscout370')).toBe('FischX and Zscout370');
  });

  it('is nobody where Commons names nobody, tells something else in its place, or tells it at length', () => {
    for (const told of [
      undefined,
      '',
      'Unknown',
      'Unknown author Unknown author',
      'Own work',
      'See File history below for details.',
      'Various, see File history below for details.',
      'SVG Added Ramos',
      'Original: BetacommandBot Vector: Zscout370',
      'Benedikt Thorolfsson (Versions 1-4)',
      'multiple people, e.g. Lin Huiyin and Liang Sicheng, see [2]',
      'Szczepan dyskusja Mail 08:10, 2 April 2007 (UTC)',
      'Tonyjeff , based on national symbol.',
      'original from xrmap flag collection 2.9, HansenBCN',
      'Coat_of_arms_of_Suriname.png : Brokopondo derivative work: Completefailure ( talk )',
      'Original: Tao Ho : 何弢 Vector: HyBoxwood',
      'Lion héraldique.svg - Bluebear2 Heraldique meuble lion passant.svg - Rinaldum , S@m , Zigeuner Coat of arms of Haiti (1964-1986).svg - Thommy9 derivative work:…',
      'This vector image includes elements that have been taken or adapted from this file:',
    ])
      expect(maker(told), String(told)).toBe('');
    // As many characters as fit where it goes: sixty under a photograph, fewer where whoever asks says so.
    expect(maker('Neville C. Connell, director of the Barbados Museum')).toBe('Neville C. Connell, director of the Barbados Museum');
    expect(maker('Neville C. Connell, director of the Barbados Museum', 40)).toBe('');
    expect(maker('Tonyjeff , Omar86 , Kafka1 and AnonMoos ; AnonMoos , Militaryace , and many more')).toBe('');
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

describe('sourced accounts on generated sheets', () => {
  const SOURCES = {
    about: [{ title: { es: 'Instituto de las islas', en: 'Island institute' }, url: 'https://example.org/islands' }],
    flag: [{ title: { es: 'Estudio de banderas', en: 'Flag study' }, url: 'https://example.org/flags' }],
  };
  const FIX = () => ({
    about: { es: ['Un archipiélago.'], en: ['An archipelago.'] },
    flag: { text: { es: ['Su pabellón.'], en: ['Its ensign.'] }, parts: [{ es: ['Una estrella', 'Representa una isla.'], en: ['A star', 'It stands for an island.'] }] },
    sources: structuredClone(SOURCES),
  });

  it('keeps the chosen Commons photo, source facts and links while replacing only the Wikipedia extracts', () => {
    const r = run({}, {
      fixes: { CC: FIX(), BB: { about: { es: ['Otra isla.'], en: ['Another island.'] }, sources: { about: SOURCES.about }, flag: { of: 'CC' } } },
      heads: { CC: { file: 'Falls.jpg', ...both('Unas cataratas') } },
      texts: {
        'es:Cc (país)': 'Cc era un país.', 'en:Cc': 'Cc was a country.',
        'es:Bandera de Cc': 'La bandera de Cc era verde.', 'en:Flag of Cc': 'The flag of Cc was green.',
      },
    });
    expect(r.code, r.out).toBe(0);
    expect(r.sheet('CC')).toMatchObject({ about: FIX().about, sources: SOURCES, flag: FIX().flag });
    expect(r.sheet('CC').lead).toBeUndefined();
    expect(r.sheet('CC').flag?.lead).toBeUndefined();
    expect(r.sheet('CC').flag?.adopted).toBe('1960-08-07');
    expect(r.sheet('CC').photos[0]).toMatchObject({ title: 'Falls.jpg', licence: 'CC0', sizes: [640, 1280] });
    expect(r.sheet('CC').read?.es).toBe('https://es.wikipedia.org/wiki/Cc_(pa%C3%ADs)');
    // A borrowed flag's historical date and designer still come from its owner, not this territory's text.
    expect(r.sheet('BB').flag?.of).toBe('CC');
    expect(r.sheet('BB').flag?.adopted).toBe(r.sheet('CC').flag?.adopted);
    expect(r.sheet('BB').flag?.text).toBeUndefined();
    expect(r.sheet('BB').about?.en).toEqual(['Another island.']);
  });

  it('rejects unsourced or unsafe accounts and untranslated flag parts', () => {
    const wrong = (fix: Record<string, unknown>) => {
      const r = run({}, { fixes: { CC: fix } });
      expect(r.code).not.toBe(0);
      expect(r.written()).toEqual([]);
      return r.out;
    };
    expect(wrong({ about: FIX().about })).toContain('an authored account of the country needs its sources');
    expect(wrong({ flag: FIX().flag })).toContain('an authored account of the flag needs its sources');
    expect(wrong({ ...FIX(), sources: { ...SOURCES, flag: [{ title: SOURCES.flag[0].title, url: 'javascript:alert(1)' }] } })).toContain('needs a safe https address');
    expect(wrong({ ...FIX(), sources: { ...SOURCES, about: [{ title: { es: 'Solo español' }, url: 'https://example.org/islands' }] } })).toContain('a title in both languages');
    expect(wrong({ ...FIX(), flag: { ...FIX().flag, parts: [{ es: ['Parte', 'Significado.'] }] } })).toContain('has no name and text in both languages');
    expect(wrong({ sources: { about: SOURCES.about } })).toContain('no matching text or links');
  });
});

describe('a researched timeline added without replacing the rest of a sheet', () => {
  const timeline = () => ({
    source: 'https://en.wikipedia.org/wiki/Flag_of_Aa',
    note: both('Los años de la imagen no son los años de uso'),
    times: [
      { past: [1900, 1950], from: 1901, to: 1948, name: both('Primera bandera'), text: both('Una versión de la historia') },
      { now: true, from: 1948, name: both('Bandera actual'), text: both('La historia sigue') },
    ],
  });

  it('keeps the chosen photograph, facts, corrections and Wikipedia texts, while adding bilingual periods with verified years', () => {
    const r = run({}, { times: { AA: timeline() }, heads: { AA: { file: 'Head.jpg', ...both('La ciudad') } }, texts: { 'es:Aa': 'Aa es un país del que alguien ha escrito a mano.', 'es:Bandera de Aa': 'La bandera de Aa es roja y blanca desde 1950.' }, fixes: { AA: { flag: { ratio: '3:4' } } } });
    expect(r.code).toBe(0);
    expect(r.sheet('AA')).toMatchObject({
      official: { en: 'Republic of Aa' },
      flag: { ratio: '3:4', lead: { es: ['La bandera de Aa es roja y blanca desde 1950.'] } },
      lead: { es: ['Aa es un país del que alguien ha escrito a mano.'] },
      photos: [{ title: 'Head.jpg', es: 'La ciudad.', en: 'La ciudad (en).' }],
      times: timeline().times,
      timeSource: timeline().source,
      timeNote: timeline().note,
    });
    expect(r.pictures()).toContain(`${name('Head.jpg')}-640.webp`);
    expect(r.out).toContain('cronología escrita en 1');
    // The range [1900, 1950] identifies the drawing, not the checked years 1901–1948 shown to the reader.
    expect(r.sheet('AA').times[0]).toMatchObject({ past: [1900, 1950], from: 1901, to: 1948 });
  });

  it('builds a period document at its own width with Commons provenance without replacing the chosen head', () => {
    const account = timeline();
    const r = run({}, {
      times: { AA: { ...account, times: [{ ...account.times[0], picture: { file: 'Painting.jpg', ...both('Un documento de época') } }, account.times[1]] } },
      heads: { AA: { file: 'Head.jpg', ...both('La ciudad') } },
    });
    expect(r.code).toBe(0);
    expect(r.sheet('AA').photos).toMatchObject([{ title: 'Head.jpg' }]);
    expect(r.sheet('AA').times[0].picture).toMatchObject({ title: 'Painting.jpg', sizes: [640], by: 'A painter', licence: 'Public domain', es: 'Un documento de época.' });
    expect(r.pictures()).toContain(`${name('Painting.jpg')}-640.webp`);
    expect(r.pictures()).toContain(`${name('Head.jpg')}-1280.webp`);
  });

  it('distinguishes two catalogue drawings that share years and rejects an unqualified or invented file', () => {
    const withTwin = ({ data }: { data: string }) => {
      const file = path.join(data, 'flags.json');
      const flags = JSON.parse(fs.readFileSync(file, 'utf8'));
      flags.past.AA.push(['0000000004.svg', 1.5, 1900, 1950]);
      fs.writeFileSync(file, JSON.stringify(flags));
    };
    const first = timeline().times[0];
    const t = {
      ...timeline(),
      times: [
        { ...first, pastFile: '0000000002.svg' },
        { ...first, pastFile: '0000000004.svg', from: 1902, to: 1949 },
        timeline().times[1],
      ],
    };
    const r = run({}, { times: { AA: t }, before: withTwin });
    expect(r.code).toBe(0);
    expect(r.sheet('AA').times.map((one) => one.pastFile)).toEqual(['0000000002.svg', '0000000004.svg', undefined]);

    const ambiguous = run({}, { times: { AA: timeline() }, before: withTwin });
    expect(ambiguous.code).not.toBe(0);
    expect(ambiguous.out).toContain('no unique flag that the country flew from 1900 to 1950');
    const unknown = run({}, { times: { AA: { ...t, times: [{ ...first, pastFile: 'not-in-catalogue.svg' }, timeline().times[1]] } }, before: withTwin });
    expect(unknown.code).not.toBe(0);
    expect(unknown.out).toContain('with file not-in-catalogue.svg');
    const wrongKind = run({}, { times: { AA: { ...t, times: [{ ...first, pastFile: '0000000002.svg' }, { ...timeline().times[1], pastFile: '0000000004.svg' }] } }, before: withTwin });
    expect(wrongKind.code).not.toBe(0);
    expect(wrongKind.out).toContain('a past flag file can only identify a past flag');
  });

  it('does not confuse a timeline with a whole sheet written by hand, nor make one for a missing country', () => {
    const doubled = run({ AA: SHEET() }, { times: { AA: timeline() } });
    expect(doubled.code).not.toBe(0);
    expect(doubled.out).toContain('AA: a timeline was written twice');
    expect(doubled.written()).toEqual([]);
    const unknown = run({}, { times: { ZZ: timeline() } });
    expect(unknown.code).not.toBe(0);
    expect(unknown.out).toContain('ZZ: a timeline was written for what is no country');
    expect(unknown.written()).toEqual([]);
  });

  it('requires a real https source and readable, bilingual history rather than trusting catalogue images or invalid dates', () => {
    const refused = (change: (one: ReturnType<typeof timeline>) => void) => {
      const one = timeline();
      change(one);
      const r = run({}, { times: { AA: one } });
      expect(r.code).not.toBe(0);
      expect(r.written()).toEqual([]);
      return r.out;
    };
    expect(refused((one) => (one.source = 'javascript:alert(1)'))).toContain('no safe https source');
    expect(refused((one) => (one.source = 'https://x:password@example.com/'))).toContain('no safe https source');
    expect(refused((one) => (one.note.en = ' '))).toContain('the note on its timeline');
    expect(refused((one) => (one.times[0].text.en = ' '))).toContain('time 1 has no text in «en»');
    expect(refused((one) => (one.times[0].past = [1900, 1949]))).toContain('no unique flag');
    expect(refused((one) => (one.times[0].to = 1899))).toContain('time 1 has no valid years');
    expect(refused((one) => (one.times[1].from = 1800))).toContain('is before the one above it');
    expect(refused((one) => (one.times[1].to = 1950))).toContain('flag of today cannot have an ending year');
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
    fs.writeFileSync(path.join(arms, 'arms.json'), JSON.stringify({ items: {}, files: {} }));
    const args = (sheets: string) => [SCRIPT, '--sheets', sheets, '--brought', without, '--said', path.join(TMP, 'said.json'), '--texts', path.join(TMP, 'texts.json'), '--fixes', path.join(TMP, 'none.json'), '--arms', arms, '--heads', path.join(TMP, 'none-heads.json'), '--gallery', path.join(TMP, 'none-gallery.json'), '--times', path.join(TMP, 'none-times.json'), '--data', path.join(TMP, 'data-np'), '--photos', path.join(TMP, 'photos-np')];
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
    expect(refused((s) => (s.times[1] = { from: 1900, name: both('x'), text: both('x') }))).toContain('exactly one flag');
    expect(refused((s) => s.times.reverse())).toMatch(/is before the one above it|the last of the times/);
    expect(refused((s) => s.times.pop())).toContain('the last of the times, and only that one, is the flag of today');
    expect(refused((s) => (s.times[1] = { now: true, from: 1900, name: both('x'), text: both('x') }))).toContain('the last of the times');
    expect(refused((s) => (s.times[0].to = 1700))).toContain('time 1 has no valid years');
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
