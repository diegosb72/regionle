// Builds the game's map data from the cached sources.
//
//   npm run data:build        (after `npm run data:fetch`)
//
// Output (public/data):
//   index.json     every country/territory: names, class, continent, population,
//                  area, capital, neighbours, label + fit points, available levels
//   world.json     TopoJSON of country shapes (country-level games and backdrop)
//   r/<ID>.json    TopoJSON of one country's subdivisions, one object per level
//
// Besides the data it leaves two things to read in .cache: report.txt, what was built, and names.json,
// where each name came from (what the source said of every unit, and which of it was believed).
//
// The whole thing runs on ONE topology of Natural Earth's admin-1 polygons, so
// that every border is a shared arc: countries are dissolved from their own
// subdivisions, neighbours come from shared arcs, and simplification keeps
// adjacent files vertex-identical along their common borders.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as topoServer from 'topojson-server';
import * as topo from 'topojson-client';
import { presimplify, sphericalTriangleArea } from 'topojson-simplify';
import { geoArea, geoCentroid, geoAzimuthalEqualArea, geoLength } from 'd3-geo';
import { geoStitch } from 'd3-geo-projection';
import polylabel from 'polylabel';
import * as C from './config.mjs';
import { norm, slug, similar, translates, cleanEs, cleanEn, cleanLocal, dropKind, shoelace, pointInRing, round, uniq } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, '.cache/src');
const OUT = path.join(ROOT, 'public/data');
const REPORT = path.join(ROOT, '.cache/report.txt');
const NAMES = path.join(ROOT, '.cache/names.json');

