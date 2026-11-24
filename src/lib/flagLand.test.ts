/**
 * «¿De qué país es?»: what scripts/data/flags-alike.mjs writes of the flags of the divisions (on flags
 * painted here, and what is published against the flags the site is built with), and what the game makes
 * of it (lib/flagLand.ts, and lib/flagGames.ts for its questions).
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error a script of the build, written without types
import { ALSO, DRAWN, SHADE, alsoFlew, fliesToo, landFlagsOf, landMark, lookOf, shades, within } from '../../scripts/data/flags-alike.mjs';
import { FLAG_LENGTHS, FLAG_OPTIONS, flagGameHelp, questionCount, roundOf, type FlagExtra, type FlagPlay } from './flagGames';
import { LAND_MIN, NAME_BREAK, landAsked, landCards, landKey, landOptions, playsLand, type LandFile } from './flagLand';
import { deckOf, flagSetText, sameMap, twins, type DeckCard, type FlagSet, type SameFile } from './flagSets';
import type { FlagsFile } from './flags';
import { setLang } from './i18n';
import { mulberry32 } from './text';
import type { Index } from './types';

const json = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(process.cwd(), file), 'utf8')) as T;
const FLAGS = json<FlagsFile>('public/data/flags.json');
const INDEX = json<Index>('public/data/index.json');
const SAME = sameMap(json<SameFile>('public/data/alike/same.json'));
const LANDS = json<LandFile>('public/data/alike/lands.json');
const deck = (set: FlagSet) => deckOf(set, INDEX, FLAGS, SAME);
const WORLD: FlagSet = { kind: 'countries' };
const CONTINENTS = ['EU', 'AS', 'AF', 'AM', 'OC'] as const;
const WHERE = new Map(INDEX.countries.map((c) => [c.id, c.ct]));
const play = (set: FlagSet, more: Partial<FlagPlay> = {}): FlagPlay => ({ game: 'flag-land', set, length: 10, answer: 'choice', ...more });
const extraOf = (set: FlagSet, data: LandFile | null = LANDS): FlagExtra => ({ land: { cards: landCards(deck(set), INDEX, FLAGS, SAME), data, where: WHERE } });
const world = deck(WORLD);
const cards = landCards(world, INDEX, FLAGS, SAME);
const land = (id: string) => world.find((c) => c.id === id)!;
/** The flag of a division, by its country and a name of its. */
const flagOf = (country: string, name: string): DeckCard => cards.get(land(country).key)!.find((c) => c.name.split(NAME_BREAK).includes(name))!;

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
const DARK_RED: Rgb = [170, 20, 40];
const ORANGE: Rgb = [255, 128, 0];
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const BLUE: Rgb = [0, 40, 140];
const ROYAL: Rgb = [0, 87, 183];
const YELLOW: Rgb = [252, 209, 22];

const near = within as (a: Look, b: Look, max: number) => boolean;
const shade = shades as (a: Look, b: Look) => boolean;
const flies = fliesToo as (a: Look, b: Look) => boolean;
const flew = alsoFlew as (country: string, look: Look, flown: Map<string, Look[]>, close?: (a: Look, b: Look) => boolean) => string[];
const flagsOf = landFlagsOf as (index: unknown, flags: unknown) => [string, string][];
const markOf = landMark as (list: [string, string][]) => string;

afterEach(() => setLang('es'));

