import { describe, expect, it } from 'vitest';
import { INTERVALS, REVIEW_MAX, allGroups, dueAt, dueCount, dueGroups, forecast, gradeOf, goneFrom, intervalOf, isDue, isSlipping, missGroups, missesOf, parseOrigin, reviewConfig } from './review';
import { DEFAULT_OPTS, dropAnswers, type Stat } from './store';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Midday, so that "today" and "tomorrow" mean the same in any time zone the tests run in. */
const NOW = new Date(2026, 10, 16, 12, 0, 0).getTime();

/** An answer seen `seen` times, right `run` times in a row, last asked `ago` milliseconds ago. */
const stat = (run: number, ago: number, seen = Math.max(1, run)): Stat => [seen, run, run, NOW - ago];

describe('when an answer comes back', () => {
  it('waits longer after each right answer and stops growing at the end of the list', () => {
    expect(INTERVALS).toEqual([...INTERVALS].sort((a, b) => a - b));
    expect(intervalOf(0)).toBe(10 * MIN);
    expect(intervalOf(1)).toBe(DAY);
    expect(intervalOf(2)).toBe(3 * DAY);
    expect(intervalOf(99)).toBe(75 * DAY);
    expect(intervalOf(-3)).toBe(10 * MIN);
    expect(dueAt(stat(2, 0))).toBe(NOW + 3 * DAY);
  });

  it('brings a miss back the same day, but not at once', () => {
    expect(isDue(stat(0, 5 * MIN), NOW)).toBe(false);
    expect(isDue(stat(0, 11 * MIN), NOW)).toBe(true);
  });

  it('plans by the day: what falls due tonight can be done from the morning', () => {
    // Right once yesterday evening: due this evening, offered from eight hours before.
    expect(isDue(stat(1, 15 * HOUR), NOW)).toBe(false);
    expect(isDue(stat(1, 17 * HOUR), NOW)).toBe(true);
    expect(isDue(stat(3, 6 * DAY), NOW)).toBe(false);
    expect(isDue(stat(3, 7 * DAY), NOW)).toBe(true);
  });

  it('never asks for what has not been seen', () => {
    expect(isDue(undefined, NOW)).toBe(false);
    expect(isDue([0, 0, 0, 0], NOW)).toBe(false);
  });

  it('grades what is known', () => {
    expect(gradeOf(undefined, NOW)).toBe('new');
    expect(gradeOf(stat(0, DAY), NOW)).toBe('learning');
    expect(gradeOf(stat(1, 5 * DAY), NOW)).toBe('learning');
    expect(gradeOf(stat(2, DAY), NOW)).toBe('known');
    expect(gradeOf(stat(2, 4 * DAY), NOW)).toBe('due');
  });
});

describe('where an answer was learnt', () => {
  it('reads the origin kept with it', () => {
    expect(parseOrigin('ES-AN', 'r|ES|g1')).toEqual({ section: 'regions', country: 'ES', level: 'g1' });
    expect(parseOrigin('FR', 'c')).toEqual({ section: 'countries', country: 'FR' });
    expect(parseOrigin('cj64n0v', 't|ES|top')).toEqual({ section: 'cities', country: 'ES', pick: 'top' });
    expect(parseOrigin('cj64n0v', 't|ES|caps')).toEqual({ section: 'cities', country: 'ES', pick: 'caps' });
    expect(parseOrigin('r:danube', 'p')).toEqual({ section: 'physical' });
    expect(parseOrigin('x', 'zzz')).toBeNull();
  });

  it('guesses it from the id for answers stored before origins were kept', () => {
    expect(parseOrigin('FR', undefined)).toEqual({ section: 'countries', country: 'FR' });
    expect(parseOrigin('ES-AN', undefined)).toEqual({ section: 'regions', country: 'ES' });
    expect(parseOrigin('GB~ENG', undefined)).toEqual({ section: 'regions', country: 'GB' });
    expect(parseOrigin('cj64n0v', undefined)).toBeNull();
  });
});

