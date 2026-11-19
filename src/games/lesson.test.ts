import { describe, expect, it } from 'vitest';
import type { Stat } from '../lib/store';
import { mulberry32 } from '../lib/text';
import type { Item } from '../lib/types';
import { DEFAULT_OPTS } from '../lib/store';
import { LESSON, LESSON_ORDERS, LESSON_SIZES, OLD, isIntroduced, lessonOrder, lessonOrders, lessonQueue, lessonSize, pickLesson } from './lesson';

/** Only what the lessons look at. */
const item = (id: string, lon: number, lat: number, extra: Partial<Item> = {}): Item => ({ id, lp: [lon, lat], area: 1, ...extra }) as Item;

describe('what a lesson teaches', () => {
  // Two clusters far apart: five pieces in the west, five in the east, and a big one in the east.
  const west = [0, 1, 2, 3, 4].map((i) => item(`W${i}`, -8 + i * 0.3, 42));
  const east = [0, 1, 2, 3, 4].map((i) => item(`E${i}`, 2 + i * 0.3, 41, { area: i === 2 ? 50 : 1 }));
  const all = [...west, ...east];

  it('takes everything when there is a lesson or less left', () => {
    expect(pickLesson(west, [], 'regions')).toEqual(west);
    expect(pickLesson(west.slice(0, 2), east, 'regions')).toEqual(west.slice(0, 2));
    expect(pickLesson([], east, 'regions')).toEqual([]);
  });

  it('starts a new map with its biggest piece and the ones around it', () => {
    const first = pickLesson(all, [], 'regions');
    expect(first).toHaveLength(LESSON);
    expect(first[0].id).toBe('E2');
    expect(first.map((x) => x.id).sort()).toEqual(['E0', 'E1', 'E2', 'E3', 'E4']);
  });

  it('goes on next to what is already known', () => {
    const pending = [...west, item('E5', 3.6, 41), item('E6', 3.9, 41)];
    const next = pickLesson(pending, east, 'regions');
    expect(next).toHaveLength(LESSON);
    // The two that were left in the east come first; the rest are the western ones nearest to them.
    expect(next.slice(0, 2).map((x) => x.id).sort()).toEqual(['E5', 'E6']);
    expect(next.slice(2).map((x) => x.id).sort()).toEqual(['W2', 'W3', 'W4']);
  });

  it('teaches cities by size, the biggest first', () => {
    const cities = [3, 9, 1, 7, 5, 8, 2].map((pop, i) => item(`C${i}`, i, 40, { pop: pop * 1e5 }));
    expect(pickLesson(cities, [], 'cities').map((x) => x.pop! / 1e5)).toEqual([9, 8, 7, 5, 3]);
    expect(pickLesson(cities, [], 'cities', 2).map((x) => x.id)).toEqual(['C1', 'C5']);
  });

  it('starts a physical map with the best known feature', () => {
    const features = all.map((x, i) => ({ ...x, area: i }));
    expect(pickLesson(features, [], 'physical')[0].id).toBe('W0');
  });
});

