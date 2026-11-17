// Builds the data of the cities and physical geography sections:
//
//   public/data/physical.json   rivers, lakes, seas, ranges, peaks, deserts and islands that can be asked
//   public/data/cities.json     cities of every country
//   public/data/capitals.json   capitals of the regions of every country that has them marked
//
//   npm run data:fetch && npm run data:physical
//
// It reads the Natural Earth layers in .cache/src and the files that `data:build` has already written
// (index.json, world.json, r/<ID>.json), which say which region every city belongs to. What is in the
// physical file, and under which names, is decided in physical-config.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as topo from 'topojson-client';
import { geoArea, geoContains, geoDistance, geoLength } from 'd3-geo';
import polylabel from 'polylabel';
import { norm, round, uniq } from './lib.mjs';
import * as P from './physical-config.mjs';

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

/**
 * Looks a source up by name. "Name@w,s,e,n" keeps only the pieces whose bounding box touches that box;
 * "Name#w,s,e,n" keeps the stretches of line inside the box and "Name!w,s,e,n" the ones outside it
 * (Natural Earth draws the Paraguay as one more stretch of the Paraná, for instance).
 */
function find(source, lookups, what) {
  if (Array.isArray(source)) return [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [source] } }];
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

const features = [];
const usedIds = new Set();
function idFor(kind, en) {
  const base = `${kind[0]}:${norm(en).replace(/ /g, '-')}`;
  let id = base;
  for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
  usedIds.add(id);
  return id;
}

