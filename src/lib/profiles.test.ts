/**
 * The sheets of the countries (lib/profiles.ts): which countries have one and how its address is written,
 * the place of a country among the States, the flags of its times and where it is on the globe; and the
 * sheets themselves, as the game is given them — that each says what was written by hand of its country,
 * that every photograph is there at every width it is said to have, with whose it is, and that the flags of
 * its times are flags the game has.
 */
import fs from 'node:fs';
import path from 'node:path';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error a script of the build, written without types
import { WIDTHS as WIDTHS_SAID } from '../../scripts/data/profiles.mjs';
// @ts-expect-error a list of the build, written without types
import { PHOTOS as PINNED, PHOTOS_AT as PINNED_AT, PHOTOS_SAID as PINNED_SAID } from '../../scripts/data/photos-pinned.mjs';
import type { FlagsFile } from './flags';
import { setLang } from './i18n';
import { locator } from './profileMap';
import { PROFILE_LANDS, hasProfile, isDay, photoSet, photoSrc, profileIn, profileRest, rankOf, timeCards, type ProfileFile, type ProfilePhoto } from './profiles';
import type { Country, Geo, Index } from './types';

const WIDTHS = WIDTHS_SAID as { head: number[]; photo: number[]; time: number[] };
const PHOTOS = PINNED as [file: string, blob: string][];
const PHOTOS_SAID = PINNED_SAID as [file: string, blob: string];
const PHOTOS_AT = PINNED_AT as { repo: string; commit: string; dir: string };

const ROOT = process.cwd();
const json = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')) as T;
const INDEX = json<Index>('public/data/index.json');
const FLAGS = json<FlagsFile>('public/data/flags.json');
const SHEETS = 'public/data/profiles';
const SOURCES = 'scripts/data/profiles';
const PICTURES = 'public/photos';

const sheetOf = (id: string) => json<ProfileFile>(`${SHEETS}/${id}.json`);
/** What is written of a country by hand: the same, with each photograph named by its title in Commons. */
interface Source extends Omit<ProfileFile, 'v' | 'photos' | 'times'> {
  photos: { file: string; es: string; en: string; by?: string; focus?: [number, number] }[];
  times: (Omit<ProfileFile['times'][number], 'picture'> & { picture?: { file: string; es: string; en: string } })[];
}
const sourceOf = (id: string) => json<Source>(`${SOURCES}/${id}.json`);
const photosOf = (sheet: ProfileFile): ProfilePhoto[] => [...sheet.photos, ...sheet.times.flatMap((time) => (time.picture ? [time.picture] : []))];

beforeEach(() => setLang('es'));

describe('which countries have a sheet', () => {
  it('are those that have a file of their own, and no other', () => {
    expect(PROFILE_LANDS).toEqual(['BR']);
    const files = (dir: string) => fs.readdirSync(path.join(ROOT, dir)).filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5)).sort();
    expect(files(SHEETS)).toEqual([...PROFILE_LANDS].sort());
    expect(files(SOURCES)).toEqual([...PROFILE_LANDS].sort());
    for (const id of PROFILE_LANDS) {
      // A country of the game, with a flag to open the sheet by.
      const country = INDEX.countries.find((c) => c.id === id);
      expect(country?.fl, id).toBeTruthy();
      expect(hasProfile(id)).toBe(true);
    }
    expect(hasProfile('AR')).toBe(false);
    expect(hasProfile('br')).toBe(false);
  });

  it('are named in the address of the gallery after the page of the countries', () => {
    expect(profileRest('BR')).toBe('paises/BR');
    expect(profileIn(profileRest('BR'))).toBe('BR');
    expect(profileIn('paises/br')).toBe('BR');
    expect(profileIn('countries/BR')).toBe('BR');
    expect(profileIn('Countries/Br')).toBe('BR');
    // The gallery alone, a country with no sheet, another page of it, and what says more than a country.
    expect(profileIn('paises')).toBeNull();
    expect(profileIn('')).toBeNull();
    expect(profileIn('paises/AR')).toBeNull();
    expect(profileIn('paises/Brasil')).toBeNull();
    expect(profileIn('regiones/BR')).toBeNull();
    expect(profileIn('ciudades/BR')).toBeNull();
    expect(profileIn('paises/BR/mas')).toBeNull();
    expect(profileIn('juegos/BR')).toBeNull();
  });
});

