import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { longChain, reach, startOf, waysOn } from './chain';
import { buildDeck, deckGraph, setLoader } from './data';
import type { Graph } from './geo';
import { mulberry32 } from './text';

const graphOf = (edges: [string, string][], alone: string[] = []): Graph => {
  const g: Graph = new Map();
  const add = (a: string, b: string) => g.set(a, [...(g.get(a) ?? []), b]);
  for (const [a, b] of edges) {
    add(a, b);
    add(b, a);
  }
  for (const id of alone) g.set(id, []);
  return g;
};

/** A line of five, a triangle hanging from its middle, and an island. */
const G = graphOf(
  [
    ['a', 'b'],
    ['b', 'c'],
    ['c', 'd'],
    ['d', 'e'],
    ['c', 'x'],
    ['x', 'y'],
    ['y', 'c'],
    ['p', 'q'],
  ],
  ['z'],
);

const isChain = (graph: Graph, chain: string[]) => new Set(chain).size === chain.length && chain.every((id, i) => i === 0 || graph.get(chain[i - 1])!.includes(id));

describe('a chain of neighbours', () => {
  it('reaches what hangs together with a piece, and nothing else', () => {
    expect([...reach(G, 'a')].sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'x', 'y']);
    expect([...reach(G, 'p')].sort()).toEqual(['p', 'q']);
    expect([...reach(G, 'z')]).toEqual(['z']);
  });

  it('goes on to what borders its last piece and is not in it', () => {
    expect(waysOn(G, ['c']).sort()).toEqual(['b', 'd', 'x', 'y']);
    expect(waysOn(G, ['a', 'b', 'c']).sort()).toEqual(['d', 'x', 'y']);
    expect(waysOn(G, ['c', 'x', 'y'])).toEqual([]);
    expect(waysOn(G, ['z'])).toEqual([]);
    expect(waysOn(G, [])).toEqual([]);
    // A neighbour that is not on the map is no way on, and one listed twice (by land and by sea) is one.
    const odd: Graph = new Map([
      ['a', ['b', 'b', 'gone']],
      ['b', ['a']],
    ]);
    expect(waysOn(odd, ['a'])).toEqual(['b']);
  });

  it('starts in the largest group that hangs together, where there is a choice to make', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const start = startOf(G, mulberry32(seed))!;
      // Not on the island, not in the pair, and not at an end of the line, which has a single way on.
      expect(['b', 'c', 'd', 'x', 'y']).toContain(start);
    }
    expect(new Set(Array.from({ length: 40 }, (_, i) => startOf(G, mulberry32(i + 1)))).size).toBeGreaterThan(2);
    expect(startOf(G, mulberry32(7))).toBe(startOf(G, mulberry32(7)));
    // A line of two has no piece with a choice: either end will do.
    expect(['p', 'q']).toContain(startOf(graphOf([['p', 'q']]), mulberry32(1)));
    expect(startOf(graphOf([], ['a', 'b']), mulberry32(1))).toBeNull();
    expect(startOf(new Map(), mulberry32(1))).toBeNull();
  });

  it('finds a long chain of its own, which is a chain', () => {
    // From an end of the line the longest goes round the triangle and out: a b c x y, or a b c d e.
    const chain = longChain(G, 'a', mulberry32(3));
    expect(chain[0]).toBe('a');
    expect(isChain(G, chain)).toBe(true);
    expect(chain).toHaveLength(5);
    // From the triangle: round it and out by one arm of the line, which leaves the other arm behind.
    expect(longChain(G, 'x', mulberry32(3))).toHaveLength(5);
    expect(longChain(G, 'z', mulberry32(3))).toEqual(['z']);
    expect(longChain(G, 'nowhere', mulberry32(3))).toEqual([]);
    // A ring is gone round whole.
    const ring = graphOf([
      ['1', '2'],
      ['2', '3'],
      ['3', '4'],
      ['4', '5'],
      ['5', '1'],
    ]);
    expect(longChain(ring, '3', mulberry32(9))).toHaveLength(5);
  });
});

describe('a chain of neighbours on the real maps', () => {
  beforeAll(() => {
    setLoader(async (p) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data', p), 'utf8')));
  });

  it('strings together most of the provinces of Spain', async () => {
    const deck = await buildDeck({ scope: 'regions', countries: ['ES'], levels: { ES: 'f' } });
    const graph = deckGraph(deck);
    const start = startOf(graph, mulberry32(1))!;
    expect(deck.byId.has(start)).toBe(true);
    const chain = longChain(graph, start, mulberry32(2));
    expect(isChain(graph, chain)).toBe(true);
    // Fifty-two provinces: the forty-seven of the peninsula hang together, and the islands by sea.
    expect(chain.length).toBeGreaterThanOrEqual(35);
    expect(chain.length).toBeLessThanOrEqual(reach(graph, start).size);
  });

  it('goes a long way round Europe', async () => {
    const { loadIndex } = await import('./data');
    const { index } = await loadIndex();
    const europe = index.countries.filter((c) => c.ct === 'EU' && c.cl === 'un').map((c) => c.id);
    const deck = await buildDeck({ scope: 'countries', countries: europe, levels: {} });
    const graph = deckGraph(deck);
    const chain = longChain(graph, 'ES', mulberry32(5));
    expect(chain[0]).toBe('ES');
    expect(isChain(graph, chain)).toBe(true);
    expect(chain.length).toBeGreaterThanOrEqual(20);
  });
});
