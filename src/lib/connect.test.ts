import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CONNECT_MISSES,
  CONNECT_SPARE,
  CONNECT_TILES,
  GROUPS,
  GROUP_SIZE,
  gameOver,
  gameTally,
  guessFour,
  judgeGuess,
  linksOf,
  makeBoard,
  newGame,
  tellLink,
  waysToShare,
  type ConnBoard,
  type Link,
  type LinkWorld,
} from './connect';
import { EU, G20, SPANISH } from './groups';
import { setLang } from './i18n';
import { mulberry32 } from './text';
import type { Country, Index } from './types';

const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/data/index.json'), 'utf8')) as Index;
const byId = new Map(index.countries.map((c) => [c.id, c]));
const world: LinkWorld = { byId, continents: index.continents, subregions: index.subregions };
const states = index.countries.filter((c) => c.cl === 'un');
/** Everything the section lets in: the states and the territories with people. */
const all = index.countries.filter((c) => c.cl !== 'other' && (c.pop ?? 0) > 0);
const of = (ids: readonly string[]): Country[] => ids.map((id) => byId.get(id)!);
const inContinent = (ct: string): Country[] => states.filter((c) => c.ct === ct);

beforeEach(() => setLang('es'));

const nb = (c: Country): string[] => c.nb ?? [];
const touch = (a: Country, b: Country): boolean => nb(a).includes(b.id) || nb(b).includes(a.id);
const TWO = ['RU', 'TR', 'KZ', 'AZ', 'GE', 'AM', 'CY', 'EG', 'ID'];
const CASPIAN = ['AZ', 'KZ', 'TM'];
const find = (links: readonly Link[], id: string): Link => {
  const link = links.find((l) => l.id === id);
  expect(link, id).toBeTruthy();
  return link!;
};
const ids = (set: ReadonlySet<string>): string[] => [...set].sort();

