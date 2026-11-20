import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bfs, onShortest, type Graph } from './geo';
import { RULE_EXTRA_MAX, bestWalk, detourOf, hasCrossings, joined, journeyGraph, missing, neededOf, pickJourney, planOf, terminals, without, type Journey, type Ways } from './journey';
import { ROUTE_RULES, isRouteRule } from './rules';
import { mulberry32 } from './text';

/** A graph from its edges: "a-b b-c". */
function graphOf(edges: string, alone: string[] = []): Graph {
  const g: Graph = new Map();
  const node = (id: string) => g.get(id) ?? g.set(id, []).get(id)!;
  for (const edge of edges.split(' ').filter(Boolean)) {
    const [a, b] = edge.split('-');
    node(a).push(b);
    node(b).push(a);
  }
  for (const id of alone) node(id);
  return g;
}
const same = (g: Graph): Ways => ({ all: g, land: g });

/** The world as the game plays it: the countries of its map, their land borders and their short sea crossings. */
const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as { countries: { id: string; cl: string; nb?: string[]; sl?: string[] }[] };
const pieces = index.countries.filter((c) => ['un', 'obs', 'partial'].includes(c.cl));
const ids = new Set(pieces.map((c) => c.id));
const WORLD: Ways = {
  all: new Map(pieces.map((c) => [c.id, [...(c.nb ?? []), ...(c.sl ?? [])].filter((id) => ids.has(id))])),
  land: new Map(pieces.map((c) => [c.id, (c.nb ?? []).filter((id) => ids.has(id))])),
};

/** Whether some pieces, with nothing else, are joined to each other. */
function connected(graph: Graph, nodes: readonly string[]): boolean {
  const allowed = new Set(nodes);
  const reached = bfs(graph, nodes[0], allowed);
  return nodes.every((id) => reached.has(id));
}
/** The fewest pieces that have to be added to some for them all to be joined, trying every choice; with `must`, among the choices that have it. */
function fewest(graph: Graph, given: readonly string[], must?: string): number {
  const others = [...graph.keys()].filter((id) => !given.includes(id));
  let best = Infinity;
  for (let mask = 0; mask < 1 << others.length; mask++) {
    const chosen = others.filter((_, i) => mask & (1 << i));
    if (chosen.length >= best) continue;
    if (must && !given.includes(must) && !chosen.includes(must)) continue;
    if (connected(graph, [...given, ...chosen])) best = chosen.length;
  }
  return best;
}
/** The fewest pieces more that join some ends, given the ones already named: these may be used, and need not be. */
function fewestMore(graph: Graph, ends: readonly string[], named: ReadonlySet<string>): number {
  const others = [...graph.keys()].filter((id) => !ends.includes(id) && !named.has(id));
  let best = Infinity;
  for (let mask = 0; mask < 1 << others.length; mask++) {
    const chosen = others.filter((_, i) => mask & (1 << i));
    if (chosen.length >= best) continue;
    const reached = bfs(graph, ends[0], new Set([...ends, ...named, ...chosen]));
    if (ends.every((t) => reached.has(t))) best = chosen.length;
  }
  return best;
}
/** A small graph drawn with dice: a chain that joins everything, and some edges more. */
function drawn(seed: number, n: number): Graph {
  const rng = mulberry32(seed);
  const names = Array.from({ length: n }, (_, i) => String.fromCharCode(97 + i));
  const edges = new Set<string>();
  for (let i = 1; i < n; i++) edges.add(`${names[Math.floor(rng() * i)]}-${names[i]}`);
  for (let k = 0; k < n / 2; k++) {
    const a = Math.floor(rng() * n);
    const b = Math.floor(rng() * n);
    if (a !== b && !edges.has(`${names[a]}-${names[b]}`) && !edges.has(`${names[b]}-${names[a]}`)) edges.add(`${names[Math.min(a, b)]}-${names[Math.max(a, b)]}`);
  }
  return graphOf([...edges].join(' '));
}

