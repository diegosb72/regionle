// The step that puts in each division how many people live in it (scripts/data/population.mjs), run for
// real on maps and sources made up for the occasion, and then what it left in the maps of the game.

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Index } from './types';

vi.setConfig({ testTimeout: 30_000 });

const ROOT = process.cwd();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'population-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;

/* ------------------------------------------------------------------ made-up maps and sources */

interface Piece {
  id: string;
  ar?: number;
  /** Drawn and never asked. */
  q?: 0;
  /** Left by an earlier run. */
  pop?: number;
  py?: number;
}
interface Land {
  a3: string;
  pop?: number;
  py?: number;
  rp?: number;
  pieces: Piece[];
  /** Groups of pieces, by the id of each group. */
  groups?: Record<string, string[]>;
}
/** What Wikidata is said to have of a division: its first figure, and what the source of the data adds. */
interface Found {
  pop: [number, string | null];
  km2?: number;
  by?: string;
  abroad?: true;
}

function world(lands: Record<string, Land>, found: Record<string, Found>, series: string[], { source = true }: { source?: boolean } = {}) {
  const dir = path.join(TMP, `w${++n}`);
  const [data, src] = [path.join(dir, 'data'), path.join(dir, 'src')];
  fs.mkdirSync(path.join(data, 'r'), { recursive: true });
  fs.mkdirSync(src, { recursive: true });
  const countries = Object.entries(lands).map(([id, l]) => ({ id, a3: l.a3, n: { es: `País ${id}` }, ...(l.pop ? { pop: l.pop } : {}), ...(l.py ? { py: l.py } : {}), ar: 1, ...(l.rp ? { rp: l.rp } : {}), dl: 'f' }));
  fs.writeFileSync(path.join(data, 'index.json'), JSON.stringify({ built: '2026-01-01', countries }));
  for (const [id, l] of Object.entries(lands)) {
    const props = (p: Piece) => ({ n: { es: `Pieza ${p.id}` }, ...(p.q === 0 ? { q: 0 } : {}), lp: [0, 0], ar: p.ar ?? 100, ...(p.pop ? { pop: p.pop } : {}), ...(p.py ? { py: p.py } : {}), nb: [] });
    const fine = l.pieces.map((p) => ({ type: 'Polygon', id: p.id, properties: props(p) }));
    const groups = Object.entries(l.groups ?? {}).map(([gid, m]) => ({ type: 'Polygon', id: gid, properties: { n: { es: `Grupo ${gid}` }, lp: [0, 0], ar: 100 * m.length, m } }));
    // Like the files of the game: where a map has groups, what is drawn and never asked is among them too.
    const loose = l.groups ? l.pieces.filter((p) => p.q === 0).map((p) => ({ type: 'Polygon', id: p.id, properties: props(p) })) : [];
    fs.writeFileSync(path.join(data, 'r', `${id}.json`), JSON.stringify({ type: 'Topology', objects: { ...(l.groups ? { g1: { geometries: [...groups, ...loose] } } : {}), f: { geometries: fine } } }));
  }
  if (source) fs.writeFileSync(path.join(src, 'wikidata-region-population.json'), JSON.stringify({ items: Object.fromEntries(Object.entries(found).map(([id, f]) => [id, { wd: 'Q1', ...(f.by ? { by: f.by } : {}), ...(f.km2 ? { km2: f.km2 } : {}), ...(f.abroad ? { abroad: true } : {}), pop: [f.pop] }])) }));
  fs.writeFileSync(path.join(src, 'population.csv'), ['Country Name,Country Code,Year,Value', ...series].join('\r\n'));
  return { dir, data, src, report: path.join(dir, 'report.txt') };
}

type World = ReturnType<typeof world>;

function run(w: World): Promise<{ code: number; out: string; err: string }> {
  return new Promise((done) => {
    execFile('node', ['scripts/data/population.mjs', '--data', w.data, '--src', w.src, '--report', w.report], { cwd: ROOT, env: { PATH: process.env.PATH ?? '' } }, (error, stdout, stderr) => {
      done({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, out: stdout, err: stderr });
    });
  });
}

