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
  /** Fetches the code now. Safe to call many times: while it is on its way, or here, nothing is asked for again. */
  warm(): void;
}

/** One fetch of the code of a screen. */
interface Attempt<P> {
  /** What it brings. */
  code: Promise<ComponentType<P>>;
  /** What draws the screen with it: it waits while the code is on its way, and breaks if it does not come. */
  screen: ComponentType<P>;
  /** Whether a screen has been drawn with it, and so waits for it. */
  shown: boolean;
}

/** A failure a screen was waiting for, until the boundary around the screen catches it. */
interface Kept {
  error: unknown;
  forget(): void;
}

/** How long a failure is kept for a boundary that does not catch it: the screen that waited for it was left before. */
export const KEPT = 10_000;

const uncaught = new Set<Kept>();
const drop = (kept: Kept): void => {
  uncaught.delete(kept);
  kept.forget();
};

/**
 * Says that a boundary has caught an error. If it was the code of a screen that did not come, it has told what
 * it had to tell: it is forgotten, and the next time the screen is shown its code is asked for again.
 */
export function caught(error: unknown): void {
  for (const kept of [...uncaught]) if (kept.error === error) drop(kept);
}

export function lazyScreen<P extends object>(load: () => Promise<ComponentType<P>>): LazyScreen<P> {
  let loaded: ComponentType<P> | null = null;
  let failed = false;
  /** The fetch that is on its way or has come; or the one that failed, while the screen that waited for it has still to say so. */
  let attempt: Attempt<P> | null = null;

  const begin = (): Attempt<P> => {
    const mine = { shown: false } as Attempt<P>;
    const forget = (): void => {
      if (attempt === mine) attempt = null;
    };
    mine.code = load().then(
      (component) => (loaded = component),
      (error: unknown) => {
        failed = true;
        if (mine.shown) {
          // A screen is waiting for this code, and has to be told it did not come: the failure stays until the
          // boundary around the screen has it (`caught`). Were it forgotten now, the screen would ask again as
          // React draws it again to tell, and again after that. A browser that keeps the failure of a file
          // answers each of those at once, and it ends there (Chromium did so for years); one that fetches the
          // file again never lets it end: the message that says to wait stays for good, with one request
          // after another behind it.
          const kept: Kept = { error, forget };
          uncaught.add(kept);
          setTimeout(() => drop(kept), KEPT);
        } else {
          // Fetched ahead of time, with nobody waiting: the next time asks again.
          forget();
        }
        throw error;
      },
    );
    // Whoever waits is told by `ready`, or by the screen: the failure is nobody else's to hear of.
    mine.code.catch(() => undefined);
    mine.screen = lazy(async () => ({ default: await mine.code })) as unknown as ComponentType<P>;
    return mine;
  };
  const current = (): Attempt<P> => (attempt ??= begin());

  function Screen(props: P) {
    // Decided once for each time the screen is shown: swapping one for the other later would start it again.
    const [Use] = useState<ComponentType<P>>(() => {
      if (loaded) return loaded;
      const mine = current();
      mine.shown = true;
      return mine.screen;
    });
    return createElement(Use, props);
  }
  const ready = (): Promise<void> =>
    current().code.then(
      () => undefined,
      () => undefined,
    );
  const warm = (): void => {
    void ready();
  };
  const here = (): boolean => loaded != null || failed;
  return Object.assign(Screen, { warm, here, ready });
}

/** How long a page waits for the code of its parts before it is drawn without them. */
export const PATIENCE = 5000;

/**
 * Whether the code of all these parts is here; one that is not wanted is `null`. What is missing is fetched,
 * and the answer changes when it has come. A page that waits for it is drawn whole: with `Suspense` alone, a
 * part that arrives after the rest is shown a third of a second later at the soonest, and pushes down what
 * was already being read.
 *
 * The wait has an end. Code that fails to come is over at once (`Part.here`), but a download can also stall,
 * neither arriving nor failing, and the page would wait for it for ever: after `patience` the answer is yes,
 * and a part that comes later is drawn then.
 */
export function useHere(parts: readonly (Part | null)[], patience = PATIENCE): boolean {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const here = parts.every((p) => !p || p.here());
  const wanted = parts.map((p) => (p ? 1 : 0)).join('');
  // The parts the wait was given up for: when others come to be wanted, they are waited for afresh.
  const [late, setLate] = useState<string | null>(null);
  useEffect(() => {
    if (here) return undefined;
    let on = true;
    void Promise.all(parts.map((p) => p?.ready())).then(() => {
      if (on) redraw();
    });
    const timer = setTimeout(() => setLate(wanted), patience);
    return () => {
      on = false;
      clearTimeout(timer);
    };
    // The parts are the same from one draw to the next: what changes is which of them are wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here, wanted]);
  return here || late === wanted;
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
