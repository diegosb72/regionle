/**
 * The odd one out: four of the countries chosen, three of which share what the question says — a
 * continent, a coast, a neighbour, a size — and one that does not. Made from what the game already knows
 * of the countries, like the statements of "true or false", and told with its reason once it is answered.
 * Nothing is drawn here: the game only shows them.
 */
import { metricOf } from './figures';
import { L, getLang, nm } from './i18n';
import { ODD_MIN } from './rules';
import { APART, CASPIAN, TWO_CONTINENTS, inContinent, names, stateBorders, type StatementWorld } from './statements';
import { listed, pick, sample, shuffle, type Rng } from './text';
import type { Country } from './types';

/** What three of the four have in common. */
export type OddKind = 'continent' | 'landlocked' | 'coast' | 'island' | 'mainland' | 'border' | 'larger' | 'smaller' | 'more' | 'fewer';

/** The kinds by what they are about: a question about the sea is as likely as one about size, whichever way it is put. */
export const ODD_FAMILIES: readonly (readonly OddKind[])[] = [['continent'], ['landlocked', 'coast'], ['island', 'mainland'], ['border'], ['larger', 'smaller'], ['more', 'fewer']];
export const ODD_KINDS: readonly OddKind[] = ODD_FAMILIES.flat();

export { ODD_MIN };

export interface OddOne {
  /** The same four are not shown twice in a game for the same reason: this tells them apart. */
  key: string;
  kind: OddKind;
  /** What is asked; it says what three of them share. */
  text: string;
  /** The four countries, in the order they are shown. */
  ids: string[];
  /** The one that is not like the other three. */
  odd: string;
  /** Said once it is answered: what the three share, and how the fourth differs. */
  why: string;
}

/**
 * How many of the countries nearest a figure the ones shown are drawn from, on each side of it: now only the
 * closest, which is hard, now many more, which is easier.
 */
const NEAR: readonly number[] = [8, 20, 60];
/** A size is measured against a country most people can place: one of the most populous third of the list. */
const KNOWN = 3;
/** On a short list every country is as good as another to measure against. */
const KNOWN_MIN = 8;

interface Found {
  three: Country[];
  odd: Country;
  text: string;
  why: string;
  /** What else tells this question from another with the same four. */
  about?: string;
}
type Maker = (list: readonly Country[], world: StatementWorld, rng: Rng) => Found | null;

const borders = (c: Country): string[] => c.nb ?? [];
const touch = (a: Country, b: Country): boolean => borders(a).includes(b.id) || borders(b).includes(a.id);
/** "Bolivia, Chile y Perú": the three, by their names. */
const said = (three: readonly Country[]): string =>
  listed(
    three.map((c) => nm(c.n)).sort((a, b) => a.localeCompare(b, getLang())),
    L('y', 'and'),
  );

/** Three of those that have it and one of those that have not. */
function split(have: readonly Country[], lack: readonly Country[], rng: Rng): { three: Country[]; odd: Country } | null {
  if (have.length < 3 || !lack.length) return null;
  return { three: sample(have, 3, rng), odd: pick(lack, rng) };
}

/**
 * Three that border one same country, and nobody else with a claim: no other country borders three of the
 * four unless they are the same three, and none borders all four. Otherwise two answers could be argued.
 */
function oneReading(three: readonly Country[], odd: Country, world: StatementWorld): boolean {
  const four = [...three, odd];
  const trio = new Set(three.map((c) => c.id));
  for (const other of world.byId.values()) {
    const touched = four.filter((c) => c.id !== other.id && touch(other, c));
    if (touched.length >= 3 && !(touched.length === 3 && touched.every((c) => trio.has(c.id)))) return false;
  }
  return true;
}

/** Three on one side of a country by a figure, clearly, and one clearly on the other. */
function sized(of: (c: Country) => number, bigger: boolean, ask: (ref: string) => string, tell: (three: string, ref: string, odd: string) => string, fig: (c: Country) => string): Maker {
  return (list, _world, rng) => {
    const pool = list.filter((c) => of(c) > 0);
    const known = [...pool].sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0)).slice(0, Math.max(KNOWN_MIN, Math.ceil(pool.length / KNOWN)));
    for (let i = 0; i < 30 && pool.length >= ODD_MIN; i++) {
      const ref = pick(known, rng);
      const v = of(ref);
      const near = pick(NEAR, rng);
      // The nearest to the country they are measured against come first, on each side.
      const above = pool.filter((c) => of(c) >= v * APART).sort((a, b) => of(a) - of(b));
      const below = pool.filter((c) => of(c) <= v / APART).sort((a, b) => of(b) - of(a));
      const [same, other] = bigger ? [above, below] : [below, above];
      const found = split(same.slice(0, near), other.slice(0, near / 2), rng);
      if (!found) continue;
      const withFig = (c: Country) => `${nm(c.n)} (${fig(c)})`;
      const three = listed(
        [...found.three].sort((a, b) => nm(a.n).localeCompare(nm(b.n), getLang())).map(withFig),
        L('y', 'and'),
      );
      return { ...found, text: ask(nm(ref.n)), why: tell(three, withFig(ref), withFig(found.odd)), about: ref.id };
    }
    return null;
  };
}

