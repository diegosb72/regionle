import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildDeck, loadIndex, setLoader } from './data';
import { buildCityDeck, buildPhysicalDeck } from './extra';
import { HINT_KINDS, NEAR_MAX, halve, hintKinds, hintLabel, hintOf, isDigits, type HintAsk } from './hints';
import { setLang } from './i18n';
import type { Places } from './sets';
import { hintMax, letterHint, mulberry32 } from './text';
import type { Deck, Item } from './types';

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
afterEach(() => setLang('es'));

/** The ways the games ask: pointing at a piece that is named, naming one that is lit, and the rest. */
const NOTHING = { name: false, place: false, capital: false, flag: false };
const PIN: HintAsk = { wants: 'place', by: 'click', shows: { ...NOTHING, name: true } };
const PUZZLE: HintAsk = { wants: 'place', by: 'click', shows: NOTHING };
const IDENTIFY: HintAsk = { wants: 'name', by: 'type', shows: { ...NOTHING, place: true } };
const OPTIONS: HintAsk = { wants: 'name', by: 'pick', shows: { ...NOTHING, place: true } };
const OUTLINE: HintAsk = { wants: 'name', by: 'type', shows: NOTHING };
const FLAG: HintAsk = { wants: 'name', by: 'pick', shows: { ...NOTHING, flag: true } };

const say = (deck: Deck, id: string, kind: Parameters<typeof hintOf>[0], answer?: string) => hintOf(kind, deck.byId.get(id)!, deck, answer ?? deck.byId.get(id)!.name, places)?.text;

