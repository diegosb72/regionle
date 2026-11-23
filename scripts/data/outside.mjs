// Brings the source data that are kept outside GitHub, npm and PyPI.
//
//   npm run data:outside                    every source, and whether each place they come from answers
//   npm run data:outside -- --only a,b      some of them (`reach` is the look at the places)
//   npm run data:outside -- --asked file    those that a file names, one to a line (`--only` comes first)
//   npm run data:outside -- --list          what there is to bring
//   npm run data:outside -- --verdict       exit 1 when the last run left something unread
//
// Why it exists: the place where the game is written reaches GitHub, npm and PyPI and nothing else, and
// some of what the roadmap asks for is kept elsewhere (Wikidata, Wikimedia Commons, geoBoundaries…). So
// this script is run by GitHub itself. The workflow "Traer datos" (.github/workflows/datos.yml, which the
// owner of the repository copies by hand from scripts/data/traer-datos.yml) runs it when its button is
// pressed, or when a branch changes the list of what it asks for (scripts/data/pedido.txt), and keeps what
// it writes in the branch `datos` of this repository. From there `data:fetch` can take each file by its
// blob SHA, like any other source.
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
/** Where the maps of the game are: what there is to ask about is read from them. */
const DATA = path.resolve(ROOT, value('data') ?? process.env.OUTSIDE_DATA ?? 'public/data');
/** A file that names what to bring: what a branch asks GitHub for (scripts/data/pedido.txt). */
const ASKED = value('asked') ?? process.env.OUTSIDE_ASKED ?? '';
const names = (text, between) => text.split(between).map((s) => s.trim()).filter(Boolean);
const SAID = names(value('only') ?? process.env.OUTSIDE_ONLY ?? '', ',');
/** Who asks: Wikimedia answers a program only when it says what it is and where to find its owner. */
const AGENT = 'regionle-data/1.0 (https://github.com/diegosb72/regionle)';
const WDQS = process.env.OUTSIDE_WDQS ?? 'https://query.wikidata.org/sparql';
/** The wait between two questions to the same place, and the first wait before asking again, in ms. */
const PAUSE = Number(process.env.OUTSIDE_PAUSE ?? 500);
/**
 * How long a source may go on looking for what it can do without, in ms, once it has what it cannot. The
 * run on GitHub is stopped at half an hour with nothing saved: better to keep less than to lose it all.
 */
const PATIENCE = Number(process.env.OUTSIDE_PATIENCE ?? 12 * 60_000);
/**
 * A place that takes this long to say no, in ms, was working on the answer and did not finish (the query
 * service gives up at a minute). That is not the same as being refused: the same question would take as
 * long again, and a smaller one may well be answered.
 */
const SLOW = Number(process.env.OUTSIDE_SLOW ?? 20_000);
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
 * is asked again a few times, each time after a longer wait; any other refusal is final. The error of a
 * place that was slow to fail says so (`slow`), and whoever is `impatient` is not made to wait for it twice.
 */
async function request(url, { method = 'GET', headers = {}, body, timeout = 60_000, tries = 4, impatient = false } = {}) {
  let last;
  for (let n = 0; n < tries; n++) {
    let wait = PAUSE * 4 ** n;
    const started = Date.now();
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
    last.slow = Date.now() - started >= SLOW;
    if (impatient && last.slow) break;
    if (n < tries - 1) await sleep(wait);
  }
  throw last;
}

/** The rows that Wikidata answers a question with. */
async function sparql(query, { tries, impatient } = {}) {
  const { body } = await request(WDQS, {
    method: 'POST',
    headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: `query=${encodeURIComponent(query)}`,
    timeout: 90_000,
    tries,
    impatient,
  });
  const rows = JSON.parse(body.toString('utf8'))?.results?.bindings;
  if (!Array.isArray(rows)) throw new Error('Wikidata answered something that is not a table');
  return rows;
}

/** The rows of a question about a long list, asked a part at a time. */
async function inParts(list, size, question, opts) {
  const rows = [];
  for (const part of chunks(list, size)) {
    rows.push(...(await sparql(question(part), opts)));
    await sleep(PAUSE);
  }
  return rows;
}

