// Builds the data of the cities and physical geography sections:
//
//   public/data/physical.json   continents, oceans, rivers, lakes, seas, ranges, plains, peninsulas, peaks,
//                               capes, deserts, islands and waterfalls that can be asked
//   public/data/cities.json     cities of every country
//   public/data/capitals.json   capitals of the regions of every country that has them marked
//
//   npm run data:fetch && npm run data:physical
//
// It reads the Natural Earth layers in .cache/src and the files that `data:build` has already written
// (index.json, world.json, r/<ID>.json), which say which region every city belongs to and which country
// every river runs through. Spain is drawn in more detail than Natural Earth has, from the Atlas Nacional
// de España (spain.mjs). How big an ocean or a continent is comes from The World Factbook, and so does which
// seas each ocean counts as its own. What is in the physical file, and under which names, is decided in
// physical-config.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as topo from 'topojson-client';
import { topology } from 'topojson-server';
import { geoArea, geoContains, geoDistance, geoLength } from 'd3-geo';
import polylabel from 'polylabel';
import { norm, round, uniq } from './lib.mjs';
import * as P from './physical-config.mjs';
import { loadSpain } from './spain.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, '.cache/src');
const OUT = path.join(ROOT, 'public/data');
const R_KM = 6371.0088;
const SCALE = 1000; // coordinates are stored as whole thousandths of a degree

const report = [];
const warnings = [];
const say = (line) => {
  report.push(line);
  console.log(line);
};
const warn = (line) => {
  warnings.push(line);
  console.log(`WARN ${line}`);
};

const load = (name) => JSON.parse(fs.readFileSync(path.join(SRC, `${name}.geojson`), 'utf8')).features;
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(OUT, rel), 'utf8'));
const key = (s) => norm(s).replace(/ /g, '');

// ---------------------------------------------------------------------------
// Surfaces that no outline gives
// ---------------------------------------------------------------------------

const factbook = (name) => JSON.parse(fs.readFileSync(path.join(SRC, `factbook-${name}.json`), 'utf8'));
const plainText = (html) => String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const surfaceNotes = [];
let landmasses;

/**
 * The surface, in km², that The World Factbook gives an ocean or a landmass:
 *   "ocean:pacific"   the total on that ocean's own page, which counts its seas
 *   "land:Asia"       the entry of that name among the largest landmasses, on the page of the world;
 *                     "land:North America+South America" adds two of them
 * `drawn` is the surface of the outline, for the report.
 */
function surfaceOf(spec, what, drawn) {
  const [kind, name] = spec.split(':');
  let value = 0;
  if (kind === 'ocean') {
    // The key comes as "total " in the source, with a space after it.
    const total = Object.entries(factbook(name).Geography?.Area ?? {}).find(([k]) => k.trim() === 'total')?.[1]?.text;
    const m = /^([\d.]+) million sq km$/.exec(plainText(total));
    if (!m) return void warn(`${what}: the Factbook gives no surface of the ocean «${name}» that can be read (${JSON.stringify(total)})`);
    value = Math.round(Number(m[1]) * 1e6);
  } else if (kind === 'land') {
    if (!landmasses) {
      const text = plainText(factbook('world').Geography?.['Area - rankings']?.text);
      const list = /top ten largest landmasses: (.*?)(?= top ten |$)/.exec(text)?.[1] ?? '';
      landmasses = new Map(
        list
          .split(';')
          .map((part) => /^\s*(.+?) ([\d,]+) sq km\s*$/.exec(part))
          .filter(Boolean)
          .map((m) => [m[1], Number(m[2].replace(/,/g, ''))]),
      );
    }
    for (const part of name.split('+')) {
      if (!landmasses.has(part)) return void warn(`${what}: the Factbook lists no landmass called «${part}»`);
      value += landmasses.get(part);
    }
  } else return void warn(`${what}: no way to read the surface «${spec}»`);
  surfaceNotes.push(`${what} ${(value / 1e6).toFixed(3)} (the outline drawn, ${(drawn / 1e6).toFixed(3)})`);
  return value;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Douglas–Peucker on a list of [lon, lat], planar in degrees. */
function simplifyLine(pts, tol) {
  if (pts.length <= 2) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let d;
      if (len2 === 0) d = Math.hypot(px - ax, py - ay);
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      }
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst > tol) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** A closed ring is cut in two halves first, so that its start is not privileged; null when it collapses. */
function simplifyRing(ring, tol) {
  if (ring.length < 5) return ring.length === 4 ? ring.slice() : null;
  let far = 0;
  let best = -1;
  for (let i = 1; i < ring.length - 1; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
    if (d > best) {
      best = d;
      far = i;
    }
  }
  const a = simplifyLine(ring.slice(0, far + 1), tol);
  const b = simplifyLine(ring.slice(far), tol);
  const out = [...a, ...b.slice(1)];
  return out.length >= 4 ? out : null;
}

const planarArea = (ring) => {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(a / 2);
};

/** Longitudes made continuous, so that a ring that crosses the antimeridian can be measured on a plane. */
function unwrap(pts) {
  const out = [];
  let shift = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) {
      const d = pts[i][0] - pts[i - 1][0];
      if (d > 180) shift -= 360;
      else if (d < -180) shift += 360;
    }
    out.push([pts[i][0] + shift, pts[i][1]]);
  }
  return out;
}
const wrapLon = (x) => ((((x + 180) % 360) + 360) % 360) - 180;

const linesOf = (g) => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []);
const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);

function bboxOf(list) {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const pts of list)
    for (const p of pts) {
      if (p[0] < w) w = p[0];
      if (p[0] > e) e = p[0];
      if (p[1] < s) s = p[1];
      if (p[1] > n) n = p[1];
    }
  return [w, s, e, n];
}

/** Flat list of whole numbers: the first point, then the steps from each point to the next. */
function encode(pts) {
  const out = [];
  let px = 0;
  let py = 0;
  let first = true;
  for (const p of pts) {
    const x = Math.round(p[0] * SCALE);
    const y = Math.round(p[1] * SCALE);
    if (!first && x === px && y === py) continue;
    out.push(first ? x : x - px, first ? y : y - py);
    px = x;
    py = y;
    first = false;
  }
  return out;
}

const ll = (p) => [round(wrapLon(p[0]), 2), round(p[1], 2)];

/** A few points that say where the thing is: its extremes and some more along the way. */
function fitPoints(list) {
  const all = list.flatMap((pts) => unwrap(pts));
  if (!all.length) return [];
  const pick = new Set();
  const ext = [0, 0, 0, 0];
  all.forEach((p, i) => {
    if (p[0] < all[ext[0]][0]) ext[0] = i;
    if (p[0] > all[ext[1]][0]) ext[1] = i;
    if (p[1] < all[ext[2]][1]) ext[2] = i;
    if (p[1] > all[ext[3]][1]) ext[3] = i;
  });
  ext.forEach((i) => pick.add(i));
  const step = Math.max(1, Math.floor(all.length / 8));
  for (let i = 0; i < all.length; i += step) pick.add(i);
  return uniq([...pick].map((i) => ll(all[i]).join(','))).map((s) => s.split(',').map(Number));
}

// ---------------------------------------------------------------------------
// The countries, as the game draws them
// ---------------------------------------------------------------------------

const idx = readJson('index.json');
const countries = idx.countries.filter((c) => c.cl !== 'other');
const byA3 = new Map(countries.map((c) => [c.a3, c]));
const worldTopo = readJson('world.json');
const worldShapes = topo.feature(worldTopo, worldTopo.objects.c).features.map((f) => {
  const polys = polysOf(f.geometry);
  return { id: String(f.id), f, box: bboxOf(polys.map((p) => p[0])), rings: polys.map((p) => p[0]) };
});

const shapeOf = new Map(worldShapes.map((s) => [s.id, s]));
const inBox = (p, b, pad = 0) => p[0] >= b[0] - pad && p[0] <= b[2] + pad && p[1] >= b[1] - pad && p[1] <= b[3] + pad;
/** Squared distance in rough kilometres from a point to the nearest corner of some rings. */
function nearRings(p, rings) {
  const cos = Math.cos((p[1] * Math.PI) / 180);
  let best = Infinity;
  for (const ring of rings)
    for (const q of ring) {
      let dx = Math.abs(q[0] - p[0]);
      if (dx > 180) dx = 360 - dx;
      const d = (dx * cos) ** 2 + (q[1] - p[1]) ** 2;
      if (d < best) best = d;
    }
  return Math.sqrt(best) * 111.2;
}

function locate(p, shapes, maxKm) {
  for (const s of shapes) if (inBox(p, s.box) && geoContains(s.f, p)) return s;
  let best = null;
  let bestKm = maxKm;
  for (const s of shapes) {
    if (!inBox(p, s.box, 1.5)) continue;
    const km = nearRings(p, s.rings);
    if (km < bestKm) {
      bestKm = km;
      best = s;
    }
  }
  return best;
}

/** Distance in rough kilometres from a point to the outline of some rings, measured to their sides. */
function nearSides(p, rings) {
  const cos = Math.cos((p[1] * Math.PI) / 180);
  let best = Infinity;
  for (const ring of rings)
    for (let i = 0; i < ring.length - 1; i++) {
      const ax = (ring[i][0] - p[0]) * cos;
      const ay = ring[i][1] - p[1];
      const bx = (ring[i + 1][0] - p[0]) * cos;
      const by = ring[i + 1][1] - p[1];
      if (Math.abs(ax) > 20 && Math.abs(bx) > 20) continue;
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < best) best = d;
    }
  return best * 111.2;
}

/** The countries a point stands in, or within `km` of: both sides of a border, the shore of a lake. */
function countriesAt(p, km = 0) {
  const pad = km / 80;
  const out = [];
  for (const s of worldShapes) {
    if (!inBox(p, s.box, pad)) continue;
    if (geoContains(s.f, p) || (km > 0 && nearSides(p, s.rings) <= km)) out.push(s.id);
  }
  return out;
}

