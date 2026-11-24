// What Wikidata and Wikipedia say of each country and of its flag, as the script that brings the data kept
// outside GitHub asks for it (scripts/data/outside.mjs, source `countries`), run for real: against a stand-in
// for Wikidata's query service and for the two Wikipedias, which answer what each test says the world is
// like, and with a list of countries made up for the occasion. Nothing here leaves the machine.

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Every test starts the script: seconds on a machine that is doing other things.
vi.setConfig({ testTimeout: 30_000 });

const ROOT = process.cwd();

interface World {
  /** What each entity gives through each property: texts as [language, text], entities by their id, a file by its name. */
  said: Record<string, Record<string, ([string, string] | string)[]>>;
  /** The day each flag began, with how exactly it is known. */
  since: Record<string, [string, number][]>;
  names: Record<string, { es?: string; en?: string }>;
  pages: Record<string, Record<string, string>>;
  /** How each page of a Wikipedia starts, by `language:title`. */
  leads: Record<string, string>;
}
let world: World;
/** What is refused: the status given to what matches, as many times as it says. */
let refusals: { when: (asked: string) => boolean; status: number; times: number }[] = [];
/** What was asked, in order: `sparql <query>` or `wiki <language> <titles>`. */
let asked: string[] = [];
let base = '';
let server: http.Server;

const uri = (id: string) => ({ type: 'uri', value: `http://www.wikidata.org/entity/${id}` });
const ids = (query: string) => [...query.matchAll(/wd:(Q\d+)/g)].map((m) => m[1]);
const WORDS = ['P1448', 'P1705', 'P1451'];

function answer(query: string): Record<string, unknown>[] {
  if (query.includes('schema:about'))
    return ids(query).flatMap((id) => Object.entries(world.pages[id] ?? {}).map(([lang, name]) => ({ item: uri(id), site: { type: 'uri', value: `https://${lang}.wikipedia.org/` }, name: { type: 'literal', value: name } })));
  if (query.includes('rdfs:label'))
    return ids(query).flatMap((id) => Object.entries(world.names[id] ?? {}).map(([lang, value]) => ({ item: uri(id), label: { type: 'literal', 'xml:lang': lang, value } })));
  if (query.includes('psv:P571'))
    return ids(query).flatMap((id) => (world.since[id] ?? []).map(([day, precision]) => ({ item: uri(id), day: { type: 'literal', value: `${day}T00:00:00Z` }, precision: { type: 'literal', value: String(precision) } })));
  const prop = /\?item p:(P\d+) \?st/.exec(query)?.[1] ?? '';
  return ids(query).flatMap((id) =>
    (world.said[id]?.[prop] ?? []).map((value) => ({
      item: uri(id),
      value: WORDS.includes(prop)
        ? { type: 'literal', 'xml:lang': value[0], value: value[1] }
        : prop === 'P94'
          ? { type: 'uri', value: `http://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(String(value))}` }
          : uri(String(value)),
    })),
  );
}

