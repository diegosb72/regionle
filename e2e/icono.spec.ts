import { expect, test, type Page } from '@playwright/test';
import { open, seed } from './helpers';

const HOUR = 3_600_000;
/** Five communities of Spain, learnt on their map: two reviews are waiting, a third comes tomorrow. */
function player(now: number) {
  const stat = (run: number, ago: number) => [3, 2, run, now - ago];
  return {
    stats: { 'loc:ES-AN': stat(0, 2 * HOUR), 'loc:ES-AR': stat(1, 20 * HOUR), 'loc:ES-CL': stat(1, 1 * HOUR), 'loc:ES-GA': stat(2, 24 * HOUR) },
    where: { 'ES-AN': 'r|ES|g1', 'ES-AR': 'r|ES|g1', 'ES-CL': 'r|ES|g1', 'ES-GA': 'r|ES|g1' },
  };
}

/** A browser that badges icons, and says what it was asked to show: a number, 0 when it was cleared. */
async function withBadges(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const calls: number[] = [];
    (window as unknown as { __badges: number[] }).__badges = calls;
    Object.defineProperty(navigator, 'setAppBadge', { value: (n: number) => (calls.push(n), Promise.resolve()), configurable: true });
    Object.defineProperty(navigator, 'clearAppBadge', { value: () => (calls.push(0), Promise.resolve()), configurable: true });
  });
}
const shown = (page: Page) => page.evaluate(() => (window as unknown as { __badges: number[] }).__badges.at(-1));
const toggle = (page: Page) => page.locator('.foot-prefs').getByRole('checkbox', { name: /Repasos pendientes en el icono/ });
/** The switch is pressed on its label: the box itself is drawn as a track with a knob. */
const flip = (page: Page) => page.locator('.foot-prefs label.toggle', { hasText: 'Repasos pendientes en el icono' }).click();

test.describe('the number on the icon', () => {
  test('is the reviews that are waiting, and goes when it is turned off', async ({ page }) => {
    await withBadges(page);
    await seed(page, player(Date.now()));
    await open(page);
    // The same count the first page gives.
    await expect(page.locator('.review')).toContainText('2');
    await expect.poll(() => shown(page)).toBe(2);
    await expect(toggle(page)).toBeChecked();
    await expect(page.locator('.foot-prefs')).toContainText('Con el juego instalado, su icono lleva el número de repasos que te esperan.');

    await flip(page);
    await expect(toggle(page)).not.toBeChecked();
    await expect.poll(() => shown(page)).toBe(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state.iconBadge)).toBe(false);
    // It stays off the next time, and is back when asked for.
    await page.reload();
    await expect(toggle(page)).not.toBeChecked();
    await expect.poll(() => shown(page)).toBe(0);
    await flip(page);
    await expect.poll(() => shown(page)).toBe(2);
  });

  test('is cleared when nothing is waiting', async ({ page }) => {
    await withBadges(page);
    await seed(page);
    await open(page);
    await expect.poll(() => shown(page)).toBe(0);
    await expect(toggle(page)).toBeChecked();
  });

  test('is not offered by a browser that cannot badge an icon', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'setAppBadge', { value: undefined, configurable: true });
    });
    await seed(page, player(Date.now()));
    await open(page);
    await expect(page.locator('.foot-prefs label.toggle').first()).toBeVisible();
    await expect(toggle(page)).toHaveCount(0);
  });
});

test.describe('the number on the icon, with the game closed', () => {
  test.use({ serviceWorkers: 'allow' });

  test('is left with the worker for the days ahead, which puts it on the icon when the browser wakes it', async ({ page, context }) => {
    const now = Date.now();
    await withBadges(page);
    await seed(page, player(now));
    await open(page);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    // The page tells the worker again when it is left; here, when it is looked at once more.
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const kept = async (): Promise<[number, number][] | null> =>
      page.evaluate(async () => {
        const cache = await caches.open('regionle-badge');
        const res = await cache.match(new URL('badge-schedule', document.baseURI.replace(/[^/]*$/, '')).href);
        return res ? ((await res.json()) as [number, number][]) : null;
      });
    await expect.poll(async () => (await kept())?.map((s) => s[1])).toEqual([2, 3, 4]);
    const schedule = (await kept())!;
    expect(Math.abs(schedule[0][0] - now)).toBeLessThan(60_000);

    // The worker, woken for the badge with nobody looking: today's count now, tomorrow's tomorrow.
    const worker = context.serviceWorkers()[0];
    const woken = (at: number) =>
      worker.evaluate(async (when) => {
        const scope = self as unknown as { navigator: object; dispatchEvent(e: Event): void };
        let last: number | null = null;
        Object.defineProperty(scope.navigator, 'setAppBadge', { value: async (n: number) => void (last = n), configurable: true });
        Object.defineProperty(scope.navigator, 'clearAppBadge', { value: async () => void (last = 0), configurable: true });
        const real = Date.now;
        Date.now = () => when;
        const waits: Promise<unknown>[] = [];
        const event = Object.assign(new Event('periodicsync'), { tag: 'badge', waitUntil: (p: Promise<unknown>) => void waits.push(p) });
        scope.dispatchEvent(event);
        await Promise.all(waits);
        Date.now = real;
        return last;
      }, at);
    expect(await woken(now + 60_000)).toBe(2);
    expect(await woken(now + 26 * HOUR)).toBe(3);
    expect(await woken(now + 80 * HOUR)).toBe(4);

    // Turned off, the worker forgets, and has nothing to put on the icon.
    await flip(page);
    await expect.poll(kept).toBeNull();
    expect(await woken(now + 26 * HOUR)).toBeNull();
  });
});
