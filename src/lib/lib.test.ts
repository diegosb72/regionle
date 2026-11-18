import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildDeck, deckGraph, divisionsOf, eligible, loadIndex, setLoader } from './data';
import { buildCityDeck, buildPhysicalDeck, loadPhysical, parsePhys, physCountries, physMatches, physTokens } from './extra';
import { placeQuery } from './links';
import { bfs, capOf, cheapestPath, makeView, onShortest, pickRoute, shortestPath } from './geo';
import { Matcher, editDistance, fmtBig, fmtTime, judgeAmount, key, listed, mulberry32, norm, parseNumber } from './text';

describe('text', () => {
  it('normalises accents, case and punctuation', () => {
    expect(norm('  Castilla-La  Mancha ')).toBe('castilla la mancha');
    expect(key('La Coruña')).toBe('coruna');
    expect(key("Saint John's")).toBe(key('St. Johns'));
    expect(key('Baden-Württemberg')).toBe('badenwurttemberg');
    expect(key('Łódź')).toBe('lodz');
  });

  it('writes names in a row', () => {
    expect(listed(['Regiones', 'Países', 'Ciudades', 'Física'], 'o')).toBe('Regiones, Países, Ciudades o Física');
    expect(listed(['Capitals', 'Flags'], 'and')).toBe('Capitals and Flags');
    expect(listed(['Regiones'], 'y')).toBe('Regiones');
    expect(listed([], 'y')).toBe('');
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
  it('finds the way that reuses what is already known', () => {
    const long = new Map([
      ['a', ['b', 'e']],
      ['b', ['a', 'c']],
      ['c', ['b', 'd']],
      ['d', ['c', 'g']],
      ['e', ['a', 'f']],
      ['f', ['e', 'g']],
      ['g', ['f', 'd']],
    ]);
    expect(cheapestPath(long, 'a', 'd', new Set())).toEqual(['a', 'b', 'c', 'd']);
    expect(cheapestPath(long, 'a', 'd', new Set(['e', 'f']))).toEqual(['a', 'e', 'f', 'g', 'd']);
    expect(cheapestPath(long, 'a', 'd', new Set(['e', 'f', 'g']))).toEqual(['a', 'e', 'f', 'g', 'd']);
    expect(cheapestPath(g, 'a', 'z', new Set())).toBeNull();
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

  it('knows what each piece belongs to: the community of a province, the region of a department', async () => {
    const fine = await buildDeck({ scope: 'regions', countries: ['ES'], levels: { ES: 'f' } });
    expect(fine.byId.get('ES-TE')!.belongs).toMatchObject({ id: 'ES-AR', name: 'Aragón', type: 'comunidad autónoma' });
    expect(fine.byId.get('ES-LE')!.belongs!.name).toBe('Castilla y León');
    expect(fine.items.every((it) => it.belongs)).toBe(true);
    // Nineteen communities for fifty-two provinces: that is what makes it a question.
    expect(new Set(fine.items.map((it) => it.belongs!.id)).size).toBe(19);
    // What is accepted when typed: every name of the community.
    expect(fine.byId.get('ES-B')!.belongs!.answers).toEqual(expect.arrayContaining(['Cataluña', 'Catalonia', 'Catalunya']));
    // The coarsest level belongs to nothing but its country.
    const coarse = await buildDeck({ scope: 'regions', countries: ['ES'] });
    expect(coarse.items.some((it) => it.belongs)).toBe(false);
    // Three levels: a département is asked for the level just above it.
    const fr = await buildDeck({ scope: 'regions', countries: ['FR'], levels: { FR: 'f' } });
    expect(fr.byId.get('FR-13')!.belongs!.name).toMatch(/Provenza/);
    // A country with a single level has no groups.
    const pt = await buildDeck({ scope: 'regions', countries: ['PT'] });
    expect(pt.items.some((it) => it.belongs)).toBe(false);
  });

  it('says what a city belongs to: its country on a map of several, its region on a map of one', async () => {
    const plain = await buildCityDeck(['ES'], 'top', 10);
    expect(plain.items.some((it) => it.belongs)).toBe(false);
    const es = await buildCityDeck(['ES'], 'top', 25, undefined, true);
    const of = (name: string) => es.items.find((it) => it.name === name)!.belongs;
    expect(of('Sevilla')).toMatchObject({ name: 'Andalucía', type: 'comunidad autónoma' });
    expect(of('Bilbao')!.name).toBe('País Vasco');
    expect(of('Madrid')!.name).toBe('Comunidad de Madrid');
    expect(es.items.every((it) => it.belongs)).toBe(true);
    const several = await buildCityDeck(['ES', 'FR', 'PT'], 'top', 10, undefined, true);
    expect(several.items.find((it) => it.name === 'Lisboa')!.belongs).toMatchObject({ id: 'PT', name: 'Portugal', type: 'país' });
    expect(new Set(several.items.map((it) => it.belongs!.id))).toEqual(new Set(['ES', 'FR', 'PT']));
  });

  it('gives each fine unit of a country the division it is played by', async () => {
    const { byId } = await loadIndex();
    const es = await divisionsOf(byId.get('ES')!);
    expect(es.get('ES-TE')!.name).toBe('Aragón');
    expect(es.size).toBe(52);
    // Where the states are what is played, a unit is in itself.
    const de = await divisionsOf(byId.get('DE')!);
    expect(de.get('DE-BY')).toMatchObject({ id: 'DE-BY', name: 'Baviera' });
    // A country that is a single piece has nothing to tell apart.
    expect((await divisionsOf(byId.get('MC')!)).size).toBe(0);
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

  it('gives regions and countries their capitals', async () => {
    const coarse = await buildDeck({ scope: 'regions', countries: ['ES'] });
    expect(coarse.byId.get('ES-AN')!.capital?.[0]).toBe('Sevilla');
    expect(coarse.items.every((it) => it.capital?.length)).toBe(true);
    const world = await buildDeck({ scope: 'countries', countries: ['ES', 'FR'] });
    expect(world.byId.get('FR')!.capital?.[0]).toBe('París');
    expect(world.items.every((it) => it.shape === 'area')).toBe(true);
  });

  it('builds maps of cities: the largest, the capitals, and whatever a review needs', async () => {
    const top = await buildCityDeck(['ES'], 'top', 10);
    expect(top.scope).toBe('cities');
    expect(top.items).toHaveLength(10);
    expect(top.items.every((it) => it.shape === 'point' && it.kind === 'city')).toBe(true);
    expect(top.items.slice(0, 2).map((it) => it.name)).toEqual(['Madrid', 'Barcelona']);
    expect(top.title).toContain('España');
    // The land of the chosen country is drawn in full colour, the rest of the world muted.
    expect(top.base!.map((g) => g.id)).toEqual(['ES']);
    expect(top.context.length).toBeGreaterThan(200);

    // The whole country is in the frame, not only the ten cities: the coast of Galicia and the Costa Brava…
    const lons = top.frame.map((p) => p[0]);
    const lats = top.frame.map((p) => p[1]);
    expect(Math.min(...lons)).toBeLessThan(-9);
    expect(Math.max(...lons)).toBeGreaterThan(3);
    expect(Math.max(...lats)).toBeGreaterThan(43.5);
    // …and the Canaries come in when one of their cities is asked.
    expect(top.items.some((it) => it.lp[1] < 30)).toBe(false);
    expect(Math.min(...lats)).toBeGreaterThan(35);
    const more = await buildCityDeck(['ES'], 'top', 25);
    expect(more.items.some((it) => it.lp[1] < 30)).toBe(true);
    expect(Math.min(...more.frame.map((p) => p[1]))).toBeLessThan(29);

    const caps = await buildCityDeck(['ES', 'FR', 'PT'], 'caps', 25);
    expect(caps.items.map((it) => it.name).sort()).toEqual(['Lisboa', 'Madrid', 'París']);
    expect(caps.noun.one).toBe('capital');

    const regional = await buildCityDeck(['ES'], 'regcaps', 25);
    expect(regional.items.length).toBeGreaterThan(15);
    expect(regional.items.every((it) => (it.cap ?? 0) >= 1)).toBe(true);

    // A review asks for cities by id: they are on the map even when the choice would leave them out.
    const small = more.items[more.items.length - 1].id;
    const forced = await buildCityDeck(['ES'], 'top', 10, [small]);
    expect(forced.items).toHaveLength(11);
    expect(forced.byId.has(small)).toBe(true);
  });

  it('builds physical maps by kind and continent', async () => {
    const rivers = await buildPhysicalDeck(['river', 'EU']);
    expect(rivers.scope).toBe('physical');
    expect(rivers.items.length).toBeGreaterThan(12);
    expect(rivers.items.every((it) => it.shape === 'line' && it.cat === 'river' && it.kind === 'feature')).toBe(true);
    expect(rivers.items.map((it) => it.name)).toEqual(expect.arrayContaining(['Danubio', 'Volga', 'Ebro', 'Tajo']));
    expect(rivers.title).toBe('Ríos · Europa');
    expect(rivers.noun.one).toBe('río');
    // What is asked is in sight: the Ural lies east of the box Europe is usually framed in.
    expect(Math.max(...rivers.frame.map((p) => p[0]))).toBeGreaterThan(55);
    expect(makeView(rivers.frame).world).toBe(false);

    const everything = await buildPhysicalDeck(['river', 'EU', 'all']);
    expect(everything.items.length).toBeGreaterThan(rivers.items.length);

    const mixed = await buildPhysicalDeck(['sea', 'lake', 'range', 'desert', 'island', 'river']);
    expect(mixed.title).toContain('Mundo');
    expect(makeView(mixed.frame).world).toBe(true);
    expect(new Set(mixed.items.map((it) => it.cat))).toEqual(new Set(['sea', 'lake', 'range', 'desert', 'island', 'river']));
    // Seas lie under the land, so that coasts stay clean; rivers come last and take the click.
    expect(mixed.items.filter((it) => it.under).every((it) => it.cat === 'sea')).toBe(true);
    expect(mixed.items[0].cat).toBe('sea');
    expect(mixed.items[mixed.items.length - 1].cat).toBe('river');

    // A review draws the map around what is due, whatever the selection says.
    const review = await buildPhysicalDeck(['river', 'EU'], ['d:sahara', 'r:nile']);
    expect(review.byId.has('d:sahara')).toBe(true);
    expect(review.byId.has('r:nile')).toBe(true);
    expect(review.items.some((it) => it.name === 'Danubio')).toBe(false);
  });

  it('builds maps of peaks: points with their height, drawn over everything else', async () => {
    const peaks = await buildPhysicalDeck(['peak', 'EU']);
    expect(peaks.title).toBe('Picos y volcanes · Europa');
    expect(peaks.noun.one).toBe('pico');
    expect(peaks.items.length).toBeGreaterThanOrEqual(8);
    expect(peaks.items.every((it) => it.shape === 'point' && it.cat === 'peak' && it.kind === 'feature' && (it.elev ?? 0) > 0)).toBe(true);
    expect(peaks.items.map((it) => it.name)).toEqual(expect.arrayContaining(['Teide', 'Mulhacén', 'Aneto', 'Mont Blanc', 'Etna']));
    expect(peaks.byId.get('p:teide')!.elev).toBeGreaterThan(3700);
    // The Teide is asked, so the Canaries are in sight.
    expect(Math.min(...peaks.frame.map((p) => p[1]))).toBeLessThan(29);
    const all = await buildPhysicalDeck(['peak', 'EU', 'all']);
    expect(all.items.length).toBeGreaterThan(peaks.items.length);

    // Among rivers and ranges, a peak comes last: it is a dot and anything drawn later would cover it.
    const mixed = await buildPhysicalDeck(['river', 'range', 'peak', 'EU']);
    expect(mixed.items[mixed.items.length - 1].cat).toBe('peak');
    expect(new Set(mixed.items.map((it) => it.shape))).toEqual(new Set(['line', 'area', 'point']));

    // A custom list keeps its own map: the peaks it names are there even if the selection has changed.
    const listed = await buildPhysicalDeck(['river', 'EU'], ['p:teide', 'p:mount-everest'], true);
    expect(listed.byId.has('p:teide')).toBe(true);
    expect(listed.byId.has('p:mount-everest')).toBe(true);
    expect(listed.items.some((it) => it.name === 'Danubio')).toBe(true);
  });

  it('reads and writes the selection of a physical map', () => {
    expect(parsePhys(['river', 'EU'])).toEqual({ kinds: ['river'], places: ['EU'], all: false });
    expect(parsePhys([])).toEqual({ kinds: ['river'], places: [], all: false });
    expect(parsePhys(['all', 'AM', 'sea', 'lake', 'zzz'])).toEqual({ kinds: ['lake', 'sea'], places: ['AM'], all: true });
    expect(physTokens(parsePhys(['all', 'AM', 'sea', 'lake']))).toEqual(['lake', 'sea', 'AM', 'all']);
    // One country instead of continents: AF, AS and AM are continents here, so a country has a word of its own.
    expect(parsePhys(['river', 'cape', 'in:ES'])).toEqual({ kinds: ['river', 'cape'], places: [], all: false, country: 'ES' });
    expect(parsePhys(['river', 'EU', 'in:ES', 'all'])).toEqual({ kinds: ['river'], places: [], all: true, country: 'ES' });
    expect(physTokens(parsePhys(['all', 'in:FR', 'peak', 'plain']))).toEqual(['plain', 'peak', 'in:FR', 'all']);
    expect(parsePhys(['river', 'in:es', 'in:ESP', 'ES']).country).toBeUndefined();
    // The kinds that came later sit among the others without moving them: a map chosen before reads the same.
    expect(physTokens(parsePhys(['island', 'desert', 'peak', 'range', 'sea', 'lake', 'river']))).toEqual(['river', 'lake', 'sea', 'range', 'peak', 'desert', 'island']);
  });

  it('chooses what a map of the world, of a continent or of a country asks about', () => {
    const tagus = { k: 'river', ct: ['EU'], r: 1, co: ['ES', 'PT'] } as const;
    const minho = { k: 'river', ct: ['EU'], r: 2, h: 1, co: ['ES', 'PT'] } as const;
    const jarama = { k: 'river', ct: ['EU'], r: 3, h: 1, co: ['ES'] } as const;
    const manzanares = { k: 'river', ct: ['EU'], r: 3, co: ['ES'] } as const;
    const seine = { k: 'river', ct: ['EU'], r: 1, co: ['FR'] } as const;
    const all = [tagus, minho, jarama, manzanares, seine];
    const pick = (tokens: string[]) => all.filter((f) => physMatches(f, parsePhys(tokens)));
    // A continent: what is known everywhere, or all that has room on it. What belongs to the map of a country never.
    expect(pick(['river', 'EU'])).toEqual([tagus, seine]);
    expect(pick(['river', 'EU', 'all'])).toEqual([tagus, minho, seine]);
    expect(pick(['river', 'all'])).toEqual([tagus, minho, seine]);
    expect(pick(['river', 'AS', 'all'])).toEqual([]);
    // A country: its best known, which are more than the continent's, or everything on it.
    expect(pick(['river', 'in:ES'])).toEqual([tagus, minho, jarama]);
    expect(pick(['river', 'in:ES', 'all'])).toEqual([tagus, minho, jarama, manzanares]);
    expect(pick(['river', 'in:PT', 'all'])).toEqual([tagus, minho]);
    expect(pick(['river', 'in:FR'])).toEqual([seine]);
    expect(pick(['lake', 'in:ES', 'all'])).toEqual([]);
  });

  it('offers a map of its own to the countries with enough on it', async () => {
    const file = await loadPhysical();
    const lands = physCountries(file.f);
    expect(lands.get('ES')).toBeGreaterThanOrEqual(150);
    for (const id of ['FR', 'IT', 'DE', 'US', 'RU', 'CN', 'BR', 'MX', 'AR', 'PT', 'GB']) expect(lands.get(id) ?? 0, id).toBeGreaterThanOrEqual(6);
    // A handful of features is no game: Andorra has the Pyrenees and little else.
    expect(lands.has('AD')).toBe(false);
    expect(lands.size).toBeGreaterThan(50);
    expect(lands.size).toBeLessThan(120);
  });

  it('builds the physical map of a country around its own land', async () => {
    const spain = await buildPhysicalDeck(['river', 'range', 'plain', 'cape', 'in:ES']);
    expect(spain.title).toBe('Geografía física · España');
    expect(spain.key).toBe('p:river,range,plain,cape,in:ES');
    expect(spain.items.length).toBeGreaterThanOrEqual(60);
    for (const id of ['r:tagus', 'r:jarama', 'r:central-system', 'r:pyrenees', 'p:northern-meseta', 'c:cape-gata']) expect(spain.byId.has(id), id).toBe(true);
    // Not what «Todos» adds, nor the rivers of the neighbours.
    for (const id of ['r:manzanares', 'r:seine', 'r:garonne', 'c:cape-ortegal']) expect(spain.byId.has(id), id).toBe(false);
    // The country stands out from the rest of the world, and every feature is filed under its name.
    expect(spain.base?.map((g) => g.id)).toEqual(['ES']);
    expect(spain.context.length).toBeGreaterThan(150);
    expect(new Set(spain.items.map((it) => it.country.n.es))).toEqual(new Set(['España']));
    expect(spain.items.every((it) => !it.country.fl)).toBe(true);
    // Rivers alone: the frame is the peninsula, without the Canary Islands that nothing asks about…
    const rivers = await buildPhysicalDeck(['river', 'in:ES']);
    expect(Math.min(...rivers.frame.map((p) => p[1]))).toBeGreaterThan(35);
    expect(Math.min(...rivers.frame.map((p) => p[0]))).toBeGreaterThan(-10);
    // …and with their islands or the Teide, it reaches them.
    const peaks = await buildPhysicalDeck(['peak', 'in:ES']);
    expect(Math.min(...peaks.frame.map((p) => p[1]))).toBeLessThan(29);
    // A plain lies under the ranges that cross it, a cape on top of everything: the click goes to what is on top.
    const order = spain.items.map((it) => it.cat);
    expect(order.indexOf('plain')).toBeLessThan(order.indexOf('range'));
    expect(order.lastIndexOf('range')).toBeLessThan(order.indexOf('river'));
    expect(order[order.length - 1]).toBe('cape');
    expect(spain.byId.get('c:cape-gata')!.shape).toBe('point');

    const all = await buildPhysicalDeck(['river', 'lake', 'in:ES', 'all']);
    expect(all.byId.has('r:manzanares')).toBe(true);
    // A reservoir is called what it is, and looked up by its own name.
    const serena = all.byId.get('l:la-serena-reservoir')!;
    expect(serena.type).toBe('embalse');
    expect(placeQuery(serena)).toBe('Embalse de La Serena, España');
    expect(placeQuery(all.byId.get('r:jarama')!)).toBe('río Jarama, España');
    // On a continent, as ever: the kind in front of a river, nothing after it.
    const europe = await buildPhysicalDeck(['river', 'lake', 'EU', 'all']);
    expect(placeQuery(europe.byId.get('r:danube')!)).toBe('río Danubio');
    expect(placeQuery(europe.byId.get('l:lake-geneva')!)).toBe('Lago Lemán');

    // The map of France shows the Rhine without going to the sea after it.
    const france = await buildPhysicalDeck(['river', 'in:FR', 'all']);
    expect(france.byId.has('r:rhine')).toBe(true);
    expect(Math.max(...france.frame.map((p) => p[1]))).toBeLessThan(52.5);
  });

  it('draws a review on the map of the country its answers were learnt on', async () => {
    // Asked with the country: the map of Spain, with the kinds of what is reviewed and room for the least known.
    const review = await buildPhysicalDeck(['in:ES'], ['r:manzanares', 'c:cape-gata']);
    expect(review.title).toContain('España');
    expect(review.byId.has('r:manzanares')).toBe(true);
    expect(review.byId.has('r:tagus')).toBe(true);
    expect(new Set(review.items.map((it) => it.cat))).toEqual(new Set(['river', 'cape']));
    // Asked without it (answers kept by a version that knew of no countries): what no continent shows still gets its own map.
    const old = await buildPhysicalDeck([], ['r:jarama', 'r:tagus']);
    expect(old.title).toContain('España');
    // What a continent shows stays on the continent.
    const europe = await buildPhysicalDeck([], ['r:tagus', 'r:danube']);
    expect(europe.title).toContain('Europa');
    expect(europe.byId.has('r:jarama')).toBe(false);
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
