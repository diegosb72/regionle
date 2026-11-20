import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLang } from './i18n';
import { ODD_FAMILIES, ODD_KINDS, ODD_MIN, makeOddOne, type OddKind, type OddOne } from './oddone';
import { APART, CASPIAN, TWO_CONTINENTS, type StatementWorld } from './statements';
import { mulberry32 } from './text';
import type { Country, Index } from './types';

const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/data/index.json'), 'utf8')) as Index;
const byId = new Map(index.countries.map((c) => [c.id, c]));
const world: StatementWorld = { byId, continents: index.continents };
const states = index.countries.filter((c) => c.cl === 'un');
const pickOf = (...ids: string[]): Country[] => ids.map((id) => byId.get(id)!);
const europe = states.filter((c) => c.ct === 'EU');
const america = states.filter((c) => c.ct === 'AM');

/** Many questions of some kinds, each asked once. */
function many(list: Country[], kinds: readonly OddKind[], count = 200, seed = 7): OddOne[] {
  const rng = mulberry32(seed);
  const seen = new Set<string>();
  const out: OddOne[] = [];
  for (let i = 0; i < count; i++) {
    const q = makeOddOne(list, world, rng, seen, kinds);
    if (!q) break;
    seen.add(q.key);
    out.push(q);
  }
  return out;
}

const nb = (id: string): string[] => byId.get(id)!.nb ?? [];
const touch = (a: string, b: string): boolean => nb(a).includes(b) || nb(b).includes(a);
const isState = (id: string) => byId.get(id)!.cl !== 'dep' && byId.get(id)!.cl !== 'other';
const three = (q: OddOne): string[] => q.ids.filter((id) => id !== q.odd);
const name = (id: string): string => byId.get(id)!.n.es;

beforeEach(() => setLang('es'));

describe('the odd one out: what is asked is what the data says', () => {
  it('shows four different countries of the list, one of which is the odd one, in no fixed place', () => {
    const list = many(states, ODD_KINDS, 300);
    expect(list.length).toBe(300);
    const chosen = new Set(states.map((c) => c.id));
    const places = new Set<number>();
    for (const q of list) {
      expect(new Set(q.ids).size, q.key).toBe(4);
      expect(q.ids.every((id) => chosen.has(id)), q.key).toBe(true);
      expect(q.ids, q.key).toContain(q.odd);
      places.add(q.ids.indexOf(q.odd));
    }
    expect([...places].sort()).toEqual([0, 1, 2, 3]);
  });

  it('about continents, leaving out the countries that lie on two', () => {
    const list = many(states, ['continent']);
    expect(list.length).toBe(200);
    for (const q of list) {
      const [a, b, c] = three(q).map((id) => byId.get(id)!.ct);
      expect(a === b && b === c, q.key).toBe(true);
      expect(byId.get(q.odd)!.ct, q.key).not.toBe(a);
      expect(q.ids.some((id) => TWO_CONTINENTS.has(id)), q.key).toBe(false);
      expect(q.text).toBe('Tres de estos países están en el mismo continente. ¿Cuál no?');
    }
  });

  it('about the sea, both ways, leaving out the shores of the Caspian', () => {
    const dry = many(states, ['landlocked']);
    const wet = many(states, ['coast']);
    expect(dry.length).toBe(200);
    expect(wet.length).toBe(200);
    for (const q of dry) {
      expect(three(q).every((id) => byId.get(id)!.ll === 1), q.key).toBe(true);
      expect(byId.get(q.odd)!.ll, q.key).toBeUndefined();
    }
    for (const q of wet) {
      expect(three(q).every((id) => !byId.get(id)!.ll), q.key).toBe(true);
      expect(byId.get(q.odd)!.ll, q.key).toBe(1);
    }
    for (const q of [...dry, ...wet]) expect(q.ids.some((id) => CASPIAN.has(id) && byId.get(id)!.ll === 1), q.key).toBe(false);
    expect(dry[0].text).toBe('Tres de estos países no tienen salida al mar. ¿Cuál sí?');
    expect(wet[0].text).toBe('Tres de estos países tienen salida al mar. ¿Cuál no?');
  });

  it('about land borders, both ways: a neighbour is a state, and a country with none has no border at all', () => {
    const alone = many(states, ['island']);
    const joined = many(states, ['mainland']);
    expect(alone.length).toBe(200);
    expect(joined.length).toBe(200);
    for (const q of alone) {
      expect(three(q).every((id) => nb(id).length === 0), q.key).toBe(true);
      expect(nb(q.odd).filter(isState).length, q.key).toBeGreaterThan(0);
      // The odd one is one that could be taken for an island: it has a neighbour or two.
      expect(nb(q.odd).length, q.key).toBeLessThanOrEqual(2);
    }
    for (const q of joined) {
      expect(three(q).every((id) => nb(id).filter(isState).length > 0), q.key).toBe(true);
      expect(nb(q.odd).length, q.key).toBe(0);
    }
  });

  it('about a neighbour in common, with one answer only', () => {
    const list = many(states, ['border'], 300);
    expect(list.length).toBe(300);
    for (const q of list) {
      const trio = three(q);
      // Somebody borders the three and not the fourth…
      const hubs = index.countries.filter((h) => !q.ids.includes(h.id) && trio.every((id) => touch(h.id, id)) && !touch(h.id, q.odd));
      expect(hubs.length, q.key).toBeGreaterThan(0);
      expect(hubs.some((h) => q.why.includes(`limitan con ${h.n.es};`)), q.why).toBe(true);
      // …and nobody borders three of the four that are not those three, or the four of them.
      for (const other of index.countries) {
        const touched = q.ids.filter((id) => id !== other.id && touch(other.id, id));
        if (touched.length >= 3) expect([...touched].sort(), `${q.key} · ${other.id}`).toEqual([...trio].sort());
      }
    }
  });

  it('about size and people, by a clear margin over the country they are measured against', () => {
    const of: Record<string, (c: Country) => number> = { larger: (c) => c.ar, smaller: (c) => c.ar, more: (c) => c.pop!, fewer: (c) => c.pop! };
    for (const kind of ['larger', 'smaller', 'more', 'fewer'] as const) {
      const list = many(states, [kind]);
      expect(list.length, kind).toBe(200);
      const up = kind === 'larger' || kind === 'more';
      for (const q of list) {
        const ref = byId.get(q.key.split(':')[1])!;
        expect(q.ids, q.key).not.toContain(ref.id);
        expect(q.text, q.key).toContain(ref.n.es);
        const v = of[kind](ref);
        const far = (id: string) => of[kind](byId.get(id)!) / v;
        for (const id of three(q)) expect(up ? far(id) : 1 / far(id), q.key).toBeGreaterThanOrEqual(APART);
        expect(up ? 1 / far(q.odd) : far(q.odd), q.key).toBeGreaterThanOrEqual(APART);
      }
    }
  });
});

