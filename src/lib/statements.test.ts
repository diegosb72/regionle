import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLang } from './i18n';
import { STATEMENT_KINDS, makeStatement, type Statement, type StatementKind, type StatementWorld } from './statements';
import { mulberry32 } from './text';
import type { Country, Index } from './types';

const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/data/index.json'), 'utf8')) as Index;
const byId = new Map(index.countries.map((c) => [c.id, c]));
const world: StatementWorld = { byId, continents: index.continents };
const states = index.countries.filter((c) => c.cl === 'un');
const pickOf = (...ids: string[]): Country[] => ids.map((id) => byId.get(id)!);
const europe = states.filter((c) => c.ct === 'EU');

/** Many statements of one kind, each made once. */
function many(list: Country[], kind: StatementKind, count = 200, seed = 7): Statement[] {
  const rng = mulberry32(seed);
  const seen = new Set<string>();
  const out: Statement[] = [];
  for (let i = 0; i < count; i++) {
    const st = makeStatement(list, world, rng, seen, [kind]);
    if (!st) break;
    seen.add(st.key);
    out.push(st);
  }
  return out;
}

const nb = (id: string): string[] => byId.get(id)!.nb ?? [];
const isState = (id: string) => byId.get(id)!.cl !== 'dep' && byId.get(id)!.cl !== 'other';
const density = (c: Country) => c.pop! / c.ar;

beforeEach(() => setLang('es'));

describe('true or false: what is said is what the data says', () => {
  it('about borders', () => {
    const list = many(europe, 'border');
    expect(list.length).toBeGreaterThan(100);
    for (const st of list) {
      const [a, b] = st.ids;
      expect(nb(a).includes(b), st.text).toBe(st.truth);
      expect(st.text).toBe(`${byId.get(a)!.n.es} limita con ${byId.get(b)!.n.es}.`);
    }
    expect(list.some((s) => s.truth) && list.some((s) => !s.truth)).toBe(true);
  });

  it('about capitals', () => {
    const list = many(europe, 'capital');
    expect(list.length).toBeGreaterThan(40);
    for (const st of list) {
      const a = byId.get(st.ids[0])!;
      expect(st.text.endsWith(`es ${a.cap!.es}.`), st.text).toBe(st.truth);
      // The right one is always told afterwards.
      expect(st.why).toContain(a.cap!.es);
      // One flag only: that of the country whose capital it really is would give a false one away.
      expect(st.ids).toEqual([a.id]);
    }
  });

  it('about size, people and density', () => {
    const figure: Record<string, (c: Country) => number> = { area: (c) => c.ar, pop: (c) => c.pop!, density };
    for (const kind of ['area', 'pop', 'density'] as const) {
      const list = many(states, kind, 150);
      expect(list.length, kind).toBe(150);
      for (const st of list) {
        const [a, b] = st.ids.map((id) => byId.get(id)!);
        expect(figure[kind](a) > figure[kind](b), st.text).toBe(st.truth);
        // Never a coin toss: one is at least a quarter larger than the other.
        const [hi, lo] = [figure[kind](a), figure[kind](b)].sort((x, y) => y - x);
        expect(hi / lo, st.text).toBeGreaterThanOrEqual(1.25);
      }
    }
  });

  it('about who has more neighbours, whatever counts as a country', () => {
    const list = many(states, 'neighbours', 150);
    expect(list.length).toBe(150);
    for (const st of list) {
      const [a, b] = st.ids;
      const strict = nb(a).filter(isState).length - nb(b).filter(isState).length;
      const loose = nb(a).length - nb(b).length;
      // The same answer counting Gibraltar or French Guiana, and not counting them.
      expect(strict > 0, st.text).toBe(st.truth);
      expect(loose > 0, st.text).toBe(st.truth);
      expect(Math.abs(strict), st.text).toBeGreaterThanOrEqual(2);
      expect(Math.abs(loose), st.text).toBeGreaterThanOrEqual(2);
    }
  });

  it('about which lies further north, by a clear margin', () => {
    const list = many(states, 'north', 150);
    for (const st of list) {
      const [a, b] = st.ids.map((id) => byId.get(id)!);
      expect(a.lp[1] > b.lp[1], st.text).toBe(st.truth);
      expect(Math.abs(a.lp[1] - b.lp[1]), st.text).toBeGreaterThanOrEqual(6);
    }
  });

  it('about the sea and land borders', () => {
    for (const st of many(states, 'landlocked', 150)) expect(!!byId.get(st.ids[0])!.ll, st.text).toBe(st.truth);
    for (const st of many(states, 'island', 150)) expect(nb(st.ids[0]).length === 0, st.text).toBe(st.truth);
  });

  it('about continents', () => {
    const list = many(states, 'continent', 200);
    expect(list.length).toBeGreaterThan(150);
    for (const st of list) {
      const a = byId.get(st.ids[0])!;
      expect(st.text === `${a.n.es} está en ${index.continents[a.ct].es}.`, st.text).toBe(st.truth);
      expect(st.why).toBe(`${a.n.es} está en ${index.continents[a.ct].es}.`);
    }
  });
});