describe('the place of a country among the States', () => {
  it('is counted from the largest figure, among those that have one', () => {
    expect(rankOf(INDEX, 'BR', (c) => c.ar)).toEqual({ place: 5, among: 198 });
    expect(rankOf(INDEX, 'BR', (c) => c.pop)).toMatchObject({ place: 7 });
    expect(rankOf(INDEX, 'RU', (c) => c.ar)?.place).toBe(1);
    expect(rankOf(INDEX, 'IN', (c) => c.pop)?.place).toBe(1);
  });

  it('is none for what is no State, has no such figure or is not in the game', () => {
    // Greenland is larger than most States and is none.
    expect(INDEX.countries.find((c) => c.id === 'GL')?.cl).toBe('dep');
    expect(rankOf(INDEX, 'GL', (c) => c.ar)).toBeNull();
    expect(rankOf(INDEX, 'BR', () => undefined)).toBeNull();
    expect(rankOf(INDEX, 'ZZ', (c) => c.ar)).toBeNull();
  });

  it('is shared by two with the same figure', () => {
    const land = (id: string, pop: number): Country => ({ ...INDEX.countries[0], id, cl: 'un', pop });
    const index: Index = { ...INDEX, countries: [land('A', 30), land('B', 20), land('C', 20), land('D', 10), { ...land('E', 99), cl: 'dep' }] };
    expect(['A', 'B', 'C', 'D'].map((id) => rankOf(index, id, (c) => c.pop)?.place)).toEqual([1, 2, 2, 4]);
    expect(rankOf(index, 'D', (c) => c.pop)?.among).toBe(4);
    expect(rankOf(index, 'E', (c) => c.pop)).toBeNull();
  });
});

describe('the pictures of a photograph', () => {
  it('are named after it and their width', () => {
    expect(photoSrc('0123456789', 640, '/x/')).toBe('/x/photos/0123456789-640.webp');
    expect(photoSet({ file: '0123456789', sizes: [640, 1280] }, './')).toBe('./photos/0123456789-640.webp 640w, ./photos/0123456789-1280.webp 1280w');
  });
});

describe('a day', () => {
  it('is a year, a month and a day that there was', () => {
    expect(isDay('1889-11-19')).toBe(true);
    expect(isDay('1992-05-11')).toBe(true);
    expect(isDay('1889-11')).toBe(false);
    expect(isDay('1889-13-01')).toBe(false);
    expect(isDay('19-11-1889')).toBe(false);
    expect(isDay('')).toBe(false);
  });
});

describe('where a country is', () => {
  const topo = json<Topology>('public/data/world.json');
  const world = new Map((feature(topo, topo.objects.c as GeometryCollection) as unknown as { features: Geo[] }).features.map((f) => [String(f.id), f]));
  const numbers = (d: string): number[] => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

  it('is drawn in the middle of the half of the globe that faces whoever looks', () => {
    const brazil = INDEX.countries.find((c) => c.id === 'BR')!;
    const drawn = locator(world, 'BR', brazil.lp, 200)!;
    expect(drawn.globe).toMatch(/^M/);
    expect(drawn.land).toMatch(/^M/);
    expect(drawn.own).toMatch(/^M/);
    // The country is whole, and well inside the square: its outline is not that of the globe.
    const own = numbers(drawn.own);
    expect(own.length).toBeGreaterThan(40);
    expect(Math.min(...own)).toBeGreaterThan(40);
    expect(Math.max(...own)).toBeLessThan(160);
    // The others are one shape, far heavier than its own, and none of it is drawn beyond the square.
    expect(drawn.land.length).toBeGreaterThan(drawn.own.length * 3);
    const land = numbers(drawn.land);
    expect(Math.min(...land)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...land)).toBeLessThanOrEqual(200);
    // What is on the far side is not drawn: Japan adds nothing to the land around Brazil.
    const less = new Map(world);
    less.delete('JP');
    expect(locator(less, 'BR', brazil.lp, 200)!.land).toBe(drawn.land);
    less.delete('AR');
    expect(locator(less, 'BR', brazil.lp, 200)!.land).not.toBe(drawn.land);
  });

  it('is nothing for what the map does not have', () => {
    expect(locator(world, 'ZZ', [0, 0], 200)).toBeNull();
  });
});

