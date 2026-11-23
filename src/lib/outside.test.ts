// The script that brings the data kept outside GitHub (scripts/data/outside.mjs), run for real: against
// a stand-in for Wikidata's query service, which answers what each test says the world is like, and with a
// few maps made up for the occasion. Nothing here leaves the machine.

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
const SOURCE = 'wikidata-region-population';

/* ------------------------------------------------------------------ the stand-in for Wikidata */

type Figure = [people: number, day: string | null];
/** What Wikidata would know. Names are looked up as "country name@language". */
interface World {
  figures: Record<string, Figure[]>;
  moved: Record<string, string>;
  /** What took the place of an entity, and of how many entities that one took it. */
  heirs: Record<string, [to: string, replaced: number][]>;
  codes: Record<string, string[]>;
  /** The entities that say the country is theirs, or that they are in it. */
  names: Record<string, string[]>;
  /** Those that are in something that is in the country. */
  deep: Record<string, string[]>;
  /** What an entity says it is in: its country and what it is a part of. */
  places: Record<string, string[]>;
  /** In km². */
  areas: Record<string, number[]>;
  labels: Record<string, string>;
}
/** A way of not answering: this status for the questions that match, the first `times` of them. */
interface Refusal {
  when: (query: string) => boolean;
  status: number;
  times: number;
  header?: Record<string, string>;
  /** How long it takes to say no, in ms: a service that was working on the answer and gave up. */
  after?: number;
}

let world: World;
let refusals: Refusal[] = [];
let asked: string[] = [];
let agents: string[] = [];
let wdqs = '';
let server: http.Server;

const uri = (id: string) => ({ type: 'uri', value: `http://www.wikidata.org/entity/${id}` });
const text = (value: string | number) => ({ type: 'literal', value: String(value) });
const ids = (query: string) => [...query.matchAll(/wd:(Q\d+)/g)].map((m) => m[1]);

function answer(query: string): Record<string, unknown>[] {
  if (query.includes('p:P1082'))
    return ids(query).flatMap((id) => (world.figures[id] ?? []).map(([people, day]) => ({ item: uri(id), pop: text(people), ...(day ? { date: text(`${day}T00:00:00Z`) } : {}) })));
  if (query.includes('owl:sameAs')) return ids(query).flatMap((id) => (world.moved[id] ? [{ item: uri(id), to: uri(world.moved[id]) }] : []));
  if (query.includes('wdt:P1366')) return ids(query).flatMap((id) => (world.heirs[id] ?? []).map(([to, n]) => ({ item: uri(id), to: uri(to), n: text(n) })));
  if (query.includes('wdt:P300'))
    return [...query.matchAll(/"([A-Z]{2}-[A-Z0-9]+)"/g)].flatMap(([, code]) => (world.codes[code] ?? []).map((id) => ({ code: text(code), item: uri(id) })));
  if (query.includes('?called')) {
    const known = query.includes('?mid') ? world.deep : world.names;
    return [...query.matchAll(/\("([^"]+)" wd:(Q\d+) "([^"]*)"@(\w+)\)/g)].flatMap(([, key, country, name, lang]) =>
      (known[`${country} ${name}@${lang}`] ?? []).map((id) => ({ key: text(key), item: uri(id) })),
    );
  }
  if (query.includes('?within ?in')) return ids(query).flatMap((id) => (world.places[id] ?? []).map((place) => ({ item: uri(id), in: uri(place) })));
  if (query.includes('p:P2046')) return ids(query).flatMap((id) => (world.areas[id] ?? []).map((km2) => ({ item: uri(id), m2: text(km2 * 1e6) })));
  if (query.includes('rdfs:label ?label')) return ids(query).flatMap((id) => (world.labels[id] ? [{ item: uri(id), label: text(world.labels[id]) }] : []));
  throw new Error(`A question the stand-in does not know: ${query}`);
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const query = new URLSearchParams(body).get('query') ?? '';
      asked.push(query);
      agents.push(String(req.headers['user-agent']));
      const refusal = refusals.find((r) => r.times > 0 && r.when(query));
      if (refusal) {
        refusal.times--;
        setTimeout(() => res.writeHead(refusal.status, refusal.header).end('no'), refusal.after ?? 0);
        return;
      }
      try {
        const bindings = answer(query);
        res.writeHead(200, { 'Content-Type': 'application/sparql-results+json' }).end(JSON.stringify({ results: { bindings } }));
      } catch (err) {
        res.writeHead(400).end(String(err));
      }
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  wdqs = `http://127.0.0.1:${(server.address() as AddressInfo).port}/sparql`;
});
afterAll(() => new Promise((done) => server.close(done)));

/* ------------------------------------------------------------------ the maps and the run */

