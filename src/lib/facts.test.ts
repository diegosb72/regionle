/**
 * What is said of the countries besides their figures (lib/facts.ts): the file it comes in, as the build
 * left it, and what the games make of it: what a question gives for an answer, what it takes when typed,
 * which countries it can be asked of and what a wrong option can never be.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { factsOf, givenAway, loadFacts, pluralOf, type FactsFile } from './facts';
import { setLang } from './i18n';
import { FACT_KINDS } from './rules';
import type { Country, Facts, Index } from './types';
import { loadIndex, setLoader } from './world';

const read = <T,>(file: string): T => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data', file), 'utf8')) as T;

let file: FactsFile;
let countries: Country[];
let byId: Map<string, Country>;
let facts: Facts;
/** The members of the United Nations, and those of Europe among them. */
let un: string[];
let europe: string[];

beforeAll(() => {
  file = read<FactsFile>('facts.json');
  countries = read<Index>('index.json').countries;
  byId = new Map(countries.map((c) => [c.id, c]));
  facts = factsOf(file, byId);
  un = countries.filter((c) => c.cl === 'un').map((c) => c.id);
  europe = countries.filter((c) => c.cl === 'un' && c.ct === 'EU').map((c) => c.id);
});
afterEach(() => setLang('es'));

const names = (ids: readonly string[]): string[] => ids.map((id) => byId.get(id)!.n.es).sort((a, b) => a.localeCompare(b, 'es'));

describe('the file of what is said of the countries', () => {
  it('is about the countries the game asks, and has the four things of every member of the United Nations', () => {
    for (const id of Object.keys(file.c)) expect(byId.get(id)?.cl, id).not.toBe('other');
    for (const id of Object.keys(file.c)) expect(byId.has(id), id).toBe(true);
    for (const id of un) {
      const rec = file.c[id];
      expect(rec?.m?.length, `${id} currency`).toBeGreaterThan(0);
      expect(rec?.l?.length, `${id} language`).toBeGreaterThan(0);
      expect(rec?.d, `${id} domain`).toBeTruthy();
      expect(rec?.p?.length, `${id} dial`).toBeGreaterThan(0);
    }
    expect(un.length).toBe(193);
  });

  it('writes each thing the way the game reads it', () => {
    for (const [id, rec] of Object.entries(file.c)) {
      for (const code of rec.m ?? []) expect(code, id).toMatch(/^[A-Z]{3}$/);
      for (const code of [...(rec.l ?? []), ...(rec.r ?? []), ...(rec.s ?? [])]) expect(code, id).toMatch(/^[a-z]{2,3}$/);
      if (rec.d != null) expect(rec.d, id).toMatch(/^\.[a-z]{2,3}$/);
      for (const code of rec.p ?? []) expect(code, id).toMatch(/^\d{1,4}( \d{1,4})?$/);
      // Nothing twice, and no language in two of its lists.
      for (const list of [rec.m, rec.p]) expect(new Set(list).size, id).toBe(list?.length ?? 0);
      const tongues = [...(rec.l ?? []), ...(rec.r ?? []), ...(rec.s ?? [])];
      expect(new Set(tongues).size, id).toBe(tongues.length);
      // No list is there to be empty.
      for (const list of [rec.m, rec.l, rec.r, rec.s, rec.p]) if (list) expect(list.length, id).toBeGreaterThan(0);
    }
  });

  it('names every currency and every language a country has, in the two languages, and no other', () => {
    const money = new Set(Object.values(file.c).flatMap((rec) => rec.m ?? []));
    // Those that are only spoken are never shown: they need no name.
    const tongues = new Set(Object.values(file.c).flatMap((rec) => [...(rec.l ?? []), ...(rec.r ?? [])]));
    expect(Object.keys(file.m).sort()).toEqual([...money].sort());
    expect(Object.keys(file.l).sort()).toEqual([...tongues].sort());
    for (const [code, list] of Object.entries(file.m)) {
      // Its name in Spanish and in English, and what it is called for short in each.
      expect(list.length, code).toBeGreaterThanOrEqual(4);
      for (const name of list) expect(name.trim(), code).toBe(name);
      for (const name of list) expect(name.length, code).toBeGreaterThan(1);
      // The short name is a word of the whole one, or was given by hand.
      if (code !== 'ZWG') {
        expect(list[0].split(' '), code).toContain(list[2]);
        expect(list[1].toLowerCase().split(' '), code).toContain(list[3].toLowerCase());
      }
      expect(new Set(list.slice(4).map((n) => n.toLowerCase())).size, code).toBe(list.length - 4);
    }
    for (const [code, list] of Object.entries(file.l)) {
      expect(list.length, code).toBeGreaterThanOrEqual(2);
      for (const name of list) expect(name.trim().length, code).toBeGreaterThan(1);
    }
    // Spanish writes them in small letters, English with a capital.
    for (const [code, [es, en]] of Object.entries(file.l)) {
      expect(es[0], code).toBe(es[0].toLowerCase());
      expect(en[0], code).toBe(en[0].toUpperCase());
    }
  });

  it('gives a language that only spoken is, where it is the first of some country: what could be offered as a wrong answer', () => {
    const first = new Set(Object.values(file.c).flatMap((rec) => rec.l?.slice(0, 1) ?? []));
    for (const [id, rec] of Object.entries(file.c)) for (const code of rec.s ?? []) expect(first.has(code), `${id} ${code}`).toBe(true);
  });

  it('says what is known to be so', () => {
    const of = (id: string) => file.c[id];
    // The euro, of twenty-five members; Bulgaria since 2026.
    expect(un.filter((id) => of(id).m![0] === 'EUR').length).toBe(25);
    expect(of('BG').m).toEqual(['EUR']);
    expect(of('ES')).toMatchObject({ m: ['EUR'], l: ['es'], d: '.es', p: ['34'] });
    expect(of('ES').r).toEqual(expect.arrayContaining(['ca', 'gl', 'eu']));
    // Its own currency first, where a country has two.
    expect(of('PA').m).toEqual(['PAB', 'USD']);
    expect(of('EC').m).toEqual(['USD']);
    expect(of('GB')).toMatchObject({ m: ['GBP'], d: '.uk', p: ['44'] });
    expect(of('US')).toMatchObject({ m: ['USD'], l: ['en'], d: '.us', p: ['1'] });
    expect(of('DO').p).toEqual(['1 809', '1 829']);
    expect(of('XK')).toMatchObject({ p: ['383'] });
    expect(of('XK').d).toBeUndefined();
    // The languages: the most spoken of the official ones first.
    expect(of('BE').l).toEqual(['nl', 'fr', 'de']);
    expect(of('CH').l).toEqual(['de', 'fr', 'it']);
    expect(of('CA').l).toEqual(['en', 'fr']);
    expect(of('BR').l).toEqual(['pt']);
    expect(of('AT').l).toEqual(['de']);
    expect(of('IR').l).toEqual(['fa']);
    expect(of('KZ').l).toEqual(['kk', 'ru']);
    // Mended by hand, with The World Factbook.
    expect(of('ZA').l).toEqual(['en', 'zu', 'xh', 'af', 'nso', 'tn', 'st', 'ts', 'ss', 've', 'nr']);
    expect(of('BO').l).toEqual(['es', 'qu', 'ay', 'gn']);
    expect(of('IL')).toMatchObject({ l: ['he'], s: expect.arrayContaining(['ar']) });
    expect(of('UA')).toMatchObject({ l: ['uk'], s: expect.arrayContaining(['ru']) });
    expect(of('ME').l).toEqual(['cnr']);
    expect(of('DZ').l).toEqual(['ar', 'tzm']);
    expect(file.l.es).toEqual(['español', 'Spanish', 'castellano', 'Castilian']);
    expect(file.m.USD.slice(0, 4)).toEqual(['dólar estadounidense', 'US dollar', 'dólar', 'dollar']);
    expect(file.m.EUR).toEqual(['euro', 'euro', 'euro', 'euro']);
  });

  it('stays small: it is fetched whole by the games that ask about it', () => {
    expect(fs.statSync(path.join(process.cwd(), 'public/data/facts.json')).size).toBeLessThan(40_000);
  });
});