interface Props {
  ar?: number;
  pop?: number;
  py?: number;
  q?: 0;
  m?: string[];
}
const file = (w: World, id: string) => JSON.parse(fs.readFileSync(path.join(w.data, 'r', `${id}.json`), 'utf8')) as { objects: Record<string, { geometries: { id: string; properties: Props }[] }> };
/** What each piece of a level of a map carries: [people, year]. */
const figures = (w: World, id: string, level = 'f') => Object.fromEntries(file(w, id).objects[level].geometries.map((g) => [g.id, [g.properties.pop, g.properties.py]]));
const country = (w: World, id: string) => (JSON.parse(fs.readFileSync(path.join(w.data, 'index.json'), 'utf8')) as { countries: { id: string; rp?: number }[] }).countries.find((c) => c.id === id)!;
const verdict = (w: World, id: string) => fs.readFileSync(w.report, 'utf8').split('\n').find((line) => line.startsWith(`${id} `)) ?? '';

/** A country of three pieces that the World Bank says had a thousand people in 2020. */
const THREE: Land = { a3: 'AAA', pop: 5000, py: 2025, pieces: [{ id: 'AA-1' }, { id: 'AA-2' }, { id: 'AA-3' }] };
const SERIES = ['Aland,AAA,2010,500', 'Aland,AAA,2019,900', 'Aland,AAA,2020,1000', 'Aland,AAA,2021,1100'];
const of = (people: number, day: string | null = '2020-07-01', more: Partial<Found> = {}): Found => ({ pop: [people, day], ...more });

/* ------------------------------------------------------------------ the tests */

