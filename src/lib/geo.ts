/** Map projections and the adjacency graph used by the route games. */
import {
  geoAzimuthalEqualArea,
  geoCentroid,
  geoContains,
  geoDistance,
  geoEqualEarth,
  geoGraticule10,
  geoInterpolate,
  geoPath,
  type GeoPath,
  type GeoPermissibleObjects,
  type GeoProjection,
  type GeoStream,
} from 'd3-geo';
import type { AnyGeo, LL } from './types';
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

/**
 * A quick «no» before asking whether a place lies in a polygon, which costs a sum over every corner of it:
 * the latitudes and the longitudes that its outline spans, with half a degree to spare for the sides, which
 * are arcs. An outline that goes all the way round the globe holds a pole, and its span says nothing.
 */
function spanOf(ring: readonly (readonly number[])[]): (ll: readonly [number, number]) => boolean {
  let s = Infinity;
  let n = -Infinity;
  let lon = ring[0][0];
  let w = lon;
  let e = lon;
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = ring[i];
    if (y < s) s = y;
    if (y > n) n = y;
    if (!i) continue;
    // Longitudes are followed step by step, so that an outline across the antimeridian spans what it spans.
    const d = x - ring[i - 1][0];
    lon += d > 180 ? d - 360 : d < -180 ? d + 360 : d;
    if (lon < w) w = lon;
    if (lon > e) e = lon;
  }
  if (e - w >= 359) return () => true;
  const SPARE = 0.5;
  return ([x, y]) => y >= s - SPARE && y <= n + SPARE && ((((x - (w - SPARE)) % 360) + 360) % 360) <= e - w + 2 * SPARE;
}

/**
 * Where to write the name of a shape whose own spot falls outside a frame: the Atlantic on a map of Europe, a
 * plain that runs from France to the Urals on the map of France. For a surface, the place inside the frame
 * with the most of the shape around it, on a grid of `side` cells; for a line, the middle of what is in
 * sight. Null when no part of it is in the frame.
 */
export function spotInFrame(geo: AnyGeo, projection: GeoProjection, box: readonly [number, number, number, number], side = 18): [number, number] | null {
  const [x0, y0, x1, y1] = box;
  const g = geo.geometry;
  if (g.type === 'LineString' || g.type === 'MultiLineString') {
    const seen: [number, number][] = [];
    for (const line of g.type === 'LineString' ? [g.coordinates] : g.coordinates)
      for (const p of line) {
        const q = projection(p as LL);
        if (q && q[0] >= x0 && q[0] <= x1 && q[1] >= y0 && q[1] <= y1) seen.push(q);
      }
    return seen.length ? seen[seen.length >> 1] : null;
  }
  if ((g.type !== 'Polygon' && g.type !== 'MultiPolygon') || !projection.invert) return null;
  const w = (x1 - x0) / side;
  const h = (y1 - y0) / side;
  // Piece by piece: most of an ocean or of an archipelago is nowhere near the place asked about.
  const pieces = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).map((coordinates) => ({ shape: { type: 'Polygon' as const, coordinates }, near: spanOf(coordinates[0]) }));
  const inside: boolean[] = [];
  for (let j = 0; j < side; j++)
    for (let i = 0; i < side; i++) {
      const ll = projection.invert([x0 + (i + 0.5) * w, y0 + (j + 0.5) * h]);
      inside.push(!!ll && pieces.some((piece) => piece.near(ll) && geoContains(piece.shape, ll)));
    }
  // How many rings of cells, all of the shape, lie around each cell: the edge of the frame counts as the end of it.
  const depth = (i: number, j: number): number => {
    for (let r = 1; ; r++)
      for (let dj = -r; dj <= r; dj++)
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const a = i + di;
          const b = j + dj;
          if (a < 0 || b < 0 || a >= side || b >= side || !inside[b * side + a]) return r - 1;
        }
  };
  let best = -1;
  let at: [number, number] | null = null;
  let off = Infinity;
  for (let j = 0; j < side; j++)
    for (let i = 0; i < side; i++) {
      if (!inside[j * side + i]) continue;
      const d = depth(i, j);
      // Among the deepest, the one nearest the middle of the frame.
      const far = (i + 0.5 - side / 2) ** 2 + (j + 0.5 - side / 2) ** 2;
      if (d > best || (d === best && far < off)) {
        best = d;
        off = far;
        at = [x0 + (i + 0.5) * w, y0 + (j + 0.5) * h];
      }
    }
  return at;
}

/** How far into a shape that is out of sight a frame reaches, as a share of the map's radius, and by how many rounds. */
const REACH = 0.12;
const ROUNDS = 3;
/** Map units, of the `NOMINAL` thousand across. */
const HAIR = 1e-6;

