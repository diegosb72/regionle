// A second opinion on the cities and on the capitals of regions.
//
//   npm i --no-save all-the-cities@3.1.0 && npm run data:check
//
// Natural Earth, which the data is built from, marks as "capital of a first-order division" cities that
// are not one (a former seat, the biggest town, the neighbour across the river), files a few border towns
// under the wrong country and gives a few hamlets the population of a famous namesake. Nothing in Natural
// Earth says which records those are, so this compares what was built with GeoNames (the package
// all-the-cities: every place of 1,000 people or more, with its country and whether it is a seat):
//
//   · every capital of a region with the seats GeoNames has inside that region;
//   · every city with its namesake nearby, to see that both are in the same country;
//   · every city among the largest of its country with the people GeoNames counts around it.
//
// What differs is printed; what was looked at and found right as it is, is listed below with the reason.
// The corrections themselves live in physical-config.mjs (REGION_CAPITAL_FIXES, CITY_COUNTRY, CITY_DROP).
// GeoNames is not part of the build and none of its data is shipped: it is only a witness. Exit code 1
// when something differs that is not listed here. `--spellings` also lists the capitals that match a
// seat by place and not by name, and `--alone` those GeoNames has nothing to say about.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as topo from 'topojson-client';
import { geoContains, geoDistance } from 'd3-geo';
import { norm } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'public/data');
const R_KM = 6371.0088;

/** Capitals that are not among the seats GeoNames has in the region, and are right: "unit": why. */
const DIFFERENT_OK = {
  'ES-BA': 'GeoNames marks Mérida, the capital of Extremadura, which lies in the province of Badajoz',
  'ES-C': 'GeoNames marks Santiago, the capital of Galicia, which lies in the province of La Coruña',
  'RO-HD': 'the seat of Hunedoara county is Deva',
  'IN-LA': 'Leh is the capital of Ladakh; Kargil is its second seat',
  'PS-WBK': 'the West Bank is one piece here; Ramallah is where the government sits',
  'BZ-CY': 'the capital of Cayo is San Ignacio; Belmopan, the capital of the country, is in the same district',
  'VN-43': 'the same city: GeoNames calls it "Thành Phố Bà Rịa"',
};

/**
 * Regions where GeoNames has several seats and the one here is the right one. Either the region holds the
 * capital of the country besides its own seat (Ontario, North Holland, Montserrado), or the map still
 * draws divisions that have since been split and GeoNames marks the seats of the new ones (the provinces
 * of Kenya and Madagascar, the regions of Ghana, the ten states of South Sudan), or two cities share the
 * role (Lubusz, the Canaries).
 */
const AMONG_SEVERAL_OK = new Set(
  `AR-B BD-C BI-BR CA-ON DK-84 ES-CN GB-ENG GH-BA GH-NP GH-TV GH-WP ID-KI IN-DH IN-DL JM-02 KE-200 KE-300 KE-400 KE-500 KE-600 KE-700 KE-800
   KH-12 KH-3 KR-43 KZ-KZY KZ-YUZ LB-AS LB-BI LR-MO LS-C LU-D LU-L MG-A MG-D MG-F MG-M MG-T MG-U ML-6 ML-7 MM-04 MN-063 MR-NKC NL-NH PA-8
   PG-SHM PG-WHM PL-LB RU-KYA SD-KS SL-N SO-SOL SS-BN SS-BW SS-EC SS-EE SS-EW SS-JG SS-LK SS-NU SS-UY SZ-HH TN-11 TZ-14 VN-73 ZA-GT`.split(/\s+/),
);

/** Cities GeoNames files under another country, and are right here: "country name": why. */
const COUNTRY_OK = {
  'EH Esmara': 'Western Sahara is a territory of its own on this map; GeoNames files it under Morocco',
  'KE Namanga': 'a town on both sides of the border; the Kenyan side is the larger',
};

let gn;
try {
  gn = createRequire(import.meta.url)('all-the-cities');
} catch {
  console.error('This check needs GeoNames:  npm i --no-save all-the-cities@3.1.0');
  process.exit(2);
}

