// What the games of «Banderas» are played with (lib/flagSets.ts): how a set of flags is said in an
// address, and the cards that are made of it, with the flags the site is built with.

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FLAG_SET_MIN, alikePlace, deckOf, flagSetName, flagSetOf, flagSetText, galleryPage, sameMap, sameSet, setMenu, setOfPage, twins, type FlagSet, type SameFile } from './flagSets';
import { flagsPageOf, flagsRest, type FlagsFile } from './flags';
import { setLang } from './i18n';
import { SAME_FLAG } from './pairs';
import { FLAGS_GALLERY_PATH, FLAGS_PATH } from './routes';
import type { Index } from './types';

const json = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(process.cwd(), file), 'utf8')) as T;
const FLAGS = json<FlagsFile>('public/data/flags.json');
const INDEX = json<Index>('public/data/index.json');
const SAME = sameMap(json<SameFile>('public/data/alike/same.json'));
const deck = (set: FlagSet) => deckOf(set, INDEX, FLAGS, SAME, '/x/');

afterEach(() => setLang('es'));

describe('a set of flags in an address', () => {
  const sets: [FlagSet, string][] = [
    [{ kind: 'countries' }, 'paises'],
    [{ kind: 'countries', continent: 'EU' }, 'paises-EU'],
    [{ kind: 'territories' }, 'territorios'],
    [{ kind: 'regions', country: 'ES' }, 'regiones-ES'],
    [{ kind: 'regions', country: 'ES', level: 1 }, 'regiones-ES-1'],
    [{ kind: 'regions', country: 'ES', level: 0 }, 'regiones-ES-0'],
    [{ kind: 'capitals' }, 'capitales'],
    [{ kind: 'cities', country: 'JP' }, 'ciudades-JP'],
    [{ kind: 'gone' }, 'desaparecidos'],
    [{ kind: 'organisations' }, 'organizaciones'],
    [{ kind: 'peoples' }, 'pueblos'],
    [{ kind: 'signals' }, 'senales'],
  ];

  it('is a word, with the country and the level where there are any, and reads back as the same set', () => {
    for (const [set, text] of sets) {
      expect(flagSetText(set)).toBe(text);
      expect(flagSetOf(text)).toEqual(set);
    }
    // Whatever its capitals.
    expect(flagSetOf('Regiones-es')).toEqual({ kind: 'regions', country: 'ES' });
    expect(flagSetOf('PAISES-eu')).toEqual({ kind: 'countries', continent: 'EU' });
  });

  it('is nothing when it names no flags, or says more than there is to say', () => {
    for (const text of ['', 'nada', 'regiones', 'regiones-España', 'regiones-ES-7', 'regiones-ES-1-2', 'ciudades', 'ciudades-ES-1', 'paises-EU-1', 'paises-Europa', 'capitales-ES', 'senales-x', 'territorios-EU', '../x']) {
      expect(flagSetOf(text), text).toBeNull();
    }
  });

  it('tells two sets apart by what they say', () => {
    expect(sameSet({ kind: 'regions', country: 'ES' }, { country: 'ES', kind: 'regions' })).toBe(true);
    expect(sameSet({ kind: 'regions', country: 'ES' }, { kind: 'regions', country: 'ES', level: 0 })).toBe(false);
    expect(sameSet({ kind: 'countries' }, { kind: 'countries', continent: 'EU' })).toBe(false);
  });

  it('has a page of the gallery, and every page of the gallery has a set to be played with', () => {
    for (const [set] of sets) {
      const page = galleryPage(set);
      // The page reads back from its address: it is one the gallery has.
      expect(flagsPageOf(flagsRest(page))).toEqual(page);
    }
    expect(galleryPage({ kind: 'regions', country: 'ES', level: 1 })).toEqual({ tab: 'regions', country: 'ES' });
    expect(galleryPage({ kind: 'capitals' })).toEqual({ tab: 'cities' });
    expect(setOfPage({ tab: 'countries' })).toEqual({ kind: 'countries' });
    expect(setOfPage({ tab: 'regions', country: 'JP' })).toEqual({ kind: 'regions', country: 'JP' });
    expect(setOfPage({ tab: 'cities' })).toEqual({ kind: 'capitals' });
    expect(setOfPage({ tab: 'cities', country: 'ES' })).toEqual({ kind: 'cities', country: 'ES' });
    expect(setOfPage({ tab: 'history' })).toEqual({ kind: 'gone' });
    expect(setOfPage({ tab: 'others' })).toEqual({ kind: 'organisations' });
    for (const tab of ['countries', 'regions', 'cities', 'history', 'others'] as const) expect(deck(setOfPage({ tab })).length).toBeGreaterThanOrEqual(FLAG_SET_MIN);
    // What links to the gallery without the rest of the section says the same as the gallery itself.
    expect(FLAGS_GALLERY_PATH).toBe(`${FLAGS_PATH}/${flagsRest({ tab: 'countries' })}`);
  });

  it('says where its look-alikes are kept: in a group that is the set itself', () => {
    expect(alikePlace({ kind: 'countries' })).toEqual({ file: 'countries', group: 'states' });
    expect(alikePlace({ kind: 'countries', continent: 'EU' })).toEqual({ file: 'countries', group: 'EU' });
    expect(alikePlace({ kind: 'territories' })).toEqual({ file: 'countries', group: 'territories' });
    expect(alikePlace({ kind: 'regions', country: 'ES' })).toEqual({ file: 'regions', group: 'ES' });
    // A level of a map has its own where there is one, and is in that of its country where there is not.
    expect(alikePlace({ kind: 'regions', country: 'ES', level: 1 })).toEqual({ file: 'regions', group: 'ES-1', wider: 'ES' });
    expect(alikePlace({ kind: 'capitals' })).toEqual({ file: 'cities', group: 'capitals' });
    expect(alikePlace({ kind: 'cities', country: 'JP' })).toEqual({ file: 'cities', group: 'JP' });
    for (const kind of ['gone', 'organisations', 'peoples', 'signals'] as const) expect(alikePlace({ kind })).toEqual({ file: 'others', group: kind });
  });

  it('has a name in each language', () => {
    expect(flagSetName({ kind: 'countries' }, INDEX)).toBe('Países del mundo');
    expect(flagSetName({ kind: 'countries', continent: 'EU' }, INDEX)).toBe('Países de Europa');
    expect(flagSetName({ kind: 'regions', country: 'ES' }, INDEX)).toBe('Regiones de España');
    expect(flagSetName({ kind: 'regions', country: 'ES', level: 0 }, INDEX)).toBe('Provincias de España');
    expect(flagSetName({ kind: 'cities', country: 'JP' }, INDEX)).toBe('Ciudades de Japón');
    setLang('en');
    expect(flagSetName({ kind: 'countries', continent: 'AM' }, INDEX)).toBe('Countries of the Americas');
    expect(flagSetName({ kind: 'regions', country: 'ES' }, INDEX)).toBe('Spain: regions');
    expect(flagSetName({ kind: 'capitals' }, INDEX)).toBe('Capitals of the world');
  });
});

