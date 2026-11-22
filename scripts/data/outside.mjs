// Brings the source data that are kept outside GitHub, npm and PyPI.
//
//   npm run data:outside                    every source, and whether each place they come from answers
//   npm run data:outside -- --only a,b      some of them (`reach` is the look at the places)
//   npm run data:outside -- --list          what there is to bring
//   npm run data:outside -- --verdict       exit 1 when the last run left something unread
//
// Why it exists: the place where the game is written reaches GitHub, npm and PyPI and nothing else, and
// some of what the roadmap asks for is kept elsewhere (Wikidata, Wikimedia Commons, geoBoundaries…). So
// this script is run by GitHub itself. The workflow "Traer datos" (.github/workflows/datos.yml, which the
// owner of the repository copies by hand from scripts/data/traer-datos.yml) runs it when its button is
// pressed and keeps what it writes in the branch `datos` of this repository. From there `data:fetch` can
// take each file by its blob SHA, like any other source.
//
// A source that cannot be read does not stop the others: what was read is kept, and the report says what
// happened to each (estado.json for a program, LEEME.md for a person). `--verdict` turns that report into
// an exit code, so that the run on GitHub ends in red after having saved what it could.
//
// A data file says where it comes from and under which licence, and never when it was fetched: the same
// answer from the source is the same file, and a file of the branch only changes when its data do. When a
// run happened is in the report.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const OUT = path.resolve(ROOT, value('out') ?? process.env.OUTSIDE_OUT ?? '.cache/outside');
const ONLY = (value('only') ?? process.env.OUTSIDE_ONLY ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
/** Who asks: Wikimedia answers a program only when it says what it is and where to find its owner. */
const AGENT = 'regionle-data/1.0 (https://github.com/diegosb72/regionle)';
const WDQS = process.env.OUTSIDE_WDQS ?? 'https://query.wikidata.org/sparql';
/** The wait between two questions to the same place, and the first wait before asking again, in ms. */
const PAUSE = Number(process.env.OUTSIDE_PAUSE ?? 500);
const ON_GITHUB = !!process.env.GITHUB_ACTIONS;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));
const kB = (bytes) => `${(bytes / 1000).toLocaleString('es', { maximumFractionDigits: bytes < 10_000 ? 1 : 0 })} kB`;
/** Git's name for a file: what `data:fetch` asks GitHub for. */
const blobSha = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
const short = (err) => String(err?.cause?.code ?? err?.cause?.message ?? err?.message ?? err).slice(0, 200);

/* ------------------------------------------------------------------ asking */