const journey = (from: string, to: string, rule: Journey['rule'], mark?: string): Journey => ({ from, to, rule, mark, needed: 0, plain: 0 });

describe('the rules of a route', () => {
  it('are four, the first of them none', () => {
    expect(ROUTE_RULES).toEqual(['none', 'avoid', 'via', 'land']);
    for (const rule of ROUTE_RULES) expect(isRouteRule(rule)).toBe(true);
    for (const not of ['', 'sea', undefined, null, 1]) expect(isRouteRule(not)).toBe(false);
  });

  it('say what is travelled on and what is given', () => {
    const all = graphOf('a-b b-c c-d a-d');
    const land = graphOf('a-b b-c', ['d']);
    const ways: Ways = { all, land };
    expect(journeyGraph(ways, journey('a', 'c', 'none'))).toBe(all);
    expect(journeyGraph(ways, journey('a', 'c', 'via', 'd'))).toBe(all);
    expect(journeyGraph(ways, journey('a', 'c', 'land'))).toBe(land);
    const closed = journeyGraph(ways, journey('a', 'c', 'avoid', 'b'));
    expect([...closed.keys()].sort()).toEqual(['a', 'c', 'd']);
    expect(closed.get('a')).toEqual(['d']);
    expect(closed.get('c')).toEqual(['d']);
    // The graph of the map is left as it was.
    expect(all.get('a')).toEqual(['b', 'd']);
    expect(without(all, 'zz').size).toBe(4);
    expect(terminals(journey('a', 'c', 'none'))).toEqual(['a', 'c']);
    expect(terminals(journey('a', 'c', 'avoid', 'b'))).toEqual(['a', 'c']);
    expect(terminals(journey('a', 'c', 'via', 'd'))).toEqual(['a', 'd', 'c']);
    expect(hasCrossings(ways)).toBe(true);
    expect(hasCrossings(same(all))).toBe(false);
  });
});