describe('the hints of a region', () => {
  it('are facts about it that the question does not show: its size, where it lies, what it borders, its capital', async () => {
    const deck = await buildDeck({ scope: 'regions', countries: ['ES'] });
    const cyl = deck.byId.get('ES-CL')!;
    expect(hintKinds(cyl, deck, PIN, places)).toEqual(['size', 'where', 'near', 'capital']);
    expect(say(deck, 'ES-CL', 'size')).toBe('Por tamaño es la mayor de las 19 del mapa.');
    expect(say(deck, 'ES-ML', 'size')).toBe('Por tamaño es la menor de las 19 del mapa.');
    expect(say(deck, 'ES-AN', 'size')).toBe('Por tamaño es la 2.ª de las 19 del mapa.');
    expect(say(deck, 'ES-CL', 'where')).toMatch(/^Está (hacia el (norte|noroeste) del mapa|por el centro del mapa)\.$/);
    expect(say(deck, 'ES-GA', 'where')).toBe('Está hacia el noroeste del mapa.');
    expect(say(deck, 'ES-CL', 'capital')).toBe('Su capital es Valladolid.');
    // Nine neighbours: the three that lie nearest by name, always the same ones, and the rest counted.
    expect(cyl.nb).toHaveLength(9);
    expect(say(deck, 'ES-CL', 'near')).toMatch(/^Limita con [^,]+, [^,]+, [^,]+ y 6 más\.$/);
    expect(say(deck, 'ES-CL', 'near')).toBe(say(deck, 'ES-CL', 'near'));
    // Few enough to name them all.
    expect(say(deck, 'ES-GA', 'near')).toMatch(/^Limita con (Asturias y Castilla y León|Castilla y León y Asturias)\.$/);
    // An island borders nothing: that is said, and it is a hint too.
    expect(say(deck, 'ES-IB', 'near')).toBe('No limita por tierra con ninguna otra del mapa.');
    // A place named after its capital is not told it.
    expect(hintKinds(deck.byId.get('ES-MD')!, deck, PIN, places)).not.toContain('capital');
    expect(hintKinds(deck.byId.get('ES-MC')!, deck, PIN, places)).not.toContain('capital');
  });

  it('say what a province is part of, unless that is its own name', async () => {
    const deck = await buildDeck({ scope: 'regions', countries: ['ES'], levels: { ES: 'f' } });
    expect(hintKinds(deck.byId.get('ES-J')!, deck, IDENTIFY, places)).toEqual(['count', 'size', 'part', 'near']);
    expect(say(deck, 'ES-J', 'part')).toBe('Pertenece a Andalucía.');
    // León is in Castilla y León, Madrid in the Community of Madrid, Valencia in the Comunidad Valenciana.
    for (const id of ['ES-LE', 'ES-M', 'ES-V']) expect(hintKinds(deck.byId.get(id)!, deck, IDENTIFY, places), id).not.toContain('part');
    // A province whose capital has another name is told it.
    expect(say(deck, 'ES-BI', 'capital')).toBe('Su capital es Bilbao.');
    expect(say(deck, 'ES-NA', 'capital')).toBe('Su capital es Pamplona.');
  });

  it('do not tell a piece named after its side of the map where it lies', async () => {
    // Rwanda: Kigali and the provinces of the North, the South, the East and the West.
    const deck = await buildDeck({ scope: 'regions', countries: ['RW'] });
    expect(say(deck, 'RW-01', 'where')).toBe('Está hacia el este del mapa.');
    for (const id of ['RW-02', 'RW-03', 'RW-04', 'RW-05']) {
      expect(hintKinds(deck.byId.get(id)!, deck, PIN, places), id).not.toContain('where');
      expect(say(deck, id, 'where'), id).toBeUndefined();
    }
    // In English they are "Eastern", "Northern"…: the same.
    setLang('en');
    const english = await buildDeck({ scope: 'regions', countries: ['RW'] });
    expect(english.byId.get('RW-05')!.name).toBe('Southern');
    for (const id of ['RW-02', 'RW-03', 'RW-04', 'RW-05']) expect(say(english, id, 'where'), id).toBeUndefined();
    expect(say(english, 'RW-01', 'where')).toBe('It is towards the east of the map.');
  });

  it('do not name a neighbour that goes by the same name, and name a fourth rather than count it', async () => {
    // Kiev, the city, lies inside Kiev, the province: "limita con Kiev" would rule the answer out.
    const ukraine = await buildDeck({ scope: 'regions', countries: ['UA'] });
    expect(ukraine.byId.get('UA-30')!.name).toBe('Kiev');
    expect(ukraine.byId.get('UA-32')!.name).toBe('Kiev');
    expect(ukraine.byId.get('UA-30')!.nb).toEqual(['UA-32']);
    expect(hintKinds(ukraine.byId.get('UA-30')!, ukraine, IDENTIFY, places)).not.toContain('near');
    expect(say(ukraine, 'UA-30', 'near')).toBeUndefined();
    // The province borders five others and the city: three are named, and the city is among the rest.
    expect(ukraine.byId.get('UA-32')!.nb).toHaveLength(6);
    expect(say(ukraine, 'UA-32', 'near')).toMatch(/^Limita con (?!.*Kiev)[^,]+, [^,]+, [^,]+ y 3 más\.$/);
    // Four neighbours: all four by name.
    const germany = await buildDeck({ scope: 'regions', countries: ['DE'] });
    expect(germany.byId.get('DE-SN')!.nb).toHaveLength(4);
    expect(say(germany, 'DE-SN', 'near')).toBe('Limita con Brandeburgo, Sajonia-Anhalt, Turingia y Baviera.');
    expect(say(germany, 'DE-BE', 'near')).toBe('Limita con Brandeburgo.');
  });

  it('say which country a region is in on a map of several, and nothing where there is one', async () => {
    const one = await buildDeck({ scope: 'regions', countries: ['PT'] });
    expect(hintKinds(one.items[0], one, IDENTIFY, places)).not.toContain('part');
    const two = await buildDeck({ scope: 'regions', countries: ['PT', 'ES'] });
    expect(say(two, 'PT-11', 'part')).toBe('Está en Portugal.');
    expect(say(two, 'ES-AR', 'part')).toBe('Está en España.');
  });
});