interface Unit {
  id: string;
  es: string;
  en?: string;
  wd?: string;
  ar?: number;
}
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;
const fresh = (name: string) => {
  const dir = path.join(TMP, `${name}-${++n}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/** Maps like those of the game: an index of countries and a file of divisions for each. */
function maps(countries: Record<string, { wd?: string; sov?: string; units: Unit[] }>) {
  const dir = fresh('maps');
  fs.mkdirSync(path.join(dir, 'r'));
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ countries: Object.entries(countries).map(([id, c]) => ({ id, ...(c.wd ? { wd: c.wd } : {}), ...(c.sov ? { sov: c.sov } : {}) })) }));
  for (const [id, c] of Object.entries(countries)) {
    const geometries = c.units.map((u) => ({ type: 'Polygon', id: u.id, properties: { n: { es: u.es, ...(u.en ? { en: u.en } : {}) }, ...(u.wd ? { wd: u.wd } : {}), ar: u.ar ?? 100 } }));
    // A level of groups above the finest one: its pieces are sums of divisions and are never asked about.
    const groups = [{ type: 'Polygon', id: `${id}-G`, properties: { n: { es: 'Grupo' }, wd: 'Q999' } }];
    fs.writeFileSync(path.join(dir, 'r', `${id}.json`), JSON.stringify({ type: 'Topology', objects: { g1: { geometries: groups }, f: { geometries } } }));
  }
  return dir;
}

interface Result {
  code: number;
  out: string;
  err: string;
  dir: string;
  /** The data file, when the run wrote it. */
  file: string | null;
  data: () => { asked: number; items: Record<string, { wd: string; by?: string; name?: string; km2?: number; abroad?: true; pop: Figure[] }>; [key: string]: unknown };
  report: () => {
    from: string | null;
    workflow: 'same' | 'behind' | 'absent';
    sources: { id: string; ok: boolean; note?: string; error?: string; blob?: string; bytes?: number; detail?: { divisions: number; found: number; by: Record<string, number>; abroad: number; proposed: Record<string, number>; refused: Record<string, number>; undone: string[]; unnamed: string[] } }[];
    reach: unknown[];
  };
}

/** Runs the script. It gets no variable of the machine but the ones named here: on GitHub it would write in the summary of the run that tests it. */
function run(args: string[], { env = {}, out = fresh('out'), script = 'scripts/data/outside.mjs' }: { env?: Record<string, string>; out?: string; script?: string } = {}): Promise<Result> {
  return new Promise((done) => {
    execFile('node', [script, '--out', out, ...args], { cwd: ROOT, env: { PATH: process.env.PATH ?? '', OUTSIDE_WDQS: wdqs, OUTSIDE_PAUSE: '0', ...env } }, (error, stdout, stderr) => {
      const file = path.join(out, 'wikidata/region-population.json');
      done({
        code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
        out: stdout,
        err: stderr,
        dir: out,
        file: fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null,
        data: () => JSON.parse(fs.readFileSync(file, 'utf8')),
        report: () => JSON.parse(fs.readFileSync(path.join(out, 'estado.json'), 'utf8')),
      });
    });
  });
}

/**
 * A country (AA) with a division for each thing that can happen to one, a country of a single piece (BB), a
 * territory (CC) that depends on another country (EE), and a country the index has no id of (DD).
 */
const GAME = () =>
  maps({
    AA: {
      wd: 'Q100',
      units: [
        { id: 'AA-01', es: 'Uno', wd: 'Q1' }, // its own entity has figures
        { id: 'AA-02', es: 'Dos', wd: 'Q2' }, // its id was merged into another
        { id: 'AA-03', es: 'Tres', wd: 'Q3' }, // one entity took its place, and only its place
        { id: 'AA-04', es: 'Cuatro', wd: 'Q4' }, // two entities took its place: it was split
        { id: 'AA-05', es: 'Cinco', wd: 'Q5' }, // what took its place also took another's: it was merged
        { id: 'AA-06', es: 'Seis', wd: 'Q6' }, // what took its place is four times its size
        { id: 'AA-07', es: 'Siete' }, // no id: one entity carries its code
        { id: 'AA-08', es: 'Ocho' }, // no id: the entity with its code is of another size; one with its name is not
        { id: 'AA-09', es: 'Nueve' }, // no id: two entities carry its code
        { id: 'AA-x10', es: 'Diez' }, // no id: two entities of its size go by its name
        { id: 'AA-x11', es: 'Once' }, // no id: the entity that goes by its name has no area
        { id: 'AA-x12', es: 'Doce' }, // no id: the entity is called after it, with its kind
        { id: 'AA-x13', es: 'Trece' }, // no id: the same entity goes by its name…
        { id: 'AA-x14', es: 'Catorce' }, // …and by the name of this one
        { id: 'AA-15', es: 'Quince' }, // no id: its code is carried by the entity of AA-01
        { id: 'AA-x16', es: 'Dieciséis', en: 'Sixteen', wd: 'Q160' }, // shares its id with the next one
        { id: 'AA-x17', es: 'Diecisiete', wd: 'Q160', ar: 5 },
        { id: 'AA-18', es: 'Dieciocho', wd: 'Q18' }, // an id of its own with no figure: no other is looked for
        { id: 'AA-19', es: 'Diecinueve' }, // no id: its code is carried by an entity of another country
      ],
    },
    BB: { wd: 'Q200', units: [{ id: 'BB-x00', es: 'Entero', wd: 'Q201' }] },
    CC: {
      wd: 'Q300',
      sov: 'EE',
      units: [
        { id: 'CC-x1', es: 'Alfa', en: 'Alpha' }, // no id: its entity is in something that is in the territory
        { id: 'CC-x2', es: 'Beta', wd: 'Q320' }, // its entity names the state the territory depends on
        { id: 'CC-x3', es: 'Gamma', wd: 'Q330' }, // its entity names a third country: the id of the maps is wrong
      ],
    },
    EE: { wd: 'Q500', units: [{ id: 'EE-x00', es: 'Metrópoli' }] },
    DD: {
      units: [
        { id: 'DD-01', es: 'Primero' },
        { id: 'DD-x2', es: 'Segundo' },
      ],
    },
  });

const WORLD = (): World => ({
  figures: {
    // Six statements, one of them twice and one with no day: the three newest are kept.
    Q1: [[100, null], [150, '2011-03-27'], [300, '2024-01-01'], [200, '2020-06-30'], [300, '2024-01-01'], [90, '2001-01-01']],
    Q20: [[20, null]],
    Q30: [[30, '2023-01-01']],
    Q40: [[40, '2023-01-01']],
    Q41: [[41, '2023-01-01']],
    Q50: [[50, '2023-01-01']],
    Q60: [[60, '2023-01-01']],
    Q70: [[70, '2022-01-01']],
    Q80: [[80, '2022-01-01']],
    Q81: [[81, '2022-01-01']],
    Q90: [[90, '2022-01-01']],
    Q91: [[91, '2022-01-01']],
    Q101: [[101, '2022-01-01']],
    Q102: [[102, '2022-01-01']],
    Q110: [[110, '2022-01-01']],
    Q120: [[120, '2022-01-01']],
    Q130: [[130, '2022-01-01']],
    Q161: [[161, '2022-01-01']],
    Q190: [[190, '2022-01-01']],
    Q201: [[201, '2022-01-01']],
    Q310: [[310, '2022-01-01']],
    Q320: [[0, '2020-01-01']],
    Q330: [[330, '2021-01-01']],
    Q400: [[400, '2022-01-01']],
    Q999: [[999, '2022-01-01']],
  },
  moved: { Q2: 'Q20' },
  heirs: { Q3: [['Q30', 1]], Q4: [['Q40', 1], ['Q41', 1]], Q5: [['Q50', 2]], Q6: [['Q60', 1]] },
  codes: { 'AA-07': ['Q70'], 'AA-08': ['Q80'], 'AA-09': ['Q90', 'Q91'], 'AA-15': ['Q1'], 'AA-18': ['Q180'], 'AA-19': ['Q190'], 'DD-01': ['Q400'] },
  // Q70 is in a province of its country and names the country; Q190 is the province of a neighbour.
  places: { Q1: ['Q100'], Q30: ['Q100', 'Q3000'], Q70: ['Q100', 'Q7000'], Q80: ['Q100'], Q90: ['Q100'], Q91: ['Q100'], Q190: ['Q777', 'Q7770'], Q310: ['Q500', 'Q3100'], Q320: ['Q500'], Q330: ['Q777'], Q400: ['Q888'] },
  names: {
    'Q100 Ocho@en': ['Q81'],
    'Q100 Diez@en': ['Q101', 'Q102'],
    'Q100 Once@es': ['Q110'],
    'Q100 Doce District@en': ['Q120'],
    'Q100 Trece@en': ['Q130'],
    'Q100 Catorce@es': ['Q130'],
    'Q100 Dieciséis@es': ['Q161'],
    'Q100 Diecisiete@en': ['Q160'],
  },
  deep: { 'Q300 Alpha@en': ['Q310'] },
  // Q20 is nothing like the division it is given to: an id that moved is the same entity whatever its size.
  areas: { Q1: [61.26], Q20: [9000], Q30: [110], Q60: [400], Q80: [900], Q81: [50, 120], Q101: [100], Q102: [100], Q120: [140], Q130: [100], Q161: [70], Q310: [95], Q320: [4443.4, 9] },
  labels: { Q20: 'Twenty', Q30: 'Thirty City', Q70: 'Seventy', Q81: 'Eight', Q120: 'Doce District', Q310: 'Alpha', Q400: 'Four hundred' },
});

beforeEach(() => {
  world = WORLD();
  refusals = [];
  asked = [];
  agents = [];
});

const FOUND = {
  'AA-01': { wd: 'Q1', km2: 61.3, pop: [[300, '2024-01-01'], [200, '2020-06-30'], [150, '2011-03-27']] },
  'AA-02': { wd: 'Q20', by: 'redirect', name: 'Twenty', km2: 9000, pop: [[20, null]] },
  'AA-03': { wd: 'Q30', by: 'successor', name: 'Thirty City', km2: 110, pop: [[30, '2023-01-01']] },
  'AA-07': { wd: 'Q70', by: 'code', name: 'Seventy', pop: [[70, '2022-01-01']] },
  'AA-08': { wd: 'Q81', by: 'name', name: 'Eight', km2: 120, pop: [[81, '2022-01-01']] },
  'AA-x12': { wd: 'Q120', by: 'name', name: 'Doce District', km2: 140, pop: [[120, '2022-01-01']] },
  'AA-x16': { wd: 'Q161', by: 'name', km2: 70, pop: [[161, '2022-01-01']] },
  'CC-x1': { wd: 'Q310', by: 'name', name: 'Alpha', km2: 95, pop: [[310, '2022-01-01']] },
  // Of the two areas its entity has, the nearest to the 100 km² of the division.
  'CC-x2': { wd: 'Q320', km2: 9, pop: [[0, '2020-01-01']] },
  'CC-x3': { wd: 'Q330', abroad: true, pop: [[330, '2021-01-01']] },
  'DD-01': { wd: 'Q400', by: 'code', name: 'Four hundred', pop: [[400, '2022-01-01']] },
};

/* ------------------------------------------------------------------ the tests */

describe('the population of the divisions', () => {
  it('gives each division the figures of its entity, or of the one entity that can stand for it', async () => {
    const r = await run(['--only', SOURCE, '--data', GAME()]);
    expect(r.code).toBe(0);
    const data = r.data();
    expect(data.items).toEqual(FOUND);
    // Every division of a map of several pieces counts; the map of one piece does not.
    expect(data.asked).toBe(24);
    expect(data).toMatchObject({ source: 'Wikidata (https://www.wikidata.org)', licence: 'CC0 1.0' });
  });

  it('tells how each figure was found', async () => {
    const r = await run(['--only', SOURCE, '--data', GAME()]);
    const [source] = r.report().sources;
    expect(source).toMatchObject({ id: SOURCE, ok: true });
    expect(source.note).toBe(
      '11 de 24 divisiones tienen cifra (3 por su identificador, 1 por uno que cambió, 1 por la entidad que la sustituyó, 2 por su código ISO, 4 por su nombre); 1 cuya entidad dice estar en otro país',
    );
    expect(source.detail).toEqual({
      divisions: 24,
      found: 11,
      by: { id: 3, redirect: 1, successor: 1, code: 2, name: 4 },
      abroad: 1,
      // How many divisions each way had an entity for (one that is already another division's does not
      // count), and how many of those it left with nothing although an entity had a figure: by its code,
      // the one of another size and the one with two; by its name, the one with two, the one with no area
      // and the two that go by the name of the same entity.
      proposed: { redirect: 1, successor: 2, code: 4, name: 8 },
      refused: { redirect: 0, successor: 1, code: 2, name: 4 },
      undone: [],
      unnamed: [],
    });
    expect(r.out).toContain('11 de 24 divisiones tienen cifra');
    expect(fs.readFileSync(path.join(r.dir, 'LEEME.md'), 'utf8')).toContain('| `wikidata/region-population.json` | Población de las divisiones de los mapas |');
  });

  it('asks about nothing it has no use for', async () => {
    await run(['--only', SOURCE, '--data', GAME()]);
    const all = asked.join('\n');
    // The country of one piece, the level of groups, and an id that two divisions share.
    expect(all).not.toMatch(/wd:Q201\b/);
    expect(all).not.toMatch(/wd:Q999\b/);
    expect(all).not.toMatch(/wd:Q160\b/);
    // The first question is about the entities that the maps name, and each is asked once.
    expect(ids(asked[0])).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q18', 'Q320', 'Q330']);
    for (const about of ['p:P1082', 'p:P2046']) {
      const entities = asked.filter((q) => q.includes(about)).flatMap(ids);
      expect(new Set(entities).size).toBe(entities.length);
    }
    // The area of an entity that moved is of no use to tell whether it is the same one, but it is kept.
    expect(asked.filter((q) => q.includes('p:P2046')).flatMap(ids)).toContain('Q20');
    // The entity of another country that carries a code of this one is asked where it is, and no more.
    expect(asked.filter((q) => /wd:Q190\b/.test(q))).toHaveLength(1);
    // A division with an id of its own is not looked for by its code or by its name.
    expect(all).not.toContain('"AA-18"');
    expect(all).not.toContain('Dieciocho');
    // One with no country in the index cannot be looked for by its name.
    expect(all).not.toContain('Segundo');
    expect(new Set(agents)).toEqual(new Set(['regionle-data/1.0 (https://github.com/diegosb72/regionle)']));
  });

  it('looks for a name alone and with each kind of division after it, in English, and alone in Spanish', async () => {
    await run(['--only', SOURCE, '--data', GAME()]);
    const names = asked.filter((q) => q.includes('?called'));
    // Twelve divisions to look for, four to a group, and two questions to a group: who names the country or
    // is in it, and who is in something that is in it.
    expect(names).toHaveLength(6);
    expect(names.map((q) => q.includes('?mid'))).toEqual([false, true, false, true, false, true]);
    expect(names.map((q) => new Set([...q.matchAll(/\("([^"]+)" wd:/g)].map((m) => m[1])).size)).toEqual([4, 4, 4, 4, 4, 4]);
    for (const q of names.slice(4)) expect(q).toContain('("CC-x1" wd:Q300 "Alpha"@en)');
    // Each of the two questions, over its three groups, names every division with every name.
    for (const q of [names.filter((x) => !x.includes('?mid')).join(' '), names.filter((x) => x.includes('?mid')).join(' ')]) {
      expect(q).toContain('("AA-x12" wd:Q100 "Doce"@en)');
      expect(q).toContain('("AA-x12" wd:Q100 "Doce District"@en)');
      expect(q).toContain('("AA-x12" wd:Q100 "Doce Municipality"@en)');
      expect(q).toContain('("AA-x12" wd:Q100 "Doce"@es)');
      expect(q).toContain('("AA-x16" wd:Q100 "Sixteen"@en)');
      expect(q).toContain('("AA-x16" wd:Q100 "Dieciséis"@es)');
      expect(q).not.toContain('"Dieciséis"@en');
      // What its code already found is not looked for again.
      expect(q).not.toContain('"AA-07"');
      // Never a path of any length: the query service does not finish those.
      expect(q).not.toMatch(/P131[+*]/);
    }
  });

  it('writes the same file for the same answers, with one division to a line', async () => {
    const game = GAME();
    const [a, b] = [await run(['--only', SOURCE, '--data', game]), await run(['--only', SOURCE, '--data', game])];
    expect(a.file).toBe(b.file);
    const lines = a.file!.split('\n');
    expect(lines.filter((line) => /^"[A-Z]{2}-/.test(line)).map((line) => line.slice(1, line.indexOf('"', 1)))).toEqual(Object.keys(FOUND).sort());
    expect(lines).toContain('"AA-02": {"wd":"Q20","by":"redirect","name":"Twenty","km2":9000,"pop":[[20,null]]},');
    expect(lines).toContain('"CC-x3": {"wd":"Q330","abroad":true,"pop":[[330,"2021-01-01"]]},');
    expect(a.file).not.toMatch(/20\d\d-\d\d-\d\dT/);
    // The name git gives the file, which is what `data:fetch` pins.
    const [source] = a.report().sources;
    const bytes = Buffer.from(a.file!, 'utf8');
    expect(source.bytes).toBe(bytes.length);
    expect(source.blob).toBe(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'));
  });

  it('takes a map to be where most of its divisions say, when that is not the country the maps name', async () => {
    // The maps know the country as Q600 and its divisions name Q601 in Wikidata. None of those is abroad for
    // that, the entity with a code of the country that names Q601 is taken, and what names a third place is
    // told apart: left out when it comes by a code, marked when it is the id of the maps.
    const game = maps({
      FF: {
        wd: 'Q600',
        units: [
          { id: 'FF-x1', es: 'Uno', wd: 'Q610' },
          { id: 'FF-x2', es: 'Dos', wd: 'Q620' },
          { id: 'FF-x3', es: 'Tres', wd: 'Q630' },
          { id: 'FF-x4', es: 'Cuatro', wd: 'Q640' },
          { id: 'FF-05', es: 'Cinco' },
          { id: 'FF-06', es: 'Seis' },
        ],
      },
    });
    world.figures = { Q610: [[1, null]], Q620: [[2, null]], Q630: [[3, null]], Q640: [[4, null]], Q650: [[5, null]], Q660: [[6, null]] };
    world.codes = { 'FF-05': ['Q650'], 'FF-06': ['Q660'] };
    world.places = { Q610: ['Q601', 'Q6010'], Q620: ['Q601', 'Q6020'], Q630: ['Q601'], Q640: ['Q777'], Q650: ['Q601'], Q660: ['Q777'] };
    const r = await run(['--only', SOURCE, '--data', game]);
    expect(r.data().items).toEqual({
      'FF-x1': { wd: 'Q610', pop: [[1, null]] },
      'FF-x2': { wd: 'Q620', pop: [[2, null]] },
      'FF-x3': { wd: 'Q630', pop: [[3, null]] },
      'FF-x4': { wd: 'Q640', abroad: true, pop: [[4, null]] },
      'FF-05': { wd: 'Q650', by: 'code', pop: [[5, null]] },
    });
    expect(r.report().sources[0].detail).toMatchObject({ found: 5, abroad: 1, undone: [] });
    // Where each entity is, is asked once.
    const located = asked.filter((q) => q.includes('?within ?in')).flatMap(ids);
    expect(new Set(located).size).toBe(located.length);
  });

  it('escapes a name that would break the question', async () => {
    const game = maps({ AA: { wd: 'Q100', units: [{ id: 'AA-x1', es: 'El "Valle" de\\Arriba' }, { id: 'AA-x2', es: 'Otro', wd: 'Q1' }] } });
    const r = await run(['--only', SOURCE, '--data', game]);
    expect(r.report().sources[0]).toMatchObject({ ok: true });
    expect(asked.filter((q) => q.includes('?called'))[0]).toContain('("AA-x1" wd:Q100 "El \\"Valle\\" de\\\\Arriba"@es)');
  });
});

describe('when Wikidata does not answer', () => {
  it('keeps what the other ways found when one way fails, and says which', async () => {
    refusals = [{ when: (q) => q.includes('?called'), status: 500, times: Infinity }];
    const r = await run(['--only', SOURCE, '--data', GAME()]);
    expect(r.code).toBe(0);
    expect(r.data().items).toEqual(Object.fromEntries(Object.entries(FOUND).filter(([, found]) => !('by' in found) || found.by !== 'name')));
    const [source] = r.report().sources;
    expect(source.ok).toBe(true);
    expect(source.detail).toMatchObject({ found: 7, by: { id: 3, redirect: 1, successor: 1, code: 2, name: 0 }, undone: ['los nombres (HTTP 500 Internal Server Error)'] });
    expect(source.note).toContain('; sin mirar: los nombres (HTTP 500 Internal Server Error)');
    // Each question twice and no more: a way that fails is not worth the minutes of a fourth try. And only
    // the first question of each group: the second is of no use without the first.
    const names = asked.filter((q) => q.includes('?called'));
    expect(names).toHaveLength(4);
    expect(names.some((q) => q.includes('?mid'))).toBe(false);
    // A run that kept everything it could read is not a failed one.
    expect((await run(['--verdict'], { out: r.dir })).code).toBe(0);
  });

  it('keeps the names it could ask about when a group of them is refused, and says how many it could not', async () => {
    // The second question of the second group is refused: what its first question found does not count.
    refusals = [{ when: (q) => q.includes('?mid') && q.includes('"AA-x12"'), status: 500, times: Infinity }];
    const r = await run(['--only', SOURCE, '--data', GAME()]);
    const items = r.data().items;
    expect(items).not.toHaveProperty('AA-x12');
    for (const id of ['AA-08', 'AA-x16', 'CC-x1'] as const) expect(items[id]).toEqual(FOUND[id]);
    const [source] = r.report().sources;
    expect(source.detail).toMatchObject({
      found: 10,
      by: { name: 3 },
      undone: ['los nombres de 4 de 12 divisiones (HTTP 500 Internal Server Error)'],
      unnamed: ['AA-x12', 'AA-x13', 'AA-x14', 'AA-15'],
    });
    // The second group: one question answered and the other asked twice. The other two: their two questions.
    expect(asked.filter((q) => q.includes('?called'))).toHaveLength(2 + 3 + 2);
  });

  /** A service that works for a while on what is asked and then gives up, as the real one does at a minute. */
  const chokes = (when: (q: string) => boolean): Refusal => ({ when, status: 504, times: Infinity, after: 300 });
  const HASTY = { OUTSIDE_SLOW: '150' };

  it('asks again, a division at a time, about a group of names that the service does not finish', async () => {
    // It chokes on two of the names together and on neither of them alone.
    refusals = [chokes((q) => q.includes('"AA-x12"') && q.includes('"AA-x13"'))];
    const r = await run(['--only', SOURCE, '--data', GAME()], { env: HASTY });
    expect(r.data().items).toEqual(FOUND);
    expect(r.report().sources[0].detail).toMatchObject({ undone: [], unnamed: [] });
    const names = asked.filter((q) => q.includes('?called'));
    // What it did not finish is not asked again as it was: the group once, and then its four divisions.
    expect(names).toHaveLength(2 + (1 + 4 * 2) + 2);
    expect(names.filter((q) => q.includes('"AA-x12"') && q.includes('"AA-x13"'))).toHaveLength(1);
  });

  it('leaves out only the division whose name is too much for the service', async () => {
    refusals = [chokes((q) => q.includes('"AA-x12"'))];
    const r = await run(['--only', SOURCE, '--data', GAME()], { env: HASTY });
    const { 'AA-x12': left, ...rest } = FOUND;
    expect(left.by).toBe('name');
    expect(r.data().items).toEqual(rest);
    expect(r.report().sources[0].detail).toMatchObject({ undone: ['los nombres de 1 de 12 divisiones (HTTP 504 Gateway Timeout)'], unnamed: ['AA-x12'] });
    // The group once, the division alone once, and the other three with their two questions.
    expect(asked.filter((q) => q.includes('?called'))).toHaveLength(2 + (1 + 1 + 3 * 2) + 2);
  });

  it('leaves the names when too many of them are too much for the service', async () => {
    const units = Array.from({ length: 35 }, (_, i) => ({ id: `GG-x${i + 1}`, es: `Lugar ${i + 1}` }));
    const game = maps({ GG: { wd: 'Q700', units: [{ id: 'GG-x0', es: 'Capital', wd: 'Q701' }, ...units] } });
    world.figures = { Q701: [[1, null]] };
    refusals = [chokes((q) => q.includes('?called'))];
    const r = await run(['--only', SOURCE, '--data', game], { env: HASTY });
    expect(Object.keys(r.data().items)).toEqual(['GG-x0']);
    const detail = r.report().sources[0].detail;
    expect(detail?.undone).toEqual(['los nombres (HTTP 504 Gateway Timeout)']);
    expect(detail?.unnamed).toHaveLength(35);
    // The first group and its four divisions, the second group and two of its divisions: six too heavy.
    expect(asked.filter((q) => q.includes('?called'))).toHaveLength(1 + 4 + 1 + 2);
  });

  it('stops asking about names at the second group that is refused', async () => {
    const units = Array.from({ length: 35 }, (_, i) => ({ id: `GG-x${i + 1}`, es: `Lugar ${i + 1}` }));
    const game = maps({ GG: { wd: 'Q700', units: [{ id: 'GG-x0', es: 'Capital', wd: 'Q701' }, ...units] } });
    world.figures = { Q701: [[1, null]], Q711: [[11, '2020-01-01']] };
    world.names = { 'Q700 Lugar 1@es': ['Q711'], 'Q700 Lugar 31@es': ['Q711'] };
    world.areas = { Q711: [100] };
    // Nine groups. With the third and the sixth refused, the last three are not asked about.
    refusals = [{ when: (q) => q.includes('"GG-x11"') || q.includes('"GG-x21"'), status: 503, times: Infinity }];
    const r = await run(['--only', SOURCE, '--data', game]);
    expect(Object.keys(r.data().items)).toEqual(['GG-x0', 'GG-x1']);
    expect(r.report().sources[0].detail?.undone).toEqual(['los nombres de 19 de 35 divisiones (HTTP 503 Service Unavailable)']);
    // A question that is refused at once is asked twice, and its group is not taken apart: it would be refused again.
    expect(asked.filter((q) => q.includes('?called'))).toHaveLength(4 * 2 + 2 * 2);
    expect(asked.join('\n')).not.toContain('"GG-x31"');
  });

  it('leaves what it can do without when there is no time left for it', async () => {
    const r = await run(['--only', SOURCE, '--data', GAME()], { env: { OUTSIDE_PATIENCE: '0' } });
    expect(r.code).toBe(0);
    // Only the first question was asked: what the maps name, as it comes.
    expect(asked).toHaveLength(1);
    expect(r.data().items).toEqual({ 'AA-01': { wd: 'Q1', pop: FOUND['AA-01'].pop }, 'CC-x2': { wd: 'Q320', pop: [[0, '2020-01-01']] }, 'CC-x3': { wd: 'Q330', pop: [[330, '2021-01-01']] } });
    const undone = r.report().sources[0].detail?.undone ?? [];
    expect(undone).toHaveLength(7);
    expect(undone.every((what) => what.endsWith('(no quedaba tiempo)'))).toBe(true);
    expect((await run(['--verdict'], { out: r.dir })).code).toBe(0);
  });

  it('goes on to the next way after one that fails', async () => {
    refusals = [{ when: (q) => q.includes('owl:sameAs') || q.includes('wdt:P300'), status: 503, times: Infinity }];
    const r = await run(['--only', SOURCE, '--data', GAME()]);
    const items = r.data().items;
    expect(Object.keys(items).sort()).toEqual(['AA-01', 'AA-03', 'AA-08', 'AA-x12', 'AA-x16', 'CC-x1', 'CC-x2', 'CC-x3']);
    expect(r.report().sources[0].detail?.undone).toEqual(['los identificadores que han cambiado (HTTP 503 Service Unavailable)', 'los códigos ISO 3166-2 (HTTP 503 Service Unavailable)']);
  });

  it('keeps the figures when it cannot learn where an entity is or how large', async () => {
    refusals = [{ when: (q) => q.includes('?within ?in') || q.includes('p:P2046'), status: 500, times: Infinity }];
    const r = await run(['--only', SOURCE, '--data', GAME()]);
    const items = r.data().items;
    // By its own id and by the id it moved to: the ways that need neither thing.
    expect(items).toEqual({
      'AA-01': { wd: 'Q1', pop: FOUND['AA-01'].pop },
      'AA-02': { wd: 'Q20', by: 'redirect', name: 'Twenty', pop: [[20, null]] },
      'CC-x2': { wd: 'Q320', pop: [[0, '2020-01-01']] },
      'CC-x3': { wd: 'Q330', pop: [[330, '2021-01-01']] },
    });
    expect(r.report().sources[0].detail?.undone.map((what) => what.replace(/ \(.*/, ''))).toEqual([
      'las entidades que sustituyeron a otra',
      'los códigos ISO 3166-2',
      'los nombres',
      'la superficie de cada entidad',
      'el país de cada entidad',
    ]);
  });

  it('leaves the source unread, and the run in red, when the first question has no answer', async () => {
    refusals = [{ when: (q) => q.includes('p:P1082'), status: 503, times: Infinity }];
    const r = await run(['--only', SOURCE, '--data', GAME()]);
    expect(r.code).toBe(0);
    expect(r.file).toBeNull();
    expect(r.report().sources).toMatchObject([{ id: SOURCE, ok: false, error: 'HTTP 503 Service Unavailable' }]);
    // The question that everything else hangs from is asked four times.
    expect(asked).toHaveLength(4);
    const verdict = await run(['--verdict'], { out: r.dir });
    expect(verdict.code).toBe(1);
    expect(verdict.out).toContain('Sin leer: 1 de 1');
  });

  it('asks again a place that is busy or broken for a moment', async () => {
    refusals = [
      { when: () => true, status: 429, times: 1, header: { 'Retry-After': '0' } },
      { when: () => true, status: 502, times: 1 },
    ];
    const r = await run(['--only', SOURCE, '--data', GAME()]);
    expect(r.data().items).toEqual(FOUND);
    expect(r.report().sources[0].detail?.undone).toEqual([]);
    expect(asked.slice(0, 3)).toEqual([asked[0], asked[0], asked[0]]);
  });

  it('does not ask again after a refusal that is final', async () => {
    refusals = [{ when: () => true, status: 400, times: Infinity }];
    const r = await run(['--only', SOURCE, '--data', GAME()]);
    expect(r.report().sources).toMatchObject([{ ok: false, error: 'HTTP 400 Bad Request' }]);
    expect(asked).toHaveLength(1);
  });
});

describe('what is asked for', () => {
  const request = (lines: string[]) => {
    const file = path.join(fresh('pedido'), 'pedido.txt');
    fs.writeFileSync(file, lines.join('\n'));
    return file;
  };

  it('lists what there is to bring', async () => {
    const r = await run(['--list']);
    expect(r.code).toBe(0);
    expect(r.out).toContain(`${SOURCE}\n  wikidata/region-population.json · Wikidata (https://www.wikidata.org) · CC0 1.0 · punto 29`);
    expect(r.out).toContain('reach');
    expect(asked).toHaveLength(0);
  });

  it('brings what a file of requests names, whose lines that start with # are notes', async () => {
    const file = request(['# Qué traer', '', `  ${SOURCE}  `, '# reach', '']);
    const r = await run(['--asked', file, '--data', GAME()]);
    expect(r.code).toBe(0);
    const report = r.report();
    expect(report.sources.map((s) => s.id)).toEqual([SOURCE]);
    // The look at the places was not asked for (and the stand-in would not have seen it).
    expect(report.reach).toEqual([]);
    expect(r.data().items).toEqual(FOUND);
  });

  it('takes the file of requests from the environment too', async () => {
    const r = await run(['--data', GAME()], { env: { OUTSIDE_ASKED: request([SOURCE]) } });
    expect(r.report().sources.map((s) => s.id)).toEqual([SOURCE]);
  });

  it('puts what is said by hand before the file', async () => {
    const r = await run(['--only', SOURCE, '--asked', request(['nada-que-exista']), '--data', GAME()]);
    expect(r.code).toBe(0);
    expect(r.report().sources.map((s) => s.id)).toEqual([SOURCE]);
  });

  it('stops before asking anything when a name is not of a source', async () => {
    for (const args of [['--only', 'wikidata-region-poblacion'], ['--asked', request([SOURCE, 'wikidata-region-poblacion'])]]) {
      const r = await run([...args, '--data', GAME()]);
      expect(r.code).toBe(2);
      expect(r.err).toContain('No hay ninguna fuente que se llame así: wikidata-region-poblacion');
      expect(fs.readdirSync(r.dir)).toEqual([]);
    }
    expect(asked).toHaveLength(0);
  });

  it('stops when the file of requests is not there', async () => {
    const r = await run(['--asked', path.join(TMP, 'no-esta.txt'), '--data', GAME()]);
    expect(r.code).toBe(2);
    expect(r.err).toContain('No está el archivo que dice qué traer');
    expect(asked).toHaveLength(0);
  });
});