// --- tuning ----------------------------------------------------------------
const K_REGION = +(process.env.K_REGION || 2.5e5); // subdivision files: tolerance = country land area / K
const K_UNIT = +(process.env.K_UNIT || 4000); //   …but never coarser than unit area / K (keeps tiny units shapely)
const K_WORLD = +(process.env.K_WORLD || 4e4); // world file: tolerance = country land area / K
const RING_K = 6; // islands/lakes smaller than RING_K tolerances are dropped
const SEA_KM = 40; // max width of a strait that still counts as a crossing
const R_KM = 6371.0088;
const SR_KM2 = R_KM * R_KM;
const RAD = Math.PI / 180;

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s]`, ...a);
const report = [];
const note = (s) => report.push(s);
const warn = (s) => {
  console.warn('  ! ' + s);
  report.push('WARN ' + s);
};
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
const abs = (a) => (a < 0 ? ~a : a);

// ===========================================================================
// 1. Load
// ===========================================================================
const adm1 = readJson('ne_10m_admin_1_states_provinces_lakes.geojson').features;
const adm1Solid = readJson('ne_10m_admin_1_states_provinces.geojson').features;
const adm0 = readJson('ne_10m_admin_0_countries_lakes.geojson').features;
const mapUnits = readJson('ne_10m_admin_0_map_units.geojson').features;
const disputed = readJson('ne_10m_admin_0_disputed_areas.geojson').features;
const places = readJson('ne_10m_populated_places.geojson').features;
const geonames = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/data/static/geonames-countries.json'), 'utf8')).countries;
log(`loaded ${adm1.length} admin-1 units, ${adm0.length} admin-0 units`);

const a0ByA3 = new Map(adm0.map((f) => [f.properties.ADM0_A3, f.properties]));
const iso2OfA3 = (a3) => {
  const v = a0ByA3.get(a3)?.ISO_A2_EH;
  return v && v !== '-99' ? v : null;
};

// ===========================================================================
// 2. Raw units → entity + id, with curated repairs
// ===========================================================================
const validIso = (s) => /^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(s || '');

/** @type {{idx:number,p:any,geometry:any,entity:string,id:string,area:number,nonQuiz:boolean,into?:string}[]} */
const raws = [];
const fixesUsed = new Set();
for (const f of adm1) {
  const p = { ...f.properties };
  for (const [match, patch] of C.RECODE) if (match(p)) Object.assign(p, patch);
  // Attributes the source has wrong, put right by the code that never changes (see config.SOURCE_FIX).
  const fix = C.SOURCE_FIX[f.properties.adm1_code];
  if (fix) {
    Object.assign(p, fix);
    fixesUsed.add(f.properties.adm1_code);
  }
  let entity = C.splitEntity(p);
  if (entity === undefined) entity = p.adm0_a3 in C.A3_TO_ENTITY ? C.A3_TO_ENTITY[p.adm0_a3] : iso2OfA3(p.adm0_a3);
  if (!entity) {
    if (!(p.adm0_a3 in C.A3_TO_ENTITY) && C.splitEntity(p) !== null) warn(`no entity for ${p.adm0_a3} ${p.name}`);
    continue;
  }
  raws.push({ idx: raws.length, p, geometry: f.geometry, entity, id: '', area: 0, nonQuiz: C.NON_QUIZ.some((fn) => fn(p)) });
}
for (const code of Object.keys(C.SOURCE_FIX)) if (!fixesUsed.has(code)) warn(`SOURCE_FIX: no feature has the code ${code}`);
// Land that no admin-1 polygon covers: the undefined Chile–Argentina border zone.
{
  const spi = adm0.find((f) => f.properties.ADM0_A3 === 'SPI');
  raws.push({
    idx: raws.length,
    p: { adm0_a3: 'SPI', adm1_code: 'SPI-1', iso_3166_2: 'X2-SPI', name: 'Campo de Hielo Patagónico Sur', name_es: 'Campo de Hielo Patagónico Sur', name_en: 'Southern Patagonian Ice Field', wikidataid: 'Q1031467', type_en: null },
    geometry: spi.geometry,
    entity: 'X2',
    id: '',
    area: 0,
    nonQuiz: true,
  });
}

// Antimeridian: Natural Earth cuts polygons at ±180°. Stitch them back so the
// seam is not drawn as a border when the map is centred on the Pacific.
let stitched = 0;
for (const r of raws) {
  let touches = false;
  const scan = (c) => {
    if (typeof c[0] === 'number') {
      if (Math.abs(c[0]) > 179.9999) touches = true;
    } else for (const x of c) scan(x);
  };
  scan(r.geometry.coordinates);
  if (touches) {
    r.geometry = geoStitch({ type: 'Feature', properties: {}, geometry: r.geometry }).geometry;
    stitched++;
  }
}
for (const r of raws) r.area = geoArea({ type: 'Feature', geometry: r.geometry });
log(`${raws.length} units kept, ${stitched} stitched across the antimeridian`);

// ids
{
  const taken = new Set();
  const fallback = (r) => {
    const digits = String(r.p.adm1_code || '').replace(/\D/g, '') || '0';
    let id = `${r.entity}-x${digits}`;
    for (let k = 2; taken.has(id); k++) id = `${r.entity}-x${digits}_${k}`;
    return id;
  };
  const byIso = new Map();
  for (const r of raws) {
    if (!validIso(r.p.iso_3166_2)) continue;
    if (!byIso.has(r.p.iso_3166_2)) byIso.set(r.p.iso_3166_2, []);
    byIso.get(r.p.iso_3166_2).push(r);
  }
  for (const r of raws) {
    const iso = r.p.iso_3166_2;
    if (validIso(iso)) {
      const dup = byIso.get(iso).length > 1;
      r.id = dup && C.NO_ISO_MERGE.has(r.entity) ? fallback(r) : iso;
    } else r.id = fallback(r);
    taken.add(r.id);
  }
}

/**
 * Final units. `members` are raw polygons dissolved together; `main` supplies
 * the attributes.
 * @type {Map<string, any>}
 */
const units = new Map();
for (const r of raws) {
  if (!units.has(r.id)) units.set(r.id, { id: r.id, entity: r.entity, members: [], main: null, nonQuiz: false, plus: [], minus: null });
  units.get(r.id).members.push(r);
}
// explicit merges
for (const r of raws) {
  for (const [match, target] of C.MERGE_INTO) if (match(r.p)) r.into = target;
  if (!r.p.name && !r.into) r.into = '~nearest';
}
const centroidOf = (r) => geoCentroid({ type: 'Feature', geometry: r.geometry });
const sphDist = (a, b) => {
  const s = Math.sin(a[1] * RAD) * Math.sin(b[1] * RAD) + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.cos((a[0] - b[0]) * RAD);
  return Math.acos(Math.max(-1, Math.min(1, s)));
};
for (const r of raws) {
  if (!r.into) continue;
  let target = r.into;
  if (target === '~nearest') {
    const c = centroidOf(r);
    let best = null;
    for (const o of raws) {
      if (o === r || o.entity !== r.entity || o.into || !o.p.name) continue;
      const d = sphDist(c, centroidOf(o));
      if (!best || d < best.d) best = { d, id: o.id };
    }
    target = best?.id;
  }
  if (!target || !units.has(target) || target === r.id) {
    if (r.p.name) warn(`merge target ${r.into} missing for ${r.id} ${r.p.name}`);
    continue; // stays as its own unit (named after its country below)
  }
  const own = units.get(r.id);
  own.members = own.members.filter((m) => m !== r);
  if (!own.members.length) units.delete(r.id);
  units.get(target).members.push(r);
  r.merged = true;
}
for (const u of units.values()) {
  const own = u.members.filter((m) => !m.merged);
  u.main = (own.length ? own : u.members).reduce((a, b) => (b.area > a.area ? b : a));
  u.nonQuiz = u.members.every((m) => m.nonQuiz);
}

// Claims: move a disputed polygon between units (see config.CLAIMS).
const extras = [];
for (const claim of C.CLAIMS) {
  const f = disputed.find((d) => claim.match(d.properties));
  if (!f) {
    warn(`claim polygon not found: ${claim.name}`);
    continue;
  }
  const x = extras.push(f) - 1;
  const [first, ...rest] = claim.from;
  const base = units.get(first);
  for (const id of rest) {
    const o = units.get(id);
    if (!o) continue;
    base.members.push(...o.members);
    units.delete(id);
  }
  base.minus = x;
  base.special = true;
  const to = units.get(claim.to);
  to.plus.push(x);
  to.special = true;
}
log(`${units.size} final units in ${new Set([...units.values()].map((u) => u.entity)).size} entities`);

// ===========================================================================
// 3. One topology for everything
// ===========================================================================
const T = topoServer.topology(
  {
    u: { type: 'FeatureCollection', features: raws.map((r) => ({ type: 'Feature', properties: {}, geometry: r.geometry })) },
    x: { type: 'FeatureCollection', features: extras.map((f) => ({ type: 'Feature', properties: {}, geometry: f.geometry })) },
  },
  1e7,
);
const gU = T.objects.u.geometries;
const gX = T.objects.x.geometries;
const P = presimplify(T, sphericalTriangleArea); // P.arcs[i] = [[lon, lat, weight], …]
const nArcs = T.arcs.length;
log(`topology: ${nArcs} arcs, ${P.arcs.reduce((s, a) => s + a.length, 0)} points`);

const polysOf = (g) => (!g || !g.type ? [] : g.type === 'Polygon' ? [g.arcs] : g.arcs);
const asMP = (polys) => ({ type: 'MultiPolygon', arcs: polys });

/** Full-resolution coordinates of a signed arc. */
const arcFull = (a) => {
  const pts = P.arcs[abs(a)];
  return a < 0 ? pts.slice().reverse() : pts;
};
const ringFrom = (ring, arcCoords) => {
  const out = [];
  ring.forEach((a, i) => {
    const pts = arcCoords(a);
    for (let k = i ? 1 : 0; k < pts.length; k++) out.push([pts[k][0], pts[k][1]]);
  });
  return out;
};

/** Join directed arcs head-to-tail into closed rings, turning right at forks. */
function stitchRings(arcs) {
  const key = (p) => p[0] + ',' + p[1];
  const items = arcs.map((a) => {
    const pts = arcFull(a);
    return { a, pts, s: key(pts[0]), e: key(pts[pts.length - 1]), used: false };
  });
  const starts = new Map();
  for (const it of items) {
    if (!starts.has(it.s)) starts.set(it.s, []);
    starts.get(it.s).push(it);
  }
  const dir = (p, q) => [q[0] - p[0], q[1] - p[1]];
  const rings = [];
  for (const first of items) {
    if (first.used) continue;
    const ring = [];
    let cur = first;
    for (;;) {
      cur.used = true;
      ring.push(cur.a);
      if (cur.e === first.s) break;
      const cands = (starts.get(cur.e) || []).filter((c) => !c.used);
      if (!cands.length) {
        warn(`open ring while stitching (${ring.length} arcs)`);
        break;
      }
      if (cands.length === 1) cur = cands[0];
      else {
        const n = cur.pts.length;
        const din = dir(cur.pts[n - 2], cur.pts[n - 1]);
        let best = null;
        for (const c of cands) {
          const dout = dir(c.pts[0], c.pts[1]);
          const ang = Math.atan2(din[0] * dout[1] - din[1] * dout[0], din[0] * dout[0] + din[1] * dout[1]);
          if (!best || ang < best.ang) best = { ang, c };
        }
        cur = best.c;
      }
    }
    rings.push(ring);
  }
  return rings;
}

/** base − minus, where both are arc polygons and minus lies inside base. */
function subtractArcs(basePolys, minusPolys) {
  const flat = (polys) => polys.flat(2);
  const b = flat(basePolys);
  const m = flat(minusPolys);
  const bs = new Set(b.map(abs));
  const ms = new Set(m.map(abs));
  const flipped = new Set();
  const arcs = b.filter((a) => !ms.has(abs(a)));
  for (const a of m)
    if (!bs.has(abs(a))) {
      arcs.push(~a);
      flipped.add(abs(a));
    }
  const rings = stitchRings(arcs).map((ring) => {
    const coords = ringFrom(ring, arcFull);
    return { ring, coords, area: shoelace(coords), made: ring.some((a) => flipped.has(abs(a))) };
  });
  // Slivers where the claim's linework and the admin-1 linework disagree by a few hundred metres.
  const good = rings.filter((r) => !(r.made && Math.abs(r.area) < 2e-3));
  const exts = good.filter((r) => r.area < 0); // clockwise = exterior (d3 convention)
  const holes = good.filter((r) => r.area > 0);
  const polys = exts.map((e) => ({ e, rings: [e.ring] }));
  for (const h of holes) {
    const host = polys.find((p) => pointInRing(h.coords[0], p.e.coords));
    if (host) host.rings.push(h.ring);
  }
  return polys.map((p) => p.rings);
}

for (const u of units.values()) {
  const geoms = u.members.map((r) => gU[r.idx]).filter((g) => g && g.type);
  let polys = geoms.length === 1 ? polysOf(geoms[0]) : topo.mergeArcs(T, geoms).arcs;
  if (u.plus.length) polys = topo.mergeArcs(T, [asMP(polys), ...u.plus.map((x) => gX[x])]).arcs;
  if (u.minus != null) polys = subtractArcs(polys, polysOf(gX[u.minus]));
  u.polys = polys;
  u.area = geoArea({ type: 'MultiPolygon', coordinates: polys.map((poly) => poly.map((ring) => ringFrom(ring, arcFull))) });
  if (!(u.area > 0) || u.area > 2 * Math.PI) warn(`suspicious area for ${u.id}: ${u.area}`);
}

// ===========================================================================
// 4. Entities
// ===========================================================================
/** @type {Map<string, any>} */
const entities = new Map();
for (const u of units.values()) {
  if (!entities.has(u.entity)) entities.set(u.entity, { id: u.entity, units: [], area: 0 });
  const e = entities.get(u.entity);
  e.units.push(u);
  e.area += u.area;
}
const SOV = { FR1: 'FR', GB1: 'GB', US1: 'US', NL1: 'NL', DN1: 'DK', AU1: 'AU', NZ1: 'NZ', CH1: 'CN', FI1: 'FI', NOR: 'NO' };
const a3OfEntity = new Map();
for (const r of raws) if (!a3OfEntity.has(r.entity) && iso2OfA3(r.p.adm0_a3) === r.entity) a3OfEntity.set(r.entity, r.p.adm0_a3);

const flagDir = path.join(ROOT, 'node_modules/flag-icons/flags/4x3');
// World Bank population, latest year per ISO3
const wbPop = new Map();
for (const line of fs.readFileSync(path.join(SRC, 'population.csv'), 'utf8').split('\n')) {
  const m = line.match(/,([A-Z]{3}),(\d{4}),([\d.]+)\r?$/);
  if (!m) continue;
  const prev = wbPop.get(m[1]);
  if (!prev || +m[2] > prev.y) wbPop.set(m[1], { y: +m[2], v: Math.round(+m[3]) });
}
const WB_CODE = { XK: 'XKX', PS: 'PSE' };

for (const e of entities.values()) {
  const extra = C.EXTRA_ENTITIES[e.id];
  const a3 = extra?.a3 ?? a3OfEntity.get(e.id);
  const p0 = extra ? null : a0ByA3.get(a3);
  if (!extra && !p0) warn(`no admin-0 row for entity ${e.id}`);
  const mu = extra ? mapUnits.find((f) => [f.properties.GU_A3, f.properties.SU_A3, f.properties.ADM0_A3].includes(a3))?.properties : null;
  e.a3 = a3;
  const nameOv = C.COUNTRY_NAME[e.id] || {};
  e.es = nameOv.es || extra?.es || p0?.NAME_ES || p0?.NAME;
  e.en = nameOv.en || extra?.en || p0?.NAME_EN || p0?.NAME;
  e.al = uniq(
    [p0?.NAME, p0?.NAME_LONG, p0?.NAME_EN, p0?.NAME_ES, p0?.ADMIN, p0?.FORMAL_EN, p0?.NAME_CIAWF, extra?.es, extra?.en, ...(C.COUNTRY_ALIASES[e.id] || [])]
      .filter((s) => s && !/\.$|\b[A-Z][a-z]?\.(\s|$)/.test(s)) // drop abbreviations such as "Dem. Rep. Congo"
      .filter((s) => norm(s) !== norm(e.es) && norm(s) !== norm(e.en)),
  );
  e.sr = C.SUBREGION_OVERRIDE[e.id] || extra?.sr || C.NE_SUBREGION[p0?.SUBREGION] || null;
  if (!e.sr && p0) {
    const ru = { Africa: 'AF-E', Americas: 'AM-S', Asia: 'AS-S', Europe: 'EU-N', Oceania: 'OC-P', Antarctica: 'AN' }[p0.REGION_UN];
    e.sr = ru || 'AN';
    note(`subregion guessed for ${e.id} ${e.es}: ${e.sr} (NE: ${p0.SUBREGION} / ${p0.REGION_UN})`);
  }
  e.ct = e.sr === 'AN' ? 'AN' : e.sr.split('-')[0];
  e.cl = extra?.cl || (C.UN_MEMBERS.has(e.id) ? 'un' : C.OBSERVERS.has(e.id) ? 'obs' : C.PARTIAL.has(e.id) ? 'partial' : 'dep');
  if (e.id === 'AQ') e.cl = 'dep';
  e.sov = extra?.sov || (e.cl === 'dep' ? SOV[p0?.SOV_A3] || null : null);
  if (e.sov === e.id) e.sov = null;
  e.wd = extra?.wd || p0?.WIKIDATAID || null;
  const wb = wbPop.get(WB_CODE[e.id] || p0?.ISO_A3_EH || a3);
  if (wb && !extra) Object.assign(e, { pop: wb.v, py: wb.y });
  else {
    const src = p0 || mu;
    const v = src ? Math.round(src.POP_EST) : 0;
    Object.assign(e, { pop: v > 0 ? v : null, py: v > 0 ? src.POP_YEAR : null });
  }
  const gn = geonames[e.id];
  // GeoNames stores whole km², which rounds the two smallest states to 0 and 1.
  const km2 = { VA: 0.49, MC: 2.08 }[e.id] ?? (gn?.area > 0 ? gn.area : e.area * SR_KM2);
  e.areaKm2 = km2 < 100 ? round(km2, 2) : Math.round(km2);
  if (e.pop == null && gn?.population > 0) e.pop = gn.population;
  e.landlocked = C.LANDLOCKED.has(e.id);
  e.flag = fs.existsSync(path.join(flagDir, e.id.toLowerCase() + '.svg')) ? e.id.toLowerCase() : null;
  e.gnCapital = gn?.capital || null;
}
{
  const un = [...entities.values()].filter((e) => e.cl === 'un').length;
  if (un !== 193) warn(`expected 193 UN members, found ${un}: missing ${[...C.UN_MEMBERS].filter((id) => !entities.has(id)).join(',')}`);
  log(`${entities.size} entities (${un} UN members)`);
}

// --- capitals ---------------------------------------------------------------
{
  const byIso = new Map();
  for (const f of places) {
    const p = f.properties;
    const k = p.ISO_A2 && p.ISO_A2 !== '-99' ? p.ISO_A2 : iso2OfA3(p.ADM0_A3);
    if (!k) continue;
    if (!byIso.has(k)) byIso.set(k, []);
    byIso.get(k).push(p);
  }
  for (const e of entities.values()) {
    const ov = C.CAPITAL_OVERRIDE[e.id] || {};
    const list = byIso.get(e.id) || [];
    const caps = list.filter((p) => /^Admin-0 capital/.test(p.FEATURECLA));
    let pick = ov.pick ? list.find((p) => p.NAME === ov.pick) : null;
    if (!pick && caps.length) pick = caps.find((p) => p.FEATURECLA === 'Admin-0 capital') || caps[0];
    if (!pick && (ov.en || e.gnCapital)) pick = list.find((p) => norm(p.NAME) === norm(ov.en || e.gnCapital) || norm(p.NAMEASCII) === norm(ov.en || e.gnCapital));
    if (!pick && !ov.es && !e.gnCapital) continue;
    const es = ov.es || pick?.NAME_ES || pick?.NAME || e.gnCapital;
    const en = ov.en || pick?.NAME_EN || pick?.NAME || e.gnCapital;
    const ll = ov.ll || (pick ? [round(pick.LONGITUDE, 3), round(pick.LATITUDE, 3)] : null);
    // NAMEALT comes cut at the first letter that is not ASCII: «Ciudad de M» for Ciudad de México, «H» for
    // Hà Nội. What is left is no name, and as an accepted answer it took a single letter for a capital.
    const cut = (s) => s.length < 2 || [es, en, pick?.NAME_ES, pick?.NAME_EN].some((full) => full && full.length > s.length && full.startsWith(s) && /[^\x00-\x7f]/.test(full[s.length]));
    const alt = String(pick?.NAMEALT || '')
      .split('|')
      .map((s) => s.trim())
      .filter((s) => s && !cut(s));
    const al = uniq([pick?.NAME, pick?.NAME_EN, pick?.NAME_ES, pick?.NAMEASCII, ...alt, ...(ov.alt || []), ...caps.filter((p) => p !== pick).flatMap((p) => [p.NAME, p.NAME_ES])].filter(Boolean).flatMap((s) => s.split('|'))).filter(
      (s) => norm(s) !== norm(es) && norm(s) !== norm(en) && !/[()]/.test(s),
    );
    e.cap = { es, en, ...(ll ? { ll } : {}), ...(al.length ? { al } : {}) };
  }
}

// ===========================================================================
// 5. Adjacency (shared arcs) + lake borders from the solid-polygon variant
// ===========================================================================
const unitList = [...units.values()];
unitList.forEach((u, i) => (u.i = i));
const arcUsers = Array.from({ length: nArcs }, () => []);
for (const u of unitList) for (const a of new Set(u.polys.flat(2).map(abs))) arcUsers[a].push(u.i);
const land = unitList.map(() => new Set());
for (const users of arcUsers) for (let i = 0; i < users.length; i++) for (let j = i + 1; j < users.length; j++) (land[users[i]].add(users[j]), land[users[j]].add(users[i]));
{
  const unitOfCode = new Map();
  for (const u of unitList) for (const r of u.members) unitOfCode.set(r.p.adm1_code, u);
  const Ts = topoServer.topology({ u: { type: 'FeatureCollection', features: adm1Solid.map((f) => ({ type: 'Feature', properties: {}, geometry: f.geometry })) } }, 1e7);
  const nb = topo.neighbors(Ts.objects.u.geometries);
  let added = 0;
  nb.forEach((arr, i) => {
    const a = unitOfCode.get(adm1Solid[i].properties.adm1_code);
    if (!a || a.special) return;
    for (const j of arr) {
      const b = unitOfCode.get(adm1Solid[j].properties.adm1_code);
      if (!b || b === a || b.special || land[a.i].has(b.i)) continue;
      land[a.i].add(b.i);
      land[b.i].add(a.i);
      added++;
    }
  });
  log(`adjacency: ${land.reduce((s, x) => s + x.size, 0) / 2} borders (${added} only across lakes)`);
}

// ===========================================================================
// 6. Simplification: per-arc tolerances shared by every file
// ===========================================================================
for (const e of entities.values()) {
  e.thrR = e.area / K_REGION;
  e.thrW = e.area / K_WORLD;
}
for (const u of unitList) u.thrR = Math.min(entities.get(u.entity).thrR, u.area / K_UNIT);

const arcThrR = new Float64Array(nArcs).fill(Infinity);
const arcThrW = new Float64Array(nArcs).fill(Infinity);
const arcMinR = new Uint8Array(nArcs);
const arcMinW = new Uint8Array(nArcs);
const minInterior = (n) => (n === 1 ? 3 : n === 2 ? 1 : 0);
for (const u of unitList) {
  const tw = entities.get(u.entity).thrW;
  for (const poly of u.polys)
    for (const ring of poly) {
      const need = minInterior(ring.length);
      for (const s of ring) {
        const a = abs(s);
        if (u.thrR < arcThrR[a]) arcThrR[a] = u.thrR;
        if (tw < arcThrW[a]) arcThrW[a] = tw;
        if (need > arcMinR[a]) arcMinR[a] = need;
      }
    }
}

function simplifyArc(a, thr, need) {
  const pts = P.arcs[a];
  const n = pts.length;
  let keep = [];
  for (let k = 0; k < n; k++) if (k === 0 || k === n - 1 || pts[k][2] >= thr) keep.push(k);
  if (keep.length - 2 < need && n > keep.length) {
    const spare = [];
    for (let k = 1; k < n - 1; k++) if (pts[k][2] < thr) spare.push(k);
    spare.sort((x, y) => pts[y][2] - pts[x][2]);
    keep = keep.concat(spare.slice(0, need - (keep.length - 2))).sort((x, y) => x - y);
  }
  return keep.map((k) => [pts[k][0], pts[k][1]]);
}
const cacheR = new Map();
const cacheW = new Map();
const arcR = (s) => {
  const a = abs(s);
  let pts = cacheR.get(a);
  if (!pts) cacheR.set(a, (pts = simplifyArc(a, arcThrR[a], arcMinR[a])));
  return s < 0 ? pts.slice().reverse() : pts;
};
const arcW = (s) => {
  const a = abs(s);
  let pts = cacheW.get(a);
  if (!pts) cacheW.set(a, (pts = simplifyArc(a, arcThrW[a], arcMinW[a])));
  return s < 0 ? pts.slice().reverse() : pts;
};

const ringArea = (coords) => {
  if (coords.length < 4) return 0;
  const a = geoArea({ type: 'Polygon', coordinates: [coords] });
  return Math.min(a, 4 * Math.PI - a);
};

const SLIVER_SR = 0.05 / SR_KM2; // 5 hectares
let sliversDropped = 0;

/**
 * Drop islands and lakes too small to matter. Rings on a shared border are kept so that no gap opens
 * between neighbours, with one exception: slivers. Where two source layers disagree by a few metres
 * (typically along lake shores) a unit is left with hair-thin scraps that simplification flattens into
 * back-and-forth lines. Their winding is then a matter of rounding, and a ring wound the wrong way is
 * read by d3 as "the whole globe except this", so they must go.
 */
function filterPolys(polys, minRing, arcCoords, isShared) {
  const info = polys.map((poly) => {
    const coords = ringFrom(poly[0], arcCoords);
    const area = ringArea(coords);
    const len = coords.length > 1 ? geoLength({ type: 'LineString', coordinates: coords }) : 0;
    return { poly, area, round: len ? (4 * Math.PI * area) / (len * len) : 0, shared: poly[0].some((a) => isShared(abs(a))) };
  });
  const total = info.reduce((s, x) => s + x.area, 0);
  const largest = Math.max(...info.map((x) => x.area));
  const sliver = (x) => x.area < 5e-4 * total && (x.round < 0.05 || x.area < SLIVER_SR);
  return info
    .filter((x) => {
      if (x.area === largest) return true;
      if (sliver(x)) {
        if (x.shared) sliversDropped++;
        return false;
      }
      return x.shared || (x.area > 0 && (x.area >= minRing || x.area >= 0.03 * total));
    })
    .map((x) => [x.poly[0], ...x.poly.slice(1).filter((h) => h.some((a) => isShared(abs(a))) || ringArea(ringFrom(h, arcCoords)) >= minRing)]);
}

for (const u of unitList) {
  const e = entities.get(u.entity);
  u.polysR = filterPolys(u.polys, Math.min(e.thrR * RING_K, u.thrR * RING_K * 4), arcR, (a) => arcUsers[a].length > 1);
}

// ===========================================================================
// 7. Geometry-derived attributes
// ===========================================================================
const coordsOf = (polys, arcCoords) => polys.map((poly) => poly.map((ring) => ringFrom(ring, arcCoords)));

/** Pole of inaccessibility of the largest polygon, computed in a local equal-area plane. */
function labelPoint(coords) {
  let best = null;
  for (const poly of coords) {
    const a = ringArea(poly[0]);
    if (!best || a > best.a) best = { a, poly };
  }
  const c = geoCentroid({ type: 'Polygon', coordinates: best.poly });
  const proj = geoAzimuthalEqualArea().rotate([-c[0], -c[1]]).scale(R_KM).translate([0, 0]);
  const planar = best.poly.map((ring) => ring.map((p) => proj(p)));
  const size = Math.sqrt(best.a * SR_KM2);
  const pt = polylabel(planar, Math.max(size / 60, 0.05));
  const ll = proj.invert([pt[0], pt[1]]);
  return ll && isFinite(ll[0]) ? [round(ll[0], 3), round(ll[1], 3)] : [round(c[0], 3), round(c[1], 3)];
}

/** A handful of outline points of the main landmasses: enough to frame the unit in any projection. */
function fitPoints(coords, minShare) {
  const parts = coords.map((poly) => ({ ring: poly[0], a: ringArea(poly[0]) }));
  const largest = Math.max(...parts.map((p) => p.a));
  const out = [];
  for (const p of parts) {
    if (p.a < largest * minShare) continue;
    const n = p.ring.length - 1;
    const count = Math.max(4, Math.min(14, Math.round(n / 6)));
    for (let k = 0; k < count; k++) {
      const q = p.ring[Math.floor((k * n) / count)];
      out.push([round(q[0], 2), round(q[1], 2)]);
    }
  }
  return out;
}

// ===========================================================================
// 8. Short sea crossings
// ===========================================================================
const sea = unitList.map(() => new Map()); // unit → Map(other unit → km)
{
  const cell = SEA_KM / R_KM;
  const grid = new Map();
  const xyz = (lon, lat) => {
    const c = Math.cos(lat * RAD);
    return [c * Math.cos(lon * RAD), c * Math.sin(lon * RAD), Math.sin(lat * RAD)];
  };
  const pts = []; // [x, y, z, unit]
  const stepRad = 6 / R_KM;
  for (const u of unitList) {
    const seen = new Set();
    for (const s of u.polysR.flat(2)) {
      const a = abs(s);
      if (arcUsers[a].length !== 1 || seen.has(a)) continue; // coast only
      seen.add(a);
      const line = arcR(a);
      for (let k = 0; k < line.length; k++) {
        const A = xyz(line[k][0], line[k][1]);
        pts.push([A[0], A[1], A[2], u.i]);
        if (k + 1 < line.length) {
          const B = xyz(line[k + 1][0], line[k + 1][1]);
          const d = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
          const n = Math.min(40, Math.floor(d / stepRad));
          for (let j = 1; j <= n; j++) {
            const t = j / (n + 1);
            const x = A[0] + (B[0] - A[0]) * t;
            const y = A[1] + (B[1] - A[1]) * t;
            const z = A[2] + (B[2] - A[2]) * t;
            const m = Math.hypot(x, y, z);
            pts.push([x / m, y / m, z / m, u.i]);
          }
        }
      }
    }
  }
  const ck = (x, y, z) => (Math.floor(x / cell) + 4096) * 67108864 + (Math.floor(y / cell) + 4096) * 8192 + (Math.floor(z / cell) + 4096);
  pts.forEach((p, i) => {
    const k = ck(p[0], p[1], p[2]);
    let arr = grid.get(k);
    if (!arr) grid.set(k, (arr = []));
    arr.push(i);
  });
  const N = unitList.length;
  const best = new Map(); // i*N+j (i<j) → chord²
  const lim2 = cell * cell;
  for (const p of pts) {
    const cx = Math.floor(p[0] / cell);
    const cy = Math.floor(p[1] / cell);
    const cz = Math.floor(p[2] / cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const arr = grid.get((cx + dx + 4096) * 67108864 + (cy + dy + 4096) * 8192 + (cz + dz + 4096));
          if (!arr) continue;
          for (const qi of arr) {
            const q = pts[qi];
            if (q[3] <= p[3]) continue;
            const d2 = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
            if (d2 > lim2) continue;
            const key = p[3] * N + q[3];
            const cur = best.get(key);
            if (cur === undefined || d2 < cur) best.set(key, d2);
          }
        }
  }
  // land components and short-hop reachability
  const comp = new Int32Array(N).fill(-1);
  let nc = 0;
  for (let i = 0; i < N; i++) {
    if (comp[i] >= 0) continue;
    const stack = [i];
    comp[i] = nc;
    while (stack.length) for (const j of land[stack.pop()]) if (comp[j] < 0) (comp[j] = nc), stack.push(j);
    nc++;
  }
  const within = (i, j, hops) => {
    let frontier = [i];
    const seen = new Set([i]);
    for (let h = 0; h < hops; h++) {
      const next = [];
      for (const a of frontier)
        for (const b of land[a]) {
          if (b === j) return true;
          if (!seen.has(b)) seen.add(b), next.push(b);
        }
      frontier = next;
    }
    return false;
  };
  const cands = [];
  for (const [key, d2] of best) {
    const i = Math.floor(key / N);
    const j = key % N;
    if (land[i].has(j)) continue;
    cands.push({ i, j, km: Math.sqrt(d2) * R_KM });
  }
  const dmin = new Map(); // component pair → narrowest crossing
  for (const c of cands) {
    if (comp[c.i] === comp[c.j]) continue;
    const k = Math.min(comp[c.i], comp[c.j]) * nc + Math.max(comp[c.i], comp[c.j]);
    if (!dmin.has(k) || c.km < dmin.get(k)) dmin.set(k, c.km);
  }
  let n = 0;
  for (const c of cands) {
    let ok;
    if (comp[c.i] !== comp[c.j]) {
      const k = Math.min(comp[c.i], comp[c.j]) * nc + Math.max(comp[c.i], comp[c.j]);
      ok = c.km <= Math.max(10, 2.5 * dmin.get(k));
    } else ok = c.km <= 25 && !within(c.i, c.j, 4);
    if (!ok) continue;
    sea[c.i].set(c.j, round(c.km, 0));
    sea[c.j].set(c.i, round(c.km, 0));
    n++;
  }
  log(`sea crossings: ${n} (from ${cands.length} candidate pairs, ${pts.length} coast samples)`);
}

// ===========================================================================
// 9. Names
// ===========================================================================
const typeEs = (t) => C.TYPE_ES[t]?.[0] || null;

/** What the source said of each unit and what was made of it (.cache/names.json). */
const nameLog = [];

/**
 * Wikidata ids that two or more units of a country carry. The Spanish and English labels of the source
 * come from Wikidata, so an id that sits on the wrong polygon brings the names of another place with it:
 * twenty Latvian municipalities were all "Valmiera" that way, and seven regions of Madagascar took the
 * name of the province they belong to. An id that several units share vouches for none of them, so its
 * labels count only where they resemble the unit's own name, and the id itself is dropped elsewhere.
 */
const wdShared = new Set();
/** Entries of TRUST_ES_UNIT and TRUST_EN_UNIT that did their work, and those that changed nothing. */
const readUsed = new Set();
const idle = new Set();
{
  const seen = new Map();
  for (const u of units.values()) {
    const w = u.main.p.wikidataid;
    if (w) seen.set(`${u.entity} ${w}`, (seen.get(`${u.entity} ${w}`) || 0) + 1);
  }
  for (const [k, n] of seen) if (n > 1) wdShared.add(k);
}

function unitNames(u) {
  const p = u.main.p;
  u.wd = p.wikidataid || null;
  const merged = C.MERGED_NAME[u.id];
  const ov = { ...(merged ? { es: merged.es, en: merged.en, lo: merged.name } : {}), ...(C.UNIT_NAME[u.id] || {}) };
  const e = entities.get(u.entity);
  if (!p.name) return { es: ov.es || e.es, en: ov.en || e.en, lo: ov.lo || e.en, al: ov.al || [] };
  if (merged) return { es: ov.es, en: ov.en, lo: ov.lo, al: ov.al || [] };
  const [lo0, extras] = cleanLocal(p.name);
  // Scholarly transliterations ("Bādgīs", "Ġawr") are not how Spanish maps spell things.
  const exotic = /[āēīōūġḥṭṣḍẓḳʿʾ]/i;
  const enC = cleanEn(p.name_en);
  const esC = exotic.test(p.name_es || '') ? '' : dropKind(cleanEs(p.name_es), [lo0]);
  const trust = C.TRUST_ES.has(u.entity);
  const shared = wdShared.has(`${u.entity} ${p.wikidataid}`);
  const esLo = !!esC && similar(esC, lo0);
  const enLo = !!enC && similar(enC, lo0);
  // A label is believed when the country is one whose labels are good, when it resembles the unit's own
  // name (or, the Spanish one, the English one), when it translates it, or when somebody has read it.
  const esRead = C.TRUST_ES_UNIT.has(u.id);
  const enRead = C.TRUST_EN_UNIT.has(u.id);
  const esByRule = !!esC && (shared ? esLo : trust || esLo || similar(esC, enC) || translates(esC, lo0) || translates(esC, enC));
  const enByRule = !!enC && (shared ? enLo : trust || enLo);
  if (esRead) (esByRule || !esC ? idle : readUsed).add(`TRUST_ES_UNIT ${u.id}`);
  if (enRead) (enByRule || !enC ? idle : readUsed).add(`TRUST_EN_UNIT ${u.id}`);
  const esOk = esByRule || (!!esC && esRead);
  const enOk = enByRule || (!!enC && enRead);
  if (shared && !esLo && !enLo) {
    u.wd = null;
    note(`${u.id} ${lo0}: shares ${p.wikidataid} with another unit and its labels are of another place («${p.name_es}», «${p.name_en}»): named by its own name, id dropped`);
  }
  const lo = ov.lo || lo0;
  const en = ov.en || (enOk ? enC : lo0);
  let es = ov.es;
  if (!es) {
    if (C.HISPANOPHONE.has(u.entity)) {
      // The local name is already Spanish; borrow accents if another field spells it better.
      const marks = (s) => (s.match(/[^\x00-\x7f]/g) || []).length;
      es = lo0;
      for (const c of [esC, enC]) if (c && norm(c) === norm(lo0) && marks(c) > marks(es)) es = c;
    } else es = esOk ? esC : lo0;
  }
  const al = [lo0, ...extras, ...(ov.al || [])];
  if (esOk) al.push(esC, p.name_es);
  if (enOk) al.push(enC, p.name_en);
  for (const s of [p.name_es, p.name_en]) if (s && s.includes(' / ')) al.push(...s.split(' / '));
  const seen = new Set([norm(es), norm(en), norm(lo)]);
  const out = [];
  for (const s of al) {
    const k = norm(s);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(s.trim());
  }
  nameLog.push({
    id: u.id,
    src: { adm1: p.adm1_code, iso: p.iso_3166_2, name: p.name, es: p.name_es, en: p.name_en, geonames: p.gn_name, wikidata: p.wikidataid, type: p.type_en },
    // which of the two labels was believed, and why: it resembles the unit's own name, the other label, or the country is trusted
    es: { clean: esC, ok: esOk, likeName: esLo, likeEn: !!esC && similar(esC, enC), read: esRead },
    en: { clean: enC, ok: enOk, likeName: enLo, read: enRead },
    trust,
    shared,
    fixed: !!C.SOURCE_FIX[p.adm1_code],
    override: Object.keys(C.UNIT_NAME[u.id] || {}),
    out: { es, en, lo, al: out, wd: u.wd },
  });
  return { es, en, lo, al: out };
}

/** A place name without the word for the kind of place, in the languages GeoNames uses: for comparing only. */
const KIND_WORDS =
  /\b(region|province|state|county|district|department|governorate|oblast|prefecture|municipality|parish|division|city|autonomous|republic|territory|of|the|de|del|la|el|provincia|departamento|rayon|rayonu|novads|okrug|kraj|zupanija|voblasts|muhafazat|provinsi|tinh|khett|wilaya|mintaqat)\b/g;
const placeKey = (s) => norm(s).replace(KIND_WORDS, ' ').replace(/\s+/g, ' ').trim();

/**
 * Names that cannot all be right, looked for in every country once its units are named.
 *
 *  · Two pieces of one level under the same name: nearly always a label that came from another place.
 *    Where it is true (a city and the district around it), both are listed in config.HOMONYMS.
 *  · A unit that GeoNames calls by the name another unit carries, which GeoNames in turn calls something
 *    else: a chain of that kind is a set of names laid on the wrong polygons (Guyana, Eritrea and
 *    Ecuador came like that). One step alone is a town inside its district and means nothing.
 *  · Two units that keep the same Wikidata id after all the above.
 */
function checkNames(e, quiz) {
  for (const lang of ['es', 'en']) {
    const by = new Map();
    for (const u of quiz) {
      const k = norm(u.names[lang]);
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(u);
    }
    for (const us of by.values()) {
      if (us.length < 2 || us.every((u) => C.HOMONYMS.has(u.id))) continue;
      warn(`${e.id}: ${us.map((u) => u.id).join(', ')} all go by «${us[0].names[lang]}» (${lang})`);
    }
  }
  const carrier = new Map(); // name → the one unit that carries it
  for (const u of quiz)
    for (const k of new Set([u.names.es, u.names.en, u.names.lo].map(placeKey))) {
      if (!k) continue;
      carrier.set(k, carrier.has(k) ? null : u);
    }
  const named = (u) => {
    const k = placeKey(u.main.p.gn_name);
    const own = [u.names.es, u.names.en, u.names.lo].map(placeKey);
    return k && !own.includes(k) ? carrier.get(k) || null : null; // the unit whose name GeoNames gives to u
  };
  for (const u of quiz) {
    const v = named(u);
    if (v && named(v)) warn(`${e.id}: GeoNames calls ${u.id} «${u.names.es}» by the name of ${v.id} («${u.main.p.gn_name}»), and ${v.id} by another's: names on the wrong polygons?`);
  }
  const ids = new Map();
  for (const u of quiz) {
    if (!u.wd) continue;
    if (!ids.has(u.wd)) ids.set(u.wd, []);
    ids.get(u.wd).push(u.id);
  }
  for (const [wd, us] of ids) if (us.length > 1 && !us.every((id) => C.HOMONYMS.has(id))) warn(`${e.id}: ${us.join(', ')} share the Wikidata id ${wd}`);
}

