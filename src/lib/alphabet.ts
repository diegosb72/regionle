/**
 * Alphabet: one country for each letter that begins a name among the ones chosen, and a clue about it
 * (its capital, its flag, its neighbours, where it lies, what it is the most of) that leaves only that one
 * among those that begin with the letter. Made from what the game already knows of the countries; which
 * letters there are depends on the language, because the names do. Nothing is drawn here.
 */
import { givesAway, saysCountry } from './hints';
import { L, capName, getLang, nm } from './i18n';
import { SAME_FLAG } from './pairs';
import { APART, CASPIAN, TWO_CONTINENTS, stateBorders, type StatementWorld } from './statements';
import { fold, initialOf, listed, namesOverlap, pick, shuffle, type Rng } from './text';
import type { Country, Named } from './types';

/** What a clue is about. */
export type AlphaKind = 'capital' | 'flag' | 'borders' | 'place' | 'rank';
export const ALPHA_KINDS: readonly AlphaKind[] = ['capital', 'flag', 'borders', 'place', 'rank'];

/** How likely each kind is where several can be told: the ones that are told in a sentence, more than the rest. */
const WEIGHT: Record<AlphaKind, number> = { capital: 3, borders: 3, place: 2, flag: 2, rank: 1.5 };

/** Most neighbours that are named in a clue. */
export const ALPHA_NEAR = 3;
/** Countries that begin with a letter for "the largest of them" to say something. */
export const ALPHA_RANK_MIN = 3;

export interface AlphaWorld extends StatementWorld {
  subregions: Record<string, Named>;
}

/** How a country meets the sea, as far as it can be said without an argument: the shores of the Caspian are left unsaid. */
export type AlphaSea = 'none' | 'island' | 'coast' | 'unsaid';

/** What a clue says, and what it says it with. */
export interface AlphaClue {
  kind: AlphaKind;
  /** The clue, as it is read. Where the clue is a flag, what is said of it. */
  text: string;
  /** The flag that is shown, where that is the clue. */
  flag?: string;
  /** The neighbours that are named, and whether they are all there are. */
  near?: string[];
  whole?: boolean;
  /** The part of the world that is named (a subregion or a continent of the data), and what is said of the sea. */
  part?: string;
  sea?: AlphaSea;
  /** The figure it is the first by among those of its letter. */
  by?: 'pop' | 'area';
}

export interface AlphaQuestion extends AlphaClue {
  letter: string;
  /** The country that is the answer. */
  id: string;
}

const borders = (c: Country): string[] => c.nb ?? [];
const seaOf = (c: Country): AlphaSea => (CASPIAN.has(c.id) ? 'unsaid' : c.ll ? 'none' : borders(c).length === 0 ? 'island' : 'coast');

type Clue = AlphaClue;
type Maker = (c: Country, mates: readonly Country[], letter: string, world: AlphaWorld, rng: Rng) => Clue | null;

const byName = (a: string, b: string): number => a.localeCompare(b, getLang());
const named = (ids: readonly string[], world: AlphaWorld): string =>
  listed(
    ids.map((id) => nm(world.byId.get(id)!.n)).sort(byName),
    L('y', 'and'),
  );

/** The part of the world a country is said to be in: its own, or its continent where the name of the part would say the country. */
function partOf(c: Country, world: AlphaWorld): { key: string; said: string } | null {
  const sub = world.subregions[c.sr];
  if (sub && !saysCountry(nm(sub), nm(c.n))) {
    // "El Caribe", "el Sudeste Asiático"; "the Caribbean".
    const el = c.sr === 'AM-K' || c.sr === 'AS-SE';
    return { key: c.sr, said: L(`en ${el ? 'el ' : ''}${nm(sub)}`, `in ${c.sr === 'AM-K' ? 'the ' : ''}${nm(sub)}`) };
  }
  const ct = world.continents[c.ct];
  if (!ct || saysCountry(nm(ct), nm(c.n))) return null;
  return { key: c.ct, said: L(`en ${nm(ct)}`, c.ct === 'AM' ? 'in the Americas' : `in ${nm(ct)}`) };
}

