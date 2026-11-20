/**
 * The countries a game opens with. Each section has its own (`DEFAULT_SEL` in lib/store.ts), and they do
 * for nearly every game. "Conexiones" is the exception: it takes countries that go four by four in one way
 * only, and the twenty the figures open with give hardly one board. Until the player chooses countries of
 * their own, it is played with the world.
 */
import { SHORTCUTS } from './groups';
import { DEFAULT_SEL } from './store';
import type { Country, Mode, Section } from './types';

/** Whether a selection is still the one its section opens with: the same things, in any order. */
export function untouched(section: Section, ids: readonly string[]): boolean {
  const usual = DEFAULT_SEL[section];
  return ids.length === usual.length && new Set(ids).size === ids.length && ids.every((id) => usual.includes(id));
}

/** Whether a game is played with the world while the player has chosen no countries. */
export const opensWithWorld = (section: Section, mode: Mode, ids: readonly string[]): boolean => section === 'pops' && mode === 'connect' && untouched(section, ids);

/** The countries of the shortcut "Mundo" among those a section plays with. */
export const worldOf = (pool: readonly Country[]): string[] => SHORTCUTS.find((sc) => sc.id === 'world')!.pick(pool);