const inRingFlat = (p, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

// ---------------------------------------------------------------------------
// Physical features
// ---------------------------------------------------------------------------

const rivers = load('ne_10m_rivers_lake_centerlines');
const lakes = load('ne_10m_lakes');
const marine = load('ne_10m_geography_marine_polys');
const regions = load('ne_10m_geography_regions_polys');

const index = (features, field) => {
  const map = new Map();
  for (const f of features) {
    const name = f.properties[field];
    if (!name) continue;
    const k = key(name);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(f);
  }
  return map;
};
const riverByName = index(rivers, 'name');
const lakeByName = index(lakes, 'name');
const marineByName = index(marine, 'name');
const regionByName = index(regions, 'NAME');
const marine50ByName = index(load('ne_50m_geography_marine_polys'), 'name');

let atlas = null;
let landByCountry = null;
/** The Atlas Nacional de España, read the first time something asks for it. */
const spain = () => (atlas ??= loadSpain(SRC));
const asArea = (rings) => ({ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: rings.map((ring) => [ring]) } });

/**
 * Looks a source up by name. "Name@w,s,e,n" keeps only the pieces whose bounding box touches that box;
 * "Name#w,s,e,n" keeps the stretches of line inside the box and "Name!w,s,e,n" the ones outside it
 * (Natural Earth draws the Paraguay as one more stretch of the Paraná, for instance).
 */
function find(source, lookups, what) {
  if (Array.isArray(source)) {
    // An outline drawn by hand: closed here if the entry left it open.
    const last = source[source.length - 1];
    const ring = last[0] === source[0][0] && last[1] === source[0][1] ? source : [...source, source[0]];
    return [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }];
  }
  if (typeof source === 'object') {
    // The land between two heights, from the atlas of Spain.
    if (source.relief) {
      const rings = spain().relief(source.relief);
      if (!rings.length) warn(`${what}: no land between those heights in that box`);
      return rings.length ? [asArea(rings)] : [];
    }
    // The island of a country that a point stands on, as Natural Earth draws that country: the game's own
    // map of the world is too coarse for the smallest ones.
    if (source.land) {
      landByCountry ??= new Map(load('ne_10m_admin_0_countries_lakes').map((f) => [f.properties.ISO_A2_EH, polysOf(f.geometry).map((poly) => poly[0])]));
      const ring = landByCountry.get(source.land)?.find((r) => inRingFlat(source.at, r));
      if (!ring) warn(`${what}: no land of ${source.land} at ${source.at}`);
      return ring ? [asArea([ring])] : [];
    }
    // A stretch of the coast of a country, as the game draws it, closed across the neck of the peninsula.
    if (source.shore) {
      const rings = shapeOf.get(source.shore)?.rings ?? [];
      if (!rings.length) {
        warn(`${what}: the map has no country ${source.shore}`);
        return [];
      }
      const ring = rings.reduce((a, b) => (planarArea(b) > planarArea(a) ? b : a));
      const stretch = between(ring, source.a, source.b, source.by, what);
      return [asArea([[...stretch, stretch[0]]])];
    }
    warn(`${what}: a source that nothing knows how to read`);
    return [];
  }
  if (source.startsWith('agua:')) {
    const rings = spain().water(source.slice(5));
    if (!rings.length) warn(`${what}: the atlas of Spain has no water called "${source.slice(5)}"`);
    return rings.length ? [asArea(rings)] : [];
  }
  const m = source.match(/^(.*?)([@#!])(.+)$/);
  const name = m ? m[1] : source;
  const op = m?.[2];
  const box = m ? m[3].split(',').map(Number) : null;
  let found = [];
  for (const map of lookups) {
    // Some straits are only a speck in the detailed layer, there to carry a label: those do not count.
    found = (map.get(key(name)) ?? []).filter((f) => f.geometry.type.endsWith('LineString') || polysOf(f.geometry).some((p) => p[0].length > 5));
    if (found.length) break;
  }
  if (box && op === '@') {
    const [w, s, e, n] = box;
    found = found.filter((f) => {
      const b = bboxOf(f.geometry.type.endsWith('LineString') ? linesOf(f.geometry) : polysOf(f.geometry).map((p) => p[0]));
      return b[2] >= w && b[0] <= e && b[3] >= s && b[1] <= n;
    });
  } else if (box) {
    const [w, s, e, n] = box;
    const wanted = (p) => (p[0] >= w && p[0] <= e && p[1] >= s && p[1] <= n) === (op === '#');
    found = found
      .map((f) => {
        const parts = [];
        for (const line of linesOf(f.geometry)) {
          let run = [];
          for (const p of line) {
            if (wanted(p)) run.push(p);
            else {
              if (run.length > 1) parts.push(run);
              run = [];
            }
          }
          if (run.length > 1) parts.push(run);
        }
        return { ...f, geometry: { type: 'MultiLineString', coordinates: parts } };
      })
      .filter((f) => f.geometry.coordinates.length);
  }
  if (!found.length) warn(`${what}: nothing in Natural Earth is called "${source}"`);
  return found;
}

/** The corner of a ring nearest to a point. */
const nearest = (ring, p) => ring.reduce((best, q, i) => (Math.hypot(q[0] - p[0], q[1] - p[1]) < Math.hypot(ring[best][0] - p[0], ring[best][1] - p[1]) ? i : best), 0);
/**
 * The corners of a closed ring from the one nearest `a` to the one nearest `b`, going round the way that
 * passes by `by`, as places in the ring without its closing point.
 */
function stretchOf(ring, a, b, by, what) {
  const open = ring.slice(0, -1);
  const [ia, ib, ic] = [a, b, by].map((p) => nearest(open, p));
  const walk = (i, j) => {
    const out = [];
    for (let k = i; ; k = (k + 1) % open.length) {
      out.push(k);
      if (k === j) return out;
    }
  };
  const far = (p, q) => geoDistance(p, q) * R_KM;
  if (far(open[ia], a) > 15 || far(open[ib], b) > 15) warn(`${what}: the outline has no corner near where it should be cut`);
  return walk(ia, ib).includes(ic) ? walk(ia, ib) : walk(ib, ia).reverse();
}
const between = (ring, a, b, by, what) => stretchOf(ring, a, b, by, what).map((k) => ring[k]);

const features = [];
const usedIds = new Set();
/** What every feature carries whatever its kind: names, continents, rank and what the options of its entry say. */
const common = (kind, [es, en, cts, rank, , al = [], opts = {}]) => ({
  i: idFor(kind, en),
  // The five oceans are in the list of the seas, whose ids they have always had, and are a kind of their own.
  k: opts.kind ?? kind,
  n: { es, en },
  al: uniq(al.filter((a) => key(a) !== key(es) && key(a) !== key(en))),
  ct: cts.split(' '),
  r: rank,
  h: opts.h ? 1 : undefined,
  t: opts.t,
  // The countries it is asked in, when the entry says so; worked out from the map otherwise, below.
  co: opts.co == null ? undefined : opts.co.split(' ').filter(Boolean),
  given: opts.co != null,
});
function idFor(kind, en) {
  const base = `${kind[0]}:${norm(en).replace(/ /g, '-')}`;
  let id = base;
  for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
  usedIds.add(id);
  return id;
}

function addLines(kind, row) {
  const [es, , , , sources] = row;
  // A river of the atlas of Spain comes whole, by its codes; one of Natural Earth, in stretches by name.
  const codes = sources.filter((src) => typeof src === 'string' && src.startsWith('siane:')).map((src) => src.slice(6));
  let lines;
  let tol;
  if (codes.length) {
    const { lines: found, notes } = spain().river(codes);
    if (!found.length) return warn(`${kind} ${es}: the atlas of Spain has no river with the code ${codes.join(', ')}`);
    if (found.length > 1 || notes.gaps.length) warn(`${kind} ${es}: in ${found.length} pieces, with gaps of ${notes.gaps.join(', ')} km`);
    lines = found;
    // The atlas is drawn for a map of Spain alone: its bends are kept, down to half a kilometre.
    tol = 0.005;
  } else {
    const found = sources.flatMap((src) => find(src, [riverByName], `${kind} ${es}`));
    lines = found.flatMap((f) => linesOf(f.geometry)).filter((l) => l.length >= 2);
    if (!lines.length) return;
    const [w, s, e, n] = bboxOf(lines);
    const size = Math.max(e - w, n - s);
    tol = Math.max(0.004, Math.min(0.02, size / 500));
  }
  lines = lines.map((l) => simplifyLine(l, tol)).filter((l) => l.length >= 2);
  const longest = lines.reduce((a, b) => (geoLength({ type: 'LineString', coordinates: b }) > geoLength({ type: 'LineString', coordinates: a }) ? b : a));
  features.push({
    ...common(kind, row),
    lp: ll(longest[Math.floor(longest.length / 2)]),
    fp: fitPoints(lines),
    // A stretch shorter than the precision of the file collapses into a single point: it draws nothing.
    g: ['L', lines.map(encode).filter((flat) => flat.length >= 4)],
    points: lines.reduce((sum, l) => sum + l.length, 0),
    shape: lines,
  });
}

/** Long straight edges get points in between: on the globe a parallel is not the shortest way between its ends. */
function densify(ring, step = 4) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    if (i > 0) {
      const q = ring[i - 1];
      const n = Math.ceil(Math.abs(p[0] - q[0]) / step);
      for (let j = 1; j < n; j++) out.push([q[0] + ((p[0] - q[0]) * j) / n, q[1] + ((p[1] - q[1]) * j) / n]);
    }
    out.push(p);
  }
  return out;
}

/**
 * Areas keep their outer rings only (an island in a lake or in a sea is drawn by the land anyway), each one
 * as Natural Earth has it: cut at the antimeridian where it crosses it, which fills right and needs no sewing.
 */
/**
 * Rings as they are stored: simplified, without what is too small to be seen, with points along their long
 * straight sides and wound the way the map wants them.
 */
