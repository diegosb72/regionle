import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ZoneRec } from './datedKept';
import { DEFAULT_OPTS } from './store';
import type { Index } from './types';
import { ZONE_DAYS, ZONE_LENGTH, ZONE_PARTS, ZONE_SHOWN, countryZone, partZone, zoneCountries, zoneDone, zoneGame, zoneOf, zoneRun, zoneSeed, zonesShown } from './zones';

const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as Index;
const rec = (patch: Partial<ZoneRec> = {}): ZoneRec => ({ d: '2026-11-20', s: 90, ok: 9, n: 10, ms: 60_000, run: 1, ...patch });
const day = (k: number): string => new Date(Date.UTC(2026, 10, 20) + k * 86_400_000).toISOString().slice(0, 10);

describe('the zones with a challenge of the day', () => {
  it('are the five continents with countries, each with enough of them for ten questions', () => {
    expect(ZONE_PARTS).toEqual(['EU', 'AS', 'AF', 'AM', 'OC']);
    for (const part of ZONE_PARTS) {
      expect(index.continents[part], part).toBeDefined();
      const game = zoneGame(partZone(part), '2026-11-20', index, DEFAULT_OPTS)!;
      expect(game.countries.length, part).toBeGreaterThanOrEqual(ZONE_LENGTH);
    }
    // Antarctica is in the data, with no country of its own.
    expect(zoneOf('p:AN', index)).toBeNull();
  });

  it('and the sovereign countries whose map, as it opens, has ten pieces or more', () => {
    const ids = zoneCountries(index).map((c) => c.id);
    expect(ids.length).toBeGreaterThanOrEqual(120);
    expect(new Set(ids).size).toBe(ids.length);
    // Spain opens with its nineteen communities.
    expect(ids).toContain('ES');
    expect(ids).toContain('FR');
    // Luxembourg has three districts; Hong Kong has eighteen, and is not a country.
    expect(ids).not.toContain('LU');
    expect(ids).not.toContain('HK');
    for (const c of zoneCountries(index)) {
      const level = c.lv.find((l) => l.k === c.dl) ?? c.lv[c.lv.length - 1];
      expect(level.n, c.id).toBeGreaterThanOrEqual(ZONE_LENGTH);
      expect(['un', 'obs', 'partial'], c.id).toContain(c.cl);
    }
  });

  it('are told apart by their mark: the same two letters name a continent and a country', () => {
    expect(partZone('AF')).toBe('p:AF');
    expect(countryZone('AF')).toBe('c:AF');
    expect(zoneOf('p:AF', index)).toEqual({ id: 'p:AF', part: 'AF' });
    expect(zoneOf('c:ES', index)?.country?.id).toBe('ES');
    expect(zoneOf('c:LU', index)).toBeNull();
    expect(zoneOf('c:ZZ', index)).toBeNull();
    expect(zoneOf('ES', index)).toBeNull();
    expect(zoneOf('', index)).toBeNull();
  });
});

