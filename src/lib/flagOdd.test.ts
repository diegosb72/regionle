/**
 * «El intruso» of the section «Banderas» (lib/flagOdd.ts, and lib/flagGames.ts for its questions): the
 * groups of a set, the flags that can come from outside each, and the questions that are made of them,
 * with the flags the site is built with.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { OTHER_CONTINENT as LINKED } from './connect';
import { groupAt, nearCards, type AlikeFile, type Near } from './flagAlike';
import { FLAG_OPTIONS, questionCount, roundOf, type FlagPlay } from './flagGames';
import { OTHER_CONTINENT, oddCount, oddGroups, oddPool, oddRound, type OddPool } from './flagOdd';
import { deckOf, flagSetText, sameMap, setMenu, twins, type DeckCard, type FlagSet, type SameFile } from './flagSets';
import type { FlagsFile } from './flags';
import { setLang } from './i18n';
import { mulberry32 } from './text';
import type { Index } from './types';

const json = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(process.cwd(), file), 'utf8')) as T;
const FLAGS = json<FlagsFile>('public/data/flags.json');
const INDEX = json<Index>('public/data/index.json');
const SAME = sameMap(json<SameFile>('public/data/alike/same.json'));
const COUNTRIES = json<AlikeFile>('public/data/alike/countries.json');
const deck = (set: FlagSet) => deckOf(set, INDEX, FLAGS, SAME);
const pool = (set: FlagSet): OddPool => oddPool(set, deck(set), INDEX, FLAGS, SAME);
const WORLD: FlagSet = { kind: 'countries' };
const EUROPE: FlagSet = { kind: 'countries', continent: 'EU' };
const SPAIN: FlagSet = { kind: 'regions', country: 'ES' };
const TERRITORIES: FlagSet = { kind: 'territories' };
const CAPITALS: FlagSet = { kind: 'capitals' };
const play = (set: FlagSet, more: Partial<FlagPlay> = {}): FlagPlay => ({ game: 'flag-odd', set, length: 10, answer: 'choice', ...more });
const continentOf = (id: string): string => INDEX.countries.find((c) => c.id === id)?.ct ?? '';
/** What looks like each country, among all the States: what the flag from outside is taken by. */
const NEAR: ReadonlyMap<string, readonly Near[]> = nearCards(groupAt(COUNTRIES, { group: 'states' }), deck(WORLD));

afterEach(() => setLang('es'));

