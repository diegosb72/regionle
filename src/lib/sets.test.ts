import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildDeck, loadIndex, setLoader } from './data';
import { buildCityDeck, buildPhysicalDeck } from './extra';
import { setLang } from './i18n';
import { SET_MAX, dealSets, judgeSet, setsOf, type PieceSet, type Places } from './sets';
import { mulberry32 } from './text';

let places: Places;
let europe: string[];
let world: string[];

beforeAll(async () => {
  setLoader(async (p) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data', p), 'utf8')));
  setLang('es');
  const { index } = await loadIndex();
  places = { continents: index.continents, subregions: index.subregions };
  europe = index.countries.filter((c) => c.ct === 'EU' && c.cl === 'un').map((c) => c.id);
  world = index.countries.filter((c) => c.cl === 'un').map((c) => c.id);
});

const byId = (sets: PieceSet[], id: string) => sets.find((s) => s.id === id);

describe('the sets of a map of countries', () => {
  it('are the organisations, the traits and the parts of the continent that the map has', async () => {
    const deck = await buildDeck({ scope: 'countries', countries: europe, levels: {} });
    const sets = setsOf(deck, places);
    const eu = byId(sets, 'eu')!;
    expect(eu).toMatchObject({ kind: 'org', lead: 'Marca sus países', name: 'Unión Europea' });
    expect(eu.members).toHaveLength(27);
    expect(eu.members).toContain('ES');
    expect(eu.members).not.toContain('NO');
    expect(byId(sets, 'nato')!.members).toContain('NO');
    expect(byId(sets, 'landlocked')).toMatchObject({ kind: 'trait', lead: 'Marca los países', name: 'Sin salida al mar' });
    expect(byId(sets, 'landlocked')!.members).toEqual(expect.arrayContaining(['CH', 'AT', 'AD', 'LU']));
    expect(byId(sets, 'landlocked')!.members).not.toContain('ES');
    expect(byId(sets, 'sr:EU-S')).toMatchObject({ kind: 'place', lead: 'Marca sus países', name: 'Europa del Sur' });
    expect(byId(sets, 'sr:EU-S')!.members).toEqual(expect.arrayContaining(['ES', 'PT', 'IT', 'GR']));
    // The whole map is no set, nor is what the map has one piece of or none.
    expect(byId(sets, 'ct:EU')).toBeUndefined();
    expect(byId(sets, 'ct:AF')).toBeUndefined();
    expect(byId(sets, 'brics')).toBeUndefined();
    expect(byId(sets, 'arab')).toBeUndefined();
    // What borders a country, for the ones that border three or more: the country itself is not marked.
    const fr = byId(sets, 'nb:FR')!;
    expect(fr).toMatchObject({ kind: 'nb', lead: 'Marca los países que limitan con', name: 'Francia', anchor: 'FR' });
    expect([...fr.members].sort()).toEqual(['AD', 'BE', 'CH', 'DE', 'ES', 'IT', 'LU', 'MC']);
    expect(byId(sets, 'nb:PT')).toBeUndefined();
    for (const s of sets) {
      expect(s.members.length, s.id).toBeGreaterThanOrEqual(2);
      expect(deck.items.length - s.members.length, s.id).toBeGreaterThanOrEqual(2);
      expect(new Set(s.members).size, s.id).toBe(s.members.length);
      for (const id of s.members) expect(deck.byId.has(id), `${s.id} ${id}`).toBe(true);
    }
  });

  it('leave out what would be a chore on the map of the world, and what names its own answer', async () => {
    const deck = await buildDeck({ scope: 'countries', countries: world, levels: {} });
    const sets = setsOf(deck, places);
    expect(byId(sets, 'ct:AF')).toBeUndefined();
    expect(byId(sets, 'ct:EU')).toBeUndefined();
    expect(byId(sets, 'ct:OC')!.members).toHaveLength(14);
    expect(byId(sets, 'sr:AF-N')!.name).toBe('África del Norte');
    expect(byId(sets, 'sr:OC-A')).toBeUndefined();
    expect(byId(sets, 'brics')!.members).toHaveLength(10);
    expect(byId(sets, 'arab')!.members.length).toBeGreaterThanOrEqual(21);
    expect(byId(sets, 'spanish')!.members).toEqual(expect.arrayContaining(['ES', 'MX', 'AR', 'GQ']));
    for (const s of sets) expect(s.members.length, s.id).toBeLessThanOrEqual(SET_MAX);
    // In English, in English: the map itself is drawn again when the language changes.
    setLang('en');
    const en = setsOf(await buildDeck({ scope: 'countries', countries: world, levels: {} }), places);
    setLang('es');
    expect(byId(en, 'eu')).toMatchObject({ lead: 'Mark its countries', name: 'European Union' });
    expect(byId(en, 'landlocked')).toBeUndefined();
    expect(byId(en, 'mediterranean')).toMatchObject({ lead: 'Mark the countries', name: 'With a coast on the Mediterranean' });
    expect(byId(en, 'nb:FR')).toMatchObject({ lead: 'Mark the countries that border', name: 'France' });
  });

  it('are the same question once when two of them have the same pieces', async () => {
    // On this map the Union, the Schengen Area and NATO are the same three, and so is what borders Belgium.
    const deck = await buildDeck({ scope: 'countries', countries: ['FR', 'DE', 'BE', 'NL', 'CH', 'GB', 'IE'], levels: {} });
    const sets = setsOf(deck, places);
    const keys = sets.map((s) => [...s.members].sort().join(','));
    expect(new Set(keys).size).toBe(keys.length);
    expect(byId(sets, 'eu')).toBeDefined();
  });
});

describe('the sets of a map of regions', () => {
  it('are the communities of the provinces, and what borders each one', async () => {
    const deck = await buildDeck({ scope: 'regions', countries: ['ES'], levels: { ES: 'f' } });
    const sets = setsOf(deck);
    const an = sets.find((s) => s.name === 'Andalucía' && s.kind === 'parent')!;
    expect(an).toMatchObject({ lead: 'Marca sus provincias', sub: 'comunidad autónoma' });
    expect(an.members.map((id) => deck.byId.get(id)!.name).sort()).toEqual(['Almería', 'Cádiz', 'Córdoba', 'Granada', 'Huelva', 'Jaén', 'Málaga', 'Sevilla']);
    // A community of a single province is no set to mark.
    expect(sets.find((s) => s.name === 'Región de Murcia' && s.kind === 'parent')).toBeUndefined();
    expect(sets.filter((s) => s.kind === 'parent').map((s) => s.name).sort()).toEqual(['Andalucía', 'Aragón', 'Canarias', 'Castilla y León', 'Castilla-La Mancha', 'Cataluña', 'Comunidad Valenciana', 'Extremadura', 'Galicia', 'País Vasco']);
    const madrid = sets.find((s) => s.kind === 'nb' && s.name === 'Madrid')!;
    expect(madrid.lead).toBe('Marca las provincias que limitan con');
    expect(madrid.members.map((id) => deck.byId.get(id)!.name).sort()).toEqual(['Cuenca', 'Guadalajara', 'Segovia', 'Toledo', 'Ávila'].sort());
    expect(madrid.anchor).toBe(madrid.id.slice(3));
  });

  it('are only what borders each piece where the map has a single level of a single country', async () => {
    const deck = await buildDeck({ scope: 'regions', countries: ['ES'], levels: { ES: 'g1' } });
    const sets = setsOf(deck);
    expect(sets.length).toBeGreaterThan(8);
    expect(sets.every((s) => s.kind === 'nb')).toBe(true);
    expect(sets.find((s) => s.name === 'Castilla y León')!.members).toHaveLength(9);
    expect(sets.find((s) => s.name === 'Castilla y León')!.lead).toBe('Marca las comunidades autónomas que limitan con');
  });

  it('are the regions of each country on a map of several', async () => {
    const deck = await buildDeck({ scope: 'regions', countries: ['ES', 'PT', 'FR'], levels: { ES: 'g1' } });
    const sets = setsOf(deck);
    const pt = byId(sets, 'of:PT')!;
    expect(pt).toMatchObject({ kind: 'parent', name: 'Portugal', sub: 'país' });
    expect(pt.members.length).toBeGreaterThan(15);
    expect(pt.members.every((id) => deck.byId.get(id)!.country.id === 'PT')).toBe(true);
    expect(byId(sets, 'of:ES')!.members).toHaveLength(19);
  });
});

describe('the sets of other maps', () => {
  it('are the cities of each country, or of each region of one country', async () => {
    const several = await buildCityDeck(['ES', 'PT', 'FR'], 'top', 25, undefined, true);
    const sets = setsOf(several);
    expect(sets.map((s) => s.name).sort()).toEqual(['España', 'Francia', 'Portugal']);
    expect(sets[0].lead).toBe('Marca sus ciudades');
    expect(sets.every((s) => s.kind === 'parent' && !s.anchor)).toBe(true);
    const one = await buildCityDeck(['ES'], 'top', 50, undefined, true);
    const regions = setsOf(one);
    expect(regions.length).toBeGreaterThan(4);
    const an = regions.find((s) => s.name === 'Andalucía')!;
    expect(an.sub).toBe('comunidad autónoma');
    expect(an.members.map((id) => one.byId.get(id)!.name)).toEqual(expect.arrayContaining(['Sevilla', 'Málaga']));
    // Without what each city belongs to there is nothing to ask.
    expect(setsOf(await buildCityDeck(['ES'], 'top', 50))).toEqual([]);
  });

  it('are none among rivers and ranges', async () => {
    expect(setsOf(await buildPhysicalDeck(['river', 'EU']))).toEqual([]);
  });
});

describe('dealing the sets of a game', () => {
  const mk = (kind: PieceSet['kind'], n: number): PieceSet[] => Array.from({ length: n }, (_, i) => ({ id: `${kind}${i}`, kind, lead: '', name: `${kind}${i}`, members: ['a', 'b'] }));

  it('takes as many as asked, each once, the same ones for the same game', () => {
    const sets = [...mk('org', 6), ...mk('place', 5), ...mk('nb', 12)];
    const deal = dealSets(sets, 10, mulberry32(4));
    expect(deal).toHaveLength(10);
    expect(new Set(deal.map((s) => s.id)).size).toBe(10);
    expect(dealSets(sets, 10, mulberry32(4)).map((s) => s.id)).toEqual(deal.map((s) => s.id));
    expect(dealSets(sets, 10, mulberry32(5)).map((s) => s.id)).not.toEqual(deal.map((s) => s.id));
    expect(dealSets(sets, 50, mulberry32(4))).toHaveLength(23);
    expect(dealSets([], 10, mulberry32(4))).toEqual([]);
  });

  it('keeps what borders a piece to a third of the game while there is something else', () => {
    const sets = [...mk('org', 6), ...mk('place', 5), ...mk('nb', 12)];
    for (let seed = 1; seed <= 20; seed++) {
      const deal = dealSets(sets, 9, mulberry32(seed));
      expect(deal.filter((s) => s.kind === 'nb')).toHaveLength(3);
    }
    // Where there is little else, they fill in; where there is nothing else, they are the game.
    expect(dealSets([...mk('org', 2), ...mk('nb', 12)], 10, mulberry32(1)).filter((s) => s.kind === 'nb')).toHaveLength(8);
    expect(dealSets(mk('nb', 12), 10, mulberry32(1))).toHaveLength(10);
    // And where there are none, the game does without.
    expect(dealSets(mk('parent', 12), 10, mulberry32(1)).every((s) => s.kind === 'parent')).toBe(true);
  });

  it('does not ask the same kind three times running while it can', () => {
    const sets = [...mk('org', 5), ...mk('place', 5), ...mk('nb', 5)];
    for (let seed = 1; seed <= 30; seed++) {
      const kinds = dealSets(sets, 12, mulberry32(seed)).map((s) => s.kind);
      for (let i = 2; i < kinds.length; i++) expect(kinds[i] === kinds[i - 1] && kinds[i] === kinds[i - 2], `${seed}: ${kinds.join(' ')}`).toBe(false);
    }
  });
});

describe('judging a set that was marked', () => {
  const eight = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  it('takes all of it and nothing else as right', () => {
    expect(judgeSet(eight, [...eight].reverse())).toEqual({ right: eight, missed: [], extra: [], res: 'ok' });
  });

  it('takes a slip or two in a large set as close, and more as wrong', () => {
    // Eight pieces: two slips in all, a piece missed or one too many.
    expect(judgeSet(eight, eight.slice(1))).toMatchObject({ missed: ['a'], extra: [], res: 'warn' });
    expect(judgeSet(eight, [...eight, 'x'])).toMatchObject({ missed: [], extra: ['x'], res: 'warn' });
    expect(judgeSet(eight, [...eight.slice(1), 'x'])).toMatchObject({ missed: ['a'], extra: ['x'], res: 'warn' });
    expect(judgeSet(eight, [...eight.slice(2), 'x'])).toMatchObject({ missed: ['a', 'b'], extra: ['x'], res: 'bad' });
    expect(judgeSet(eight, [])).toMatchObject({ right: [], missed: eight, res: 'bad' });
    expect(judgeSet(eight, ['x', 'y'])).toMatchObject({ right: [], extra: ['x', 'y'], res: 'bad' });
    // Four or five pieces: one slip. Twenty: four.
    expect(judgeSet(eight.slice(0, 4), ['a', 'b', 'c']).res).toBe('warn');
    expect(judgeSet(eight.slice(0, 4), ['a', 'b']).res).toBe('bad');
    const twenty = Array.from({ length: 20 }, (_, i) => `p${i}`);
    expect(judgeSet(twenty, twenty.slice(4)).res).toBe('warn');
    expect(judgeSet(twenty, twenty.slice(5)).res).toBe('bad');
  });

  it('takes no slip in a set of two or three', () => {
    expect(judgeSet(['a', 'b', 'c'], ['a', 'b']).res).toBe('bad');
    expect(judgeSet(['a', 'b'], ['a', 'b', 'x']).res).toBe('bad');
    expect(judgeSet(['a', 'b'], ['b', 'a']).res).toBe('ok');
    // The same piece marked twice is marked once.
    expect(judgeSet(['a', 'b'], ['a', 'a', 'b'])).toEqual({ right: ['a', 'b'], missed: [], extra: [], res: 'ok' });
  });
});