function tidy(rings, tol, least) {
  const out = [];
  for (const ring of rings) {
    if (planarArea(ring) < least) continue;
    const simple = tol ? simplifyRing(ring, tol) : ring;
    if (!simple) continue;
    const dense = densify(simple);
    if (geoArea({ type: 'Polygon', coordinates: [dense] }) > 2 * Math.PI) dense.reverse();
    out.push(dense);
  }
  return out;
}

/** How far the outline of an ocean with its seas may stray from the source's, in degrees: as much as a sea's. */
const OCEAN_TOL = 0.05;

/**
 * Natural Earth cuts at the antimeridian whatever crosses it, and unrolls into a strip whatever goes round a
 * pole: drawn like that, the cut shows as a line across the Pacific. Here the pieces are sewn back along it.
 *
 * Takes closed rings and returns loops whose longitudes run on past ±180 instead of jumping, so that they can
 * be measured and simplified on a plane. A loop that crosses the cut and comes back ends where it starts; one
 * that goes round a pole ends a whole turn from where it starts, which is the same place.
 */
function sewAtAntimeridian(rings, what) {
  // The source's cut is not quite at 180° on its western side, nor at quite the same latitudes on both.
  const onCut = (p) => Math.abs(p[0]) > 180 - 1e-3;
  const atPole = (p) => Math.abs(p[1]) > 90 - 1e-9;
  const loops = [];
  const chains = [];
  for (const ring of rings) {
    const pts = ring.slice(0, -1);
    const n = pts.length;
    // Side k runs from corner k to the next one: it is part of the cut when both ends lie on it.
    const cut = (k) => onCut(pts[k]) && onCut(pts[(k + 1) % n]) && Math.sign(pts[k][0]) === Math.sign(pts[(k + 1) % n][0]);
    const first = pts.findIndex((_, k) => cut(k));
    if (first < 0) {
      loops.push(ring);
      continue;
    }
    // What is left of the ring between two stretches of the cut, walked from the end of one of them.
    let run = null;
    for (let step = 1; step <= n; step++) {
      const k = (first + step) % n;
      if (cut(k)) {
        if (run) chains.push(run);
        run = null;
        continue;
      }
      run ??= [pts[k]];
      run.push(pts[(k + 1) % n]);
    }
  }
  // The pole of a strip is one place, however long the strip draws it.
  const open = chains.filter((chain) => !chain.every(atPole));
  const used = new Set();
  for (const start of open) {
    if (used.has(start)) continue;
    const loop = [];
    let shift = 0;
    let chain = start;
    for (;;) {
      used.add(chain);
      for (const [x, y] of loop.length ? chain.slice(1) : chain) loop.push([x + shift, y]);
      const last = chain[chain.length - 1];
      // It left by one edge of the plane and comes back in by the other, at the same latitude or very near it.
      const gap = (c) => (onCut(c[0]) && Math.sign(c[0][0]) === -Math.sign(last[0]) ? Math.abs(c[0][1] - last[1]) : Infinity);
      const next = open.reduce((best, c) => (gap(c) < gap(best) ? c : best));
      if (!onCut(last) || gap(next) > 0.25) {
        warn(`${what}: cut at the antimeridian, and its pieces do not meet again at ${last}`);
        return rings;
      }
      shift += last[0] > 0 ? 360 : -360;
      if (next === start) {
        // Back at the first corner, a whole number of turns away.
        loop[loop.length - 1] = [start[0][0] + shift, start[0][1]];
        break;
      }
      if (used.has(next)) {
        warn(`${what}: cut at the antimeridian, and two of its pieces go on into the same one at ${last}`);
        return rings;
      }
      chain = next;
    }
    loops.push(loop);
  }
  return loops;
}

function addAreas(kind, row, lookups, withArea) {
  const [es, , , , sources, , opts = {}] = row;
  const found = sources.flatMap((s) => find(s, lookups, `${kind} ${es}`));
  if (!found.length) return;
  const rings = found.flatMap((f) => polysOf(f.geometry).map((p) => p[0]));
  const [w, s, e, n] = bboxOf(rings);
  const size = Math.max(e - w, n - s);
  const cap = kind === 'sea' ? 0.05 : 0.03;
  const tol = Math.max(0.003, Math.min(cap, size / 500));
  const biggest = Math.max(...rings.map(planarArea));
  // Islets smaller than what the eye can see at this scale are dropped.
  const out = tidy(rings, tol, Math.max(tol * tol * 12, biggest * 0.002));
  if (!out.length) return warn(`${kind} ${es}: nothing left after simplifying`);
  out.sort((a, b) => planarArea(b) - planarArea(a));
  const span = bboxOf([out[0]]);
  if (opts.at && !out.some((ring) => inRingFlat(opts.at, ring))) warn(`${kind} ${es}: its name would be written outside it`);
  const pole = opts.at ?? polylabel([out[0]], Math.max(0.02, Math.max(span[2] - span[0], span[3] - span[1]) / 200));
  const wds = uniq(found.map((f) => f.properties.wikidataid ?? f.properties.WIKIDATAID).filter(Boolean));
  const geo = { type: 'MultiPolygon', coordinates: out.map((r) => [r]) };
  if (geoArea(geo) > 2 * Math.PI) warn(`${kind} ${es}: covers more than half the globe`);
  features.push({
    ...common(kind, row),
    wd: opts.wd !== '' && wds.length === 1 && found.length === 1 ? wds[0] : undefined,
    // A reservoir as the atlas of Spain draws it at its scale is a picture, not a measure: half as big again as it is.
    // An ocean is outlined without its seas: its surface is the one the books give it.
    ar:
      typeof opts.area === 'string'
        ? surfaceOf(opts.area, `${kind} ${es}`, Math.round(geoArea(geo) * R_KM * R_KM))
        : withArea && opts.area !== 0 && !sources.some((src) => typeof src === 'string' && src.startsWith('agua:'))
          ? Math.round(geoArea(geo) * R_KM * R_KM)
          : undefined,
    lp: ll([pole[0], pole[1]]),
    fp: fitPoints(out),
    g: ['A', out.map(encode)],
    points: out.reduce((sum, r) => sum + r.length, 0),
    shape: out,
  });
}

for (const row of P.SEAS) addAreas('sea', row, [marineByName, marine50ByName], true);
for (const row of P.DESERTS) addAreas('desert', row, [regionByName], false);
for (const row of P.RANGES) addAreas('range', row, [regionByName], false);
for (const row of P.PLAINS) addAreas('plain', row, [regionByName], false);
for (const row of P.PENINSULAS) addAreas('peninsula', row, [regionByName], false);
for (const row of P.ISLANDS) addAreas('island', row, [regionByName], true);
for (const row of P.LAKES) addAreas('lake', row, [lakeByName, marineByName], true);
for (const row of P.RIVERS) addLines('river', row);

// ---------------------------------------------------------------------------
// The oceans with their seas
// ---------------------------------------------------------------------------

/**
 * An ocean is outlined without its seas (`g`): on a map of seas every stretch of water is one piece, and the
 * Mediterranean is not the Atlantic. On the map of continents and oceans no sea is asked, and there a click on
 * the Caribbean has to find an ocean: `gw` is the ocean with all the water that is counted as its own.
 *
 * Which water that is comes from the page that gives the ocean its surface: The World Factbook lists the seas
 * that its figure includes. What it does not name («and other tributary water bodies») goes with the ocean it
 * shares the longest border with, round by round from the open ocean towards the land; so does what it splits
 * between two oceans («part of the Drake Passage»). Natural Earth's marine outlines share their borders corner
 * by corner, and merged they leave no seam.
 *
 * Seas are drawn under the land, which hides this outline wherever it follows a coast: the islands are left out
 * of it, and so is Antarctica, and what is seen of it is the lines where two oceans meet. It is one outline for
 * each ocean, sewn where the source cuts it at the antimeridian.
 */