const area = (c: Country): number => c.ar;
const people = (c: Country): number => c.pop ?? 0;
const km2 = (c: Country): string => metricOf('area').short(c.ar);
const heads = (c: Country): string => metricOf('pop').short(c.pop ?? 0);

const MAKERS: Record<OddKind, Maker> = {
  continent: (list, world, rng) => {
    // A country on two continents is left out: either could be argued.
    const pool = list.filter((c) => !TWO_CONTINENTS.has(c.id));
    const homes = [...new Set(pool.map((c) => c.ct))].filter((ct) => pool.filter((c) => c.ct === ct).length >= 3);
    if (!homes.length) return null;
    const ct = pick(homes, rng);
    const found = split(
      pool.filter((c) => c.ct === ct),
      pool.filter((c) => c.ct !== ct),
      rng,
    );
    if (!found) return null;
    const { three, odd } = found;
    return {
      ...found,
      text: L('Tres de estos países están en el mismo continente. ¿Cuál no?', 'Three of these countries are in the same continent. Which one is not?'),
      why: L(`${said(three)} están ${inContinent(ct, world)}; ${nm(odd.n)}, ${inContinent(odd.ct, world)}.`, `${said(three)} are ${inContinent(ct, world)}; ${nm(odd.n)}, ${inContinent(odd.ct, world)}.`),
    };
  },

  // The countries on the Caspian, which is a lake, are left out of both: whether that is a coast can be argued.
  landlocked: (list, _world, rng) => {
    const found = split(
      list.filter((c) => c.ll && !CASPIAN.has(c.id)),
      list.filter((c) => !c.ll),
      rng,
    );
    if (!found) return null;
    return {
      ...found,
      text: L('Tres de estos países no tienen salida al mar. ¿Cuál sí?', 'Three of these countries are landlocked. Which one is not?'),
      why: L(`${said(found.three)} no tienen costa; ${nm(found.odd.n)} sí.`, `${said(found.three)} have no coast; ${nm(found.odd.n)} has one.`),
    };
  },
  coast: (list, _world, rng) => {
    const found = split(
      list.filter((c) => !c.ll),
      list.filter((c) => c.ll && !CASPIAN.has(c.id)),
      rng,
    );
    if (!found) return null;
    return {
      ...found,
      text: L('Tres de estos países tienen salida al mar. ¿Cuál no?', 'Three of these countries have a coast. Which one is landlocked?'),
      why: L(`${said(found.three)} tienen costa; ${nm(found.odd.n)} no.`, `${said(found.three)} have a coast; ${nm(found.odd.n)} has none.`),
    };
  },

  // A border with a territory that is not a state (a base, a colony) is nobody's idea of a neighbour: a
  // country that has only those is on neither side.
  island: (list, world, rng) => {
    const joined = list.filter((c) => stateBorders(c, world).length > 0);
    // The ones with a neighbour or two are the ones taken for islands: they make the better question.
    const few = joined.filter((c) => borders(c).length <= 2);
    const found = split(
      list.filter((c) => !borders(c).length),
      few.length ? few : joined,
      rng,
    );
    if (!found) return null;
    const theirs = names(stateBorders(found.odd, world), world);
    return {
      ...found,
      text: L('Tres de estos países no tienen frontera terrestre con ningún otro. ¿Cuál sí?', 'Three of these countries have no land border with any other. Which one has?'),
      why: L(`${said(found.three)} no limitan por tierra con nadie; ${nm(found.odd.n)} limita con ${theirs}.`, `${said(found.three)} share no land border with anyone; ${nm(found.odd.n)} borders ${theirs}.`),
    };
  },
  mainland: (list, world, rng) => {
    const found = split(
      list.filter((c) => stateBorders(c, world).length > 0),
      list.filter((c) => !borders(c).length),
      rng,
    );
    if (!found) return null;
    return {
      ...found,
      text: L('Tres de estos países tienen frontera terrestre con algún otro. ¿Cuál no?', 'Three of these countries share a land border with another. Which one does not?'),
      why: L(`${said(found.three)} tienen vecinos por tierra; ${nm(found.odd.n)} no limita con nadie.`, `${said(found.three)} have neighbours by land; ${nm(found.odd.n)} borders nobody.`),
    };
  },

  border: (list, world, rng) => {
    const chosen = new Set(list.map((c) => c.id));
    const hubs = [...world.byId.values()].filter((h) => h.cl !== 'other' && borders(h).filter((id) => chosen.has(id)).length >= 3);
    for (let i = 0; i < 30 && hubs.length; i++) {
      const hub = pick(hubs, rng);
      const mine = new Set(borders(hub));
      const others = list.filter((c) => c.id !== hub.id && !touch(hub, c));
      // The ones that almost touch it make the best odd one: neighbours of its neighbours, then those of
      // its own part of the world, then those of its continent.
      const near = others.filter((c) => borders(c).some((id) => mine.has(id)));
      const region = others.filter((c) => c.sr === hub.sr);
      const continent = others.filter((c) => c.ct === hub.ct);
      const found = split(
        list.filter((c) => mine.has(c.id)),
        near.length ? near : region.length ? region : continent.length ? continent : others,
        rng,
      );
      if (!found || !oneReading(found.three, found.odd, world)) continue;
      return {
        ...found,
        text: L('Tres de estos países limitan con un mismo país. ¿Cuál no?', 'Three of these countries border the same country. Which one does not?'),
        why: L(`${said(found.three)} limitan con ${nm(hub.n)}; ${nm(found.odd.n)} no.`, `${said(found.three)} border ${nm(hub.n)}; ${nm(found.odd.n)} does not.`),
      };
    }
    return null;
  },

  larger: sized(
    area,
    true,
    (ref) => L(`Tres de estos países son más grandes que ${ref}. ¿Cuál no?`, `Three of these countries are larger than ${ref}. Which one is not?`),
    (three, ref, odd) => L(`${three} son más grandes que ${ref}; ${odd}, no.`, `${three} are larger than ${ref}; ${odd} is not.`),
    km2,
  ),
  smaller: sized(
    area,
    false,
    (ref) => L(`Tres de estos países son más pequeños que ${ref}. ¿Cuál no?`, `Three of these countries are smaller than ${ref}. Which one is not?`),
    (three, ref, odd) => L(`${three} son más pequeños que ${ref}; ${odd}, no.`, `${three} are smaller than ${ref}; ${odd} is not.`),
    km2,
  ),
  more: sized(
    people,
    true,
    (ref) => L(`Tres de estos países tienen más habitantes que ${ref}. ¿Cuál no?`, `Three of these countries have more people than ${ref}. Which one does not?`),
    (three, ref, odd) => L(`${three} tienen más habitantes que ${ref}; ${odd}, no.`, `${three} have more people than ${ref}; ${odd} does not.`),
    heads,
  ),
  fewer: sized(
    people,
    false,
    (ref) => L(`Tres de estos países tienen menos habitantes que ${ref}. ¿Cuál no?`, `Three of these countries have fewer people than ${ref}. Which one does not?`),
    (three, ref, odd) => L(`${three} tienen menos habitantes que ${ref}; ${odd}, no.`, `${three} have fewer people than ${ref}; ${odd} does not.`),
    heads,
  ),
};

/**
 * Four countries of a list and which of them is the odd one, with the question that says why; `seen` holds
 * the keys of those already asked, which are not asked again. Null when the list has nothing left to ask.
 */
export function makeOddOne(list: readonly Country[], world: StatementWorld, rng: Rng = Math.random, seen?: ReadonlySet<string>, kinds: readonly OddKind[] = ODD_KINDS): OddOne | null {
  const families = ODD_FAMILIES.map((family) => family.filter((k) => kinds.includes(k))).filter((family) => family.length);
  if (list.length < ODD_MIN || !families.length) return null;
  for (let i = 0; i < 80; i++) {
    const kind = pick(pick(families, rng), rng);
    const found = MAKERS[kind](list, world, rng);
    if (!found) continue;
    const ids = shuffle([...found.three, found.odd], rng).map((c) => c.id);
    const key = `${kind}:${found.about ? `${found.about}:` : ''}${[...ids].sort().join('-')}`;
    if (!seen?.has(key)) return { key, kind, text: found.text, ids, odd: found.odd.id, why: found.why };
  }
  return null;
}
