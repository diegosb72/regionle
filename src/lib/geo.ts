/** Map projections and the adjacency graph used by the route games. */
import {
  geoAzimuthalEqualArea,
  geoCentroid,
  geoDistance,
  geoEqualEarth,
  geoGraticule10,
  geoPath,
  type GeoPath,
  type GeoPermissibleObjects,
  type GeoProjection,
  type GeoStream,
} from 'd3-geo';
import type { Geo, LL } from './types';
import type { Rng } from './text';

const DEG = 180 / Math.PI;

export interface View {
  projection: GeoProjection;
  path: GeoPath<unknown, GeoPermissibleObjects>;
  /** True when the whole planet is shown. */
  world: boolean;
  /** Box of the framed points in map units: [x0, y0, x1, y1]. */
  box: [number, number, number, number];
  /** Box of everything that can be drawn. */
  limits: [number, number, number, number];
}

/** Size of the square the projection is fitted to; the screen transform scales it afterwards. */
export const NOMINAL = 1000;

/** Centre and angular radius (degrees) of the smallest-ish cap holding the points. */
export function capOf(points: LL[]): { centre: LL; radius: number } {
  const centre = geoCentroid({ type: 'MultiPoint', coordinates: points }) as LL;
  let radius = 0;
  for (const p of points) radius = Math.max(radius, geoDistance(p, centre) * DEG);
  return { centre, radius };
}

/**
 * Picks a projection for the points to show: an equal-area azimuthal view centred on them for anything
 * up to a continent, Equal Earth beyond that.
 */
export function makeView(frame: LL[]): View {
  let points = frame.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (!points.length) points = [[0, 20]];
  let { centre, radius } = capOf(points);
  // Very small selections still get some surroundings.
  const MIN = 0.35;
  if (radius < MIN) {
    const dLon = MIN / Math.max(0.2, Math.cos(centre[1] / DEG));
    points = [...points, [centre[0] - dLon, centre[1]], [centre[0] + dLon, centre[1]], [centre[0], Math.min(89, centre[1] + MIN)], [centre[0], Math.max(-89, centre[1] - MIN)]];
    radius = MIN;
  }
  const world = radius > 80;
  const projection = world
    ? geoEqualEarth().rotate([radius >= 118 ? -11 : -centre[0], 0])
    : geoAzimuthalEqualArea()
        .rotate([-centre[0], -centre[1]])
        .clipAngle(Math.max(22, Math.min(150, radius * 2.4 + 14)));
  projection.precision(0.2).fitExtent(
    [
      [0, 0],
      [NOMINAL, NOMINAL],
    ],
    { type: 'MultiPoint', coordinates: points },
  );
  const path = geoPath(projection).digits(2);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    const q = projection(p);
    if (!q) continue;
    if (q[0] < x0) x0 = q[0];
    if (q[0] > x1) x1 = q[0];
    if (q[1] < y0) y0 = q[1];
    if (q[1] > y1) y1 = q[1];
  }
  const [[sx0, sy0], [sx1, sy1]] = path.bounds({ type: 'Sphere' });
  return { projection, path, world, box: [x0, y0, x1, y1], limits: [sx0, sy0, sx1, sy1] };
}

export function graticule() {
  return geoGraticule10();
}

/** Number of coordinates in a set of shapes: a measure of how heavy they are to draw. */
export function countPoints(geos: Geo[]): number {
  let n = 0;
  for (const g of geos) {
    const polys = g.geometry.type === 'Polygon' ? [g.geometry.coordinates] : g.geometry.coordinates;
    for (const poly of polys) for (const ring of poly) n += ring.length;
  }
  return n;
}

export interface CoarsePath {
  /** Path data of the shape with every point rounded to the grid; empty when nothing is left of it. */
  draw(geo: GeoPermissibleObjects): string;
  /** Exact bounds of the last shape drawn, or null when no part of it is on the map. */
  bounds(): [number, number, number, number] | null;
}

/**
 * A light version of a view's path generator for maps seen from afar. Points are rounded to a grid
 * of `grid` map units and runs that land on the same spot collapse into one, so a coast of five
 * hundred points that spans twenty pixels is drawn with forty. Rings that shrink to less than a
 * triangle are left out. Neighbours stay glued together because a shared point rounds the same way
 * on both sides.
 */