/* ------------------------------------------------------------------ what the game already has */

const QID = /^Q[1-9]\d*$/;
/** An id of a division that is its ISO 3166-2 code, and not a number of the source of the maps. */
const ISO = /^[A-Z]{2}-[A-Z0-9]{1,3}$/;
const byNumber = (a, b) => Number(a.slice(1)) - Number(b.slice(1));

/**
 * The divisions of the finest level of every map that has more than one: the id each has in the game, its
 * map, the Wikidata id of its country, of the state that country depends on and its own (where the source
 * of the maps gave one), its names and its area in km². A map of a single piece is its country, whose
 * figures the game already has.
 */
function divisions() {
  const index = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8'));
  const countries = new Map((index.countries ?? []).map((c) => [c.id, c]));
  const list = [];
  for (const file of fs.readdirSync(path.join(DATA, 'r')).filter((f) => f.endsWith('.json')).sort()) {
    const units = JSON.parse(fs.readFileSync(path.join(DATA, 'r', file), 'utf8')).objects?.f?.geometries ?? [];
    if (units.length < 2) continue;
    const map = file.slice(0, -5);
    const about = countries.get(map);
    const [country, sovereign] = [about?.wd, countries.get(about?.sov)?.wd].map((id) => (QID.test(id ?? '') ? id : null));
    for (const g of units) {
      const p = g.properties ?? {};
      list.push({
        id: String(g.id),
        map,
        country,
        sovereign,
        wd: QID.test(p.wd ?? '') ? p.wd : null,
        en: p.n?.en ?? p.n?.es ?? null,
        es: p.n?.es ?? null,
        area: Number(p.ar) > 0 ? Number(p.ar) : null,
      });
    }
  }
  return list;
}

/* ------------------------------------------------------------------ what Wikidata is asked */

const entity = (cell) => {
  const id = String(cell?.value ?? '').split('/').pop();
  return QID.test(id) ? id : null;
};
const wd = (ids) => ids.map((q) => `wd:${q}`).join(' ');
/** A text as SPARQL writes it, in a language when one is given. */
const literal = (text, lang) => `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"${lang ? `@${lang}` : ''}`;
const group = (map, key, one) => map.set(key, (map.get(key) ?? new Set()).add(one));

/**
 * How many people live in each entity, as Wikidata has it: of the statements of best rank (the one marked
 * as the figure to use or, where none is, all that are not withdrawn), the three newest, each with the day
 * it is of when the statement says so. A figure with no day comes after those that have one.
 */
async function figuresOf(ids, opts) {
  const found = new Map();
  const rows = await inParts(ids, 250, (part) => `SELECT ?item ?pop ?date WHERE { VALUES ?item { ${wd(part)} } ?item p:P1082 ?st . ?st a wikibase:BestRank ; ps:P1082 ?pop . OPTIONAL { ?st pq:P585 ?date } }`, opts);
  for (const row of rows) {
    const id = entity(row.item);
    const pop = Number(row.pop?.value);
    if (!id || !Number.isFinite(pop) || pop < 0) continue;
    const day = /^\d{4}-\d{2}-\d{2}/.exec(row.date?.value ?? '')?.[0] ?? null;
    const list = found.get(id) ?? [];
    if (!list.some(([p, d]) => p === pop && d === day)) list.push([pop, day]);
    found.set(id, list);
  }
  for (const [id, list] of found) found.set(id, list.sort((a, b) => (b[1] ?? '').localeCompare(a[1] ?? '') || b[0] - a[0]).slice(0, 3));
  return found;
}

/** The entity that each of these ids stands for now, where Wikidata has merged it into another. */
async function movedOf(ids, opts) {
  const rows = await inParts(ids, 250, (part) => `SELECT ?item ?to WHERE { VALUES ?item { ${wd(part)} } ?item owl:sameAs ?to }`, opts);
  const moved = new Map();
  for (const row of rows) if (entity(row.item) && entity(row.to)) moved.set(entity(row.item), entity(row.to));
  return moved;
}

