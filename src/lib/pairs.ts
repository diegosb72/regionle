/**
 * Pairs: cards face down, two for each country (its flag and its name, or its capital and the country), to be
 * turned two at a time until every one is with its other half. The back of a card says which of the two it
 * is, so a turn is always one of each: a flag and a name, a capital and a country. Which countries are dealt,
 * what each card shows, what a turn does and when a turn is a miss are worked out here; the game only draws it.
 */
import { nm } from './i18n';
import { PAIRS_MIN, type PairOf } from './rules';
import { fold, shuffle, type Rng } from './text';
import type { Country } from './types';

export { PAIRS_MIN };

/** What a card shows once it is turned. */
export type PairFace = 'flag' | 'name' | 'capital' | 'country';

export interface PairCard {
  /** The country it is one half of. */
  country: string;
  face: PairFace;
}

/** The two faces of a pair of each kind. */
export const PAIR_FACES: Record<PairOf, readonly [PairFace, PairFace]> = { flag: ['flag', 'name'], capital: ['capital', 'country'] };

/**
 * Whose flag a card of each of these would show, as far as the eye can tell. A territory drawn with the flag
 * of its country (the French ones, Svalbard, the Caribbean Netherlands, Saint Helena) is a second card of
 * that flag; Romania's differs from Chad's in a shade of blue, and Monaco's from Indonesia's in proportions
 * that a card does not keep. Two that show the same are never dealt together: nobody could tell which name
 * goes with which.
 */
export const SAME_FLAG: Readonly<Record<string, string>> = {
  BL: 'FR',
  GF: 'FR',
  GP: 'FR',
  MF: 'FR',
  PM: 'FR',
  RE: 'FR',
  WF: 'FR',
  YT: 'FR',
  BV: 'NO',
  SJ: 'NO',
  BQ: 'NL',
  HM: 'AU',
  SH: 'GB',
  RO: 'TD',
  MC: 'ID',
};

/** What tells a country from another on the table: its flag, or the name of its capital. Nothing where it has none. */
function mark(c: Country, of: PairOf): string {
  if (of === 'flag') return c.fl ? (SAME_FLAG[c.id] ?? c.id) : '';
  return c.cap ? fold(nm(c.cap)) : '';
}

/** The countries that can be dealt: the ones that have what the pairs are made of. */
export function pairable(list: readonly Country[], of: PairOf): Country[] {
  return list.filter((c) => mark(c, of) !== '');
}

/**
 * The countries of a deal: as many as asked for where there are that many, and no two with the same flag
 * (see `SAME_FLAG`) or with a capital of the same name, which would be two pairs nobody could tell apart.
 */
export function pickPairs(list: readonly Country[], of: PairOf, pairs: number, rng: Rng = Math.random): Country[] {
  const taken = new Set<string>();
  const out: Country[] = [];
  for (const c of shuffle(pairable(list, of), rng)) {
    if (out.length >= pairs) break;
    const m = mark(c, of);
    if (taken.has(m)) continue;
    taken.add(m);
    out.push(c);
  }
  return out;
}

/** The cards of those countries, two each, shuffled. */
export function dealPairs(countries: readonly Country[], of: PairOf, rng: Rng = Math.random): PairCard[] {
  const [one, other] = PAIR_FACES[of];
  return shuffle(
    countries.flatMap((c): PairCard[] => [
      { country: c.id, face: one },
      { country: c.id, face: other },
    ]),
    rng,
  );
}

/** A deal ready to be played. */
export function newPairs(list: readonly Country[], of: PairOf, pairs: number, rng: Rng = Math.random): PairGame {
  return startPairs(dealPairs(pickPairs(list, of, pairs, rng), of, rng));
}

export interface PairGame {
  cards: readonly PairCard[];
  /** Cards face up that are not a pair yet: none, the first of a turn, or the two of a turn that did not match. */
  up: readonly number[];
  /** The countries whose two cards have been put together, in the order they were. */
  found: readonly string[];
  /** Cards that have been turned at some point: what they show is known. */
  seen: readonly number[];
  /** Turns taken: two cards each. */
  turns: number;
  /** Countries that took a turn that could have been spared (see `turnCard`). */
  missed: readonly string[];
}

export function startPairs(cards: readonly PairCard[]): PairGame {
  return { cards, up: [], found: [], seen: [], turns: 0, missed: [] };
}

