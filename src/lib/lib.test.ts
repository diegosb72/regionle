import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildDeck, deckGraph, eligible, loadIndex, setLoader } from './data';
import { bfs, capOf, makeView, onShortest, pickRoute, shortestPath } from './geo';
import { Matcher, editDistance, fmtBig, fmtTime, judgeAmount, key, mulberry32, norm, parseNumber } from './text';

describe('text', () => {
  it('normalises accents, case and punctuation', () => {
    expect(norm('  Castilla-La  Mancha ')).toBe('castilla la mancha');
    expect(key('La Coruña')).toBe('coruna');
    expect(key("Saint John's")).toBe(key('St. Johns'));
    expect(key('Baden-Württemberg')).toBe('badenwurttemberg');
    expect(key('Łódź')).toBe('lodz');
  });

  it('measures typos', () => {
    expect(editDistance('zaragoza', 'saragoza', 2)).toBe(1);
    expect(editDistance('teruel', 'tereul', 2)).toBe(1);
    expect(editDistance('madrid', 'barcelona', 2)).toBe(3);
  });

  const m = new Matcher([
    { id: 'NE', answers: ['Níger', 'Niger'] },
    { id: 'NG', answers: ['Nigeria'] },
    { id: 'GN', answers: ['Guinea'] },
    { id: 'GQ', answers: ['Guinea Ecuatorial', 'Equatorial Guinea'] },
    { id: 'ES-A', answers: ['Alicante', 'Alacant/Alicante'] },
    { id: 'ES-M', answers: ['Madrid', 'Comunidad de Madrid'] },
    { id: 'MZ-MPM', answers: ['Maputo (ciudad)'] },
  ]);

  it('matches exact spellings before guessing typos', () => {
    expect(m.check('niger', 'NE')).toEqual({ res: 'yes' });
    expect(m.check('niger', 'NG')).toEqual({ res: 'other', id: 'NE' });
    expect(m.check('Nigerai', 'NG')).toEqual({ res: 'yes' });
    expect(m.check('xyz', 'NG')).toEqual({ res: 'no' });
  });

  it('accepts aliases, slashed names and generic prefixes', () => {
    expect(m.lookup('alacant')).toEqual(['ES-A']);
    expect(m.lookup('Provincia de Alicante')).toEqual(['ES-A']);
    expect(m.lookup('comunidad de madrid')).toEqual(['ES-M']);
    expect(m.lookup('maputo')).toEqual(['MZ-MPM']);
  });

  it('knows when to wait for more letters', () => {
    expect(m.isPrefixOf('Guinea', new Set(['GN', 'GQ']))).toBe(true);
    expect(m.isPrefixOf('Guinea', new Set(['GN']))).toBe(false);
    expect(m.suggest('gui')).toEqual(['GN', 'GQ']);
  });

  it('reads and formats numbers the Spanish way', () => {
    expect(parseNumber('1.400')).toBe(1400);
    expect(parseNumber('1,4')).toBe(1.4);
    expect(parseNumber('1.4')).toBe(1.4);
    expect(parseNumber('47 000 000')).toBe(47000000);
    expect(parseNumber('1.234.567,5')).toBe(1234567.5);
    expect(parseNumber('abc')).toBeNull();
    expect(fmtBig(49_355_143)).toBe('49,4 millones');
    expect(fmtBig(1_000_000)).toBe('1 millón');
    expect(fmtBig(825)).toBe('825');
    expect(fmtTime(65_000)).toBe('1:05');
    expect(judgeAmount(50e6, 49.4e6).res).toBe('ok');
    expect(judgeAmount(40e6, 49.4e6).res).toBe('warn');
    expect(judgeAmount(10e6, 49.4e6).res).toBe('bad');
  });
});