// ===========================================================================
// 10. Write subdivision files
// ===========================================================================
// Files are replaced in place and leftovers removed afterwards, so that a dev server watching the
// folder never sees it disappear.
fs.mkdirSync(path.join(OUT, 'r'), { recursive: true });
const written = new Set();
const emit = (rel, text) => {
  fs.writeFileSync(path.join(OUT, rel), text);
  written.add(rel);
};

function localTopology(objects, arcCoords) {
  const map = new Map();
  const arcs = [];
  const remap = (s) => {
    const a = abs(s);
    let j = map.get(a);
    if (j === undefined) {
      j = arcs.length;
      map.set(a, j);
      arcs.push(arcCoords(a).map((p) => [p[0], p[1]]));
    }
    return s < 0 ? ~j : j;
  };
  const out = {};
  for (const [name, geoms] of Object.entries(objects)) {
    out[name] = {
      type: 'GeometryCollection',
      geometries: geoms.map((g) => ({ type: 'MultiPolygon', id: g.id, properties: g.props, arcs: g.polys.map((poly) => poly.map((ring) => ring.map(remap))) })),
    };
  }
  const t = { type: 'Topology', arcs, objects: out };
  t.bbox = topo.bbox(t);
  const wide = t.bbox[2] - t.bbox[0] > 180;
  return rewind(topo.quantize(t, wide ? 1e6 : 1e5));
}