describe('the hints of a country', () => {
  it('are its part of the world, its neighbours, its capital and its flag', async () => {
    const deck = await buildDeck({ scope: 'countries', countries: europe });
    const es = deck.byId.get('ES')!;
    expect(hintKinds(es, deck, OPTIONS, places)).toEqual(['size', 'part', 'near', 'capital', 'flag', 'half']);
    expect(hintKinds(es, deck, IDENTIFY, places)).toEqual(['count', 'size', 'part', 'near', 'capital', 'flag']);
    expect(say(deck, 'ES', 'part')).toBe('Está en Europa del Sur.');
    expect(say(deck, 'ES', 'capital')).toBe('Su capital es Madrid.');
    expect(say(deck, 'ES', 'near')).toMatch(/^Limita con (Portugal|Andorra|Francia), (Portugal|Andorra|Francia) y (Portugal|Andorra|Francia)\.$/);
    expect(hintOf('flag', es, deck, es.name, places)).toEqual({ kind: 'flag', text: 'Esta es su bandera:', flag: 'es' });
    expect(say(deck, 'IS', 'near')).toBe('No limita por tierra con ningún otro del mapa.');
    expect(say(deck, 'RU', 'size')).toMatch(/^Por tamaño es el mayor de los \d+ del mapa\.$/);
    // Luxembourg, Monaco, San Marino: the capital would be the answer.
    for (const id of ['LU', 'MC', 'SM']) expect(hintKinds(deck.byId.get(id)!, deck, IDENTIFY, places), id).not.toContain('capital');
  });

  it('leave out what the question shows, and what it asks for', async () => {
    const deck = await buildDeck({ scope: 'countries', countries: europe });
    const es = deck.byId.get('ES')!;
    // Asked by its flag: no flag, and where it lies is worth saying, for the map shows nothing.
    expect(hintKinds(es, deck, FLAG, places)).toEqual(['size', 'where', 'part', 'near', 'capital', 'half']);
    // Asked by its outline: the same, typed.
    expect(hintKinds(es, deck, OUTLINE, places)).toEqual(['count', 'size', 'where', 'part', 'near', 'capital', 'flag']);
    // Lit on the map: where it lies is in sight.
    expect(hintKinds(es, deck, IDENTIFY, places)).not.toContain('where');
    // To be pointed at: a flag says nothing of where a country is.
    expect(hintKinds(es, deck, PIN, places)).toEqual(['size', 'where', 'part', 'near', 'capital']);
    // Pointed at by its capital or its flag, or as a jigsaw piece: its name is a hint, and its capital is not when it is the question.
    expect(hintKinds(es, deck, { ...PUZZLE, shows: { ...NOTHING, capital: true } }, places)).toEqual(['size', 'where', 'part', 'near', 'name']);
    expect(hintKinds(es, deck, PUZZLE, places)).toEqual(['size', 'where', 'part', 'near', 'capital', 'name']);
    expect(say(deck, 'ES', 'name')).toBe('Se llama España.');
    // Its capital, or what it belongs to, is asked of a piece in full sight: only the way of answering can be helped.
    expect(hintKinds(es, deck, { wants: 'capital', by: 'type', shows: { ...NOTHING, name: true, place: true } }, places)).toEqual(['count']);
    expect(hintKinds(es, deck, { wants: 'capital', by: 'pick', shows: { ...NOTHING, name: true, place: true } }, places)).toEqual(['half']);
    expect(hintKinds(es, deck, { wants: 'parent', by: 'pick', shows: { ...NOTHING, name: true, place: true } }, places)).toEqual(['half']);
  });

  it('say the continent on a map of the world, where no side of the map means anything', async () => {
    const deck = await buildDeck({ scope: 'countries', countries: world });
    expect(hintKinds(deck.byId.get('ES')!, deck, PIN, places)).toEqual(['size', 'part', 'near', 'capital']);
    expect(say(deck, 'ES', 'where')).toBeUndefined();
    expect(say(deck, 'JM', 'part')).toBe('Está en el Caribe.');
    // A part of the world that says the country: its continent instead.
    expect(say(deck, 'FM', 'part')).toBe('Está en Oceanía.');
    expect(say(deck, 'AU', 'part')).toBe('Está en Oceanía.');
    expect(say(deck, 'NZ', 'part')).toBe('Está en Oceanía.');
    expect(say(deck, 'ZA', 'part')).toBe('Está en África.');
    expect(say(deck, 'CF', 'part')).toBe('Está en África.');
    expect(say(deck, 'NA', 'part')).toBe('Está en África Austral.');
    expect(say(deck, 'KI', 'part')).toBe('Está en Micronesia.');
    // Without the names of the parts of the world there is no part to say.
    expect(hintOf('part', deck.byId.get('ES')!, deck, 'España')).toBeNull();
    // All of one part of the world: its name says nothing.
    const south = await buildDeck({ scope: 'countries', countries: ['ES', 'PT', 'IT', 'GR', 'MT'] });
    expect(hintKinds(south.byId.get('ES')!, south, PIN, places)).not.toContain('part');
  });
});