describe('the cards of a set', () => {
  const land = new Map(INDEX.countries.map((c) => [c.id, c]));

  it('are the States for the countries, and the territories with a flag of their own apart', () => {
    const world = deck({ kind: 'countries' });
    expect(world.length).toBe(INDEX.countries.filter((c) => c.fl && ['un', 'obs', 'partial'].includes(c.cl)).length);
    expect(world.every((card) => land.get(card.id)!.cl !== 'dep')).toBe(true);
    const europe = deck({ kind: 'countries', continent: 'EU' });
    expect(europe.length).toBeGreaterThan(40);
    expect(europe.every((card) => land.get(card.id)!.ct === 'EU')).toBe(true);
    const territories = deck({ kind: 'territories' });
    expect(territories.length).toBeGreaterThan(30);
    expect(territories.every((card) => land.get(card.id)!.cl === 'dep')).toBe(true);
    // One that flies the flag of its country has none to be asked: it would be that of France under another name.
    for (const id of ['BL', 'GF', 'RE', 'SJ', 'BQ', 'HM', 'SH']) expect(territories.some((card) => card.id === id), id).toBe(false);
    expect(territories.map((card) => card.id)).toEqual(expect.arrayContaining(['GL', 'PR', 'HK', 'GI']));
  });

  it('answer to their names in both languages, and a country to the others it goes by', () => {
    const spain = deck({ kind: 'countries' }).find((card) => card.id === 'ES')!;
    expect(spain).toMatchObject({ key: 'country:ES', name: 'España', alt: 'Spain', look: 'ES', said: 'espana', src: '/x/flags/es.svg' });
    expect(spain.answers).toEqual(expect.arrayContaining(['España', 'Spain']));
    const usa = deck({ kind: 'countries' }).find((card) => card.id === 'US')!;
    expect(usa.answers.length).toBeGreaterThan(2);
    const andalusia = deck({ kind: 'regions', country: 'ES' }).find((card) => card.id === 'ES-AN')!;
    expect(andalusia.answers).toEqual(['Andalucía', 'Andalusia']);
    expect(andalusia.look).toBe(andalusia.file);
    setLang('en');
    expect(deck({ kind: 'countries' }).find((card) => card.id === 'ES')).toMatchObject({ name: 'Spain', alt: 'España' });
  });

  it('know which of them cannot share a question: the same picture, or the same name', () => {
    const world = deck({ kind: 'countries' });
    const by = (id: string) => world.find((card) => card.id === id)!;
    // Chad and Romania, Indonesia and Monaco: both are asked, and never side by side.
    expect(twins(by('TD'), by('RO'))).toBe(true);
    expect(twins(by('ID'), by('MC'))).toBe(true);
    expect(twins(by('TD'), by('AD'))).toBe(false);
    for (const [id, like] of Object.entries(SAME_FLAG)) {
      const [a, b] = [by(id), by(like)];
      if (a && b) expect(twins(a, b), `${id} ${like}`).toBe(true);
    }
    // Two emirates fly the same flag, whatever the file it was drawn in.
    const emirates = deck({ kind: 'regions', country: 'AE' });
    const [ajman, dubai] = [emirates.find((card) => card.id === 'AE-AJ')!, emirates.find((card) => card.id === 'AE-DU')!];
    expect(ajman.file).not.toBe(dubai.file);
    expect(twins(ajman, dubai)).toBe(true);
  });

  it('are each flag once: the same picture under the same name is one card', () => {
    const spain = deck({ kind: 'regions', country: 'ES' });
    // Asturias is a community and its only province: one flag, one name.
    expect(spain.filter((card) => card.said === 'asturias')).toHaveLength(1);
    expect(spain.length).toBeLessThan(FLAGS.regions.ES.length);
    expect(deck({ kind: 'regions', country: 'ES', level: 1 }).some((card) => card.said === 'asturias')).toBe(true);
    expect(deck({ kind: 'regions', country: 'ES', level: 0 }).some((card) => card.said === 'asturias')).toBe(true);
    // The region of Brussels is also one of the provinces of the map, under a longer name: one card, which answers to both.
    const brussels = deck({ kind: 'regions', country: 'BE' }).filter((card) => card.id === 'BE-BRU');
    expect(brussels).toHaveLength(1);
    expect(brussels[0]).toMatchObject({ name: 'Bruselas', level: 1 });
    expect(brussels[0].answers).toEqual(['Bruselas', 'Brussels', 'Bruselas-Capital', 'Brussels Capital']);
    expect(deck({ kind: 'regions', country: 'BE', level: 0 }).find((card) => card.id === 'BE-BRU')).toMatchObject({ name: 'Bruselas-Capital', answers: ['Bruselas-Capital', 'Brussels Capital'] });
    // In every set of the site: no two cards that are the same picture and are called the same.
    const menu = setMenu(INDEX, FLAGS, SAME);
    const all: FlagSet[] = [...menu.countries, menu.territories, ...menu.regions, ...menu.regions.flatMap((c) => c.levels), menu.capitals, ...menu.cities, menu.gone, menu.organisations, menu.peoples, menu.signals].filter((c) => !!c).map((c) => c!.set);
    expect(all.length).toBeGreaterThan(150);
    for (const set of all) {
      const cards = deck(set);
      expect(new Set(cards.map((card) => card.key)).size, flagSetText(set)).toBe(cards.length);
      expect(new Set(cards.map((card) => `${card.look}\n${card.said}`)).size, flagSetText(set)).toBe(cards.length);
      for (const card of cards) expect(card.answers.length, card.key).toBeGreaterThan(0);
    }
  });

  it('are the capital and the other cities for the cities of a country, and the letters and numbers for the signals', () => {
    const spain = deck({ kind: 'cities', country: 'ES' });
    expect(spain.some((card) => card.kind === 'capital' && card.name === 'Madrid')).toBe(true);
    expect(spain.filter((card) => card.kind === 'city').length).toBeGreaterThan(20);
    expect(deck({ kind: 'capitals' }).every((card) => card.kind === 'capital')).toBe(true);
    const signals = deck({ kind: 'signals' });
    expect(signals.length).toBe(40);
    expect(signals.every((card) => card.group === 'sea')).toBe(true);
  });

  it('are none for a set there are no flags of', () => {
    expect(deck({ kind: 'regions', country: 'ZZ' })).toEqual([]);
    expect(deck({ kind: 'cities', country: 'ZZ' })).toEqual([]);
    expect(deck({ kind: 'countries', continent: 'ZZ' })).toEqual([]);
  });
});

