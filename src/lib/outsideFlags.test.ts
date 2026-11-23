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
}
/** A way of not answering: this status for what matches, the first `times` of it. */
interface Refusal {
  when: (asked: string) => boolean;
  status: number;
  times: number;
}

let world: World;
let refusals: Refusal[] = [];
/** What was asked, in order: `sparql <query>`, `api <form>`, `file <title>`, `picture <title>`, `branch <path>`. */
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

function answer(query: string): Record<string, unknown>[] {
  if (query.includes('p:P41') && query.includes('wdt:P300'))
    return [...query.matchAll(/"([A-Z]{2}-[A-Z0-9]+)"/g)].flatMap(([, code]) => (world.codes[code] ?? []).flatMap((id) => rows(id, { code: text(code) })));
  if (query.includes('p:P41')) return ids(query).flatMap((id) => rows(id));
  if (query.includes('owl:sameAs')) return ids(query).flatMap((id) => (world.moved[id] ? [{ item: uri(id), to: uri(world.moved[id]) }] : []));
  if (query.includes('p:P2046')) return ids(query).flatMap((id) => (world.areas[id] ?? []).map((km2) => ({ item: uri(id), m2: text(km2 * 1e6) })));
  throw new Error(`A question the stand-in does not know: ${query}`);
}

/** What Commons says of the files it is asked about. */
function commons(form: URLSearchParams): Record<string, unknown> {
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
      const said = place === 'sparql' ? `sparql ${form.get('query') ?? ''}` : place === 'api' ? `api ${body}` : `${place} ${what}`;
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
        if (place === 'file' && world.files[what]) return void res.writeHead(200).end(world.files[what].body);
        if (place === 'picture' && world.files[what]) return void res.writeHead(200).end(`a picture of ${what}`);
        if (place === 'branch' && world.branch[what] !== undefined) return void res.writeHead(200).end(world.branch[what]);
        res.writeHead(404).end('not here');
      } catch (err) {
        res.writeHead(400).end(String(err));
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
function game(countries: Record<string, { units: Unit[]; groups?: Unit[] }>, cities: Record<string, { i: string; k?: number; wd?: string }[]> = {}) {
  const dir = fresh('maps');
  fs.mkdirSync(path.join(dir, 'r'));
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ countries: Object.keys(countries).map((id) => ({ id })) }));
  const pieces = (list: Unit[]) => ({ geometries: list.map((u) => ({ type: 'Polygon', id: u.id, properties: { n: { es: u.id }, ...(u.wd ? { wd: u.wd } : {}), ar: u.ar ?? 100 } })) });
  for (const [id, c] of Object.entries(countries)) fs.writeFileSync(path.join(dir, 'r', `${id}.json`), JSON.stringify({ type: 'Topology', objects: { ...(c.groups ? { g1: pieces(c.groups) } : {}), f: pieces(c.units) } }));
  fs.writeFileSync(path.join(dir, 'cities.json'), JSON.stringify({ v: 1, c: cities }));
  return dir;
}

interface Item {
  wd?: string;
  by?: string;
  file: string;
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

const FILE: Record<string, string> = { 'flags-regions': 'flags/regions.json', 'flags-capitals': 'flags/capitals.json' };

/** Runs the script. It gets no variable of the machine but the ones named here. */
function run(source: string, data: string, env: Record<string, string> = {}, out = fresh('out')): Promise<Result> {
  return new Promise((done) => {
    // No wait between downloads, and no list of pictures or of flags given by hand but the one a test writes.
    const none = path.join(TMP, 'no-list');
    const vars = { PATH: process.env.PATH ?? '', OUTSIDE_WDQS: `${base}/sparql`, OUTSIDE_COMMONS: `${base}/api`, OUTSIDE_KEPT: `${base}/branch`, OUTSIDE_PAUSE: '0', OUTSIDE_FLAG_GAP: '0', OUTSIDE_FLAG_PICTURES: none, OUTSIDE_FLAG_HAND: none, ...env };
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
  world = { flags: {}, moved: {}, codes: {}, areas: {}, files: {}, leads: {}, branch: {} };
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

  it('tells which categories of Commons say that a file is not a flag that flies', async () => {
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
    expect(asked.filter((q) => q.startsWith('branch '))).toEqual(['branch flags/regions.json', 'branch flags/capitals.json']);
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

describe('the lists of the repository', () => {
  it('names the sources of flags, which say what their files hold', () => {
    const script = fs.readFileSync(path.join(ROOT, 'scripts/data/outside.mjs'), 'utf8');
    for (const id of Object.keys(FILE)) expect(script).toContain(`id: '${id}'`);
  });

  it('gives flags by hand to sources that exist, each to a thing of the game, by a file with a name and with its reason', () => {
    const hand = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/data/flags-hand.json'), 'utf8')) as Record<string, Record<string, { file: string; why: string }>>;
    expect(Object.keys(hand).sort()).toEqual(Object.keys(FILE).sort());
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