describe('the groups of «El intruso»', () => {
  it('are the continents of a set that spans them, each with the flags that are of it', () => {
    const world = oddGroups(WORLD, deck(WORLD), INDEX);
    expect(world.map((g) => [g.id, g.name, g.cards.length])).toEqual([
      ['EU', 'Países de Europa', 46],
      ['AS', 'Países de Asia', 48],
      ['AF', 'Países de África', 55],
      ['AM', 'Países de América', 35],
      ['OC', 'Países de Oceanía', 14],
    ]);
    for (const group of world) {
      expect(group.cards.every((card) => continentOf(card.country) === group.id), group.id).toBe(true);
      expect(group.looks.size).toBeGreaterThan(0);
      for (const card of group.cards) expect(group.looks.has(card.look)).toBe(true);
    }
    expect(oddCount({ groups: world })).toBe(198);
    expect(oddGroups(TERRITORIES, deck(TERRITORIES), INDEX).map((g) => g.name)).toEqual(['Territorios de Europa', 'Territorios de Asia', 'Territorios de América', 'Territorios de Oceanía', 'Territorios de Antártida']);
    const capitals = oddGroups(CAPITALS, deck(CAPITALS), INDEX);
    expect(capitals.map((g) => g.name)).toEqual(['Capitales de Europa', 'Capitales de Asia', 'Capitales de África', 'Capitales de América', 'Capitales de Oceanía']);
    expect(oddCount({ groups: capitals })).toBe(deck(CAPITALS).length);
    setLang('en');
    expect(oddGroups(WORLD, deck(WORLD), INDEX).map((g) => g.name)).toEqual(['Countries of Europe', 'Countries of Asia', 'Countries of Africa', 'Countries of the Americas', 'Countries of Oceania']);
    expect(oddGroups(TERRITORIES, deck(TERRITORIES), INDEX)[2].name).toBe('Territories of the Americas');
    expect(oddGroups(CAPITALS, deck(CAPITALS), INDEX)[3].name).toBe('Capitals of the Americas');
  });

  it('is the set itself where it is of one thing: a continent, the regions of a country, a kind of flag', () => {
    const one = (set: FlagSet) => oddGroups(set, deck(set), INDEX).map((g) => [g.id, g.name, g.cards.length]);
    expect(one(EUROPE)).toEqual([['set', 'Países de Europa', 46]]);
    expect(one(SPAIN)).toEqual([['set', 'Regiones de España', 55]]);
    expect(one({ kind: 'regions', country: 'ES', level: 1 })).toEqual([['set', 'Comunidades autónomas de España', 19]]);
    expect(one({ kind: 'cities', country: 'ES' })).toEqual([['set', 'Ciudades de España', 48]]);
    expect(one({ kind: 'gone' })).toEqual([['set', 'Países que ya no existen', 210]]);
    expect(one({ kind: 'signals' })).toEqual([['set', 'Código internacional de señales', 40]]);
  });

  it('is no group with fewer than three flags that can share a question', () => {
    const emirates = deck({ kind: 'regions', country: 'AE' });
    // Six flags that are four pictures: a group. Two of them, or four that are two pictures, none.
    expect(oddGroups({ kind: 'regions', country: 'AE' }, emirates, INDEX)).toHaveLength(1);
    expect(oddGroups({ kind: 'regions', country: 'AE' }, emirates.slice(0, 2), INDEX)).toEqual([]);
    const twinned = emirates.filter((card) => ['AE-AJ', 'AE-DU', 'AE-RK', 'AE-SH'].includes(card.id));
    expect(twinned).toHaveLength(4);
    expect(oddGroups({ kind: 'regions', country: 'AE' }, twinned, INDEX)).toEqual([]);
    expect(oddCount({ groups: [] })).toBe(0);
    // Of the capitals of a continent with two flags, nothing is asked: the other continents are.
    const few = deck(CAPITALS).filter((card) => continentOf(card.country) !== 'OC' || ['NZ', 'AU'].includes(card.country));
    expect(oddGroups(CAPITALS, few, INDEX).map((g) => g.id)).toEqual(['EU', 'AS', 'AF', 'AM']);
  });
});

