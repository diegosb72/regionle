/** The pages of the maps of the countries: which countries have one, what each is called, and what it says of its map. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMapLink } from './maplink';
import { mapAt, pageMap, routeOf } from './routes';
import { MAP_WORD, SEO_LANGS, mapPageNamed, pageFile, type MapPage } from './seo';
import { mapPagesOf, slugOf, type MapSource } from './seoMaps';
import type { Country } from './types';
import { eligible } from './world';

const SPAIN: MapSource = {
  id: 'ES',
  n: { es: 'España', en: 'Spain' },
  lv: [
    { n: 19, es: 'comunidades autónomas', en: 'autonomous communities' },
    { n: 52, es: 'provincias', en: 'provinces' },
  ],
};
const ANDORRA: MapSource = { id: 'AD', n: { es: 'Andorra' }, lv: [{ n: 7, es: 'parroquias', en: 'parishes' }] };
const UK: MapSource = {
  id: 'GB',
  n: { es: 'Reino Unido', en: 'United Kingdom' },
  lv: [
    { n: 4, es: 'naciones', en: 'nations' },
    { n: 12, es: 'naciones y regiones', en: 'nations and regions' },
    { n: 232, es: 'condados y distritos', en: 'counties and districts' },
  ],
};
const of = (pages: MapPage[], lang: 'es' | 'en') => pages.find((p) => p.lang === lang)!;

/** The countries as the game reads them: what the pages of the site are built from. */
const WORLD = (JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/data/index.json'), 'utf8')) as { countries: MapSource[] }).countries;

describe('a name as an address carries it', () => {
  it('is in small letters, without accents, and with a hyphen for anything that is neither a letter nor a figure', () => {
    expect(slugOf('España')).toBe('espana');
    expect(slugOf('Emiratos Árabes Unidos')).toBe('emiratos-arabes-unidos');
    expect(slugOf('Côte d’Ivoire')).toBe('cote-d-ivoire');
    expect(slugOf('São Tomé and Príncipe')).toBe('sao-tome-and-principe');
    expect(slugOf('Curaçao')).toBe('curacao');
    expect(slugOf('San Martín (Francia)')).toBe('san-martin-francia');
    expect(slugOf('  Timor-Leste  ')).toBe('timor-leste');
    expect(slugOf('Área 51')).toBe('area-51');
    expect(slugOf('¿?')).toBe('');
  });
});

describe('the pages of the map of a country', () => {
  it('are two, one in each language, called after the country in that language', () => {
    const pages = mapPagesOf([SPAIN]);
    expect(pages.map((p) => [p.map, p.lang])).toEqual([
      ['ES', 'es'],
      ['ES', 'en'],
    ]);
    expect(pages.map((p) => pageFile(p))).toEqual(['mapa-es-espana.html', 'map-es-spain.html']);
    // Each knows what the other is called: it is where the page says its other language is.
    for (const p of pages) expect(p.files).toEqual({ es: 'mapa-es-espana', en: 'map-es-spain' });
    expect([MAP_WORD.es, MAP_WORD.en]).toEqual(['mapa', 'map']);
  });

  it('are named after the finest pieces of the map, which is what they open the game on', () => {
    expect(of(mapPagesOf([SPAIN]), 'es').name).toBe('España: provincias en el mapa');
    expect(of(mapPagesOf([SPAIN]), 'en').name).toBe('Spain: provinces on the map');
    expect(of(mapPagesOf([UK]), 'es').name).toBe('Reino Unido: condados y distritos en el mapa');
    expect(of(mapPagesOf([ANDORRA]), 'en').name).toBe('Andorra: parishes on the map');
  });

  it('tell how many pieces the map has at each level, from the coarsest to the finest', () => {
    expect(of(mapPagesOf([SPAIN]), 'es').description).toBe(
      'España en el mapa: 19 comunidades autónomas y 52 provincias. Juega a señalar, identificar, reconocer siluetas y montar el puzle, gratis y sin registro, hasta saberte el mapa entero.',
    );
    expect(of(mapPagesOf([SPAIN]), 'en').description).toBe(
      'Spain on the map: 19 autonomous communities and 52 provinces. Pin, identify, tell outlines apart and piece the jigsaw together, free and with no sign-up, until you know the whole map.',
    );
    expect(of(mapPagesOf([ANDORRA]), 'es').description).toMatch(/^Andorra en el mapa: 7 parroquias\. Juega /);
    // Three levels of plain names: commas, and an "y" before the last.
    const three: MapSource = { id: 'ZZ', n: { es: 'Tierra', en: 'Land' }, lv: [{ n: 2, es: 'zonas', en: 'zones' }, { n: 5, es: 'regiones', en: 'regions' }, { n: 30, es: 'distritos', en: 'districts' }] };
    expect(of(mapPagesOf([three]), 'es').description).toMatch(/^Tierra en el mapa: 2 zonas, 5 regiones y 30 distritos\. /);
    expect(of(mapPagesOf([three]), 'en').description).toMatch(/^Land on the map: 2 zones, 5 regions and 30 districts\. /);
  });

  it('keep the levels apart with semicolons where the name of one has an "y" of its own', () => {
    expect(of(mapPagesOf([UK]), 'es').description).toMatch(/^Reino Unido en el mapa: 4 naciones; 12 naciones y regiones; 232 condados y distritos\. /);
    expect(of(mapPagesOf([UK]), 'en').description).toMatch(/^United Kingdom on the map: 4 nations; 12 nations and regions; 232 counties and districts\. /);
    // An "y" that is a letter of a word is not one that joins two: those names go in a row like any others.
    const letters: MapSource = { id: 'ZZ', n: { es: 'Tierra', en: 'Land' }, lv: [{ n: 3, es: 'ayuntamientos', en: 'islands' }, { n: 9, es: 'distritos y', en: 'districts and' }] };
    expect(of(mapPagesOf([letters]), 'es').description).toMatch(/^Tierra en el mapa: 3 ayuntamientos y 9 distritos y\. /);
    expect(of(mapPagesOf([letters]), 'en').description).toMatch(/^Land on the map: 3 islands and 9 districts and\. /);
    // One level alone needs nothing between it and anything.
    const one: MapSource = { id: 'ZZ', n: { es: 'Tierra' }, lv: [{ n: 9, es: 'provincias y ciudades', en: 'provinces and cities' }] };
    expect(of(mapPagesOf([one]), 'es').description).toMatch(/^Tierra en el mapa: 9 provincias y ciudades\. /);
  });

  it('go by the Spanish name of a country that has no other', () => {
    const pages = mapPagesOf([ANDORRA]);
    expect(pages.map((p) => pageFile(p))).toEqual(['mapa-ad-andorra.html', 'map-ad-andorra.html']);
    expect(of(pages, 'en').description).toMatch(/^Andorra on the map: 7 parishes\. Pin, /);
  });

  it('are only for a map the game opens: two pieces or more at its finest, of a country that can be chosen', () => {
    const rock: MapSource = { id: 'GI', n: { es: 'Gibraltar' }, lv: [{ n: 1, es: 'territorios', en: 'territories' }] };
    const none: MapSource = { id: 'AQ', n: { es: 'Antártida', en: 'Antarctica' }, lv: [] };
    expect(mapPagesOf([rock, none])).toEqual([]);
    expect(mapPagesOf([rock, SPAIN, none]).map((p) => p.map)).toEqual(['ES', 'ES']);
    // What counts is the finest level, as where the countries are chosen: a coarser one with pieces is not enough.
    expect(mapPagesOf([{ id: 'ZZ', n: { es: 'Tierra' }, lv: [{ n: 3, es: 'reinos', en: 'kingdoms' }, { n: 1, es: 'islas', en: 'islands' }] }])).toEqual([]);
    // A territory that is not a country to choose has no page, whatever its map.
    expect(mapPagesOf([{ ...SPAIN, cl: 'other' }])).toEqual([]);
    for (const cl of ['un', 'dep', 'obs', 'partial', undefined]) expect(mapPagesOf([{ ...SPAIN, cl }]), String(cl)).toHaveLength(2);
    // A level of one piece is not told: the map is that of its finer level.
    const whole: MapSource = { id: 'ZZ', n: { es: 'Tierra' }, lv: [{ n: 1, es: 'reinos', en: 'kingdoms' }, { n: 2, es: 'islas', en: 'islands' }] };
    expect(of(mapPagesOf([whole]), 'es').description).toMatch(/^Tierra en el mapa: 2 islas\. /);
    expect(of(mapPagesOf([whole]), 'en').description).toMatch(/^Tierra on the map: 2 islands\. /);
    expect(of(mapPagesOf([whole]), 'es').name).toBe('Tierra: islas en el mapa');
    // The finest level is the last one, whatever the others have.
    const coarse: MapSource = { id: 'ZZ', n: { es: 'Tierra' }, lv: [{ n: 9, es: 'reinos', en: 'kingdoms' }, { n: 4, es: 'islas', en: 'islands' }] };
    expect(of(mapPagesOf([coarse]), 'es').name).toBe('Tierra: islas en el mapa');
    expect(of(mapPagesOf([coarse]), 'en').name).toBe('Tierra: islands on the map');
    // Two pieces are enough.
    expect(mapPagesOf([{ id: 'ZZ', n: { es: 'Tierra' }, lv: [{ n: 2, es: 'islas', en: 'islands' }] }])).toHaveLength(2);
  });

  it('are none for a country without a code the game could read back from the name of its page', () => {
    for (const id of ['ESP', 'e', 'es', '1A', 'E-S', '']) expect(mapPagesOf([{ ...SPAIN, id }]), id).toEqual([]);
    expect(mapPagesOf([{ ...SPAIN, id: 'X1' }]).map((p) => pageFile(p))).toEqual(['mapa-x1-espana.html', 'map-x1-spain.html']);
  });

  it('are not written at all when two of them would be one, or one would have no name', () => {
    expect(() => mapPagesOf([SPAIN, SPAIN])).toThrow(/ES/);
    expect(() => mapPagesOf([{ ...SPAIN, n: { es: '¿?', en: 'Spain' } }])).toThrow(/mapa-es-/);
    expect(() => mapPagesOf([{ ...SPAIN, n: { es: 'España', en: '***' } }])).toThrow(/map-es-/);
    // The same name under another code is another page.
    expect(mapPagesOf([SPAIN, { ...SPAIN, id: 'PT' }])).toHaveLength(4);
  });
});

describe('the name of the page of a map', () => {
  it('says which map it is of and in which language, with or without its extension', () => {
    expect(mapPageNamed('mapa-es-espana')).toEqual({ map: 'ES', lang: 'es' });
    expect(mapPageNamed('mapa-es-espana.html')).toEqual({ map: 'ES', lang: 'es' });
    expect(mapPageNamed('map-es-spain.html')).toEqual({ map: 'ES', lang: 'en' });
    expect(mapPageNamed('map-gb-united-kingdom')).toEqual({ map: 'GB', lang: 'en' });
    expect(mapPageNamed('mapa-x1-chipre-del-norte.html')).toEqual({ map: 'X1', lang: 'es' });
    expect(mapPageNamed('map-cd-democratic-republic-of-the-congo')).toEqual({ map: 'CD', lang: 'en' });
  });

  it('is not one that only looks like it', () => {
    for (const name of ['mapa', 'mapa-es', 'mapa-es-', 'mapa-espana', 'mapa-esp-espana', 'mapas-es-espana', 'xmapa-es-espana', 'mapa-ES-espana', 'Mapa-es-espana', 'mapa-1e-espana', 'mapa-es-españa', 'mapa-es-espana-', 'mapa-es--espana', 'mapa-es-espana.htm', 'mapa-es-espana.html.html', 'map_es_spain', 'regiones', 'es', '']) {
      expect(mapPageNamed(name), name).toBeNull();
    }
  });

  it('opens the regions of that country at their finest, whatever the address the site is at', () => {
    expect(mapAt('/regionle/mapa-es-espana.html')).toEqual({ map: 'ES', lang: 'es' });
    expect(mapAt('/map-es-spain')).toEqual({ map: 'ES', lang: 'en' });
    expect(pageMap('/regionle/mapa-es-espana.html')).toBe('regiones/ES:f');
    expect(pageMap('/a/b/map-gb-united-kingdom')).toBe('regiones/GB:f');
    // And that is an address the game knows how to read: the regions, that country, that level.
    expect(routeOf('regiones/ES:f')).toEqual({ kind: 'section', section: 'regions', link: { ids: ['ES'], levels: { ES: 'f' } } });
    for (const path of ['/regionle/', '/regionle/regiones.html', '/regionle/es.html', '/regionle/mapa-espana.html', '/mapa-es-espana/', '/regionle/mapa-es-espana.htm', '/regionle/Xmapa-es-espana.html', '/regionle/el.mapa-es-espana.html', '/regionle/A_map-es-spain']) {
      expect(mapAt(path), path).toBeNull();
      expect(pageMap(path), path).toBeNull();
    }
  });
});

describe('the pages of the maps of the site as it is', () => {
  const pages = mapPagesOf(WORLD);

  it('are two for each country that can be chosen among the regions, and no other', () => {
    // The rule of the game itself (lib/world.ts): a page for a map it would not open would open nothing.
    const playable = WORLD.filter((c) => eligible('regions', c as unknown as Country));
    expect(playable.length).toBeGreaterThan(200);
    expect(pages).toHaveLength(playable.length * 2);
    expect(new Set(pages.map((p) => p.map))).toEqual(new Set(playable.map((c) => c.id)));
    for (const lang of SEO_LANGS) expect(pages.filter((p) => p.lang === lang)).toHaveLength(playable.length);
  });

  it('have each a name of its own, which says its map and its language to the game', () => {
    const files = pages.map((p) => pageFile(p));
    expect(new Set(files).size).toBe(files.length);
    for (const p of pages) {
      const file = pageFile(p);
      expect(file, file).toMatch(/^(mapa|map)-[a-z][a-z0-9]-[a-z0-9]+(-[a-z0-9]+)*\.html$/);
      expect(mapPageNamed(file), file).toEqual({ map: p.map, lang: p.lang });
      // What the game opens from that name is a link to a map that it reads.
      const link = parseMapLink('regions', pageMap(`/regionle/${file}`)!.slice('regiones/'.length));
      expect(link, file).toEqual({ ids: [p.map], levels: { [p.map]: 'f' } });
    }
  });

  it('open the game on a level that the map of the country has: the finest is always the one called "f"', () => {
    for (const c of WORLD as (MapSource & { lv: { k: string }[] })[]) if (c.lv.length) expect(c.lv[c.lv.length - 1].k, c.id).toBe('f');
  });

  it('say something of their own, of a fair length, and nothing that is left to fill in', () => {
    const said = new Set<string>();
    for (const p of pages) {
      expect(p.name.length, p.name).toBeGreaterThan(12);
      expect(p.name.length, p.name).toBeLessThanOrEqual(90);
      expect(p.description.length, p.description).toBeGreaterThan(110);
      expect(p.description.length, p.description).toBeLessThanOrEqual(300);
      expect(`${p.name} ${p.description}`, p.map).not.toMatch(/undefined|null|NaN|\s{2}|: \.|\b[01] [a-zó]/);
      said.add(`${p.lang}:${p.description}`);
    }
    expect(said.size).toBe(pages.length);
  });

  it('say of Spain and of the United States what their maps are', () => {
    const es = pages.find((p) => p.map === 'ES' && p.lang === 'es')!;
    expect(pageFile(es)).toBe('mapa-es-espana.html');
    expect(es.name).toBe('España: provincias en el mapa');
    expect(es.description).toMatch(/^España en el mapa: 19 comunidades autónomas y 52 provincias\. /);
    const us = pages.find((p) => p.map === 'US' && p.lang === 'en')!;
    expect(pageFile(us)).toBe('map-us-united-states.html');
    expect(us.name).toBe('United States: states on the map');
  });
});