describe('what the countries chosen can have in common', () => {
  const links = linksOf(states, world);

  it('is where they lie, the sea, what they belong to, how large they are, what they border and a letter', () => {
    expect(new Set(links.map((l) => l.kind))).toEqual(new Set(['place', 'sea', 'org', 'past', 'tongue', 'size', 'nb', 'lone', 'initial']));
    expect(find(links, 'sr:AF-W').title).toBe('África Occidental');
    expect(find(links, 'ct:AM').title).toBe('América');
    expect(find(links, 'landlocked').title).toBe('Sin salida al mar');
    expect(find(links, 'island').title).toBe('Sin fronteras terrestres');
    expect(find(links, 'eu').title).toBe('Unión Europea');
    expect(find(links, 'ussr').title).toBe('Antigua URSS');
    expect(find(links, 'spanish').title).toBe('Con el español como lengua oficial');
    expect(find(links, 'small').title).toBe('Menos de 1000 km²');
    expect(find(links, 'crowd').title).toBe('Más de 100 millones de habitantes');
    expect(find(links, 'nb:BR').title).toBe('Limitan con Brasil');
    expect(find(links, 'lone').title).toBe('Limitan con un solo país');
    expect(find(links, 'initial:M').title).toBe('Empiezan por M');
    // No two with the same name.
    expect(new Set(links.map((l) => l.title)).size).toBe(links.length);
    expect(new Set(links.map((l) => l.id)).size).toBe(links.length);
  });

  it('holds what the data says, and nothing of which either could be argued', () => {
    // A part of the world: its countries, but for the ones that lie on two continents, which are in none.
    expect(ids(find(links, 'sr:AF-W').members)).toEqual(states.filter((c) => c.sr === 'AF-W').map((c) => c.id).sort());
    expect(ids(find(links, 'ct:AS').members)).toEqual(states.filter((c) => c.ct === 'AS' && !TWO.includes(c.id)).map((c) => c.id).sort());
    for (const link of links.filter((l) => l.kind === 'place')) {
      expect(ids(link.doubt), link.id).toEqual([...TWO].sort());
      for (const id of TWO) expect(link.members.has(id), `${link.id} ${id}`).toBe(false);
    }
    // The sea: the shores of the Caspian are on neither side.
    expect(ids(find(links, 'landlocked').members)).toEqual(states.filter((c) => c.ll && !CASPIAN.includes(c.id)).map((c) => c.id).sort());
    expect(ids(find(links, 'landlocked').doubt)).toEqual([...CASPIAN].sort());
    expect(ids(find(links, 'island').members)).toEqual(states.filter((c) => nb(c).length === 0).map((c) => c.id).sort());
    // What borders a country: not the country itself, nor the ones that only touch a territory of it.
    const brazil = find(links, 'nb:BR');
    expect(ids(brazil.members)).toEqual(states.filter((c) => c.id !== 'BR' && touch(c, byId.get('BR')!)).map((c) => c.id).sort());
    expect(brazil.members.size).toBe(9);
    expect(ids(brazil.doubt)).toEqual(['BR', 'FR']);
    const france = find(links, 'nb:FR');
    expect(france.members.has('ES')).toBe(true);
    expect(france.members.has('BR')).toBe(false);
    expect(ids(france.doubt)).toEqual(['BR', 'FR', 'SR']);
    // Spain and the United Kingdom, by Gibraltar.
    expect(find(links, 'nb:ES').doubt.has('GB')).toBe(true);
    // One neighbour and no more.
    const lone = find(links, 'lone');
    for (const id of ['PT', 'DK', 'IE', 'KR', 'CA', 'HT', 'DO', 'GM', 'LS', 'QA']) expect(lone.members.has(id), id).toBe(true);
    for (const id of ['ES', 'FR', 'JP', 'US']) expect(lone.members.has(id), id).toBe(false);
    for (const id of lone.members) expect(nb(byId.get(id)!), id).toHaveLength(1);
  });

  it('tells a size by a figure, and leaves out what is within a quarter of it', () => {
    const crowd = find(links, 'crowd');
    for (const id of crowd.members) expect(byId.get(id)!.pop!, id).toBeGreaterThanOrEqual(125_000_000);
    for (const id of ['CN', 'IN', 'US', 'ID', 'BR', 'NG']) expect(crowd.members.has(id), id).toBe(true);
    // Japan, Egypt, Vietnam: a hundred million, give or take.
    for (const id of ['JP', 'EG', 'VN']) expect(crowd.doubt.has(id), id).toBe(true);
    expect(crowd.members.has('ES')).toBe(false);
    expect(crowd.doubt.has('ES')).toBe(false);
    const small = find(links, 'small');
    for (const id of small.members) expect(byId.get(id)!.ar, id).toBeLessThanOrEqual(800);
    for (const id of ['MC', 'SM', 'LI', 'MT', 'AD', 'TV']) expect(small.members.has(id), id).toBe(true);
    // Kiribati (811 km²) and São Tomé and Príncipe (1001).
    expect(ids(small.doubt)).toEqual(['KI', 'ST']);
    const large = find(links, 'large');
    for (const id of large.members) expect(byId.get(id)!.ar, id).toBeGreaterThanOrEqual(1_250_000);
    expect(large.doubt.has('AO')).toBe(true);
    const few = find(links, 'few');
    for (const id of few.members) expect(byId.get(id)!.pop!, id).toBeLessThanOrEqual(800_000);
  });

  it('leaves out of a list the ones that are in it by half: a guest, the users of the euro, the open borders', () => {
    expect(find(links, 'g20').doubt.has('ES')).toBe(true);
    expect(find(links, 'g20').members.has('ES')).toBe(false);
    expect(ids(find(links, 'euro').doubt)).toEqual(['AD', 'MC', 'ME', 'SM']);
    expect(ids(find(links, 'schengen').doubt)).toEqual(['MC', 'SM']);
    expect(find(links, 'brics').doubt.has('SA')).toBe(true);
    // With the territories and the states with no seat among the countries, the others that use the euro too.
    const wide = linksOf(all, world);
    expect(ids(find(wide, 'euro').doubt)).toEqual(['AD', 'MC', 'ME', 'SM', 'VA', 'XK']);
    expect(find(wide, 'portuguese').doubt.has('MO')).toBe(true);
    expect(find(wide, 'mediterranean').doubt.has('GI')).toBe(true);
  });

  it('is shared by four or more of the countries chosen, and not by nearly all of them', () => {
    for (const list of [states, all, inContinent('EU'), inContinent('AF'), of(EU)]) {
      for (const link of linksOf(list, world)) {
        expect(link.members.size, link.id).toBeGreaterThanOrEqual(GROUP_SIZE);
        expect(link.members.size, link.id).toBeLessThanOrEqual(Math.floor((list.length * 2) / 3));
        for (const id of link.members) expect(link.doubt.has(id), `${link.id} ${id}`).toBe(false);
      }
    }
    // On a map of Europe, "Europe" says nothing; the Union still does.
    const europe = linksOf(inContinent('EU'), world);
    expect(europe.some((l) => l.id === 'ct:EU')).toBe(false);
    expect(find(europe, 'eu').members.size).toBe(27);
    expect(europe.some((l) => l.id === 'sr:EU-N')).toBe(true);
    // Among the members of the Union, the Union is everybody.
    expect(linksOf(of(EU), world).some((l) => l.id === 'eu')).toBe(false);
  });

  it('follows the language of the game: the letters are those of the names', () => {
    expect(find(links, 'initial:A').members.has('DE')).toBe(true);
    expect(find(links, 'initial:E').members.has('ES')).toBe(true);
    setLang('en');
    const english = linksOf(states, world);
    expect(find(english, 'initial:G').members.has('DE')).toBe(true);
    expect(find(english, 'initial:S').members.has('ES')).toBe(true);
    expect(find(english, 'initial:G').title).toBe('They begin with G');
    expect(find(english, 'sr:AF-W').title).toBe('Western Africa');
    expect(find(english, 'landlocked').title).toBe('Landlocked');
    expect(find(english, 'nb:BR').title).toBe('They border Brazil');
    expect(find(english, 'crowd').title).toBe('More than 100 million people');
    expect(find(english, 'lone').title).toBe('They border one country only');
  });
});

