/**
 * The maps painted by hand (hand.ts), as they are kept: what the game needs of them from the moment it opens
 * — to read them from storage, to keep them and to carry them in a backup. The palette and the brush travel
 * with the game that uses them.
 */

/** The colours there are to paint with: a piece has one of them, by its number, from 1. */
export const HAND_COLOUR_COUNT = 6;
export const isHandColour = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= HAND_COLOUR_COUNT;

/** The painting of one map. */
export interface HandMap {
  /** The colour of each painted piece, by its id: 1 to 6. */
  f: Record<string, number>;
  /** What each colour stands for, by its number: only those the player has written. */
  l: Record<string, string>;
  /** When it was last touched: the oldest paintings make room for new ones. */
  t: number;
}
/** The paintings, by the key of their map (`deck.key`). */
export type Hand = Record<string, HandMap>;

/** Characters of what a colour stands for, at most: a word or two of a legend. */
export const HAND_LABEL_MAX = 30;
/** Paintings kept at most, and pieces painted in each. */
export const HAND_MAPS_MAX = 30;
export const HAND_PIECES_MAX = 6000;

/** What a colour stands for as it is typed: on one line, with nothing before it and no longer than allowed. */
export const typedLabel = (text: string): string => text.replace(/\s+/g, ' ').trimStart().slice(0, HAND_LABEL_MAX);

/** Whether a painting has nothing worth keeping: no piece painted and no colour explained. */
export const blankHand = (map: HandMap | null | undefined): boolean => !map || (Object.keys(map.f).length === 0 && Object.keys(map.l).length === 0);

/**
 * The paintings with that of one map set; a blank one is taken away. When there are too many, the ones
 * touched longest ago go.
 */
export function withHand(hand: Hand, key: string, map: HandMap | null): Hand {
  if (!key) return hand;
  if (blankHand(map)) {
    if (!(key in hand)) return hand;
    const rest = { ...hand };
    delete rest[key];
    return rest;
  }
  if (hand[key] === map) return hand;
  const next: Hand = { ...hand, [key]: map! };
  const keys = Object.keys(next);
  if (keys.length <= HAND_MAPS_MAX) return next;
  const oldest = keys.filter((k) => k !== key).sort((a, b) => next[a].t - next[b].t);
  for (const k of oldest.slice(0, keys.length - HAND_MAPS_MAX)) delete next[k];
  return next;
}

/** The paintings without some pieces: the ones that are no longer in the game. */
export function dropHand(hand: Hand, ids: readonly string[]): Hand {
  const gone = new Set(ids);
  let out = hand;
  for (const [key, map] of Object.entries(hand)) {
    if (!Object.keys(map.f).some((id) => gone.has(id))) continue;
    const f: Record<string, number> = {};
    for (const [id, colour] of Object.entries(map.f)) if (!gone.has(id)) f[id] = colour;
    out = withHand(out, key, { ...map, f });
  }
  return out;
}

const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** What is read from storage or from a backup, with anything that is not a painting left out. */
export function cleanHand(value: unknown): Hand {
  if (!isObject(value)) return {};
  const maps: [string, HandMap][] = [];
  for (const [key, raw] of Object.entries(value)) {
    if (!key || !isObject(raw) || !isObject(raw.f)) continue;
    const f: Record<string, number> = {};
    let n = 0;
    for (const [id, colour] of Object.entries(raw.f)) {
      if (!id || !isHandColour(colour)) continue;
      f[id] = colour;
      if (++n >= HAND_PIECES_MAX) break;
    }
    const l: Record<string, string> = {};
    if (isObject(raw.l))
      for (const [colour, text] of Object.entries(raw.l)) {
        if (!isHandColour(Number(colour)) || typeof text !== 'string') continue;
        const label = typedLabel(text).trim();
        if (label) l[Number(colour)] = label;
      }
    const map: HandMap = { f, l, t: typeof raw.t === 'number' && Number.isFinite(raw.t) && raw.t > 0 ? raw.t : 0 };
    if (!blankHand(map)) maps.push([key, map]);
  }
  // The latest ones, when there are more than are kept.
  maps.sort((a, b) => b[1].t - a[1].t);
  return Object.fromEntries(maps.slice(0, HAND_MAPS_MAX));
}