describe('the game of a zone on a day', () => {
  it('has a seed of its own for each zone and each day, the same for everyone', () => {
    const seeds = [zoneSeed('p:EU', '2026-11-20'), zoneSeed('p:EU', '2026-11-21'), zoneSeed('p:AF', '2026-11-20'), zoneSeed('c:AF', '2026-11-20'), zoneSeed('c:ES', '2026-11-20')];
    expect(new Set(seeds).size).toBe(seeds.length);
    expect(zoneSeed('p:EU', '2026-11-20')).toBe(seeds[0]);
    for (const seed of seeds) {
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2_147_483_647);
    }
  });

  it('is a medley of ten questions on the countries of a continent', () => {
    const game = zoneGame('p:EU', '2026-11-20', index, DEFAULT_OPTS)!;
    expect(game).toMatchObject({ section: 'countries', mode: 'mix', levels: {}, zone: { id: 'p:EU', date: '2026-11-20' }, challenge: { seed: zoneSeed('p:EU', '2026-11-20') } });
    expect(game.countries).toHaveLength(46);
    expect(game.countries).toEqual([...game.countries].sort());
    expect(game.countries.every((id) => index.countries.find((c) => c.id === id)!.ct === 'EU')).toBe(true);
    expect(game.weekly).toBeUndefined();
  });

  it('or on the regions of a country, at the level its map opens with whatever the player has chosen', () => {
    const game = zoneGame('c:ES', '2026-11-20', index, DEFAULT_OPTS)!;
    expect(game).toMatchObject({ section: 'regions', mode: 'mix', countries: ['ES'], levels: { ES: 'g1' }, zone: { id: 'c:ES', date: '2026-11-20' }, challenge: { seed: zoneSeed('c:ES', '2026-11-20') } });
    // The level a map opens with is neither its first nor its last: the United Kingdom opens with its twelve
    // regions, between the four nations and the counties; Belgium, with its eleven provinces.
    expect(zoneGame('c:GB', '2026-11-20', index, DEFAULT_OPTS)!.levels).toEqual({ GB: 'g2' });
    expect(zoneGame('c:BE', '2026-11-20', index, DEFAULT_OPTS)!.levels).toEqual({ BE: 'f' });
  });

  it('settles what changes the questions, and leaves the rest as the player likes it', () => {
    const mine = { ...DEFAULT_OPTS, answer: 'type' as const, length: 'all' as const, pinBy: 'capital' as const, turned: true, flagLook: 'blur' as const, format: 'exam' as const, labels: false, wiki: true };
    for (const id of ['p:AS', 'c:FR']) {
      const game = zoneGame(id, '2026-11-20', index, mine)!;
      expect(game.opts, id).toMatchObject({ answer: 'choice', length: ZONE_LENGTH, pinBy: 'name', turned: false, flagLook: 'plain', format: 'normal', labels: false, wiki: true });
    }
  });

  it('is nothing for what has no challenge', () => {
    expect(zoneGame('c:LU', '2026-11-20', index, DEFAULT_OPTS)).toBeNull();
    expect(zoneGame('p:AN', '2026-11-20', index, DEFAULT_OPTS)).toBeNull();
    expect(zoneGame('nothing', '2026-11-20', index, DEFAULT_OPTS)).toBeNull();
  });
});

describe('what the first page says of a zone', () => {
  it('is done on the day it was last finished, and on no other', () => {
    expect(zoneDone(rec(), '2026-11-20')).toBe(true);
    expect(zoneDone(rec(), '2026-11-21')).toBe(false);
    expect(zoneDone(undefined, '2026-11-20')).toBe(false);
  });

  it('counts the days in a row while they can still go on: the last one was today or yesterday', () => {
    expect(zoneRun(rec({ run: 4 }), '2026-11-20')).toBe(4);
    expect(zoneRun(rec({ run: 4 }), '2026-11-21')).toBe(4);
    expect(zoneRun(rec({ run: 4 }), '2026-11-22')).toBe(0);
    expect(zoneRun(rec({ d: '2026-11-30', run: 2 }), '2026-12-01')).toBe(2);
    expect(zoneRun(undefined, '2026-11-20')).toBe(0);
  });

  it('keeps in sight the countries played within the last month, the latest first, and never the continents', () => {
    const zones = { 'p:EU': rec(), 'c:ES': rec({ d: day(-3) }), 'c:FR': rec({ d: day(0) }), 'c:IT': rec({ d: day(-(ZONE_DAYS - 1)) }), 'c:PT': rec({ d: day(-ZONE_DAYS) }), 'c:DE': rec({ d: day(-3) }) };
    expect(zonesShown(zones, day(0))).toEqual(['c:FR', 'c:DE', 'c:ES', 'c:IT']);
    expect(zonesShown({}, day(0))).toEqual([]);
  });

  it('and no more than a handful of them', () => {
    const zones = Object.fromEntries(Array.from({ length: ZONE_SHOWN + 4 }, (_, k) => [`c:A${String.fromCharCode(65 + k)}`, rec({ d: day(-k) })]));
    const shown = zonesShown(zones, day(0));
    expect(shown).toHaveLength(ZONE_SHOWN);
    expect(shown[0]).toBe('c:AA');
    expect(shown).not.toContain(`c:A${String.fromCharCode(65 + ZONE_SHOWN)}`);
  });
});