describe('the flags of the divisions, as scripts/data/flags-alike.mjs sees them', () => {
  it('are those of the States that have any, each picture once for its country, and none of a dependency', () => {
    const index = {
      countries: [
        { id: 'ES', fl: 'es', cl: 'un' },
        { id: 'XK', fl: 'xk', cl: 'partial' },
        { id: 'VA', fl: 'va', cl: 'obs' },
        { id: 'GL', fl: 'gl', cl: 'dep' },
        { id: 'ZZ', cl: 'un' },
        { id: 'FR', fl: 'fr', cl: 'un' },
      ],
    };
    const row = (id: string, file: string) => [id, 0, id, id, file, 1.5];
    const flags = {
      regions: {
        ES: [row('ES-M', 'madrid.svg'), row('ES-MD', 'madrid.svg'), row('ES-CT', 'cat.svg')],
        XK: [row('XK-1', 'one.webp')],
        GL: [row('GL-1', 'north.svg')],
        ZZ: [row('ZZ-1', 'lost.svg')],
        FR: [row('FR-66', 'cat.svg')],
      },
    };
    expect(flagsOf(index, flags)).toEqual([
      ['ES', 'madrid.svg'],
      ['ES', 'cat.svg'],
      ['XK', 'one.webp'],
      ['FR', 'cat.svg'],
    ]);
  });

  it('are marked by what tells their list from another', () => {
    const list: [string, string][] = [
      ['ES', 'a.svg'],
      ['FR', 'b.svg'],
    ];
    expect(markOf(list)).toMatch(/^[0-9a-f]{10}$/);
    expect(markOf(list)).toBe(markOf([...list]));
    expect(markOf(list)).not.toBe(markOf([...list].reverse()));
    expect(markOf(list)).not.toBe(markOf([...list, ['FR', 'c.svg']]));
    expect(markOf(list)).not.toBe(markOf([list[0], ['FR', 'B.svg']]));
  });

  it('are the same design in two shades when no part of them differs much, however far they are on the whole', () => {
    const poland = flat(WHITE, RED);
    const thuringia = flat(WHITE, DARK_RED);
    // Too far on the whole for the line of the flags of other times, and still the same flag to whoever meets one alone.
    expect(near(poland, thuringia, ALSO)).toBe(false);
    expect(shade(poland, thuringia)).toBe(true);
    expect(flies(poland, thuringia)).toBe(true);
    expect(flies(flat(BLUE, YELLOW), flat(ROYAL, YELLOW))).toBe(true);
    // Another colour is another flag, and so is the same one upside down.
    expect(shade(poland, flat(WHITE, ORANGE))).toBe(false);
    expect(shade(poland, flat(RED, WHITE))).toBe(false);
    expect(flies(poland, flat(RED, WHITE))).toBe(false);
    expect(SHADE).toBeGreaterThan(ALSO);
  });

  it('are not the same when one bears something the other has not, however small', () => {
    const plain = flat(WHITE, RED);
    const disc = (r: number) => paint((x, y) => (Math.hypot((x - 0.5) * 1.5, y - 0.5) < r ? BLACK : y < 0.5 ? WHITE : RED));
    // A badge the size of a coin moves the whole very little, and one part of it a lot.
    expect(near(plain, disc(0.12), ALSO)).toBe(true);
    expect(shade(plain, disc(0.12))).toBe(false);
    // It is as good as the plain one all the same: within the line of the whole. A large one is not.
    expect(flies(plain, disc(0.12))).toBe(true);
    expect(flies(plain, disc(0.3))).toBe(false);
  });

  it('are flown too by the countries that have one as good, as their own or as that of a division', () => {
    const hesse = flat(RED, WHITE);
    const flown = new Map<string, Look[]>([
      ['DE', [flat(BLACK, RED, YELLOW), hesse]],
      ['ID', [flat(RED, WHITE)]],
      ['MC', [flat(DARK_RED, WHITE)]],
      ['PL', [flat(WHITE, RED)]],
      ['AT', [flat(RED, WHITE, RED), flat(BLUE, YELLOW), flat(DARK_RED, WHITE)]],
    ]);
    // By the line of the flags of other times, only the very same; by that of the divisions, its shades too. Never its own country.
    expect(flew('DE', hesse, flown)).toEqual(['ID']);
    expect(flew('DE', hesse, flown, flies)).toEqual(['ID', 'MC', 'AT']);
    expect(flew('PL', flat(WHITE, DARK_RED), flown, flies)).toEqual([]);
    expect(flew('XX', flat(WHITE, DARK_RED), flown, flies)).toEqual(['PL']);
  });
});

