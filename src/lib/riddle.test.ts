import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildDeck, loadIndex, setLoader } from './data';
import { buildCityDeck, buildPhysicalDeck } from './extra';
import { setLang } from './i18n';
import { CLUES_OK, cluesFor, judgeRiddle, riddlePoints, type Clue } from './riddle';
import type { Places } from './sets';
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

const text = (clues: Clue[], id: string) => clues.find((c) => c.id === id)?.text;
const ids = (clues: Clue[]) => clues.map((c) => c.id);

describe('the clues of a country', () => {
  it('go from its size to its name, by its part of the world, its borders, a neighbour, its capital and its flag', async () => {
    const deck = await buildDeck({ scope: 'countries', countries: europe, levels: {} });
    const es = cluesFor(deck.byId.get('ES')!, deck, places, mulberry32(1));
    expect(ids(es)).toEqual(['size', 'part', 'borders', 'neighbour', 'capital', 'flag', 'initial']);
    expect(text(es, 'size')).toMatch(/^Tengo 4\d(,\d+)? millones de habitantes y mido 50\d\.\d{3} km²\.$/);
    expect(text(es, 'part')).toBe('Estoy en Europa del Sur.');
    expect(text(es, 'borders')).toMatch(/^Tengo costa y limito con \d países\.$/);
    // One of its neighbours on this map, which the map lights up.
    const nb = es.find((c) => c.id === 'neighbour')!;
    expect(nb.kind === 'text' && ['PT', 'FR', 'AD'].includes(nb.show ?? '')).toBe(true);
    expect(nb.text).toMatch(/^Uno de mis vecinos es (Portugal|Francia|Andorra)\.$/);
    expect(text(es, 'capital')).toBe('Mi capital empieza por «M».');
    expect(es.find((c) => c.id === 'flag')).toMatchObject({ kind: 'flag', code: 'es', text: 'Esta es mi bandera.' });
    expect(text(es, 'initial')).toBe('Mi nombre empieza por «E» y tiene 6 letras.');
    // The same game gives the same neighbour.
    expect(cluesFor(deck.byId.get('ES')!, deck, places, mulberry32(1))).toEqual(es);

    const ch = cluesFor(deck.byId.get('CH')!, deck, places, mulberry32(1));
    expect(text(ch, 'borders')).toBe('No tengo salida al mar y limito con 5 países.');
    const is = cluesFor(deck.byId.get('IS')!, deck, places, mulberry32(1));
    expect(text(is, 'borders')).toBe('No tengo fronteras por tierra: me rodea el mar.');
    expect(ids(is)).not.toContain('neighbour');
    // A country named after its capital is not given away by it.
    expect(ids(cluesFor(deck.byId.get('LU')!, deck, places, mulberry32(1)))).not.toContain('capital');
    expect(ids(cluesFor(deck.byId.get('MC')!, deck, places, mulberry32(1)))).not.toContain('capital');
    const gb = cluesFor(deck.byId.get('GB')!, deck, places, mulberry32(1));
    expect(text(gb, 'initial')).toBe('Mi nombre empieza por «R» y tiene 10 letras, en 2 palabras.');
  });

  it('name the part of the world only where the map has several', async () => {
    const south = await buildDeck({ scope: 'countries', countries: ['ES', 'PT', 'IT', 'GR'], levels: {} });
    expect(ids(cluesFor(south.byId.get('ES')!, south, places, mulberry32(1)))).not.toContain('part');
    const all = await buildDeck({ scope: 'countries', countries: world, levels: {} });
    expect(text(cluesFor(all.byId.get('CU')!, all, places, mulberry32(1)), 'part')).toBe('Estoy en el Caribe.');
    expect(text(cluesFor(all.byId.get('TH')!, all, places, mulberry32(1)), 'part')).toBe('Estoy en el Sudeste Asiático.');
    // "Australia y Nueva Zelanda" would say which two it can be: the continent is said instead.
    expect(text(cluesFor(all.byId.get('NZ')!, all, places, mulberry32(1)), 'part')).toBe('Estoy en Oceanía.');
    setLang('en');
    const en = await buildDeck({ scope: 'countries', countries: world, levels: {} });
    const cu = cluesFor(en.byId.get('CU')!, en, places, mulberry32(1));
    setLang('es');
    expect(text(cu, 'part')).toBe('I am in the Caribbean.');
    expect(text(cu, 'borders')).toBe('I have no land borders: the sea is all around me.');
    expect(text(cu, 'capital')).toBe('My capital starts with “H”.');
    expect(text(cu, 'initial')).toBe('My name starts with “C” and has 4 letters.');
  });
});

