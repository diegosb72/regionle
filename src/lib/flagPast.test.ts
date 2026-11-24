/**
 * «Antes y ahora»: what scripts/data/flags-alike.mjs writes of the flags that the countries flew before
 * (on flags painted here, and what is published against the flags the site is built with), and what the
 * game makes of it (lib/flagPast.ts, and lib/flagGames.ts for its questions).
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error a script of the build, written without types
import { ALSO, DRAWN, KEEP_PAST, alsoFlew, besidePast, groupsOf, lookOf, pastGroupsOf, pastKey as scriptKey } from '../../scripts/data/flags-alike.mjs';
import { FLAG_OPTIONS, questionCount, roundOf, type FlagExtra, type FlagPlay } from './flagGames';
import { PAST_MIN, drawPast, pastAsked, pastCards, pastKey, pastOptions, pastPlace, type PastFile } from './flagPast';
import { deckOf, flagSetText, sameMap, twins, type DeckCard, type FlagSet, type SameFile } from './flagSets';
import type { FlagsFile } from './flags';
import { setLang } from './i18n';
import { mulberry32 } from './text';
import type { Index } from './types';

const json = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(process.cwd(), file), 'utf8')) as T;
const FLAGS = json<FlagsFile>('public/data/flags.json');
const INDEX = json<Index>('public/data/index.json');
const SAME = sameMap(json<SameFile>('public/data/alike/same.json'));
const PAST = json<PastFile>('public/data/alike/past.json');
const deck = (set: FlagSet) => deckOf(set, INDEX, FLAGS, SAME);
const WORLD: FlagSet = { kind: 'countries' };
const EUROPE: FlagSet = { kind: 'countries', continent: 'EU' };
const TERRITORIES: FlagSet = { kind: 'territories' };
const play = (set: FlagSet, more: Partial<FlagPlay> = {}): FlagPlay => ({ game: 'flag-past', set, length: 10, answer: 'choice', ...more });
const extraOf = (set: FlagSet, data: PastFile | null = PAST): FlagExtra => ({ past: { cards: pastCards(deck(set), FLAGS), data, place: pastPlace(set)! } });
const land = (id: string) => INDEX.countries.find((c) => c.id === id)!;

type Look = { px: Float32Array; pal: Float32Array };
type Rgb = [number, number, number];
const { w: W, h: H } = DRAWN as { w: number; h: number };
const paint = (colour: (x: number, y: number) => Rgb): Look => {
  const data = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) data.set(colour(x / W, y / H), (y * W + x) * 3);
  return (lookOf as (data: Uint8Array) => Look)(data);
};
const flat = (...bands: Rgb[]) => paint((_, y) => bands[Math.min(bands.length - 1, Math.floor(y * bands.length))]);
const RED: Rgb = [206, 17, 38];
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const GREEN: Rgb = [0, 122, 61];
const BLUE: Rgb = [0, 40, 140];
const YELLOW: Rgb = [252, 209, 22];

const flew = alsoFlew as (country: string, look: Look, flown: Map<string, Look[]>) => string[];
const beside = besidePast as (country: string, look: Look, members: string[], today: Map<string, Look>, also: string[], keep?: number) => (string | number)[];
const groupsOfPast = pastGroupsOf as (index: unknown, flags: unknown) => Record<string, [string, string][]>;

afterEach(() => setLang('es'));

describe('the flags of other times, as scripts/data/flags-alike.mjs sees them', () => {
  it('are in the groups the game is played in: the States, those of each continent, and the territories', () => {
    const index = {
      continents: { EU: {}, AS: {}, AF: {} },
      countries: [
        { id: 'ES', fl: 'es', cl: 'un', ct: 'EU' },
        { id: 'FR', fl: 'fr', cl: 'un', ct: 'EU' },
        { id: 'JP', fl: 'jp', cl: 'un', ct: 'AS' },
        { id: 'TW', fl: 'tw', cl: 'partial', ct: 'AS' },
        { id: 'GI', fl: 'gi', cl: 'dep', ct: 'EU' },
        // One with no flag of today has none to be set beside another, and is in no group.
        { id: 'YY', cl: 'un', ct: 'EU' },
      ],
    };
    const flags = { past: { ES: [['a.svg', 1.5, 1785, 1873], ['b.svg', 1.5, 1931, 1939]], TW: [['c.svg', 1.5, 1912, 1928]], GI: [['d.svg', 2, 0, 1982]], YY: [['e.svg', 1.5, 1, 2]] } };
    // A flag is in every group its country is in; a group with none is not there (Africa, and Asia has one).
    expect(groupsOfPast(index, flags)).toEqual({
      states: [
        ['ES', 'a.svg'],
        ['ES', 'b.svg'],
        ['TW', 'c.svg'],
      ],
      EU: [
        ['ES', 'a.svg'],
        ['ES', 'b.svg'],
      ],
      AS: [['TW', 'c.svg']],
      territories: [['GI', 'd.svg']],
    });
    expect(groupsOfPast(index, {})).toEqual({});
    expect(scriptKey('ES', 'a.svg')).toBe('ES:a.svg');
  });

  it('know which other countries flew a flag, or one as good as it', () => {
    const tricolour = flat(RED, WHITE, BLACK);
    // The same with a shade of difference: another drawing of the same flag.
    const again = flat([210, 20, 40], WHITE, [6, 6, 6]);
    const flown = new Map<string, Look[]>([
      ['EG', [flat(RED, WHITE, BLACK, YELLOW), tricolour]],
      ['LY', [flat(GREEN), again]],
      ['YE', [tricolour]],
      ['DE', [flat(BLACK, RED, YELLOW), flat(BLACK, WHITE, RED)]],
      ['JP', [flat(WHITE)]],
    ]);
    // Whether it is the flag of today (Yemen) or one of before (Libya); never the country itself.
    expect(flew('EG', tricolour, flown)).toEqual(['LY', 'YE']);
    expect(flew('YE', tricolour, flown)).toEqual(['EG', 'LY']);
    // The same colours in another order are another flag.
    expect(flew('DE', flat(BLACK, WHITE, RED), flown)).toEqual([]);
    expect(flew('XX', flat(BLUE), flown)).toEqual([]);
    expect(ALSO).toBeGreaterThan(0);
    expect(ALSO).toBeLessThan(10);
  });

  it('set beside a flag the countries whose flag of today is most like it, never its own nor one that flew it', () => {
    const old = flat(RED, WHITE, BLACK);
    const today = new Map<string, Look>([
      ['EG', flat(RED, WHITE, BLACK, YELLOW)],
      ['YE', old],
      ['NL', flat(RED, WHITE, BLUE)],
      ['HU', flat(RED, WHITE, GREEN)],
      ['JP', flat(WHITE)],
      ['SE', flat(BLUE, YELLOW)],
    ]);
    const all = [...today.keys()];
    const near = beside('EG', old, all, today, ['YE']);
    const ids = near.filter((_, i) => i % 2 === 0);
    // Pairs of country and score, the nearest first.
    expect(near).toHaveLength(8);
    expect(ids).not.toContain('EG');
    expect(ids).not.toContain('YE');
    expect(ids.slice(0, 2).sort()).toEqual(['HU', 'NL']);
    const scores = near.filter((_, i) => i % 2 === 1) as number[];
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
    for (const score of scores) expect(Number.isInteger(score)).toBe(true);
    // No more than asked for, only the members of the group, and nothing is too far to be kept.
    expect(beside('EG', old, all, today, [], 2)).toHaveLength(4);
    expect(beside('EG', old, ['NL', 'SE', 'ZZ'], today, []).filter((_, i) => i % 2 === 0)).toEqual(['NL', 'SE']);
    expect(beside('EG', old, all, today, []).filter((_, i) => i % 2 === 0)[0]).toBe('YE');
    expect(KEEP_PAST).toBeGreaterThanOrEqual(2 * (FLAG_OPTIONS - 1));
  });
});

describe('what is published of the flags of other times (public/data/alike/past.json)', () => {
  const wanted = groupsOfPast(INDEX, FLAGS);
  const members = (groupsOf as (index: unknown, flags: unknown) => { countries: Record<string, string[]> })(INDEX, FLAGS).countries;
  const every = Object.entries(FLAGS.past ?? {}).flatMap(([country, rows]) => rows.map((row) => `${country}:${row[0]}`));

  it('is of the flags the site is built with: run `npm run data:flag-alike` when this fails', () => {
    expect(PAST.v).toBe(1);
    expect(Object.keys(PAST.groups)).toEqual(Object.keys(wanted));
    expect(Object.keys(PAST.groups)).toEqual(['states', 'EU', 'AS', 'AF', 'AM', 'OC', 'territories']);
    for (const [id, list] of Object.entries(wanted)) expect(Object.keys(PAST.groups[id]), id).toEqual(list.map(([country, file]) => `${country}:${file}`));
    // Every flag has how far it is from the one of today, whatever group it is in.
    expect(Object.keys(PAST.own).sort()).toEqual([...new Set(every)].sort());
    expect(every.length).toBe(300);
    for (const key of Object.keys(PAST.also)) expect(every, key).toContain(key);
  });

  it('is well made: beside each flag, countries of its group, the nearest first, none of them its own nor one that flew it', () => {
    let lists = 0;
    for (const [id, list] of Object.entries(PAST.groups)) {
      const of = new Set(id === 'territories' ? members.territories : members[id]);
      for (const [key, near] of Object.entries(list)) {
        const where = `${id} ${key}`;
        lists++;
        expect(near.length % 2, where).toBe(0);
        expect(near.length, where).toBeLessThanOrEqual(2 * KEEP_PAST);
        // Enough for a question, whatever the group: three beside the right one.
        expect(near.length, where).toBeGreaterThanOrEqual(2 * (FLAG_OPTIONS - 1));
        const also = new Set(PAST.also[key] ?? []);
        let last = 0;
        const seen = new Set<string>();
        for (let k = 0; k < near.length; k += 2) {
          const [country, score] = [String(near[k]), Number(near[k + 1])];
          expect(of.has(country), `${where} → ${country}`).toBe(true);
          expect(country === key.split(':')[0] || also.has(country) || seen.has(country), `${where} → ${country}`).toBe(false);
          seen.add(country);
          expect(Number.isInteger(score) && score >= last, where).toBe(true);
          last = score;
        }
      }
    }
    expect(lists).toBeGreaterThan(550);
    for (const [key, own] of Object.entries(PAST.own)) expect(Number.isInteger(own) && own >= 0, key).toBe(true);
    for (const [key, also] of Object.entries(PAST.also)) {
      expect(also.length, key).toBeGreaterThan(0);
      expect(also, key).not.toContain(key.split(':')[0]);
      for (const country of also) expect(land(country), `${key} → ${country}`).toBeTruthy();
    }
  });

  it('knows the flags that more than one country flew', () => {
    const file = (country: string, from: number, to: number): string => `${country}:${FLAGS.past![country].find((row) => row[2] === from && row[3] === to)![0]}`;
    // The federation of Arab republics: Egypt, Libya and Syria at once.
    expect(PAST.also[file('EG', 1972, 1984)]).toEqual(expect.arrayContaining(['LY', 'SY']));
    expect(PAST.also[file('LY', 1972, 1977)]).toEqual(expect.arrayContaining(['EG', 'SY']));
    // The blue and white of Central America, with its arms: four countries.
    expect(PAST.also[file('HN', 1823, 1824)].sort()).toEqual(['CR', 'NI', 'SV']);
    // A white cloth: the Bourbons of France, and the Taliban.
    expect(PAST.also[file('FR', 1815, 1830)]).toContain('AF');
    expect(PAST.also[file('AF', 1996, 1997)]).toContain('FR');
    // The black and yellow of the Habsburgs, in Austria and in Hungary.
    expect(PAST.also[file('AT', 1804, 1867)]).toEqual(['HU']);
    // Most flags were of one country alone.
    expect(Object.keys(PAST.also).length).toBeLessThan(every.length / 4);
    expect(PAST.also[file('ES', 1931, 1939)]).toBeUndefined();
  });

  it('sets beside a flag the ones of today that a person would take it for', () => {
    const near = (group: string, country: string, from: number): string[] => {
      const row = FLAGS.past![country].find((r) => r[2] === from)!;
      return PAST.groups[group][`${country}:${row[0]}`].filter((_, i) => i % 2 === 0).map(String);
    };
    // The black, white and red of imperial Germany: Yemen, which flies them the other way up.
    expect(near('states', 'DE', 1867)[0]).toBe('YE');
    expect(near('states', 'DE', 1867).slice(0, 4)).toEqual(expect.arrayContaining(['EG', 'IQ']));
    // Among those of Europe, others: Yemen is not there.
    expect(near('EU', 'DE', 1867)).not.toContain('YE');
    expect(near('EU', 'DE', 1867).every((id) => land(id).ct === 'EU')).toBe(true);
    // The red of Albania with its eagle, in any year: the red flags of today.
    expect(near('states', 'AL', 1946).slice(0, 4)).toEqual(expect.arrayContaining(['VN', 'TR']));
    // How far each is from the flag of today: the white of the Bourbons is nothing like the red and yellow, the flag of 1843 is.
    const own = (country: string, from: number): number => PAST.own[`${country}:${FLAGS.past![country].find((r) => r[2] === from)![0]}`];
    expect(own('ES', 1701)).toBeGreaterThan(60);
    expect(own('ES', 1843)).toBeLessThan(25);
    expect(own('ES', 1931)).toBeGreaterThan(own('ES', 1843));
    expect(own('PL', 1919)).toBeLessThan(5);
  });
});

describe('the flags a game of «Antes y ahora» asks (lib/flagPast.ts)', () => {
  const world = deck(WORLD);
  const cards = pastCards(world, FLAGS);
  const of = (id: string): DeckCard[] => cards.get(`country:${id}`) ?? [];

  it('is played with the countries, and with nothing else', () => {
    expect(pastPlace(WORLD)).toBe('states');
    expect(pastPlace(EUROPE)).toBe('EU');
    expect(pastPlace(TERRITORIES)).toBe('territories');
    for (const set of [{ kind: 'regions', country: 'ES' }, { kind: 'capitals' }, { kind: 'cities', country: 'ES' }, { kind: 'gone' }, { kind: 'organisations' }, { kind: 'peoples' }, { kind: 'signals' }] as FlagSet[]) expect(pastPlace(set), flagSetText(set)).toBeNull();
    // The groups of the file are the ones the sets say.
    for (const set of [WORLD, EUROPE, TERRITORIES, { kind: 'countries', continent: 'OC' }] as FlagSet[]) expect(PAST.groups[pastPlace(set)!], flagSetText(set)).toBeTruthy();
    expect(PAST_MIN).toBe(FLAG_OPTIONS);
  });

  it('are the flags each country of the set flew before, the oldest first, each under the name of its country', () => {
    expect(cards.size).toBe(81);
    expect([...cards.values()].flat()).toHaveLength(291);
    const spain = of('ES');
    expect(spain.map((c) => c.years![0])).toEqual([1701, 1760, 1843, 1931, 1939, 1945, 1977]);
    const republic = spain[3];
    expect(republic).toMatchObject({ kind: 'past', id: 'ES', country: 'ES', name: 'España', years: [1931, 1939], ratio: 1.67, said: 'espana' });
    expect(republic.key).toBe(`past:ES:${republic.file}`);
    expect(republic.src).toMatch(/flags\/commons\/[0-9a-f]{10}\.svg$/);
    expect(republic.answers).toEqual(world.find((c) => c.id === 'ES')!.answers);
    expect(pastKey(republic)).toBe(`ES:${republic.file}`);
    expect(PAST.own[pastKey(republic)]).toBeGreaterThan(0);
    // A heavy drawing is shown small by its picture.
    expect(spain[0].small).toMatch(/\.webp$/);
    expect(spain[0].src).toMatch(/\.svg$/);
    // Every card with a key of its own, and each a flag the file knows.
    const all = [...cards.values()].flat();
    expect(new Set(all.map((c) => c.key)).size).toBe(all.length);
    for (const card of all) expect(PAST.own[pastKey(card)], card.key).toBeGreaterThanOrEqual(0);
    // A country that never changed its flag is not asked; a set that is not of countries has none.
    expect(of('JP')).toEqual([]);
    expect(pastCards(deck({ kind: 'regions', country: 'ES' }), FLAGS).size).toBe(0);
    // Those of a continent, and those of the territories.
    expect(pastCards(deck(EUROPE), FLAGS).size).toBe(26);
    expect(pastCards(deck({ kind: 'countries', continent: 'OC' }), FLAGS).size).toBe(1);
    expect([...pastCards(deck(TERRITORIES), FLAGS).keys()].sort()).toEqual(['country:AS', 'country:BM', 'country:CK', 'country:FK', 'country:GG', 'country:JE']);
    setLang('en');
    expect(pastCards(deck(WORLD), FLAGS).get('country:ES')![0].name).toBe('Spain');
  });

  it('draws one of the flags of a country, the ones that differ most from that of today more often', () => {
    const spain = of('ES');
    const drawn = new Map<number, number>();
    const rng = mulberry32(11);
    for (let i = 0; i < 4000; i++) {
      const from = drawPast(spain, PAST, rng).years![0];
      drawn.set(from, (drawn.get(from) ?? 0) + 1);
    }
    // All of them come up…
    expect([...drawn.keys()].sort()).toEqual([1701, 1760, 1843, 1931, 1939, 1945, 1977]);
    // …the white flags of the Bourbons and that of the Republic far more than the red and yellow of 1843.
    expect(drawn.get(1701)!).toBeGreaterThan(3 * drawn.get(1843)!);
    expect(drawn.get(1931)!).toBeGreaterThan(2 * drawn.get(1843)!);
    // With nothing written of them, any of them alike; and one alone is that one.
    const plain = new Map<number, number>();
    for (let i = 0; i < 3500; i++) {
      const from = drawPast(spain, null, rng).years![0];
      plain.set(from, (plain.get(from) ?? 0) + 1);
    }
    for (const n of plain.values()) expect(Math.abs(n - 500)).toBeLessThan(120);
    expect(drawPast(spain.slice(0, 1), PAST, rng)).toBe(spain[0]);
    // The lot decides: the first with the least, the last with the most.
    expect(drawPast(spain, PAST, () => 0)).toBe(spain[0]);
    expect(drawPast(spain, PAST, () => 0.999999)).toBe(spain[6]);
  });

  it('asks one flag of each country, no more countries than the game is long, or the very flags that were missed', () => {
    const rng = mulberry32(3);
    const ten = pastAsked(cards, PAST, 10, rng);
    expect(ten).toHaveLength(10);
    expect(new Set(ten.map((c) => c.id)).size).toBe(10);
    const all = pastAsked(cards, PAST, 'all', rng);
    expect(all).toHaveLength(81);
    expect(new Set(all.map((c) => c.id)).size).toBe(81);
    // Another game, other countries and other flags of them.
    expect(pastAsked(cards, PAST, 10, mulberry32(4)).map((c) => c.key)).not.toEqual(pastAsked(cards, PAST, 10, mulberry32(5)).map((c) => c.key));
    const missed = new Set([of('ES')[0].key, of('ES')[3].key, of('US')[5].key]);
    expect(pastAsked(cards, PAST, 10, rng, missed).map((c) => c.key).sort()).toEqual([...missed].sort());
  });

  it('offers the country that flew the flag beside the three whose flag of today is most like it', () => {
    const germany = of('DE').find((c) => c.years![0] === 1867)!;
    const options = pastOptions(germany, world, PAST, 'states', FLAG_OPTIONS, mulberry32(1));
    expect(options.map((o) => o.id).sort()).toEqual(['DE', 'EG', 'IQ', 'YE']);
    // They are cards of the set: the countries of today, with their flags.
    for (const option of options) expect(world).toContain(option);
    // Among those of Europe, the nearest of Europe.
    const europe = deck(EUROPE);
    const there = pastOptions(germany, europe, PAST, 'EU', FLAG_OPTIONS, mulberry32(1));
    expect(there).toHaveLength(4);
    expect(there.map((o) => o.id)).toContain('DE');
    expect(there.every((o) => land(o.id).ct === 'EU')).toBe(true);
    // The right one is not always in the same place.
    const places = new Set(Array.from({ length: 40 }, (_, seed) => pastOptions(germany, world, PAST, 'states', FLAG_OPTIONS, mulberry32(seed)).findIndex((o) => o.id === 'DE')));
    expect([...places].sort()).toEqual([0, 1, 2, 3]);
    // With nothing written of the flags, any three of the set; a country that is not in it has nothing to offer.
    const blind = pastOptions(germany, world, null, 'states', FLAG_OPTIONS, mulberry32(1));
    expect(blind).toHaveLength(4);
    expect(blind.map((o) => o.id)).toContain('DE');
    expect(pastOptions(germany, deck({ kind: 'countries', continent: 'AS' }), PAST, 'AS', FLAG_OPTIONS)).toEqual([]);
  });

  it('never offers a country that flew the flag too, nor two countries with the same flag of today', () => {
    let questions = 0;
    for (const set of [WORLD, EUROPE, { kind: 'countries', continent: 'AS' }, { kind: 'countries', continent: 'AF' }, { kind: 'countries', continent: 'AM' }, TERRITORIES] as FlagSet[]) {
      const lands = deck(set);
      const place = pastPlace(set)!;
      for (const [key, flags] of pastCards(lands, FLAGS)) {
        for (const card of flags) {
          for (let seed = 1; seed <= 3; seed++) {
            const options = pastOptions(card, lands, PAST, place, FLAG_OPTIONS, mulberry32(seed));
            const where = `${flagSetText(set)} ${card.key}`;
            questions++;
            expect(options, where).toHaveLength(FLAG_OPTIONS);
            expect(options.filter((o) => o.key === key), where).toHaveLength(1);
            const also = new Set(PAST.also[pastKey(card)] ?? []);
            for (const option of options) expect(also.has(option.id), `${where} → ${option.name}`).toBe(false);
            for (let i = 0; i < options.length; i++) for (let j = i + 1; j < options.length; j++) expect(twins(options[i], options[j]), `${where}: ${options[i].name} / ${options[j].name}`).toBe(false);
          }
        }
      }
    }
    expect(questions).toBeGreaterThan(1500);
    // Romania's old flags never come with Chad, whose flag of today is Romania's.
    const romania = of('RO');
    expect(romania.length).toBeGreaterThan(0);
    for (const card of romania) for (let seed = 1; seed <= 20; seed++) expect(pastOptions(card, world, PAST, 'states', FLAG_OPTIONS, mulberry32(seed)).map((o) => o.id)).not.toContain('TD');
    // The white flag of the Taliban, whatever the luck: never France, which flew it under the Bourbons.
    const white = of('AF').find((c) => c.years![0] === 1996)!;
    for (let seed = 1; seed <= 60; seed++) expect(pastOptions(white, world, null, 'states', FLAG_OPTIONS, mulberry32(seed)).map((o) => o.id)).toContain('AF');
    for (let seed = 1; seed <= 200; seed++) expect(pastOptions(white, world, { ...PAST, groups: {} }, 'states', FLAG_OPTIONS, mulberry32(seed)).map((o) => o.id)).not.toContain('FR');
  });
});

describe('a game of «Antes y ahora» (lib/flagGames.ts)', () => {
  it('has a question for each country of the set that flew another flag, and none where they are too few', () => {
    const world = deck(WORLD);
    expect(questionCount(play(WORLD), world, undefined, extraOf(WORLD))).toBe(10);
    expect(questionCount(play(WORLD, { length: 20 }), world, undefined, extraOf(WORLD))).toBe(20);
    expect(questionCount(play(WORLD, { length: 'all' }), world, undefined, extraOf(WORLD))).toBe(81);
    expect(questionCount(play(EUROPE, { length: 'all' }), deck(EUROPE), undefined, extraOf(EUROPE))).toBe(26);
    expect(questionCount(play(TERRITORIES, { length: 20 }), deck(TERRITORIES), undefined, extraOf(TERRITORIES))).toBe(6);
    // One country of Oceania changed its flag: no game. And with what is not countries there is nothing to ask.
    const oceania: FlagSet = { kind: 'countries', continent: 'OC' };
    expect(questionCount(play(oceania, { length: 'all' }), deck(oceania), undefined, extraOf(oceania))).toBe(0);
    expect(roundOf(play(oceania), deck(oceania), mulberry32(1), new Map(), undefined, extraOf(oceania))).toEqual([]);
    expect(questionCount(play(WORLD), world)).toBe(0);
    expect(roundOf(play(WORLD), world, mulberry32(1))).toEqual([]);
  });

  it('asks a flag of another time, and is answered by the country of the set that flew it', () => {
    for (const set of [WORLD, EUROPE, { kind: 'countries', continent: 'AF' }, TERRITORIES] as FlagSet[]) {
      const lands = deck(set);
      const extra = extraOf(set);
      for (const length of [10, 20, 'all'] as const) {
        const round = roundOf(play(set, { length }), lands, mulberry32(9), new Map(), undefined, extra);
        const where = `${flagSetText(set)} ${length}`;
        expect(round, where).toHaveLength(questionCount(play(set, { length }), lands, undefined, extra));
        expect(new Set(round.map((q) => q.card.id)).size, where).toBe(round.length);
        for (const q of round) {
          expect(q.card.kind, where).toBe('past');
          expect(q.options, where).toHaveLength(FLAG_OPTIONS);
          // The right answer is not the card, which is no option: it is the country.
          expect(q.right, where).toBe(`country:${q.card.id}`);
          expect(q.options.filter((o) => o.key === q.right), where).toHaveLength(1);
          expect(q.options.some((o) => o.key === q.card.key), where).toBe(false);
          for (const option of q.options) expect(lands, where).toContain(option);
          expect(q.order).toEqual([]);
          expect(q.odd).toBeUndefined();
        }
      }
    }
  });

  it('is the same for the same luck, another for another, and of the flags that were missed when it goes over them', () => {
    const world = deck(WORLD);
    const extra = extraOf(WORLD);
    const keys = (seed: number) => roundOf(play(WORLD), world, mulberry32(seed), new Map(), undefined, extra).map((q) => `${q.card.key} ${q.options.map((o) => o.id).join('')}`);
    expect(keys(2)).toEqual(keys(2));
    expect(keys(2)).not.toEqual(keys(3));
    const first = roundOf(play(WORLD), world, mulberry32(2), new Map(), undefined, extra);
    const missed = new Set(first.slice(0, 3).map((q) => q.card.key));
    const again = roundOf(play(WORLD), world, mulberry32(8), new Map(), missed, extra);
    expect(again.map((q) => q.card.key).sort()).toEqual([...missed].sort());
    for (const q of again) expect(q.options).toHaveLength(FLAG_OPTIONS);
    // Without what is written of the flags the game still asks: the answers are then any of the set.
    const blind = roundOf(play(WORLD), world, mulberry32(2), new Map(), undefined, extraOf(WORLD, null));
    expect(blind).toHaveLength(10);
    for (const q of blind) expect(q.options.filter((o) => o.key === q.right)).toHaveLength(1);
  });
});