describe('what is published of the flags of the divisions (public/data/alike/lands.json)', () => {
  const wanted = flagsOf(INDEX, FLAGS);
  const keys = new Set(wanted.map(([country, file]) => `${country}:${file}`));
  const states = new Set(world.map((c) => c.id));

  it('is of the flags the site is built with: run `npm run data:flag-alike` when this fails', () => {
    expect(LANDS.v).toBe(1);
    expect(LANDS.n).toBe(wanted.length);
    expect(LANDS.of).toBe(markOf(wanted));
    expect(wanted.length).toBe(2061);
    expect(new Set(wanted.map(([country]) => country)).size).toBe(116);
  });

  it('is well made: each flag that another country flies too, with those countries, none of them its own', () => {
    const entries = Object.entries(LANDS.also);
    expect(entries.length).toBeGreaterThan(40);
    expect(entries.length).toBeLessThan(keys.size / 10);
    for (const [key, also] of entries) {
      expect(keys, key).toContain(key);
      expect(also.length, key).toBeGreaterThan(0);
      expect(new Set(also).size, key).toBe(also.length);
      for (const id of also) {
        expect(states, `${key} ${id}`).toContain(id);
        expect(id, key).not.toBe(key.slice(0, 2));
      }
    }
  });

  it('knows the flags that are another country’s: Hesse and Indonesia, Thuringia and Poland, England and Genoa', () => {
    const also = (country: string, name: string) => LANDS.also[landKey(flagOf(country, name))] ?? [];
    expect(also('DE', 'Hesse')).toEqual(expect.arrayContaining(['ID', 'MC', 'AT']));
    expect(also('DE', 'Turingia')).toContain('PL');
    expect(also('AT', 'Baja Austria')).toContain('UA');
    expect(also('AT', 'Viena')).toEqual(expect.arrayContaining(['ID', 'MC', 'DE']));
    // …and those that a division of another country flies: the cross of Saint George, the bars of Aragon.
    expect(also('GB', 'Inglaterra')).toEqual(['IT']);
    expect(also('IT', 'Génova')).toEqual(['GB']);
    expect(also('ES', 'Cataluña')).toEqual(['FR']);
    expect(also('FR', 'Pirineos Orientales')).toEqual(['ES']);
    // A flag like no other has nothing written of it.
    expect(also('ES', 'Andalucía')).toEqual([]);
    expect(also('US', 'California')).toEqual([]);
  });
});

