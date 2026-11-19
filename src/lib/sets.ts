/**
 * "Marca el grupo": sets of pieces of a map that go together (the provinces of a community, the countries
 * of the European Union, what borders a piece) to be marked on it, all of them and nothing else.
 */
import { ARAB_LEAGUE, BRICS, EU, EUROZONE, G20, MEDITERRANEAN, NATO, SCHENGEN, SPANISH, USSR, YUGOSLAVIA } from './groups';
import { L, nm } from './i18n';
import type { Rng } from './text';
import type { Deck, Item, Named, Res } from './types';

/** What kind of set it is: the game does not ask too many of the same kind in a row. */
export type SetKind = 'org' | 'trait' | 'place' | 'parent' | 'nb';

export interface PieceSet {
  id: string;
  kind: SetKind;
  /** What is asked for, said before the name: "Marca sus provincias", "Marca los países que limitan con". */
  lead: string;
  /** The name of the set: "Andalucía", "Unión Europea", "Sin salida al mar". */
  name: string;
  /** What the thing named is, where it is not plain: "comunidad autónoma". */
  sub?: string;
  /** The pieces of the map that are in it. */
  members: string[];
  /** The piece the set is told by, which is drawn and cannot be marked: the one the others border. */
  anchor?: string;
}

/** A set larger than this is a chore to mark: the countries of Africa are fifty-four. */
export const SET_MAX = 35;
/** A neighbour set is asked of pieces that border at least this many. */
const NB_MIN = 3;

/** Names of the continents and of their parts, by their codes. */
export interface Places {
  continents: Record<string, Named>;
  subregions: Record<string, Named>;
}

/** A set is worth asking when it has two pieces or more and leaves at least two of the map out. */
const askable = (members: string[], deck: Deck): boolean => members.length >= 2 && members.length <= SET_MAX && deck.items.length - members.length >= 2;

function countrySets(deck: Deck, places?: Places): PieceSet[] {
  const many = deck.noun.many;
  const own = L(`Marca sus ${many}`, `Mark its ${many}`);
  const which = L(`Marca los ${many}`, `Mark the ${many}`);
  const inDeck = (ids: readonly string[]) => ids.filter((id) => deck.byId.has(id));
  const out: PieceSet[] = [];
  const org = (id: string, name: string, ids: readonly string[]) => out.push({ id, kind: 'org', lead: own, name, members: inDeck(ids) });
  org('eu', L('Unión Europea', 'European Union'), EU);
  org('nato', L('OTAN', 'NATO'), NATO);
  org('schengen', L('Espacio Schengen', 'Schengen Area'), SCHENGEN);
  org('euro', L('Eurozona', 'Euro area'), EUROZONE);
  org('g20', 'G20', G20);
  org('brics', 'BRICS', BRICS);
  org('arab', L('Liga Árabe', 'Arab League'), ARAB_LEAGUE);
  org('ussr', L('Antigua URSS', 'Former USSR'), USSR);
  org('yugoslavia', L('Antigua Yugoslavia', 'Former Yugoslavia'), YUGOSLAVIA);
  const trait = (id: string, name: string, ids: readonly string[]) => out.push({ id, kind: 'trait', lead: which, name, members: inDeck(ids) });
  trait('mediterranean', L('Con costa en el Mediterráneo', 'With a coast on the Mediterranean'), MEDITERRANEAN);
  trait('spanish', L('Con el español como lengua oficial', 'With Spanish as an official language'), SPANISH);
  trait(
    'landlocked',
    L('Sin salida al mar', 'Landlocked'),
    deck.items.filter((it) => it.country.ll).map((it) => it.id),
  );
  // Parts of the world: only where the map has more than one, or the set would be the whole map.
  if (places) {
    for (const [code, name] of Object.entries(places.continents)) {
      out.push({ id: `ct:${code}`, kind: 'place', lead: own, name: nm(name), members: deck.items.filter((it) => it.country.ct === code).map((it) => it.id) });
    }
    for (const [code, name] of Object.entries(places.subregions)) {
      // "Australia y Nueva Zelanda" says by itself which two they are.
      if (code === 'OC-A') continue;
      out.push({ id: `sr:${code}`, kind: 'place', lead: own, name: nm(name), members: deck.items.filter((it) => it.country.sr === code).map((it) => it.id) });
    }
  }
  return out;
}

