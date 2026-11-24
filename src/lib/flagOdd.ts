/**
 * «El intruso»: four flags, three of a group and one from outside it, which is the one to find. The group
 * is the set that is played with (the regions of Spain, the countries of Europe, the organisations) or,
 * where the set spans the continents (the countries of the world, the territories, the capitals), those of
 * one continent, another for each question.
 *
 * The one from outside is of the same kind and from somewhere else: a country of another continent, a
 * region of another country, an organisation among the peoples. It is never the picture of a flag of the
 * group, whoever flies it: Chad is no intruder among the countries of Europe, where Romania is. Among the
 * countries it is, where it can be, one that looks like one of the three (lib/flagAlike.ts): Ivory Coast
 * beside Ireland.
 */
import type { Near } from './flagAlike';
import { cityCounts, signalFlags, type FlagsFile } from './flags';
import { apart, beside, deckOf, flagSetName, twins, type DeckCard, type FlagSet } from './flagSets';
import { L, nm } from './i18n';
import { fold, shuffle, type Rng } from './text';
import type { Index } from './types';

/** Some flags that are of one thing: what three of a question are taken from. */
export interface OddGroup {
  id: string;
  /** What they are, as the question says it: «Países de Europa», «Regiones de España». */
  name: string;
  cards: DeckCard[];
  /** The pictures of its flags: none of them is ever the one from outside. */
  looks: ReadonlySet<string>;
}

/** A flag that can be the one from outside. */
export interface OddOut {
  card: DeckCard;
  /** The group it is of, where the groups are the continents of the set; null where it is of no group of it. */
  group: string | null;
  /** What it is of, said in a word once the question is answered: «África», «Francia», «organización». */
  tag: string;
  /** The other continent of a country that lies on two: it is no flag from outside there either. */
  also?: string;
}

export interface OddPool {
  groups: OddGroup[];
  out: OddOut[];
}

/** A group is one with three flags that can be set side by side. */
const GROUP_MIN = 3;
/** Where the flags from outside can be from near (the regions of the same continent), they are, when there are these many. */
const NEAR_MIN = 12;
/** Among the countries, the one from outside is one of these many that look most like one of the three. */
const ALIKE_BEST = 4;

/**
 * The other continent of each country that lies on two, next to the one the game files it under (as
 * lib/connect.ts has them, which a test keeps in step): Russia is filed under Europe and is no intruder
 * among the countries of Asia, nor Turkey among those of Europe. Either could be argued.
 */
export const OTHER_CONTINENT: Readonly<Record<string, string>> = { RU: 'AS', TR: 'EU', KZ: 'EU', AZ: 'EU', GE: 'EU', AM: 'EU', CY: 'AS', EG: 'AS', ID: 'OC' };

/** Whether the groups of a set are the continents its flags are of. */
const spans = (set: FlagSet): boolean => (set.kind === 'countries' && !set.continent) || set.kind === 'territories' || set.kind === 'capitals';

/** What the flags of a continent are called in a set that spans them. */
function continentGroup(set: FlagSet, continent: string, index: Index): string {
  if (set.kind === 'countries') return flagSetName({ kind: 'countries', continent }, index);
  const name = nm(index.continents[continent]);
  const of = continent === 'AM' ? 'the Americas' : name;
  return set.kind === 'capitals' ? L(`Capitales de ${name}`, `Capitals of ${of}`) : L(`Territorios de ${name}`, `Territories of ${of}`);
}

/** The groups of a set: the set itself, or the continents its flags are of. A group with fewer than three flags that can share a question is none. */
export function oddGroups(set: FlagSet, deck: readonly DeckCard[], index: Index): OddGroup[] {
  const group = (id: string, name: string, cards: DeckCard[]): OddGroup[] => (apart(cards, GROUP_MIN).length >= GROUP_MIN ? [{ id, name, cards, looks: new Set(cards.map((c) => c.look)) }] : []);
  if (!spans(set)) return group('set', flagSetName(set, index), [...deck]);
  const where = new Map(index.countries.map((c) => [c.id, c.ct]));
  return Object.keys(index.continents).flatMap((continent) =>
    group(
      continent,
      continentGroup(set, continent, index),
      deck.filter((card) => where.get(card.country) === continent),
    ),
  );
}

/** How many questions there are to ask: one for each flag of a group, which is one of the three of its question. */
export const oddCount = (pool: Pick<OddPool, 'groups'>): number => pool.groups.reduce((n, g) => n + g.cards.length, 0);