describe('the odd one out: the game it makes', () => {
  it('never repeats a question while there are others', () => {
    const list = many(europe, ODD_KINDS, 400);
    expect(new Set(list.map((q) => q.key)).size).toBe(list.length);
    expect(list.length).toBe(400);
  });

  it('asks about one thing as often as about another, on a list that spans the world', () => {
    const list = many(states, ODD_KINDS, 600);
    for (const family of ODD_FAMILIES) {
      const n = list.filter((q) => family.includes(q.kind)).length;
      expect(n, family.join()).toBeGreaterThan(60);
      expect(n, family.join()).toBeLessThan(140);
    }
    for (const kind of ODD_KINDS) expect(list.some((q) => q.kind === kind), kind).toBe(true);
  });

  it('asks only what the list can answer', () => {
    // South America and its neighbours by land: one continent, two countries without a coast, no island.
    const south = pickOf('AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'PY', 'PE', 'UY', 'VE');
    const kinds = new Set(many(south, ODD_KINDS, 300).map((q) => q.kind));
    expect(kinds.has('continent')).toBe(false);
    expect(kinds.has('landlocked')).toBe(false);
    expect(kinds.has('island')).toBe(false);
    expect(kinds.has('mainland')).toBe(false);
    expect(kinds.has('coast')).toBe(true);
    expect(kinds.has('border')).toBe(true);
    expect(kinds.has('larger')).toBe(true);
  });

  it('runs out on a small list instead of going round in circles, and has nothing to ask of four countries', () => {
    const five = pickOf('ES', 'PT', 'FR', 'AD', 'MA');
    const list = many(five, ODD_KINDS, 500);
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThan(60);
    expect(ODD_MIN).toBe(5);
    expect(makeOddOne(five.slice(0, 4), world, mulberry32(1))).toBeNull();
    expect(makeOddOne([], world, mulberry32(1))).toBeNull();
    expect(makeOddOne(states, world, mulberry32(1), undefined, [])).toBeNull();
  });

  it('says why, naming the three in the order of the alphabet', () => {
    const border = many(america, ['border'], 40).find((q) => q.why.includes('limitan con Brasil;'))!;
    expect(border).toBeDefined();
    const names = three(border)
      .map(name)
      .sort((a, b) => a.localeCompare(b, 'es'));
    expect(border.why).toBe(`${names[0]}, ${names[1]} ${/^h?[ií][^aeiou]/i.test(names[2]) ? 'e' : 'y'} ${names[2]} limitan con Brasil; ${name(border.odd)} no.`);

    const sea = many(pickOf('BO', 'PY', 'CH', 'AT', 'CL'), ['landlocked'], 1)[0];
    expect(sea.odd).toBe('CL');
    expect(sea.why).toMatch(/^[A-ZÁÉÍÓÚ].+ no tienen costa; Chile sí\.$/);

    const size = many(states, ['larger'], 1)[0];
    expect(size.why).toMatch(/^.+ \(.+ km²\), .+ \(.+ km²\) [ye] .+ \(.+ km²\) son más grandes que .+ \(.+ km²\); .+ \(.+ km²\), no\.$/);
    const people = many(states, ['fewer'], 1)[0];
    expect(people.why).toMatch(/ tienen menos habitantes que .+ \(.+\); .+ \(.+\), no\.$/);

    const continent = many(pickOf('BO', 'PE', 'CL', 'CH'), ['continent'], 1);
    // Four countries are too few for a game, whatever they are.
    expect(continent).toEqual([]);
    const ct = many(pickOf('BO', 'PE', 'CL', 'CH', 'EC'), ['continent'], 1)[0];
    expect(ct.odd).toBe('CH');
    expect(ct.why).toMatch(/ están en América; Suiza, en Europa\.$/);
  });

  it('speaks English when the game does', () => {
    setLang('en');
    const ct = many(pickOf('BO', 'PE', 'CL', 'CH', 'EC'), ['continent'], 1)[0];
    expect(ct.text).toBe('Three of these countries are in the same continent. Which one is not?');
    expect(ct.why).toMatch(/ are in the Americas; Switzerland, in Europe\.$/);
    const sea = many(pickOf('BO', 'PY', 'CH', 'AT', 'CL'), ['landlocked'], 1)[0];
    expect(sea.text).toBe('Three of these countries are landlocked. Which one is not?');
    expect(sea.why).toMatch(/ and .+ have no coast; Chile has one\.$/);
  });
});