describe('what the name of a country gives away', () => {
  it('is what begins like a word of it', () => {
    expect(givenAway('francés', 'Francia', 3)).toBe(true);
    expect(givenAway('ruso', 'Rusia', 3)).toBe(true);
    expect(givenAway('checo', 'Chequia', 3)).toBe(true);
    expect(givenAway('árabe', 'Emiratos Árabes Unidos', 3)).toBe(true);
    expect(givenAway('criollo haitiano', 'Haití', 3)).toBe(true);
    expect(givenAway('leona', 'Sierra Leona', 4)).toBe(true);
    expect(givenAway('boliviano', 'Bolivia', 4)).toBe(true);
    expect(givenAway('Spanish', 'Spain', 3)).toBe(true);
  });

  it('is not what only shares a couple of letters with it, or a word that says nothing', () => {
    expect(givenAway('alemán', 'Austria', 3)).toBe(false);
    expect(givenAway('danés', 'Dinamarca', 3)).toBe(false);
    expect(givenAway('griego', 'Grecia', 3)).toBe(false);
    expect(givenAway('neerlandés', 'Países Bajos', 3)).toBe(false);
    expect(givenAway('ruso', 'Bielorrusia', 3)).toBe(false);
    // A currency is seldom named after its country: three letters are a chance.
    expect(givenAway('libra', 'Líbano', 4)).toBe(false);
    expect(givenAway('libra', 'Líbano', 3)).toBe(true);
    expect(givenAway('hindi de Fiyi', 'República de la India', 3)).toBe(false);
    expect(givenAway('', 'Francia', 3)).toBe(false);
  });

  it('leaves these languages unasked, and no other: those of the members of the United Nations that are named after them', () => {
    const asked = new Set(facts.asked('language', europe));
    expect(names(europe.filter((id) => !asked.has(id)))).toEqual([
      'Albania',
      'Alemania',
      'Bosnia y Herzegovina',
      'Bulgaria',
      'Chequia',
      'Croacia',
      'Eslovaquia',
      'Eslovenia',
      'España',
      'Estonia',
      'Finlandia',
      'Francia',
      'Hungría',
      'Islandia',
      'Italia',
      'Letonia',
      'Lituania',
      'Macedonia del Norte',
      'Malta',
      'Montenegro',
      'Noruega',
      'Polonia',
      'Portugal',
      'Rumania',
      'Rusia',
      'Serbia',
      'Suecia',
      'Ucrania',
    ]);
    // What is left is worth asking.
    expect(names([...asked])).toEqual(['Andorra', 'Austria', 'Bélgica', 'Bielorrusia', 'Chipre', 'Dinamarca', 'Grecia', 'Irlanda', 'Liechtenstein', 'Luxemburgo', 'Moldavia', 'Mónaco', 'Países Bajos', 'Reino Unido', 'San Marino', 'Suiza']);
    const world = new Set(facts.asked('language', un));
    expect(world.size).toBeGreaterThan(120);
    for (const id of ['MX', 'BR', 'US', 'IN', 'IR', 'IL', 'EG', 'AU', 'ET', 'KE']) expect(world.has(id), id).toBe(true);
    for (const id of ['JP', 'CN', 'TH', 'VN', 'TR', 'SA', 'AE', 'ID', 'MN', 'SO']) expect(world.has(id), id).toBe(false);
  });

  it('leaves three currencies unasked', () => {
    const asked = new Set(facts.asked('currency', un));
    expect(names(un.filter((id) => !asked.has(id)))).toEqual(['Afganistán', 'Bolivia', 'Sierra Leona']);
    setLang('en');
    const inEnglish = new Set(facts.asked('currency', un));
    expect(un.filter((id) => !inEnglish.has(id)).sort()).toEqual(['AF', 'BO', 'SL']);
  });

  it('is judged by the names of the language the game is in', () => {
    // "Bangla" and "Bangladesh"; "bengalí" and "Bangladés".
    expect(facts.asked('language', ['BD'])).toEqual(['BD']);
    setLang('en');
    expect(facts.asked('language', ['BD'])).toEqual([]);
    // "French" does not begin like "France" for three letters: it is asked in English.
    expect(facts.asked('language', ['FR', 'ES', 'DE'])).toEqual(['FR']);
  });

  it('asks a domain and a dialling code of every country that has one', () => {
    expect(facts.asked('domain', un)).toEqual(un);
    expect(facts.asked('dial', un)).toEqual(un);
    expect(facts.asked('domain', ['ES', 'XK', 'PT'])).toEqual(['ES', 'PT']);
    expect(facts.asked('dial', ['ES', 'ZZ'])).toEqual(['ES']);
  });
});