const key = (s) => norm(s).replace(/ /g, '');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(OUT, rel), 'utf8'));
const capitals = readJson('capitals.json').rc;
const cities = readJson('cities.json').c;
const km = (a, b) => geoDistance(a, b) * R_KM;
const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
const boxOf = (rings) => {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of rings)
    for (const p of ring) {
      b[0] = Math.min(b[0], p[0]);
      b[1] = Math.min(b[1], p[1]);
      b[2] = Math.max(b[2], p[0]);
      b[3] = Math.max(b[3], p[1]);
    }
  return b;
};
const inBox = (p, b, pad = 0) => p[0] >= b[0] - pad && p[0] <= b[2] + pad && p[1] >= b[1] - pad && p[1] <= b[3] + pad;
const nearRings = (p, rings) => {
  const cos = Math.cos((p[1] * Math.PI) / 180);
  let best = Infinity;
  for (const ring of rings) for (const q of ring) best = Math.min(best, ((q[0] - p[0]) * cos) ** 2 + (q[1] - p[1]) ** 2);
  return Math.sqrt(best) * 111.2;
};

// GeoNames by country, and on a grid of one degree for "what is near here".
const byCountry = new Map();
const grid = new Map();
for (const c of gn) {
  const at = c.loc.coordinates;
  const place = { n: c.name, alt: c.altName, fc: c.featureCode, p: c.population, at, cc: c.country };
  if (!byCountry.has(c.country)) byCountry.set(c.country, []);
  byCountry.get(c.country).push(place);
  const cell = `${Math.floor(at[0])},${Math.floor(at[1])}`;
  if (!grid.has(cell)) grid.set(cell, []);
  grid.get(cell).push(place);
}
const near = (ll, radius) => {
  const found = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (const c of grid.get(`${Math.floor(ll[0]) + dx},${Math.floor(ll[1]) + dy}`) ?? []) {
        const d = km(ll, c.at);
        if (d <= radius) found.push([d, c]);
      }
  return found.sort((a, b) => a[0] - b[0]);
};
const namesOf = (pl) => [pl.n, ...String(pl.alt ?? '').split(',')].filter(Boolean).map(key);

let unexpected = 0;
const head = (title) => console.log(`\n${title}`);

// ---------------------------------------------------------------- capitals of regions