/** What each piece is part of: the community of a province, the country of a region or of a city. */
function parentSets(deck: Deck): PieceSet[] {
  const many = deck.noun.many;
  const own = L(`Marca sus ${many}`, `Mark its ${many}`);
  const out = new Map<string, PieceSet>();
  const add = (id: string, name: string, sub: string | undefined, item: Item) => {
    const set = out.get(id) ?? { id, kind: 'parent' as const, lead: own, name, sub, members: [] };
    set.members.push(item.id);
    out.set(id, set);
  };
  const several = deck.countries.length > 1;
  for (const it of deck.items) {
    if (it.belongs) add(`in:${it.belongs.id}`, it.belongs.name, it.belongs.type, it);
    // On a map of several countries, the pieces of each one; unless that is what `belongs` already says.
    if (several && it.belongs?.id !== it.country.id) add(`of:${it.country.id}`, nm(it.country.n), L('país', 'country'), it);
  }
  return [...out.values()];
}

/** What borders each piece by land, for the pieces that border enough of them. */
function neighbourSets(deck: Deck): PieceSet[] {
  const fem = deck.noun.fem;
  const lead = L(`Marca ${fem ? 'las' : 'los'} ${deck.noun.many} que limitan con`, `Mark the ${deck.noun.many} that border`);
  return deck.items
    .filter((it) => it.shape === 'area' && it.nb.length >= NB_MIN)
    .map((it) => ({ id: `nb:${it.id}`, kind: 'nb' as const, lead, name: it.name, members: it.nb.filter((id) => deck.byId.has(id)), anchor: it.id }));
}

/** Every set that can be asked on a map. Rivers and ranges have none. */
export function setsOf(deck: Deck, places?: Places): PieceSet[] {
  if (deck.scope === 'physical') return [];
  const sets = [...(deck.scope === 'countries' ? countrySets(deck, places) : parentSets(deck)), ...(deck.scope === 'cities' ? [] : neighbourSets(deck))];
  // Two sets with the same pieces (the eurozone on a map where it is the whole Union) are one question: the first stays.
  const seen = new Set<string>();
  return sets.filter((s) => {
    if (!askable(s.members, deck)) return false;
    const key = [...s.members].sort().join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The sets of a game, by lot. What borders a piece is there to fill in: a third of the game at most
 * while there are other sets, and spread evenly among them, so that a game does not open with it. Of the
 * others, no kind comes three times running where that can be helped.
 */
export function dealSets(sets: readonly PieceSet[], count: number, rand: Rng): PieceSet[] {
  const shuffled = (list: PieceSet[]) => {
    const out = [...list].sort((a, b) => (a.id < b.id ? -1 : 1));
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const main = shuffled(sets.filter((s) => s.kind !== 'nb'));
  const nb = shuffled(sets.filter((s) => s.kind === 'nb'));
  const total = Math.min(Math.max(0, count), sets.length);
  const fill = Math.min(nb.length, Math.max(total - main.length, Math.ceil(total / 3)));
  // The others, spread out: each turn takes the kind that has the most left, unless it has just come twice.
  const pools = new Map<SetKind, PieceSet[]>();
  for (const s of main.slice(0, total - fill)) pools.set(s.kind, [...(pools.get(s.kind) ?? []), s]);
  const rest: PieceSet[] = [];
  while (rest.length < total - fill) {
    const last = rest[rest.length - 1]?.kind;
    const twice = rest.length >= 2 && rest[rest.length - 2].kind === last;
    const kinds = [...pools.entries()].filter(([, list]) => list.length).sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1));
    const pick = (twice ? kinds.find(([k]) => k !== last) : undefined) ?? kinds[0];
    rest.push(pick[1].shift()!);
  }
  // What borders a piece goes in at even steps: the middle of each of as many stretches as there are.
  const at = new Set(Array.from({ length: fill }, (_, i) => Math.floor(((i + 0.5) * total) / fill)));
  const fillers = nb.slice(0, fill);
  return Array.from({ length: total }, (_, i) => (at.has(i) && fillers.length ? fillers.shift()! : (rest.shift() ?? fillers.shift()!)));
}

export interface SetVerdict {
  /** Marked and in the set. */
  right: string[];
  /** In the set and not marked. */
  missed: string[];
  /** Marked and not in the set. */
  extra: string[];
  res: Res;
}

/**
 * How a set was marked. All of it and nothing else is right; a slip or two in a large set is close (one
 * for every five pieces, and none in a set of fewer than four); anything else is wrong.
 */
export function judgeSet(members: readonly string[], picked: readonly string[]): SetVerdict {
  const set = new Set(members);
  const marked = new Set(picked);
  const right = members.filter((id) => marked.has(id));
  const missed = members.filter((id) => !marked.has(id));
  const extra = [...marked].filter((id) => !set.has(id));
  const slips = missed.length + extra.length;
  const allowed = members.length >= 4 ? Math.max(1, Math.round(members.length * 0.2)) : 0;
  return { right, missed, extra, res: slips === 0 ? 'ok' : slips <= allowed && right.length > 0 ? 'warn' : 'bad' };
}
