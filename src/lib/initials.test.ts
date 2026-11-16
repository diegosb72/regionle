// Abbreviations: a name of several words can be typed by its initials ("NH", "PEI"), and nothing else can.

import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildDeck, loadIndex, setLoader } from './data';
import { buildCityDeck, buildPhysicalDeck } from './extra';
import { setLang } from './i18n';
import { Matcher, initialsOf, type Answerable } from './text';
import type { Deck } from './types';

/** Something with these names, the first of them the one on show. */
const named = (id: string, ...names: string[]): Answerable => ({ id, answers: names, proper: names });

describe('the initials of a name', () => {
  it('spells out a name of several words', () => {
    expect(initialsOf('New Hampshire')).toEqual(['nh']);
    expect(initialsOf('British Columbia')).toEqual(['bc']);
    expect(initialsOf('Prince Edward Island')).toEqual(['pei']);
    expect(initialsOf('Nordrhein-Westfalen')).toEqual(['nw']);
    expect(initialsOf('São Paulo')).toEqual(['sp']);
  });

  it('gives none to a name of one word: a code is not an abbreviation', () => {
    expect(initialsOf('Massachusetts')).toEqual([]);
    expect(initialsOf('Texas')).toEqual([]);
    expect(initialsOf('Québec')).toEqual([]);
    expect(initialsOf('Biel/Bienne')).toEqual([]);
    expect(initialsOf('Santiago (Región Metropolitana)')).toEqual([]);
  });

  it('passes over the words that only join the others, or counts them', () => {
    expect(initialsOf('Tierra del Fuego')).toEqual(['tf', 'tdf']);
    expect(initialsOf('Castilla y León')).toEqual(['cl', 'cyl']);
    expect(initialsOf('Newfoundland and Labrador')).toEqual(['nl', 'nal']);
    expect(initialsOf('District of Columbia')).toEqual(['dc', 'doc']);
    // A run of them is counted word by word or as one.
    expect(initialsOf('Pays de la Loire')).toEqual(['pl', 'pdll', 'pdl']);
    expect(initialsOf('Stoke-on-Trent')).toEqual(['st', 'sot']);
  });

  it('takes the last word for one of the name, whatever it is', () => {
    expect(initialsOf('Carolina del Sur')).toEqual(['cs', 'cds']);
    expect(initialsOf('Baja California Sur')).toEqual(['bcs']);
    expect(initialsOf('Nueva Gales del Sur')).toEqual(['ngs', 'ngds']);
    expect(initialsOf('Boulogne-sur-Mer')).toEqual(['bm', 'bsm']);
    expect(initialsOf('Georgias del Sur y Sandwich del Sur')).toEqual(['gsss']);
    // One word of its own: the article counts.
    expect(initialsOf('La Rioja')).toEqual(['lr']);
    expect(initialsOf('Los Angeles')).toEqual(['la']);
  });

  it('undoes an elision, and tells it from an apostrophe that is part of a word', () => {
    expect(initialsOf("Provence-Alpes-Côte d'Azur")).toEqual(['paca', 'pacda']);
    expect(initialsOf("Reggio nell'Emilia")).toEqual(['re', 'rne']);
    expect(initialsOf("L'Aquila")).toEqual(['la']);
    expect(initialsOf("L'viv")).toEqual([]);
    expect(initialsOf("Hawai'i")).toEqual([]);
  });

  it('reads an abbreviation inside a name letter by letter, and no number as an initial', () => {
    expect(initialsOf('DR Congo')).toEqual(['drc']);
    expect(initialsOf('Washington D. C.')).toEqual(['wdc']);
    expect(initialsOf('St. Gallen')).toEqual(['sg']);
    expect(initialsOf('U.S. Virgin Islands')).toEqual(['usvi']);
    expect(initialsOf('Región 12')).toEqual([]);
    expect(initialsOf('Édéa II')).toEqual([]);
  });

  it('reads each name of a double one, and nothing longer than five letters', () => {
    expect(initialsOf('Trentino-Alto Adige/Südtirol')).toEqual(['taa']);
    expect(initialsOf('Dadra y Nagar Haveli y Damán y Diu')).toEqual(['dnhdd']);
    // With "and" and "da" they would be seven.
    expect(initialsOf('Saint Helena, Ascension and Tristan da Cunha')).toEqual(['shatc']);
    expect(initialsOf('Bosque Nacional de la Sierra de las Nieves')).toEqual(['bnsn']);
    expect(initialsOf('Alfa Beta Gamma Delta Épsilon Zeta')).toEqual([]);
  });
});

