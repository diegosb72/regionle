/**
 * Which flags look alike: how scripts/data/flags-alike.mjs tells (on flags painted here), what it has
 * written (public/data/alike) against the flags the site is built with, and what the games make of it
 * (lib/flagAlike.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error a script of the build, written without types
import { DRAWN, FAR, GRID, KEEP, KEEP_COUNTRIES, LEVEL_MIN, alikeIn, apartLooks, groupsOf, lightOf, lookOf, sameLook, strayOf } from '../../scripts/data/flags-alike.mjs';
import { ALIKE_CLOSE, ALIKE_OTHERS, closeness, groupAt, nearCards, picOf, rivalsOf, type AlikeFile, type AlikeGroup, type AlikeKind, type Near } from './flagAlike';
import { FLAG_SET_MIN, alikePlace, deckOf, flagSetText, sameMap, setMenu, twins, type DeckCard, type FlagSet, type SameFile } from './flagSets';
import type { FlagsFile } from './flags';
import { SAME_FLAG } from './pairs';
import type { Index } from './types';

const json = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(process.cwd(), file), 'utf8')) as T;
const FLAGS = json<FlagsFile>('public/data/flags.json');
const INDEX = json<Index>('public/data/index.json');
const KINDS: readonly AlikeKind[] = ['countries', 'regions', 'cities', 'others'];
const ALIKE = Object.fromEntries(KINDS.map((kind) => [kind, json<AlikeFile>(`public/data/alike/${kind}.json`)])) as Record<AlikeKind, AlikeFile>;
const SAME_FILE = json<SameFile>('public/data/alike/same.json');
const SAME = sameMap(SAME_FILE);
const deck = (set: FlagSet) => deckOf(set, INDEX, FLAGS, SAME);
const nearOf = (set: FlagSet) => {
  const place = alikePlace(set);
  return nearCards(groupAt(ALIKE[place.file], place), deck(set));
};

type Look = { px: Float32Array; pal: Float32Array };
type Rgb = [number, number, number];
type Apart = { drawn: number; peak: number; flipped: number; palette: number; score: number };
const look = lookOf as (data: Uint8Array) => Look;
const apart = apartLooks as (a: Look, b: Look) => Apart;
const same = sameLook as (a: Look, b: Look) => boolean;
const among = alikeIn as (pics: string[], looks: Map<string, Look>, keep?: number) => AlikeGroup;
const groups = groupsOf as (index: unknown, flags: unknown) => Record<AlikeKind, Record<string, string[]>>;
const { w: W, h: H } = DRAWN as { w: number; h: number };

/** A flag painted dot by dot: what each dot is, by where it is (0 to 1 across and down). */
function paint(colour: (x: number, y: number) => Rgb): Look {
  const data = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) data.set(colour(x / W, y / H), (y * W + x) * 3);
  return look(data);
}
const upright = (...bands: Rgb[]) => paint((x) => bands[Math.min(bands.length - 1, Math.floor(x * bands.length))]);
const flat = (...bands: Rgb[]) => paint((_, y) => bands[Math.min(bands.length - 1, Math.floor(y * bands.length))]);
const disc = (field: Rgb, on: Rgb) => paint((x, y) => (Math.hypot(((x - 0.5) * 4) / 3, y - 0.5) < 0.3 ? on : field));

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const IRELAND = upright([22, 155, 98], WHITE, [255, 136, 62]);
const IVORY_COAST = upright([255, 136, 62], WHITE, [22, 155, 98]);
const ITALY = upright([0, 146, 70], WHITE, [206, 43, 55]);
const NETHERLANDS = flat([174, 28, 40], WHITE, [33, 70, 139]);
const LUXEMBOURG = flat([237, 41, 57], WHITE, [0, 161, 222]);
const RUSSIA = flat(WHITE, [0, 57, 166], [213, 43, 30]);
const JAPAN = disc(WHITE, [188, 0, 45]);