describe('the clues of a region', () => {
  it('go from its size to its name, by where it lies, its borders, a neighbour and its outline', async () => {
    const deck = await buildDeck({ scope: 'regions', countries: ['ES'], levels: { ES: 'g1' } });
    const cl = cluesFor(deck.byId.get('ES-CL')!, deck, undefined, mulberry32(1));
    expect(ids(cl)).toEqual(['size', 'where', 'borders', 'neighbour', 'shape', 'initial']);
    expect(text(cl, 'size')).toMatch(/^Mido 9\d\.\d{3} km²: por tamaño soy la mayor de las 19 de este mapa\.$/);
    expect(text(cl, 'borders')).toBe('Limito por tierra con 9 de las comunidades autónomas de este mapa.');
    expect(cl.find((c) => c.id === 'neighbour')!.text).toMatch(/^Una de mis vecinas es /);
    expect(cl.find((c) => c.id === 'shape')).toEqual({ id: 'shape', kind: 'shape', text: 'Esta es mi silueta.' });
    expect(text(cl, 'initial')).toBe('Mi nombre empieza por «C» y tiene 13 letras, en 3 palabras.');
    const an = cluesFor(deck.byId.get('ES-AN')!, deck, undefined, mulberry32(1));
    expect(text(an, 'size')).toMatch(/por tamaño soy la 2\.ª de las 19/);
    expect(text(an, 'where')).toBe('Estoy hacia el sur del mapa.');
    const ga = cluesFor(deck.byId.get('ES-GA')!, deck, undefined, mulberry32(1));
    expect(text(ga, 'where')).toBe('Estoy hacia el noroeste del mapa.');
    // The middle is that of the pieces: the Canaries stretch the frame, and Madrid is still in the middle.
    expect(text(cluesFor(deck.byId.get('ES-MD')!, deck, undefined, mulberry32(1)), 'where')).toBe('Estoy por el centro del mapa.');
    const cn = cluesFor(deck.byId.get('ES-CN')!, deck, undefined, mulberry32(1));
    expect(text(cn, 'where')).toBe('Estoy hacia el suroeste del mapa.');
    expect(text(cn, 'borders')).toBe('No limito por tierra con ninguna de las comunidades autónomas de este mapa.');
    expect(ids(cn)).not.toContain('neighbour');
    const ce = cluesFor(deck.byId.get('ES-CE')!, deck, undefined, mulberry32(1));
    expect(text(ce, 'size')).toMatch(/soy la menor de las 19|soy la 18\.ª de las 19/);
  });

  it('say what a province is part of, unless that gives it away', async () => {
    const deck = await buildDeck({ scope: 'regions', countries: ['ES'], levels: { ES: 'f' } });
    const hu = deck.items.find((it) => it.name === 'Huesca')!;
    expect(ids(cluesFor(hu, deck, undefined, mulberry32(1)))).toEqual(['size', 'where', 'borders', 'parent', 'neighbour', 'shape', 'initial']);
    expect(text(cluesFor(hu, deck, undefined, mulberry32(1)), 'parent')).toBe('Mi comunidad autónoma es Aragón.');
    // A community of one province is that province; and so is one by the same name.
    for (const name of ['Murcia', 'Madrid', 'La Rioja', 'Asturias']) {
      const it = deck.items.find((x) => x.name === name)!;
      expect(ids(cluesFor(it, deck, undefined, mulberry32(1))), name).not.toContain('parent');
    }
  });

  it('say whose it is on a map of several countries', async () => {
    const deck = await buildDeck({ scope: 'regions', countries: ['ES', 'PT'], levels: { ES: 'g1' } });
    const pt = deck.items.find((it) => it.country.id === 'PT')!;
    expect(text(cluesFor(pt, deck, undefined, mulberry32(1)), 'parent')).toBe('Mi país es Portugal.');
  });
});