const oceanNotes = [];
{
  const rows = P.SEAS.filter((row) => row[6]?.kind === 'ocean');
  // A reef is outlined over the sea it lies in, not beside it: merged with that sea, it would tear its border.
  const net = topology({ m: { type: 'FeatureCollection', features: marine.filter((f) => f.properties.featurecla !== 'reef') } });
  const geoms = net.objects.m.geometries;
  const touching = topo.neighbors(geoms);
  const nameOf = (i) => geoms[i].properties.name ?? '';
  const named = (name) => geoms.map((_, i) => i).filter((i) => key(nameOf(i)) === key(name));

  // How long a border two outlines share, in km: by the arcs both are made of.
  const arcKm = net.arcs.map((arc) => arc.reduce((sum, p, k) => (k ? sum + geoDistance(arc[k - 1], p) * R_KM : 0), 0));
  const arcsOf = geoms.map((g) => {
    const out = new Set();
    const walk = (a) => (typeof a[0] === 'number' ? a.forEach((k) => out.add(k < 0 ? ~k : k)) : a.forEach(walk));
    walk(g.arcs ?? []);
    return out;
  });
  const border = (i, j) => [...arcsOf[i]].reduce((sum, a) => (arcsOf[j].has(a) ? sum + arcKm[a] : sum), 0);

  // -1: in no ocean yet. The oceans themselves first…
  const of = new Array(geoms.length).fill(-1);
  rows.forEach((row, o) => {
    for (const src of row[4]) for (const i of named(src)) of[i] = o;
  });
  // …then what the Factbook counts with each of them…
  const told = new Map();
  rows.forEach((row, o) => {
    const note = plainText(factbook(row[6].area.split(':')[1]).Geography?.Area?.note);
    const list = /^note: includes (.+?),? and other tributary water bodies$/.exec(note)?.[1];
    if (!list) return void warn(`ocean ${row[0]}: the Factbook does not say which seas its surface includes (${JSON.stringify(note)})`);
    for (const part of list.split(/,\s*/)) {
      const [, shared, sea] = /^(part of the |a small part of the |almost all of the )?(.+)$/.exec(part.trim());
      const name = sea in P.OCEAN_SEA_NAMES ? P.OCEAN_SEA_NAMES[sea] : sea;
      const found = name ? named(name) : [];
      if (name && !found.length) warn(`ocean ${row[0]}: the Factbook counts «${sea}» with it, and Natural Earth outlines no sea of that name`);
      if (!shared) for (const i of found) told.set(i, o);
    }
  });
  // …and round by round what touches them: a sea the Factbook names waits until its own ocean reaches it.
  for (let round = 1; ; round++) {
    const next = [];
    geoms.forEach((_, i) => {
      if (of[i] >= 0) return;
      const shared = new Map();
      for (const j of touching[i]) if (of[j] >= 0) shared.set(of[j], (shared.get(of[j]) ?? 0) + border(i, j));
      if (!shared.size) return;
      const want = told.get(i);
      if (want != null && !shared.has(want)) return;
      const [first, second] = [...shared].sort((a, b) => b[1] - a[1]);
      next.push([i, want ?? first[0]]);
      // Worth a look in the report: what could have gone to another ocean.
      if (want == null && second && second[1] > first[1] / 4) oceanNotes.push(`${nameOf(i) || 'a sea without a name'} with ${rows[first[0]][1]} (${first[1].toFixed(0)} km of border, ${second[1].toFixed(0)} with ${rows[second[0]][1]})`);
    });
    if (!next.length) break;
    for (const [i, o] of next) of[i] = o;
  }
  for (const [i, o] of told) if (of[i] !== o) warn(`ocean ${rows[o][0]}: the Factbook counts «${nameOf(i)}» with it, and on the map it does not touch it`);
  const loose = uniq(geoms.map((_, i) => (of[i] < 0 ? nameOf(i) : '')).filter(Boolean));
  const wholeNotes = [];

  rows.forEach((row, o) => {
    const f = features.find((x) => x.k === 'ocean' && x.n.es === row[0]);
    if (!f) return void warn(`ocean ${row[0]}: not built, and so without its seas`);
    const members = geoms.filter((_, i) => of[i] === o);
    const rings = topo.merge(net, members).coordinates.map((poly) => poly[0]);
    // Outlines that overlap instead of meeting leave a border that does not close.
    for (const ring of rings) if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) warn(`ocean ${row[0]}: with its seas, an outline does not close at ${ring[0]}`);
    // One outline where Natural Earth has two halves or a strip: the cut would be drawn as a line across the water.
    const loops = sewAtAntimeridian(rings, `ocean ${row[0]}`);
    const round = (loop) => Math.abs(loop[loop.length - 1][0] - loop[0][0]) > 180;
    const biggest = Math.max(...loops.map((loop) => (round(loop) ? 0 : planarArea(loop))));
    const least = Math.max(OCEAN_TOL * OCEAN_TOL * 12, biggest * 0.002);
    const polygon = (ring) => ({ type: 'Polygon', coordinates: [ring] });
    let out = [];
    for (const loop of loops) {
      if (!round(loop) && planarArea(loop) < least) continue;
      const simple = round(loop) ? simplifyLine(loop, OCEAN_TOL) : simplifyRing(loop, OCEAN_TOL);
      if (!simple) continue;
      const ring = densify(simple).map(([x, y]) => [wrapLon(x), y]);
      ring[ring.length - 1] = ring[0].slice();
      // Of the two sides of a line round the globe, the ocean is the smaller.
      if (geoArea(polygon(ring)) > 2 * Math.PI) ring.reverse();
      out.push(ring);
    }
    // A coast inside the ocean is an island, or Antarctica: the land is drawn over it.
    out = out.filter((ring) => !out.some((other) => other !== ring && geoArea(polygon(other)) > geoArea(polygon(ring)) && geoContains(polygon(other), ring[0])));
    out.sort((a, b) => geoArea(polygon(b)) - geoArea(polygon(a)));
    const whole = { type: 'MultiPolygon', coordinates: out.map((r) => [r]) };
    if (!geoContains(whole, f.lp)) warn(`ocean ${row[0]}: with its seas, its name would be written outside it`);
    if (geoArea(whole) > 2 * Math.PI) warn(`ocean ${row[0]}: with its seas it covers more than half the globe`);
    // The water alone, sea by sea, to set beside the figure of the Factbook.
    const water = members.reduce((sum, g) => {
      const polys = polysOf(topo.feature(net, g).geometry);
      const side = (ring) => {
        const a = geoArea(polygon(densify(ring, 1)));
        return Math.min(a, 4 * Math.PI - a);
      };
      return sum + polys.reduce((part, poly) => part + side(poly[0]) - poly.slice(1).reduce((holes, hole) => holes + side(hole), 0), 0);
    }, 0);
    f.gw = ['A', out.map(encode)];
    const pts = out.reduce((sum, r) => sum + r.length, 0);
    f.points += pts;
    wholeNotes.push(`${row[1]}: ${members.length - row[4].length} seas, gulfs and straits; ${out.length} outline${out.length === 1 ? '' : 's'}, ${pts} points; ${((water * R_KM * R_KM) / 1e6).toFixed(1)} million km² of water as the source draws it (${(f.ar / 1e6).toFixed(1)} in the Factbook)`);
  });
  oceanNotes.unshift(...wholeNotes);
  oceanNotes.push(`in no ocean: ${loose.join(', ') || 'nothing'}`);
}

// ---------------------------------------------------------------------------
// Continents
// ---------------------------------------------------------------------------

/**
 * A continent is its mainland as Natural Earth outlines it, which settles where Europe ends and Asia begins,
 * and every island of the game's own map, each one as the map draws it and with the continent of its
 * country, or with the one that `ISLANDS_OF` gives it. Natural Earth draws islands too, in less detail and
 * not all of them: only the biggest piece of each of its outlines is taken, which is the mainland.
 */