/** How many pairs there are on the table. */
export const pairCount = (g: PairGame): number => g.cards.length / 2;
export const pairsDone = (g: PairGame): boolean => g.cards.length > 0 && g.found.length >= pairCount(g);

/**
 * Whether a card can be turned: it is face down and, with one card up, it is of the other kind. Two flags
 * cannot be a pair, and the backs say which is which.
 */
export function canTurn(g: PairGame, i: number): boolean {
  const card = g.cards[i];
  if (!card || g.found.includes(card.country)) return false;
  // The two of a turn that did not match go back with the next card, whichever it is.
  if (g.up.length !== 1) return true;
  return card.face !== g.cards[g.up[0]].face;
}

/** The two of a turn that did not match, face down again. */
export function hidePair(g: PairGame): PairGame {
  return g.up.length === 2 ? { ...g, up: [] } : g;
}

/**
 * Turns a card over. With one already up, the turn is settled: the two are a pair, or they are not.
 *
 * A turn that does not match is a **miss** when it could have been spared: the other half of the first
 * card had been seen already, and was not the one chosen; or the second card had been seen, so what it shows
 * was known not to go with the first. Turning two cards that had never been seen is not a miss: there is
 * no other way to find out what they are. The miss is the first card's, which is the one that was answered.
 */
export function turnCard(g: PairGame, i: number): PairGame {
  if (!canTurn(g, i)) return g;
  const table = hidePair(g);
  const see = (seen: readonly number[], k: number): readonly number[] => (seen.includes(k) ? seen : [...seen, k]);
  if (table.up.length === 0) return { ...table, up: [i], seen: see(table.seen, i) };
  const a = table.up[0];
  const first = table.cards[a];
  const second = table.cards[i];
  const seen = see(table.seen, i);
  const turns = table.turns + 1;
  if (first.country === second.country) return { ...table, up: [], found: [...table.found, first.country], seen, turns };
  const other = table.cards.findIndex((c, k) => k !== a && c.country === first.country);
  const spared = table.seen.includes(other) || table.seen.includes(i);
  return { ...table, up: [a, i], seen, turns, missed: spared && !table.missed.includes(first.country) ? [...table.missed, first.country] : table.missed };
}

/** The pairs found without a miss, and with one: what the result counts. */
export function pairTally(g: PairGame): { ok: number; bad: number } {
  const bad = g.found.filter((id) => g.missed.includes(id)).length;
  return { ok: g.found.length - bad, bad };
}

/** Words this long are given a place to be cut, with a hyphen, when a card is too narrow for them. */
export const LONG_WORD = 14;
const VOWEL = /[aeiouáéíóúü]/i;

/**
 * A name with a soft hyphen in each of its longest words («Centroafri·cana», «Jayawarde·nepura»): where a
 * card has no room for the word, it is cut there and not wherever the line ends. The place is the nearest
 * to the middle that leaves a vowel before it and a consonant and a vowel after it, which is where a
 * syllable begins in Spanish and, near enough, in the other names there are; a word with no such place
 * is left whole.
 */
export function softened(name: string): string {
  return name.replace(new RegExp(`[^\\s\\-\u00ad]{${LONG_WORD},}`, 'g'), (word) => {
    let at = -1;
    for (let i = 4; i <= word.length - 4; i++) {
      if (!VOWEL.test(word[i - 1]) || VOWEL.test(word[i]) || !/\p{L}/u.test(word[i]) || !VOWEL.test(word[i + 1])) continue;
      if (at < 0 || Math.abs(i - word.length / 2) < Math.abs(at - word.length / 2)) at = i;
    }
    return at < 0 ? word : `${word.slice(0, at)}\u00ad${word.slice(at)}`;
  });
}

/**
 * What a name is made of as far as lines go: the pieces that are never cut. A space is dropped where the
 * line ends at it, a hyphen stays with what comes before it, and a soft hyphen shows as one.
 */
export function unbroken(name: string): string[] {
  const out: string[] = [];
  let piece = '';
  for (const ch of name) {
    if (ch === '-' || ch === '\u00ad') {
      if (piece) out.push(`${piece}-`);
      piece = '';
    } else if (/\s/.test(ch)) {
      if (piece) out.push(piece);
      piece = '';
    } else piece += ch;
  }
  if (piece) out.push(piece);
  return out;
}

/** The key the fewest turns of a table are kept under: one record for each kind of pair and number of pairs. */
export const pairsKey = (of: PairOf, pairs: number): string => `pairs:${of}:${pairs}`;
