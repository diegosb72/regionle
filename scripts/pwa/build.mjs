/**
 * Last step of the build: makes the built site installable and able to work without a connection.
 *
 *   node scripts/pwa/build.mjs <build folder>
 *
 * Writes into the build folder:
 *   sw.js         the service worker (scripts/pwa/sw.js) with the version, the files of the application and
 *                 the page that answers a visit to each page of the site (and to the pages of the maps, by
 *                 the word their names start with)
 *   offline.json  what "download everything" has to fetch (maps of every country, cities, physical
 *                 geography, the flags of the countries) and how much it weighs once compressed
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

/**
 * The pages next to the first one. `es.html` and `en.html` are the game in one language, each named after the
 * language it is written in. Any other (`regiones.html`, `regions.html`…) is the page of a screen: the page
 * of its language with the title and the description of that screen, which the game opens by its address.
 */
const langOf = (f) => /<html lang="([a-z]+)"/.exec(fs.readFileSync(path.join(out, f), 'utf8'))?.[1] ?? '';
const beside = walk(out)
  .filter((f) => /^[^/]+\.html$/.test(f) && f !== 'index.html')
  .sort();
const langPages = beside.filter((f) => f === `${langOf(f)}.html`);
/**
 * The pages of the maps of the countries (`mapa-es-espana.html`, `map-es-spain.html`): a word of the language,
 * the code of the country and its name. There are hundreds, so the worker is not given their names: it is told
 * which page answers for each of the words they start with.
 */
const MAP = /^([a-z]+)-[a-z][a-z0-9]-[a-z0-9]+(?:-[a-z0-9]+)*\.html$/;
const mapPages = new Set(beside.filter((f) => MAP.test(f)));
const maps = {};
for (const f of mapPages) {
  const word = MAP.exec(f)[1];
  const page = `${langOf(f)}.html`;
  if (!langPages.includes(page)) throw new Error(`pwa: ${f} está en un idioma que no tiene página (${page})`);
  if (maps[word] && maps[word] !== page) throw new Error(`pwa: las páginas que empiezan por «${word}-» están en más de un idioma`);
  maps[word] = page;
}
const screenPages = beside.filter((f) => !langPages.includes(f) && !mapPages.has(f) && langPages.includes(`${langOf(f)}.html`));
/** Which page answers a visit to each of them, asked for with or without its extension. */
const pages = {};
for (const f of langPages) pages[f] = pages[f.slice(0, -5)] = f;
for (const f of screenPages) pages[f] = pages[f.slice(0, -5)] = `${langOf(f)}.html`;

/**
 * Read by search engines and social networks, never by the game, which answers a visit to the page of a
 * screen with the page of its language: neither stored nor counted in the version.
 */
const forCrawlers = (f) => f === 'robots.txt' || f === 'sitemap.xml' || /^social-[\w-]+\.png$/.test(f) || screenPages.includes(f) || mapPages.has(f);
/**
 * The flags that come from Wikimedia Commons (scripts/data/flags.mjs): thousands of files, of which a
 * player sees a few. They are neither stored with the application nor part of what "download everything"
 * fetches: the worker keeps each one the first time it is shown, like any flag. Each is named after what it
 * holds, so the version of the site does not have to count them either: their list (data/flags.json) does.
 */
const commonsFlag = (f) => f.startsWith('flags/commons/');
/**
 * The photographs of the sheets of the countries, and their coats of arms (scripts/data/profiles.mjs), are
 * for whoever opens a sheet: like those flags, each is kept the first time it is shown, and none is stored
 * beforehand.
 */
const photograph = (f) => f.startsWith('photos/');
const onDemand = (f) => commonsFlag(f) || photograph(f);
const files = walk(out)
  .filter((f) => !GENERATED.has(f) && !f.startsWith('.') && !forCrawlers(f) && !onDemand(f))
  .sort();
const digest = (list) => {
  const h = createHash('sha1');
  for (const f of list) h.update(f).update('\0').update(fs.readFileSync(path.join(out, f)));
  return h.digest('hex').slice(0, 12);
};

/** Needed to open the application at all: stored when the worker is installed. */
const WORLD = ['data/index.json', 'data/world.json'];
/** A country flag whose content changed at its usual URL must replace old copies in the data cache. */
const revisedFlags = new Set(fs.readdirSync(path.join(here, '../data/flag-overrides')).map((name) => `flags/${name}`));
const isPack = (f) => (f.startsWith('data/') && !WORLD.includes(f)) || (f.startsWith('flags/') && !revisedFlags.has(f));
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
  .update(JSON.stringify(pages))
  .update(JSON.stringify(maps))
  .update(fs.readFileSync(path.join(here, 'sw.js')))
  .digest('hex')
  .slice(0, 12);

const source = fs
  .readFileSync(path.join(here, 'sw.js'), 'utf8')
  .replace("'__VERSION__'", JSON.stringify(version))
  .replace('__SHELL__', JSON.stringify(shell))
  .replace('__FRESH__', JSON.stringify(fresh))
  .replace('__PAGES__', JSON.stringify(pages))
  .replace('__MAPS__', JSON.stringify(maps));
if (/__(VERSION|SHELL|FRESH|PAGES|MAPS)__/.test(source)) throw new Error('sw.js: quedan marcas sin sustituir');
fs.writeFileSync(path.join(out, 'sw.js'), source);

const kb = (n) => `${Math.round(n / 1024)} kB`;
const shellBytes = shell.reduce((n, f) => n + zipped(f), 0);
console.log(`pwa · versión ${version}`);
console.log(`pwa · aplicación: ${shell.length} archivos, ${kb(shellBytes)} comprimidos`);
console.log(`pwa · páginas: ${langPages.length} de idioma, guardadas; ${screenPages.length} de pantalla y ${mapPages.size} de mapa, que contesta la de su idioma`);
console.log(`pwa · descarga completa: ${pack.length} archivos, ${kb(offline.bytes)} comprimidos`);
for (const [what, mine] of [['banderas de Wikimedia Commons', commonsFlag], ['fotografías y escudos de las fichas', photograph]]) {
  const later = walk(out).filter(mine);
  if (later.length) console.log(`pwa · ${what}, que se guardan al verse: ${later.length} archivos, ${kb(later.reduce((n, f) => n + fs.statSync(path.join(out, f)).size, 0))}`);
}
