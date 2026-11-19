/**
 * Miles instead of kilometres: a setting of the footer. What is shown changes (distances, surfaces, the
 * four distances to choose from); what is kept and judged stays in kilometres.
 */
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, seed } from './helpers';

const SPAIN = { section: 'regions', countries: ['ES'], levels: { ES: 'g1' }, nonce: 1 };
const DIST = { ...SPAIN, mode: 'bearing', opts: { ...OPTS, bearingAsk: 'dist' } };
const EXPLORE = { ...SPAIN, mode: 'explore', opts: OPTS };

/** A game in course for a player who has, or has not, asked for miles. */
async function start(page: Page, game: Record<string, unknown>, miles: boolean): Promise<void> {
  await seed(page, { miles, game });
  await page.goto('./#/jugar');
  await expect(page.locator('main#contenido')).toBeVisible();
  await expect(page.locator('.play-loading')).toHaveCount(0, { timeout: 30_000 });
}

const choices = (page: Page) => page.locator('.bearing-km .choice span');
const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`).first();
async function clickBy(page: Page, id: string): Promise<void> {
  const box = (await piece(page, id).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test.describe('miles instead of kilometres', () => {
  test('are turned on in the footer, change what the screen says at once and stay on', async ({ page }) => {
    // A player with a game behind them: the achievements are on the progress screen.
    await seed(page, { tot: { g: 1, q: 10, ok: 8, warn: 0, ms: 60_000 }, days: { '2026-11-17': [1, 10, 8, 60_000, 1] } });
    await open(page, '/progreso');
    const badge = page.locator('.badge', { hasText: 'Puntería' });
    const toggle = page.locator('.foot-prefs label.toggle', { hasText: 'Distancias en millas' });
    await expect(badge).toContainText('a menos de 10 km');
    await expect(toggle.locator('input')).not.toBeChecked();
    await expect(toggle).toContainText('Las altitudes siguen en metros.');

    await toggle.click();
    await expect(toggle.locator('input')).toBeChecked();
    await expect(badge).toContainText('a menos de 6 mi');

    await page.reload();
    await expect(badge).toContainText('a menos de 6 mi');
    await expect(toggle.locator('input')).toBeChecked();

    await toggle.click();
    await expect(badge).toContainText('a menos de 10 km');
  });

  test('deal the four distances in kilometres to whoever has not asked for miles', async ({ page }) => {
    await start(page, DIST, false);
    await expect(choices(page)).toHaveCount(4);
    for (const text of await choices(page).allTextContents()) expect(text).toMatch(/^[\d.]+ km$/);
  });

  test('deal the four distances as round figures of miles, and tell the answer in miles', async ({ page }) => {
    await start(page, DIST, true);
    // Castilla y León from Melilla: some 740 km, which are 460 miles.
    await expect(page.locator('.q-name')).toHaveText('Castilla y León');
    await expect(choices(page)).toHaveText(['110 mi', '180 mi', '290 mi', '460 mi']);
    await page.keyboard.press('4');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.verdict-head')).toContainText('460 mi');
    await expect(page.locator('.bearing-line')).toContainText('a unos 460 mi en línea recta.');
    // The surface of the card of facts, in square miles: 94.226 km² are 36.381 mi².
    await expect(page.locator('.verdict')).toContainText(/\d mi²/);
    await expect(page.locator('.verdict')).not.toContainText('km');
  });

  test('measure with the ruler of the map in miles', async ({ page }) => {
    await start(page, EXPLORE, true);
    await page.locator('label.toggle', { hasText: 'Regla para medir' }).click();
    await clickBy(page, 'ES-CL');
    await clickBy(page, 'ES-CT');
    await expect(page.locator('.ruler-km')).toHaveText(/^\d+ mi$/);
    // From the middle of Castilla y León to the middle of Cataluña: some five hundred kilometres, three hundred miles.
    const miles = Number(((await page.locator('.ruler-km').textContent()) ?? '').replace(/\D/g, ''));
    expect(miles).toBeGreaterThan(250);
    expect(miles).toBeLessThan(400);
  });
});
