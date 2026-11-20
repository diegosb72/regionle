import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { ALPHA_KINDS, ALPHA_NEAR, ALPHA_RANK_MIN, lettersOf, makeAlphabet, type AlphaKind, type AlphaQuestion, type AlphaWorld } from './alphabet';
import { setLang } from './i18n';
import { SAME_FLAG } from './pairs';
import { APART, CASPIAN, TWO_CONTINENTS } from './statements';
import { fold, initialOf, mulberry32 } from './text';
import type { Country, Index } from './types';

const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/data/index.json'), 'utf8')) as Index;
const byId = new Map(index.countries.map((c) => [c.id, c]));
const world: AlphaWorld = { byId, continents: index.continents, subregions: index.subregions };
const states = index.countries.filter((c) => c.cl === 'un');
const europe = states.filter((c) => c.ct === 'EU');
/** Everything the section lets in: the states and the territories with people. */
const all = index.countries.filter((c) => c.cl !== 'other' && (c.pop ?? 0) > 0);
const pickOf = (...ids: string[]): Country[] => ids.map((id) => byId.get(id)!);

let lang: 'es' | 'en' = 'es';
const use = (l: 'es' | 'en') => {
  lang = l;
  setLang(l);
};
beforeEach(() => use('es'));

const name = (c: Country): string => (lang === 'en' ? (c.n.en ?? c.n.es) : c.n.es);
const capital = (c: Country): string => (lang === 'en' ? c.cap!.en : c.cap!.es);
const nb = (c: Country): string[] => c.nb ?? [];
const touch = (a: Country, b: Country): boolean => nb(a).includes(b.id) || nb(b).includes(a.id);
const isState = (id: string): boolean => byId.get(id)!.cl !== 'dep' && byId.get(id)!.cl !== 'other';

/** Whether a clue is true of a country, by what the data says: worked out here, not by the game. */
function fits(q: AlphaQuestion, c: Country, mates: Country[]): boolean {
  if (q.kind === 'capital') return !!c.cap && q.text.includes(capital(c));
  if (q.kind === 'flag') return (SAME_FLAG[c.id] ?? c.id) === (SAME_FLAG[q.id] ?? q.id);
  if (q.kind === 'borders') {
    const named = q.near!.map((id) => byId.get(id)!);
    if (!named.every((n) => n.id !== c.id && touch(c, n))) return false;
    return q.whole ? nb(c).length === named.length : true;
  }
  if (q.kind === 'place') {
    // A country on two continents is in whichever is said, for all anybody could argue.
    const there = TWO_CONTINENTS.has(c.id) || c.sr === q.part || c.ct === q.part;
    const caspian = CASPIAN.has(c.id);
    const sea = q.sea === 'unsaid' || caspian || (q.sea === 'none' ? !!c.ll : q.sea === 'island' ? !c.ll && nb(c).length === 0 : !c.ll);
    return there && sea;
  }
  const of = (x: Country) => (q.by === 'pop' ? (x.pop ?? 0) : x.ar);
  return [byId.get(q.id)!, ...mates].every((m) => m.id === c.id || of(c) > of(m));
}

/** Many games on a list, each with its own lot. */
function games(list: Country[], count = 60, kinds: readonly AlphaKind[] = ALPHA_KINDS): AlphaQuestion[][] {
  return Array.from({ length: count }, (_, i) => makeAlphabet(list, world, mulberry32(i + 1), kinds));
}