/** What took the place of each of these entities (P1366), and of how many entities each of those took it. */
async function heirsOf(ids, opts) {
  const rows = await inParts(
    ids,
    250,
    (part) => `SELECT ?item ?to (COUNT(DISTINCT ?from) AS ?n) WHERE { VALUES ?item { ${wd(part)} } ?item wdt:P1366 ?to . ?from wdt:P1366 ?to } GROUP BY ?item ?to`,
    opts,
  );
  const heirs = new Map();
  for (const row of rows) {
    const [id, to, n] = [entity(row.item), entity(row.to), Number(row.n?.value)];
    if (id && to && n >= 1) heirs.set(id, [...(heirs.get(id) ?? []), { to, n }]);
  }
  return heirs;
}

/** The entities that carry each of these ISO 3166-2 codes (P300). */
async function codedOf(codes, opts) {
  const rows = await inParts(codes, 250, (part) => `SELECT ?code ?item WHERE { VALUES ?code { ${part.map((code) => literal(code)).join(' ')} } ?item wdt:P300 ?code }`, opts);
  const coded = new Map();
  for (const row of rows) if (entity(row.item)) group(coded, String(row.code?.value ?? ''), entity(row.item));
  return coded;
}

/** How many divisions a question about names is about, a dozen names each. */
const NAMED_AT_ONCE = 4;
/** How many divisions may turn out to be more than the service can take, and how many questions it may refuse, before the names are left. */
const NAMED_HEAVY = 6;
const NAMED_REFUSED = 2;

/**
 * The entities that go by a name of a division, or by another name of theirs, in its country: those that
 * say it is their country (P17) or that they are in it (P131), straight or one step up. A division is
 * { id, country, names: [[name, language]] }. Every condition is a plain pattern on purpose: a path of any
 * length up to the country (P131+) makes the query service walk a whole country for each name, and it gives
 * up before the minute.
 *
 * Each group of divisions takes two questions, and what they find counts only when both are answered: with
 * one missing, a division could seem to have one entity of its name when it has two. The service chokes on
 * some groups of names that it answers at once when they are fewer (ten divisions at a time cost the first
 * run on GitHub two groups, a minute each), so the groups are small, and one that it does not finish is
 * asked again a division at a time: only the division it cannot take is left out. Asking stops when the
 * service refuses outright, when too many divisions are too much for it, and when the time is up.
 *
 * Gives what it found, the divisions it could not ask about, and the last thing that went wrong.
 */
async function namedOf(units, until = Infinity) {
  const named = new Map();
  const unasked = [];
  let [heavy, refused, last] = [0, 0, null];
  const over = () => Date.now() >= until || heavy >= NAMED_HEAVY || refused >= NAMED_REFUSED;
  const ask = async (part) => {
    const rows = part.flatMap((u) => u.names.map(([name, lang]) => `(${literal(u.id)} wd:${u.country} ${literal(name, lang)})`));
    const list = `VALUES (?key ?country ?name) { ${rows.join(' ')} } VALUES ?called { rdfs:label skos:altLabel }`;
    const found = new Map();
    for (const where of ['VALUES ?within { wdt:P17 wdt:P131 } ?item ?called ?name . ?item ?within ?country', '?item ?called ?name . ?item wdt:P131 ?mid . ?mid wdt:P131 ?country']) {
      for (const row of await sparql(`SELECT DISTINCT ?key ?item WHERE { ${list} ${where} }`, { tries: 2, impatient: true })) if (entity(row.item)) group(found, String(row.key?.value ?? ''), entity(row.item));
      await sleep(PAUSE);
    }
    for (const [key, ids] of found) named.set(key, ids);
  };
  for (const part of chunks(units, NAMED_AT_ONCE)) {
    const ids = part.map((u) => u.id);
    if (over()) {
      unasked.push(...ids);
      continue;
    }
    try {
      await ask(part);
      continue;
    } catch (err) {
      last = err;
      // Refused, or a division that is already alone: nothing smaller to ask.
      if (!err.slow || part.length === 1) {
        if (err.slow) heavy++;
        else refused++;
        unasked.push(...ids);
        continue;
      }
    }
    for (const u of part) {
      if (over()) {
        unasked.push(u.id);
        continue;
      }
      try {
        await ask([u]);
      } catch (err) {
        last = err;
        if (err.slow) heavy++;
        else refused++;
        unasked.push(u.id);
      }
    }
  }
  return { named, unasked, last };
}

