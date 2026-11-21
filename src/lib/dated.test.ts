import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { datedName, datedNote, editionNow, keepDated } from './dated';
import type { DatedResult } from './datedKept';
import { setLang } from './i18n';
import { DEFAULT_OPTS, isDated, useStore, type GameConfig, type Opts } from './store';
import type { Deck, Index } from './types';
import { weekGame, weekSeed } from './weekly';
import { zoneGame, zoneSeed } from './zones';

const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as Index;

const result = (patch: Partial<DatedResult> = {}): DatedResult => ({ s: 86, ok: 41, n: 50, ms: 252_000, ...patch });
const game = (patch: Partial<GameConfig>): GameConfig => ({ section: 'countries', mode: 'mix', countries: ['ES', 'FR'], levels: {}, opts: DEFAULT_OPTS, nonce: 1, ...patch });
const places = { continents: { EU: { es: 'Europa', en: 'Europe' }, AF: { es: 'África', en: 'Africa' } }, subregions: {} };
const deckOf = (es: string, en: string): Deck => ({ items: [{ country: { n: { es, en } } }] }) as unknown as Deck;

beforeEach(() => {
  useStore.setState({ weekly: {}, zones: {} });
});
afterEach(() => setLang('es'));

describe('a game with a date', () => {
  it('is the challenge of a week or that of a day of a zone, and no other game', () => {
    expect(isDated(game({ weekly: '2026-11-16' }))).toBe(true);
    expect(isDated(game({ zone: { id: 'p:EU', date: '2026-11-20' } }))).toBe(true);
    expect(isDated(game({}))).toBe(false);
    expect(isDated(game({ daily: '2026-11-20' }))).toBe(false);
    expect(isDated(null)).toBe(false);
  });

  it('is called by what it is and where: the world or the continent of the week, the continent or the country of the day', () => {
    // The week of 16 November 2026 asks the world; the one of 5 January, Europe.
    expect(datedName(game({ weekly: '2026-11-16' }), deckOf('España', 'Spain'), places)).toBe('Reto de la semana · Mundo');
    expect(datedName(game({ weekly: '2026-01-05' }), deckOf('España', 'Spain'), places)).toBe('Reto de la semana · Europa');
    expect(datedName(game({ zone: { id: 'p:AF', date: '2026-11-20' } }), deckOf('Angola', 'Angola'), places)).toBe('Reto del día · África');
    // A country is named by the pieces of its map, which are its own.
    expect(datedName(game({ zone: { id: 'c:ES', date: '2026-11-20' } }), deckOf('España', 'Spain'), places)).toBe('Reto del día · España');
    expect(datedName(game({}), deckOf('España', 'Spain'), places)).toBeNull();
    setLang('en');
    expect(datedName(game({ weekly: '2026-01-05' }), deckOf('España', 'Spain'), places)).toBe('Weekly challenge · Europe');
    expect(datedName(game({ zone: { id: 'c:ES', date: '2026-11-20' } }), deckOf('España', 'Spain'), places)).toBe('Daily challenge · Spain');
  });

  it('is called by its code where the names of the continents are not at hand', () => {
    expect(datedName(game({ zone: { id: 'p:AF', date: '2026-11-20' } }), deckOf('Angola', 'Angola'))).toBe('Reto del día · AF');
  });
});