describe('the people of the divisions of a country', () => {
  it('are written when every division has a figure and together they are the people of the country', async () => {
    const w = world({ AA: THREE }, { 'AA-1': of(600), 'AA-2': of(300, '2021-01-01'), 'AA-3': of(90, null) }, SERIES);
    const r = await run(w);
    expect(r.code).toBe(0);
    expect(figures(w, 'AA')).toEqual({ 'AA-1': [600, 2020], 'AA-2': [300, 2021], 'AA-3': [90, undefined] });
    // The year most of the figures are of: what the country is set against, and what the game says.
    expect(country(w, 'AA').rp).toBe(2020);
    expect(verdict(w, 'AA')).toContain('sí: suman 990 de 1,000 en 2020 (0.99), cifras de 2020 a 2021');
    expect(r.out).toContain('1 de 1 países (3 de 3 divisiones)');
  });

  it('go after the area of each piece, and nothing else of the file changes', async () => {
    const w = world({ AA: THREE }, { 'AA-1': of(600), 'AA-2': of(300), 'AA-3': of(100) }, SERIES);
    const before = fs.readFileSync(path.join(w.data, 'r', 'AA.json'), 'utf8');
    await run(w);
    const after = fs.readFileSync(path.join(w.data, 'r', 'AA.json'), 'utf8');
    // The file as it was, with the two figures of each piece put in by hand.
    let expected = before;
    for (const people of [600, 300, 100]) expected = expected.replace('"ar":100,"nb"', `"ar":100,"pop":${people},"py":2020,"nb"`);
    expect(after).toBe(expected);
    expect(after).not.toBe(before);
    expect(Object.keys(file(w, 'AA').objects.f.geometries[0].properties)).toEqual(['n', 'lp', 'ar', 'pop', 'py', 'nb']);
  });

  it('are set against the country as it was in the year of the figures, not as it is now', async () => {
    // Half the people of 2020, counted in 2010, when the country had half of them.
    const w = world({ AA: THREE }, { 'AA-1': of(300, '2010-01-01'), 'AA-2': of(150, '2010-01-01'), 'AA-3': of(50, '2010-01-01') }, SERIES);
    await run(w);
    expect(country(w, 'AA').rp).toBe(2010);
    expect(figures(w, 'AA')['AA-1']).toEqual([300, 2010]);
    // The same figures said to be of 2020 are half of what the country had.
    const late = world({ AA: THREE }, { 'AA-1': of(300), 'AA-2': of(150), 'AA-3': of(50) }, SERIES);
    await run(late);
    expect(country(late, 'AA').rp).toBeUndefined();
    expect(figures(late, 'AA')).toEqual({ 'AA-1': [undefined, undefined], 'AA-2': [undefined, undefined], 'AA-3': [undefined, undefined] });
    expect(verdict(late, 'AA')).toContain('no cuadra: sus divisiones suman 500 y el país tenía 1,000 en 2020 (0.50)');
  });

  it('may be a tenth away from the people of the country, and no more', async () => {
    for (const [sum, ok] of [[900, true], [899, false], [1100, true], [1101, false]] as const) {
      const w = world({ AA: THREE }, { 'AA-1': of(sum - 400), 'AA-2': of(300), 'AA-3': of(100) }, SERIES);
      await run(w);
      expect(country(w, 'AA').rp).toBe(ok ? 2020 : undefined);
    }
  });

  it('are set against the nearest year the World Bank has, and against what the maps say where it has none', async () => {
    // Counted after the last year of the series.
    const late = world({ AA: THREE }, { 'AA-1': of(700, '2030-01-01'), 'AA-2': of(300, '2030-01-01'), 'AA-3': of(100, '2030-01-01') }, SERIES);
    await run(late);
    expect(verdict(late, 'AA')).toContain('sí: suman 1,100 de 1,100 en 2030');
    // A country the World Bank does not know: the maps say it has 5000 people.
    const lost = world({ AA: { ...THREE, a3: 'ZZZ' } }, { 'AA-1': of(3000), 'AA-2': of(1500), 'AA-3': of(400) }, SERIES);
    await run(lost);
    expect(verdict(lost, 'AA')).toContain('sí: suman 4,900 de 5,000 en 2020');
    // And one of which nothing is known has nothing to be set against.
    const blank = world({ AA: { a3: 'ZZZ', pieces: THREE.pieces } }, { 'AA-1': of(3000), 'AA-2': of(1500), 'AA-3': of(400) }, SERIES);
    await run(blank);
    expect(country(blank, 'AA').rp).toBeUndefined();
    expect(verdict(blank, 'AA')).toContain('no hay con qué comparar');
  });

  it('reads the World Bank under its own code where the maps have another, and past a name with a comma in it', async () => {
    const w = world({ XK: { a3: 'KOS', pieces: [{ id: 'XK-1' }, { id: 'XK-2' }] }, BS: { a3: 'BHS', pieces: [{ id: 'BS-1' }, { id: 'BS-2' }] } }, { 'XK-1': of(60), 'XK-2': of(40), 'BS-1': of(30), 'BS-2': of(20) }, ['Kosovo,XKX,2020,100', '"Bahamas, The",BHS,2020,50']);
    await run(w);
    expect(country(w, 'XK').rp).toBe(2020);
    expect(country(w, 'BS').rp).toBe(2020);
  });

  it('with figures that have no date are set against the country as the maps have it', async () => {
    const w = world({ AA: { ...THREE, a3: 'ZZZ' } }, { 'AA-1': of(3000, null), 'AA-2': of(1500, null), 'AA-3': of(500, null) }, SERIES);
    await run(w);
    expect(country(w, 'AA').rp).toBe(2025);
    expect(figures(w, 'AA')).toEqual({ 'AA-1': [3000, undefined], 'AA-2': [1500, undefined], 'AA-3': [500, undefined] });
    expect(verdict(w, 'AA')).toContain('cifras sin fecha');
  });
});

