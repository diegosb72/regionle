// Downloads the pinned source datasets into .cache/src (git-ignored).
//
//   npm run data:fetch
//
// Sources
//   · Natural Earth cultural and physical vectors, 1:10m and 1:50m (public domain)
//       https://github.com/nvkelso/natural-earth-vector @ ca96624 (v5.1.2+)
//   · World Bank total population (SP.POP.TOTL), as packaged by datasets/population (ODC-PDDL)
//       https://github.com/datasets/population @ d4b1a4a
//   · Atlas Nacional de España (ANE), CartoBase at 1:3 000 000: rivers, reservoirs and heights of Spain
//     (CC BY 4.0 ign.es), as the Instituto Geográfico Nacional published them and rOpenSpain keeps them
//       https://github.com/rOpenSpain/mapSpain/tree/sianedata @ 3652863
//   · The World Factbook (CIA, public domain) as factbook.json keeps it (CC0): the surface of each ocean
//     and of each continent, which are figures that no outline on a map gives, and the seas that each
//     ocean's figure counts as its own
//       https://github.com/factbook/factbook.json @ 144d697
//
// Files are fetched by Git blob SHA, so the build is reproducible and the
// download is verified for free. With a GitHub token available (GH_TOKEN,
// GITHUB_TOKEN or the `gh` CLI) the API is used; otherwise the script falls
// back to raw.githubusercontent.com at the pinned commit.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, '.cache/src');

const NE = { repo: 'nvkelso/natural-earth-vector', commit: 'ca96624a56bd078437bca8184e78163e5039ad19', dir: 'geojson/' };
const POP = { repo: 'datasets/population', commit: 'd4b1a4a9a17e2123baf0ef119de05bceced1ab1b', dir: 'data/' };
const ANE = { repo: 'rOpenSpain/mapSpain', commit: '365286363cab2266d81f981093525edd50e2ce15', dir: 'data-raw/2020/SIANE_CARTO_BASE_S_3M/todo/' };
const WFB = { repo: 'factbook/factbook.json', commit: '144d6977b2b01ac1cbd220de754c0a005616760b', dir: '' };

