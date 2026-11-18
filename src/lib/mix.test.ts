import { describe, expect, it } from 'vitest';
import { MIX_MAX, cleanMix, dropMix, isLive, livePairs, mixGroups, mixKey, readMixKey, timesMixed, withMix, type Mix } from './mix';
import { reviewConfig } from './review';
import { DEFAULT_OPTS, type Stat } from './store';

const NOW = new Date(2026, 10, 18, 12, 0, 0).getTime();
const MIN = 60_000;
/** Seen `seen` times, right `run` times in a row, the last time `ago` minutes ago. */
const stat = (run: number, ago: number, seen = Math.max(1, run)): Stat => [seen, run, run, NOW - ago * MIN];

describe('the key of a mix-up', () => {
  it('says the skill, what was asked and what was answered', () => {
    expect(mixKey('loc', 'ES-HU', 'ES-TE')).toBe('loc:ES-HU>ES-TE');
    expect(readMixKey('loc:ES-HU>ES-TE')).toEqual({ skill: 'loc', asked: 'ES-HU', given: 'ES-TE' });
  });

  it('copes with ids that hold a colon', () => {
    const key = mixKey('name', 'r:volga', 'r:don');
    expect(readMixKey(key)).toEqual({ skill: 'name', asked: 'r:volga', given: 'r:don' });
  });

  it('is nothing when it is not one', () => {
    for (const bad of ['', 'loc', 'loc:ES-HU', 'zzz:a>b', 'loc:>b', 'loc:a>', 'loc:a>a']) expect(readMixKey(bad), bad).toBeNull();
  });
});

describe('keeping a mix-up', () => {
  it('counts the times and remembers the last one', () => {
    let mix: Mix = {};
    mix = withMix(mix, {}, 'loc', 'ES-HU', 'ES-TE', NOW - 5000);
    mix = withMix(mix, {}, 'loc', 'ES-HU', 'ES-TE', NOW);
    mix = withMix(mix, {}, 'loc', 'ES-TE', 'ES-HU', NOW);
    expect(mix).toEqual({ 'loc:ES-HU>ES-TE': [2, NOW], 'loc:ES-TE>ES-HU': [1, NOW] });
    expect(timesMixed(mix, 'loc', 'ES-TE', 'ES-HU')).toBe(3);
    expect(timesMixed(mix, 'name', 'ES-TE', 'ES-HU')).toBe(0);
  });

  it('keeps each skill apart: placing one is not naming it', () => {
    let mix = withMix({}, {}, 'loc', 'SK', 'SI', NOW);
    mix = withMix(mix, {}, 'flag', 'SK', 'SI', NOW);
    expect(Object.keys(mix).sort()).toEqual(['flag:SK>SI', 'loc:SK>SI']);
  });

  it('does not take a thing for itself, nor change what it was given', () => {
    const mix: Mix = { 'loc:A>B': [1, 1] };
    expect(withMix(mix, {}, 'loc', 'A', 'A', NOW)).toBe(mix);
    withMix(mix, {}, 'loc', 'A', 'B', NOW);
    expect(mix).toEqual({ 'loc:A>B': [1, 1] });
  });

  it('lets go of the settled and the oldest when there are too many', () => {
    let mix: Mix = {};
    for (let i = 0; i < MIX_MAX; i++) mix[mixKey('loc', `a${i}`, `b${i}`)] = [1, NOW - (MIX_MAX - i) * MIN];
    // The fifth has been learnt since; the first is the oldest.
    const stats = { 'loc:a5': stat(2, 0) };
    mix = withMix(mix, stats, 'loc', 'new', 'one', NOW);
    expect(Object.keys(mix)).toHaveLength(MIX_MAX);
    expect(mix['loc:a5>b5']).toBeUndefined();
    expect(mix['loc:a0>b0']).toBeDefined();
    expect(mix['loc:new>one']).toEqual([1, NOW]);
    mix = withMix(mix, stats, 'loc', 'new', 'two', NOW);
    expect(mix['loc:a0>b0']).toBeUndefined();
    expect(mix['loc:a1>b1']).toBeDefined();
  });
});

describe('a mix-up that still stands', () => {
  const entry: [number, number] = [2, NOW - 60 * MIN];

  it('stands until the piece is got right twice in a row afterwards', () => {
    expect(isLive(entry, undefined)).toBe(true);
    expect(isLive(entry, stat(0, 50))).toBe(true);
    expect(isLive(entry, stat(1, 10))).toBe(true);
    expect(isLive(entry, stat(2, 10))).toBe(false);
  });

  it('is not settled by a run that came before it', () => {
    // Right three times in a row, the last of them before the mix-up was written down.
    expect(isLive(entry, stat(3, 90))).toBe(true);
  });
});

