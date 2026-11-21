// @vitest-environment jsdom
/**
 * A screen whose code is fetched apart, drawn by React inside the boundary that catches what breaks: above
 * all, what happens when the code does not come.
 */
import { Suspense, act, createElement, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';
import { KEPT, lazyScreen, type LazyScreen } from './lazy';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Part = () => createElement('p', { id: 'part' }, 'el calendario');
const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/** A fetch that fails after a while, every time it is asked for: a browser that asks the network again. */
const failing = (ms: number) => vi.fn<() => Promise<ComponentType<object>>>(() => new Promise((_, reject) => setTimeout(() => reject(new TypeError('Failed to fetch dynamically imported module')), ms)));

let box: HTMLDivElement;
let root: Root;
/** What puts the boundary back, as its button does. */
let again: () => void;

const show = (screen: LazyScreen<object>) =>
  createElement(ErrorBoundary, {
    fallback: (error: Error, retry: () => void) => {
      again = retry;
      return createElement('p', { id: 'failed' }, error.message);
    },
    children: createElement(Suspense, { fallback: createElement('p', { id: 'wait' }, 'Cargando…') }, createElement(screen)),
  });
const said = (): string => box.textContent ?? '';

beforeEach(() => {
  box = document.createElement('div');
  document.body.append(box);
  root = createRoot(box);
  // React says in the console what a boundary has caught: here it is what is being looked at.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => root.unmount());
  box.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('a screen whose code is fetched apart, drawn inside its boundary', () => {
  it('tells its boundary, and asks once: it does not go on asking while the message to wait stays', async () => {
    for (const ms of [0, 5, 30]) {
      const load = failing(ms);
      const screen = lazyScreen(load);
      await act(async () => {
        root.render(show(screen));
      });
      await act(() => sleep(ms + 120));
      expect(said(), `failing after ${ms} ms`).toBe('Failed to fetch dynamically imported module');
      expect(load, `failing after ${ms} ms`).toHaveBeenCalledTimes(1);
      await act(async () => {
        root.render(null);
      });
    }
  });

  it('asks again when the screen is shown again, once for each time, and draws it when the code comes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let fail!: (reason: Error) => void;
    const load = vi.fn<() => Promise<ComponentType<object>>>(() => new Promise((_, reject) => (fail = reject)));
    const screen = lazyScreen(load);
    await act(async () => {
      root.render(show(screen));
    });
    expect(said()).toBe('Cargando…');
    await act(async () => fail(new TypeError('Failed to fetch dynamically imported module')));
    expect(said()).toBe('Failed to fetch dynamically imported module');
    expect(load).toHaveBeenCalledTimes(1);

    // The boundary is put back: the same failure, from a fetch of its own.
    await act(async () => again());
    expect(said()).toBe('Cargando…');
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => fail(new TypeError('Failed to fetch dynamically imported module')));
    expect(said()).toBe('Failed to fetch dynamically imported module');
    expect(load).toHaveBeenCalledTimes(2);

    // And now the code comes.
    load.mockImplementation(() => Promise.resolve(Part));
    await act(async () => again());
    expect(said()).toBe('el calendario');
    expect(load).toHaveBeenCalledTimes(3);
    expect(screen.here()).toBe(true);
    // It is here to stay: the failures of before, long forgotten, take nothing with them.
    vi.advanceTimersByTime(KEPT);
    await screen.ready();
    screen.warm();
    expect(load).toHaveBeenCalledTimes(3);
    await act(async () => {
      root.render(null);
    });
    act(() => root.render(show(screen)));
    expect(said()).toBe('el calendario');
  });

  it('is drawn at once, with no message to wait, when its code was fetched ahead of time', async () => {
    const load = vi.fn<() => Promise<ComponentType<object>>>(() => Promise.resolve(Part));
    const screen = lazyScreen(load);
    screen.warm();
    await screen.ready();
    expect(screen.here()).toBe(true);
    act(() => root.render(show(screen)));
    expect(said()).toBe('el calendario');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('asks again when it is shown after a fetch ahead of time that failed with nobody waiting', async () => {
    const load = failing(0);
    const screen = lazyScreen(load);
    screen.warm();
    await screen.ready();
    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.here()).toBe(true);

    load.mockImplementation(() => Promise.resolve(Part));
    await act(async () => {
      root.render(show(screen));
    });
    await act(() => sleep(20));
    expect(said()).toBe('el calendario');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('forgets after a while a failure that came when the screen had been left, and asks again', async () => {
    let fail!: (reason: Error) => void;
    const load = vi.fn<() => Promise<ComponentType<object>>>(() => new Promise((_, reject) => (fail = reject)));
    const screen = lazyScreen(load);
    await act(async () => {
      root.render(show(screen));
    });
    expect(said()).toBe('Cargando…');
    // The player goes somewhere else, and then the fetch fails: there is no boundary to tell.
    await act(async () => {
      root.render(null);
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fail(new TypeError('Failed to fetch dynamically imported module'));
    await screen.ready();
    vi.advanceTimersByTime(KEPT - 1);
    vi.useRealTimers();

    // Shown again before that while is over, it is still that failure, with nothing asked for…
    await act(async () => {
      root.render(show(screen));
    });
    expect(said()).toBe('Failed to fetch dynamically imported module');
    expect(load).toHaveBeenCalledTimes(1);
    // …which its boundary has now caught: the next time asks again.
    load.mockImplementation(() => Promise.resolve(Part));
    await act(async () => again());
    await act(() => sleep(20));
    expect(said()).toBe('el calendario');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps that failure when a boundary catches something else', async () => {
    let fail!: (reason: Error) => void;
    const load = vi.fn<() => Promise<ComponentType<object>>>(() => new Promise((_, reject) => (fail = reject)));
    const screen = lazyScreen(load);
    await act(async () => {
      root.render(show(screen));
    });
    await act(async () => {
      root.render(null);
    });
    fail(new TypeError('Failed to fetch dynamically imported module'));
    await screen.ready();

    // Another screen breaks, by a mistake of its own.
    const Broken = (): never => {
      throw new Error('roto a propósito');
    };
    await act(async () => {
      root.render(createElement(ErrorBoundary, { fallback: (error: Error) => createElement('p', null, error.message), children: createElement(Broken) }));
    });
    expect(said()).toBe('roto a propósito');
    await act(async () => {
      root.render(null);
    });

    await act(async () => {
      root.render(show(screen));
    });
    expect(said()).toBe('Failed to fetch dynamically imported module');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('asks again by itself, with the screen left, when that while is over', async () => {
    let fail!: (reason: Error) => void;
    const load = vi.fn<() => Promise<ComponentType<object>>>(() => new Promise((_, reject) => (fail = reject)));
    const screen = lazyScreen(load);
    await act(async () => {
      root.render(show(screen));
    });
    await act(async () => {
      root.render(null);
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fail(new TypeError('Failed to fetch dynamically imported module'));
    await screen.ready();
    vi.advanceTimersByTime(KEPT);
    vi.useRealTimers();

    load.mockImplementation(() => Promise.resolve(Part));
    await act(async () => {
      root.render(show(screen));
    });
    await act(() => sleep(20));
    expect(said()).toBe('el calendario');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('tells its boundary too when what the fetch fails with is not an error, and asks again the next time', async () => {
    const load = vi.fn<() => Promise<ComponentType<object>>>(() => Promise.reject('sin conexión'));
    const screen = lazyScreen(load);
    await act(async () => {
      root.render(show(screen));
    });
    await act(() => sleep(20));
    expect(said()).toBe('sin conexión');
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => again());
    await act(() => sleep(20));
    expect(said()).toBe('sin conexión');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
