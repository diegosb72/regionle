/**
 * The result of any game as a picture: drawn in the browser when the game ends, with what was played, the
 * score and the map painted by how each answer went.
 */
import fs from 'node:fs';
import { expect, test, type Download, type Page } from '@playwright/test';
import { OPTS, seed, start } from './helpers';

const NOW = new Date('2026-11-18T12:00:00+01:00');
const SPAIN = { section: 'regions', countries: ['ES'], levels: { ES: 'g1' } };
const ID: Record<string, string> = { Andalucía: 'ES-AN', 'Castilla y León': 'ES-CL', 'Comunidad de Madrid': 'ES-MD' };
const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`);
/** Where to leave the pictures to look at them, when asked to (`PICS=/tmp/x npx playwright test …`). */
const keep = async (download: Download, name: string) => {
  if (process.env.PICS) await download.saveAs(`${process.env.PICS}/${name}`);
};

/** What a PNG file says of itself: its size in pixels. */
function sizeOf(png: Buffer): [number, number] {
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test.describe('the picture of the result of a game', () => {
  test('is saved from the results of a game on a map', async ({ page }) => {
    await start(page, { ...SPAIN, mode: 'pin', only: Object.values(ID) });
    // Three pieces: the first right at once, the second at the second try, the third never.
    const next = page.getByRole('button', { name: /^(Siguiente|Ver resultado)/ });
    for (let n = 0; n < 3; n++) {
      await expect(page.locator('.hud-main')).toContainText(`${n + 1} / 3`);
      const id = ID[(await page.locator('.q-name').textContent())!.trim()];
      expect(id).toBeTruthy();
      // Galicia is on the map and is none of the three: a click on it is always a miss.
      for (let miss = 0; miss < (n === 0 ? 0 : n === 1 ? 1 : 3); miss++) await piece(page, 'ES-GA').dispatchEvent('click');
      if (n < 2) await piece(page, id).dispatchEvent('click');
      // A right answer moves on by itself; a miss waits for the button.
      await expect(async () => {
        if (await next.isVisible()) await next.click();
        expect((await page.locator('.hud-main').textContent()) ?? '').toContain(n < 2 ? `${n + 2} / 3` : 'Repaso');
      }).toPass({ timeout: 15_000 });
    }
    // What was missed is asked once more before the result: this time it is found.
    await expect(page.locator('.q')).toContainText('Repaso de fallos');
    await piece(page, ID[(await page.locator('.q-name').textContent())!.trim()]).dispatchEvent('click');
    await expect(page.locator('.results-title')).toBeVisible({ timeout: 10_000 });
    // One right at once, one with help and one missed.
    await expect(page.locator('.results-stats dd')).toContainText(['1', '1', '1']);
    const score = `${(await page.locator('.results-score').textContent())!.match(/(\d+) %/)![1]} %`;

    const button = page.locator('.results-actions').getByRole('button', { name: 'Guardar imagen' });
    await expect(button).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    expect(download.suggestedFilename()).toBe('regionle-pin-2026-11-18.png');
    const png = fs.readFileSync(await download.path());
    expect(sizeOf(png)).toEqual([1080, 1080]);
    // With a map in it, it weighs far more than the words alone.
    expect(png.length).toBeGreaterThan(40_000);
    await keep(download, 'mapa.png');

    await expect(page.locator('.results .pic-note')).toHaveText('Imagen guardada en tus descargas.');
    const preview = page.locator('.results img.pic');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute('alt', `Imagen del resultado. Regiones · Señalar: España · comunidades autónomas, ${score}.`);
    expect(await preview.evaluate((img: HTMLImageElement) => img.decode().then(() => img.naturalWidth))).toBe(1080);
    // The buttons the result already had are where they were, and the first of them still has the focus.
    await expect(page.locator('.results-actions button').first()).toContainText('Otra vez');
  });

  test('paints each piece of the map by how its answer went', async ({ page }) => {
    await start(page, { ...SPAIN, mode: 'pin', only: ['ES-AN'] });
    await piece(page, 'ES-AN').dispatchEvent('click');
    await expect(page.locator('.results-title')).toBeVisible({ timeout: 10_000 });
    const button = page.locator('.results-actions').getByRole('button', { name: 'Guardar imagen' });
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    await keep(download, 'una.png');
    // The picture as the page shows it, read back point by point: Andalusia in the green of a right answer,
    // Castile and León in the colour of the land.
    const colours = await page.locator('.results img.pic').evaluate(async (img: HTMLImageElement) => {
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1080;
      const pen = canvas.getContext('2d')!;
      pen.drawImage(img, 0, 0);
      const seen = new Set<string>();
      // The map is the square on the right: every eighth point of it.
      const { data } = pen.getImageData(612, 176, 404, 404);
      for (let i = 0; i < data.length; i += 4 * 8) seen.add(`#${[data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
      return [...seen];
    });
    expect(colours).toContain('#8fd1a9');
    expect(colours).toContain('#fdf6e3');
    expect(colours).not.toContain('#f0957c');
  });

  test('is there for a game with no map, and names the game', async ({ page }) => {
    await start(page, { section: 'pops', mode: 'truefalse', countries: ['ES', 'FR', 'DE', 'IT', 'PT', 'NL', 'BE', 'PL'], opts: { length: 10 } });
    for (let i = 0; i < 2; i++) {
      await expect(page.locator('.hud-main')).toHaveText(`${i + 1} / 10`);
      await page.getByRole('button', { name: 'Falso' }).click();
      await page.getByRole('button', { name: 'Siguiente' }).click();
    }
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-title')).toBeVisible();
    const button = page.locator('.results-actions').getByRole('button', { name: 'Guardar imagen' });
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    expect(download.suggestedFilename()).toBe('regionle-truefalse-2026-11-18.png');
    expect(sizeOf(fs.readFileSync(await download.path()))).toEqual([1080, 1080]);
    await keep(download, 'cifras.png');
    await expect(page.locator('.results img.pic')).toHaveAttribute('alt', /^Imagen del resultado\. .+: Verdadero o falso, \d+ %\.$/);
  });

  test('is not offered when nothing was answered', async ({ page }) => {
    await start(page, { section: 'pops', mode: 'truefalse', countries: ['ES', 'FR', 'DE', 'IT', 'PT', 'NL', 'BE', 'PL'], opts: { length: 10 } });
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-title')).toHaveText('Sin preguntas');
    await expect(page.getByRole('button', { name: 'Guardar imagen' })).toHaveCount(0);
  });

  test('is told in English', async ({ page }) => {
    // The language and the game are kept together: what is seeded is written once.
    await seed(page, { lang: 'en', game: { ...SPAIN, mode: 'pin', only: ['ES-AN'], nonce: 1, opts: OPTS } });
    await page.goto('./#/jugar');
    await expect(page.locator('.map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    await piece(page, 'ES-AN').dispatchEvent('click');
    await expect(page.locator('.results-title')).toBeVisible({ timeout: 10_000 });
    const button = page.locator('.results-actions').getByRole('button', { name: 'Save picture' });
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    await keep(download, 'en.png');
    await expect(page.locator('.results .pic-note')).toHaveText('Picture saved to your downloads.');
    await expect(page.locator('.results img.pic')).toHaveAttribute('alt', 'Picture of the result. Regions · Pin it: Spain · autonomous communities, 100%.');
  });

  test('fits a phone under the buttons of the result @movil', async ({ page }) => {
    await start(page, { ...SPAIN, mode: 'pin', only: ['ES-AN'] });
    await piece(page, 'ES-AN').dispatchEvent('click');
    await expect(page.locator('.results-title')).toBeVisible({ timeout: 10_000 });
    // A phone hands the picture to other applications where it can; where it cannot, it saves it.
    const button = page.locator('.results-actions').getByRole('button', { name: /Guardar imagen|Compartir imagen/ });
    await expect(button).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.clientWidth);
    const box = (await button.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
});