/** What each of these entities says it is in: its country (P17) and what it is a part of (P131). */
async function placesOf(ids, opts) {
  const rows = await inParts(ids, 250, (part) => `SELECT ?item ?in WHERE { VALUES ?item { ${wd(part)} } VALUES ?within { wdt:P17 wdt:P131 } ?item ?within ?in }`, opts);
  const places = new Map();
  for (const row of rows) if (entity(row.item) && entity(row.in)) group(places, entity(row.item), entity(row.in));
  return places;
}

/** The area of each of these entities in km²: every one that its statements of best rank say. */
async function areasOf(ids, opts) {
  const rows = await inParts(ids, 250, (part) => `SELECT ?item ?m2 WHERE { VALUES ?item { ${wd(part)} } ?item p:P2046 ?st . ?st a wikibase:BestRank ; psn:P2046 ?v . ?v wikibase:quantityAmount ?m2 }`, opts);
  const areas = new Map();
  for (const row of rows) {
    const km2 = Number(row.m2?.value) / 1e6;
    if (entity(row.item) && km2 > 0) areas.set(entity(row.item), [...(areas.get(entity(row.item)) ?? []), km2]);
  }
  return areas;
}

/** The English name of each of these entities, for whoever looks over what was found. */
async function labelsOf(ids, opts) {
  const rows = await inParts(ids, 250, (part) => `SELECT ?item ?label WHERE { VALUES ?item { ${wd(part)} } ?item rdfs:label ?label . FILTER(LANG(?label) = "en") }`, opts);
  const labels = new Map();
  for (const row of rows) if (entity(row.item) && row.label?.value) labels.set(entity(row.item), String(row.label.value));
  return labels;
}

/* ------------------------------------------------------------------ the sources */

/** A JSON file with one entry to a line: a change in the data is a change in a few lines. */
function lined(head, items) {
  const keys = Object.keys(items).sort();
  const lines = keys.map((k, i) => `${JSON.stringify(k)}: ${JSON.stringify(items[k])}${i < keys.length - 1 ? ',' : ''}`);
  const top = Object.entries(head).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  return `{\n${top.join('\n')}\n"items": {\n${lines.join('\n')}\n}\n}\n`;
}

/** How far the area that Wikidata gives may be from that of the division for both to be the same land. */
const SAME_SIZE = [2 / 3, 3 / 2];
/** What Wikidata adds in English to the name of a place to name the division that is called after it. */
const KINDS = ['Region', 'District', 'Province', 'Municipality', 'Parish', 'County', 'Department', 'Governorate', 'Prefecture', 'State'];
/** The ways a figure is found, as the file names them (`by`) and as the report tells them. */
const WAYS = [
  [undefined, 'por su identificador'],
  ['redirect', 'por uno que cambió'],
  ['successor', 'por la entidad que la sustituyó'],
  ['code', 'por su código ISO'],
  ['name', 'por su nombre'],
];

