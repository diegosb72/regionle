import { describe, expect, it } from 'vitest';
import { LIST_MAX, LIST_NAME_MAX, decodeList, encodeList, listConfig, listPlayable, sameList } from './lists';
import { DEFAULT_OPTS, type CustomList } from './store';

const list = (patch: Partial<CustomList> = {}): CustomList => ({ id: 'l1', name: 'Examen del jueves', section: 'regions', countries: ['ES'], levels: { ES: 'f' }, ids: ['ES-BU', 'ES-SE', 'ES-TE'], ...patch });
/** A list as it comes back from a link: the same, under a new id. */
const back = (l: CustomList) => {
  const out = decodeList(encodeList(l));
  expect(out).not.toBeNull();
  expect(out!.id).not.toBe(l.id);
  return { ...out!, id: l.id };
};

describe('custom lists by link', () => {
  it('carries the name, the map and the pieces', () => {
    const code = encodeList(list());
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(back(list())).toEqual(list());
  });

  it('writes once what every id starts with', () => {
    const provinces = Array.from({ length: 40 }, (_, i) => `ES-${String(i).padStart(2, '0')}`);
    const long = list({ ids: provinces });
    expect(back(long).ids).toEqual(provinces);
    // "ES-" forty times would add 120 characters before encoding.
    expect(encodeList(long).length).toBeLessThan(encodeList(list({ ids: provinces.map((id) => id.replace('ES-', 'ESX')) })).length);
    // Ids of several countries share nothing, and come back just the same.
    const mixed = list({ countries: ['ES', 'PT'], levels: {}, ids: ['ES-M', 'PT-11', 'ES-B'] });
    expect(back(mixed)).toEqual(mixed);
  });

  it('keeps countries, cities and physical features', () => {
    const countries = list({ section: 'countries', countries: ['ES', 'FR', 'PT', 'IT'], levels: {}, ids: ['FR', 'IT'] });
    expect(back(countries)).toEqual(countries);
    const cities = list({ section: 'cities', countries: ['ES'], levels: {}, ids: ['ES:madrid', 'ES:sevilla'], cityPick: 'regcaps', cityCount: 50 });
    expect(back(cities)).toEqual(cities);
    const physical = list({ section: 'physical', countries: ['river', 'peak', 'EU', 'all'], levels: {}, ids: ['r:ebro', 'p:teide', 'r:tagus'] });
    expect(back(physical)).toEqual(physical);
    // The physical map of one country: its token has a colon in it.
    const spain = list({ section: 'physical', countries: ['river', 'cape', 'in:ES', 'all'], levels: {}, ids: ['r:jarama', 'c:cape-gata', 'r:tagus'] });
    expect(back(spain)).toEqual(spain);
    expect(decodeList(encodeList({ ...spain, countries: ['river', 'in:es'] }))).toBeNull();
  });

  it('only sends the levels of the countries of the list', () => {
    expect(back(list({ levels: { ES: 'f', FR: 'g1' } })).levels).toEqual({ ES: 'f' });
  });

  it('keeps accents in the name and trims a long one', () => {
    expect(back(list({ name: 'Ríos de Ávila ✓' })).name).toBe('Ríos de Ávila ✓');
    expect(back(list({ name: 'x'.repeat(90) })).name).toHaveLength(LIST_NAME_MAX);
    expect(back(list({ name: '  dos   espacios  ' })).name).toBe('dos espacios');
  });

  it('turns down what is not a list', () => {
    const wire = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const good = { v: 1, n: 'x', s: 'regions', c: 'ES', i: 'ES-M.ES-B' };
    expect(decodeList(wire(good))).not.toBeNull();
    expect(decodeList('')).toBeNull();
    expect(decodeList('no-es-una-lista')).toBeNull();
    expect(decodeList(wire('texto'))).toBeNull();
    expect(decodeList(wire({ ...good, v: 2 }))).toBeNull();
    expect(decodeList(wire({ ...good, s: 'pops' }))).toBeNull();
    expect(decodeList(wire({ ...good, c: '' }))).toBeNull();
    expect(decodeList(wire({ ...good, c: 'E$' }))).toBeNull();
    expect(decodeList(wire({ ...good, i: '' }))).toBeNull();
    expect(decodeList(wire({ ...good, i: 'ES-M.<script>' }))).toBeNull();
    expect(decodeList(wire({ ...good, i: Array.from({ length: LIST_MAX + 1 }, (_, k) => `a${k}`).join('.') }))).toBeNull();
    // Levels that make no sense are dropped, not trusted.
    expect(decodeList(wire({ ...good, l: { ES: '../x', FR: 'f' } }))!.levels).toEqual({});
    // The same piece twice counts once.
    expect(decodeList(wire({ ...good, i: 'ES-M.ES-M.ES-B' }))!.ids).toEqual(['ES-M', 'ES-B']);
  });

  it('knows a list it already has, whatever its name or the order of its pieces', () => {
    expect(sameList(list(), list({ id: 'l2', name: 'Otro nombre', ids: ['ES-TE', 'ES-BU', 'ES-SE'] }))).toBe(true);
    expect(sameList(list(), list({ ids: ['ES-BU', 'ES-SE'] }))).toBe(false);
    expect(sameList(list(), list({ countries: ['ES', 'PT'] }))).toBe(false);
    expect(sameList(list(), list({ section: 'cities' }))).toBe(false);
  });

  it('turns a list into a game on its own map, limited to its pieces', () => {
    const cfg = listConfig(list(), 'identify', { ...DEFAULT_OPTS, length: 10 });
    expect(cfg).toMatchObject({ section: 'regions', mode: 'identify', countries: ['ES'], levels: { ES: 'f' }, only: ['ES-BU', 'ES-SE', 'ES-TE'], list: 'Examen del jueves' });
    // A list of cities is played with the cities it was made from, whatever is chosen now.
    const cities = listConfig(list({ section: 'cities', cityPick: 'regcaps', cityCount: 50 }), 'pin', DEFAULT_OPTS);
    expect(cities.opts.cityPick).toBe('regcaps');
    expect(cities.opts.cityCount).toBe(50);
  });

  it('is played in every game but the route', () => {
    for (const mode of ['explore', 'learn', 'pin', 'identify', 'nameall', 'outline', 'regionle', 'puzzle', 'neighbours', 'capital', 'flag', 'blind'] as const) expect(listPlayable(mode), mode).toBe(true);
    expect(listPlayable('travel')).toBe(false);
    expect(listPlayable('edit')).toBe(false);
  });
});