describe('a country to be found by what is shown of it', () => {
  it('is one that shares it with no other of the map', () => {
    expect(facts.asked('dial', ['US', 'CA', 'MX'], true)).toEqual(['MX']);
    expect(facts.asked('dial', ['US', 'MX'], true)).toEqual(['US', 'MX']);
    expect(facts.asked('dial', ['RU', 'KZ', 'UZ'], true)).toEqual(['UZ']);
    // Among the members of the United Nations, only those two codes are shared; and no domain is.
    const found = new Set(facts.asked('dial', un, true));
    expect(un.filter((id) => !found.has(id)).sort()).toEqual(['CA', 'KZ', 'RU', 'US']);
    expect(facts.asked('domain', un, true)).toEqual(un);
    expect(facts.asked('domain', ['GP', 'MF', 'FR'], true)).toEqual(['FR']);
    // A country with two codes is found by either, if both are its own alone.
    expect(facts.asked('dial', ['DO', 'HT'], true)).toEqual(['DO', 'HT']);
  });
});

describe('what a question gives for an answer', () => {
  it('is the currency without saying whose it is, the first of the languages, the domain and the code with its plus', () => {
    expect(FACT_KINDS.map((kind) => facts.said(kind, 'ES'))).toEqual(['euro', 'español', '.es', '+34']);
    expect(FACT_KINDS.map((kind) => facts.said(kind, 'US'))).toEqual(['dólar', 'inglés', '.us', '+1']);
    expect(FACT_KINDS.map((kind) => facts.said(kind, 'DO'))).toEqual(['peso', 'español', '.do', '+1 809']);
    expect(facts.said('currency', 'GB')).toBe('libra');
    expect(facts.said('currency', 'IL')).toBe('séquel');
    expect(facts.said('currency', 'ZW')).toBe('ZiG');
    expect(facts.said('language', 'BE')).toBe('neerlandés');
    setLang('en');
    expect(FACT_KINDS.map((kind) => facts.said(kind, 'ES'))).toEqual(['euro', 'Spanish', '.es', '+34']);
    expect(facts.said('currency', 'US')).toBe('dollar');
    expect(facts.said('currency', 'GB')).toBe('pound');
    expect(facts.said('currency', 'AF')).toBe('afghani');
  });

  it('is nothing where the country has none, or is not one of the game', () => {
    expect(facts.said('domain', 'XK')).toBe('');
    expect(facts.said('dial', 'XK')).toBe('+383');
    for (const kind of FACT_KINDS) expect(facts.said(kind, 'ZZ')).toBe('');
    for (const kind of FACT_KINDS) expect(facts.all(kind, 'ZZ')).toBe('');
  });

  it('is told whole once the question is settled: the two currencies, every language, both codes', () => {
    expect(facts.all('currency', 'PA')).toBe('balboa y dólar');
    expect(facts.all('currency', 'ES')).toBe('euro');
    expect(facts.all('language', 'BE')).toBe('neerlandés, francés y alemán');
    expect(facts.all('language', 'CH')).toBe('alemán, francés e italiano');
    expect(facts.all('language', 'ES')).toBe('español');
    expect(facts.all('dial', 'DO')).toBe('+1 809 y +1 829');
    expect(facts.all('domain', 'ES')).toBe('.es');
    setLang('en');
    expect(facts.all('currency', 'PA')).toBe('balboa and dollar');
    expect(facts.all('language', 'BE')).toBe('Dutch, French and German');
  });

  it('is in every case one of the things that hold of the country', () => {
    for (const lang of ['es', 'en'] as const) {
      setLang(lang);
      for (const kind of FACT_KINDS) for (const id of un) expect(facts.holds(kind, id, facts.said(kind, id)), `${lang} ${kind} ${id}`).toBe(true);
    }
  });
});