describe('the sets there are to choose from', () => {
  const menu = setMenu(INDEX, FLAGS, SAME);

  it('are those with flags enough for a game, each with how many', () => {
    expect(menu.countries[0]).toMatchObject({ set: { kind: 'countries' }, name: 'Todo el mundo' });
    expect(menu.countries.map((c) => c.name)).toEqual(['Todo el mundo', 'Europa', 'Asia', 'África', 'América', 'Oceanía']);
    expect(menu.territories?.n).toBeGreaterThan(30);
    expect(menu.regions.length).toBeGreaterThan(60);
    expect(menu.cities.length).toBeGreaterThan(60);
    for (const choice of [...menu.countries, ...menu.regions, ...menu.cities]) {
      expect(choice.n, flagSetText(choice.set)).toBeGreaterThanOrEqual(FLAG_SET_MIN);
      expect(choice.n).toBe(deck(choice.set).length);
    }
    // By name, in the language on screen.
    const names = menu.regions.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));
    for (const one of [menu.capitals, menu.gone, menu.organisations, menu.peoples, menu.signals]) expect(one?.n).toBeGreaterThanOrEqual(FLAG_SET_MIN);
  });

  it('offer the levels of a map one by one where more than one has flags enough', () => {
    const spain = menu.regions.find((c) => c.country === 'ES')!;
    expect(spain.name).toBe('España');
    expect(spain.levels.map((l) => l.name)).toEqual(['Comunidades autónomas', 'Provincias']);
    expect(spain.levels.map((l) => l.set)).toEqual([
      { kind: 'regions', country: 'ES', level: 1 },
      { kind: 'regions', country: 'ES', level: 0 },
    ]);
    // A map with one level of flags is the whole of it.
    expect(menu.regions.find((c) => c.country === 'JP')!.levels).toEqual([]);
    expect(menu.regions.filter((c) => c.levels.length > 0).map((c) => c.country).sort()).toEqual(['ES', 'FR', 'IT']);
  });
});
