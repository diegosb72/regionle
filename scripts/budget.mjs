/**
 * Keeps the site from growing unnoticed: adds up what a first visit has to download and stops the build
 * when it goes over what has been allowed for it.
 *
 *   node scripts/budget.mjs <build folder>
 *
 * Sizes are the compressed ones (gzip), which is what travels. The limits leave some room over what the
 * site weighs today; raise one only when what it buys is worth the wait it costs.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/** kB, compressed. */
export const LIMITS = {
  /** The page itself: the heaviest of the pages of the site, which only differ in their head. */
  html: 5,
  /** Scripts fetched before anything is drawn: the entry and what it imports from the start. */
  script: 130,
  /** Style sheets. */
  style: 26,
  /** The typefaces asked for with the page. */
  fonts: 110,
  /** The heaviest script of those fetched only when their screen is opened. */
  chunk: 60,
};

const out = path.resolve(process.argv[2] ?? 'dist');
const page = path.join(out, 'index.html');
if (!fs.existsSync(page)) {
  console.error(`No hay ningún sitio compilado en ${out}`);
  process.exit(1);
}

const html = fs.readFileSync(page, 'utf8');
const gz = (file) => zlib.gzipSync(fs.readFileSync(path.join(out, file)), { level: 9 }).length;
const rel = (href) => href.replace(/^\.\//, '').split(/[?#]/)[0];
const tags = (re) => [...html.matchAll(re)].map((m) => rel(m[1]));
const attr = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
const links = [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]);
const linked = (test) => links.filter(test).map((tag) => rel(attr(tag, 'href') ?? ''));

const first = {
  script: [...tags(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/g), ...linked((t) => attr(t, 'rel') === 'modulepreload')],
  style: linked((t) => attr(t, 'rel') === 'stylesheet'),
  fonts: linked((t) => attr(t, 'rel') === 'preload' && attr(t, 'as') === 'font'),
};
const assets = fs.existsSync(path.join(out, 'assets')) ? fs.readdirSync(path.join(out, 'assets')).map((f) => `assets/${f}`) : [];
const lazy = assets.filter((f) => f.endsWith('.js') && !first.script.includes(f)).map((f) => ({ file: f, bytes: gz(f) }));
const heaviest = lazy.sort((a, b) => b.bytes - a.bytes)[0] ?? { file: '—', bytes: 0 };

const sum = (files) => files.reduce((n, f) => n + gz(f), 0);
const pages = fs
  .readdirSync(out)
  .filter((f) => f.endsWith('.html'))
  .map((f) => ({ file: f, bytes: gz(f) }))
  .sort((a, b) => b.bytes - a.bytes);
const rows = [
  ['html', 'página', pages[0].bytes, `${pages[0].file}, la mayor de ${pages.length}`],
  ['script', 'guiones de la primera carga', sum(first.script), `${first.script.length} archivos`],
  ['style', 'estilos', sum(first.style), `${first.style.length} archivos`],
  ['fonts', 'tipografías pedidas con la página', sum(first.fonts), `${first.fonts.length} archivos`],
  ['chunk', 'mayor guion bajo demanda', heaviest.bytes, heaviest.file],
];

const kb = (n) => (n / 1024).toFixed(1).replace('.', ',');
let over = 0;
for (const [key, name, bytes, what] of rows) {
  const limit = LIMITS[key];
  const bad = bytes > limit * 1024;
  if (bad) over++;
  console.log(`tamaño · ${bad ? '✗' : '✓'} ${name}: ${kb(bytes)} kB de ${limit} (${what})`);
}
if (!first.script.length || !first.style.length) {
  console.error('tamaño · no se han encontrado en index.html el guion o los estilos de la primera carga');
  process.exit(1);
}
// The icons of the other screens have a file of their own so as not to travel with the page (vite.config.ts).
const strays = first.script.filter((f) => /(^|\/)icons-more-/.test(f));
if (strays.length) {
  console.error(`tamaño · ✗ los iconos de las demás pantallas viajan con la página (${strays.join(', ')}): la primera pantalla usa uno que vite.config.ts no ha visto.`);
  process.exit(1);
}
if (over) {
  console.error(`tamaño · ${over === 1 ? 'un límite superado' : `${over} límites superados`}: aligera el sitio o sube el límite en scripts/budget.mjs si lo vale.`);
  process.exit(1);
}