function addLines(kind, [es, en, cts, rank, sources, al = []]) {
  const found = sources.flatMap((s) => find(s, [riverByName], `${kind} ${es}`));
  let lines = found.flatMap((f) => linesOf(f.geometry)).filter((l) => l.length >= 2);
  if (!lines.length) return;
  const [w, s, e, n] = bboxOf(lines);
  const size = Math.max(e - w, n - s);
  const tol = Math.max(0.004, Math.min(0.02, size / 500));
  lines = lines.map((l) => simplifyLine(l, tol)).filter((l) => l.length >= 2);
  const longest = lines.reduce((a, b) => (geoLength({ type: 'LineString', coordinates: b }) > geoLength({ type: 'LineString', coordinates: a }) ? b : a));
  features.push({
    i: idFor(kind, en),
    k: kind,
    n: { es, en },
    al: uniq(al.filter((a) => key(a) !== key(es) && key(a) !== key(en))),
    ct: cts.split(' '),
    r: rank,
    lp: ll(longest[Math.floor(longest.length / 2)]),
    fp: fitPoints(lines),
    // A stretch shorter than the precision of the file collapses into a single point: it draws nothing.
    g: ['L', lines.map(encode).filter((flat) => flat.length >= 4)],
    points: lines.reduce((sum, l) => sum + l.length, 0),
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
function addAreas(kind, [es, en, cts, rank, sources, al = []], lookups, withArea) {
  const found = sources.flatMap((s) => find(s, lookups, `${kind} ${es}`));
  if (!found.length) return;
  const rings = found.flatMap((f) => polysOf(f.geometry).map((p) => p[0]));
  const [w, s, e, n] = bboxOf(rings);
  const size = Math.max(e - w, n - s);
  const cap = kind === 'sea' ? 0.05 : 0.03;
  const tol = Math.max(0.003, Math.min(cap, size / 500));
  const biggest = Math.max(...rings.map(planarArea));
  const out = [];
  for (const ring of rings) {
    // Islets smaller than what the eye can see at this scale are dropped.
    if (planarArea(ring) < Math.max(tol * tol * 12, biggest * 0.002)) continue;
    const simple = simplifyRing(ring, tol);
    if (!simple) continue;
    const dense = densify(simple);
    if (geoArea({ type: 'Polygon', coordinates: [dense] }) > 2 * Math.PI) dense.reverse();
    out.push(dense);
  }
  if (!out.length) return warn(`${kind} ${es}: nothing left after simplifying`);
  out.sort((a, b) => planarArea(b) - planarArea(a));
  const span = bboxOf([out[0]]);
  const pole = polylabel([out[0]], Math.max(0.02, Math.max(span[2] - span[0], span[3] - span[1]) / 200));
  const wds = uniq(found.map((f) => f.properties.wikidataid ?? f.properties.WIKIDATAID).filter(Boolean));
  const geo = { type: 'MultiPolygon', coordinates: out.map((r) => [r]) };
  if (geoArea(geo) > 2 * Math.PI) warn(`${kind} ${es}: covers more than half the globe`);
  features.push({
    i: idFor(kind, en),
    k: kind,
    n: { es, en },
    al: uniq(al.filter((a) => key(a) !== key(es) && key(a) !== key(en))),
    ct: cts.split(' '),
    r: rank,
    wd: wds.length === 1 && found.length === 1 ? wds[0] : undefined,
    ar: withArea ? Math.round(geoArea(geo) * R_KM * R_KM) : undefined,
    lp: ll([pole[0], pole[1]]),
    fp: fitPoints(out),
    g: ['A', out.map(encode)],
    points: out.reduce((sum, r) => sum + r.length, 0),
  });
}

for (const row of P.SEAS) addAreas('sea', row, [marineByName, marine50ByName], true);
for (const row of P.DESERTS) addAreas('desert', row, [regionByName], false);
for (const row of P.RANGES) addAreas('range', row, [regionByName], false);
for (const row of P.ISLANDS) addAreas('island', row, [regionByName], true);
for (const row of P.LAKES) addAreas('lake', row, [lakeByName, marineByName], true);
for (const row of P.RIVERS) addLines('river', row);

// Peaks and volcanoes are points: place, height and Wikidata id come from Natural Earth's elevation points.
const peakByName = index(
  load('ne_10m_geography_regions_elevation_points').filter((f) => f.properties.featurecla === 'mountain'),
  'name',
);
function addPeak([es, en, cts, rank, sources, al = []]) {
  const m = sources[0].match(/^(.*?)@(.+)$/);
  const name = m ? m[1] : sources[0];
  let found = peakByName.get(key(name)) ?? [];
  if (m) {
    const [w, s, e, n] = m[2].split(',').map(Number);
    found = found.filter((f) => {
      const [x, y] = f.geometry.coordinates;
      return x >= w && x <= e && y >= s && y <= n;
    });
  }
  if (found.length !== 1) return warn(`peak ${es}: ${found.length} mountains in Natural Earth are called "${sources[0]}"`);
  const f = found[0];
  const at = ll(f.geometry.coordinates);
  const el = Math.round(f.properties.elevation);
  if (!(el > 0)) return warn(`peak ${es}: no height`);
  features.push({
    i: idFor('peak', en),
    k: 'peak',
    n: { es, en },
    al: uniq(al.filter((a) => key(a) !== key(es) && key(a) !== key(en))),
    ct: cts.split(' '),
    r: rank,
    wd: f.properties.wikidataid || undefined,
    el,
    lp: at,
    fp: [at],
    points: 1,
  });
}
for (const row of P.PEAKS) addPeak(row);
// Two peaks too close together would be one dot on the map of a continent.
{
  const peaks = features.filter((f) => f.k === 'peak');
  for (let i = 0; i < peaks.length; i++)
    for (let j = i + 1; j < peaks.length; j++) {
      const km = geoDistance(peaks[i].lp, peaks[j].lp) * R_KM;
      if (km < 55) warn(`peaks ${peaks[i].n.es} and ${peaks[j].n.es} are ${Math.round(km)} km apart`);
    }
}

const kinds = ['river', 'lake', 'sea', 'range', 'peak', 'desert', 'island'];
say('Physical features');
for (const k of kinds) {
  const list = features.filter((f) => f.k === k);
  const basic = list.filter((f) => f.r === 1).length;
  const pts = list.reduce((sum, f) => sum + f.points, 0);
  const byCt = {};
  for (const f of list) for (const c of f.ct) byCt[c] = (byCt[c] ?? 0) + 1;
  say(`  ${k.padEnd(7)} ${String(list.length).padStart(3)} (${basic} basic) · ${pts} points · ${Object.entries(byCt).map(([c, n]) => `${c} ${n}`).join(', ')}`);
}
const physical = {
  v: 1,
  scale: SCALE,
  f: features.map(({ points, ...f }) => {
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
const capitalsText = JSON.stringify({ v: 1, rc: regionCaps });
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

fs.mkdirSync(path.join(ROOT, '.cache'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.cache/physical-report.txt'), [...report, '', 'National capitals named by their place, not their name', ...capNotes, '', 'Capitals of regions, level by level', ...capReport, '', 'Regions with several marked capitals (the first is taken)', ...several, '', `Warnings: ${warnings.length}`, ...warnings].join('\n'));
say(`${warnings.length} warnings · report in .cache/physical-report.txt`);