/** Every way of sharing some countries out among some links, four to each: counted here, not by the game. */
function shares(board: ConnBoard): string[] {
  const all = board.groups.flatMap((g) => g.ids);
  const links = board.groups.map((g) => g.link);
  const out: string[] = [];
  const room = links.map(() => GROUP_SIZE);
  const at: number[] = [];
  const go = (i: number): void => {
    if (i === all.length) {
      out.push(at.join(''));
      return;
    }
    for (let k = 0; k < links.length; k++) {
      if (!room[k] || !links[k].members.has(all[i])) continue;
      room[k]--;
      at.push(k);
      go(i + 1);
      at.pop();
      room[k]++;
    }
  };
  go(0);
  return out;
}

const SELECTIONS: [string, Country[], number][] = [
  ['the states of the world', states, 40],
  ['the states and the territories', all, 25],
  ['Europe', inContinent('EU'), 60],
  ['Africa', inContinent('AF'), 60],
  ['Asia', inContinent('AS'), 60],
  ['the Americas', inContinent('AM'), 60],
  ['the European Union', of(EU), 60],
];

describe('a board', () => {
  for (const [name, list, seeds] of SELECTIONS) {
    it(`is sixteen countries that go four by four in one way only: ${name}`, () => {
      const chosen = new Set(list.map((c) => c.id));
      const kinds = new Set<string>();
      const titles = new Set<string>();
      for (let seed = 1; seed <= seeds; seed++) {
        const board = makeBoard(list, world, mulberry32(seed));
        expect(board, `${name}, seed ${seed}`).toBeTruthy();
        const { groups, tiles } = board!;
        const where = `${name}, seed ${seed}: ${groups.map((g) => `${g.link.title} (${g.ids.join(' ')})`).join('; ')}`;
        expect(groups, where).toHaveLength(GROUPS);
        const on = groups.flatMap((g) => g.ids);
        expect(new Set(on).size, where).toBe(CONNECT_TILES);
        expect([...tiles].sort(), where).toEqual([...on].sort());
        expect(new Set(groups.map((g) => g.link.id)).size, where).toBe(GROUPS);
        for (const g of groups) {
          expect(g.ids, where).toHaveLength(GROUP_SIZE);
          kinds.add(g.link.kind);
          titles.add(g.link.title);
          for (const id of g.ids) {
            expect(chosen.has(id), where).toBe(true);
            expect(g.link.members.has(id), `${id} in ${g.link.title} — ${where}`).toBe(true);
          }
          // No kind three times: a board is not four lists of neighbours.
          expect(groups.filter((o) => o.link.kind === g.link.kind).length, where).toBeLessThanOrEqual(2);
        }
        // Nobody of whom one of the four could be argued either way.
        for (const id of on) for (const g of groups) expect(g.link.doubt.has(id), `${id} and ${g.link.title} — ${where}`).toBe(false);
        // One answer, and it is the one the board says.
        const ways = shares(board!);
        expect(ways, where).toEqual([groups.flatMap((_, k) => Array.from({ length: GROUP_SIZE }, () => k)).join('')]);
        expect(waysToShare(on, groups.map((g) => g.link)), where).toBe(1);
        // A few countries that would fit another group too, and no more.
        const spare = on.reduce((n, id) => n + groups.filter((g) => g.link.members.has(id)).length - 1, 0);
        expect(spare, where).toBeLessThanOrEqual(CONNECT_SPARE);
        // What a wrong guess is read against comes with the board.
        expect(board!.links.length, where).toBeGreaterThanOrEqual(GROUPS);
        for (const g of groups) expect(board!.links, where).toContain(g.link);
      }
      // Not the same board over and over.
      expect(kinds.size, name).toBeGreaterThanOrEqual(4);
      expect(titles.size, name).toBeGreaterThanOrEqual(name === 'the European Union' ? 8 : 12);
    });
  }

  it('says what the data says: a part of the world, a coast, a border', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const board = makeBoard(states, world, mulberry32(seed))!;
      for (const g of board.groups) {
        for (const c of of(g.ids)) {
          const [what, code] = g.link.id.split(':');
          if (what === 'sr') expect(c.sr, `${c.id} ${g.link.title}`).toBe(code);
          if (what === 'ct') expect(c.ct, `${c.id} ${g.link.title}`).toBe(code);
          if (what === 'nb') expect(touch(c, byId.get(code)!), `${c.id} ${g.link.title}`).toBe(true);
          if (what === 'landlocked') expect(c.ll, `${c.id} ${g.link.title}`).toBe(1);
          if (what === 'island') expect(nb(c), `${c.id} ${g.link.title}`).toHaveLength(0);
          if (what === 'lone') expect(nb(c), `${c.id} ${g.link.title}`).toHaveLength(1);
          if (what === 'eu') expect(EU, `${c.id} ${g.link.title}`).toContain(c.id);
        }
        // The country the others border is not one of the sixteen, nor one on two continents where a part of the world is a group.
        if (g.link.kind === 'nb') expect(board.tiles).not.toContain(g.link.id.slice(3));
        if (g.link.kind === 'place') for (const id of TWO) expect(board.tiles, g.link.title).not.toContain(id);
      }
    }
  });

  it('is the same for the same draw, and another for another', () => {
    const a = makeBoard(states, world, mulberry32(7))!;
    const b = makeBoard(states, world, mulberry32(7))!;
    expect(a.tiles).toEqual(b.tiles);
    expect(a.groups.map((g) => g.link.id)).toEqual(b.groups.map((g) => g.link.id));
    const c = makeBoard(states, world, mulberry32(8))!;
    expect(c.tiles).not.toEqual(a.tiles);
  });

  it('is in the language of the game', () => {
    setLang('en');
    const board = makeBoard(states, world, mulberry32(4))!;
    setLang('es');
    const same = makeBoard(states, world, mulberry32(4))!;
    // (The letters differ from one language to the other, and so may the draw: only the titles are looked at.)
    for (const g of board.groups) expect(g.link.title).not.toMatch(/Limitan|Empiezan|Sin |Con |Menos|Más|Antigua/);
    expect(same.groups.some((g) => /[áéíóúñ]|Limitan|Empiezan|Sin |Con |Menos|Antigua|G20|BRICS|OTAN|Europa|Asia|Caribe|Melanesia|Micronesia/.test(g.link.title))).toBe(true);
  });

  it('is not there for fewer than sixteen countries, nor for countries too much alike', () => {
    expect(makeBoard(states.slice(0, 15), world, mulberry32(1))).toBeNull();
    // Oceania has fourteen states.
    expect(makeBoard(inContinent('OC'), world, mulberry32(1))).toBeNull();
    // The G20: nineteen countries that are all large, all crowded and all members of something.
    for (let seed = 1; seed <= 5; seed++) expect(makeBoard(of(G20), world, mulberry32(seed))).toBeNull();
  });

  it('takes more countries that fit two groups where the countries chosen are few and much alike, and still has one answer', () => {
    // Spanish is spoken in twenty-one countries, nearly all of them in two parts of the Americas.
    let made = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const board = makeBoard(of(SPANISH), world, mulberry32(seed));
      if (!board) continue;
      made++;
      expect(shares(board), `seed ${seed}`).toHaveLength(1);
      const on = board.groups.flatMap((g) => g.ids);
      const spare = on.reduce((n, id) => n + board.groups.filter((g) => g.link.members.has(id)).length - 1, 0);
      expect(spare).toBeGreaterThan(CONNECT_SPARE);
      expect(spare).toBeLessThanOrEqual(6);
    }
    expect(made).toBeGreaterThanOrEqual(28);
  });
});