describe('the best answer of a route', () => {
  it('is the shortest way between two ends, around what is closed', () => {
    // a — b — c, and the long way round by d and e.
    const g = graphOf('a-b b-c a-d d-e e-c');
    const plain = planOf(same(g), journey('a', 'c', 'none'));
    expect(neededOf(plain)).toBe(1);
    expect(bestWalk(plain)).toEqual(['a', 'b', 'c']);
    const around = planOf(same(g), journey('a', 'c', 'avoid', 'b'));
    expect(neededOf(around)).toBe(2);
    expect(bestWalk(around)).toEqual(['a', 'd', 'e', 'c']);
    // What is closed is nowhere near any way.
    expect(detourOf(around, 'b')).toBe(Infinity);
    expect(detourOf(around, 'd')).toBe(0);
    expect(detourOf(plain, 'b')).toBe(0);
    // By d the way is one piece longer.
    expect(detourOf(plain, 'd')).toBe(1);
  });

  it('with a stop is the smallest tree that joins the three, travelled there and back', () => {
    // a — b — c — d, with a branch from b: b — x — y.
    const g = graphOf('a-b b-c c-d b-x x-y');
    const plan = planOf(same(g), journey('a', 'd', 'via', 'y'));
    expect(plan.hub).toBe('b');
    // b, c and x: the stop itself is given.
    expect(neededOf(plan)).toBe(3);
    expect(bestWalk(plan)).toEqual(['a', 'b', 'x', 'y', 'x', 'b', 'c', 'd']);
    for (const id of ['a', 'b', 'c', 'd', 'x', 'y']) expect(detourOf(plan, id), id).toBe(0);
    // A stop on the way itself adds nothing, and nothing is gone back over.
    const onTheWay = planOf(same(g), journey('a', 'd', 'via', 'c'));
    expect(neededOf(onTheWay)).toBe(1);
    expect(bestWalk(onTheWay)).toEqual(['a', 'b', 'c', 'd']);
    expect(detourOf(onTheWay, 'x')).toBe(1);
    expect(detourOf(onTheWay, 'y')).toBe(2);
    // Nor does one at the end of the way.
    const beyond = planOf(same(graphOf('a-b b-c c-d')), journey('a', 'c', 'via', 'd'));
    expect(neededOf(beyond)).toBe(1);
    expect(bestWalk(beyond)).toEqual(['a', 'b', 'c', 'd', 'c']);
  });

  it('is as small as any choice of pieces, on graphs drawn with dice', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const g = drawn(seed, 6 + (seed % 4));
      const names = [...g.keys()].sort();
      const rng = mulberry32(seed * 7);
      const pickOne = (not: string[]): string => {
        const left = names.filter((id) => !not.includes(id));
        return left[Math.floor(rng() * left.length)];
      };
      const from = pickOne([]);
      const to = pickOne([from]);
      const mark = pickOne([from, to]);
      for (const rule of ['none', 'via', 'avoid'] as const) {
        const j = journey(from, to, rule, rule === 'none' ? undefined : mark);
        const plan = planOf(same(g), j);
        const given = terminals(j);
        const best = fewest(plan.graph, given);
        if (best === Infinity) {
          // Closing the piece cut the two ends apart.
          expect(rule, `seed ${seed}`).toBe('avoid');
          expect(plan.hub).toBeNull();
          expect(bestWalk(plan)).toEqual([]);
          continue;
        }
        expect(neededOf(plan), `seed ${seed} ${rule}`).toBe(best);
        // The walk goes from one end to the other by pieces that touch, calls at the stop, and uses no piece more than the best answer.
        const walk = bestWalk(plan);
        expect(walk[0]).toBe(from);
        expect(walk[walk.length - 1]).toBe(to);
        for (let i = 1; i < walk.length; i++) expect(plan.graph.get(walk[i - 1]), `seed ${seed} ${rule}: ${walk.join(' ')}`).toContain(walk[i]);
        for (const t of given) expect(walk).toContain(t);
        if (rule === 'avoid') expect(walk).not.toContain(mark);
        expect(new Set(walk).size - given.length).toBe(best);
        // Each piece is as far off as the best answer that uses it says.
        for (const id of plan.graph.keys()) {
          const withIt = fewest(plan.graph, given, id);
          const off = detourOf(plan, id);
          if (given.length === 3) expect(off, `seed ${seed} ${rule} ${id}`).toBe(withIt - best);
          else {
            // Between two ends it is the way through the piece that is measured: what hangs off the way counts there and back.
            expect(off, `seed ${seed} ${rule} ${id}`).toBeGreaterThanOrEqual(withIt - best);
            expect(off === 0, `seed ${seed} ${rule} ${id}`).toBe(withIt === best);
          }
        }
      }
    }
  });
});