describe('lessons to the taste of the player', () => {
  const named = (id: string, name: string, area: number, lon: number): Item => item(id, lon, 40, { name, area });
  // West to east they spell nothing; by size and by name they come in other orders.
  const map = [named('a', 'Zamora', 3, 0), named('b', 'Álava', 9, 1), named('c', 'Burgos', 1, 2), named('d', 'Ávila', 7, 3), named('e', 'Navarra', 5, 4), named('f', 'Ñora', 2, 5), named('g', 'Orense', 8, 6)];
  const ids = (list: Item[]) => list.map((x) => x.id).join('');

  it('are as long as asked, among the sizes there are', () => {
    expect(LESSON_SIZES).toContain(LESSON);
    for (const size of LESSON_SIZES) expect(pickLesson([...map, ...map.map((x) => ({ ...x, id: x.id + x.id }))], [], 'regions', size)).toHaveLength(size);
    expect(LESSON_SIZES.map((n) => lessonSize(n))).toEqual([...LESSON_SIZES]);
    // What is kept may be anything: a size there is not is the usual one.
    expect([undefined, 0, 4, 500, NaN].map((n) => lessonSize(n))).toEqual([LESSON, LESSON, LESSON, LESSON, LESSON]);
    // What a new player starts with is the usual lesson, in the order that suits each map.
    expect(DEFAULT_OPTS.lessonSize).toBe(LESSON);
    expect(DEFAULT_OPTS.lessonOrder).toBe('auto');
    expect(LESSON_ORDERS).toContain(DEFAULT_OPTS.lessonOrder);
  });

  it('come from the largest to the smallest when asked by size', () => {
    expect(ids(pickLesson(map, [], 'regions', 3, 'size'))).toBe('bgd');
    // What is already known does not change which come next: the largest that are left.
    expect(ids(pickLesson(map.filter((x) => !'bgd'.includes(x.id)), map.slice(0, 2), 'regions', 3, 'size'))).toBe('eaf');
    // The last lesson is in order too, though it takes all there is.
    expect(ids(pickLesson(map.slice(0, 3), [], 'regions', 5, 'size'))).toBe('bac');
  });

  it('come by their names when asked so, as a dictionary of the language has them', () => {
    // Á with A and Ñ after N, not at the end with the other letters that have a mark.
    expect(ids(pickLesson(map, [], 'regions', 7, 'abc'))).toBe('bdcefga');
    expect(ids(pickLesson(map, [], 'regions', 3, 'abc'))).toBe('bdc');
  });

  it('come corner by corner unless told otherwise, and cities by size', () => {
    expect(lessonOrder('regions')).toBe('near');
    expect(lessonOrder('countries', 'auto')).toBe('near');
    expect(lessonOrder('cities')).toBe('size');
    expect(lessonOrder('cities', 'near')).toBe('near');
    expect(lessonOrder('regions', 'abc')).toBe('abc');
    // Rivers and peaks have no size to go by: asked for, it is the usual order.
    expect(lessonOrders('physical')).toEqual(['near', 'abc']);
    expect(lessonOrder('physical', 'size')).toBe('near');
    expect(lessonOrder('regions', 'nonsense' as never)).toBe('near');
    // Cities corner by corner: the largest on a new map, and the ones around it.
    const cities = [3, 9, 1, 7, 5, 8, 2].map((pop, i) => item(`C${i}`, i * 3, 40, { pop: pop * 1e5, area: 0 }));
    expect(pickLesson(cities, [], 'cities', 3, 'near')).toHaveLength(3);
  });
});

describe('what a lesson asks', () => {
  const fresh = ['a', 'b', 'c', 'd', 'e'];
  const old = ['p', 'q', 'r', 's'];

  it('asks where each new piece is, then what each is called, then mixes them with old ones', () => {
    const q = lessonQueue(fresh, old, mulberry32(7));
    expect(q).toHaveLength(LESSON * 2 + OLD * 2);
    const where = q.slice(0, 5);
    const names = q.slice(5, 10);
    const mixed = q.slice(10);
    expect(where.every((x) => x.kind === 'pin' && !x.easy)).toBe(true);
    expect(where.map((x) => x.id).sort()).toEqual(fresh);
    // The first time a name is asked, it is with four options.
    expect(names.every((x) => x.kind === 'name' && x.easy)).toBe(true);
    expect(names.map((x) => x.id).sort()).toEqual(fresh);
    // The mixed round has as many old pieces as new ones, alternating the two kinds of question.
    expect(mixed.filter((x) => fresh.includes(x.id))).toHaveLength(OLD);
    expect(mixed.filter((x) => old.includes(x.id))).toHaveLength(OLD);
    expect(new Set(mixed.map((x) => x.id)).size).toBe(mixed.length);
    expect(mixed.map((x) => x.kind)).toEqual(['name', 'pin', 'name', 'pin', 'name', 'pin']);
    expect(mixed.every((x) => !x.easy)).toBe(true);
  });

  it('makes do with what there is in a first lesson and in a short one', () => {
    expect(lessonQueue(fresh, [], mulberry32(1))).toHaveLength(LESSON * 2 + OLD);
    const short = lessonQueue(['a', 'b'], ['p'], mulberry32(1));
    expect(short).toHaveLength(2 + 2 + 2 + 1);
    expect(short.slice(4).map((x) => x.id).sort()).toEqual(['a', 'b', 'p']);
  });

  it('gives the same questions for the same seed', () => {
    expect(lessonQueue(fresh, old, mulberry32(42))).toEqual(lessonQueue(fresh, old, mulberry32(42)));
  });

  it('counts a piece as introduced once it was placed and named right the last time', () => {
    const right: Stat = [3, 2, 1, 0];
    const missed: Stat = [3, 2, 0, 0];
    expect(isIntroduced({}, 'a')).toBe(false);
    expect(isIntroduced({ 'loc:a': right }, 'a')).toBe(false);
    expect(isIntroduced({ 'loc:a': right, 'name:a': right }, 'a')).toBe(true);
    expect(isIntroduced({ 'loc:a': right, 'name:a': missed }, 'a')).toBe(false);
    expect(isIntroduced({ 'loc:a': right, 'name:a': right }, 'b')).toBe(false);
  });
});
