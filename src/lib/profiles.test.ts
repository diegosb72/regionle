/**
 * The sheets of the countries (lib/profiles.ts): which countries have one and how its address is written,
 * the place of a country among the States, the flags of its times and where it is on the globe; and the
 * sheets themselves, as the game is given them — that every country with a flag has one, that none says
 * anything that is not what it is said to be, that those written by hand say what was written, that every
 * photograph is there at every width it is said to have, with whose it is, that the coat of arms each shows
 * is one that may be shown, with whose its drawing is, and that the flags of its times are flags the game has.
 */
import fs from 'node:fs';
import path from 'node:path';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error a list of the build, written without types
import { ARMS as ARMS_PINNED, ARMS_AT as ARMS_PINNED_AT, ARMS_SAID as ARMS_PINNED_SAID } from '../../scripts/data/arms-pinned.mjs';
// @ts-expect-error a script of the build, written without types
import { ARMS_BOX as ARMS_BOX_SAID, LEAD_MAX as LEAD_MAX_SAID, WIDTHS as WIDTHS_SAID } from '../../scripts/data/profiles.mjs';
// @ts-expect-error a list of the build, written without types
import { PHOTOS as PINNED, PHOTOS_AT as PINNED_AT, PHOTOS_SAID as PINNED_SAID } from '../../scripts/data/photos-pinned.mjs';
import type { FlagsFile } from './flags';
import { setLang } from './i18n';
import { SAME_FLAG } from './pairs';
import { locator } from './profileMap';
import { bordersText, flownCards, hasProfile, isDay, neighboursOf, photoSet, photoSrc, profileIn, profileRest, rankOf, regionsText, timeCards, townsText, yearOfDay, type ProfileFile, type ProfilePhoto, type ProfileTime } from './profiles';
import type { Country, Geo, Index } from './types';

const WIDTHS = WIDTHS_SAID as { head: number[]; photo: number[]; time: number[]; chosen: number[] };
const LEAD_MAX = LEAD_MAX_SAID as { about: number; flag: number };
const ARMS_BOX = ARMS_BOX_SAID as number;
const ARMS = ARMS_PINNED as [file: string, blob: string][];
const ARMS_SAID = ARMS_PINNED_SAID as [file: string, blob: string];
const ARMS_AT = ARMS_PINNED_AT as { repo: string; commit: string; dir: string };
const PHOTOS = PINNED as [file: string, blob: string, commit?: string][];
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
/** A sheet written by hand, as the game is given it: with everything that such a sheet has. */
type Written = ProfileFile & Required<Pick<ProfileFile, 'official' | 'about' | 'times' | 'photos' | 'read'>> & { flag: Required<Pick<NonNullable<ProfileFile['flag']>, 'adopted' | 'ratio' | 'text' | 'parts'>> & NonNullable<ProfileFile['flag']> };
/** What is written of a country by hand: the same, with each photograph named by its title in Commons. */
interface Source extends Omit<Written, 'v' | 'photos' | 'times'> {
  photos: { file: string; es: string; en: string; by?: string; focus?: [number, number] }[];
  times: (Omit<ProfileTime, 'picture'> & { picture?: { file: string; es: string; en: string } })[];
}
const sourceOf = (id: string) => json<Source>(`${SOURCES}/${id}.json`);
const photosOf = (sheet: ProfileFile): ProfilePhoto[] => [...(sheet.photos ?? []), ...(sheet.times ?? []).flatMap((time) => (time.picture ? [time.picture] : []))];
const files = (dir: string) => fs.readdirSync(path.join(ROOT, dir)).filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5)).sort();
/** The countries that have a sheet, and those of them that somebody has written of by hand. */
const LANDS = INDEX.countries.filter((c) => hasProfile(c)).map((c) => c.id);
const WRITTEN = files(SOURCES);
const has = (id: string) => LANDS.includes(id);

beforeEach(() => setLang('es'));