let ringsRewound = 0;
/**
 * Last line of defence, run on exactly what is written to disk: rounding to the grid can still turn a
 * small ring inside out, so every exterior ring is measured and, if it claims more than half the globe,
 * reversed. Reversing a ring of arcs means walking them backwards, each one the other way round.
 */
function rewind(t) {
  for (const [name, obj] of Object.entries(t.objects)) {
    const fc = topo.feature(t, obj);
    obj.geometries.forEach((g, gi) => {
      fc.features[gi].geometry.coordinates.forEach((poly, pi) => {
        if (geoArea({ type: 'Polygon', coordinates: [poly[0]] }) <= 2 * Math.PI) return;
        g.arcs[pi][0] = g.arcs[pi][0]
          .slice()
          .reverse()
          .map((a) => ~a);
        ringsRewound++;
        note(`rewound ${g.id} (${name}), polygon ${pi}`);
      });
    });
    for (const f of topo.feature(t, obj).features) if (geoArea(f) > 2 * Math.PI) warn(`${f.id} (${name}) still covers more than half the globe`);
  }
  return t;
}

const compact = (o) => {
  for (const k of Object.keys(o)) if (o[k] == null || (Array.isArray(o[k]) && !o[k].length)) delete o[k];
  return o;
};
const pluralOf = (u) => C.TYPE_ES[u.main.p.type_en] || null;