/**
 * How many people live in each division of the maps. The entity of a division is the one the source of the
 * maps names; where that one has no figure, or the source names none, others are tried, each on a condition
 * that keeps a figure from landing on the wrong division:
 *
 *   · redirect: the id was merged into another, which is the same entity;
 *   · successor: one entity took the place of this one and of no other (a province that became a
 *     metropolitan city), and it is not of another size where Wikidata gives its area;
 *   · code: the one entity that carries the ISO 3166-2 code of the division and is where its map is (a
 *     code on the wrong entity is a mistake that would not show otherwise), on the same condition;
 *   · name: the one entity of the country that goes by the name of the division, alone or with the kind of
 *     division after it, whose area Wikidata gives and is that of the division.
 *
 * No entity is given to two divisions, nor one that already is another division. Only the first question
 * has to be answered: a way that Wikidata does not answer, or that there is no time left for, is left out,
 * and the note says so.
 *
 * The id that the maps name is taken as it comes, and it can be wrong (the source gives a Belgian province
 * the id of a district of Luxembourg). So that it can be seen, each entity comes with the area Wikidata gives
 * it (`km2`) and, when it says it is somewhere that is not where its map is, with `abroad`. What to do with
 * those is for the build to decide, with the figures in hand.
 *
 * Where a map is: its country, the state that country depends on and whatever most of its divisions say they
 * are in. The last is needed because the id the maps give a country is not always the one its divisions
 * name in Wikidata (Palestine the region and the State of Palestine; the island of Saint Helena and the
 * territory): going by the country alone, every division of those maps would look abroad.
 */
