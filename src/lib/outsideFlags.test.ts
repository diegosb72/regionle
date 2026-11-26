// The sources of flags of the script that brings the data kept outside GitHub (scripts/data/outside.mjs),
// run for real: against a stand-in for Wikidata's query service, for Commons and for the place its files
// are downloaded from, which answer what each test says the world is like, and with a few maps made up for
// the occasion. Nothing here leaves the machine.

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Every test starts the script, once or twice: seconds on a machine that is doing other things.
vi.setConfig({ testTimeout: 30_000 });

const ROOT = process.cwd();

/* ------------------------------------------------------------------ the stand-in for Wikidata and Commons */

interface Statement {
  file: string;
  rank?: 'Preferred' | 'Normal' | 'Deprecated';
  from?: string;
  to?: string;
}
interface Kept {
  body: string;
  mime?: string;
  w?: number;
  h?: number;
  licence?: string;
  licenceUrl?: string;
  artist?: string;
  credit?: string;
  attribution?: boolean;
  restrictions?: string;
  /** What its page says, as it is written. */
  text?: string;
  /** What its page says it weighs, when that is not what it weighs. */
  bytes?: number;
  /** What its page says its SHA-1 is, when that is not what it is. */
  sha1?: string;
  /** The categories it is in. */
  categories?: string[];
}
interface World {
  flags: Record<string, Statement[]>;
  moved: Record<string, string>;
  codes: Record<string, string[]>;
  /** In km². */
  areas: Record<string, number[]>;
  files: Record<string, Kept>;
  /** The title that a name which is not one leads to. */
  leads: Record<string, string>;
  /** What the branch keeps: the text of each of its data files, by its path. */
  branch: Record<string, string>;
  /** How many categories Commons gives in one answer, when it gives them in pieces. */
  atOnce?: number;
  /** The page each entity has in each Wikipedia: its title by language. */
  pages: Record<string, Record<string, string>>;
  /** What each page of a Wikipedia says before its first heading, by `language:title`. */
  leadsOf: Record<string, string>;
  /** The title that a name of a page of a Wikipedia leads to, by `language:name`. */
  wikiLeads: Record<string, string>;
  /** What Wikidata says of what has a flag and many pages: how many, its names, what it is, where, and when it began and ended. */
  known: Record<string, { links: number; es?: string; en?: string; is?: string[]; in?: string[]; born?: string[]; died?: string[] }>;
  /** What each country is known by, by the entity of the country: of which kind each thing is, its entity, its picture, how many pages tell of it and its names. */
  sights?: Record<string, { kind: 'heritage' | 'park' | 'sight' | 'capital' | 'top'; of: string; file: string; links: number; es?: string; en?: string }[]>;
  /** What Commons finds when it is searched: the titles of the files, the best answer first, by what was looked for, as it was written. */
  sought?: Record<string, string[]>;
  /** The coat of arms Wikidata shows each country with, by the entity of the country: the names of the files. */
  arms?: Record<string, string[]>;
}
/** A way of not answering: this status for what matches, the first `times` of it. */
interface Refusal {
  when: (asked: string) => boolean;
  status: number;
  times: number;
}

let world: World;
let refusals: Refusal[] = [];
/** What was asked, in order: `sparql <query>`, `api <form>`, `wiki <language> <titles>`, `file <title>`, `picture <title>`, `branch <path>`. */
let asked: string[] = [];
/** When each of those was asked, in ms. */
let times: number[] = [];
let agents: string[] = [];
let base = '';
let server: http.Server;

const uri = (id: string) => ({ type: 'uri', value: `http://www.wikidata.org/entity/${id}` });
const text = (value: string | number) => ({ type: 'literal', value: String(value) });
const ids = (query: string) => [...query.matchAll(/wd:(Q\d+)/g)].map((m) => m[1]);
const sha1 = (body: string | Buffer) => createHash('sha1').update(body).digest('hex');

const rows = (id: string, more: Record<string, unknown> = {}) =>
  (world.flags[id] ?? []).map((st) => ({
    item: uri(id),
    file: { type: 'uri', value: `http://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(st.file)}` },
    rank: { type: 'uri', value: `http://wikiba.se/ontology#${st.rank ?? 'Normal'}Rank` },
    ...(st.from ? { from: text(st.from === '?' ? 'http://www.wikidata.org/.well-known/genid/1' : `${st.from}T00:00:00Z`) } : {}),
    ...(st.to ? { to: text(st.to === '?' ? 'http://www.wikidata.org/.well-known/genid/2' : `${st.to}T00:00:00Z`) } : {}),
    ...more,
  }));

/** How each kind of thing a country is known by is asked for. */
const SIGHT_ASKED = { heritage: 'wdt:P1435 wd:Q9259', park: 'wdt:P31 wd:Q46169', sight: 'wdt:P31 wd:Q570116', capital: 'wdt:P36', top: 'wdt:P610' };

function answer(query: string): Record<string, unknown>[] {
  if (query.includes('?sight')) {
    const kind = (Object.keys(SIGHT_ASKED) as (keyof typeof SIGHT_ASKED)[]).find((k) => query.includes(SIGHT_ASKED[k]));
    return ids(query).flatMap((id) =>
      (world.sights?.[id] ?? [])
        .filter((one) => one.kind === kind)
        .map((one) => ({
          country: uri(id),
          sight: uri(one.of),
          image: { type: 'uri', value: `http://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(one.file)}` },
          links: text(one.links),
          ...(one.es ? { es: { type: 'literal', 'xml:lang': 'es', value: one.es } } : {}),
          ...(one.en ? { en: { type: 'literal', 'xml:lang': 'en', value: one.en } } : {}),
        })),
    );
  }
  if (query.includes('p:P94'))
    return ids(query).flatMap((id) => (world.arms?.[id] ?? []).map((file) => ({ item: uri(id), value: { type: 'uri', value: `http://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}` } })));
  if (query.includes('p:P41') && query.includes('wdt:P300'))
    return [...query.matchAll(/"([A-Z]{2}-[A-Z0-9]+)"/g)].flatMap(([, code]) => (world.codes[code] ?? []).flatMap((id) => rows(id, { code: text(code) })));
  if (query.includes('p:P41')) return ids(query).flatMap((id) => rows(id));
  if (query.includes('owl:sameAs')) return ids(query).flatMap((id) => (world.moved[id] ? [{ item: uri(id), to: uri(world.moved[id]) }] : []));
  if (query.includes('p:P2046')) return ids(query).flatMap((id) => (world.areas[id] ?? []).map((km2) => ({ item: uri(id), m2: text(km2 * 1e6) })));
  if (query.includes('schema:about'))
    return ids(query).flatMap((id) => Object.entries(world.pages[id] ?? {}).filter(([lang]) => query.includes(`<https://${lang}.wikipedia.org/>`)).map(([lang, name]) => ({ item: uri(id), site: { type: 'uri', value: `https://${lang}.wikipedia.org/` }, name: text(name) })));
  // What has a flag and at least so many pages: the question the candidates start from.
  if (query.includes('wikibase:sitelinks')) {
    const least = Number(/\?links >= (\d+)/.exec(query)?.[1] ?? 0);
    return Object.entries(world.known).filter(([id, one]) => one.links >= least && world.flags[id]?.length).flatMap(([id, one]) => world.flags[id].map(() => ({ item: uri(id), links: text(one.links) })));
  }
  if (query.includes('rdfs:label') && query.includes('"es"'))
    return ids(query).flatMap((id) => (['es', 'en'] as const).flatMap((lang) => (world.known[id]?.[lang] ? [{ item: uri(id), label: { type: 'literal', 'xml:lang': lang, value: world.known[id][lang] } }] : [])));
  if (query.includes('rdfs:label')) return ids(query).flatMap((id) => (world.known[id]?.en ? [{ item: uri(id), label: { type: 'literal', 'xml:lang': 'en', value: world.known[id].en } }] : []));
  if (query.includes('wdt:P31 ')) return ids(query).flatMap((id) => (world.known[id]?.is ?? []).map((to) => ({ item: uri(id), class: uri(to) })));
  if (query.includes('wdt:P17 ')) return ids(query).flatMap((id) => (world.known[id]?.in ?? []).map((to) => ({ item: uri(id), country: uri(to) })));
  if (query.includes('wdt:P571'))
    return ids(query).flatMap((id) => [...(world.known[id]?.born ?? []).map((day) => ({ item: uri(id), born: text(`${day}T00:00:00Z`) })), ...(world.known[id]?.died ?? []).map((day) => ({ item: uri(id), died: text(`${day}T00:00:00Z`) }))]);
  throw new Error(`A question the stand-in does not know: ${query}`);
}

/** What a Wikipedia says of the pages it is asked about: how each starts, as it is written. */
function wikipedia(lang: string, form: URLSearchParams): Record<string, unknown> {
  const redirects: { from: string; to: string }[] = [];
  const pages = new Map<string, Record<string, unknown>>();
  for (const name of (form.get('titles') ?? '').split('|').filter(Boolean)) {
    const to = world.wikiLeads[`${lang}:${name}`];
    if (to) redirects.push({ from: name, to });
    const title = to ?? name;
    const lead = world.leadsOf[`${lang}:${title}`];
    pages.set(title, lead === undefined ? { title, missing: true } : { title, revisions: [{ slots: { main: { content: lead } } }] });
  }
  return { batchcomplete: true, query: { ...(redirects.length ? { redirects } : {}), pages: [...pages.values()] } };
}

/** What Commons says of the files it is asked about. */
function commons(form: URLSearchParams): Record<string, unknown> {
  if (form.get('generator') === 'search') {
    // What it finds for some words: each file with all that is said of it, and its place among the answers. They do not come in order.
    const found = world.sought?.[form.get('gsrsearch') ?? ''] ?? [];
    const pages = found.map((title, i) => ({ ...(commons(new URLSearchParams({ titles: `File:${title}` })).query as { pages: Record<string, unknown>[] }).pages[0], index: i + 1 }));
    return { batchcomplete: true, ...(pages.length ? { query: { pages: pages.reverse() } } : {}) };
  }
  const names = (form.get('titles') ?? '').split('|').filter(Boolean);
  const normalized: { from: string; to: string }[] = [];
  const redirects: { from: string; to: string }[] = [];
  const pages = new Map<string, Record<string, unknown>>();
  for (const name of names) {
    let title = name.replace(/_/g, ' ');
    if (title !== name) normalized.push({ from: name, to: title });
    const to = world.leads[title.replace(/^File:/, '')];
    if (to) {
      redirects.push({ from: title, to: `File:${to}` });
      title = `File:${to}`;
    }
    const file = world.files[title.replace(/^File:/, '')];
    if (!file) pages.set(title, { title, missing: true });
    else if (form.get('prop') === 'revisions') pages.set(title, { title, revisions: [{ slots: { main: { content: file.text ?? '' } } }] });
    else if (form.get('prop') === 'categories') pages.set(title, { title, categories: (file.categories ?? []).map((name) => ({ ns: 14, title: `Category:${name}` })) });
    else {
      const said = (value: string | undefined) => (value === undefined ? undefined : { value, source: 'commons-desc-page' });
      const at = encodeURIComponent(title.replace(/^File:/, ''));
      const extmetadata = Object.fromEntries(
        Object.entries({
          LicenseShortName: said(file.licence ?? 'Public domain'),
          LicenseUrl: said(file.licenceUrl),
          Artist: said(file.artist),
          Credit: said(file.credit),
          AttributionRequired: said(file.attribution ? 'true' : 'false'),
          Restrictions: said(file.restrictions ?? ''),
        }).filter(([, value]) => value),
      );
      pages.set(title, {
        title,
        imageinfo: [
          {
            size: file.bytes ?? Buffer.byteLength(file.body),
            width: file.w ?? 900,
            height: file.h ?? 600,
            mime: file.mime ?? 'image/svg+xml',
            sha1: file.sha1 ?? sha1(file.body),
            url: `${base}/file/${at}?utm_source=test`,
            thumburl: `${base}/picture/${at}`,
            descriptionurl: `https://commons.wikimedia.org/wiki/File:${at}`,
            extmetadata,
          },
        ],
      });
    }
  }
  const query = { ...(normalized.length ? { normalized } : {}), ...(redirects.length ? { redirects } : {}) };
  if (form.get('prop') === 'categories' && world.atOnce) {
    // In pieces, as Commons answers when there is much to say: so many categories, and where to go on from.
    const all = [...pages.values()].flatMap((page) => (page.categories as { title: string }[]).map((category) => ({ page: String(page.title), category })));
    const from = Number(form.get('clcontinue') ?? 0);
    const part = all.slice(from, from + world.atOnce);
    const list = [...pages.values()].map((page) => {
      const mine = part.filter((one) => one.page === page.title).map((one) => one.category);
      return mine.length ? { title: page.title, categories: mine } : { title: page.title };
    });
    const next = from + world.atOnce;
    return next < all.length ? { continue: { clcontinue: String(next), continue: '||' }, query: { ...query, pages: list } } : { batchcomplete: true, query: { ...query, pages: list } };
  }
  return { batchcomplete: true, query: { ...query, pages: [...pages.values()] } };
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const url = new URL(req.url ?? '/', 'http://x');
      const [, place, ...rest] = url.pathname.split('/');
      const what = decodeURIComponent(rest.join('/'));
      const form = new URLSearchParams(body);
      const said = place === 'sparql' ? `sparql ${form.get('query') ?? ''}` : place === 'api' ? `api ${body}` : place === 'wiki' ? `wiki ${what} ${form.get('titles') ?? ''}` : `${place} ${what}`;
      asked.push(said);
      times.push(Date.now());
      agents.push(String(req.headers['user-agent']));
      const refusal = refusals.find((r) => r.times > 0 && r.when(said));
      if (refusal) {
        refusal.times--;
        return void res.writeHead(refusal.status).end('no');
      }
      try {
        if (place === 'sparql') return void res.writeHead(200, { 'Content-Type': 'application/sparql-results+json' }).end(JSON.stringify({ results: { bindings: answer(form.get('query') ?? '') } }));
        if (place === 'api') return void res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(commons(form)));
        if (place === 'wiki') return void res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(wikipedia(what, form)));
        if (place === 'file' && world.files[what]) return void res.writeHead(200).end(world.files[what].body);
        if (place === 'picture' && world.files[what]) return void res.writeHead(200).end(`a picture of ${what}`);
        if (place === 'branch' && world.branch[what] !== undefined) return void res.writeHead(200).end(world.branch[what]);
        res.writeHead(404).end('not here');
      } catch (err) {
        if (!res.headersSent) res.writeHead(400).end(String(err));
      }
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((done) => server.close(done)));

