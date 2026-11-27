// Brings the source data that are kept outside GitHub, npm and PyPI.
//
//   npm run data:outside                    every source, and whether each place they come from answers
//   npm run data:outside -- --only a,b      some of them, in that order (`reach` is the look at the places)
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
 * When everything has to be over, whatever is left to do: no source goes on past it with what it can do
 * without. Several sources of twelve minutes each would otherwise outlast the half hour.
 */
const DEADLINE = Date.now() + Number(process.env.OUTSIDE_TOTAL ?? 24 * 60_000);
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
/** Where each Wikipedia answers what is asked about its pages: `{lang}` stands for its language. */
const WIKIPEDIA = process.env.OUTSIDE_WIKIPEDIA ?? 'https://{lang}.wikipedia.org/w/api.php';
/** The Wikipedias that are looked at, in this order: those of the languages of the game. */
const WIKIS = ['en', 'es'];
/**
 * The lists of what flies a flag and is not in the maps: the countries that are no more, the organisations
 * and the peoples, each by its Wikidata id. scripts/data/flags-lists.mjs writes them from what
 * `flags-candidates` brings.
 */
const FLAG_LISTS = path.resolve(ROOT, process.env.OUTSIDE_FLAG_LISTS ?? 'scripts/data/flags-lists.json');
/** The signals: flags that are nobody's, each a file of Commons named by hand. */
const FLAG_SIGNALS = path.resolve(ROOT, process.env.OUTSIDE_FLAG_SIGNALS ?? 'scripts/data/flags-signals.json');
/**
 * The sheets of the countries (src/screens/FlagProfile.tsx): what is written of each by hand is a file of
 * its own in this folder (`BR.json`), and it names the photographs the sheet shows, each a file of Commons.
 */
const PROFILES = path.resolve(ROOT, process.env.OUTSIDE_PROFILES ?? 'scripts/data/profiles');
/** Additional, captioned photographs after a chosen head; never a replacement for the chosen head. */
const PROFILE_GALLERY = path.resolve(ROOT, process.env.OUTSIDE_GALLERY ?? 'scripts/data/profiles-gallery.json');
/** Research written separately from the full sheets: its stages may also name period photographs. */
const PROFILE_TIMES = path.resolve(ROOT, process.env.OUTSIDE_TIMES ?? 'scripts/data/profiles-times.json');
/**
 * How wide a photograph is brought, in px: one of the widths that Wikimedia draws its pictures at, and
 * more than the game shows one at. The original is not brought: a photograph may weigh tens of megabytes.
 */
const PHOTO_WIDTH = 1920;
/** Where the photographs are kept in the branch: each under the SHA-1 of its original and the width it was asked for at. */
const PHOTO_FILES = 'photos/files';
/**
 * The photograph at the head of the sheet of a country nobody has written of: one chosen by eye for each,
 * a file of Commons, with what is seen in it (scripts/data/profiles-heads.json). A country whose sheet is
 * written by hand names its own photographs, and this one is not brought for it.
 */
const HEADS = path.resolve(ROOT, process.env.OUTSIDE_HEADS ?? 'scripts/data/profiles-heads.json');
/**
 * The countries that such a photograph is about to be chosen for, one id to a line (a line that starts
 * with # is a note): those whose candidates are looked for and brought as small pictures, to choose by eye.
 * A line may say, after the id and a colon, words to look for in Commons too («PE: Machu Picchu»): what a
 * country is best known by is not always what Wikidata shows it with.
 */
const HEADS_ASKED = path.resolve(ROOT, process.env.OUTSIDE_HEADS_ASKED ?? 'scripts/data/heads-asked.txt');
/**
 * What was corrected by hand of what the sources say of each country (scripts/data/profiles-fixes.json): the
 * coat of arms that somebody chose for a country instead of the one Wikidata names is brought too.
 */
const PROFILE_FIXES = path.resolve(ROOT, process.env.OUTSIDE_PROFILE_FIXES ?? 'scripts/data/profiles-fixes.json');
/** How wide the picture of a coat of arms is brought, in px: twice what the sheet shows one at, and more. One of the widths Wikimedia draws its pictures at. */
const ARMS_PICTURE = 330;
/** Where those pictures are kept in the branch: each under the SHA-1 of its original and its width. */
const ARMS_FILES = 'arms/files';
/** How wide the picture of a candidate is brought, in px: enough to choose among them. One of the widths Wikimedia draws its pictures at. */
const HEAD_PICTURE = 330;
/** Where those small pictures are kept in the branch: each under the SHA-1 of its original and its width. */
const HEAD_FILES = 'heads/files';
/** The narrowest original that is a candidate, in px: the photograph chosen for a sheet is kept up to 1280 px wide. */
const HEAD_WIDE = 1280;
/** How many times wider than tall a candidate is, at least and at most: the head of a sheet is twice as wide as tall, and a tower or a strip would lose most of itself in it. */
const HEAD_SHAPE = [1.25, 2.4];
/** How many candidates are kept of each country at most, of those Wikidata shows; and how many of each thing looked for in Commons. */
const HEADS_EACH = 10;
const HEADS_SOUGHT = 8;
/**
 * Where the photographs of Commons that its people have judged good are, the best first, and after them
 * all the photographs there are: something looked for by its words is looked for among the first, and
 * among the next ones only while few have been found.
 */
const HEADS_AMONG = [
  ['featured', 'incategory:"Featured pictures on Wikimedia Commons" '],
  ['quality', 'incategory:"Quality images" '],
  ['any', ''],
];
/** How many found among the best are enough not to look among the next. */
const HEADS_ENOUGH = 4;
/**
 * What a country is known by, as Wikidata has it, each kind with how it is asked for and how many of it are
 * candidates at most (those that most Wikipedias tell of, first): what UNESCO lists as World Heritage, its
 * national parks, what is called a tourist attraction, its capital and its highest point. Each gives the
 * picture Wikidata shows it with (P18).
 */
const SIGHTS = [
  { kind: 'heritage', most: 6, where: '?sight wdt:P1435 wd:Q9259 ; wdt:P17 ?country .' },
  { kind: 'park', most: 2, where: '?sight wdt:P31 wd:Q46169 ; wdt:P17 ?country .' },
  { kind: 'sight', most: 3, where: '?sight wdt:P31 wd:Q570116 ; wdt:P17 ?country .' },
  { kind: 'capital', most: 1, where: '?country wdt:P36 ?sight .' },
  { kind: 'top', most: 1, where: '?country wdt:P610 ?sight .' },
];
/** How many pages of Wikimedia sites have to tell of something that has a flag for it to be a candidate for those lists. */
const CANDIDATE_LINKS = Number(process.env.OUTSIDE_CANDIDATE_LINKS ?? 40);
/** How many of them Wikidata is asked about in one question: they are thousands, and each question has its wait. */
const CANDIDATES_AT_ONCE = 400;
/** Words in a drawing: text that is set, and not shapes that are drawn. */
const WORDS = /<(text|tspan|textPath|tref)\b/i;
/**
 * A category of Commons that may say of the file in it that it is not a flag that flies: one of other
 * times, one that somebody proposed, one that nobody ever flew. It is told and nothing more: «Historical
 * flags of…» holds many a flag that flies, and «Flags of former…» speaks of the thing and not of its flag.
 * What is made of it is decided where the flags are prepared (scripts/data/flags.mjs).
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

/** The cities of the game that `which` takes, by the id each has in it: a city has no code and no area to be judged by. */
function citiesThat(which) {
  const cities = JSON.parse(fs.readFileSync(path.join(DATA, 'cities.json'), 'utf8')).c ?? {};
  return Object.keys(cities)
    .sort()
    .flatMap((map) => cities[map].filter(which).map((c) => ({ id: String(c.i), map, wd: QID.test(c.wd ?? '') ? c.wd : null, area: null })));
}
/** The capitals of the countries, as the list of cities has them (3 is the capital, 2 a second one). */
const capitals = () => citiesThat((c) => c.k >= 2);
/** The other cities of the game: those that are the capital of no country. */
const towns = () => citiesThat((c) => !(c.k >= 2));

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

