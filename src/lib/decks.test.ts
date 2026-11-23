/**
 * The map a game is played on (lib/decks.ts) and what comes with it: what is said of the countries besides
 * their figures (lib/facts.ts) is fetched for the games that ask about it or show it, and for no other.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { setLoader } from './data';
import { deckFor } from './decks';
import { FACT_EXTRAS, FACT_KINDS, PIN_BYS, factOf } from './rules';
import { DEFAULT_OPTS, type GameConfig, type Opts } from './store';
import type { Mode, Section } from './types';

const read = (file: string): unknown => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data', file), 'utf8'));
const game = (mode: Mode, opts: Partial<Opts> = {}, section: Section = 'countries'): GameConfig => ({ section, mode, countries: ['ES', 'FR', 'PT', 'IT'], levels: {}, opts: { ...DEFAULT_OPTS, ...opts }, nonce: 1 });

/** Reads the files from disk and says how many times the one of the facts was asked for; `down` makes that one fail. */
function loader(down = false): { facts: () => number } {
  let n = 0;
  setLoader(async (file) => {
    if (file === 'facts.json') {
      n++;
      if (down) throw new Error('sin red');
    }
    return read(file);
  });
  return { facts: () => n };
}

describe('the fact a game is about', () => {
  it('is the one chosen in the game that asks for them, and the currency when nothing is said', () => {
    for (const fact of FACT_KINDS) expect(factOf('countries', 'fact', { fact })).toBe(fact);
    expect(FACT_KINDS).toEqual(['currency', 'language', 'domain', 'dial']);
    expect(factOf('countries', 'fact', {})).toBe('currency');
    expect(factOf('countries', 'fact', { fact: 'anthem' as unknown as Opts['fact'] })).toBe('currency');
    // What "pin it" shows says nothing of what this game asks.
    expect(factOf('countries', 'fact', { fact: 'language', pinBy: 'dial' })).toBe('language');
  });

  it('is the domain or the dialling code "pin it" shows, and none when it shows a name, a capital or a flag', () => {
    expect(PIN_BYS).toEqual(['name', 'capital', 'flag', 'domain', 'dial']);
    expect(factOf('countries', 'pin', { pinBy: 'domain' })).toBe('domain');
    expect(factOf('countries', 'pin', { pinBy: 'dial' })).toBe('dial');
    for (const pinBy of ['name', 'capital', 'flag', 'currency', 'language', undefined]) expect(factOf('countries', 'pin', { pinBy, fact: 'dial' }), String(pinBy)).toBeNull();
  });

  it('is none in any other game, and none where the map is not one of countries', () => {
    for (const mode of ['identify', 'outline', 'capital', 'flag', 'mix', 'listen', 'explore', 'whoami', 'learn', 'cards'] as const) expect(factOf('countries', mode, { fact: 'dial', pinBy: 'dial' }), mode).toBeNull();
    for (const section of ['regions', 'cities', 'physical', 'pops'] as const) {
      expect(factOf(section, 'fact', { fact: 'language' }), section).toBeNull();
      expect(factOf(section, 'pin', { pinBy: 'domain' }), section).toBeNull();
    }
  });
});

describe('the map of a game', () => {
  it('brings the facts of the countries to the game that asks about them', async () => {
    const files = loader();
    const deck = await deckFor(game('fact', { fact: 'language' }));
    expect(deck.items.map((it) => it.id).sort()).toEqual(['ES', 'FR', 'IT', 'PT']);
    expect(deck.facts?.said('currency', 'ES')).toBe('euro');
    expect(deck.facts?.said('domain', 'PT')).toBe('.pt');
    expect(files.facts()).toBe(1);
    // Once for everybody: the next game does not ask for the file again.
    expect((await deckFor(game('fact', { fact: 'dial' }))).facts).toBe(deck.facts);
    expect(files.facts()).toBe(1);
  });

  it('brings them to "pin it" by a domain or a dialling code, and not by a name, a capital or a flag', async () => {
    const files = loader();
    for (const pinBy of ['name', 'capital', 'flag'] as const) expect((await deckFor(game('pin', { pinBy }))).facts, pinBy).toBeUndefined();
    expect(files.facts()).toBe(0);
    for (const pinBy of ['domain', 'dial'] as const) expect((await deckFor(game('pin', { pinBy }))).facts?.said('dial', 'ES'), pinBy).toBe('+34');
    expect(files.facts()).toBe(1);
  });

  it('brings them to the games that show them beside what they ask, and to no other', async () => {
    const files = loader();
    for (const mode of ['identify', 'outline', 'capital', 'flag', 'mix', 'learn', 'nameall'] as const) expect((await deckFor(game(mode, { fact: 'dial', pinBy: 'name' }))).facts, mode).toBeUndefined();
    expect(files.facts()).toBe(0);
    expect(FACT_EXTRAS).toEqual(['explore', 'whoami']);
    for (const mode of FACT_EXTRAS) expect((await deckFor(game(mode))).facts?.card('ES').length, mode).toBe(4);
    expect(files.facts()).toBe(1);
  });

  it('fetches nothing of them for a map that is not one of countries, whatever its game', async () => {
    const files = loader();
    const spain = { countries: ['ES'], levels: { ES: 'g1' } };
    for (const mode of ['explore', 'whoami', 'pin'] as const) expect((await deckFor({ ...game(mode, { pinBy: 'dial' }, 'regions'), ...spain })).facts, mode).toBeUndefined();
    expect((await deckFor({ ...game('explore', {}, 'cities'), countries: ['ES'] })).facts).toBeUndefined();
    expect(files.facts()).toBe(0);
  });

  it('cannot start a game about them when their file does not come, and starts the ones that only show them', async () => {
    const files = loader(true);
    await expect(deckFor(game('fact'))).rejects.toThrow('sin red');
    await expect(deckFor(game('pin', { pinBy: 'domain' }))).rejects.toThrow('sin red');
    // The card of "explore" and the clues of "who am I?" do without: the game is the one it always was.
    for (const mode of FACT_EXTRAS) {
      const deck = await deckFor(game(mode));
      expect(deck.items).toHaveLength(4);
      expect(deck.facts, mode).toBeUndefined();
    }
    // Asked for each time: a failure is not kept.
    expect(files.facts()).toBe(4);
    // And when it comes at last, the game starts.
    loader();
    expect((await deckFor(game('fact'))).facts?.said('language', 'PT')).toBe('portugués');
  });
});
