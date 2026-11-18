/**
 * What the browser keeps is read while the store is being made, before the rest of its module has run:
 * anything that reading needs has to exist by then. A constant declared further down the file does not,
 * and the whole reading is then dropped without a word — the player opens the game and finds it empty.
 * A compiled build can hide it (the constant is written into the code that uses it), so it is tested
 * here, on the modules as they are written.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const NAME = 'regionle:v1';

/** A browser storage with `kept` in it. */
function storageWith(kept: unknown): Map<string, string> {
  const items = new Map<string, string>([[NAME, JSON.stringify(kept)]]);
  const localStorage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
  // The store asks the window for it.
  vi.stubGlobal('window', { localStorage });
  return items;
}

describe('what the browser keeps is read as the store is made', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('with everything the reading needs already in place', async () => {
    storageWith({
      version: 2,
      state: {
        welcomed: true,
        lang: 'en',
        dayGoal: 50,
        stats: { 'flag:ES': [2, 2, 2, 5], 'flag:FR': [1, 1, 1, 6], 'loc:ES-M': [3, 3, 3, 7] },
        where: { 'ES-M': 'r|ES|f' },
        notes: { 'ES-M': '  In   the middle ' },
        mix: { 'loc:ES-CC>ES-BA': [2, 9] },
        sessions: [{ t: 1_700_000_000_000, section: 'regions', mode: 'pin', label: 'España', total: 10, ok: 6, warn: 1, bad: 3, ms: 60_000 }],
      },
    });
    vi.resetModules();
    const { useStore } = await import('./store');
    expect(useStore.persist.hasHydrated()).toBe(true);
    const s = useStore.getState();
    expect(s.lang).toBe('en');
    expect(s.dayGoal).toBe(50);
    expect(Object.keys(s.stats)).toHaveLength(3);
    // What each part of the reading makes of it: the note tidied, the album started from the flags learnt,
    // the tallies and the calendar from the sessions.
    expect(s.notes).toEqual({ 'ES-M': 'In the middle' });
    expect(s.album).toEqual({ ES: 5 });
    expect(s.tot.g).toBe(1);
    expect(Object.keys(s.days)).toHaveLength(1);
  });

  it('and what an older version kept is brought up to date on the way', async () => {
    const items = storageWith({ version: 1, state: { welcomed: true, opts: { answer: 'choice' }, stats: { 'flag:JP': [4, 4, 4, 8] } } });
    vi.resetModules();
    const { useStore } = await import('./store');
    expect(useStore.persist.hasHydrated()).toBe(true);
    expect(useStore.getState().opts.answer).toBe('type');
    expect(useStore.getState().album).toEqual({ JP: 8 });
    // Written back in the form of today.
    const saved = JSON.parse(items.get(NAME)!) as { version: number; state: { album: Record<string, number> } };
    expect(saved.version).toBe(2);
    expect(saved.state.album).toEqual({ JP: 8 });
  });
});
