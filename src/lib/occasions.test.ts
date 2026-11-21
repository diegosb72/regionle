import fs from 'node:fs';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { addDays, isDate } from '../daily/spec';
import { setLoader } from './data';
import { isOccasion, type OccasionRec } from './datedKept';
import { deckFor } from './decks';
import { countPhys, parsePhys } from './extra';
import { ARAB_LEAGUE, EU, SPANISH } from './groups';
import { setLang } from './i18n';
import {
  OCCASIONS,
  OCCASION_DAYS,
  POPULOUS,
  daysTo,
  editionOn,
  occasionDate,
  occasionDone,
  occasionEnd,
  occasionGame,
  occasionName,
  occasionNext,
  occasionOf,
  occasionQuestions,
  occasionSeed,
  occasionWhat,
  occasionsOpen,
  occasionsPlayed,
  type Occasion,
} from './occasions';
import { DEFAULT_OPTS } from './store';
import type { Index } from './types';

const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as Index;
const physFile = JSON.parse(fs.readFileSync('public/data/physical.json', 'utf8')) as Parameters<typeof countPhys>[0];
const the = (id: string): Occasion => occasionOf(id)!;
const ids = (list: readonly { o: Occasion }[]): string[] => list.map((e) => e.o.id);
/** A day that is not in the calendar: one in the last days of the year, whose week ends in the next. */
const late: Occasion = { id: 'late', md: '12-28', name: ['Tarde', 'Late'], what: ['x', 'x'], ask: { section: 'regions', country: 'ES', level: 'g1' } };

/** How many questions each day has: its whole map, or twenty where the map has more. */
const QUESTIONS: Record<string, number> = {
  newyear: 14,
  wetlands: 27,
  ireland: 26,
  water: 20,
  earth: 20,
  spanish: 21,
  europe: 27,
  africa: 55,
  italy: 20,
  oceans: 20,
  portugal: 20,
  deserts: 19,
  canada: 13,
  usa: 51,
  argentina: 24,
  population: 30,
  france: 13,
  colombia: 33,
  peru: 26,
  india: 36,
  brazil: 27,
  mexico: 32,
  chile: 16,
  china: 31,
  germany: 16,
  spain: 52,
  un: 20,
  cities: 20,
  poland: 16,
  constitution: 19,
  mountains: 20,
  arabic: 22,
};

afterEach(() => setLang('es'));

