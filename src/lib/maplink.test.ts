import { describe, expect, it } from 'vitest';
import { CITY_COUNTS } from './extra';
import { LINK_CITY_COUNTS, mapLinkRest, parseMapLink } from './maplink';
import { PATHS, canonicalPath, routeOf } from './routes';

describe('a link to a map and a game', () => {
  it('names the countries, the level of each and the game', () => {
    expect(parseMapLink('regions', 'ES:p+PT/capital')).toEqual({ ids: ['ES', 'PT'], levels: { ES: 'p' }, mode: 'capital' });
    expect(parseMapLink('countries', 'ES+FR+DE')).toEqual({ ids: ['ES', 'FR', 'DE'], levels: {} });
    // A comma is as good as a plus, and a country said twice is said once.
    expect(parseMapLink('countries', 'ES,FR,ES/flag')).toEqual({ ids: ['ES', 'FR'], levels: {}, mode: 'flag' });
    expect(parseMapLink('regions', 'X1:g1')).toEqual({ ids: ['X1'], levels: { X1: 'g1' } });
  });

  it('says which cities, where the map is of cities', () => {
    expect(parseMapLink('cities', 'ES/pin/top25')).toEqual({ ids: ['ES'], levels: {}, mode: 'pin', cityPick: 'top', cityCount: 25 });
    expect(parseMapLink('cities', 'ES+PT/blind/caps')).toEqual({ ids: ['ES', 'PT'], levels: {}, mode: 'blind', cityPick: 'caps' });
    expect(parseMapLink('cities', 'ES/pin/regcaps')?.cityPick).toBe('regcaps');
    expect(parseMapLink('cities', 'ES/pin/top30')).toBeNull();
    expect(parseMapLink('countries', 'ES/pin/top25')).toBeNull();
    expect([...LINK_CITY_COUNTS]).toEqual([...CITY_COUNTS]);
  });

  it('reads the tokens of a physical map as they are kept', () => {
    expect(parseMapLink('physical', 'river+lake+EU/pin')).toEqual({ ids: ['river', 'lake', 'EU'], levels: {}, mode: 'pin' });
    expect(parseMapLink('physical', 'peak+in:ES+all')).toEqual({ ids: ['peak', 'in:ES', 'all'], levels: {} });
    expect(parseMapLink('physical', 'volcano+EU')).toBeNull();
    expect(parseMapLink('physical', 'river+ES')).toBeNull();
  });

  it('is nothing when it is written any other way', () => {
    for (const rest of ['loquesea', 'es', 'ESP', 'ES:', 'ES:p:q', 'ES//pin', 'ES/', 'ES/Pin', 'ES/pin/top25/x', 'ES+', '+ES', 'ES:P', 'ES/1', 'ES/pin/', 'ES fr']) expect(parseMapLink('regions', rest), rest).toBeNull();
    // A level makes no sense where there is none to choose.
    expect(parseMapLink('countries', 'ES:p')).toBeNull();
    expect(parseMapLink('cities', 'ES:p/pin')).toBeNull();
  });

  it('is written the way it is read', () => {
    const cases: [Parameters<typeof mapLinkRest>[0], string][] = [
      ['regions', 'ES:p+PT/capital'],
      ['countries', 'ES+FR+DE/flag'],
      ['cities', 'ES/pin/top25'],
      ['cities', 'ES+PT/blind/caps'],
      ['physical', 'river+lake+EU/pin'],
      ['physical', 'peak+in:ES+all/identify'],
      ['pops', 'ES+FR/hilo'],
    ];
    for (const [section, rest] of cases) expect(mapLinkRest(section, parseMapLink(section, rest)!), rest).toBe(rest);
    // Which cities is said after the game, so there is none to say without one.
    expect(mapLinkRest('cities', { ids: ['ES'], levels: {}, cityPick: 'top', cityCount: 50 })).toBe('ES');
    // Levels kept from another section do not travel.
    expect(mapLinkRest('countries', { ids: ['ES'], levels: { ES: 'p' }, mode: 'pin' })).toBe('ES/pin');
  });

  it('is an address of the section, and what is not a link is still an address that is nothing', () => {
    expect(routeOf('regiones/ES:p/capital')).toEqual({ kind: 'section', section: 'regions', link: { ids: ['ES'], levels: { ES: 'p' }, mode: 'capital' } });
    expect(routeOf(`${PATHS.cities}/ES/pin/top25`)).toMatchObject({ kind: 'section', section: 'cities', link: { cityCount: 25 } });
    expect(routeOf('regiones')).toEqual({ kind: 'section', section: 'regions' });
    expect(routeOf('regiones/loquesea')).toEqual({ kind: 'unknown', path: 'regiones/loquesea' });
    // What follows the section is kept as it is written: the codes tell capitals from small letters.
    expect(canonicalPath('Regiones/ES:p+PT/capital')).toBe('regiones/ES:p+PT/capital');
    expect(canonicalPath('regions/ES:p/')).toBe('regiones/ES:p');
  });
});