async function regionPopulation(source) {
  const units = divisions();
  if (!units.length) throw new Error('No map of public/data/r has more than one division');
  // An id that two divisions carry (a city and the district around it) says what one of them is, not which.
  const carried = new Map();
  for (const u of units) if (u.wd) carried.set(u.wd, (carried.get(u.wd) ?? 0) + 1);
  const own = new Set(units.filter((u) => u.wd && carried.get(u.wd) === 1));
  if (!own.size) throw new Error('No division of public/data/r has a Wikidata id of its own');

  const figures = await figuresOf([...own].map((u) => u.wd).sort(byNumber));
  const areas = new Map();
  const measured = new Set();
  const asked = new Set([...own].map((u) => u.wd));
  /** The entities that already are a division: none of them is given to another. */
  const taken = new Set(carried.keys());
  const matched = new Map();
  for (const u of own) if (figures.has(u.wd)) matched.set(u.id, { wd: u.wd, pop: figures.get(u.wd) });

  const lax = { tries: 2 };
  const undone = [];
  /** The divisions whose name could not be asked about: which they are says what the service chokes on. */
  const unnamed = [];
  const until = Date.now() + PATIENCE;
  /** One of the things that can be done without: what it finds is kept, and what stops it is told. */
  const attempt = async (what, find) => {
    if (Date.now() >= until) return void undone.push(`${what} (no quedaba tiempo)`);
    try {
      await find();
    } catch (err) {
      undone.push(`${err?.what ?? what} (${short(err)})`);
    }
  };

  /** What each entity says it is in, for those that have been asked. */
  const places = new Map();
  const located = new Set();
  const locate = async (ids) => {
    const fresh = [...new Set(ids)].filter((id) => !located.has(id)).sort(byNumber);
    for (const [id, where] of await placesOf(fresh, lax)) places.set(id, where);
    for (const id of fresh) located.add(id);
  };
  const homes = new Map();
  const home = (u) => homes.get(u.map) ?? new Set([u.country, u.sovereign].filter(Boolean));
  /** Learns where each map is from the divisions that have an id of their own, the first time it is needed. */
  const calibrate = async () => {
    if (homes.size) return;
    await locate([...own].map((u) => u.wd));
    const sisters = new Map();
    for (const u of own) sisters.set(u.map, [...(sisters.get(u.map) ?? []), u]);
    for (const [map, list] of sisters) {
      const said = new Map();
      for (const u of list) for (const place of places.get(u.wd) ?? []) said.set(place, (said.get(place) ?? 0) + 1);
      homes.set(map, new Set([...home(list[0]), ...[...said].filter(([, times]) => times * 2 > list.length).map(([place]) => place)]));
    }
  };
  /** Whether an entity says it is where the map of a division is. Of a map that is nowhere, any is. */
  const within = (u, id) => !home(u).size || [...(places.get(id) ?? [])].some((place) => home(u).has(place));

  const sized = (u, id, trust) => {
    if (trust === 'same') return true;
    const known = areas.get(id) ?? [];
    if (!known.length || !u.area) return trust === 'likely';
    return known.some((km2) => km2 / u.area >= SAME_SIZE[0] && km2 / u.area <= SAME_SIZE[1]);
  };
  /**
   * How far each way got, in divisions: those it had some entity to propose for, and those of them left
   * with nothing although one of the entities had a figure (it was of another size, or Wikidata does not
   * give its area, or there were several, or it was the one of two divisions). The second number is where
   * a rule that is too strict would show.
   */
  const proposed = {};
  const refused = {};
  /**
   * Gives each division the one entity, of those proposed for it, that has a figure, is nobody else's and
   * is its size: `same` does not look at the size, `likely` looks when Wikidata gives it, `maybe` needs it.
   */
  const settle = async (proposals, by, trust) => {
    const free = new Map([...proposals].map(([u, ids]) => [u, [...ids].filter((id) => !taken.has(id))]));
    proposed[by] = [...free.values()].filter((ids) => ids.length).length;
    const fresh = [...new Set([...free.values()].flat())].filter((id) => !asked.has(id)).sort(byNumber);
    for (const id of fresh) asked.add(id);
    for (const [id, list] of await figuresOf(fresh, lax)) figures.set(id, list);
    if (trust !== 'same') {
      for (const [id, list] of await areasOf(fresh, lax)) areas.set(id, list);
      for (const id of fresh) measured.add(id);
    }
    const picks = new Map();
    for (const [u, ids] of free) {
      const fit = ids.filter((id) => figures.has(id) && sized(u, id, trust));
      if (fit.length === 1) picks.set(u, fit[0]);
    }
    const times = new Map();
    for (const id of picks.values()) times.set(id, (times.get(id) ?? 0) + 1);
    for (const [u, id] of picks) {
      if (times.get(id) > 1) continue;
      matched.set(u.id, { wd: id, by, pop: figures.get(id) });
      taken.add(id);
    }
    refused[by] = [...free].filter(([u, ids]) => !matched.has(u.id) && ids.some((id) => figures.has(id))).length;
  };

  await attempt('los identificadores que han cambiado', async () => {
    const lacking = [...own].filter((u) => !matched.has(u.id));
    const moved = await movedOf(lacking.map((u) => u.wd).sort(byNumber), lax);
    for (const u of lacking) if (moved.has(u.wd)) u.now = moved.get(u.wd);
    await settle(new Map(lacking.filter((u) => u.now).map((u) => [u, new Set([u.now])])), 'redirect', 'same');
  });

  await attempt('las entidades que sustituyeron a otra', async () => {
    const lacking = [...own].filter((u) => !matched.has(u.id));
    const heirs = await heirsOf([...new Set(lacking.map((u) => u.now ?? u.wd))].sort(byNumber), lax);
    const proposals = new Map();
    for (const u of lacking) {
      const [heir, ...others] = heirs.get(u.now ?? u.wd) ?? [];
      // One entity that took the place of this one and of no other: the same land under another name.
      if (heir && !others.length && heir.n === 1) proposals.set(u, new Set([heir.to]));
    }
    await settle(proposals, 'successor', 'likely');
  });

  await attempt('los códigos ISO 3166-2', async () => {
    const lacking = units.filter((u) => !own.has(u) && ISO.test(u.id));
    const coded = await codedOf(lacking.map((u) => u.id), lax);
    await calibrate();
    await locate([...coded.values()].flatMap((ids) => [...ids]).filter((id) => !taken.has(id)));
    const proposals = new Map();
    for (const u of lacking) {
      const here = [...(coded.get(u.id) ?? [])].filter((id) => within(u, id));
      if (here.length) proposals.set(u, new Set(here));
    }
    await settle(proposals, 'code', 'likely');
  });

  await attempt('los nombres', async () => {
    const lacking = units.filter((u) => !own.has(u) && !matched.has(u.id) && u.country && (u.en || u.es));
    const called = (u) => [...(u.en ? [u.en, ...KINDS.map((kind) => `${u.en} ${kind}`)].map((name) => [name, 'en']) : []), ...(u.es ? [[u.es, 'es']] : [])];
    const { named, unasked, last } = await namedOf(lacking.map((u) => ({ id: u.id, country: u.country, names: called(u) })), until);
    unnamed.push(...unasked);
    await settle(new Map(lacking.filter((u) => named.has(u.id)).map((u) => [u, named.get(u.id)])), 'name', 'maybe');
    // What was found is kept; what could not be asked about is told, with how much of it there was.
    if (!unasked.length) return;
    const why = last ?? new Error('no quedaba tiempo');
    throw unasked.length < lacking.length ? Object.assign(why, { what: `los nombres de ${unasked.length} de ${lacking.length} divisiones` }) : why;
  });

  await attempt('los nombres de lo encontrado', async () => {
    const found = [...matched.values()].filter((m) => m.by);
    const labels = await labelsOf([...new Set(found.map((m) => m.wd))].sort(byNumber), lax);
    for (const m of found) if (labels.has(m.wd)) m.name = labels.get(m.wd);
  });

  const all = [...new Set([...matched.values()].map((m) => m.wd))].sort(byNumber);
  await attempt('la superficie de cada entidad', async () => {
    for (const [id, list] of await areasOf(all.filter((id) => !measured.has(id)), lax)) areas.set(id, list);
    for (const u of units) {
      const m = matched.get(u.id);
      // Of the areas its statements give, the one nearest to that of the division: the kindest reading.
      const [km2] = (areas.get(m?.wd) ?? []).sort((a, b) => Math.abs(Math.log(a / (u.area ?? a))) - Math.abs(Math.log(b / (u.area ?? b))));
      if (km2) m.km2 = Number(km2.toFixed(km2 < 10 ? 2 : km2 < 100 ? 1 : 0));
    }
  });
  await attempt('el país de cada entidad', async () => {
    await calibrate();
    await locate(all);
    for (const u of units) {
      const m = matched.get(u.id);
      // An entity that names no place at all says nothing either way.
      if (m && places.has(m.wd) && !within(u, m.wd)) m.abroad = true;
    }
  });

  const items = {};
  for (const [id, m] of matched) {
    items[id] = { wd: m.wd, ...(m.by ? { by: m.by } : {}), ...(m.name ? { name: m.name } : {}), ...(m.km2 ? { km2: m.km2 } : {}), ...(m.abroad ? { abroad: true } : {}), pop: m.pop };
  }
  const by = Object.fromEntries(WAYS.map(([way]) => [way ?? 'id', [...matched.values()].filter((m) => m.by === way).length]));
  const told = WAYS.filter(([way]) => by[way ?? 'id']).map(([way, es]) => `${by[way ?? 'id']} ${es}`);
  const abroad = [...matched.values()].filter((m) => m.abroad).length;
  return {
    text: lined({ source: source.from, licence: source.licence, what: source.what, asked: units.length }, items),
    note: [
      `${matched.size} de ${units.length} divisiones tienen cifra (${told.join(', ')})`,
      ...(abroad ? [`${abroad} cuya entidad dice estar en otro país`] : []),
      ...(undone.length ? [`sin mirar: ${undone.join('; ')}`] : []),
    ].join('; '),
    detail: { divisions: units.length, found: matched.size, by, abroad, proposed, refused, undone, unnamed },
  };
}