describe('the clues of a city', () => {
  it('go from its size to its name, by where it lies and how far it is from the largest', async () => {
    const deck = await buildCityDeck(['ES'], 'top', 25, undefined, true);
    const seville = deck.items.find((it) => it.name === 'Sevilla')!;
    const clues = cluesFor(seville, deck, undefined, mulberry32(1));
    expect(ids(clues)).toEqual(['size', 'where', 'status', 'parent', 'near', 'initial']);
    expect(text(clues, 'size')).toMatch(/^Tengo .+ habitantes en mi área urbana: soy la \d+\.ª de las 25 de este mapa\.$/);
    expect(text(clues, 'status')).toBe('Soy capital de una región, no de mi país.');
    expect(text(clues, 'parent')).toBe('Mi comunidad autónoma es Andalucía.');
    const near = clues.find((c) => c.id === 'near')!;
    expect(near.text).toMatch(/^Estoy a unos 3\d0 km al suroeste de Madrid\.$/);
    expect(near.kind === 'text' && deck.byId.get(near.show!)?.name).toBe('Madrid');
    const madrid = deck.items.find((it) => it.name === 'Madrid')!;
    const first = cluesFor(madrid, deck, undefined, mulberry32(1));
    expect(text(first, 'size')).toMatch(/soy la más poblada de las 25/);
    expect(text(first, 'status')).toBe('Soy la capital de mi país.');
    // Madrid the city is in Madrid the community: that would be the answer. It is measured from the second city.
    expect(ids(first)).not.toContain('parent');
    expect(text(first, 'near')).toMatch(/ de Barcelona\.$/);
  });

  it('say the country on a map of several, and nothing of capitals where all are', async () => {
    const caps = await buildCityDeck(['ES', 'PT', 'FR', 'IT'], 'caps', 10, undefined, true);
    const lisbon = caps.items.find((it) => it.name === 'Lisboa')!;
    const clues = cluesFor(lisbon, caps, undefined, mulberry32(1));
    expect(text(clues, 'country')).toBe('Mi país es Portugal.');
    expect(ids(clues)).not.toContain('status');
    expect(ids(clues)).not.toContain('parent');
  });
});

describe('a riddle', () => {
  it('has no clues for rivers and ranges', async () => {
    const deck = await buildPhysicalDeck(['river', 'EU']);
    expect(cluesFor(deck.items[0], deck, undefined, mulberry32(1))).toEqual([]);
  });

  it('is worth less with each clue, and never nothing', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(riddlePoints)).toEqual([6, 5, 4, 3, 2, 1, 1, 1]);
    expect(riddlePoints(0)).toBe(6);
  });

  it('is right with few clues and no wrong name, right with help otherwise, and wrong when not solved', () => {
    expect(judgeRiddle(true, 1, 0)).toBe('ok');
    expect(judgeRiddle(true, CLUES_OK, 0)).toBe('ok');
    expect(judgeRiddle(true, CLUES_OK + 1, 0)).toBe('warn');
    expect(judgeRiddle(true, 2, 1)).toBe('warn');
    expect(judgeRiddle(false, 7, 3)).toBe('bad');
    expect(judgeRiddle(false, 1, 0)).toBe('bad');
  });
});