describe('a country gets none', () => {
  it('when a division has no figure, and loses what an earlier run left', async () => {
    const stale: Land = { ...THREE, rp: 2015, pieces: [{ id: 'AA-1', pop: 5, py: 2015 }, { id: 'AA-2', pop: 6 }, { id: 'AA-3' }], groups: { 'AA~g': ['AA-1', 'AA-2'] } };
    const w = world({ AA: stale }, { 'AA-1': of(600), 'AA-2': of(400) }, SERIES);
    const r = await run(w);
    expect(r.code).toBe(0);
    expect(figures(w, 'AA')).toEqual({ 'AA-1': [undefined, undefined], 'AA-2': [undefined, undefined], 'AA-3': [undefined, undefined] });
    expect(figures(w, 'AA', 'g1')).toEqual({ 'AA~g': [undefined, undefined] });
    expect(country(w, 'AA').rp).toBeUndefined();
    expect(verdict(w, 'AA')).toContain('faltan 1 de 3: AA-3 Pieza AA-3 (sin cifra)');
    expect(r.out).toContain('0 de 1 países (0 de 3 divisiones); a 1 les faltan cifras y en 0 no cuadran');
  });

  it('when the figure of a division cannot be of it', async () => {
    const reasons: [Found, string][] = [
      [of(100, '2020-01-01', { abroad: true }), 'entidad de otro país'],
      [of(12.486), 'cifra que no es un número de personas'],
      [of(-3), 'cifra que no es un número de personas'],
      [of(0), 'cifra de cero habitantes'],
      // The entity the maps name is a fifth of the piece: the city the province is called after.
      [of(100, '2020-01-01', { km2: 20 }), 'entidad mucho menor que la división'],
    ];
    for (const [found, why] of reasons) {
      const w = world({ AA: THREE }, { 'AA-1': of(600), 'AA-2': of(300), 'AA-3': found }, SERIES);
      await run(w);
      expect(country(w, 'AA').rp).toBeUndefined();
      expect(verdict(w, 'AA')).toContain(`faltan 1 de 3: AA-3 Pieza AA-3 (${why})`);
    }
  });

  it('but an entity of another size is taken when it is three tenths of the piece, a thousandth, or was looked for by code or by name', async () => {
    for (const found of [of(100, '2020-01-01', { km2: 30 }), of(100, '2020-01-01', { km2: 0.1 }), of(100, '2020-01-01', { km2: 20, by: 'code' }), of(100, '2020-01-01', { km2: 5000 }), of(100)]) {
      const w = world({ AA: THREE }, { 'AA-1': of(600), 'AA-2': of(300), 'AA-3': found }, SERIES);
      await run(w);
      expect(country(w, 'AA').rp).toBe(2020);
    }
  });

  it('when it is a map of a single piece, which is the country', async () => {
    const w = world({ AA: { ...THREE, rp: 2001, pieces: [{ id: 'AA-1', pop: 9 }] } }, { 'AA-1': of(1000) }, SERIES);
    const r = await run(w);
    expect(figures(w, 'AA')).toEqual({ 'AA-1': [undefined, undefined] });
    expect(country(w, 'AA').rp).toBeUndefined();
    expect(r.out).toContain('0 de 0 países');
  });
});

describe('what is drawn and never asked', () => {
  it('needs no figure, and counts with the rest when it has one', async () => {
    const land: Land = { ...THREE, pieces: [...THREE.pieces, { id: 'AA-base', q: 0 }] };
    const none = world({ AA: land }, { 'AA-1': of(600), 'AA-2': of(300), 'AA-3': of(100) }, SERIES);
    await run(none);
    expect(country(none, 'AA').rp).toBe(2020);
    expect(figures(none, 'AA')['AA-base']).toEqual([undefined, undefined]);
    expect(verdict(none, 'AA')).toMatch(/^AA País AA\s+3 sí/);
    // With its own two hundred people, the pieces are a fifth more than the country.
    const some = world({ AA: land }, { 'AA-1': of(600), 'AA-2': of(300), 'AA-3': of(100), 'AA-base': of(200) }, SERIES);
    await run(some);
    expect(country(some, 'AA').rp).toBeUndefined();
  });
});