describe('how two flags are compared (scripts/data/flags-alike.mjs)', () => {
  it('sees a flag as a grid of colours and as how much of it is of each colour with a name', () => {
    const red = flat([206, 17, 38]);
    expect(red.px).toHaveLength(GRID.w * GRID.h * 3);
    // One colour all over: every cell the same, and all of it of one named colour.
    for (let i = 3; i < red.px.length; i++) expect(red.px[i]).toBeCloseTo(red.px[i % 3], 3);
    expect([...red.pal].filter((share) => share > 0.999)).toHaveLength(1);
    // Three bands: a third of each of three colours.
    const shares = [...IRELAND.pal].filter((share) => share > 0.01);
    expect(shares).toHaveLength(3);
    for (const share of shares) expect(share).toBeCloseTo(1 / 3, 1);
    expect([...IRELAND.pal].reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 5);
  });

  it('finds a flag the same as itself, and two that differ in a shade alike without being the same', () => {
    expect(apart(IRELAND, IRELAND)).toEqual({ drawn: 0, peak: 0, flipped: 0, palette: 0, score: 0 });
    expect(same(IRELAND, IRELAND)).toBe(true);
    // The same flag drawn by another hand, a touch lighter: one picture.
    expect(same(flat([206, 17, 38], WHITE), flat([208, 20, 40], WHITE))).toBe(true);
    // Italy beside Ireland: a band of another colour. Alike, and two flags.
    const italy = apart(IRELAND, ITALY);
    expect(italy.score).toBeGreaterThan(10);
    expect(italy.score).toBeLessThan(25);
    expect(same(IRELAND, ITALY)).toBe(false);
    // A disc on white is not white, however much of it is: one cell is enough to tell.
    expect(apart(JAPAN, flat(WHITE)).peak).toBeGreaterThan(50);
    expect(same(JAPAN, flat(WHITE))).toBe(false);
  });

  it('finds alike two flags that are each other in a mirror, and two made of the same colours in another order', () => {
    const mirror = apart(IRELAND, IVORY_COAST);
    // As they are drawn they have nothing in common but the white…
    expect(mirror.drawn).toBeGreaterThan(50);
    // …and they are the pair that is mixed up most.
    expect(mirror.flipped).toBeLessThan(5);
    expect(mirror.score).toBeLessThan(10);
    expect(mirror.score).toBeLessThan(apart(IRELAND, ITALY).score);
    expect(same(IRELAND, IVORY_COAST)).toBe(false);

    const order = apart(NETHERLANDS, RUSSIA);
    expect(order.drawn).toBeGreaterThan(80);
    expect(order.palette).toBeLessThan(0.05);
    expect(order.score).toBeLessThan(FAR);
    expect(order.score).toBeLessThan(order.drawn / 2);
    // The same bands in a lighter blue are nearer than the same colours shuffled.
    expect(apart(NETHERLANDS, LUXEMBOURG).score).toBeLessThan(order.score);
    // Nothing in common: further than what is kept as a neighbour.
    expect(apart(flat(BLACK), flat(WHITE)).score).toBeGreaterThan(FAR);
    expect(apart(IRELAND, JAPAN).score).toBeGreaterThan(FAR);
  });

  it('gives each flag of a group its nearest ones, and sets apart those that are the same picture', () => {
    const looks = new Map<string, Look>([
      ['ie', IRELAND],
      ['ci', IVORY_COAST],
      ['ie-again', IRELAND],
      ['it', ITALY],
      ['nl', NETHERLANDS],
      ['black', flat(BLACK)],
    ]);
    const pics = [...looks.keys()];
    const group = among(pics, looks, 2);
    expect(group.pics).toEqual(pics);
    // The second Ireland is the first: it stands behind it, and has no neighbours of its own.
    expect(group.same).toEqual([[0, 2]]);
    expect(group.near[2]).toEqual([]);
    // Pairs of place and score, the nearest first, no more than asked for, never itself nor what stands behind another.
    expect(group.near[0].filter((_, i) => i % 2 === 0)).toEqual([1, 3]);
    expect(group.near[1].filter((_, i) => i % 2 === 0)).toEqual([0, 3]);
    expect(group.near[0][1]).toBeLessThan(group.near[0][3]);
    for (const list of group.near) {
      expect(list.length).toBeLessThanOrEqual(4);
      for (let i = 1; i < list.length; i += 2) expect(Number.isInteger(list[i])).toBe(true);
    }
    // Black is like nothing here.
    expect(group.near[5]).toEqual([]);
    for (const list of group.near) expect(list.filter((_, i) => i % 2 === 0)).not.toContain(5);
    // With more kept, more come: the order does not change.
    expect(among(pics, looks, 4).near[0].slice(0, 4)).toEqual(group.near[0]);
    expect(among(pics, looks).near[0].length).toBeLessThanOrEqual(2 * KEEP);
  });

  it('compares the flags in the sets they are played in', () => {
    const index = {
      continents: { EU: {}, AS: {}, AN: {} },
      countries: [
        { id: 'ES', fl: 'es', cl: 'un', ct: 'EU' },
        { id: 'FR', fl: 'fr', cl: 'un', ct: 'EU' },
        { id: 'VA', fl: 'va', cl: 'obs', ct: 'EU' },
        { id: 'JP', fl: 'jp', cl: 'un', ct: 'AS' },
        { id: 'TW', fl: 'tw', cl: 'partial', ct: 'AS' },
        { id: 'GI', fl: 'gi', cl: 'dep', ct: 'EU' },
        { id: 'AQ', fl: 'aq', cl: 'dep', ct: 'AN' },
        // Neither a State nor a territory, and one with no flag: in no group.
        { id: 'XX', fl: 'xx', cl: 'other', ct: 'EU' },
        { id: 'YY', cl: 'un', ct: 'EU' },
      ],
    };
    const row = (id: string, level: number, file: string) => [id, level, id, '', file, 1.5];
    const flags = {
      regions: {
        // Two levels with flags enough: each is a group, besides the country. A picture is once in each.
        ES: [...['a', 'b', 'c', 'd'].map((x) => row(x, 1, `${x}1.svg`)), ...['e', 'f', 'g', 'h', 'i'].map((x) => row(x, 0, `${x}0.svg`)), row('a', 0, 'a1.svg')],
        // One level of four and one of three: the country alone.
        FR: [...['a', 'b', 'c', 'd'].map((x) => row(x, 1, `f${x}.svg`)), ...['e', 'f', 'g'].map((x) => row(x, 0, `f${x}.svg`))],
      },
      capitals: [
        ['m', 'ES', 'Madrid', '', 'm.svg', 1.5],
        ['p', 'FR', 'París', 'Paris', 'p.svg', 1.5],
      ],
      cities: { ES: [['s', 'Sevilla', 'Seville', 's.svg', 1.5]], JP: [['o', 'Osaka', '', 'o.svg', 1.5]] },
      gone: [['Q1', 'Uno', 'One', 'g.svg', 1.5, 1900, 1950]],
      organisations: [['Q2', 'Dos', 'Two', 'o2.svg', 1.5]],
      peoples: [['Q3', 'Tres', 'Three', 'p3.svg', 1.5]],
      signals: [
        ['ics-a', 'sea', 'A', '', 'sa.svg', 1],
        ['race-green', 'race', 'Verde', 'Green', 'rg.svg', 1.5],
      ],
    };
    const found = groups(index, flags);
    expect(found.countries).toEqual({ states: ['ES', 'FR', 'VA', 'JP', 'TW'], EU: ['ES', 'FR', 'VA'], AS: ['JP', 'TW'], territories: ['GI', 'AQ'] });
    expect(Object.keys(found.regions)).toEqual(['ES', 'ES-1', 'ES-0', 'FR']);
    expect(found.regions.ES).toEqual(['a1.svg', 'b1.svg', 'c1.svg', 'd1.svg', 'e0.svg', 'f0.svg', 'g0.svg', 'h0.svg', 'i0.svg']);
    expect(found.regions['ES-1']).toHaveLength(LEVEL_MIN);
    expect(found.regions['ES-0']).toEqual(['e0.svg', 'f0.svg', 'g0.svg', 'h0.svg', 'i0.svg', 'a1.svg']);
    // The capital of a country is among its cities, and among the capitals.
    expect(found.cities).toEqual({ capitals: ['m.svg', 'p.svg'], ES: ['m.svg', 's.svg'], FR: ['p.svg'], JP: ['o.svg'] });
    // Of the signals, those of the sea: the ones that are played.
    expect(found.others).toEqual({ gone: ['g.svg'], organisations: ['o2.svg'], peoples: ['p3.svg'], signals: ['sa.svg'] });
    expect(LEVEL_MIN).toBe(FLAG_SET_MIN);
    // A heavy drawing is compared by its light picture.
    expect([...(lightOf as (flags: unknown) => Map<string, string>)({ ...flags, regions: { ES: [['x', 0, 'X', '', 'x.svg', 1.5, 'x.webp']] } })]).toEqual([['x.svg', 'x.webp']]);
  });
});

