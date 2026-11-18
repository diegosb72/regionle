// Checks on the generated map data in public/data: the app trusts these files blindly.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { geoArea, geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { describe, expect, it } from 'vitest';

const DATA = resolve(__dirname, '../../public/data');
const read = <T>(file: string): T => JSON.parse(readFileSync(resolve(DATA, file), 'utf8')) as T;

interface IndexCountry {
  id: string;
  cl: string;
  n: { es: string };
  cap?: { es: string };
  pop?: number;
  fl?: string;
  nb?: string[];
  sl?: string[];
  lv: { k: string; n: number }[];
  dl: string;
}
const index = read<{ countries: IndexCountry[] }>('index.json');
const byId = new Map(index.countries.map((c) => [c.id, c]));

const features = (topology: Topology, name: string) => {
  const fc = feature(topology, topology.objects[name] as GeometryCollection<{ q?: 0; nb?: string[]; sl?: string[]; g?: string[]; m?: string[] }>);
  return fc.features;
};

describe('index.json', () => {
  it('lists the 193 members of the United Nations, each with a name, a flag and people', () => {
    const un = index.countries.filter((c) => c.cl === 'un');
    expect(un).toHaveLength(193);
    for (const c of un) {
      expect(c.n.es, c.id).toBeTruthy();
      expect(c.fl, c.id).toBeTruthy();
      expect(c.pop, c.id).toBeGreaterThan(0);
      expect(c.cap?.es, c.id).toBeTruthy();
    }
  });

  it('has unique ids and symmetric neighbours', () => {
    expect(byId.size).toBe(index.countries.length);
    for (const c of index.countries) {
      for (const key of ['nb', 'sl'] as const) {
        for (const other of c[key] ?? []) {
          expect(byId.get(other)?.[key], `${c.id} → ${other}`).toContain(c.id);
        }
      }
    }
  });

  it('has one subdivision file per country and nothing else', () => {
    const files = readdirSync(resolve(DATA, 'r'))
      .map((f) => f.replace(/\.json$/, ''))
      .sort();
    expect(files).toEqual([...byId.keys()].sort());
  });
});