describe('the groups of divisions', () => {
  it('carry the sum of their members, as old as the oldest of them', async () => {
    const land: Land = { ...THREE, pieces: [...THREE.pieces, { id: 'AA-base', q: 0 }], groups: { 'AA~n': ['AA-1', 'AA-2'], 'AA~s': ['AA-3'] } };
    const w = world({ AA: land }, { 'AA-1': of(600, '2021-01-01'), 'AA-2': of(300, '2019-05-05'), 'AA-3': of(100) }, SERIES);
    await run(w);
    expect(figures(w, 'AA', 'g1')).toEqual({ 'AA~n': [900, 2019], 'AA~s': [100, 2020], 'AA-base': [undefined, undefined] });
    expect(Object.keys(file(w, 'AA').objects.g1.geometries[0].properties)).toEqual(['n', 'lp', 'ar', 'pop', 'py', 'm']);
  });

  it('carry no year when a member has none', async () => {
    const w = world({ AA: { ...THREE, groups: { 'AA~n': ['AA-1', 'AA-2'] } } }, { 'AA-1': of(600), 'AA-2': of(300, null), 'AA-3': of(100) }, SERIES);
    await run(w);
    expect(figures(w, 'AA', 'g1')).toEqual({ 'AA~n': [900, undefined] });
  });
});

describe('a division whose figure counts others that the map draws apart', () => {
  const RUSSIA: Land = { a3: 'RUS', pieces: [{ id: 'RU-TYU' }, { id: 'RU-KHM' }, { id: 'RU-YAN' }, { id: 'RU-MOW' }] };

  it('is left with what is its own', async () => {
    const w = world({ RU: RUSSIA }, { 'RU-TYU': of(390), 'RU-KHM': of(176), 'RU-YAN': of(52), 'RU-MOW': of(610) }, ['Russia,RUS,2020,1000']);
    await run(w);
    expect(figures(w, 'RU')).toEqual({ 'RU-TYU': [162, 2020], 'RU-KHM': [176, 2020], 'RU-YAN': [52, 2020], 'RU-MOW': [610, 2020] });
    expect(verdict(w, 'RU')).toContain('sí: suman 1,000 de 1,000');
  });

  it('has none when one of those has none, or when they are more than it', async () => {
    const short = world({ RU: RUSSIA }, { 'RU-TYU': of(390), 'RU-KHM': of(176), 'RU-MOW': of(610) }, ['Russia,RUS,2020,1000']);
    await run(short);
    expect(verdict(short, 'RU')).toContain('faltan 2 de 4: RU-TYU Pieza RU-TYU (cuenta lo de otras divisiones, que no tienen cifra); RU-YAN Pieza RU-YAN (sin cifra)');
    const over = world({ RU: RUSSIA }, { 'RU-TYU': of(200), 'RU-KHM': of(176), 'RU-YAN': of(52), 'RU-MOW': of(610) }, ['Russia,RUS,2020,1000']);
    await run(over);
    expect(country(over, 'RU').rp).toBeUndefined();
  });
});

describe('the step', () => {
  it('leaves everything as it was when it is run again', async () => {
    const w = world({ AA: { ...THREE, groups: { 'AA~n': ['AA-1', 'AA-2'] } }, BB: { a3: 'BBB', pieces: [{ id: 'BB-1' }, { id: 'BB-2' }] } }, { 'AA-1': of(600), 'AA-2': of(300), 'AA-3': of(100), 'BB-1': of(5) }, SERIES);
    const first = await run(w);
    expect(first.out).toContain('Archivos cambiados: 1 y el índice.');
    const read = () => ['index.json', 'r/AA.json', 'r/BB.json'].map((f) => fs.readFileSync(path.join(w.data, f), 'utf8'));
    const written = read();
    const again = await run(w);
    expect(again.out).toContain('Archivos cambiados: 0.');
    expect(read()).toEqual(written);
  });

  it('stops, and touches nothing, when a source is not there', async () => {
    const w = world({ AA: THREE }, {}, SERIES, { source: false });
    const before = fs.readFileSync(path.join(w.data, 'index.json'), 'utf8');
    const r = await run(w);
    expect(r.code).toBe(1);
    expect(r.err).toContain('wikidata-region-population.json: se trae con «npm run data:fetch»');
    expect(fs.readFileSync(path.join(w.data, 'index.json'), 'utf8')).toBe(before);
  });
});