let regionBytes = 0;
const sizes = [];
for (const e of entities.values()) {
  const fine = e.units.slice().sort((a, b) => a.id.localeCompare(b.id));
  for (const u of fine) {
    const coords = coordsOf(u.polysR, arcR);
    u.names = unitNames(u);
    u.lp = labelPoint(coords);
    u.fp = fitPoints(coords, 0.1);
    u.km2 = Math.round(u.area * SR_KM2 * 10) / 10;
  }
  const quiz = fine.filter((u) => !u.nonQuiz);
  if (e.cl === 'other') for (const u of fine) u.nonQuiz = true;
  checkNames(e, quiz);

  // finest level
  const cfg = C.LEVELS[e.id];
  const counts = new Map();
  for (const u of quiz) {
    const t = pluralOf(u);
    if (t) counts.set(t, (counts.get(t) || 0) + 1);
  }
  const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const fineLabel = cfg?.fine || C.FINE_LABEL[e.id] || { es: common?.[1] || 'regiones', en: 'regions', sg: common?.[0] || 'región' };
  const propsOf = (u, parents) =>
    compact({
      n: compact({ es: u.names.es, en: u.names.en !== u.names.es ? u.names.en : null, lo: u.names.lo !== u.names.es ? u.names.lo : null }),
      al: u.names.al,
      t: typeEs(u.main.p.type_en) && typeEs(u.main.p.type_en) !== fineLabel.sg ? typeEs(u.main.p.type_en) : null,
      q: u.nonQuiz ? 0 : null,
      wd: u.wd,
      lp: u.lp,
      fp: u.fp,
      ar: u.km2,
      nb: [...land[u.i]].map((j) => unitList[j].id).sort(),
      sl: [...sea[u.i].keys()].map((j) => unitList[j].id).sort(),
      g: parents?.length ? parents : null,
    });

  const objects = {};
  const levels = [];
  const parentIds = new Map(fine.map((u) => [u.id, []]));

  for (const grp of cfg?.groups || []) {
    const buckets = new Map();
    let broken = false;
    for (const u of quiz) {
      const key = grp.key(u.main.p);
      if (key == null || key === '') {
        warn(`${e.id} level ${grp.id}: ${u.id} ${u.names.es} has no group`);
        broken = true;
        continue;
      }
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(u);
    }
    if (broken || buckets.size < 2) continue;
    const geoms = [];
    for (const [key, members] of [...buckets.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
      const def = grp.names?.[key];
      if (grp.names && !def) warn(`${e.id} level ${grp.id}: no curated name for group "${key}"`);
      const label = String(key).trim();
      const id = def?.[0] || `${e.id}~${slug(label)}`;
      const es = def?.[1] || grp.es?.[label] || label;
      const en = def?.[2] || label;
      const lo = def?.[3] || label;
      const al = uniq([...(def?.[4] || []), label, en, lo]).filter((s) => norm(s) !== norm(es));
      const polys = filterPolys(topo.mergeArcs(T, members.map((m) => asMP(m.polysR))).arcs, e.thrR * RING_K, arcR, (a) => arcUsers[a].length > 1);
      const coords = coordsOf(polys, arcR);
      for (const m of members) parentIds.get(m.id).push(id);
      geoms.push({
        id,
        polys,
        props: compact({
          n: compact({ es, en: en !== es ? en : null, lo: lo !== es ? lo : null }),
          al,
          lp: labelPoint(coords),
          fp: fitPoints(coords, 0.1),
          ar: Math.round(members.reduce((s, m) => s + m.km2, 0)),
          m: members.map((m) => m.id).sort(),
        }),
      });
    }
    // units that are drawn but never asked stay visible at every level
    for (const u of fine) if (u.nonQuiz) geoms.push({ id: u.id, polys: u.polysR, props: propsOf(u) });
    objects[grp.id] = geoms;
    levels.push({ k: grp.id, n: buckets.size, es: grp.label.es, en: grp.label.en, sg: grp.label.sg });
  }
  objects.f = fine.map((u) => ({ id: u.id, polys: u.polysR, props: propsOf(u, parentIds.get(u.id)) }));
  levels.push({ k: 'f', n: quiz.length, es: fineLabel.es, en: fineLabel.en, sg: fineLabel.sg });
  e.levels = levels;
  e.defLevel = cfg?.def && cfg.def !== 'fine' && objects[cfg.def] ? cfg.def : 'f';

  const json = JSON.stringify(localTopology(objects, arcR));
  emit(`r/${e.id}.json`, json);
  regionBytes += json.length;
  sizes.push([e.id, json.length, fine.length]);
}
log(`subdivisions: ${entities.size} files, ${(regionBytes / 1e6).toFixed(2)} MB`);

// ===========================================================================
// 11. World file: dissolve units into countries
// ===========================================================================
const entList = [...entities.values()].sort((a, b) => a.id.localeCompare(b.id));
entList.forEach((e, i) => (e.i = i));
const entOfUnit = unitList.map((u) => entities.get(u.entity).i);
for (const e of entList) e.polys = topo.mergeArcs(T, e.units.map((u) => asMP(u.polys))).arcs;
const arcEnts = Array.from({ length: nArcs }, () => []);
for (const e of entList) for (const a of new Set(e.polys.flat(2).map(abs))) arcEnts[a].push(e.i);
for (const e of entList) for (const poly of e.polys) for (const ring of poly) for (const s of ring) arcMinW[abs(s)] = Math.max(arcMinW[abs(s)], minInterior(ring.length));
for (const e of entList) {
  e.polysW = filterPolys(e.polys, e.thrW * RING_K, arcW, (a) => arcEnts[a].length > 1);
  const coords = coordsOf(e.polysW, arcW);
  e.lp = labelPoint(coords);
  e.fp = fitPoints(coords, 0.01);
  const nb = new Set();
  const sl = new Map();
  for (const u of e.units) {
    for (const j of land[u.i]) if (entOfUnit[j] !== e.i) nb.add(entOfUnit[j]);
    for (const [j, km] of sea[u.i]) if (entOfUnit[j] !== e.i) sl.set(entOfUnit[j], Math.min(km, sl.get(entOfUnit[j]) ?? Infinity));
  }
  // Glaciers nobody governs are drawn but take no part in the game, so they are nobody's neighbour.
  const real = (i) => entList[i].cl !== 'other' && e.cl !== 'other';
  e.nb = [...nb].filter(real).map((i) => entList[i].id).sort();
  e.sl = [...sl.keys()].filter((i) => !nb.has(i) && real(i)).map((i) => entList[i].id).sort();
}
const worldJson = JSON.stringify(localTopology({ c: entList.map((e) => ({ id: e.id, polys: e.polysW, props: undefined })) }, arcW));
emit('world.json', worldJson);
log(`world: ${(worldJson.length / 1e6).toFixed(2)} MB`);
log(`slivers dropped: ${sliversDropped}, rings rewound: ${ringsRewound}`);

// ===========================================================================
// 12. Index
// ===========================================================================
const index = {
  built: new Date().toISOString().slice(0, 10),
  continents: C.CONTINENTS,
  subregions: C.SUBREGIONS,
  countries: entList.map((e) =>
    compact({
      id: e.id,
      a3: e.a3,
      n: compact({ es: e.es, en: e.en !== e.es ? e.en : null }),
      al: e.al,
      ct: e.ct,
      sr: e.sr,
      cl: e.cl,
      sov: e.sov,
      pop: e.pop,
      py: e.py,
      ar: e.areaKm2,
      cap: e.cap,
      wd: e.wd,
      ll: e.landlocked ? 1 : null,
      fl: e.flag,
      lp: e.lp,
      fp: e.fp,
      nb: e.nb,
      sl: e.sl,
      lv: e.levels,
      dl: e.defLevel,
    }),
  ),
};
const indexJson = JSON.stringify(index);
emit('index.json', indexJson);
for (const rel of fs.readdirSync(OUT, { recursive: true })) {
  const name = String(rel).split(path.sep).join('/');
  if (name.endsWith('.json') && !written.has(name)) fs.rmSync(path.join(OUT, name));
}
log(`index: ${(indexJson.length / 1e3).toFixed(0)} kB`);

// ===========================================================================
// Report (for humans reviewing a rebuild)
// ===========================================================================
note('');
note('== largest subdivision files ==');
for (const [id, bytes, n] of sizes.sort((a, b) => b[1] - a[1]).slice(0, 25)) note(`${id}  ${(bytes / 1e3).toFixed(0).padStart(5)} kB  ${n} units`);
note('');
note('== countries ==');
for (const e of entList) {
  note(
    [e.id, e.cl.padEnd(7), e.sr.padEnd(5), (e.es || '').padEnd(34), String(e.pop ?? '-').padStart(11), String(e.py ?? '').padEnd(4), String(e.areaKm2).padStart(9), (e.cap?.es || '-').padEnd(26), e.levels.map((l) => `${l.k}:${l.n} ${l.es}`).join(' | '), '· nb', e.nb.join(','), e.sl.length ? '· sea ' + e.sl.join(',') : ''].join(' '),
  );
}
note('');
note('== units ==');
for (const e of entList) {
  note(`-- ${e.id} ${e.es}`);
  for (const u of e.units.slice().sort((a, b) => a.id.localeCompare(b.id))) {
    const n = u.names;
    note(`   ${u.id.padEnd(10)} ${u.nonQuiz ? '·' : ' '} ${n.es}${n.en !== n.es ? ' | en ' + n.en : ''}${n.lo !== n.es ? ' | lo ' + n.lo : ''}${n.al.length ? ' | al ' + n.al.join('; ') : ''}${u.members.length > 1 ? `  [${u.members.length} parts]` : ''}`);
  }
}
// One Wikidata id on units of two countries: one of the two carries a namesake's (config.SOURCE_FIX).
{
  const carriers = new Map();
  for (const e of entList)
    for (const u of e.units) {
      if (!u.wd) continue;
      if (!carriers.has(u.wd)) carriers.set(u.wd, []);
      carriers.get(u.wd).push([e.id, u.id]);
    }
  for (const [wd, us] of carriers) if (new Set(us.map(([e]) => e)).size > 1) warn(`${us.map(([, id]) => id).join(', ')}: units of different countries share the Wikidata id ${wd}`);
}
// The lists of labels read by hand must name units that exist and labels the rules would turn down.
for (const [list, ids] of [
  ['TRUST_ES_UNIT', C.TRUST_ES_UNIT],
  ['TRUST_EN_UNIT', C.TRUST_EN_UNIT],
])
  for (const id of ids) {
    if (idle.has(`${list} ${id}`)) warn(`${list}: ${id} is believed without it (or has no label): take it off the list`);
    else if (!readUsed.has(`${list} ${id}`)) warn(`${list}: no unit has the id ${id}`);
  }
// What was not believed, for whoever reads the source again: each line is a name the game does not use.
note('');
note('== labels of the source that were not believed ==');
note('   (right ones go in config.TRUST_ES_UNIT / TRUST_EN_UNIT; a wrong name in the source, in SOURCE_FIX)');
for (const x of nameLog) {
  const off = [];
  if (x.es.clean && !x.es.ok && !x.override.includes('es') && norm(x.es.clean) !== norm(x.out.es)) off.push(`es «${x.es.clean}»`);
  if (x.en.clean && !x.en.ok && !x.override.includes('en') && norm(x.en.clean) !== norm(x.out.en)) off.push(`en «${x.en.clean}»`);
  if (off.length) note(`   ${x.id.padEnd(10)} ${x.out.es}${x.out.en !== x.out.es ? ' | en ' + x.out.en : ''}   ✗ ${off.join(' · ')}${x.shared ? '   (id shared with another unit)' : ''}`);
}
fs.writeFileSync(REPORT, report.join('\n'));
fs.writeFileSync(NAMES, JSON.stringify(nameLog, null, 1));
log(`done → public/data (${((regionBytes + worldJson.length + indexJson.length) / 1e6).toFixed(2)} MB), report in .cache/report.txt`);
