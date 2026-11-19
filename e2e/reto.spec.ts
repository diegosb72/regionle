import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { seed } from './helpers';

// A day that is over: its result is shown as it was left, whatever day the test is run.
const DAY = '2026-11-12';
const done = { [DAY]: { p: [20, 16, 13, 8, 4], k: [1, 4, 2, 3, 1], t: Date.parse(`${DAY}T20:00:00Z`) } };

test.describe('the result of a daily challenge', () => {
  test('adds up the five tests and can be shared as text', async ({ page }) => {
    await seed(page, { daily: done });
    await page.goto(`./#/reto/${DAY}`);
    await expect(page.locator('.d-total strong')).toHaveText('61');
    // The rows of this result; the statistics under it have a list of their own, drawn the same way.
    await expect(page.locator('.d-summary > .d-rows li')).toHaveCount(5);
    await expect(page.locator('.d-summary > .d-rows li b')).toHaveText(['20', '16', '13', '8', '4']);
    const text = await page.locator('.d-share textarea').inputValue();
    expect(text).toContain('61/100');
    expect(text).toContain(`#/reto/${DAY}`);
  });

  test('is saved as a picture drawn in the browser', async ({ page }) => {
    await seed(page, { daily: done });
    await page.goto(`./#/reto/${DAY}`);
    const button = page.getByRole('button', { name: 'Guardar imagen' });
    await expect(button).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    expect(download.suggestedFilename()).toBe(`regionle-${DAY}.png`);
    const png = fs.readFileSync(await download.path());
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1080, 1080]);
    expect(png.length).toBeGreaterThan(20_000);

    await expect(page.locator('.pic-note')).toHaveText('Imagen guardada en tus descargas.');
    const preview = page.locator('img.pic');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute('alt', /61 de 100/);
    expect(await preview.evaluate((img: HTMLImageElement) => img.decode().then(() => img.naturalWidth))).toBe(1080);
  });
});