describe('the pairs that are mixed up', () => {
  const mix: Mix = {
    'loc:ES-HU>ES-TE': [2, NOW - 30 * MIN],
    'loc:ES-TE>ES-HU': [1, NOW - 10 * MIN],
    'loc:ES-CC>ES-BA': [1, NOW - 20 * MIN],
    'name:ES-CC>ES-BA': [4, NOW - 40 * MIN],
    'loc:ES-SO>ES-GU': [5, NOW - 50 * MIN],
  };

  it('are counted in both directions, the most mixed up first', () => {
    const pairs = livePairs(mix, {});
    expect(pairs.map((p) => `${p.skill} ${p.a}/${p.b} ${p.times}`)).toEqual(['loc ES-SO/ES-GU 5', 'name ES-CC/ES-BA 4', 'loc ES-HU/ES-TE 3', 'loc ES-CC/ES-BA 1']);
    expect(pairs[2].last).toBe(NOW - 10 * MIN);
  });

  it('name first the one that was asked about more often', () => {
    const [p] = livePairs({ 'loc:B>A': [3, NOW], 'loc:A>B': [1, NOW] }, {});
    expect([p.a, p.b]).toEqual(['B', 'A']);
  });

  it('leave the list once both ways are told apart', () => {
    const stats: Record<string, Stat> = { 'loc:ES-SO': stat(2, 5), 'loc:ES-HU': stat(2, 5) };
    const pairs = livePairs(mix, stats);
    // Soria is settled. Huesca too, but Teruel was also taken for Huesca and has not been asked since.
    expect(pairs.map((p) => `${p.skill} ${p.a}/${p.b}`)).toEqual(['name ES-CC/ES-BA', 'loc ES-HU/ES-TE', 'loc ES-CC/ES-BA']);
    expect(livePairs(mix, { ...stats, 'loc:ES-TE': stat(2, 5) }).map((p) => p.a)).not.toContain('ES-HU');
  });
});

describe('the mix-ups, map by map', () => {
  const where = { 'ES-HU': 'r|ES|f', 'ES-TE': 'r|ES|f', 'ES-CC': 'r|ES|f', 'ES-AN': 'r|ES|g1', 'ES-EX': 'r|ES|g1', SK: 'c', SI: 'c', AT: 'c', m1: 't|ES|top', m2: 't|ES|top', 'r:volga': 'p', 'r:don': 'p' };
  const mix: Mix = {
    'loc:ES-HU>ES-TE': [2, NOW],
    'loc:ES-CC>ES-BA': [1, NOW],
    'loc:ES-AN>ES-EX': [1, NOW],
    'flag:SK>SI': [4, NOW],
    'flag:AT>SI': [1, NOW],
    'cap:SK>SI': [1, NOW],
    'loc:m1>m2': [1, NOW],
    'name:r:volga>r:don': [2, NOW],
  };
  const groups = mixGroups(mix, {}, where);
  const by = (key: string) => groups.find((g) => g.key === key)!;

  it('are a game for each map, level and skill', () => {
    expect(groups.map((g) => g.key)).toEqual(['mix:countries:flag', 'mix:regions:loc:ES:f', 'mix:physical:name', 'mix:cities:loc:ES:top', 'mix:countries:cap', 'mix:regions:loc:ES:g1']);
  });

  it('hold both pieces of each pair, the most mixed up first', () => {
    const flags = by('mix:countries:flag');
    expect(flags.ids).toEqual(['SK', 'SI', 'AT']);
    expect(flags.pairs.map((p) => p.times)).toEqual([4, 1]);
    expect(flags.mode).toBe('flag');
    // A piece that was never asked about itself still belongs to the map of the one it was taken for.
    expect(by('mix:regions:loc:ES:f').ids).toEqual(['ES-HU', 'ES-TE', 'ES-CC', 'ES-BA']);
  });

  it('are played on their map, with only those pieces', () => {
    const provinces = reviewConfig(by('mix:regions:loc:ES:f'), DEFAULT_OPTS);
    expect(provinces).toMatchObject({ section: 'regions', mode: 'pin', countries: ['ES'], levels: { ES: 'f' }, only: ['ES-HU', 'ES-TE', 'ES-CC', 'ES-BA'] });
    expect(reviewConfig(by('mix:countries:flag'), DEFAULT_OPTS)).toMatchObject({ section: 'countries', mode: 'flag', only: ['SK', 'SI', 'AT'] });
    expect(reviewConfig(by('mix:cities:loc:ES:top'), DEFAULT_OPTS)).toMatchObject({ section: 'cities', mode: 'pin', countries: ['ES'], only: ['m1', 'm2'] });
    expect(reviewConfig(by('mix:physical:name'), DEFAULT_OPTS)).toMatchObject({ section: 'physical', mode: 'identify', only: ['r:volga', 'r:don'] });
  });

  it('leave out what cannot be placed on any map', () => {
    expect(mixGroups({ 'loc:zz1>zz2': [3, NOW] }, {}, {})).toEqual([]);
  });
});

describe('what is forgotten and what is read back', () => {
  it('drops everything about a piece that is no longer in the data', () => {
    const mix: Mix = { 'loc:A>B': [1, 1], 'loc:B>C': [2, 2], 'name:C>D': [3, 3] };
    expect(dropMix(mix, ['A'])).toEqual({ 'loc:B>C': [2, 2], 'name:C>D': [3, 3] });
    expect(dropMix(mix, ['C'])).toEqual({ 'loc:A>B': [1, 1] });
  });

  it('trusts only what is well formed', () => {
    expect(cleanMix(null)).toEqual({});
    expect(cleanMix('x')).toEqual({});
    expect(cleanMix({ 'loc:A>B': [2.9, 5], 'loc:A>A': [1, 1], nope: [1, 1], 'loc:C>D': 'x', 'loc:E>F': [0, 1], 'loc:G>H': [1, 'x'], 'cap:I>J': [1, 9, 'extra'] })).toEqual({ 'loc:A>B': [2, 5], 'cap:I>J': [1, 9] });
  });
});