/* ------------------------------------------------------------------ the maps of the game */

describe('the maps of the game', () => {
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/index.json'), 'utf8')) as Index;
  const pieces = (id: string, level = 'f') => (JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/r', `${id}.json`), 'utf8')) as { objects: Record<string, { geometries: { id: string; properties: Props }[] }> }).objects[level]?.geometries ?? [];
  const peopled = index.countries.filter((c) => c.rp != null);

  it('carry the people of the divisions of a good half of the countries that have divisions', () => {
    expect(peopled.length).toBeGreaterThanOrEqual(100);
    for (const id of ['ES', 'FR', 'DE', 'US', 'MX', 'AR', 'BR', 'CO', 'CL', 'CN', 'IN', 'JP', 'RU', 'BE', 'CZ']) expect(peopled.map((c) => c.id)).toContain(id);
    // Where Wikidata's figures are missing or do not add up, there are none: see the README.
    for (const id of ['PT', 'IT', 'GB', 'PE', 'HU', 'IE']) expect(peopled.map((c) => c.id)).not.toContain(id);
  });

  it('give every division that is asked about a figure where the country has them, and none anywhere else', () => {
    for (const c of index.countries) {
      if (!fs.existsSync(path.join(ROOT, 'public/data/r', `${c.id}.json`))) continue;
      const asked = pieces(c.id).filter((g) => g.properties.q !== 0);
      const withPeople = asked.filter((g) => Number.isInteger(g.properties.pop) && g.properties.pop! > 0);
      expect([c.id, withPeople.length]).toEqual([c.id, c.rp != null ? asked.length : 0]);
      for (const g of asked) if (g.properties.py != null) expect(g.properties.py).toBeGreaterThan(1980);
    }
  });

  it('add up to the people of each country, give or take what years apart and the tolerance allow', () => {
    for (const c of peopled) {
      const sum = pieces(c.id).reduce((s, g) => s + (g.properties.pop ?? 0), 0);
      // Against the country as it is today, which the figures of an older year fall short of.
      expect([c.id, sum / c.pop! > 0.5 && sum / c.pop! < 1.35]).toEqual([c.id, true]);
    }
    const spain = pieces('ES').reduce((s, g) => s + (g.properties.pop ?? 0), 0);
    expect(spain / index.countries.find((c) => c.id === 'ES')!.pop!).toBeGreaterThan(0.97);
    expect(pieces('ES').find((g) => g.id === 'ES-M')!.properties).toMatchObject({ pop: expect.any(Number), py: expect.any(Number) });
    expect(pieces('ES').find((g) => g.id === 'ES-M')!.properties.pop).toBeGreaterThan(6_500_000);
  });

  it('give each group of divisions the sum of its members', () => {
    for (const c of peopled) {
      const fine = new Map(pieces(c.id).map((g) => [g.id, g.properties.pop ?? 0]));
      for (const level of c.lv.map((l) => l.k).filter((k) => k !== 'f')) {
        for (const g of pieces(c.id, level).filter((x) => x.properties.m)) expect([g.id, g.properties.pop]).toEqual([g.id, g.properties.m!.reduce((s, m) => s + fine.get(m)!, 0)]);
      }
    }
    // Andalucía is its eight provinces.
    expect(pieces('ES', 'g1').find((g) => g.id === 'ES~AN' || g.properties.m?.includes('ES-SE'))!.properties.pop).toBeGreaterThan(8_000_000);
  });

  it('do not count twice the two districts that Wikidata counts in the oblast of Tyumen', () => {
    const people = (id: string) => pieces('RU').find((g) => g.id === id)!.properties.pop!;
    expect(people('RU-TYU')).toBeGreaterThan(1_000_000);
    expect(people('RU-TYU')).toBeLessThan(2_000_000);
    expect(people('RU-KHM')).toBeGreaterThan(1_500_000);
  });
});