const MAKERS: Record<AlphaKind, Maker> = {
  // A capital is that of one country. Not where it all but says the name: Argel, Brasilia, Ciudad de Guatemala.
  capital: (c, mates) => {
    if (!c.cap) return null;
    const cap = capName(c.cap);
    if (namesOverlap(cap, nm(c.n)) || givesAway(cap, nm(c.n))) return null;
    if (mates.some((m) => m.cap && fold(capName(m.cap)) === fold(cap))) return null;
    return { kind: 'capital', text: L(`Su capital es ${cap}.`, `Its capital is ${cap}.`) };
  },

  // A flag is that of one country, unless it flies that of another or cannot be told from it at a glance.
  flag: (c, mates) => {
    if (!c.fl || (c.cl === 'dep' && SAME_FLAG[c.id])) return null;
    const shown = (x: Country) => SAME_FLAG[x.id] ?? x.id;
    if (mates.some((m) => shown(m) === shown(c))) return null;
    return { kind: 'flag', text: L('Esta es su bandera.', 'This is its flag.'), flag: c.fl };
  },

  /**
   * The countries it borders: all of them where they are few and it borders nothing else, and three of them
   * otherwise. One whose name would all but say the answer (Sudán del Sur for Sudán) is not named.
   */
  borders: (c, mates, _letter, world, rng) => {
    const states = stateBorders(c, world).filter((id) => world.byId.has(id));
    const fair = states.filter((id) => !givesAway(nm(world.byId.get(id)!.n), nm(c.n)));
    if (!fair.length) return null;
    const touches = (m: Country, id: string): boolean => borders(m).includes(id) || borders(world.byId.get(id)!).includes(m.id);
    if (fair.length === states.length && states.length === borders(c).length && states.length <= ALPHA_NEAR) {
      // Said whole, another country fits only with the very same neighbours.
      const same = (m: Country) => borders(m).length === states.length && states.every((id) => touches(m, id));
      if (mates.some(same)) return null;
      return {
        kind: 'borders',
        text: states.length === 1 ? L(`Solo limita con ${named(states, world)}.`, `It borders only ${named(states, world)}.`) : L(`Limita con ${named(states, world)}, y con nadie más.`, `It borders ${named(states, world)}, and nobody else.`),
        near: states,
        whole: true,
      };
    }
    for (let i = 0; i < 12; i++) {
      const some = shuffle(fair, rng).slice(0, ALPHA_NEAR);
      if (mates.some((m) => some.every((id) => touches(m, id)))) continue;
      return { kind: 'borders', text: L(`Limita con ${named(some, world)}, entre otros.`, `It borders ${named(some, world)}, among others.`), near: some, whole: false };
    }
    return null;
  },

  /**
   * Its part of the world and how it meets the sea. Not for a country on two continents, of which either
   * could be said; and one of those among the others spoils the clue, wherever it is filed.
   */
  place: (c, mates, _letter, world) => {
    if (TWO_CONTINENTS.has(c.id)) return null;
    const part = partOf(c, world);
    if (!part) return null;
    const sea = seaOf(c);
    const inPart = (m: Country) => TWO_CONTINENTS.has(m.id) || m.sr === part.key || m.ct === part.key;
    // What is said of the sea is true of another too: nothing is said, or the same is, or it is an island, which has a coast.
    const sameSea = (m: Country) => sea === 'unsaid' || seaOf(m) === 'unsaid' || seaOf(m) === sea || (sea === 'coast' && seaOf(m) === 'island');
    if (mates.some((m) => inPart(m) && sameSea(m))) return null;
    const tail =
      sea === 'none'
        ? L(' y no tiene salida al mar', ' and is landlocked')
        : sea === 'island'
          ? L(' y no tiene fronteras terrestres', ' and has no land borders')
          : sea === 'coast'
            ? L(' y tiene costa', ' and has a coast')
            : '';
    return { kind: 'place', text: L(`Está ${part.said}${tail}.`, `It is ${part.said}${tail}.`), part: part.key, sea };
  },

  // The largest or the most populous of those that begin with the letter, by far: a quarter more than the next.
  rank: (c, mates, letter, _world, rng) => {
    if (mates.length + 1 < ALPHA_RANK_MIN) return null;
    const tops: Clue[] = [];
    const most = (of: (x: Country) => number): boolean => of(c) > 0 && mates.every((m) => of(c) >= of(m) * APART);
    if (most((x) => x.pop ?? 0)) tops.push({ kind: 'rank', text: L(`Es el más poblado de los que empiezan por ${letter}.`, `It has the most people of those that begin with ${letter}.`), by: 'pop' });
    if (most((x) => x.ar)) tops.push({ kind: 'rank', text: L(`Es el más grande de los que empiezan por ${letter}.`, `It is the largest of those that begin with ${letter}.`), by: 'area' });
    return tops.length ? pick(tops, rng) : null;
  },
};

/** One of what can be told about a country among those of its letter, or null where nothing sets it apart. */
function clueFor(c: Country, mates: readonly Country[], letter: string, world: AlphaWorld, rng: Rng, kinds: readonly AlphaKind[], used: ReadonlyMap<AlphaKind, number>): Clue | null {
  const found: Clue[] = [];
  for (const kind of kinds) {
    const clue = MAKERS[kind](c, mates, letter, world, rng);
    if (clue) found.push(clue);
  }
  if (!found.length) return null;
  // A kind that has been told already in this game is less likely to be told again.
  const weights = found.map((f) => WEIGHT[f.kind] / (1 + (used.get(f.kind) ?? 0)));
  let at = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < found.length; i++) {
    at -= weights[i];
    if (at <= 0) return found[i];
  }
  return found[found.length - 1];
}

/** The letters there are among the names of some countries, in order, each with the countries filed under it. */
export function lettersOf(list: readonly Country[]): Map<string, Country[]> {
  const by = new Map<string, Country[]>();
  for (const c of list) {
    const letter = initialOf(nm(c.n));
    if (!letter) continue;
    by.set(letter, [...(by.get(letter) ?? []), c]);
  }
  return new Map([...by].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * A game: a question for each letter, from A to Z. The country of a letter is drawn by lot among those
 * that have something to be told apart by; a letter where none has is left out.
 */
export function makeAlphabet(list: readonly Country[], world: AlphaWorld, rng: Rng = Math.random, kinds: readonly AlphaKind[] = ALPHA_KINDS): AlphaQuestion[] {
  const out: AlphaQuestion[] = [];
  const used = new Map<AlphaKind, number>();
  for (const [letter, filed] of lettersOf(list)) {
    for (const c of shuffle(filed, rng)) {
      const clue = clueFor(
        c,
        filed.filter((m) => m.id !== c.id),
        letter,
        world,
        rng,
        kinds,
        used,
      );
      if (!clue) continue;
      used.set(clue.kind, (used.get(clue.kind) ?? 0) + 1);
      out.push({ letter, id: c.id, ...clue });
      break;
    }
  }
  return out;
}
