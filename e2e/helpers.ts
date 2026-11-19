import { expect, type Page } from '@playwright/test';

/** The options of a game, as the setup screen leaves them; without the Wikipedia card, which asks another site. */
export const OPTS = { answer: 'type', length: 10, suggest: false, pinBy: 'name', metric: 'pop', blind: false, labels: true, cityPick: 'top', cityCount: 10, wiki: false, format: 'normal' };

/** "Señalar" on the autonomous communities of Spain: nineteen pieces. */
export const PIN_SPAIN = { section: 'regions', mode: 'pin', countries: ['ES'], levels: { ES: 'g1' }, opts: OPTS, nonce: 1 };

/**
 * What the game finds kept in the browser when it opens: by default, a player who has been here before
 * (no welcome, and no rules shown before the first question of a game). Written once, before the first
 * page: what the game saves afterwards stays.
 */
export async function seed(page: Page, state: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript((kept) => {
    if (sessionStorage.getItem('e2e')) return;
    sessionStorage.setItem('e2e', '1');
    localStorage.setItem('regionle:v1', JSON.stringify({ state: { welcomed: true, helpAuto: false, ...kept }, version: 2 }));
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

/** Any game seeded as the one in course, and its screen once it is ready. */
export async function start(page: Page, game: Record<string, unknown>): Promise<void> {
  await seed(page, { game: { levels: {}, nonce: 1, ...game, opts: { ...OPTS, ...((game.opts as object) ?? {}) } } });
  await page.goto('./#/jugar');
  await expect(page.locator('main#contenido')).toBeVisible();
  await expect(page.locator('.play-loading')).toHaveCount(0, { timeout: 30_000 });
}

/**
 * Another game in the same browser, once `start` has been through: what the first one left kept stays, and
 * only the game in course changes. (A second `start` would not do: what is seeded is written once.)
 */
export async function restart(page: Page, game: Record<string, unknown>): Promise<void> {
  await page.evaluate((next) => {
    const saved = JSON.parse(localStorage.getItem('regionle:v1')!) as { state: Record<string, unknown> };
    saved.state.game = next;
    localStorage.setItem('regionle:v1', JSON.stringify(saved));
  }, { levels: {}, nonce: 2, ...game, opts: { ...OPTS, ...((game.opts as object) ?? {}) } });
  await page.goto('./#/jugar');
  await page.reload();
  await expect(page.locator('main#contenido')).toBeVisible();
  await expect(page.locator('.play-loading')).toHaveCount(0, { timeout: 30_000 });
}

/** Writes an answer and sends it. */
export async function type(page: Page, text: string): Promise<void> {
  await page.locator('.answer-input').fill(text);
  await page.keyboard.press('Enter');
}