describe('on GitHub', () => {
  it('says where the run comes from and writes its summary, with a warning for what it could not look at', async () => {
    refusals = [{ when: (q) => q.includes('wdt:P1366'), status: 500, times: Infinity }];
    const summary = path.join(fresh('summary'), 'summary.md');
    const env = { GITHUB_ACTIONS: 'true', GITHUB_STEP_SUMMARY: summary, GITHUB_SHA: 'abcdef1234567890', GITHUB_REF_NAME: 'una-rama' };
    const r = await run(['--only', SOURCE, '--data', GAME()], { env });
    expect(r.report().from).toBe('una-rama@abcdef1');
    expect(r.out).toContain('::warning title=Sin mirar::Población de las divisiones de los mapas (wikidata-region-population): las entidades que sustituyeron a otra (HTTP 500 Internal Server Error)');
    expect(r.out).not.toContain('::warning title=Fuente sin leer');
    const written = fs.readFileSync(summary, 'utf8');
    expect(written).toContain('# Lo que se ha traído');
    expect(written).toContain('Hecha con `una-rama@abcdef1`');
    expect(written).toContain('10 de 24 divisiones tienen cifra');
  });
});

describe('the workflow that runs it', () => {
  /** A copy of the script in a repository of its own, with the copy of the workflow and the one that was put in its place. */
  const repository = (copy: string, placed: string | null) => {
    const dir = fresh('repo');
    fs.mkdirSync(path.join(dir, 'scripts/data'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'scripts/data/outside.mjs'), path.join(dir, 'scripts/data/outside.mjs'));
    fs.writeFileSync(path.join(dir, 'scripts/data/traer-datos.yml'), copy);
    if (placed !== null) {
      fs.mkdirSync(path.join(dir, '.github/workflows'), { recursive: true });
      fs.writeFileSync(path.join(dir, '.github/workflows/datos.yml'), placed);
    }
    return path.join(dir, 'scripts/data/outside.mjs');
  };
  const GITHUB = { GITHUB_ACTIONS: 'true', GITHUB_SHA: 'abcdef1234567890', GITHUB_REF_NAME: 'main' };

  it('says so when the workflow in its place is not the copy that the branch carries', async () => {
    const summary = path.join(fresh('summary'), 'summary.md');
    const script = repository('name: Traer datos\non:\n  push:\n', 'name: Traer datos\non:\n  workflow_dispatch:\n');
    const r = await run(['--only', SOURCE, '--data', GAME()], { script, env: { ...GITHUB, GITHUB_STEP_SUMMARY: summary } });
    expect(r.code).toBe(0);
    expect(r.report().workflow).toBe('behind');
    expect(r.out).toContain('::warning title=Flujo sin actualizar::.github/workflows/datos.yml no es igual que scripts/data/traer-datos.yml de esta rama');
    for (const page of [fs.readFileSync(summary, 'utf8'), fs.readFileSync(path.join(r.dir, 'LEEME.md'), 'utf8')]) expect(page).toContain('**El flujo que está puesto se ha quedado atrás.**');
    // It is something to do, not something that went wrong: the data are as good as ever.
    expect(r.data().items).toEqual(FOUND);
    expect((await run(['--verdict'], { out: r.dir, script })).code).toBe(0);
  });

  it('says nothing when they are the same, however the lines end', async () => {
    const script = repository('name: Traer datos\non:\n  push:\n', 'name: Traer datos\r\non:\r\n  push:\r\n\r\n');
    const r = await run(['--only', SOURCE, '--data', GAME()], { script, env: GITHUB });
    expect(r.report().workflow).toBe('same');
    expect(r.out).not.toContain('Flujo sin actualizar');
    expect(fs.readFileSync(path.join(r.dir, 'LEEME.md'), 'utf8')).not.toContain('se ha quedado atrás');
  });

  it('says nothing where the workflow was never put', async () => {
    const r = await run(['--only', SOURCE, '--data', GAME()], { script: repository('name: Traer datos\n', null), env: GITHUB });
    expect(r.report().workflow).toBe('absent');
    expect(r.out).not.toContain('Flujo sin actualizar');
  });

  it('is asked, in the list of the repository, for sources that exist', async () => {
    const listed = (await run(['--list'])).out.split('\n').filter((line) => /^\S/.test(line));
    const asked = fs.readFileSync(path.join(ROOT, 'scripts/data/pedido.txt'), 'utf8').split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
    expect(asked.length).toBeGreaterThan(0);
    for (const name of asked) expect(listed).toContain(name);
    // The copy of the workflow starts with the list where the script expects it.
    const copy = fs.readFileSync(path.join(ROOT, 'scripts/data/traer-datos.yml'), 'utf8');
    expect(copy).toContain('      - scripts/data/pedido.txt\n');
    expect(copy).toContain("PEDIDO: ${{ github.event_name == 'push' && 'scripts/data/pedido.txt' || '' }}");
  });
});

describe('the game as it is', () => {
  it('has something to ask about: divisions with a Wikidata id, in maps of more than one piece', () => {
    // What the script reads from the maps of the game, read here the same way: were the maps to change
    // shape, the script would find nothing and this would say so before a run on GitHub did.
    const dir = path.join(ROOT, 'public/data/r');
    let units = 0;
    let named = 0;
    let withId = 0;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const list: { id?: string; properties?: { n?: { es?: string }; wd?: string; ar?: number } }[] = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')).objects?.f?.geometries ?? [];
      if (list.length < 2) continue;
      units += list.length;
      named += list.filter((g) => g.id && g.properties?.n?.es && Number(g.properties.ar) > 0).length;
      withId += list.filter((g) => /^Q[1-9]\d*$/.test(g.properties?.wd ?? '')).length;
    }
    expect(units).toBeGreaterThan(4000);
    expect(named).toBe(units);
    expect(withId / units).toBeGreaterThan(0.9);
    const countries: { id: string; wd?: string }[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/index.json'), 'utf8')).countries;
    expect(countries.every((c) => /^Q[1-9]\d*$/.test(c.wd ?? ''))).toBe(true);
  });
});
