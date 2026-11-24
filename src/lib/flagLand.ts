/**
 * «¿De qué país es?»: the flags of the divisions of the countries, asked by the country each is of. It is
 * played with a set of countries (lib/flagSets.ts), and what is asked is not the cards of the set but the
 * flags of the regions of those countries: one for each country that has any, drawn anew for each game;
 * the answers are four countries of the set, each with its own flag.
 *
 * What is set beside the right country is three others that have flags of regions too, of its continent
 * where there are enough: Japan among countries of Asia. Never one that flies that very flag, near enough,
 * as its own or as that of one of its divisions (public/data/alike/lands.json, by
 * scripts/data/flags-alike.mjs): the red and white of Hesse is that of Indonesia, and the cross of England
 * is that of Genoa.
 */
import type { FlagsFile } from './flags';
import { beside, deckOf, type DeckCard, type FlagSet } from './flagSets';
import { shuffle, type Rng } from './text';
import type { Index } from './types';
import { loadFile } from './world';

/** What scripts/data/flags-alike.mjs writes of the flags of the divisions. A flag goes by its country and its file: `DE:96c4d5810c.svg`. */
export interface LandFile {
  v: number;
  /** How many flags were looked at, and what tells their list from another: a test says so when the flags have changed since. */
  n: number;
  of: string;
  /** The other countries that fly it, or one as good as it, as their own flag or as that of a division; only the flags that have any. */
  also: Record<string, string[]>;
}

export const loadLands = (): Promise<LandFile> => loadFile<LandFile>('alike/lands.json');

/** Whether a set is one the game is played with: the countries, all or those of a continent. */
export const playsLand = (set: FlagSet): boolean => set.kind === 'countries';

/** The fewest countries with flags of regions that make a game: a question shows four. */
export const LAND_MIN = 4;

/** What is set between the names of the divisions that fly one flag. */
export const NAME_BREAK = ' / ';

/** What a flag of a division goes by in the file. */
export const landKey = (card: DeckCard): string => `${card.country}:${card.file ?? ''}`;

/**
 * The flags of the divisions of each country of a deck, in the order of the data, by the key of the card
 * of the country; the countries that have none are not there. Each flag is the card it is in the set of
 * the regions of its country (`deckOf`), under its own name: what is asked of it is which country it is of.
 * A flag that several divisions of a country fly (that of Salzburg, of Vienna and of Vorarlberg) is there
 * once, under the names of them all.
 */
export function landCards(deck: readonly DeckCard[], index: Index, file: FlagsFile, same: ReadonlyMap<string, string> = new Map(), base?: string): Map<string, DeckCard[]> {
  const out = new Map<string, DeckCard[]>();
  for (const land of deck) {
    if (land.kind !== 'country' || !file.regions[land.id]?.length) continue;
    const byLook = new Map<string, DeckCard>();
    for (const card of deckOf({ kind: 'regions', country: land.id }, index, file, same, base)) {
      const first = byLook.get(card.look);
      if (!first) byLook.set(card.look, card);
      else if (!first.name.split(NAME_BREAK).includes(card.name)) byLook.set(card.look, { ...first, name: `${first.name}${NAME_BREAK}${card.name}` });
    }
    if (byLook.size) out.set(land.key, [...byLook.values()]);
  }
  return out;
}

/**
 * The flags a game asks: one of each country that has any, the countries by lot and no more than `length`
 * of them, the flag of each by lot too; or, when the game is only of some flags (those that were missed),
 * those very ones.
 */
export function landAsked(cards: ReadonlyMap<string, readonly DeckCard[]>, length: number | 'all', rng: Rng = Math.random, only?: ReadonlySet<string>): DeckCard[] {
  if (only) return shuffle([...cards.values()].flat().filter((card) => only.has(card.key)), rng);
  const lands = shuffle([...cards.values()], rng);
  return (length === 'all' ? lands : lands.slice(0, length)).map((flags) => flags[Math.floor(rng() * flags.length)]);
}

/**
 * The countries to choose from when the flag of a division is asked: its own and, beside it, others of the
 * set that have flags of regions too, those of its continent before the rest (`where` says which continent
 * each is of). None that flies that flag, near enough, nor one whose own flag is the same picture as that
 * of one that does (Chad, where Romania flies it); and no two of them with the same flag.
 */
export function landOptions(
  card: DeckCard,
  deck: readonly DeckCard[],
  cards: ReadonlyMap<string, readonly DeckCard[]>,
  data: LandFile | null | undefined,
  where: ReadonlyMap<string, string>,
  n: number,
  rng: Rng = Math.random,
): DeckCard[] {
  const land = deck.find((c) => c.kind === 'country' && c.id === card.country);
  if (!land) return [];
  const also = new Set(data?.also[landKey(card)] ?? []);
  const barred = new Set(deck.filter((c) => also.has(c.id)).map((c) => c.look));
  const able = shuffle(deck, rng).filter((c) => c.key !== land.key && cards.has(c.key) && !also.has(c.id) && !barred.has(c.look));
  const near = able.filter((c) => where.get(c.id) === where.get(land.id));
  const far = able.filter((c) => where.get(c.id) !== where.get(land.id));
  return shuffle([land, ...beside(land, [...near, ...far], n - 1)], rng);
}