describe('which countries have a sheet', () => {
  it('are all that have a flag: every State and every territory, and nothing else', () => {
    expect(LANDS).toHaveLength(249);
    expect(files(SHEETS)).toEqual([...LANDS].sort());
    for (const id of ['BR', 'ES', 'VA', 'XK', 'EH', 'GI', 'AQ']) expect(has(id), id).toBe(true);
    // The two patches of ice that are nobody's have no flag to open a sheet by.
    const none = INDEX.countries.filter((c) => !hasProfile(c)).map((c) => c.id);
    expect(none.sort()).toEqual(['X1', 'X2']);
    expect(hasProfile(undefined)).toBe(false);
    // Those written by hand are countries of the game.
    expect(WRITTEN).toEqual(['BR']);
    for (const id of WRITTEN) expect(has(id), id).toBe(true);
  });

  it('are named in the address of the gallery after the page of the countries', () => {
    expect(profileRest('BR')).toBe('paises/BR');
    expect(profileIn(profileRest('BR'), has)).toBe('BR');
    expect(profileIn('paises/br', has)).toBe('BR');
    expect(profileIn('countries/BR', has)).toBe('BR');
    expect(profileIn('Countries/Br', has)).toBe('BR');
    expect(profileIn('paises/AR', has)).toBe('AR');
    // The gallery alone, what is no country with a flag, another page of it, and what says more than a country.
    expect(profileIn('paises', has)).toBeNull();
    expect(profileIn('', has)).toBeNull();
    expect(profileIn('paises/X1', has)).toBeNull();
    expect(profileIn('paises/ZZ', has)).toBeNull();
    expect(profileIn('paises/Brasil', has)).toBeNull();
    expect(profileIn('regiones/BR', has)).toBeNull();
    expect(profileIn('ciudades/BR', has)).toBeNull();
    expect(profileIn('paises/BR/mas', has)).toBeNull();
    expect(profileIn('juegos/BR', has)).toBeNull();
    // Whoever is asked decides: with nobody that has a sheet, no address names one.
    expect(profileIn('paises/BR', () => false)).toBeNull();
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

describe('what a sheet says in words of how many there are', () => {
  it('counts the ones a country borders by what they are, and names one alone', () => {
    expect(bordersText(4, 1)).toBe('Limita con 5 países y territorios');
    expect(bordersText(8, 0)).toBe('Limita con 8 países');
    expect(bordersText(0, 2)).toBe('Limita con 2 territorios');
    expect(bordersText(1, 0)).toBe('Limita con un país');
    expect(bordersText(0, 1)).toBe('Limita con un territorio');
    setLang('en');
    expect(bordersText(4, 1)).toBe('Borders 5 countries and territories');
    expect(bordersText(8, 0)).toBe('Borders 8 countries');
    expect(bordersText(1, 0)).toBe('Borders one country');
    expect(bordersText(0, 1)).toBe('Borders one territory');
  });

  it('says of how many of its divisions the flags are, so that the ones shown are not taken for all', () => {
    const provinces = { n: 52, es: 'provincias', en: 'provinces' };
    expect(regionsText(52, provinces)).toBe('Las de sus 52 provincias');
    expect(regionsText(43, provinces)).toBe('Las de 43 de sus 52 provincias');
    expect(regionsText(1, { n: 75, es: 'distritos', en: 'districts' })).toBe('La de 1 de sus 75 distritos');
    // With no word for its divisions, they are regions; and all the flags there are, are of them.
    expect(regionsText(7, undefined)).toBe('Las de sus 7 regiones');
    setLang('en');
    expect(regionsText(27, { n: 27, es: 'estados', en: 'states' })).toBe('Those of its 27 states');
    expect(regionsText(43, provinces)).toBe('Those of 43 of its 52 provinces');
    expect(regionsText(1, { n: 75, es: 'distritos', en: 'districts' })).toBe('That of 1 of its 75 districts');
    expect(regionsText(7, undefined)).toBe('Those of its 7 regions');
  });

  it('leads to the flags of its towns: of how many, or of its capital alone', () => {
    expect(townsText([{ kind: 'capital' }, { kind: 'city' }, { kind: 'city' }])).toBe('Ver las de 3 ciudades');
    expect(townsText([{ kind: 'capital' }])).toBe('Ver la de su capital');
    expect(townsText([{ kind: 'city' }])).toBe('Ver la de una ciudad');
    setLang('en');
    expect(townsText([{ kind: 'capital' }, { kind: 'city' }])).toBe('See those of 2 cities');
    expect(townsText([{ kind: 'capital' }])).toBe('See that of its capital');
    expect(townsText([{ kind: 'city' }])).toBe('See that of one city');
  });
});

describe('whom a country borders', () => {
  const byId = new Map(INDEX.countries.map((c) => [c.id, c]));
  const names = (id: string, lang: 'es' | 'en'): string[] => {
    setLang(lang);
    return neighboursOf(byId.get(id)!, byId).map((other) => byId.get(other)!.n[lang] ?? byId.get(other)!.n.es);
  };

  it('lists them by their name in the language of the game, and not by their code', () => {
    // As the game keeps them: Peru (PE) before Paraguay (PY), Austria (AT) before Germany (DE).
    expect(byId.get('BR')!.nb).toEqual(['AR', 'BO', 'CO', 'GF', 'GY', 'PE', 'PY', 'SR', 'UY', 'VE']);
    expect(names('BR', 'es')).toEqual(['Argentina', 'Bolivia', 'Colombia', 'Guayana Francesa', 'Guyana', 'Paraguay', 'Perú', 'Surinam', 'Uruguay', 'Venezuela']);
    expect(names('CH', 'es')).toEqual(['Alemania', 'Austria', 'Francia', 'Italia', 'Liechtenstein']);
    expect(names('CH', 'en')).toEqual(['Austria', 'France', 'Germany', 'Italy', 'Liechtenstein']);
    expect(names('BR', 'en')).toEqual(['Argentina', 'Bolivia', 'Colombia', 'French Guiana', 'Guyana', 'Paraguay', 'Peru', 'Suriname', 'Uruguay', 'Venezuela']);
    // The list of the game is left as it was.
    expect(byId.get('BR')!.nb).toEqual(['AR', 'BO', 'CO', 'GF', 'GY', 'PE', 'PY', 'SR', 'UY', 'VE']);
  });

  it('leaves out what the game does not have, and is empty for an island', () => {
    expect(neighboursOf({ nb: ['ES', 'ZZ', 'PT'] }, byId)).toEqual(['ES', 'PT']);
    expect(neighboursOf(byId.get('IS')!, byId)).toEqual([]);
    expect(neighboursOf({}, byId)).toEqual([]);
  });

  it('is every neighbour of every country, each once', () => {
    setLang('es');
    for (const country of INDEX.countries) {
      const said = neighboursOf(country, byId);
      expect([...said].sort(), country.id).toEqual([...(country.nb ?? [])].filter((id) => byId.has(id)).sort());
    }
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

  it('gives its year, as does a year alone', () => {
    expect(yearOfDay('1889-11-19')).toBe(1889);
    expect(yearOfDay('1866')).toBe(1866);
    expect(yearOfDay('')).toBeNull();
    expect(yearOfDay('hace mucho')).toBeNull();
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

  it('is told by a ring where the country is too small to be seen', () => {
    const at = (id: string) => locator(world, id, INDEX.countries.find((c) => c.id === id)!.lp, 220)!;
    // A spot of colour that the eye finds needs none.
    for (const id of ['BR', 'ES', 'RU', 'UY', 'IE', 'AT', 'KR']) expect(at(id).ring, id).toBeNull();
    // Kiribati is specks over an ocean as wide as a continent: what counts is how much is drawn, not how far apart.
    expect(at('KI').ring).not.toBeNull();
    for (const id of ['VA', 'MC', 'SM', 'NR', 'TV', 'MT', 'SG', 'LU', 'LB', 'GI']) {
      const drawn = at(id);
      expect(drawn.ring, id).not.toBeNull();
      // Where the country is: on the line down the middle of the globe, which is turned to face it, above
      // its middle if the country is north of the equator and below if south.
      const [x, y] = drawn.ring!;
      const north = INDEX.countries.find((c) => c.id === id)!.lp[1] > 0;
      expect(Math.abs(x - 110), id).toBeLessThan(6);
      expect(y, id).toBeGreaterThan(20);
      expect(y, id).toBeLessThan(200);
      expect(y < 110, id).toBe(north);
    }
  });

  it('is drawn for countries of every kind: across the line where the day changes, at a pole, an island', () => {
    for (const id of ['FJ', 'KI', 'NZ', 'US', 'AQ', 'GL', 'SJ', 'BV', 'PN', 'EH', 'XK', 'PS', 'TF', 'HM', 'UM'].filter(has)) {
      const country = INDEX.countries.find((c) => c.id === id)!;
      const drawn = locator(world, id, country.lp, 220);
      expect(drawn, id).not.toBeNull();
      expect(drawn!.own.length > 0 || drawn!.ring !== null, id).toBe(true);
    }
  }, 30_000);
});

describe('the flags a country flew before', () => {
  it('are those the game has of it, the oldest first', () => {
    const cards = flownCards('BR', FLAGS, INDEX, '/');
    expect(cards.map((card) => card.years)).toEqual([
      [1889, 1889],
      [1889, 1960],
      [1960, 1968],
      [1968, 1992],
    ]);
    for (const card of cards) expect(card).toMatchObject({ kind: 'past', id: 'BR' });
    const all = flownCards('US', FLAGS, INDEX, '/');
    expect(all.length).toBeGreaterThan(20);
    const from = all.map((card) => card.years![0]);
    expect(from).toEqual([...from].sort((a, b) => a - b));
  });

  it('are none for a country the game has no earlier flag of', () => {
    expect(FLAGS.past?.AD).toBeUndefined();
    expect(flownCards('AD', FLAGS, INDEX, '/')).toEqual([]);
    expect(flownCards('ZZ', FLAGS, INDEX, '/')).toEqual([]);
  });
});

/** A text that says something, with no space at its ends nor two together, and nothing left of how a wiki writes. */
const clean = (text: unknown, what: string) => {
  expect(typeof text, what).toBe('string');
  const said = text as string;
  expect(said.length, what).toBeGreaterThan(0);
  expect(said, what).toBe(said.trim());
  expect(said, what).not.toMatch(/\s{2}|[{}[\]<>|=]|\n|https?:|&\w+;|''/);
};
/** A text in one language of the game or in both, each clean. */
const cleanIn = (said: { es?: string; en?: string } | undefined, what: string) => {
  if (said === undefined) return;
  expect(Object.keys(said).length, what).toBeGreaterThan(0);
  for (const [lang, text] of Object.entries(said)) {
    expect(['es', 'en'], what).toContain(lang);
    clean(text, `${what} (${lang})`);
  }
};

describe('the sheet of every country', () => {
  const sheets = LANDS.map((id) => sheetOf(id));

  it('is of its country, and says only what a sheet says', () => {
    const known = ['v', 'id', 'official', 'local', 'localLang', 'motto', 'anthem', 'about', 'lead', 'flag', 'times', 'photos', 'arms', 'read', 'readFlag'];
    const ofFlag = ['of', 'adopted', 'changed', 'ratio', 'colours', 'called', 'by', 'text', 'lead', 'parts'];
    for (const [i, sheet] of sheets.entries()) {
      expect(sheet.v, LANDS[i]).toBe(1);
      expect(sheet.id).toBe(LANDS[i]);
      for (const key of Object.keys(sheet)) expect(known, `${sheet.id}.${key}`).toContain(key);
      for (const key of Object.keys(sheet.flag ?? {})) expect(ofFlag, `${sheet.id}.flag.${key}`).toContain(key);
      // Only what somebody wrote by hand has texts and times; and of photographs, the others have at most the one chosen for their head.
      if (!WRITTEN.includes(sheet.id)) {
        for (const key of ['about', 'times'] as const) expect(sheet[key], `${sheet.id}.${key}`).toBeUndefined();
        expect(sheet.photos?.length ?? 0, `${sheet.id}.photos`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('has at its head the photograph that was chosen for it, as it was chosen, light enough and with whose it is', () => {
    const { _: note, ...chosen } = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/data/profiles-heads.json'), 'utf8')) as Record<string, { file: string; es: string; en: string; by?: string; focus?: [number, number] }> & { _: string };
    expect(typeof note).toBe('string');
    const ids = Object.keys(chosen);
    // The file is written by hand, one country to a line and in order; and every country it names is one of the game.
    expect(ids).toEqual([...ids].sort());
    for (const id of ids) expect(LANDS, id).toContain(id);
    // The first lot: the countries where Spanish is spoken, and the most populous of the rest. The second: the rest of Europe, and ten more.
    expect(ids.length).toBeGreaterThanOrEqual(100);
    for (const id of ['ES', 'MX', 'AR', 'CO', 'PE', 'CL', 'US', 'CN', 'IN', 'JP', 'DE', 'FR', 'GB', 'IT']) expect(ids, id).toContain(id);
    for (const id of ['PT', 'NL', 'GR', 'SE', 'PL', 'CH', 'AT', 'IE', 'VA', 'XK', 'CA', 'MA', 'SA']) expect(ids, id).toContain(id);
    // Every State of Europe has one.
    const europe = INDEX.countries.filter((c) => c.ct === 'EU' && c.cl !== 'dep' && hasProfile(c)).map((c) => c.id);
    expect(europe.length).toBeGreaterThanOrEqual(44);
    for (const id of europe) expect(ids, id).toContain(id);
    const seen = new Set<string>();
    for (const sheet of sheets) {
      if (WRITTEN.includes(sheet.id)) continue;
      const head = chosen[sheet.id];
      if (!head) {
        expect(sheet.photos, sheet.id).toBeUndefined();
        continue;
      }
      expect(sheet.photos, sheet.id).toHaveLength(1);
      const photo = sheet.photos![0];
      expect(photo.title, sheet.id).toBe(head.file);
      expect([photo.es, photo.en], sheet.id).toEqual([head.es, head.en]);
      for (const text of [photo.es, photo.en]) {
        expect(text.length, `${sheet.id}: ${text}`).toBeGreaterThan(3);
        expect(text.length, `${sheet.id}: ${text}`).toBeLessThanOrEqual(100);
        // What is seen, said as a name is: no full stop.
        expect(text, sheet.id).toMatch(/^\p{Lu}.*[^.]$/u);
      }
      expect(photo.focus, sheet.id).toEqual(head.focus);
      // Each country its own: no photograph is at the head of two sheets.
      expect(seen.has(photo.file), `${sheet.id}: ${photo.title}`).toBe(false);
      seen.add(photo.file);
      expect(photo.file, photo.title).toMatch(/^[0-9a-f]{10}$/);
      expect(photo.title).toMatch(/\.jpe?g$/i);
      // Twice as wide as tall is how it is shown on a wide screen: one much taller or much wider than that loses most of itself.
      expect(photo.w / photo.h, photo.title).toBeGreaterThanOrEqual(1.25);
      expect(photo.w / photo.h, photo.title).toBeLessThanOrEqual(2.4);
      expect(photo.sizes, photo.title).toEqual(WIDTHS.chosen.filter((w) => w <= photo.w));
      expect(photo.sizes.at(-1), photo.title).toBe(1280);
      for (const w of photo.sizes) {
        const file = path.join(ROOT, PICTURES, `${photo.file}-${w}.webp`);
        expect(fs.existsSync(file), file).toBe(true);
        const bytes = fs.statSync(file).size;
        expect(bytes, `${photo.title} ${w}`).toBeGreaterThan(2_000);
        expect(bytes, `${photo.title} ${w}`).toBeLessThan(300_000);
        expect(fs.readFileSync(file).subarray(8, 12).toString('latin1')).toBe('WEBP');
      }
      // Free to show and to make smaller, and said as its licence asks.
      expect(photo.licence, photo.title).toMatch(/^(CC0|CC BY(-SA)? \d\.\d|Public domain)/);
      if (photo.licence.startsWith('CC')) expect(photo.licenceUrl, photo.title).toMatch(/^https:\/\/creativecommons\.org\//);
      if (/^CC BY/.test(photo.licence)) expect(photo.by?.trim(), photo.title).toBeTruthy();
      // A name, not all that the page of the file tells of how it was made.
      if (photo.by) {
        expect(photo.by.length, photo.by).toBeLessThanOrEqual(60);
        expect(photo.by, photo.title).not.toMatch(/\(\s|\s\)|\s,|\.jpe?g|talk|more photos/i);
      }
    }
    expect(seen.size).toBe(ids.filter((id) => !WRITTEN.includes(id)).length);
  });

  it('names the country in full, and says its motto and its anthem, in words that read clean', () => {
    for (const sheet of sheets) {
      const { id } = sheet;
      cleanIn(sheet.official, `${id} official`);
      cleanIn(sheet.anthem, `${id} anthem`);
      if (sheet.local !== undefined) {
        clean(sheet.local, `${id} local`);
        expect(sheet.localLang, id).toMatch(/^[a-z]{2,3}$/);
      } else expect(sheet.localLang, id).toBeUndefined();
      if (sheet.motto) {
        const { text, lang, ...means } = sheet.motto;
        clean(text, `${id} motto`);
        if (lang !== undefined) expect(lang, id).toMatch(/^[a-z]{2,3}$/);
        if (Object.keys(means).length) cleanIn(means, `${id} motto means`);
        // A motto said in a language of the game means what it says.
        if (lang === 'es') expect(means.es, id).toBe(text);
        if (lang === 'en') expect(means.en, id).toBe(text);
        // No slogan of a tourist board, which is what Wikidata often calls a motto.
        expect(text, id).not.toMatch(/visit|discover|tourism|experience|magical|wonder|timeless|inspired by/i);
      }
    }
    const count = (of: (sheet: ProfileFile) => unknown) => sheets.filter((sheet) => of(sheet)).length;
    // As many as the sources give: a fall here is a source read worse than it was.
    expect(count((s) => s.official?.es)).toBeGreaterThanOrEqual(232);
    expect(count((s) => s.official?.en)).toBeGreaterThanOrEqual(236);
    expect(count((s) => s.motto)).toBeGreaterThanOrEqual(160);
    expect(count((s) => s.motto?.es)).toBeGreaterThanOrEqual(158);
    expect(count((s) => s.motto?.en)).toBeGreaterThanOrEqual(155);
    expect(count((s) => s.anthem)).toBeGreaterThanOrEqual(233);
    // Every State of the United Nations is named in full in both languages.
    for (const sheet of sheets) if (INDEX.countries.find((c) => c.id === sheet.id)?.cl === 'un') expect(Object.keys(sheet.official ?? {}).sort(), sheet.id).toEqual(['en', 'es']);
  });

  it('says of its flag the day it was adopted, its proportions and its colours as they are written', () => {
    for (const sheet of sheets) {
      const { id, flag } = sheet;
      if (!flag) continue;
      if (flag.adopted !== undefined) {
        expect(yearOfDay(flag.adopted), `${id} ${flag.adopted}`).not.toBeNull();
        expect(flag.adopted.length === 4 || isDay(flag.adopted), `${id} ${flag.adopted}`).toBe(true);
        // No flag is said to be adopted after today, nor before any flag was.
        expect(yearOfDay(flag.adopted)!, id).toBeGreaterThan(1200);
        expect(yearOfDay(flag.adopted)!, id).toBeLessThanOrEqual(2026);
      }
      if (flag.changed !== undefined) {
        expect(flag.changed.length === 4 || isDay(flag.changed), `${id} ${flag.changed}`).toBe(true);
        expect(flag.adopted, id).toBeDefined();
        expect(yearOfDay(flag.changed)!, id).toBeGreaterThanOrEqual(yearOfDay(flag.adopted!)!);
        expect(yearOfDay(flag.changed)!, id).toBeLessThanOrEqual(2026);
      }
      if (flag.ratio !== undefined) {
        expect(flag.ratio, id).toMatch(/^\d+(\.\d+)?:\d+(\.\d+)?$/);
        const [h, w] = flag.ratio.split(':').map(Number);
        // Height to width: no flag of a country is taller than it is wide but for a hair, and none is four times as wide.
        expect(h / w, `${id} ${flag.ratio}`).toBeGreaterThan(0.35);
        expect(h / w, `${id} ${flag.ratio}`).toBeLessThanOrEqual(1);
      }
      if (flag.colours) {
        expect(flag.colours.es.length, id).toBeGreaterThanOrEqual(2);
        expect(flag.colours.en, id).toHaveLength(flag.colours.es.length);
        for (const name of [...flag.colours.es, ...flag.colours.en]) expect(name, id).toMatch(/^[a-záéíóúñ ]+$/);
        expect(new Set(flag.colours.es).size, id).toBe(flag.colours.es.length);
      }
      cleanIn(flag.by, `${id} flag by`);
    }
    const count = (of: (sheet: ProfileFile) => unknown) => sheets.filter((sheet) => of(sheet)).length;
    expect(count((s) => s.flag?.adopted)).toBeGreaterThanOrEqual(228);
    expect(count((s) => s.flag?.ratio)).toBeGreaterThanOrEqual(238);
    expect(count((s) => s.flag?.colours)).toBeGreaterThanOrEqual(225);
  });

  it('says its flag is as it is since the year the game has its last earlier flag lowered', () => {
    for (const sheet of sheets) {
      if (!sheet.flag?.changed || WRITTEN.includes(sheet.id)) continue;
      const lowered = (FLAGS.past?.[sheet.id] ?? []).map((row) => row[3]);
      expect(lowered.length, sheet.id).toBeGreaterThan(0);
      expect(Math.abs(yearOfDay(sheet.flag.changed)! - Math.max(...lowered)), sheet.id).toBeLessThanOrEqual(1);
    }
  });

  it('says whose flag it is of the territories that the game draws with the flag of their country, and of that flag the same as that country', () => {
    const byId = new Map(INDEX.countries.map((c) => [c.id, c]));
    // The game knows which they are (lib/pairs.ts): the territories among the flags that are the same as another.
    const drawn = Object.entries(SAME_FLAG).filter(([id]) => byId.get(id)?.cl === 'dep');
    expect(drawn.map(([id]) => id).sort()).toEqual(['BL', 'BQ', 'BV', 'GF', 'GP', 'HM', 'MF', 'PM', 'RE', 'SH', 'SJ', 'WF', 'YT']);
    const said = sheets.filter((sheet) => sheet.flag?.of !== undefined).map((sheet) => [sheet.id, sheet.flag!.of]);
    expect(said.sort()).toEqual(drawn.sort());
    for (const [id, of] of drawn) {
      // The country it depends on, whose sheet it leads to.
      expect(byId.get(id)?.sov, id).toBe(of);
      expect(has(of), of).toBe(true);
      const mine = sheetOf(id);
      const theirs = sheetOf(of);
      expect(theirs.flag?.of, of).toBeUndefined();
      const { of: _whose, ...flag } = mine.flag!;
      // What is true of a flag wherever it flies; not what somebody wrote of it for the sheet of its country.
      const { text: _text, parts: _parts, called: _called, ...facts } = theirs.flag!;
      expect(flag, id).toEqual(facts);
      expect(Object.keys(flag).length, id).toBeGreaterThanOrEqual(2);
      expect(mine.readFlag, id).toEqual(theirs.readFlag);
      // Of the territory itself, its own page.
      expect(mine.read, id).not.toEqual(theirs.read);
    }
    expect(sheetOf('RE').flag).toMatchObject({ of: 'FR', adopted: '1794-02-15', ratio: '2:3' });
    // One with a flag of its own says nothing of whose it is: New Caledonia flies the Kanak flag beside the French.
    expect(sheetOf('NC').flag).toMatchObject({ adopted: '2010', ratio: '1:2' });
    expect(sheetOf('NC').flag?.of).toBeUndefined();
    expect(sheetOf('NC').readFlag?.en).toBe('https://en.wikipedia.org/wiki/Flags_of_New_Caledonia');
  });

  it('leads to the page of the country and of its flag in the Wikipedia of each language', () => {
    for (const sheet of sheets) {
      for (const key of ['read', 'readFlag'] as const) {
        for (const [lang, url] of Object.entries(sheet[key] ?? {})) {
          expect(['es', 'en'], sheet.id).toContain(lang);
          expect(url, sheet.id).toMatch(new RegExp(`^https://${lang}\\.wikipedia\\.org/wiki/[^ ?#]+$`));
        }
      }
      // Every country has a page in both.
      expect(Object.keys(sheet.read ?? {}).sort(), sheet.id).toEqual(['en', 'es']);
    }
  });

  it('tells how Wikipedia begins to tell of the country and of its flag, where nobody has written of them: shortened, clean, and each with its page', () => {
    const count = { about: { es: 0, en: 0 }, flag: { es: 0, en: 0 } };
    /** A text of Wikipedia as a sheet may show it: a few paragraphs of whole sentences, with nothing of what plain text leaves behind. */
    const told = (lead: ProfileFile['lead'], links: { es?: string; en?: string } | undefined, max: number, what: string, n: { es: number; en: number }) => {
      if (lead === undefined) return;
      expect(Object.keys(lead).length, what).toBeGreaterThan(0);
      for (const [lang, text] of Object.entries(lead) as ['es' | 'en', string[]][]) {
        const here = `${what} (${lang})`;
        expect(['es', 'en'], here).toContain(lang);
        // The page it is from is the one the sheet leads to in that language.
        expect(links?.[lang], here).toMatch(new RegExp(`^https://${lang}\\.wikipedia\\.org/wiki/`));
        expect(text.length, here).toBeGreaterThanOrEqual(1);
        expect(text.length, here).toBeLessThanOrEqual(3);
        for (const paragraph of text) {
          expect(paragraph, here).toBe(paragraph.trim());
          expect(paragraph.length, here).toBeGreaterThanOrEqual(12);
          // It begins as a sentence does and ends where one ends.
          expect(paragraph, here).toMatch(/^[\p{Lu}\p{N}«“"¿¡(]/u);
          expect(paragraph, here).toMatch(/[.!?…][»”"')\]]*$/);
          // Nothing of what turning a page into plain text leaves: a mark that is not seen, the place of a note, a bracket left empty, a space before a comma.
          expect(paragraph, here).not.toMatch(/[\u200b-\u200f\u202a-\u202e\u00a0\u2060\ufeff]|\s{2}|\n|\[\d+\]|\[cita|\[citation|\(\s*\)|\(\s*[;,:]|[;,:]\s*\)| [,;:.!?]|[{}<>|]|https?:/);
          expect(paragraph.split('(').length, here).toBe(paragraph.split(')').length);
        }
        // As long as there is room for, and no longer; a first sentence that is longer than that is kept whole, up to a point.
        const length = text.join(' ').length;
        expect(length, here).toBeLessThanOrEqual(Math.round(max * 1.6));
        if (/[.!?…][»”"')\]]* \p{Lu}/u.test(text.join(' '))) expect(length, here).toBeLessThanOrEqual(max);
        n[lang]++;
      }
    };
    for (const sheet of sheets) {
      told(sheet.lead, sheet.read, LEAD_MAX.about, `${sheet.id} lead`, count.about);
      told(sheet.flag?.lead, sheet.readFlag, LEAD_MAX.flag, `${sheet.id} flag lead`, count.flag);
      // What somebody wrote for the game is told instead of it, never beside it.
      if (sheet.about) expect(sheet.lead, sheet.id).toBeUndefined();
      if (sheet.flag?.text) expect(sheet.flag.lead, sheet.id).toBeUndefined();
    }
    for (const id of WRITTEN) expect([sheetOf(id).lead, sheetOf(id).flag?.lead], id).toEqual([undefined, undefined]);
    // Every country nobody has written of has its page in both Wikipedias, and so its text; most flags have theirs.
    expect(count.about).toEqual({ es: sheets.length - WRITTEN.length, en: sheets.length - WRITTEN.length });
    expect(count.flag.es).toBeGreaterThanOrEqual(240);
    expect(count.flag.en).toBeGreaterThanOrEqual(240);
    expect(LEAD_MAX).toEqual({ about: 640, flag: 480 });
  });

  it('tells of the flag of a territory that flies that of its country what it tells of that flag, and of Palestine and Antarctica what was decided by hand', () => {
    for (const sheet of sheets) if (sheet.flag?.of) expect(sheet.flag.lead, sheet.id).toEqual(sheetOf(sheet.flag.of).flag?.lead);
    expect(sheetOf('RE').flag?.lead?.es?.[0]).toMatch(/^La bandera de Francia /);
    expect(sheetOf('RE').lead?.es?.[0]).toMatch(/^Reunión /);
    // The sheet of Palestine is that of the State, and so is the page its text is from: not that of the region.
    expect(sheetOf('PS').read).toEqual({ es: 'https://es.wikipedia.org/wiki/Palestina', en: 'https://en.wikipedia.org/wiki/Palestine' });
    expect(sheetOf('PS').lead?.es?.[0]).toMatch(/^Palestina, oficialmente Estado de Palestina, es un país/);
    expect(sheetOf('PS').lead?.en?.[0]).toMatch(/^Palestine, officially the State of Palestine, is a country/);
    // The page in Spanish of the flag of Antarctica begins with another flag than the one the game draws.
    expect(Object.keys(sheetOf('AQ').flag?.lead ?? {})).toEqual(['en']);
    expect(Object.keys(sheetOf('AQ').lead ?? {}).sort()).toEqual(['en', 'es']);
  });

  it('tells of a few what their pages are known to begin with, without the brackets of how they are called elsewhere', () => {
    const first = (id: string, lang: 'es' | 'en') => sheetOf(id).lead?.[lang]?.[0] ?? '';
    expect(first('ES', 'es')).toMatch(/^España, formalmente Reino de España, es un país soberano /);
    expect(first('ES', 'en')).toMatch(/^Spain, officially the Kingdom of Spain, is a country /);
    expect(first('JP', 'es')).toMatch(/^Japón es un país insular /);
    expect(first('QA', 'es')).toMatch(/^Catar, cuyo nombre oficial es Estado de Catar, es un Estado soberano /);
    expect(first('GI', 'en')).toMatch(/^Gibraltar is a British Overseas Territory /);
    expect(first('NR', 'en')).toMatch(/^Nauru, also known by its native name Naoero and officially as the Republic of Naoero, is an island country /);
    expect(sheetOf('ES').flag?.lead?.es?.[0]).toMatch(/^La bandera de España \(también conocida como la rojigualda\) fue adoptada /);
    expect(sheetOf('ES').flag?.lead?.en?.[0]).toMatch(/^The national flag of Spain, as it is defined in the Constitution of 1978, /);
  });

  it('says what a few are known to be', () => {
    const of = (id: string) => sheetOf(id);
    expect(of('ES')).toMatchObject({
      official: { es: 'Reino de España', en: 'Kingdom of Spain' },
      local: 'Reino de España',
      localLang: 'es',
      motto: { text: 'Plus ultra', lang: 'la', es: 'Más allá' },
      anthem: { es: 'Marcha Real' },
      flag: { adopted: '1785-05-28', changed: '1981-10-05', ratio: '2:3', colours: { es: ['rojo', 'amarillo'], en: ['red', 'yellow'] } },
    });
    expect(of('US').flag).toMatchObject({ adopted: '1777-06-14', changed: '1960-07-04', ratio: '10:19' });
    expect(of('FR')).toMatchObject({ official: { es: 'República Francesa', en: 'French Republic' }, local: 'République française', localLang: 'fr', motto: { text: 'Liberté, égalité, fraternité', lang: 'fr' } });
    expect(of('CH')).toMatchObject({ official: { es: 'Confederación Suiza' }, flag: { ratio: '1:1' } });
    expect(of('JP').local).toBe('日本国');
    expect(of('LK').official?.en).toBe('Democratic Socialist Republic of Sri Lanka');
    expect(of('IE')).toMatchObject({ local: 'Éire', localLang: 'ga' });
    expect(of('NO')).toMatchObject({ local: 'Kongeriket Norge', localLang: 'nb' });
    expect(of('AR').flag?.ratio).toBe('9:14');
    expect(of('GI')).toMatchObject({ motto: { lang: 'la' }, anthem: { es: 'Himno de Gibraltar · God Save the King' } });
    // Nepal's is no rectangle, and nothing is said of its proportions.
    expect(of('NP').flag?.ratio).toBeUndefined();
    // Whoever has no motto is given none.
    for (const id of ['AU', 'IT', 'MX', 'JP']) expect(of(id).motto, id).toBeUndefined();
  });
});


describe.each(WRITTEN.map((id) => [id]))('the sheet of %s, written by hand', (id) => {
  const sheet = sheetOf(id) as Written;
  const source = sourceOf(id);

  it('says what was written of the country by hand: `npm run data:profiles` has been run since', () => {
    expect(sheet.v).toBe(1);
    expect(sheet.id).toBe(id);
    expect(source.id).toBe(id);
    expect(sheet.official).toEqual(source.official);
    expect(sheet.local).toBe(source.local);
    expect(sheet.localLang).toBe(source.localLang);
    expect(sheet.about).toEqual(source.about);
    // Of the flag, what was written; of what the sources say besides, nothing that was written is changed.
    expect(sheet.flag).toMatchObject(source.flag);
    expect(sheet.flag.colours).toBeUndefined();
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
    const both = (said: { es?: string; en?: string }, what: string) => {
      expect(said.es?.trim(), `${what} (es)`).toBeTruthy();
      expect(said.en?.trim(), `${what} (en)`).toBeTruthy();
      texts.push(said.es!, said.en!);
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
    const used = new Set(
      LANDS.flatMap((land) => {
        const one = sheetOf(land);
        return [...photosOf(one).flatMap((photo) => photo.sizes.map((w) => `${photo.file}-${w}.webp`)), ...(one.arms ? [`${one.arms.file}-${one.arms.w}.webp`] : [])];
      }),
    );
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
    const odd: Written = { ...sheet, times: [{ ...sheet.times[0], gone: 'Q0', past: undefined, now: undefined }, { ...sheet.times[0], gone: undefined, past: [1, 2], now: undefined }] };
    expect(timeCards(odd, FLAGS, INDEX, '/')).toEqual([null, null]);
  });
});

describe('the coat of arms of each country', () => {
  const sheets = LANDS.map((land) => sheetOf(land));
  const { _: why, ...FIXES } = json<Record<string, { arms?: { file?: string; kind?: string; by?: string } | null; flag?: { of?: string } }> & { _: string }>('scripts/data/profiles-fixes.json');
  const shown = sheets.filter((sheet) => sheet.arms);

  it('is shown by nearly every State, and by none of the territories that the game draws with the flag of their country', () => {
    expect(typeof why).toBe('string');
    expect(shown.length).toBeGreaterThanOrEqual(220);
    const states = INDEX.countries.filter((c) => c.cl !== 'dep' && hasProfile(c)).map((c) => c.id);
    // Wikidata names none for Turkey, which has none; and of three the drawing Commons has is not one the sheet may show as it is.
    const without = states.filter((id) => !sheetOf(id).arms).sort();
    expect(without.length).toBeLessThanOrEqual(8);
    for (const id of ['ES', 'MX', 'AR', 'CO', 'PE', 'CL', 'NI', 'US', 'CN', 'IN', 'JP', 'DE', 'FR', 'GB', 'IT', 'BR', 'PT', 'CA', 'PS']) expect(sheetOf(id).arms, id).toBeDefined();
    for (const sheet of sheets) if (sheet.flag?.of) expect(sheet.arms, sheet.id).toBeUndefined();
    expect(sheetOf('AQ').arms).toBeUndefined();
  });

  it('is a small picture that fits its box, light, and named after what it is made from', () => {
    for (const { id, arms } of shown) {
      const one = arms!;
      expect(Object.keys(one).filter((key) => !['file', 'w', 'h', 'title', 'by', 'licence', 'licenceUrl', 'kind'].includes(key)), id).toEqual([]);
      expect(one.file, id).toMatch(/^[0-9a-f]{10}$/);
      expect(Number.isInteger(one.w) && Number.isInteger(one.h), id).toBe(true);
      expect(Math.max(one.w, one.h), id).toBeLessThanOrEqual(ARMS_BOX);
      // As large as its box, unless Commons has it smaller; and never a sliver.
      expect(Math.max(one.w, one.h), id).toBeGreaterThanOrEqual(200);
      expect(Math.min(one.w, one.h), id).toBeGreaterThanOrEqual(80);
      const file = path.join(ROOT, PICTURES, `${one.file}-${one.w}.webp`);
      expect(fs.existsSync(file), file).toBe(true);
      const bytes = fs.statSync(file).size;
      expect(bytes, one.title).toBeGreaterThan(1_500);
      expect(bytes, one.title).toBeLessThan(60_000);
      expect(fs.readFileSync(file).subarray(8, 12).toString('latin1')).toBe('WEBP');
    }
    expect(ARMS_BOX).toBe(264);
    // Each country its own drawing.
    expect(new Set(shown.map((sheet) => sheet.arms!.file)).size).toBe(shown.length);
  });

  it('says whose the drawing is: on free terms, and with a name wherever the terms ask for one', () => {
    const terms = new Set<string>();
    for (const { id, arms } of shown) {
      const one = arms!;
      expect(one.title.trim(), id).toBe(one.title);
      expect(one.title, id).toMatch(/\.(svg|png|jpe?g)$/i);
      expect(one.licence, one.title).toMatch(/^(CC0|CC BY(-SA)? \d\.\d|Public domain$|Attribution$)/);
      terms.add(one.licence.replace(/ \d.*$/, ''));
      if (one.licenceUrl !== undefined) expect(one.licenceUrl, one.title).toMatch(/^https:\/\//);
      if (/^CC BY/.test(one.licence)) expect(one.licenceUrl, one.title).toMatch(/^https:\/\/creativecommons\.org\/licenses\//);
      if (/^(CC BY|Attribution)/.test(one.licence)) expect(one.by?.trim(), `${id}: ${one.title}`).toBeTruthy();
      if (one.by !== undefined) {
        expect(one.by.trim(), one.title).toBe(one.by);
        expect(one.by.length, one.by).toBeGreaterThan(1);
        expect(one.by.length, one.by).toBeLessThanOrEqual(60);
        // A name, or a few: not what the page of the file tells in their place.
        expect(one.by, `${id}: ${one.title}`).not.toMatch(/\(\s|\s\)|\s,|\.(svg|png|jpe?g)|talk|file history|own work|unknown|version|https?:|\bUser:|Bot\b|…/i);
      }
    }
    expect([...terms].sort()).toEqual(['Attribution', 'CC BY', 'CC BY-SA', 'CC0', 'Public domain']);
  });

  it('is called what it is: an emblem or a seal where the country has no coat of arms', () => {
    const kinds = (kind: string | undefined) => shown.filter((sheet) => sheet.arms!.kind === kind).map((sheet) => sheet.id);
    for (const { id, arms } of shown) expect([undefined, 'emblem', 'seal'], id).toContain(arms!.kind);
    expect(kinds(undefined).length).toBeGreaterThan(140);
    for (const id of ['ES', 'MX', 'DE', 'GB', 'PT', 'AR', 'BR', 'RU', 'PL']) expect(kinds(undefined), id).toContain(id);
    for (const id of ['CN', 'IN', 'IT', 'FR', 'IL', 'KR', 'VN', 'AF', 'LA']) expect(kinds('emblem'), id).toContain(id);
    for (const id of ['JP', 'MG', 'PW', 'LY', 'GU']) expect(kinds('seal'), id).toContain(id);
  });

  it('is the one somebody chose by hand where what Wikidata names is not the one, and none where it names what is not one', () => {
    const chosen = Object.entries(FIXES).filter(([, fix]) => typeof fix.arms?.file === 'string');
    expect(chosen.map(([id]) => id).sort()).toEqual(['BF', 'ES', 'LA', 'PS']);
    for (const [id, fix] of chosen) expect(sheetOf(id).arms?.title, id).toBe(fix.arms!.file);
    expect(sheetOf('ES').arms).toMatchObject({ title: 'Escudo de España (mazonado).svg', licence: 'Public domain' });
    // Who drew it, where Commons tells it in more words than fit, or in none.
    for (const [id, fix] of Object.entries(FIXES)) if (fix.arms?.by) expect(sheetOf(id).arms?.by, id).toBe(fix.arms.by);
    // The arms of a family that owned the islands, a photograph where a drawing is wanted, and a drawing that is asked to be deleted.
    const none = Object.entries(FIXES).filter(([, fix]) => fix.arms === null).map(([id]) => id).sort();
    expect(none).toEqual(['CC', 'NU', 'TG']);
    for (const id of none) expect(sheetOf(id).arms, id).toBeUndefined();
    // Nobody says anything of the coat of arms of a territory that shows none.
    for (const [id, fix] of Object.entries(FIXES)) if (fix.flag?.of) expect(fix.arms, id).toBeUndefined();
  });

  it('is fetched to make the sheets: the ones they show, each pinned by what it holds', () => {
    expect(ARMS_AT.repo).toBe('diegosb72/regionle');
    expect(ARMS_AT.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(ARMS_SAID[0]).toBe('arms/arms.json');
    for (const [file, blob] of [ARMS_SAID, ...ARMS]) expect(blob, file).toMatch(/^[0-9a-f]{40}$/);
    for (const [file] of ARMS) expect(file).toMatch(/^arms\/files\/[0-9a-f]{40}\.330\.(png|jpg)$/);
    expect(ARMS.map(([file]) => path.basename(file).slice(0, 10)).sort()).toEqual(shown.map((sheet) => sheet.arms!.file).sort());
  });
});

describe('the photographs that are fetched to make the sheets', () => {
  it('are the ones the sheets show, each pinned by what it holds', () => {
    expect(PHOTOS_AT.repo).toBe('diegosb72/regionle');
    expect(PHOTOS_AT.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(PHOTOS_SAID[0]).toBe('photos/photos.json');
    for (const [file, blob, commit] of [PHOTOS_SAID, ...PHOTOS]) {
      expect(blob, file).toMatch(/^[0-9a-f]{40}$/);
      // One that Wikimedia has drawn again since says where it is as it was brought: at an earlier commit, and not the one of the rest.
      if (commit !== undefined) {
        expect(commit, file).toMatch(/^[0-9a-f]{40}$/);
        expect(commit, file).not.toBe(PHOTOS_AT.commit);
      }
    }
    expect(PHOTOS_SAID).toHaveLength(2);
    for (const [file] of PHOTOS) expect(file).toMatch(/^photos\/files\/[0-9a-f]{40}\.1920\.(jpg|png)$/);
    // Under the SHA-1 of its original, whose first figures are what its pictures are named after.
    const pinned = PHOTOS.map(([file]) => path.basename(file).slice(0, 10)).sort();
    const shown = LANDS.flatMap((land) => photosOf(sheetOf(land)).map((photo) => photo.file)).sort();
    expect(pinned).toEqual(shown);
  });
});