describe('the calendar of the special days', () => {
  it('names each day once, with a name that can be kept, on a day that every year has, in the order of the year', () => {
    expect(OCCASIONS).toHaveLength(32);
    expect(new Set(OCCASIONS.map((o) => o.id)).size).toBe(OCCASIONS.length);
    for (const o of OCCASIONS) {
      expect(isOccasion(o.id), o.id).toBe(true);
      expect(o.md, o.id).toMatch(/^\d\d-\d\d$/);
      // A leap year and a common one: the 29th of February is no day for a challenge.
      expect(isDate(`2027-${o.md}`), o.id).toBe(true);
      expect(isDate(`2028-${o.md}`), o.id).toBe(true);
      expect(occasionOf(o.id)).toBe(o);
    }
    const days = OCCASIONS.map((o) => o.md);
    expect(days).toEqual([...days].sort());
    // No two on the same day: the first page would not know which comes first.
    expect(new Set(days).size).toBe(days.length);
    expect(occasionOf('nothing')).toBeUndefined();
  });

  it('says in both languages what each day is called and what it asks, each in its own words', () => {
    for (const lang of ['es', 'en'] as const) {
      setLang(lang);
      const names = OCCASIONS.map(occasionName);
      const whats = OCCASIONS.map(occasionWhat);
      expect(new Set(names).size, lang).toBe(OCCASIONS.length);
      expect(new Set(whats).size, lang).toBe(OCCASIONS.length);
      for (const text of [...names, ...whats]) {
        expect(text.trim(), lang).toBe(text);
        expect(text.length, text).toBeGreaterThan(5);
        // They go inside sentences: none ends with a full stop, none carries a straight quote.
        expect(text, lang).not.toMatch(/[.:'"]$|'/);
      }
    }
    setLang('es');
    expect([occasionName(the('europe')), occasionWhat(the('europe'))]).toEqual(['Día de Europa', 'Los países de la Unión Europea']);
    setLang('en');
    expect([occasionName(the('europe')), occasionWhat(the('europe'))]).toEqual(['Europe Day', 'The countries of the European Union']);
  });

  it('asks the regions of a country that has them at that level, on a map of its own', () => {
    const regional = OCCASIONS.filter((o) => o.ask.section === 'regions');
    expect(regional).toHaveLength(18);
    for (const o of regional) {
      if (o.ask.section !== 'regions') continue;
      const { country, level } = o.ask;
      const rec = index.countries.find((c) => c.id === country);
      expect(rec, o.id).toBeDefined();
      const lv = rec!.lv.find((l) => l.k === level);
      expect(lv, o.id).toBeDefined();
      // Enough pieces for four options, and for a game worth a day.
      expect(lv!.n, o.id).toBeGreaterThanOrEqual(12);
      expect(fs.existsSync(`public/data/r/${country}.json`), o.id).toBe(true);
    }
    // Spain has two days: its provinces on one, its communities on the other.
    expect([the('spain').ask, the('constitution').ask]).toEqual([
      { section: 'regions', country: 'ES', level: 'f' },
      { section: 'regions', country: 'ES', level: 'g1' },
    ]);
  });

  it('asks the countries its day is about: the ones the index has, each once, in the order of their codes', () => {
    const of = (id: string): string[] => {
      const { ask } = the(id);
      return ask.section === 'countries' ? ask.of(index) : [];
    };
    const known = new Set(index.countries.map((c) => c.id));
    for (const o of OCCASIONS.filter((x) => x.ask.section === 'countries')) {
      const list = of(o.id);
      expect(list.length, o.id).toBeGreaterThanOrEqual(12);
      expect(list, o.id).toEqual([...list].sort());
      expect(new Set(list).size, o.id).toBe(list.length);
      expect(list.every((id) => known.has(id)), o.id).toBe(true);
    }
    const continent = (id: string) => index.countries.find((c) => c.id === id)!.ct;
    expect(of('newyear')).toHaveLength(14);
    expect(of('newyear').every((id) => continent(id) === 'OC')).toBe(true);
    expect(of('africa')).toHaveLength(55);
    expect(of('africa').every((id) => continent(id) === 'AF')).toBe(true);
    expect(of('spanish')).toEqual([...SPANISH].sort());
    expect(of('europe')).toEqual([...EU].sort());
    expect(of('europe')).toHaveLength(27);
    expect(of('arabic')).toEqual([...ARAB_LEAGUE].sort());
    expect(of('un')).toHaveLength(193);
    expect(of('un').every((id) => index.countries.find((c) => c.id === id)!.cl === 'un')).toBe(true);
    // Capitals that are not in the name of their country: the game would drop the others.
    expect(of('cities')).toHaveLength(181);
    expect(of('cities')).not.toContain('LU');
  });

  it('takes for the most populous the thirty members with most people, whatever order the index has them in', () => {
    const { ask } = the('population');
    if (ask.section !== 'countries') throw new Error('not countries');
    const list = ask.of(index);
    expect(list).toHaveLength(POPULOUS);
    for (const id of ['CN', 'IN', 'US', 'ID', 'PK', 'NG', 'BR', 'BD', 'RU', 'MX', 'JP', 'ET', 'PH', 'EG', 'DE', 'FR', 'GB']) expect(list, id).toContain(id);
    const least = Math.min(...list.map((id) => index.countries.find((c) => c.id === id)!.pop ?? 0));
    const out = index.countries.filter((c) => c.cl === 'un' && !list.includes(c.id));
    expect(Math.max(...out.map((c) => c.pop ?? 0))).toBeLessThanOrEqual(least);
    expect(ask.of({ ...index, countries: [...index.countries].reverse() })).toEqual(list);
    // Members only: a territory would not be among them however many people it had.
    const territory = index.countries.find((c) => c.cl !== 'un')!;
    expect(ask.of({ ...index, countries: [...index.countries.filter((c) => c !== territory), { ...territory, pop: 2_000_000_000 }] })).toEqual(list);
  });

  it('knows how many pieces each physical map has: what the file of the physical map holds for its words', () => {
    const physical = OCCASIONS.filter((o) => o.ask.section === 'physical');
    expect(physical.map((o) => o.id)).toEqual(['wetlands', 'water', 'earth', 'oceans', 'deserts', 'mountains']);
    for (const o of physical) {
      if (o.ask.section !== 'physical') continue;
      expect(countPhys(physFile, parsePhys([...o.ask.tokens])), o.id).toBe(o.ask.pieces);
      // Its words are ones the physical map understands: none is lost on the way.
      const spec = parsePhys([...o.ask.tokens]);
      expect([...spec.kinds, ...(spec.all ? ['all'] : [])].sort(), o.id).toEqual([...o.ask.tokens].sort());
      expect(spec.places, o.id).toEqual([]);
    }
  });

  it('says how many questions each day has: its whole map, or twenty where the map has more', () => {
    expect(Object.fromEntries(OCCASIONS.map((o) => [o.id, occasionQuestions(o, index)]))).toEqual(QUESTIONS);
    // A map with fewer pieces than the day asks for gives what it has.
    expect(occasionQuestions({ ...late, ask: { section: 'physical', tokens: ['lake'], pieces: 7, length: 20 } }, index)).toBe(7);
    expect(occasionQuestions({ ...late, ask: { section: 'physical', tokens: ['lake'], pieces: 27, length: 10 } }, index)).toBe(10);
    // A country or a level the index does not have: nothing to ask.
    expect(occasionQuestions({ ...late, ask: { section: 'regions', country: 'XX', level: 'f' } }, index)).toBe(0);
    expect(occasionQuestions({ ...late, ask: { section: 'regions', country: 'ES', level: 'zz' } }, index)).toBe(0);
  });
});

describe('the map each day is played on', () => {
  beforeAll(() => {
    setLoader(async (p) => JSON.parse(fs.readFileSync(`public/data/${p}`, 'utf8')));
  });

  it('has the pieces the calendar says, so that the game has the questions the first page promises', async () => {
    for (const o of OCCASIONS) {
      const game = occasionGame(o, 2026, index, DEFAULT_OPTS);
      const deck = await deckFor({ ...game, nonce: 1 });
      const length = game.opts.length;
      expect(typeof length === 'number' ? Math.min(length, deck.items.length) : deck.items.length, o.id).toBe(QUESTIONS[o.id]);
      if (o.ask.section === 'physical') expect(deck.items.length, o.id).toBe(o.ask.pieces);
      // Four options take four pieces to choose among.
      expect(deck.items.length, o.id).toBeGreaterThanOrEqual(12);
    }
  }, 60_000);
});

describe('the week a challenge is open', () => {
  it('begins on its day and lasts seven days, that one among them', () => {
    expect(OCCASION_DAYS).toBe(7);
    expect(occasionDate(the('europe'), 2026)).toBe('2026-05-09');
    expect(occasionEnd(the('europe'), 2026)).toBe('2026-05-15');
    // Across the end of a month, and of a year.
    expect(occasionEnd(the('peru'), 2026)).toBe('2026-08-03');
    expect(occasionEnd(late, 2026)).toBe('2027-01-03');
    for (const o of OCCASIONS) expect(occasionEnd(o, 2027), o.id).toBe(addDays(occasionDate(o, 2027), 6));
  });

  it('is open from its day to the last of its week, and not the day before nor the day after', () => {
    const o = the('europe');
    expect(editionOn(o, '2026-05-08')).toBeNull();
    for (const day of ['2026-05-09', '2026-05-10', '2026-05-12', '2026-05-15']) expect(editionOn(o, day), day).toBe(2026);
    expect(editionOn(o, '2026-05-16')).toBeNull();
    expect(editionOn(o, '2027-05-09')).toBe(2027);
    expect(editionOn(o, '2026-11-21')).toBeNull();
  });

  it('is still the one of the year before when its week goes into January', () => {
    expect(editionOn(late, '2026-12-27')).toBeNull();
    expect(editionOn(late, '2026-12-28')).toBe(2026);
    expect(editionOn(late, '2026-12-31')).toBe(2026);
    expect(editionOn(late, '2027-01-01')).toBe(2026);
    expect(editionOn(late, '2027-01-03')).toBe(2026);
    expect(editionOn(late, '2027-01-04')).toBeNull();
    expect(editionOn(late, '2027-12-28')).toBe(2027);
    // The first day of the year has a challenge of its own, of the year that begins.
    expect(editionOn(the('newyear'), '2027-01-01')).toBe(2027);
    expect(editionOn(the('newyear'), '2027-01-07')).toBe(2027);
    expect(editionOn(the('newyear'), '2026-12-31')).toBeNull();
    expect(editionOn(the('newyear'), '2027-01-08')).toBeNull();
  });

  it('lists the challenges open on a day, the one that opened last first', () => {
    expect(occasionsOpen('2026-11-21')).toEqual([]);
    expect(occasionsOpen('2026-05-09')).toEqual([{ o: the('europe'), year: 2026 }]);
    expect(ids(occasionsOpen('2026-07-14'))).toEqual(['france', 'population', 'argentina']);
    expect(ids(occasionsOpen('2026-07-15'))).toEqual(['france', 'population', 'argentina']);
    expect(ids(occasionsOpen('2026-07-16'))).toEqual(['france', 'population']);
    expect(ids(occasionsOpen('2026-12-11'))).toEqual(['mountains', 'constitution']);
    expect(ids(occasionsOpen('2026-12-12'))).toEqual(['mountains', 'constitution']);
    expect(ids(occasionsOpen('2026-12-13'))).toEqual(['mountains']);
    // One that opened in December comes after one that opened in January, which is later.
    const open = occasionsOpen('2027-01-02', [the('newyear'), late]);
    expect(open).toEqual([
      { o: the('newyear'), year: 2027 },
      { o: late, year: 2026 },
    ]);
    // Two of the same day, were there any: by name, whatever order the list has them in.
    const twin = { ...late, id: 'also' };
    expect(ids(occasionsOpen('2026-12-29', [late, twin]))).toEqual(['also', 'late']);
    expect(ids(occasionsOpen('2026-12-29', [twin, late]))).toEqual(['also', 'late']);
  });

  it('is never more than three at once, and there is one at some time of every month', () => {
    let most = 0;
    const months = new Set<string>();
    for (let day = '2027-01-01'; day <= '2027-12-31'; day = addDays(day, 1)) {
      const open = occasionsOpen(day);
      most = Math.max(most, open.length);
      if (open.length) months.add(day.slice(5, 7));
    }
    expect(most).toBe(3);
    expect([...months].sort()).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']);
  });

  it('says which challenge opens next after a day: never one that is open already, and the first of the next year after the last', () => {
    expect(occasionNext('2026-11-21')).toEqual({ o: the('constitution'), year: 2026 });
    expect(occasionNext('2026-12-05')).toEqual({ o: the('constitution'), year: 2026 });
    // On its own day it is open: the next is the one after it.
    expect(occasionNext('2026-12-06')).toEqual({ o: the('mountains'), year: 2026 });
    expect(occasionNext('2026-12-17')).toEqual({ o: the('arabic'), year: 2026 });
    expect(occasionNext('2026-12-18')).toEqual({ o: the('newyear'), year: 2027 });
    expect(occasionNext('2026-12-31')).toEqual({ o: the('newyear'), year: 2027 });
    expect(occasionNext('2027-01-01')).toEqual({ o: the('wetlands'), year: 2027 });
    expect(occasionNext('2026-07-10')).toEqual({ o: the('population'), year: 2026 });
    // Whatever order the list is in; and nothing where there is no day at all.
    expect(occasionNext('2026-11-21', [...OCCASIONS].reverse())).toEqual({ o: the('constitution'), year: 2026 });
    expect(occasionNext('2026-11-21', [the('europe')])).toEqual({ o: the('europe'), year: 2027 });
    expect(occasionNext('2026-11-21', [])).toBeNull();
  });

  it('counts the days from one day to another', () => {
    expect(daysTo('2026-11-21', '2026-12-06')).toBe(15);
    expect(daysTo('2026-12-05', '2026-12-06')).toBe(1);
    expect(daysTo('2026-12-06', '2026-12-06')).toBe(0);
    expect(daysTo('2026-12-31', '2027-01-01')).toBe(1);
    // Across the 29th of February.
    expect(daysTo('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysTo('2027-02-28', '2027-03-01')).toBe(1);
  });
});

describe('the game of a special day', () => {
  const mine = { ...DEFAULT_OPTS, answer: 'type' as const, length: 10 as const, pinBy: 'flag' as const, turned: true, flagLook: 'grey' as const, format: 'lives' as const, labels: false, wiki: true };

  it('puts its questions in order with a seed of its day and its year, the same for everyone', () => {
    const seeds = OCCASIONS.flatMap((o) => [2026, 2027, 2028].map((year) => occasionSeed(o.id, year)));
    expect(new Set(seeds).size).toBe(seeds.length);
    for (const seed of seeds) {
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2_147_483_647);
    }
    // The ones of 2026 as they are: a change here would give players of the same day different games.
    expect([occasionSeed('constitution', 2026), occasionSeed('france', 2026), occasionSeed('europe', 2026)]).toEqual([1769514939, 1819004966, 210777438]);
  });

  it('is a medley of every piece of a country, with what changes the questions settled and the rest as the player likes it', () => {
    const game = occasionGame(the('france'), 2026, index, mine);
    expect(game).toMatchObject({ section: 'regions', mode: 'mix', countries: ['FR'], levels: { FR: 'g1' }, challenge: { seed: occasionSeed('france', 2026) }, occasion: { id: 'france', year: 2026 } });
    expect(game.opts).toMatchObject({ answer: 'choice', length: 'all', pinBy: 'name', turned: false, flagLook: 'plain', format: 'normal' });
    expect(game.opts).toMatchObject({ labels: false, wiki: true });
    // It is the challenge of a special day, and neither that of a week nor that of a zone.
    expect(game.weekly).toBeUndefined();
    expect(game.zone).toBeUndefined();
    // Two players with different tastes get the same game.
    const other = occasionGame(the('france'), 2026, index, DEFAULT_OPTS);
    expect([other.mode, other.countries, other.levels, other.challenge, other.opts.length]).toEqual([game.mode, game.countries, game.levels, game.challenge, game.opts.length]);
  });

  it('asks countries the way its day says, and of a physical map what its words say, as many as it says', () => {
    const flags = occasionGame(the('un'), 2026, index, mine);
    expect(flags).toMatchObject({ section: 'countries', mode: 'flag', levels: {}, occasion: { id: 'un', year: 2026 } });
    expect(flags.countries).toHaveLength(193);
    expect(flags.opts.length).toBe(20);
    expect(occasionGame(the('cities'), 2026, index, mine)).toMatchObject({ section: 'countries', mode: 'capital', opts: { length: 20 } });
    expect(occasionGame(the('europe'), 2026, index, mine)).toMatchObject({ section: 'countries', mode: 'mix', opts: { length: 'all' } });
    const earth = occasionGame(the('earth'), 2026, index, mine);
    expect(earth).toMatchObject({ section: 'physical', mode: 'mix', countries: ['continent', 'range', 'desert'], levels: {}, opts: { length: 20 } });
    expect(occasionGame(the('deserts'), 2026, index, mine)).toMatchObject({ countries: ['desert', 'all'], opts: { length: 'all' } });
    // The game has a list of its own: changing it does not change the calendar.
    earth.countries.push('river');
    expect(occasionGame(the('earth'), 2026, index, mine).countries).toEqual(['continent', 'range', 'desert']);
  });

  it('is another game each year, on the same map', () => {
    const [a, b] = [occasionGame(the('spain'), 2026, index, mine), occasionGame(the('spain'), 2027, index, mine)];
    expect(b.occasion).toEqual({ id: 'spain', year: 2027 });
    expect(b.challenge?.seed).not.toBe(a.challenge?.seed);
    expect([b.countries, b.levels, b.mode]).toEqual([a.countries, a.levels, a.mode]);
  });

  it('is, with no year, the same game for practice: a game like any other, with no seed and nothing to keep', () => {
    for (const o of OCCASIONS) {
      const practice = occasionGame(o, null, index, mine);
      const { challenge, occasion, ...rest } = occasionGame(o, 2026, index, mine);
      expect(challenge, o.id).toBeDefined();
      expect(occasion, o.id).toEqual({ id: o.id, year: 2026 });
      expect(practice, o.id).toEqual(rest);
      expect('challenge' in practice || 'occasion' in practice, o.id).toBe(false);
    }
  });
});

describe('what is kept of the special days', () => {
  const rec = (y: number, s = 86): OccasionRec => ({ y, s, ok: 16, n: 19, ms: 95_000, t: 1 });

  it('says whether the challenge of a year is done: only the one of that year counts', () => {
    expect(occasionDone(rec(2026), 2026)).toBe(true);
    expect(occasionDone(rec(2025), 2026)).toBe(false);
    expect(occasionDone(rec(2027), 2026)).toBe(false);
    expect(occasionDone(undefined, 2026)).toBe(false);
  });

  it('counts how many days of the calendar were played in a year', () => {
    expect(occasionsPlayed({}, 2026)).toBe(0);
    // One of another year, and one of a day the calendar no longer has, are not of this year's count.
    expect(occasionsPlayed({ europe: rec(2026), water: rec(2026), spain: rec(2025), gone: rec(2026) }, 2026)).toBe(2);
    expect(occasionsPlayed({ europe: rec(2026), water: rec(2026), spain: rec(2025), gone: rec(2026) }, 2025)).toBe(1);
  });
});