describe('sixteen countries chosen to go one way', () => {
  // The boards the game is played on in the browser tests (e2e/conexiones.spec.ts): four of each of four
  // parts of the world, and nothing else that four of them share and the rest could be grouped around.
  const BY_REGION = 'ML SN GH BJ BO CL UY EC MD UA PL RO LA VN TH MY'.split(' ');
  const LONG = 'CF CD GQ ST VC KN AG TT TM KG UZ TJ BA MK LI LU'.split(' ');
  const byContinent = (list: readonly string[]): string[] => {
    const groups = new Map<string, string[]>();
    for (const id of list) groups.set(byId.get(id)!.ct, [...(groups.get(byId.get(id)!.ct) ?? []), id]);
    return [...groups.values()].map((g) => g.sort().join(' ')).sort();
  };
  const TITLES: Record<string, string[]> = {
    'BJ GH ML SN': ['África Occidental', 'África'],
    'BO CL EC UY': ['América del Sur', 'América', 'Con el español como lengua oficial'],
    'MD PL RO UA': ['Europa del Este', 'Europa'],
    'LA MY TH VN': ['Sudeste Asiático', 'Asia'],
    'CD CF GQ ST': ['África Central', 'África'],
    'AG KN TT VC': ['Caribe', 'América', 'Sin fronteras terrestres'],
    'KG TJ TM UZ': ['Asia Central', 'Asia', 'Antigua URSS'],
    'BA LI LU MK': ['Europa'],
  };

  for (const [name, list] of [
    ['by their part of the world', BY_REGION],
    ['with the longest names', LONG],
  ] as const) {
    it(`always give a board, and always the same four groups: ${name}`, () => {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 80; seed++) {
        const board = makeBoard(of(list), world, mulberry32(seed));
        expect(board, `seed ${seed}`).toBeTruthy();
        expect(board!.groups.map((g) => [...g.ids].sort().join(' ')).sort(), `seed ${seed}`).toEqual(byContinent(list));
        for (const g of board!.groups) {
          const key = [...g.ids].sort().join(' ');
          expect(TITLES[key], `${key}: ${g.link.title}`).toContain(g.link.title);
          seen.add(g.link.title);
        }
      }
      // What a group is called is not always the same: a part of the world, its continent, something else they share.
      expect(seen.size).toBeGreaterThan(4);
      // In English too: the letters change, and none of these groups is one of letters.
      setLang('en');
      for (let seed = 1; seed <= 20; seed++) expect(makeBoard(of(list), world, mulberry32(seed))!.groups.map((g) => [...g.ids].sort().join(' ')).sort()).toEqual(byContinent(list));
    });
  }

  it('hold four countries with no coast, one from each group, which are no group', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const board = makeBoard(of(BY_REGION), world, mulberry32(seed))!;
      expect(judgeGuess(board, ['ML', 'BO', 'MD', 'LA'])).toEqual({ res: 'other', title: 'Sin salida al mar' });
      expect(judgeGuess(board, ['ML', 'SN', 'GH', 'BO'])).toEqual({ res: 'near' });
      expect(judgeGuess(board, ['ML', 'SN', 'BO', 'CL'])).toEqual({ res: 'no' });
    }
  });

  it('are the same board time and again where the countries are few: the twenty the section starts with', () => {
    const twenty = of('AR AU BR CA CN DE ES FR GB ID IN IT JP KR MX RU SA TR US ZA'.split(' '));
    const boards = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const board = makeBoard(twenty, world, mulberry32(seed));
      expect(board, `seed ${seed}`).toBeTruthy();
      boards.add(board!.groups.map((g) => [...g.ids].sort().join(' ')).sort().join('|'));
    }
    // Four of them begin with A in Spanish, and that is the only way the rest fall into three continents.
    expect([...boards]).toEqual(['AR AU DE SA|BR CA MX US|CN IN JP KR|ES FR GB IT']);
    // In English there are two, and no board at all.
    setLang('en');
    for (let seed = 1; seed <= 5; seed++) expect(makeBoard(twenty, world, mulberry32(seed))).toBeNull();
  });
});

