// @vitest-environment jsdom
/** Where the ghosts are kept: what is read from the browser, what is written to it, and who is told. */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ghost, Kept } from './ghost';
import { GHOSTS_KEY, anyGhost } from './ghostLazy';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Keeper = typeof import('./ghostKept');
/** The module as a page that has just been opened finds it: with nothing read yet. */
async function opened(): Promise<Keeper> {
  vi.resetModules();
  return import('./ghostKept');
}

const A = 'regions|pin|a';
const B = 'countries|flag|b';
/** Ten questions, eight right first time, in so many seconds. */
const ghost = (seconds: number, t = 1000): Ghost => ({ k: 7, h: 99, t, q: [3, 3, 3, 3, 3, 3, 3, 3, 4, 5], d: seconds * 10 });
/** The same, all ten right. */
const full = (seconds: number, t = 2000): Ghost => ({ k: 8, h: 99, t, q: Array(10).fill(3), d: seconds * 10 });
const stored = (): unknown => JSON.parse(localStorage.getItem(GHOSTS_KEY) ?? 'null');
const store = (list: unknown): void => localStorage.setItem(GHOSTS_KEY, typeof list === 'string' ? list : JSON.stringify(list));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the ghosts kept in the browser', () => {
  it('are read once, and only what is a ghost under the name of a game', async () => {
    store([[A, ghost(20)], ['nonsense', ghost(20)], [B, { ...ghost(30), q: 'x' }], [B, full(30)]]);
    const kept = await opened();
    expect(kept.ghostsKept()).toEqual([
      [A, ghost(20)],
      [B, full(30)],
    ]);
    expect(kept.ghostOf(A)).toEqual(ghost(20));
    expect(kept.ghostOf(B)).toEqual(full(30));
    expect(kept.ghostOf('regions|pin|zz')).toBeNull();
    // What this page has read stands until something says otherwise: the same list every time it is asked for.
    expect(kept.ghostsKept()).toBe(kept.ghostsKept());
  });

  it('are none when nothing is kept, or what is kept cannot be read', async () => {
    expect((await opened()).ghostsKept()).toEqual([]);
    for (const junk of ['{not json', '{"a":1}', '"text"', '5', 'null', '']) {
      store(junk);
      expect((await opened()).ghostsKept(), junk).toEqual([]);
    }
    // Whether there may be any is asked without reading them: it is a matter of something being kept under their name.
    localStorage.clear();
    expect(anyGhost()).toBe(false);
    store([[A, ghost(20)]]);
    expect(anyGhost()).toBe(true);
  });

  it('are none where the browser gives no storage, and nothing breaks', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const kept = await opened();
    expect(anyGhost()).toBe(false);
    expect(kept.ghostsKept()).toEqual([]);
    // What a game leaves lasts as long as the page does.
    expect(kept.keepGhost(A, ghost(20))).toEqual(ghost(20));
    expect(kept.ghostOf(A)).toEqual(ghost(20));
    expect(() => kept.clearGhosts()).not.toThrow();
    expect(kept.ghostsKept()).toEqual([]);
  });
});

describe('a game that ends', () => {
  it('leaves its ghost when there was none, and is told which one stands', async () => {
    const kept = await opened();
    const mine = ghost(20);
    expect(kept.keepGhost(A, mine)).toBe(mine);
    expect(stored()).toEqual([[A, mine]]);
    expect(anyGhost()).toBe(true);
    // Read back by a page opened later.
    expect((await opened()).ghostOf(A)).toEqual(mine);
  });

  it('takes the place of the ghost there was only when it is the better one', async () => {
    const kept = await opened();
    const first = ghost(20);
    kept.keepGhost(A, first);
    const slower = ghost(25, 5000);
    // The one that stands is given back: the game's own as it was handed in, and the one from before as it is read.
    expect(kept.keepGhost(A, slower)).toEqual(first);
    expect(kept.keepGhost(A, slower)).not.toBe(slower);
    expect(stored()).toEqual([[A, first]]);
    const faster = ghost(15, 6000);
    expect(kept.keepGhost(A, faster)).toBe(faster);
    const better = full(90, 7000);
    expect(kept.keepGhost(A, better)).toBe(better);
    expect(stored()).toEqual([[A, better]]);
    // A game that was not played to the end leaves nothing, and the ghost stays.
    expect(kept.keepGhost(A, null)).toEqual(better);
    // …unless it is of questions the map no longer deals.
    expect(kept.keepGhost(A, null, true)).toBeNull();
    expect(localStorage.getItem(GHOSTS_KEY)).toBeNull();
    expect(anyGhost()).toBe(false);
  });

  it('reads what is kept again before writing: what another tab has kept since is not lost', async () => {
    const kept = await opened();
    kept.keepGhost(A, ghost(20));
    // Another tab keeps the ghost of another game, and a better one of this: no word of it has reached this page.
    store([[B, full(30)], [A, full(40)]]);
    expect(kept.keepGhost(A, ghost(10, 9000))).toEqual(full(40));
    expect(stored()).toEqual([
      [A, full(40)],
      [B, full(30)],
    ]);
  });

  it('keeps its ghost for as long as the page lasts when the browser has no room', async () => {
    const kept = await opened();
    kept.keepGhost(A, ghost(20));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const better = full(30);
    expect(kept.keepGhost(A, better)).toBe(better);
    expect(kept.ghostOf(A)).toBe(better);
    // The browser still holds the one from before.
    expect(stored()).toEqual([[A, ghost(20)]]);
  });
});