/** How far the stored outline may stray from the one drawn, in degrees: as for any other area. */
const CONTINENT_TOL = 0.03;
/** Islands smaller than this, in square degrees, are in no continent: a click could hardly find them. */
const CONTINENT_ISLAND = 0.02;
/** An island is simplified to a sixtieth of its size, and never more than the mainland. */
const ISLAND_FINE = 60;
{
  const rows = P.CONTINENTS;
  const biggest = (rings) => rings.reduce((a, b) => (planarArea(b) > planarArea(a) ? b : a));
  const main = rows.map((row) => row[4].flatMap((src) => find(src, [regionByName], `continent ${row[0]}`)).map((f) => biggest(polysOf(f.geometry).map((p) => p[0]))));
  const at = (code) => rows.findIndex((row) => row[2] === code);

  // What Natural Earth outlines with one continent and belongs to another: the stretch of coast between two
  // corners is taken from the first and given to the second as a piece of its own.
  for (const { from, to, a, b, by, what } of P.CONTINENT_MOVES) {
    const rings = main[at(from)];
    const ring = rings.reduce((best, r) => (Math.hypot(r[nearest(r, by)][0] - by[0], r[nearest(r, by)][1] - by[1]) < Math.hypot(best[nearest(best, by)][0] - by[0], best[nearest(best, by)][1] - by[1]) ? r : best));
    // The ring is closed: without its last point, which is its first again, it can be walked round and round.
    const open = ring.slice(0, -1);
    const chain = stretchOf(ring, a, b, by, `continents, ${what}`);
    const gone = new Set(chain.slice(1, -1));
    const rest = open.filter((_, k) => !gone.has(k));
    rings[rings.indexOf(ring)] = [...rest, rest[0]];
    // …without the corners that already lie inside the continent it goes to, which Natural Earth draws twice:
    // its Africa reaches into the Negev, and its Asia begins at the border. There the piece follows the outline
    // of that continent instead, corner by corner, so that the two meet.
    const host = main[at(to)].reduce((best, r) => (planarArea(r) > planarArea(best) ? r : best)).slice(0, -1);
    const piece = [];
    let skipped = false;
    for (const k of chain) {
      const q = open[k];
      if (inRingFlat(q, host)) {
        skipped = true;
        continue;
      }
      if (skipped && piece.length) {
        const i = nearest(host, piece[piece.length - 1]);
        const j = nearest(host, q);
        const ahead = (j - i + host.length) % host.length;
        const step = ahead <= host.length - ahead ? 1 : host.length - 1;
        for (let h = i; ; h = (h + step) % host.length) {
          piece.push(host[h]);
          if (h === j) break;
        }
      }
      skipped = false;
      piece.push(q);
    }
    main[at(to)].push([...piece, piece[0]]);
    say(`  continents: ${what} goes from ${from} to ${to}, ${piece.length} points of the outline`);
  }

  // The islands: whatever land the map draws outside those outlines.
  const boxes = main.map((rings) => rings.map((r) => bboxOf([r])));
  const outlined = (p) => main.some((rings, i) => rings.some((r, j) => inBox(p, boxes[i][j]) && inRingFlat(p, r)));
  const ctOf = new Map(idx.countries.map((c) => [c.id, c.ct]));
  const extra = rows.map(() => []);
  let nowhere = 0;
  for (const c of worldShapes)
    for (const raw of c.rings) {
      const jumps = raw.reduce((n, p, i) => n + (i > 0 && Math.abs(p[0] - raw[i - 1][0]) > 180 ? 1 : 0), 0);
      // Antarctica goes round the pole: its outline is no island.
      if (jumps % 2) continue;
      const ring = jumps ? unwrap(raw) : raw;
      if (ring.length < 4 || planarArea(ring) < CONTINENT_ISLAND) continue;
      const spot = polylabel([ring], 0.02);
      const p = [wrapLon(spot[0]), spot[1]];
      if (outlined(p)) continue;
      const rule = P.ISLANDS_OF.find(([id, box]) => id === c.id && (!box || inBox(p, box)));
      const code = rule ? rule[2] : ctOf.get(c.id);
      const i = code ? at(code) : -1;
      if (i < 0) {
        nowhere++;
        continue;
      }
      extra[i].push(ring);
    }

  // Where two continents meet, Natural Earth gives both outlines the same corners, and both have to keep the
  // same ones: simplified each on its own, one keeps what the other drops and a sliver that is nobody's opens
  // along the Urals. So a corner is kept in every outline it is in unless it is one more of a line they walk
  // together, with the same corner before it and the same one after; and what lies between two corners that
  // are kept is simplified by itself, which gives the same line from either side.
  const cornerKey = (p) => `${p[0]},${p[1]}`;
  const seenIn = new Map();
  main.forEach((rings, i) =>
    rings.forEach((ring, j) => {
      const n = ring.length - 1;
      for (let k = 0; k < n; k++) {
        const key = cornerKey(ring[k]);
        if (!seenIn.has(key)) seenIn.set(key, []);
        seenIn.get(key).push({ ring: `${i}/${j}`, around: [cornerKey(ring[(k + n - 1) % n]), cornerKey(ring[(k + 1) % n])].sort().join(' ') });
      }
    }),
  );
  let joints = 0;
  let together = 0;
  function simplifyJoined(ring, tol) {
    const open = ring.slice(0, -1);
    const n = open.length;
    const fixed = [];
    for (let k = 0; k < n; k++) {
      const at = seenIn.get(cornerKey(open[k]));
      if (at.length < 2) continue;
      // Twice in one outline, or with other corners around it in the other: a place where two lines part.
      if (new Set(at.map((o) => o.ring)).size < at.length || at.some((o) => o.around !== at[0].around)) fixed.push(k);
      else together++;
    }
    joints += fixed.length;
    if (fixed.length < 2) return simplifyRing(ring, tol);
    const out = [];
    fixed.forEach((from, f) => {
      const to = fixed[(f + 1) % fixed.length];
      const stretch = [];
      for (let k = from; ; k = (k + 1) % n) {
        stretch.push(open[k]);
        if (k === to) break;
      }
      out.push(...simplifyLine(stretch, tol).slice(0, -1));
    });
    out.push(out[0]);
    return out.length >= 4 ? out : null;
  }

  rows.forEach((row, i) => {
    const [es, , , , , , opts = {}] = row;
    const rings = main[i];
    if (!rings.length) return;
    // One tolerance for them all, or two neighbours would not keep the same corners.
    const tol = CONTINENT_TOL;
    // The islands are the ones the map draws, so that a click on one falls on it: each simplified in step with
    // its size, the big ones like the mainland and the small ones hardly at all.
    const mainland = tidy(rings.map((ring) => simplifyJoined(ring, tol)).filter(Boolean), 0, 0);
    const islands = extra[i].flatMap((ring) => {
      const [iw, is, ie, inn] = bboxOf([ring]);
      return tidy([ring], Math.max(0.004, Math.min(tol, Math.max(ie - iw, inn - is) / ISLAND_FINE)), 0);
    });
    const out = [...mainland, ...islands];
    out.sort((a, b) => planarArea(b) - planarArea(a));
    const span = bboxOf([out[0]]);
    if (opts.at && !out.some((ring) => inRingFlat(opts.at, ring))) warn(`continent ${es}: its name would be written outside it`);
    const pole = opts.at ?? polylabel([out[0]], Math.max(0.02, Math.max(span[2] - span[0], span[3] - span[1]) / 200));
    // Ring by ring: the one of Antarctica goes round the pole, and as a single shape it would have no inside.
    const drawn = Math.round(out.reduce((sum, r) => sum + Math.min(geoArea({ type: 'Polygon', coordinates: [r] }), 4 * Math.PI - geoArea({ type: 'Polygon', coordinates: [r] })), 0) * R_KM * R_KM);
    if (opts.area === 'outline') surfaceNotes.push(`continent ${es} ${(drawn / 1e6).toFixed(3)} (its outline: the Factbook has none)`);
    features.push({
      ...common('continent', row),
      ar: opts.area === 'outline' ? drawn : typeof opts.area === 'string' ? surfaceOf(opts.area, `continent ${es}`, drawn) : undefined,
      lp: ll([pole[0], pole[1]]),
      fp: fitPoints(out),
      g: ['A', out.map(encode)],
      points: out.reduce((sum, r) => sum + r.length, 0),
      shape: out,
    });
    const pts = (list) => list.reduce((sum, r) => sum + r.length, 0);
    say(`  continent ${es}: ${mainland.length} outlines of Natural Earth (${pts(mainland)} points) and ${islands.length} islands of the map (${pts(islands)} points)`);
  });
  say(`  continents: ${nowhere} islands of the map are in none`);
  say(`  continents: where two meet, ${joints} corners are kept in both and ${together} more are simplified as one line`);
}

// Peaks and volcanoes are points: place, height and Wikidata id come from Natural Earth's elevation points.
const peakByName = index(
  load('ne_10m_geography_regions_elevation_points').filter((f) => f.properties.featurecla === 'mountain'),
  'name',
);
/** The one point of a layer with that name: "Name", or "Name@w,s,e,n" where several share it. */
function pointNamed(byName, source, what) {
  const m = source.match(/^(.*?)@(.+)$/);
  const name = m ? m[1] : source;
  let found = byName.get(key(name)) ?? [];
  if (m) {
    const [w, s, e, n] = m[2].split(',').map(Number);
    found = found.filter((f) => {
      const [x, y] = f.geometry.coordinates;
      return x >= w && x <= e && y >= s && y <= n;
    });
  }
  if (found.length !== 1) return warn(`${what}: ${found.length} points in Natural Earth are called "${source}"`);
  return found[0];
}
function addPeak(row) {
  const [es, , , , sources] = row;
  const f = pointNamed(peakByName, sources[0], `peak ${es}`);
  if (!f) return;
  const at = ll(f.geometry.coordinates);
  const el = Math.round(f.properties.elevation);
  if (!(el > 0)) return warn(`peak ${es}: no height`);
  features.push({ ...common('peak', row), wd: f.properties.wikidataid || undefined, el, lp: at, fp: [at], points: 1 });
}
for (const row of P.PEAKS) addPeak(row);

const capeNotes = [];
const fallNotes = [];
/** A cape is the corner of the coast of a country that reaches farthest one way inside a box. */
const TOWARDS = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0], NE: [1, 1], NW: [-1, 1], SE: [1, -1], SW: [-1, -1] };
const labelled = load('ne_10m_geography_regions_points');
const capeByName = index(labelled.filter((f) => f.properties.featurecla === 'cape'), 'name');
const fallByName = index(labelled.filter((f) => f.properties.featurecla === 'waterfall'), 'name');
/** The corner of the coast, as the game draws it, nearest to a point and no farther than `maxKm`. */
function coastNear(p, maxKm) {
  let best = null;
  let bestKm = maxKm;
  for (const c of worldShapes) {
    if (!inBox(p, c.box, 1)) continue;
    for (const ring of c.rings)
      for (const q of ring) {
        if (Math.abs(q[1] - p[1]) > 1) continue;
        const km = geoDistance(p, q) * R_KM;
        if (km < bestKm) {
          bestKm = km;
          best = q;
        }
      }
  }
  return best && { at: best, km: bestKm };
}
function addCape(row) {
  const [es, , , , [source]] = row;
  if (typeof source === 'string') {
    // A cape of the world: Natural Earth says where it is. Where the coast that the game draws has a corner
    // right there, the dot is put on it; otherwise it stays where the source has it, which is on a straight
    // stretch of that coast or on an islet that the map does not draw.
    const f = pointNamed(capeByName, source, `cape ${es}`);
    if (!f) return;
    const tip = coastNear(f.geometry.coordinates, 6);
    const at = ll(tip ? tip.at : f.geometry.coordinates);
    capeNotes.push(`${es} ${tip ? `${tip.km.toFixed(0)} km` : `as the source has it, ${Math.round(Math.min(...worldShapes.filter((c) => inBox(f.geometry.coordinates, c.box, 2)).map((c) => nearSides(f.geometry.coordinates, c.rings))))} km from the coast`}`);
    features.push({ ...common('cape', row), wd: f.properties.wikidataid || undefined, lp: at, fp: [at], points: 1 });
    return;
  }
  const { coast, to } = source;
  // A headland that Natural Earth draws instead of marking: its whole outline is searched.
  const headland = source.tip ? find(source.tip, [regionByName], `cape ${es}`) : null;
  const [w, s, e, n] = source.box ?? [-180, -90, 180, 90];
  const [dx, dy] = TOWARDS[to];
  let tip = null;
  let far = -Infinity;
  for (const ring of headland ? headland.flatMap((f) => polysOf(f.geometry).map((poly) => poly[0])) : (shapeOf.get(coast)?.rings ?? []))
    for (const p of ring) {
      if (p[0] < w || p[0] > e || p[1] < s || p[1] > n) continue;
      const reach = p[0] * dx * Math.cos((p[1] * Math.PI) / 180) + p[1] * dy;
      if (reach > far) {
        far = reach;
        tip = p;
      }
    }
  if (!tip) return warn(`cape ${es}: the coast of ${coast ?? source.tip} has no corner in that box`);
  const at = ll(tip);
  // A cape of the points layer that the layer has beside the cape: it says which one it is, not where.
  const known = source.named ? pointNamed(capeByName, source.named, `cape ${es}`) : null;
  if (known) capeNotes.push(`${es} by the corner of the coast, ${Math.round(geoDistance(known.geometry.coordinates, tip) * R_KM)} km from the point of the source`);
  features.push({ ...common('cape', row), wd: (known?.properties.wikidataid ?? headland?.[0]?.properties.WIKIDATAID) || undefined, lp: at, fp: [at], points: 1 });
}
for (const row of P.CAPES) addCape(row);