/** A link made by hand, for the boards made by hand. */
const link = (id: string, members: string[], kind: Link['kind'] = 'place'): Link => ({ id, kind, title: id.toUpperCase(), members: new Set(members), doubt: new Set() });
/** Four groups of letters: a–d, e–h, i–l, m–p. */
function handBoard(extra: Link[] = [], spare: Record<string, string[]> = {}): ConnBoard {
  const letters = 'abcdefghijklmnop'.split('');
  const groups = [0, 1, 2, 3].map((k) => {
    const own = letters.slice(k * 4, k * 4 + 4);
    return { link: link(`g${k}`, [...own, ...(spare[`g${k}`] ?? [])]), ids: own };
  });
  return { groups, tiles: letters, links: [...groups.map((g) => g.link), ...extra] };
}

describe('the ways of sharing countries out', () => {
  it('are counted up to where it is told to stop', () => {
    const board = handBoard();
    const on = board.groups.flatMap((g) => g.ids);
    const links = board.groups.map((g) => g.link);
    expect(waysToShare(on, links)).toBe(1);
    // One that fits two groups changes nothing: the other group is full.
    expect(waysToShare(on, handBoard([], { g0: ['e'] }).groups.map((g) => g.link))).toBe(1);
    // Two that could swap places: two answers.
    expect(waysToShare(on, handBoard([], { g0: ['e'], g1: ['a'] }).groups.map((g) => g.link))).toBe(2);
    // Three in a ring: more than two, and the count stops at two unless told otherwise.
    const ring = handBoard([], { g0: ['e', 'i'], g1: ['a', 'j'], g2: ['b', 'f'] }).groups.map((g) => g.link);
    expect(waysToShare(on, ring)).toBe(2);
    expect(waysToShare(on, ring, 100)).toBeGreaterThan(2);
    // A country that fits nowhere: no way at all.
    expect(waysToShare([...on.slice(0, 15), 'z'], links)).toBe(0);
  });
});