function wikipedia(lang: string, form: URLSearchParams): Record<string, unknown> {
  const pages = (form.get('titles') ?? '').split('|').filter(Boolean).map((title) => {
    const lead = world.leads[`${lang}:${title}`];
    return lead === undefined ? { title, missing: true } : { title, revisions: [{ slots: { main: { content: lead } } }] };
  });
  return { batchcomplete: true, query: { pages } };
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const [, place, lang = ''] = new URL(req.url ?? '/', 'http://x').pathname.split('/');
      const form = new URLSearchParams(body);
      const said = place === 'sparql' ? `sparql ${form.get('query') ?? ''}` : `wiki ${lang} ${form.get('titles') ?? ''}`;
      asked.push(said);
      const refusal = refusals.find((r) => r.times > 0 && r.when(said));
      if (refusal) {
        refusal.times--;
        return void res.writeHead(refusal.status).end('no');
      }
      if (place === 'sparql') return void res.writeHead(200, { 'Content-Type': 'application/sparql-results+json' }).end(JSON.stringify({ results: { bindings: answer(form.get('query') ?? '') } }));
      if (place === 'wiki') return void res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(wikipedia(lang, form)));
      res.writeHead(404).end('not here');
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((done) => server.close(done)));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-countries-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;
const fresh = (name: string) => {
  const dir = path.join(TMP, `${name}-${++n}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/** The list of countries of a game: each with its Wikidata entity, or with none. */
function game(countries: Record<string, string | null>): string {
  const dir = fresh('data');
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ countries: Object.entries(countries).map(([id, wd]) => ({ id, ...(wd ? { wd } : {}) })) }));
  return dir;
}

interface Item {
  wd: string;
  official?: [string, string][];
  native?: [string, string][];
  motto?: [string, string][];
  anthem?: string[];
  government?: string[];
  flag?: string[];
  arms?: string[];
  pages?: Record<string, string>;
}
interface Flown {
  since?: [string, number][];
  ratio?: string[];
  colours?: string[];
  by?: string[];
  pages?: Record<string, string>;
}
interface Result {
  code: number;
  data: () => { asked: number; source: string; licence: string; items: Record<string, Item>; flags: Record<string, Flown>; names: Record<string, { es?: string; en?: string }>; boxes: Record<string, string> };
  raw: () => string;
  source: () => { id: string; ok: boolean; note?: string; error?: string; detail?: { asked: number; official: number; motto: number; anthem: number; flag: number; dated: number; boxes: number; undone: string[] } };
}

/** Runs the script. It gets no variable of the machine but the ones named here. */
function run(data: string, env: Record<string, string> = {}): Promise<Result> {
  const out = fresh('out');
  return new Promise((done) => {
    const none = path.join(TMP, 'no-list');
    const vars = { PATH: process.env.PATH ?? '', OUTSIDE_WDQS: `${base}/sparql`, OUTSIDE_WIKIPEDIA: `${base}/wiki/{lang}`, OUTSIDE_COMMONS: `${base}/api`, OUTSIDE_KEPT: '', OUTSIDE_PAUSE: '0', OUTSIDE_PROFILES: none, ...env };
    execFile('node', ['scripts/data/outside.mjs', '--out', out, '--only', 'countries', '--data', data], { cwd: ROOT, env: vars }, (error) => {
      const file = path.join(out, 'countries/countries.json');
      done({
        code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
        raw: () => fs.readFileSync(file, 'utf8'),
        data: () => JSON.parse(fs.readFileSync(file, 'utf8')),
        source: () => (JSON.parse(fs.readFileSync(path.join(out, 'estado.json'), 'utf8')) as { sources: ReturnType<Result['source']>[] }).sources.find((s) => s.id === 'countries')!,
      });
    });
  });
}

/** Two countries: one that says everything of itself and of its flag, and one that says its name and no more. */
const LANDS = () => game({ AA: 'Q10', BB: 'Q20', CC: null });
const BOX_AA = '{{Infobox country\n| conventional_long_name = Republic of Aa\n| national_motto = {{lang|la|Semper}}<ref>{{cite web|url=x}}</ref>\n}}';
const BOX_FLAG = '{{Infobox flag\n| Name = Aa\n| Proportion = 2:3\n| Adoption = {{start date|1900|1|2}}\n}}';

beforeEach(() => {
  refusals = [];
  asked = [];
  world = {
    said: {
      Q10: {
        P1448: [['xx', 'República  de Aa'], ['en', 'Republic of Aa']],
        P1705: [['xx', 'Aa']],
        P1451: [['la', 'Semper']],
        P85: ['Q300'],
        P122: ['Q401', 'Q400'],
        P163: ['Q11'],
        P94: ['Coat of arms of Aa.svg'],
      },
      Q20: { P1448: [['yy', 'Bb']] },
      Q11: { P2061: ['Q500'], P462: ['Q602', 'Q601'], P287: ['Q700'] },
    },
    since: { Q11: [['1900-01-02', 11]] },
    names: { Q300: { es: 'Himno de Aa', en: 'Anthem of Aa' }, Q400: { es: 'república', en: 'republic' }, Q401: { en: 'federation' }, Q500: { en: '3:2' }, Q601: { es: 'rojo', en: 'red' }, Q602: { es: 'blanco', en: 'white' }, Q700: { en: 'Ann Maker' } },
    pages: { Q10: { en: 'Aa', es: 'Aa (país)' }, Q11: { en: 'Flag of Aa' }, Q20: { es: 'Bb' } },
    leads: {
      'en:Aa': `{{Short description|Country}}\n{{Use dmy dates}}\n${BOX_AA}\n'''Aa''' is a country.`,
      'es:Aa (país)': "{{Ficha de país\n| nombre_oficial = República de Aa\n}}\n'''Aa''' es un país.",
      'en:Flag of Aa': `${BOX_FLAG}\nThe flag of Aa.`,
      'es:Bb': "'''Bb''' es un país del que nadie ha hecho ficha.",
    },
  };
});

describe('what Wikidata and Wikipedia say of each country', () => {
  it('brings what each country says of itself and of its flag, the names of what it names, its pages and their boxes of facts', async () => {
    const r = await run(LANDS());
    expect(r.code).toBe(0);
    const data = r.data();
    expect(data.asked).toBe(2);
    expect(data.items).toEqual({
      AA: {
        wd: 'Q10',
        // The spaces of a name are those of a text, and every list is in an order that does not depend on the day.
        official: [['en', 'Republic of Aa'], ['xx', 'República de Aa']],
        native: [['xx', 'Aa']],
        motto: [['la', 'Semper']],
        anthem: ['Q300'],
        government: ['Q400', 'Q401'],
        flag: ['Q11'],
        arms: ['Coat of arms of Aa.svg'],
        pages: { en: 'Aa', es: 'Aa (país)' },
      },
      BB: { wd: 'Q20', official: [['yy', 'Bb']], pages: { es: 'Bb' } },
    });
    expect(data.flags).toEqual({ Q11: { since: [['1900-01-02', 11]], ratio: ['Q500'], colours: ['Q601', 'Q602'], by: ['Q700'], pages: { en: 'Flag of Aa' } } });
    expect(data.names).toEqual(world.names);
    // The box alone, whole, whatever comes before it; a page with none has no entry.
    expect(data.boxes).toEqual({ 'en:Aa': BOX_AA, 'es:Aa (país)': '{{Ficha de país\n| nombre_oficial = República de Aa\n}}', 'en:Flag of Aa': BOX_FLAG });
    expect(data.licence).toContain('CC0');
    expect(data.licence).toContain('CC BY-SA');
    expect(r.source()).toMatchObject({ ok: true, detail: { asked: 2, official: 2, motto: 1, anthem: 1, flag: 1, dated: 1, boxes: 3, undone: [] } });
    // One entry to a line: a change in what a country says is a change in a line.
    expect(r.raw().split('\n').filter((line) => line.startsWith('"AA":'))).toHaveLength(1);
  });

  it('asks only for the statements of best rank that have not ended, and says who it is', async () => {
    await run(LANDS());
    const queries = asked.filter((a) => a.startsWith('sparql ') && /\?item p:P\d+ \?st/.test(a));
    expect(queries.map((q) => /\?item p:(P\d+) \?st/.exec(q)![1])).toEqual(['P1448', 'P1705', 'P1451', 'P85', 'P122', 'P163', 'P94', 'P571', 'P2061', 'P462', 'P287']);
    for (const q of queries) expect(q).toContain('wikibase:BestRank');
    for (const q of queries.filter((q) => !q.includes('psv:P571'))) expect(q).toContain('FILTER NOT EXISTS { ?st pq:P582 ?end }');
    // The flag is asked about by its own entity, and the pages of both are asked for at once.
    expect(queries.find((q) => q.includes('p:P2061'))).toContain('wd:Q11');
    expect(asked.find((a) => a.includes('schema:about'))).toMatch(/wd:Q10 wd:Q20 wd:Q11/);
    expect(asked.filter((a) => a.startsWith('wiki ')).sort()).toEqual(['wiki en Aa|Flag of Aa', 'wiki es Aa (país)|Bb']);
  });

  it('is not read when Wikidata does not say what any country is called', async () => {
    refusals = [{ when: (a) => a.includes('p:P1448'), status: 500, times: 99 }];
    const r = await run(LANDS());
    expect(r.source()).toMatchObject({ ok: false });
    expect(asked.some((a) => a.includes('p:P85'))).toBe(false);

    refusals = [];
    world.said = { Q10: { P85: ['Q300'] } };
    expect((await run(LANDS())).source()).toMatchObject({ ok: false, error: expect.stringContaining('official name') });
  });

  it('keeps what it has when something else is not answered, and tells what', async () => {
    refusals = [
      { when: (a) => a.includes('p:P85'), status: 400, times: 99 },
      { when: (a) => a.startsWith('wiki es'), status: 400, times: 99 },
    ];
    const r = await run(LANDS());
    expect(r.code).toBe(0);
    expect(r.data().items.AA).toMatchObject({ official: [['en', 'Republic of Aa'], ['xx', 'República de Aa']], motto: [['la', 'Semper']], flag: ['Q11'] });
    expect(r.data().items.AA.anthem).toBeUndefined();
    expect(Object.keys(r.data().boxes)).toEqual(['en:Aa', 'en:Flag of Aa']);
    const undone = r.source().detail!.undone;
    expect(undone).toHaveLength(2);
    expect(undone[0]).toContain('anthem (P85)');
    expect(undone[1]).toContain('«es»');
    expect(r.source().note).toContain('sin mirar');
  });

  it('takes a box that holds other templates whole, and none that is never closed', async () => {
    const nested = '{{Infobox country\n| a = {{lang|xx|{{small|uno}}}}\n| b = [[Dos|{{dos}}]]\n}}';
    world.leads['en:Aa'] = `${nested}\n{{Another box|x=1}}`;
    world.leads['en:Flag of Aa'] = '{{Infobox flag\n| Name = {{lang|xx|Aa}\n';
    const boxes = (await run(LANDS())).data().boxes;
    expect(boxes['en:Aa']).toBe(nested);
    expect(boxes['en:Flag of Aa']).toBeUndefined();
  });

  it('has nothing to ask when no country has a Wikidata entity', async () => {
    const r = await run(game({ AA: null }));
    expect(r.source()).toMatchObject({ ok: false, error: expect.stringContaining('No country') });
    expect(asked).toEqual([]);
  });
});