describe('abbreviations in a game', () => {
  const states = new Matcher([
    named('US-NH', 'Nuevo Hampshire', 'New Hampshire'),
    named('US-NJ', 'Nueva Jersey', 'New Jersey'),
    named('US-NC', 'Carolina del Norte', 'North Carolina'),
    named('US-MA', 'Massachusetts'),
    named('US-ME', 'Maine'),
    named('US-NE', 'Nebraska'),
    { id: 'US-DC', answers: ['Washington D. C.', 'District of Columbia', 'Washington DC', 'DC'], proper: ['Washington D. C.', 'District of Columbia'] },
    named('CA-NS', 'Nueva Escocia', 'Nova Scotia'),
    named('CA-NL', 'Terranova y Labrador', 'Newfoundland and Labrador'),
    named('MX-NLE', 'Nuevo León'),
  ]);

  it('takes the initials of a name of several words, however they are typed', () => {
    for (const text of ['nh', 'NH', 'N.H.', 'n. h.', 'n h']) expect(states.lookup(text), text).toEqual(['US-NH']);
    expect(states.lookup('nj')).toEqual(['US-NJ']);
    // Those of the name in either language.
    expect(states.lookup('nc')).toEqual(['US-NC']);
    expect(states.lookup('cn')).toEqual(['US-NC']);
    expect(states.lookup('cdn')).toEqual(['US-NC']);
    expect(states.check('nh', 'US-NH')).toEqual({ res: 'yes' });
    expect(states.check('nj', 'US-NH')).toEqual({ res: 'other', id: 'US-NJ' });
    expect(states.find('nh')).toEqual(['US-NH']);
  });

  it('takes no code for a name of one word', () => {
    for (const code of ['ma', 'me', 'MA', 'M.A.']) expect(states.lookup(code), code).toEqual([]);
    expect(states.check('ma', 'US-MA')).toEqual({ res: 'no' });
    expect(states.vague('ma')).toBe(false);
  });

  it('gives none to what is shown under a name of one word, whatever it is called elsewhere', () => {
    // "Komi Republic", "Cusco Department", "Ar Riyad": names of several words that the player does not read.
    const m = new Matcher([named('RU-KO', 'Komi', 'Komi Republic'), named('PE-CUS', 'Cusco', 'Cusco Department'), named('SA-01', 'Riad', 'Riyadh', 'Ar Riyad'), named('PE-LMA', 'Lima Metropolitana', 'Metropolitan Lima')]);
    for (const k of ['kr', 'cd', 'ar']) {
      expect(m.lookup(k), k).toEqual([]);
      expect(m.vague(k), k).toBe(false);
    }
    expect(m.lookup('komi republic')).toEqual(['RU-KO']);
    // Where the name on show has several, those of the other languages count as well.
    expect(m.lookup('lm')).toEqual(['PE-LMA']);
    expect(m.lookup('ml')).toEqual(['PE-LMA']);
    // The same place under each of its names: "SA" is South Africa to those who read it so.
    expect(new Matcher([named('ZA', 'Sudáfrica', 'South Africa')]).lookup('sa')).toEqual([]);
    expect(new Matcher([named('ZA', 'South Africa', 'Sudáfrica')]).lookup('sa')).toEqual(['ZA']);
    // A name too long for initials of its own still has several words.
    expect(new Matcher([named('VI', 'Islas Vírgenes de EE. UU.', 'U.S. Virgin Islands')]).lookup('usvi')).toEqual(['VI']);
    // Nothing is named after its kind: no names proper, no initials.
    const lakes = new Matcher([{ id: 'l:superior', answers: ['Lago Superior', 'Lake Superior', 'Superior'], proper: [] }]);
    expect(lakes.lookup('ls')).toEqual([]);
    expect(lakes.abbreviations()).toEqual([]);
    expect(lakes.lookup('superior')).toEqual(['l:superior']);
  });

  it('takes initials that two names spell for neither', () => {
    expect(states.lookup('nl')).toEqual([]);
    expect(states.vague('nl')).toBe(true);
    expect(states.check('nl', 'CA-NL')).toEqual({ res: 'vague' });
    expect(states.check('nl', 'US-MA')).toEqual({ res: 'vague' });
    // Each is still told from the other by what only it spells.
    expect(states.lookup('tyl')).toEqual(['CA-NL']);
    // A map with one of them only: its initials are its own.
    expect(new Matcher([named('MX-NLE', 'Nuevo León'), named('MX-SON', 'Sonora')]).lookup('nl')).toEqual(['MX-NLE']);
  });

  it('takes initials that are the code of something else for nothing', () => {
    // "NE" would be read as Nebraska, and Nebraska has no abbreviation: it is not Nueva Escocia either.
    expect(states.lookup('ne')).toEqual([]);
    expect(states.vague('ne')).toBe(true);
    expect(states.lookup('ns')).toEqual(['CA-NS']);
    const canada = new Matcher([named('CA-NS', 'Nueva Escocia', 'Nova Scotia'), named('CA-ON', 'Ontario')]);
    expect(canada.lookup('ne')).toEqual(['CA-NS']);
    // The same among countries.
    const world = new Matcher([named('SV', 'El Salvador'), named('ES', 'España', 'Spain'), named('CR', 'Costa Rica')]);
    expect(world.lookup('es')).toEqual([]);
    expect(world.lookup('cr')).toEqual(['CR']);
    expect(new Matcher([named('SV', 'El Salvador'), named('CR', 'Costa Rica')]).lookup('es')).toEqual(['SV']);
  });

  it('reads no code in the ids of a list of capitals', () => {
    const capitals: Answerable[] = [named('AR', 'Buenos Aires'), named('BA', 'Sarajevo'), named('SD', 'Jartum', 'Khartoum'), named('DO', 'Santo Domingo')];
    // Under the ids of their countries, "BA" would be Bosnia's and "SD" Sudan's.
    expect(new Matcher(capitals).lookup('ba')).toEqual([]);
    const m = new Matcher(capitals, { codes: false });
    expect(m.lookup('ba')).toEqual(['AR']);
    expect(m.lookup('sd')).toEqual(['DO']);
  });

  it('leaves a spelling what it is', () => {
    // "LA" is Los Angeles, unless something on the map is called that.
    const m = new Matcher([named('a', 'Los Ángeles', 'Los Angeles'), named('b', 'La')]);
    expect(m.lookup('la')).toEqual(['b']);
    expect(m.abbreviates('la')).toBe(false);
    // Without names proper nothing is abbreviated: a list of spellings is just that.
    expect(new Matcher([{ id: 'x', answers: ['New Hampshire'] }]).lookup('nh')).toEqual([]);
  });

  it('knows an abbreviation from a name', () => {
    expect(states.abbreviates('nh')).toBe(true);
    expect(states.abbreviates('N.H.')).toBe(true);
    expect(states.abbreviates('new hampshire')).toBe(false);
    expect(states.abbreviates('maine')).toBe(false);
    expect(states.abbreviates('ma')).toBe(false);
    // A spelling written as one counts as one, the name proper does not.
    expect(states.abbreviates('dc')).toBe(true);
    expect(states.abbreviates('washington dc')).toBe(false);
    // So does a name in another language that is one ("K.P."), but never the name on show ("F.C.T.").
    const pakistan = new Matcher([named('PK-KP', 'Khyber Pakhtunkhwa', 'K.P.'), named('PK-IS', 'F.C.T.', 'Islamabad Capital Territory'), named('PK-SD', 'Sindh')]);
    expect(pakistan.abbreviates('kp')).toBe(true);
    expect(pakistan.lookup('kp', { whole: true })).toEqual([]);
    expect(pakistan.abbreviates('fct')).toBe(false);
    expect(pakistan.lookup('fct', { whole: true })).toEqual(['PK-IS']);
    expect(
      states
        .abbreviations()
        .map(([k]) => k)
        .sort(),
    ).toEqual(['cdn', 'cn', 'dc', 'doc', 'nal', 'nc', 'nh', 'nj', 'ns', 'tl', 'tyl', 'wdc']);
  });

  it('asks for the name in full while letters of it are in sight', () => {
    const whole = { whole: true };
    expect(states.lookup('nh', whole)).toEqual([]);
    expect(states.lookup('dc', whole)).toEqual([]);
    expect(states.find('nh', whole)).toEqual([]);
    // The right answer, but for being an abbreviation: told apart from a wrong one.
    expect(states.check('nh', 'US-NH', whole)).toEqual({ res: 'short' });
    expect(states.check('dc', 'US-DC', whole)).toEqual({ res: 'short' });
    expect(states.check('nj', 'US-NH', whole)).toEqual({ res: 'no' });
    expect(states.check('new hampshire', 'US-NH', whole)).toEqual({ res: 'yes' });
    expect(states.check('new hampshrie', 'US-NH', whole)).toEqual({ res: 'yes' });
    expect(states.check('washington dc', 'US-DC', whole)).toEqual({ res: 'yes' });
  });

  it('takes one as it is typed only where no name could be starting with it', () => {
    const all = new Set(['US-NH', 'US-NJ', 'US-NC', 'US-MA', 'US-ME', 'US-NE', 'US-DC', 'CA-NS', 'CA-NL', 'MX-NLE']);
    expect(states.typed('nh', all)).toEqual({ ids: ['US-NH'], wait: false });
    expect(states.typed('dc', all)).toEqual({ ids: ['US-DC'], wait: false });
    // "tl" is Terranova y Labrador, but "nu" is on the way to "Nueva Jersey".
    const canada = new Matcher([named('CA-NS', 'Nueva Escocia', 'Nova Scotia'), named('CA-NL', 'Terranova y Labrador', 'Newfoundland and Labrador'), named('CA-NU', 'Nunavut')]);
    const open = new Set(['CA-NS', 'CA-NL', 'CA-NU']);
    expect(canada.typed('tl', open)).toEqual({ ids: ['CA-NL'], wait: false });
    expect(canada.typed('ne', open)).toEqual({ ids: ['CA-NS'], wait: true });
    // Also when the name it could be starting has been found already.
    expect(canada.typed('ne', new Set(['CA-NS']))).toEqual({ ids: ['CA-NS'], wait: true });
    // What has been found is not taken again, and a name is taken as before.
    expect(canada.typed('tl', new Set(['CA-NS']))).toEqual({ ids: [], wait: false });
    expect(canada.typed('nunavut', open)).toEqual({ ids: ['CA-NU'], wait: false });
    expect(canada.typed('xx', open)).toEqual({ ids: [], wait: false });
  });

  it('waits where a longer abbreviation or a word such as "isla" could be coming', () => {
    const mexico = new Matcher([named('MX-BCN', 'Baja California'), named('MX-BCS', 'Baja California Sur'), named('MX-SON', 'Sonora')]);
    const open = new Set(['MX-BCN', 'MX-BCS', 'MX-SON']);
    expect(mexico.typed('bc', open)).toEqual({ ids: ['MX-BCN'], wait: true });
    expect(mexico.typed('bcs', open)).toEqual({ ids: ['MX-BCS'], wait: false });
    const seas = new Matcher([named('a', 'Islas Salomón', 'Solomon Islands'), named('b', 'Fiyi', 'Fiji')]);
    expect(seas.typed('is', new Set(['a', 'b']))).toEqual({ ids: ['a'], wait: true });
    expect(seas.typed('si', new Set(['a', 'b']))).toEqual({ ids: ['a'], wait: false });
    // An article that the comparison drops is still typed.
    const rioja = new Matcher([named('a', 'La Rioja'), named('b', 'Los Alcores')]);
    expect(rioja.typed('la', new Set(['a', 'b']))).toEqual({ ids: ['b'], wait: true });
  });

  it('puts what the letters abbreviate first among the suggestions', () => {
    const m = new Matcher([named('a', 'Nharea'), named('b', 'Nuevo Hampshire', 'New Hampshire')]);
    expect(m.suggest('nh')).toEqual(['b', 'a']);
    expect(m.suggest('nha')).toEqual(['a']);
  });
});

