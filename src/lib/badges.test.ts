import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BADGE_GROUPS, EARTH_IDS, LEVEL_AT, POINTS, badgesOf, isEarned, levelOfPoints, pointsOf, type BadgeCtx } from './badges';
import type { Days } from './days';
import type { SessionRec, Stat } from './store';
import type { Index } from './types';

const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as Index;
const NOW = 1_800_000_000_000;
/** Right first time twice in a row: what "learnt" means everywhere. */
const learnt: Stat = [2, 2, 2, NOW];
const once: Stat = [1, 1, 1, NOW];
const session = (total: number, ok: number): SessionRec => ({ t: NOW, section: 'regions', mode: 'pin', label: 'x', total, ok, warn: 0, bad: total - ok, ms: 1000 });
const ctx = (patch: Partial<BadgeCtx> = {}): BadgeCtx => ({ stats: {}, where: {}, sessions: [], best: {}, tot: {}, lists: [], index, ...patch });
const earned = (c: BadgeCtx) => badgesOf(c).filter(isEarned).map((b) => b.id);
const badge = (c: BadgeCtx, id: string) => badgesOf(c).find((b) => b.id === id)!;

describe('achievements', () => {
  it('start with nothing earned and every goal within reach', () => {
    const all = badgesOf(ctx());
    expect(all.filter(isEarned)).toEqual([]);
    expect(new Set(all.map((b) => b.id)).size).toBe(all.length);
    for (const b of all) {
      expect(b.goal, b.id).toBeGreaterThan(0);
      expect(b.done, b.id).toBe(0);
      expect(b.name, b.id).toBeTruthy();
      expect(b.desc, b.id).toBeTruthy();
      expect(BADGE_GROUPS, b.id).toContain(b.group);
    }
  });

  it('give a continent to whoever has placed all its countries', () => {
    const europe = index.countries.filter((c) => c.cl === 'un' && c.ct === 'EU');
    const stats: Record<string, Stat> = {};
    const where: Record<string, string> = {};
    for (const c of europe) {
      stats[`loc:${c.id}`] = learnt;
      where[c.id] = 'c';
    }
    expect(earned(ctx({ stats, where }))).toEqual(['ct-EU']);
    expect(badge(ctx({ stats, where }), 'world')).toMatchObject({ done: europe.length, goal: 193 });
    // One country seen only once: not learnt yet, and the continent waits.
    stats[`loc:${europe[0].id}`] = once;
    expect(earned(ctx({ stats, where }))).toEqual([]);
    expect(badge(ctx({ stats, where }), 'ct-EU')).toMatchObject({ done: europe.length - 1, goal: europe.length });
    // Naming a country is not placing it.
    expect(badge(ctx({ stats: { 'name:FR': learnt }, where: { FR: 'c' } }), 'ct-EU').done).toBe(0);
  });

  it('give a country in detail for all the regions of one, at the level they were played', () => {
    const spain = index.countries.find((c) => c.id === 'ES')!;
    const g1 = spain.lv.find((l) => l.k === 'g1')!;
    const stats: Record<string, Stat> = {};
    const where: Record<string, string> = {};
    for (let i = 0; i < g1.n; i++) {
      stats[`loc:ES-X${i}`] = learnt;
      where[`ES-X${i}`] = 'r|ES|g1';
    }
    expect(earned(ctx({ stats, where }))).toEqual(['detail']);
    expect(badge(ctx({ stats, where }), 'regions100')).toMatchObject({ done: g1.n, goal: 100 });
    // The same regions counted against the provinces are far from all of them.
    for (const id of Object.keys(where)) where[id] = 'r|ES|f';
    expect(isEarned(badge(ctx({ stats, where }), 'detail'))).toBe(false);
  });

  it('count capitals, flags, cities, features and neighbours apart', () => {
    const stats: Record<string, Stat> = { 'cap:FR': learnt, 'cap:ES-M': learnt, 'flag:FR': learnt, 'nb:FR': learnt, 'loc:ES:madrid': learnt, 'loc:r:ebro': learnt, 'loc:p:teide': learnt, 'cap:PT': once };
    const where = { 'ES:madrid': 't|ES', 'r:ebro': 'p', 'p:teide': 'p' };
    const c = ctx({ stats, where });
    expect(badge(c, 'caps50').done).toBe(2);
    expect(badge(c, 'flags50').done).toBe(1);
    expect(badge(c, 'nb25').done).toBe(1);
    expect(badge(c, 'cities100').done).toBe(1);
    expect(badge(c, 'phys50').done).toBe(2);
  });

  it('reward keeping at it, full marks and the daily streak', () => {
    expect(earned(ctx({ tot: { g: 1, q: 5 } }))).toEqual(['first']);
    expect(earned(ctx({ tot: { g: 25, q: 1000 } }))).toEqual(['first', 'g25', 'q1000']);
    expect(earned(ctx({ tot: { g: 100, q: 10 } }))).toEqual(['first', 'g25', 'g100']);
    // Full marks need a game of ten questions or more.
    expect(earned(ctx({ sessions: [session(9, 9), session(10, 9)] }))).toEqual([]);
    expect(earned(ctx({ sessions: [session(10, 10)] }))).toEqual(['perfect']);
    expect(earned(ctx({ best: { 'daily:streak': 2 } }))).toEqual([]);
    expect(earned(ctx({ best: { 'daily:streak': 7 } }))).toEqual(['streak3', 'streak7']);
    expect(earned(ctx({ best: { 'daily:streak': 31 } }))).toEqual(['streak3', 'streak7', 'streak30']);
  });

  it('reward each of the new games', () => {
    expect(earned(ctx({ tot: { lessons: 10 } }))).toEqual(['lessons10']);
    expect(earned(ctx({ tot: { regionle1: 1 } }))).toEqual(['regionle1']);
    expect(earned(ctx({ tot: { near: 3 } }))).toEqual(['near']);
    expect(earned(ctx({ best: { 'nameall:r:ES.g1': 61_000 } }))).toEqual(['fill']);
    expect(earned(ctx({ best: { 'timed:pin:r:ES.g1': 19, 'timed:identify:c:FR,ES': 20 } }))).toEqual(['timed20']);
    expect(earned(ctx({ best: { 'lives:pin:r:ES.g1': 29 } }))).toEqual([]);
    expect(earned(ctx({ best: { 'lives:pin:r:ES.g1': 30 } }))).toEqual(['lives30']);
    expect(earned(ctx({ lists: [{ id: 'l1', name: 'x', section: 'regions', countries: ['ES'], levels: {}, ids: ['a', 'b'] }] }))).toEqual(['list']);
    // Progress never shows more than the goal.
    expect(badge(ctx({ best: { 'lives:pin:r:ES.g1': 300 } }), 'lives30').done).toBe(30);
  });

  it('count the records of harder rules, and not those of easier ones', () => {
    // Twenty in half a minute are twenty in a minute; in two minutes or in five they are not.
    expect(earned(ctx({ best: { 'timed30:pin:r:ES.g1': 20 } }))).toEqual(['timed20']);
    expect(earned(ctx({ best: { 'timed120:pin:r:ES.g1': 99, 'timed300:pin:r:ES.g1': 99 } }))).toEqual([]);
    // Thirty with one life are thirty with three; with five they are not.
    expect(earned(ctx({ best: { 'lives1:pin:r:ES.g1': 30 } }))).toEqual(['lives30']);
    expect(earned(ctx({ best: { 'lives5:pin:r:ES.g1': 99 } }))).toEqual([]);
    expect(badge(ctx({ best: { 'timed:pin:r:ES.g1': 7, 'timed30:pin:r:ES.g1': 12, 'timed120:pin:r:ES.g1': 40 } }), 'timed20').done).toBe(12);
    expect(badge(ctx({ best: { 'lives:pin:r:ES.g1': 7, 'lives1:pin:r:ES.g1': 3, 'lives5:pin:r:ES.g1': 40 } }), 'lives30').done).toBe(7);
  });

  it('reward the cards, the medley, the game by ear and a ten in an exam', () => {
    const played = (mode: SessionRec['mode'], total: number, ok: number): SessionRec => ({ ...session(total, ok), mode });
    expect(badge(ctx({ tot: { cards: 99 } }), 'cards100')).toMatchObject({ done: 99, goal: 100 });
    expect(earned(ctx({ tot: { cards: 100 } }))).toEqual(['cards100']);
    // A medley and a game by ear of ten or more, all right first time: each its own, on top of the full marks of any game.
    expect(earned(ctx({ sessions: [played('mix', 10, 10)] }))).toEqual(['perfect', 'mixfull']);
    expect(earned(ctx({ sessions: [played('listen', 12, 12)] }))).toEqual(['perfect', 'ear']);
    expect(earned(ctx({ sessions: [played('mix', 9, 9), played('listen', 10, 9), played('pin', 10, 10)] }))).toEqual(['perfect']);
    // The mark of an exam is kept in tenths, and only that of a whole map.
    expect(earned(ctx({ best: { 'exam:pin:r:ES.g1': 99 } }))).toEqual([]);
    expect(earned(ctx({ best: { 'exam:pin:r:ES.g1': 85, 'exam:mix:c:FR,ES': 100 } }))).toEqual(['exam10']);
  });

  it('reward the days in a row, by the longest run written down or still on the calendar', () => {
    const on = (first: string, n: number): Days => Object.fromEntries(Array.from({ length: n }, (_, i) => [new Date(Date.parse(`${first}T00:00:00Z`) + i * 864e5).toISOString().slice(0, 10), [1, 5, 5, 100, 0]]));
    expect(earned(ctx({ best: { 'study:streak': 6 } }))).toEqual([]);
    expect(earned(ctx({ best: { 'study:streak': 7 } }))).toEqual(['study7']);
    expect(earned(ctx({ best: { 'study:streak': 30 } }))).toEqual(['study7', 'study30']);
    // A player from before the calendar has days and no run written down.
    expect(earned(ctx({ days: on('2026-11-01', 7) }))).toEqual(['study7']);
    expect(badge(ctx({ days: on('2026-11-01', 4), best: { 'study:streak': 2 } }), 'study30')).toMatchObject({ done: 4, goal: 30 });
    // A run that is no longer on the calendar still counts.
    expect(badge(ctx({ days: on('2026-11-01', 2), best: { 'study:streak': 12 } }), 'study30').done).toBe(12);
    // The run of daily challenges is another thing.
    expect(earned(ctx({ best: { 'daily:streak': 7 } }))).not.toContain('study7');
  });

  it('reward ten days with the daily goal met', () => {
    const days: Days = {};
    for (let i = 1; i <= 9; i++) days[`2026-11-${String(i).padStart(2, '0')}`] = [1, 20, 10, 100, 1];
    days['2026-11-20'] = [3, 400, 300, 100, 0];
    expect(badge(ctx({ days }), 'goal10')).toMatchObject({ done: 9, goal: 10 });
    days['2026-11-21'] = [1, 20, 20, 100, 1];
    expect(earned(ctx({ days }))).toContain('goal10');
    // Without the calendar there is nothing to count, and nothing breaks.
    expect(badge(ctx(), 'goal10').done).toBe(0);
  });

  it('reward the capitals and the flags of the whole world, and the continents with their oceans', () => {
    const members = index.countries.filter((c) => c.cl === 'un');
    const stats: Record<string, Stat> = {};
    for (const c of members) stats[`flag:${c.id}`] = learnt;
    // The flag of a territory and a capital seen once add nothing.
    stats['flag:GI'] = learnt;
    stats['cap:FR'] = once;
    stats['cap:ES'] = learnt;
    // The capital of a region is a capital learnt, not one of the 193.
    stats['cap:ES-M'] = learnt;
    const c = ctx({ stats });
    expect(badge(c, 'flagsUN')).toMatchObject({ done: members.length, goal: members.length });
    expect(badge(c, 'capsUN')).toMatchObject({ done: 1, goal: 193 });
    expect(earned(c)).toEqual(['flags50', 'flagsUN']);

    const sea: Record<string, Stat> = {};
    const where: Record<string, string> = {};
    for (const id of EARTH_IDS) {
      sea[`loc:${id}`] = learnt;
      where[id] = 'p';
    }
    // Named, not placed: another skill.
    sea['name:c:europe'] = learnt;
    expect(badge(ctx({ stats: sea, where }), 'earth')).toMatchObject({ done: 11, goal: 11 });
    delete sea['loc:s:southern-ocean'];
    expect(badge(ctx({ stats: sea, where }), 'earth').done).toBe(10);
  });

  it('keep what was earned: a medal given is not taken back', () => {
    // Full marks are read from the latest sessions, and the game keeps only so many.
    const once = ctx({ sessions: [session(10, 10)] });
    expect(earned(once)).toEqual(['perfect']);
    const later = ctx({ sessions: [session(10, 3)], earned: { perfect: NOW } });
    expect(earned(later)).toEqual(['perfect']);
    expect(badge(later, 'perfect')).toMatchObject({ done: 1, goal: 1 });
    // A list that was made and deleted, a continent learnt and then missed, a goal met on a day no longer kept.
    expect(earned(ctx({ earned: { list: NOW, 'ct-EU': NOW, goal10: NOW } }))).toEqual(['ct-EU', 'goal10', 'list']);
    const europe = index.countries.filter((c) => c.cl === 'un' && c.ct === 'EU');
    expect(badge(ctx({ earned: { 'ct-EU': NOW } }), 'ct-EU')).toMatchObject({ done: europe.length, goal: europe.length });
    // What was never earned is still counted as it is, and a date for a medal that does not exist adds nothing.
    expect(badge(later, 'g25').done).toBe(0);
    expect(earned(ctx({ earned: { nothing: NOW } }))).toEqual([]);
  });

  it('name the continents and the oceans as the physical map does', () => {
    const phys = JSON.parse(fs.readFileSync('public/data/physical.json', 'utf8')) as { f: { i: string; k: string }[] };
    const whole = phys.f.filter((f) => f.k === 'continent' || f.k === 'ocean').map((f) => f.i);
    expect([...EARTH_IDS].sort()).toEqual(whole.sort());
    expect(EARTH_IDS).toHaveLength(11);
  });
});

