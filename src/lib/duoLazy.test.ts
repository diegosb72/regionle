// @vitest-environment jsdom
/** What a game of two draws comes in a file of its own: when it is fetched, and what happens when it does not come. */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Lazy = typeof import('./duoLazy');

let box: HTMLDivElement;
let root: Root;

/** A page that asks for that code when `wanted`, and says whether it has it. */
function Probe({ lazy, wanted }: { lazy: Lazy; wanted: boolean }) {
  const code = lazy.useDuoCode(wanted);
  return createElement('p', null, code ? `here:${typeof code.DuoBoard}` : 'not here');
}
const said = (): string => box.textContent ?? '';
/** Lets what is being fetched arrive. */
const settle = async () => {
  for (let i = 0; i < 5; i++) await act(async () => void (await new Promise((done) => setTimeout(done, 0))));
};

beforeEach(() => {
  vi.resetModules();
  box = document.createElement('div');
  document.body.append(box);
  root = createRoot(box);
});

afterEach(() => {
  act(() => root.unmount());
  box.remove();
  vi.doUnmock('../games/Duo');
  vi.restoreAllMocks();
});

describe('the code that draws a game of two', () => {
  it('is fetched once, and is the same for whoever asks for it again', async () => {
    const lazy = await import('./duoLazy');
    const first = lazy.duoCode();
    expect(lazy.duoCode()).toBe(first);
    const code = await first;
    expect(typeof code?.DuoBoard).toBe('function');
    expect(typeof code?.DuoResults).toBe('function');
    expect(await lazy.duoCode()).toBe(code);
  });

  it('is not asked for until it is wanted, and is there a moment after it is', async () => {
    const lazy = await import('./duoLazy');
    const fetch = vi.fn(() => ({ DuoBoard: () => null }));
    vi.doMock('../games/Duo', fetch);
    act(() => root.render(createElement(Probe, { lazy, wanted: false })));
    await settle();
    expect(said()).toBe('not here');
    expect(fetch).not.toHaveBeenCalled();
    act(() => root.render(createElement(Probe, { lazy, wanted: true })));
    expect(said()).toBe('not here');
    await settle();
    expect(said()).toBe('here:function');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('is there at once for whoever comes after it has been fetched', async () => {
    const lazy = await import('./duoLazy');
    await lazy.duoCode();
    act(() => root.render(createElement(Probe, { lazy, wanted: false })));
    // Here already, wanted or not: nothing is fetched to show it.
    expect(said()).toBe('here:function');
  });

  it('is nothing when it does not come, and is asked for again the next time', async () => {
    const lazy = await import('./duoLazy');
    vi.doMock('../games/Duo', () => {
      throw new Error('no connection');
    });
    expect(await lazy.duoCode()).toBeNull();
    act(() => root.render(createElement(Probe, { lazy, wanted: true })));
    await settle();
    expect(said()).toBe('not here');
    // The connection is back: whoever asks again gets it.
    vi.doUnmock('../games/Duo');
    vi.doMock('../games/Duo', () => ({ DuoBoard: () => null }));
    const code = await lazy.duoCode();
    expect(typeof code?.DuoBoard).toBe('function');
  });

  it('is not given to a page that has gone by the time it arrives', async () => {
    const lazy = await import('./duoLazy');
    const warn = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    act(() => root.render(createElement(Probe, { lazy, wanted: true })));
    act(() => root.render(createElement('p', null, 'another page')));
    await settle();
    expect(said()).toBe('another page');
    expect(warn).not.toHaveBeenCalled();
  });
});