const FILES = [
  { ...NE, file: 'ne_10m_admin_1_states_provinces_lakes.geojson', sha: 'c4a7366cd343d5e3df150c048e0a4e0f3bf02b1b' },
  { ...NE, file: 'ne_10m_admin_1_states_provinces.geojson', sha: '4a8438f98ac7dfec7dc1739b1eaf91398ad33f22' },
  { ...NE, file: 'ne_10m_admin_0_countries_lakes.geojson', sha: 'b1b4126e95fecca261e8e0c198357531df5f5a91' },
  { ...NE, file: 'ne_10m_admin_0_map_units.geojson', sha: '003025bf947f0c083318dfdb86a69b8dd0678947' },
  { ...NE, file: 'ne_10m_admin_0_disputed_areas.geojson', sha: '20866d163d8e7557bb9808d286060229f79e2e42' },
  { ...NE, file: 'ne_10m_populated_places.geojson', sha: '376fb028c390a7a23213800ae4babaa6f534a0f3' },
  // Physical geography (scripts/data/physical.mjs).
  { ...NE, file: 'ne_10m_rivers_lake_centerlines.geojson', sha: '61a0d7137a6ff1113cc259525e7479c63d5fec86' },
  { ...NE, file: 'ne_10m_lakes.geojson', sha: 'e48ec603e0943b62f8c81960fb990bb6bab4a4a8' },
  { ...NE, file: 'ne_10m_geography_marine_polys.geojson', sha: 'bea6b3567d415123ca75123c2aa1619076bf2250' },
  { ...NE, file: 'ne_10m_geography_regions_polys.geojson', sha: 'b0af6a56d56c7903c9aa40df5b01813bb4334c94' },
  { ...NE, file: 'ne_50m_geography_marine_polys.geojson', sha: '530f9f9e07f0a9015e2075a8d0db480dc44a22b3' },
  { ...NE, file: 'ne_10m_geography_regions_elevation_points.geojson', sha: '86076ef74c48d1adca1eadefd2b22894795d070c' },
  { ...NE, file: 'ne_10m_geography_regions_points.geojson', sha: '75e2a7192111dee3464e90296d31cf5ad5cd7d1c' },
  { ...POP, file: 'population.csv', sha: '4a07ae0fbf5610d7bd2de9aea41f783ee1e0aea7' },
  // Spain in detail (scripts/data/spain.mjs): each layer is a shapefile and its table.
  { ...ANE, file: 'se89_3_hidro_rio_l_x.shp', sha: 'e7ef7a6152d0a08258bc8cdc0db7e6fe1802419e' },
  { ...ANE, file: 'se89_3_hidro_rio_l_x.dbf', sha: '489dbf75e314c6c7484d66fca171348e9e87234a' },
  { ...ANE, file: 'se89_3_hidro_rio_a_x.shp', sha: 'fd7fbc6dab849a6d6f981d5328e520329a7ff671' },
  { ...ANE, file: 'se89_3_hidro_rio_a_x.dbf', sha: 'f944c6ef59166f70b8f676064ce0de4c5a4b8245' },
  { ...ANE, file: 'se89_3_orog_hipso_a_x.shp', sha: 'd22c78152948bf57106c028ba318dab6ae756629' },
  { ...ANE, file: 'se89_3_orog_hipso_a_x.dbf', sha: 'b6b37d27a820dd8d2f3841a674ab3ac3529f900e' },
  // How big the oceans and the continents are (scripts/data/physical.mjs). The source files them under a code:
  // each is kept under a name that says what it is.
  { ...WFB, file: 'oceans/zn.json', as: 'factbook-pacific.json', sha: '0fac6216817c8e56e9b86d6e9cb813d514222371' },
  { ...WFB, file: 'oceans/zh.json', as: 'factbook-atlantic.json', sha: 'f970cc0fde3bad6556690489c904588d22cb7bec' },
  { ...WFB, file: 'oceans/xo.json', as: 'factbook-indian.json', sha: '7bde5e1f3ac0ec0ce74adad6759cb37986d62685' },
  { ...WFB, file: 'oceans/oo.json', as: 'factbook-southern.json', sha: 'cbc9c84cdd6d43db33ccd56bf9d48812a401108e' },
  { ...WFB, file: 'oceans/xq.json', as: 'factbook-arctic.json', sha: '234d9150c79292c1820cbcdb6178b9938d4f537a' },
  { ...WFB, file: 'world/xx.json', as: 'factbook-world.json', sha: 'b39e033c35e78768f1e09e26d9c7394c52238535' },
];

function token() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync('gh', ['auth', 'token'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch {
    return null;
  }
}

/** Git's blob hash: sha1("blob <size>\0" + content). */
function blobSha(buf) {
  return createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

async function download(f, tok) {
  const urls = [];
  if (tok) urls.push({ url: `https://api.github.com/repos/${f.repo}/git/blobs/${f.sha}`, headers: { Authorization: `Bearer ${tok}`, Accept: 'application/vnd.github.raw' } });
  urls.push({ url: `https://raw.githubusercontent.com/${f.repo}/${f.commit}/${f.dir}${f.file}`, headers: {} });
  let lastErr;
  for (const { url, headers } of urls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'regionle-data-fetch', ...headers } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

fs.mkdirSync(OUT, { recursive: true });
const tok = token();
for (const f of FILES) {
  const name = f.as ?? f.file;
  const dest = path.join(OUT, name);
  if (fs.existsSync(dest) && blobSha(fs.readFileSync(dest)) === f.sha) {
    console.log(`✓ ${name} (cached)`);
    continue;
  }
  process.stdout.write(`↓ ${name} … `);
  const buf = await download(f, tok);
  const got = blobSha(buf);
  if (got !== f.sha) throw new Error(`Checksum mismatch for ${name}: expected ${f.sha}, got ${got}`);
  fs.writeFileSync(dest, buf);
  console.log(`${(buf.length / 1e6).toFixed(1)} MB`);
}
console.log('Sources ready in .cache/src');