describe('levels', () => {
  it('start at one and climb at each threshold', () => {
    expect(levelOfPoints(0)).toMatchObject({ n: 1, from: 0, next: LEVEL_AT[1], part: 0 });
    expect(levelOfPoints(LEVEL_AT[1] - 1).n).toBe(1);
    expect(levelOfPoints(LEVEL_AT[1]).n).toBe(2);
    expect(levelOfPoints(400)).toMatchObject({ n: 2, from: 200, next: 600, part: 0.5 });
    for (let n = 1; n < LEVEL_AT.length; n++) {
      expect(LEVEL_AT[n]).toBeGreaterThan(LEVEL_AT[n - 1]);
      expect(levelOfPoints(LEVEL_AT[n]).n).toBe(n + 1);
    }
  });

  it('stop at the top, with a name for each step', () => {
    const top = levelOfPoints(1_000_000);
    expect(top).toMatchObject({ n: LEVEL_AT.length, next: null, part: 1 });
    const names = LEVEL_AT.map((at) => levelOfPoints(at).name);
    expect(new Set(names).size).toBe(LEVEL_AT.length);
    for (const name of names) expect(name).toBeTruthy();
  });

  it('are paid in right answers and achievements', () => {
    expect(pointsOf({}, 0)).toBe(0);
    expect(pointsOf({ ok: 12, warn: 3, q: 40 }, 2)).toBe(12 * POINTS.ok + 3 * POINTS.warn + 2 * POINTS.badge);
  });
});
