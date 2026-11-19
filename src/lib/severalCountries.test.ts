// Short forms on a map with regions of several countries: each is judged within its own country.

import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildDeck, setLoader } from './data';
import { buildCityDeck } from './extra';
import { setLang } from './i18n';
import { Matcher, type Answerable } from './text';

/** A region of a country with these names, the first of them the one on show. */
const region = (id: string, within: string, names: string[], add: string[] = []): Answerable => ({ id, within, answers: names, proper: names, ...(add.length ? { short: { add } } : {}) });

describe('short forms on a made-up map of two countries', () => {
  const items = [
    region('AA-N', 'AA', ['Northern Plains'], ['North']),
    region('AA-S', 'AA', ['Southern Hills'], ['r:^SOUTH']),
    region('AA-X', 'AA', ['Xanadu']),
    region('BB-N', 'BB', ['Northern Lakes'], ['North']),
    region('BB-S', 'BB', ['Southern Marsh'], ['r:^SOUTH']),
    region('BB-W', 'BB', ['West'], []),
    region('BB-Q', 'BB', ['Quarter of the West'], ['West', 'Lone']),
    region('AA-W', 'AA', ['Western Reach'], ['West']),
  ];
  const m = new Matcher(items);

  it('takes a type-in for the piece that is asked about, whatever other countries have it', () => {
    expect(m.check('north', 'AA-N')).toEqual({ res: 'yes' });
    expect(m.check('north', 'BB-N')).toEqual({ res: 'yes' });
    expect(m.check('south', 'AA-S')).toEqual({ res: 'yes' });
    expect(m.check('south', 'BB-S')).toEqual({ res: 'yes' });
  });

  it('names nothing with a type-in of pieces of two countries when no piece is asked about', () => {
    expect(m.lookup('north')).toEqual([]);
    expect(m.find('north')).toEqual([]);
    expect(m.vague('north')).toBe(true);
    // A pattern is a type-in like any other.
    expect(m.lookup('south')).toEqual([]);
    expect(m.vague('south')).toBe(true);
    // Nothing is filled in as it is typed, and Enter would take nothing either: it gets the reason why.
    expect(m.typed('north', new Set(items.map((it) => it.id)))).toEqual({ ids: [], wait: false });
  });

  it('keeps a type-in that only one country has', () => {
    expect(m.lookup('lone')).toEqual(['BB-Q']);
    expect(m.vague('lone')).toBe(false);
  });

  it('gives the name written out to its piece and leaves the type-ins of other countries out', () => {
    // \"West\" is what one piece is called; two more only answer to it, one of them in another country.
    expect(m.lookup('west')).toEqual(['BB-W']);
    expect(m.vague('west')).toBe(false);
    // Asked about a piece, its country decides: the one called so, and the one of that country that answers to it.
    expect(m.check('west', 'BB-Q')).toEqual({ res: 'yes' });
    expect(m.check('west', 'AA-W')).toEqual({ res: 'yes' });
    expect(m.lookup('west', { within: 'BB' })).toEqual(['BB-W', 'BB-Q']);
    expect(m.lookup('west', { within: 'AA' })).toEqual(['AA-W', 'BB-W']);
  });

  it('says which piece of the country in question a wrong type-in is', () => {
    expect(m.check('north', 'AA-S')).toEqual({ res: 'other', id: 'AA-N' });
    expect(m.check('north', 'BB-S')).toEqual({ res: 'other', id: 'BB-N' });
    // What only another country has is still what was typed: no slip of the finger for something else.
    expect(m.check('lone', 'AA-X')).toEqual({ res: 'other', id: 'BB-Q' });
  });

  it('does not take a type-in while letters of the name are in sight, in any country', () => {
    expect(m.check('north', 'AA-N', { whole: true })).toEqual({ res: 'short' });
    expect(m.check('northern plains', 'AA-N', { whole: true })).toEqual({ res: 'yes' });
  });

  it('judges initials within the country of the piece that is asked about', () => {
    const two = new Matcher([region('AA-1', 'AA', ['Nueva Plata']), region('AA-2', 'AA', ['Monte Alto']), region('BB-1', 'BB', ['Nuevo Puerto']), region('BB-2', 'BB', ['Mar Azul']), region('BB-3', 'BB', ['Mina Antigua'])]);
    // On the map as a whole \"NP\" could be two names: with no piece in mind it is none.
    expect(two.lookup('np')).toEqual([]);
    expect(two.vague('np')).toBe(true);
    // Asked about one of them, the other is in another country.
    expect(two.check('np', 'AA-1')).toEqual({ res: 'yes' });
    expect(two.check('np', 'BB-1')).toEqual({ res: 'yes' });
    // Two pieces of one country spell \"MA\": not even there.
    expect(two.check('ma', 'AA-2')).toEqual({ res: 'yes' });
    expect(two.check('ma', 'BB-2')).toEqual({ res: 'vague' });
    expect(two.check('ma', 'BB-3')).toEqual({ res: 'vague' });
  });

  it('leaves the code of a piece of another country out of it', () => {
    // \"CB\" is the code of ES-CB, and the initials of a district of Portugal.
    const iberia = new Matcher([region('ES-CB', 'ES', ['Cantabria']), region('ES-M', 'ES', ['Madrid']), region('PT-05', 'PT', ['Castelo Branco']), region('PT-11', 'PT', ['Lisboa'])]);
    expect(iberia.lookup('cb')).toEqual([]);
    expect(iberia.check('cb', 'PT-05')).toEqual({ res: 'yes' });
    expect(iberia.check('cb', 'ES-CB')).toEqual({ res: 'other', id: 'PT-05' });
  });

  it('changes nothing on a map of one country', () => {
    const one = new Matcher(items.filter((it) => it.within === 'BB'));
    expect(one.lookup('north')).toEqual(['BB-N']);
    expect(one.lookup('west')).toEqual(['BB-W', 'BB-Q']);
    expect(one.lookup('south')).toEqual(['BB-S']);
    expect(one.vague('north')).toBe(false);
  });

  it('changes nothing where the pieces say no country: countries, cities, capitals', () => {
    const flat = new Matcher(items.map(({ within: _, ...it }) => it));
    expect(flat.lookup('north')).toEqual(['AA-N', 'BB-N']);
    expect(flat.lookup('west')).toEqual(['BB-W', 'BB-Q', 'AA-W']);
    expect(flat.check('north', 'AA-S')).toEqual({ res: 'other', id: 'AA-N' });
  });

  it('tells two pieces with one name apart by the country in question', () => {
    const punjabs = new Matcher([region('IN-PB', 'IN', ['Punjab']), region('IN-HR', 'IN', ['Haryana']), region('PK-PB', 'PK', ['Punjab']), region('PK-SD', 'PK', ['Sindh'])]);
    // A name written out is the name of both, wherever they are.
    expect(punjabs.lookup('punjab')).toEqual(['IN-PB', 'PK-PB']);
    expect(punjabs.check('punjab', 'PK-PB')).toEqual({ res: 'yes' });
    expect(punjabs.check('punjab', 'PK-SD')).toEqual({ res: 'other', id: 'PK-PB' });
    expect(punjabs.check('punjab', 'IN-HR')).toEqual({ res: 'other', id: 'IN-PB' });
  });
});

