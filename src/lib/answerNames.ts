/**
 * What the things that have been answered are called. An answer is kept by the id of its piece; its name is
 * on the map it was learnt on, so that map is built to read it, as a review of it would.
 */
import { deckFor } from './decks';
import { reviewConfig, type ReviewGroup } from './review';
import type { Opts } from './store';

export interface Named {
  name: string;
  /** The capital that is asked about it, where there is one. */
  capital?: string;
}

/** Maps built at a time: each is a file or two and a few thousand points. */
const AT_ONCE = 4;

/**
 * The names of the pieces of each group, by the key of the group and the id of the piece. A map that
 * cannot be loaded (no connection and no copy of it) leaves its group out: the caller shows ids.
 */
export async function namesOf(groups: readonly ReviewGroup[], opts: Opts, onProgress?: (done: number, total: number) => void): Promise<Map<string, Map<string, Named>>> {
  const out = new Map<string, Map<string, Named>>();
  let next = 0;
  let done = 0;
  const work = async (): Promise<void> => {
    while (next < groups.length) {
      const g = groups[next++];
      try {
        const deck = await deckFor({ ...reviewConfig(g, opts, Infinity), nonce: 0 });
        const names = new Map<string, Named>();
        for (const id of g.ids) {
          const it = deck.byId.get(id);
          if (it) names.set(id, { name: it.name, capital: it.capital?.[0] });
        }
        out.set(g.key, names);
      } catch {
        // Left out: see above.
      }
      onProgress?.(++done, groups.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, groups.length) }, work));
  return out;
}
