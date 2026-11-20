import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { worldOf, opensWithWorld, untouched } from './opening';
import { DEFAULT_SEL, useStore } from './store';
import type { Country } from './types';
import { eligible } from './world';

const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as { countries: Country[] };

describe('what a section opens with', () => {
  it('is what the game keeps for someone who has never chosen anything', () => {
    expect(useStore.getState().sel).toEqual(DEFAULT_SEL);
    // A copy: choosing something does not change what a section opens with.
    expect(useStore.getState().sel).not.toBe(DEFAULT_SEL);
    expect(DEFAULT_SEL.pops).toHaveLength(20);
  });

  it('is told from a choice of the player, whatever the order', () => {
    expect(untouched('pops', DEFAULT_SEL.pops)).toBe(true);
    expect(untouched('pops', [...DEFAULT_SEL.pops].reverse())).toBe(true);
    expect(untouched('pops', DEFAULT_SEL.pops.slice(1))).toBe(false);
    expect(untouched('pops', [...DEFAULT_SEL.pops, 'PT'])).toBe(false);
    expect(untouched('pops', [...DEFAULT_SEL.pops.slice(1), 'PT'])).toBe(false);
    // The same count with one of them twice is not the same choice.
    expect(untouched('pops', [...DEFAULT_SEL.pops.slice(1), DEFAULT_SEL.pops[1]])).toBe(false);
    expect(untouched('pops', [])).toBe(false);
    expect(untouched('regions', ['ES'])).toBe(true);
    expect(untouched('regions', ['FR'])).toBe(false);
  });
});

describe('the game that opens with the world', () => {
  it('is "Conexiones", and only while no countries have been chosen', () => {
    expect(opensWithWorld('pops', 'connect', DEFAULT_SEL.pops)).toBe(true);
    expect(opensWithWorld('pops', 'connect', [...DEFAULT_SEL.pops].reverse())).toBe(true);
    // A choice of the player is the player's, however short of a board it falls.
    expect(opensWithWorld('pops', 'connect', ['ES', 'FR', 'PT'])).toBe(false);
    expect(opensWithWorld('pops', 'connect', [...DEFAULT_SEL.pops, 'PT'])).toBe(false);
    // The other games of the section keep the twenty they open with.
    for (const mode of ['hilo', 'topten', 'truefalse', 'oddone', 'pairs', 'alphabet'] as const) expect(opensWithWorld('pops', mode, DEFAULT_SEL.pops), mode).toBe(false);
    // And no other section has such a game.
    expect(opensWithWorld('countries', 'connect', DEFAULT_SEL.countries)).toBe(false);
  });

  it('takes the countries of the shortcut "Mundo": every one the section plays with, less the dependencies', () => {
    const pool = index.countries.filter((c) => eligible('pops', c));
    const world = worldOf(pool);
    expect(world.length).toBeGreaterThan(190);
    expect(new Set(world).size).toBe(world.length);
    const byId = new Map(index.countries.map((c) => [c.id, c]));
    for (const id of world) expect(byId.get(id)!.cl, id).not.toBe('dep');
    for (const c of pool) expect(world.includes(c.id), c.id).toBe(c.cl !== 'dep');
    // The twenty of always are among them: nothing is lost by opening wider.
    for (const id of DEFAULT_SEL.pops) expect(world, id).toContain(id);
  });
});
