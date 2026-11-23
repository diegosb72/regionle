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
 * Nor is it asked again past the time there is for it (`until`): the first try is always made.
 */
async function request(url, { method = 'GET', headers = {}, body, timeout = 60_000, tries = 4, impatient = false, until = Infinity } = {}) {
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
    if (n === tries - 1 || Date.now() + wait > until) break;
    await sleep(wait);
  }
  throw last;
}

/** The rows that Wikidata answers a question with. */
async function sparql(query, { tries, impatient, until } = {}) {
  const { body } = await request(WDQS, {
    method: 'POST',
    headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: `query=${encodeURIComponent(query)}`,
    timeout: 90_000,
    tries,
    impatient,
    until,
  });
  const rows = JSON.parse(body.toString('utf8'))?.results?.bindings;
  if (!Array.isArray(rows)) throw new Error('Wikidata answered something that is not a table');
  return rows;
}

/** How many parts of a question may be left for later before the place is taken to be down, and not asked the rest. */
const LATER = 3;

/**
 * The rows of a question about a long list, asked a part at a time. A part that is refused is not the end
 * of the question: it is asked again when the others have been, by when a bad moment of the place has
 * usually passed. (The query service has one in most runs, and a single one cost a run every entity it
 * would have set right.) A refusal that is final is not asked about again, nor is anything asked once the
 * time there was for it is up.
 */