describe('the hints of a city and of a river', () => {
  it('place a city by its people and by the nearest one', async () => {
    const deck = await buildCityDeck(['ES'], 'top', 10);
    const sevilla = deck.items.find((it) => it.name === 'Sevilla')!;
    expect(hintKinds(sevilla, deck, PIN, places)).toEqual(['size', 'where', 'near']);
    expect(say(deck, deck.items.find((it) => it.name === 'Madrid')!.id, 'size')).toBe('Por habitantes es la más poblada de las 10 del mapa.');
    expect(say(deck, sevilla.id, 'near')).toMatch(/^Está a unos \d+ km al (norte|sur|este|oeste|noreste|noroeste|sureste|suroeste) de [A-ZÁ][\p{L} ]+\.$/u);
    expect(say(deck, sevilla.id, 'near')).not.toContain('Sevilla');
    // On a map of several countries, its country.
    const two = await buildCityDeck(['ES', 'PT'], 'top', 10);
    expect(say(two, two.items.find((it) => it.name === 'Lisboa')!.id, 'part')).toBe('Está en Portugal.');
  });

  it('have little to say of a river: the game knows too little of it', async () => {
    const deck = await buildPhysicalDeck(['river', 'EU']);
    const river = deck.items[0];
    // Where it lies on the map, and no more: no size, no neighbours, no capital.
    expect(hintKinds(river, deck, PIN, places)).toEqual(['where']);
    expect(hintOf('where', river, deck, river.name, places)?.text).toMatch(/^Está (hacia el \S+|por el centro) del mapa\.$/);
    expect(hintKinds(river, deck, IDENTIFY, places)).toEqual(['count']);
    expect(hintKinds(river, deck, OPTIONS, places)).toEqual(['half']);
    for (const kind of ['size', 'part', 'near', 'capital'] as const) expect(hintOf(kind, river, deck, river.name, places), kind).toBeNull();
  });
});

describe('the hints about the answer itself', () => {
  it('count the letters and the words of what has to be typed', async () => {
    const deck = await buildDeck({ scope: 'regions', countries: ['ES'] });
    expect(say(deck, 'ES-CL', 'count')).toBe('Tiene 13 letras, en 3 palabras.');
    expect(say(deck, 'ES-MD', 'count')).toBe('Tiene 17 letras, en 3 palabras.');
    expect(say(deck, 'ES-CM', 'count')).toBe('Tiene 16 letras, en 3 palabras.');
    expect(say(deck, 'ES-AR', 'count')).toBe('Tiene 6 letras.');
    // What is counted is what is asked for: the capital, when it is the capital.
    expect(say(deck, 'ES-AN', 'count', 'Sevilla')).toBe('Tiene 7 letras.');
    // As many as the blanks the game writes under the field: a hyphen or an apostrophe is not one.
    for (const name of ['Castilla-La Mancha', "Ha'apai", 'Saint-Pierre-et-Miquelon', 'Washington D. C.', 'Biel/Bienne']) {
      const blanks = letterHint(name, 0).split('_').length - 1;
      expect(say(deck, 'ES-CM', 'count', name), name).toMatch(new RegExp(`^Tiene ${blanks} letras`));
    }
    expect(say(deck, 'ES-CM', 'count', "Ha'apai")).toBe('Tiene 6 letras.');
    expect(say(deck, 'ES-CM', 'count', 'Saint-Pierre-et-Miquelon')).toBe('Tiene 21 letras, en 4 palabras.');
  });

  it('count the digits of a dialling code, and the letters of a domain', async () => {
    const deck = await buildDeck({ scope: 'countries', countries: europe });
    expect(say(deck, 'ES', 'count', '+34')).toBe('Tiene 2 cifras.');
    expect(say(deck, 'ES', 'count', '+7')).toBe('Tiene 1 cifra.');
    expect(say(deck, 'ES', 'count', '+351')).toBe('Tiene 3 cifras.');
    // Two groups, as it is said: the one of the Dominican Republic.
    expect(say(deck, 'ES', 'count', '+1 809')).toBe('Tiene 4 cifras, en 2 grupos.');
    expect(say(deck, 'ES', 'count', '.es')).toBe('Tiene 2 letras.');
    // A currency or a language is counted like any other name.
    expect(say(deck, 'ES', 'count', 'euro')).toBe('Tiene 4 letras.');
    expect(say(deck, 'ES', 'count', 'sotho septentrional')).toBe('Tiene 18 letras, en 2 palabras.');
    setLang('en');
    expect(say(deck, 'ES', 'count', '+34')).toBe('It has 2 digits.');
    expect(say(deck, 'ES', 'count', '+7')).toBe('It has 1 digit.');
    expect(say(deck, 'ES', 'count', '+1 809')).toBe('It has 4 digits, in 2 groups.');

    for (const code of ['+34', '+1 809', '34', '1 829', '+7']) expect(isDigits(code), code).toBe(true);
    for (const text of ['.es', 'euro', '', '+', ' ', 'B2', '3M']) expect(isDigits(text), text).toBe(false);
    // The plus and the dot are given, like a hyphen: what is left to write are the digits and the letters.
    expect(letterHint('+34', 0)).toBe('+ _ _');
    expect(letterHint('+351', 1)).toBe('+ 3 _ _');
    expect(letterHint('+1 809', 1)).toBe('+ 1   _ _ _');
    expect(letterHint('.es', 0)).toBe('. _ _');
    expect(letterHint('.es', 1)).toBe('. e _');
    // The last one is always left for the player.
    expect(hintMax('+34')).toBe(1);
    expect(hintMax('+7')).toBe(0);
    expect(hintMax('.es')).toBe(1);
  });

  it('are the only ones about something said of a country: the question shows it whole', async () => {
    const deck = await buildDeck({ scope: 'countries', countries: europe });
    const shows = { ...NOTHING, place: true };
    expect(hintKinds(deck.byId.get('ES')!, deck, { wants: 'fact', by: 'type', shows }, places)).toEqual(['count']);
    expect(hintKinds(deck.byId.get('ES')!, deck, { wants: 'fact', by: 'pick', shows }, places)).toEqual(['half']);
    // A country to be found by its domain or its dialling code is helped like one found by its capital: its name is one more hint.
    const byFact = hintKinds(deck.byId.get('ES')!, deck, { wants: 'place', by: 'click', shows: NOTHING }, places);
    expect(byFact).toContain('name');
    expect(byFact).toContain('capital');
    expect(byFact).not.toContain('count');
  });

  it('take away two of the three wrong options, by lot, and never the right one', () => {
    const options = ['a', 'b', 'c', 'd'];
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const cut = halve(options, 'c', mulberry32(seed));
      expect(cut).toHaveLength(2);
      expect(cut).not.toContain('c');
      expect(new Set(cut).size).toBe(2);
      seen.add(cut.join(''));
      // The same lot, the same two.
      expect(halve(options, 'c', mulberry32(seed))).toEqual(cut);
    }
    // Each of the three pairs comes up.
    expect([...seen].sort()).toEqual(['ab', 'ad', 'bd']);
    // With three options or fewer, one more gone would leave the answer alone.
    expect(halve(['a', 'b', 'c'], 'a', mulberry32(1))).toEqual([]);
    expect(halve(['a'], 'a', mulberry32(1))).toEqual([]);
  });

  it('writes «e» before a name that begins with the sound of an i', () => {
    const piece = (id: string, name: string, lp: [number, number], nb: string[] = []): Item => ({ id, name, kind: 'country', shape: 'area', lp, nb, area: 1 }) as unknown as Item;
    const items = [piece('X', 'Suiza', [0, 0], ['F', 'I']), piece('F', 'Francia', [1, 0]), piece('I', 'Italia', [2, 0]), piece('H', 'Hielo', [9, 0])];
    const deck = { items, byId: new Map(items.map((it) => [it.id, it])), noun: { one: 'país', many: 'países', fem: false }, countries: [] } as unknown as Deck;
    expect(hintOf('near', items[0], deck, 'Suiza')?.text).toBe('Limita con Francia e Italia.');
    items[0].nb = ['F', 'H'];
    expect(hintOf('near', items[0], deck, 'Suiza')?.text).toBe('Limita con Francia y Hielo.');
    expect(NEAR_MAX).toBe(3);
  });
});

