/**
 * The sheets of the countries (lib/profiles.ts): which countries have one and how its address is written,
 * the place of a country among the States, the flags of its times and where it is on the globe; and the
 * sheets themselves, as the game is given them — that every country with a flag has one, that none says
 * anything that is not what it is said to be, that those written by hand say what was written, that every
 * photograph is there at every width it is said to have, with whose it is, that the coat of arms each shows
 * is one that may be shown, with whose its drawing is, and that the flags of its times are flags the game has.
 */
import { createHash } from 'node:crypto';
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
import { countryFlags, type CreditsFile, type FlagsFile } from './flags';
import { setLang } from './i18n';
import { SAME_FLAG } from './pairs';
import { locator } from './profileMap';
import { bordersText, flownCards, hasProfile, isDay, neighboursOf, photoSet, photoSrc, profileIn, profileRest, rankOf, regionsText, timeCards, townsText, yearOfDay, type ProfileFile, type ProfilePhoto, type ProfileTime, type Said } from './profiles';
import type { Country, Geo, Index } from './types';

const WIDTHS = WIDTHS_SAID as { head: number[]; photo: number[]; time: number[]; chosen: number[] };
const LEAD_MAX = LEAD_MAX_SAID as { about: number; flag: number };
const ARMS_BOX = ARMS_BOX_SAID as number;
const ARMS = ARMS_PINNED as [file: string, blob: string][];
const ARMS_SAID = ARMS_PINNED_SAID as [file: string, blob: string];
const ARMS_AT = ARMS_PINNED_AT as { repo: string; commit: string; dir: string };
const PHOTOS = PINNED as [file: string, blob: string, commit?: string][];
const PHOTOS_SAID = PINNED_SAID as [file: string, blob: string, commit?: string];
const PHOTOS_AT = PINNED_AT as { repo: string; commit: string; dir: string };

