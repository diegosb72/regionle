import { describe, expect, it } from 'vitest';
import { SECTION_IDS } from './modes';
import { PATHS } from './routes';
import { SHORTCUT_KEYS, shortcutOf } from './shortcuts';

describe('keys that work on any screen', () => {
  it('open the sections with 1 to 5, in the order of the menu', () => {
    expect(['1', '2', '3', '4', '5'].map((key) => shortcutOf({ key }))).toEqual(SECTION_IDS.map((id) => ({ kind: 'go', path: PATHS[id] })));
    expect(SHORTCUT_KEYS.sections.map((s) => s.section)).toEqual([...SECTION_IDS]);
    expect(shortcutOf({ key: '0' })).toBeNull();
    expect(shortcutOf({ key: '6' })).toBeNull();
  });

  it('open the daily challenge with R and the progress with P, in either case', () => {
    expect(shortcutOf({ key: 'r' })).toEqual({ kind: 'go', path: 'reto' });
    expect(shortcutOf({ key: 'R' })).toEqual({ kind: 'go', path: 'reto' });
    expect(shortcutOf({ key: 'p' })).toEqual({ kind: 'go', path: 'progreso' });
  });

  it('change the theme with T and show the help with ?', () => {
    expect(shortcutOf({ key: 't' })).toEqual({ kind: 'theme' });
    expect(shortcutOf({ key: '?' })).toEqual({ kind: 'help' });
  });

  it('are no other key', () => {
    for (const key of ['a', 'Enter', ' ', 'Escape', 'ArrowLeft', 'F5', 'Tab', '+', 'Shift']) expect(shortcutOf({ key })).toBeNull();
  });

  it('stand aside for the shortcuts of the browser', () => {
    expect(shortcutOf({ key: 'r', ctrl: true })).toBeNull();
    expect(shortcutOf({ key: 'r', meta: true })).toBeNull();
    expect(shortcutOf({ key: 't', ctrl: true })).toBeNull();
    expect(shortcutOf({ key: 'p', alt: true })).toBeNull();
  });

  it('stand aside while something is typed or a map holds the keyboard', () => {
    for (const key of ['1', 'r', 'p', 't', '?']) expect(shortcutOf({ key, busy: true })).toBeNull();
  });

  it('do not take anyone out of a game, nor change its colours: there only the help works', () => {
    for (const key of ['1', '4', 'r', 'p', 't']) expect(shortcutOf({ key, playing: true })).toBeNull();
    expect(shortcutOf({ key: '?', playing: true })).toEqual({ kind: 'help' });
  });

  it('are none at all once turned off', () => {
    for (const key of ['1', 'r', 'p', 't', '?']) expect(shortcutOf({ key, off: true })).toBeNull();
  });
});