/** Waterfalls are points too, from the same layer as the capes of the world. */
for (const row of P.FALLS) {
  const f = pointNamed(fallByName, row[4][0], `fall ${row[0]}`);
  if (!f) continue;
  // Where the entry says so, the falls are put where they are and not where the source writes their name.
  const given = row[6]?.at;
  const at = ll(given ?? f.geometry.coordinates);
  if (given) fallNotes.push(`${row[0]} placed by hand, ${Math.round(geoDistance(f.geometry.coordinates, given) * R_KM)} km from the point of the source`);
  features.push({ ...common('fall', row), wd: f.properties.wikidataid || undefined, lp: at, fp: [at], points: 1 });
}

// Two dots too close together would be one: on the map of a continent for the peaks asked there, on the
// map of a country for the rest.
for (const kind of ['peak', 'cape', 'fall']) {
  const dots = features.filter((f) => f.k === kind);
  for (let i = 0; i < dots.length; i++)
    for (let j = i + 1; j < dots.length; j++) {
      const km = geoDistance(dots[i].lp, dots[j].lp) * R_KM;
      if (km < (dots[i].r < 3 && dots[j].r < 3 ? 55 : 12)) warn(`${kind}s ${dots[i].n.es} and ${dots[j].n.es} are ${Math.round(km)} km apart`);
    }
}

// ---------------------------------------------------------------------------
// The countries of each feature
// ---------------------------------------------------------------------------

/** Points every `km` or so along some lines. */
function along(lines, km) {
  const out = [];
  for (const line of lines) {
    let left = 0;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      const len = geoDistance(a, b) * R_KM;
      for (let at = left; at < len; at += km) out.push([a[0] + ((b[0] - a[0]) * at) / len, a[1] + ((b[1] - a[1]) * at) / len]);
      left = (((left - len) % km) + km) % km;
    }
  }
  return out;
}

/**
 * Points in a grid inside some rings (no holes: an island in a lake is a detail here), and what each one stands
 * for in km². A long thin shape that crosses its box from corner to corner catches few points of a grid made
 * for the box (the plain that runs from France to the Urals caught forty, and none in Poland): the grid is
 * made finer until some two hundred fall inside.
 */
function within(rings, least = 200) {
  const [w, s, e, n] = bboxOf(rings);
  for (let side = 22; ; side *= 2) {
    const step = Math.max((e - w) / side, (n - s) / side, 0.02);
    const out = [];
    for (let y = s + step / 2; y < n; y += step) for (let x = w + step / 2; x < e; x += step) if (rings.some((ring) => inRingFlat([x, y], ring))) out.push([x, y]);
    if (out.length >= least || side >= 176 || step <= 0.02) return { points: out, cell: step * step * 111.2 * 111.2 * Math.cos((((s + n) / 2) * Math.PI) / 180) };
  }
}

const areaOf = new Map(countries.map((c) => [c.id, c.ar]));
/** For the report: which countries hold each plain and each peninsula, and how much of each it covers. */
const holdNotes = [];
/** Share of the tally each country has. */
const shares = (tally) => {
  const total = [...tally.values()].reduce((a, b) => a + b, 0) || 1;
  return [...tally].map(([id, n]) => ({ id, n, share: n / total })).sort((a, b) => b.n - a.n);
};
const count = (tally, ids) => {
  for (const id of ids) tally.set(id, (tally.get(id) ?? 0) + 1);
};

/**
 * A river belongs to the countries that have a tenth of its course or 150 km of it, both banks of a border
 * counting; a range, a desert or an island, to those that hold a tenth of it or that it covers a seventh of;
 * a lake, to those with a tenth of its shore; a peak or a cape, to the country it stands in and to any other
 * within 4 km, which is as fine as the borders of the map are. A sea, to every country with coast on it.
 */
function countriesOf(f) {
  const tally = new Map();
  if (f.k === 'peak' || f.k === 'cape' || f.k === 'fall') {
    // A cape left at sea, on an islet the map does not draw, is of the country whose coast is nearest.
    const near = countriesAt(f.lp, f.k === 'cape' ? 12 : f.k === 'fall' ? 5 : 4);
    return near.length || f.k !== 'cape' ? near : countriesAt(f.lp, 60);
  }
  if (f.k === 'river') {
    const step = 8;
    for (const p of along(f.shape, step)) count(tally, countriesAt(p, 3));
    return shares(tally)
      .filter((c) => c.share >= 0.1 || c.n * step >= 150)
      .map((c) => c.id);
  }
  if (f.k === 'lake') {
    for (const p of along(f.shape, 6)) count(tally, countriesAt(p, 8));
    return shares(tally)
      .filter((c) => c.share >= 0.1)
      .map((c) => c.id);
  }
  if (f.k === 'sea' || f.k === 'ocean') {
    const [w, s, e, n] = bboxOf(f.shape);
    const out = [];
    // Two corners of the coast have to be on it, or one where the sea is a strait or a bay with room for no more.
    const small = Math.max(e - w, n - s) < 2;
    const need = small ? 1 : 2;
    for (const c of worldShapes) {
      if (c.box[2] < w - 0.3 || c.box[0] > e + 0.3 || c.box[3] < s - 0.3 || c.box[1] > n + 0.3) continue;
      // A corner of the coast is on this sea if the water a dozen kilometres off it, on any side, is this sea's.
      let hits = 0;
      for (const ring of c.rings)
        for (let i = 0; i < ring.length && hits < need; i += small ? 1 : 2) {
          const p = ring[i];
          if (p[0] < w - 0.2 || p[0] > e + 0.2 || p[1] < s - 0.2 || p[1] > n + 0.2) continue;
          const dx = 0.12 / Math.max(0.2, Math.cos((p[1] * Math.PI) / 180));
          const around = [p, [p[0] + dx, p[1]], [p[0] - dx, p[1]], [p[0], p[1] + 0.12], [p[0], p[1] - 0.12]];
          if (around.some((q) => f.shape.some((ring2) => inRingFlat(q, ring2)) && !geoContains(c.f, q))) hits++;
        }
      if (hits >= need) out.push(c.id);
    }
    return out;
  }
  const { points, cell } = within(f.shape);
  for (const p of points) count(tally, countriesAt(p));
  const cover = (c) => (c.n * cell) / (areaOf.get(c.id) || Infinity);
  // A peninsula or a plain that is nearly the whole of a country says nothing on the map of that country:
  // the Iberian Peninsula is not asked in Spain, nor the Arabian in Saudi Arabia.
  const whole = f.k === 'peninsula' || f.k === 'plain' ? 0.8 : Infinity;
  // …and a peninsula is of the countries that hold a quarter of it: the Yucatán is Mexico's, not Belize's.
  const part = f.k === 'peninsula' ? (c) => c.share >= 0.25 : (c) => c.share >= 0.1 || cover(c) >= 0.14;
  if (Number.isFinite(whole))
    holdNotes.push(
      `${f.n.es}: ${shares(tally)
        .filter((c) => c.share >= 0.05 || cover(c) >= 0.14)
        .map((c) => `${c.id} ${Math.round(c.share * 100)} % of it, ${Math.round(cover(c) * 100)} % of the country${part(c) && cover(c) < whole ? '' : ' (out)'}`)
        .join(' · ')}`,
    );
  return shares(tally)
    .filter((c) => part(c) && cover(c) < whole)
    .map((c) => c.id);
}
for (const f of features) {
  if (!f.given) f.co = countriesOf(f).sort();
  // What is only asked on the map of its country has to have one.
  if (f.r === 3 && !f.co.length) warn(`${f.k} ${f.n.es}: only for the map of its country, and it stands in none`);
}

const kinds = ['continent', 'ocean', 'sea', 'river', 'lake', 'range', 'plain', 'peninsula', 'peak', 'desert', 'island', 'cape', 'fall'];
say('Physical features');
for (const k of kinds) {
  const list = features.filter((f) => f.k === k);
  const basic = list.filter((f) => f.r === 1).length;
  const home = list.filter((f) => f.r === 3).length;
  const pts = list.reduce((sum, f) => sum + f.points, 0);
  const byCt = {};
  for (const f of list) for (const c of f.ct) byCt[c] = (byCt[c] ?? 0) + 1;
  say(`  ${k.padEnd(9)} ${String(list.length).padStart(3)} (${basic} basic, ${home} only on the map of their country) · ${pts} points · ${Object.entries(byCt).map(([c, n]) => `${c} ${n}`).join(', ')}`);
}
say(`  capes of the world, and how far the dot was moved to stand on the coast: ${capeNotes.join(' · ')}`);
if (fallNotes.length) say(`  waterfalls: ${fallNotes.join(' · ')}`);
say(`  surfaces from The World Factbook, in millions of km²: ${surfaceNotes.join(' · ')}`);
say(`  oceans with their seas:\n    ${oceanNotes.join('\n    ')}`);
say(`  plains and peninsulas by country:\n    ${holdNotes.join('\n    ')}`);
{
  // Countries with something to ask on a map of their own.
  const per = new Map();
  for (const f of features) for (const c of f.co ?? []) per.set(c, (per.get(c) ?? 0) + 1);
  const list = [...per].sort((a, b) => b[1] - a[1]);
  say(`  countries with 5 features or more: ${list.filter((x) => x[1] >= 5).length} · the fullest: ${list.slice(0, 12).map(([c, n]) => `${c} ${n}`).join(', ')}`);
}
const physical = {
  v: 1,
  scale: SCALE,
  f: features.map(({ points, shape, given, ...f }) => {
    for (const k of Object.keys(f)) if (f[k] == null || (Array.isArray(f[k]) && !f[k].length)) delete f[k];
    return f;
  }),
};
const physicalText = JSON.stringify(physical);
fs.writeFileSync(path.join(OUT, 'physical.json'), physicalText);
say(`  physical.json ${(physicalText.length / 1024).toFixed(0)} kB, ${features.length} features`);

// ---------------------------------------------------------------------------
// Cities
// ---------------------------------------------------------------------------

const SPANISH = new Set('ES MX AR CO PE CL VE EC BO PY UY CU DO GT HN SV NI CR PA PR GQ'.split(' '));
/** 3 = capital of the country · 2 = its other capital, where there are two · 1 = capital of a region */
const KEEP = { 'Admin-0 capital': 3, 'Admin-0 capital alt': 2, 'Admin-1 capital': 1, 'Admin-1 region capital': 1, 'Admin-0 region capital': 1, 'Populated place': 0, 'Populated Place': 0 };
const PER_COUNTRY = 60;