describe('short forms on the maps of the game', () => {
  beforeAll(() => {
    setLang('es');
    setLoader(async (p) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data', p), 'utf8')));
  });

  it('reads «South» and «Capital» country by country on a map with Australia, New Zealand and Pakistan', async () => {
    const deck = await buildDeck({ scope: 'regions', countries: ['GB', 'IE', 'AU', 'NZ', 'IN', 'PK'] });
    const m = new Matcher(deck.items);
    expect(m.lookup('south')).toEqual([]);
    expect(m.vague('south')).toBe(true);
    expect(m.check('south', 'AU-SA')).toEqual({ res: 'yes' });
    expect(m.check('south', 'NZ-STL')).toEqual({ res: 'yes' });
    expect(m.lookup('capital')).toEqual([]);
    expect(m.check('capital', 'AU-ACT')).toEqual({ res: 'yes' });
    expect(m.check('capital', 'PK-IS')).toEqual({ res: 'yes' });
    // Typed about a piece of a country that has no such type-in, it is still the south of somewhere: not a slip for «Louth».
    expect(m.check('south', 'PK-PB')).toEqual({ res: 'other', id: 'AU-SA' });
    // Names written out and initials that are one thing on the whole map stay as they were.
    expect(m.lookup('punjab')).toEqual(['IN-PB', 'PK-PB']);
    expect(m.lookup('kp')).toEqual(['PK-KP']);
    // And on the map of Australia alone, as ever.
    const australia = new Matcher((await buildDeck({ scope: 'regions', countries: ['AU'] })).items);
    expect(australia.lookup('south')).toEqual(['AU-SA']);
    expect(australia.lookup('capital')).toEqual(['AU-ACT']);
  });

  it('gives «North» to the province that is called so, and to the others when they are asked about', async () => {
    const deck = await buildDeck({ scope: 'regions', countries: ['CM', 'GH', 'ZM'] });
    const m = new Matcher(deck.items);
    // Cameroon has a North; Ghana and Zambia have a Northern that answers to «North» on their own maps.
    expect(m.lookup('north')).toEqual(['CM-NO']);
    expect(m.check('north', 'GH-NP')).toEqual({ res: 'yes' });
    expect(m.check('north', 'ZM-05')).toEqual({ res: 'yes' });
    expect(m.check('north', 'ZM-01')).toEqual({ res: 'other', id: 'ZM-05' });
    expect(m.lookup('northern')).toEqual(['GH-NP', 'ZM-05']);
  });

  it('takes «CB» for Castelo Branco when a district of Portugal is asked about, on a map with Cantabria', async () => {
    const m = new Matcher((await buildDeck({ scope: 'regions', countries: ['ES', 'PT', 'FR'] })).items);
    expect(m.lookup('cb')).toEqual([]);
    expect(m.vague('cb')).toBe(true);
    expect(m.check('cb', 'PT-05')).toEqual({ res: 'yes' });
    expect(m.check('vc', 'PT-16')).toEqual({ res: 'yes' });
    // What one country alone has is taken with no piece in mind, as before.
    expect(m.lookup('mancha')).toEqual(['ES-CM']);
    expect(m.lookup('leon')).toEqual(['ES-CL']);
  });

  it('tells regions apart by country, and nothing else', async () => {
    const regions = await buildDeck({ scope: 'regions', countries: ['ES', 'PT'] });
    expect(new Set(regions.items.map((it) => it.within))).toEqual(new Set(['ES', 'PT']));
    const countries = await buildDeck({ scope: 'countries', countries: ['ES', 'PT'] });
    expect(countries.items.every((it) => it.within === undefined)).toBe(true);
    const cities = await buildCityDeck(['ES', 'PT'], 'top', 10);
    expect(cities.items.every((it) => it.within === undefined)).toBe(true);
  });
});