describe.each(PROFILE_LANDS.map((id) => [id]))('the sheet of %s', (id) => {
  const sheet = sheetOf(id);
  const source = sourceOf(id);

  it('says what was written of the country by hand: `npm run data:profiles` has been run since', () => {
    expect(sheet.v).toBe(1);
    expect(sheet.id).toBe(id);
    expect(source.id).toBe(id);
    expect(sheet.official).toEqual(source.official);
    expect(sheet.local).toBe(source.local);
    expect(sheet.localLang).toBe(source.localLang);
    expect(sheet.about).toEqual(source.about);
    expect(sheet.flag).toEqual(source.flag);
    expect(sheet.read).toEqual(source.read);
    expect(sheet.photos.map((p) => [p.title, p.es, p.en, p.focus])).toEqual(source.photos.map((p) => [p.file, p.es, p.en, p.focus]));
    expect(sheet.times.map(({ picture, ...time }) => ({ ...time, picture: picture && [picture.title, picture.es, picture.en] }))).toEqual(
      source.times.map(({ picture, ...time }) => ({ ...time, picture: picture && [picture.file, picture.es, picture.en] })),
    );
    // Who made a photograph is what Commons says, unless the sheet says it in fewer words.
    for (const [i, one] of source.photos.entries()) if (one.by) expect(sheet.photos[i].by).toBe(one.by);
  });

  it('says everything in the two languages, a paragraph for a paragraph', () => {
    const texts: string[] = [];
    const both = (said: { es: string; en: string }, what: string) => {
      expect(said.es.trim(), `${what} (es)`).not.toBe('');
      expect(said.en.trim(), `${what} (en)`).not.toBe('');
      texts.push(said.es, said.en);
    };
    both(sheet.official, 'official');
    both(sheet.read, 'read');
    expect(sheet.read.es).toMatch(/^https:\/\/es\.wikipedia\.org\/wiki\//);
    expect(sheet.read.en).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//);
    for (const list of [sheet.about, sheet.flag.text]) {
      expect(list.es.length).toBeGreaterThan(0);
      expect(list.en).toHaveLength(list.es.length);
      texts.push(...list.es, ...list.en);
    }
    expect(sheet.flag.parts.length).toBeGreaterThan(0);
    for (const part of sheet.flag.parts) {
      expect(part.es).toHaveLength(2);
      expect(part.en).toHaveLength(2);
      texts.push(part.es[1], part.en[1]);
    }
    if (sheet.flag.called) both(sheet.flag.called, 'called');
    if (sheet.flag.by) both(sheet.flag.by, 'by');
    for (const [i, time] of sheet.times.entries()) {
      both(time.name, `time ${i} name`);
      both(time.text, `time ${i}`);
      if (time.when) both(time.when, `time ${i} when`);
    }
    for (const photo of photosOf(sheet)) both(photo, photo.title);
    // Whole sentences, with no space twice and none left at the ends; the quotes are the ones of each language.
    for (const text of texts.filter((t) => !t.startsWith('https://'))) {
      expect(text, text).toBe(text.trim());
      expect(text, text).not.toMatch(/\s{2}|"|'/);
    }
    for (const text of [...sheet.about.es, ...sheet.about.en, ...sheet.flag.text.es, ...sheet.flag.text.en, ...sheet.times.flatMap((t) => [t.text.es, t.text.en]), ...photosOf(sheet).flatMap((p) => [p.es, p.en])]) expect(text, text).toMatch(/[.!?]$/);
  });

  it('gives the days of its flag and its proportions', () => {
    expect(isDay(sheet.flag.adopted)).toBe(true);
    if (sheet.flag.changed) {
      expect(isDay(sheet.flag.changed)).toBe(true);
      expect(sheet.flag.changed > sheet.flag.adopted).toBe(true);
    }
    expect(sheet.flag.ratio).toMatch(/^\d+:\d+$/);
  });

  it('has each photograph at every width it says, light enough, with who made it and on what terms', () => {
    const photos = photosOf(sheet);
    expect(sheet.photos.length).toBeGreaterThanOrEqual(4);
    expect(new Set(photos.map((p) => p.file)).size).toBe(photos.length);
    for (const [i, photo] of photos.entries()) {
      expect(photo.file, photo.title).toMatch(/^[0-9a-f]{10}$/);
      expect(photo.title).toMatch(/\.(jpe?g|png|tiff?)$/i);
      expect(photo.w).toBeGreaterThan(0);
      expect(photo.h).toBeGreaterThan(0);
      // The widths of where it is shown: the one at the head of the sheet, those of its gallery, that of a time.
      const wanted: readonly number[] = i === 0 ? WIDTHS.head : i < sheet.photos.length ? WIDTHS.photo : WIDTHS.time;
      expect(photo.sizes, photo.title).toEqual(wanted.filter((w) => w <= photo.w));
      for (const w of photo.sizes) {
        const file = path.join(ROOT, PICTURES, `${photo.file}-${w}.webp`);
        expect(fs.existsSync(file), file).toBe(true);
        const bytes = fs.statSync(file).size;
        // A picture of a page, not the photograph as it was taken: none is heavier than a third of a megabyte.
        expect(bytes, `${photo.title} ${w}`).toBeGreaterThan(2_000);
        expect(bytes, `${photo.title} ${w}`).toBeLessThan(w > 1280 ? 420_000 : 300_000);
        expect(fs.readFileSync(file).subarray(8, 12).toString('latin1')).toBe('WEBP');
      }
      // Free to show and to make smaller, and said as its licence asks.
      expect(photo.licence, photo.title).toMatch(/^(CC0|CC BY(-SA)? \d\.\d|Public domain)/);
      if (photo.licence.startsWith('CC')) expect(photo.licenceUrl, photo.title).toMatch(/^https:\/\/creativecommons\.org\//);
      if (/^CC BY/.test(photo.licence)) expect(photo.by?.trim(), photo.title).toBeTruthy();
      // A name, not all that the page of the file tells of how it was made.
      if (photo.by) expect(photo.by.length, photo.by).toBeLessThanOrEqual(60);
      if (photo.focus) for (const n of photo.focus) expect(n >= 0 && n <= 100).toBe(true);
    }
  });

  it('keeps no picture that no sheet shows', () => {
    const used = new Set(PROFILE_LANDS.flatMap((land) => photosOf(sheetOf(land)).flatMap((photo) => photo.sizes.map((w) => `${photo.file}-${w}.webp`))));
    expect(fs.readdirSync(path.join(ROOT, PICTURES)).sort()).toEqual([...used].sort());
  });

  it('tells its times by flags the game has, the oldest first and the one of today last', () => {
    const cards = timeCards(sheet, FLAGS, INDEX, '/');
    expect(cards).toHaveLength(sheet.times.length);
    expect(sheet.times.length).toBeGreaterThanOrEqual(2);
    for (const [i, time] of sheet.times.entries()) {
      const card = cards[i];
      expect(card, `${time.from}`).not.toBeNull();
      // One of the three, and only one.
      expect([time.now, time.gone, time.past].filter((x) => x !== undefined)).toHaveLength(1);
      if (time.past) {
        expect(card).toMatchObject({ kind: 'past', id, years: time.past });
        expect([time.from, time.to]).toEqual(time.past);
      }
      if (time.gone) {
        expect(card).toMatchObject({ kind: 'gone', id: time.gone });
        expect(card!.years).toEqual([time.from, time.to]);
      }
      if (time.now) {
        expect(card).toMatchObject({ kind: 'country', id });
        expect(time.to).toBeUndefined();
        expect(i).toBe(sheet.times.length - 1);
      }
      if (i) expect(time.from).toBeGreaterThanOrEqual(sheet.times[i - 1].from);
      if (time.to !== undefined) expect(time.to).toBeGreaterThanOrEqual(time.from);
    }
    expect(sheet.times.filter((time) => time.now)).toHaveLength(1);
    // Every flag the game has of what the country flew before is one of its times.
    const flew = (FLAGS.past?.[id] ?? []).map((row) => `${row[2]}-${row[3]}`).sort();
    expect(sheet.times.flatMap((time) => (time.past ? [time.past.join('-')] : [])).sort()).toEqual(flew);
  });

  it('has a time none of whose flags the game has when asked about one it does not', () => {
    const odd: ProfileFile = { ...sheet, times: [{ ...sheet.times[0], gone: 'Q0', past: undefined, now: undefined }, { ...sheet.times[0], gone: undefined, past: [1, 2], now: undefined }] };
    expect(timeCards(odd, FLAGS, INDEX, '/')).toEqual([null, null]);
  });
});

describe('the photographs that are fetched to make the sheets', () => {
  it('are the ones the sheets show, each pinned by what it holds', () => {
    expect(PHOTOS_AT.repo).toBe('diegosb72/regionle');
    expect(PHOTOS_AT.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(PHOTOS_SAID[0]).toBe('photos/photos.json');
    for (const [file, blob] of [PHOTOS_SAID, ...PHOTOS]) {
      expect(blob, file).toMatch(/^[0-9a-f]{40}$/);
    }
    for (const [file] of PHOTOS) expect(file).toMatch(/^photos\/files\/[0-9a-f]{40}\.1920\.(jpg|png)$/);
    // Under the SHA-1 of its original, whose first figures are what its pictures are named after.
    const pinned = PHOTOS.map(([file]) => path.basename(file).slice(0, 10)).sort();
    const shown = PROFILE_LANDS.flatMap((land) => photosOf(sheetOf(land)).map((photo) => photo.file)).sort();
    expect(pinned).toEqual(shown);
  });
});
