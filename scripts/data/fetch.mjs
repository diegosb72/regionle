// Downloads the pinned source datasets into .cache/src (git-ignored).
//
//   npm run data:fetch
//
// Sources
//   · Natural Earth 1:10m cultural vectors (public domain)
//       https://github.com/nvkelso/natural-earth-vector @ ca96624 (v5.1.2+)
//   · World Bank total population (SP.POP.TOTL), as packaged by datasets/population (ODC-PDDL)
//       https://github.com/datasets/population @ d4b1a4a
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

const FILES = [
  { ...NE, file: 'ne_10m_admin_1_states_provinces_lakes.geojson', sha: 'c4a7366cd343d5e3df150c048e0a4e0f3bf02b1b' },
  { ...NE, file: 'ne_10m_admin_1_states_provinces.geojson', sha: '4a8438f98ac7dfec7dc1739b1eaf91398ad33f22' },
  { ...NE, file: 'ne_10m_admin_0_countries_lakes.geojson', sha: 'b1b4126e95fecca261e8e0c198357531df5f5a91' },
  { ...NE, file: 'ne_10m_admin_0_map_units.geojson', sha: '003025bf947f0c083318dfdb86a69b8dd0678947' },
  { ...NE, file: 'ne_10m_admin_0_disputed_areas.geojson', sha: '20866d163d8e7557bb9808d286060229f79e2e42' },
  { ...NE, file: 'ne_10m_populated_places.geojson', sha: '376fb028c390a7a23213800ae4babaa6f534a0f3' },
  { ...POP, file: 'population.csv', sha: '4a07ae0fbf5610d7bd2de9aea41f783ee1e0aea7' },
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
  const dest = path.join(OUT, f.file);
  if (fs.existsSync(dest) && blobSha(fs.readFileSync(dest)) === f.sha) {
    console.log(`✓ ${f.file} (cached)`);
    continue;
  }
  process.stdout.write(`↓ ${f.file} … `);
  const buf = await download(f, tok);
  const got = blobSha(buf);
  if (got !== f.sha) throw new Error(`Checksum mismatch for ${f.file}: expected ${f.sha}, got ${got}`);
  fs.writeFileSync(dest, buf);
  console.log(`${(buf.length / 1e6).toFixed(1)} MB`);
}
console.log('Sources ready in .cache/src');