/**
 * What there is to bring. `id` is what `--only` takes, `file` where it is kept in the branch, `needs` the
 * point of the roadmap that waits for it. `run` gives the text of the file, a note for the report and, if
 * it wants, the same in figures (`detail`, whose `undone` lists what it could not look at).
 */
const SOURCES = [
  {
    id: 'wikidata-region-population',
    file: 'wikidata/region-population.json',
    from: 'Wikidata (https://www.wikidata.org)',
    licence: 'CC0 1.0',
    what: 'Population (P1082) of each division of the maps, by its id in the game: the Wikidata entity the figure is of (wd), how it was found when it is not the one the maps name (by: redirect, successor, code or name; with its English name), the area Wikidata gives it (km2), whether it says it is not where its map is (abroad), and its statements of best rank, the newest first, as [people, day]',
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

/**
 * Whether the workflow that is in its place is the copy this branch carries. Only the owner of the
 * repository can put it there, so it falls behind when the copy changes: `behind` then, `same` when they
 * say the same, and `absent` where it was never put (a copy of the repository that nothing runs from).
 */
function workflow() {
  const read = (file) => {
    try {
      return fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n').trimEnd();
    } catch {
      return null;
    }
  };
  const [placed, copy] = [read('.github/workflows/datos.yml'), read('scripts/data/traer-datos.yml')];
  return placed === null ? 'absent' : copy === null || placed === copy ? 'same' : 'behind';
}
const BEHIND = '`.github/workflows/datos.yml` no es igual que `scripts/data/traer-datos.yml` de esta rama: hay que volver a copiarlo (el README, en «Datos de fuera», dice cómo)';

/** What a run brought, for a person: the page of the branch, or (`brief`) the summary of the run on GitHub. */
function readme(report, brief = false) {
  const row = (cells) => `| ${cells.join(' | ')} |`;
  const lines = brief
    ? ['# Lo que se ha traído', '']
    : [
        '# Datos de fuera',
        '',
        'Esta rama no es el juego: guarda datos que el juego necesita y que no están en GitHub, npm ni PyPI.',
        'La escribe el flujo «Traer datos» (pestaña *Actions*), cuando alguien pulsa su botón o cuando una rama del',
        'juego cambia la lista de lo que pide (`scripts/data/pedido.txt`); nadie más escribe aquí.',
        'Qué se trae y de dónde lo dice `scripts/data/outside.mjs`, en la rama del juego.',
        '',
        `## Última descarga: ${report.when.slice(0, 10)}`,
        '',
      ];
  lines.push(`Hecha con ${report.from ? `\`${report.from}\`` : 'una copia local'}. Lo que no se pidió esta vez sigue en la rama \`datos\` como estaba.`, '');
  if (report.workflow === 'behind') lines.push(`**El flujo que está puesto se ha quedado atrás.** ${BEHIND}.`, '');
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
  // A source that was read, less something it could not look at: it is kept, and it is said.
  const partial = report.sources.flatMap((s) => (s.detail?.undone ?? []).map((what) => `${s.es} (${s.id}): ${what}`));
  if (ON_GITHUB) for (const line of unread) console.log(`::warning title=Fuente sin leer::${line}`);
  if (ON_GITHUB) for (const line of silent) console.log(`::warning title=No contesta::${line}`);
  if (ON_GITHUB) for (const line of partial) console.log(`::warning title=Sin mirar::${line}`);
  if (ON_GITHUB && report.workflow === 'behind') console.log(`::warning title=Flujo sin actualizar::${BEHIND.replace(/`/g, '')}.`);
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

// What is said by hand comes first; with nothing said, what the file of requests names; with neither, all.
let ONLY = SAID;
if (!SAID.length && ASKED) {
  const file = path.resolve(ROOT, ASKED);
  if (!fs.existsSync(file)) {
    console.error(`No está el archivo que dice qué traer: ${ASKED}.`);
    process.exit(2);
  }
  // A name to a line (or several, between commas); a line that starts with # is a note for people.
  ONLY = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((line) => !line.trim().startsWith('#')).flatMap((line) => names(line, ','));
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
  workflow: workflow(),
  sources: [],
  reach: [],
};

for (const source of SOURCES.filter((s) => wanted(s.id))) {
  const { run, ...about } = source;
  const started = Date.now();
  process.stdout.write(`↓ ${source.id} … `);
  try {
    const { text, note, detail } = await run(source);
    const buf = Buffer.from(text, 'utf8');
    const dest = path.join(OUT, source.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    report.sources.push({ ...about, ok: true, bytes: buf.length, blob: blobSha(buf), note, ...(detail ? { detail } : {}), ms: Date.now() - started });
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
