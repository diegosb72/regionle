/**
 * A route with a condition: the two ends of the route game and, on top of them, a rule to keep. A piece is
 * closed and has to be gone around; the route has to call at a third piece that is out of the way; or only
 * land borders count, and not the short sea crossings. What is asked, what counts as having made it, how far
 * off a guess is and what the best answer was all follow from the graph of the map alone.
 */
import { bfs, onShortest, pickRoute, shortestPath, type Graph } from './geo';
import type { RouteRule } from './rules';
import type { Rng } from './text';

export interface Journey {
  from: string;
  to: string;
  rule: RouteRule;
  /** The piece that is closed (`avoid`) or the one to call at (`via`). */
  mark?: string;
  /** Pieces to name on the shortest way that keeps the rule: neither the ends nor the stop. */
  needed: number;
  /** Pieces the shortest way would need without the rule. */
  plain: number;
}

/** The two graphs of a map: with its short sea crossings, and by land alone. */
export interface Ways {
  all: Graph;
  land: Graph;
}

/** What a rule may add to the plain route, in pieces to name: more than that is another route altogether. */
export const RULE_EXTRA_MAX = 3;
/** The longest way a journey may be, in steps: as in the plain game. */
const STEPS_MAX = 7;

const INF = Number.POSITIVE_INFINITY;
const at = (dist: Map<string, number>, id: string): number => dist.get(id) ?? INF;

/** The graph without one of its nodes: nothing goes into it or out of it. */
export function without(graph: Graph, id: string): Graph {
  const out: Graph = new Map();
  for (const [node, list] of graph) if (node !== id) out.set(node, list.includes(id) ? list.filter((nx) => nx !== id) : list);
  return out;
}

/** Whether any sea crossing joins two pieces of the map: without one, land is all there is. */
export const hasCrossings = (ways: Ways): boolean => [...ways.all].some(([id, list]) => list.length !== (ways.land.get(id)?.length ?? 0));

/** The graph a journey is travelled on: by land alone, or the one of the map less the piece that is closed. */
export function journeyGraph(ways: Ways, j: Journey): Graph {
  if (j.rule === 'land') return ways.land;
  return j.rule === 'avoid' && j.mark ? without(ways.all, j.mark) : ways.all;
}

/** The pieces a journey is given with: its two ends and, when it has to call somewhere, the stop between them. */
export const terminals = (j: Journey): string[] => (j.rule === 'via' && j.mark ? [j.from, j.mark, j.to] : [j.from, j.to]);

/**
 * From some costs to start with, the least each node can be reached for: what it costs somewhere, plus the
 * steps from there. The costs are small whole numbers, so the nodes are settled value by value.
 */
function spread(graph: Graph, start: Map<string, number>): Map<string, number> {
  const cost = new Map<string, number>();
  const rows: string[][] = [];
  for (const [id, value] of start) {
    if (value === INF) continue;
    cost.set(id, value);
    (rows[value] ??= []).push(id);
  }
  for (let value = 0; value < rows.length; value++) {
    const row = rows[value];
    if (!row) continue;
    for (const cur of row) {
      // Reached for less since it was put in this row.
      if (cost.get(cur) !== value) continue;
      for (const nx of graph.get(cur) || []) {
        if (at(cost, nx) <= value + 1) continue;
        cost.set(nx, value + 1);
        (rows[value + 1] ??= []).push(nx);
      }
    }
  }
  return cost;
}

const summed = (maps: Map<string, number>[]): Map<string, number> => {
  const out = new Map<string, number>();
  for (const id of maps[0].keys()) {
    let total = 0;
    for (const m of maps) total += at(m, id);
    if (total < INF) out.set(id, total);
  }
  return out;
};

/** What is worked out once for a journey, to judge every guess with. */
export interface Plan {
  journey: Journey;
  /** The graph it is travelled on. */
  graph: Graph;
  ends: string[];
  /** Steps from each terminal to everywhere. */
  reach: Map<string, number>[];
  /** Steps of the best answer: of the shortest way between two ends, or of the smallest tree that joins three. */
  steps: number;
  /** Where the ways to every terminal meet in a best answer; null when they cannot all be joined. */
  hub: string | null;
  /** With three terminals: the steps of the smallest tree that joins them and each node. */
  withNode?: Map<string, number>;
}