describe("today's review", () => {
  const stats: Record<string, Stat> = {
    // Spain by autonomous communities: three due, one not yet.
    'loc:ES-AN': stat(1, 2 * DAY),
    'loc:ES-AR': stat(0, 3 * DAY),
    'loc:ES-GA': stat(2, 9 * DAY),
    'loc:ES-MD': stat(4, DAY),
    // …and one province, a different level of the same country.
    'loc:ES-M': stat(1, 5 * DAY),
    // Capitals of those communities: a game of its own.
    'cap:ES-AN': stat(0, DAY),
    // Countries on the map and their flags.
    'loc:FR': stat(1, 2 * DAY),
    'loc:DE': stat(1, 3 * DAY),
    'flag:FR': stat(0, DAY),
    // Cities of Spain, capitals of the world, a river.
    'loc:c1': stat(0, DAY),
    'loc:c2': stat(1, 4 * DAY),
    'loc:c3': stat(0, 2 * DAY),
    'loc:c4': stat(0, 2 * DAY),
    'loc:r:danube': stat(0, DAY),
    // Not due at all.
    'loc:IT': stat(5, DAY),
    // A skill this version does not know.
    'zzz:PT': stat(0, DAY),
  };
  const where: Record<string, string> = {
    'ES-AN': 'r|ES|g1',
    'ES-AR': 'r|ES|g1',
    'ES-GA': 'r|ES|g1',
    'ES-MD': 'r|ES|g1',
    'ES-M': 'r|ES|f',
    FR: 'c',
    DE: 'c',
    IT: 'c',
    c1: 't|ES|top',
    c2: 't|ES|top',
    c3: 't|FR|caps',
    c4: 't|DE|caps',
    'r:danube': 'p',
  };
  const groups = dueGroups(stats, where, NOW);
  const byKey = new Map(groups.map((g) => [g.key, g]));

  it('gathers what is due into one game per map and skill', () => {
    expect([...byKey.keys()].sort()).toEqual(
      ['cities:loc:ES:top', 'cities:loc:caps', 'countries:flag', 'countries:loc', 'physical:loc', 'regions:cap:ES', 'regions:loc:ES'].sort(),
    );
    expect(dueCount(groups)).toBe(3 + 1 + 2 + 1 + 2 + 2 + 1);
  });

  it('reviews a country at the level with more due, and leaves the other for later', () => {
    const g = byKey.get('regions:loc:ES')!;
    expect(g.level).toBe('g1');
    expect(g.country).toBe('ES');
    expect(g.mode).toBe('pin');
    expect(g.ids).not.toContain('ES-M');
    expect(g.ids).not.toContain('ES-MD');
  });

  it('asks first what has been due for longest', () => {
    // ES-AR fell due ten minutes after a miss three days ago; ES-GA, six days ago; ES-AN, one day ago.
    expect(byKey.get('regions:loc:ES')!.ids).toEqual(['ES-GA', 'ES-AR', 'ES-AN']);
    expect(byKey.get('regions:loc:ES')!.oldest).toBe(NOW - 6 * DAY);
  });

  it('keeps the capitals of the world together, whichever country they belong to', () => {
    const g = byKey.get('cities:loc:caps')!;
    expect(g.country).toBeUndefined();
    expect(g.countries).toEqual(['DE', 'FR']);
    expect(g.pick).toBe('caps');
    expect(byKey.get('cities:loc:ES:top')!.country).toBe('ES');
  });

  it('lists the biggest reviews first', () => {
    expect(groups[0].key).toBe('regions:loc:ES');
    expect(groups.map((g) => g.ids.length)).toEqual([...groups.map((g) => g.ids.length)].sort((a, b) => b - a));
  });

  it('turns a group into a game on its own map, with only the questions that are due', () => {
    const cfg = reviewConfig(byKey.get('regions:loc:ES')!, { ...DEFAULT_OPTS, length: 10 });
    expect(cfg).toMatchObject({ section: 'regions', mode: 'pin', countries: ['ES'], levels: { ES: 'g1' }, review: true });
    expect(cfg.only).toEqual(['ES-GA', 'ES-AR', 'ES-AN']);
    expect(cfg.opts.length).toBe('all');

    const caps = reviewConfig(byKey.get('cities:loc:caps')!, DEFAULT_OPTS);
    expect(caps.countries).toEqual(['DE', 'FR']);
    expect(caps.opts.cityPick).toBe('caps');

    const countries = reviewConfig(byKey.get('countries:loc')!, DEFAULT_OPTS);
    expect(countries.countries.sort()).toEqual(['DE', 'FR']);
    expect(countries.mode).toBe('pin');
    expect(reviewConfig(byKey.get('countries:flag')!, DEFAULT_OPTS).mode).toBe('flag');
  });

  it('never makes a review longer than the limit', () => {
    const many: Record<string, Stat> = {};
    for (let i = 0; i < REVIEW_MAX + 25; i++) many[`loc:${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`] = stat(0, DAY + i * MIN);
    const [g] = dueGroups(many, {}, NOW);
    expect(g.ids).toHaveLength(REVIEW_MAX + 25);
    const cfg = reviewConfig(g, DEFAULT_OPTS);
    expect(cfg.only).toHaveLength(REVIEW_MAX);
    expect(cfg.only).toEqual(g.ids.slice(0, REVIEW_MAX));
  });

  it('says how many answers fall due each of the coming days', () => {
    const f = forecast(
      {
        'loc:A': stat(0, 3 * DAY), // long overdue → today
        'loc:B': stat(1, HOUR), // tomorrow
        'loc:C': stat(2, DAY), // in two days
        'loc:D': stat(2, DAY + HOUR), // in two days
        'loc:E': stat(6, 0), // far away
        'loc:F': [0, 0, 0, 0], // never asked
      },
      NOW,
      7,
    );
    expect(f).toEqual([1, 1, 2, 0, 0, 0, 0]);
  });
});

