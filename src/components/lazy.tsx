/**
 * A screen whose code is fetched when it is first shown, so that the first page does not carry the
 * whole game. `warm()` fetches it ahead of time; once it is here, the screen is drawn at once, without
 * the loading message that `React.lazy` alone would show the first time.
 */
import { createElement, lazy, useEffect, useReducer, useState, type ComponentType, type ReactElement } from 'react';

/** Code that is fetched apart, as far as waiting for it goes. */
export interface Part {
  /** Whether there is nothing to wait for: the code is here, or it was asked for and did not come. */
  here(): boolean;
  /** Fetches the code, and settles when it is here or when it has failed to come: it never rejects. */
  ready(): Promise<void>;
}

export interface LazyScreen<P> extends Part {
  (props: P): ReactElement;
  /** Fetches the code now. Safe to call many times; a failure is forgotten, so that it can be tried again. */
  warm(): void;
}

export function lazyScreen<P extends object>(load: () => Promise<ComponentType<P>>): LazyScreen<P> {
  let loaded: ComponentType<P> | null = null;
  let pending: Promise<ComponentType<P>> | null = null;
  let failed = false;

  const fetchIt = (): Promise<ComponentType<P>> =>
    (pending ??= load().then(
      (component) => (loaded = component),
      (error: unknown) => {
        // `React.lazy` keeps a failure for good: a new one is made so that showing the screen again asks again.
        pending = null;
        failed = true;
        waiting = fresh();
        throw error;
      },
    ));
  const fresh = (): ComponentType<P> => lazy(async () => ({ default: await fetchIt() })) as unknown as ComponentType<P>;
  let waiting = fresh();

  function Screen(props: P) {
    // Decided once for each time the screen is shown: swapping one for the other later would start it again.
    const [Use] = useState<ComponentType<P>>(() => loaded ?? waiting);
    return createElement(Use, props);
  }
  const ready = (): Promise<void> =>
    fetchIt().then(
      () => undefined,
      () => undefined,
    );
  const warm = (): void => {
    void ready();
  };
  const here = (): boolean => loaded != null || failed;
  return Object.assign(Screen, { warm, here, ready });
}

/**
 * Whether the code of all these parts is here; one that is not wanted is `null`. What is missing is fetched,
 * and the answer changes when it has come. A page that waits for it is drawn whole: with `Suspense` alone, a
 * part that arrives after the rest is shown a third of a second later at the soonest, and pushes down what
 * was already being read.
 */
export function useHere(parts: readonly (Part | null)[]): boolean {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const here = parts.every((p) => !p || p.here());
  const wanted = parts.map((p) => (p ? 1 : 0)).join('');
  useEffect(() => {
    if (here) return undefined;
    let on = true;
    void Promise.all(parts.map((p) => p?.ready())).then(() => {
      if (on) redraw();
    });
    return () => {
      on = false;
    };
    // The parts are the same from one draw to the next: what changes is which of them are wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here, wanted]);
  return here;
}

/** Runs `task` when the browser has nothing better to do, or soon enough where it cannot say. */
export function whenIdle(task: () => void, timeout = 4000): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const w = window as Window & { requestIdleCallback?: (fn: () => void, opts?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(task, { timeout });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(task, 1200);
  return () => window.clearTimeout(id);
}

/** The player has asked the browser to spend as little data as it can. */
export function savingData(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return c?.saveData === true;
}