/**
 * The plan of a journey. With two terminals the best answer is a shortest path. With three it is a tree: the
 * ways to the three meet somewhere, and the best meeting point is the one with the fewest steps to them all.
 */
export function planOf(ways: Ways, journey: Journey): Plan {
  const graph = journeyGraph(ways, journey);
  const ends = terminals(journey);
  const reach = ends.map((t) => bfs(graph, t));
  let hub: string | null = null;
  let steps = INF;
  for (const [id, total] of summed(reach)) {
    if (total < steps) {
      steps = total;
      hub = id;
    }
  }
  const plan: Plan = { journey, graph, ends, reach, steps, hub };
  if (ends.length === 3 && hub) {
    // The smallest tree that joins the three and one node more is a pair of them joined somewhere, and from
    // there a way to where the third and the node are joined: each of the three in turn is the one apart.
    const split = new Map<string, number>();
    for (let i = 0; i < 3; i++) {
      const pair = spread(graph, summed(reach.filter((_, k) => k !== i)));
      for (const [id, cost] of pair) split.set(id, Math.min(at(split, id), cost + at(reach[i], id)));
    }
    plan.withNode = spread(graph, split);
  }
  return plan;
}

/** Pieces to name in the best answer of a plan: all of its pieces, less the terminals themselves. */
export const neededOf = (plan: Plan): number => plan.steps + 1 - plan.ends.length;

/**
 * How many pieces more than the best answer the best one that uses `id` takes: 0 for a piece of a best
 * answer, and the further off the more. Between two ends it is the shortest way through the piece, there
 * and on; with a stop, the smallest tree that joins the piece too. Infinite for a piece that cannot be reached.
 */
export function detourOf(plan: Plan, id: string): number {
  if (plan.withNode) return at(plan.withNode, id) - plan.steps;
  return at(plan.reach[0], id) + at(plan.reach[1], id) - plan.steps;
}

/** From a random place of a sorted list on, round to where it started: the same for the same dice. */
function* turned<T>(list: readonly T[], rng: Rng): Generator<T> {
  const start = Math.floor(rng() * Math.max(1, list.length));
  for (let k = 0; k < list.length; k++) yield list[(start + k) % list.length];
}

/**
 * A journey on the map that keeps a rule. A closed piece is one the shortest routes go through, and one
 * that can be gone around. A stop is a piece off the shortest routes. By land, the ends are two that a sea
 * crossing would bring closer. Wherever it can be, the rule makes the way longer: when no such journey turns
 * up, one where it only narrows the choice is given. Null when the map has no journey of the kind (or none
 * at all): whoever asks decides what to offer instead.
 */
export function pickJourney(ways: Ways, rng: Rng, rule: RouteRule, tries = 40): Journey | null {
  if (rule === 'none') {
    const route = pickRoute(ways.all, rng);
    return route ? { from: route.from, to: route.to, rule, needed: route.steps - 1, plain: route.steps - 1 } : null;
  }
  if (rule === 'land') {
    if (!hasCrossings(ways)) return null;
    const inland = [...ways.land.keys()].filter((id) => ways.land.get(id)!.length > 0).sort();
    // The pieces with a crossing of their own: the likeliest to be closer to something by sea than by land.
    const coastal = inland.filter((id) => ways.all.get(id)!.length !== ways.land.get(id)!.length);
    for (let attempt = 0; attempt < tries && inland.length; attempt++) {
      // From anywhere first; from the coast when that has not found a pair.
      const pool = attempt < tries / 2 || !coastal.length ? inland : coastal;
      const from = pool[Math.floor(rng() * pool.length)];
      const byLand = bfs(ways.land, from);
      const bySea = bfs(ways.all, from);
      const options = [...byLand.keys()].filter((id) => at(byLand, id) >= 2 && at(byLand, id) <= STEPS_MAX && at(byLand, id) > at(bySea, id)).sort();
      if (!options.length) continue;
      const to = options[Math.floor(rng() * options.length)];
      return { from, to, rule, needed: at(byLand, to) - 1, plain: at(bySea, to) - 1 };
    }
    return null;
  }
  let spare: Journey | null = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    // Shorter than a plain route may be: the rule adds to it.
    const route = pickRoute(ways.all, rng, 2, 5);
    if (!route) return null;
    const { from, to, steps } = route;
    const plain = steps - 1;
    if (rule === 'avoid') {
      for (const mark of turned([...onShortest(ways.all, from, to)].sort(), rng)) {
        const around = bfs(without(ways.all, mark), from).get(to);
        if (around == null || around - steps > RULE_EXTRA_MAX) continue;
        const journey: Journey = { from, to, rule, mark, needed: around - 1, plain };
        if (around > steps) return journey;
        spare ??= journey;
      }
    } else {
      const a = bfs(ways.all, from);
      const b = bfs(ways.all, to);
      // Off the shortest routes, and not so far that the stop is the whole journey.
      const options = [...a.keys()].filter((id) => id !== from && id !== to && b.has(id) && at(a, id) + at(b, id) > steps && at(a, id) + at(b, id) - steps <= RULE_EXTRA_MAX + 1).sort();
      let looked = 0;
      for (const mark of turned(options, rng)) {
        if (++looked > 8) break;
        // The smallest tree that joins the three: its pieces, less the three themselves.
        let tree = INF;
        for (const [id, d] of bfs(ways.all, mark)) tree = Math.min(tree, d + at(a, id) + at(b, id));
        const needed = tree - 2;
        if (needed - plain > RULE_EXTRA_MAX) continue;
        const journey: Journey = { from, to, rule, mark, needed, plain };
        if (needed > plain) return journey;
        spare ??= journey;
      }
    }
  }
  return spare;
}

