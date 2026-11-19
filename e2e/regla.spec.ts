import { expect, test, type Page } from '@playwright/test';
import { OPTS, seed, start } from './helpers';

const EXPLORE = { section: 'regions', mode: 'explore', countries: ['ES'], levels: { ES: 'g1' } };
const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`).first();
const ruler = (page: Page) => page.locator('.ruler');
const spots = (page: Page) => page.locator('.map-svg .m-mark-spot');
const km = async (page: Page): Promise<number> => Number(((await page.locator('.ruler-km').textContent()) ?? '').replace(/[^\d,]/g, '').replace(',', '.'));

/** A click on the map at the middle of the box of a piece. */
async function clickBy(page: Page, id: string): Promise<void> {
  const box = (await piece(page, id).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
const flip = (page: Page, name: string) => page.locator('label.toggle', { hasText: name }).click();

test.describe('the ruler of the map', () => {
  test('measures from one click to the next, and starts again with a third', async ({ page }) => {
    await start(page, EXPLORE);
    await expect(ruler(page)).toHaveCount(0);
    await flip(page, 'Regla para medir');
    await expect(ruler(page)).toContainText('Haz clic en el primer punto.');
    await expect(ruler(page).getByRole('button', { name: 'Borrar' })).toHaveCount(0);

    // With the ruler out, a click is an end of the measure and not a piece to look up.
    await clickBy(page, 'ES-CL');
    await expect(ruler(page)).toContainText('Ahora, el otro punto.');
    await expect(spots(page)).toHaveCount(1);
    await expect(page.locator('.card-item')).toHaveCount(0);
    await expect(page.locator('.map-svg .m-links line')).toHaveCount(0);

    await clickBy(page, 'ES-CT');
    await expect(spots(page)).toHaveCount(2);
    await expect(page.locator('.map-svg .m-links line')).toHaveCount(1);
    await expect(page.locator('.ruler-km')).toHaveText(/^\d+ km$/);
    // From the middle of Castilla y León to the middle of Cataluña: some five hundred kilometres.
    const far = await km(page);
    expect(far).toBeGreaterThan(400);
    expect(far).toBeLessThan(650);
    await expect(ruler(page)).toContainText('en línea recta');
    await expect(ruler(page).locator('small')).toHaveText(/^De 4\d,\d° N · \d,\d° O a 4\d,\d° N · \d,\d° E$/);

    // A third click is the first end of another measure.
    await clickBy(page, 'ES-AN');
    await expect(spots(page)).toHaveCount(1);
    await expect(ruler(page)).toContainText('Ahora, el otro punto.');
    await clickBy(page, 'ES-MD');
    const near = await km(page);
    expect(near).toBeGreaterThan(250);
    expect(near).toBeLessThan(far);

    await ruler(page).getByRole('button', { name: 'Borrar' }).click();
    await expect(spots(page)).toHaveCount(0);
    await expect(ruler(page)).toContainText('Haz clic en el primer punto.');
  });

  test('is put away, and the map looks pieces up again', async ({ page }) => {
    await start(page, EXPLORE);
    await flip(page, 'Regla para medir');
    await clickBy(page, 'ES-CL');
    await clickBy(page, 'ES-CT');
    await expect(spots(page)).toHaveCount(2);
    await flip(page, 'Regla para medir');
    await expect(ruler(page)).toHaveCount(0);
    await expect(spots(page)).toHaveCount(0);
    await expect(page.locator('.map-svg .m-links line')).toHaveCount(0);
    await piece(page, 'ES-CL').dispatchEvent('click');
    await expect(page.locator('.card-item .q-name')).toContainText('Castilla y León');
    // Taken out again, it starts with nothing measured, and the card that was open stays.
    await flip(page, 'Regla para medir');
    await expect(ruler(page)).toContainText('Haz clic en el primer punto.');
    await expect(page.locator('.card-item .q-name')).toContainText('Castilla y León');
  });

  test('is worked with the keys, and speaks English', async ({ page }) => {
    await seed(page, { lang: 'en', game: { nonce: 1, ...EXPLORE, opts: OPTS } });
    await page.goto('./#/jugar');
    await expect(page.locator('.play-loading')).toHaveCount(0, { timeout: 30_000 });
    await expect(piece(page, 'ES-CL')).toBeVisible();
    await flip(page, 'Ruler');
    await expect(ruler(page)).toContainText('Click on the first point.');
    // A cross moved with the arrows, and Enter to leave each end.
    await page.locator('.map-svg').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(ruler(page)).toContainText('Now, the other point.');
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.locator('.ruler-km')).toHaveText(/^[\d,.]+ km$/);
    await expect(ruler(page)).toContainText('as the crow flies');
    await expect(ruler(page).locator('small')).toHaveText(/^From .+ to .+$/);
    expect(await km(page)).toBeGreaterThan(0);
    await expect(ruler(page).getByRole('button', { name: 'Clear' })).toBeVisible();
  });
});