describe('a guess of four', () => {
  it('is a group, or three of one, or nothing', () => {
    const board = handBoard();
    expect(judgeGuess(board, ['a', 'b', 'c', 'd'])).toEqual({ res: 'group', index: 0 });
    expect(judgeGuess(board, ['p', 'm', 'o', 'n'])).toEqual({ res: 'group', index: 3 });
    expect(judgeGuess(board, ['a', 'b', 'c', 'e'])).toEqual({ res: 'near' });
    expect(judgeGuess(board, ['a', 'b', 'e', 'f'])).toEqual({ res: 'no' });
    expect(judgeGuess(board, ['a', 'e', 'i', 'm'])).toEqual({ res: 'no' });
  });

  it('is told when the four share something that is none of the groups, by what says the most', () => {
    const wide = link('wide', ['a', 'e', 'i', 'm', 'b', 'f']);
    const narrow = link('narrow', ['a', 'e', 'i', 'm']);
    const board = handBoard([wide, narrow]);
    expect(judgeGuess(board, ['a', 'e', 'i', 'm'])).toEqual({ res: 'other', title: 'NARROW' });
    expect(judgeGuess(board, ['a', 'e', 'b', 'f'])).toEqual({ res: 'other', title: 'WIDE' });
    // Three of a group and one more that share something else: it is that which is said.
    const three = handBoard([link('x', ['a', 'b', 'c', 'e'])]);
    expect(judgeGuess(three, ['a', 'b', 'c', 'e'])).toEqual({ res: 'other', title: 'X' });
    // What the four share is one of the groups, and they are not the group: nothing is given away.
    const spare = handBoard([], { g0: ['e'] });
    expect(judgeGuess(spare, ['a', 'b', 'c', 'e'])).toEqual({ res: 'near' });
    expect(judgeGuess(spare, ['a', 'b', 'c', 'd'])).toEqual({ res: 'group', index: 0 });
  });

  it('is read against everything the countries chosen can share, on a board of the game', () => {
    // Four countries of a board that share something which is none of its groups: there are many, board after board.
    let found = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const board = makeBoard(states, world, mulberry32(seed))!;
      const theirs = new Set(board.groups.map((g) => g.link.id));
      for (const other of board.links) {
        if (theirs.has(other.id)) continue;
        const four = board.tiles.filter((id) => other.members.has(id)).slice(0, GROUP_SIZE);
        if (four.length < GROUP_SIZE || board.groups.some((g) => g.ids.every((id) => four.includes(id)))) continue;
        found++;
        const said = judgeGuess(board, four);
        expect(said.res, `${other.title}: ${four.join(' ')}`).toBe('other');
        // It is said by what fewest countries share: that, or something that says as much.
        const fewest = Math.min(...board.links.filter((l) => !theirs.has(l.id) && four.every((id) => l.members.has(id))).map((l) => l.members.size));
        const told = board.links.find((l) => l.title === (said as { title: string }).title)!;
        expect(told.members.size, `${other.title}: ${four.join(' ')}`).toBe(fewest);
        expect(four.every((id) => told.members.has(id))).toBe(true);
        expect(theirs.has(told.id)).toBe(false);
      }
    }
    expect(found).toBeGreaterThan(20);
  });
});

