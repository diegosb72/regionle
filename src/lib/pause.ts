/**
 * The clock of a game, stopped from outside it: while a player reads how the game is played, its time does
 * not run. It is a count and not a switch: whoever stops it takes its own hold away, and nobody else's.
 */
import { useSyncExternalStore } from 'react';

let holds = 0;
const listeners = new Set<() => void>();
const tell = (): void => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Stops the clocks. What it returns lets them run again; calling that twice does nothing more. */
export function pauseClock(): () => void {
  holds += 1;
  tell();
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    holds -= 1;
    tell();
  };
}

export const clockPaused = (): boolean => holds > 0;

/** Whether the clocks are stopped, for whatever counts time on screen. */
export function usePaused(): boolean {
  return useSyncExternalStore(subscribe, clockPaused, () => false);
}
