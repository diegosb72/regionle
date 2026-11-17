import { expect, type Page } from '@playwright/test';

/** The options of a game, as the setup screen leaves them; without the Wikipedia card, which asks another site. */
export const OPTS = { answer: 'type', length: 10, suggest: false, pinBy: 'name', metric: 'pop', blind: false, labels: true, cityPick: 'top', cityCount: 10, wiki: false, format: 'normal' };

/** "Señalar" on the autonomous communities of Spain: nineteen pieces. */
export const PIN_SPAIN = { section: 'regions', mode: 'pin', countries: ['ES'], levels: { ES: 'g1' }, opts: OPTS, nonce: 1 };

/**
 * What the game finds kept in the browser when it opens: by default, a player who has been here before
 * (no welcome). Written once, before the first page: what the game saves afterwards stays.
 */
export async function seed(page: Page, state: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript((kept) => {
    if (sessionStorage.getItem('e2e')) return;
    sessionStorage.setItem('e2e', '1');
    localStorage.setItem('regionle:v1', JSON.stringify({ state: { welcomed: true, ...kept }, version: 2 }));
  }, state);
}

/** Opens an address of the game ("/regiones") and waits for its screen. */
export async function open(page: Page, route = '/'): Promise<void> {
  await page.goto(`./#${route}`);
  await expect(page.locator('main#contenido')).toBeVisible();
  await expect(page.locator('#root .spinner')).toHaveCount(0);
}

/** A game on the map, ready to be answered. */
export async function play(page: Page, game: Record<string, unknown> = PIN_SPAIN): Promise<void> {
  await seed(page, { game });
  await page.goto('./#/jugar');
  await expect(page.locator('.map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.q')).toContainText('Te quedan 3 intentos');
}

/** How many tries are left in the question on screen; -1 when it is over. */
export async function triesLeft(page: Page): Promise<number> {
  const text = (await page.locator('.q').textContent()) ?? '';
  return Number(/Te quedan? (\d+) intento/.exec(text)?.[1] ?? -1);
}