describe('graph', () => {
  const g = new Map([
    ['a', ['b']],
    ['b', ['a', 'c', 'e']],
    ['c', ['b', 'd']],
    ['d', ['c', 'e']],
    ['e', ['b', 'd']],
    ['z', []],
  ]);
  it('finds distances and paths', () => {
    expect(bfs(g, 'a').get('d')).toBe(3);
    expect(shortestPath(g, 'a', 'd')).toHaveLength(4);
    expect(shortestPath(g, 'a', 'z')).toBeNull();
    expect([...onShortest(g, 'a', 'd')].sort()).toEqual(['b', 'c', 'e']);
  });
  it('picks a route of the requested length', () => {
    const r = pickRoute(g, mulberry32(7), 3, 5)!;
    expect(r.steps).toBe(3);
    expect(bfs(g, r.from).get(r.to)).toBe(3);
  });
});

describe('data', () => {
  beforeAll(() => {
    setLoader(async (p) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data', p), 'utf8')));
  });

  it('has the 193 UN members', async () => {
    const { index } = await loadIndex();
    expect(index.countries.filter((c) => c.cl === 'un')).toHaveLength(193);
    expect(index.countries.filter((c) => eligible('regions', c)).length).toBeGreaterThan(190);
  });

  it('builds Spain by provinces and by autonomous communities', async () => {
    const fine = await buildDeck({ scope: 'regions', countries: ['ES'], levels: { ES: 'f' } });
    expect(fine.items).toHaveLength(52);
    expect(fine.byId.get('ES-TE')!.parent).toBe('Aragón');
    expect(fine.byId.get('ES-M')!.nb.sort()).toEqual(['ES-AV', 'ES-CU', 'ES-GU', 'ES-SG', 'ES-TO']);
    const coarse = await buildDeck({ scope: 'regions', countries: ['ES'] });
    expect(coarse.items).toHaveLength(19);
    expect(coarse.noun.fem).toBe(true);
    const madrid = coarse.items.find((it) => it.name.includes('Madrid'))!;
    expect(madrid.nb.map((id) => coarse.byId.get(id)!.name).sort()).toEqual(['Castilla y León', 'Castilla-La Mancha']);
  });

  it('links regions across borders', async () => {
    const deck = await buildDeck({ scope: 'regions', countries: ['ES', 'PT', 'FR'] });
    const graph = deckGraph(deck);
    const galicia = deck.items.find((it) => it.name === 'Galicia')!;
    expect(galicia.nb.some((id) => deck.byId.get(id)!.country.id === 'PT')).toBe(true);
    const paris = deck.items.find((it) => it.name.startsWith('Isla de Francia') || it.en === 'Île-de-France')!;
    expect(bfs(graph, galicia.id).get(paris.id)).toBeGreaterThan(2);
    expect(deck.title).toContain('3 países');
  });

  it('frames Europe without Siberia and the world as a whole', async () => {
    const { index } = await loadIndex();
    const europe = index.countries.filter((c) => c.ct === 'EU' && c.cl === 'un').map((c) => c.id);
    const eu = await buildDeck({ scope: 'countries', countries: europe });
    expect(eu.title).toContain('Europa');
    expect(capOf(eu.frame).radius).toBeLessThan(40);
    expect(makeView(eu.frame).world).toBe(false);
    const all = await buildDeck({ scope: 'countries', countries: index.countries.map((c) => c.id) });
    expect(all.items).toHaveLength(249);
    expect(makeView(all.frame).world).toBe(true);
    expect(all.byId.get('ES')!.nb.sort()).toEqual(['AD', 'FR', 'GI', 'MA', 'PT']);
  });

  it('gives every country a name, a label point and a level', async () => {
    const { index } = await loadIndex();
    for (const c of index.countries) {
      expect(c.n.es, c.id).toBeTruthy();
      expect(c.lp, c.id).toHaveLength(2);
      expect(c.lv.length, c.id).toBeGreaterThan(0);
      expect(c.lv.some((l) => l.k === c.dl), c.id).toBe(true);
    }
  });
});
