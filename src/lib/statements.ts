/**
 * True or false: statements about the countries chosen, made from what the game already knows of them
 * (who borders whom, capitals, sizes, where they lie). Each one comes with why it is true or false, which is
 * what is learnt from it. Nothing is drawn here: the game only shows them.
 */
import { metricOf } from './figures';
import { L, capName, getLang, nm } from './i18n';
import { listed, namesOverlap, pick, type Rng } from './text';
import { areaUnit } from './units';
import type { Country } from './types';

export type StatementKind = 'border' | 'capital' | 'area' | 'pop' | 'density' | 'neighbours' | 'north' | 'landlocked' | 'island' | 'continent';

export const STATEMENT_KINDS: readonly StatementKind[] = ['border', 'capital', 'area', 'pop', 'density', 'neighbours', 'north', 'landlocked', 'island', 'continent'];

export interface Statement {
  /** The same statement is not made twice in a game: this tells them apart. */
  key: string;
  kind: StatementKind;
  text: string;
  truth: boolean;
  /** Said once it is answered: the fact behind it. */
  why: string;
  /** The countries it names, the subject first: their flags are shown with it. */
  ids: string[];
}

export interface StatementWorld {
  /** Every country of the game, to name the neighbours a chosen one has outside the selection. */
  byId: ReadonlyMap<string, Country>;
  /** Names of the continents, by their code. */
  continents: Readonly<Record<string, { es: string; en?: string }>>;
}

/** Two figures have to be this far apart for a comparison to be asked: closer than that is a coin toss. */
export const APART = 1.25;
/** Degrees of latitude between two centres for "further north" to be beyond doubt. */
const DEGREES = 6;

/** Neighbours two countries must be apart by for one to be said to border more than the other. */
const NEIGHBOURS_APART = 2;
/**
 * Countries that lie on two continents: nothing is said about which one they are in, since either answer
 * can be argued (Russia, Turkey, Kazakhstan, the Caucasus, Cyprus, Egypt, Indonesia).
 */
export const TWO_CONTINENTS: ReadonlySet<string> = new Set(['RU', 'TR', 'KZ', 'AZ', 'GE', 'AM', 'CY', 'EG', 'ID']);
/** Landlocked countries on the shore of the Caspian, which is a lake: worth a word when the answer is told. */
export const CASPIAN: ReadonlySet<string> = new Set(['AZ', 'KZ', 'TM']);

const density = (c: Country): number => (c.pop && c.ar > 0 ? c.pop / c.ar : 0);
const borders = (c: Country): string[] => c.nb ?? [];
/** The neighbours that are states: a territory of another country (Gibraltar, French Guiana, Hong Kong) is not one more country. */
export const stateBorders = (c: Country, world: StatementWorld): string[] => borders(c).filter((id) => world.byId.get(id)?.cl !== 'dep' && world.byId.get(id)?.cl !== 'other');

/** The names of some countries in a row, a handful at most: "Francia, Andorra y Portugal". */
export function names(ids: readonly string[], world: StatementWorld, max = 8): string {
  const all = ids
    .map((id) => world.byId.get(id))
    .filter((c): c is Country => !!c)
    .map((c) => nm(c.n))
    .sort((a, b) => a.localeCompare(b, getLang()));
  const shown = all.slice(0, max);
  const text = listed(shown, L('y', 'and'));
  return all.length > max ? L(`${shown.join(', ')} y ${all.length - max} más`, `${shown.join(', ')} and ${all.length - max} more`) : text;
}

/** "en África", "in the Americas". */
export function inContinent(ct: string, world: StatementWorld): string {
  const name = world.continents[ct] ? nm(world.continents[ct]) : ct;
  return L(`en ${name}`, ct === 'AM' ? 'in the Americas' : `in ${name}`);
}

type Maker = (list: readonly Country[], truth: boolean, world: StatementWorld, rng: Rng) => Statement | null;

/** A pair for a comparison: far enough apart by the figure, the larger one first. */
function pair(list: readonly Country[], of: (c: Country) => number, rng: Rng, apart: (hi: number, lo: number) => boolean): [Country, Country] | null {
  const pool = list.filter((c) => of(c) > 0 || of(c) < 0);
  for (let i = 0; i < 40 && pool.length >= 2; i++) {
    const a = pick(pool, rng);
    const b = pick(pool, rng);
    if (a.id === b.id) continue;
    const [hi, lo] = of(a) >= of(b) ? [a, b] : [b, a];
    if (apart(of(hi), of(lo))) return [hi, lo];
  }
  return null;
}

const ratio = (hi: number, lo: number) => lo > 0 && hi / lo >= APART;

/** A statement that says the first of two has more of something than the second. */
function compare(kind: StatementKind, of: (c: Country) => number, say: (a: string, b: string) => string, fact: (c: Country) => string, apart = ratio): Maker {
  return (list, truth, _world, rng) => {
    const found = pair(list, of, rng, apart);
    if (!found) return null;
    const [hi, lo] = found;
    const [a, b] = truth ? [hi, lo] : [lo, hi];
    return { key: `${kind}:${a.id}>${b.id}`, kind, text: say(nm(a.n), nm(b.n)), truth, why: `${nm(hi.n)}: ${fact(hi)}. ${nm(lo.n)}: ${fact(lo)}.`, ids: [a.id, b.id] };
  };
}