describe('the flags of the regions of a set of countries (lib/flagLand.ts)', () => {
  it('is played with the countries, all or those of a continent, and with nothing else', () => {
    expect(playsLand(WORLD)).toBe(true);
    for (const continent of CONTINENTS) expect(playsLand({ kind: 'countries', continent })).toBe(true);
    for (const set of [{ kind: 'territories' }, { kind: 'regions', country: 'ES' }, { kind: 'capitals' }, { kind: 'cities', country: 'JP' }, { kind: 'gone' }, { kind: 'organisations' }, { kind: 'peoples' }, { kind: 'signals' }] as FlagSet[]) {
      expect(playsLand(set), flagSetText(set)).toBe(false);
    }
  });

  it('are those of each country that has any, under their own names, each picture once', () => {
    expect(cards.size).toBe(116);
    // Three fewer than the files there are: pictures that are the same as another of their country, under another file.
    expect([...cards.values()].flat()).toHaveLength(2058);
    expect(LANDS.n).toBe(2061);
    for (const [key, list] of cards) {
      const owner = world.find((c) => c.key === key)!;
      expect(owner, key).toBeTruthy();
      expect(list.length, key).toBeGreaterThan(0);
      expect(new Set(list.map((c) => c.look)).size, key).toBe(list.length);
      expect(new Set(list.map((c) => c.key)).size, key).toBe(list.length);
      for (const card of list) {
        expect(card.kind).toBe('region');
        expect(card.country).toBe(owner.id);
        expect(card.file, card.key).toBeTruthy();
        expect(card.name, card.key).toBeTruthy();
      }
    }
    // The countries without flags of regions are not there, and the game does not ask them.
    expect(cards.has(land('VA').key)).toBe(false);
    expect(cards.get(land('ES').key)!.length).toBeGreaterThan(40);
    expect(flagOf('ES', 'Andalucía').name).toBe('Andalucía');
    // A flag that several divisions of a country fly is there once, under the names of them all.
    expect(flagOf('AT', 'Viena').name).toBe('Salzburgo / Viena / Vorarlberg');
    expect(flagOf('AT', 'Salzburgo')).toBe(flagOf('AT', 'Vorarlberg'));
    expect(flagOf('ES', 'Madrid').name).toBe('Comunidad de Madrid / Madrid');
    // In the other language, the names of that one.
    setLang('en');
    const english = landCards(deck(WORLD), INDEX, FLAGS, SAME);
    expect(english.get(land('AT').key)!.map((c) => c.name)).toContain('Salzburg / Vienna / Vorarlberg');
  });

  it('are fewer with the countries of a continent: only theirs', () => {
    let sum = 0;
    for (const continent of CONTINENTS) {
      const set: FlagSet = { kind: 'countries', continent };
      const mine = landCards(deck(set), INDEX, FLAGS, SAME);
      expect(mine.size, continent).toBeGreaterThanOrEqual(LAND_MIN);
      for (const key of mine.keys()) expect(WHERE.get(key.split(':')[1]), key).toBe(continent);
      sum += mine.size;
    }
    expect(sum).toBe(cards.size);
    // The sets that are not of countries have none.
    expect(landCards(deck({ kind: 'capitals' }), INDEX, FLAGS, SAME).size).toBe(0);
    expect(landCards(deck({ kind: 'regions', country: 'ES' }), INDEX, FLAGS, SAME).size).toBe(0);
  });

  it('asks one flag of each country, the countries by lot and the flag of each by lot too', () => {
    const asked = landAsked(cards, 10, mulberry32(1));
    expect(asked).toHaveLength(10);
    expect(new Set(asked.map((c) => c.country)).size).toBe(10);
    const all = landAsked(cards, 'all', mulberry32(1));
    expect(all).toHaveLength(cards.size);
    expect(new Set(all.map((c) => c.country)).size).toBe(cards.size);
    // Another game, other countries first and other flags of each.
    const again = landAsked(cards, 'all', mulberry32(2));
    expect(again.map((c) => c.country)).not.toEqual(all.map((c) => c.country));
    const spain = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) spain.add(landAsked(cards, 'all', mulberry32(seed)).find((c) => c.country === 'ES')!.key);
    expect(spain.size).toBeGreaterThan(10);
    expect(landAsked(cards, 'all', mulberry32(1))).toEqual(all);
    // The game that goes over what was missed asks those very flags, even two of one country.
    const missed = new Set([flagOf('ES', 'Andalucía').key, flagOf('ES', 'Cataluña').key, flagOf('DE', 'Hesse').key]);
    expect(
      landAsked(cards, 10, mulberry32(3), missed)
        .map((c) => c.key)
        .sort(),
    ).toEqual([...missed].sort());
  });

  it('offers the country of the flag among four that have flags of regions, all of its continent', () => {
    // Every flag of the game, not only those a game happens to ask.
    const rng = mulberry32(1);
    const places = new Set<number>();
    let asked = 0;
    for (const list of cards.values()) {
      for (const card of list) {
        const options = landOptions(card, world, cards, LANDS, WHERE, FLAG_OPTIONS, rng);
        expect(options, card.key).toHaveLength(FLAG_OPTIONS);
        expect(new Set(options.map((o) => o.key)).size).toBe(FLAG_OPTIONS);
        expect(options.filter((o) => o.id === card.country)).toHaveLength(1);
        for (const option of options) {
          expect(option.kind).toBe('country');
          expect(cards.has(option.key), `${card.key} ${option.id}`).toBe(true);
          // Every continent has countries enough with flags of regions, whatever is barred: no question goes outside its own.
          expect(WHERE.get(option.id), `${card.key} ${option.id}`).toBe(WHERE.get(card.country));
        }
        for (const a of options) for (const b of options) if (a !== b) expect(twins(a, b), `${a.id} ${b.id}`).toBe(false);
        places.add(options.findIndex((o) => o.id === card.country));
        asked++;
      }
    }
    expect(asked).toBe(2058);
    // The right one is not always in the same place.
    expect([...places].sort()).toEqual([0, 1, 2, 3]);
    // …and with the countries of one continent alone it is the same.
    for (const continent of CONTINENTS) {
      const mine = deck({ kind: 'countries', continent });
      const theirs = landCards(mine, INDEX, FLAGS, SAME);
      for (const list of theirs.values()) for (const card of list) expect(landOptions(card, mine, theirs, LANDS, WHERE, FLAG_OPTIONS, rng), card.key).toHaveLength(FLAG_OPTIONS);
    }
  });

  it('never offers a country that flies that flag too, nor one whose flag is the same picture as that of one that does', () => {
    const offered = (card: DeckCard, data: LandFile | null, set: readonly DeckCard[] = world): Set<string> => {
      const ids = new Set<string>();
      for (let seed = 1; seed <= 300; seed++) for (const option of landOptions(card, set, cards, data, WHERE, FLAG_OPTIONS, mulberry32(seed))) ids.add(option.id);
      return ids;
    };
    const hesse = flagOf('DE', 'Hesse');
    const fair = offered(hesse, LANDS);
    expect(fair.has('DE')).toBe(true);
    for (const id of LANDS.also[landKey(hesse)]) expect(fair.has(id), id).toBe(false);
    expect(fair.has('AT')).toBe(false);
    expect(fair.has('MC')).toBe(false);
    // Without what is written of them they would be: the game waits for that file.
    expect(offered(hesse, null).has('AT')).toBe(true);
    // Catalonia is never asked beside France, whose Pyrénées-Orientales fly the same bars; England, never beside Italy.
    expect(offered(flagOf('ES', 'Cataluña'), LANDS).has('FR')).toBe(false);
    expect(offered(flagOf('ES', 'Cataluña'), null).has('FR')).toBe(true);
    expect(offered(flagOf('GB', 'Inglaterra'), LANDS).has('IT')).toBe(false);
    // Every flag of the game, with every country written beside it.
    for (const list of cards.values()) {
      for (const card of list) {
        const also = LANDS.also[landKey(card)];
        if (!also) continue;
        const ids = offered(card, LANDS);
        for (const id of also) expect(ids.has(id), `${card.key} ${id}`).toBe(false);
      }
    }
    // Where Romania flies it, Chad is not offered either: their flags are one picture.
    const made: LandFile = { v: 1, n: 0, of: '', also: { [landKey(flagOf('ES', 'Andalucía'))]: ['RO'] } };
    const both = [...world.filter((c) => ['ES', 'RO', 'TD'].includes(c.id)), ...world.filter((c) => cards.has(c.key) && !['ES', 'RO', 'TD'].includes(c.id)).slice(0, 2)];
    const some = new Map([...cards].map(([key, list]) => [key, list] as const));
    some.set(land('TD').key, cards.get(land('ES').key)!);
    const ids = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) for (const option of landOptions(flagOf('ES', 'Andalucía'), both, some, made, WHERE, FLAG_OPTIONS, mulberry32(seed))) ids.add(option.id);
    expect(twins(land('RO'), land('TD'))).toBe(true);
    expect(ids.has('RO')).toBe(false);
    expect(ids.has('TD')).toBe(false);
    expect(ids.has('ES')).toBe(true);
  });

  it('goes outside the continent only when it has too few countries, and gives fewer options when the set has', () => {
    const few = world.filter((c) => ['ES', 'FR', 'JP', 'BR', 'US'].includes(c.id));
    const options = landOptions(flagOf('ES', 'Andalucía'), few, cards, LANDS, WHERE, FLAG_OPTIONS, mulberry32(1));
    expect(options).toHaveLength(FLAG_OPTIONS);
    expect(options.map((o) => o.id)).toEqual(expect.arrayContaining(['ES', 'FR']));
    expect(
      landOptions(flagOf('ES', 'Andalucía'), [land('ES'), land('FR')], cards, LANDS, WHERE, FLAG_OPTIONS, mulberry32(1))
        .map((o) => o.id)
        .sort(),
    ).toEqual(['ES', 'FR']);
    // A flag whose country is not in the set has nothing to be asked among.
    expect(landOptions(flagOf('DE', 'Hesse'), few, cards, LANDS, WHERE, FLAG_OPTIONS, mulberry32(1))).toEqual([]);
  });
});