describe('a game', () => {
  it('finds the groups one by one, and takes their countries off the table', () => {
    let game = newGame(handBoard());
    expect(game.tiles).toHaveLength(16);
    expect(gameOver(game)).toBe(false);
    let said;
    ({ game, said } = guessFour(game, ['e', 'f', 'g', 'h']));
    expect(said).toEqual({ res: 'group', index: 1 });
    expect(game.found).toEqual([1]);
    expect(game.tiles.join('')).toBe('abcdijklmnop');
    expect(game.res).toEqual({ 1: 'ok' });
    // What is off the table cannot be guessed again.
    expect(guessFour(game, ['e', 'f', 'g', 'h']).game).toBe(game);
    for (const four of ['abcd', 'ijkl', 'mnop']) ({ game, said } = guessFour(game, four.split('')));
    expect(game.found).toEqual([1, 0, 2, 3]);
    expect(game.tiles).toEqual([]);
    expect(gameOver(game)).toBe(true);
    expect(gameTally(game)).toEqual({ ok: 4, warn: 0, bad: 0 });
  });

  it('counts a wrong guess once, and the group that comes after it is not found first time', () => {
    let game = newGame(handBoard());
    let said;
    ({ game, said } = guessFour(game, ['a', 'b', 'c', 'e']));
    expect(said).toEqual({ res: 'near' });
    expect(game.misses).toBe(1);
    // The same four again, in another order: said, and not counted.
    ({ game, said } = guessFour(game, ['e', 'c', 'b', 'a']));
    expect(said).toEqual({ res: 'again' });
    expect(game.misses).toBe(1);
    ({ game, said } = guessFour(game, ['a', 'e', 'i', 'm']));
    expect(said).toEqual({ res: 'no' });
    expect(game.misses).toBe(2);
    ({ game } = guessFour(game, ['a', 'b', 'c', 'd']));
    expect(game.res).toEqual({ 0: 'warn' });
    // The next one starts clean.
    ({ game } = guessFour(game, ['e', 'f', 'g', 'h']));
    expect(game.res).toEqual({ 0: 'warn', 1: 'ok' });
    expect(game.misses).toBe(2);
    expect(gameTally(game)).toEqual({ ok: 1, warn: 1, bad: 0 });
  });

  it('does not count as a miss four that share something else', () => {
    let game = newGame(handBoard([link('x', ['a', 'e', 'i', 'm'])]));
    let said;
    ({ game, said } = guessFour(game, ['a', 'e', 'i', 'm']));
    expect(said).toEqual({ res: 'other', title: 'X' });
    expect(game.misses).toBe(0);
    ({ game } = guessFour(game, ['a', 'b', 'c', 'd']));
    expect(game.res).toEqual({ 0: 'ok' });
  });

  it('ends at the fourth wrong guess, and the groups left are misses', () => {
    let game = newGame(handBoard());
    ({ game } = guessFour(game, ['a', 'b', 'c', 'd']));
    for (const four of ['efgi', 'efgj', 'efgk']) ({ game } = guessFour(game, four.split('')));
    expect(game.misses).toBe(3);
    expect(gameOver(game)).toBe(false);
    ({ game } = guessFour(game, ['e', 'f', 'g', 'l']));
    expect(game.misses).toBe(CONNECT_MISSES);
    expect(gameOver(game)).toBe(true);
    expect(gameTally(game)).toEqual({ ok: 1, warn: 0, bad: 3 });
    // Nothing more is taken.
    expect(guessFour(game, ['e', 'f', 'g', 'h']).game).toBe(game);
    expect(tellLink(game).index).toBe(-1);
  });

  it('leaves out of the count the groups that were left when the player ended it', () => {
    let game = newGame(handBoard());
    ({ game } = guessFour(game, ['a', 'b', 'c', 'e']));
    ({ game } = guessFour(game, ['a', 'b', 'c', 'd']));
    expect(gameTally(game)).toEqual({ ok: 0, warn: 1, bad: 0 });
  });

  it('tells what a group has in common for the asking, and that group is not found first time', () => {
    let game = newGame(handBoard());
    let index;
    ({ game, index } = tellLink(game));
    expect(index).toBe(0);
    expect(game.told).toEqual([0]);
    expect(game.misses).toBe(0);
    // Another group, found without being told, is first time all the same.
    ({ game } = guessFour(game, ['e', 'f', 'g', 'h']));
    expect(game.res).toEqual({ 1: 'ok' });
    ({ game } = guessFour(game, ['a', 'b', 'c', 'd']));
    expect(game.res).toEqual({ 1: 'ok', 0: 'warn' });
    // The next one to be told is the first that is neither found nor told.
    ({ game, index } = tellLink(game));
    expect(index).toBe(2);
    ({ game, index } = tellLink(game));
    expect(index).toBe(3);
    ({ game, index } = tellLink(game));
    expect(index).toBe(-1);
    expect(game.told).toEqual([0, 2, 3]);
  });

  it('takes four countries of the table, no more and no fewer', () => {
    const game = newGame(handBoard());
    expect(guessFour(game, ['a', 'b', 'c']).game).toBe(game);
    expect(guessFour(game, ['a', 'b', 'c', 'd', 'e']).game).toBe(game);
    expect(guessFour(game, ['a', 'b', 'c', 'z']).game).toBe(game);
  });
});