const ROOT = process.cwd();
const json = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')) as T;
const INDEX = json<Index>('public/data/index.json');
const FLAGS = json<FlagsFile>('public/data/flags.json');
const CREDITS = json<CreditsFile>('public/data/flag-credits.json');
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
/** Bilingual, independently sourced accounts added to generated sheets without inventing flag periods. */
const CURATED = ['AQ', 'BV', 'GS', 'HM', 'TF'] as const;
/** Small batches of Commons galleries, always after the chosen head. */
const GALLERIED = ['AQ', 'BV', 'GS', 'HM', 'KE', 'TF', 'TZ', 'UG', 'RW', 'BI', 'CD', 'ZM', 'AO', 'NA'] as const;
/** Commons gallery photographs after the chosen head, with captions/credits checked on each file's page. */
type GallerySource = { file: string; es: string; en: string; by?: string };
const GALLERY = Object.fromEntries(Object.entries(json<Record<string, unknown>>('scripts/data/profiles-gallery.json')).filter(([id]) => id !== '_')) as Record<string, GallerySource[]>;
/** Reviewed photos from the owner's archive, after all existing heads and Commons galleries. */
type ReleasePhoto = ProfilePhoto & { sha256: string };
const RELEASE_FILE = json<{ countries: Record<string, ReleasePhoto[]>; excluded: { id: string; title: string; reason: string }[] }>('scripts/data/release-gallery.json');
const RELEASE = RELEASE_FILE.countries;
const FIXES = json<Record<string, Partial<ProfileFile>>>('scripts/data/profiles-fixes.json');
/** Independent, sourced timelines: these add to the generated sheets rather than replacing them. */
const TIMELINE_FILE = json<Record<string, unknown>>('scripts/data/profiles-times.json');
type TimeSource = Omit<ProfileTime, 'picture'> & { picture?: { file: string; by?: string; es: string; en: string } };
const { _: TIMELINE_REASON, ...TIMELINES } = TIMELINE_FILE as { _: string } & Record<string, { source: string; note?: Said; times: TimeSource[] }>;
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
    const known = ['v', 'id', 'official', 'local', 'localLang', 'motto', 'anthem', 'about', 'sources', 'lead', 'flag', 'times', 'timeSource', 'timeNote', 'photos', 'arms', 'read', 'readFlag'];
    const ofFlag = ['of', 'adopted', 'changed', 'ratio', 'colours', 'called', 'by', 'drawing', 'text', 'lead', 'parts'];
    for (const [i, sheet] of sheets.entries()) {
      expect(sheet.v, LANDS[i]).toBe(1);
      expect(sheet.id).toBe(LANDS[i]);
      for (const key of Object.keys(sheet)) expect(known, `${sheet.id}.${key}`).toContain(key);
      for (const key of Object.keys(sheet.flag ?? {})) expect(ofFlag, `${sheet.id}.flag.${key}`).toContain(key);
      // Brazil alone has a complete hand-written sheet; five more have sourced text and a checked gallery, not invented flag periods.
      if (!WRITTEN.includes(sheet.id)) {
        if (!CURATED.some((id) => id === sheet.id)) expect(sheet.about, `${sheet.id}.about`).toBeUndefined();
        if (TIMELINES[sheet.id]) expect(sheet.times?.length, `${sheet.id}.times`).toBe(TIMELINES[sheet.id].times.length);
        else expect(sheet.times, `${sheet.id}.times`).toBeUndefined();
        expect(sheet.photos?.length ?? 0, `${sheet.id}.photos`).toBeLessThanOrEqual(1 + (GALLERY[sheet.id]?.length ?? 0) + (RELEASE[sheet.id]?.length ?? 0));
      }
    }
  });

  it('has at its head the photograph that was chosen for it, as it was chosen, light enough and with whose it is', () => {
    const { _: note, ...chosen } = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/data/profiles-heads.json'), 'utf8')) as Record<string, { file: string; es: string; en: string; by?: string; byUrl?: string; focus?: [number, number] }> & { _: string };
    expect(typeof note).toBe('string');
    const ids = Object.keys(chosen);
    // The file is written by hand, one country to a line and in order; and every country it names is one of the game.
    expect(ids).toEqual([...ids].sort());
    for (const id of ids) expect(LANDS, id).toContain(id);
    // Every State and territory now has a photograph (Brazil's is in its hand-written sheet).
    const states = INDEX.countries.filter((c) => c.cl !== 'dep' && hasProfile(c)).map((c) => c.id);
    const territories = INDEX.countries.filter((c) => c.cl === 'dep' && hasProfile(c)).map((c) => c.id);
    expect(states).toHaveLength(198);
    expect(territories).toHaveLength(51);
    expect(ids).toHaveLength(248);
    expect([...WRITTEN, ...ids].sort()).toEqual([...states, ...territories].sort());
    for (const id of territories) expect(ids, id).toContain(id);
    // The Åland attachment calls it «ala»; the game's sheet is AX.
    expect(chosen.AX.file).toBe('Аландские острова - panoramio.jpg');
    // The search for Kingston returned Canadian places, so Norfolk's file was verified directly in Commons.
    expect(chosen.NF.file).toBe('Kingston, Norfolk Island.jpg');
    // Credits that Commons explicitly requires, not merely the uploader's account name.
    expect(chosen.MO).toMatchObject({ by: 'Diego Delso, delso.photo', byUrl: 'https://delso.photo/' });
    expect(chosen.MS.by).toBe('Andrew Shiva / Wikipedia');
    // The first lot: the Spanish-speaking countries and the most populous of the rest. The second: the rest of Europe, and ten more. The third: the next fifty by population.
    for (const id of ['ES', 'MX', 'AR', 'CO', 'PE', 'CL', 'US', 'CN', 'IN', 'JP', 'DE', 'FR', 'GB', 'IT']) expect(ids, id).toContain(id);
    for (const id of ['PT', 'NL', 'GR', 'SE', 'PL', 'CH', 'AT', 'IE', 'VA', 'XK', 'CA', 'MA', 'SA']) expect(ids, id).toContain(id);
    // Nobody is silently skipped, even when the search for a place's name returned pictures of another place.
    const third = 'MG CI CM NP NE AU KP SY ML BF TW MW ZM LK TD KZ SO SN KH ZW GN BJ RW BI TN SS HT JO AE TJ PG AZ IL SL TG LA TM LY KG CG SG LB LR CF OM PS NZ MR KW GE'.split(' ');
    expect(third).toHaveLength(50);
    for (const id of third) expect(ids, id).toContain(id);
    expect(chosen.LK.file).toBe('Sigiriya Rock fortress.jpg');
    expect(chosen.PS.by).toBe('Andrew Shiva / Wikipedia');
    // Every State of Europe has one.
    const europe = INDEX.countries.filter((c) => c.ct === 'EU' && c.cl !== 'dep' && hasProfile(c)).map((c) => c.id);
    expect(europe.length).toBeGreaterThanOrEqual(44);
    for (const id of europe) expect(ids, id).toContain(id);
    const seen = new Set<string>();
    for (const sheet of sheets) {
      if (WRITTEN.includes(sheet.id)) continue;
      const head = chosen[sheet.id];
      expect(head, sheet.id).toBeDefined();
      expect(sheet.photos, sheet.id).toHaveLength(1 + (GALLERY[sheet.id]?.length ?? 0) + (RELEASE[sheet.id]?.length ?? 0));
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
      if (head.by) expect(photo.by, sheet.id).toBe(head.by);
      expect(photo.byUrl, sheet.id).toBe(head.byUrl);
      if (photo.byUrl) expect(photo.byUrl, sheet.id).toMatch(/^https:\/\//);
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

  it('says its flag is as it is since the last earlier flag was lowered, when that catalogue range records a replacement', () => {
    for (const sheet of sheets) {
      if (!sheet.flag?.changed || WRITTEN.includes(sheet.id)) continue;
      // HN's 1949 statute specified today's turquoise and arrangement; the catalogue's 2022–2026
      // range records governments switching between shades, not a new legal national flag.
      if (sheet.id === 'HN') {
        expect(sheet.flag.changed).toBe('1949-01-26');
        expect(sheet.timeNote?.en).toContain('not new adoptions of national flags');
        continue;
      }
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
    // Every country without an authored account has its page in both Wikipedias, and so its text; most flags have theirs.
    expect(count.about).toEqual({ es: sheets.length - WRITTEN.length - CURATED.length, en: sheets.length - WRITTEN.length - CURATED.length });
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
    // Neither Wikipedia flag lead explains the particular Bartram proposal as accurately as the sourced account.
    expect(sheetOf('AQ').flag?.lead).toBeUndefined();
    expect(sheetOf('AQ').lead).toBeUndefined();
    expect(sheetOf('AQ').flag?.text?.en[0]).toContain('not the Antarctic Treaty emblem');
    // Misleading dates or colours in the source are hidden rather than attributed to it after rewriting.
    for (const id of ['GQ', 'JE', 'RW']) expect(Object.keys(sheetOf(id).flag?.lead ?? {})).toEqual(['en']);
    expect(Object.keys(sheetOf('HN').flag?.lead ?? {})).toEqual(['es']);
    expect(sheetOf('RS').flag?.lead?.es).toHaveLength(1); // No unverified pre-uprising delegation to Russia.
    expect(sheetOf('TN').flag?.lead).toBeUndefined();
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

describe('sourced polar accounts and additional Commons galleries', () => {
  it('adds bilingual text and its real sources without replacing a photograph, an emblem or a Wikipedia link', () => {
    for (const id of CURATED) {
      const sheet = sheetOf(id);
      const fix = FIXES[id];
      expect(sheet.about, id).toEqual(fix.about);
      expect(sheet.about?.es, id).toHaveLength(2);
      expect(sheet.about?.en, id).toHaveLength(2);
      expect(sheet.lead, id).toBeUndefined(); // Authored accounts are not labelled as Wikipedia excerpts.
      expect(sheet.sources, id).toEqual(fix.sources);
      expect(sheet.sources?.about?.length, id).toBeGreaterThan(0);
      for (const sources of Object.values(sheet.sources ?? {})) for (const source of sources ?? []) {
        cleanIn(source.title, `${id} source`);
        expect(new URL(source.url).protocol, id).toBe('https:');
      }
      expect(sheet.read?.es, id).toMatch(/^https:\/\/es\.wikipedia\.org\/wiki\//);
      expect(sheet.read?.en, id).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//);
      expect(sheet.photos, id).toHaveLength(1 + GALLERY[id].length + (RELEASE[id]?.length ?? 0));
      expect(sheet.photos?.[0].by, id).toBeTruthy();
      expect(sheet.photos?.[0].licence, id).toMatch(/^(CC BY(-SA)? \d|Public domain)/);
      expect(JSON.stringify(sheet), id).not.toContain('Placeholder');
      // The upload's dated historical events are not flag periods; no earlier flag exists in the catalogue.
      expect(FLAGS.past?.[id], id).toBeUndefined();
      expect(sheet.times, id).toBeUndefined();
    }
    for (const id of ['GS', 'TF']) expect(sheetOf(id).arms, id).toBeDefined();
  });

  it('keeps each chosen head and adds only the bilingual, licensed Commons photographs in the gallery', () => {
    expect(Object.keys(GALLERY).sort()).toEqual([...GALLERIED].sort());
    const heads = json<Record<string, { file: string; es: string; en: string }>>('scripts/data/profiles-heads.json');
    const used = new Set<string>();
    for (const id of GALLERIED) {
      const [hero, ...photos] = sheetOf(id).photos!.slice(0, 1 + GALLERY[id].length);
      expect(hero.title, id).toBe(heads[id].file);
      expect([hero.es, hero.en], id).toEqual([heads[id].es, heads[id].en]);
      expect(photos, id).toHaveLength(['RW', 'BI', 'CD', 'ZM', 'AO', 'NA'].includes(id) ? 4 : 2);
      expect(photos.length + 1, id).toBeGreaterThanOrEqual(3);
      expect(photos.length + 1, id).toBeLessThanOrEqual(8);
      for (const [i, photo] of photos.entries()) {
        const source = GALLERY[id][i];
        expect([photo.title, photo.es, photo.en, photo.by], id).toEqual([source.file, source.es, source.en, source.by]);
        expect(used.has(photo.file), photo.title).toBe(false);
        used.add(photo.file);
        expect(photo.file, photo.title).toMatch(/^[0-9a-f]{10}$/);
        expect(photo.sizes, photo.title).toEqual(WIDTHS.photo.filter((w) => w <= photo.w));
        expect(photo.licence, photo.title).toMatch(/^(CC BY(-SA)? \d|Public domain)/);
        if (photo.licence.startsWith('CC')) expect(photo.licenceUrl, photo.title).toMatch(/^https:\/\/creativecommons\.org\//);
        for (const width of photo.sizes) {
          const file = path.join(ROOT, PICTURES, `${photo.file}-${width}.webp`);
          expect(fs.existsSync(file), file).toBe(true);
          expect(fs.statSync(file).size, file).toBeLessThanOrEqual(300_000);
          expect(fs.readFileSync(file).subarray(8, 12).toString('latin1')).toBe('WEBP');
        }
      }
    }
  });

  it('keeps Rwanda’s existing timeline, does not invent one for Burundi and identifies the palace as a reconstruction', () => {
    const rwanda = sheetOf('RW');
    const burundi = sheetOf('BI');
    expect(rwanda.photos?.length).toBe(5 + (RELEASE.RW?.length ?? 0));
    expect(burundi.photos?.length).toBe(5 + (RELEASE.BI?.length ?? 0));
    expect(rwanda.times).toHaveLength(3);
    expect(rwanda.timeSource).toBe(TIMELINES.RW.source);
    expect(burundi.times).toBeUndefined();
    const palace = rwanda.photos?.find((photo) => photo.title === 'Rwanda Nyanza Mwami Palace.jpg');
    expect(palace?.es).toMatch(/^Reconstrucción del palacio/);
    expect(palace?.en).toMatch(/^Reconstruction of the traditional/);
    expect(rwanda.photos?.slice(1, 5).map((photo) => photo.licence)).toEqual(['CC BY-SA 4.0', 'CC BY-SA 4.0', 'CC BY-SA 4.0', 'CC BY-SA 3.0']);
    expect(burundi.photos?.slice(1, 5).map((photo) => photo.licence)).toEqual(['CC BY-SA 4.0', 'CC BY-SA 4.0', 'CC BY-SA 4.0', 'CC BY 2.0']);
  });

  it('keeps DR Congo’s six flag periods and Zambia’s lack of a timeline alongside their new photographs', () => {
    const congo = sheetOf('CD');
    const zambia = sheetOf('ZM');
    expect(congo.photos?.length).toBe(5 + (RELEASE.CD?.length ?? 0));
    expect(zambia.photos?.length).toBe(5 + (RELEASE.ZM?.length ?? 0));
    expect(congo.photos?.[0].title).toBe('Virunga 01.jpg');
    expect(zambia.photos?.[0].title).toBe('Cataratas Victoria, Zambia-Zimbabue, 2018-07-27, DD 05.jpg');
    expect(congo.times).toHaveLength(6);
    expect(congo.timeSource).toBe(TIMELINES.CD.source);
    expect(zambia.times).toBeUndefined();
    expect(congo.photos?.slice(1, 5).map((photo) => photo.licence)).toEqual(['CC BY-SA 3.0', 'CC BY-SA 3.0', 'CC BY 3.0', 'CC BY-SA 3.0']);
    expect(zambia.photos?.slice(1, 5).map((photo) => photo.licence)).toEqual(['CC BY 2.0', 'CC BY-SA 4.0', 'CC BY-SA 4.0', 'CC BY-SA 4.0']);
  });

  it('keeps Angola and Namibia’s chosen heads and flag dates, adding photos but no unsourced timelines', () => {
    const expected = {
      AO: {
        head: 'Quedas-Kalandula 07 queda LWS-2011-08 QD18 (cropped).jpg',
        adopted: '1975-11-11',
        licences: ['CC BY-SA 3.0', 'CC BY 2.0', 'CC BY-SA 3.0', 'CC BY-SA 2.0'],
      },
      NA: {
        head: 'Dead Vlei, Sossusvlei, Namibia, 2018-08-06, DD 086.jpg',
        adopted: '1990-03-21',
        licences: ['CC BY-SA 2.5', 'CC BY-SA 3.0', 'CC BY 3.0', 'CC BY-SA 4.0'],
      },
    };
    for (const [id, { head, adopted, licences }] of Object.entries(expected)) {
      const sheet = sheetOf(id);
      expect(sheet.photos?.length, id).toBe(5 + (RELEASE[id]?.length ?? 0));
      expect(sheet.photos?.[0].title, id).toBe(head);
      expect(sheet.photos?.slice(1, 5).map((photo) => photo.licence), id).toEqual(licences);
      expect(sheet.flag?.adopted, id).toBe(adopted);
      expect(sheet.times, id).toBeUndefined();
    }
  });

  it('distinguishes the Bartram proposal, the borrowed Norwegian/Australian flags and the TAAF emblem', () => {
    const aq = sheetOf('AQ');
    expect(aq.flag?.text).toEqual(FIXES.AQ.flag?.text);
    expect(aq.flag?.parts).toEqual(FIXES.AQ.flag?.parts);
    expect(aq.flag?.lead).toBeUndefined();
    expect(aq.flag?.adopted).toBeUndefined(); // 2002 is the Treaty emblem, not this flag.
    expect(aq.flag?.text?.es[0]).toContain('No es el emblema del Tratado Antártico');
    for (const [id, owner] of [['BV', 'NO'], ['HM', 'AU']] as const) {
      const sheet = sheetOf(id);
      expect(sheet.flag?.of, id).toBe(owner);
      expect(sheet.flag?.adopted, id).toBe(sheetOf(owner).flag?.adopted);
      expect(sheet.flag?.ratio, id).toBe(sheetOf(owner).flag?.ratio);
      expect(sheet.flag?.lead, id).toEqual(sheetOf(owner).flag?.lead);
      expect(sheet.flag?.text, id).toBeUndefined();
      expect(sheet.sources?.flag, id).toBeUndefined();
      expect(sheet.arms, id).toBeUndefined();
    }
    expect(sheetOf('BV')).toMatchObject({ local: 'Bouvetøya', localLang: 'nb' });
    for (const id of ['GS', 'TF'] as const) {
      const sheet = sheetOf(id);
      expect(sheet.flag?.text, id).toEqual(FIXES[id].flag?.text);
      expect(sheet.flag?.parts, id).toEqual(FIXES[id].flag?.parts);
      expect(sheet.flag?.lead, id).toBeUndefined();
      expect(sheet.sources?.flag?.length, id).toBeGreaterThan(0);
    }
    expect(sheetOf('GS').flag?.adopted).toBeUndefined(); // 1992 dates the arms, not an attested adoption of today's ensign.
    expect(sheetOf('GS').flag?.parts?.[1].en[1]).toContain('not native wildlife');
    expect(sheetOf('TF').flag?.adopted).toBe('2007-02-23');
    expect(sheetOf('TF').flag?.text?.en[0]).toContain('decree sets no proportions');
    expect(sheetOf('TF').flag?.parts?.[2].es[1]).toContain('el decreto no establece ese significado');
    expect(sheetOf('TF').motto).toBeUndefined(); // The motto of France is not a motto of this territory.
  });
});

describe('the sourced correction to Uganda’s flag description', () => {
  it('uses the 1962 law rather than the incorrect 1969 Spanish introduction without inventing a flag period', () => {
    const sheet = sheetOf('UG');
    const fix = FIXES.UG;
    expect(sheet.flag?.adopted).toBe('1962-10-09');
    expect(sheet.flag?.text).toEqual(fix.flag?.text);
    expect(sheet.flag?.parts).toEqual(fix.flag?.parts);
    expect(sheet.flag?.lead).toBeUndefined();
    expect(sheet.flag?.text?.es[0]).toContain('9 de octubre de 1962');
    expect(sheet.flag?.text?.es[0]).not.toContain('1969');
    expect(sheet.sources?.flag).toEqual(fix.sources?.flag);
    expect(sheet.sources?.flag?.[0].url).toBe('https://ulii.org/akn/ug/act/ord/1962/64');
    expect(sheet.lead?.es).toBeDefined(); // The country introduction still comes from its Wikipedia page.
    expect(sheet.readFlag?.es).toMatch(/^https:\/\/es\.wikipedia\.org\/wiki\//);
    expect(sheet.times).toBeUndefined(); // The catalogue's 1962 drawing was a proposal, not this national flag.
  });
});

describe('the reviewed WebPs from the owner’s photo release', () => {
  it('preserves every chosen head and earlier gallery, then adds only the pinned bilingual photos across 248 more sheets', () => {
    expect(Object.keys(RELEASE).sort()).toEqual(LANDS.filter((id) => id !== 'BR').sort());
    expect(Object.values(RELEASE).flat()).toHaveLength(1330);
    expect(RELEASE_FILE.excluded).toHaveLength(15); // Eight too-wide panoramas, seven with uncertain rights.
    for (const id of LANDS) {
      const sheet = sheetOf(id);
      if (id === 'BR') { expect(RELEASE[id]).toBeUndefined(); continue; }
      const prior = 1 + (GALLERY[id]?.length ?? 0);
      const rows = RELEASE[id];
      expect(sheet.photos?.length, id).toBe(prior + rows.length);
      expect(sheet.photos?.length, id).toBeLessThanOrEqual(8);
      expect(new Set(sheet.photos?.map((photo) => photo.title)).size, id).toBe(sheet.photos?.length);
      const approved = rows.map(({ sha256: _hash, ...photo }) => photo);
      expect(sheet.photos?.slice(prior), id).toEqual(approved);
      for (const photo of rows) {
        expect(photo.sizes, photo.title).toEqual([640]);
        const file = path.join(ROOT, PICTURES, `${photo.file}-640.webp`);
        expect(fs.existsSync(file), file).toBe(true);
        expect(createHash('sha256').update(fs.readFileSync(file)).digest('hex'), file).toBe(photo.sha256);
      }
    }
    for (const excluded of RELEASE_FILE.excluded) expect(sheetOf(excluded.id).photos?.map((p) => p.title), excluded.title).not.toContain(excluded.title);
  });
});

describe('researched timelines layered over the generated sheets', () => {
  it('covers eighty-six real countries without replacing their photograph or attributing corrected text to Wikipedia', () => {
    expect(typeof TIMELINE_REASON).toBe('string');
    const ids = Object.keys(TIMELINES);
    expect(ids).toEqual([...ids].sort());
    expect(ids).toHaveLength(86);
    expect(ids).not.toContain('BR');
    expect(ids.every(has)).toBe(true);
    expect(ids.reduce((n, id) => n + TIMELINES[id].times.length, 0)).toBe(342);
    for (const id of ids) {
      const sheet = sheetOf(id);
      const source = TIMELINES[id];
      expect(sheet.about, id).toBeUndefined();
      // Timelines do not replace the chosen head or any separately curated gallery (TZ has both).
      expect(sheet.photos, id).toHaveLength(1 + (GALLERY[id]?.length ?? 0) + (RELEASE[id]?.length ?? 0));
      expect(sheet.lead?.es?.length, id).toBeGreaterThan(0);
      expect(sheet.lead?.en?.length, id).toBeGreaterThan(0);
      // Misleading dates and descriptions are hidden, not rewritten as if they came from Wikipedia.
      // The separately sourced timeline does not masquerade as an extract of either encyclopedia.
      if (['GQ', 'JE', 'RW', 'TN'].includes(id)) expect(sheet.flag?.lead?.es, id).toBeUndefined();
      else expect(sheet.flag?.lead?.es?.length, id).toBeGreaterThan(0);
      if (['AF', 'HN', 'TN'].includes(id)) expect(sheet.flag?.lead?.en, id).toBeUndefined();
      else expect(sheet.flag?.lead?.en?.length, id).toBeGreaterThan(0);
      expect(sheet.timeSource, id).toBe(source.source);
      expect(sheet.timeNote, id).toEqual(source.note);
      // Period photographs are turned into light, credited WebP files rather than copied verbatim.
      expect(sheet.times?.map(({ picture: _picture, ...time }) => time), id).toEqual(source.times.map(({ picture: _picture, ...time }) => time));
      for (const [i, one] of source.times.entries()) {
        const photo = sheet.times?.[i].picture;
        if (!one.picture) {
          expect(photo, `${id} ${i}`).toBeUndefined();
          continue;
        }
        expect(photo, `${id} ${i}`).toMatchObject({ title: one.picture.file, es: one.picture.es, en: one.picture.en, sizes: WIDTHS.time });
        expect(photo?.licence, `${id} ${i}`).toMatch(/^(Public domain|CC0|CC BY(-SA)? \d)/);
        if (one.picture.by) expect(photo?.by, `${id} ${i}`).toBe(one.picture.by);
        if (/^CC BY/.test(photo?.licence ?? '')) expect(photo?.by, `${id} ${i} author`).toBeTruthy();
        for (const width of photo?.sizes ?? []) {
          const file = path.join(ROOT, PICTURES, `${photo?.file}-${width}.webp`);
          expect(fs.existsSync(file), file).toBe(true);
          expect(fs.statSync(file).size, file).toBeLessThan(300_000);
        }
      }
      expect(new URL(sheet.timeSource!).protocol, id).toBe('https:');
      cleanIn(sheet.timeNote, `${id} timeline note`);
    }
    expect(sheetOf('BR').timeSource).toBeUndefined();
    expect(sheetOf('GI').times).toBeUndefined();
  });

  it('serves the Commons shahada drawing in the games and sheet, while preserving the republic’s tricolour in the history', () => {
    const profile = sheetOf('AF');
    const drawing = profile.flag?.drawing;
    expect(drawing).toMatchObject({ file: 'af.svg', title: 'Flag of the Taliban.svg', by: 'Lexicon', licence: 'Public domain' });
    expect(drawing?.note.es).toContain('ficha y los juegos');
    expect(drawing?.note.en).toContain('tricolour');
    const expectedSha = 'fbfe78dee5dbaefbd21b488c0ae0231f3c5e2c9e';
    for (const file of ['scripts/data/flag-overrides/af.svg', 'docs/flags/af.svg']) {
      const svg = fs.readFileSync(path.join(ROOT, file));
      expect(createHash('sha1').update(svg).digest('hex'), file).toBe(expectedSha);
      expect(svg.toString()).not.toContain('flag-icons-af');
    }
    expect(INDEX.countries.find((c) => c.id === 'AF')?.fl).toBe('af');
    expect(countryFlags(INDEX, '/').find((card) => card.id === 'AF')).toMatchObject({ src: '/flags/af.svg', ratio: 2 });
    expect(timeCards(profile, FLAGS, INDEX, '/').at(-1)).toMatchObject({ kind: 'country', id: 'AF', src: '/flags/af.svg', ratio: 2 });
    expect(timeCards(profile, FLAGS, INDEX, '/').at(-2)?.src).toMatch(/^\/flags\/commons\//);
    expect(profile.flag?.lead?.en).toBeUndefined(); // Wikipedia dates the first adoption to the 2021 return.
    expect(profile.readFlag?.en).toBe('https://en.wikipedia.org/wiki/Flag_of_Afghanistan');
  });

  it('has Commons provenance and an author and licence link for every drawing needing attribution', () => {
    for (const id of Object.keys(TIMELINES)) {
      for (const card of timeCards(sheetOf(id), FLAGS, INDEX, '/')) {
        if (!card?.file) continue;
        const record = CREDITS.files[card.file];
        expect(record, `${id}: ${card.file}`).toBeDefined();
        const licence = CREDITS.licences[record[2]];
        expect(licence, `${id}: ${card.file}`).toBeDefined();
        if (licence[0] === 'Public domain' || licence[0] === 'CC0') continue;
        expect(record[1], `${id}: ${card.file} author`).not.toBe('');
        expect(new URL(licence[1].replace(/^http:/, 'https:')).protocol).toBe('https:');
      }
    }
    expect(CREDITS.files['2a344f84d8.svg'][0]).toBe('Flag of Cambodia (1992–1993).svg');
    expect(CREDITS.licences[CREDITS.files['2a344f84d8.svg'][2]][0]).toBe('CC BY-SA 3.0');
  });

  it('shows the flag of each period from the catalogue, even where its historical years differ from the catalogue row', () => {
    for (const id of Object.keys(TIMELINES)) {
      const sheet = sheetOf(id);
      const times = sheet.times!;
      const cards = timeCards(sheet, FLAGS, INDEX, '/');
      expect(cards, id).toHaveLength(times.length);
      expect(times.length, id).toBeGreaterThanOrEqual(2);
      expect(times.filter((t) => t.now), id).toHaveLength(1);
      expect(times.at(-1)?.now, id).toBe(true);
      for (const [i, time] of times.entries()) {
        const here = `${id} ${i}`;
        const card = cards[i];
        expect(card, here).not.toBeNull();
        expect([time.past, time.gone, time.now].filter((flag) => flag !== undefined), here).toHaveLength(1);
        if (time.past) {
          const rows = FLAGS.past?.[id]?.filter((row) => row[2] === time.past![0] && row[3] === time.past![1] && (!time.pastFile || row[0] === time.pastFile));
          expect(rows, here).toHaveLength(1);
          expect(card, here).toMatchObject({ kind: 'past', id, file: rows![0][0] });
        } else if (time.gone) {
          const row = (FLAGS.gone ?? []).find((row) => row[0] === time.gone);
          expect(row, here).toBeDefined();
          expect(card, here).toMatchObject({ kind: 'gone', id: time.gone, file: row![3] });
        } else expect(card, here).toMatchObject({ kind: 'country', id });
        expect(time.from, here).toBeGreaterThan(0);
        if (i) expect(time.from, here).toBeGreaterThanOrEqual(times[i - 1].from);
        if (!time.now) expect(time.to, here).toBeGreaterThanOrEqual(time.from);
        cleanIn(time.name, `${here} name`);
        cleanIn(time.text, `${here} text`);
        expect(time.text.es, here).toMatch(/[.!?]$/);
        expect(time.text.en, here).toMatch(/[.!?]$/);
        if (time.when) cleanIn(time.when, `${here} when`);
      }
    }
    // These ranges are verified independently: the catalogue range chooses the drawing, not the caption.
    expect(sheetOf('ES').times?.[1]).toMatchObject({ past: [1760, 1843], from: 1760, to: 1785 });
    expect(sheetOf('DE').times?.[2]).toMatchObject({ past: [1947, 1949], from: 1946, to: 1949 });
    expect(sheetOf('UA').times?.[1]).toMatchObject({ gone: 'Q133356', from: 1949, to: 1991 });
    expect(sheetOf('CR').times?.slice(2, 4)).toMatchObject([
      { past: [1824, 1824], pastFile: '19d0666629.svg', from: 1824, to: 1824 },
      { past: [1824, 1824], pastFile: '0987a89723.svg', from: 1824, to: 1824 },
    ]);
    const costaRica = sheetOf('CR');
    expect(timeCards({ id: 'CR', times: [{ ...costaRica.times![2], pastFile: undefined }] }, FLAGS, INDEX, '/')).toEqual([null]);
    expect(timeCards({ id: 'CR', times: costaRica.times!.slice(2, 4) }, FLAGS, INDEX, '/').map((card) => card?.file)).toEqual(['19d0666629.svg', '0987a89723.svg']);
    expect(sheetOf('NI').times?.[2]).toMatchObject({ past: [1839, 1858], from: 1854, to: 1856 });
    expect(sheetOf('NI').times?.[5]).toMatchObject({ past: [1858, 1896], from: 1893, to: 1896 });
    expect(sheetOf('PY').times?.[1]).toMatchObject({ past: [1826, 1879], from: 1826, to: 1842 });
    expect(sheetOf('ET').times?.[4]).toMatchObject({ past: [1996, 1996], from: 1996, to: 2009 });
    expect(sheetOf('RO').times?.[1]).toMatchObject({ past: [1947, 1949], when: { es: 'Enero–marzo de 1948', en: 'January–March 1948' } });
    expect(sheetOf('SV').times?.at(-1)).toMatchObject({ now: true, from: 1922, when: { es: '1916–1921 y desde 1922', en: '1916–1921 and since 1922' } });
    expect(sheetOf('IQ').times?.[0]).toMatchObject({ past: [0, 1958], from: 1924, to: 1959 });
    expect(sheetOf('EG').times?.[4]).toMatchObject({ past: [1958, 1999], from: 1958, to: 1972 });
    expect(sheetOf('TM').times?.[0]).toMatchObject({ past: [1925, 1992], from: 1974, to: 1992 });
    expect(sheetOf('MZ').times?.[2]).toMatchObject({ past: [0, 1983], when: { es: 'abril–1 de mayo de 1983', en: 'April–1 May 1983' } });
    expect(sheetOf('US').times?.at(-1)).toMatchObject({ now: true, from: 1960 });
    expect(sheetOf('AL').times?.[2]).toMatchObject({ past: [1928, 1939], from: 1934, to: 1939 });
    expect(sheetOf('AT').times?.[0]).toMatchObject({ past: [1804, 1867], from: 1804, to: 1918 });
    expect(sheetOf('BA').times?.[0]).toMatchObject({ past: [0, 1998], from: 1992, to: 1998 });
    expect(sheetOf('CY').times?.at(-1)).toMatchObject({ now: true, from: 2006 });
    expect(sheetOf('GR').times?.[1]).toMatchObject({ past: [1822, 1978], from: 1822, to: 1978 });
    expect(sheetOf('HR').times?.[0]).toMatchObject({ past: [1990, 1990], when: { es: 'Julio–diciembre de 1990', en: 'July–December 1990' } });
    expect(sheetOf('HU').times?.[0]).toMatchObject({ past: [1848, 1869], when: { es: '1848–1849 y 1867–1869', en: '1848–1849 and 1867–1869' } });
    expect(sheetOf('IR').times?.[0]).toMatchObject({ past: [1964, 1980], from: 1964, to: 1979 });
    expect(sheetOf('LT').times?.[1]).toMatchObject({ past: [1990, 2004], from: 1988, to: 2004 });
    expect(sheetOf('MN').times?.at(-1)).toMatchObject({ now: true, from: 1992 });
    expect(sheetOf('NL').times?.[1]).toMatchObject({ past: [1795, 1806], from: 1796, to: 1806 });
    expect(sheetOf('PH').times?.[0]).toMatchObject({ past: [1936, 1998], from: 1955, to: 1985 });
    expect(sheetOf('PL').times?.at(-1)).toMatchObject({ now: true, from: 1980 });
    expect(sheetOf('SA').times?.[0]).toMatchObject({ past: [0, 1932], from: 1921, to: 1932 });
    // Dates on catalogue drawings can describe a badge's approval, a choice made before the first hoisting,
    // or simply a bad import. Neither a union flag nor a contemporaneous civil ensign is the next national flag.
    expect(sheetOf('AF').times).toHaveLength(17);
    expect(sheetOf('AF').times?.[0]).toMatchObject({ past: [1709, 1901], from: 1881, to: 1901 });
    expect(sheetOf('AF').times?.some((time) => time.past?.[0] === 1747)).toBe(false); // Herat, not the whole emirate.
    expect(sheetOf('AF').times?.[12]).toMatchObject({ past: [1996, 1997], from: 1996, to: 1997 });
    expect(sheetOf('AF').times?.[11]).toMatchObject({ past: [1992, 1996], from: 1992, to: 2001 }); // Rival governments overlapped.
    expect(sheetOf('AF').times?.[6].text.es).toContain('1348 del calendario islámico lunar'); // Solar 1348 would be 1969–70.
    expect(sheetOf('AF').times?.[6].text.en).toContain('1348 in the lunar Islamic calendar');
    expect(sheetOf('AF').times?.at(-2)).toMatchObject({ past: [2013, 2021], from: 2004, to: 2021 }); // 2013 is NOT a new flag adoption.
    expect(sheetOf('AF').timeNote?.en).toContain('the red 1978–1980 flag');
    expect(sheetOf('AF').flag?.adopted).toBe('1997'); // Exact October day disputed; 2021 was a return.
    expect(sheetOf('AF').flag?.changed).toBeUndefined();
    expect(sheetOf('AG').times?.[0]).toMatchObject({ past: [1956, 1962], when: { es: 'Hacia 1956–1962', en: 'Around 1956–1962' } });
    expect(sheetOf('AS').times?.map((time) => time.past)).toEqual([[1912, 1959], [1959, 1960], undefined]);
    expect(sheetOf('AS').flag?.adopted).toBe('1960-04-17');
    expect(sheetOf('AZ').times?.[0]).toMatchObject({ past: [0, 2013], from: 1991, to: 2013 });
    expect(sheetOf('BH').times?.[0]).toMatchObject({ past: [1932, 1972], from: 1933 });
    expect(sheetOf('BS').times?.[0]).toMatchObject({ past: [1964, 1973], when: { es: 'Insignia aprobada en 1964 · hasta 1973', en: 'Badge approved in 1964 · through 1973' } });
    expect(sheetOf('CK').times?.[0]).toMatchObject({ past: [1973, 1979], from: 1974 });
    expect(sheetOf('DM').times?.[0]).toMatchObject({ past: [1961, 1978], from: 1965 });
    expect(sheetOf('DM').times?.[1].from).toBe(1981); // The first 1978 independence design is missing.
    expect(sheetOf('FK').times?.[2].when?.en).toBe('1948–1999, except April–June 1982');
    expect(sheetOf('GH').times?.map((time) => time.past)).toEqual([[1964, 1966], undefined]);
    expect(sheetOf('GH').times?.at(-1)?.when?.en).toBe('1957–1964 and since 1966');
    expect(sheetOf('HT').flag?.adopted).toBeUndefined(); // Britannica and Wikipedia differ by one day.
    expect(sheetOf('MR').flag?.adopted).toBe('2017-10-25');
    expect(sheetOf('MW').times?.at(-1)?.when?.en).toBe('1964–2010 and since 2012');
    // The sixth batch distinguishes autonomous and colonial flags, non-national ensigns, missing
    // independence designs and dates taken from a first hoisting rather than a catalogue filename.
    expect(sheetOf('BB').times?.[0]).toMatchObject({ past: [0, 1966], from: 1885, when: { en: 'Late nineteenth century–1966' } });
    expect(sheetOf('GA').times?.at(-1)).toMatchObject({ now: true, from: 1960 });
    expect(sheetOf('GG').times?.[0]).toMatchObject({ past: [1936, 1985], from: 1936 });
    expect(sheetOf('JE').times?.[0]).toMatchObject({ past: [0, 1981], from: 1830, when: { en: 'From at least the 1830s until 1981' } });
    expect(sheetOf('KM').times?.[0]).toMatchObject({ past: [1996, 2002], from: 1996, to: 2001 });
    expect(sheetOf('KW').times?.[0].when?.en).toBe('1956–1961 · maritime ensign');
    expect(sheetOf('LC').times?.map((time) => time.from)).toEqual([1939, 1979, 2002]); // The 1967 design is missing.
    expect(sheetOf('LS').times?.[0]).toMatchObject({ past: [1987, 2006], from: 1987 });
    expect(sheetOf('MY').times?.[0]).toMatchObject({ past: [1950, 1963], from: 1950 });
    expect(sheetOf('RW').times?.[0].when?.en).toBe('January–September 1961');
    expect(sheetOf('RW').flag?.adopted).toBe('2001-12-31'); // October was only a parliamentary vote.
    expect(sheetOf('TG').times?.map((time) => time.past)).toEqual([[1957, 1958], [1958, 1960], undefined]);
    expect(sheetOf('TN').times?.[0]).toMatchObject({ past: [0, 1999], from: 1831, when: { en: 'Nineteenth century–1999 · pre-law version' } });
    expect(sheetOf('TN').flag?.adopted).toBeUndefined(); // The battle in 1827 was not adoption.
    // This batch does not promote technical catalogue ranges, alternative tones, civil flags or union
    // flags to a seamless sequence of independent national flags.
    expect(sheetOf('GQ').times?.[0]).toMatchObject({ past: [1968, 1973], from: 1968, to: 1968, when: { en: 'From 12 October 1968 · duration uncertain' } });
    expect(sheetOf('GQ').timeNote?.en).toContain('FOTW dates their introduction to 1973 and Britannica to 1978');
    expect(sheetOf('HN').times?.map((time) => time.past)).toEqual([[1839, 1866], [1866, 1898], undefined]);
    expect(sheetOf('HN').flag).toMatchObject({ adopted: '1866-02-16', changed: '1949-01-26' });
    expect(sheetOf('HN').timeNote?.en).toContain('government returned to turquoise in 2022 and to navy blue in 2026');
    expect(sheetOf('RS').times?.[0]).toMatchObject({ past: [1835, 1882], from: 1839 });
    expect(sheetOf('RS').times?.[2]).toMatchObject({ past: [1946, 1992], from: 1947 });
    expect(sheetOf('RS').timeNote?.en).toContain('constituent republic');
    expect(sheetOf('SY').times?.map((time) => time.past)).toEqual([[1961, 1963], [1963, 1972], [1961, 1963], [1972, 1980], [1963, 1972], undefined]);
    expect(sheetOf('SY').times?.[1]).toMatchObject({ past: [1963, 1972], from: 1958, to: 1961 }); // The drawing has TWO stars.
    expect(sheetOf('SY').times?.[4]).toMatchObject({ past: [1963, 1972], from: 1980, to: 2024 });
    expect(sheetOf('SY').timeNote?.en).toContain('the 1963–1972 three-green-star flag are omitted');
    expect(sheetOf('SY').flag?.adopted).toBe('2025-03-13'); // 2024 was only de facto state use.
    expect(sheetOf('TW').times?.[0]).toMatchObject({ past: [1912, 1928], from: 1912 });
    expect(sheetOf('TW').timeNote?.en).toContain('not a sequence of flags flown on the island');
    expect(sheetOf('TW').flag).toMatchObject({ adopted: '1928-10-28', by: { en: 'Lu Haodong (canton) and Sun Yat-sen (red field)' } });
    expect(sheetOf('VE').times?.[0]).toMatchObject({ past: [1817, 1899], from: 1811, to: 1812 });
    expect(sheetOf('VE').times?.[1]).toMatchObject({ past: [1903, 1905], from: 1817, to: 1819 });
    expect(sheetOf('VE').times?.[2]).toMatchObject({ past: [1905, 1917], from: 1830, to: 1836 });
    expect(sheetOf('VE').times?.at(-2)).toMatchObject({ past: [1930, 1954], from: 1930, to: 2006 });
    expect(sheetOf('VE').flag?.adopted).toBe('2006-03-09'); // Publication of the eight-star law.
    expect(sheetOf('VE').timeNote?.en).toContain('not successive civil-to-state replacements');
    expect(sheetOf('VE').times?.some((time) => time.from === 1859)).toBe(false); // Federalist rebel flags.
    // A contested occupation flag and a rejected proposal are not historical national flags.
    expect(sheetOf('KH').times?.some((time) => time.past?.[0] === 1942)).toBe(false);
    expect(sheetOf('IQ').times?.some((time) => time.name.en.includes('blue'))).toBe(false);
    expect(sheetOf('UG').times).toBeUndefined(); // The catalogue's 1962 flag was proposed, not adopted.
    // The UN administration's drawing is licensed, so the in-sheet credit must come from the same Commons catalogue.
    const cambodiaUN = timeCards({ id: 'KH', times: sheetOf('KH').times!.slice(-2, -1) }, FLAGS, INDEX, '/')[0];
    expect(cambodiaUN?.file).toBe('2a344f84d8.svg');
  });

  it('does not turn the flags of separate states or technical catalogue years into a national succession', () => {
    const yemen = sheetOf('YE');
    expect(yemen.times?.map((time) => time.gone ?? 'now')).toEqual(['Q580188', 'Q267584', 'Q199841', 'now']);
    expect(FLAGS.gone?.find((row) => row[0] === 'Q580188')?.slice(5, 7)).toEqual([1918, 1970]);
    expect(yemen.times?.[0]).toMatchObject({ from: 1927, to: 1962 }); // Royalists kept flying it afterwards.
    expect(yemen.times?.[2]).toMatchObject({ from: 1967, to: 1990 }); // South and north coexisted.
    expect(yemen.timeNote?.en).toContain('coexisted from 1967');
    expect(yemen.flag?.adopted).toBe('1990-05-22');

    const tanzania = sheetOf('TZ');
    expect(tanzania.times?.map((time) => time.gone ?? 'now')).toEqual(['Q431731', 'Q157904', 'now']);
    expect(FLAGS.gone?.find((row) => row[0] === 'Q157904')?.slice(5, 7)).toEqual([1856, 1964]);
    expect(tanzania.times?.[1]).toMatchObject({ from: 1963, to: 1964, when: { en: '10 December 1963–12 January 1964 · Zanzibar' } });
    expect(tanzania.times?.at(-1)).toMatchObject({ now: true, from: 1964, when: { en: 'Since 30 June 1964 · union on 26 April' } });
    expect(tanzania.timeNote?.en).toContain("revolutionary Zanzibar republic's blue, black and green flag (1964) is missing");
    expect(tanzania.timeNote?.en).toContain('may have been military rather than national');

    const czechia = sheetOf('CZ');
    expect(czechia.times?.map((time) => time.gone ?? 'now')).toEqual(['Q33946', 'Q152750', 'Q33946', 'now']);
    expect(FLAGS.gone?.find((row) => row[0] === 'Q33946')?.slice(5, 7)).toEqual([1918, 1992]);
    expect(czechia.times?.[0]).toMatchObject({ from: 1920, to: 1939 });
    expect(czechia.times?.[1]).toMatchObject({ from: 1939, when: { en: 'October 1939–May 1945 · protectorate under German occupation' } });
    expect(czechia.timeNote?.en).toContain('coexisted with the federal flag');

    const slovakia = sheetOf('SK');
    expect(slovakia.times?.map((time) => time.gone ?? 'now')).toEqual(['Q33946', 'Q154401', 'Q33946', 'now']);
    expect(slovakia.times?.[1]).toMatchObject({ from: 1939, to: 1945 });
    expect(slovakia.times?.at(-1)).toMatchObject({ now: true, from: 1992, when: { en: 'Since September 1992 · independent since January 1993' } });
    expect(slovakia.timeNote?.en).toContain('coexisted with the federal flag');
    // The Czech and Slovak timelines both distinguish the federation's emblem from their own flags.
    for (const id of ['CZ', 'SK', 'TZ', 'YE']) {
      const profile = sheetOf(id);
      expect(profile.times?.at(-1)?.now, id).toBe(true);
      expect(timeCards(profile, FLAGS, INDEX, '/').every(Boolean), id).toBe(true);
      expect(new URL(profile.timeSource!).protocol, id).toBe('https:');
    }
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
      const released = i >= sheet.photos.length - (RELEASE[id]?.length ?? 0) && i < sheet.photos.length;
      const wanted: readonly number[] = i === 0 ? WIDTHS.head : released ? [640] : i < sheet.photos.length ? WIDTHS.photo : WIDTHS.time;
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
    // The metadata includes the two new period documents; the original thumbnails remain pinned to their older bytes.
    expect(PHOTOS_SAID).toHaveLength(3);
    expect(PHOTOS_SAID[2]).not.toBe(PHOTOS_AT.commit);
    for (const [file] of PHOTOS) expect(file).toMatch(/^photos\/files\/[0-9a-f]{40}\.1920\.(jpg|png)$/);
    // The downloaded originals make the earlier photos. The separately hash-pinned release WebPs
    // have no 1920px originals in this source and must not silently appear in photos-pinned.mjs.
    const pinned = PHOTOS.map(([file]) => path.basename(file).slice(0, 10)).sort();
    const released = new Set(Object.values(RELEASE).flat().map((photo) => photo.file));
    const shown = LANDS.flatMap((land) => photosOf(sheetOf(land)).map((photo) => photo.file)).filter((file) => !released.has(file)).sort();
    expect(pinned).toEqual(shown);
  });
});
