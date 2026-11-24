/**
 * Which flags look alike, as the games of «Banderas» read it (public/data/alike, which
 * scripts/data/flags-alike.mjs writes): for the cards of a game, the others that are most like each.
 */
import { twins, type DeckCard } from './flagSets';
import { loadFile } from './world';

/** The flags that are compared with one another: those of the countries, those of the regions of one country… */
export interface AlikeGroup {
  /** The pictures, by name: the id of a country, or the file of any other flag. */
  pics: string[];
  /** The pictures that are the same as another, by their place in `pics`: the first of each list stands for the rest. */
  same: number[][];
  /** For each picture, its nearest ones as pairs of place and score, the nearest first; none for one that another stands for. */
  near: number[][];
}

export interface AlikeFile {
  v: number;
  groups: Record<string, AlikeGroup>;
}

export type AlikeKind = 'countries' | 'regions' | 'cities' | 'others';

export const loadAlike = (kind: AlikeKind): Promise<AlikeFile> => loadFile<AlikeFile>(`alike/${kind}.json`);

/** The group of a file that the flags of a set are compared in (lib/flagSets.ts, `alikePlace`); none when the file has not got it. */
export const groupAt = (file: AlikeFile | null | undefined, place: { group: string; wider?: string }): AlikeGroup | undefined =>
  file?.groups[place.group] ?? (place.wider ? file?.groups[place.wider] : undefined);

/** A flag that looks like another, and how far from it: the lower the score, the more alike. */
export interface Near {
  card: DeckCard;
  score: number;
}

/** The name a card goes by in the files of look-alikes: its country, or its file. */
export const picOf = (card: DeckCard): string => (card.kind === 'country' ? card.id : (card.file ?? ''));

/**
 * For each card of a deck (by its key), the cards of the same deck that look most like it, the nearest
 * first. Only cards that can share a question with it: never one that is the same picture, or goes by the
 * same name. A card the group does not know, or a group that is missing, gives an empty list.
 */
export function nearCards(group: AlikeGroup | undefined, deck: readonly DeckCard[]): Map<string, Near[]> {
  const out = new Map<string, Near[]>();
  for (const card of deck) out.set(card.key, []);
  if (!group) return out;
  const place = new Map(group.pics.map((pic, i) => [pic, i]));
  /** The place that stands for each: its own, but for a picture that is the same as an earlier one. */
  const head = group.pics.map((_, i) => i);
  for (const list of group.same) for (const i of list) head[i] = list[0];
  /** The cards of the deck drawn with each picture that stands for others. */
  const at = new Map<number, DeckCard[]>();
  for (const card of deck) {
    const i = place.get(picOf(card));
    if (i == null) continue;
    const list = at.get(head[i]);
    if (list) list.push(card);
    else at.set(head[i], [card]);
  }
  for (const card of deck) {
    const i = place.get(picOf(card));
    if (i == null) continue;
    const pairs = group.near[head[i]] ?? [];
    const list = out.get(card.key)!;
    for (let k = 0; k + 1 < pairs.length; k += 2) {
      for (const other of at.get(pairs[k]) ?? []) if (other.key !== card.key && !twins(card, other)) list.push({ card: other, score: pairs[k + 1] });
    }
  }
  return out;
}

/** How many flags a question about look-alikes shows beside the one it asks. */
export const ALIKE_OTHERS = 3;
/** Up to this score, two flags are mixed up at a glance; further, they are only the nearest there is. */
export const ALIKE_CLOSE = 26;

/**
 * The flags to show beside a card in a question about look-alikes: its nearest ones, as long as no two of
 * them are the same picture or go by the same name. Fewer than `ALIKE_OTHERS` when its neighbours are not enough.
 */
export function rivalsOf(card: DeckCard, near: readonly Near[]): Near[] {
  const out: Near[] = [];
  for (const one of near) {
    if (out.length >= ALIKE_OTHERS) break;
    if (twins(card, one.card) || out.some((o) => twins(o.card, one.card))) continue;
    out.push(one);
  }
  return out;
}

/**
 * How alike a card and the flags set beside it are: the mean of their scores; `Infinity` when there are
 * not enough of them for a question.
 */
export function closeness(rivals: readonly Near[]): number {
  if (rivals.length < ALIKE_OTHERS) return Infinity;
  return rivals.reduce((sum, r) => sum + r.score, 0) / rivals.length;
}