describe('answers about things that are no longer in the data', () => {
  const level = (country: string) => (country === 'ES' ? 'g1' : 'f');

  it('are told apart when the map they were learnt on is the one loaded and does not have them', () => {
    const deck = new Set(['a', 'b']);
    const where = { a: 't|BR|top', ghost: 't|BR|top', b: 't|BR|top' };
    expect(goneFrom(['a', 'ghost', 'b'], (id) => deck.has(id), where, 'cities', level)).toEqual(['ghost']);
    // Everything is there: nothing goes.
    expect(goneFrom(['a', 'b'], (id) => deck.has(id), where, 'cities', level)).toEqual([]);
    // A river that left the list, a country that is no more.
    expect(goneFrom(['r:styx'], () => false, { 'r:styx': 'p' }, 'physical', level)).toEqual(['r:styx']);
    expect(goneFrom(['XX'], () => false, { XX: 'c' }, 'countries', level)).toEqual(['XX']);
  });

  it('are left alone when it is not certain that they belong to this map', () => {
    const none = () => false;
    // Stored by an early version, without its map: it may be a province on a map of communities.
    expect(goneFrom(['ES-M'], none, {}, 'regions', level)).toEqual([]);
    // Learnt on another level of the country than the one loaded.
    expect(goneFrom(['ES-M'], none, { 'ES-M': 'r|ES|f' }, 'regions', level)).toEqual([]);
    // Learnt in another section.
    expect(goneFrom(['x'], none, { x: 't|BR|top' }, 'physical', level)).toEqual([]);
    // The same level, and the map does not have it: gone.
    expect(goneFrom(['ES-XX'], none, { 'ES-XX': 'r|ES|g1' }, 'regions', level)).toEqual(['ES-XX']);
  });

  it('are dropped whole: every skill, and the map they were learnt on', () => {
    const stat: Stat = [1, 1, 1, 0];
    const stats = { 'loc:ghost': stat, 'name:ghost': stat, 'loc:a': stat, 'name:r:volga': stat, 'loc:r:styx': stat };
    const where = { ghost: 't|BR|top', a: 't|BR|top', 'r:volga': 'p', 'r:styx': 'p' };
    const left = dropAnswers(stats, where, ['ghost', 'r:styx']);
    expect(Object.keys(left.stats).sort()).toEqual(['loc:a', 'name:r:volga']);
    expect(Object.keys(left.where).sort()).toEqual(['a', 'r:volga']);
    // Nothing to drop leaves everything as it was.
    expect(dropAnswers(stats, where, [])).toEqual({ stats, where });
  });
});