describe('what cannot be a wrong option', () => {
  it('is anything else that is true of the country: its other currency, another of its languages, one that is only spoken there', () => {
    expect(facts.holds('currency', 'PA', 'dólar')).toBe(true);
    expect(facts.holds('currency', 'PA', 'balboa')).toBe(true);
    expect(facts.holds('currency', 'MX', 'dólar')).toBe(false);
    // Every dollar is "dólar": the one of Australia cannot be offered against that of Canada.
    expect(facts.holds('currency', 'CA', facts.said('currency', 'AU'))).toBe(true);
    expect(facts.holds('language', 'BE', 'francés')).toBe(true);
    expect(facts.holds('language', 'BE', 'alemán')).toBe(true);
    expect(facts.holds('language', 'BE', 'italiano')).toBe(false);
    // Official in part of Spain; spoken in Ukraine and in Algeria, and official in neither.
    expect(facts.holds('language', 'ES', 'catalán')).toBe(true);
    expect(facts.holds('language', 'UA', 'ruso')).toBe(true);
    expect(facts.holds('language', 'DZ', 'francés')).toBe(true);
    expect(facts.holds('domain', 'ES', '.es')).toBe(true);
    expect(facts.holds('domain', 'ES', '.pt')).toBe(false);
    expect(facts.holds('dial', 'DO', '+1 829')).toBe(true);
    expect(facts.holds('dial', 'DO', '+1')).toBe(false);
  });

  it('leaves at least three wrong options to every question of a map of the world', () => {
    for (const lang of ['es', 'en'] as const) {
      setLang(lang);
      for (const kind of FACT_KINDS) {
        const said = new Set(un.map((id) => facts.said(kind, id)));
        for (const id of facts.asked(kind, un)) expect([...said].filter((s) => !facts.holds(kind, id, s)).length, `${lang} ${kind} ${id}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe('how many countries share what is said of one', () => {
  it('counts those that could say the same of themselves, the country among them', () => {
    // The yen is of Japan alone; the krone, of Denmark, Norway, Sweden, Iceland and Czechia; the euro, of twenty-five.
    expect(facts.sharedBy('currency', 'JP', un)).toBe(1);
    expect(facts.sharedBy('currency', 'DK', un)).toBe(5);
    expect(facts.sharedBy('currency', 'ES', un)).toBe(25);
    // By the name a question gives: the dollars of the world are one answer.
    expect(facts.sharedBy('currency', 'US', un)).toBeGreaterThan(30);
    expect(facts.sharedBy('language', 'DK', un)).toBe(1);
    expect(facts.sharedBy('language', 'ES', un)).toBe(20);
    // Dutch: the Netherlands, Belgium and Suriname.
    expect(facts.sharedBy('language', 'NL', un)).toBe(3);
    expect(facts.sharedBy('domain', 'ES', un)).toBe(1);
    // Canada has the code of the United States.
    expect(facts.sharedBy('dial', 'US', un)).toBe(2);
  });

  it('counts among the countries given, and only what is official in the whole of each', () => {
    expect(facts.sharedBy('currency', 'ES', ['ES', 'FR', 'CH'])).toBe(2);
    // On a map the country is not on, it is not counted.
    expect(facts.sharedBy('currency', 'JP', ['ES', 'FR'])).toBe(0);
    expect(facts.sharedBy('currency', 'ES', [])).toBe(0);
    // English is spoken by many in Spain, and French is so in Algeria: neither is official there.
    expect(facts.holds('language', 'ES', 'inglés')).toBe(true);
    expect(facts.sharedBy('language', 'GB', ['GB', 'ES'])).toBe(1);
    expect(facts.sharedBy('language', 'FR', ['FR', 'DZ'])).toBe(1);
    // It is the first of a country that is counted: German for Switzerland, whatever else is official in it.
    expect(facts.sharedBy('language', 'CH', ['CH', 'DE', 'AT', 'FR', 'IT'])).toBe(3);
    // A country that has none shares it with nobody.
    expect(facts.said('domain', 'XK')).toBe('');
    expect(facts.sharedBy('domain', 'XK', ['XK', 'ES'])).toBe(0);
  });
});

describe('a map that gives four options to choose from', () => {
  it('is the world, for each of the four things and in both languages', () => {
    for (const lang of ['es', 'en'] as const) {
      setLang(lang);
      for (const kind of FACT_KINDS) expect(facts.choosable(kind, un), `${lang} ${kind}`).toBe(true);
    }
    expect(facts.choosable('language', europe)).toBe(true);
    expect(facts.choosable('currency', europe)).toBe(true);
  });

  it('is not one with fewer than four different answers', () => {
    // English, English and Spanish; the euro five times over.
    expect(facts.choosable('language', ['US', 'CA', 'MX'])).toBe(false);
    expect(facts.choosable('currency', ['ES', 'FR', 'DE', 'IT', 'PT'])).toBe(false);
    expect(facts.choosable('domain', ['ES', 'FR', 'DE'])).toBe(false);
    expect(facts.choosable('domain', ['ES', 'FR', 'DE', 'IT'])).toBe(true);
    expect(facts.choosable('dial', ['ES', 'FR', 'DE', 'IT'])).toBe(true);
    // Canada and the United States share their code: three different ones among four countries.
    expect(facts.choosable('dial', ['US', 'CA', 'MX', 'DE'])).toBe(false);
    expect(facts.choosable('language', [])).toBe(false);
  });

  it('is not one whose four answers leave fewer than three that are wrong of a country asked', () => {
    // Arabic, French, Spanish and Portuguese: but French is spoken in Algeria, and cannot be offered as wrong of it.
    const maghreb = ['DZ', 'MA', 'TN', 'FR', 'ES', 'PT'];
    expect(new Set(maghreb.map((id) => facts.said('language', id))).size).toBe(4);
    expect(facts.asked('language', maghreb)).toEqual(['DZ', 'MA', 'TN']);
    expect(facts.choosable('language', maghreb)).toBe(false);
    // With Italian there are three again.
    expect(facts.choosable('language', [...maghreb, 'IT'])).toBe(true);
    // The dollar is the other currency of Panama: against it there are only the peso and the colón.
    expect(facts.choosable('currency', ['PA', 'US', 'MX', 'CR'])).toBe(false);
    expect(facts.choosable('currency', ['PA', 'US', 'MX', 'CR', 'GT'])).toBe(true);
  });

  it('is judged by the countries a list asks about, with the answers of the whole map to choose from', () => {
    const map = ['PA', 'US', 'MX', 'CR'];
    // Panama is the one that is short of wrong answers: a list that leaves it out is played among four.
    expect(facts.choosable('currency', map, ['US', 'MX', 'CR'])).toBe(true);
    expect(facts.choosable('currency', map, ['MX'])).toBe(true);
    expect(facts.choosable('currency', map, ['PA'])).toBe(false);
    expect(facts.choosable('currency', map, ['PA', 'MX'])).toBe(false);
    // The answers are those of the map, not of the list: one country alone is asked among the four of its map…
    expect(facts.choosable('domain', ['ES', 'FR', 'DE', 'IT'], ['ES'])).toBe(true);
    // …and a map of three answers gives no four, however short the list.
    expect(facts.choosable('domain', ['ES', 'FR', 'DE'], ['ES'])).toBe(false);
    // No list is the whole map.
    expect(facts.choosable('currency', map, undefined)).toBe(false);
  });
});

describe('what is typed for a fact', () => {
  const all = () => countries.filter((c) => c.cl !== 'other').map((c) => c.id);
  const right = (kind: (typeof FACT_KINDS)[number], id: string, text: string) => facts.check(kind, id, text, all()).right;

  it('takes a currency by its plain name, by its whole name, by more than one of it and by its code, in either language', () => {
    for (const text of ['peso', 'Peso', 'pesos', 'peso mexicano', 'Mexican peso', 'MXN', 'mxn']) expect(right('currency', 'MX', text), text).toBe(true);
    for (const text of ['dólar', 'dolar', 'dólares', 'dollar', 'dollars', 'dólar estadounidense', 'US dollar', 'USD']) expect(right('currency', 'US', text), text).toBe(true);
    for (const text of ['euro', 'euros', 'EURO', 'EUR']) expect(right('currency', 'ES', text), text).toBe(true);
    for (const text of ['libra', 'libras', 'libra esterlina', 'pound', 'pound sterling', 'sterling']) expect(right('currency', 'GB', text), text).toBe(true);
    for (const text of ['yen', 'yenes']) expect(right('currency', 'JP', text), text).toBe(true);
    for (const text of ['franco', 'francos', 'franco CFA', 'CFA', 'franco CFA de África Occidental']) expect(right('currency', 'SN', text), text).toBe(true);
    for (const text of ['séquel', 'sequel', 'shekel', 'shéquel', 'nuevo séquel']) expect(right('currency', 'IL', text), text).toBe(true);
    for (const text of ['yuan', 'renminbi', 'yuanes']) expect(right('currency', 'CN', text), text).toBe(true);
    for (const text of ['ZiG', 'zig', 'oro zimbabuense', 'dólar']) expect(right('currency', 'ZW', text), text).toBe(true);
    // The dollar of another country is a dollar too: it is the plain name that is asked for.
    expect(right('currency', 'CA', 'dólar')).toBe(true);
    expect(right('currency', 'CA', 'dólar canadiense')).toBe(true);
  });

  it('takes either currency of a country that has two', () => {
    for (const text of ['balboa', 'balboas', 'dólar', 'US dollar']) expect(right('currency', 'PA', text), text).toBe(true);
    for (const text of ['loti', 'rand']) expect(right('currency', 'LS', text), text).toBe(true);
  });

  it('forgives a slip of the finger in a long name, and none in a short one', () => {
    expect(right('currency', 'US', 'dolarr')).toBe(true);
    expect(right('currency', 'GT', 'quetsal')).toBe(true);
    // "rial" and "real" are two currencies, a letter apart.
    expect(right('currency', 'BR', 'real')).toBe(true);
    expect(right('currency', 'BR', 'rial')).toBe(false);
    expect(right('currency', 'IR', 'real')).toBe(false);
    expect(right('currency', 'JP', 'yan')).toBe(false);
  });

  it('says what a wrong currency was taken for', () => {
    expect(facts.check('currency', 'MX', 'dolar', all())).toEqual({ right: false, meant: 'dólar', note: 'La moneda no es «dólar».' });
    expect(facts.check('currency', 'CA', 'dólar australiano', all())).toMatchObject({ right: false, meant: 'dólar' });
    expect(facts.check('currency', 'ES', 'peseta', all())).toEqual({ right: false });
    expect(facts.check('currency', 'ES', '   ', all())).toEqual({ right: false });
    setLang('en');
    expect(facts.check('currency', 'MX', 'dolar', all())).toEqual({ right: false, meant: 'dollar', note: 'The currency is not “dollar”.' });
  });

  it('takes any language that is official in the country, also in part of it, by any of its names', () => {
    for (const text of ['neerlandés', 'holandés', 'flamenco', 'Dutch', 'francés', 'frances', 'French', 'alemán', 'German']) expect(right('language', 'BE', text), text).toBe(true);
    for (const text of ['español', 'castellano', 'Spanish', 'catalán', 'gallego', 'euskera', 'aranés']) expect(right('language', 'ES', text), text).toBe(true);
    for (const text of ['persa', 'farsi', 'Persian']) expect(right('language', 'IR', text), text).toBe(true);
    for (const text of ['chino', 'mandarín', 'Mandarin', 'chino mandarín']) expect(right('language', 'CN', text), text).toBe(true);
    for (const text of ['portugués', 'portugues', 'Portuguese']) expect(right('language', 'BR', text), text).toBe(true);
    for (const text of ['suajili', 'swahili', 'kiswahili', 'inglés']) expect(right('language', 'KE', text), text).toBe(true);
    for (const text of ['inglés', 'zulú', 'xhosa', 'afrikáans', 'afrikaans']) expect(right('language', 'ZA', text), text).toBe(true);
    for (const text of ['guaraní', 'guarani', 'español']) expect(right('language', 'PY', text), text).toBe(true);
    for (const text of ['hebreo', 'Hebrew']) expect(right('language', 'IL', text), text).toBe(true);
  });

  it('says of a wrong language what it is, and when it is one that is spoken there without being official', () => {
    expect(facts.check('language', 'BR', 'español', all())).toEqual({ right: false, meant: 'español', note: 'No es el español.' });
    expect(facts.check('language', 'UA', 'ruso', all())).toEqual({ right: false, meant: 'ruso', note: 'El ruso se habla en Ucrania, pero no es oficial.' });
    expect(facts.check('language', 'DZ', 'frances', all())).toEqual({ right: false, meant: 'francés', note: 'El francés se habla en Argelia, pero no es oficial.' });
    expect(facts.check('language', 'IL', 'árabe', all())).toMatchObject({ right: false, meant: 'árabe' });
    expect(facts.check('language', 'BR', 'brasileño', all())).toEqual({ right: false });
    setLang('en');
    expect(facts.check('language', 'BR', 'spanish', all())).toEqual({ right: false, meant: 'Spanish', note: 'It is not Spanish.' });
    expect(facts.check('language', 'UA', 'Russian', all())).toEqual({ right: false, meant: 'Russian', note: 'Russian is spoken in Ukraine, but it is not official.' });
  });

  it('takes a domain with its dot or without it, in any case', () => {
    for (const text of ['.es', 'es', 'ES', ' .es ', '..es']) expect(right('domain', 'ES', text), text).toBe(true);
    for (const text of ['.pt', 'esp', 'españa', '', '.']) expect(right('domain', 'ES', text), text).toBe(false);
    expect(right('domain', 'GB', '.uk')).toBe(true);
    expect(right('domain', 'GB', '.gb')).toBe(false);
    expect(right('domain', 'XK', '.xk')).toBe(false);
  });

  it('takes a dialling code with its plus or without it, with the zeros of an international call, in groups or run together', () => {
    for (const text of ['34', '+34', '0034', '(+34)', ' 34 ', '+ 34']) expect(right('dial', 'ES', text), text).toBe(true);
    for (const text of ['43', '3', '340', 'treinta y cuatro', '', '+']) expect(right('dial', 'ES', text), text).toBe(false);
    for (const text of ['1809', '+1 809', '1-809', '+1829', '1 829']) expect(right('dial', 'DO', text), text).toBe(true);
    expect(right('dial', 'DO', '1')).toBe(false);
    expect(right('dial', 'US', '+1')).toBe(true);
    expect(right('dial', 'XK', '383')).toBe(true);
  });

  it('says whose a domain or a code is, when it is of another country of the map', () => {
    expect(facts.check('domain', 'ES', 'pt', ['ES', 'PT', 'FR'])).toEqual({ right: false, meant: '.pt', note: '«.pt» es el dominio de Portugal.' });
    expect(facts.check('dial', 'ES', '351', ['ES', 'PT', 'FR'])).toEqual({ right: false, meant: '+351', note: '«+351» es el prefijo de Portugal.' });
    expect(facts.check('dial', 'US', '1829', ['US', 'DO'])).toEqual({ right: false, meant: '+1 829', note: '«+1 829» es el prefijo de República Dominicana.' });
    // Not on the map: nothing is said of it.
    expect(facts.check('domain', 'ES', 'pt', ['ES', 'FR'])).toEqual({ right: false });
    expect(facts.check('dial', 'ES', '999', ['ES', 'PT'])).toEqual({ right: false });
    setLang('en');
    expect(facts.check('domain', 'ES', 'pt', ['ES', 'PT'])).toEqual({ right: false, meant: '.pt', note: '“.pt” is the domain of Portugal.' });
    expect(facts.check('dial', 'ES', '351', ['ES', 'PT'])).toEqual({ right: false, meant: '+351', note: '“+351” is the dialling code of Portugal.' });
  });

  it('judges right, typed as it is shown, what every question gives for an answer', () => {
    for (const lang of ['es', 'en'] as const) {
      setLang(lang);
      for (const kind of FACT_KINDS) for (const id of un) expect(facts.check(kind, id, facts.said(kind, id), un).right, `${lang} ${kind} ${id}`).toBe(true);
    }
  });

  it('never takes for right, in a map of the world, what a question would offer as a wrong option', () => {
    // Every answer of the map against every country it is not true of: some hundred thousand in each language.
    const taken: string[] = [];
    for (const lang of ['es', 'en'] as const) {
      setLang(lang);
      for (const kind of FACT_KINDS) {
        // A domain and a dialling code are written the same in both languages: once is enough.
        if (lang === 'en' && (kind === 'domain' || kind === 'dial')) continue;
        const said = [...new Set(un.map((id) => facts.said(kind, id)))];
        for (const id of facts.asked(kind, un)) {
          for (const wrong of said) if (!facts.holds(kind, id, wrong) && facts.check(kind, id, wrong, un).right) taken.push(`${lang} ${kind} ${id}: ${wrong}`);
        }
      }
    }
    expect(taken).toEqual([]);
  }, 30_000);
});

describe('what is offered while a fact is typed', () => {
  it('is each name once, however many currencies answer to it', () => {
    const d = facts.suggest('currency', 'd');
    expect(d.length).toBe(6);
    expect(new Set(d).size).toBe(6);
    expect(d).toEqual(expect.arrayContaining(['dólar', 'dinar']));
    expect(facts.suggest('currency', 'dól')).toEqual(['dólar']);
    expect(facts.suggest('language', 'españ')).toEqual(['español']);
    expect(facts.suggest('language', 'castell')).toEqual(['español']);
    expect(facts.suggest('language', 'x')).toContain('xhosa');
    setLang('en');
    expect(facts.suggest('currency', 'doll')).toEqual(['dollar']);
    expect(facts.suggest('language', 'span')).toEqual(['Spanish']);
  });

  it('is nothing for a domain or a code, which are not looked up by their letters', () => {
    expect(facts.suggest('domain', 'e')).toEqual([]);
    expect(facts.suggest('dial', '3')).toEqual([]);
    expect(facts.suggest('currency', '')).toEqual([]);
  });
});

describe('the words of a question about a fact, and the card of a country', () => {
  it('ask for each thing in its own words, in both languages', () => {
    const es = FACT_KINDS.map((kind) => facts.ask(kind));
    expect(es).toEqual(['¿Qué moneda se usa en…?', '¿Qué idioma es oficial en…?', '¿Cuál es el dominio de internet de…?', '¿Cuál es el prefijo telefónico de…?']);
    expect(facts.ask('domain', true)).toBe('Señala el país de este dominio de internet');
    expect(facts.ask('dial', true)).toBe('Señala el país de este prefijo telefónico');
    setLang('en');
    const en = [...FACT_KINDS.map((kind) => facts.ask(kind)), ...FACT_KINDS.map((kind) => facts.ask(kind, true))];
    expect(new Set(en).size).toBe(8);
    for (const line of en) expect(es).not.toContain(line);
    expect(facts.ask('dial')).toBe('What is the dialling code of…?');
  });

  it('gives the card the four things in full: the currency by its whole name, every official language', () => {
    expect(facts.card('ES')).toEqual([
      ['Moneda', 'euro'],
      ['Idioma oficial', 'español'],
      ['Dominio de internet', '.es'],
      ['Prefijo telefónico', '+34'],
    ]);
    expect(facts.card('PA')[0]).toEqual(['Moneda', 'balboa panameño y dólar estadounidense']);
    expect(facts.card('BE')[1]).toEqual(['Idiomas oficiales', 'neerlandés, francés y alemán']);
    expect(facts.card('DO')[3]).toEqual(['Prefijo telefónico', '+1 809 y +1 829']);
    // Only what the country has.
    expect(facts.card('XK').map((row) => row[0])).toEqual(['Moneda', 'Idiomas oficiales', 'Prefijo telefónico']);
    expect(facts.card('ZZ')).toEqual([]);
    setLang('en');
    expect(facts.card('US')).toEqual([
      ['Currency', 'US dollar'],
      ['Official language', 'English'],
      ['Internet domain', '.us'],
      ['Dialling code', '+1'],
    ]);
  });
});

describe('more than one of a currency', () => {
  it('is said as Spanish and English say it', () => {
    expect(['dólar', 'peso', 'yen', 'franco', 'libra', 'colón', 'guaraní', 'real', 'pesos'].map((w) => pluralOf(w, true))).toEqual(['dólares', 'pesos', 'yenes', 'francos', 'libras', 'colónes', 'guaraníes', 'reales', 'pesos']);
    expect(['dollar', 'pound', 'peso', 'franc'].map((w) => pluralOf(w, false))).toEqual(['dollars', 'pounds', 'pesos', 'francs']);
  });
});

describe('the facts as the game fetches them', () => {
  it('come from their file and from the countries of the game, once for everybody', async () => {
    let fetched = 0;
    setLoader(async (p) => {
      if (p === 'facts.json') fetched++;
      return read(p);
    });
    const [a, b] = await Promise.all([loadFacts(), loadFacts()]);
    expect(a).toBe(b);
    expect(await loadFacts()).toBe(a);
    expect(fetched).toBe(1);
    expect(a.said('currency', 'ES')).toBe('euro');
    expect(a.asked('language', (await loadIndex()).index.countries.filter((c) => c.cl === 'un').map((c) => c.id)).length).toBeGreaterThan(120);
  });

  it('are asked for again after a failure, which is not kept', async () => {
    setLoader(async () => {
      throw new Error('sin red');
    });
    await expect(loadFacts()).rejects.toThrow('sin red');
    setLoader(async (p) => read(p));
    expect((await loadFacts()).said('domain', 'ES')).toBe('.es');
  });
});