/* ------------------------------------------------------------------ the maps and the run */

interface Unit {
  id: string;
  wd?: string;
  ar?: number;
}
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-flags-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;
const fresh = (name: string) => {
  const dir = path.join(TMP, `${name}-${++n}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/** Maps like those of the game: for each country, its divisions and, when it has them, the groups they make up; and the list of cities. */
function game(countries: Record<string, { units: Unit[]; groups?: Unit[]; wd?: string }>, cities: Record<string, { i: string; k?: number; wd?: string }[]> = {}) {
  const dir = fresh('maps');
  fs.mkdirSync(path.join(dir, 'r'));
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ countries: Object.entries(countries).map(([id, c]) => ({ id, ...(c.wd ? { wd: c.wd } : {}) })) }));
  const pieces = (list: Unit[]) => ({ geometries: list.map((u) => ({ type: 'Polygon', id: u.id, properties: { n: { es: u.id }, ...(u.wd ? { wd: u.wd } : {}), ar: u.ar ?? 100 } })) });
  for (const [id, c] of Object.entries(countries)) fs.writeFileSync(path.join(dir, 'r', `${id}.json`), JSON.stringify({ type: 'Topology', objects: { ...(c.groups ? { g1: pieces(c.groups) } : {}), f: pieces(c.units) } }));
  fs.writeFileSync(path.join(dir, 'cities.json'), JSON.stringify({ v: 1, c: cities }));
  return dir;
}

interface Past {
  file: string;
  rank?: string;
  from?: string;
  to?: string;
}
interface Item {
  wd?: string;
  by?: string;
  /** The page of Wikipedia whose box of facts shows the flag. */
  page?: string;
  past?: Past[];
  /** Files named by a country's sheet and independent timeline (source `photos`). */
  photos?: string[];
  file: string;
  /** What is listed: whether Wikidata prefers the flag it flies to the others. */
  rank?: string;
  instead?: string;
  from?: string;
  also?: string[];
  old?: string[];
  other?: { wd: string; file: string };
  tiny?: true;
}
interface FileSaid {
  sha1?: string;
  bytes?: number;
  mime?: string;
  w?: number;
  h?: number;
  licence?: string;
  licenceUrl?: string;
  artist?: string;
  credit?: string;
  attribution?: true;
  restrictions?: string;
  page?: string;
  kept?: string;
  picture?: string;
  drawn?: string;
  words?: true;
  marks?: string[];
  missing?: true;
}
interface Detail {
  asked: number;
  found: number;
  by: Record<string, number>;
  doubted: { other: number; tiny: number };
  files: { all: number; missing: number; drawn: number; words: number; wanted: number; brought: number; there: number; left: number; pictures: number; bytes: number };
  kinds: Record<string, number>;
  licences: Record<string, number>;
  undone: string[];
}
interface Result {
  code: number;
  out: string;
  dir: string;
  /** The data file of a source, as it was written. */
  raw: (source?: string) => string;
  data: (source?: string) => { asked: number; items: Record<string, Item>; files: Record<string, FileSaid>; [key: string]: unknown };
  source: (source?: string) => { id: string; ok: boolean; note?: string; error?: string; detail?: Detail };
  /** Every file the run kept, by its path in the branch. */
  kept: () => string[];
  read: (name: string) => string;
}

const FILE: Record<string, string> = {
  'flags-regions': 'flags/regions.json',
  'flags-capitals': 'flags/capitals.json',
  'flags-cities': 'flags/cities.json',
  'flags-countries': 'flags/countries.json',
  'flags-candidates': 'flags/candidates.json',
  'flags-listed': 'flags/listed.json',
  'flags-signals': 'flags/signals.json',
  photos: 'photos/photos.json',
  heads: 'heads/heads.json',
  arms: 'arms/arms.json',
};

/** Runs the script. It gets no variable of the machine but the ones named here. */
function run(source: string, data: string, env: Record<string, string> = {}, out = fresh('out')): Promise<Result> {
  return new Promise((done) => {
    // No wait between downloads, and no list of pictures or of flags given by hand but the one a test writes.
    const none = path.join(TMP, 'no-list');
    const vars = {
      PATH: process.env.PATH ?? '',
      OUTSIDE_WDQS: `${base}/sparql`,
      OUTSIDE_COMMONS: `${base}/api`,
      OUTSIDE_WIKIPEDIA: `${base}/wiki/{lang}`,
      OUTSIDE_KEPT: `${base}/branch`,
      OUTSIDE_PAUSE: '0',
      OUTSIDE_FLAG_GAP: '0',
      OUTSIDE_FLAG_PICTURES: none,
      OUTSIDE_FLAG_HAND: none,
      OUTSIDE_FLAG_LISTS: none,
      OUTSIDE_FLAG_SIGNALS: none,
      OUTSIDE_PROFILES: none,
      OUTSIDE_TIMES: none,
      OUTSIDE_HEADS: none,
      OUTSIDE_HEADS_ASKED: none,
      OUTSIDE_PROFILE_FIXES: none,
      ...env,
    };
    execFile('node', ['scripts/data/outside.mjs', '--out', out, '--only', source, '--data', data], { cwd: ROOT, env: vars }, (error, stdout) => {
      const walk = (dir: string, at = ''): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), `${at}${e.name}/`) : [`${at}${e.name}`]));
      const report = () => JSON.parse(fs.readFileSync(path.join(out, 'estado.json'), 'utf8')) as { sources: ReturnType<Result['source']>[] };
      done({
        code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
        out: stdout,
        dir: out,
        raw: (id = source) => fs.readFileSync(path.join(out, FILE[id]), 'utf8'),
        data: (id = source) => JSON.parse(fs.readFileSync(path.join(out, FILE[id]), 'utf8')),
        source: (id = source) => report().sources.find((s) => s.id === id)!,
        kept: () => walk(out).filter((f) => f.startsWith('flags/files/')).sort(),
        read: (name) => fs.readFileSync(path.join(out, name), 'utf8'),
      });
    });
  });
}

const svg = (what: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><title>${what}</title></svg>`;
/** Where a file is kept in the branch. */
const at = (body: string, kind = 'svg') => `flags/files/${sha1(body).slice(0, 2)}/${sha1(body)}.${kind}`;

beforeEach(() => {
  refusals = [];
  asked = [];
  times = [];
  agents = [];
  world = { flags: {}, moved: {}, codes: {}, areas: {}, files: {}, leads: {}, branch: {}, pages: {}, leadsOf: {}, wikiLeads: {}, known: {} };
});

/** A country of four provinces, each with a flag of its own drawn as it should be. */
const PLAIN = () => {
  for (const [id, name] of [['Q1', 'Uno'], ['Q2', 'Dos'], ['Q3', 'Tres'], ['Q4', 'Cuatro']]) {
    world.flags[id] = [{ file: `Flag of ${name}.svg` }];
    world.files[`Flag of ${name}.svg`] = { body: svg(name) };
  }
  return game({ AA: { units: [{ id: 'AA-01', wd: 'Q1' }, { id: 'AA-02', wd: 'Q2' }, { id: 'AA-03', wd: 'Q3' }, { id: 'AA-04', wd: 'Q4' }] } });
};

/* ------------------------------------------------------------------ which flag */

describe('the flag of each division', () => {
  it('is the one its entity flies today, with the file kept under the SHA-1 of what it holds', async () => {
    const r = await run('flags-regions', PLAIN());
    expect(r.code).toBe(0);
    const { items, files, asked: about } = r.data();
    expect(about).toBe(4);
    expect(items['AA-01']).toEqual({ wd: 'Q1', file: 'Flag of Uno.svg' });
    expect(Object.keys(items)).toEqual(['AA-01', 'AA-02', 'AA-03', 'AA-04']);
    expect(files['Flag of Uno.svg'].kept).toBe(at(svg('Uno')));
    expect(r.kept()).toEqual(['Uno', 'Dos', 'Tres', 'Cuatro'].map((name) => at(svg(name))).sort());
    expect(r.read(at(svg('Tres')))).toBe(svg('Tres'));
    expect(r.source().note).toContain('4 de 4 tienen bandera');
    expect(r.source().detail).toMatchObject({ asked: 4, found: 4, by: { id: 4 }, files: { wanted: 4, brought: 4, there: 0, left: 0 }, kinds: { svg: 4 }, undone: [] });
  });

  it('leaves out what has no flag', async () => {
    const data = PLAIN();
    delete world.flags.Q2;
    const { items } = (await run('flags-regions', data)).data();
    expect(Object.keys(items)).toEqual(['AA-01', 'AA-03', 'AA-04']);
  });

  it('is not one it says it stopped flying, nor one that was withdrawn', async () => {
    const data = PLAIN();
    world.flags.Q1 = [{ file: 'Flag of Uno (1976-1997).svg', to: '1997-01-01' }, { file: 'Flag of Uno.svg' }, { file: 'Wrong.svg', rank: 'Deprecated' }];
    // Only flags of the past: nothing that it flies.
    world.flags.Q2 = [{ file: 'Flag of Dos (old).svg', to: '?' }];
    const { items, files } = (await run('flags-regions', data)).data();
    expect(items['AA-01']).toEqual({ wd: 'Q1', file: 'Flag of Uno.svg', old: ['Flag of Uno (1976-1997).svg'] });
    expect(items['AA-02']).toBeUndefined();
    expect(Object.keys(files)).not.toContain('Wrong.svg');
    expect(Object.keys(files)).not.toContain('Flag of Uno (1976-1997).svg');
  });

  it('is the preferred one where there is one, then the one that started last, then a drawing before a photograph', async () => {
    const data = PLAIN();
    world.flags.Q1 = [{ file: 'B.svg', from: '2020-05-01' }, { file: 'A.svg', rank: 'Preferred' }, { file: 'C.svg' }];
    world.flags.Q2 = [{ file: 'Since 1990.svg', from: '1990-01-01' }, { file: 'Since 2009.svg', from: '2009-06-30' }, { file: 'No day.svg' }, { file: 'Some day.svg', from: '?' }];
    world.flags.Q3 = [{ file: 'Photo.png' }, { file: 'Zeta.svg' }, { file: 'Alfa.svg' }];
    for (const name of ['A.svg', 'Since 2009.svg', 'Alfa.svg']) world.files[name] = { body: svg(name) };
    const { items } = (await run('flags-regions', data)).data();
    expect(items['AA-01']).toEqual({ wd: 'Q1', file: 'A.svg', old: ['B.svg', 'C.svg'] });
    expect(items['AA-02']).toEqual({ wd: 'Q2', file: 'Since 2009.svg', from: '2009-06-30', also: ['Since 1990.svg', 'No day.svg', 'Some day.svg'] });
    expect(items['AA-03']).toEqual({ wd: 'Q3', file: 'Alfa.svg', also: ['Zeta.svg', 'Photo.png'] });
  });

  it('is that of the entity its id was merged into', async () => {
    const data = PLAIN();
    delete world.flags.Q2;
    world.moved.Q2 = 'Q22';
    world.flags.Q22 = [{ file: 'Flag of Dos.svg' }];
    const r = await run('flags-regions', data);
    expect(r.data().items['AA-02']).toEqual({ wd: 'Q22', by: 'redirect', file: 'Flag of Dos.svg' });
    expect(r.source().detail?.by).toEqual({ id: 3, redirect: 1 });
    // Only what had no flag is asked whether it moved.
    expect(asked.filter((q) => q.includes('owl:sameAs')).flatMap(ids)).toEqual(['Q2']);
  });

  it('is that of the one entity that carries its code, when it has none of its own or the maps name none', async () => {
    world.flags.Q7 = [{ file: 'Seven.svg' }];
    world.flags.Q8 = [{ file: 'Eight.svg' }];
    world.flags.Q9 = [{ file: 'Nine.svg' }];
    world.codes = { 'AA-07': ['Q7'], 'AA-08': ['Q8'], 'AA-09': ['Q8', 'Q9'] };
    for (const name of ['Seven.svg', 'Eight.svg']) world.files[name] = { body: svg(name) };
    // AA-07 has no id; AA-08 has one with no flag; two entities carry the code of AA-09; AA-x10 has no code.
    const data = game({ AA: { units: [{ id: 'AA-07' }, { id: 'AA-08', wd: 'Q80' }, { id: 'AA-09' }, { id: 'AA-x10' }] } });
    const { items } = (await run('flags-regions', data)).data();
    expect(items).toEqual({ 'AA-07': { wd: 'Q7', by: 'code', file: 'Seven.svg' }, 'AA-08': { wd: 'Q8', by: 'code', file: 'Eight.svg' } });
    const codes = asked.filter((q) => q.includes('wdt:P300')).flatMap((q) => [...q.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
    expect(codes).toEqual(['AA-07', 'AA-08', 'AA-09']);
  });

  it('believes the entity of the maps before the one with the code, and tells the other', async () => {
    world.flags.Q1 = [{ file: 'Mine.svg' }];
    world.flags.Q10 = [{ file: 'Coded.svg' }];
    world.flags.Q2 = [{ file: 'Same.svg' }];
    world.flags.Q20 = [{ file: 'Same.svg' }];
    world.codes = { 'AA-01': ['Q10'], 'AA-02': ['Q20'], 'AA-03': ['Q3'] };
    world.flags.Q3 = [{ file: 'Three.svg' }];
    for (const name of ['Mine.svg', 'Coded.svg', 'Same.svg', 'Three.svg']) world.files[name] = { body: svg(name) };
    world.leads = { 'Coded.svg': 'Flag of the code.svg' };
    world.files['Flag of the code.svg'] = { body: svg('Coded') };
    const data = game({ AA: { units: [{ id: 'AA-01', wd: 'Q1' }, { id: 'AA-02', wd: 'Q2' }, { id: 'AA-03', wd: 'Q3' }] } });
    const r = await run('flags-regions', data);
    expect(r.data().items).toEqual({
      // The other goes by the title Commons gives it, like any file.
      'AA-01': { wd: 'Q1', file: 'Mine.svg', other: { wd: 'Q10', file: 'Flag of the code.svg' } },
      // Another entity with the same flag is nothing to tell, and the same entity is no other.
      'AA-02': { wd: 'Q2', file: 'Same.svg' },
      'AA-03': { wd: 'Q3', file: 'Three.svg' },
    });
    expect(r.source().detail?.doubted).toEqual({ other: 1, tiny: 0 });
    // The flag that is only told is brought too: which of the two it is, is not for this script to say.
    expect(Object.keys(r.data().files)).toEqual(['Flag of the code.svg', 'Mine.svg', 'Same.svg', 'Three.svg']);
    expect(r.data().files['Flag of the code.svg'].kept).toBe(at(svg('Coded')));
  });

  it('believes the one with the code when the entity of the maps is far smaller than the division', async () => {
    world.flags.Q1 = [{ file: 'City.svg' }];
    world.flags.Q10 = [{ file: 'Province.svg' }];
    world.flags.Q2 = [{ file: 'Town.svg' }];
    world.flags.Q3 = [{ file: 'Slip.svg' }];
    world.flags.Q4 = [{ file: 'Unmeasured.svg' }];
    world.codes = { 'AA-01': ['Q10'] };
    // Q1 and Q2 are a hundredth of their divisions; Q3 is a thousandth, which is a figure written wrong; Q4 has no area.
    world.areas = { Q1: [10], Q2: [10], Q3: [1], Q10: [990] };
    for (const name of ['City.svg', 'Province.svg', 'Town.svg', 'Slip.svg', 'Unmeasured.svg']) world.files[name] = { body: svg(name) };
    const data = game({ AA: { units: [{ id: 'AA-01', wd: 'Q1', ar: 1000 }, { id: 'AA-02', wd: 'Q2', ar: 1000 }, { id: 'AA-03', wd: 'Q3', ar: 1000 }, { id: 'AA-04', wd: 'Q4', ar: 1000 }] } });
    const r = await run('flags-regions', data);
    expect(r.data().items).toEqual({
      'AA-01': { wd: 'Q10', by: 'code', file: 'Province.svg', other: { wd: 'Q1', file: 'City.svg' } },
      // Nothing to take its place: it keeps its flag, and says what it looks like.
      'AA-02': { wd: 'Q2', file: 'Town.svg', tiny: true },
      'AA-03': { wd: 'Q3', file: 'Slip.svg' },
      'AA-04': { wd: 'Q4', file: 'Unmeasured.svg' },
    });
    expect(r.source().detail?.doubted).toEqual({ other: 1, tiny: 1 });
  });

  it('asks about the pieces of every level, and once about one that is in two', async () => {
    world.flags.Q1 = [{ file: 'One.svg' }];
    world.flags.Q50 = [{ file: 'Group.svg' }];
    world.flags.Q60 = [{ file: 'Both.svg' }];
    world.codes = { 'AA-G': ['Q50'] };
    for (const name of ['One.svg', 'Group.svg', 'Both.svg']) world.files[name] = { body: svg(name) };
    const data = game({
      AA: { units: [{ id: 'AA-01', wd: 'Q1' }, { id: 'AA-CE', wd: 'Q60' }], groups: [{ id: 'AA-G' }, { id: 'AA-CE' }] },
      // A map of a single piece is its country, whose flag the game has.
      BB: { units: [{ id: 'BB-x00', wd: 'Q1' }] },
    });
    const r = await run('flags-regions', data);
    expect(r.data().asked).toBe(3);
    expect(r.data().items).toEqual({ 'AA-01': { wd: 'Q1', file: 'One.svg' }, 'AA-CE': { wd: 'Q60', file: 'Both.svg' }, 'AA-G': { wd: 'Q50', by: 'code', file: 'Group.svg' } });
  });

  it('takes the flag that is given by hand before the one Wikidata gives, and where Wikidata gives none', async () => {
    const data = PLAIN();
    delete world.flags.Q2;
    for (const name of ['The real flag of Uno.svg', 'Flag of Dos by hand.svg']) world.files[name] = { body: svg(name) };
    const hand = path.join(fresh('hand'), 'hand.json');
    const given = (file: string) => ({ file, why: 'seen' });
    fs.writeFileSync(hand, JSON.stringify({ 'flags-regions': { 'AA-01': given('The real flag of Uno.svg'), 'AA-02': given('Flag of Dos by hand.svg'), 'AA-03': given('Flag of Tres.svg'), 'ZZ-99': given('Nowhere.svg'), 'AA-04': given('') }, 'flags-capitals': { 'AA-04': given('Capital.svg') } }));
    const r = await run('flags-regions', data, { OUTSIDE_FLAG_HAND: hand });
    expect(r.data().items).toEqual({
      'AA-01': { wd: 'Q1', by: 'hand', file: 'The real flag of Uno.svg', instead: 'Flag of Uno.svg' },
      // Nothing of Wikidata to tell: it had no flag, or the same one.
      'AA-02': { by: 'hand', file: 'Flag of Dos by hand.svg' },
      'AA-03': { wd: 'Q3', by: 'hand', file: 'Flag of Tres.svg' },
      'AA-04': { wd: 'Q4', file: 'Flag of Cuatro.svg' },
    });
    // The flag that gave way is not brought, and the one given is.
    expect(Object.keys(r.data().files)).toEqual(['Flag of Cuatro.svg', 'Flag of Dos by hand.svg', 'Flag of Tres.svg', 'The real flag of Uno.svg']);
    expect(r.source().detail?.by).toEqual({ hand: 3, id: 1 });
  });

  it('writes the same file for the same answers, with one entry to a line', async () => {
    const data = PLAIN();
    const [a, b] = [await run('flags-regions', data), await run('flags-regions', data)];
    expect(a.raw()).toBe(b.raw());
    const lines = a.raw().split('\n');
    expect(lines.filter((line) => line.startsWith('"AA-0'))).toHaveLength(4);
    expect(lines.filter((line) => line.startsWith('"Flag of '))).toHaveLength(4);
    expect(lines).toContain('"items": {');
    expect(lines).toContain('"files": {');
    expect(a.raw()).not.toMatch(/20\d\d-\d\d-\d\dT/);
    expect(agents.every((agent) => /regionle/.test(agent))).toBe(true);
  });
});

describe('the flag of each capital', () => {
  it('is asked of the capitals of the list of cities, by the id of each city', async () => {
    world.flags = { Q1: [{ file: 'Capital.svg' }], Q2: [{ file: 'Second.svg' }], Q3: [{ file: 'Just a city.svg' }], Q4: [{ file: 'Capital of a region.svg' }] };
    for (const name of ['Capital.svg', 'Second.svg']) world.files[name] = { body: svg(name) };
    const cities = { AA: [{ i: 'c1', k: 3, wd: 'Q1' }, { i: 'c2', k: 2, wd: 'Q2' }, { i: 'c3', wd: 'Q3' }, { i: 'c4', k: 1, wd: 'Q4' }], BB: [{ i: 'c5', k: 3, wd: 'Q5' }] };
    const r = await run('flags-capitals', game({ AA: { units: [{ id: 'AA-01' }, { id: 'AA-02' }] } }, cities));
    expect(r.code).toBe(0);
    expect(r.data().asked).toBe(3);
    expect(r.data().items).toEqual({ c1: { wd: 'Q1', file: 'Capital.svg' }, c2: { wd: 'Q2', file: 'Second.svg' } });
    expect(asked.filter((q) => q.includes('p:P41')).flatMap(ids)).toEqual(['Q1', 'Q2', 'Q5']);
    // A city has no code and no area to be judged by.
    expect(asked.some((q) => q.includes('wdt:P300') || q.includes('p:P2046'))).toBe(false);
    expect(r.kept()).toEqual([at(svg('Capital.svg')), at(svg('Second.svg'))].sort());
  });
});

describe('the flag of each city that is no capital', () => {
  it('is asked of the other cities of the list, by the id of each city', async () => {
    world.flags = { Q1: [{ file: 'Capital.svg' }], Q3: [{ file: 'Just a city.svg' }], Q4: [{ file: 'Capital of a region.svg' }] };
    for (const name of ['Just a city.svg', 'Capital of a region.svg']) world.files[name] = { body: svg(name) };
    const cities = { AA: [{ i: 'c1', k: 3, wd: 'Q1' }, { i: 'c2', k: 2, wd: 'Q2' }, { i: 'c3', wd: 'Q3' }, { i: 'c4', k: 1, wd: 'Q4' }], BB: [{ i: 'c5', k: 3, wd: 'Q5' }, { i: 'c6', k: 0, wd: 'Q6' }, { i: 'c7' }] };
    const r = await run('flags-cities', game({ AA: { units: [{ id: 'AA-01' }, { id: 'AA-02' }] } }, cities));
    expect(r.code).toBe(0);
    expect(r.data().asked).toBe(4);
    expect(r.data().items).toEqual({ c3: { wd: 'Q3', file: 'Just a city.svg' }, c4: { wd: 'Q4', file: 'Capital of a region.svg' } });
    expect(asked.filter((q) => q.includes('p:P41')).flatMap(ids)).toEqual(['Q3', 'Q4', 'Q6']);
    expect(asked.some((q) => q.includes('wdt:P300') || q.includes('p:P2046'))).toBe(false);
    expect(r.kept()).toEqual([at(svg('Just a city.svg')), at(svg('Capital of a region.svg'))].sort());
  });
});

/* ------------------------------------------------------------------ which file */

describe('the file of each flag', () => {
  it('comes with who made it and on what terms it is given', async () => {
    const data = PLAIN();
    world.files['Flag of Uno.svg'] = {
      body: svg('Uno'),
      w: 1200,
      h: 800,
      licence: 'CC BY-SA 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      artist: '<a href="//commons.wikimedia.org/wiki/User:Ana" title="User:Ana">Ana</a> &amp; <span class="x">Luis</span>',
      credit: '<span class="int-own-work" lang="en">Own work</span>',
      attribution: true,
      restrictions: 'insignia',
    };
    world.files['Flag of Dos.svg'].artist = `<b>${'x'.repeat(400)}</b>`;
    const { files } = (await run('flags-regions', data)).data();
    expect(files['Flag of Uno.svg']).toEqual({
      sha1: sha1(svg('Uno')),
      bytes: svg('Uno').length,
      mime: 'image/svg+xml',
      w: 1200,
      h: 800,
      licence: 'CC BY-SA 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      artist: 'Ana & Luis',
      credit: 'Own work',
      attribution: true,
      restrictions: 'insignia',
      page: 'https://commons.wikimedia.org/wiki/File:Flag%20of%20Uno.svg',
      kept: at(svg('Uno')),
    });
    expect(files['Flag of Dos.svg']).toMatchObject({ licence: 'Public domain' });
    expect(files['Flag of Dos.svg']).not.toHaveProperty('attribution');
    expect(files['Flag of Dos.svg'].artist).toHaveLength(160);
    expect(files['Flag of Dos.svg'].artist?.endsWith('…')).toBe(true);
  });

  it('goes by the title Commons gives it, whatever name the statement had', async () => {
    const data = PLAIN();
    world.flags.Q1 = [{ file: 'Bandera_de_Uno.svg' }];
    world.flags.Q2 = [{ file: 'Old name of Dos.svg' }];
    world.leads = { 'Old name of Dos.svg': 'Flag of Dos.svg' };
    world.files['Bandera de Uno.svg'] = { body: svg('Uno bis') };
    const { items, files } = (await run('flags-regions', data)).data();
    expect(items['AA-01'].file).toBe('Bandera de Uno.svg');
    expect(items['AA-02'].file).toBe('Flag of Dos.svg');
    expect(Object.keys(files)).toEqual(['Bandera de Uno.svg', 'Flag of Dos.svg', 'Flag of Tres.svg', 'Flag of Cuatro.svg'].sort());
  });

  it('says so when Commons has no such file, and brings the rest', async () => {
    const data = PLAIN();
    delete world.files['Flag of Dos.svg'];
    const r = await run('flags-regions', data);
    expect(r.code).toBe(0);
    expect(r.data().items['AA-02'].file).toBe('Flag of Dos.svg');
    expect(r.data().files['Flag of Dos.svg']).toEqual({ missing: true });
    expect(r.source().detail?.files).toMatchObject({ all: 3, missing: 1, wanted: 3, brought: 3 });
    expect(r.kept()).toHaveLength(3);
  });

  it('brings the drawing that the page of a photograph says there is, and not the photograph', async () => {
    const data = PLAIN();
    world.flags.Q1 = [{ file: 'Flag of Uno.png' }];
    world.flags.Q2 = [{ file: 'Flag of Dos.gif' }];
    world.flags.Q3 = [{ file: 'Flag of Tres.jpg' }];
    world.files['Flag of Uno.png'] = { body: 'a photograph of Uno', mime: 'image/png', text: '{{vva|Flag of Uno.svg}}\n{{Information\n|Description=Flag}}' };
    // No drawing is named; and the one that is named is not there.
    world.files['Flag of Dos.gif'] = { body: 'a photograph of Dos', mime: 'image/gif', text: '{{Information|other versions=[[File:Flag of Dos.svg]]}}' };
    world.files['Flag of Tres.jpg'] = { body: 'a photograph of Tres', mime: 'image/jpeg', text: '{{Vector version available|File:Gone.svg}}' };
    const r = await run('flags-regions', data);
    const { items, files } = r.data();
    expect(items['AA-01'].file).toBe('Flag of Uno.png');
    expect(files['Flag of Uno.png']).toMatchObject({ mime: 'image/png', drawn: 'Flag of Uno.svg' });
    expect(files['Flag of Uno.png']).not.toHaveProperty('kept');
    expect(files['Flag of Uno.svg'].kept).toBe(at(svg('Uno')));
    expect(files['Flag of Dos.gif'].kept).toBe(at('a photograph of Dos', 'gif'));
    expect(files['Flag of Dos.gif']).not.toHaveProperty('drawn');
    expect(files['Flag of Tres.jpg'].kept).toBe(at('a photograph of Tres', 'jpg'));
    expect(files['Gone.svg']).toEqual({ missing: true });
    expect(r.source().detail).toMatchObject({ files: { drawn: 1 }, kinds: { svg: 2, png: 1, gif: 1, jpg: 1 } });
    // Only the pages of the photographs are read.
    const read = asked.filter((q) => q.startsWith('api ') && q.includes('prop=revisions')).map((q) => new URLSearchParams(q.slice(4)).get('titles'));
    expect(read).toEqual(['File:Flag of Dos.gif|File:Flag of Tres.jpg|File:Flag of Uno.png']);
    expect(asked).not.toContain('file Flag of Uno.png');
  });

  it.each([
    ['{{vva|Flag of X.svg}}', 'Flag of X.svg'],
    ['{{Vector version available|Flag_of_X.svg}}', 'Flag of X.svg'],
    ['{{vector version available | 1 = File:Flag of X.svg | 2 = other}}', 'Flag of X.svg'],
    ['{{SupersededSVG|Image:Flag of X.svg}}', 'Flag of X.svg'],
    ['{{Superseded|Flag of X.svg|reason}}', 'Flag of X.svg'],
    ['{{Superseded|Flag of X.png}}', null],
    ['{{Convert to SVG|flag}}', null],
  ])('reads %s as a drawing of the same flag: %s', async (page, drawing) => {
    world.flags.Q1 = [{ file: 'Photo.png' }];
    world.files['Photo.png'] = { body: 'a photograph', mime: 'image/png', text: page };
    world.files['Flag of X.svg'] = { body: svg('X') };
    const { files } = (await run('flags-regions', game({ AA: { units: [{ id: 'AA-01', wd: 'Q1' }, { id: 'AA-02' }] } }))).data();
    expect(files['Photo.png'].drawn ?? null).toBe(drawing);
  });

  it('describes and brings the other flags that the entity flies today', async () => {
    const data = PLAIN();
    world.flags.Q1 = [{ file: 'Flag of Uno (Variant).svg', from: '2020-01-01' }, { file: 'Flag_of_Uno.svg' }, { file: 'Flag of Uno (1976-1997).svg', to: '1997-01-01' }];
    world.files['Flag of Uno (Variant).svg'] = { body: svg('Uno, another way') };
    const r = await run('flags-regions', data);
    const { items, files } = r.data();
    // By the title Commons gives it, like the first.
    expect(items['AA-01']).toEqual({ wd: 'Q1', file: 'Flag of Uno (Variant).svg', from: '2020-01-01', also: ['Flag of Uno.svg'], old: ['Flag of Uno (1976-1997).svg'] });
    expect(files['Flag of Uno (Variant).svg'].kept).toBe(at(svg('Uno, another way')));
    expect(files['Flag of Uno.svg'].kept).toBe(at(svg('Uno')));
    // One of the past is named, and nothing is asked about it.
    expect(Object.keys(files)).not.toContain('Flag of Uno (1976-1997).svg');
    expect(r.kept()).toHaveLength(5);
  });

  it('tells which categories of Commons may say that a file is not a flag that flies', async () => {
    const data = PLAIN();
    world.files['Flag of Uno.svg'].categories = ['Flags of the province of Uno', 'Historical flags of provinces of Spain', 'SVG flags with an aspect ratio of 3:2'];
    world.files['Flag of Dos.svg'].categories = ['SVG proposed flags of provinces of Spain', 'Proposals for municipality flags of East Timor 2009', 'Special or fictional flags'];
    world.files['Flag of Tres.svg'].categories = ['Flags of former municipalities of Latvia', 'Flags of Luanda (before 1975)', 'Luanda in the 20th century'];
    // Old and still flown, of what was once another country, unofficial: none of that says it does not fly.
    world.files['Flag of Cuatro.svg'].categories = ['Flags introduced in 1964', 'Flags of states of the German Confederation', 'SVG flags of states of the Confederate States', 'Unofficial flags of regions of France', 'Flags with historical themes'];
    const r = await run('flags-regions', data);
    const { files } = r.data();
    expect(files['Flag of Uno.svg'].marks).toEqual(['Historical flags of provinces of Spain']);
    expect(files['Flag of Dos.svg'].marks).toEqual(['Proposals for municipality flags of East Timor 2009', 'SVG proposed flags of provinces of Spain', 'Special or fictional flags']);
    expect(files['Flag of Tres.svg'].marks).toEqual(['Flags of Luanda (before 1975)', 'Flags of former municipalities of Latvia']);
    expect(files['Flag of Cuatro.svg'].marks).toBeUndefined();
    // What a file is, is told; whether it goes in the game, is decided where the flags are made. It is brought all the same.
    expect(r.kept()).toHaveLength(4);
    expect(asked.filter((q) => q.startsWith('api ') && q.includes('prop=categories')).every((q) => q.includes('clshow=%21hidden'))).toBe(true);
  });

  it('reads the categories that Commons gives in more than one piece', async () => {
    const data = PLAIN();
    world.atOnce = 2;
    world.files['Flag of Cuatro.svg'].categories = ['Flags of Cuatro', 'SVG flags', 'Red flags', 'Historical flags of Cuatro'];
    world.files['Flag of Dos.svg'].categories = ['Flags of Dos', 'Proposed flags of Dos'];
    world.files['Flag of Uno.svg'].categories = ['Flags of Uno'];
    const r = await run('flags-regions', data);
    const { files } = r.data();
    expect(files['Flag of Cuatro.svg'].marks).toEqual(['Historical flags of Cuatro']);
    expect(files['Flag of Dos.svg'].marks).toEqual(['Proposed flags of Dos']);
    expect(files['Flag of Uno.svg'].marks).toBeUndefined();
    expect(asked.filter((q) => q.startsWith('api ') && q.includes('prop=categories'))).toHaveLength(4);
    expect(r.source().detail?.undone).toEqual([]);
  });

  it('brings the picture Wikimedia draws of an original that is too heavy', async () => {
    const data = PLAIN();
    world.files['Flag of Uno.svg'] = { body: svg('Uno'), bytes: 3_000_000 };
    const r = await run('flags-regions', data, { OUTSIDE_FLAG_MAX: '1000000' });
    const file = r.data().files['Flag of Uno.svg'];
    const name = `flags/files/${sha1(svg('Uno')).slice(0, 2)}/${sha1(svg('Uno'))}.960.png`;
    expect(file.picture).toBe(name);
    expect(file).not.toHaveProperty('kept');
    expect(r.read(name)).toBe('a picture of Flag of Uno.svg');
    expect(asked).toContain('picture Flag of Uno.svg');
    expect(asked).not.toContain('file Flag of Uno.svg');
    expect(asked.find((q) => q.startsWith('api ') && q.includes('prop=imageinfo'))).toContain('iiurlwidth=960');
    expect(r.source().detail?.files).toMatchObject({ brought: 4, pictures: 1 });
    expect(r.source().note).toContain('con 1 imágenes');
  });

  it('brings a drawing with words in it both ways: as it is, and as Wikimedia draws it', async () => {
    const data = PLAIN();
    const worded = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><text x="1" y="1">UNO</text></svg>';
    world.files['Flag of Uno.svg'] = { body: worded };
    // A title is not words, nor is a word in the name of something else.
    world.files['Flag of Dos.svg'] = { body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><title>text</title><g id="textile"/></svg>' };
    const r = await run('flags-regions', data);
    const file = r.data().files['Flag of Uno.svg'];
    expect(file).toMatchObject({ words: true, kept: at(worded), picture: at(worded, '960.png') });
    expect(r.read(at(worded))).toBe(worded);
    expect(r.read(at(worded, '960.png'))).toBe('a picture of Flag of Uno.svg');
    expect(r.data().files['Flag of Dos.svg']).not.toHaveProperty('words');
    expect(r.data().files['Flag of Dos.svg']).not.toHaveProperty('picture');
    expect(r.source().detail?.files).toMatchObject({ words: 1, brought: 4, pictures: 1 });

    // The next run knows it has words from what the branch says, and brings nothing again.
    world.branch['flags/regions.json'] = r.raw();
    asked = [];
    const again = await run('flags-regions', data);
    expect(asked.filter((q) => q.startsWith('file ') || q.startsWith('picture '))).toEqual([]);
    expect(again.data().files['Flag of Uno.svg']).toMatchObject({ words: true, kept: at(worded), picture: at(worded, '960.png') });
    expect(again.raw()).toBe(r.raw());

    // A drawing that the branch kept before anybody looked inside is brought as a picture once the list names it.
    world.branch['flags/regions.json'] = r.raw().replace('"words":true,', '').replace(/,"picture":"[^"]+"/, '');
    asked = [];
    const unaware = await run('flags-regions', data);
    expect(asked.filter((q) => q.startsWith('file ') || q.startsWith('picture '))).toEqual([]);
    expect(unaware.data().files['Flag of Uno.svg']).not.toHaveProperty('picture');
    const list = path.join(fresh('list'), 'pictures.txt');
    fs.writeFileSync(list, '# Drawings with words in them\nFlag of Uno.svg\n\nFlag of nowhere.svg\n');
    const listed = await run('flags-regions', data, { OUTSIDE_FLAG_PICTURES: list });
    expect(asked.filter((q) => q.startsWith('file ') || q.startsWith('picture '))).toEqual(['picture Flag of Uno.svg']);
    expect(listed.data().files['Flag of Uno.svg']).toMatchObject({ kept: at(worded), picture: at(worded, '960.png') });
    expect(listed.kept()).toEqual([at(worded, '960.png')]);
  });

  it('downloads one file at a time, each after a wait', async () => {
    const r = await run('flags-regions', PLAIN(), { OUTSIDE_FLAG_GAP: '120' });
    expect(r.kept()).toHaveLength(4);
    const when = times.filter((_, i) => asked[i].startsWith('file '));
    expect(when).toHaveLength(4);
    for (let i = 1; i < when.length; i++) expect(when[i] - when[i - 1]).toBeGreaterThanOrEqual(110);
  });

  it('does not download again what the branch already keeps', async () => {
    const data = PLAIN();
    const first = await run('flags-regions', data);
    world.branch['flags/regions.json'] = first.raw();
    // What another source of flags brought counts too.
    world.flags.Q9 = [{ file: 'Flag of Tres.svg' }];
    world.branch['flags/capitals.json'] = JSON.stringify({ files: { 'Flag of Nueve.svg': { kept: 'flags/files/zz/nothing.svg' } } });
    world.flags.Q4 = [{ file: 'New flag of Cuatro.svg' }];
    world.files['New flag of Cuatro.svg'] = { body: svg('Cuatro, new') };
    asked = [];
    const r = await run('flags-regions', data);
    expect(asked.filter((q) => q.startsWith('file '))).toEqual(['file New flag of Cuatro.svg']);
    // Every source that brings files is asked what it keeps.
    expect(asked.filter((q) => q.startsWith('branch '))).toEqual(['branch flags/regions.json', 'branch flags/capitals.json', 'branch flags/cities.json', 'branch flags/countries.json', 'branch flags/listed.json', 'branch flags/signals.json']);
    expect(r.kept()).toEqual([at(svg('Cuatro, new'))]);
    // The entry of a file that was there says where it is all the same.
    expect(r.data().files['Flag of Uno.svg'].kept).toBe(at(svg('Uno')));
    expect(r.source().note).toContain('4 archivos: 1 descargados');
    expect(r.source().note).toContain('3 que ya estaban');
    expect(r.source().detail?.files).toMatchObject({ wanted: 4, brought: 1, there: 3, left: 0 });
  });

  it('looks at nothing kept where there is no branch to read', async () => {
    const r = await run('flags-regions', PLAIN(), { OUTSIDE_KEPT: '' });
    expect(asked.some((q) => q.startsWith('branch '))).toBe(false);
    expect(r.kept()).toHaveLength(4);
  });
});

/* ------------------------------------------------------------------ when something fails */

describe('when a place does not answer', () => {
  it('leaves the source unread, and the run in red, when the first question has no answer', async () => {
    refusals = [{ when: (q) => q.startsWith('sparql ') && q.includes('p:P41'), status: 500, times: 99 }];
    const r = await run('flags-regions', PLAIN());
    expect(r.source()).toMatchObject({ ok: false, error: 'HTTP 500 Internal Server Error' });
    expect(fs.existsSync(path.join(r.dir, 'flags/regions.json'))).toBe(false);
  });

  it('leaves the source unread when Commons says nothing of the files', async () => {
    refusals = [{ when: (q) => q.startsWith('api '), status: 403, times: 99 }];
    const r = await run('flags-regions', PLAIN());
    expect(r.source()).toMatchObject({ ok: false, error: 'HTTP 403 Forbidden' });
    expect(r.kept()).toEqual([]);
  });

  it('keeps the flags it found when the other ways of finding them fail, and says which', async () => {
    const data = PLAIN();
    delete world.flags.Q2;
    world.areas = { Q1: [1] };
    refusals = [
      { when: (q) => q.includes('owl:sameAs'), status: 403, times: 99 },
      { when: (q) => q.includes('wdt:P300'), status: 403, times: 99 },
      { when: (q) => q.includes('p:P2046'), status: 403, times: 99 },
    ];
    const r = await run('flags-regions', data);
    expect(r.code).toBe(0);
    expect(Object.keys(r.data().items)).toEqual(['AA-01', 'AA-03', 'AA-04']);
    expect(r.source().detail?.undone).toEqual(['los identificadores que han cambiado (HTTP 403 Forbidden)', 'los códigos ISO 3166-2 (HTTP 403 Forbidden)', 'la superficie de cada entidad (HTTP 403 Forbidden)']);
    expect(r.source().note).toContain('sin mirar: los identificadores que han cambiado');
  });

  it('keeps the photograph when it cannot learn whether there is a drawing of it', async () => {
    const data = PLAIN();
    world.flags.Q1 = [{ file: 'Flag of Uno.png' }];
    world.files['Flag of Uno.png'] = { body: 'a photograph of Uno', mime: 'image/png', text: '{{vva|Flag of Uno.svg}}' };
    refusals = [{ when: (q) => q.startsWith('api ') && q.includes('prop=revisions'), status: 500, times: 99 }];
    const r = await run('flags-regions', data);
    expect(r.data().files['Flag of Uno.png'].kept).toBe(at('a photograph of Uno', 'png'));
    expect(r.source().detail?.undone).toEqual(['los dibujos de las banderas que son fotografías (HTTP 500 Internal Server Error)']);
  });

  it('keeps the flags when it cannot read their categories, and says so', async () => {
    const data = PLAIN();
    world.files['Flag of Uno.svg'].categories = ['Historical flags of Uno'];
    refusals = [{ when: (q) => q.startsWith('api ') && q.includes('prop=categories'), status: 500, times: 99 }];
    const r = await run('flags-regions', data);
    expect(r.code).toBe(0);
    expect(r.data().files['Flag of Uno.svg'].marks).toBeUndefined();
    expect(r.kept()).toHaveLength(4);
    expect(r.source().detail?.undone).toEqual(['lo que las categorías de Commons dicen de cada bandera (HTTP 500 Internal Server Error)']);
  });

  it('leaves a file that cannot be downloaded with no place in the branch, says how many, and brings the others', async () => {
    refusals = [{ when: (q) => q === 'file Flag of Dos.svg', status: 404, times: 99 }];
    const r = await run('flags-regions', PLAIN());
    expect(r.code).toBe(0);
    expect(r.source().ok).toBe(true);
    const { files } = r.data();
    expect(files['Flag of Dos.svg']).toMatchObject({ sha1: sha1(svg('Dos')) });
    expect(files['Flag of Dos.svg']).not.toHaveProperty('kept');
    expect(r.kept()).toHaveLength(3);
    expect(r.source().detail?.undone).toEqual(['1 de 4 archivos (HTTP 404 Not Found)']);
    expect(r.source().note).toContain('1 sin traer');
    // It was left unread only in part: the run is not in red for it.
    expect((await run('flags-regions', PLAIN(), {}, r.dir)).code).toBe(0);
  });

  it('asks again for a file when the place is busy for a moment', async () => {
    refusals = [{ when: (q) => q === 'file Flag of Dos.svg', status: 429, times: 2 }];
    const r = await run('flags-regions', PLAIN());
    expect(r.kept()).toHaveLength(4);
    expect(asked.filter((q) => q === 'file Flag of Dos.svg')).toHaveLength(3);
  });

  it('asks for no more files in a run once the place goes on saying that it is too much', async () => {
    refusals = [{ when: (q) => q === 'file Flag of Dos.svg', status: 429, times: 99 }];
    const r = await run('flags-regions', PLAIN());
    expect(r.source().ok).toBe(true);
    // In the order of the alphabet: Cuatro came, Dos was refused three times, and Tres and Uno were not asked for.
    expect(asked.filter((q) => q.startsWith('file '))).toEqual(['file Flag of Cuatro.svg', 'file Flag of Dos.svg', 'file Flag of Dos.svg', 'file Flag of Dos.svg']);
    expect(r.kept()).toEqual([at(svg('Cuatro'))]);
    expect(r.source().detail?.undone).toEqual(['3 de 4 archivos (HTTP 429 Too Many Requests)']);
  });

  it('does not keep a file that is not what its page says', async () => {
    const data = PLAIN();
    world.files['Flag of Uno.svg'].sha1 = sha1('something else');
    const r = await run('flags-regions', data);
    expect(r.kept()).toHaveLength(3);
    expect(r.data().files['Flag of Uno.svg']).not.toHaveProperty('kept');
    expect(r.source().detail?.undone).toEqual(['1 de 4 archivos (lo descargado no es lo que su ficha dice)']);
  });

  it('takes a file whose page gives no SHA-1 to be no file: its name is where it would be kept', async () => {
    const data = PLAIN();
    world.files['Flag of Uno.svg'].sha1 = '../../../../outside';
    const r = await run('flags-regions', data);
    expect(r.data().files['Flag of Uno.svg']).toEqual({ missing: true });
    expect(r.kept()).toHaveLength(3);
    expect(fs.readdirSync(path.dirname(r.dir)).filter((name) => name.startsWith('outside'))).toEqual([]);
  });

  it('stops downloading when file after file fails', async () => {
    const units = Array.from({ length: 14 }, (_, i) => ({ id: `AA-${String(i + 1).padStart(2, '0')}`, wd: `Q${i + 1}` }));
    for (const u of units) {
      world.flags[u.wd] = [{ file: `${u.id}.svg` }];
      world.files[`${u.id}.svg`] = { body: svg(u.id) };
    }
    refusals = [{ when: (q) => q.startsWith('file '), status: 404, times: 99 }];
    const r = await run('flags-regions', game({ AA: { units } }));
    expect(r.kept()).toEqual([]);
    expect(asked.filter((q) => q.startsWith('file '))).toHaveLength(8);
    expect(r.source().detail?.files).toMatchObject({ wanted: 14, brought: 0, left: 14 });
  });

  it('brings no file once the time is up, and says so', async () => {
    const r = await run('flags-regions', PLAIN(), { OUTSIDE_PATIENCE: '0' });
    expect(r.source().ok).toBe(true);
    expect(Object.keys(r.data().items)).toHaveLength(4);
    expect(r.kept()).toEqual([]);
    expect(r.source().detail?.undone).toContain('4 de 4 archivos (no quedaba tiempo)');
  });
});

/* ------------------------------------------------------------------ the flag that Wikipedia shows */

describe('the flag that the page of Wikipedia shows', () => {
  /** PLAIN, with the second province and the third left with no flag in Wikidata. */
  const BARE = () => {
    const data = PLAIN();
    delete world.flags.Q2;
    delete world.flags.Q3;
    for (const name of ['Dos county flag.svg', 'Bandera de Tres.png']) world.files[name] = { body: svg(name), ...(name.endsWith('.png') ? { mime: 'image/png' } : {}) };
    return data;
  };
  const box = (param: string) => `{{Short description|A county}}\n{{Infobox settlement\n| name = X\n${param}\n| image_shield = Arms of X.svg\n}}\n'''X''' is a county.`;

  it('is taken for what Wikidata gives no flag of, the English page before the Spanish one', async () => {
    const data = BARE();
    world.pages = { Q2: { en: 'Dos County', es: 'Provincia de Dos' }, Q3: { es: 'Tres (provincia)' }, Q1: { en: 'Uno' } };
    world.leadsOf = {
      'en:Dos County': box('| image_flag = Dos county flag.svg'),
      'es:Provincia de Dos': box('| bandera = Otra.svg'),
      'es:Tres (provincia)': box('|bandera=Bandera_de_Tres.png'),
    };
    const r = await run('flags-regions', data);
    expect(r.code).toBe(0);
    expect(r.data().items['AA-02']).toEqual({ wd: 'Q2', by: 'wikipedia', page: 'en:Dos County', file: 'Dos county flag.svg' });
    expect(r.data().items['AA-03']).toEqual({ wd: 'Q3', by: 'wikipedia', page: 'es:Tres (provincia)', file: 'Bandera de Tres.png' });
    // Only what has no flag is asked about, and the Spanish page only of what the English one left with none.
    expect(asked.filter((q) => q.includes('schema:about')).flatMap(ids)).toEqual(['Q2', 'Q3']);
    expect(asked.filter((q) => q.startsWith('wiki '))).toEqual(['wiki en Dos County', 'wiki es Tres (provincia)']);
    expect(r.kept()).toContain(at(svg('Dos county flag.svg')));
    expect(r.kept()).toContain(at(svg('Bandera de Tres.png'), 'png'));
    expect(r.source().detail?.by).toEqual({ id: 2, wikipedia: 2 });
    expect(r.source().note).toContain('4 de 4 tienen bandera');
  });

  it.each([
    ['| image_flag = [[File:Dos county flag.svg|125px|border]]', 'Dos county flag.svg'],
    ['| image_flag   =   Dos_county_flag.svg', 'Dos county flag.svg'],
    ['| flag = Image:Dos county flag.svg', 'Dos county flag.svg'],
    ['| image_flag = Dos county flag.svg{{!}}border', 'Dos county flag.svg'],
    ['| image_flag = <!-- none yet -->Dos county flag.svg', 'Dos county flag.svg'],
    ['| image_flag = <!-- Dos county flag.svg -->', null],
    ['| image_flag = ', null],
    ['| image_flag = {{flag|Spain}}', null],
    ['| bandera = no', null],
    ['| flag_size = 120px\n| flag_link = Flag of Dos\n| flag_alt = Dos county flag.svg', null],
  ])('reads «%s» as the flag %s', async (param, file) => {
    const data = BARE();
    world.pages = { Q2: { en: 'Dos County' } };
    world.leadsOf = { 'en:Dos County': box(param) };
    const r = await run('flags-regions', data);
    expect(r.data().items['AA-02']?.file ?? null).toBe(file);
  });

  it('follows a page to the one its title leads to', async () => {
    const data = BARE();
    world.pages = { Q2: { en: 'Dos county' } };
    world.wikiLeads = { 'en:Dos county': 'Dos County' };
    world.leadsOf = { 'en:Dos County': box('| image_flag = Dos county flag.svg') };
    const r = await run('flags-regions', data);
    expect(r.data().items['AA-02']).toMatchObject({ by: 'wikipedia', page: 'en:Dos county', file: 'Dos county flag.svg' });
  });

  it('gives way to a flag given by hand, which tells what Wikipedia showed', async () => {
    const data = BARE();
    world.pages = { Q2: { en: 'Dos County' } };
    world.leadsOf = { 'en:Dos County': box('| image_flag = Dos county flag.svg') };
    world.files['By hand.svg'] = { body: svg('hand') };
    const hand = path.join(fresh('hand'), 'hand.json');
    fs.writeFileSync(hand, JSON.stringify({ 'flags-regions': { 'AA-02': { file: 'By hand.svg', why: 'seen' } } }));
    const r = await run('flags-regions', data, { OUTSIDE_FLAG_HAND: hand });
    expect(r.data().items['AA-02']).toEqual({ wd: 'Q2', by: 'hand', file: 'By hand.svg', instead: 'Dos county flag.svg' });
  });

  it('asks Wikipedia nothing when everything has its flag in Wikidata', async () => {
    await run('flags-regions', PLAIN());
    expect(asked.some((q) => q.includes('schema:about') || q.startsWith('wiki '))).toBe(false);
  });

  it('keeps what Wikidata gave when Wikipedia does not answer, and says so', async () => {
    const data = BARE();
    world.pages = { Q2: { en: 'Dos County' } };
    refusals = [{ when: (q) => q.startsWith('wiki '), status: 403, times: 99 }];
    const r = await run('flags-regions', data);
    expect(r.code).toBe(0);
    expect(Object.keys(r.data().items)).toEqual(['AA-01', 'AA-04']);
    expect(r.source().detail?.undone).toEqual(['las fichas de Wikipedia (HTTP 403 Forbidden)']);
  });
});

/* ------------------------------------------------------------------ the flags that are not of the maps */

describe('the flags a country flew before', () => {
  const OLD = () => {
    world.flags = {
      Q10: [
        { file: 'Flag of Aa.svg' },
        { file: 'Flag of Aa (1900-1950).svg', from: '1900-01-01', to: '1950-06-30' },
        { file: 'Flag of Aa (1950-1990).svg', from: '1950-07-01', to: '1990-01-01', rank: 'Preferred' },
        { file: 'Flag of Aa, once.svg', to: '?' },
        { file: 'Flag of Aa, wrong.svg', to: '1960-01-01', rank: 'Deprecated' },
      ],
      Q20: [{ file: 'Flag of Bb.svg' }],
    };
    for (const name of ['Flag of Aa (1900-1950).svg', 'Flag of Aa (1950-1990).svg', 'Flag of Aa, once.svg']) world.files[name] = { body: svg(name) };
    return game({ AA: { units: [{ id: 'AA-01' }, { id: 'AA-02' }], wd: 'Q10' }, BB: { units: [{ id: 'BB-01' }, { id: 'BB-02' }], wd: 'Q20' }, CC: { units: [{ id: 'CC-01' }, { id: 'CC-02' }] } });
  };

  it('are those that say when they stopped flying, the last first, each with its days and its file', async () => {
    const r = await run('flags-countries', OLD());
    expect(r.code).toBe(0);
    expect(r.data().asked).toBe(2);
    expect(r.data().items).toEqual({
      AA: {
        wd: 'Q10',
        past: [
          { file: 'Flag of Aa (1950-1990).svg', rank: 'preferred', from: '1950-07-01', to: '1990-01-01' },
          { file: 'Flag of Aa (1900-1950).svg', from: '1900-01-01', to: '1950-06-30' },
          { file: 'Flag of Aa, once.svg', to: '?' },
        ],
      },
    });
    // The flag of today is the game's own, and is not brought; nor is one that was withdrawn.
    expect(Object.keys(r.data().files)).toEqual(['Flag of Aa (1900-1950).svg', 'Flag of Aa (1950-1990).svg', 'Flag of Aa, once.svg']);
    expect(r.kept()).toHaveLength(3);
    expect(r.source().note).toContain('3 banderas anteriores de 1 de 2 países');
    expect(asked.filter((q) => q.includes('p:P41')).flatMap(ids)).toEqual(['Q10', 'Q20']);
  });

  it('is left unread when no country has a Wikidata id', async () => {
    const r = await run('flags-countries', game({ AA: { units: [{ id: 'AA-01' }, { id: 'AA-02' }] } }));
    expect(r.code).toBe(0);
    expect(r.source().ok).toBe(false);
  });
});

describe('the flags of what the lists name', () => {
  const lists = (said: unknown) => {
    const file = path.join(fresh('lists'), 'lists.json');
    fs.writeFileSync(file, JSON.stringify(said));
    return file;
  };
  const LISTED = () => {
    world.flags = {
      // A country that is no more: every flag it had says when it ended.
      Q100: [
        { file: 'Flag of Gone (1920-1950).svg', from: '1920-01-01', to: '1950-01-01' },
        { file: 'Flag of Gone (1950-1990).svg', from: '1950-01-01', to: '1990-12-26' },
      ],
      // An organisation, with the flag it flies and one it flew.
      Q200: [{ file: 'Flag of the Union.svg' }, { file: 'Other flag of the Union.svg' }, { file: 'Flag of the Union (1950).svg', to: '1960-01-01' }],
      Q300: [{ file: 'Flag of a People.svg' }],
    };
    for (const name of Object.values(world.flags).flat().map((st) => st.file)) world.files[name] = { body: svg(name) };
    return lists({ historical: { Q100: { es: 'Ido' }, Q999: { es: 'Sin bandera' } }, organisations: { Q200: { es: 'La Unión' } }, peoples: { Q300: { es: 'Un pueblo' } }, other: { 'not-an-id': {} } });
  };

  it('are the one each flies today and those it stopped flying, the last first', async () => {
    const r = await run('flags-listed', PLAIN(), { OUTSIDE_FLAG_LISTS: LISTED() });
    expect(r.code).toBe(0);
    expect(r.data().asked).toBe(4);
    expect(r.data().items).toEqual({
      Q100: {
        past: [
          { file: 'Flag of Gone (1950-1990).svg', from: '1950-01-01', to: '1990-12-26' },
          { file: 'Flag of Gone (1920-1950).svg', from: '1920-01-01', to: '1950-01-01' },
        ],
      },
      Q200: { file: 'Flag of the Union.svg', also: ['Other flag of the Union.svg'], past: [{ file: 'Flag of the Union (1950).svg', to: '1960-01-01' }] },
      Q300: { file: 'Flag of a People.svg' },
    });
    expect(asked.filter((q) => q.includes('p:P41')).flatMap(ids)).toEqual(['Q100', 'Q200', 'Q300', 'Q999']);
    expect(r.kept()).toHaveLength(6);
    expect(r.source().note).toContain('3 de 4 tienen bandera');
  });

  it('say when the flag that is flown is the one Wikidata prefers to the others', async () => {
    const said = LISTED();
    world.flags.Q300 = [{ file: 'Flag of a People.svg' }, { file: 'The flag of a People.svg', rank: 'Preferred' }];
    world.files['The flag of a People.svg'] = { body: svg('the people') };
    const r = await run('flags-listed', PLAIN(), { OUTSIDE_FLAG_LISTS: said });
    expect(r.data().items.Q300).toEqual({ file: 'The flag of a People.svg', rank: 'preferred' });
    expect(r.data().items.Q200.rank).toBeUndefined();
  });

  it('take the one that is given by hand before the one Wikidata gives', async () => {
    const said = LISTED();
    world.files['The flag of Gone.svg'] = { body: svg('gone') };
    world.files['The flag of Nothing.svg'] = { body: svg('nothing') };
    const hand = path.join(fresh('hand'), 'hand.json');
    fs.writeFileSync(hand, JSON.stringify({ 'flags-listed': { Q100: { file: 'The flag of Gone.svg', why: 'seen' }, Q999: { file: 'The flag of Nothing.svg', why: 'seen' }, Q200: { file: 'Flag of the Union.svg', why: 'the same' }, Q5: { file: 'Not listed.svg', why: 'seen' } } }));
    const r = await run('flags-listed', PLAIN(), { OUTSIDE_FLAG_LISTS: said, OUTSIDE_FLAG_HAND: hand });
    expect(r.data().items.Q100).toMatchObject({ by: 'hand', file: 'The flag of Gone.svg' });
    expect(r.data().items.Q100.past).toHaveLength(2);
    expect(r.data().items.Q999).toEqual({ by: 'hand', file: 'The flag of Nothing.svg' });
    expect(r.data().items.Q200).toMatchObject({ by: 'hand', file: 'Flag of the Union.svg' });
    expect(r.data().items.Q200.instead).toBeUndefined();
    expect(r.data().items.Q5).toBeUndefined();
  });

  it('is left unread where the lists name nothing', async () => {
    const r = await run('flags-listed', PLAIN());
    expect(r.source().ok).toBe(false);
    expect(asked).toEqual([]);
  });
});

describe('the flags that are signals', () => {
  it('are the files that the list names, by the id it gives each', async () => {
    for (const name of ['ICS Alfa.svg', 'ICS Bravo.svg']) world.files[name] = { body: svg(name) };
    world.leads = { 'ICS Alpha.svg': 'ICS Alfa.svg' };
    const file = path.join(fresh('signals'), 'signals.json');
    fs.writeFileSync(file, JSON.stringify({ signals: { 'ics-a': { file: 'ICS Alpha.svg', es: 'A' }, 'ics-b': { file: 'ICS Bravo.svg', es: 'B' }, 'ics-c': { file: 'ICS Charlie.svg', es: 'C' }, 'ics-d': { es: 'D' } } }));
    const r = await run('flags-signals', PLAIN(), { OUTSIDE_FLAG_SIGNALS: file });
    expect(r.code).toBe(0);
    expect(r.data().items).toEqual({ 'ics-a': { by: 'hand', file: 'ICS Alfa.svg' }, 'ics-b': { by: 'hand', file: 'ICS Bravo.svg' }, 'ics-c': { by: 'hand', file: 'ICS Charlie.svg' } });
    expect(r.data().files['ICS Charlie.svg']).toEqual({ missing: true });
    expect(r.kept()).toEqual([at(svg('ICS Alfa.svg')), at(svg('ICS Bravo.svg'))].sort());
    // Wikidata is asked nothing: the list says it all.
    expect(asked.some((q) => q.startsWith('sparql '))).toBe(false);
  });

  it('is left unread where there is no list', async () => {
    const r = await run('flags-signals', PLAIN());
    expect(r.source().ok).toBe(false);
  });
});

describe('the photographs of the sheets of the countries', () => {
  /** A folder of sheets, each a file named after its country. */
  const sheets = (said: Record<string, unknown>) => {
    const dir = fresh('profiles');
    for (const [id, sheet] of Object.entries(said)) fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(sheet));
    return dir;
  };
  const picture = (body: string, kind = 'jpg') => `photos/files/${sha1(body)}.1920.${kind}`;
  const PHOTOS = () => {
    world.files['Rio.jpg'] = {
      body: 'a photograph of Rio',
      mime: 'image/jpeg',
      w: 6000,
      h: 4000,
      licence: 'CC BY-SA 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      artist: '<a href="//commons.wikimedia.org/wiki/User:Ana">Ana Pérez</a>',
      attribution: true,
    };
    world.files['Falls.jpg'] = { body: 'a photograph of the falls', mime: 'image/jpeg', licence: 'CC0' };
    world.files['Dunes.png'] = { body: 'a photograph of the dunes', mime: 'image/png', licence: 'CC BY 4.0', artist: 'Luis' };
    world.files['Painting.jpg'] = { body: 'a painting', mime: 'image/jpeg' };
    world.leads = { 'Rio de Janeiro.jpg': 'Rio.jpg' };
    return sheets({
      BR: {
        photos: [{ file: 'Rio de Janeiro.jpg', es: 'Río' }, { file: ' Falls.jpg ' }, { file: 'Gone.jpg' }, { es: 'sin archivo' }, { file: 'Dunes.png' }, { file: 'Falls.jpg' }],
        times: [{ from: 1822, picture: { file: 'Painting.jpg' } }, { from: 1889 }],
      },
      // A sheet that names none is none to bring anything for.
      XX: { photos: [] },
    });
  };

  it('are the files that the sheets name, each as the picture that Wikimedia draws of it and with whose it is', async () => {
    const r = await run('photos', PLAIN(), { OUTSIDE_PROFILES: PHOTOS() });
    expect(r.code).toBe(0);
    expect(r.source().ok).toBe(true);
    // Each under the title Commons has it by, once, in the order the sheet names them.
    expect(r.data().items).toEqual({ BR: { photos: ['Rio.jpg', 'Falls.jpg', 'Gone.jpg', 'Dunes.png', 'Painting.jpg'] } });
    expect(r.data().asked).toBe(5);
    expect(r.data().files['Rio.jpg']).toEqual({
      sha1: sha1('a photograph of Rio'),
      bytes: Buffer.byteLength('a photograph of Rio'),
      mime: 'image/jpeg',
      w: 6000,
      h: 4000,
      licence: 'CC BY-SA 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      artist: 'Ana Pérez',
      attribution: true,
      page: 'https://commons.wikimedia.org/wiki/File:Rio.jpg',
      picture: picture('a photograph of Rio'),
    });
    expect(r.data().files['Falls.jpg']).toMatchObject({ licence: 'CC0', picture: picture('a photograph of the falls') });
    // A picture of what was kept as a PNG is one too.
    expect(r.data().files['Dunes.png']).toMatchObject({ artist: 'Luis', picture: picture('a photograph of the dunes', 'png') });
    expect(r.data().files['Painting.jpg']).toMatchObject({ licence: 'Public domain', picture: picture('a painting') });
    expect(r.data().files['Gone.jpg']).toEqual({ missing: true });
    expect(r.read(picture('a photograph of Rio'))).toBe('a picture of Rio.jpg');
    expect(r.read(picture('a painting'))).toBe('a picture of Painting.jpg');
    // What is brought is the picture, at the width it is wanted at: an original may weigh tens of megabytes.
    expect(asked.filter((q) => q.startsWith('picture ')).sort()).toEqual(['picture Dunes.png', 'picture Falls.jpg', 'picture Painting.jpg', 'picture Rio.jpg']);
    expect(asked.some((q) => q.startsWith('file '))).toBe(false);
    expect(asked.find((q) => q.startsWith('api '))).toContain('iiurlwidth=1920');
    // Wikidata is asked nothing: the sheets say it all.
    expect(asked.some((q) => q.startsWith('sparql '))).toBe(false);
    expect(r.source().note).toContain('5 fotografías de 1 fichas: 4 traídas');
    expect(r.source().note).toContain('1 que Commons no tiene');
    expect(agents.every((agent) => agent.startsWith('regionle-data/'))).toBe(true);
  });

  it('adds period images from independent timelines without losing the chosen head or fetching duplicates', async () => {
    world.files['Past.jpg'] = { body: 'a period document', mime: 'image/jpeg', licence: 'Public domain', artist: 'E. Le Deley' };
    world.files['Capital.jpg'] = { body: 'the capital', mime: 'image/jpeg', licence: 'CC0' };
    const timesFile = path.join(fresh('timelines'), 'profiles-times.json');
    fs.writeFileSync(timesFile, JSON.stringify({
      _: 'historical accounts',
      BR: { times: [{ picture: { file: 'Painting.jpg' } }, { picture: { file: ' Past.jpg ' } }] },
      ES: { times: [{ picture: { file: 'Past.jpg' } }, { picture: { file: 'Past.jpg' } }] },
      XX: { times: [{ name: 'no photo' }] },
    }));
    const headsFile = path.join(fresh('heads'), 'profiles-heads.json');
    fs.writeFileSync(headsFile, JSON.stringify({ _: 'chosen heads', ES: { file: 'Capital.jpg' }, BR: { file: 'Not Rio.jpg' } }));
    const r = await run('photos', PLAIN(), { OUTSIDE_PROFILES: PHOTOS(), OUTSIDE_HEADS: headsFile, OUTSIDE_TIMES: timesFile });
    expect(r.code).toBe(0);
    expect(r.data().items.BR.photos).toEqual(['Rio.jpg', 'Falls.jpg', 'Gone.jpg', 'Dunes.png', 'Painting.jpg', 'Past.jpg']);
    expect(r.data().items.ES.photos).toEqual(['Capital.jpg', 'Past.jpg']);
    expect(r.data().items.XX).toBeUndefined();
    expect(r.data().files['Past.jpg']).toMatchObject({ licence: 'Public domain', artist: 'E. Le Deley', picture: picture('a period document') });
    expect(asked.filter((q) => q === 'picture Past.jpg')).toHaveLength(1);
    expect(r.data().files['Not Rio.jpg']).toBeUndefined();
  });

  it('keeps what it could bring when a picture does not come, and says which did not', async () => {
    const dir = PHOTOS();
    refusals = [{ when: (q) => q === 'picture Falls.jpg', status: 404, times: 99 }];
    const r = await run('photos', PLAIN(), { OUTSIDE_PROFILES: dir });
    expect(r.source().ok).toBe(true);
    expect(r.data().files['Falls.jpg'].picture).toBeUndefined();
    expect(r.data().files['Falls.jpg'].licence).toBe('CC0');
    expect(r.data().files['Rio.jpg'].picture).toBe(picture('a photograph of Rio'));
    expect(r.source().detail?.undone).toEqual(['1 de 4 fotografías (HTTP 404 Not Found)']);
  });

  it('is left unread where no sheet names a photograph', async () => {
    const r = await run('photos', PLAIN(), { OUTSIDE_PROFILES: sheets({ XX: { photos: [] } }) });
    expect(r.source().ok).toBe(false);
    expect(asked).toEqual([]);
    // …and where there are no sheets at all.
    expect((await run('photos', PLAIN())).source().ok).toBe(false);
  });
});

describe('the photograph chosen for the head of the sheet of a country nobody has written of', () => {
  const chosen = (said: Record<string, unknown>) => {
    const file = path.join(fresh('heads'), 'profiles-heads.json');
    fs.writeFileSync(file, JSON.stringify({ _: 'what this file is', ...said }));
    return file;
  };
  const sheets = (said: Record<string, unknown>) => {
    const dir = fresh('profiles');
    for (const [id, sheet] of Object.entries(said)) fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(sheet));
    return dir;
  };

  it('is brought with the photographs of the sheets, and not for a country whose sheet names its own', async () => {
    world.files['Alhambra.jpg'] = { body: 'the Alhambra', mime: 'image/jpeg', licence: 'CC BY-SA 4.0', artist: 'Ana' };
    world.files['Rio.jpg'] = { body: 'Rio', mime: 'image/jpeg', licence: 'CC0' };
    world.files['Not Rio.jpg'] = { body: 'another', mime: 'image/jpeg', licence: 'CC0' };
    const r = await run('photos', PLAIN(), {
      OUTSIDE_PROFILES: sheets({ BR: { photos: [{ file: 'Rio.jpg' }] } }),
      OUTSIDE_HEADS: chosen({ ES: { file: ' Alhambra.jpg ', es: 'La Alhambra' }, BR: { file: 'Not Rio.jpg' }, XX: { es: 'sin archivo' } }),
    });
    expect(r.source().ok).toBe(true);
    expect(r.data().items).toEqual({ BR: { photos: ['Rio.jpg'] }, ES: { photos: ['Alhambra.jpg'] } });
    expect(r.data().files['Alhambra.jpg']).toMatchObject({ licence: 'CC BY-SA 4.0', artist: 'Ana', picture: `photos/files/${sha1('the Alhambra')}.1920.jpg` });
    expect(r.data().files['Not Rio.jpg']).toBeUndefined();
    expect(asked.filter((q) => q.startsWith('picture ')).sort()).toEqual(['picture Alhambra.jpg', 'picture Rio.jpg']);
    // The note at the head of the file is no country.
    expect(Object.keys(r.data().items)).not.toContain('_');
  });

  it('is enough to bring something where no sheet is written by hand', async () => {
    world.files['Alhambra.jpg'] = { body: 'the Alhambra', mime: 'image/jpeg', licence: 'CC BY-SA 4.0', artist: 'Ana' };
    const r = await run('photos', PLAIN(), { OUTSIDE_HEADS: chosen({ ES: { file: 'Alhambra.jpg' } }) });
    expect(r.source().ok).toBe(true);
    expect(r.data().items).toEqual({ ES: { photos: ['Alhambra.jpg'] } });
  });
});

describe('what could be shown at the head of the sheet of a country', () => {
  /** The countries of the game, each with its entity; and the list of those a photograph is to be chosen for. */
  const lands = () => game({ ES: { units: [], wd: 'Q29' }, PE: { units: [], wd: 'Q419' }, AD: { units: [], wd: 'Q228' }, ZZ: { units: [] } });
  const list = (text: string) => {
    const file = path.join(fresh('asked'), 'heads-asked.txt');
    fs.writeFileSync(file, text);
    return file;
  };
  const photo = (body: string, more: Partial<Kept> = {}): Kept => ({ body, mime: 'image/jpeg', w: 4000, h: 2500, licence: 'CC BY-SA 4.0', artist: 'Ana', ...more });
  const small = (body: string) => `heads/files/${sha1(body)}.330.jpg`;
  const SIGHTS = () => {
    world.files['Alhambra.jpg'] = photo('alhambra');
    world.files['Sagrada.jpg'] = photo('sagrada', { w: 3000, h: 4000 });
    world.files['Teide.jpg'] = photo('teide', { licence: 'CC0', artist: undefined });
    world.files['Madrid.jpg'] = photo('madrid');
    world.files['Plan.png'] = photo('plan', { mime: 'image/png' });
    world.files['Tiny.jpg'] = photo('tiny', { w: 1200, h: 800 });
    world.files['Strip.jpg'] = photo('strip', { w: 9000, h: 1500 });
    world.files['Machu Picchu.jpg'] = photo('machu');
    world.leads = { 'Alhambra de Granada.jpg': 'Alhambra.jpg' };
    world.sights = {
      Q29: [
        { kind: 'heritage', of: 'Q47476', file: 'Alhambra de Granada.jpg', links: 150, es: 'Alhambra', en: 'Alhambra' },
        // Its second picture: the first by name is the one that counts.
        { kind: 'heritage', of: 'Q47476', file: 'Zzz.jpg', links: 150, es: 'Alhambra' },
        { kind: 'heritage', of: 'Q48435', file: 'Sagrada.jpg', links: 200, es: 'Sagrada Familia', en: 'Sagrada Família' },
        { kind: 'heritage', of: 'Q5', file: 'Plan.png', links: 90 },
        { kind: 'heritage', of: 'Q6', file: 'Tiny.jpg', links: 80 },
        { kind: 'heritage', of: 'Q7', file: 'Strip.jpg', links: 70 },
        { kind: 'heritage', of: 'Q8', file: 'Gone.jpg', links: 60 },
        { kind: 'park', of: 'Q131393', file: 'Teide.jpg', links: 60, es: 'Parque nacional del Teide', en: 'Teide National Park' },
        { kind: 'capital', of: 'Q2807', file: 'Madrid.jpg', links: 300, es: 'Madrid', en: 'Madrid' },
        // What it is known by twice is a candidate once: the Teide is its highest point too.
        { kind: 'top', of: 'Q83057', file: 'Teide.jpg', links: 110, es: 'Teide', en: 'Teide' },
      ],
      Q419: [{ kind: 'heritage', of: 'Q676203', file: 'Machu Picchu.jpg', links: 180, es: 'Machu Picchu', en: 'Machu Picchu' }],
      Q228: [{ kind: 'capital', of: 'Q1863', file: 'Plan.png', links: 100, es: 'Andorra la Vieja' }],
    };
    return list('# the first lot\nES\nAD  # with a note\n\nXX\nZZ\n');
  };

  it('is what Wikidata shows the country is known by with, the best known of each kind first, with a small picture of each', async () => {
    const r = await run('heads', lands(), { OUTSIDE_HEADS_ASKED: SIGHTS() });
    expect(r.code).toBe(0);
    expect(r.source().ok).toBe(true);
    // Only the countries that are named, and of them only those the game has with an entity.
    expect(Object.keys(r.data().items).sort()).toEqual(['AD', 'ES']);
    expect(r.data().asked).toBe(2);
    expect((r.data().items.ES as unknown as { sights: unknown[] }).sights).toEqual([
      { file: 'Alhambra.jpg', kind: 'heritage', of: 'Q47476', links: 150, es: 'Alhambra', en: 'Alhambra' },
      { file: 'Teide.jpg', kind: 'park', of: 'Q131393', links: 60, es: 'Parque nacional del Teide', en: 'Teide National Park' },
      { file: 'Madrid.jpg', kind: 'capital', of: 'Q2807', links: 300, es: 'Madrid', en: 'Madrid' },
    ]);
    // What is taller than wide, no photograph, too small or a strip does not fit the head of a sheet; a country may be left with nothing.
    expect((r.data().items.AD as unknown as { sights: unknown[] }).sights).toEqual([]);
    expect(Object.keys(r.data().files).sort()).toEqual(['Alhambra.jpg', 'Madrid.jpg', 'Teide.jpg']);
    expect(r.data().files['Alhambra.jpg']).toMatchObject({ sha1: sha1('alhambra'), w: 4000, h: 2500, mime: 'image/jpeg', licence: 'CC BY-SA 4.0', artist: 'Ana', picture: small('alhambra') });
    expect(r.read(small('alhambra'))).toBe('a picture of Alhambra.jpg');
    expect(asked.filter((q) => q.startsWith('picture ')).sort()).toEqual(['picture Alhambra.jpg', 'picture Madrid.jpg', 'picture Teide.jpg']);
    // The pictures are asked for small, and no original is.
    expect(asked.find((q) => q.startsWith('api '))).toContain('iiurlwidth=330');
    expect(asked.some((q) => q.startsWith('file '))).toBe(false);
    // Five things are asked of Wikidata, and of none of them about a country that was not named.
    const queries = asked.filter((q) => q.startsWith('sparql '));
    expect(queries).toHaveLength(5);
    expect(queries.every((q) => q.includes('wd:Q29') && q.includes('wd:Q228') && !q.includes('wd:Q419'))).toBe(true);
    expect(r.source().note).toContain('3 candidatas para 1 de 2 países: 3 imágenes traídas');
    expect(r.source().note).toContain('sin ninguna: AD');
    expect(r.source().detail).toMatchObject({ asked: 2, found: 1, none: ['AD'], kinds: { capital: 1, heritage: 1, park: 1 } });
  });

  it('keeps no more of a kind than it says, nor more than ten of a country', async () => {
    const dir = lands();
    world.sights = { Q419: [] };
    for (let i = 0; i < 20; i++) {
      world.files[`H${i}.jpg`] = photo(`h${i}`);
      world.sights.Q419.push({ kind: 'heritage', of: `Q${1000 + i}`, file: `H${i}.jpg`, links: 100 - i });
    }
    for (const kind of ['park', 'sight'] as const)
      for (let i = 0; i < 5; i++) {
        world.files[`${kind}${i}.jpg`] = photo(`${kind}${i}`);
        world.sights.Q419.push({ kind, of: `Q${kind === 'park' ? 2000 + i : 3000 + i}`, file: `${kind}${i}.jpg`, links: 50 - i });
      }
    const r = await run('heads', dir, { OUTSIDE_HEADS_ASKED: list('PE\n') });
    const sights = (r.data().items.PE as unknown as { sights: { file: string; kind: string }[] }).sights;
    expect(sights.map((s) => s.file)).toEqual(['H0.jpg', 'H1.jpg', 'H2.jpg', 'H3.jpg', 'H4.jpg', 'H5.jpg', 'park0.jpg', 'park1.jpg', 'sight0.jpg', 'sight1.jpg']);
  });

  it('keeps the candidates whose picture did not come, without one, and says so', async () => {
    const asking = SIGHTS();
    refusals = [{ when: (q) => q === 'picture Teide.jpg', status: 404, times: 99 }];
    const r = await run('heads', lands(), { OUTSIDE_HEADS_ASKED: asking });
    expect(r.source().ok).toBe(true);
    expect(r.data().files['Teide.jpg'].picture).toBeUndefined();
    expect(r.data().files['Alhambra.jpg'].picture).toBe(small('alhambra'));
    expect(r.source().detail?.undone).toEqual(['1 de 3 imágenes (HTTP 404 Not Found)']);
  });

  it('goes on without a kind that Wikidata does not answer about, but not without the first', async () => {
    const asking = SIGHTS();
    refusals = [{ when: (q) => q.startsWith('sparql ') && q.includes('wdt:P36'), status: 500, times: 99 }];
    const r = await run('heads', lands(), { OUTSIDE_HEADS_ASKED: asking });
    expect(r.source().ok).toBe(true);
    expect((r.data().items.ES as unknown as { sights: { kind: string }[] }).sights.map((s) => s.kind)).toEqual(['heritage', 'park']);
    expect(r.source().detail?.undone.join(' ')).toContain('capital');
    refusals = [{ when: (q) => q.startsWith('sparql ') && q.includes('wdt:P1435'), status: 500, times: 99 }];
    expect((await run('heads', lands(), { OUTSIDE_HEADS_ASKED: asking })).source().ok).toBe(false);
  });

  it('looks in Commons for what the list says to look for by its words: among the pictures judged best, and among the others while those are few', async () => {
    const dir = lands();
    const FEATURED = (words: string) => `${words} incategory:"Featured pictures on Wikimedia Commons" filetype:bitmap filew:>1279`;
    const QUALITY = (words: string) => `${words} incategory:"Quality images" filetype:bitmap filew:>1279`;
    const ANY = (words: string) => `${words} filetype:bitmap filew:>1279`;
    for (const name of ['M1', 'M2', 'M3', 'M4', 'M5', 'Q1', 'Tall', 'N1', 'N2', 'N3']) world.files[`${name}.jpg`] = photo(name.toLowerCase(), name === 'Tall' ? { w: 2000, h: 3000 } : {});
    world.files['Machu Picchu.jpg'] = photo('machu');
    world.sights = { Q419: [{ kind: 'heritage', of: 'Q676203', file: 'Machu Picchu.jpg', links: 180, es: 'Machu Picchu' }] };
    world.sought = {
      // Enough among the best: the next ones are not looked at. What Wikidata showed already is not a candidate twice, nor what does not fit.
      [FEATURED('Machu Picchu')]: ['M1.jpg', 'Machu Picchu.jpg', 'Tall.jpg', 'M2.jpg', 'M3.jpg', 'M4.jpg', 'M5.jpg'],
      [QUALITY('Machu Picchu')]: ['Q1.jpg'],
      // Few among the best: the next ones are looked at too, and after them all the others.
      [FEATURED('Nazca lines')]: ['N1.jpg'],
      [QUALITY('Nazca lines')]: ['N2.jpg', 'N1.jpg', 'N3.jpg'],
      [ANY('Nazca lines')]: ['N3.jpg', 'Q1.jpg'],
    };
    const r = await run('heads', dir, { OUTSIDE_HEADS_ASKED: list('PE: Machu Picchu\nPE:  Nazca   lines # the lines\nPE: Nothing such\nAD\n') });
    expect(r.source().ok).toBe(true);
    const sights = (r.data().items.PE as unknown as { sights: Record<string, unknown>[] }).sights;
    expect(sights).toEqual([
      { file: 'Machu Picchu.jpg', kind: 'heritage', of: 'Q676203', links: 180, es: 'Machu Picchu' },
      { file: 'M1.jpg', kind: 'sought', words: 'Machu Picchu', among: 'featured' },
      { file: 'M2.jpg', kind: 'sought', words: 'Machu Picchu', among: 'featured' },
      { file: 'M3.jpg', kind: 'sought', words: 'Machu Picchu', among: 'featured' },
      { file: 'M4.jpg', kind: 'sought', words: 'Machu Picchu', among: 'featured' },
      { file: 'M5.jpg', kind: 'sought', words: 'Machu Picchu', among: 'featured' },
      { file: 'N1.jpg', kind: 'sought', words: 'Nazca lines', among: 'featured' },
      { file: 'N2.jpg', kind: 'sought', words: 'Nazca lines', among: 'quality' },
      { file: 'N3.jpg', kind: 'sought', words: 'Nazca lines', among: 'quality' },
      { file: 'Q1.jpg', kind: 'sought', words: 'Nazca lines', among: 'any' },
    ]);
    // Each is brought small, as the others are, and with whose it is.
    expect(r.data().files['M1.jpg']).toMatchObject({ sha1: sha1('m1'), licence: 'CC BY-SA 4.0', artist: 'Ana', picture: small('m1') });
    expect(r.read(small('n3'))).toBe('a picture of N3.jpg');
    const searches = asked.filter((q) => q.startsWith('api ') && q.includes('generator=search')).map((q) => new URLSearchParams(q.slice(4)).get('gsrsearch'));
    expect(searches).toEqual([FEATURED('Machu Picchu'), FEATURED('Nazca lines'), QUALITY('Nazca lines'), ANY('Nazca lines'), FEATURED('Nothing such'), QUALITY('Nothing such'), ANY('Nothing such')]);
    expect(r.source().note).toContain('3 cosas buscadas en Commons por su nombre');
    // A country that is only named has what Wikidata shows of it, which here is nothing.
    expect((r.data().items.AD as unknown as { sights: unknown[] }).sights).toEqual([]);
  });

  it('is left unread where no country is named', async () => {
    SIGHTS();
    expect((await run('heads', lands())).source().ok).toBe(false);
    expect((await run('heads', lands(), { OUTSIDE_HEADS_ASKED: list('# nobody yet\nXX\n') })).source().ok).toBe(false);
    expect(asked).toEqual([]);
  });
});

describe('the coat of arms of each country', () => {
  const lands = () => game({ ES: { units: [], wd: 'Q29' }, FR: { units: [], wd: 'Q142' }, JP: { units: [], wd: 'Q17' }, TR: { units: [], wd: 'Q43' }, ZZ: { units: [] } });
  const small = (body: string, kind = 'png') => `arms/files/${sha1(body)}.330.${kind}`;
  const fixes = (said: Record<string, unknown>) => {
    const file = path.join(fresh('fixes'), 'profiles-fixes.json');
    fs.writeFileSync(file, JSON.stringify({ _: 'why this file is here', ...said }));
    return file;
  };
  const ARMS = () => {
    world.files['Escudo de España.svg'] = { body: 'the arms of Spain', w: 600, h: 620, licence: 'CC BY-SA 3.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0', artist: '<a href="//commons.wikimedia.org/wiki/User:Heralder">Heralder</a>', attribution: true };
    world.files['Arms A.svg'] = { body: 'arms a' };
    world.files['Arms B.svg'] = { body: 'arms b', licence: 'CC0' };
    world.files['Kamon.jpg'] = { body: 'a kamon', mime: 'image/jpeg', licence: 'CC BY 4.0', artist: 'Somebody' };
    world.files['Emblem FR.svg'] = { body: 'an emblem', licence: 'CC BY-SA 4.0', artist: 'Ana' };
    world.files['Seal TR.svg'] = { body: 'a seal' };
    world.leads = { 'Old name of the kamon.jpg': 'Kamon.jpg' };
    world.arms = { Q29: ['Escudo de España.svg'], Q142: ['Arms B.svg', 'Arms_A.svg'], Q17: ['Old name of the kamon.jpg'] };
    return lands();
  };

  it('is the file Wikidata shows each with, with a picture of each as Wikimedia draws it and with whose it is', async () => {
    const r = await run('arms', ARMS());
    expect(r.code).toBe(0);
    expect(r.source().ok).toBe(true);
    // Each under the title Commons has it by, in order of name; a country with none is not listed, nor one with no entity.
    expect(r.data().items).toEqual({ ES: { files: ['Escudo de España.svg'] }, FR: { files: ['Arms A.svg', 'Arms B.svg'] }, JP: { files: ['Kamon.jpg'] } });
    expect(r.data().asked).toBe(4);
    expect(r.data().files['Escudo de España.svg']).toEqual({
      sha1: sha1('the arms of Spain'),
      bytes: Buffer.byteLength('the arms of Spain'),
      mime: 'image/svg+xml',
      w: 600,
      h: 620,
      licence: 'CC BY-SA 3.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
      artist: 'Heralder',
      attribution: true,
      page: 'https://commons.wikimedia.org/wiki/File:Escudo%20de%20Espa%C3%B1a.svg',
      picture: small('the arms of Spain'),
    });
    expect(Object.keys(r.data().files).sort()).toEqual(['Arms A.svg', 'Arms B.svg', 'Escudo de España.svg', 'Kamon.jpg']);
    // The picture of a drawing is a PNG; that of a photograph, a photograph.
    expect(r.data().files['Kamon.jpg']).toMatchObject({ licence: 'CC BY 4.0', artist: 'Somebody', picture: small('a kamon', 'jpg') });
    expect(r.read(small('the arms of Spain'))).toBe('a picture of Escudo de España.svg');
    // What is brought is the picture, small: the drawing itself is not.
    expect(asked.filter((q) => q.startsWith('picture ')).sort()).toEqual(['picture Arms A.svg', 'picture Arms B.svg', 'picture Escudo de España.svg', 'picture Kamon.jpg']);
    expect(asked.some((q) => q.startsWith('file '))).toBe(false);
    expect(asked.find((q) => q.startsWith('api '))).toContain('iiurlwidth=330');
    const queries = asked.filter((q) => q.startsWith('sparql '));
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('p:P94');
    expect(r.source().note).toContain('escudo de 3 de 4 países: 4 imágenes traídas');
    expect(r.source().note).toContain('1 países con más de uno');
    expect(r.source().detail).toMatchObject({ asked: 4, found: 3, files: { all: 4, missing: 0, brought: 4, left: 0 } });
    expect(agents.every((agent) => agent.startsWith('regionle-data/'))).toBe(true);
  });

  it('brings the one that somebody chose by hand for a country too, whatever Wikidata names', async () => {
    const dir = ARMS();
    const r = await run('arms', dir, {
      OUTSIDE_PROFILE_FIXES: fixes({
        FR: { motto: null, arms: { file: ' Emblem FR.svg ', kind: 'emblem' } },
        TR: { arms: { file: 'Seal TR.svg' } },
        // What says nothing of a file names none; and what is no country of the game is not asked about.
        ES: { arms: { kind: 'emblem' } },
        JP: { arms: null },
        XX: { arms: { file: 'Arms of nowhere.svg' } },
        ZZ: { arms: { file: 'Arms of nowhere.svg' } },
      }),
    });
    expect(r.source().ok).toBe(true);
    expect(r.data().items).toEqual({
      ES: { files: ['Escudo de España.svg'] },
      FR: { files: ['Arms A.svg', 'Arms B.svg'], chosen: 'Emblem FR.svg' },
      JP: { files: ['Kamon.jpg'] },
      TR: { chosen: 'Seal TR.svg' },
    });
    expect(r.data().files['Emblem FR.svg']).toMatchObject({ licence: 'CC BY-SA 4.0', artist: 'Ana', picture: small('an emblem') });
    expect(r.data().files['Seal TR.svg'].picture).toBe(small('a seal'));
    expect(r.data().files['Arms of nowhere.svg']).toBeUndefined();
    expect(r.source().note).toContain('escudo de 4 de 4 países: 6 imágenes traídas');
  });

  it('says so of a file Commons does not have, and of a picture that does not come', async () => {
    const dir = ARMS();
    world.arms!.Q43 = ['Gone.svg'];
    refusals = [{ when: (q) => q === 'picture Arms B.svg', status: 404, times: 99 }];
    const r = await run('arms', dir);
    expect(r.source().ok).toBe(true);
    expect(r.data().items.TR).toEqual({ files: ['Gone.svg'] });
    expect(r.data().files['Gone.svg']).toEqual({ missing: true });
    expect(r.data().files['Arms B.svg'].picture).toBeUndefined();
    expect(r.data().files['Arms B.svg'].licence).toBe('CC0');
    expect(r.data().files['Arms A.svg'].picture).toBe(small('arms a'));
    expect(r.source().note).toContain('1 que Commons no tiene');
    expect(r.source().detail?.undone).toEqual(['1 de 4 imágenes (HTTP 404 Not Found)']);
  });

  it('is left unread when Wikidata names the coat of arms of no country', async () => {
    const r = await run('arms', lands());
    expect(r.source().ok).toBe(false);
    expect(asked.filter((q) => !q.startsWith('sparql '))).toEqual([]);
  });
});

describe('what has a flag and is well known', () => {
  const KNOWN = () => {
    world.flags = {
      Q10: [{ file: 'Flag of Aa.svg' }],
      Q100: [{ file: 'Flag of Gone.svg', from: '1950-01-01', to: '1990-12-26' }, { file: 'Flag of Gone, older.svg', to: '?', rank: 'Deprecated' }],
      Q200: [{ file: 'Flag of the Union.svg', rank: 'Preferred' }],
      Q300: [{ file: 'Flag of Few.svg' }],
      Q1: [{ file: 'Flag of Uno.svg' }],
      Q7: [{ file: 'Flag of a City.svg' }],
    };
    world.known = {
      Q10: { links: 300, es: 'Aa', en: 'Aa', is: ['Q6256'] },
      Q100: { links: 120, es: 'Ido', en: 'Gone', is: ['Q3024240', 'Q6256'], born: ['1920-05-01', '1918-01-01'], died: ['1990-12-26', '1991-01-01'], in: ['Q10'] },
      Q200: { links: 80, en: 'The Union', is: ['Q484652'], born: ['-0026-01-01'] },
      Q300: { links: 12, en: 'Few write about it' },
      Q1: { links: 50, en: 'Uno', in: ['Q10'] },
      Q7: { links: 45, en: 'A city' },
      // A class is known by its English name.
      Q6256: { links: 0, en: 'country' },
      Q3024240: { links: 0, en: 'historical country' },
      Q484652: { links: 0, en: 'international organization' },
    };
    return game({ AA: { units: [{ id: 'AA-01', wd: 'Q1' }, { id: 'AA-02', wd: 'Q2' }], wd: 'Q10' } }, { AA: [{ i: 'c1', wd: 'Q7' }] });
  };

  it('is told with its names, what it is, where, when, its flags and whether the game has it', async () => {
    const r = await run('flags-candidates', KNOWN(), { OUTSIDE_CANDIDATE_LINKS: '40' });
    expect(r.code).toBe(0);
    const data = r.data() as unknown as { links: number; items: Record<string, unknown>; classes: Record<string, string> };
    expect(data.links).toBe(40);
    expect(data.items).toEqual({
      // What the game has is told as what it has it as, and nothing more is asked of it.
      Q1: { links: 50, game: 'piece' },
      Q7: { links: 45, game: 'city' },
      Q10: { links: 300, game: 'country' },
      // The first year it says it began, and the last it says it ended.
      Q100: { links: 120, es: 'Ido', en: 'Gone', is: ['Q6256', 'Q3024240'], in: ['Q10'], from: 1918, to: 1991, flags: [{ file: 'Flag of Gone, older.svg', rank: 'deprecated', to: '?' }, { file: 'Flag of Gone.svg', from: '1950-01-01', to: '1990-12-26' }] },
      Q200: { links: 80, en: 'The Union', is: ['Q484652'], from: -26, flags: [{ file: 'Flag of the Union.svg', rank: 'preferred' }] },
    });
    expect(data.classes).toEqual({ Q6256: 'country', Q3024240: 'historical country', Q484652: 'international organization' });
    expect(asked.filter((q) => q.includes('wdt:P31 ')).flatMap(ids)).toEqual(['Q100', 'Q200']);
    // No file is asked about, and none is brought.
    expect(asked.some((q) => q.startsWith('api ') || q.startsWith('file '))).toBe(false);
    expect(r.kept()).toEqual([]);
    expect(r.source().note).toContain('5 cosas con bandera');
    expect(r.source().note).toContain('3 ya están en el juego');
  });

  it('keeps what it learnt when a question about them has no answer, and says which', async () => {
    refusals = [{ when: (q) => q.includes('wdt:P17 '), status: 403, times: 99 }];
    const r = await run('flags-candidates', KNOWN());
    expect(r.code).toBe(0);
    expect((r.data().items.Q100 as unknown as { in?: string[] }).in).toBeUndefined();
    expect((r.data().items.Q100 as unknown as { to?: number }).to).toBe(1991);
    expect(r.source().detail?.undone).toEqual(['en qué país está cada cosa (HTTP 403 Forbidden)']);
  });

  it('is left unread when the question it starts from has no answer', async () => {
    refusals = [{ when: (q) => q.includes('wikibase:sitelinks'), status: 500, times: 99 }];
    const r = await run('flags-candidates', KNOWN());
    expect(r.source().ok).toBe(false);
  });
});

describe('the time there is for a whole run', () => {
  it('brings the sources in the order they are asked for', async () => {
    world.files['ICS Alfa.svg'] = { body: svg('a') };
    const file = path.join(fresh('signals'), 'signals.json');
    fs.writeFileSync(file, JSON.stringify({ signals: { a: { file: 'ICS Alfa.svg' } } }));
    const r = await run('flags-signals,flags-regions', PLAIN(), { OUTSIDE_FLAG_SIGNALS: file });
    expect((JSON.parse(r.read('estado.json')) as { sources: { id: string }[] }).sources.map((one) => one.id)).toEqual(['flags-signals', 'flags-regions']);
  });

  it('leaves what a source can do without for another run once it is over', async () => {
    const data = PLAIN();
    delete world.flags.Q2;
    const r = await run('flags-regions', data, { OUTSIDE_TOTAL: '0' });
    expect(r.code).toBe(0);
    // What it cannot do without is there: which flag each thing flies, and what Commons says of its file.
    expect(Object.keys(r.data().items)).toEqual(['AA-01', 'AA-03', 'AA-04']);
    expect(r.data().files['Flag of Uno.svg'].sha1).toBe(sha1(svg('Uno')));
    expect(r.kept()).toEqual([]);
    expect(r.source().detail?.files).toMatchObject({ wanted: 3, brought: 0, left: 3 });
    expect(r.source().detail?.undone).toContain('las fichas de Wikipedia (no quedaba tiempo)');
  });
});

describe('the lists of the repository', () => {
  it('names the sources of flags, which say what their files hold', () => {
    const script = fs.readFileSync(path.join(ROOT, 'scripts/data/outside.mjs'), 'utf8');
    for (const id of Object.keys(FILE)) expect(script).toContain(`id: '${id}'`);
  });

  it('gives flags by hand to sources that exist, each to a thing of the game, by a file with a name and with its reason', () => {
    const hand = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/data/flags-hand.json'), 'utf8')) as Record<string, Record<string, { file: string; why: string }>>;
    // The sources that take a flag by hand: those of the maps, and that of the lists.
    expect(Object.keys(hand).sort()).toEqual(['flags-capitals', 'flags-listed', 'flags-regions']);
    const lists = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/data/flags-lists.json'), 'utf8')) as Record<string, Record<string, unknown>>;
    const listed = new Set(Object.values(lists).flatMap((list) => Object.keys(list)));
    for (const id of Object.keys(hand['flags-listed'])) expect(listed, id).toContain(id);
    const cities = (JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/cities.json'), 'utf8')) as { c: Record<string, { i: string; k?: number }[]> }).c;
    const capitals = new Set(Object.values(cities).flat().filter((c) => (c.k ?? 0) >= 2).map((c) => c.i));
    for (const id of Object.keys(hand['flags-capitals'])) expect(capitals, id).toContain(id);
    for (const id of Object.keys(hand['flags-regions'])) {
      const file = path.join(ROOT, 'public/data/r', `${id.slice(0, 2)}.json`);
      expect(fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(`"id":"${id}"`), id).toBe(true);
    }
    for (const one of Object.values(hand).flatMap((by) => Object.values(by))) {
      expect(Object.keys(one)).toEqual(['file', 'why']);
      expect(one.file).toMatch(/^\S.*\.(svg|png|gif|jpe?g)$/i);
      expect(one.why.length).toBeGreaterThan(10);
    }
  });

  it('names the pictures that are wanted one to a line', () => {
    const lines = fs.readFileSync(path.join(ROOT, 'scripts/data/flags-pictures.txt'), 'utf8').split('\n').filter((line) => line && !line.startsWith('#'));
    expect(new Set(lines).size).toBe(lines.length);
    for (const line of lines) expect(line).toBe(line.trim());
  });
});