async function inParts(list, size, question, opts) {
  const rows = [];
  const later = [];
  const ask = async (part) => {
    rows.push(...(await sparql(question(part), opts)));
    await sleep(PAUSE);
  };
  for (const part of chunks(list, size)) {
    try {
      await ask(part);
    } catch (err) {
      if (err.final || later.length >= LATER || Date.now() >= (opts?.until ?? Infinity)) throw err;
      later.push({ part, err });
    }
  }
  for (const { part, err } of later) {
    if (Date.now() >= (opts?.until ?? Infinity)) throw err;
    await ask(part);
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
 * service refuses outright, when too many divisions are too much for it, and when the time is up. A group
 * that was refused is asked about once more at the end: a bad moment of the service passes.
 *
 * Gives what it found, the divisions it could not ask about, and the last thing that went wrong.
 */
async function namedOf(units, until = Infinity) {
  const named = new Map();
  const unasked = [];
  const again = [];
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
      if (!err.slow) {
        refused++;
        again.push(part);
        continue;
      }
      if (part.length === 1) {
        heavy++;
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
  for (const part of again) {
    try {
      if (Date.now() >= until) throw last;
      await ask(part);
    } catch (err) {
      last = err;
      unasked.push(...part.map((u) => u.id));
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
/** An entity with less than this share of the area of a division is something else: the city a province is called after. */
const TINY = 0.3;
/** Unless it is a thousandth of it: 1.234 written where 1234 was meant, which Wikidata has here and there. */
const SLIP = [0.0008, 0.00125];
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
 * The id that the maps name can be wrong: the source gives a Belgian province the id of a district of
 * Luxembourg, and more than one region the id of the city it is called after. An entity that says it is
 * somewhere else than its map, or that is far smaller than its division, is doubted: the division is looked
 * for by its code and by its name too, like those with no entity, and what that finds takes its place. With
 * nothing better found it keeps the entity of the maps. So that it can be seen, each entity comes with the
 * area Wikidata gives it (`km2`) and, when it says it is not where its map is, with `abroad`: what to do
 * with those is for the build to decide, with the figures in hand.
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

  // The one question everything else hangs from. It has half the time of the rest to be answered in.
  const figures = await figuresOf([...own].map((u) => u.wd).sort(byNumber), { until: Date.now() + PATIENCE / 2 });
  const areas = new Map();
  const measured = new Set();
  const asked = new Set([...own].map((u) => u.wd));
  /** The entities that already are a division: none of them is given to another. */
  const taken = new Set(carried.keys());
  const matched = new Map();
  for (const u of own) if (figures.has(u.wd)) matched.set(u.id, { wd: u.wd, pop: figures.get(u.wd) });

  const until = Date.now() + PATIENCE;
  /**
   * How the rest is asked: as often as the first question when it is refused, but not twice of a place that
   * is slow to fail, and never past the time there is.
   */
  const lax = { tries: 4, impatient: true, until };
  const undone = [];
  /** The divisions whose name could not be asked about: which they are says what the service chokes on. */
  const unnamed = [];
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

  const doubted = new Set();
  const tiny = (u, id) => {
    const known = areas.get(id) ?? [];
    return !!u.area && known.length > 0 && known.every((km2) => km2 / u.area < TINY && !(km2 / u.area >= SLIP[0] && km2 / u.area <= SLIP[1]));
  };
  await attempt('las entidades que no parecen su división', async () => {
    await calibrate();
    const ids = [...own].filter((u) => matched.has(u.id)).map((u) => u.wd).sort(byNumber);
    for (const [id, list] of await areasOf(ids, lax)) areas.set(id, list);
    for (const id of ids) measured.add(id);
    for (const u of own) if (matched.has(u.id) && ((places.has(u.wd) && !within(u, u.wd)) || tiny(u, u.wd))) doubted.add(u);
  });
  /** Whether a division is still to be found: it has no entity of its own, or the one it has is doubted and nothing has taken its place. */
  const wanting = (u) => (own.has(u) ? doubted.has(u) && !matched.get(u.id)?.by : !matched.has(u.id));

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
    const lacking = units.filter((u) => wanting(u) && ISO.test(u.id));
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
    const lacking = units.filter((u) => wanting(u) && u.country && (u.en || u.es));
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
    detail: { divisions: units.length, found: matched.size, by, abroad, doubted: doubted.size, proposed, refused, undone, unnamed },
  };
}

/* ------------------------------------------------------------------ flags */

/** Where Commons answers what is asked about its files. */
const COMMONS = process.env.OUTSIDE_COMMONS ?? 'https://commons.wikimedia.org/w/api.php';
/**
 * Where what the branch `datos` already keeps can be read: a file that is there is not downloaded again, so
 * a run that was cut short is taken up where it stopped. Nowhere, away from GitHub.
 */
const KEPT = process.env.OUTSIDE_KEPT ?? (process.env.GITHUB_REPOSITORY ? `https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY}/datos` : '');
/**
 * An original heavier than this, in bytes, is not brought: the picture that Wikimedia draws of it is. A
 * drawing is left at well under half its weight once it is cleaned (scripts/data/flag-image.mjs), and the
 * game keeps as drawings those that then weigh up to 750 kB: one of more than this would not be among them.
 */
const FLAG_MAX = Number(process.env.OUTSIDE_FLAG_MAX ?? 2_000_000);
/** How wide that picture is, in px: one of the widths Wikimedia draws. */
const FLAG_PICTURE = 960;
/**
 * The wait between one download and the next, in ms. Wikimedia gives a program that says who it is two
 * hundred requests a minute, all its sites together, and answers the rest with a 429: the first run, at two
 * files at once and no wait, was refused 1152 of 2001. A file every 400 ms is 150 a minute, one at a time.
 * (Even so, the second run was refused after some seven hundred files: what is left is for the next run,
 * which is why a refusal that outlasts its waits ends the downloads instead of being tried on file after file.)
 */
const FLAG_GAP = Number(process.env.OUTSIDE_FLAG_GAP ?? 400);
/** How many files in a row may fail before the place is taken to be refusing, and left alone. */
const FLAGS_FAILED = 8;
/**
 * The files whose picture, as Wikimedia draws it, is wanted besides the original: one Commons title to a
 * line. They are the drawings with words in them, which each device would set in a typeface of its own;
 * scripts/data/flags.mjs, which is who looks inside the files, writes the list.
 */
const FLAG_PICTURES = path.resolve(ROOT, process.env.OUTSIDE_FLAG_PICTURES ?? 'scripts/data/flags-pictures.txt');
/**
 * The flags that are given by hand: for each source, by the id of the thing, the Commons title of its flag
 * (`file`) and how it is known to be the one (`why`). For what Wikidata has no flag of, or gives one that
 * is not the flag (the banner of the city of Rome).
 */
const FLAG_HAND = path.resolve(ROOT, process.env.OUTSIDE_FLAG_HAND ?? 'scripts/data/flags-hand.json');
/** Words in a drawing: text that is set, and not shapes that are drawn. */
const WORDS = /<(text|tspan|textPath|tref)\b/i;
/**
 * A category of Commons that says of the file in it that it is not a flag that flies: one of other times,
 * one that somebody proposed, one that nobody ever flew. A flag that is only unofficial is not among them:
 * many of the flags that regions are known by have no law behind them.
 */
const NOT_FLOWN = new RegExp(
  [
    // «Historical flags of provinces of Spain», «SVG proposed flags of provinces of Spain», «Special or fictional flags».
    String.raw`^(svg\s+)?(historical|historic|former|obsolete|defunct|proposed|fictitious|fictional|hypothetical|fantasy|special or fictional)\s+flags?\b`,
    // «Proposals for municipality flags of East Timor 2009», «Flag proposals of Spain».
    String.raw`^proposals\s+for\b.*\bflags?\b`,
    String.raw`\bflag\s+proposals\b`,
    // «Flags of former municipalities of Latvia».
    String.raw`\bflags\s+of\s+(the\s+)?(former|defunct|abolished|dissolved|historical)\b`,
    // «Flags of Luanda (before 1975)».
    String.raw`\bflags?\b.*\b(before|until)\s+\d{4}\b`,
  ].join('|'),
  'i',
);
/** Where the files are kept in the branch, whatever source named them: each under the SHA-1 of what it holds. */
const FLAG_FILES = 'flags/files';
const SVG = /\.svg$/i;
const KIND = { 'image/svg+xml': 'svg', 'image/png': 'png', 'image/gif': 'gif', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/tiff': 'tif' };
const RANK = { PreferredRank: 'preferred', NormalRank: 'normal', DeprecatedRank: 'deprecated' };

/**
 * Every piece of every level of the maps that have more than one at it (provinces, and the communities they
 * make up): its id, its map, its Wikidata id where the maps give one and its area in km². A piece that is in
 * two levels (Ceuta, province and community) is one.
 */
function pieces() {
  const found = new Map();
  for (const file of fs.readdirSync(path.join(DATA, 'r')).filter((f) => f.endsWith('.json')).sort()) {
    const objects = JSON.parse(fs.readFileSync(path.join(DATA, 'r', file), 'utf8')).objects ?? {};
    for (const level of Object.keys(objects).sort()) {
      const units = objects[level]?.geometries ?? [];
      if (units.length < 2) continue;
      for (const g of units) {
        const p = g.properties ?? {};
        const piece = { id: String(g.id), map: file.slice(0, -5), wd: QID.test(p.wd ?? '') ? p.wd : null, area: Number(p.ar) > 0 ? Number(p.ar) : null };
        if (!found.get(piece.id)?.wd) found.set(piece.id, piece);
      }
    }
  }
  return [...found.values()];
}

/** The capitals of the countries, as the list of cities has them (3 is the capital, 2 a second one), by the id each city has in the game. */
function capitals() {
  const cities = JSON.parse(fs.readFileSync(path.join(DATA, 'cities.json'), 'utf8')).c ?? {};
  return Object.keys(cities)
    .sort()
    .flatMap((map) => cities[map].filter((c) => c.k >= 2).map((c) => ({ id: String(c.i), map, wd: QID.test(c.wd ?? '') ? c.wd : null, area: null })));
}

/** The file that a statement names, as Commons titles it: the query service gives the address that leads to it. */
function fileOf(cell) {
  const at = String(cell?.value ?? '').split('/Special:FilePath/')[1];
  if (!at) return null;
  try {
    return decodeURIComponent(at).replace(/_/g, ' ').trim() || null;
  } catch {
    return null;
  }
}
/** The day a qualifier gives, or `?` when it says there is one and not which. */
const dayOf = (cell) => (cell ? (/^(\d{4}-\d{2}-\d{2})/.exec(String(cell.value))?.[1] ?? '?') : null);

const FLAG_ROWS = '?st ps:P41 ?file ; wikibase:rank ?rank . OPTIONAL { ?st pq:P580 ?from } OPTIONAL { ?st pq:P582 ?to }';

/** Adds the rows of a question about flags to what is known: for each key, each picture with its rank and the days it says it flew between. */
function statements(known, rows, keyOf) {
  for (const row of rows) {
    const [key, file] = [keyOf(row), fileOf(row.file)];
    if (!key || !file) continue;
    const list = known.get(key) ?? new Map();
    const st = list.get(file) ?? { file, rank: RANK[String(row.rank?.value ?? '').split('#')[1]] ?? 'normal', from: null, to: null };
    const [from, to] = [dayOf(row.from), dayOf(row.to)];
    if (from && (!st.from || from < st.from)) st.from = from;
    if (to && (!st.to || to > st.to)) st.to = to;
    known.set(key, list.set(file, st));
  }
  return known;
}

/** The pictures of the flag (P41) of each of these entities. */
async function flagsOf(ids, opts, known = new Map()) {
  return statements(known, await inParts(ids, 250, (part) => `SELECT ?item ?file ?rank ?from ?to WHERE { VALUES ?item { ${wd(part)} } ?item p:P41 ?st . ${FLAG_ROWS} }`, opts), (row) => entity(row.item));
}

/** The pictures of the flag of the entities that carry each of these ISO 3166-2 codes (P300): for each code, each entity with its pictures. */
async function flagsCoded(codes, opts) {
  const rows = await inParts(
    codes,
    250,
    (part) => `SELECT ?code ?item ?file ?rank ?from ?to WHERE { VALUES ?code { ${part.map((code) => literal(code)).join(' ')} } ?item wdt:P300 ?code ; p:P41 ?st . ${FLAG_ROWS} }`,
    opts,
  );
  const coded = new Map();
  const known = statements(new Map(), rows, (row) => (entity(row.item) ? `${row.code?.value ?? ''} ${entity(row.item)}` : null));
  for (const [key, list] of known) {
    const [code, id] = key.split(' ');
    coded.set(code, (coded.get(code) ?? new Map()).set(id, list));
  }
  return coded;
}

/**
 * The flags that an entity flies today, the likeliest first: those that are not withdrawn and name no day
 * on which they stopped being flown, the preferred ones alone when there are any; of those, the one that
 * started last, a drawing before a photograph, and by name. The others it had are told apart: `old`.
 */
function flown(list) {
  const all = [...(list?.values() ?? [])].filter((f) => f.rank !== 'deprecated');
  const live = all.filter((f) => !f.to);
  const best = live.some((f) => f.rank === 'preferred') ? live.filter((f) => f.rank === 'preferred') : live;
  const since = (f) => (f.from && f.from !== '?' ? f.from : '');
  best.sort((a, b) => since(b).localeCompare(since(a)) || Number(SVG.test(b.file)) - Number(SVG.test(a.file)) || a.file.localeCompare(b.file));
  return { now: best, old: all.filter((f) => !best.includes(f)).sort((a, b) => a.file.localeCompare(b.file)) };
}

/** What Commons answers a question with. A place that is busy with its own copies says so with a 200, and is asked again after a wait. */
async function commonsSays(form, until) {
  for (let n = 0; ; n++) {
    const { body } = await request(COMMONS, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' }, body: form.toString(), until });
    const json = JSON.parse(body.toString('utf8'));
    if (!json?.error) return json ?? {};
    if (n >= 3 || !['maxlag', 'ratelimited'].includes(json.error.code) || Date.now() >= until) throw new Error(`Commons: ${json.error.code ?? 'error'}`);
    await sleep(PAUSE * 4 ** (n + 1));
  }
}

const bare = (title) => String(title).replace(/^File:/, '');

/**
 * What Commons says of each of these files, fifty at a time: `asking` is what is asked of them. Gives the
 * page of each by its title, and the title that each name that is not one leads to (a name written another
 * way, or the one a file had before it was renamed).
 */
async function commonsOf(titles, asking, until = Infinity) {
  const pages = new Map();
  const leads = new Map();
  for (const part of chunks(titles, 50)) {
    let more = {};
    // An answer that does not fit comes in pieces, each saying how to ask for the next.
    for (let piece = 0; piece < 20; piece++) {
      const json = await commonsSays(new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', redirects: '1', maxlag: '5', ...asking, titles: part.map((t) => `File:${t}`).join('|'), ...more }), until);
      for (const { from, to } of [...(json.query?.normalized ?? []), ...(json.query?.redirects ?? [])]) leads.set(bare(from), bare(to));
      for (const page of json.query?.pages ?? []) {
        const was = pages.get(bare(page.title)) ?? {};
        // The categories of a page may come in more than one piece: each piece adds to those before.
        pages.set(bare(page.title), { ...was, ...page, ...(was.categories || page.categories ? { categories: [...(was.categories ?? []), ...(page.categories ?? [])] } : {}) });
      }
      if (!json.continue) break;
      more = json.continue;
    }
    await sleep(PAUSE);
  }
  const titled = (name) => {
    let title = name;
    for (let hop = 0; hop < 4 && leads.has(title); hop++) title = leads.get(title);
    return title;
  };
  return { pages, titled };
}

/** A text of a file's page without its marks, and no longer than it has to be to say who made the file. */
function plain(html, max = 160) {
  const text = String(html ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** What is kept of the page of a file: what it holds, and who made it and on what terms it is given. */
function about(page) {
  const info = page?.imageinfo?.[0];
  // Its SHA-1 is the name the file is kept under: one that is not a SHA-1 is no name for a file.
  if (!info || page.missing || !/^[0-9a-f]{40}$/.test(String(info.sha1 ?? '')) || !/^https?:\/\//.test(String(info.url ?? ''))) return null;
  const said = (name) => plain(info.extmetadata?.[name]?.value);
  return {
    sha1: String(info.sha1),
    bytes: Number(info.size) || 0,
    mime: String(info.mime ?? ''),
    w: Number(info.width) || 0,
    h: Number(info.height) || 0,
    licence: said('LicenseShortName') || said('UsageTerms'),
    ...(said('LicenseUrl') ? { licenceUrl: said('LicenseUrl') } : {}),
    ...(said('Artist') ? { artist: said('Artist') } : {}),
    ...(said('Credit') ? { credit: said('Credit') } : {}),
    ...(said('AttributionRequired').toLowerCase() === 'true' ? { attribution: true } : {}),
    ...(said('Restrictions') ? { restrictions: said('Restrictions') } : {}),
    page: String(info.descriptionurl ?? ''),
  };
}

/** The drawing that the page of a photograph says there is of the same flag: Commons marks a file so when somebody has drawn it again. */
function drawnAs(text) {
  const m = /\{\{\s*(?:vector[ _]version[ _]available|vva|svg[ _]available|supersededsvg|superseded[ _-]?svg|superseded)\s*\|\s*(?:1\s*=\s*)?(?:(?:File|Image)\s*:\s*)?([^|{}\n]+?\.svg)\s*[|}]/i.exec(String(text ?? ''));
  return m ? m[1].replace(/_/g, ' ').trim() : null;
}

/**
 * The files that the branch already keeps, as the data files of the sources of flags say (none where it
 * cannot be read), and the SHA-1 of those that were seen to have words in them when they were brought.
 */
async function keptFiles() {
  const [kept, words] = [new Set(), new Set()];
  if (!KEPT) return { kept, words };
  for (const source of SOURCES.filter((s) => s.flags)) {
    try {
      const { body } = await request(`${KEPT}/${source.file}`, { tries: 2, timeout: 30_000 });
      for (const file of Object.values(JSON.parse(body.toString('utf8')).files ?? {})) {
        for (const name of [file.kept, file.picture]) if (name) kept.add(name);
        if (file.words && file.sha1) words.add(file.sha1);
      }
    } catch {
      // The first time there is nothing kept, and a branch that cannot be read is one more download.
    }
  }
  return { kept, words };
}

/** The flags given by hand for a source, by the id of each thing: none where there is no list. */
function byHand(source) {
  try {
    const said = JSON.parse(fs.readFileSync(FLAG_HAND, 'utf8'))[source.id] ?? {};
    return new Map(Object.entries(said).filter(([, one]) => typeof one?.file === 'string' && one.file.trim()).map(([id, one]) => [id, one.file.trim()]));
  } catch {
    return new Map();
  }
}

/** The titles of the list of pictures that are wanted: none where there is no list. */
function picturesWanted() {
  try {
    return new Set(fs.readFileSync(FLAG_PICTURES, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')));
  } catch {
    return new Set();
  }
}

/** A JSON file of several lists, with one entry to a line in each. */
function listed(head, lists) {
  const top = Object.entries(head).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  const parts = Object.entries(lists).map(([name, items]) => {
    const keys = Object.keys(items).sort();
    return `${JSON.stringify(name)}: {\n${keys.map((k, i) => `${JSON.stringify(k)}: ${JSON.stringify(items[k])}${i < keys.length - 1 ? ',' : ''}`).join('\n')}\n}`;
  });
  return `{\n${top.join('\n')}\n${parts.join(',\n')}\n}\n`;
}

/**
 * The flag of each of the things a source asks about (`subjects`: the divisions of the maps, the capitals),
 * and the file of each flag.
 *
 * Which flag: the one its Wikidata entity flies today (see `flown`). The entity of a thing is the one the
 * maps name; when that one has no flag, the one its id was merged into, and then the one entity that
 * carries its ISO 3166-2 code and has a flag. Where the entity of the maps and the one with the code are
 * not the same and fly different flags, the first is believed and the other is told (`other`), unless the
 * first is far smaller than the division (the city a province is called after): then it is the other way
 * round. An entity that small with nothing to take its place keeps its flag, and says so (`tiny`). A flag
 * given by hand (`by: hand`) comes before any of them, and what Wikidata gave is told (`instead`).
 *
 * Which file: what Commons keeps under that name, with who made it and on what terms it is given, which a
 * game that shows it has to say. A photograph whose page says that somebody has drawn the flag again is
 * brought as that drawing (`drawn`), with the photograph left out. An original too heavy to be of use
 * is brought as the picture Wikimedia draws of it (`picture`); a drawing with words in it (`words`), and
 * any other that the list of pictures names, is brought both ways. The flag that is only told (`other`)
 * is brought too: which of the two it is, is for whoever builds the game to say.
 *
 * Only the first question has to be answered. What Wikidata does not answer after it is left out and told;
 * a file that cannot be downloaded, or that there was no time for, has its entry with no file, and the
 * next run brings it: what the branch already keeps is not downloaded again.
 */
async function flagsFor(source, subjects, keep) {
  if (!subjects.length) throw new Error('Nothing to ask the flag of');
  const own = [...new Set(subjects.filter((u) => u.wd).map((u) => u.wd))].sort(byNumber);
  if (!own.length) throw new Error('Nothing to ask the flag of has a Wikidata id');
  const until = Date.now() + PATIENCE;
  const lax = { tries: 4, impatient: true, until };
  const undone = [];
  const attempt = async (what, find) => {
    if (Date.now() >= until) return void undone.push(`${what} (no quedaba tiempo)`);
    try {
      await find();
    } catch (err) {
      undone.push(`${what} (${short(err)})`);
    }
  };

  // The one question everything else hangs from.
  const flags = await flagsOf(own, { until: Date.now() + PATIENCE / 2 });
  const moved = new Map();
  await attempt('los identificadores que han cambiado', async () => {
    for (const [from, to] of await movedOf(own.filter((id) => !flags.has(id)), lax)) moved.set(from, to);
    await flagsOf([...new Set(moved.values())].filter((id) => !flags.has(id)).sort(byNumber), lax, flags);
  });
  let coded = new Map();
  await attempt('los códigos ISO 3166-2', async () => {
    coded = await flagsCoded(subjects.filter((u) => ISO.test(u.id)).map((u) => u.id), lax);
  });

  /** What each thing may fly: the flag of its entity (or of the one it became) and that of the entity with its code. */
  const picks = new Map();
  for (const u of subjects) {
    const mine = u.wd && (flags.has(u.wd) ? { wd: u.wd } : moved.has(u.wd) && flags.has(moved.get(u.wd)) ? { wd: moved.get(u.wd), by: 'redirect' } : null);
    const first = mine && { ...mine, ...flown(flags.get(mine.wd)) };
    // A code that two entities with a flag carry says what one of them is, not which.
    const carriers = [...(coded.get(u.id) ?? [])].filter(([, list]) => flown(list).now.length);
    const second = carriers.length === 1 && carriers[0][0] !== first?.wd ? { wd: carriers[0][0], by: 'code', ...flown(carriers[0][1]) } : null;
    picks.set(u.id, { first: first?.now.length ? first : null, second, old: first?.old ?? [] });
  }

  const areas = new Map();
  await attempt('la superficie de cada entidad', async () => {
    const ids = subjects.filter((u) => u.area && picks.get(u.id).first).map((u) => picks.get(u.id).first.wd);
    for (const [id, list] of await areasOf([...new Set(ids)].sort(byNumber), lax)) areas.set(id, list);
  });
  const tiny = (u, id) => {
    const known = areas.get(id) ?? [];
    return !!u.area && known.length > 0 && known.every((km2) => km2 / u.area < TINY && !(km2 / u.area >= SLIP[0] && km2 / u.area <= SLIP[1]));
  };

  const items = {};
  for (const u of subjects) {
    const { first, second, old } = picks.get(u.id);
    const small = !!first && tiny(u, first.wd);
    const [pick, other] = first && !(small && second) ? [first, second] : [second, first];
    if (!pick) continue;
    const [flag, ...also] = pick.now;
    items[u.id] = {
      wd: pick.wd,
      ...(pick.by ? { by: pick.by } : {}),
      file: flag.file,
      ...(flag.from && flag.from !== '?' ? { from: flag.from } : {}),
      ...(also.length ? { also: also.map((f) => f.file) } : {}),
      ...(pick === first && old.length ? { old: old.map((f) => f.file) } : {}),
      ...(other && other.now[0].file !== flag.file ? { other: { wd: other.wd, file: other.now[0].file } } : {}),
      ...(pick === first && small ? { tiny: true } : {}),
    };
  }

  for (const [id, title] of byHand(source)) {
    if (!subjects.some((u) => u.id === id)) continue;
    const was = items[id];
    items[id] = { ...(was ? { wd: was.wd } : {}), by: 'hand', file: title, ...(was && was.file !== title ? { instead: was.file } : {}) };
  }

  /* The files: what Commons says of each, and the drawing that stands for a photograph. */
  const files = {};
  const sources = new Map();
  const learn = async (names) => {
    const { pages, titled } = await commonsOf(names, { prop: 'imageinfo', iiprop: 'url|size|mime|sha1|extmetadata', iiextmetadatafilter: 'LicenseShortName|UsageTerms|LicenseUrl|Artist|Credit|AttributionRequired|Restrictions', iiurlwidth: String(FLAG_PICTURE) }, until);
    const titles = new Map();
    for (const name of names) {
      const title = titled(name);
      titles.set(name, title);
      const info = about(pages.get(title));
      files[title] = info ?? { missing: true };
      if (info) sources.set(title, pages.get(title).imageinfo[0]);
    }
    return titles;
  };
  // Every flag that some thing flies today: its own, the others its entity gives, and that of the entity with its code.
  const asked = [...new Set(Object.values(items).flatMap((item) => [item.file, ...(item.also ?? []), ...(item.other ? [item.other.file] : [])]))].sort();
  const titles = await learn(asked);
  for (const item of Object.values(items)) {
    item.file = titles.get(item.file) ?? item.file;
    if (item.also) item.also = item.also.map((name) => titles.get(name) ?? name);
    if (item.other) item.other.file = titles.get(item.other.file) ?? item.other.file;
  }

  await attempt('los dibujos de las banderas que son fotografías', async () => {
    const photos = Object.keys(files).filter((title) => !files[title].missing && files[title].mime !== 'image/svg+xml').sort();
    const { pages } = await commonsOf(photos, { prop: 'revisions', rvprop: 'content', rvslots: 'main' }, until);
    const drawn = new Map();
    for (const title of photos) {
      const name = drawnAs(pages.get(title)?.revisions?.[0]?.slots?.main?.content);
      if (name) drawn.set(title, name);
    }
    const fresh = [...new Set(drawn.values())].filter((name) => !files[name]).sort();
    const found = fresh.length ? await learn(fresh) : new Map();
    for (const [title, name] of drawn) {
      const drawing = found.get(name) ?? name;
      if (files[drawing] && !files[drawing].missing && files[drawing].mime === 'image/svg+xml') files[title].drawn = drawing;
    }
  });

  await attempt('lo que las categorías de Commons dicen de cada bandera', async () => {
    const named = Object.keys(files).filter((title) => !files[title].missing).sort();
    const { pages } = await commonsOf(named, { prop: 'categories', cllimit: 'max', clshow: '!hidden' }, until);
    for (const title of named) {
      const said = (pages.get(title)?.categories ?? []).map((c) => String(c.title).replace(/^Category:/, '')).filter((name) => NOT_FLOWN.test(name));
      if (said.length) files[title].marks = [...new Set(said)].sort();
    }
  });

  /* The download: every file that some thing flies, less the photographs that have a drawing; one at a time, and unhurried. */
  const { kept, words } = await keptFiles();
  const pictured = picturesWanted();
  const wanted = Object.keys(files)
    .filter((title) => !files[title].missing && !files[title].drawn)
    .sort();
  const [brought, there, left] = [[], [], []];
  let [failed, bytes, pictures] = [0, 0, 0];
  let last = null;
  let free = 0;
  /** A file of the place the flags come from, asked for no sooner than the wait after the one before. */
  const fetched = async (url) => {
    await sleep(Math.max(0, free - Date.now()));
    free = Date.now() + FLAG_GAP;
    return (await request(url, { tries: 3, until })).body;
  };
  const one = async (title) => {
    const file = files[title];
    const from = sources.get(title);
    const kind = KIND[file.mime] ?? (path.extname(title).slice(1).toLowerCase() || 'bin');
    const at = `${FLAG_FILES}/${file.sha1.slice(0, 2)}/${file.sha1}`;
    const heavy = file.bytes > FLAG_MAX && !!from.thumburl;
    let fresh = false;
    if (!heavy) {
      if (!kept.has(`${at}.${kind}`)) {
        const body = await fetched(from.url);
        if (createHash('sha1').update(body).digest('hex') !== file.sha1) throw new Error('lo descargado no es lo que su ficha dice');
        if (kind === 'svg' && WORDS.test(body.toString('utf8'))) file.words = true;
        keep(`${at}.${kind}`, body);
        bytes += body.length;
        fresh = true;
      } else if (words.has(file.sha1)) file.words = true;
      file.kept = `${at}.${kind}`;
    }
    if (from.thumburl && (heavy || file.words || pictured.has(title))) {
      if (!kept.has(`${at}.${FLAG_PICTURE}.png`)) {
        const body = await fetched(from.thumburl);
        keep(`${at}.${FLAG_PICTURE}.png`, body);
        bytes += body.length;
        pictures++;
        fresh = true;
      }
      file.picture = `${at}.${FLAG_PICTURE}.png`;
    }
    (fresh ? brought : there).push(title);
  };
  /** The place has said that this is too much, and went on saying so after the waits it asked for: no more is asked of it in this run. */
  let refused = false;
  for (const title of wanted) {
    if (Date.now() >= until || failed >= FLAGS_FAILED || refused) {
      left.push(title);
      continue;
    }
    try {
      await one(title);
      failed = 0;
    } catch (err) {
      failed++;
      last = err;
      left.push(title);
      refused = /^HTTP 429\b/.test(String(err?.message ?? ''));
    }
  }
  if (left.length) undone.push(`${left.length} de ${wanted.length} archivos (${last ? short(last) : 'no quedaba tiempo'})`);

  const count = (list, of) => {
    const n = {};
    for (const one of list) n[of(one)] = (n[of(one)] ?? 0) + 1;
    return Object.fromEntries(Object.entries(n).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
  };
  const flying = Object.values(items);
  const real = Object.values(files).filter((f) => !f.missing);
  const by = count(flying, (item) => item.by ?? 'id');
  return {
    text: listed({ source: source.from, licence: source.licence, what: source.what, asked: subjects.length }, { items, files }),
    note: [
      `${flying.length} de ${subjects.length} tienen bandera`,
      `${wanted.length} archivos: ${brought.length} descargados (${kB(bytes)}${pictures ? `, con ${pictures} imágenes` : ''})${there.length ? `, ${there.length} que ya estaban` : ''}${left.length ? `, ${left.length} sin traer` : ''}`,
      ...(undone.length ? [`sin mirar: ${undone.join('; ')}`] : []),
    ].join('; '),
    detail: {
      asked: subjects.length,
      found: flying.length,
      by,
      doubted: { other: flying.filter((item) => item.other).length, tiny: flying.filter((item) => item.tiny).length },
      files: { all: real.length, missing: Object.values(files).length - real.length, drawn: real.filter((f) => f.drawn).length, words: real.filter((f) => f.words).length, wanted: wanted.length, brought: brought.length, there: there.length, left: left.length, pictures, bytes },
      kinds: count(real, (f) => KIND[f.mime] ?? f.mime),
      licences: count(real, (f) => f.licence || '?'),
      undone,
    },
  };
}

/** What the sources of flags have in common: where they read, and what their data files say. */
const FLAGS = {
  from: 'Wikidata (https://www.wikidata.org) y Wikimedia Commons (https://commons.wikimedia.org)',
  licence: 'La de cada archivo, que su entrada dice: dominio público o una licencia libre',
  flags: true,
};
const FLAGS_WHAT =
  'items: the Wikidata entity whose flag it is (wd), how it was found when it is not the one the game names (by: redirect or code; hand when the flag is one given in scripts/data/flags-hand.json, with the one Wikidata gave under instead), the Commons file of the flag it flies today (file) and since when (from), ' +
  'other flags the entity gives as of today (also) and those it gives as past or less fit (old), the flag of the entity that carries its ISO 3166-2 code when that is another (other), and whether the entity is far smaller than the division (tiny). ' +
  `files: what Commons says of each file, by its title: SHA-1, bytes, MIME type, width and height, licence and its address, author, credit, whether it must be attributed, restrictions other than copyright, and its page; where the file is kept in this branch (kept); the ${FLAG_PICTURE} px picture that Wikimedia draws of it (picture), which stands for an original of more than ${FLAG_MAX / 1e6} MB and goes with a drawing that has words in it (words); for a photograph, the drawing of the same flag that is kept in its place (drawn); and the categories of Commons that say the file is not a flag that flies, when it is in any: historical, proposed or made up (marks). ` +
  `The files themselves are under ${FLAG_FILES}, each named after its SHA-1.`;

/**
 * What there is to bring. `id` is what `--only` takes, `file` where it is kept in the branch, `needs` the
 * point of the roadmap that waits for it. `run` gives the text of the file, a note for the report and, if
 * it wants, the same in figures (`detail`, whose `undone` lists what it could not look at); what else it
 * brings (the files of the flags), it hands over one by one to be kept as it comes.
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
  {
    id: 'flags-regions',
    file: 'flags/regions.json',
    ...FLAGS,
    what: `The flag of each division of the maps, at every level they have, by its id in the game. ${FLAGS_WHAT}`,
    es: 'Banderas de las divisiones de los mapas',
    needs: '37',
    run: (source, keep) => flagsFor(source, pieces(), keep),
  },
  {
    id: 'flags-capitals',
    file: 'flags/capitals.json',
    ...FLAGS,
    what: `The flag of the capital, or capitals, of each country, by the id the city has in the game. ${FLAGS_WHAT}`,
    es: 'Banderas de las capitales de los países',
    needs: '112',
    run: (source, keep) => flagsFor(source, capitals(), keep),
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
  /** Keeps a file under a name of the branch. Only inside it: a name is what the source made of an answer from outside. */
  const keep = (name, body) => {
    const dest = path.join(OUT, name);
    if (path.relative(OUT, dest).startsWith('..') || path.isAbsolute(name)) throw new Error(`Un archivo no puede guardarse fuera de la rama: ${name}`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, body);
  };
  try {
    const { text, note, detail } = await run(source, keep);
    const buf = Buffer.from(text, 'utf8');
    keep(source.file, buf);
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