const places = load('ne_10m_populated_places');
const regionCache = new Map();
function regionOf(id) {
  if (!regionCache.has(id)) {
    const file = path.join(OUT, 'r', `${id}.json`);
    if (!fs.existsSync(file)) regionCache.set(id, null);
    else {
      const t = JSON.parse(fs.readFileSync(file, 'utf8'));
      const fine = topo.feature(t, t.objects.f).features.map((f) => {
        const polys = polysOf(f.geometry);
        return { id: String(f.id), f, p: f.properties, box: bboxOf(polys.map((q) => q[0])), rings: polys.map((q) => q[0]) };
      });
      const groups = {};
      for (const lv of ['g1', 'g2']) if (t.objects[lv]) groups[lv] = t.objects[lv].geometries.map((g) => ({ id: String(g.id), p: g.properties }));
      regionCache.set(id, { fine, groups });
    }
  }
  return regionCache.get(id);
}

const byCountry = new Map();
const cityFixed = new Set();
const SCHOLARLY = /[āēīōūġḥṭṣḍẓḳčšʿʾ]/i;
let unplaced = 0;
let unitless = 0;
for (const pl of places) {
  const p = pl.properties;
  const cls = KEEP[p.FEATURECLA];
  if (cls == null) continue;
  const at = pl.geometry.coordinates;
  if (P.CITY_DROP.has(`${p.NAME}|${p.ADM1NAME}`)) continue;
  // The country Natural Earth names is believed when the city is in it or at its door (Melilla falls just
  // outside the simplified outline of Spain); otherwise the map decides, as overseas territories are countries here.
  const forced = P.CITY_COUNTRY[`${p.NAME}|${p.ADM0_A3}`];
  const named = forced ? countries.find((c) => c.id === forced) : byA3.get(p.ADM0_A3);
  if (forced && !named) warn(`cities: no country ${forced} for ${p.NAME}`);
  const home = named && shapeOf.get(named.id);
  let country = home && ((inBox(at, home.box) && geoContains(home.f, at)) || nearRings(at, home.rings) < 40) ? named : null;
  if (!country) {
    const shape = locate(at, worldShapes, 60);
    country = shape ? countries.find((c) => c.id === shape.id) : null;
  }
  if (!country) {
    unplaced++;
    continue;
  }
  const region = regionOf(country.id);
  const unit = region ? locate(at, region.fine.filter((u) => u.p.q !== 0), 80) : null;
  if (region && !unit) unitless++;
  const local = String(p.NAME ?? '').trim();
  const fixKey = `${p.NAME}|${p.ADM0_A3}`;
  const fix = P.CITY_FIX[fixKey] ?? {};
  if (P.CITY_FIX[fixKey]) cityFixed.add(fixKey);
  const en = fix.en ?? (String(p.NAME_EN ?? '').trim() || local);
  let esRaw = fix.es ?? (String(p.NAME_ES ?? '').trim() || local);
  // A scholarly transliteration («Herāt», «Šibarġan», «Al-Kāf») is not how a map in Spanish spells things:
  // the plain spelling is the one the English label has. It stays as a name that is accepted.
  const scholarly = !fix.es && SCHOLARLY.test(esRaw) && !SCHOLARLY.test(en) ? esRaw : null;
  if (scholarly) esRaw = en;
  // Wikidata gives the long official name ("Puebla de Zaragoza", "San Miguel de Tucumán"); where Spanish is
  // spoken, the short one everybody uses is Natural Earth's own.
  let es = esRaw;
  if (SPANISH.has(country.id) && key(local) !== key(esRaw) && key(esRaw).includes(key(local)) && key(local).length >= 4) es = local;
  if (P.CITY_NAMES[local]) es = P.CITY_NAMES[local];
  const al = uniq([esRaw, local, en, ...(fix.al ?? []), scholarly].map((x) => String(x ?? '').trim()).filter((x) => x && key(x) !== key(es)));
  const city = {
    i: `c${Number(p.NE_ID).toString(36)}`,
    n: en && en !== es ? { es, en } : { es },
    ll: [round(at[0], 3), round(at[1], 3)],
    // Natural Earth writes -99 where it has no figure.
    p: Math.max(0, Math.round(p.POP_MAX || 0)),
    k: cls,
    u: unit?.id,
    wd: p.WIKIDATAID || undefined,
    al: al.filter((a) => key(a) !== key(en)).slice(0, 3),
    raw: { cls: p.FEATURECLA, adm1: p.ADM1NAME, name: local, ascii: String(p.NAMEASCII ?? '').trim() },
    at,
  };
  if (!byCountry.has(country.id)) byCountry.set(country.id, []);
  byCountry.get(country.id).push(city);
}

for (const k of Object.keys(P.CITY_FIX)) if (!cityFixed.has(k)) warn(`CITY_FIX: Natural Earth has no city "${k}"`);

// Natural Earth lists a few places twice, and gives a few others the identity of a bigger city of the
// same country: its Wikidata id and its names (Pyongsan appears as Pyongyang, Maradi as Niamey in English).
let twice = 0;
let renamed = 0;
for (const [id, all] of byCountry) {
  const byWd = new Map();
  const gone = new Set();
  for (const x of [...all].sort((a, b) => b.k - a.k || b.p - a.p)) {
    if (!x.wd) continue;
    const first = byWd.get(x.wd);
    if (!first) byWd.set(x.wd, x);
    else if (geoDistance(first.at, x.at) * R_KM < 30) {
      // The same id a stone's throw away: the same place. The better record stays.
      gone.add(x);
      twice++;
    } else {
      // The same id far away: another place under a borrowed name. Its own is the one the map calls it by.
      x.n = { es: x.raw.name };
      x.al = [];
      x.wd = undefined;
      renamed++;
    }
  }
  const list = all.filter((x) => !gone.has(x));
  byCountry.set(id, list);
  // A name in English, or an alias, that is really the name of another city of the country.
  const main = new Map(list.map((x) => [key(x.n.es), x]));
  for (const x of list) {
    const taken = (name) => {
      const other = main.get(key(name));
      return !!other && other !== x;
    };
    if (x.n.en && taken(x.n.en)) {
      const own = [x.raw.name, x.raw.ascii].find((name) => name && !taken(name)) ?? x.n.es;
      x.n = key(own) !== key(x.n.es) ? { es: x.n.es, en: own } : { es: x.n.es };
      renamed++;
    }
    x.al = x.al.filter((a) => !taken(a) && key(a) !== key(x.n.en ?? ''));
  }
}

// The capital of a country is called what the countries section calls it.
const capNotes = [];
for (const c of countries) {
  const list = byCountry.get(c.id);
  if (!list || !c.cap) continue;
  const caps = list.filter((x) => x.k >= 2).sort((a, b) => b.k - a.k);
  const names = [c.cap.es, c.cap.en].filter(Boolean).map(key);
  const called = (x) => names.includes(key(x.n.es)) || names.includes(key(x.n.en ?? '')) || x.al.some((a) => names.includes(key(a)));
  // By name first: among the capitals Natural Earth marks, then among every city (Cayenne is the capital
  // of a region of France there). Only then by place, and only a marked capital or a city on the very spot:
  // the nearest town is somebody else (Koror is not Ngerulmud, nor Pointe-à-Pitre Basse-Terre).
  const kmTo = (x) => geoDistance(x.ll, c.cap.ll) * R_KM;
  const nearestOf = (pool, max) => (c.cap.ll ? pool.filter((x) => kmTo(x) < max).sort((a, b) => kmTo(a) - kmTo(b))[0] : undefined);
  let hit = caps.find(called) ?? list.find(called);
  if (!hit) {
    hit = nearestOf(caps, 35) ?? nearestOf(list, 6);
    if (hit) capNotes.push(`${c.id}: «${c.cap.es}» given to ${hit.n.es} (k${hit.k}), ${Math.round(kmTo(hit))} km away`);
  }
  if (!hit) {
    if (list.length) capNotes.push(`${c.id}: no city for «${c.cap.es}»`);
    continue;
  }
  if (key(hit.n.es) !== key(c.cap.es)) hit.al = uniq([hit.n.es, ...hit.al]).slice(0, 3);
  hit.n = c.cap.en && c.cap.en !== c.cap.es ? { es: c.cap.es, en: c.cap.en } : { es: c.cap.es };
  for (const x of list) if (x.k === 3 && x !== hit) x.k = 2;
  hit.k = 3;
}

// Two cities of one country with the same name: the smaller one says where it is.
for (const list of byCountry.values()) {
  const seen = new Map();
  for (const x of [...list].sort((a, b) => b.k - a.k || b.p - a.p)) {
    const k = key(x.n.es);
    if (seen.has(k) && x.raw.adm1) {
      x.al = uniq([x.n.es, ...x.al]).slice(0, 3);
      x.n = { es: `${x.n.es} (${x.raw.adm1})`, ...(x.n.en ? { en: `${x.n.en} (${x.raw.adm1})` } : {}) };
    } else seen.set(k, x);
  }
}