describe('what is missed most', () => {
  /** An answer asked `seen` times, right first time `ok` of them, with `run` right in a row now. */
  const st = (seen: number, ok: number, run: number): Stat => [seen, ok, run, NOW - DAY];

  it('counts the times an answer was not right first time', () => {
    expect(missesOf(st(7, 2, 0))).toBe(5);
    expect(missesOf(st(3, 3, 3))).toBe(0);
    expect(missesOf(undefined)).toBe(0);
  });

  it('is what was missed twice or more and has not been learnt since', () => {
    expect(isSlipping(st(2, 0, 0))).toBe(true);
    expect(isSlipping(st(5, 2, 1))).toBe(true);
    // Missed once: anyone slips once.
    expect(isSlipping(st(4, 3, 1))).toBe(false);
    // Missed five times, and then right twice running: learnt, and off the list.
    expect(isSlipping(st(7, 2, 2))).toBe(false);
    expect(isSlipping(undefined)).toBe(false);
  });

  it('gathers it by map, the most missed first, with a game for each level of a country', () => {
    const stats: Record<string, Stat> = {
      'loc:ES-ZA': st(7, 2, 0),
      'loc:ES-GU': st(4, 1, 1),
      'loc:ES-M': st(6, 6, 6),
      'loc:ES-TE': st(3, 1, 0),
      'loc:ES-AR': st(3, 0, 0),
      'name:ES-ZA': st(2, 0, 0),
      'cap:FR': st(5, 1, 0),
      'loc:FR': st(2, 1, 1),
    };
    const where = { 'ES-ZA': 'r|ES|g2', 'ES-GU': 'r|ES|g2', 'ES-M': 'r|ES|g2', 'ES-TE': 'r|ES|g2', 'ES-AR': 'r|ES|g1', FR: 'c' };
    const groups = missGroups(stats, where);
    expect(groups.map((g) => [g.key, g.ids])).toEqual([
      // Zamora was missed five times, Guadalajara three, Teruel two; Madrid is known.
      ['regions:loc:ES:g2', ['ES-ZA', 'ES-GU', 'ES-TE']],
      // Of the maps with one, the one whose piece was missed more: four times, three, two.
      ['countries:cap', ['FR']],
      // The communities are another map of the same country: a game of their own.
      ['regions:loc:ES:g1', ['ES-AR']],
      ['regions:name:ES:g2', ['ES-ZA']],
    ]);
    // Each one is played like a review: on its map, only those pieces.
    const cfg = reviewConfig(groups[0], DEFAULT_OPTS);
    expect(cfg).toMatchObject({ section: 'regions', mode: 'pin', countries: ['ES'], levels: { ES: 'g2' }, only: ['ES-ZA', 'ES-GU', 'ES-TE'], review: true });
  });

  it('puts first, of two missed as often, the one that was asked fewer times', () => {
    const stats: Record<string, Stat> = { 'loc:ES-A': st(9, 6, 0), 'loc:ES-B': st(3, 0, 0), 'loc:ES-C': st(4, 1, 0) };
    const where = { 'ES-A': 'r|ES|g2', 'ES-B': 'r|ES|g2', 'ES-C': 'r|ES|g2' };
    expect(missGroups(stats, where)[0].ids).toEqual(['ES-B', 'ES-C', 'ES-A']);
  });

  it('is empty while nothing has been missed twice', () => {
    expect(missGroups({ 'loc:ES-M': st(3, 2, 2), 'loc:ES-B': st(1, 0, 0) }, { 'ES-M': 'r|ES|g2', 'ES-B': 'r|ES|g2' })).toEqual([]);
  });
});

describe('every answer, for the file of the review', () => {
  it('lists each one once, on its map and at its level, the one asked longest ago first', () => {
    const stats: Record<string, Stat> = {
      'loc:ES-ZA': [2, 1, 1, NOW - 3 * DAY],
      'loc:ES-M': [1, 1, 1, NOW - 5 * DAY],
      'loc:ES-AR': [1, 1, 1, NOW - DAY],
      'flag:FR': [1, 0, 0, NOW],
      'loc:never': [0, 0, 0, 0],
    };
    const where = { 'ES-ZA': 'r|ES|g2', 'ES-M': 'r|ES|g2', 'ES-AR': 'r|ES|g1', FR: 'c' };
    const groups = allGroups(stats, where);
    expect(groups.map((g) => [g.key, g.level, g.ids])).toEqual([
      ['regions:loc:ES:g2', 'g2', ['ES-M', 'ES-ZA']],
      ['regions:loc:ES:g1', 'g1', ['ES-AR']],
      ['countries:flag', undefined, ['FR']],
    ]);
    expect(groups.flatMap((g) => g.ids)).toHaveLength(4);
  });
});
