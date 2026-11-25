// How Wikipedia begins to tell of each country and of its flag, as the script that brings the data kept
// outside GitHub asks for it (scripts/data/outside.mjs, source `texts`), run for real: against a stand-in for
// the two Wikipedias, which answer what each test says they hold, and with sheets of countries made up for
// the occasion. Nothing here leaves the machine.

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

interface Held {
  text: string;
  rev: number;
}
/** What each Wikipedia holds, by `language:title`; and the titles that lead to another. */
let held: Record<string, Held>;
let leads: Record<string, string>;
/** How many openings an answer carries at most: the rest come when asked to go on. */
let atOnce = 20;
/** What is refused: the status given to what matches, as many times as it says. */
let refusals: { when: (asked: string) => boolean; status: number; times: number }[] = [];
/** What was asked, in order: `<language> <titles>`, and what else the question said. */
let asked: { lang: string; titles: string[]; form: Record<string, string>; agent: string }[] = [];
let base = '';
let server: http.Server;

function wikipedia(lang: string, form: URLSearchParams): Record<string, unknown> {
  const titles = (form.get('titles') ?? '').split('|').filter(Boolean);
  const redirects = titles.filter((title) => leads[`${lang}:${title}`]).map((from) => ({ from, to: leads[`${lang}:${from}`] }));
  const real = [...new Set(titles.map((title) => leads[`${lang}:${title}`] ?? title))];
  const from = Number(form.get('excontinue') ?? 0);
  const pages = real.map((title, i) => {
    const page = held[`${lang}:${title}`];
    if (!page) return { title, missing: true };
    // Every page says which revision it is at; only some of them say how they begin in each answer.
    return { title, revisions: [{ revid: page.rev, parentid: page.rev - 1 }], ...(i >= from && i < from + atOnce ? { extract: page.text } : {}) };
  });
  const more = from + atOnce < real.length ? { continue: { excontinue: String(from + atOnce), continue: '||revisions' } } : { batchcomplete: true };
  return { ...more, query: { ...(redirects.length ? { redirects } : {}), pages } };
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const [, place, lang = ''] = new URL(req.url ?? '/', 'http://x').pathname.split('/');
      const form = new URLSearchParams(body);
      const titles = (form.get('titles') ?? '').split('|').filter(Boolean);
      asked.push({ lang, titles, form: Object.fromEntries(form), agent: String(req.headers['user-agent'] ?? '') });
      const refusal = refusals.find((r) => r.times > 0 && r.when(`${lang} ${titles.join('|')}`));
      if (refusal) {
        refusal.times--;
        return void res.writeHead(refusal.status).end('no');
      }
      if (place === 'wiki') return void res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(wikipedia(lang, form)));
      res.writeHead(404).end('not here');
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((done) => server.close(done)));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-texts-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;
const fresh = (name: string) => {
  const dir = path.join(TMP, `${name}-${++n}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

type Links = { es?: string; en?: string };
/** The sheets of a game: of each country, the pages it leads to. */
function game(sheets: Record<string, { read?: Links; readFlag?: Links } | string>): string {
  const dir = fresh('data');
  fs.mkdirSync(path.join(dir, 'profiles'));
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ countries: Object.keys(sheets).map((id) => ({ id })) }));
  for (const [id, sheet] of Object.entries(sheets)) fs.writeFileSync(path.join(dir, 'profiles', `${id}.json`), typeof sheet === 'string' ? sheet : JSON.stringify({ v: 1, id, ...sheet }));
  return dir;
}

interface Page {
  text: string;
  rev?: number;
  title?: string;
}
interface Result {
  code: number;
  data: () => { asked: number; source: string; licence: string; what: string; pages: Record<string, Page> };
  raw: () => string;
  written: () => boolean;
  source: () => { id: string; ok: boolean; note?: string; error?: string; detail?: { asked: number; sheets: number; read: number; by: Record<string, number>; undone: string[] } };
}

/** Runs the script. It gets no variable of the machine but the ones named here. */
function run(data: string, env: Record<string, string> = {}): Promise<Result> {
  const out = fresh('out');
  return new Promise((done) => {
    const none = path.join(TMP, 'no-list');
    const vars = { PATH: process.env.PATH ?? '', OUTSIDE_WDQS: `${base}/sparql`, OUTSIDE_WIKIPEDIA: `${base}/wiki/{lang}`, OUTSIDE_COMMONS: `${base}/api`, OUTSIDE_KEPT: '', OUTSIDE_PAUSE: '0', OUTSIDE_PROFILES: none, ...env };
    execFile('node', ['scripts/data/outside.mjs', '--out', out, '--only', 'texts', '--data', data], { cwd: ROOT, env: vars }, (error) => {
      const file = path.join(out, 'countries/texts.json');
      done({
        code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
        raw: () => fs.readFileSync(file, 'utf8'),
        data: () => JSON.parse(fs.readFileSync(file, 'utf8')),
        written: () => fs.existsSync(file),
        source: () => (JSON.parse(fs.readFileSync(path.join(out, 'estado.json'), 'utf8')) as { sources: ReturnType<Result['source']>[] }).sources.find((s) => s.id === 'texts')!,
      });
    });
  });
}

const es = (title: string) => `https://es.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
const en = (title: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

beforeEach(() => {
  asked = [];
  refusals = [];
  atOnce = 20;
  leads = {};
  held = {
    'es:Aland': { text: 'Aland es un país.\nTiene dos islas.', rev: 101 },
    'en:Aland': { text: 'Aland is a country.', rev: 201 },
    'es:Bandera de Aland': { text: 'La bandera de Aland es azul.', rev: 102 },
    'en:Flag of Aland': { text: 'The flag of Aland is blue.', rev: 202 },
    'es:Bélgoña (país)': { text: 'Bélgoña es otro país.', rev: 103 },
    'en:Belgonia': { text: 'Belgonia is another country.', rev: 203 },
  };
});

describe('how Wikipedia begins to tell of each country and of its flag', () => {
  const two = () =>
    game({
      AA: { read: { es: es('Aland'), en: en('Aland') }, readFlag: { es: es('Bandera de Aland'), en: en('Flag of Aland') } },
      // A territory that flies the flag of its country leads to the same page of the flag.
      BB: { read: { es: es('Bélgoña (país)'), en: en('Belgonia') }, readFlag: { es: es('Bandera de Aland'), en: en('Flag of Aland') } },
    });

  it('brings the opening of every page the sheets lead to, by its language and the title the sheet names, with the revision it was read from', async () => {
    const r = await run(two());
    expect(r.code).toBe(0);
    const data = r.data();
    expect(data.source).toContain('Wikipedia');
    expect(data.licence).toContain('CC BY-SA 4.0');
    expect(data.asked).toBe(6);
    expect(data.pages).toEqual({
      'en:Aland': { rev: 201, text: 'Aland is a country.' },
      'en:Belgonia': { rev: 203, text: 'Belgonia is another country.' },
      'en:Flag of Aland': { rev: 202, text: 'The flag of Aland is blue.' },
      'es:Aland': { rev: 101, text: 'Aland es un país.\nTiene dos islas.' },
      'es:Bandera de Aland': { rev: 102, text: 'La bandera de Aland es azul.' },
      'es:Bélgoña (país)': { rev: 103, text: 'Bélgoña es otro país.' },
    });
    expect(r.source()).toMatchObject({ ok: true, detail: { asked: 6, sheets: 2, read: 6, by: { en: 3, es: 3 }, undone: [] } });
    expect(r.source().note).toBe('el comienzo de 6 de 6 páginas, de 2 fichas (en: 3, es: 3)');
    // One line a page, and nothing of when it was brought: the same answer is the same file.
    expect(r.raw().split('\n').filter((line) => line.startsWith('"es:Aland":'))).toHaveLength(1);
    expect(r.raw()).not.toMatch(/20\d\d-\d\d-\d\d/);
    expect((await run(two())).raw()).toBe(r.raw());
  });

  it('asks each Wikipedia once for each page, as plain text and for the opening alone, and says who it is', async () => {
    await run(two());
    expect(asked.map((q) => `${q.lang} ${q.titles.join('|')}`)).toEqual(['en Aland|Belgonia|Flag of Aland', 'es Aland|Bandera de Aland|Bélgoña (país)']);
    for (const q of asked) {
      expect(q.form).toMatchObject({ action: 'query', prop: 'extracts|revisions', exintro: '1', explaintext: '1', exlimit: '20', rvprop: 'ids', redirects: '1', maxlag: '5' });
      expect(q.agent).toMatch(/^regionle-data\/\d/);
    }
  });

  it('asks for twenty pages at a time, and goes on asking for what an answer leaves out', async () => {
    const sheets: Record<string, { read: Links }> = {};
    for (let i = 0; i < 45; i++) {
      const title = `País ${String(i).padStart(2, '0')}`;
      sheets[`C${i}`] = { read: { es: es(title) } };
      held[`es:${title}`] = { text: `Empieza ${i}.`, rev: 1000 + i };
    }
    atOnce = 8;
    const r = await run(game(sheets));
    expect(r.code).toBe(0);
    expect(Object.keys(r.data().pages)).toHaveLength(45);
    expect(r.data().pages['es:País 44']).toEqual({ rev: 1044, text: 'Empieza 44.' });
    // Three lots of titles (20, 20 and 5), each asked until it is whole (three, three and one answers).
    expect(asked.map((q) => [q.titles.length, q.form.excontinue ?? ''])).toEqual([
      [20, ''],
      [20, '8'],
      [20, '16'],
      [20, ''],
      [20, '8'],
      [20, '16'],
      [5, ''],
    ]);
  });

  it('follows a title that leads to another page, and tells which', async () => {
    leads['es:Aland'] = 'República de Aland';
    held['es:República de Aland'] = { text: 'La República de Aland es un país.', rev: 301 };
    const r = await run(two());
    expect(r.data().pages['es:Aland']).toEqual({ title: 'República de Aland', rev: 301, text: 'La República de Aland es un país.' });
    expect(r.data().pages['en:Aland']).toEqual({ rev: 201, text: 'Aland is a country.' });
  });

  it('keeps what it reads when a page is not there or says nothing, and tells which', async () => {
    delete held['en:Belgonia'];
    held['es:Bandera de Aland'] = { text: '  \n ', rev: 102 };
    const r = await run(two());
    expect(r.code).toBe(0);
    expect(Object.keys(r.data().pages).sort()).toEqual(['en:Aland', 'en:Flag of Aland', 'es:Aland', 'es:Bélgoña (país)']);
    expect(r.source()).toMatchObject({ ok: true, detail: { asked: 6, read: 4, by: { en: 2, es: 2 } } });
    expect(r.source().note).toContain('sin comienzo en «en»: Belgonia');
    expect(r.source().note).toContain('sin comienzo en «es»: Bandera de Aland');
  });

  it('keeps one language when the other Wikipedia does not answer, and is not read when neither does', async () => {
    refusals = [{ when: (q) => q.startsWith('en '), status: 500, times: 99 }];
    const r = await run(two(), { OUTSIDE_PATIENCE: '4000' });
    expect(r.code).toBe(0);
    expect(Object.keys(r.data().pages).sort()).toEqual(['es:Aland', 'es:Bandera de Aland', 'es:Bélgoña (país)']);
    expect(r.source()).toMatchObject({ ok: true, detail: { read: 3, by: { en: 0, es: 3 } } });
    expect(r.source().note).toContain('sin mirar: the openings of the Wikipedia in «en»');

    refusals = [{ when: () => true, status: 500, times: 99 }];
    const none = await run(two(), { OUTSIDE_PATIENCE: '4000' });
    expect(none.written()).toBe(false);
    expect(none.source()).toMatchObject({ ok: false, error: expect.stringContaining('opening of no page') });
  });

  it('reads the pages from the addresses of the sheets alone: what is no page of a Wikipedia it looks at is left out', async () => {
    const data = game({
      AA: { read: { es: es('Aland'), en: 'https://example.org/wiki/Aland' }, readFlag: { es: 'https://es.wikipedia.org/w/index.php?title=Bandera', en: 'https://fr.wikipedia.org/wiki/Drapeau' } },
      // A sheet that cannot be read is no reason to bring nothing.
      BB: '{ not a sheet',
      CC: {},
    });
    const r = await run(data);
    expect(r.code).toBe(0);
    expect(r.data().pages).toEqual({ 'es:Aland': { rev: 101, text: 'Aland es un país.\nTiene dos islas.' } });
    expect(asked.map((q) => `${q.lang} ${q.titles.join('|')}`)).toEqual(['es Aland']);
    expect(r.source()).toMatchObject({ ok: true, detail: { asked: 1, sheets: 1 } });
  });

  it('has nothing to ask when no sheet leads to a page', async () => {
    const r = await run(game({ AA: {} }));
    expect(r.written()).toBe(false);
    expect(r.source()).toMatchObject({ ok: false, error: expect.stringContaining('No sheet') });
    expect(asked).toEqual([]);
  });
});