/** Whether the pieces that have been named join every terminal of the journey. */
export function joined(plan: Plan, named: Iterable<string>): boolean {
  const allowed = new Set<string>([...plan.ends, ...named]);
  const reached = bfs(plan.graph, plan.ends[0], allowed);
  return plan.ends.every((t) => reached.has(t));
}

/**
 * One best answer, as it is travelled: from one end to the other, calling at the stop when there is one.
 * A piece the way goes into and comes back out of is there twice: it comes back the way it went.
 */
export function bestWalk(plan: Plan): string[] {
  const { graph, ends, hub } = plan;
  if (!hub) return [];
  if (ends.length === 2) return shortestPath(graph, ends[0], ends[1]) ?? [];
  const leg = (a: string, b: string): string[] => shortestPath(graph, a, b) ?? [];
  const aside = leg(hub, ends[1]);
  return [...leg(ends[0], hub), ...aside.slice(1), ...aside.slice(0, -1).reverse(), ...leg(hub, ends[2]).slice(1)];
}

/**
 * From one piece, the fewest pieces not yet named that a way to each of the others goes into, and the piece
 * before each on such a way.
 */
function costs(graph: Graph, from: string, free: ReadonlySet<string>): { cost: Map<string, number>; prev: Map<string, string | null> } {
  const cost = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string | null>([[from, null]]);
  // What costs nothing goes to the front of the line, so that the cheapest is always looked at first.
  const line = [from];
  while (line.length) {
    const cur = line.shift()!;
    const c = cost.get(cur)!;
    for (const nx of graph.get(cur) || []) {
      const w = free.has(nx) ? 0 : 1;
      if (at(cost, nx) <= c + w) continue;
      cost.set(nx, c + w);
      prev.set(nx, cur);
      if (w) line.push(nx);
      else line.unshift(nx);
    }
  }
  return { cost, prev };
}

/**
 * Pieces that are still missing on an answer that makes the most of what has been named: any of them is a
 * hint. The ways from every terminal meet where the fewest new pieces are needed between them all.
 */
export function missing(plan: Plan, named: ReadonlySet<string>): string[] {
  const { graph, ends } = plan;
  const free = new Set<string>([...named, ...ends]);
  const sides = ends.map((t) => costs(graph, t, free));
  let meet: { id: string; total: number } | null = null;
  // In the order of their names: the same answer for the same map, whatever order its pieces came in.
  for (const id of [...sides[0].cost.keys()].sort()) {
    let total = 0;
    for (const side of sides) total += at(side.cost, id);
    // Every way goes into the meeting point, which is named once.
    if (!free.has(id)) total -= sides.length - 1;
    if (total < (meet?.total ?? INF)) meet = { id, total };
  }
  if (!meet) return [];
  const out = new Set<string>();
  for (const side of sides) {
    let hops = 0;
    for (let id: string | null = meet.id; id && hops <= graph.size; id = side.prev.get(id) ?? null, hops++) if (!free.has(id)) out.add(id);
  }
  return [...out];
}