const MAKERS: Record<StatementKind, Maker> = {
  border: (list, truth, world, rng) => {
    const chosen = new Set(list.map((c) => c.id));
    if (truth) {
      const pool = list.filter((c) => borders(c).some((id) => chosen.has(id)));
      if (!pool.length) return null;
      const a = pick(pool, rng);
      const b = world.byId.get(pick(borders(a).filter((id) => chosen.has(id)), rng))!;
      return { key: `border:${[a.id, b.id].sort().join('-')}`, kind: 'border', text: L(`${nm(a.n)} limita con ${nm(b.n)}.`, `${nm(a.n)} borders ${nm(b.n)}.`), truth, why: L(`${nm(a.n)} limita con ${names(borders(a), world)}.`, `${nm(a.n)} borders ${names(borders(a), world)}.`), ids: [a.id, b.id] };
    }
    for (let i = 0; i < 40; i++) {
      const a = pick(list, rng);
      const mine = new Set(borders(a));
      const others = list.filter((c) => c.id !== a.id && !mine.has(c.id));
      if (!others.length) continue;
      // The ones that almost touch it make the best false statement: neighbours of its neighbours, then
      // those of its own part of the world, then those of its continent.
      const near = others.filter((c) => borders(c).some((id) => mine.has(id)));
      const region = others.filter((c) => c.sr === a.sr);
      const continent = others.filter((c) => c.ct === a.ct);
      const b = pick(near.length ? near : region.length ? region : continent.length ? continent : others, rng);
      const why = mine.size ? L(`${nm(a.n)} limita con ${names(borders(a), world)}.`, `${nm(a.n)} borders ${names(borders(a), world)}.`) : L(`${nm(a.n)} no tiene fronteras terrestres.`, `${nm(a.n)} has no land borders.`);
      return { key: `border:${[a.id, b.id].sort().join('-')}`, kind: 'border', text: L(`${nm(a.n)} limita con ${nm(b.n)}.`, `${nm(a.n)} borders ${nm(b.n)}.`), truth, why, ids: [a.id, b.id] };
    }
    return null;
  },

  capital: (list, truth, _world, rng) => {
    // A country named after its capital would give the answer away, either way.
    const pool = list.filter((c) => c.cap && !namesOverlap(capName(c.cap), nm(c.n)));
    if (!pool.length) return null;
    const a = pick(pool, rng);
    const real = capName(a.cap!);
    const fact = L(`La capital de ${nm(a.n)} es ${real}.`, `The capital of ${nm(a.n)} is ${real}.`);
    if (truth) return { key: `capital:${a.id}:${a.id}`, kind: 'capital', text: fact, truth, why: fact, ids: [a.id] };
    const others = pool.filter((c) => c.id !== a.id && capName(c.cap!) !== real);
    if (!others.length) return null;
    const near = others.filter((c) => c.sr === a.sr);
    const b = pick(near.length ? near : others, rng);
    const wrong = capName(b.cap!);
    return {
      key: `capital:${a.id}:${b.id}`,
      kind: 'capital',
      text: L(`La capital de ${nm(a.n)} es ${wrong}.`, `The capital of ${nm(a.n)} is ${wrong}.`),
      truth,
      why: L(`La capital de ${nm(a.n)} es ${real}; ${wrong} es la de ${nm(b.n)}.`, `The capital of ${nm(a.n)} is ${real}; ${wrong} is that of ${nm(b.n)}.`),
      // Only the country asked about: the flag of the other one would say whose capital that is.
      ids: [a.id],
    };
  },

  area: compare('area', (c) => c.ar, (a, b) => L(`${a} es más grande que ${b}.`, `${a} is larger than ${b}.`), (c) => metricOf('area').short(c.ar)),
  pop: compare('pop', (c) => c.pop ?? 0, (a, b) => L(`${a} tiene más habitantes que ${b}.`, `${a} has more people than ${b}.`), (c) => metricOf('pop').full(c.pop ?? 0)),
  density: compare('density', density, (a, b) => L(`${a} tiene más habitantes por ${areaUnit()} que ${b}.`, `${a} has more people per ${areaUnit()} than ${b}.`), (c) => metricOf('density').short(density(c))),
  neighbours: (list, truth, world, rng) => {
    // Counted two ways, with and without the territories that are not states: a statement is made only
    // where both counts tell the two countries apart, so that it does not hang on what counts as a country.
    const states = (c: Country) => stateBorders(c, world).length;
    const all = (c: Country) => borders(c).length;
    const fact = (c: Country) => {
      const ids = stateBorders(c, world);
      if (!ids.length) return L(`${nm(c.n)} no limita con ningún país`, `${nm(c.n)} borders no country`);
      return L(`${nm(c.n)} limita con ${ids.length} (${names(ids, world)})`, `${nm(c.n)} borders ${ids.length} (${names(ids, world)})`);
    };
    for (let i = 0; i < 40; i++) {
      const x = pick(list, rng);
      const y = pick(list, rng);
      if (x.id === y.id) continue;
      const [hi, lo] = states(x) >= states(y) ? [x, y] : [y, x];
      if (states(hi) - states(lo) < NEIGHBOURS_APART || all(hi) - all(lo) < NEIGHBOURS_APART) continue;
      const [a, b] = truth ? [hi, lo] : [lo, hi];
      return {
        key: `neighbours:${a.id}>${b.id}`,
        kind: 'neighbours',
        text: L(`${nm(a.n)} limita con más países que ${nm(b.n)}.`, `${nm(a.n)} borders more countries than ${nm(b.n)}.`),
        truth,
        why: `${fact(hi)}; ${fact(lo)}.`,
        ids: [a.id, b.id],
      };
    }
    return null;
  },
  north: compare(
    'north',
    // Shifted so that every latitude is a figure above zero, as the comparison expects.
    (c) => c.lp[1] + 100,
    (a, b) => L(`${a} está más al norte que ${b}.`, `${a} is further north than ${b}.`),
    (c) => L(`su centro está a ${metricOf('lat').short(c.lp[1])}`, `its centre lies at ${metricOf('lat').short(c.lp[1])}`),
    (hi, lo) => hi - lo >= DEGREES,
  ),

  landlocked: (list, truth, _world, rng) => {
    const pool = list.filter((c) => !!c.ll === truth);
    // With no country of the other kind on the list, the answer would always be the same.
    if (!pool.length || !list.some((c) => !!c.ll !== truth)) return null;
    const a = pick(pool, rng);
    return {
      key: `landlocked:${a.id}`,
      kind: 'landlocked',
      text: L(`${nm(a.n)} no tiene salida al mar.`, `${nm(a.n)} is landlocked.`),
      truth,
      why: truth
        ? CASPIAN.has(a.id)
          ? L(`Así es: ${nm(a.n)} da al mar Caspio, que es un lago sin salida al océano.`, `That is right: ${nm(a.n)} lies on the Caspian Sea, which is a lake with no way out to the ocean.`)
          : L(`Así es: ${nm(a.n)} no tiene costa.`, `That is right: ${nm(a.n)} has no coast.`)
        : L(`${nm(a.n)} sí tiene costa.`, `${nm(a.n)} does have a coast.`),
      ids: [a.id],
    };
  },

  island: (list, truth, world, rng) => {
    const alone = (c: Country) => borders(c).length === 0;
    const pool = list.filter((c) => alone(c) === truth);
    if (!pool.length || !list.some((c) => alone(c) !== truth)) return null;
    const a = pick(pool, rng);
    return {
      key: `island:${a.id}`,
      kind: 'island',
      text: L(`${nm(a.n)} no tiene frontera terrestre con ningún país.`, `${nm(a.n)} has no land border with any country.`),
      truth,
      why: truth ? L(`Así es: ${nm(a.n)} no comparte frontera terrestre con nadie.`, `That is right: ${nm(a.n)} shares no land border with anyone.`) : L(`${nm(a.n)} limita con ${names(borders(a), world)}.`, `${nm(a.n)} borders ${names(borders(a), world)}.`),
      ids: [a.id],
    };
  },

  continent: (list, truth, world, rng) => {
    const here = [...new Set(list.map((c) => c.ct))];
    // Asked only where the selection spans more than one: within a single continent it would be no question.
    if (here.length < 2) return null;
    const pool = list.filter((c) => !TWO_CONTINENTS.has(c.id));
    if (!pool.length) return null;
    const a = pick(pool, rng);
    const said = truth ? a.ct : pick(here.filter((ct) => ct !== a.ct), rng);
    return {
      key: `continent:${a.id}:${said}`,
      kind: 'continent',
      text: L(`${nm(a.n)} está ${inContinent(said, world)}.`, `${nm(a.n)} is ${inContinent(said, world)}.`),
      truth,
      why: L(`${nm(a.n)} está ${inContinent(a.ct, world)}.`, `${nm(a.n)} is ${inContinent(a.ct, world)}.`),
      ids: [a.id],
    };
  },
};

/**
 * One statement about the countries of a list, as likely true as false; `seen` holds the keys of those
 * already made, which are not made again. Null when the list has nothing left to say (a single country).
 */
export function makeStatement(list: readonly Country[], world: StatementWorld, rng: Rng = Math.random, seen?: ReadonlySet<string>, kinds: readonly StatementKind[] = STATEMENT_KINDS): Statement | null {
  if (list.length < 2 || !kinds.length) return null;
  for (let i = 0; i < 60; i++) {
    const st = MAKERS[pick(kinds, rng)](list, rng() < 0.5, world, rng);
    if (st && !seen?.has(st.key)) return st;
  }
  return null;
}