describe('the hints in English', () => {
  it('say the same', async () => {
    setLang('en');
    const deck = await buildDeck({ scope: 'countries', countries: europe });
    expect(say(deck, 'ES', 'part')).toBe('It is in Southern Europe.');
    expect(say(deck, 'ES', 'capital')).toBe('Its capital is Madrid.');
    expect(say(deck, 'RU', 'size')).toMatch(/^By size it is the largest of the \d+ on the map\.$/);
    expect(say(deck, 'IS', 'near')).toBe('It shares a land border with no other on the map.');
    expect(say(deck, 'ES', 'count', 'Spain')).toBe('It has 5 letters.');
    expect(say(deck, 'ES', 'name')).toBe('It is called Spain.');
    const regions = await buildDeck({ scope: 'regions', countries: ['ES'] });
    expect(say(regions, 'ES-AN', 'size')).toBe('By size it is the 2nd of the 19 on the map.');
    expect(say(regions, 'ES-AN', 'capital')).toBe('Its capital is Seville.');
    expect(say(regions, 'ES-GA', 'where')).toBe('It is towards the north-west of the map.');
  });

  it('name every kind in the menu, in both languages', () => {
    for (const lang of ['es', 'en'] as const) {
      setLang(lang);
      const names = HINT_KINDS.map(hintLabel);
      expect(new Set(names).size).toBe(HINT_KINDS.length);
      for (const n of names) expect(n.length).toBeGreaterThan(3);
    }
  });
});