describe('shapes', () => {
  // A ring wound the wrong way means "the whole globe except this" to d3, and paints the map solid.
  const HALF_GLOBE = 2 * Math.PI;

  it('world.json draws every country the right way round', () => {
    const world = features(read<Topology>('world.json'), 'c');
    expect(world.map((f) => String(f.id)).sort()).toEqual([...byId.keys()].sort());
    for (const f of world) expect(geoArea(f), String(f.id)).toBeLessThan(HALF_GLOBE);
  });

  it('every subdivision file matches the index and has no inside-out shape', () => {
    const problems: string[] = [];
    for (const c of index.countries) {
      const topology = read<Topology>(`r/${c.id}.json`);
      expect(Object.keys(topology.objects).sort(), c.id).toEqual(c.lv.map((l) => l.k).sort());
      expect(
        c.lv.map((l) => l.k),
        c.id,
      ).toContain(c.dl);
      for (const level of c.lv) {
        const list = features(topology, level.k);
        const ids = new Set(list.map((f) => String(f.id)));
        if (ids.size !== list.length) problems.push(`${c.id}/${level.k}: repeated ids`);
        const asked = list.filter((f) => f.properties.q !== 0);
        if (asked.length !== level.n) problems.push(`${c.id}/${level.k}: index says ${level.n}, file has ${asked.length}`);
        for (const f of list) {
          if (!(geoArea(f) < HALF_GLOBE)) problems.push(`${f.id}: inside out`);
          if (!(geoArea(f) > 0)) problems.push(`${f.id}: no area`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('groups name members that exist, and members point back at their groups', () => {
    const problems: string[] = [];
    for (const c of index.countries) {
      if (c.lv.length < 2) continue;
      const topology = read<Topology>(`r/${c.id}.json`);
      const fine = new Map(features(topology, 'f').map((f) => [String(f.id), f]));
      for (const level of c.lv) {
        if (level.k === 'f') continue;
        for (const grp of features(topology, level.k)) {
          for (const m of grp.properties.m ?? []) {
            const unit = fine.get(m);
            if (!unit) problems.push(`${grp.id}: unknown member ${m}`);
            else if (!unit.properties.g?.includes(String(grp.id))) problems.push(`${m} does not point back at ${grp.id}`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Names of regions (scripts/data/build.mjs; config.SOURCE_FIX and HOMONYMS)
// ---------------------------------------------------------------------------

interface UnitRec {
  id: string;
  n: { es: string; en?: string; lo?: string };
  al?: string[];
  /** The kind of unit, in Spanish, when it is not the one the level is made of. */
  t?: string;
  q?: 0;
  wd?: string;
  ar: number;
}

describe('names of regions', () => {
  const fold = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const topologies = new Map<string, Topology>();
  const units = (country: string, level = 'f'): UnitRec[] => {
    if (!topologies.has(country)) topologies.set(country, read<Topology>(`r/${country}.json`));
    const object = topologies.get(country)!.objects[level] as GeometryCollection<Omit<UnitRec, 'id'>>;
    return object.geometries.map((g) => ({ ...(g.properties as Omit<UnitRec, 'id'>), id: String(g.id) }));
  };
  const asked = (country: string, level = 'f') => units(country, level).filter((u) => u.q !== 0);
  const unit = (id: string) => units(id.split(/[-~]/)[0]).find((u) => u.id === id)!;
  const es = (country: string) => asked(country).map((u) => u.n.es);
  const cities = read<{ c: Record<string, CityRec[]> }>('cities.json').c;
  /** The region a city lies in, by the name the game gives it. */
  const regionOf = (country: string, city: string) => {
    const rec = cities[country].find((c) => c.n.es === city);
    return rec?.u ? unit(rec.u).n.es : undefined;
  };

  it('gives two pieces of a map one name only where a city and the district around it share it', () => {
    // Every other pair so far was a label that had come from another place: twenty Latvian municipalities
    // called «Valmiera», seven regions of Madagascar called like their province, two halves of «Tobago».
    const twins = new Set<string>();
    for (const c of index.countries) {
      for (const level of c.lv) {
        for (const lang of ['es', 'en'] as const) {
          const byName = new Map<string, UnitRec[]>();
          for (const u of asked(c.id, level.k)) {
            const k = fold(u.n[lang] ?? u.n.es);
            byName.set(k, [...(byName.get(k) ?? []), u]);
          }
          for (const group of byName.values()) {
            if (group.length < 2) continue;
            twins.add(group.map((u) => u.id).join(' = '));
            // In Spanish, where both go by one name, the kind of unit under it tells them apart.
            if (lang === 'es') expect(new Set(group.map((u) => u.t ?? '')).size, group.map((u) => u.id).join(' = ')).toBe(group.length);
          }
        }
      }
    }
    expect([...twins].sort()).toEqual([
      'AZ-SUS = AZ-x5565', // Shusha: the district and the town
      'BG-22 = BG-23', // Sofia: the city and its province (in English)
      'BM-HA = BM-HAM', // Hamilton: the city and the parish
      'BY-HM = BY-MI', // Minsk
      'HR-01 = HR-21', // Zagreb
      'HU-VE = HU-VM', // Veszprém
      'LA-VI = LA-VT', // Vientiane (in English)
      'LV-x1066 = LV-x4851', // Rēzekne (in English)
      'LV-x1081 = LV-x4850', // Daugavpils
      'LV-x1084 = LV-x4849', // Jelgava
      'LV-x1085 = LV-x5725', // Jēkabpils
      'LV-x4852 = LV-x934', // Ventspils
      'TW-CYI = TW-CYQ', // Chiayi
      'TW-HSQ = TW-HSZ', // Hsinchu
      'UA-30 = UA-32', // Kiev
      'UZ-TK = UZ-TO', // Tashkent
      'YE-SA = YE-SN', // Saná
    ]);
  });

  it('keeps one Wikidata id to one piece, so that no piece shows the article of another', () => {
    const shared: string[] = [];
    for (const c of index.countries) {
      const byWd = new Map<string, string[]>();
      for (const u of asked(c.id)) if (u.wd) byWd.set(u.wd, [...(byWd.get(u.wd) ?? []), u.id]);
      for (const ids of byWd.values()) if (ids.length > 1) shared.push(ids.join(' = '));
    }
    // A city and the municipality around it, in Latvia: nothing in the data says whose the id is.
    expect(shared.sort()).toEqual(['LV-x1066 = LV-x4851', 'LV-x1085 = LV-x5725']);
  });

  it('names every piece in full, with no stray word in front and none left alone', () => {
    const KIND = /^(Municipalidade?|Minicipalidad|Ayuntamiento|Municipio|Estado|Ciudad|División|Provincia|Departamento|Región|Distrito|Prefectura|Condado|Cantón|Comuna)\s+/i;
    const problems: string[] = [];
    for (const c of index.countries) {
      for (const level of c.lv) {
        for (const u of units(c.id, level.k)) {
          for (const name of [u.n.es, u.n.en, u.n.lo]) {
            if (name === undefined) continue;
            if (!fold(name)) problems.push(`${u.id}: a name with no letters («${name}»)`);
            if (/^(the|an?|of|de|del|el|la|los|las)$/i.test(name.trim())) problems.push(`${u.id}: «${name}» is not a name`);
            if (/^\p{Ll}/u.test(name)) problems.push(`${u.id}: «${name}» begins in lower case`);
          }
          // «Municipalidad Kamnik», «Estado Kachin»: the kind of place in front of the name it has everywhere else.
          const rest = u.n.es.replace(KIND, '');
          if (rest !== u.n.es && [u.n.lo, u.n.en].some((other) => other !== undefined && fold(other) === fold(rest))) problems.push(`${u.id}: «${u.n.es}» for «${rest}»`);
        }
      }
    }
    expect(problems).toEqual([]);
    // The district of Anguilla that was «The» in English, and took whatever began with "the".
    expect(unit('AI-x5125').n).toEqual({ es: 'The Quarter' });
    expect(asked('SI').map((u) => u.n.es)).toEqual(expect.arrayContaining(['Kamnik', 'Maribor', 'Murska Sobota', 'Dobrepolje']));
    expect(es('GN')).toEqual(expect.arrayContaining(['Pita', 'Koubia', 'Gaoual']));
    expect(es('ZA')).toEqual(expect.arrayContaining(['Cabo Oriental', 'Cabo Occidental', 'Cabo Septentrional']));
  });

  it('lays the names of Guyana, Eritrea and Ecuador on the polygons they belong to', () => {
    // In the source the names of these three countries are rotated among their polygons. A capital lies
    // in its own region, and that is the witness here: where each city falls, by the name of the piece.
    expect(regionOf('GY', 'Georgetown')).toBe('Demerara-Mahaica');
    expect(regionOf('GY', 'Linden')).toBe('Alto Demerara-Berbice');
    expect(regionOf('GY', 'Lethem')).toBe('Alto Takutu-Alto Esequibo');
    expect(regionOf('GY', 'Bartica')).toBe('Cuyuni-Mazaruni');
    expect(regionOf('GY', 'Anna Regina')).toBe('Pomeroon-Supenaam');
    expect(regionOf('GY', 'Corriverton')).toBe('Berbice Oriental-Corentyne');
    expect(regionOf('ER', 'Asmara')).toBe('Maekel');
    expect(regionOf('ER', 'Keren')).toBe('Anseba');
    expect(regionOf('ER', 'Mendefera')).toBe('Debub');
    expect(regionOf('ER', 'Massawa')).toBe('Semenawi Keyih Bahri');
    expect(regionOf('EC', 'Ambato')).toBe('Tungurahua');
    expect(regionOf('EC', 'Tena')).toBe('Napo');
    // …and so does the size: the strip of coast is not the third of the country that touches Brazil.
    const area = (id: string) => unit(id).ar;
    expect(unit('GY-MA').n.es).toBe('Mahaica-Berbice');
    expect(area('GY-MA')).toBeLessThan(5000);
    expect(area('GY-EB')).toBeGreaterThan(30000);
    expect(area('GY-UT')).toBeGreaterThan(area('GY-UD') * 3);
    expect(area('GY-CU')).toBeGreaterThan(area('GY-PM') * 5);
    expect(area('ER-MA')).toBeLessThan(area('ER-DU'));
    expect(area('EC-N')).toBeGreaterThan(area('EC-T') * 3);
    expect(new Set(es('GY')).size).toBe(10);
    // The capitals of regions are found by where they lie, so they follow.
    const capitals = read<{ rc: Record<string, Record<string, Record<string, string[]>>> }>('capitals.json').rc;
    expect(capitals.EC.f['EC-N'][0]).toBe('Tena');
    expect(capitals.EC.f['EC-T'][0]).toBe('Ambato');
    expect(capitals.ER.f['ER-MA'][0]).toBe('Asmara');
    expect(capitals.ER.f['ER-AN'][0]).toBe('Keren');
  });

  it('calls a piece by its own name: not by its neighbour, its region, its capital or its country', () => {
    // Latvia: one Valmiera. Madagascar: twenty-two regions, none under the name of a province.
    expect(asked('LV').filter((u) => u.n.es === 'Valmiera').map((u) => u.id)).toEqual(['LV-VMR']);
    expect(unit('LV-008').n.es).toBe('Amatas');
    expect(new Set(es('MG')).size).toBe(22);
    for (const province of asked('MG', 'g1')) expect(es('MG'), province.n.es).not.toContain(province.n.es);
    expect(unit('MG-x5866').n.es).toBe('Atsimo-Andrefana');
    expect(unit('MG-x5867').n.es).toBe('Atsimo-Atsinanana');
    // A neighbour's name.
    expect(unit('GB-WRL').n.es).toBe('Wirral');
    expect(es('GB').filter((n) => n === 'Halton')).toHaveLength(1);
    expect(unit('AZ-LAC').n).toEqual({ es: 'Lachín', en: 'Lachin', lo: 'Laçın' });
    expect(unit('AZ-LA').n.es).toBe('Lankaran');
    // The county, the region or the country it belongs to.
    expect(unit('GB-SHN').n.es).toBe('St Helens');
    expect(unit('GB-LND').n).toMatchObject({ es: 'City de Londres', en: 'City of London' });
    expect(unit('IT-BZ').n).toMatchObject({ es: 'Bolzano', en: 'South Tyrol' });
    expect(unit('IT-GE').n).toMatchObject({ es: 'Génova', en: 'Genoa' });
    for (const region of asked('IT', 'g1')) expect(es('IT'), region.n.es).not.toContain(region.n.es);
    expect(unit('VN-66').n.es).toBe('Hưng Yên');
    expect(unit('PM-x4866')).toMatchObject({ n: { es: 'Saint-Pierre' }, al: ['San Pedro'] });
    expect(unit('MP-x4940').n).toMatchObject({ es: 'Islas del Norte', en: 'Northern Islands' });
    expect(unit('DK-84').n.en).toBe('Capital Region');
    // Its capital, or a place of another country.
    expect(unit('MD-GA').n.es).toBe('Gagauzia');
    expect(unit('XK-x5902').n.es).toBe('Pristina');
    expect(unit('XK-x5908').n.es).toBe('Prizren');
    expect(unit('ML-3').n.es).toBe('Sikasso');
    // Two districts of one name on two islands.
    expect([unit('SC-13').n.es, unit('SC-14').n.es]).toEqual(["Grand'Anse Mahé", "Grand'Anse Praslin"]);
    expect([unit('MT-65').n.es, unit('MT-66').n.es]).toEqual(['Żebbuġ (Gozo)', 'Żebbuġ (Malta)']);
    // The name of today, with the one it had before still accepted.
    expect(unit('TJ-SU')).toMatchObject({ n: { es: 'Sughd' }, al: expect.arrayContaining(['Leninabad']) });
    expect(unit('DO-07')).toMatchObject({ n: { es: 'Elías Piña' }, al: ['La Estrelleta'] });
    expect(unit('NA-CA')).toMatchObject({ n: { es: 'Zambezi' }, al: ['Caprivi'] });
  });

  it('asks the seven emirates, and Tobago once', () => {
    expect(byId.get('AE')!.lv).toMatchObject([{ k: 'f', n: 7 }]);
    expect(es('AE').sort()).toEqual(['Abu Dabi', 'Ajman', 'Dubái', 'Fuyaira', 'Ras al-Jaima', 'Sarja', 'Umm al-Qaywayn']);
    // The two neutral zones on the border with Oman are drawn and not asked.
    const zones = units('AE').filter((u) => u.q === 0);
    expect(zones.map((u) => [u.n.es, u.n.en])).toEqual([
      ['Zona neutral', 'Neutral Zone'],
      ['Zona neutral', 'Neutral Zone'],
    ]);
    // Every emirate is called after its capital: there is no capital to ask.
    expect(read<{ rc: Record<string, unknown> }>('capitals.json').rc.AE).toBeUndefined();
    expect(es('TT').filter((n) => n.includes('Tobago'))).toEqual(['Tobago']);
    expect(unit('TT-TOB').ar).toBeGreaterThan(280);
  });

  it('uses the Spanish name where the place has one, also when it looks nothing like the local one', () => {
    // The source's Spanish label was only believed when it resembled the local name, so a translation or a
    // Spanish name of its own was thrown away: «Norte» stood beside "Western", and Jartum was "Khartoum".
    expect(es('ZM')).toEqual(expect.arrayContaining(['Norte', 'Sur', 'Este', 'Oeste', 'Noroeste', 'Central']));
    expect(es('RW').sort()).toEqual(['Este', 'Kigali', 'Norte', 'Oeste', 'Sur']);
    expect(es('BW')).toEqual(expect.arrayContaining(['Noreste', 'Noroeste', 'Sudeste', 'Sur', 'Central']));
    for (const c of ['ZM', 'RW', 'BW', 'SL', 'HK', 'SB', 'PG', 'AS']) {
      for (const name of es(c)) expect(name, c).not.toMatch(/^(North|South|East|West)(ern)?([- ](East|West)(ern)?)?$/);
    }
    expect(es('SD')).toEqual(expect.arrayContaining(['Jartum', 'Nilo Azul', 'Nilo Blanco', 'Río Nilo', 'Mar Rojo', 'Darfur del Oeste']));
    expect(es('SS')).toEqual(expect.arrayContaining(['Ecuatoria Oriental', 'Ecuatoria Occidental', 'Alto Nilo', 'Lagos', 'Unidad']));
    expect(es('PG')).toEqual(expect.arrayContaining(['Nueva Irlanda', 'Tierras Altas Orientales', 'Nueva Bretaña del Este', 'Golfo', 'Bougainville']));
    expect(es('PS').sort()).toEqual(['Cisjordania', 'Gaza']);
    // A Spanish label written in English, and the halves of a region that was split under two spellings
    // («Al Batnah North» beside «Al Batinah Sur») or under the name of the whole («Oriental»).
    expect(es('TZ')).toEqual(expect.arrayContaining(['Pemba Norte', 'Pemba Sur', 'Zanzíbar Norte', 'Zanzíbar Central/Sur', 'Zanzíbar Urbano/Oeste']));
    expect(es('OM')).toEqual(expect.arrayContaining(['Al Batinah Norte', 'Al Batinah Sur', 'Ash Sharqiyah Norte', 'Ash Sharqiyah Sur']));
    for (const name of [...es('TZ'), ...es('OM')]) expect(name).not.toMatch(/\b(North|South|East|West)\b/);
    expect(unit('OM-SH')).toMatchObject({ n: { es: 'Ash Sharqiyah Sur', en: 'Ash Sharqiyah South' }, al: expect.arrayContaining(['Oriental']) });
    expect(unit('TZ-07').al).toContain('Zanzibar North');
    // What it was called before is still taken.
    expect(unit('SD-KH')).toMatchObject({ n: { es: 'Jartum', en: 'Khartoum' } });
    expect(unit('PS-WBK')).toMatchObject({ n: { es: 'Cisjordania', en: 'West Bank' }, al: ['Ribera Occidental'] });
    // A unit called after the capital of its country goes by the name the game gives that capital.
    for (const [country, id] of [
      ['SD', 'SD-KH'],
      ['GE', 'GE-TB'],
      ['DJ', 'DJ-DJ'],
      ['TD', 'TD-ND'],
      ['BT', 'BT-15'],
      ['AE', 'AE-AZ'],
      ['BD', 'BD-C'],
      ['JO', 'JO-AM'],
      ['MW', 'MW-LI'],
      ['OM', 'OM-MA'],
      ['AD', 'AD-07'],
      ['AI', 'AI-x5126'],
      ['PM', 'PM-x4866'],
    ]) {
      expect(unit(id).n.es, id).toBe(byId.get(country)!.cap!.es);
    }
    // In English too: the name the place has in English, not the local one spelt out.
    const en = (id: string) => unit(id).n.en ?? unit(id).n.es;
    expect([en('ER-SK'), en('ER-DK')]).toEqual(['Northern Red Sea', 'Southern Red Sea']);
    expect([en('SO-JD'), en('SO-SH')]).toEqual(['Middle Juba', 'Lower Shebelle']);
    expect(['BH-13', 'BH-14', 'BH-16', 'BH-17'].map(en)).toEqual(['Capital', 'Southern', 'Central', 'Northern']);
    expect([en('KH-5'), en('CZ-PL'), en('SD-DW'), en('PG-NSB')]).toEqual(['Kampong Speu', 'Plzeň', 'West Darfur', 'Bougainville']);
    // A name the place no longer goes by gives way to the one it has, and is still taken.
    expect(unit('TM-D')).toMatchObject({ n: { es: 'Daşoguz' }, al: expect.arrayContaining(['Tashauz']) });
    expect(unit('PH-COM')).toMatchObject({ n: { es: 'Davao de Oro' }, al: expect.arrayContaining(['Compostela Valley']) });
    expect(unit('NI-AN')).toMatchObject({ n: { es: 'Costa Caribe Norte' }, al: expect.arrayContaining(['Atlántico Norte']) });
  });

  it('spells a name the way it is spelt: no letters swapped, dropped or added in one label of the three', () => {
    // «Vekila Polana» beside "Velika Polana", «Haute-Rhin», «Zinguldak»: one label with a slip of the pen,
    // found by setting each name against the other two.
    const spelt: [string, 'es' | 'lo', string][] = [
      ['SI-094', 'es', 'Postojna'],
      ['SI-101', 'es', 'Radlje ob Dravi'],
      ['SI-187', 'es', 'Velika Polana'],
      ['SZ-SH', 'es', 'Shiselweni'],
      ['PW-370', 'es', 'Sonsorol'],
      ['BT-TY', 'es', 'Trashiyangtse'],
      ['ET-BE', 'es', 'Benishangul-Gumuz'],
      ['PW-050', 'lo', 'Hatohobei'],
      ['IT-KR', 'lo', 'Crotone'],
      ['IT-OR', 'lo', 'Oristano'],
      ['FR-68', 'lo', 'Haut-Rhin'],
      ['FR-77', 'lo', 'Seine-et-Marne'],
      ['GB-NAY', 'lo', 'North Ayrshire'],
      ['TR-67', 'lo', 'Zonguldak'],
    ];
    for (const [id, lang, name] of spelt) {
      const u = unit(id);
      expect(u.n[lang] ?? u.n.es, `${id} ${lang}`).toBe(name);
      // The label with the slip is not kept as another name of the piece.
      expect((u.al ?? []).filter((a) => /Municipalidad/.test(a)), id).toEqual([]);
    }
    // The same letters in another order, in a name of one word, is a slip; a name of several words may be
    // turned round on purpose («Java Central» for "Central Java").
    const tight = (name: string) => fold(name).replace(/ /g, '');
    const letters = (name: string) => [...tight(name)].sort().join('');
    for (const country of index.countries) {
      for (const u of asked(country.id)) {
        for (const other of [u.n.en, u.n.lo]) {
          if (!other || tight(other) === tight(u.n.es) || /\s|-/.test(u.n.es.trim())) continue;
          if (['Argel', 'Luxemburgo', 'Friburgo'].includes(u.n.es)) continue; // Alger, Luxembourg, Fribourg
          expect(letters(other) === letters(u.n.es), `${u.id} «${u.n.es}» / «${other}»`).toBe(false);
        }
      }
    }
    // A district of Anguilla goes by its English name, as the other thirteen do.
    expect(unit('AI-x5119')).toMatchObject({ n: { es: 'North Side' }, al: ['Lado norte'] });
    expect(unit('GL-UO').n).toMatchObject({ es: 'Parque nacional del noreste de Groenlandia', en: 'Northeast Greenland National Park' });
    expect(unit('ER-SK').al).toEqual(expect.arrayContaining(['Mar Rojo Septentrional']));
  });

  it('names the regions a country is asked by, not the label of a field of the source', () => {
    // The Philippines, Azerbaijan and Burkina Faso are asked by region, and the regions were called
    // «Bicol (Region V)», «Absheron Economic Region», «Centre-Est»; Caraga was «Dinagat Islands (Region XIII)».
    const named = (country: string) => asked(country, byId.get(country)!.dl).map((u) => u.n.es);
    expect(byId.get('PH')!.dl).toBe('g1');
    expect(named('PH').sort((a, b) => a.localeCompare(b, 'es'))).toEqual([
      'Bangsamoro',
      'Bicol',
      'Bisayas Centrales',
      'Bisayas Occidentales',
      'Bisayas Orientales',
      'Calabarzon',
      'Caraga',
      'Davao',
      'Gran Manila',
      'Ilocos',
      'La Cordillera',
      'Luzón Central',
      'Mimaropa',
      'Mindanao del Norte',
      'Península de Zamboanga',
      'Soccsksargen',
      'Valle del Cagayán',
    ]);
    expect(named('AZ')).toEqual(expect.arrayContaining(['Absheron', 'Najicheván', 'Alto Karabaj', 'Kalbajar-Lachín']));
    expect(named('BF')).toEqual(expect.arrayContaining(['Centro', 'Centro-Este', 'Este', 'Norte', 'Sudoeste', 'Sahel']));
    expect(named('GN')).toEqual(expect.arrayContaining(['Conakri', 'Boké']));
    // The ids are the ones these pieces had: progress is kept by id.
    expect(asked('PH', 'g1').map((u) => u.id)).toEqual(expect.arrayContaining(['PH~dinagat-islands-region-xiii', 'PH~national-capital-region']));
    for (const c of index.countries) {
      for (const u of asked(c.id, c.dl)) {
        for (const name of [u.n.es, u.n.en ?? u.n.es]) {
          expect(name, u.id).not.toMatch(/\((Region|Región|CAR|ARMM)\b|Economic Region|Autonomous Republic$/);
        }
      }
    }
  });
});

describe('names of cities and capitals', () => {
  const cities = read<{ c: Record<string, CityRec[]> }>('cities.json').c;
  const all = Object.entries(cities).flatMap(([country, list]) => list.map((c) => ({ country, ...c })));
  const city = (country: string, name: string) => cities[country].find((c) => c.n.es === name)!;
  const SCHOLARLY = /[āēīōūġḥṭṣḍẓḳčšʿʾ]/i;

  it('gives no city the label of another thing', () => {
    // Each of these was in the game: Puerto Plata as «El higo luperon», and in English Coquimbo as
    // "Atlético Morelia", Mazatlán as "Juarez", the Colón of Panama as "Bucaramanga", Hail as "Saudi Arabia".
    const namesIn = (country: string) => new Set(cities[country].flatMap((c) => [c.n.es, c.n.en ?? '', ...((c as { al?: string[] }).al ?? [])]));
    for (const [country, wrong] of [
      ['DO', 'El higo luperon'],
      ['CL', 'Atlético Morelia'],
      ['CL', 'Trehuaco'],
      ['MX', 'Juarez'],
      ['MX', 'Ciudad Madero Tamaulipas'],
      ['PA', 'Bucaramanga'],
      ['SA', 'Saudi Arabia'],
      ['EG', 'sharkia'],
      ['IQ', 'Thi Qar'],
      ['KH', 'Kam'],
    ]) {
      expect(namesIn(country).has(wrong), `${country} ${wrong}`).toBe(false);
    }
    expect(city('DO', 'Puerto Plata').u).toBe('DO-18');
    expect(city('MX', 'Mazatlán').n).toEqual({ es: 'Mazatlán' });
    expect(city('PA', 'Colón').n).toEqual({ es: 'Colón' });
    expect(city('CU', 'Caibarién')).toBeTruthy();
    expect(cities.CU.filter((c) => c.n.es.startsWith('Placetas'))).toHaveLength(1);
    expect(city('BZ', 'San Ignacio')).toBeTruthy();
    // The capitals of regions are cities, and take their names from them.
    const capitals = read<{ rc: Record<string, Record<string, Record<string, string[]>>> }>('capitals.json').rc;
    expect(capitals.DO.f['DO-18']).toEqual(['Puerto Plata']);
    expect(capitals.SA.f['SA-06']).not.toContain('Saudi Arabia');
    expect(capitals.PA.f['PA-3']).toEqual(['Colón']);
  });

  it('writes every city name as a name: a capital letter first, no scholarly marks, no kind of place in front', () => {
    const problems: string[] = [];
    for (const c of all) {
      for (const name of [c.n.es, c.n.en]) {
        if (name === undefined) continue;
        // «'s-Hertogenbosch» and «'Alayat Sama’il» begin with an apostrophe, and rightly.
        if (/^\p{Ll}/u.test(name)) problems.push(`${c.country} «${name}» begins in lower case`);
      }
      if (SCHOLARLY.test(c.n.es) && !SCHOLARLY.test(c.n.en ?? c.n.es)) problems.push(`${c.country} «${c.n.es}» for «${c.n.en}»`);
      if (/^(Condado|Distrito|Municipio|Provincia|Prefectura|Departamento)\s/.test(c.n.es) && c.n.en !== undefined) problems.push(`${c.country} «${c.n.es}»`);
    }
    expect(problems).toEqual([]);
    expect(cities.AF.map((c) => c.n.es)).toEqual(expect.arrayContaining(['Herat', 'Kunduz', 'Baghlan', 'Sheberghan']));
    expect(cities.PH.map((c) => c.n.es)).toEqual(expect.arrayContaining(['Davao', 'Cebú', 'Zamboanga', 'Ciudad Quezon']));
  });

  it('spells a capital the way the unit called after it is spelt, and takes no scrap of a name for it', () => {
    expect(byId.get('AE')!.cap).toMatchObject({ es: 'Abu Dabi', en: 'Abu Dhabi' });
    expect(byId.get('BD')!.cap).toMatchObject({ es: 'Daca', al: ['Dacca'] });
    expect(city('AE', 'Abu Dabi')).toBeTruthy();
    expect(cities.AE.map((c) => c.n.es)).toEqual(expect.arrayContaining(['Ras al-Jaima', 'Umm al-Qaywayn', 'Sarja', 'Fuyaira']));
    // The source cuts its other names at the first letter that is not ASCII: Hanoi also answered to «H».
    for (const c of index.countries) {
      const cap = c.cap as { es: string; en?: string; al?: string[] } | undefined;
      for (const a of cap?.al ?? []) {
        expect(a.length, `${c.id} «${a}»`).toBeGreaterThan(1);
        expect(a, c.id).not.toMatch(/[()]/);
        for (const full of [cap!.es, cap!.en ?? cap!.es]) {
          const cut = full.length > a.length && full.startsWith(a) && /[^\x00-\x7f]/.test(full[a.length]);
          expect(cut, `${c.id} «${a}» of «${full}»`).toBe(false);
        }
      }
    }
    expect(byId.get('VN')!.cap).toEqual({ es: 'Hanói', en: 'Hanoi', ll: [105.848, 21.035] });
    expect(byId.get('MX')!.cap).toMatchObject({ es: 'Ciudad de México', al: ['México', 'México D. F.', 'CDMX', 'Mexico DF'] });
  });
});

// ---------------------------------------------------------------------------
// Cities and physical geography (scripts/data/physical.mjs)
// ---------------------------------------------------------------------------

interface PhysRec {
  i: string;
  k: string;
  n: { es: string; en?: string };
  ct: string[];
  r: number;
  /** One of the best known on the map of its country. */
  h?: number;
  /** The countries it is asked in. */
  co?: string[];
  t?: string;
  ar?: number;
  lp: [number, number];
  fp: [number, number][];
  /** Lines and surfaces; a peak or a cape is the point its name hangs from and has none. */
  g?: ['L' | 'A', number[][]];
  /** An ocean with its seas, drawn where no sea is asked. */
  gw?: ['A', number[][]];
  /** Height of a peak, in metres. */
  el?: number;
  wd?: string;
}
interface CityRec {
  i: string;
  n: { es: string; en?: string };
  ll: [number, number];
  p: number;
  k?: number;
  u?: string;
  wd?: string;
}

describe('physical.json', () => {
  const file = read<{ scale: number; f: PhysRec[] }>('physical.json');
  const KINDS = ['continent', 'ocean', 'river', 'lake', 'sea', 'range', 'plain', 'peninsula', 'peak', 'cape', 'desert', 'island', 'fall'];
  /** Drawn as a dot: there is no shape to them. */
  const DOTS = ['peak', 'cape', 'fall'];
  const PLACES = ['EU', 'AS', 'AF', 'AM', 'OC', 'AN'];
  const byKind = (k: string) => file.f.filter((f) => f.k === k);
  /** Undoes the storage: the first point and then the steps, in whole fractions of a degree. */
  const decode = (flat: number[]): [number, number][] => {
    const out: [number, number][] = [];
    let x = 0;
    let y = 0;
    for (let i = 0; i + 1 < flat.length; i += 2) {
      x += flat[i];
      y += flat[i + 1];
      out.push([x / file.scale, y / file.scale]);
    }
    return out;
  };

  it('names every feature in both languages, under an id of its own', () => {
    expect(new Set(file.f.map((f) => f.i)).size).toBe(file.f.length);
    for (const f of file.f) {
      expect(f.n.es, f.i).toBeTruthy();
      expect(f.n.en, f.i).toBeTruthy();
      expect(KINDS, f.i).toContain(f.k);
      expect([1, 2, 3], f.i).toContain(f.r);
      expect(f.ct.length, f.i).toBeGreaterThan(0);
      for (const c of f.ct) expect(PLACES, f.i).toContain(c);
    }
  });

  it('keeps the ids that the answers already learnt are stored under', () => {
    // An id is where the progress of a player hangs from: new features must not push an old one to another name.
    for (const id of ['r:tagus', 'r:ebro', 'r:douro', 'r:guadalquivir', 'r:guadiana', 'r:minho', 'r:pyrenees', 'r:cantabrian-mountains', 'r:sierra-morena', 'i:majorca', 'i:ibiza', 'p:teide', 'p:mulhacen', 'p:aneto', 's:strait-of-gibraltar', 's:bay-of-biscay'])
      expect(file.f.some((f) => f.i === id), id).toBe(true);
  });

  it('says in which countries each feature is asked, with countries that exist', () => {
    const problems: string[] = [];
    for (const f of file.f) {
      for (const c of f.co ?? []) if (!byId.has(c)) problems.push(`${f.i}: in ${c}, which is no country`);
      if (new Set(f.co ?? []).size !== (f.co ?? []).length) problems.push(`${f.i}: a country twice`);
      // What no continent shows has to be on the map of some country, or it would never be asked.
      if (f.r === 3 && !f.co?.length) problems.push(`${f.i}: only for the map of its country, and it has none`);
      if (f.h != null && f.h !== 1) problems.push(`${f.i}: h is ${f.h}`);
    }
    expect(problems).toEqual([]);
    const of = (id: string) => file.f.find((f) => f.i === id)?.co ?? [];
    // Rivers by the countries they run through, a border counting for both sides.
    expect(of('r:tagus')).toEqual(['ES', 'PT']);
    expect(of('r:minho')).toEqual(['ES', 'PT']);
    expect(of('r:danube')).toEqual(expect.arrayContaining(['DE', 'AT', 'HU', 'RO']));
    expect(of('r:nile')).toEqual(expect.arrayContaining(['EG', 'SD']));
    // The Garonne rises in Spain and leaves it at once: it is a river of France.
    expect(of('r:garonne')).toEqual(['FR']);
    // Ranges and islands by the land they stand on; a small country counts when the range covers a good part of it.
    expect(of('r:pyrenees')).toEqual(['AD', 'ES', 'FR']);
    expect(of('r:alps')).toEqual(expect.arrayContaining(['AT', 'CH', 'FR', 'IT']));
    expect(of('i:borneo')).toEqual(['BN', 'ID', 'MY']);
    expect(of('i:ireland')).toEqual(['GB', 'IE']);
    // Lakes by their shores, peaks by the border they stand on, seas by the coasts they wash.
    expect(of('l:lake-victoria')).toEqual(['KE', 'TZ', 'UG']);
    expect(of('p:mont-blanc')).toEqual(['FR', 'IT']);
    expect(of('p:mount-everest')).toEqual(['CN', 'NP']);
    expect(of('s:strait-of-gibraltar')).toEqual(expect.arrayContaining(['ES', 'MA']));
    expect(of('s:black-sea')).toEqual(expect.arrayContaining(['BG', 'GE', 'RO', 'RU', 'TR', 'UA']));
    // On the map of Spain the sea off its north coast has a name of its own.
    expect(of('s:bay-of-biscay')).toEqual(['FR']);
    expect(of('s:cantabrian-sea')).toEqual(['ES']);
  });

  it('has the physical map of Spain that a school atlas has', () => {
    const spain = file.f.filter((f) => f.co?.includes('ES'));
    const known = spain.filter((f) => f.r === 1 || f.h === 1);
    // The seas of a map are its seas and its oceans: the Atlantic is asked with the Cantabrian.
    const names = (list: PhysRec[], kind: string) => list.filter((f) => f.k === kind || (kind === 'sea' && f.k === 'ocean')).map((f) => f.n.es);
    expect(spain.length).toBeGreaterThanOrEqual(150);
    for (const [kind, all, first] of [
      ['river', 75, 35],
      ['range', 12, 10],
      ['plain', 4, 4],
      ['cape', 12, 9],
      ['island', 11, 11],
      ['sea', 8, 6],
      ['peak', 8, 6],
      ['lake', 12, 3],
    ] as const) {
      expect(names(spain, kind).length, kind).toBeGreaterThanOrEqual(all);
      expect(names(known, kind).length, kind).toBeGreaterThanOrEqual(first);
    }
    // What every pupil is asked to place.
    expect(names(known, 'river')).toEqual(expect.arrayContaining(['Miño', 'Duero', 'Tajo', 'Guadiana', 'Guadalquivir', 'Ebro', 'Júcar', 'Segura', 'Turia', 'Sil', 'Pisuerga', 'Esla', 'Tormes', 'Jarama', 'Genil', 'Segre', 'Cinca', 'Gállego', 'Jalón', 'Nalón', 'Nervión', 'Llobregat', 'Ter']));
    expect(names(known, 'range')).toEqual(
      expect.arrayContaining(['Pirineos', 'Cordillera Cantábrica', 'Macizo Galaico', 'Sistema Central', 'Sistema Ibérico', 'Montes de Toledo', 'Sierra Morena', 'Cordillera Subbética', 'Cordillera Penibética', 'Cordillera Costero-Catalana']),
    );
    expect(names(known, 'plain').sort()).toEqual(['Depresión del Ebro', 'Depresión del Guadalquivir', 'Submeseta Norte', 'Submeseta Sur']);
    expect(names(known, 'cape')).toEqual(expect.arrayContaining(['Cabo Finisterre', 'Estaca de Bares', 'Cabo de Peñas', 'Cabo de Creus', 'Cabo de la Nao', 'Cabo de Palos', 'Cabo de Gata', 'Punta de Tarifa', 'Cabo de Trafalgar']));
    expect(names(known, 'island').sort()).toEqual(['El Hierro', 'Formentera', 'Fuerteventura', 'Gran Canaria', 'Ibiza', 'La Gomera', 'La Palma', 'Lanzarote', 'Mallorca', 'Menorca', 'Tenerife']);
    expect(names(known, 'sea')).toEqual(expect.arrayContaining(['Mar Cantábrico', 'Mar Mediterráneo', 'Océano Atlántico', 'Estrecho de Gibraltar', 'Golfo de Cádiz', 'Golfo de Valencia']));
    expect(names(known, 'peak')).toEqual(expect.arrayContaining(['Teide', 'Mulhacén', 'Aneto']));
    // One name, one feature: nothing on the map of Spain is called as something else there is.
    for (const lang of ['es', 'en'] as const) {
      const all = spain.map((f) => (f.n[lang] ?? f.n.es).toLowerCase());
      expect(all.filter((n, i) => all.indexOf(n) !== i), lang).toEqual([]);
    }
    // Reservoirs say that they are one.
    for (const f of spain.filter((x) => x.k === 'lake')) expect(f.t === 'res', f.i).toBe(f.n.es.startsWith('Embalse'));
  });

  it('draws the rivers of Spain whole, from the atlas of the country', () => {
    const line = (id: string) => (file.f.find((f) => f.i === id)?.g?.[1] ?? []).map(decode);
    /** Kilometres from a place to a stretch of line, on a plane: fine at this size. */
    const off = (at: [number, number], a: [number, number], b: [number, number]) => {
      const cos = Math.cos((at[1] * Math.PI) / 180);
      const [ax, ay, bx, by] = [(a[0] - at[0]) * cos, a[1] - at[1], (b[0] - at[0]) * cos, b[1] - at[1]];
      const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
      const t = len2 ? Math.max(0, Math.min(1, -(ax * (bx - ax) + ay * (by - ay)) / len2)) : 0;
      return Math.hypot(ax + t * (bx - ax), ay + t * (by - ay)) * 111.2;
    };
    /** How near a river passes to a place. */
    const passes = (id: string, at: [number, number]) => Math.min(...line(id).flatMap((pts) => pts.slice(1).map((p, i) => off(at, pts[i], p))));
    // One line each, source to mouth: the atlas cuts them at every reservoir and the build sews them back.
    for (const id of ['r:tagus', 'r:ebro', 'r:douro', 'r:guadiana', 'r:guadalquivir', 'r:minho', 'r:jucar', 'r:segura', 'r:jarama', 'r:navia']) expect(line(id).length, id).toBe(1);
    // Each river by a town that stands on it.
    expect(passes('r:tagus', [-4.02, 39.86])).toBeLessThan(5); // Toledo
    expect(passes('r:ebro', [-0.88, 41.65])).toBeLessThan(5); // Zaragoza
    expect(passes('r:douro', [-8.61, 41.15])).toBeLessThan(5); // Oporto
    expect(passes('r:guadalquivir', [-5.98, 37.39])).toBeLessThan(5); // Sevilla
    expect(passes('r:guadiana', [-6.97, 38.88])).toBeLessThan(5); // Badajoz
    expect(passes('r:pisuerga', [-4.72, 41.65])).toBeLessThan(5); // Valladolid
    expect(passes('r:tormes', [-5.66, 40.96])).toBeLessThan(5); // Salamanca
    expect(passes('r:segura', [-1.13, 37.99])).toBeLessThan(5); // Murcia
    expect(passes('r:genil', [-3.6, 37.18])).toBeLessThan(5); // Granada
    expect(passes('r:manzanares', [-3.7, 40.42])).toBeLessThan(6); // Madrid
    expect(passes('r:nervion', [-2.93, 43.26])).toBeLessThan(5); // Bilbao
    expect(passes('r:arga', [-1.64, 42.82])).toBeLessThan(5); // Pamplona
  });

  it('puts every cape on the coast of its country', () => {
    const world = read<Topology>('world.json');
    const shapes = new Map(feature(world, world.objects.c as GeometryCollection).features.map((f) => [String(f.id), f.geometry]));
    const capes = byKind('cape');
    expect(capes.length).toBeGreaterThanOrEqual(12);
    /** Kilometres from a place to a stretch of coast, on a plane: fine at this size. */
    const off = (at: [number, number], a: number[], b: number[]) => {
      const cos = Math.cos((at[1] * Math.PI) / 180);
      const [ax, ay, bx, by] = [(a[0] - at[0]) * cos, a[1] - at[1], (b[0] - at[0]) * cos, b[1] - at[1]];
      const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
      const t = len2 ? Math.max(0, Math.min(1, -(ax * (bx - ax) + ay * (by - ay)) / len2)) : 0;
      return Math.hypot(ax + t * (bx - ax), ay + t * (by - ay)) * 111.2;
    };
    for (const f of capes) {
      expect(f.g, f.i).toBeUndefined();
      expect(f.fp, f.i).toEqual([f.lp]);
      expect(f.co?.length, f.i).toBeGreaterThan(0);
      const g = shapes.get(f.co![0])!;
      const rings = g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : [];
      const corner = Math.min(...rings.flatMap((ring) => ring.map((p) => off(f.lp, p, p))));
      const side = Math.min(...rings.flatMap((ring) => ring.slice(1).map((p, i) => off(f.lp, ring[i], p))));
      // A cape of Spain is a corner of the coast the game draws. The file keeps two decimals of a degree: a
      // kilometre, give or take.
      if (f.r === 3) expect(corner, f.i).toBeLessThan(1.5);
      // A cape of the world is where the source has it, on the nearest corner when there is one at hand. The
      // coast drawn here is coarse: it has no Outer Banks for Cape Hatteras to stand on, nor the hook of Cape Cod.
      else expect(side, f.i).toBeLessThan(['c:cape-hatteras', 'c:cape-cod'].includes(f.i) ? 55 : 16);
    }
  });

  it('gives a shape of their own size to the straits that the source only labels', () => {
    // Natural Earth has them as specks along the coast: 20 km² of Strait of Gibraltar, which nobody could click.
    for (const [id, least] of [
      ['s:strait-of-gibraltar', 0.5],
      ['s:bab-el-mandeb', 0.4],
      ['s:yucatan-channel', 1.5],
      ['s:scotia-sea', 20],
    ] as const) {
      const f = file.f.find((x) => x.i === id)!;
      const pts = f.g![1].flatMap(decode);
      const wide = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
      expect(f.g![1].length, id).toBe(1);
      expect(wide, id).toBeGreaterThan(least);
      // Drawn by hand over water and land alike: no surface to compare.
      expect(f.ar, id).toBeUndefined();
    }
  });

  it('has enough of each kind, and enough of the well-known ones for a first game', () => {
    for (const [kind, all, known] of [
      ['river', 150, 40],
      ['lake', 60, 20],
      ['sea', 90, 35],
      ['range', 50, 18],
      ['plain', 34, 16],
      ['peninsula', 28, 14],
      ['peak', 90, 25],
      ['cape', 44, 12],
      ['desert', 15, 6],
      ['island', 35, 18],
      ['fall', 4, 4],
    ] as const) {
      expect(byKind(kind).length, kind).toBeGreaterThanOrEqual(all);
      expect(byKind(kind).filter((f) => f.r === 1).length, kind).toBeGreaterThanOrEqual(known);
    }
    // Neither more nor fewer: the six continents as the game counts them, and the five oceans.
    expect(byKind('continent').map((f) => f.i).sort()).toEqual(['c:africa', 'c:americas', 'c:antarctica', 'c:asia', 'c:europe', 'c:oceania']);
    expect(byKind('ocean').map((f) => f.i).sort()).toEqual(['s:arctic-ocean', 's:atlantic-ocean', 's:indian-ocean', 's:pacific-ocean', 's:southern-ocean']);
    for (const id of ['r:danube', 'r:nile', 'r:amazon', 'r:ebro', 's:atlantic-ocean', 's:mediterranean-sea', 'd:sahara', 'i:greenland', 'r:alps', 'r:andes', 'l:lake-victoria', 'p:mount-everest', 'p:teide', 'p:mount-kilimanjaro', 'p:aconcagua'])
      expect(file.f.some((f) => f.i === id), id).toBe(true);
  });

  it('draws six continents that share out the land, each place in one of them', () => {
    const continents = byKind('continent').map((f) => ({ ct: f.ct[0], f, geo: { type: 'MultiPolygon' as const, coordinates: f.g![1].map((flat) => [decode(flat)]) } }));
    for (const { f } of continents) {
      // Asked on the map of the world and nowhere else: a continent is not a feature of any country.
      expect(f.r, f.i).toBe(1);
      expect(f.ct.length, f.i).toBe(1);
      expect(f.co, f.i).toBeUndefined();
      expect(f.g![0], f.i).toBe('A');
    }
    const where = (p: [number, number]) => continents.filter((c) => geoContains(c.geo, p)).map((c) => c.ct).join('+') || '-';
    const places: Record<string, [number, number, string]> = {
      Madrid: [-3.7, 40.4, 'EU'],
      London: [-0.1, 51.5, 'EU'],
      Iceland: [-19, 65, 'EU'],
      Ireland: [-8, 53.3, 'EU'],
      Mallorca: [3, 39.6, 'EU'],
      Sicily: [14.2, 37.6, 'EU'],
      Crete: [24.9, 35.2, 'EU'],
      Svalbard: [16, 78.5, 'EU'],
      'São Miguel': [-25.5, 37.78, 'EU'],
      Kaliningrad: [21, 54.7, 'EU'],
      // The Urals and the river Ural.
      Perm: [56.2, 58, 'EU'],
      Ufa: [56, 54.7, 'EU'],
      Samara: [50.1, 53.2, 'EU'],
      'Novaya Zemlya': [56, 73.5, 'EU'],
      Chelyabinsk: [61.4, 55.16, 'AS'],
      Tyumen: [65.5, 57.15, 'AS'],
      Aktobe: [57.2, 50.3, 'AS'],
      Astana: [71.4, 51.2, 'AS'],
      // The crest of the Caucasus, and the straits.
      Krasnodar: [39, 45.04, 'EU'],
      Grozny: [45.7, 43.3, 'EU'],
      Tbilisi: [44.8, 41.7, 'AS'],
      Yerevan: [44.5, 40.2, 'AS'],
      Edirne: [26.56, 41.68, 'EU'],
      Ankara: [32.85, 39.93, 'AS'],
      // Islands by the land they lie off, whatever country they are.
      Cyprus: [33.2, 35, 'AS'],
      Tenerife: [-16.6, 28.27, 'AF'],
      Madeira: [-16.95, 32.75, 'AF'],
      Sakhalin: [142.8, 50, 'AS'],
      'Wrangel Island': [-179.5, 71.2, 'AS'],
      Kamchatka: [159, 55, 'AS'],
      Honshu: [138.5, 36.2, 'AS'],
      Borneo: [114, 1, 'AS'],
      Java: [110, -7.3, 'AS'],
      Halmahera: [127.9, 0.8, 'AS'],
      'Sri Lanka': [80.7, 7.8, 'AS'],
      Socotra: [53.9, 12.5, 'AS'],
      // Africa ends at the Suez Canal.
      Cairo: [31.24, 30.04, 'AF'],
      'west of the canal': [32, 30.5, 'AF'],
      Sinai: [33.8, 29.5, 'AS'],
      Negev: [34.8, 30.8, 'AS'],
      Madagascar: [46.5, -19.5, 'AF'],
      Zanzibar: [39.33, -6.1, 'AF'],
      Bioko: [8.7, 3.5, 'AF'],
      // One America, the isthmus with it.
      Alaska: [-150, 65, 'AM'],
      Greenland: [-42, 72, 'AM'],
      'Costa Rica': [-84, 10, 'AM'],
      Panama: [-80, 8.6, 'AM'],
      Darién: [-77.7, 8, 'AM'],
      Bogotá: [-74.07, 4.71, 'AM'],
      Cuba: [-79, 22, 'AM'],
      'Tierra del Fuego': [-68.5, -54, 'AM'],
      Falklands: [-59, -51.7, 'AM'],
      // Oceania: Australia, New Guinea whole, and the Pacific as far as Hawaii.
      Australia: [134, -25, 'OC'],
      Tasmania: [146.5, -42, 'OC'],
      'Papua New Guinea': [144, -6, 'OC'],
      'Papua, in Indonesia': [138.5, -4, 'OC'],
      'New Zealand': [170.5, -44, 'OC'],
      Fiji: [178, -17.8, 'OC'],
      Hawaii: [-155.5, 19.6, 'OC'],
      // Antarctica goes round the pole.
      'the South Pole': [0, -89, 'AN'],
      'East Antarctica': [100, -75, 'AN'],
      'the Antarctic Peninsula': [-63.5, -66, 'AN'],
      // Water, and islands in mid-ocean that are part of none.
      'the Atlantic': [-30, 30, '-'],
      'the Mediterranean': [18, 35, '-'],
      'the Black Sea': [35, 43.5, '-'],
      'the Caspian': [51, 42, '-'],
      'the Red Sea': [38, 21, '-'],
      Kerguelen: [69.5, -49.3, '-'],
      'South Georgia': [-36.8, -54.4, '-'],
    };
    const wrong = Object.entries(places)
      .map(([name, [x, y, want]]) => [name, want, where([x, y])])
      .filter(([, want, got]) => want !== got)
      .map(([name, want, got]) => `${name}: in ${got}, not ${want}`);
    expect(wrong).toEqual([]);
    // Where their country puts them, every country stands on its continent: the dot of its name is inside it.
    // (Russia is asked with Europe and the dot of its name is in Siberia; the same goes for the others listed.)
    const split = new Set(['RU', 'CY', 'TF', 'GS', 'HM', 'BV']);
    const astray: string[] = [];
    for (const c of index.countries as unknown as { id: string; ct?: string; lp?: [number, number] }[]) {
      if (!c.ct || !c.lp || split.has(c.id)) continue;
      const got = where(c.lp);
      // A speck of an island is not drawn as part of a continent: nothing to say of it.
      if (got !== '-' && got !== c.ct) astray.push(`${c.id}: filed under ${c.ct}, drawn in ${got}`);
    }
    expect(astray).toEqual([]);
  });

  it('gives continents and oceans the surface of the books, not that of their outline', () => {
    const ar = (id: string) => file.f.find((f) => f.i === id)!.ar!;
    // The World Factbook, in km²: an ocean with its seas, a continent with its islands.
    expect(ar('s:pacific-ocean')).toBe(168_723_000);
    expect(ar('s:atlantic-ocean')).toBe(85_133_000);
    expect(ar('s:indian-ocean')).toBe(70_560_000);
    expect(ar('s:southern-ocean')).toBe(21_960_000);
    expect(ar('s:arctic-ocean')).toBe(15_558_000);
    expect(ar('c:asia')).toBe(44_568_500);
    // America is one here: the north and the south of the book, added.
    expect(ar('c:americas')).toBe(24_473_000 + 17_819_000);
    expect(ar('c:africa')).toBe(30_065_000);
    expect(ar('c:antarctica')).toBe(14_200_000);
    expect(ar('c:europe')).toBe(9_948_000);
    // The book has Australia alone: Oceania is measured on the map, and comes out a little bigger than it.
    expect(ar('c:oceania')).toBeGreaterThan(8_400_000);
    expect(ar('c:oceania')).toBeLessThan(9_200_000);
    // The order every pupil learns.
    const order = (kind: string) =>
      byKind(kind)
        .sort((a, b) => b.ar! - a.ar!)
        .map((f) => f.n.es);
    expect(order('ocean')).toEqual(['Océano Pacífico', 'Océano Atlántico', 'Océano Índico', 'Océano Antártico', 'Océano Ártico']);
    expect(order('continent')).toEqual(['Asia', 'América', 'África', 'Antártida', 'Europa', 'Oceanía']);
  });

  it('draws each ocean a second time with its seas, for the map that asks no sea', () => {
    const oceans = byKind('ocean');
    // Only an ocean has seas to take in.
    expect(file.f.filter((f) => f.gw).map((f) => f.i).sort()).toEqual(oceans.map((f) => f.i).sort());
    const shape = (rings: number[][]) => ({ type: 'MultiPolygon' as const, coordinates: rings.map((flat) => [decode(flat)]) });
    const short = (f: PhysRec) => f.i.slice(2).replace('-ocean', '');
    const open = (p: [number, number]) => oceans.filter((f) => geoContains(shape(f.g![1]), p)).map(short).join('+') || '-';
    const whole = (p: [number, number]) => oceans.filter((f) => geoContains(shape(f.gw![1]), p)).map(short).join('+') || '-';
    // Which ocean each sea is counted with: The World Factbook's lists, and for what it does not name, the one it opens to.
    const seas: Record<string, [number, number, string]> = {
      Mediterranean: [18, 35, 'atlantic'],
      'Black Sea': [34, 43.3, 'atlantic'],
      Baltic: [19.5, 56.5, 'atlantic'],
      'North Sea': [3, 56, 'atlantic'],
      Caribbean: [-75, 15, 'atlantic'],
      'Gulf of Mexico': [-90, 25, 'atlantic'],
      'Hudson Bay': [-85, 60, 'atlantic'],
      'Baffin Bay': [-68, 73, 'atlantic'],
      'Labrador Sea': [-55, 58, 'atlantic'],
      'Gulf of Guinea': [3, 2, 'atlantic'],
      'Barents Sea': [40, 75, 'arctic'],
      'Kara Sea': [70, 76, 'arctic'],
      'Laptev Sea': [125, 76, 'arctic'],
      'Beaufort Sea': [-140, 72, 'arctic'],
      'Chukchi Sea': [-170, 70, 'arctic'],
      'Norwegian Sea': [3, 68, 'arctic'],
      'Greenland Sea': [-5, 76, 'arctic'],
      'Arabian Sea': [64, 15, 'indian'],
      'Bay of Bengal': [88, 14, 'indian'],
      'Red Sea': [38.5, 20, 'indian'],
      'Persian Gulf': [51.5, 27, 'indian'],
      'Mozambique Channel': [41, -18, 'indian'],
      'Andaman Sea': [96, 10, 'indian'],
      'Timor Sea': [126, -12, 'indian'],
      'Great Australian Bight': [130, -34, 'indian'],
      'South China Sea': [115, 12, 'pacific'],
      'Philippine Sea': [135, 18, 'pacific'],
      'Sea of Japan': [135, 40, 'pacific'],
      'East China Sea': [125, 29, 'pacific'],
      'Sea of Okhotsk': [150, 55, 'pacific'],
      'Bering Sea': [-175, 57, 'pacific'],
      'Gulf of Alaska': [-145, 57, 'pacific'],
      'Coral Sea': [155, -17, 'pacific'],
      // Between the Great Barrier Reef and the coast of Queensland.
      'the lagoon of the reef': [146.9, -18.6, 'pacific'],
      'Torres Strait': [142.3, -10.2, 'pacific'],
      'Gulf of Carpentaria': [139, -14, 'pacific'],
      'Tasman Sea': [160, -40, 'pacific'],
      'Java Sea': [112, -5, 'pacific'],
      'Banda Sea': [127, -6, 'pacific'],
      'Celebes Sea': [122, 3, 'pacific'],
      'Arafura Sea': [135, -9, 'pacific'],
      'Gulf of California': [-110.3, 26, 'pacific'],
      'Weddell Sea': [-45, -72, 'southern'],
      'Ross Sea': [-175, -75, 'southern'],
      'Bellingshausen Sea': [-85, -72, 'southern'],
    };
    const wrong: string[] = [];
    for (const [name, [x, y, ocean]] of Object.entries(seas)) {
      // A sea is not the open ocean, and belongs to one ocean only.
      if (open([x, y]) !== '-') wrong.push(`${name}: part of the open ${open([x, y])}`);
      if (whole([x, y]) !== ocean) wrong.push(`${name}: with ${whole([x, y])}, not ${ocean}`);
    }
    // The open ocean is the same water in both.
    const waters: Record<string, [number, number, string]> = {
      'North Atlantic': [-35, 30, 'atlantic'],
      'South Atlantic': [-15, -30, 'atlantic'],
      'North Pacific': [165, 30, 'pacific'],
      'South Pacific': [-120, -30, 'pacific'],
      Indian: [80, -25, 'indian'],
      Arctic: [0, 87, 'arctic'],
      Southern: [60, -64, 'southern'],
    };
    for (const [name, [x, y, ocean]] of Object.entries(waters)) {
      if (open([x, y]) !== ocean) wrong.push(`${name}: open ${open([x, y])}`);
      if (whole([x, y]) !== ocean) wrong.push(`${name}: whole ${whole([x, y])}`);
    }
    // A lake, however big and however it is called.
    if (whole([51, 41]) !== '-') wrong.push(`Caspian: with ${whole([51, 41])}`);
    expect(wrong).toEqual([]);

    for (const f of oceans) {
      const [kind, rings] = f.gw!;
      expect(kind, f.i).toBe('A');
      for (const flat of rings) {
        expect(flat.every(Number.isInteger), f.i).toBe(true);
        const pts = decode(flat);
        expect(pts.length, f.i).toBeGreaterThanOrEqual(4);
        expect(pts[0], f.i).toEqual(pts[pts.length - 1]);
        for (const [x, y] of pts) expect(x >= -180 && x <= 180 && y >= -90 && y <= 90, `${f.i} ${x},${y}`).toBe(true);
      }
      // Wound the right way round, and bigger than the open ocean alone: it has the same water and more.
      expect(geoArea(shape(rings)), f.i).toBeLessThan(0.75 * 4 * Math.PI);
      expect(geoArea(shape(rings)), f.i).toBeGreaterThan(geoArea(shape(f.g![1])));
      // Its name is written where the open ocean has it.
      expect(geoContains(shape(rings), f.lp), f.i).toBe(true);
    }
    // The coasts of the whole world, once: it must not weigh more than the continents do.
    const points = oceans.reduce((sum, f) => sum + f.gw![1].reduce((n, flat) => n + flat.length / 2, 0), 0);
    expect(points).toBeLessThan(12_000);
  });

  it('draws the peninsulas and the great plains, and says whose they are', () => {
    const of = (id: string) => file.f.find((f) => f.i === id);
    const names = (kind: string, rank: number) =>
      byKind(kind)
        .filter((f) => f.r <= rank)
        .map((f) => f.n.es);
    expect(names('peninsula', 1)).toEqual(
      expect.arrayContaining([
        'Península Ibérica',
        'Península Itálica',
        'Península Escandinava',
        'Península Balcánica',
        'Península Arábiga',
        'Península del Indostán',
        'Indochina',
        'Anatolia',
        'Península de Corea',
        'Península de Kamchatka',
        'Cuerno de África',
        'Península de Yucatán',
        'Península de Baja California',
        'Península de Florida',
      ]),
    );
    expect(names('peninsula', 2)).toEqual(expect.arrayContaining(['Península de Crimea', 'Península de Jutlandia', 'Peloponeso', 'Península de Bretaña', 'Península de Malaca', 'Península de Alaska']));
    expect(names('plain', 1)).toEqual(
      expect.arrayContaining(['Gran Llanura Europea', 'Meseta del Tíbet', 'Llanura de Siberia Occidental', 'Meseta del Decán', 'Grandes Llanuras', 'Llanura amazónica', 'La Pampa', 'Gran Chaco', 'Cuenca del Congo', 'Sahel']),
    );
    for (const f of [...byKind('peninsula'), ...byKind('plain')]) expect(f.g?.[0], f.i).toBe('A');
    // A peninsula that is the whole of a country is nothing to point at on its map: Iberia in Spain, Korea in either Korea.
    for (const id of ['p:iberian-peninsula', 'p:scandinavian-peninsula', 'p:balkan-peninsula', 'p:arabian-peninsula', 'p:korean-peninsula', 'p:horn-of-africa']) expect(of(id)?.co, id).toBeUndefined();
    // One that is a part of it is: Italy's, Florida, Yucatán, Kamchatka, Brittany.
    expect(of('p:italian-peninsula')?.co).toEqual(['IT']);
    expect(of('p:florida-peninsula')?.co).toEqual(['US']);
    expect(of('p:yucatan-peninsula')?.co).toEqual(['MX']);
    expect(of('p:kamchatka-peninsula')?.co).toEqual(['RU']);
    expect(of('p:brittany')?.co).toEqual(['FR']);
    expect(of('p:malay-peninsula')?.co).toEqual(['MY', 'TH']);
    // A great plain is asked in the countries it crosses, small or large; not in the one it covers whole.
    expect(of('p:european-plain')?.co).toEqual(expect.arrayContaining(['FR', 'BE', 'NL', 'DE', 'PL', 'BY', 'RU']));
    expect(of('p:european-plain')?.co).not.toContain('LT');
    expect(of('p:congo-basin')?.co).not.toContain('CD');
    expect(of('p:pampas')?.co).toEqual(['AR']);
    expect(of('p:great-plains')?.co).toEqual(['CA', 'US']);
    expect(of('p:gran-chaco')?.co).toEqual(['AR', 'BO', 'PY']);
    // The source spreads Tibet over the Himalaya: it is asked in China.
    expect(of('p:tibetan-plateau')?.co).toEqual(['CN']);
    // The Alps are of everyone who has a share of them.
    expect(of('r:alps')?.co).toEqual(['AT', 'CH', 'DE', 'FR', 'IT', 'LI', 'SI']);
    expect(of('r:tian-shan')?.co).toEqual(['CN', 'KG', 'KZ']);
  });

  it('places the capes of the world and the waterfalls where they are', () => {
    const of = (id: string) => file.f.find((f) => f.i === id)!;
    /** Kilometres between two places. */
    const km = (a: [number, number], b: [number, number]) => {
      const rad = Math.PI / 180;
      const h = Math.sin(((b[1] - a[1]) * rad) / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(((b[0] - a[0]) * rad) / 2) ** 2;
      return 2 * 6371 * Math.asin(Math.sqrt(h));
    };
    // The points of the source are written for labels, and some stand beside the cape: these are the ones
    // that had to be found by the coast, each within a few kilometres of where the cape is.
    for (const [id, at, co] of [
      ['c:cape-palmas', [-7.72, 4.37], ['LR']],
      ['c:cap-vert', [-17.52, 14.74], ['SN']],
      ['c:cape-blanc', [-17.05, 20.77], ['EH', 'MR']],
      ['c:cape-sao-roque', [-35.26, -5.48], ['BR']],
      ['c:cabo-frio', [-42.02, -23.0], ['BR']],
      // And some of those that the source has right.
      ['c:cape-of-good-hope', [18.47, -34.36], ['ZA']],
      ['c:cape-horn', [-67.27, -55.98], ['CL']],
      ['c:north-cape', [25.78, 71.17], ['NO']],
      ['c:cape-st-vincent', [-9.0, 37.02], ['PT']],
      ['c:cape-comorin', [77.55, 8.08], ['IN']],
      ['c:cape-york', [142.53, -10.69], ['AU']],
      ['c:cape-guardafui', [51.28, 11.83], ['SO']],
    ] as const) {
      expect(km(of(id).lp, [at[0], at[1]]), id).toBeLessThan(15);
      expect(of(id).co, id).toEqual(co);
    }
    // Four waterfalls, each between the countries that share it.
    expect(byKind('fall').map((f) => [f.n.es, f.co])).toEqual([
      ['Cataratas del Niágara', ['CA', 'US']],
      ['Salto Ángel', ['VE']],
      ['Cataratas del Iguazú', ['AR', 'BR']],
      ['Cataratas Victoria', ['ZM', 'ZW']],
    ]);
    for (const [id, at] of [
      ['f:niagara-falls', [-79.07, 43.08]],
      ['f:angel-falls', [-62.54, 5.97]],
      ['f:iguazu-falls', [-54.44, -25.69]],
      ['f:victoria-falls', [25.86, -17.92]],
    ] as const) {
      const f = of(id);
      expect(km(f.lp, [at[0], at[1]]), id).toBeLessThan(5);
      expect(f.g, id).toBeUndefined();
      expect(f.fp, id).toEqual([f.lp]);
    }
  });

  it('draws rivers as lines and everything else as surfaces, inside the globe', () => {
    const problems: string[] = [];
    for (const f of file.f) {
      if (DOTS.includes(f.k)) continue;
      if (!f.g) {
        problems.push(`${f.i}: nothing to draw`);
        continue;
      }
      const [shape, parts] = f.g;
      if (shape !== (f.k === 'river' ? 'L' : 'A')) problems.push(`${f.i}: drawn as ${shape}`);
      if (!parts.length) problems.push(`${f.i}: nothing to draw`);
      let w = Infinity;
      let e = -Infinity;
      let s = Infinity;
      let n = -Infinity;
      for (const flat of parts) {
        if (flat.length % 2) problems.push(`${f.i}: odd list`);
        if (flat.length < (shape === 'L' ? 4 : 8)) problems.push(`${f.i}: a part with ${flat.length / 2} points`);
        if (!flat.every(Number.isInteger)) problems.push(`${f.i}: fractions`);
        const pts = decode(flat);
        for (const [x, y] of pts) {
          if (!(x >= -180 && x <= 180 && y >= -90 && y <= 90)) problems.push(`${f.i}: off the globe at ${x},${y}`);
          w = Math.min(w, x);
          e = Math.max(e, x);
          s = Math.min(s, y);
          n = Math.max(n, y);
        }
        if (shape === 'A') {
          const [a, b] = [pts[0], pts[pts.length - 1]];
          if (a[0] !== b[0] || a[1] !== b[1]) problems.push(`${f.i}: open ring`);
        }
      }
      // The point its name hangs from, and the points that frame it, lie on the feature.
      const inBox = (p: [number, number]) => p[0] >= w - 0.6 && p[0] <= e + 0.6 && p[1] >= s - 0.6 && p[1] <= n + 0.6;
      if (!inBox(f.lp)) problems.push(`${f.i}: label away from it`);
      if (!f.fp.length || !f.fp.every(inBox)) problems.push(`${f.i}: frame away from it`);
    }
    expect(problems).toEqual([]);
  });

  it('marks every peak as a point with its height, apart from the others', () => {
    const peaks = byKind('peak');
    const problems: string[] = [];
    for (const f of peaks) {
      if (f.g) problems.push(`${f.i}: drawn as a shape`);
      if (!Number.isInteger(f.el) || f.el! < 300 || f.el! > 8850) problems.push(`${f.i}: height ${f.el}`);
      const [x, y] = f.lp;
      if (!(x >= -180 && x <= 180 && y >= -90 && y <= 90)) problems.push(`${f.i}: off the globe`);
      if (f.fp.length !== 1 || f.fp[0][0] !== x || f.fp[0][1] !== y) problems.push(`${f.i}: framed away from itself`);
    }
    // Two triangles on top of each other cannot be told apart, nor clicked.
    const km = (a: [number, number], b: [number, number]) => {
      const rad = Math.PI / 180;
      const h = Math.sin(((b[1] - a[1]) * rad) / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(((b[0] - a[0]) * rad) / 2) ** 2;
      return 2 * 6371 * Math.asin(Math.sqrt(h));
    };
    // On the map of a continent they need more room than on the map of a country.
    for (let i = 0; i < peaks.length; i++)
      for (let j = i + 1; j < peaks.length; j++) if (km(peaks[i].lp, peaks[j].lp) < (peaks[i].r < 3 && peaks[j].r < 3 ? 55 : 12)) problems.push(`${peaks[i].i} and ${peaks[j].i}: too close`);
    expect(problems).toEqual([]);
    // Heights that anyone can check.
    const height = (id: string) => peaks.find((f) => f.i === id)?.el;
    expect(height('p:mount-everest')).toBeGreaterThanOrEqual(8840);
    expect(height('p:teide')).toBeGreaterThanOrEqual(3700);
    expect(height('p:mulhacen')).toBeGreaterThanOrEqual(3470);
    expect(peaks.filter((f) => f.ct.includes('EU') && f.r === 1).length).toBeGreaterThanOrEqual(8);
  });

  it('winds every surface the right way round', () => {
    // As with countries: a ring wound backwards means "the whole globe but this".
    for (const f of file.f) {
      if (!f.g || f.g[0] !== 'A') continue;
      const geo = { type: 'MultiPolygon' as const, coordinates: f.g[1].map((flat) => [decode(flat)]) };
      // The Pacific covers a third of the planet: nothing gets near the whole of it.
      expect(geoArea(geo), f.i).toBeLessThan(0.75 * 4 * Math.PI);
      expect(geoArea(geo), f.i).toBeGreaterThan(0);
    }
  });
});

describe('cities.json', () => {
  const file = read<{ c: Record<string, CityRec[]> }>('cities.json');
  const all = Object.values(file.c).flat();

  it('lists cities of countries that exist, each under an id of its own', () => {
    for (const id of Object.keys(file.c)) expect(byId.has(id), id).toBe(true);
    expect(new Set(all.map((c) => c.i)).size).toBe(all.length);
    expect(all.length).toBeGreaterThan(4000);
    for (const c of all) {
      expect(c.n.es, c.i).toBeTruthy();
      expect(c.ll[0], c.i).toBeGreaterThanOrEqual(-180);
      expect(c.ll[0], c.i).toBeLessThanOrEqual(180);
      expect(Math.abs(c.ll[1]), c.i).toBeLessThanOrEqual(90);
      expect(c.p, c.i).toBeGreaterThanOrEqual(0);
      expect([undefined, 1, 2, 3], c.i).toContain(c.k);
    }
  });

  it('never gives two cities of a country the same name or the same identity', () => {
    // The source lists a few places twice and lends a few the names of a bigger neighbour: the build puts it right.
    const problems: string[] = [];
    for (const [id, list] of Object.entries(file.c)) {
      for (const lang of ['es', 'en'] as const) {
        const seen = new Set<string>();
        for (const c of list) {
          const name = (c.n[lang] ?? c.n.es).toLowerCase();
          if (seen.has(name)) problems.push(`${id}: two cities called ${name}`);
          seen.add(name);
        }
      }
      const ids = list.map((c) => c.wd).filter(Boolean);
      if (new Set(ids).size !== ids.length) problems.push(`${id}: the same Wikidata id twice`);
    }
    expect(problems).toEqual([]);
  });

  it('sorts each country by population, the largest first', () => {
    for (const [id, list] of Object.entries(file.c)) for (let i = 1; i < list.length; i++) expect(list[i].p, `${id} #${i}`).toBeLessThanOrEqual(list[i - 1].p);
  });

  it('marks one capital in every member of the United Nations that has one', () => {
    // Nauru has no official capital, and no city on the map.
    const without = index.countries.filter((c) => c.cl === 'un' && (file.c[c.id] ?? []).filter((x) => x.k === 3).length !== 1).map((c) => c.id);
    expect(without).toEqual(['NR']);
    expect(file.c.ES.find((c) => c.k === 3)?.n.es).toBe('Madrid');
    expect(file.c.ES.slice(0, 2).map((c) => c.n.es)).toEqual(['Madrid', 'Barcelona']);
  });

  it('keeps border towns in their own country, and capitals under their own name', () => {
    // The source files these under the neighbour across the river or the border.
    const where = (name: string) => Object.entries(file.c).filter(([, list]) => list.some((c) => c.n.es === name)).map(([id]) => id);
    expect(where('Saint Louis')).toEqual(['SN']);
    expect(where('Kaédi')).toEqual(['MR']);
    expect(where('Ebebiyín')).toEqual(['GQ']);
    expect(where('Kapan')).toEqual(['AM']);
    expect(where('Yacuiba')).toEqual(['BO']);
    // The name of a capital goes to the city that has it, not to the nearest town.
    expect(file.c.GP.find((c) => c.k === 3)?.p).toBeLessThan(5000);
    expect(file.c.GP.map((c) => c.n.es)).toContain('Pointe-à-Pitre');
    expect(file.c.GF.find((c) => c.k === 3)?.p).toBeGreaterThan(50000);
    expect(file.c.PW.map((c) => c.n.es).sort()).toEqual(['Koror', 'Ngerulmud']);
  });

  it('has no hamlet with the population of a famous namesake among the largest cities', () => {
    // A Natal in the Amazon, a Vila Velha in Amapá, the Iranian Arak in the Algerian desert, the Iraqi Hilla in Arabia.
    const top = (id: string) => file.c[id].slice(0, 30).map((c) => c.n.es);
    expect(top('BR').filter((n) => n.startsWith('Natal'))).toEqual(['Natal']);
    expect(top('BR').filter((n) => n.startsWith('Vila Velha'))).toEqual(['Vila Velha']);
    expect(file.c.BR.find((c) => c.n.es === 'Vila Velha')!.ll[1]).toBeLessThan(-15);
    expect(file.c.BR.find((c) => c.n.es === 'Natal')!.ll[0]).toBeGreaterThan(-40);
    expect(top('DZ')).not.toContain('Arak');
    expect(top('SA')).not.toContain('Al Ḥilla');
    expect(file.c.BO.find((c) => c.n.es === 'San Borja')!.p).toBeLessThan(50000);
  });

  it('marks as capital of a region the city that is one, and no other', () => {
    const marked = (id: string) => file.c[id].filter((c) => (c.k ?? 0) >= 1).map((c) => c.n.es);
    const names = (id: string) => file.c[id].map((c) => c.n.es);
    // Spain: the capitals of its communities and its two autonomous cities, with both capitals of the Canaries.
    expect(marked('ES')).toHaveLength(20);
    expect(marked('ES')).toEqual(expect.arrayContaining(['Madrid', 'Santiago de Compostela', 'Mérida', 'Las Palmas de Gran Canaria', 'Santa Cruz de Tenerife', 'Ceuta']));
    // France: its thirteen regions of today, not the twenty-two of before 2016.
    expect(marked('FR')).toHaveLength(13);
    expect(names('FR')).toContain('Montpellier');
    expect(marked('FR')).not.toContain('Montpellier');
    // The biggest town, the twin across the river or a former seat is not the capital.
    expect(names('JP')).toContain('Kitakyūshū');
    expect(marked('JP')).not.toContain('Kitakyūshū');
    expect(marked('SD')).toContain('Jartum');
    expect(names('SD')).toContain('Omdurmán');
    expect(marked('SD')).not.toContain('Omdurmán');
    expect(marked('BR')).not.toContain('Niterói');
    expect(marked('ZM')).toContain('Choma');
    expect(marked('ZM')).not.toContain('Livingstone');
    expect(marked('CU')).toContain('Bayamo');
    expect(marked('GB').sort()).toEqual(['Belfast', 'Cardiff', 'Edimburgo', 'Londres']);
  });

  it('places every city in a region of its own country', () => {
    const problems: string[] = [];
    for (const [id, list] of Object.entries(file.c)) {
      const units = new Set(features(read<Topology>(`r/${id}.json`), 'f').map((f) => String(f.id)));
      for (const c of list) if (c.u && !units.has(c.u)) problems.push(`${c.n.es} (${id}): unknown region ${c.u}`);
    }
    expect(problems).toEqual([]);
  });
});

describe('capitals.json', () => {
  const file = read<{ rc: Record<string, Record<string, Record<string, string[]>>> }>('capitals.json');

  it('names capitals of regions that exist, at levels that exist', () => {
    const problems: string[] = [];
    for (const [id, levels] of Object.entries(file.rc)) {
      const country = byId.get(id);
      if (!country) {
        problems.push(`${id}: unknown country`);
        continue;
      }
      const topology = read<Topology>(`r/${id}.json`);
      for (const [level, units] of Object.entries(levels)) {
        if (!country.lv.some((l) => l.k === level)) {
          problems.push(`${id}/${level}: unknown level`);
          continue;
        }
        const known = new Set(features(topology, level).map((f) => String(f.id)));
        for (const [unit, names] of Object.entries(units)) {
          if (!known.has(unit)) problems.push(`${id}/${level}: unknown region ${unit}`);
          if (!names.length || names.some((n) => !n.trim())) problems.push(`${unit}: empty name`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('gives the seat of a region and not its biggest town, a former seat or a neighbour', () => {
    // Each of these was wrong as the source marks it, and was put right after comparing with GeoNames.
    const first = (id: string, unit: string, level = 'f') => file.rc[id][level][unit]?.[0];
    expect(first('CY', 'CY-01')).toBe('Nicosia');
    expect(first('BD', 'BD-C')).toBe('Daca');
    expect(first('NL', 'NL-FL')).toBe('Lelystad');
    expect(first('NL', 'NL-NH')).toBe('Haarlem');
    expect(first('NL', 'NL-ZH')).toBe('La Haya');
    expect(first('JP', 'JP-35')).toBe('Yamaguchi');
    expect(first('JP', 'JP-40')).toBe('Fukuoka');
    expect(first('ZA', 'ZA-GT')).toBe('Johannesburgo');
    expect(first('SD', 'SD-KH')).toBe('Jartum');
    expect(first('NG', 'NG-DE')).toBe('Asaba');
    expect(first('NG', 'NG-AN')).toBe('Awka');
    expect(first('MY', 'MY-10')).toBe('Shah Alam');
    expect(first('CU', 'CU-12')).toBe('Bayamo');
    expect(first('PE', 'PE-LIM')).toBe('Huacho');
    expect(first('SN', 'SN-MT')).toBe('Matam');
    expect(first('MR', 'MR-06')).toBe('Rosso');
    expect(first('LK', 'LK-1', 'g1')).toBe('Colombo');
    expect(first('AR', 'AR-R')).toBe('Viedma');
    expect(first('AR', 'AR-B')).toBe('La Plata');
    expect(first('VE', 'VE-A')).toBe('Caracas');
    expect(first('CA', 'CA-ON')).toBe('Toronto');
    // Two cities share the role: either is accepted.
    expect(file.rc.PL.f['PL-LB']).toEqual(expect.arrayContaining(['Zielona Góra', 'Gorzów Wielkopolski']));
    // Nepal's zones no longer exist.
    expect(file.rc.NP).toBeUndefined();
  });

  it('accepts for a capital only its own names, not those of another city of the region', () => {
    expect(file.rc.JP.f['JP-01']).toEqual(['Sapporo']);
    expect(file.rc.KZ.f['KZ-KAR'].join(' ')).not.toMatch(/Zhezkazgan|Jezkazgan/);
    expect(file.rc.ZA.f['ZA-EC'].join(' ')).not.toMatch(/Qacha/);
    expect(file.rc.MR.f['MR-06'].join(' ')).not.toMatch(/Louis/);
  });

  it('knows the prefecture of every French department', () => {
    expect(Object.keys(file.rc.FR.f)).toHaveLength(96);
    expect(file.rc.FR.f['FR-13'][0]).toBe('Marsella');
    expect(file.rc.FR.f['FR-31'][0]).toBe('Toulouse');
    expect(file.rc.FR.f['FR-75'][0]).toBe('París');
  });

  it('knows the capitals of every Spanish province and autonomous community', () => {
    expect(Object.keys(file.rc.ES.f)).toHaveLength(52);
    expect(Object.keys(file.rc.ES.g1)).toHaveLength(19);
    expect(file.rc.ES.g1['ES-GA'][0]).toBe('Santiago de Compostela');
    expect(file.rc.ES.g1['ES-AN'][0]).toBe('Sevilla');
    expect(file.rc.ES.f['ES-M'][0]).toBe('Madrid');
  });
});
