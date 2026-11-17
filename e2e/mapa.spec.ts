import { expect, test } from '@playwright/test';
import { play, triesLeft } from './helpers';

test.describe('the map with a keyboard', () => {
  test('is reached with Tab, walked with the arrows and answered with Enter', async ({ page }) => {
    await play(page);
    const map = page.locator('.map-svg');
    await expect(map).toHaveAttribute('role', 'application');
    for (let i = 0; i < 40 && !(await map.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(map).toBeFocused();

    const said = page.locator('.map [role=status]');
    await page.keyboard.press('ArrowRight');
    // The name of a piece that is being asked is not given away: only its place in the count.
    await expect(said).toHaveText(/^Pieza, \d+ de 19$/);
    const first = await said.textContent();
    await page.keyboard.press('ArrowRight');
    await expect(said).not.toHaveText(first ?? '');

    const asked = await page.locator('.q-name, .q-ask').first().textContent();
    await page.keyboard.press('Enter');
    // Right or wrong, the answer has been taken, and the same Enter has not moved on to another question.
    await expect.poll(async () => (await triesLeft(page)) !== 3).toBe(true);
    await expect(page.locator('.q-name, .q-ask').first()).toHaveText(asked ?? '');
  });

  test('zooms with + and shows everything again with 0', async ({ page }) => {
    await play(page);
    const map = page.locator('.map-svg');
    await map.focus();
    const view = () => page.locator('.map-svg g[transform]').first().getAttribute('transform');
    const scale = async () => Number(/scale\(([\d.]+)\)/.exec((await view()) ?? '')?.[1]);
    const whole = await scale();
    await page.keyboard.press('+');
    await expect.poll(scale).toBeGreaterThan(whole * 1.3);
    await page.keyboard.press('0');
    await expect.poll(scale).toBeLessThan(whole * 1.1);
  });
});

test.describe('the map with a mouse', () => {
  test('a click on a piece is an answer; a drag only moves the map', async ({ page }) => {
    await play(page);
    const view = () => page.locator('.map-svg g[transform]').first().getAttribute('transform');
    const before = await view();
    const box = (await page.locator('.map-svg [data-id="ES-CL"]').boundingBox())!;
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 70, y + 40, { steps: 6 });
    await page.mouse.up();
    await expect.poll(view).not.toBe(before);
    expect(await triesLeft(page)).toBe(3);

    await page.locator('.map-svg [data-id="ES-AN"]').click();
    await expect.poll(async () => (await triesLeft(page)) !== 3).toBe(true);
  });
});

test.describe('the map with a finger @movil', () => {
  test('a tap on a piece is an answer, and nothing spills past the screen', async ({ page }) => {
    await play(page);
    await page.locator('.map-svg [data-id="ES-CM"]').tap();
    await expect.poll(async () => (await triesLeft(page)) !== 3).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