/** What a site of Wikimedia answers a question with. A place that is busy with its own copies says so with a 200, and is asked again after a wait. */
async function wikiSays(url, form, until, name = new URL(url).host) {
  for (let n = 0; ; n++) {
    const { body } = await request(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' }, body: form.toString(), until });
    const json = JSON.parse(body.toString('utf8'));
    if (!json?.error) return json ?? {};
    if (n >= 3 || !['maxlag', 'ratelimited'].includes(json.error.code) || Date.now() >= until) throw new Error(`${name}: ${json.error.code ?? 'error'}`);
    await sleep(PAUSE * 4 ** (n + 1));
  }
}
const commonsSays = (form, until) => wikiSays(COMMONS, form, until, 'Commons');

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

/** The titles of the pages that a Wikipedia answers about, by the name each was asked under: a name written another way, or one that leads to another page, is followed. */
function followed(json) {
  const leads = new Map();
  for (const { from, to } of [...(json.query?.normalized ?? []), ...(json.query?.redirects ?? [])]) leads.set(String(from), String(to));
  return (name) => {
    let title = name;
    for (let hop = 0; hop < 4 && leads.has(title); hop++) title = leads.get(title);
    return title;
  };
}

/** The page each of these entities has in each of the Wikipedias that are looked at: for each entity, its title by language. */
async function pagesOf(ids, opts) {
  const sites = WIKIS.map((lang) => `<https://${lang}.wikipedia.org/>`).join(' ');
  const rows = await inParts(ids, 200, (part) => `SELECT ?item ?site ?name WHERE { VALUES ?item { ${wd(part)} } VALUES ?site { ${sites} } ?page schema:about ?item ; schema:isPartOf ?site ; schema:name ?name }`, opts);
  const pages = new Map();
  for (const row of rows) {
    const [id, lang] = [entity(row.item), /^https:\/\/([a-z-]+)\.wikipedia\.org\/$/.exec(String(row.site?.value ?? ''))?.[1]];
    if (id && lang && row.name?.value) pages.set(id, { ...(pages.get(id) ?? {}), [lang]: String(row.name.value) });
  }
  return pages;
}

/**
 * The start of each of these pages of a Wikipedia as it is written (what comes before its first heading:
 * the box of facts is there), fifty at a time and by the title that was asked. An answer that does not fit
 * comes in pieces.
 */
async function leadsOf(lang, titles, until = Infinity) {
  const url = WIKIPEDIA.replace('{lang}', lang);
  const found = new Map();
  for (const part of chunks(titles, 50)) {
    if (Date.now() >= until) throw new Error('no quedaba tiempo');
    let more = {};
    const texts = new Map();
    let titled = (name) => name;
    for (let piece = 0; piece < 20; piece++) {
      const json = await wikiSays(url, new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', redirects: '1', maxlag: '5', prop: 'revisions', rvprop: 'content', rvslots: 'main', rvsection: '0', titles: part.join('|'), ...more }), until);
      titled = followed(json);
      for (const page of json.query?.pages ?? []) {
        const text = page.revisions?.[0]?.slots?.main?.content;
        if (typeof text === 'string') texts.set(String(page.title), text);
      }
      if (!json.continue) break;
      more = json.continue;
    }
    for (const title of part) if (texts.has(titled(title))) found.set(title, texts.get(titled(title)));
    await sleep(PAUSE);
  }
  return found;
}

/** The parameter of a box of facts that names the flag: `image_flag` in the English Wikipedia, `bandera` in the Spanish one. */
const FLAG_PARAM = /^[ \t]*\|[ \t]*(?:image[_ ]flag|flag[_ ]image|imagen[_ ]bandera|bandera|flag)[ \t]*=[ \t]*(.*)$/gim;
const PICTURE_NAME = /^[^{}<>[\]#|]+\.(?:svg|png|gif|jpe?g|webp)$/i;

/**
 * The flag that the box of facts of a page of Wikipedia shows: the file that its parameter for the flag
 * names, or none. Only a file is one: a template that draws the flag of something else (`{{flag|…}}`), a
 * «no» and a size are not.
 */
function flagIn(text) {
  const lead = String(text ?? '').replace(/<!--[\s\S]*?-->/g, '');
  for (const [, said] of lead.matchAll(FLAG_PARAM)) {
    const name = said
      .replace(/\{\{\s*!\s*\}\}/g, '|')
      .replace(/^\[\[/, '')
      .split(/[|\]]/)[0]
      .replace(/^\s*(?:file|image|archivo|imagen|fichier)\s*:\s*/i, '')
      .replace(/_/g, ' ')
      .trim();
    if (PICTURE_NAME.test(name)) return name;
  }
  return null;
}

/**
 * What Commons says of each of the files that are named, and the files themselves, kept as they come.
 *
 * What it says: what the file holds, who made it and on what terms it is given, which a game that shows it
 * has to say. A photograph whose page says that somebody has drawn the flag again is brought as that
 * drawing (`drawn`), with the photograph left out. What the categories it is in say of it is told (`marks`).
 *
 * The files: one at a time, and unhurried. An original too heavy to be of use is brought as the picture
 * Wikimedia draws of it (`picture`); a drawing with words in it (`words`), and any other that the list of
 * pictures names, is brought both ways. A file that cannot be downloaded, or that there was no time for,
 * has its entry with no file, and the next run brings it: what the branch already keeps is not downloaded
 * again.
 *
 * Gives what was learnt of each file by its title, the title each name leads to, and how the download went.
 */
async function filesOf(names, { until, keep, attempt, undone }) {
  const files = {};
  const sources = new Map();
  const titles = new Map();
  const learn = async (list) => {
    const { pages, titled } = await commonsOf(list, { prop: 'imageinfo', iiprop: 'url|size|mime|sha1|extmetadata', iiextmetadatafilter: 'LicenseShortName|UsageTerms|LicenseUrl|Artist|Credit|AttributionRequired|Restrictions', iiurlwidth: String(FLAG_PICTURE) }, until);
    for (const name of list) {
      const title = titled(name);
      titles.set(name, title);
      const info = about(pages.get(title));
      files[title] = info ?? { missing: true };
      if (info) sources.set(title, pages.get(title).imageinfo[0]);
    }
  };
  await learn([...new Set(names)].sort());

  await attempt('los dibujos de las banderas que son fotografías', async () => {
    const photos = Object.keys(files).filter((title) => !files[title].missing && files[title].mime !== 'image/svg+xml').sort();
    const { pages } = await commonsOf(photos, { prop: 'revisions', rvprop: 'content', rvslots: 'main' }, until);
    const drawn = new Map();
    for (const title of photos) {
      const name = drawnAs(pages.get(title)?.revisions?.[0]?.slots?.main?.content);
      if (name) drawn.set(title, name);
    }
    const fresh = [...new Set(drawn.values())].filter((name) => !files[name]).sort();
    if (fresh.length) await learn(fresh);
    for (const [title, name] of drawn) {
      const drawing = titles.get(name) ?? name;
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

  /* The download: every file that was named, less the photographs that have a drawing; one at a time, and unhurried. */
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

  const real = Object.values(files).filter((f) => !f.missing);
  return {
    files,
    titled: (name) => titles.get(name) ?? name,
    note: `${wanted.length} archivos: ${brought.length} descargados (${kB(bytes)}${pictures ? `, con ${pictures} imágenes` : ''})${there.length ? `, ${there.length} que ya estaban` : ''}${left.length ? `, ${left.length} sin traer` : ''}`,
    detail: {
      files: { all: real.length, missing: Object.values(files).length - real.length, drawn: real.filter((f) => f.drawn).length, words: real.filter((f) => f.words).length, wanted: wanted.length, brought: brought.length, there: there.length, left: left.length, pictures, bytes },
      kinds: tally(real, (f) => KIND[f.mime] ?? f.mime),
      licences: tally(real, (f) => f.licence || '?'),
    },
  };
}

/** How many of a list there are of each kind, the most first. */
function tally(list, of) {
  const n = {};
  for (const one of list) n[of(one)] = (n[of(one)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(n).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

/** What a source of flags may go on doing without, once it has what it cannot: each thing is tried, and what fails or finds no time is told. */
function patient() {
  const until = Math.min(Date.now() + PATIENCE, DEADLINE);
  const undone = [];
  const attempt = async (what, find) => {
    if (Date.now() >= until) return void undone.push(`${what} (no quedaba tiempo)`);
    try {
      await find();
    } catch (err) {
      undone.push(`${what} (${short(err)})`);
    }
  };
  return { until, undone, attempt, lax: { tries: 4, impatient: true, until } };
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
 * round. An entity that small with nothing to take its place keeps its flag, and says so (`tiny`).
 *
 * What Wikidata gives no flag of may still have one that it was never told: the flag that the box of facts
 * of its page of Wikipedia shows is taken then (`by: wikipedia`, with the page under `page`), the English
 * Wikipedia before the Spanish one. A flag given by hand (`by: hand`) comes before any of them, and what
 * the others gave is told (`instead`).
 *
 * Which file, and how it is brought: see `filesOf`. The flag that is only told (`other`) is brought too:
 * which of the two it is, is for whoever builds the game to say.
 *
 * Only the first question has to be answered. What Wikidata does not answer after it is left out and told.
 */
async function flagsFor(source, subjects, keep) {
  if (!subjects.length) throw new Error('Nothing to ask the flag of');
  const own = [...new Set(subjects.filter((u) => u.wd).map((u) => u.wd))].sort(byNumber);
  if (!own.length) throw new Error('Nothing to ask the flag of has a Wikidata id');
  const { until, undone, attempt, lax } = patient();

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

  // What Wikidata gives no flag of: the one that the box of facts of its page of Wikipedia shows.
  await attempt('las fichas de Wikipedia', async () => {
    const now = (u) => moved.get(u.wd) ?? u.wd;
    const bare = subjects.filter((u) => u.wd && !items[u.id]);
    if (!bare.length) return;
    const pages = await pagesOf([...new Set(bare.map(now))].sort(byNumber), lax);
    for (const lang of WIKIS) {
      const left = bare.filter((u) => !items[u.id] && pages.get(now(u))?.[lang]);
      if (!left.length) continue;
      const texts = await leadsOf(lang, [...new Set(left.map((u) => pages.get(now(u))[lang]))].sort(), until);
      for (const u of left) {
        const title = pages.get(now(u))[lang];
        const file = flagIn(texts.get(title));
        if (file) items[u.id] = { wd: now(u), by: 'wikipedia', page: `${lang}:${title}`, file };
      }
    }
  });

  for (const [id, title] of byHand(source)) {
    if (!subjects.some((u) => u.id === id)) continue;
    const was = items[id];
    items[id] = { ...(was ? { wd: was.wd } : {}), by: 'hand', file: title, ...(was && was.file !== title ? { instead: was.file } : {}) };
  }

  // Every flag that some thing flies today: its own, the others its entity gives, and that of the entity with its code.
  const asked = Object.values(items).flatMap((item) => [item.file, ...(item.also ?? []), ...(item.other ? [item.other.file] : [])]);
  const got = await filesOf(asked, { until, keep, attempt, undone });
  for (const item of Object.values(items)) {
    item.file = got.titled(item.file);
    if (item.also) item.also = item.also.map(got.titled);
    if (item.other) item.other.file = got.titled(item.other.file);
  }

  const flying = Object.values(items);
  return {
    text: listed({ source: source.from, licence: source.licence, what: source.what, asked: subjects.length }, { items, files: got.files }),
    note: [`${flying.length} de ${subjects.length} tienen bandera`, got.note, ...(undone.length ? [`sin mirar: ${undone.join('; ')}`] : [])].join('; '),
    detail: {
      asked: subjects.length,
      found: flying.length,
      by: tally(flying, (item) => item.by ?? 'id'),
      doubted: { other: flying.filter((item) => item.other).length, tiny: flying.filter((item) => item.tiny).length },
      ...got.detail,
      undone,
    },
  };
}

/** A statement of a flag as a data file tells it: its file, its rank when it is not the usual one, and the days it says it flew between. */
const told = (st) => ({ file: st.file, ...(st.rank !== 'normal' ? { rank: st.rank } : {}), ...(st.from ? { from: st.from } : {}), ...(st.to ? { to: st.to } : {}) });
/** The flags that are said to have stopped flying, the last to do so first; one that does not say when comes after those that do. */
const ended = (list) =>
  [...(list?.values() ?? [])]
    .filter((f) => f.rank !== 'deprecated' && f.to)
    .sort((a, b) => (b.to === '?' ? '' : b.to).localeCompare(a.to === '?' ? '' : a.to) || a.file.localeCompare(b.file));

/** The countries of the game, each with its Wikidata entity. */
function countries() {
  const index = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8'));
  return (index.countries ?? []).filter((c) => QID.test(c.wd ?? '')).map((c) => ({ id: String(c.id), wd: c.wd }));
}

/**
 * The flags that the countries of the game flew before the one they fly: those that Wikidata gives each
 * with the day it stopped being flown (`past`, the last first, each with the days it flew between), and
 * their files. A country none of whose flags has such a day is left out.
 */
async function pastFlags(source, keep) {
  const subjects = countries();
  if (!subjects.length) throw new Error('No country to ask the flags of has a Wikidata id');
  const { until, undone, attempt } = patient();
  const flags = await flagsOf([...new Set(subjects.map((u) => u.wd))].sort(byNumber), { until: Date.now() + PATIENCE / 2 });
  const items = {};
  for (const u of subjects) {
    const past = ended(flags.get(u.wd));
    if (past.length) items[u.id] = { wd: u.wd, past: past.map(told) };
  }
  const got = await filesOf(Object.values(items).flatMap((item) => item.past.map((f) => f.file)), { until, keep, attempt, undone });
  for (const item of Object.values(items)) for (const f of item.past) f.file = got.titled(f.file);
  const n = Object.values(items).reduce((sum, item) => sum + item.past.length, 0);
  return {
    text: listed({ source: source.from, licence: source.licence, what: source.what, asked: subjects.length }, { items, files: got.files }),
    note: [`${n} banderas anteriores de ${Object.keys(items).length} de ${subjects.length} países`, got.note, ...(undone.length ? [`sin mirar: ${undone.join('; ')}`] : [])].join('; '),
    detail: { asked: subjects.length, found: Object.keys(items).length, flags: n, ...got.detail, undone },
  };
}

/** A list of the repository, or nothing where it is not there or cannot be read. */
function listOf(file) {
  try {
    const said = JSON.parse(fs.readFileSync(file, 'utf8'));
    return said && typeof said === 'object' ? said : {};
  } catch {
    return {};
  }
}
/** How many flags of other times are brought of one thing at most: the last ones it flew. */
const PAST_AT_MOST = 6;

/**
 * The flags of what the lists name (scripts/data/flags-lists.json: the countries that are no more, the
 * organisations and the peoples, each by its Wikidata id): for each, the flag it flies today (`file`, with
 * `rank` when Wikidata prefers it to the others, and the others it gives as of today under `also`) and
 * those it stopped flying (`past`, the last first), which is all that something that is no more should
 * have. One given by hand comes before them, as for the maps.
 */
async function listedFlags(source, keep) {
  const lists = listOf(FLAG_LISTS);
  const ids = [...new Set(Object.values(lists).flatMap((list) => Object.keys(list ?? {})))].filter((id) => QID.test(id)).sort(byNumber);
  if (!ids.length) throw new Error('The lists name nothing to ask the flag of');
  const { until, undone, attempt } = patient();
  const flags = await flagsOf(ids, { until: Date.now() + PATIENCE / 2 });
  const items = {};
  for (const id of ids) {
    const { now } = flown(flags.get(id));
    const past = ended(flags.get(id)).slice(0, PAST_AT_MOST);
    if (!now.length && !past.length) continue;
    const [flag, ...also] = now;
    items[id] = { ...(flag ? { file: flag.file, ...(flag.rank !== 'normal' ? { rank: flag.rank } : {}), ...(flag.from && flag.from !== '?' ? { from: flag.from } : {}) } : {}), ...(also.length ? { also: also.slice(0, 3).map((f) => f.file) } : {}), ...(past.length ? { past: past.map(told) } : {}) };
  }
  for (const [id, title] of byHand(source)) {
    if (!ids.includes(id)) continue;
    const was = items[id];
    items[id] = { ...(was ?? {}), by: 'hand', file: title, ...(was?.file && was.file !== title ? { instead: was.file } : {}) };
  }
  const got = await filesOf(Object.values(items).flatMap((item) => [...(item.file ? [item.file] : []), ...(item.also ?? []), ...(item.past ?? []).map((f) => f.file)]), { until, keep, attempt, undone });
  for (const item of Object.values(items)) {
    if (item.file) item.file = got.titled(item.file);
    if (item.also) item.also = item.also.map(got.titled);
    for (const f of item.past ?? []) f.file = got.titled(f.file);
  }
  return {
    text: listed({ source: source.from, licence: source.licence, what: source.what, asked: ids.length }, { items, files: got.files }),
    note: [`${Object.keys(items).length} de ${ids.length} tienen bandera`, got.note, ...(undone.length ? [`sin mirar: ${undone.join('; ')}`] : [])].join('; '),
    detail: { asked: ids.length, found: Object.keys(items).length, ...got.detail, undone },
  };
}

/** The flags that are no place's and no people's: the signals, which the list names file by file (scripts/data/flags-signals.json). */
async function signalFlags(source, keep) {
  const named = Object.entries(listOf(FLAG_SIGNALS).signals ?? {}).filter(([, one]) => typeof one?.file === 'string' && one.file.trim());
  if (!named.length) throw new Error('The list of signals names no file');
  const { until, undone, attempt } = patient();
  const items = Object.fromEntries(named.map(([id, one]) => [id, { by: 'hand', file: one.file.trim() }]));
  const got = await filesOf(Object.values(items).map((item) => item.file), { until, keep, attempt, undone });
  for (const item of Object.values(items)) item.file = got.titled(item.file);
  return {
    text: listed({ source: source.from, licence: source.licence, what: source.what, asked: named.length }, { items, files: got.files }),
    note: [`${named.length} señales`, got.note, ...(undone.length ? [`sin mirar: ${undone.join('; ')}`] : [])].join('; '),
    detail: { asked: named.length, found: named.length, ...got.detail, undone },
  };
}

/** The photograph chosen for the head of the sheet of each country, by its id: what the file of them says, without its note. */
function headsChosen() {
  if (!fs.existsSync(HEADS)) return {};
  const { _: _note, ...heads } = JSON.parse(fs.readFileSync(HEADS, 'utf8'));
  return heads;
}

/** The photographs that a sheet names: those it shows, and the one of each of its times that has one. */
function photosIn(sheet) {
  const named = [...(Array.isArray(sheet?.photos) ? sheet.photos : []), ...(Array.isArray(sheet?.times) ? sheet.times.map((time) => time?.picture) : [])];
  return [...new Set(named.map((one) => (typeof one?.file === 'string' ? one.file.trim() : '')).filter(Boolean))];
}

/**
 * The photographs of the sheets of the countries, each a file of Commons named by a complete sheet,
 * a chosen head, its additional gallery (scripts/data/profiles-gallery.json), or an independently written
 * timeline (scripts/data/profiles-times.json).
 * Of each: what Commons says of it (who made it and on what terms it is given,
 * which the sheet has to say under it) and the picture that Wikimedia draws of it, `PHOTO_WIDTH` px wide.
 * The original is never asked for. A photograph that could not be brought has its entry with no picture.
 */
async function profilePhotos(source, keep) {
  const sheets = fs.existsSync(PROFILES) ? fs.readdirSync(PROFILES).filter((name) => name.endsWith('.json')).sort() : [];
  const items = {};
  for (const name of sheets) {
    const photos = photosIn(JSON.parse(fs.readFileSync(path.join(PROFILES, name), 'utf8')));
    if (photos.length) items[name.slice(0, -5)] = { photos };
  }
  // The one chosen for the head of the sheet of each country nobody has written of.
  for (const [id, head] of Object.entries(headsChosen())) if (!items[id] && typeof head?.file === 'string' && head.file.trim()) items[id] = { photos: [head.file.trim()] };
  // A gallery adds to an existing head, never replacing it. One manifest supplies captions for the build
  // and names the very same Commons files for the workflow; otherwise the two can drift apart.
  if (fs.existsSync(PROFILE_GALLERY)) {
    const { _: _note, ...gallery } = JSON.parse(fs.readFileSync(PROFILE_GALLERY, 'utf8'));
    for (const [id, photos] of Object.entries(gallery)) {
      if (!items[id]) throw new Error(`The gallery of ${id} has no chosen head or hand-written sheet`);
      if (!Array.isArray(photos) || !photos.length || photosIn({ photos }).length !== photos.length) throw new Error(`The gallery of ${id} needs distinct Commons files`);
      const named = [...items[id].photos, ...photosIn({ photos })];
      if (new Set(named).size !== named.length) throw new Error(`The gallery of ${id} repeats its head or another photograph`);
      items[id].photos = named;
    }
  }
  // A timeline is an addition to the sheet, not a replacement for its head photograph. Ask for both.
  if (fs.existsSync(PROFILE_TIMES)) {
    const { _: _about, ...timelines } = JSON.parse(fs.readFileSync(PROFILE_TIMES, 'utf8'));
    for (const [id, timeline] of Object.entries(timelines)) {
      const photos = photosIn({ times: timeline.times });
      if (photos.length) items[id] = { photos: [...new Set([...(items[id]?.photos ?? []), ...photos])] };
    }
  }
  const names = [...new Set(Object.values(items).flatMap((item) => item.photos))].sort();
  if (!names.length) throw new Error('The sheets name no photograph');
  const { until, undone } = patient();
  const { pages, titled } = await commonsOf(names, {
    prop: 'imageinfo',
    iiprop: 'url|size|mime|thumbmime|sha1|extmetadata',
    iiextmetadatafilter: 'LicenseShortName|UsageTerms|LicenseUrl|Artist|Credit|AttributionRequired|Restrictions',
    iiurlwidth: String(PHOTO_WIDTH),
  });
  const files = {};
  const sources = new Map();
  for (const name of names) {
    const title = titled(name);
    const info = about(pages.get(title));
    files[title] = info ?? { missing: true };
    if (info) sources.set(title, pages.get(title).imageinfo[0]);
  }
  for (const item of Object.values(items)) item.photos = [...new Set(item.photos.map(titled))];

  const [brought, left] = [[], []];
  let [bytes, failed] = [0, 0];
  let last = null;
  for (const title of [...sources.keys()].sort()) {
    if (Date.now() >= until || failed >= FLAGS_FAILED) {
      left.push(title);
      continue;
    }
    const file = files[title];
    const from = sources.get(title);
    // The picture that Wikimedia draws of it: what a photograph is drawn as is a photograph, whatever the original was kept as.
    const kind = KIND[from.thumbmime] ?? (file.mime === 'image/png' ? 'png' : 'jpg');
    try {
      await sleep(FLAG_GAP);
      const { body } = await request(from.thumburl ?? from.url, { tries: 3, until });
      const at = `${PHOTO_FILES}/${file.sha1}.${PHOTO_WIDTH}.${kind}`;
      keep(at, body);
      file.picture = at;
      bytes += body.length;
      brought.push(title);
      failed = 0;
    } catch (err) {
      failed++;
      last = err;
      left.push(title);
    }
  }
  if (left.length) undone.push(`${left.length} de ${sources.size} fotografías (${last ? short(last) : 'no quedaba tiempo'})`);
  const missing = names.length - sources.size;
  return {
    text: listed({ source: source.from, licence: source.licence, what: source.what, asked: names.length }, { items, files }),
    note: [`${names.length} fotografías de ${Object.keys(items).length} fichas: ${brought.length} traídas (${kB(bytes)})`, ...(missing ? [`${missing} que Commons no tiene`] : []), ...(undone.length ? [`sin mirar: ${undone.join('; ')}`] : [])].join('; '),
    detail: {
      asked: names.length,
      found: sources.size,
      files: { all: sources.size, missing, brought: brought.length, left: left.length, bytes },
      licences: tally([...sources.keys()].map((title) => files[title]), (f) => f.licence || '?'),
      undone,
    },
  };
}

/* ------------------------------------------------------------------ what to show at the head of a sheet */

/** The countries named in the list of those a photograph is to be chosen for: by the id of each, the words to look for in Commons that the list gives it. */
function headsAsked() {
  const asked = new Map();
  if (!fs.existsSync(HEADS_ASKED)) return asked;
  for (const line of fs.readFileSync(HEADS_ASKED, 'utf8').split(/\r?\n/)) {
    const [id, ...rest] = line.replace(/#.*/, '').split(':');
    if (!id.trim()) continue;
    const words = rest.join(':').replace(/\s+/g, ' ').trim();
    const sought = asked.get(id.trim()) ?? asked.set(id.trim(), []).get(id.trim());
    if (words && !sought.includes(words)) sought.push(words);
  }
  return asked;
}

/** What is asked of Commons about a file that may be shown at the head of a sheet. */
const HEAD_ASKING = {
  prop: 'imageinfo',
  iiprop: 'url|size|mime|thumbmime|sha1|extmetadata',
  iiextmetadatafilter: 'LicenseShortName|UsageTerms|LicenseUrl|Artist|Credit|AttributionRequired|Restrictions',
  iiurlwidth: String(HEAD_PICTURE),
};

/**
 * The photographs of Commons that answer to some words and could be at the head of a sheet, the ones its
 * people have judged best first: each with where it was found (`among`), and the page of each by its title.
 */
async function soughtInCommons(words, until) {
  const found = [];
  const pages = new Map();
  for (const [among, where] of HEADS_AMONG) {
    const json = await commonsSays(
      new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', maxlag: '5', generator: 'search', gsrnamespace: '6', gsrlimit: '20', gsrsearch: `${words} ${where}filetype:bitmap filew:>${HEAD_WIDE - 1}`, ...HEAD_ASKING }),
      until,
    );
    // As Commons orders them: what answers best to the words, first.
    for (const page of [...(json.query?.pages ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))) {
      const title = bare(page.title);
      if (pages.has(title) || found.length >= HEADS_SOUGHT || !fitsHead(about(page))) continue;
      pages.set(title, page);
      found.push({ file: title, among });
    }
    await sleep(PAUSE);
    if (found.length >= HEADS_ENOUGH) break;
  }
  return { found, pages };
}

/** Whether a file of Commons could be the photograph at the head of a sheet: a photograph, wide enough, and of a shape that fits there. */
const fitsHead = (file) => !!file && file.mime === 'image/jpeg' && file.w >= HEAD_WIDE && file.h > 0 && file.w / file.h >= HEAD_SHAPE[0] && file.w / file.h <= HEAD_SHAPE[1];

/**
 * What could be shown at the head of the sheet of each country that is named (scripts/data/heads-asked.txt):
 * the pictures that Wikidata shows what the country is known by with (`SIGHTS`), each with what it is of and
 * how many Wikipedias tell of that, and a small picture of each to choose among them by eye. Nothing is
 * chosen here: somebody looks at them and writes the one that stays in scripts/data/profiles-heads.json,
 * and the source `photos` brings that one as the sheet will show it.
 */
async function headSights(source, keep) {
  const asked = headsAsked();
  const subjects = countries().filter((u) => asked.has(u.id));
  if (!subjects.length) throw new Error('No country of the game is named to look for what to show at the head of its sheet');
  const { until, undone, attempt, lax } = patient();
  const ids = [...new Set(subjects.map((u) => u.wd))].sort(byNumber);
  const text = (cell) => (cell?.value ? String(cell.value).replace(/\s+/g, ' ').trim() : '');

  /** What each country is known by, by kind: the best known first, each once and with one picture. */
  const found = new Map(ids.map((id) => [id, []]));
  let first = true;
  for (const { kind, most, where } of SIGHTS) {
    const ask = async () => {
      const rows = await inParts(
        ids,
        40,
        (part) =>
          `SELECT ?country ?sight ?image ?links ?es ?en WHERE { VALUES ?country { ${wd(part)} } ${where} ?sight wdt:P18 ?image ; wikibase:sitelinks ?links . ` +
          'OPTIONAL { ?sight rdfs:label ?es FILTER(LANG(?es) = "es") } OPTIONAL { ?sight rdfs:label ?en FILTER(LANG(?en) = "en") } }',
        first ? { until: Date.now() + PATIENCE / 2 } : lax,
      );
      const of = new Map();
      for (const row of rows) {
        const [country, sight, file] = [entity(row.country), entity(row.sight), fileOf(row.image)];
        if (!found.has(country) || !sight || !file) continue;
        const list = of.get(country) ?? of.set(country, new Map()).get(country);
        const was = list.get(sight);
        // A thing with several pictures is a candidate with one: the first by name, so that asking again gives the same.
        if (!was || file < was.file) list.set(sight, { file, kind, of: sight, links: Number(row.links?.value) || 0, ...(text(row.es) ? { es: text(row.es) } : {}), ...(text(row.en) ? { en: text(row.en) } : {}) });
      }
      // Twice as many as will stay: some will turn out not to fit the head of a sheet.
      for (const [country, list] of of) found.get(country).push(...[...list.values()].sort((a, b) => b.links - a.links || byNumber(a.of, b.of)).slice(0, most * 2));
    };
    // The first kind has to come: without it there is nothing to say whether Wikidata answers.
    if (first) await ask();
    else await attempt(kind, ask);
    first = false;
  }

  const names = [...new Set([...found.values()].flatMap((list) => list.map((one) => one.file)))].sort();
  if (!names.length && ![...asked.values()].some((list) => list.length)) throw new Error('Wikidata shows nothing of the countries named with a picture');
  const { pages, titled } = await commonsOf(names, HEAD_ASKING, until);

  const items = {};
  const files = {};
  const sources = new Map();
  let unfit = 0;
  for (const u of subjects) {
    const sights = [];
    const per = {};
    for (const one of found.get(u.wd)) {
      const title = titled(one.file);
      const info = about(pages.get(title));
      if (sights.some((s) => s.file === title)) continue;
      if (!fitsHead(info)) {
        unfit++;
        continue;
      }
      const most = SIGHTS.find((s) => s.kind === one.kind).most;
      if ((per[one.kind] ?? 0) >= most || sights.length >= HEADS_EACH) continue;
      per[one.kind] = (per[one.kind] ?? 0) + 1;
      sights.push({ ...one, file: title });
      files[title] = info;
      sources.set(title, pages.get(title).imageinfo[0]);
    }
    items[u.id] = { sights };
  }
  // What the list says to look for in Commons by its words, after what Wikidata shows: each thing looked for, with what was found of it.
  let sought = 0;
  for (const u of subjects)
    for (const words of asked.get(u.id)) {
      sought++;
      await attempt(`«${words}»`, async () => {
        const { found: got, pages: theirs } = await soughtInCommons(words, until);
        for (const one of got) {
          if (items[u.id].sights.some((s) => s.file === one.file)) continue;
          items[u.id].sights.push({ file: one.file, kind: 'sought', words, among: one.among });
          files[one.file] = about(theirs.get(one.file));
          sources.set(one.file, theirs.get(one.file).imageinfo[0]);
        }
      });
    }

  const [brought, left] = [[], []];
  let [bytes, failed] = [0, 0];
  let last = null;
  for (const title of [...sources.keys()].sort()) {
    if (Date.now() >= until || failed >= FLAGS_FAILED) {
      left.push(title);
      continue;
    }
    const file = files[title];
    const from = sources.get(title);
    try {
      await sleep(FLAG_GAP);
      const { body } = await request(from.thumburl ?? from.url, { tries: 3, until });
      const at = `${HEAD_FILES}/${file.sha1}.${HEAD_PICTURE}.jpg`;
      keep(at, body);
      file.picture = at;
      bytes += body.length;
      brought.push(title);
      failed = 0;
    } catch (err) {
      failed++;
      last = err;
      left.push(title);
    }
  }
  if (left.length) undone.push(`${left.length} de ${sources.size} imágenes (${last ? short(last) : 'no quedaba tiempo'})`);
  const none = subjects.filter((u) => !items[u.id].sights.length).map((u) => u.id);
  return {
    text: listed({ source: source.from, licence: source.licence, what: source.what, asked: subjects.length }, { items, files }),
    note: [
      `${sources.size} candidatas para ${subjects.length - none.length} de ${subjects.length} países: ${brought.length} imágenes traídas (${kB(bytes)})`,
      ...(sought ? [`${sought} cosas buscadas en Commons por su nombre`] : []),
      ...(unfit ? [`${unfit} que no sirven de cabecera`] : []),
      ...(none.length ? [`sin ninguna: ${none.join(' ')}`] : []),
      ...(undone.length ? [`sin mirar: ${undone.join('; ')}`] : []),
    ].join('; '),
    detail: {
      asked: subjects.length,
      found: subjects.length - none.length,
      none,
      files: { all: sources.size, unfit, brought: brought.length, left: left.length, bytes },
      kinds: tally(Object.values(items).flatMap((item) => item.sights), (s) => s.kind),
      licences: tally([...sources.keys()].map((title) => files[title]), (f) => f.licence || '?'),
      undone,
    },
  };
}

/* ------------------------------------------------------------------ the coat of arms of each country */

/** The coat of arms that somebody chose for a country instead of the one Wikidata names, by the id of the country: the title of its file. */
function armsChosen() {
  if (!fs.existsSync(PROFILE_FIXES)) return {};
  const { _: _note, ...fixes } = JSON.parse(fs.readFileSync(PROFILE_FIXES, 'utf8'));
  return Object.fromEntries(Object.entries(fixes).flatMap(([id, fix]) => (typeof fix?.arms?.file === 'string' && fix.arms.file.trim() ? [[id, fix.arms.file.trim()]] : [])));
}

/**
 * The coat of arms of each country of the game — or its emblem, or its seal: what Wikidata shows it with
 * (P94) — and the one that somebody chose for it by hand instead (scripts/data/profiles-fixes.json). Of
 * each file, what Commons says of it (who drew it and on what terms it is given) and a picture of it as
 * Wikimedia draws it, `ARMS_PICTURE` px wide: most are drawings that weigh hundreds of kilobytes, and the
 * sheet shows one small. Which of them a sheet shows is decided where the sheets are made.
 */
async function countryArms(source, keep) {
  const subjects = countries();
  if (!subjects.length) throw new Error('No country of the game has a Wikidata id');
  const { until, undone } = patient();
  const ids = [...new Set(subjects.map((u) => u.wd))].sort(byNumber);
  const named = new Map(ids.map((id) => [id, []]));
  for (const row of await valuesOf(ids, 'P94', { until: Date.now() + PATIENCE / 2 })) {
    const [list, file] = [named.get(entity(row.item)), fileOf(row.value)];
    if (list && file && !list.includes(file)) list.push(file);
  }
  const chosen = armsChosen();
  const names = [...new Set([...[...named.values()].flat(), ...subjects.flatMap((u) => (chosen[u.id] ? [chosen[u.id]] : []))])].sort();
  if (!names.length) throw new Error('Wikidata names the coat of arms of no country');
  const { pages, titled } = await commonsOf(names, { ...HEAD_ASKING, iiurlwidth: String(ARMS_PICTURE) }, until);

  const items = {};
  for (const u of subjects) {
    // Each under the title Commons has it by, and in the same order whenever they are asked for.
    const said = [...new Set(named.get(u.wd).map(titled))].sort();
    const mine = chosen[u.id] ? titled(chosen[u.id]) : null;
    if (said.length || mine) items[u.id] = { ...(said.length ? { files: said } : {}), ...(mine ? { chosen: mine } : {}) };
  }
  const files = {};
  const sources = new Map();
  for (const title of [...new Set(names.map(titled))].sort()) {
    const info = about(pages.get(title));
    files[title] = info ?? { missing: true };
    if (info) sources.set(title, pages.get(title).imageinfo[0]);
  }

  const [brought, left] = [[], []];
  let [bytes, failed] = [0, 0];
  let last = null;
  for (const title of sources.keys()) {
    if (Date.now() >= until || failed >= FLAGS_FAILED) {
      left.push(title);
      continue;
    }
    const file = files[title];
    const from = sources.get(title);
    // The picture Wikimedia draws of a drawing is a PNG; that of a photograph, what the photograph is.
    const kind = KIND[from.thumbmime] ?? (file.mime === 'image/jpeg' ? 'jpg' : 'png');
    try {
      await sleep(FLAG_GAP);
      const { body } = await request(from.thumburl ?? from.url, { tries: 3, until });
      const at = `${ARMS_FILES}/${file.sha1}.${ARMS_PICTURE}.${kind}`;
      keep(at, body);
      file.picture = at;
      bytes += body.length;
      brought.push(title);
      failed = 0;
    } catch (err) {
      failed++;
      last = err;
      left.push(title);
    }
  }
  if (left.length) undone.push(`${left.length} de ${sources.size} imágenes (${last ? short(last) : 'no quedaba tiempo'})`);
  const missing = Object.keys(files).length - sources.size;
  const several = Object.values(items).filter((item) => (item.files?.length ?? 0) > 1).length;
  return {
    text: listed({ source: source.from, licence: source.licence, what: source.what, asked: subjects.length }, { items, files }),
    note: [
      `escudo de ${Object.keys(items).length} de ${subjects.length} países: ${brought.length} imágenes traídas (${kB(bytes)})`,
      ...(several ? [`${several} países con más de uno`] : []),
      ...(Object.keys(chosen).length ? [`${Object.keys(chosen).length} elegidos a mano`] : []),
      ...(missing ? [`${missing} que Commons no tiene`] : []),
      ...(undone.length ? [`sin mirar: ${undone.join('; ')}`] : []),
    ].join('; '),
    detail: {
      asked: subjects.length,
      found: Object.keys(items).length,
      files: { all: sources.size, missing, brought: brought.length, left: left.length, bytes },
      licences: tally([...sources.keys()].map((title) => files[title]), (f) => f.licence || '?'),
      undone,
    },
  };
}

/* ------------------------------------------------------------------ what is said of each country */

/** What a country says of itself in words, each in its language: what it is called in full, what it calls itself, and its motto. */
const COUNTRY_WORDS = { official: 'P1448', native: 'P1705', motto: 'P1451' };
/** What it names: its anthem, how it is governed and its flag, each an entity. */
const COUNTRY_THINGS = { anthem: 'P85', government: 'P122', flag: 'P163' };
/** What its flag names: its proportions (width to height), its colours and who designed it. */
const FLAG_THINGS = { ratio: 'P2061', colours: 'P462', by: 'P287' };
/** The longest box of facts that is kept, in characters: that of a country is a few thousand. */
const BOX_MAX = 60_000;

/** What each of these entities gives through a property: the values of its statements of best rank that have not ended. */
const valuesOf = (ids, prop, opts) =>
  inParts(ids, 200, (part) => `SELECT ?item ?value WHERE { VALUES ?item { ${wd(part)} } ?item p:${prop} ?st . ?st a wikibase:BestRank ; ps:${prop} ?value . FILTER NOT EXISTS { ?st pq:P582 ?end } }`, opts);

/**
 * The box of facts of a page of Wikipedia, as it is written: the first of its templates that is called one
 * («Infobox…», «Ficha de…»), up to the braces that close it. What it says is read by whoever builds the
 * game (scripts/data/profiles.mjs), where reading it another way does not mean asking again.
 */
function boxIn(text) {
  const start = /\{\{\s*(?:Infobox|Ficha de)\b/i.exec(text)?.index;
  if (start === undefined) return null;
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    const two = text.slice(i, i + 2);
    if (two === '{{') {
      depth++;
      i++;
    } else if (two === '}}') {
      depth--;
      i++;
      if (!depth) return text.slice(start, i + 1).slice(0, BOX_MAX);
    }
  }
  return null;
}

/**
 * What Wikidata and Wikipedia say of each country of the game and of its flag: what the sheets of the
 * countries are filled with before anybody writes anything of them (scripts/data/profiles.mjs).
 *
 * From Wikidata, of the country: what it is called in full (P1448), what it calls itself (P1705) and its
 * motto (P1451), each in the language it is said in; its anthem (P85), how it is governed (P122), its coat
 * of arms (P94, the name of its file in Commons) and its flag (P163). Of the flag, which is an entity of
 * its own: the day it began (P571, with how exactly it is known: 11 a day, 10 a month, 9 a year), its
 * proportions (P2061, width to height), its colours (P462) and who designed it (P287). What is named by an
 * entity has its names in Spanish and in English under `names`.
 *
 * From the English and the Spanish Wikipedia, the page of the country and that of its flag (`pages`) and the
 * box of facts each opens with, as it is written (`boxes`, by `language:title`): a second source to hold
 * what Wikidata says against, and what it does not say (the official name in Spanish).
 *
 * Only the first question has to be answered. What is not answered after it is left out and told.
 */
async function countryFacts(source) {
  const subjects = countries();
  if (!subjects.length) throw new Error('No country of the game has a Wikidata id');
  const { until, undone, attempt, lax } = patient();
  const ids = [...new Set(subjects.map((u) => u.wd))].sort(byNumber);
  const said = new Map(ids.map((id) => [id, {}]));
  const words = (cell) => (cell?.value && cell['xml:lang'] ? [String(cell['xml:lang']), String(cell.value).replace(/\s+/g, ' ').trim()] : null);
  /** One more value of something, once. */
  const add = (one, key, value) => {
    if (!one || value === null || value === undefined) return;
    const list = (one[key] ??= []);
    if (!list.some((v) => JSON.stringify(v) === JSON.stringify(value))) list.push(value);
  };

  for (const row of await valuesOf(ids, COUNTRY_WORDS.official, { until: Date.now() + PATIENCE / 2 })) add(said.get(entity(row.item)), 'official', words(row.value));
  if (![...said.values()].some((one) => one.official)) throw new Error('Wikidata gives the official name of no country');
  for (const [key, prop] of Object.entries(COUNTRY_WORDS).slice(1))
    await attempt(`${key} (${prop})`, async () => {
      for (const row of await valuesOf(ids, prop, lax)) add(said.get(entity(row.item)), key, words(row.value));
    });
  for (const [key, prop] of Object.entries(COUNTRY_THINGS))
    await attempt(`${key} (${prop})`, async () => {
      for (const row of await valuesOf(ids, prop, lax)) add(said.get(entity(row.item)), key, entity(row.value));
    });
  await attempt('arms (P94)', async () => {
    for (const row of await valuesOf(ids, 'P94', lax)) add(said.get(entity(row.item)), 'arms', fileOf(row.value));
  });

  const flagIds = [...new Set([...said.values()].flatMap((one) => one.flag ?? []))].sort(byNumber);
  const flags = new Map(flagIds.map((id) => [id, {}]));
  if (flagIds.length) {
    await attempt('since (P571)', async () => {
      const rows = await inParts(flagIds, 200, (part) => `SELECT ?item ?day ?precision WHERE { VALUES ?item { ${wd(part)} } ?item p:P571 ?st . ?st a wikibase:BestRank ; psv:P571 ?v . ?v wikibase:timeValue ?day ; wikibase:timePrecision ?precision }`, lax);
      for (const row of rows) {
        const day = /^(\d{4}-\d{2}-\d{2})T/.exec(String(row.day?.value ?? ''))?.[1];
        if (day) add(flags.get(entity(row.item)), 'since', [day, Number(row.precision?.value) || 0]);
      }
    });
    for (const [key, prop] of Object.entries(FLAG_THINGS))
      await attempt(`${key} (${prop})`, async () => {
        for (const row of await valuesOf(flagIds, prop, lax)) add(flags.get(entity(row.item)), key, entity(row.value));
      });
  }

  const names = {};
  const named = [...new Set([...[...said.values()].flatMap((one) => [...(one.anthem ?? []), ...(one.government ?? [])]), ...[...flags.values()].flatMap((one) => [...(one.ratio ?? []), ...(one.colours ?? []), ...(one.by ?? [])])])].sort(byNumber);
  if (named.length)
    await attempt('the names of what they name', async () => {
      const rows = await inParts(named, 300, (part) => `SELECT ?item ?label WHERE { VALUES ?item { ${wd(part)} } ?item rdfs:label ?label . FILTER(LANG(?label) IN ("es", "en")) }`, lax);
      for (const row of rows) if (entity(row.item) && row.label?.value) (names[entity(row.item)] ??= {})[row.label['xml:lang'] === 'es' ? 'es' : 'en'] = String(row.label.value);
    });

  const pages = new Map();
  const boxes = {};
  await attempt('the pages of Wikipedia', async () => {
    for (const [id, titles] of await pagesOf([...ids, ...flagIds], lax)) pages.set(id, titles);
  });
  for (const lang of WIKIS)
    await attempt(`the boxes of facts of the Wikipedia in «${lang}»`, async () => {
      const titles = [...new Set([...pages.values()].map((of) => of[lang]).filter(Boolean))].sort();
      for (const [title, text] of await leadsOf(lang, titles, until)) {
        const box = boxIn(text);
        if (box) boxes[`${lang}:${title}`] = box;
      }
    });

  /** What was said, in an order that does not change with the day it is asked on. */
  const tidy = (one) => Object.fromEntries(Object.entries(one ?? {}).map(([key, list]) => [key, [...list].sort((a, b) => (typeof a === 'string' && QID.test(a) && QID.test(b) ? byNumber(a, b) : JSON.stringify(a).localeCompare(JSON.stringify(b))))]));
  const items = {};
  for (const u of subjects) items[u.id] = { wd: u.wd, ...tidy(said.get(u.wd)), ...(pages.has(u.wd) ? { pages: pages.get(u.wd) } : {}) };
  const flown = {};
  for (const id of flagIds) flown[id] = { ...tidy(flags.get(id)), ...(pages.has(id) ? { pages: pages.get(id) } : {}) };
  const count = (key) => Object.values(items).filter((item) => item[key]).length;
  const dated = Object.values(flown).filter((flag) => flag.since).length;
  return {
    text: listed({ source: source.from, licence: source.licence, what: source.what, asked: subjects.length }, { items, flags: flown, names, boxes }),
    note: [
      `nombre oficial de ${count('official')} de ${subjects.length} países, lema de ${count('motto')}, himno de ${count('anthem')}, bandera de ${count('flag')}`,
      `${dated} banderas con fecha`,
      `${Object.keys(boxes).length} fichas de Wikipedia`,
      ...(undone.length ? [`sin mirar: ${undone.join('; ')}`] : []),
    ].join('; '),
    detail: { asked: subjects.length, official: count('official'), motto: count('motto'), anthem: count('anthem'), flag: count('flag'), dated, boxes: Object.keys(boxes).length, undone },
  };
}

/* ------------------------------------------------------------------ how Wikipedia begins to tell of each country */

/** A page of a Wikipedia, as the sheets of the countries name it: «https://es.wikipedia.org/wiki/Bandera_de_Espa%C3%B1a». */
const WIKI_PAGE = /^https:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/([^?#]+)$/;
/** The longest opening that is kept, in characters: that of a country is a few thousand. */
const OPENING_MAX = 12_000;
/** How many pages a Wikipedia tells the opening of in one answer. */
const OPENINGS_AT_ONCE = 20;

/** The language and the title of a page of Wikipedia, from its address; nothing when it is not one. */
function pageIn(address) {
  const m = WIKI_PAGE.exec(String(address ?? ''));
  if (!m) return null;
  try {
    return { lang: m[1], title: decodeURIComponent(m[2]).replace(/_/g, ' ').trim() };
  } catch {
    return null;
  }
}

/**
 * The pages of Wikipedia that the sheets of the countries lead to (public/data/profiles/<country>.json):
 * that of each country (`read`) and that of its flag (`readFlag`), in each language. They are the ones the
 * sheets were left with after being corrected by hand, which is why they are read from there and not asked
 * again: the titles by language, and which sheets name each page.
 */
function pagesRead() {
  const dir = path.join(DATA, 'profiles');
  const titles = new Map(WIKIS.map((lang) => [lang, new Set()]));
  const sheets = new Set();
  for (const name of fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort() : []) {
    let sheet;
    try {
      sheet = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    } catch {
      continue;
    }
    for (const links of [sheet?.read, sheet?.readFlag])
      for (const address of Object.values(links ?? {})) {
        const page = pageIn(address);
        if (!page || !titles.has(page.lang) || !page.title) continue;
        titles.get(page.lang).add(page.title);
        sheets.add(name);
      }
  }
  return { titles, sheets: sheets.size };
}

/**
 * How each of these pages of a Wikipedia begins, as plain text (what comes before its first heading, with
 * no boxes, notes or marks), and which revision of the page that is: twenty at a time, by the title that
 * was asked. An answer that does not fit comes in pieces.
 */
async function openingsOf(lang, titles, until = Infinity) {
  const url = WIKIPEDIA.replace('{lang}', lang);
  const found = new Map();
  for (const part of chunks(titles, OPENINGS_AT_ONCE)) {
    if (Date.now() >= until) throw new Error('no quedaba tiempo');
    let more = {};
    const pages = new Map();
    let titled = (name) => name;
    for (let piece = 0; piece < 20; piece++) {
      const form = new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        redirects: '1',
        maxlag: '5',
        prop: 'extracts|revisions',
        exintro: '1',
        explaintext: '1',
        exsectionformat: 'plain',
        exlimit: String(OPENINGS_AT_ONCE),
        rvprop: 'ids',
        titles: part.join('|'),
        ...more,
      });
      const json = await wikiSays(url, form, until, `Wikipedia (${lang})`);
      // The names that lead to another page are told in the first piece alone.
      if (!piece) titled = followed(json);
      for (const page of json.query?.pages ?? []) {
        const one = pages.get(String(page.title)) ?? {};
        if (typeof page.extract === 'string') one.text = page.extract;
        if (Number.isInteger(page.revisions?.[0]?.revid)) one.rev = page.revisions[0].revid;
        pages.set(String(page.title), one);
      }
      if (!json.continue) break;
      more = json.continue;
    }
    for (const title of part) {
      const page = pages.get(titled(title));
      const text = (page?.text ?? '').replace(/\r/g, '').trim();
      if (text) found.set(title, { ...(titled(title) !== title ? { title: titled(title) } : {}), ...(page.rev ? { rev: page.rev } : {}), text: text.slice(0, OPENING_MAX) });
    }
    await sleep(PAUSE);
  }
  return found;
}

/**
 * How Wikipedia begins to tell of each country of the game and of its flag: the opening of each page that
 * the sheets of the countries lead to, in Spanish and in English, as plain text. It is what a sheet says of
 * a country before anybody writes of it (scripts/data/profiles.mjs, which shortens it and says whose it is).
 *
 * `pages`, by `language:title`, the title being the one the sheet names: the text, the revision of the page
 * it was read from (`rev`) and, when that title leads to another page, the title of that one (`title`).
 * The text is Wikipedia's, under CC BY-SA 4.0: whoever shows it names the page and the licence.
 *
 * The openings of one language are enough for the file to be written; what is not read is told.
 */
async function countryTexts(source) {
  const { titles, sheets } = pagesRead();
  const asked = [...titles.values()].reduce((n, set) => n + set.size, 0);
  if (!asked) throw new Error('No sheet of a country names a page of Wikipedia');
  const { until, undone, attempt } = patient();
  const pages = {};
  const read = {};
  for (const lang of WIKIS)
    await attempt(`the openings of the Wikipedia in «${lang}»`, async () => {
      const list = [...titles.get(lang)].sort();
      const found = await openingsOf(lang, list, until);
      for (const [title, page] of found) pages[`${lang}:${title}`] = page;
      read[lang] = found.size;
      const none = list.filter((title) => !found.has(title));
      if (none.length) undone.push(`sin comienzo en «${lang}»: ${none.slice(0, 12).join(', ')}${none.length > 12 ? ` y ${none.length - 12} más` : ''}`);
    });
  if (!Object.keys(pages).length) throw new Error(`Wikipedia gave the opening of no page: ${undone.join('; ')}`);
  return {
    text: listed({ source: source.from, licence: source.licence, what: source.what, asked }, { pages }),
    note: [`el comienzo de ${Object.keys(pages).length} de ${asked} páginas, de ${sheets} fichas (${WIKIS.map((lang) => `${lang}: ${read[lang] ?? 0}`).join(', ')})`, ...(undone.length ? [`sin mirar: ${undone.join('; ')}`] : [])].join('; '),
    detail: { asked, sheets, read: Object.keys(pages).length, by: Object.fromEntries(WIKIS.map((lang) => [lang, read[lang] ?? 0])), undone },
  };
}

/** The year a day of Wikidata is of: «-0026-01-01T00:00:00Z» is 27 BC, and is told as -26. */
const yearOf = (cell) => {
  const m = /^(-?)(\d{1,6})-\d{2}-\d{2}/.exec(String(cell?.value ?? ''));
  return m ? Number(`${m[1]}${m[2]}`) : null;
};

/**
 * Everything in Wikidata that has a flag (P41) and that many Wikipedias write about, whatever it is: what
 * the lists of the flags that are not of the maps are made from (scripts/data/flags-lists.mjs). Of each:
 * its names in Spanish and in English, how many pages of Wikimedia sites tell of it (`links`), what it is
 * (`is`, P31, with the English name of each class under `classes`), the country it is in (`in`, P17), the
 * years it began and ended (P571 and P576: the first it gives and the last) and its flags, each with its
 * rank and the days it flew between. What the game already has (a country, a division, a city) is told as
 * that (`game`) and nothing more is asked of it. No file is brought: that is for the sources that the
 * lists feed.
 *
 * Only the first question has to be answered: what Wikidata does not say of them after it is told.
 */
async function candidates(source) {
  const { undone, attempt, lax } = patient();
  const rows = await sparql(`SELECT ?item ?links WHERE { ?item wdt:P41 ?flag ; wikibase:sitelinks ?links . FILTER(?links >= ${CANDIDATE_LINKS}) }`, { until: Date.now() + PATIENCE / 2 });
  const items = {};
  for (const row of rows) if (entity(row.item)) items[entity(row.item)] = { links: Number(row.links?.value) || 0 };
  if (!Object.keys(items).length) throw new Error('Wikidata names nothing with a flag');

  // What the game already has, by its Wikidata entity: a country, a division of a map or a city. Nothing more is asked of it.
  const mine = new Map();
  for (const c of Object.values(JSON.parse(fs.readFileSync(path.join(DATA, 'cities.json'), 'utf8')).c ?? {}).flat()) if (QID.test(c.wd ?? '')) mine.set(c.wd, 'city');
  for (const piece of pieces()) if (piece.wd) mine.set(piece.wd, 'piece');
  for (const country of countries()) mine.set(country.wd, 'country');
  for (const id of Object.keys(items)) if (mine.has(id)) items[id].game = mine.get(id);
  const ids = Object.keys(items).filter((id) => !items[id].game).sort(byNumber);

  await attempt('los nombres', async () => {
    const said = await inParts(ids, CANDIDATES_AT_ONCE, (part) => `SELECT ?item ?label WHERE { VALUES ?item { ${wd(part)} } ?item rdfs:label ?label . FILTER(LANG(?label) IN ("es", "en")) }`, lax);
    for (const row of said) if (entity(row.item) && row.label?.value) items[entity(row.item)][row.label['xml:lang'] === 'es' ? 'es' : 'en'] = String(row.label.value);
  });
  const classes = {};
  await attempt('qué es cada cosa', async () => {
    const said = await inParts(ids, CANDIDATES_AT_ONCE, (part) => `SELECT ?item ?class WHERE { VALUES ?item { ${wd(part)} } ?item wdt:P31 ?class }`, lax);
    for (const row of said) if (entity(row.item) && entity(row.class)) (items[entity(row.item)].is ??= []).push(entity(row.class));
    for (const item of Object.values(items)) if (item.is) item.is = [...new Set(item.is)].sort(byNumber);
    for (const [id, label] of await labelsOf([...new Set(Object.values(items).flatMap((item) => item.is ?? []))].sort(byNumber), lax)) classes[id] = label;
  });
  await attempt('en qué país está cada cosa', async () => {
    const said = await inParts(ids, CANDIDATES_AT_ONCE, (part) => `SELECT ?item ?country WHERE { VALUES ?item { ${wd(part)} } ?item wdt:P17 ?country }`, lax);
    for (const row of said) if (entity(row.item) && entity(row.country)) (items[entity(row.item)].in ??= []).push(entity(row.country));
    for (const item of Object.values(items)) if (item.in) item.in = [...new Set(item.in)].sort(byNumber);
  });
  await attempt('cuándo empezó y cuándo acabó cada cosa', async () => {
    const said = await inParts(ids, CANDIDATES_AT_ONCE, (part) => `SELECT ?item ?born ?died WHERE { VALUES ?item { ${wd(part)} } { ?item wdt:P571 ?born } UNION { ?item wdt:P576 ?died } }`, lax);
    for (const row of said) {
      const item = items[entity(row.item)];
      const [born, died] = [yearOf(row.born), yearOf(row.died)];
      if (!item) continue;
      if (born !== null && (item.from === undefined || born < item.from)) item.from = born;
      if (died !== null && (item.to === undefined || died > item.to)) item.to = died;
    }
  });
  await attempt('las banderas de cada cosa', async () => {
    for (const [id, list] of await flagsOf(ids, lax)) items[id].flags = [...list.values()].sort((a, b) => a.file.localeCompare(b.file)).map(told);
  });

  const all = Object.keys(items);
  return {
    text: listed({ source: source.from, licence: source.licence, what: source.what, links: CANDIDATE_LINKS }, { items, classes }),
    note: [`${all.length} cosas con bandera de las que hablan ${CANDIDATE_LINKS} páginas o más`, `${all.length - ids.length} ya están en el juego`, ...(undone.length ? [`sin mirar: ${undone.join('; ')}`] : [])].join('; '),
    detail: { found: all.length, game: tally(all.filter((id) => items[id].game), (id) => items[id].game), undone },
  };
}

/** What the sources of flags have in common: where they read, and what their data files say. */
const FLAGS = {
  from: 'Wikidata (https://www.wikidata.org) y Wikimedia Commons (https://commons.wikimedia.org)',
  licence: 'La de cada archivo, que su entrada dice: dominio público o una licencia libre',
  flags: true,
};
const FLAGS_WHAT =
  'items: the Wikidata entity whose flag it is (wd), how it was found when it is not the one the game names (by: redirect or code; wikipedia when Wikidata gives no flag and the box of facts of its page of Wikipedia shows one, with the page under page; hand when the flag is one given in scripts/data/flags-hand.json, with the one the others gave under instead), the Commons file of the flag it flies today (file) and since when (from), ' +
  'other flags the entity gives as of today (also) and those it gives as past or less fit (old), the flag of the entity that carries its ISO 3166-2 code when that is another (other), and whether the entity is far smaller than the division (tiny). ' +
  `files: what Commons says of each file, by its title: SHA-1, bytes, MIME type, width and height, licence and its address, author, credit, whether it must be attributed, restrictions other than copyright, and its page; where the file is kept in this branch (kept); the ${FLAG_PICTURE} px picture that Wikimedia draws of it (picture), which stands for an original of more than ${FLAG_MAX / 1e6} MB and goes with a drawing that has words in it (words); for a photograph, the drawing of the same flag that is kept in its place (drawn); and the categories of Commons it is in that speak of other times, of a proposal or of an invention, which may mean that it is not a flag that flies (marks). ` +
  `The files themselves are under ${FLAG_FILES}, each named after its SHA-1.`;
/** What the data files of the other sources of flags say of the files, which is what those of the maps say. */
const FILES_WHAT = FLAGS_WHAT.slice(FLAGS_WHAT.indexOf('files: '));

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
  {
    id: 'flags-cities',
    file: 'flags/cities.json',
    ...FLAGS,
    what: `The flag of each city of the game that is the capital of no country, by the id the city has in the game. ${FLAGS_WHAT}`,
    es: 'Banderas de las ciudades que no son capital de un país',
    needs: '112',
    run: (source, keep) => flagsFor(source, towns(), keep),
  },
  {
    id: 'flags-countries',
    file: 'flags/countries.json',
    ...FLAGS,
    what: `The flags that each country of the game flew before the one it flies, by the id of the country. items: its Wikidata entity (wd) and those flags (past), the last to stop flying first: the Commons file of each, its rank when it is the preferred one, and the days Wikidata says it flew between (from, to; ? for a day that is not known). ${FILES_WHAT}`,
    es: 'Banderas anteriores de los países',
    needs: '112',
    run: pastFlags,
  },
  {
    id: 'flags-candidates',
    file: 'flags/candidates.json',
    from: 'Wikidata (https://www.wikidata.org)',
    licence: 'CC0 1.0',
    what: `Everything in Wikidata that has a flag (P41) and that at least ${CANDIDATE_LINKS} pages of Wikimedia sites tell of, by its Wikidata id: what the lists of scripts/data/flags-lists.json are made from. items: its names in Spanish and in English (es, en), how many pages tell of it (links), what it is (is: P31), the country it is in (in: P17), the years it began and ended (from, to: P571 and P576), and its flags, each with its file, its rank when it is not the usual one and the days it flew between; what the game already has says only as what (game: country, piece or city). classes: the English name of each class`,
    es: 'Todo lo que tiene bandera y es conocido, para hacer las listas',
    needs: '112',
    run: candidates,
  },
  {
    id: 'flags-listed',
    file: 'flags/listed.json',
    ...FLAGS,
    what: `The flags of what the lists of scripts/data/flags-lists.json name (countries that are no more, organisations, peoples), by its Wikidata id. items: the Commons file of the flag it flies today (file), whether Wikidata prefers it to the others (rank), since when (from) and the others it gives as of today (also); those it stopped flying (past), the last first, each with its file and the days it flew between, which is all that something that is no more has; and by: hand when the flag is one given in scripts/data/flags-hand.json, with the one Wikidata gave under instead. ${FILES_WHAT}`,
    es: 'Banderas de países que ya no existen, de organizaciones y de pueblos',
    needs: '112',
    run: listedFlags,
  },
  {
    id: 'flags-signals',
    file: 'flags/signals.json',
    ...FLAGS,
    from: 'Wikimedia Commons (https://commons.wikimedia.org)',
    what: `The flags that are signals, each a file of Commons that scripts/data/flags-signals.json names, by the id the list gives it. items: that file (file; by: hand, as every one is). ${FILES_WHAT}`,
    es: 'Banderas que son señales',
    needs: '112',
    run: signalFlags,
  },
  {
    id: 'photos',
    file: 'photos/photos.json',
    from: 'Wikimedia Commons (https://commons.wikimedia.org)',
    licence: 'La de cada archivo, que su entrada dice: dominio público o una licencia libre',
    what:
      'The photographs that the sheets of the countries show, each a file of Commons that a sheet names (scripts/data/profiles/<country>.json), the one chosen for the head of a country nobody has written of (scripts/data/profiles-heads.json), or a further photograph in its gallery (scripts/data/profiles-gallery.json). ' +
      'items: the titles of those of each sheet, by the id of its country (photos). ' +
      'files: what Commons says of each file, by its title: SHA-1, bytes, MIME type, width and height of the original, licence and its address, author, credit, whether it must be attributed, restrictions other than copyright, and its page; ' +
      `and where the picture of it that Wikimedia draws, ${PHOTO_WIDTH} px wide, is kept in this branch (picture): the original is not brought. The pictures are under ${PHOTO_FILES}, each named after the SHA-1 of its original.`,
    es: 'Fotografías de las fichas de los países',
    needs: '113',
    run: profilePhotos,
  },
  {
    id: 'photos-upload-index',
    file: 'user-photos/index.json',
    from: 'Archivo aportado por el dueño en la release de GitHub (https://github.com/diegosb72/regionle/releases/tag/imagenes)',
    licence: 'Sin verificar: el inventario no acredita la licencia de ninguna fotografía',
    what: 'Names, sizes and SHA-256 hashes of the files inside the split ZIP in scripts/data/release-photos.json, plus its five small top-level documents and the photo lists of 249 profiles for review. The application script is read, never run. No image is published or assumed reusable merely because it is in the archive.',
    es: 'Inventario del archivo fotográfico aportado por el dueño',
    needs: '113',
    run: async (source, keep) => {
      const { releasePhotoInventory } = await import('./release-photos.mjs');
      return releasePhotoInventory(source, keep);
    },
  },
  {
    id: 'photos-upload-audit',
    file: 'user-photos/audit.json',
    from: 'Wikimedia Commons (https://commons.wikimedia.org)',
    licence: 'La licencia de cada archivo se consulta en Commons; los metadatos no sustituyen una revisión de derechos de terceros',
    what: 'Solo metadatos ACTUALES de Commons para las candidatas de scripts/data/release-photo-plan.json: URL, SHA-1, autor, licencia y restricciones. No descarga fotografías ni aprueba automáticamente las candidatas.',
    es: 'Metadatos actuales de Commons de las fotos candidatas del ZIP',
    needs: '113',
    run: async (source) => {
      const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/data/release-photo-plan.json'), 'utf8'));
      const names = [...new Set(Object.values(plan.countries).flatMap((photos) => photos.map((photo) => photo.title)))].sort();
      if (names.length < 100 || names.length > 2000) throw new Error('The photo plan does not name a plausible number of unique files');
      const { until } = patient();
      const { pages, titled } = await commonsOf(names, {
        prop: 'imageinfo',
        iiprop: 'url|size|mime|sha1|extmetadata',
        iiextmetadatafilter: 'LicenseShortName|UsageTerms|LicenseUrl|Artist|Credit|AttributionRequired|Restrictions',
      }, until);
      const files = Object.fromEntries(names.map((title) => [title, { canonical: titled(title), ...(about(pages.get(titled(title))) ?? { missing: true }) }]));
      const missing = Object.values(files).filter((file) => file.missing).length;
      return {
        text: JSON.stringify({ source: source.from, licence: source.licence, plan: 'scripts/data/release-photo-plan.json', files }, null, 2) + '\n',
        note: `${names.length} candidate photos checked in Commons; ${missing} without current file metadata; no image downloaded`,
        detail: { checked: names.length, missing },
      };
    },
  },
  {
    id: 'heads',
    file: 'heads/heads.json',
    from: 'Wikidata (https://www.wikidata.org) y Wikimedia Commons (https://commons.wikimedia.org)',
    licence: 'Lo de Wikidata, CC0; cada imagen, la licencia que dice su entrada: dominio público o una licencia libre',
    what:
      'What could be shown at the head of the sheet of each country that is named (scripts/data/heads-asked.txt): the pictures Wikidata shows what the country is known by with ' +
      '(what UNESCO lists as World Heritage, its national parks, what is called a tourist attraction, its capital and its highest point). ' +
      'items: of each country, by its id, its candidates (sights), the best known of each kind first: the file, the kind (heritage, park, sight, capital, top), the entity it is of (of), how many Wikipedias tell of it (links) and its name (es, en); ' +
      'and after them what was looked for in Commons by words that the list gives (kind sought, with the words and whether it was found among the featured pictures, the quality images or any others: among). ' +
      'files: what Commons says of each file, by its title: SHA-1, bytes, MIME type, width and height of the original, licence and its address, author, credit, whether it must be attributed and its page; ' +
      `and where the small picture of it, ${HEAD_PICTURE} px wide, is kept in this branch (picture), to choose among them by eye. Only photographs at least ${HEAD_WIDE} px wide and between ${HEAD_SHAPE[0]} and ${HEAD_SHAPE[1]} times wider than tall are candidates. ` +
      'Nothing is chosen here: the one that stays is written in scripts/data/profiles-heads.json and brought by the source photos.',
    es: 'Candidatas a fotografía de cabecera de las fichas de los países',
    needs: '113',
    run: headSights,
  },
  {
    id: 'arms',
    file: 'arms/arms.json',
    from: 'Wikidata (https://www.wikidata.org) y Wikimedia Commons (https://commons.wikimedia.org)',
    licence: 'Lo de Wikidata, CC0; cada imagen, la licencia que dice su entrada: dominio público o una licencia libre',
    what:
      'The coat of arms of each country of the game, or its emblem or its seal: the file Wikidata shows it with (P94) and the one that somebody chose for it by hand instead (scripts/data/profiles-fixes.json). ' +
      'items, by the id of the country: the files Wikidata names (files), in order of name, and the one chosen by hand (chosen). ' +
      'files: what Commons says of each file, by its title: SHA-1, bytes, MIME type, width and height of the original, licence and its address, author, credit, whether it must be attributed, restrictions other than copyright, and its page; ' +
      `and where the picture of it that Wikimedia draws, ${ARMS_PICTURE} px wide, is kept in this branch (picture): the original is not brought. The pictures are under ${ARMS_FILES}, each named after the SHA-1 of its original.`,
    es: 'Escudo de cada país',
    needs: '113',
    run: countryArms,
  },
  {
    id: 'countries',
    file: 'countries/countries.json',
    from: 'Wikidata (https://www.wikidata.org) y Wikipedia (https://www.wikipedia.org)',
    licence: 'CC0 1.0 lo que dice Wikidata; CC BY-SA 4.0 las fichas de Wikipedia, cada una bajo el título de su página',
    what:
      'What Wikidata and Wikipedia say of each country of the game and of its flag. items, by the id of the country: its Wikidata entity (wd); what it is called in full (official, P1448), what it calls itself (native, P1705) and its motto (motto, P1451), each a list of [language, text]; ' +
      'its anthem (anthem, P85), how it is governed (government, P122) and its flag (flag, P163), each a list of entities; the file of its coat of arms in Commons (arms, P94); and its page in each Wikipedia (pages). Only statements of best rank that have not ended are told. ' +
      'flags, by the entity of the flag: the day it began with how exactly it is known (since, P571: [day, precision], 11 a day, 10 a month, 9 a year), its proportions as width to height (ratio, P2061), its colours (colours, P462) and who designed it (by, P287), each a list of entities, and its page in each Wikipedia (pages). ' +
      'names: the name in Spanish and in English of every entity named. boxes, by language:title: the box of facts that the page opens with, as it is written.',
    es: 'Lo que Wikidata y Wikipedia dicen de cada país y de su bandera',
    needs: '113',
    run: countryFacts,
  },
  {
    id: 'texts',
    file: 'countries/texts.json',
    from: 'Wikipedia (https://www.wikipedia.org)',
    licence: 'CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/): cada texto es de los autores de su página, que es la que le da nombre',
    what:
      'How Wikipedia begins to tell of each country of the game and of its flag: the opening of each page that the sheets of the countries lead to (public/data/profiles/<country>.json: read and readFlag), in Spanish and in English, as plain text. ' +
      'pages, by language:title, the title being the one the sheet names: the text (text), the revision of the page it was read from (rev) and, when that title leads to another page, the title of that one (title).',
    es: 'Cómo empieza Wikipedia a hablar de cada país y de su bandera',
    needs: '113',
    run: countryTexts,
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

// In the order they were asked for, which is the order they matter in when the time runs out; all of them, in the order of the list above.
const turn = (id) => (ONLY.length ? ONLY.indexOf(id) : 0);
for (const source of SOURCES.filter((s) => wanted(s.id)).sort((a, b) => turn(a.id) - turn(b.id))) {
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