describe('the flags that come from outside', () => {
  it('are of another continent, among the countries: every flag of a set that spans them, each of its own', () => {
    const world = pool(WORLD);
    expect(world.out).toHaveLength(198);
    expect(world.out.map((o) => o.card)).toEqual(deck(WORLD));
    const by = (id: string) => world.out.find((o) => o.card.id === id)!;
    expect(by('ES')).toMatchObject({ group: 'EU', tag: 'Europa' });
    expect(by('JP')).toMatchObject({ group: 'AS', tag: 'Asia' });
    expect(by('BR')).toMatchObject({ group: 'AM', tag: 'América' });
    expect(by('ES').also).toBeUndefined();
    // A country that lies on two continents is of both: no flag from outside in either.
    expect(by('RU')).toMatchObject({ group: 'EU', also: 'AS' });
    expect(by('TR')).toMatchObject({ group: 'AS', also: 'EU' });
    expect(OTHER_CONTINENT).toEqual(LINKED);
    for (const [id, other] of Object.entries(OTHER_CONTINENT)) expect(continentOf(id), id).not.toBe(other);
    // With those of one continent: the States of the others, less the ones that are of it too.
    const europe = pool(EUROPE);
    expect(europe.out).toHaveLength(198 - 46 - 5);
    expect(europe.out.every((o) => o.group === null && continentOf(o.card.country) !== 'EU')).toBe(true);
    for (const id of ['TR', 'KZ', 'AZ', 'GE', 'AM']) expect(europe.out.some((o) => o.card.id === id), id).toBe(false);
    expect(europe.out.find((o) => o.card.id === 'JP')!.tag).toBe('Asia');
    const asia = pool({ kind: 'countries', continent: 'AS' });
    for (const id of ['RU', 'CY', 'EG']) expect(asia.out.some((o) => o.card.id === id), id).toBe(false);
    setLang('en');
    expect(pool(WORLD).out.find((o) => o.card.id === 'BR')!.tag).toBe('Americas');
  });

  it('are of another country, among its regions and its cities: from the same continent where there are enough', () => {
    const spain = pool(SPAIN);
    expect(spain.out.length).toBeGreaterThan(500);
    expect(spain.out.every((o) => o.card.kind === 'region' && o.card.country !== 'ES' && continentOf(o.card.country) === 'EU')).toBe(true);
    expect(spain.out.find((o) => o.card.country === 'FR')!.tag).toBe('Francia');
    // The levels of a map take theirs from the same place.
    expect(pool({ kind: 'regions', country: 'ES', level: 1 }).out).toHaveLength(spain.out.length);
    const towns = pool({ kind: 'cities', country: 'ES' });
    expect(towns.out.length).toBeGreaterThan(300);
    expect(towns.out.every((o) => (o.card.kind === 'city' || o.card.kind === 'capital') && o.card.country !== 'ES' && continentOf(o.card.country) === 'EU')).toBe(true);
    // From the same continent alone where it has a dozen of them; from anywhere otherwise. Never of the country itself.
    const menu = setMenu(INDEX, FLAGS, SAME);
    const continents = new Set<string>();
    for (const choice of menu.regions) {
      const out = pool(choice.set).out;
      const near = out.filter((o) => continentOf(o.card.country) === continentOf(choice.country));
      continents.add(continentOf(choice.country));
      expect(out.some((o) => o.card.country === choice.country), choice.name).toBe(false);
      if (near.length >= 12) expect(out, choice.name).toHaveLength(near.length);
      else expect(out.length, choice.name).toBeGreaterThan(1000);
    }
    expect([...continents].sort()).toEqual(['AF', 'AM', 'AS', 'EU', 'OC']);
  });

  it('are of another kind, among the flags that are of no country', () => {
    const tags = (set: FlagSet) => [...new Set(pool(set).out.map((o) => o.tag))];
    expect(tags({ kind: 'gone' })).toEqual(['organización', 'pueblo']);
    expect(tags({ kind: 'organisations' })).toEqual(['pueblo', 'país que ya no existe']);
    expect(tags({ kind: 'peoples' })).toEqual(['organización', 'país que ya no existe']);
    expect(pool({ kind: 'gone' }).out).toHaveLength(deck({ kind: 'organisations' }).length + deck({ kind: 'peoples' }).length);
    // Among the signals of the sea: those of the races, and those that are of no code.
    const signals = pool({ kind: 'signals' });
    expect(signals.out).toHaveLength(25);
    expect(tags({ kind: 'signals' })).toEqual(['carreras de motor', 'no es del código']);
    expect(signals.out.every((o) => o.card.kind === 'signal' && o.card.group !== 'sea' && !!o.card.look && !!o.card.said)).toBe(true);
    setLang('en');
    expect(tags({ kind: 'signals' })).toEqual(['motor racing', 'not of the code']);
    expect(tags({ kind: 'gone' })).toEqual(['organisation', 'people']);
  });
});