describe('the look-alikes that are published (public/data/alike)', () => {
  const wanted = groups(INDEX, FLAGS);

  it('are those of the flags the site is built with: run `npm run data:flag-alike` when this fails', () => {
    for (const kind of KINDS) {
      // A flag alone has nothing to be like, and is in no group.
      const want = Object.entries(wanted[kind]).filter(([, pics]) => pics.length >= 2);
      expect(ALIKE[kind].v).toBe(1);
      expect(Object.keys(ALIKE[kind].groups).sort(), kind).toEqual(want.map(([id]) => id).sort());
      for (const [id, pics] of want) expect(ALIKE[kind].groups[id].pics, `${kind} ${id}`).toEqual(pics);
    }
    expect(Object.keys(ALIKE.countries.groups)).toEqual(['states', 'EU', 'AS', 'AF', 'AM', 'OC', 'territories']);
    expect(Object.keys(ALIKE.regions.groups).filter((id) => id.includes('-'))).toEqual(['ES-1', 'ES-0', 'FR-1', 'FR-0', 'IT-1', 'IT-0']);
  });

  it('are well made: each flag with its nearest ones first, none of them itself, none too far', () => {
    let flags = 0;
    for (const kind of KINDS) {
      const keep = kind === 'countries' ? KEEP_COUNTRIES : KEEP;
      for (const [id, group] of Object.entries(ALIKE[kind].groups)) {
        const where = `${kind} ${id}`;
        const n = group.pics.length;
        flags += n;
        expect(new Set(group.pics).size, where).toBe(n);
        expect(group.near, where).toHaveLength(n);
        const behind = new Set<number>();
        for (const list of group.same) {
          expect(list.length, where).toBeGreaterThan(1);
          expect([...list].sort((a, b) => a - b), where).toEqual(list);
          for (const i of list.slice(1)) {
            expect(behind.has(i), where).toBe(false);
            behind.add(i);
          }
        }
        group.near.forEach((list, i) => {
          if (behind.has(i)) return expect(list, `${where} ${group.pics[i]}`).toEqual([]);
          expect(list.length % 2, where).toBe(0);
          expect(list.length, where).toBeLessThanOrEqual(2 * keep);
          let last = 0;
          const seen = new Set<number>();
          for (let k = 0; k < list.length; k += 2) {
            const [j, score] = [list[k], list[k + 1]];
            expect(j >= 0 && j < n && j !== i && !behind.has(j) && !seen.has(j), `${where} ${group.pics[i]} → ${j}`).toBe(true);
            seen.add(j);
            expect(score, where).toBeGreaterThanOrEqual(last);
            expect(score, where).toBeLessThanOrEqual(FAR);
            last = score;
          }
        });
      }
    }
    expect(flags).toBeGreaterThan(4000);
  });

  it('know of no two pictures that are the same and that the games would take for two', () => {
    // Countries: a territory drawn with the flag of its country is in the list of the game (lib/pairs.ts).
    for (const [id, group] of Object.entries(ALIKE.countries.groups)) {
      for (const list of group.same) {
        const whose = new Set(list.map((i) => SAME_FLAG[group.pics[i]] ?? group.pics[i]));
        expect([...whose], `${id}: ${list.map((i) => group.pics[i]).join(' ')}`).toHaveLength(1);
      }
    }
    // Every other flag: the list that every game reads has each of them under the same picture.
    for (const kind of ['regions', 'cities', 'others'] as const) {
      for (const [id, group] of Object.entries(ALIKE[kind].groups)) {
        for (const list of group.same) {
          const heads = new Set(list.map((i) => SAME.get(group.pics[i])));
          expect(heads.size, `${kind} ${id}: ${list.map((i) => group.pics[i]).join(' ')}`).toBe(1);
          expect([...heads][0]).toBeTruthy();
        }
      }
    }
    // …and that list names files that are flags, each once: those of the groups, and those that are of no
    // country, which are compared all together (a signal of the races with a country that is no more).
    const stray = (strayOf as (flags: unknown) => string[])(FLAGS);
    expect(stray).toHaveLength(new Set(stray).size);
    expect(stray).toEqual(expect.arrayContaining([...wanted.others.gone, ...wanted.others.organisations, ...wanted.others.peoples, ...wanted.others.signals]));
    // Every signal is among them, those that are not played with too: «El intruso» sets them beside the ones that are.
    expect(stray.length).toBe(new Set([...wanted.others.gone, ...wanted.others.organisations, ...wanted.others.peoples, ...(FLAGS.signals ?? []).map((row) => row[4])]).size);
    const files = new Set<string>([...Object.values(wanted).flatMap((kind) => Object.values(kind).flat()), ...stray]);
    const listed = SAME_FILE.same.flat();
    expect(SAME_FILE.v).toBe(1);
    expect(new Set(listed).size).toBe(listed.length);
    for (const file of listed) expect(files.has(file), file).toBe(true);
    for (const list of SAME_FILE.same) expect(list.length).toBeGreaterThan(1);
  });

  it('find the flags a person mixes up', () => {
    const by = (set: FlagSet, id: string): [DeckCard, Near[]] => {
      const card = deck(set).find((c) => c.id === id)!;
      return [card, nearOf(set).get(card.key) ?? []];
    };
    const first = (set: FlagSet, id: string) => by(set, id)[1][0];
    const world: FlagSet = { kind: 'countries' };
    expect(first(world, 'IE').card.id).toBe('CI');
    expect(first(world, 'CI').card.id).toBe('IE');
    expect(first(world, 'IE').score).toBeLessThan(10);
    expect(first(world, 'AU').card.id).toBe('NZ');
    expect(first(world, 'NZ').card.id).toBe('AU');
    expect(first(world, 'RO').card.id).toBe('MD');
    expect(first(world, 'ID').card.id).toBe('SG');
    expect(first(world, 'NL').score).toBeLessThan(ALIKE_CLOSE);
    expect(by(world, 'NL')[1].slice(0, 3).map((n) => n.card.id)).toContain('LU');
    // Among those of a continent, the nearest of that continent: Ivory Coast is not in Europe.
    const europe: FlagSet = { kind: 'countries', continent: 'EU' };
    expect(first(europe, 'IE').card.id).toBe('IT');
    expect(by(europe, 'IE')[1].every((n) => INDEX.countries.find((c) => c.id === n.card.id)!.ct === 'EU')).toBe(true);
    // The blue ensigns of the British territories.
    const [, anguilla] = by({ kind: 'territories' }, 'AI');
    expect(anguilla.slice(0, 3).every((n) => n.score < ALIKE_CLOSE)).toBe(true);
    expect(anguilla.slice(0, 5).map((n) => n.card.id)).toEqual(expect.arrayContaining(['FK', 'MS']));
  });
});