describe('abbreviations on the maps', () => {
  beforeAll(() => {
    setLoader(async (p) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data', p), 'utf8')));
  });

  /** The abbreviations of a map, each with the name it stands for. */
  const listed = (deck: Deck) => {
    const out: Record<string, string> = {};
    for (const [k, id] of new Matcher(deck.items).abbreviations()) out[k.toUpperCase()] = deck.byId.get(id)!.answers[0];
    return out;
  };
  const regions = (...countries: string[]) => buildDeck({ scope: 'regions', countries, levels: Object.fromEntries(countries.map((c) => [c, 'f'])) });

  it('takes NH and NJ in the United States, and neither MA nor TX', async () => {
    const deck = await regions('US');
    const short = listed(deck);
    // The initials of the name in English and in Spanish, with and without "del".
    expect(short).toEqual({
      NH: 'Nuevo Hampshire',
      NJ: 'Nueva Jersey',
      NM: 'Nuevo México',
      NY: 'Nueva York',
      RI: 'Rhode Island',
      NC: 'Carolina del Norte',
      CN: 'Carolina del Norte',
      CDN: 'Carolina del Norte',
      SC: 'Carolina del Sur',
      CS: 'Carolina del Sur',
      CDS: 'Carolina del Sur',
      ND: 'Dakota del Norte',
      DN: 'Dakota del Norte',
      DDN: 'Dakota del Norte',
      SD: 'Dakota del Sur',
      DS: 'Dakota del Sur',
      DDS: 'Dakota del Sur',
      WV: 'Virginia Occidental',
      VO: 'Virginia Occidental',
      DC: 'Washington D. C.',
      WDC: 'Washington D. C.',
      DOC: 'Washington D. C.',
    });
    // No state with a name of one word answers to its postal code.
    const m = new Matcher(deck.items);
    const abbreviated = new Set(new Matcher(deck.items).abbreviations().map(([, id]) => id));
    const plain = deck.items.filter((it) => !abbreviated.has(it.id));
    expect(plain).toHaveLength(40);
    for (const it of plain) expect(m.lookup(it.id.slice(3)), it.name).toEqual([]);
    for (const code of ['MA', 'TX', 'CA', 'FL', 'WA', 'PA', 'AK', 'HI']) expect(m.lookup(code), code).toEqual([]);
  });

  it('takes BC, PEI and NWT in Canada', async () => {
    expect(listed(await regions('CA'))).toEqual({
      BC: 'Columbia Británica',
      CB: 'Columbia Británica',
      NB: 'Nuevo Brunswick',
      NL: 'Terranova y Labrador',
      NAL: 'Terranova y Labrador',
      TL: 'Terranova y Labrador',
      TYL: 'Terranova y Labrador',
      NS: 'Nueva Escocia',
      NE: 'Nueva Escocia',
      NT: 'Territorios del Noroeste',
      // "Northwest" is one word: this one is in the data by hand.
      NWT: 'Territorios del Noroeste',
      TN: 'Territorios del Noroeste',
      TDN: 'Territorios del Noroeste',
      PEI: 'Isla del Príncipe Eduardo',
      IPE: 'Isla del Príncipe Eduardo',
      IDPE: 'Isla del Príncipe Eduardo',
    });
  });

  it('takes NSW and ACT in Australia', async () => {
    expect(listed(await regions('AU'))).toEqual({
      NSW: 'Nueva Gales del Sur',
      NGS: 'Nueva Gales del Sur',
      NGDS: 'Nueva Gales del Sur',
      NT: 'Territorio del Norte',
      TN: 'Territorio del Norte',
      TDN: 'Territorio del Norte',
      SA: 'Australia Meridional',
      AM: 'Australia Meridional',
      WA: 'Australia Occidental',
      AO: 'Australia Occidental',
      ACT: 'Territorio de la Capital Australiana',
      TCA: 'Territorio de la Capital Australiana',
      TDCA: 'Territorio de la Capital Australiana',
      TDLCA: 'Territorio de la Capital Australiana',
    });
  });

  it('takes for nothing what could be two things on a bigger map', async () => {
    const one = new Matcher((await regions('MX')).items);
    expect(one.lookup('bc')).toEqual(['MX-BCN']);
    expect(one.lookup('nl')).toEqual(['MX-NLE']);
    const three = new Matcher((await regions('US', 'CA', 'MX')).items);
    // British Columbia or Baja California, Newfoundland and Labrador or Nuevo León.
    for (const k of ['bc', 'nl']) {
      expect(three.lookup(k), k).toEqual([]);
      expect(three.vague(k), k).toBe(true);
    }
    // Nueva Escocia and Territorios del Noroeste, but also the codes of Nebraska and Tennessee.
    for (const k of ['ne', 'tn']) {
      expect(three.lookup(k), k).toEqual([]);
      expect(three.vague(k), k).toBe(true);
    }
    expect(three.lookup('pei')).toEqual(['CA-PE']);
    expect(three.lookup('nh')).toEqual(['US-NH']);
    expect(three.lookup('bcs')).toEqual(['MX-BCS']);
    // Minas Gerais or Mato Grosso: the code that tells them apart has to be learnt, the initials do not.
    const brazil = new Matcher((await regions('BR')).items);
    expect(brazil.lookup('mg')).toEqual([]);
    expect(brazil.vague('mg')).toBe(true);
    expect(brazil.lookup('sp')).toEqual(['BR-SP']);
  });

  it('takes the usual ones among countries, and no code of two letters', async () => {
    const { index } = await loadIndex();
    const un = index.countries.filter((c) => c.cl === 'un').map((c) => c.id);
    const world = new Matcher((await buildDeck({ scope: 'countries', countries: un })).items);
    const expected: Record<string, string> = { uk: 'GB', gb: 'GB', eeuu: 'US', usa: 'US', eau: 'AE', uae: 'AE', rdc: 'CD', drc: 'CD', nz: 'NZ', png: 'PG', rd: 'DO', cr: 'CR', bf: 'BF' };
    for (const [k, id] of Object.entries(expected)) expect(world.lookup(k), k).toEqual([id]);
    // El Salvador, but Spain's code; Reino Unido, but Russia's; Corea del Norte, but China's.
    for (const k of ['es', 'ru', 'cn']) {
      expect(world.lookup(k), k).toEqual([]);
      expect(world.vague(k), k).toBe(true);
    }
    // "Sudáfrica" is one word: "SA" is Saudi Arabia alone, and no code of its own to learn.
    expect(world.lookup('sa')).toEqual(['SA']);
    // A country with a name of one word answers to no code.
    for (const k of ['fr', 'de', 'it', 'pt', 'mx', 'br', 'jp', 'ar']) {
      expect(world.lookup(k), k).toEqual([]);
      expect(world.vague(k), k).toBe(false);
    }
    // Where Spain is not on the map, "ES" is El Salvador.
    const americas = index.countries.filter((c) => c.cl === 'un' && c.ct === 'AM').map((c) => c.id);
    expect(new Matcher((await buildDeck({ scope: 'countries', countries: americas })).items).lookup('es')).toEqual(['SV']);
  });

  it('takes NY and LA among cities', async () => {
    const short = listed(await buildCityDeck(['US'], 'top', 50));
    expect(short.NY).toBe('Nueva York');
    expect(short.NYC).toBe('Nueva York');
    expect(short.LA).toBe('Los Ángeles');
    expect(short.SF).toBe('San Francisco');
  });

  it('gives none to a piece shown under a name of one word', async () => {
    // "Cusco Departament" and "Lima Region" in the source, "Ar Riyad", "Foral de Navarra", "Canary Islands".
    const peru = listed(await regions('PE'));
    expect(Object.values(peru)).not.toContain('Cusco');
    expect(Object.values(peru)).not.toContain('Lima');
    expect(peru.LM).toBe('Lima Metropolitana');
    expect(Object.values(listed(await regions('SA')))).not.toContain('Riad');
    const spain = listed(await buildDeck({ scope: 'regions', countries: ['ES'], levels: { ES: 'g1' } }));
    expect(Object.values(spain)).not.toContain('Canarias');
    expect(Object.values(spain)).not.toContain('Navarra');
    expect(spain).toMatchObject({ CYL: 'Castilla y León', CLM: 'Castilla-La Mancha', LR: 'La Rioja', IB: 'Islas Baleares', PV: 'País Vasco', CV: 'Comunidad Valenciana' });
    // Every piece with an abbreviation is shown under a name of several words, on every map.
    const { index } = await loadIndex();
    for (const c of index.countries)
      for (const lv of c.lv) {
        let deck: Deck;
        try {
          deck = await buildDeck({ scope: 'regions', countries: [c.id], levels: { [c.id]: lv.k } });
        } catch {
          continue;
        }
        const m = new Matcher(deck.items);
        const hand = new Set(deck.items.flatMap((it) => it.answers.filter(Boolean)).map((s) => s.replace(/[\s.]/g, '').toLowerCase()));
        for (const [k, id] of m.abbreviations()) {
          if (hand.has(k)) continue;
          expect(/[\s\-.'’]/.test(deck.byId.get(id)!.name.trim()), `${c.id} ${lv.k}: ${k} = ${deck.byId.get(id)!.name}`).toBe(true);
        }
      }
  });

  it('follows the language of the game', async () => {
    const { index } = await loadIndex();
    const africa = index.countries.filter((c) => c.cl === 'un' && c.ct === 'AF').map((c) => c.id);
    const maps = async () => ({
      provinces: new Matcher((await regions('ZA')).items),
      countries: new Matcher((await buildDeck({ scope: 'countries', countries: africa })).items),
    });
    // "Noroeste" and "Sudáfrica" are one word each; "North West" and "South Africa" are two.
    const es = await maps();
    expect(es.provinces.lookup('nw')).toEqual([]);
    expect(es.countries.lookup('sa')).toEqual([]);
    // "KwaZulu" is one word as well: this one is in the data by hand, in any language.
    expect(es.provinces.lookup('kzn')).toEqual(['ZA-NL']);
    try {
      setLang('en');
      const en = await maps();
      expect(en.provinces.lookup('nw')).toEqual(['ZA-NW']);
      expect(en.countries.lookup('sa')).toEqual(['ZA']);
      // And the other way round: "Países Bajos", but "Netherlands".
      const europe = index.countries.filter((c) => c.cl === 'un' && c.ct === 'EU').map((c) => c.id);
      expect(new Matcher((await buildDeck({ scope: 'countries', countries: europe })).items).lookup('pb')).toEqual([]);
    } finally {
      setLang('es');
    }
  });

  it('has none for rivers, lakes and seas, which are named after their kind', async () => {
    const deck = await buildPhysicalDeck(['sea', 'lake', 'range', 'desert', 'island', 'river']);
    const m = new Matcher(deck.items);
    expect(m.abbreviations()).toEqual([]);
    for (const k of ['ls', 'mr', 'op', 'tf']) expect(m.lookup(k), k).toEqual([]);
    expect(m.lookup('lago superior')).toHaveLength(1);
  });

  it('never takes one for two things, for a name of the map or for the code of another piece', async () => {
    const { index } = await loadIndex();
    const decks: [string, Deck][] = [];
    for (const c of index.countries)
      for (const lv of c.lv) {
        try {
          decks.push([`${c.id} ${lv.k}`, await buildDeck({ scope: 'regions', countries: [c.id], levels: { [c.id]: lv.k } })]);
        } catch {
          // A level without pieces of its own is not offered.
        }
      }
    decks.push(['world', await buildDeck({ scope: 'countries', countries: index.countries.map((c) => c.id) })]);
    expect(decks.length).toBeGreaterThan(250);
    let total = 0;
    for (const [title, deck] of decks) {
      const m = new Matcher(deck.items);
      const codes = new Map(deck.items.map((it) => [(it.id.split('-')[1] ?? it.id).toLowerCase(), it.id]));
      const spellings = new Set(deck.items.flatMap((it) => it.answers.filter(Boolean)));
      for (const [k, id] of m.abbreviations()) {
        total++;
        const what = `${title}: ${k}`;
        expect(m.lookup(k), what).toContain(id);
        expect(m.abbreviates(k), what).toBe(true);
        expect(m.lookup(k, { whole: true }), what).toEqual([]);
        expect(m.check(k, id, { whole: true }), what).toEqual({ res: 'short' });
        expect(k.length, what).toBeGreaterThanOrEqual(2);
        expect(k.length, what).toBeLessThanOrEqual(5);
        // Initials are nobody else's: a spelling written as an abbreviation ("DC") is whatever the data says.
        if (spellings.has(k.toUpperCase())) continue;
        expect(m.lookup(k), what).toEqual([id]);
        const coded = codes.get(k);
        if (coded) expect(coded, what).toBe(id);
      }
    }
    expect(total).toBeGreaterThan(1500);
  }, 60_000);
});
