/**
 * The number on the icon of the installed game: how many reviews are waiting. Browsers that know how to
 * badge an icon do it for an installed web app (`navigator.setAppBadge`); the rest are left alone.
 *
 * Reviews come due as time goes by, with the game closed as well. The page cannot count then, so it gives
 * the service worker the count from each moment on for the days ahead (`badgeSchedule`), and the worker puts
 * the right one on the icon whenever the browser wakes it for that (periodic background sync, where there
 * is such a thing). Where there is not, the icon says what was waiting the last time the game was open.
 */
import { dueCount, dueGroups } from './review';
import type { Stat } from './store';

const HOUR = 3_600_000;
/** How far ahead the count is worked out, and how often within that. */
export const BADGE_DAYS = 10;
export const BADGE_STEP = 4 * HOUR;
/** The name the worker knows the periodic refresh by. */
export const BADGE_SYNC = 'badge';

/** A step of the schedule: from this moment on, this many are waiting. */
export type BadgeStep = [at: number, count: number];

/** How many reviews are waiting at a moment: the same count the first page gives. */
export function waitingAt(stats: Record<string, Stat>, where: Record<string, string>, now: number): number {
  return dueCount(dueGroups(stats, where, now));
}

/**
 * The count of waiting reviews from `now` on, for the next `BADGE_DAYS` days if nothing is answered meanwhile:
 * a step for each moment it changes, looked at every `BADGE_STEP`.
 */
export function badgeSchedule(stats: Record<string, Stat>, where: Record<string, string>, now: number): BadgeStep[] {
  const out: BadgeStep[] = [];
  let last = -1;
  for (let t = now; t <= now + BADGE_DAYS * 24 * HOUR; t += BADGE_STEP) {
    const count = waitingAt(stats, where, t);
    if (count !== last) out.push([t, count]);
    last = count;
  }
  return out;
}

/** What a schedule says at a moment: the count of the last step that has come; null before the first. */
export function badgeAt(schedule: readonly BadgeStep[], now: number): number | null {
  let count: number | null = null;
  for (const [at, n] of schedule) {
    if (at > now) break;
    count = n;
  }
  return count;
}

type BadgeNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

/** Can this browser put a number on the icon of an installed app? */
export function badgeSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof (navigator as BadgeNavigator).setAppBadge === 'function';
}

/** Puts the number on the icon, or takes it off when nothing is waiting. */
export function showBadge(count: number): void {
  const nav = navigator as BadgeNavigator;
  try {
    const done = count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.();
    // A browser that refuses (the app is not installed, the player said no) is left in peace.
    void done?.catch(() => undefined);
  } catch {
    // Same.
  }
}

/** Gives the worker the schedule to go by when the game is closed; null takes it away. */
export function tellWorker(schedule: BadgeStep[] | null): void {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: 'badge', schedule });
  } catch {
    // No worker to tell.
  }
}

/** Asks the browser to wake the worker now and then for the badge, where it does such things; or to stop. */
export async function keepBadgeFresh(on: boolean): Promise<void> {
  try {
    const reg = (await navigator.serviceWorker?.ready) as (ServiceWorkerRegistration & { periodicSync?: { register(tag: string, o: { minInterval: number }): Promise<void>; unregister(tag: string): Promise<void> } }) | undefined;
    const sync = reg?.periodicSync;
    if (!sync) return;
    if (!on) return await sync.unregister(BADGE_SYNC);
    const allowed = await navigator.permissions.query({ name: 'periodic-background-sync' as PermissionName });
    if (allowed.state === 'granted') await sync.register(BADGE_SYNC, { minInterval: 6 * HOUR });
  } catch {
    // Not installed, not allowed or not known: the badge is then what the page last said.
  }
}