head('Capitals of regions');
const tally = { same: 0, known: 0, unwitnessed: 0 };
const differs = [];
const several = [];
const spelt = [];
const alone = [];
for (const cc of Object.keys(capitals).sort()) {
  const t = readJson(`r/${cc}.json`);
  const fine = topo.feature(t, t.objects.f).features.map((f) => {
    const rings = polysOf(f.geometry).map((q) => q[0]);
    return { id: String(f.id), f, p: f.properties, rings, box: boxOf(rings) };
  });
  const places = (byCountry.get(cc) ?? []).filter((pl) => /^PPL(A|A2|C)$/.test(pl.fc));
  for (const pl of places) {
    let unit = fine.find((u) => u.p.q !== 0 && inBox(pl.at, u.box) && geoContains(u.f, pl.at));
    if (!unit) {
      // A seat on the coast falls outside a simplified outline: the nearest region, if it is at hand.
      let best = 12;
      for (const u of fine) {
        if (u.p.q === 0 || !inBox(pl.at, u.box, 0.5)) continue;
        const d = nearRings(pl.at, u.rings);
        if (d < best) {
          best = d;
          unit = u;
        }
      }
    }
    pl.u = unit?.id;
  }
  const mine = cities[cc] ?? [];
  for (const lv of Object.keys(capitals[cc])) {
    const groups = lv === 'f' ? null : new Map(t.objects[lv].geometries.map((g) => [String(g.id), g.properties]));
    for (const [id, names] of Object.entries(capitals[cc][lv])) {
      const members = new Set(lv === 'f' ? [id] : (groups.get(id)?.m ?? []));
      const title = (lv === 'f' ? fine.find((u) => u.id === id)?.p : groups.get(id))?.n?.es ?? id;
      const inside = places.filter((pl) => pl.u && members.has(pl.u));
      const seats = inside.filter((pl) => pl.fc !== 'PPLA2');
      const keys = names.map(key);
      const own = mine.find((x) => keys.includes(key(x.n.es)) || keys.includes(key(x.n.en ?? '')));
      const named = (pl) => namesOf(pl).some((n) => keys.includes(n));
      const close = (pl) => !!own && km(own.ll, pl.at) < 12;
      const line = `${id} ${title}: ${names[0]} · GeoNames: ${seats.map((s) => `${s.n}${s.fc === 'PPLC' ? ' (capital of the country)' : ''}`).join(', ') || '—'}`;
      if (!seats.length) {
        // No first-order seat inside: the level is a finer one (provinces, departments), or GeoNames
        // has no seat there. A second-order seat that matches is as good a witness.
        if (inside.some((pl) => named(pl) || close(pl))) tally.same++;
        else {
          tally.unwitnessed++;
          alone.push(line);
        }
      } else if (seats.some(named)) {
        if (seats.length === 1) tally.same++;
        else if (AMONG_SEVERAL_OK.has(id)) tally.known++;
        else several.push(line);
      } else if (seats.some(close)) {
        // Another spelling of the same city, nearly always; now and then the twin town across the river
        // (Omdurman for Khartoum, Maxixe for Inhambane), which is why they are printed.
        tally.same++;
        spelt.push(line);
      } else if (DIFFERENT_OK[id]) tally.known++;
      else differs.push(line);
    }
  }
}
const show = (title, lines) => {
  if (!lines.length) return;
  console.log(`  ${title}`);
  for (const l of lines) console.log(`    ${l}`);
};
show('Not among the seats GeoNames has in the region:', differs);
show('One of several seats GeoNames has in the region:', several);
if (process.argv.includes('--spellings')) show('Near a seat that goes by another name (a spelling, or a twin town?):', spelt);
if (process.argv.includes('--alone')) show('With no seat of GeoNames in the region to compare with:', alone);
unexpected += differs.length + several.length;
console.log(`  ${tally.same} agree (${spelt.length} of them under another spelling: --spellings lists them) · ${tally.known} looked at and right, listed in this file · ${tally.unwitnessed} that GeoNames says nothing about · ${differs.length + several.length} to look at`);

// ---------------------------------------------------------------- the country of every city

head('Cities filed under another country');
let abroad = 0;
for (const [cc, list] of Object.entries(cities))
  for (const x of list) {
    const names = [x.n.es, x.n.en, ...(x.al ?? [])].filter(Boolean).map(key);
    const called = near(x.ll, 25).filter(([, c]) => namesOf(c).some((n) => names.includes(n)));
    if (!called.length || called.some(([, c]) => c.cc === cc)) continue;
    if (COUNTRY_OK[`${cc} ${x.n.es}`]) continue;
    abroad++;
    unexpected++;
    console.log(`  ${cc} ${x.n.es}: GeoNames has ${called[0][1].n} in ${called[0][1].cc}, ${Math.round(called[0][0])} km away`);
  }
console.log(`  ${abroad} to look at`);

// ---------------------------------------------------------------- populations out of nowhere

head('Big cities with nobody around');
let ghosts = 0;
for (const [cc, list] of Object.entries(cities)) {
  [...list]
    .sort((a, b) => b.p - a.p)
    .slice(0, 25)
    .forEach((x, i) => {
      if (x.p < 200000) return;
      const people = near(x.ll, 40).reduce((sum, [, c]) => sum + c.p, 0);
      // An urban area is counted more generously than the towns in it, but not twenty times over.
      if (people * 20 >= x.p) return;
      ghosts++;
      console.log(`  ${cc} #${i + 1} ${x.n.es}: ${x.p.toLocaleString('en')} here · ${people.toLocaleString('en')} in GeoNames within 40 km`);
    });
}
console.log(`  ${ghosts} to look at (not counted as errors: GeoNames lacks the figure of some cities)`);

console.log(unexpected ? `\n${unexpected} differences to look at.` : '\nNothing new to look at.');
process.exit(unexpected ? 1 : 0);
