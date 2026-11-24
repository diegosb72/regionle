/**
 * scripts/data/profiles.mjs, which makes the sheets of the countries, run on a country made up here: what
 * it takes from what is written by hand and what from Commons, the pictures it makes of each photograph,
 * and what it refuses — a photograph nobody asked Commons about, one that is not free to show, a text in
 * one language only, a time whose flag the game does not have.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ProfileFile } from './profiles';

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
  fs.writeFileSync(path.join(data, 'index.json'), JSON.stringify({ countries: [{ id: 'AA' }, { id: 'BB' }] }));
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
/** Runs the script on the sheets that are given, each under the name of its file. */
function run(sheets: Record<string, unknown>, before?: (dirs: { data: string; photos: string }) => void) {
  const dir = path.join(TMP, `run-${++n}`);
  const [said, mine, photos] = [path.join(dir, 'sheets'), path.join(dir, 'data'), path.join(dir, 'photos')];
  fs.mkdirSync(said, { recursive: true });
  fs.cpSync(data, mine, { recursive: true });
  for (const [name, sheet] of Object.entries(sheets)) fs.writeFileSync(path.join(said, `${name}.json`), JSON.stringify(sheet));
  before?.({ data: mine, photos });
  let out = '';
  let code = 0;
  try {
    out = execFileSync('node', [SCRIPT, '--sheets', said, '--brought', brought, '--data', mine, '--photos', photos], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    const failed = err as { status?: number; stderr?: string; stdout?: string };
    code = failed.status ?? 1;
    out = `${failed.stdout ?? ''}${failed.stderr ?? ''}`;
  }
  const pictures = () => (fs.existsSync(photos) ? fs.readdirSync(photos).sort() : []);
  const sheet = (id: string) => JSON.parse(fs.readFileSync(path.join(mine, 'profiles', `${id}.json`), 'utf8')) as ProfileFile;
  const written = () => (fs.existsSync(path.join(mine, 'profiles')) ? fs.readdirSync(path.join(mine, 'profiles')).sort() : []);
  return { code, out, pictures, sheet, written, photos };
}
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
    expect(r.written()).toEqual(['AA.json']);
    expect(r.out).toContain('AA.json');
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
    const r = run({ AA: SHEET() }, ({ data: mine, photos }) => {
      fs.mkdirSync(photos, { recursive: true });
      fs.mkdirSync(path.join(mine, 'profiles'), { recursive: true });
      fs.writeFileSync(path.join(photos, 'ffffffffff-640.webp'), 'old');
      fs.writeFileSync(path.join(mine, 'profiles', 'ZZ.json'), '{}');
    });
    expect(r.code).toBe(0);
    expect(r.pictures()).not.toContain('ffffffffff-640.webp');
    expect(r.written()).toEqual(['AA.json']);
  });

  it('makes one sheet for each country that has one written, and a photograph that two show once', () => {
    const other = { ...SHEET(), id: 'BB', times: [{ past: [1700, 1750], from: 1700, to: 1750, name: both('Vieja'), text: both('Vieja') }, { now: true, from: 1750, name: both('Hoy'), text: both('Hoy') }], photos: [{ file: 'Falls.jpg', ...both('Las mismas cataratas') }] };
    const r = run({ AA: SHEET(), BB: other });
    expect(r.code).toBe(0);
    expect(r.written()).toEqual(['AA.json', 'BB.json']);
    // At the head of the second it is wanted wider than in the gallery of the first: every width is there, each once.
    expect(r.sheet('BB').photos[0]).toMatchObject({ file: name('Falls.jpg'), sizes: [640, 1280, 1920], es: 'Las mismas cataratas.' });
    expect(r.pictures().filter((file) => file.startsWith(name('Falls.jpg')))).toEqual([`${name('Falls.jpg')}-1280.webp`, `${name('Falls.jpg')}-1920.webp`, `${name('Falls.jpg')}-640.webp`]);
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
