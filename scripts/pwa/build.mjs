/**
 * Last step of the build: makes the built site installable and able to work without a connection.
 *
 *   node scripts/pwa/build.mjs <build folder>
 *
 * Writes into the build folder:
 *   sw.js         the service worker (scripts/pwa/sw.js) with the version and the files of the application
 *   offline.json  what "download everything" has to fetch (maps of every country, cities, physical
 *                 geography, flags) and how much it weighs once compressed
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] ?? 'dist');
if (!fs.existsSync(path.join(out, 'index.html'))) {
  console.error(`No hay ningún sitio compilado en ${out}`);
  process.exit(1);
}

/** Every file of the build, as paths with forward slashes relative to it. */
function walk(dir, base = '') {
  const list = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) list.push(...walk(path.join(dir, entry.name), rel));
    else list.push(rel);
  }
  return list;
}

const GENERATED = new Set(['sw.js', 'offline.json']);
/** Read by search engines and social networks, never by the game: neither stored nor counted in the version. */
const forCrawlers = (f) => f === 'robots.txt' || f === 'sitemap.xml' || /^social-[\w-]+\.png$/.test(f);
const files = walk(out)
  .filter((f) => !GENERATED.has(f) && !f.startsWith('.') && !forCrawlers(f))
  .sort();
const digest = (list) => {
  const h = createHash('sha1');
  for (const f of list) h.update(f).update('\0').update(fs.readFileSync(path.join(out, f)));
  return h.digest('hex').slice(0, 12);
};

/** Needed to open the application at all: stored when the worker is installed. */
const WORLD = ['data/index.json', 'data/world.json'];
const isPack = (f) => (f.startsWith('data/') && !WORLD.includes(f)) || f.startsWith('flags/');
const pack = files.filter(isPack);
const zipped = (f) => zlib.gzipSync(fs.readFileSync(path.join(out, f)), { level: 6 }).length;
const offline = { dv: digest(pack), bytes: pack.reduce((n, f) => n + zipped(f), 0), files: pack };
fs.writeFileSync(path.join(out, 'offline.json'), JSON.stringify(offline));

const shell = [...files.filter((f) => !isPack(f)), 'offline.json'].sort();
// Hashed names (assets/…) are safe to take from the browser's cache; the rest is asked again.
const fresh = shell.filter((f) => !f.startsWith('assets/') && !WORLD.includes(f));
const version = createHash('sha1')
  .update(digest(files))
  .update(JSON.stringify(offline))
  .update(fs.readFileSync(path.join(here, 'sw.js')))
  .digest('hex')
  .slice(0, 12);

const source = fs
  .readFileSync(path.join(here, 'sw.js'), 'utf8')
  .replace("'__VERSION__'", JSON.stringify(version))
  .replace('__SHELL__', JSON.stringify(shell))
  .replace('__FRESH__', JSON.stringify(fresh));
if (/__(VERSION|SHELL|FRESH)__/.test(source)) throw new Error('sw.js: quedan marcas sin sustituir');
fs.writeFileSync(path.join(out, 'sw.js'), source);

const kb = (n) => `${Math.round(n / 1024)} kB`;
const shellBytes = shell.reduce((n, f) => n + zipped(f), 0);
console.log(`pwa · versión ${version}`);
console.log(`pwa · aplicación: ${shell.length} archivos, ${kb(shellBytes)} comprimidos`);
console.log(`pwa · descarga completa: ${pack.length} archivos, ${kb(offline.bytes)} comprimidos`);
