/**
 * A chain of neighbours: from one piece to one that borders it, and on from that one, never through the
 * same piece twice. What the game needs to deal a start, to say when a chain has nowhere to go, and to
 * have a long chain of its own to compare with.
 */
import type { Graph } from './geo';
import type { Rng } from './text';

/** Wrong names a chain can take before it ends. */
export const CHAIN_MISSES = 3;

/** The pieces that can be reached from one, itself among them. */
export function reach(graph: Graph, from: string): Set<string> {
  const seen = new Set([from]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    for (const id of graph.get(queue[i]) ?? []) {
      if (seen.has(id) || !graph.has(id)) continue;
      seen.add(id);
      queue.push(id);
    }
  }
  return seen;
}

/** Where a chain can go on to: what borders its last piece and is not in it yet. */
export function waysOn(graph: Graph, chain: readonly string[]): string[] {
  const last = chain[chain.length - 1];
  if (last == null) return [];
  const used = new Set(chain);
  return [...new Set(graph.get(last) ?? [])].filter((id) => graph.has(id) && !used.has(id));
}

/**
 * Where a chain starts, by lot: a piece of the largest group of the map that hangs together, and one with
 * two neighbours or more where there is any (a start with a single way on is no choice at all).
 * Null when nothing on the map borders anything.
 */
export function startOf(graph: Graph, rand: Rng): string | null {
  const ids = [...graph.keys()].sort();
  let best: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    const group = [...reach(graph, id)].sort();
    for (const g of group) seen.add(g);
    if (group.length > best.length) best = group;
  }
  if (best.length < 2) return null;
  const roomy = best.filter((id) => waysOn(graph, [id]).length >= 2);
  const pool = roomy.length ? roomy : best;
  return pool[Math.floor(rand() * pool.length)];
}

/** How many pieces are within reach of one without going through the ones used, itself among them. */
function roomFrom(graph: Graph, from: string, used: ReadonlySet<string>): number {
  const seen = new Set([from]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    for (const id of graph.get(queue[i]) ?? []) {
      if (seen.has(id) || used.has(id) || !graph.has(id)) continue;
      seen.add(id);
      queue.push(id);
    }
  }
  return seen.size;
}

/**
 * A long chain from a start: not the longest there is, which takes for ever to find on a big map, but a
 * good one. Each try goes on to the piece that leaves the most of the map within reach and, among
 * equals, to the one with the fewest ways on (the corners first, as a knight tours a chessboard); now
 * and then it goes anywhere, so that the tries differ. The longest of the tries is kept.
 */
export function longChain(graph: Graph, start: string, rand: Rng, tries?: number): string[] {
  if (!graph.has(start)) return [];
  const limit = reach(graph, start).size;
  // Fewer tries on a big map: each one costs more there.
  const n = tries ?? Math.max(12, Math.min(120, Math.round(4000 / limit)));
  let best = [start];
  for (let t = 0; t < n && best.length < limit; t++) {
    const chain = [start];
    const used = new Set(chain);
    for (;;) {
      const open = waysOn(graph, chain);
      if (!open.length) break;
      let pool: string[] = [];
      if (t > 0 && rand() < 0.12) pool = open;
      else {
        let most = 0;
        let least = Infinity;
        for (const id of open) {
          const room = roomFrom(graph, id, used);
          const onward = new Set((graph.get(id) ?? []).filter((x) => graph.has(x) && !used.has(x) && x !== id)).size;
          if (room > most || (room === most && onward < least)) {
            most = room;
            least = onward;
            pool = [id];
          } else if (room === most && onward === least) pool.push(id);
        }
      }
      const next = pool[Math.floor(rand() * pool.length)];
      chain.push(next);
      used.add(next);
    }
    if (chain.length > best.length) best = chain;
  }
  return best;
}