describe('what has been named', () => {
  const g = graphOf('a-b b-c c-d b-x x-y a-p p-q q-d');

  it('joins the ends when there is a way between them through it alone', () => {
    const plain = planOf(same(g), journey('a', 'd', 'none'));
    expect(joined(plain, [])).toBe(false);
    expect(joined(plain, ['b'])).toBe(false);
    expect(joined(plain, ['b', 'c'])).toBe(true);
    expect(joined(plain, ['p', 'q'])).toBe(true);
    expect(joined(plain, ['c', 'q', 'x'])).toBe(false);
    // With a piece closed, the way through it does not count.
    const closed = planOf(same(g), journey('a', 'd', 'avoid', 'c'));
    expect(joined(closed, ['b', 'c'])).toBe(false);
    expect(joined(closed, ['p', 'q'])).toBe(true);
    // With a stop, the two ends are not enough: the stop has to be joined too.
    const stop = planOf(same(g), journey('a', 'd', 'via', 'y'));
    expect(joined(stop, ['b', 'c'])).toBe(false);
    expect(joined(stop, ['p', 'q'])).toBe(false);
    expect(joined(stop, ['b', 'c', 'x'])).toBe(true);
    // By the other way too, as long as the stop is reached.
    expect(joined(stop, ['p', 'q', 'b', 'x'])).toBe(true);
  });

  it('leaves the fewest pieces missing, and a hint is one of them', () => {
    const stop = planOf(same(g), journey('a', 'd', 'via', 'y'));
    expect(missing(stop, new Set()).sort()).toEqual(['b', 'c', 'x']);
    expect(missing(stop, new Set(['b'])).sort()).toEqual(['c', 'x']);
    // What has been named counts, even off the best answer: with p and q down, the stop is all that is left to reach.
    expect(missing(stop, new Set(['p', 'q'])).sort()).toEqual(['b', 'x']);
    expect(missing(stop, new Set(['b', 'c', 'x']))).toEqual([]);
    const plain = planOf(same(g), journey('a', 'd', 'none'));
    expect(missing(plain, new Set(['p'])).sort()).toEqual(['q']);
    expect(missing(plain, new Set(['x'])).length).toBe(2);
  });

  it('is finished off with as few pieces as any choice, on graphs drawn with dice', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const g2 = drawn(seed + 100, 7 + (seed % 3));
      const names = [...g2.keys()].sort();
      const rng = mulberry32(seed * 13);
      const order = [...names].sort(() => rng() - 0.5);
      const [from, to, mark, ...rest] = order;
      const named = new Set(rest.slice(0, seed % 3));
      for (const rule of ['none', 'via'] as const) {
        const j = journey(from, to, rule, rule === 'via' ? mark : undefined);
        const plan = planOf(same(g2), j);
        const left = missing(plan, named);
        expect(left.length, `seed ${seed} ${rule}`).toBe(fewestMore(g2, terminals(j), named));
        expect(joined(plan, [...named, ...left]), `seed ${seed} ${rule}`).toBe(true);
        for (const id of left) expect([...terminals(j), ...named]).not.toContain(id);
      }
    }
  });
});