describe('the look-alikes as a game reads them (lib/flagAlike.ts)', () => {
  const card = (id: string, file: string, name = id): DeckCard => ({ key: `region:${id}`, kind: 'region', id, country: 'XX', name, src: '', small: '', file, ratio: 1.5, look: file, said: name.toLowerCase(), answers: [name] });

  it('names a card as the files do: a country by its id, any other flag by its file', () => {
    expect(picOf(card('a', 'a.svg'))).toBe('a.svg');
    expect(picOf(deck({ kind: 'countries' })[0])).toBe(deck({ kind: 'countries' })[0].id);
    expect(picOf({ ...card('a', 'a.svg'), file: undefined })).toBe('');
  });

  it('gives each card the cards of its deck that look most like it, through the picture that stands for its own', () => {
    // b.svg is the same picture as a.svg, which stands for both; d.svg is not played.
    const group: AlikeGroup = { pics: ['a.svg', 'b.svg', 'c.svg', 'd.svg', 'e.svg'], same: [[0, 1]], near: [[2, 10, 3, 12, 4, 30], [], [0, 10, 4, 20], [0, 12], [2, 20, 0, 30]] };
    const [a, b, c, e] = [card('a', 'a.svg'), { ...card('b', 'b.svg'), look: 'a.svg' }, card('c', 'c.svg'), card('e', 'e.svg')];
    const near = nearCards(group, [a, b, c, e]);
    const said = (key: string) => near.get(key)!.map((n) => `${n.card.id} ${n.score}`);
    expect(said(a.key)).toEqual(['c 10', 'e 30']);
    // The one that stands behind another has the neighbours of that one, and neither has the other.
    expect(said(b.key)).toEqual(['c 10', 'e 30']);
    // Whoever is near a picture is near every card drawn with it.
    expect(said(c.key)).toEqual(['a 10', 'b 10', 'e 20']);
    expect(said(e.key)).toEqual(['c 20', 'a 30', 'b 30']);
    // A card the group has not got, or no group: no neighbours, and no error.
    expect(nearCards(group, [a, card('z', 'z.svg')]).get('region:z')).toEqual([]);
    expect([...nearCards(undefined, [a, c]).values()]).toEqual([[], []]);
    // Never a card that goes by the same name.
    const namesake = { ...card('c2', 'c.svg', 'a'), key: 'region:c2' };
    expect(nearCards(group, [a, namesake, e]).get(a.key)!.map((n) => n.card.id)).toEqual(['e']);
  });

  it('finds the group of a set, or the wider one when it has none of its own', () => {
    const file: AlikeFile = { v: 1, groups: { ES: { pics: ['a'], same: [], near: [[]] }, 'ES-1': { pics: ['b'], same: [], near: [[]] } } };
    expect(groupAt(file, { group: 'ES-1', wider: 'ES' })?.pics).toEqual(['b']);
    expect(groupAt(file, { group: 'ES-2', wider: 'ES' })?.pics).toEqual(['a']);
    expect(groupAt(file, { group: 'FR' })).toBeUndefined();
    expect(groupAt(null, { group: 'ES' })).toBeUndefined();
    // Every set that is offered has its group in the files, but for those of a single flag.
    const menu = setMenu(INDEX, FLAGS, SAME);
    const sets = [...menu.countries, menu.territories, ...menu.regions, ...menu.regions.flatMap((c) => c.levels), menu.capitals, ...menu.cities, menu.gone, menu.organisations, menu.peoples, menu.signals].filter((c) => !!c).map((c) => c!.set);
    for (const set of sets) {
      const place = alikePlace(set);
      expect(ALIKE[place.file].groups[place.group], flagSetText(set)).toBeDefined();
      // Every card of the set is known to its group.
      const pics = new Set(ALIKE[place.file].groups[place.group].pics);
      for (const one of deck(set)) expect(pics.has(picOf(one)), `${flagSetText(set)} ${one.name}`).toBe(true);
    }
  });

  it('sets beside a flag its three nearest that can share a question with it and with one another', () => {
    const list = (...cards: [DeckCard, number][]): Near[] => cards.map(([c, score]) => ({ card: c, score }));
    const [a, b, c, d, e] = ['a', 'b', 'c', 'd', 'e'].map((id) => card(id, `${id}.svg`));
    expect(rivalsOf(a, list([b, 5], [c, 9], [d, 20], [e, 21])).map((r) => r.card.id)).toEqual(['b', 'c', 'd']);
    // Two that are the same picture: the nearer of them, and the next.
    const twin = { ...card('c2', 'c2.svg'), look: 'b.svg' };
    expect(rivalsOf(a, list([b, 5], [twin, 6], [d, 20], [e, 21])).map((r) => r.card.id)).toEqual(['b', 'd', 'e']);
    // Fewer than three when there are no more.
    expect(rivalsOf(a, list([b, 5], [twin, 6]))).toHaveLength(1);
    expect(ALIKE_OTHERS).toBe(3);
    expect(closeness(list([b, 5], [c, 10], [d, 30]))).toBe(15);
    expect(closeness(list([b, 5], [c, 10]))).toBe(Infinity);
  });

  it('never sets Chad beside Romania, nor Monaco beside Indonesia, and still asks both', () => {
    const world = deck({ kind: 'countries' });
    const near = nearOf({ kind: 'countries' });
    const rivals = (id: string) => {
      const one = world.find((c) => c.id === id)!;
      return rivalsOf(one, near.get(one.key) ?? []).map((r) => r.card.id);
    };
    expect(rivals('RO')).toEqual(['MD', 'AD', 'BE']);
    expect(rivals('TD')).not.toContain('RO');
    expect(rivals('TD')).toHaveLength(3);
    expect(rivals('ID')).not.toContain('MC');
    expect(rivals('MC')).not.toContain('ID');
    // In every set of the site: no flag beside one that cannot be told from it, nor two such among its rivals.
    const menu = setMenu(INDEX, FLAGS, SAME);
    const sets = [...menu.countries, menu.territories, ...menu.regions, ...menu.regions.flatMap((c) => c.levels), menu.capitals, ...menu.cities, menu.gone, menu.organisations, menu.peoples, menu.signals].filter((c) => !!c).map((c) => c!.set);
    let questions = 0;
    for (const set of sets) {
      const cards = deck(set);
      const around = nearOf(set);
      for (const one of cards) {
        const beside = rivalsOf(one, around.get(one.key) ?? []).map((r) => r.card);
        if (beside.length === ALIKE_OTHERS) questions++;
        const shown = [one, ...beside];
        for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) expect(twins(shown[i], shown[j]), `${flagSetText(set)}: ${shown[i].name} / ${shown[j].name}`).toBe(false);
      }
    }
    expect(questions).toBeGreaterThan(3000);
  });
});
