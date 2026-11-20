/**
 * QR codes: wherever the game gives an address to send, it also shows it as a code to point a phone at.
 * Each code is read here off the screen by a reader that is not the game's, and must say that address.
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import jsQR from 'jsqr';
import { open, seed, start } from './helpers';

// The clock of these tests is set by hand, and so is where it is read: their days are Madrid's, whatever
// E2E_ZONE says (playwright.config.ts).
test.use({ timezoneId: 'Europe/Madrid' });

const NOW = new Date('2026-11-18T12:00:00+01:00');

/** What a camera would read from the code on the screen. */
async function scan(page: Page): Promise<string | null> {
  const code = page.locator('.qr-code');
  await expect(code).toBeVisible();
  const shot = await code.screenshot();
  const px = await page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise((ok, no) => {
      img.onload = ok;
      img.onerror = no;
      img.src = `data:image/png;base64,${b64}`;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const pen = canvas.getContext('2d')!;
    pen.drawImage(img, 0, 0);
    return { w: canvas.width, h: canvas.height, data: Array.from(pen.getImageData(0, 0, canvas.width, canvas.height).data) };
  }, shot.toString('base64'));
  return jsQR(Uint8ClampedArray.from(px.data), px.w, px.h)?.data ?? null;
}

const root = (page: Page) => page.url().split('#')[0];

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test.describe('the QR code of an address', () => {
  test('opens the map and the game that are chosen', async ({ page }) => {
    await seed(page, { sel: { regions: ['ES'] }, levels: { ES: 'f' }, mode: { regions: 'capital' } });
    await open(page, '/regiones');
    const link = page.locator('.maplink');
    await expect(link.getByRole('button', { name: 'Copiar enlace a este mapa' })).toBeVisible();
    await link.getByRole('button', { name: 'Código QR' }).click();

    const dialog = page.getByRole('dialog', { name: 'Código QR' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.qr-what')).toHaveText('Regiones · España · Capitales');
    const url = `${root(page)}#/regiones/ES:f/capital`;
    await expect(dialog.locator('.qr-url')).toHaveText(url);
    await expect(dialog.getByRole('img')).toHaveAccessibleName('Código QR que abre Regiones · España · Capitales');
    expect(await scan(page)).toBe(url);

    // Whoever opens what the code says finds that map and that game chosen.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    // The focus goes back to the button that opened it.
    await expect(link.getByRole('button', { name: 'Código QR' })).toBeFocused();
  });

  test('is black on white in the dark theme too, and as large as the panel lets it be', async ({ page }) => {
    await seed(page, { sel: { regions: ['ES'] }, theme: 'dark' });
    await open(page, '/regiones');
    await page.locator('.maplink').getByRole('button', { name: 'Código QR' }).click();
    const code = page.locator('.qr-code');
    await expect(code).toBeVisible();
    expect(await code.locator('rect').getAttribute('fill')).toBe('#fff');
    expect(await code.locator('path').getAttribute('fill')).toBe('#000');
    const box = (await code.boundingBox())!;
    expect(Math.round(box.width)).toBe(Math.round(box.height));
    expect(box.width).toBeGreaterThan(400);
    expect(await scan(page)).toBe(`${root(page)}#/regiones/ES:g1/pin`);
  });

  test('is saved as a picture that a reader reads', async ({ page }) => {
    await seed(page, { sel: { countries: ['ES', 'FR', 'PT'] } });
    await open(page, '/paises');
    await page.locator('.maplink').getByRole('button', { name: 'Código QR' }).click();
    const dialog = page.getByRole('dialog', { name: 'Código QR' });
    const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Guardar imagen' }).click()]);
    expect(download.suggestedFilename()).toBe('regionle-qr.png');
    const png = fs.readFileSync(await download.path());
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    expect(w).toBe(h);
    expect(w).toBeGreaterThan(1000);
    await expect(dialog.locator('.qr-note')).toHaveText('Imagen guardada en tus descargas.');
    if (process.env.PICS) await download.saveAs(`${process.env.PICS}/qr.png`);

    const px = await page.evaluate(async (b64) => {
      const img = new Image();
      await new Promise((ok, no) => {
        img.onload = ok;
        img.onerror = no;
        img.src = `data:image/png;base64,${b64}`;
      });
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 400;
      const pen = canvas.getContext('2d')!;
      pen.drawImage(img, 0, 0, 400, 400);
      return Array.from(pen.getImageData(0, 0, 400, 400).data);
    }, png.toString('base64'));
    expect(jsQR(Uint8ClampedArray.from(px), 400, 400)?.data).toBe(await dialog.locator('.qr-url').textContent());
  });

  test('is all that is printed: the code, what it opens and the address', async ({ page }) => {
    await seed(page, { sel: { regions: ['ES'] } });
    await open(page, '/regiones');
    await page.locator('.maplink').getByRole('button', { name: 'Código QR' }).click();
    const dialog = page.getByRole('dialog', { name: 'Código QR' });
    await expect(dialog.locator('.qr-code')).toBeVisible();
    await expect(dialog.locator('.qr-brand')).toBeHidden();

    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#root')).toBeHidden();
    await expect(dialog.locator('.qr-code')).toBeVisible();
    await expect(dialog.locator('.qr-brand')).toHaveText('Regionle ∞');
    await expect(dialog.locator('.qr-what')).toBeVisible();
    await expect(dialog.locator('.qr-url')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Imprimir' })).toBeHidden();
    await expect(dialog.getByRole('button', { name: 'Cerrar' })).toBeHidden();
    // Twelve centimetres across: read from the back of a classroom.
    const width = await dialog.locator('.qr-code').evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.round(width)).toBe(Math.round((120 / 25.4) * 96));

    await page.emulateMedia({ media: 'screen' });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    // With the panel put away, paper is for the page again.
    await expect(page.locator('html')).not.toHaveClass(/dlg-print/);
  });

  test('carries a list of one\'s own', async ({ page }) => {
    const list = { id: 'l1', name: 'Examen del jueves', section: 'regions', countries: ['ES'], levels: { ES: 'f' }, ids: ['ES-M', 'ES-B', 'ES-A'] };
    await seed(page, { lists: [list], listOn: { regions: 'l1' } });
    await open(page, '/regiones');
    const card = page.locator('.listcard').filter({ hasText: 'Examen del jueves' });
    await card.getByRole('button', { name: 'Código QR' }).click();
    const dialog = page.getByRole('dialog', { name: 'Código QR' });
    await expect(dialog.locator('.qr-what')).toHaveText('Lista «Examen del jueves»');
    const said = await scan(page);
    expect(said).toBe(await dialog.locator('.qr-url').textContent());
    expect(said).toContain('#/lista/');

    // What the code says opens the list in a browser that has never seen it.
    await page.evaluate(() => localStorage.clear());
    await page.goto(said!);
    await page.reload();
    await expect(page.locator('main#contenido')).toContainText('Examen del jueves');
  });

  test('carries the result of the day\'s challenge', async ({ page }) => {
    await seed(page, { nick: 'Ana', daily: { '2026-11-18': { p: [20, 16, 13, 8, 12], k: [1, 5, 2, 3, 3] } } });
    await open(page, '/reto');
    await page.locator('.d-share').getByRole('button', { name: 'Código QR' }).click();
    const dialog = page.getByRole('dialog', { name: 'Código QR' });
    await expect(dialog.locator('.qr-what')).toHaveText('Reto del 18 de noviembre de 2026 · Irak');
    const said = await scan(page);
    // The same address the text to share ends with.
    expect(said).toMatch(/#\/reto\/2026-11-18\/[0-9a-k]{5}\.[\w-]+$/);
    expect(await page.locator('.d-share textarea').inputValue()).toContain(said!);
  });

  test('carries a game to challenge someone with', async ({ page }) => {
    // The three districts of Luxembourg, each found at once.
    await start(page, { section: 'regions', countries: ['LU'], mode: 'pin', opts: { length: 'all' } });
    const ids: Record<string, string> = { Diekirch: 'LU-D', Grevenmacher: 'LU-G', Luxemburgo: 'LU-L' };
    for (let n = 0; n < 3; n++) {
      await expect(page.locator('.hud-main')).toContainText(`${n + 1} / 3`);
      await page.locator(`.map-svg [data-id="${ids[(await page.locator('.q-name').textContent())!.trim()]}"]`).dispatchEvent('click');
    }
    await expect(page.locator('.results-title')).toBeVisible({ timeout: 10_000 });
    const box = page.locator('.duel');
    await box.getByRole('button', { name: 'Código QR' }).click();
    const dialog = page.getByRole('dialog', { name: 'Código QR' });
    await expect(dialog.locator('.qr-what')).toContainText('Reto: ');
    const said = await scan(page);
    expect(said).toContain('#/duelo/');
    expect(said).toBe(await dialog.locator('.qr-url').textContent());
  });
});

test.describe('the QR code on a phone', () => {
  test('fits the screen and is read @movil', async ({ page }) => {
    await seed(page, { sel: { regions: ['ES'] } });
    await open(page, '/regiones');
    await page.locator('.maplink').getByRole('button', { name: 'Código QR' }).click();
    const dialog = page.getByRole('dialog', { name: 'Código QR' });
    await expect(dialog).toBeVisible();
    const view = page.viewportSize()!;
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(view.width);
    expect(box.y + box.height).toBeLessThanOrEqual(view.height);
    await expect(dialog.getByRole('button', { name: 'Guardar imagen' })).toBeInViewport();
    expect(await scan(page)).toBe(`${root(page)}#/regiones/ES:g1/pin`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