describe('a journey picked on the world', () => {
  const draws = (rule: Journey['rule'], n = 80): Journey[] => {
    const rng = mulberry32(2026);
    return Array.from({ length: n }, () => pickJourney(WORLD, rng, rule)).filter((j): j is Journey => !!j);
  };

  it('is the same for the same dice', () => {
    for (const rule of ROUTE_RULES) {
      const a = pickJourney(WORLD, mulberry32(77), rule);
      const b = pickJourney(WORLD, mulberry32(77), rule);
      expect(a, rule).not.toBeNull();
      expect(a).toEqual(b);
      expect(a!.rule).toBe(rule);
    }
  });

  it('without a rule is the route of always', () => {
    for (const j of draws('none')) {
      expect(j.mark).toBeUndefined();
      expect(j.needed).toBe(j.plain);
      expect(bfs(WORLD.all, j.from).get(j.to)).toBe(j.needed + 1);
    }
  });

  it('closes a piece the shortest routes go through, and one that can be gone around', () => {
    const list = draws('avoid');
    expect(list.length).toBe(80);
    let longer = 0;
    for (const j of list) {
      expect(onShortest(WORLD.all, j.from, j.to).has(j.mark!), `${j.from}-${j.to} ${j.mark}`).toBe(true);
      const plan = planOf(WORLD, j);
      expect(plan.hub).not.toBeNull();
      expect(neededOf(plan)).toBe(j.needed);
      expect(j.plain).toBe(bfs(WORLD.all, j.from).get(j.to)! - 1);
      expect(j.needed).toBeGreaterThanOrEqual(j.plain);
      expect(j.needed - j.plain).toBeLessThanOrEqual(RULE_EXTRA_MAX);
      expect(bestWalk(plan)).not.toContain(j.mark);
      if (j.needed > j.plain) longer++;
    }
    // Nearly always the closed piece makes the way longer: that is what is looked for.
    expect(longer).toBeGreaterThan(70);
    // And not always the same one.
    expect(new Set(list.map((j) => j.mark)).size).toBeGreaterThan(20);
  });

  it('calls at a piece that is off the shortest routes', () => {
    const list = draws('via');
    expect(list.length).toBe(80);
    let longer = 0;
    for (const j of list) {
      expect([j.from, j.to]).not.toContain(j.mark);
      expect(onShortest(WORLD.all, j.from, j.to).has(j.mark!), `${j.from}-${j.to} ${j.mark}`).toBe(false);
      const plan = planOf(WORLD, j);
      expect(neededOf(plan)).toBe(j.needed);
      expect(j.plain).toBe(bfs(WORLD.all, j.from).get(j.to)! - 1);
      expect(j.needed - j.plain).toBeLessThanOrEqual(RULE_EXTRA_MAX);
      expect(j.needed).toBeGreaterThanOrEqual(j.plain);
      const walk = bestWalk(plan);
      expect(walk).toContain(j.mark);
      expect(new Set(walk).size - 3).toBe(j.needed);
      if (j.needed > j.plain) longer++;
    }
    expect(longer).toBeGreaterThan(70);
    expect(new Set(list.map((j) => j.mark)).size).toBeGreaterThan(20);
  });

  it('by land alone joins two pieces that a sea crossing would bring closer', () => {
    const list = draws('land');
    expect(list.length).toBe(80);
    for (const j of list) {
      expect(j.mark).toBeUndefined();
      expect(bfs(WORLD.land, j.from).get(j.to)).toBe(j.needed + 1);
      expect(bfs(WORLD.all, j.from).get(j.to)).toBe(j.plain + 1);
      expect(j.needed, `${j.from}-${j.to}`).toBeGreaterThan(j.plain);
      expect(j.needed).toBeLessThanOrEqual(6);
      // The best answer crosses no sea.
      const walk = bestWalk(planOf(WORLD, j));
      for (let i = 1; i < walk.length; i++) expect(WORLD.land.get(walk[i - 1])).toContain(walk[i]);
    }
    expect(new Set(list.map((j) => `${j.from}-${j.to}`)).size).toBeGreaterThan(30);
  });

  it('is not picked where the map has none of the kind', () => {
    // A row of four: closing any of the two in the middle cuts it, and nothing is out of the way.
    const row = same(graphOf('a-b b-c c-d'));
    for (let seed = 0; seed < 20; seed++) {
      expect(pickJourney(row, mulberry32(seed), 'avoid')).toBeNull();
      // No crossing to do without.
      expect(pickJourney(row, mulberry32(seed), 'land')).toBeNull();
      expect(pickJourney(row, mulberry32(seed), 'none')).not.toBeNull();
    }
    // The only stops there are lie beyond an end: they add nothing, and they are never a piece of the way itself.
    for (let seed = 0; seed < 40; seed++) {
      const via = pickJourney(row, mulberry32(seed), 'via');
      expect(via, `seed ${seed}`).not.toBeNull();
      expect(onShortest(row.all, via!.from, via!.to).has(via!.mark!), `seed ${seed}: ${via!.from}-${via!.to} by ${via!.mark}`).toBe(false);
      expect(via).toMatchObject({ needed: 1, plain: 1 });
    }
    // Two pieces are no route at all.
    for (const rule of ROUTE_RULES) expect(pickJourney(same(graphOf('a-b')), mulberry32(1), rule)).toBeNull();
    // A ring of six can be gone around the other way, and by land when a crossing cuts across it.
    const ring = graphOf('a-b b-c c-d d-e e-f f-a');
    const avoid = pickJourney(same(ring), mulberry32(3), 'avoid');
    expect(avoid).not.toBeNull();
    expect(avoid!.needed).toBeGreaterThan(avoid!.plain);
    const cut: Ways = { all: graphOf('a-b b-c c-d d-e e-f f-a a-d'), land: ring };
    const land = pickJourney(cut, mulberry32(3), 'land');
    expect(land).not.toBeNull();
    expect([land!.from, land!.to].sort()).toEqual(['a', 'd']);
    expect(land).toMatchObject({ needed: 2, plain: 0 });
  });
});