/** How long a place asks to be left alone, in ms: it says so in seconds or with a date. */
function retryAfter(res) {
  const said = res.headers.get('retry-after');
  if (!said) return null;
  const ms = /^\d+$/.test(said.trim()) ? Number(said) * 1000 : Date.parse(said) - Date.now();
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/**
 * The body of an answer. A place that is busy (429) or broken for a moment (5xx), or that does not answer,
 * is asked again a few times, each time after a longer wait; any other refusal is final.
 */
async function request(url, { method = 'GET', headers = {}, body, timeout = 60_000, tries = 4 } = {}) {
  let last;
  for (let n = 0; n < tries; n++) {
    let wait = PAUSE * 4 ** n;
    try {
      const res = await fetch(url, { method, headers: { 'User-Agent': AGENT, ...headers }, body, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
      if (res.ok) return { status: res.status, body: Buffer.from(await res.arrayBuffer()) };
      await res.arrayBuffer().catch(() => {});
      last = new Error(`HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`);
      if (res.status !== 429 && res.status < 500) throw Object.assign(last, { final: true });
      // Never more than two minutes: a run that waits longer is better started again.
      wait = Math.min(retryAfter(res) ?? wait, 120_000);
    } catch (err) {
      if (err.final) throw err;
      last = err;
    }
    if (n < tries - 1) await sleep(wait);
  }
  throw last;
}

/** The rows that Wikidata answers a question with. */
async function sparql(query) {
  const { body } = await request(WDQS, {
    method: 'POST',
    headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: `query=${encodeURIComponent(query)}`,
    timeout: 90_000,
  });
  const rows = JSON.parse(body.toString('utf8'))?.results?.bindings;
  if (!Array.isArray(rows)) throw new Error('Wikidata answered something that is not a table');
  return rows;
}

/* ------------------------------------------------------------------ what the game already has */

const QID = /^Q[1-9]\d*$/;
const byNumber = (a, b) => Number(a.slice(1)) - Number(b.slice(1));

/** The Wikidata id of every division of the maps of the game that has one. */
function regionIds() {
  const dir = path.join(ROOT, 'public/data/r');
  const ids = new Set();
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const topology = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    for (const object of Object.values(topology.objects ?? {})) for (const g of object.geometries ?? []) if (QID.test(g.properties?.wd ?? '')) ids.add(g.properties.wd);
  }
  return [...ids].sort(byNumber);
}

/* ------------------------------------------------------------------ the sources */

/** A JSON file with one entry to a line: a change in the data is a change in a few lines. */
function lined(head, items) {
  const keys = Object.keys(items).sort(byNumber);
  const lines = keys.map((k, i) => `${JSON.stringify(k)}: ${JSON.stringify(items[k])}${i < keys.length - 1 ? ',' : ''}`);
  const top = Object.entries(head).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  return `{\n${top.join('\n')}\n"items": {\n${lines.join('\n')}\n}\n}\n`;
}

/**
 * How many people live in each division, as Wikidata has it: of the statements of best rank (the one marked
 * as the figure to use or, where none is, all that are not withdrawn), the three newest, each with the day
 * it is of when the statement says so. Which one the game shows is for the build to choose.
 */
async function regionPopulation(source) {
  const ids = regionIds();
  if (!ids.length) throw new Error('No division of public/data/r has a Wikidata id');
  const found = new Map();
  for (const part of chunks(ids, 250)) {
    const rows = await sparql(
      `SELECT ?item ?pop ?date WHERE { VALUES ?item { ${part.map((q) => `wd:${q}`).join(' ')} } ?item p:P1082 ?st . ?st a wikibase:BestRank ; ps:P1082 ?pop . OPTIONAL { ?st pq:P585 ?date } }`,
    );
    for (const row of rows) {
      const id = String(row.item?.value ?? '').split('/').pop();
      const pop = Number(row.pop?.value);
      if (!QID.test(id) || !Number.isFinite(pop) || pop < 0) continue;
      const day = /^\d{4}-\d{2}-\d{2}/.exec(row.date?.value ?? '')?.[0] ?? null;
      const list = found.get(id) ?? [];
      if (!list.some(([p, d]) => p === pop && d === day)) list.push([pop, day]);
      found.set(id, list);
    }
    await sleep(PAUSE);
  }
  const items = {};
  // The newest first; a figure with no day after those that have one, the largest first.
  for (const [id, list] of found) items[id] = list.sort((a, b) => (b[1] ?? '').localeCompare(a[1] ?? '') || b[0] - a[0]).slice(0, 3);
  return {
    text: lined({ source: source.from, licence: source.licence, what: source.what, asked: ids.length }, items),
    note: `${found.size} de ${ids.length} divisiones tienen cifra`,
  };
}

/**
 * What there is to bring. `id` is what `--only` takes, `file` where it is kept in the branch, `needs` the
 * point of the roadmap that waits for it. `run` gives the text of the file and a note for the report.
 */
const SOURCES = [
  {
    id: 'wikidata-region-population',
    file: 'wikidata/region-population.json',
    from: 'Wikidata (https://www.wikidata.org)',
    licence: 'CC0 1.0',
    what: 'Population (P1082) of each division of the maps that has a Wikidata id: the statements of best rank, the newest first, as [people, day]',
    es: 'Población de las divisiones de los mapas',
    needs: '29',
    run: regionPopulation,
  },
];

/**
 * The places that the pending points of the roadmap would read from, each asked for something small: the
 * report says which of them answer from where this runs, before anything is built on them.
 */
const REACH = [
  { name: 'Wikidata, consultas', url: `${WDQS}?format=json&query=${encodeURIComponent('SELECT ?p WHERE { wd:Q29 wdt:P1082 ?p }')}`, headers: { Accept: 'application/sparql-results+json' } },
  // The other way to the same figures, should the query service refuse a program: one entity at a time.
  { name: 'Wikidata, fichas', url: 'https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=Q54936&property=P1082&format=json' },
  {
    name: 'Wikimedia Commons, fichas de los archivos',
    url: 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Cextmetadata&iiextmetadatafilter=LicenseShortName&titles=File%3AFlag%20of%20Texas.svg',
  },
  { name: 'Wikimedia Commons, archivos', url: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Flag_of_Texas.svg' },
  { name: 'geoBoundaries, fichas de los mapas', url: 'https://www.geoboundaries.org/api/current/gbOpen/KEN/ADM1/' },
  { name: 'geoBoundaries, archivos', url: 'https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/SSD/ADM1/geoBoundaries-SSD-ADM1-metaData.json' },
  { name: 'GeoNames, descargas', url: 'https://download.geonames.org/export/dump/countryInfo.txt' },
];

async function look({ name, url, headers }) {
  const started = Date.now();
  const host = new URL(url).host;
  try {
    const { status, body } = await request(url, { headers, timeout: 30_000, tries: 2 });
    return { name, host, ok: true, status, bytes: body.length, ms: Date.now() - started };
  } catch (err) {
    return { name, host, ok: false, error: short(err), ms: Date.now() - started };
  }
}

/* ------------------------------------------------------------------ the report */

const REPORT = path.join(OUT, 'estado.json');

/** What a run brought, for a person: the page of the branch, or (`brief`) the summary of the run on GitHub. */
function readme(report, brief = false) {
  const row = (cells) => `| ${cells.join(' | ')} |`;
  const lines = brief
    ? ['# Lo que se ha traído', '']
    : [
        '# Datos de fuera',
        '',
        'Esta rama no es el juego: guarda datos que el juego necesita y que no están en GitHub, npm ni PyPI.',
        'La escribe el flujo «Traer datos» (pestaña *Actions*) cuando alguien pulsa su botón; nadie más escribe aquí.',
        'Qué se trae y de dónde lo dice `scripts/data/outside.mjs`, en la rama del juego.',
        '',
        `## Última descarga: ${report.when.slice(0, 10)}`,
        '',
      ];
  lines.push(`Hecha con ${report.from ? `\`${report.from}\`` : 'una copia local'}. Lo que no se pidió esta vez sigue en la rama \`datos\` como estaba.`, '');
  if (report.sources.length) {
    lines.push(row(['Archivo', 'Qué es', 'De dónde', 'Licencia', 'Resultado']), row(['---', '---', '---', '---', '---']));
    for (const s of report.sources) lines.push(row([`\`${s.file}\``, s.es, s.from, s.licence, s.ok ? `${kB(s.bytes)} · ${s.note}` : `**sin leer**: ${s.error}`]));
    lines.push('');
  }
  if (report.reach.length) {
    lines.push('## Sitios que contestan', '', 'Una petición pequeña a cada sitio del que saldrían los puntos pendientes de la hoja de ruta:', '');
    lines.push(row(['Sitio', 'Servidor', 'Contesta']), row(['---', '---', '---']));
    for (const r of report.reach) lines.push(row([r.name, `\`${r.host}\``, r.ok ? `sí (${r.ms} ms)` : `**no**: ${r.error}`]));
    lines.push('');
  }
  return lines.join('\n');
}

function say(report) {
  const unread = report.sources.filter((s) => !s.ok).map((s) => `${s.es} (${s.id}): ${s.error}`);
  const silent = report.reach.filter((r) => !r.ok).map((r) => `${r.name} (${r.host}): ${r.error}`);
  if (ON_GITHUB) for (const line of unread) console.log(`::warning title=Fuente sin leer::${line}`);
  if (ON_GITHUB) for (const line of silent) console.log(`::warning title=No contesta::${line}`);
  const failed = [...unread, ...silent];
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${readme(report, true)}\n`);
  return failed;
}

/* ------------------------------------------------------------------ what was asked for */

if (flag('list')) {
  for (const s of SOURCES) console.log(`${s.id}\n  ${s.file} · ${s.from} · ${s.licence} · punto ${s.needs}\n  ${s.what}`);
  console.log(`reach\n  whether these answer: ${[...new Set(REACH.map((r) => new URL(r.url).host))].join(', ')}`);
  process.exit(0);
}

if (flag('verdict')) {
  // Nothing was run (a branch with nothing to bring): nothing to say.
  if (!fs.existsSync(REPORT)) process.exit(0);
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  const unread = report.sources.filter((s) => !s.ok).map((s) => `${s.es} (${s.id}): ${s.error}`);
  for (const line of unread) console.log(ON_GITHUB ? `::error title=Fuente sin leer::${line}` : `✗ ${line}`);
  if (unread.length) console.log(`Sin leer: ${unread.length} de ${report.sources.length}. Lo que sí se ha leído está guardado.`);
  process.exit(unread.length ? 1 : 0);
}

const unknown = ONLY.filter((id) => id !== 'reach' && !SOURCES.some((s) => s.id === id));
if (unknown.length) {
  console.error(`No hay ninguna fuente que se llame así: ${unknown.join(', ')}. Las que hay: ${[...SOURCES.map((s) => s.id), 'reach'].join(', ')}.`);
  process.exit(2);
}
const wanted = (id) => !ONLY.length || ONLY.includes(id);

fs.mkdirSync(OUT, { recursive: true });
const report = {
  when: new Date().toISOString(),
  from: process.env.GITHUB_SHA ? `${process.env.GITHUB_REF_NAME ?? ''}@${process.env.GITHUB_SHA.slice(0, 7)}` : null,
  sources: [],
  reach: [],
};

for (const source of SOURCES.filter((s) => wanted(s.id))) {
  const { run, ...about } = source;
  const started = Date.now();
  process.stdout.write(`↓ ${source.id} … `);
  try {
    const { text, note } = await run(source);
    const buf = Buffer.from(text, 'utf8');
    const dest = path.join(OUT, source.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    report.sources.push({ ...about, ok: true, bytes: buf.length, blob: blobSha(buf), note, ms: Date.now() - started });
    console.log(`${kB(buf.length)} · ${note}`);
  } catch (err) {
    report.sources.push({ ...about, ok: false, error: short(err), ms: Date.now() - started });
    console.log(`sin leer: ${short(err)}`);
  }
}

if (wanted('reach'))
  for (const place of REACH) {
    const seen = await look(place);
    report.reach.push(seen);
    console.log(`${seen.ok ? '✓' : '✗'} ${seen.name} (${seen.host})${seen.ok ? '' : `: ${seen.error}`}`);
  }

fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(OUT, 'LEEME.md'), readme(report));
const failed = say(report);
const where = path.relative(ROOT, REPORT).startsWith('..') ? REPORT : path.relative(ROOT, REPORT);
console.log(`Hecho${failed.length ? `; sin leer: ${failed.length}` : ''}. El informe está en ${where}.`);