// Capitals of regions: the level of each country whose units have, nearly all of them, one marked capital.
const regionCaps = {};
const capReport = [];
const several = [];
for (const c of countries) {
  const region = regionOf(c.id);
  const list = byCountry.get(c.id) ?? [];
  const manual = P.REGION_CAPITALS[c.id] ?? {};
  if (!region || P.REGION_CAPITALS_SKIP.has(c.id)) continue;
  for (const lv of c.lv) {
    const units =
      lv.k === 'f'
        ? region.fine.filter((u) => u.p.q !== 0).map((u) => ({ id: u.id, p: u.p, members: [u.id] }))
        : (region.groups[lv.k] ?? []).filter((g) => g.p.q !== 0).map((g) => ({ id: g.id, p: g.p, members: g.p.m ?? [] }));
    if (units.length < 2) continue;
    const out = {};
    if (manual[lv.k]) {
      const table = manual[lv.k];
      for (const u of units) {
        const names = [u.id, u.p.n.es, u.p.n.en, u.p.n.lo, ...(u.p.al ?? [])].filter(Boolean).map(key);
        const hit = Object.keys(table).find((k) => names.includes(key(k)));
        if (hit) out[u.id] = table[hit];
        else warn(`capitals ${c.id}/${lv.k}: no hand-written capital for ${u.p.n.es}`);
      }
      capReport.push(`${c.id}/${lv.k}: ${Object.keys(out).length}/${units.length} by hand`);
    } else {
      let marked = 0;
      let withCap = 0;
      for (const u of units) {
        const members = new Set(u.members);
        const inside = list.filter((x) => x.u && members.has(x.u));
        let caps = inside.filter((x) => x.k === 1);
        marked += caps.length;
        if (!caps.length) caps = inside.filter((x) => x.k === 3);
        if (!caps.length) continue;
        withCap++;
        // Several marked in one region: the biggest, and its names alone (the others are other cities).
        caps.sort((a, b) => b.p - a.p);
        const top = caps[0];
        if (caps.length > 1) several.push(`${c.id}/${lv.k} ${u.id} ${u.p.n.es}: ${caps.map((x) => `${x.n.es} (${Math.round(x.p / 1000)}k)`).join(', ')}`);
        out[u.id] = uniq([top.n.es, top.n.en, ...top.al].filter(Boolean)).slice(0, 5);
      }
      const coverage = withCap / units.length;
      const excess = marked / Math.max(1, withCap);
      const ok = coverage >= 0.7 && excess <= 1.25;
      capReport.push(`${c.id}/${lv.k}: ${withCap}/${units.length} units, ${marked} marked${ok ? '' : ' → skipped'}`);
      if (!ok) continue;
    }
    // What Natural Earth marks wrongly, put right by hand; `null` takes a capital out.
    for (const [id, names] of Object.entries(P.REGION_CAPITAL_FIXES[c.id]?.[lv.k] ?? {})) {
      if (!units.some((u) => u.id === id)) warn(`capital fixes ${c.id}/${lv.k}: there is no unit ${id}`);
      else if (names) out[id] = names;
      else delete out[id];
    }
    if (Object.keys(out).length >= 2) (regionCaps[c.id] ??= {})[lv.k] = out;
  }
}

// What each of those capitals is called in English, where that is not the name the table shows: in English
// the game shows «The Hague» and not «La Haya». It is the English label of the city the table names, which
// Natural Earth has for most; those it does not have, or has wrong, are written by hand in the settings.
const regionCapsEn = {};
const capEnReport = [];
for (const c of countries) {
  const list = byCountry.get(c.id) ?? [];
  const region = regionOf(c.id);
  const byHand = P.REGION_CAPITAL_EN[c.id] ?? {};
  for (const [lv, table] of Object.entries(regionCaps[c.id] ?? {})) {
    for (const [id, names] of Object.entries(table)) {
      const shown = names[0];
      let en = byHand[shown];
      // Where Spanish is spoken the name is the same in both languages, but for the few that English has
      // a name of its own for (Seville, Havana): the label there is the long official one, or a slip.
      if (en === undefined && !SPANISH.has(c.id)) {
        const members = lv === 'f' ? [id] : (region?.groups[lv]?.find((g) => g.id === id)?.p.m ?? []);
        const k = key(shown);
        const hits = list.filter((x) => key(x.n.es) === k || key(x.n.en ?? '') === k || x.al.some((a) => key(a) === k));
        // The one inside the region; failing that, the only city of the country that goes by the name.
        const city = hits.find((x) => members.includes(x.u)) ?? (hits.length === 1 ? hits[0] : undefined);
        en = city ? (city.n.en ?? city.n.es) : undefined;
        // A capital with several names and no city to say which of them is the English one: for whoever reads the report.
        if (!city && names.length > 1) capEnReport.push(`${c.id}/${lv} ${id}: no city for «${shown}» (${names.slice(1).join(', ')})`);
      }
      if (en && en !== shown) (((regionCapsEn[c.id] ??= {})[lv] ??= {})[id] = en);
    }
  }
}
for (const [id, table] of Object.entries(P.REGION_CAPITAL_EN)) {
  const shown = new Set(Object.values(regionCaps[id] ?? {}).flatMap((t) => Object.values(t).map((names) => names[0])));
  for (const name of Object.keys(table)) if (!shown.has(name)) warn(`REGION_CAPITAL_EN ${id}: no region has «${name}» for a capital`);
}

// The cities say the same as that table. Where the capitals of a country's regions are known, a city is
// marked as one because the table names it, not because Natural Earth does: the mark comes off the former
// seats and big towns (Kitakyushu, Onitsha, Niterói) and goes on the capitals it had missed (Lelystad).
// The regions meant are the larger ones where a country has two levels: communities, not provinces.
let capsMarked = 0;
let capsUnmarked = 0;
for (const c of countries) {
  const list = byCountry.get(c.id);
  const region = regionOf(c.id);
  const lv = ['g1', 'g2', 'f'].find((k) => regionCaps[c.id]?.[k]);
  if (!lv || !list || !region) continue;
  const called = (x, keys) => keys.includes(key(x.n.es)) || keys.includes(key(x.n.en ?? '')) || x.al.some((a) => keys.includes(key(a)));
  const real = new Set();
  /** Fine units that belong to a region whose capital is known. */
  const covered = new Set();
  for (const [id, names] of Object.entries(regionCaps[c.id][lv])) {
    const members = lv === 'f' ? [id] : (region.groups[lv]?.find((g) => g.id === id)?.p.m ?? []);
    for (const m of members) covered.add(m);
    const hits = list.filter((x) => called(x, names.map(key)));
    const inside = hits.filter((x) => members.includes(x.u));
    if (inside.length) {
      // More than one where two cities share the role, and each has its name in the list.
      for (const x of inside) real.add(x);
      continue;
    }
    // Just across a simplified outline (Viedma, on the far bank from its province): the nearest namesake.
    const rings = region.fine.filter((u) => members.includes(u.id)).flatMap((u) => u.rings);
    const nearby = hits.map((x) => [nearRings(x.at, rings), x]).filter(([d]) => d < 40).sort((p, q) => p[0] - q[0])[0];
    if (nearby) real.add(nearby[1]);
  }
  for (const x of list) {
    if (real.has(x)) {
      if (x.k < 1) {
        x.k = 1;
        capsMarked++;
      }
    } else if (x.k === 1 && covered.has(x.u)) {
      x.k = 0;
      capsUnmarked++;
    }
  }
}

// Only the biggest cities of each country and the capitals are kept.
const cityOut = {};
let kept = 0;
for (const c of countries) {
  const list = (byCountry.get(c.id) ?? []).sort((a, b) => b.p - a.p);
  if (!list.length) continue;
  // A place with no known population cannot be among the largest; it stays only if it is a capital.
  const top = new Set(list.filter((x) => x.p > 0).slice(0, PER_COUNTRY));
  const out = list.filter((x) => top.has(x) || x.k > 0);
  cityOut[c.id] = out.map(({ raw, at, ...x }) => {
    for (const k of Object.keys(x)) if (x[k] == null || (Array.isArray(x[k]) && !x[k].length)) delete x[k];
    // Most cities are no capital of anything: the mark is kept only where it says something.
    if (!x.k) delete x.k;
    return x;
  });
  kept += out.length;
}
const citiesText = JSON.stringify({ v: 1, c: cityOut });
fs.writeFileSync(path.join(OUT, 'cities.json'), citiesText);
// On its own, because the capitals game of the regions section needs nothing else.
// `en`: the name in English of the capitals that have another one, with the same keys as `rc`.
const capitalsText = JSON.stringify({ v: 1, rc: regionCaps, en: regionCapsEn });
fs.writeFileSync(path.join(OUT, 'capitals.json'), capitalsText);

say('Cities');
say(`  ${kept} cities in ${Object.keys(cityOut).length} countries (${unplaced} outside every country, ${unitless} outside every region) · cities.json ${(citiesText.length / 1024).toFixed(0)} kB`);
const counts = Object.values(cityOut).map((l) => l.length);
say(`  countries with ≥ 5 cities: ${counts.filter((n) => n >= 5).length} · ≥ 10: ${counts.filter((n) => n >= 10).length} · ≥ 25: ${counts.filter((n) => n >= 25).length}`);
const levels = Object.values(regionCaps).reduce((n, o) => n + Object.keys(o).length, 0);
const capUnits = Object.values(regionCaps).reduce((n, o) => n + Object.values(o).reduce((m, t) => m + Object.keys(t).length, 0), 0);
say(`  ${twice} places listed twice were merged · ${renamed} names that belonged to another city were put right`);
say(`  capitals of regions among the cities: ${capsMarked} marked that Natural Earth had not, ${capsUnmarked} unmarked that are not one`);
say(`  capitals of regions: ${Object.keys(regionCaps).length} countries, ${levels} levels, ${capUnits} regions · capitals.json ${(capitalsText.length / 1024).toFixed(0)} kB`);
const capEn = Object.values(regionCapsEn).reduce((n, o) => n + Object.values(o).reduce((m, t) => m + Object.keys(t).length, 0), 0);
say(`  of them, ${capEn} go by another name in English`);

fs.mkdirSync(path.join(ROOT, '.cache'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.cache/physical-report.txt'), [...report, '', 'National capitals named by their place, not their name', ...capNotes, '', 'Capitals of regions, level by level', ...capReport, '', 'Regions with several marked capitals (the first is taken)', ...several, '', 'Capitals of regions with several names and no city to tell the English one by', ...capEnReport, '', `Warnings: ${warnings.length}`, ...warnings].join('\n'));
say(`${warnings.length} warnings · report in .cache/physical-report.txt`);
