/**
 * «Antes y ahora»: the flags that the countries flew before the one they fly, asked by the country that
 * flew them. It is played with a set of countries (lib/flagSets.ts), and what is asked is not the cards
 * of the set but the flags of other times of those countries: one for each country that has any, drawn
 * anew for each game; the answers are four countries of the set, each with its flag of today.
 *
 * What is set beside the right country is written beforehand (public/data/alike/past.json, by
 * scripts/data/flags-alike.mjs): the countries whose flag of today is most like the old one, which is what
 * makes the question one, and never a country that flew that flag too — the white of the Bourbons was
 * that of the Taliban, and the blue and white of Central America was that of four countries.
 */
import { flagSrc, type FlagsFile } from './flags';
import { beside, type DeckCard, type FlagSet } from './flagSets';
import { shuffle, type Rng } from './text';
import { loadFile } from './world';

/** What scripts/data/flags-alike.mjs writes of the flags of other times. A flag goes by its country and its file: `ES:799f25a865.svg`. */
export interface PastFile {
  v: number;
  /** By group (`states`, a continent, `territories`) and by flag: the countries of the group whose flag of today is most like it, as pairs of country and score, the nearest first. */
  groups: Record<string, Record<string, (string | number)[]>>;
  /** How far each is from the flag its country flies today: the lower, the more alike. */
  own: Record<string, number>;
  /** The other countries that flew it, or one as good as it; only the flags that have any. */
  also: Record<string, string[]>;
}

export const loadPast = (): Promise<PastFile> => loadFile<PastFile>('alike/past.json');

/** The group of that file a set is played in; null for a set that is not of countries, which the game is not played with. */
export const pastPlace = (set: FlagSet): string | null => (set.kind === 'countries' ? (set.continent ?? 'states') : set.kind === 'territories' ? 'territories' : null);

/** The fewest countries with a flag of another time that make a game: a question shows four countries, and a game of one question is none. */
export const PAST_MIN = 4;

/** What a flag of another time goes by in the file. */
export const pastKey = (card: DeckCard): string => `${card.id}:${card.file ?? ''}`;

/**
 * The flags that each country of a deck flew before, the oldest first, by the key of the card of the
 * country. Each is a card under the name of its country: what is asked of it is whose it was.
 */
export function pastCards(deck: readonly DeckCard[], file: FlagsFile, base?: string): Map<string, DeckCard[]> {
  const out = new Map<string, DeckCard[]>();
  for (const land of deck) {
    if (land.kind !== 'country') continue;
    const rows = file.past?.[land.id] ?? [];
    if (!rows.length) continue;
    out.set(
      land.key,
      rows.map(([name, ratio, from, to, small]) => ({
        key: `past:${land.id}:${name}`,
        kind: 'past' as const,
        id: land.id,
        country: land.id,
        name: land.name,
        ...(land.alt ? { alt: land.alt } : {}),
        years: [from, to] as [number, number],
        src: flagSrc(name, base),
        small: flagSrc(small ?? name, base),
        file: name,
        ratio,
        look: name,
        said: land.said,
        answers: land.answers,
      })),
    );
  }
  return out;
}

/** A flag that is the one of today, near enough, weighs this little… */
const WEIGHT_MIN = 4;
/** …and one of which nothing is known, as one that is neither like it nor unlike. */
const WEIGHT_USUAL = 20;

/**
 * One of the flags a country flew, by lot: the further a flag is from the one the country flies today, the
 * more often it comes up. The forty-eight stars of the United States are as likely as the forty-nine; the
 * white of the Bourbons, far more than the red and yellow of 1843.
 */
export function drawPast(cards: readonly DeckCard[], data: PastFile | null | undefined, rng: Rng = Math.random): DeckCard {
  const weights = cards.map((card) => Math.max(WEIGHT_MIN, data?.own[pastKey(card)] ?? WEIGHT_USUAL));
  let at = rng() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < cards.length; i++) {
    at -= weights[i];
    if (at < 0) return cards[i];
  }
  return cards[cards.length - 1];
}

/**
 * The countries to choose from when a flag of another time is asked: the one that flew it and, beside it,
 * the countries of the set whose flag of today is most like the old one; where those are not enough, any
 * of the set but those that flew it too. No two of them with the same flag of today.
 */
export function pastOptions(card: DeckCard, deck: readonly DeckCard[], data: PastFile | null | undefined, place: string, n: number, rng: Rng = Math.random): DeckCard[] {
  const land = deck.find((c) => c.id === card.id);
  if (!land) return [];
  const byId = new Map(deck.map((c) => [c.id, c]));
  const key = pastKey(card);
  const near = data?.groups[place]?.[key] ?? [];
  const rivals: DeckCard[] = [];
  for (let k = 0; k + 1 < near.length; k += 2) {
    const rival = byId.get(String(near[k]));
    if (rival) rivals.push(rival);
  }
  const barred = new Set(data?.also[key] ?? []);
  const rest = shuffle(deck, rng).filter((c) => !barred.has(c.id));
  return shuffle([land, ...beside(land, [...rivals, ...rest], n - 1)], rng);
}

/**
 * The flags a game asks: one of each country that has any, the countries by lot and no more than
 * `length` of them; or, when the game is only of some flags (those that were missed), those very ones.
 */
export function pastAsked(past: ReadonlyMap<string, readonly DeckCard[]>, data: PastFile | null | undefined, length: number | 'all', rng: Rng = Math.random, only?: ReadonlySet<string>): DeckCard[] {
  if (only) return shuffle([...past.values()].flat().filter((card) => only.has(card.key)), rng);
  const lands = shuffle([...past.values()], rng);
  return (length === 'all' ? lands : lands.slice(0, length)).map((cards) => drawPast(cards, data, rng));
}