describe('the questions of «El intruso»', () => {
  const sets: FlagSet[] = [WORLD, EUROPE, TERRITORIES, SPAIN, { kind: 'regions', country: 'AE' }, CAPITALS, { kind: 'cities', country: 'ES' }, { kind: 'gone' }, { kind: 'organisations' }, { kind: 'peoples' }, { kind: 'signals' }];

  it('are three flags of a group and one from outside it, which is the one that is asked', () => {
    for (const set of sets) {
      const cards = deck(set);
      const from = pool(set);
      const where = flagSetText(set);
      const round = roundOf(play(set), cards, mulberry32(5), new Map(), undefined, { odd: from });
      expect(round, where).toHaveLength(Math.min(10, cards.length));
      for (const q of round) {
        expect(q.options, where).toHaveLength(FLAG_OPTIONS);
        expect(q.right, where).toBe(q.card.key);
        expect(q.options.filter((o) => o.key === q.right), where).toHaveLength(1);
        expect(q.order).toEqual([]);
        const group = from.groups.find((g) => g.name === q.odd!.group)!;
        expect(group, where).toBeTruthy();
        const inside = q.options.filter((o) => o.key !== q.right);
        for (const card of inside) expect(group.cards, where).toContain(card);
        // The one from outside is no flag of the group, by its key or by its picture.
        expect(group.cards.some((card) => card.key === q.card.key), where).toBe(false);
        expect(group.looks.has(q.card.look), where).toBe(false);
        expect(from.out.find((o) => o.card.key === q.card.key)!.tag, where).toBe(q.odd!.tag);
        for (let i = 0; i < q.options.length; i++) for (let j = i + 1; j < q.options.length; j++) expect(twins(q.options[i], q.options[j]), `${where}: ${q.options[i].name} / ${q.options[j].name}`).toBe(false);
      }
      // Another flag from outside in each question, while there are others.
      expect(new Set(round.map((q) => q.card.key)).size, where).toBe(round.length);
    }
  });

  it('are one for each flag of the set with «Todas»: each is one of the three of a question', () => {
    for (const set of sets) {
      const cards = deck(set);
      const from = pool(set);
      const round = roundOf(play(set, { length: 'all' }), cards, mulberry32(6), new Map(), undefined, { odd: from });
      expect(round, flagSetText(set)).toHaveLength(cards.length);
      const inside = new Set(round.flatMap((q) => q.options.filter((o) => o.key !== q.right).map((o) => o.key)));
      for (const card of cards) expect(inside.has(card.key), `${flagSetText(set)} ${card.name}`).toBe(true);
    }
    // The right one is not always in the same place.
    const places = new Set(roundOf(play(WORLD, { length: 'all' }), deck(WORLD), mulberry32(1), new Map(), undefined, { odd: pool(WORLD) }).map((q) => q.options.findIndex((o) => o.key === q.right)));
    expect([...places].sort()).toEqual([0, 1, 2, 3]);
  });

  it('take the one from outside, among the countries, from those that look like one of the three', () => {
    const world = deck(WORLD);
    const from = pool(WORLD);
    let alike = 0;
    let all = 0;
    for (let seed = 1; seed <= 6; seed++) {
      for (const q of roundOf(play(WORLD, { length: 20 }), world, mulberry32(seed), NEAR, undefined, { odd: from })) {
        all++;
        const like = new Set(q.options.filter((o) => o.key !== q.right).flatMap((o) => (NEAR.get(o.key) ?? []).map((n) => n.card.key)));
        if (like.has(q.card.key)) alike++;
      }
    }
    expect(all).toBe(120);
    expect(alike).toBeGreaterThan(110);
    // With no look-alikes known, any flag from outside: far fewer are like one of the three.
    let chance = 0;
    for (let seed = 1; seed <= 6; seed++) {
      for (const q of roundOf(play(WORLD, { length: 20 }), world, mulberry32(seed), new Map(), undefined, { odd: from })) {
        const like = new Set(q.options.filter((o) => o.key !== q.right).flatMap((o) => (NEAR.get(o.key) ?? []).map((n) => n.card.key)));
        if (like.has(q.card.key)) chance++;
      }
    }
    expect(chance).toBeLessThan(alike / 2);
    // The same for the same luck, another for another.
    const keys = (seed: number) => roundOf(play(WORLD), world, mulberry32(seed), NEAR, undefined, { odd: from }).map((q) => q.options.map((o) => o.id).join(''));
    expect(keys(4)).toEqual(keys(4));
    expect(keys(4)).not.toEqual(keys(5));
  });

  it('never bring from outside the picture of a flag of the group, nor a country that is of that continent too', () => {
    const europe = deck(EUROPE);
    const fromEurope = pool(EUROPE);
    const world = deck(WORLD);
    const fromWorld = pool(WORLD);
    const outsiders = new Set<string>();
    const pairs = new Set<string>();
    for (let seed = 1; seed <= 25; seed++) {
      for (const q of roundOf(play(EUROPE, { length: 'all' }), europe, mulberry32(seed), NEAR, undefined, { odd: fromEurope })) outsiders.add(q.card.id);
      for (const q of roundOf(play(WORLD, { length: 'all' }), world, mulberry32(seed), NEAR, undefined, { odd: fromWorld })) pairs.add(`${q.card.id} ${fromWorld.groups.find((g) => g.name === q.odd!.group)!.id}`);
    }
    // Chad flies the flag of Romania, and Indonesia that of Monaco: neither is from outside Europe, to the eye.
    expect(outsiders.has('TD')).toBe(false);
    expect(outsiders.has('ID')).toBe(false);
    expect(outsiders.size).toBeGreaterThan(40);
    for (const pair of ['TD EU', 'RO AF', 'ID EU', 'MC AS', 'RU AS', 'TR EU', 'KZ EU', 'CY AS', 'EG AS', 'ID OC']) expect(pairs.has(pair), pair).toBe(false);
    // They are from outside all the same where they are: Chad among those of Asia, Russia among those of Africa.
    expect([...pairs].some((pair) => pair.startsWith('TD ') && !pair.endsWith(' AF'))).toBe(true);
    expect([...pairs].some((pair) => pair.startsWith('RU '))).toBe(true);
    for (const pair of pairs) {
      const [id, group] = pair.split(' ');
      expect(continentOf(id), pair).not.toBe(group);
    }
  });

  it('ask again the flags from outside that were missed, each beside three others of a group it is not of', () => {
    const world = deck(WORLD);
    const from = pool(WORLD);
    const first = roundOf(play(WORLD), world, mulberry32(3), NEAR, undefined, { odd: from });
    const missed = new Set(first.slice(0, 4).map((q) => q.card.key));
    const again = roundOf(play(WORLD), world, mulberry32(9), NEAR, missed, { odd: from });
    expect(again.map((q) => q.card.key).sort()).toEqual([...missed].sort());
    for (const q of again) {
      expect(q.options).toHaveLength(FLAG_OPTIONS);
      const group = from.groups.find((g) => g.name === q.odd!.group)!;
      expect(group.id).not.toBe(continentOf(q.card.country));
      expect(group.looks.has(q.card.look)).toBe(false);
    }
    // Those of a set that is one group: the same group, other three.
    const spain = deck(SPAIN);
    const fromSpain = pool(SPAIN);
    const key = roundOf(play(SPAIN), spain, mulberry32(3), new Map(), undefined, { odd: fromSpain })[0].card.key;
    const once = oddRound(fromSpain, 10, mulberry32(4), undefined, new Set([key]));
    expect(once).toHaveLength(1);
    expect(once[0]).toMatchObject({ group: 'Regiones de España' });
    expect(once[0].card.key).toBe(key);
    expect(once[0].trio).toHaveLength(3);
    // A flag that is not from outside is not asked.
    expect(oddRound(fromSpain, 10, mulberry32(4), undefined, new Set([spain[0].key]))).toEqual([]);
  });

  it('are as many as is said, with the flags of every set there is to choose', () => {
    const menu = setMenu(INDEX, FLAGS, SAME);
    const all = [...menu.countries, menu.territories, ...menu.regions, ...menu.regions.flatMap((c) => c.levels), menu.capitals, ...menu.cities, menu.gone, menu.organisations, menu.peoples, menu.signals].filter((c) => !!c).map((c) => c!.set);
    expect(all.length).toBeGreaterThan(150);
    const none: string[] = [];
    for (const set of all) {
      const cards = deck(set);
      const from = pool(set);
      const where = flagSetText(set);
      // What the chooser counts with the groups alone is what the game asks with the flags from outside.
      const said = questionCount(play(set, { length: 'all' }), cards, undefined, { odd: { groups: oddGroups(set, cards, INDEX) } });
      expect(questionCount(play(set, { length: 'all' }), cards, undefined, { odd: from }), where).toBe(said);
      if (!said) {
        none.push(where);
        continue;
      }
      expect(from.out.length, where).toBeGreaterThan(0);
      expect(roundOf(play(set, { length: 'all' }), cards, mulberry32(2), new Map(), undefined, { odd: from }), where).toHaveLength(said);
      expect(roundOf(play(set, { length: 20 }), cards, mulberry32(2), new Map(), undefined, { odd: from }), where).toHaveLength(Math.min(20, said));
    }
    // There is a game with every set.
    expect(none).toEqual([]);
  });

  it('are none without the flags from outside, or without what the game is asked with', () => {
    const world = deck(WORLD);
    expect(questionCount(play(WORLD), world)).toBe(0);
    expect(roundOf(play(WORLD), world, mulberry32(1))).toEqual([]);
    // The groups alone say how many there will be, and ask nothing.
    const groups = oddGroups(WORLD, world, INDEX);
    expect(questionCount(play(WORLD, { length: 'all' }), world, undefined, { odd: { groups } })).toBe(198);
    expect(roundOf(play(WORLD), world, mulberry32(1), new Map(), undefined, { odd: { groups } })).toEqual([]);
    const lone: DeckCard[] = world.slice(0, 2);
    expect(questionCount(play(EUROPE), lone, undefined, { odd: oddPool(EUROPE, lone, INDEX, FLAGS, SAME) })).toBe(0);
  });
});