describe('the alphabet: its letters', () => {
  it('files a name under its first letter, without its accent', () => {
    expect(initialOf('España')).toBe('E');
    expect(initialOf('Áustria')).toBe('A');
    expect(initialOf('Östereich')).toBe('O');
    expect(initialOf('el Salvador')).toBe('E');
    expect(initialOf('Ñuble')).toBe('N');
    expect(initialOf('')).toBe('');
    expect(initialOf('’s-Hertogenbosch')).toBe('S');
    expect(initialOf('3 de Febrero')).toBe('');
  });

  it('has the letters the names of the countries begin with, which are not the same in every language', () => {
    expect([...lettersOf(states).keys()].join('')).toBe('ABCDEFGHIJKLMNOPRSTUVYZ');
    expect(lettersOf(states).get('A')!.map((c) => c.id)).toContain('DE');
    expect(lettersOf(states).get('O')!.map((c) => c.id)).toEqual(['OM']);
    use('en');
    expect([...lettersOf(states).keys()].join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVYZ');
    expect(lettersOf(states).get('G')!.map((c) => c.id)).toContain('DE');
    expect(lettersOf(states).get('Q')!.map((c) => c.id)).toEqual(['QA']);
  });

  it('asks one country for each letter, from A to Z', () => {
    for (const list of [states, europe, all]) {
      const letters = lettersOf(list);
      for (const qs of games(list, 30)) {
        expect(qs.map((q) => q.letter)).toEqual([...letters.keys()]);
        for (const q of qs) {
          expect(letters.get(q.letter)!.map((c) => c.id), q.letter).toContain(q.id);
          expect(initialOf(name(byId.get(q.id)!))).toBe(q.letter);
        }
      }
    }
    expect([...lettersOf(europe).keys()].length).toBe(16);
  });

  it('draws the country of a letter by lot: two games are not the same game', () => {
    const [one, two] = games(states, 2);
    const same = one.filter((q, i) => q.id === two[i].id).length;
    expect(same).toBeLessThan(one.length - 5);
    // Every country of a letter comes up sooner or later, where it has something to be told apart by.
    const seen = new Set(games(states, 200).flatMap((qs) => qs.filter((q) => q.letter === 'H').map((q) => q.id)));
    expect([...seen].sort()).toEqual(['HN', 'HT', 'HU']);
  });

  it('is in the language of the game', () => {
    use('en');
    const qs = makeAlphabet(states, world, mulberry32(4));
    expect(qs.find((q) => q.letter === 'G')).toBeTruthy();
    for (const q of qs) expect(q.text).toMatch(/^(Its capital is |This is its flag\.|It borders |It is in |It has the most people |It is the largest )/);
    use('es');
    for (const q of makeAlphabet(states, world, mulberry32(4))) expect(q.text).toMatch(/^(Su capital es |Esta es su bandera\.|Limita con |Solo limita con |Está en |Es el más )/);
  });
});

describe('the alphabet: a clue leaves one country among those of its letter', () => {
  it('whatever it is about, in both languages, with countries and with territories', () => {
    for (const l of ['es', 'en'] as const) {
      use(l);
      for (const list of [states, europe, all, states.filter((c) => c.ct === 'AF' || c.ct === 'AS')]) {
        const letters = lettersOf(list);
        for (const qs of games(list, 40)) {
          for (const q of qs) {
            const answer = byId.get(q.id)!;
            const mates = letters.get(q.letter)!.filter((c) => c.id !== q.id);
            expect(fits(q, answer, mates), `${l} ${q.letter} ${q.text} → ${name(answer)}`).toBe(true);
            const also = mates.filter((m) => fits(q, m, mates));
            expect(also.map(name), `${l} ${q.letter} ${q.text} → ${name(answer)}`).toEqual([]);
          }
        }
      }
    }
  });

  it('tells of each kind sooner or later, and not always of the same', () => {
    const count = new Map<AlphaKind, number>();
    const qs = games(states, 100).flat();
    for (const q of qs) count.set(q.kind, (count.get(q.kind) ?? 0) + 1);
    for (const kind of ALPHA_KINDS) expect(count.get(kind) ?? 0, kind).toBeGreaterThan(qs.length * 0.04);
    for (const kind of ALPHA_KINDS) expect(count.get(kind) ?? 0, kind).toBeLessThan(qs.length * 0.45);
    // Within a game, no kind takes more than about half of the letters.
    for (const game of games(states, 100)) for (const kind of ALPHA_KINDS) expect(game.filter((q) => q.kind === kind).length, kind).toBeLessThanOrEqual(13);
  });

  it('can be asked for one kind of clue alone', () => {
    for (const kind of ALPHA_KINDS) {
      const qs = games(states, 10, [kind]).flat();
      expect(qs.length, kind).toBeGreaterThan(0);
      expect(new Set(qs.map((q) => q.kind))).toEqual(new Set([kind]));
    }
  });
});

describe('the alphabet: what each clue says', () => {
  const only = (kind: AlphaKind, list = states, count = 80) => games(list, count, [kind]).flat();

  it('gives the capital, unless it all but says the name', () => {
    const qs = only('capital');
    for (const q of qs) expect(q.text).toBe(`Su capital es ${byId.get(q.id)!.cap!.es}.`);
    const asked = new Set(qs.map((q) => q.id));
    // Argel, Brasilia, Ciudad de Guatemala, Luxemburgo, San Salvador, Túnez…
    for (const id of ['DZ', 'BR', 'GT', 'LU', 'SV', 'TN', 'MX', 'PA', 'SG', 'MC', 'SM', 'DJ', 'KW', 'AD', 'ST']) expect(asked.has(id), id).toBe(false);
    for (const id of ['ES', 'FR', 'AL', 'JP']) expect(asked.has(id), id).toBe(true);
  });

  it('shows the flag, unless it is that of another country', () => {
    const qs = only('flag', all, 120);
    for (const q of qs) {
      expect(q.text).toBe('Esta es su bandera.');
      expect(q.flag).toBe(byId.get(q.id)!.fl);
      // A territory that flies the flag of its country has none to be told by.
      expect(byId.get(q.id)!.cl === 'dep' && SAME_FLAG[q.id] != null, q.id).toBe(false);
    }
    const asked = new Set(qs.map((q) => q.id));
    for (const id of ['RE', 'GP', 'MF', 'SJ', 'BQ', 'SH']) expect(asked.has(id), id).toBe(false);
    // No other clue carries a flag.
    for (const q of games(states, 20).flat()) expect(q.flag != null).toBe(q.kind === 'flag');
  });

  it('names the neighbours: all of them where they are few, and three otherwise', () => {
    const qs = only('borders', all, 150);
    expect(qs.some((q) => q.whole)).toBe(true);
    expect(qs.some((q) => !q.whole)).toBe(true);
    for (const q of qs) {
      const c = byId.get(q.id)!;
      const near = q.near!;
      expect(near.length).toBeGreaterThan(0);
      expect(near.length).toBeLessThanOrEqual(ALPHA_NEAR);
      expect(new Set(near).size).toBe(near.length);
      for (const id of near) {
        expect(touch(c, byId.get(id)!), `${q.id}-${id}`).toBe(true);
        // A territory of another country is not one more country to name.
        expect(isState(id), id).toBe(true);
        expect(q.text).toContain(byId.get(id)!.n.es);
      }
      if (q.whole) {
        expect([...near].sort()).toEqual([...nb(c)].sort());
        expect(q.text).toMatch(near.length === 1 ? /^Solo limita con .+\.$/ : /^Limita con .+, y con nadie más\.$/);
      } else {
        expect(nb(c).length).toBeGreaterThan(near.length);
        expect(q.text).toMatch(/^Limita con .+, entre otros\.$/);
      }
    }
    // An island has no neighbours to be told by.
    const asked = new Set(qs.map((q) => q.id));
    for (const id of ['JP', 'IS', 'CU', 'AU']) expect(asked.has(id), id).toBe(false);
    // Surinam borders French Guiana too, which is not a country: its two are not "all".
    for (const q of qs.filter((x) => x.id === 'SR')) expect(q.whole).toBe(false);
    // The name of a neighbour does not say the answer: Sudán del Sur is not named for Sudán, nor Guinea for Guinea-Bisáu.
    for (const q of qs.filter((x) => x.id === 'SD')) expect(q.near).not.toContain('SS');
    for (const q of qs.filter((x) => x.id === 'GW')) expect(q.near).not.toContain('GN');
    expect(only('borders', pickOf('PT', 'ES', 'FR'), 5).find((q) => q.id === 'PT')?.text).toBe('Solo limita con España.');
    // «e» before the sound of an i.
    expect(only('borders', pickOf('TN', 'ES', 'FR'), 5).find((q) => q.id === 'TN')?.text).toBe('Limita con Argelia y Libia, y con nadie más.');
    expect(only('borders', pickOf('KW', 'ES', 'FR'), 5).find((q) => q.id === 'KW')?.text).toBe('Limita con Arabia Saudita e Irak, y con nadie más.');
  });

  it('says the part of the world and how the country meets the sea', () => {
    const qs = only('place', all, 150);
    const tails = new Set<string>();
    for (const q of qs) {
      const c = byId.get(q.id)!;
      // Not a country on two continents, of which either could be said.
      expect(TWO_CONTINENTS.has(q.id), q.id).toBe(false);
      expect([c.sr, c.ct]).toContain(q.part);
      // (The Antarctic is a part of the world and a continent under the same key: either name may be the one said.)
      const part = [index.subregions[q.part!], index.continents[q.part!]].find((p) => p && q.text.includes(`en ${q.part === 'AM-K' || q.part === 'AS-SE' ? 'el ' : ''}${p.es}`))!;
      expect(part, q.text).toBeTruthy();
      expect(q.sea).toBe(CASPIAN.has(c.id) ? 'unsaid' : c.ll ? 'none' : nb(c).length === 0 ? 'island' : 'coast');
      // What comes after the name of the part of the world (which may hold a "y" of its own: «Australia y Nueva Zelanda»).
      const tail = q.text.slice(q.text.indexOf(part.es) + part.es.length).replace(/^ y /, '').replace(/\.$/, '');
      tails.add(tail);
      expect(tail).toBe(q.sea === 'none' ? 'no tiene salida al mar' : q.sea === 'island' ? 'no tiene fronteras terrestres' : q.sea === 'coast' ? 'tiene costa' : '');
    }
    expect([...tails].sort()).toEqual(['no tiene fronteras terrestres', 'no tiene salida al mar', 'tiene costa']);
    // The part of the world is not named where its name would say the country: of those, the continent.
    for (const q of qs.filter((x) => ['AU', 'NZ', 'FM', 'CF', 'ZA'].includes(x.id))) expect(q.part, q.id).toBe(byId.get(q.id)!.ct);
    expect(only('place', pickOf('AU', 'ES', 'FR'), 5).find((q) => q.id === 'AU')?.text).toBe('Está en Oceanía y no tiene fronteras terrestres.');
    expect(only('place', pickOf('JM', 'ES', 'FR'), 5).find((q) => q.id === 'JM')?.text).toBe('Está en el Caribe y no tiene fronteras terrestres.');
    expect(only('place', pickOf('TH', 'ES', 'FR'), 5).find((q) => q.id === 'TH')?.text).toBe('Está en el Sudeste Asiático y tiene costa.');
    expect(only('place', pickOf('BO', 'ES', 'FR'), 5).find((q) => q.id === 'BO')?.text).toBe('Está en América del Sur y no tiene salida al mar.');
    // The shores of the Caspian: nothing is said of the sea.
    expect(only('place', pickOf('TM', 'ES', 'FR'), 5).find((q) => q.id === 'TM')?.text).toBe('Está en Asia Central.');
    use('en');
    expect(only('place', pickOf('JM', 'ES', 'FR'), 5).find((q) => q.id === 'JM')?.text).toBe('It is in the Caribbean and has no land borders.');
    expect(only('place', pickOf('BO', 'ES', 'FR'), 5).find((q) => q.id === 'BO')?.text).toBe('It is in South America and is landlocked.');
    expect(only('place', pickOf('US', 'ES', 'FR'), 5).find((q) => q.id === 'US')?.text).toBe('It is in North America and has a coast.');
  });

  it('does not say where an island with a coast is when another of its letter is one too', () => {
    // Japón and Jamaica are islands of different parts of the world: each can be told by its own.
    expect(only('place', pickOf('JP', 'JM', 'JO'), 20).map((q) => q.id).sort()).toContain('JP');
    // Irlanda and Islandia are both in northern Europe, and both have a coast; Islandia has no land border,
    // Irlanda has one. "Has a coast" is true of both, so Irlanda is not told that way; "no land borders" is not.
    const asked = new Set(only('place', pickOf('IE', 'IS'), 40).map((q) => q.id));
    expect([...asked]).toEqual(['IS']);
  });

  it('says what a country is the first of among those of its letter, where it is by far', () => {
    const qs = only('rank', states, 100);
    expect(qs.some((q) => q.by === 'pop')).toBe(true);
    expect(qs.some((q) => q.by === 'area')).toBe(true);
    const letters = lettersOf(states);
    for (const q of qs) {
      const c = byId.get(q.id)!;
      const mates = letters.get(q.letter)!.filter((m) => m.id !== q.id);
      expect(mates.length + 1).toBeGreaterThanOrEqual(ALPHA_RANK_MIN);
      const of = (x: Country) => (q.by === 'pop' ? (x.pop ?? 0) : x.ar);
      for (const m of mates) expect(of(c) / of(m), `${q.id} > ${m.id}`).toBeGreaterThanOrEqual(APART);
      expect(q.text).toBe(q.by === 'pop' ? `Es el más poblado de los que empiezan por ${q.letter}.` : `Es el más grande de los que empiezan por ${q.letter}.`);
    }
    // China and Canadá are too much of a size for either to be "the largest" of the C; China has by far the most people.
    expect(qs.filter((q) => q.letter === 'C' && q.by === 'area')).toEqual([]);
    expect(qs.find((q) => q.letter === 'C')?.id).toBe('CN');
    // Two countries are not enough for one of them to be the most of anything.
    expect(only('rank', pickOf('DK', 'DM'), 5)).toEqual([]);
  });

  it('leaves out a letter where nothing tells its countries apart, and makes no game of no countries', () => {
    expect(makeAlphabet([], world, mulberry32(1))).toEqual([]);
    // Asked for neighbours alone, an island has nothing to say.
    expect(makeAlphabet(pickOf('JP', 'IS', 'ES'), world, mulberry32(1), ['borders']).map((q) => q.letter)).toEqual(['E']);
    const few = makeAlphabet(pickOf('ES', 'FR', 'PT'), world, mulberry32(1));
    expect(few.map((q) => q.id)).toEqual(['ES', 'FR', 'PT']);
    expect(fold(few[0].text)).not.toContain('espana');
  });
});