describe('a game with a date that is started when its date has passed', () => {
  const mine: Opts = { ...DEFAULT_OPTS, wiki: false, length: 20 };
  const week = (monday: string): GameConfig => ({ ...weekGame(monday, index, mine), nonce: 1 });
  const zone = (id: string, date: string): GameConfig => ({ ...zoneGame(id, date, index, mine)!, nonce: 1 });

  it('is the one it was all through its week, from its Monday to its Sunday', () => {
    for (const day of ['2026-11-16', '2026-11-19', '2026-11-22']) expect(editionNow(week('2026-11-16'), index, day), day).toBeNull();
  });

  it('becomes the challenge of the week it is now, with its own theme, countries and order', () => {
    // The week of the 16th is a medley of the world; that of the 23rd, the countries of Africa to tell apart.
    const next = editionNow(week('2026-11-16'), index, '2026-11-23')!;
    expect(next).toEqual(weekGame('2026-11-23', index, mine));
    expect(next).toMatchObject({ weekly: '2026-11-23', mode: 'identify', challenge: { seed: weekSeed('2026-11-23') } });
    expect(next.countries).not.toEqual(week('2026-11-16').countries);
    // Any later day of that week, and a week long gone, give the same one.
    expect(editionNow(week('2026-11-16'), index, '2026-11-27')).toEqual(next);
    expect(editionNow(week('2026-06-01'), index, '2026-11-27')).toEqual(next);
    // What the player had set that does not change the questions goes on to it.
    expect(next.opts.wiki).toBe(false);
  });

  it('is the one it was on its day, and becomes that of the day it is now in the same zone', () => {
    for (const id of ['p:EU', 'c:ES']) {
      expect(editionNow(zone(id, '2026-11-20'), index, '2026-11-20'), id).toBeNull();
      const next = editionNow(zone(id, '2026-11-20'), index, '2026-11-21')!;
      expect(next, id).toEqual(zoneGame(id, '2026-11-21', index, mine));
      expect(next, id).toMatchObject({ zone: { id, date: '2026-11-21' }, challenge: { seed: zoneSeed(id, '2026-11-21') } });
      // The same map, asked in another order.
      expect(next.countries, id).toEqual(zone(id, '2026-11-20').countries);
      expect(next.challenge?.seed, id).not.toBe(zone(id, '2026-11-20').challenge?.seed);
    }
    expect(editionNow(zone('c:ES', '2026-11-20'), index, '2026-11-21')!.levels).toEqual({ ES: 'g1' });
  });

  it('is the one of the day it is, too, when the clock has gone back', () => {
    expect(editionNow(zone('p:EU', '2026-11-20'), index, '2026-11-19')).toMatchObject({ zone: { id: 'p:EU', date: '2026-11-19' } });
    expect(editionNow(week('2026-11-23'), index, '2026-11-22')).toMatchObject({ weekly: '2026-11-16' });
  });

  it('is left as it is when its zone has no challenge any more, and is nothing to a game without a date', () => {
    expect(editionNow(game({ zone: { id: 'c:LU', date: '2026-11-20' } }), index, '2026-11-21')).toBeNull();
    expect(editionNow(game({ zone: { id: 'p:AN', date: '2026-11-20' } }), index, '2026-11-21')).toBeNull();
    expect(editionNow(game({}), index, '2026-11-21')).toBeNull();
    expect(editionNow(game({ daily: '2026-11-20' }), index, '2026-11-21')).toBeNull();
    // A challenge someone sent carries a seed and no date: it is the game it was whenever it is opened.
    expect(editionNow(game({ challenge: { seed: 7 } }), index, '2026-11-21')).toBeNull();
  });
});

describe('the result of the challenge of a week', () => {
  const cfg = game({ weekly: '2026-11-16' });

  it('goes on record the first time it is played to the end', () => {
    expect(keepDated(cfg, true, result())).toBe('new');
    expect(useStore.getState().weekly['2026-11-16']).toMatchObject(result());
    expect(datedNote('Reto de la semana · Mundo', cfg, 'new', 86)).toBe('Reto de la semana · Mundo: queda apuntado tu 86 %.');
  });

  it('stays as it was when the week is played again, and the results say what it was', () => {
    keepDated(cfg, true, result());
    expect(keepDated(cfg, true, result({ s: 100 }))).toBe(86);
    expect(useStore.getState().weekly['2026-11-16'].s).toBe(86);
    expect(datedNote('Reto de la semana · Mundo', cfg, 86, 100)).toBe('Reto de la semana · Mundo: ya tenías apuntado un 86 %. Cuenta la primera vez que se termina.');
  });

  it('says what it was, and not that it is still to be played, when the week is on record and the replay is left halfway', () => {
    keepDated(cfg, true, result());
    expect(keepDated(cfg, false, result({ n: 3, ok: 3, s: 100 }))).toBe(86);
    expect(useStore.getState().weekly['2026-11-16']).toMatchObject(result());
  });

  it('is not written down when the game is left before its end, which leaves the week to be played', () => {
    expect(keepDated(cfg, false, result({ n: 12, ok: 10 }))).toBe('short');
    expect(useStore.getState().weekly).toEqual({});
    expect(datedNote('Reto de la semana · Mundo', cfg, 'short', 80)).toBe('Reto de la semana · Mundo: lo has dejado antes del final y no se apunta. Puedes empezarlo otra vez.');
    // Played whole afterwards, it counts.
    expect(keepDated(cfg, true, result())).toBe('new');
  });

  it('says so in English too', () => {
    setLang('en');
    expect(datedNote('Weekly challenge · World', cfg, 'new', 86)).toBe('Weekly challenge · World: your 86% is on record.');
    expect(datedNote('Weekly challenge · World', cfg, 86, 100)).toBe('Weekly challenge · World: you already had 86% on record. The first time it is finished is the one that counts.');
    expect(datedNote('Weekly challenge · World', cfg, 'short', 80)).toBe('Weekly challenge · World: you left it before the end, so nothing goes on record. You can start it again.');
  });
});