/**
 * Points to add to a frame so that each of some shapes can be seen in it. A map is framed by its land, and a
 * sea that only touches a far corner of it would be asked about with nothing of it on screen: the Arctic
 * Ocean north of Europe, the Norwegian Sea off Shetland, the Bering Sea on a map of Asia drawn by its
 * countries. For each shape with no part in sight the frame reaches into it, from its corner nearest the
 * middle of the map towards its own middle `at`: all the way if that is near, a little of the map if not,
 * and further in a second and a third round if it still cannot be seen.
 */
export function sightFor(frame: LL[], shapes: readonly { geo: AnyGeo; at: LL }[]): LL[] {
  let added: LL[] = [];
  for (let round = 1; round <= ROUNDS; round++) {
    const points = [...frame, ...added];
    if (!points.length) break;
    const view = makeView(points);
    const [x0, y0, x1, y1] = view.box;
    const { centre, radius } = capOf(points);
    const more: LL[] = [];
    for (const shape of shapes) {
      const q = view.projection(shape.at);
      // To a hair: a middle taken in by an earlier round is a corner of the box itself.
      if (q && q[0] >= x0 - HAIR && q[0] <= x1 + HAIR && q[1] >= y0 - HAIR && q[1] <= y1 + HAIR) continue;
      if (spotInFrame(shape.geo, view.projection, view.box, 12)) continue;
      const g = shape.geo.geometry;
      const lines = g.type === 'Polygon' || g.type === 'MultiLineString' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : g.type === 'LineString' ? [g.coordinates] : [];
      let near: LL | null = null;
      let best = Infinity;
      for (const line of lines)
        for (const p of line) {
          const d = geoDistance(p as LL, centre);
          if (d < best) {
            best = d;
            near = p as LL;
          }
        }
      if (!near) continue;
      const far = geoDistance(near, shape.at) * DEG;
      const reach = REACH * round * radius;
      more.push(reach >= far ? shape.at : (geoInterpolate(near, shape.at)(reach / far) as LL));
    }
    if (!more.length) break;
    added = [...added, ...more];
  }
  return added;
}

/**
 * Width and height in view units of the biggest polygon of a multi-part shape, from the corners of its
 * lon/lat box: what the eye finds in an archipelago. Null for anything that is a single piece.
 */
export function landBox(geo: AnyGeo, project: (p: LL) => [number, number] | null): [number, number] | null {
  if (geo.geometry.type !== 'MultiPolygon' || geo.geometry.coordinates.length < 2) return null;
  let best: [number, number, number, number] | null = null;
  let bestArea = -1;
  for (const poly of geo.geometry.coordinates) {
    let w = Infinity;
    let e = -Infinity;
    let south = Infinity;
    let north = -Infinity;
    for (const pt of poly[0]) {
      if (pt[0] < w) w = pt[0];
      if (pt[0] > e) e = pt[0];
      if (pt[1] < south) south = pt[1];
      if (pt[1] > north) north = pt[1];
    }
    const area = (e - w) * Math.cos((((south + north) / 2) * Math.PI) / 180) * (north - south);
    if (area > bestArea) {
      bestArea = area;
      best = [w, south, e, north];
    }
  }
  if (!best) return null;
  const [w, south, e, north] = best;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const corner of [
    [w, south],
    [e, south],
    [w, north],
    [e, north],
  ] as LL[]) {
    const q = project(corner);
    if (!q) continue;
    if (q[0] < x0) x0 = q[0];
    if (q[0] > x1) x1 = q[0];
    if (q[1] < y0) y0 = q[1];
    if (q[1] > y1) y1 = q[1];
  }
  return Number.isFinite(x0) ? [x1 - x0, y1 - y0] : null;
}