/** The flags of a set and those that can come from outside it. */
export function oddPool(set: FlagSet, deck: readonly DeckCard[], index: Index, file: FlagsFile, same: ReadonlyMap<string, string> = new Map(), base?: string): OddPool {
  const groups = oddGroups(set, deck, index);
  const lands = new Map(index.countries.map((c) => [c.id, c]));
  const continent = (id: string): string => lands.get(id)?.ct ?? '';
  const continentName = (id: string): string => (index.continents[continent(id)] ? nm(index.continents[continent(id)]) : '');
  const landName = (id: string): string => (lands.has(id) ? nm(lands.get(id)!.n) : id);
  const of = (other: FlagSet): DeckCard[] => deckOf(other, index, file, same, base);
  const tagged = (cards: readonly DeckCard[], tag: string): OddOut[] => cards.map((card) => ({ card, group: null, tag }));
  /** A flag of a set that spans the continents: of its continent, and of the other where its country lies on two. */
  const placed = (card: DeckCard): OddOut => ({ card, group: continent(card.country), tag: continentName(card.country), ...(OTHER_CONTINENT[card.country] ? { also: OTHER_CONTINENT[card.country] } : {}) });
  /** From the countries of the same continent where they have flags enough; from anywhere otherwise. */
  const elsewhere = (own: string, others: readonly string[], flagsOf: (country: string) => DeckCard[]): OddOut[] => {
    const from = (list: readonly string[]): OddOut[] => list.flatMap((country) => tagged(flagsOf(country), landName(country)));
    const near = from(others.filter((country) => continent(country) === continent(own)));
    return near.length >= NEAR_MIN ? near : [...near, ...from(others.filter((country) => continent(country) !== continent(own)))];
  };

  let out: OddOut[];
  switch (set.kind) {
    case 'countries':
      out = set.continent
        ? of({ kind: 'countries' })
            .filter((card) => continent(card.country) !== set.continent && OTHER_CONTINENT[card.country] !== set.continent)
            .map((card) => ({ card, group: null, tag: continentName(card.country) }))
        : deck.map(placed);
      break;
    case 'territories':
    case 'capitals':
      out = deck.map(placed);
      break;
    case 'regions':
      out = elsewhere(
        set.country,
        Object.keys(file.regions).filter((country) => country !== set.country),
        (country) => of({ kind: 'regions', country }),
      );
      break;
    case 'cities':
      out = elsewhere(
        set.country,
        [...cityCounts(file).keys()].filter((country) => country !== set.country),
        (country) => of({ kind: 'cities', country }),
      );
      break;
    case 'gone':
      out = [...tagged(of({ kind: 'organisations' }), L('organización', 'organisation')), ...tagged(of({ kind: 'peoples' }), L('pueblo', 'people'))];
      break;
    case 'organisations':
      out = [...tagged(of({ kind: 'peoples' }), L('pueblo', 'people')), ...tagged(of({ kind: 'gone' }), L('país que ya no existe', 'country that is no more'))];
      break;
    case 'peoples':
      out = [...tagged(of({ kind: 'organisations' }), L('organización', 'organisation')), ...tagged(of({ kind: 'gone' }), L('país que ya no existe', 'country that is no more'))];
      break;
    default:
      // The signals that are not of the code of the sea: those of the races, and those that are of no code.
      out = signalFlags(file, base)
        .filter((card) => card.group !== 'sea')
        .map((card) => ({
          card: { ...card, look: same.get(card.file ?? '') ?? card.file ?? card.key, said: fold(card.name), answers: [card.name, card.alt ?? ''].filter(Boolean) },
          group: null,
          tag: card.group === 'race' ? L('carreras de motor', 'motor racing') : L('no es del código', 'not of the code'),
        }));
  }
  return { groups, out };
}

/** One question: the flag from outside, the three it is set beside, what those are and what it is. */
export interface OddAsked {
  card: DeckCard;
  trio: DeckCard[];
  group: string;
  tag: string;
}

/**
 * The questions of a game. Each flag of the set is one of the three of a question, the flags by lot and
 * no more than `length` of them; the one from outside is another in each. `near` are the flags that look
 * like each (the countries have them): the one from outside is then one of those. `only` are the keys of
 * the flags from outside to ask again, each beside three others.
 */
export function oddRound(pool: OddPool, length: number | 'all', rng: Rng = Math.random, near?: ReadonlyMap<string, readonly Near[]>, only?: ReadonlySet<string>): OddAsked[] {
  /** The flags that have been the one from outside already: another is taken while there is one. */
  const used = new Set<string>();
  const outside = (group: OddGroup, o: OddOut): boolean => o.group !== group.id && o.also !== group.id && !group.looks.has(o.card.look);
  const fits = (group: OddGroup, o: OddOut, trio: readonly DeckCard[]): boolean => outside(group, o) && !trio.some((t) => twins(t, o.card));
  const out: OddAsked[] = [];

  if (only) {
    for (const o of shuffle(pool.out.filter((x) => only.has(x.card.key)), rng)) {
      for (const group of shuffle(pool.groups, rng)) {
        if (!outside(group, o)) continue;
        const trio = beside(o.card, shuffle(group.cards, rng), GROUP_MIN);
        if (trio.length < GROUP_MIN) continue;
        out.push({ card: o.card, trio, group: group.name, tag: o.tag });
        break;
      }
    }
    return out;
  }

  const anchors = shuffle(pool.groups.flatMap((group) => group.cards.map((card) => ({ group, card }))), rng);
  for (const { group, card } of length === 'all' ? anchors : anchors.slice(0, length)) {
    const trio = [card, ...beside(card, shuffle(group.cards, rng), GROUP_MIN - 1)];
    if (trio.length < GROUP_MIN) continue;
    const all = pool.out.filter((o) => fits(group, o, trio));
    if (!all.length) continue;
    const fresh = all.filter((o) => !used.has(o.card.key));
    const able = fresh.length ? fresh : all;
    let pick: OddOut | undefined;
    if (near) {
      // How like one of the three each flag is: the least of its scores.
      const score = new Map<string, number>();
      for (const t of trio) for (const n of near.get(t.key) ?? []) score.set(n.card.key, Math.min(score.get(n.card.key) ?? Infinity, n.score));
      const alike = able.filter((o) => score.has(o.card.key)).sort((a, b) => score.get(a.card.key)! - score.get(b.card.key)!);
      if (alike.length) pick = alike[Math.floor(rng() * Math.min(ALIKE_BEST, alike.length))];
    }
    pick ??= able[Math.floor(rng() * able.length)];
    used.add(pick.card.key);
    out.push({ card: pick.card, trio: shuffle(trio, rng), group: group.name, tag: pick.tag });
  }
  return out;
}