export function coarsePath(projection: GeoProjection, grid: number): CoarsePath {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const stream = (sink: GeoStream): GeoStream => {
    let buf: number[] = [];
    let lx = NaN;
    let ly = NaN;
    let ring = false;
    return {
      point(x, y) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        const rx = Math.round(x / grid) * grid;
        const ry = Math.round(y / grid) * grid;
        if (rx !== lx || ry !== ly) {
          buf.push(rx, ry);
          lx = rx;
          ly = ry;
        }
      },
      lineStart() {
        buf = [];
        lx = ly = NaN;
      },
      lineEnd() {
        let n = buf.length >> 1;
        if (ring) {
          if (n > 1 && buf[0] === buf[2 * n - 2] && buf[1] === buf[2 * n - 1]) n--;
          if (n < 3) return;
        } else if (n < 2) return;
        sink.lineStart();
        for (let i = 0; i < n; i++) sink.point(buf[2 * i], buf[2 * i + 1]);
        sink.lineEnd();
      },
      polygonStart() {
        ring = true;
        sink.polygonStart();
      },
      polygonEnd() {
        ring = false;
        sink.polygonEnd();
      },
      sphere() {
        sink.sphere?.();
      },
    };
  };
  const path = geoPath({ stream: (sink) => projection.stream(stream(sink)) }).digits(2);
  return {
    draw(geo) {
      x0 = y0 = Infinity;
      x1 = y1 = -Infinity;
      return path(geo) || '';
    },
    bounds: () => (x0 <= x1 ? [x0, y0, x1, y1] : null),
  };
}

/** Outline of one feature drawn on its own, north up, inside a `size` square. */
export function silhouette(geo: Geo, size: number, pad = 0.08): string {
  const c = geoCentroid(geo);
  const projection = geoAzimuthalEqualArea()
    .rotate([-c[0], -c[1]])
    .precision(0.1)
    .fitExtent(
      [
        [size * pad, size * pad],
        [size * (1 - pad), size * (1 - pad)],
      ],
      geo,
    );
  return geoPath(projection).digits(2)(geo) || '';
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: LL, b: LL): number {
  return geoDistance(a, b) * 6371;
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

export type Graph = Map<string, string[]>;

/** Number of steps from `from` to every reachable node. */
export function bfs(graph: Graph, from: string, allowed?: ReadonlySet<string>): Map<string, number> {
  const dist = new Map<string, number>([[from, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    const d = dist.get(cur)!;
    for (const nx of graph.get(cur) || []) {
      if (dist.has(nx) || (allowed && !allowed.has(nx))) continue;
      dist.set(nx, d + 1);
      queue.push(nx);
    }
  }
  return dist;
}

/** One shortest path from `a` to `b`, both ends included; null when they are not connected. */
export function shortestPath(graph: Graph, a: string, b: string, allowed?: ReadonlySet<string>): string[] | null {
  const prev = new Map<string, string | null>([[a, null]]);
  const queue = [a];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    if (cur === b) break;
    for (const nx of graph.get(cur) || []) {
      if (prev.has(nx) || (allowed && !allowed.has(nx))) continue;
      prev.set(nx, cur);
      queue.push(nx);
    }
  }
  if (!prev.has(b)) return null;
  const out: string[] = [];
  for (let at: string | null = b; at; at = prev.get(at) ?? null) out.push(at);
  return out.reverse();
}

export interface Route {
  from: string;
  to: string;
  /** Steps of the shortest route (number of regions in between is `steps - 1`). */
  steps: number;
}

/** Picks two nodes whose shortest route has between `min` and `max` steps, preferring the middle of the range. */
export function pickRoute(graph: Graph, rng: Rng, min = 3, max = 7): Route | null {
  const nodes = [...graph.keys()].filter((id) => (graph.get(id) || []).length > 0);
  if (nodes.length < 3) return null;
  let fallback: Route | null = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const from = nodes[Math.floor(rng() * nodes.length)];
    const dist = bfs(graph, from);
    const good: string[] = [];
    let far: [string, number] | null = null;
    for (const [id, d] of dist) {
      if (d >= min && d <= max) good.push(id);
      if (d >= 2 && (!far || d > far[1])) far = [id, d];
    }
    if (good.length) {
      const to = good[Math.floor(rng() * good.length)];
      return { from, to, steps: dist.get(to)! };
    }
    if (far && (!fallback || Math.abs(far[1] - min) < Math.abs(fallback.steps - min))) fallback = { from, to: far[0], steps: far[1] };
  }
  return fallback;
}

/** Nodes lying on at least one shortest path between the two ends (ends excluded). */
export function onShortest(graph: Graph, from: string, to: string): Set<string> {
  const a = bfs(graph, from);
  const b = bfs(graph, to);
  const total = a.get(to);
  const out = new Set<string>();
  if (total == null) return out;
  for (const [id, d] of a) if (id !== from && id !== to && d + (b.get(id) ?? Infinity) === total) out.add(id);
  return out;
}