/** Number of coordinates in a set of shapes: a measure of how heavy they are to draw. */
export function countPoints(geos: AnyGeo[]): number {
  let n = 0;
  for (const { geometry: g } of geos) {
    if (g.type === 'Point') n += 1;
    else if (g.type === 'LineString') n += g.coordinates.length;
    else if (g.type === 'MultiLineString') for (const line of g.coordinates) n += line.length;
    else for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) for (const ring of poly) n += ring.length;
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

/**
 * Outline of one feature drawn on its own inside a `size` square: north up, or turned `turn` degrees
 * clockwise for those who want it harder. Turned or not, it is fitted to the square.
 */
export function silhouette(geo: AnyGeo, size: number, pad = 0.08, turn = 0): string {
  const c = geoCentroid(geo);
  const projection = geoAzimuthalEqualArea()
    .rotate([-c[0], -c[1]])
    // d3 counts the angle anticlockwise.
    .angle(-turn)
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

/**
 * How far a point is from a shape, in kilometres: nothing when it falls inside a surface; otherwise the
 * distance to the nearest point of its edge, of its line (a river) or to the dot itself (a city).
 *
 * The nearest point is looked for on a flat sheet laid around the point, which is exact nearby and good
 * enough far away; the distance to it is then measured on the globe.
 */
export function kmToShape(at: LL, geo: AnyGeo): number {
  const g = geo.geometry;
  if (g.type === 'Point') return distanceKm(at, g.coordinates as LL);
  if ((g.type === 'Polygon' || g.type === 'MultiPolygon') && geoContains(geo, at)) return 0;
  const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates.flat() : g.coordinates;
  const [lon0, lat0] = at;
  const cos = Math.max(0.05, Math.cos(lat0 / DEG));
  /** Degrees of longitude from one meridian to another, the short way round. */
  const turn = (d: number) => (d > 180 ? d - 360 : d < -180 ? d + 360 : d);
  let best = Infinity;
  let bx = 0;
  let by = 0;
  const near = (x: number, y: number) => {
    const d = x * x + y * y;
    if (d < best) {
      best = d;
      bx = x;
      by = y;
    }
  };
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      // Each stretch on its own: its first end the short way from the point, its second the short way from the first.
      const px = turn(line[i][0] - lon0) * cos;
      const py = line[i][1] - lat0;
      if (i + 1 >= line.length) {
        near(px, py);
        break;
      }
      const vx = turn(line[i + 1][0] - line[i][0]) * cos;
      const vy = line[i + 1][1] - line[i][1];
      const len = vx * vx + vy * vy;
      const t = len ? Math.max(0, Math.min(1, -(px * vx + py * vy) / len)) : 0;
      near(px + t * vx, py + t * vy);
    }
  }
  return Number.isFinite(best) ? distanceKm(at, [lon0 + bx / cos, Math.max(-90, Math.min(90, lat0 + by))]) : Infinity;
}

/** Roughly the longest distance between two of the points: the farthest from any one of them, and the farthest from that. */
export function spanKm(points: LL[]): number {
  if (points.length < 2) return 1;
  const farthest = (from: LL) => points.reduce((best, p) => (distanceKm(from, p) > distanceKm(from, best) ? p : best), from);
  const a = farthest(points[0]);
  return distanceKm(a, farthest(a)) || 1;
}

/**
 * How close counts as right and as nearly right when a place is put on the map blind, in kilometres. Both
 * follow the size of the map: forty kilometres are a bad miss among the cities of Belgium and a
 * bull's-eye among the capitals of the world.
 */
export function tolerances(points: LL[]): { ok: number; warn: number } {
  const ok = Math.max(15, Math.min(500, spanKm(points) * 0.03));
  return { ok: Math.round(ok), warn: Math.round(ok * 2.6) };
}

/** Nearest first: the plausible wrong options of a multiple choice, the pieces around a lesson. */
export function nearest<T extends { id: string; lp: LL }>(target: { id: string; lp: LL }, pool: T[], n: number): T[] {
  const [lon, lat] = target.lp;
  const cos = Math.cos((lat * Math.PI) / 180);
  return pool
    .filter((p) => p.id !== target.id)
    .map((p) => {
      let dLon = Math.abs(p.lp[0] - lon);
      if (dLon > 180) dLon = 360 - dLon;
      return [Math.hypot(dLon * cos, p.lp[1] - lat), p] as const;
    })
    .sort((a, b) => a[0] - b[0])
    .slice(0, n)
    .map((x) => x[1]);
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

/**
 * A path from `a` to `b` that needs the fewest nodes outside `free`, both ends included: what is still
 * missing once some of the way is already known.
 */
export function cheapestPath(graph: Graph, a: string, b: string, free: ReadonlySet<string>): string[] | null {
  const cost = new Map<string, number>([[a, 0]]);
  const prev = new Map<string, string | null>([[a, null]]);
  // Costs are small whole numbers, so nodes are settled layer by layer: one layer per new node needed.
  let layer = [a];
  for (let guard = 0; layer.length && guard <= graph.size; guard++) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i++) {
      const cur = layer[i];
      const c = cost.get(cur)!;
      for (const nx of graph.get(cur) || []) {
        const w = nx === b || free.has(nx) ? 0 : 1;
        if (cost.has(nx) && cost.get(nx)! <= c + w) continue;
        cost.set(nx, c + w);
        prev.set(nx, cur);
        if (w === 0) layer.push(nx);
        else next.push(nx);
      }
    }
    layer = next.filter((id, i) => next.indexOf(id) === i);
  }
  if (!prev.has(b)) return null;
  const out: string[] = [];
  for (let at: string | null = b; at && out.length <= graph.size; at = prev.get(at) ?? null) out.push(at);
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