describe('the ghosts of a copy, and none at all', () => {
  it('take the place of the ones here, cleaned', async () => {
    const kept = await opened();
    kept.keepGhost(A, ghost(20));
    kept.setGhosts([[B, full(30)], ['junk'], [B, ghost(5)]]);
    expect(kept.ghostsKept()).toEqual([[B, full(30)]]);
    expect(stored()).toEqual([[B, full(30)]]);
    // A copy with nothing that is a ghost leaves none, and nothing kept under their name.
    kept.setGhosts('nonsense');
    expect(kept.ghostsKept()).toEqual([]);
    expect(localStorage.getItem(GHOSTS_KEY)).toBeNull();
  });

  it('are all gone when the progress is deleted', async () => {
    const kept = await opened();
    kept.keepGhost(A, ghost(20));
    kept.keepGhost(B, full(30));
    kept.clearGhosts();
    expect(kept.ghostsKept()).toEqual([]);
    expect(localStorage.getItem(GHOSTS_KEY)).toBeNull();
    expect(anyGhost()).toBe(false);
  });
});

describe('a screen that shows a ghost', () => {
  let box: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    box = document.createElement('div');
    document.body.append(box);
    root = createRoot(box);
  });
  afterEach(() => {
    act(() => root.unmount());
    box.remove();
  });

  /** What a screen draws of the ghosts: the names of their games, and the time of each. */
  const screen = (kept: Keeper) => () => createElement('p', null, kept.useGhosts().map(([key, g]: Kept) => `${key}=${g.d}`).join(' '));

  it('follows what becomes of it: a game that ends, a copy, the progress deleted', async () => {
    store([[A, ghost(20)]]);
    const kept = await opened();
    await act(async () => root.render(createElement(screen(kept))));
    expect(box.textContent).toBe(`${A}=200`);
    act(() => void kept.keepGhost(A, ghost(15)));
    expect(box.textContent).toBe(`${A}=150`);
    act(() => void kept.keepGhost(B, full(30)));
    expect(box.textContent).toBe(`${B}=300 ${A}=150`);
    act(() => kept.setGhosts([[A, full(9)]]));
    expect(box.textContent).toBe(`${A}=90`);
    act(() => kept.clearGhosts());
    expect(box.textContent).toBe('');
  });

  it('follows what another tab keeps', async () => {
    const kept = await opened();
    await act(async () => root.render(createElement(screen(kept))));
    expect(box.textContent).toBe('');
    store([[B, full(30)]]);
    // Nothing has told this page yet.
    expect(kept.ghostsKept()).toEqual([]);
    act(() => void window.dispatchEvent(new StorageEvent('storage', { key: GHOSTS_KEY })));
    expect(box.textContent).toBe(`${B}=300`);
    // What another tab keeps of anything else is none of its business…
    store([[A, ghost(20)]]);
    act(() => void window.dispatchEvent(new StorageEvent('storage', { key: 'regionle:v1' })));
    expect(box.textContent).toBe(`${B}=300`);
    // …and a storage emptied whole is.
    localStorage.clear();
    act(() => void window.dispatchEvent(new StorageEvent('storage', { key: null })));
    expect(box.textContent).toBe('');
  });

  it('is no longer told once it is gone', async () => {
    const kept = await opened();
    const draw = vi.fn(screen(kept));
    await act(async () => root.render(createElement(draw)));
    const drawn = draw.mock.calls.length;
    act(() => root.render(null));
    act(() => void kept.keepGhost(A, ghost(20)));
    expect(draw.mock.calls.length).toBe(drawn);
  });
});