describe('true or false: fair questions only', () => {
  it('says nothing of the continent of a country that lies on two', () => {
    const ids = new Set(many(states, 'continent', 400).map((s) => s.ids[0]));
    for (const id of ['RU', 'TR', 'KZ', 'EG', 'ID', 'CY', 'GE']) expect(ids.has(id), id).toBe(false);
    // On a short list, the others are asked about and those are not.
    const short = new Set(many(pickOf('ES', 'BR', 'RU', 'EG', 'TR'), 'continent', 50).map((s) => s.ids[0]));
    expect([...short].sort()).toEqual(['BR', 'ES']);
    // And a list of nothing else has no such question.
    expect(many(pickOf('RU', 'EG', 'TR'), 'continent')).toEqual([]);
  });

  it('does not ask for the continent inside a single one', () => {
    expect(many(europe, 'continent')).toEqual([]);
  });

  it('does not ask about the sea where every country has a coast, or none has', () => {
    expect(many(pickOf('ES', 'PT', 'FR', 'IT'), 'landlocked')).toEqual([]);
    expect(many(pickOf('CH', 'AT', 'HU', 'CZ'), 'landlocked')).toEqual([]);
    expect(many(pickOf('ES', 'CH'), 'landlocked').map((s) => [s.ids[0], s.truth]).sort()).toEqual([['CH', true], ['ES', false]]);
  });

  it('leaves out the countries named after their capital', () => {
    const ids = new Set(many(states, 'capital', 400).map((s) => s.ids[0]));
    for (const id of ['MC', 'SG', 'LU', 'PA', 'MX', 'GT', 'KW', 'DJ']) expect(ids.has(id), id).toBe(false);
    expect(ids.has('FR')).toBe(true);
  });

  it('makes a false border out of a country nearby, not across the world', () => {
    const list = many(states, 'border', 300).filter((s) => !s.truth);
    const sameContinent = list.filter((s) => byId.get(s.ids[0])!.ct === byId.get(s.ids[1])!.ct).length;
    expect(sameContinent / list.length).toBeGreaterThan(0.9);
  });

  it('is as often true as false', () => {
    const rng = mulberry32(3);
    let truths = 0;
    const n = 600;
    for (let i = 0; i < n; i++) if (makeStatement(states, world, rng)!.truth) truths++;
    expect(truths / n).toBeGreaterThan(0.4);
    expect(truths / n).toBeLessThan(0.6);
  });

  it('uses every kind on a list that spans the world', () => {
    const rng = mulberry32(11);
    const kinds = new Set<string>();
    for (let i = 0; i < 400; i++) kinds.add(makeStatement(states, world, rng)!.kind);
    expect([...kinds].sort()).toEqual([...STATEMENT_KINDS].sort());
  });
});

describe('true or false: the game it makes', () => {
  it('never repeats a statement while there are others', () => {
    const rng = mulberry32(5);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const st = makeStatement(europe, world, rng, seen)!;
      expect(st, `statement ${i}`).not.toBeNull();
      expect(seen.has(st.key)).toBe(false);
      seen.add(st.key);
    }
  });

  it('takes two countries with a border for the same statement, whichever is named first', () => {
    const keys = many(pickOf('ES', 'PT'), 'border').map((s) => s.key);
    expect(keys).toEqual(['border:ES-PT']);
  });

  it('runs out on a small list instead of going round in circles', () => {
    const rng = mulberry32(9);
    const seen = new Set<string>();
    let made = 0;
    for (let i = 0; i < 500; i++) {
      const st = makeStatement(pickOf('ES', 'PT'), world, rng, seen);
      if (!st) break;
      seen.add(st.key);
      made++;
    }
    expect(made).toBeGreaterThan(5);
    expect(made).toBeLessThan(40);
  });

  it('has nothing to say about one country, or about none', () => {
    expect(makeStatement(pickOf('ES'), world)).toBeNull();
    expect(makeStatement([], world)).toBeNull();
    expect(makeStatement(europe, world, Math.random, undefined, [])).toBeNull();
  });

  it('explains the answer with the facts', () => {
    const border = many(pickOf('ES', 'PT', 'IT'), 'border', 20);
    const esIt = border.find((s) => s.key === 'border:ES-IT')!;
    expect(esIt.truth).toBe(false);
    expect(esIt.why).toMatch(/limita con .*(Francia|Suiza)/);
    const more = many(pickOf('FR', 'PT'), 'neighbours', 5);
    expect(more.length).toBeGreaterThan(0);
    expect(more[0].why).toBe('Francia limita con 8 (Alemania, Andorra, Bélgica, España, Italia, Luxemburgo, Mónaco y Suiza); Portugal limita con 1 (España).');
    const sea = many(pickOf('KZ', 'ES'), 'landlocked', 5).find((s) => s.ids[0] === 'KZ')!;
    expect(sea.truth).toBe(true);
    expect(sea.why).toContain('mar Caspio');
  });

  it('counts as neighbours the states only: Gibraltar is not one more country for Spain', () => {
    const st = many(pickOf('ES', 'IS'), 'neighbours', 5)[0];
    expect(st.why).toBe('España limita con 4 (Andorra, Francia, Marruecos y Portugal); Islandia no limita con ningún país.');
  });

  it('speaks English when the game does', () => {
    setLang('en');
    const st = many(pickOf('ES', 'PT'), 'border', 1)[0];
    expect(st.text).toMatch(/^(Spain borders Portugal|Portugal borders Spain)\.$/);
    const where = many(pickOf('ES', 'BR'), 'continent', 10);
    const texts = where.map((s) => s.text);
    expect(texts.some((t) => t.endsWith('is in the Americas.'))).toBe(true);
    expect(texts.some((t) => t.endsWith('is in Europe.'))).toBe(true);
  });
});