describe('the result of the challenge of a day of a zone', () => {
  const on = (date: string): GameConfig => game({ zone: { id: 'c:ES', date } });

  it('goes on record the first time that day is played to the end', () => {
    expect(keepDated(on('2026-11-20'), true, result({ s: 90, ok: 9, n: 10 }))).toBe('new');
    expect(useStore.getState().zones['c:ES']).toMatchObject({ d: '2026-11-20', s: 90, run: 1 });
    expect(datedNote('Reto del día · España', on('2026-11-20'), 'new', 90)).toBe('Reto del día · España: queda apuntado tu 90 %.');
    expect(keepDated(on('2026-11-20'), true, result({ s: 100, ok: 10, n: 10 }))).toBe(90);
    expect(useStore.getState().zones['c:ES'].s).toBe(90);
  });

  it('says what it was when the day is on record and the replay is left halfway; and that it comes late, for an earlier day', () => {
    keepDated(on('2026-11-20'), true, result({ s: 90, ok: 9, n: 10 }));
    expect(keepDated(on('2026-11-20'), false, result({ s: 100, ok: 2, n: 2 }))).toBe(90);
    expect(keepDated(on('2026-11-19'), false, result({ s: 100, ok: 2, n: 2 }))).toBe('old');
    expect(useStore.getState().zones['c:ES']).toMatchObject({ d: '2026-11-20', s: 90, run: 1 });
  });

  it('says how many days in a row it makes, from the second on', () => {
    keepDated(on('2026-11-20'), true, result());
    expect(keepDated(on('2026-11-21'), true, result({ s: 70 }))).toBe('new');
    expect(datedNote('Reto del día · España', on('2026-11-21'), 'new', 70)).toBe('Reto del día · España: queda apuntado tu 70 %. Llevas 2 días seguidos.');
    setLang('en');
    expect(datedNote('Daily challenge · Spain', on('2026-11-21'), 'new', 70)).toBe('Daily challenge · Spain: your 70% is on record. That makes 2 days in a row.');
  });

  it('is not written down when it is left before its end, nor when a later day is already kept', () => {
    expect(keepDated(on('2026-11-20'), false, result())).toBe('short');
    expect(useStore.getState().zones).toEqual({});
    keepDated(on('2026-11-21'), true, result());
    // The game of the day before, finished late.
    expect(keepDated(on('2026-11-20'), true, result({ s: 100 }))).toBe('old');
    expect(useStore.getState().zones['c:ES']).toMatchObject({ d: '2026-11-21', s: 86, run: 1 });
    expect(datedNote('Reto del día · España', on('2026-11-20'), 'old', 100)).toBe('Reto del día · España: era de un día anterior al último que tienes apuntado, así que no cuenta.');
  });

  it('is nothing to a game without a date', () => {
    expect(keepDated(game({}), true, result())).toBeNull();
    expect(useStore.getState().weekly).toEqual({});
    expect(useStore.getState().zones).toEqual({});
  });
});