describe('the questions of «¿De qué país es?» (lib/flagGames.ts)', () => {
  it('are as many as asked for: one for each country with flags of regions, at most', () => {
    expect(questionCount(play(WORLD), world, undefined, extraOf(WORLD))).toBe(10);
    expect(questionCount(play(WORLD, { length: 20 }), world, undefined, extraOf(WORLD))).toBe(20);
    expect(questionCount(play(WORLD, { length: 'all' }), world, undefined, extraOf(WORLD))).toBe(116);
    for (const continent of CONTINENTS) {
      const set: FlagSet = { kind: 'countries', continent };
      const extra = extraOf(set);
      const most = extra.land!.cards.size;
      for (const length of FLAG_LENGTHS) {
        const count = questionCount(play(set, { length }), deck(set), undefined, extra);
        expect(count, `${continent} ${length}`).toBe(length === 'all' ? most : Math.min(length, most));
        expect(roundOf(play(set, { length }), deck(set), mulberry32(1), undefined, undefined, extra), `${continent} ${length}`).toHaveLength(count);
      }
    }
    // Oceania has fewer than ten such countries: its game is shorter than asked.
    expect(questionCount(play({ kind: 'countries', continent: 'OC' }), deck({ kind: 'countries', continent: 'OC' }), undefined, extraOf({ kind: 'countries', continent: 'OC' }))).toBe(8);
    // Without the flags of the regions, or with fewer countries than a question shows, there is no game.
    expect(questionCount(play(WORLD), world)).toBe(0);
    expect(roundOf(play(WORLD), world, mulberry32(1))).toEqual([]);
    const three = new Map([...cards].slice(0, LAND_MIN - 1));
    expect(questionCount(play(WORLD), world, undefined, { land: { cards: three, data: LANDS, where: WHERE } })).toBe(0);
    expect(roundOf(play(WORLD), world, mulberry32(1), undefined, undefined, { land: { cards: three, data: LANDS, where: WHERE } })).toEqual([]);
  });

  it('show the flag of a region and are answered by its country, one of four', () => {
    const round = roundOf(play(WORLD, { length: 'all' }), world, mulberry32(4), undefined, undefined, extraOf(WORLD));
    expect(round).toHaveLength(116);
    expect(new Set(round.map((q) => q.card.country)).size).toBe(116);
    for (const q of round) {
      expect(q.card.kind).toBe('region');
      expect(q.options).toHaveLength(FLAG_OPTIONS);
      const owner = q.options.find((o) => o.key === q.right)!;
      expect(owner.kind).toBe('country');
      expect(owner.id).toBe(q.card.country);
      expect(q.order).toEqual([]);
      expect(q.odd).toBeUndefined();
    }
    // The same for the same luck, and others for another.
    const keys = (seed: number) => roundOf(play(WORLD), world, mulberry32(seed), undefined, undefined, extraOf(WORLD)).map((q) => `${q.card.key}:${q.options.map((o) => o.id).join('')}`);
    expect(keys(5)).toEqual(keys(5));
    expect(keys(5)).not.toEqual(keys(6));
  });

  it('go over the flags that were missed, each among countries of the whole set', () => {
    const missed = new Set([flagOf('ES', 'Andalucía').key, flagOf('JP', 'Tokio').key]);
    const round = roundOf(play(WORLD), world, mulberry32(7), undefined, missed, extraOf(WORLD));
    expect(round.map((q) => q.card.key).sort()).toEqual([...missed].sort());
    for (const q of round) expect(q.options).toHaveLength(FLAG_OPTIONS);
  });

  it('says how it is played, and that no country that flies the flag is among the other three', () => {
    const help = flagGameHelp('flag-land');
    expect(help.steps[0]).toContain('cuatro países');
    expect(help.steps[2]).toContain('una sola de las banderas de sus regiones');
    expect(help.tip).toContain('nunca uno que tenga esa misma bandera');
    setLang('en');
    expect(flagGameHelp('flag-land').tip).toContain('never one that flies that same flag');
  });
});
