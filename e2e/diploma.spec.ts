/**
 * The diploma of a game: a sheet to print with who completed which map, in which game, how it went and
 * when. It is offered when at least half of the game was right, and the name on it is kept nowhere.
 */
import { expect, test, type Page } from '@playwright/test';
import { OPTS, seed, start } from './helpers';

const NOW = new Date('2026-11-18T12:00:00+01:00');
const LUX = { section: 'regions', countries: ['LU'], mode: 'pin', opts: { length: 'all' } };
const ID: Record<string, string> = { Diekirch: 'LU-D', Grevenmacher: 'LU-G', Luxemburgo: 'LU-L' };
const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`);

/**
 * Plays the three districts of Luxembourg: `misses` of them are never found (three wrong clicks each), the
 * rest at once. What was missed is asked once more before the result, and found then.
 */
async function playLux(page: Page, misses = 0, kept: Record<string, unknown> = {}): Promise<void> {
  // What else the browser has kept goes in with the game: what is seeded is written once.
  await seed(page, { ...kept, game: { levels: {}, nonce: 1, ...LUX, opts: { ...OPTS, ...LUX.opts } } });
  await start(page, LUX);
  const next = page.getByRole('button', { name: /^(Siguiente|Ver resultado)/ });
  for (let n = 0; n < 3; n++) {
    await expect(page.locator('.hud-main')).toContainText(`${n + 1} / 3`);
    const id = ID[(await page.locator('.q-name').textContent())!.trim()];
    expect(id).toBeTruthy();
    if (n < misses) {
      const other = Object.values(ID).find((x) => x !== id)!;
      for (let i = 0; i < 3; i++) await piece(page, other).dispatchEvent('click');
      await expect(async () => {
        if (await next.isVisible()) await next.click();
        expect((await page.locator('.hud-main').textContent()) ?? '').toMatch(n < 2 ? `${n + 2} / 3` : /Repaso/);
      }).toPass({ timeout: 15_000 });
    } else await piece(page, id).dispatchEvent('click');
  }
  for (let n = 0; n < misses; n++) {
    await expect(page.locator('.q')).toContainText('Repaso de fallos');
    const name = (await page.locator('.q-name').textContent())!.trim();
    await piece(page, ID[name]).dispatchEvent('click');
    if (n < misses - 1) await expect(page.locator('.q-name')).not.toHaveText(name, { timeout: 10_000 });
  }
  await expect(page.locator('.results-title')).toBeVisible({ timeout: 15_000 });
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test.describe('the diploma of a game', () => {
  test('says who completed what, how it went and when', async ({ page }) => {
    await playLux(page, 0, { nick: 'Ana' });
    await page.locator('.results-actions').getByRole('button', { name: 'Diploma' }).click();
    const dialog = page.getByRole('dialog', { name: 'Diploma' });
    await expect(dialog).toBeVisible();

    const sheet = dialog.locator('.dip');
    await expect(sheet.locator('.dip-title')).toHaveText('Diploma');
    await expect(sheet.locator('.dip-lead')).toHaveText(['Este diploma acredita que', 'ha completado']);
    // The name the player goes by is offered; it can be changed for this sheet.
    await expect(dialog.getByLabel('Nombre en el diploma')).toHaveValue('Ana');
    await expect(sheet.locator('.dip-name')).toHaveText('Ana');
    await expect(sheet.locator('.dip-where')).toHaveText('Luxemburgo · distritos');
    await expect(sheet.locator('.dip-where img')).toHaveAttribute('src', /flags\/lu\.svg$/);
    await expect(sheet.locator('.dip-what')).toHaveText('Regiones · Señalar');
    await expect(sheet.locator('.dip-result')).toHaveText(/^3 de 3 a la primera · en \d+:\d\d$/);
    await expect(sheet.locator('.dip-seal')).toHaveAccessibleName('100 %');
    await expect(sheet.locator('.dip-field')).toHaveText(['18 de noviembre de 2026Fecha', /Firma$/]);
    await expect(sheet.locator('.dip-brand')).toContainText('Regionle ∞');
    // The map that was played, behind the words: its three pieces.
    await expect(sheet.locator('.dip-map path')).toHaveCount(3);
    await expect(sheet.locator('.dip-qr')).toBeVisible();
  });

  test('takes the name that is typed, and keeps it nowhere', async ({ page }) => {
    await playLux(page);
    await page.locator('.results-actions').getByRole('button', { name: 'Diploma' }).click();
    const dialog = page.getByRole('dialog', { name: 'Diploma' });
    const name = dialog.getByLabel('Nombre en el diploma');
    // With no name, a line to write it on.
    await expect(name).toHaveValue('');
    await expect(dialog.locator('.dip-name')).toHaveClass(/blank/);
    await name.fill('  María del Carmen   Rodríguez Fernández ');
    await expect(dialog.locator('.dip-name')).toHaveText('María del Carmen Rodríguez Fernández');
    await expect(dialog.locator('.dip-name')).toHaveClass(/tight-1/);
    await expect(dialog.locator('.dip-name')).not.toHaveClass(/blank/);

    // Closed and opened again, the name is still there...
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.locator('.results-actions').getByRole('button', { name: 'Diploma' })).toBeFocused();
    await page.locator('.results-actions').getByRole('button', { name: 'Diploma' }).click();
    await expect(dialog.locator('.dip-name')).toHaveText('María del Carmen Rodríguez Fernández');
    // ...but it is not the name of the player, which travels in the links of a challenge, nor is it saved.
    await expect(page.locator('.duel-send input')).toHaveValue('');
    const kept = await page.evaluate(() => localStorage.getItem('regionle:v1') ?? '');
    expect(kept).not.toContain('Rodríguez');
    expect(JSON.parse(kept).state.nick).toBe('');
  });

  test('is all that is printed, on a sheet lying on its side', async ({ page }) => {
    await playLux(page);
    await page.locator('.results-actions').getByRole('button', { name: 'Diploma' }).click();
    const dialog = page.getByRole('dialog', { name: 'Diploma' });
    await dialog.getByLabel('Nombre en el diploma').fill('Ana García');
    expect(await dialog.locator('style').textContent()).toContain('size: landscape');
    // The file the browser offers to save it as says what it is.
    expect(await page.title()).toBe('Diploma — Luxemburgo · distritos');
    // On the screen, the whole sheet is seen at once.
    const sheet = dialog.locator('.dip');
    await expect(sheet).toBeInViewport({ ratio: 1 });

    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#root')).toBeHidden();
    await expect(dialog.getByLabel('Nombre en el diploma')).toBeHidden();
    await expect(dialog.getByRole('button', { name: 'Imprimir' })).toBeHidden();
    await expect(sheet).toBeVisible();
    // At its real size: 250 mm by 178, which a sheet lying down has room for, A4 or Letter.
    const box = await sheet.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return [r.width, r.height].map((px) => Math.round((px / 96) * 25.4));
    });
    expect(box).toEqual([250, 178]);
    expect(await sheet.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    // Nothing of it runs past its frame.
    const inside = await sheet.evaluate((el) => {
      const frame = el.querySelector('.dip-in')!.getBoundingClientRect();
      return [...el.querySelectorAll('.dip-in > :not(.dip-map)')].every((part) => {
        const r = part.getBoundingClientRect();
        return r.top >= frame.top && r.bottom <= frame.bottom && r.left >= frame.left && r.right <= frame.right;
      });
    });
    expect(inside).toBe(true);

    await page.emulateMedia({ media: 'screen' });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(await page.title()).not.toContain('Diploma');
    await expect(page.locator('html')).not.toHaveClass(/dlg-print/);
  });

  test('is earned with half of the game right, and not with less', async ({ page }) => {
    // Two of three never found: a third of the game.
    await playLux(page, 2);
    await expect(page.locator('.results-stats dd')).toContainText(['1', '0', '2']);
    await expect(page.locator('.results-actions').getByRole('button', { name: 'Guardar imagen' })).toBeVisible();
    await expect(page.locator('.results-actions').getByRole('button', { name: 'Diploma' })).toHaveCount(0);
  });

  test('says what was missed too', async ({ page }) => {
    await playLux(page, 1);
    await expect(page.locator('.results-stats dd')).toContainText(['2', '0', '1']);
    await page.locator('.results-actions').getByRole('button', { name: 'Diploma' }).click();
    const sheet = page.getByRole('dialog', { name: 'Diploma' }).locator('.dip');
    await expect(sheet.locator('.dip-result')).toHaveText(/^2 de 3 a la primera · en \d+:\d\d$/);
    await expect(sheet.locator('.dip-seal')).toHaveAccessibleName('67 %');
  });

  test('is not given for going over the misses alone', async ({ page }) => {
    await start(page, { ...LUX, only: ['LU-D'] });
    await piece(page, 'LU-D').dispatchEvent('click');
    await expect(page.locator('.results-title')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.results-actions').getByRole('button', { name: 'Guardar imagen' })).toBeVisible();
    await expect(page.locator('.results-actions').getByRole('button', { name: 'Diploma' })).toHaveCount(0);
  });

  test('is written in English for who plays in English', async ({ page }) => {
    await seed(page, { lang: 'en', nick: 'Tom', game: { levels: {}, nonce: 1, ...LUX, opts: { ...OPTS, ...LUX.opts } } });
    await start(page, LUX);
    const ids: Record<string, string> = { Diekirch: 'LU-D', Grevenmacher: 'LU-G', Luxembourg: 'LU-L' };
    for (let n = 0; n < 3; n++) {
      await expect(page.locator('.hud-main')).toContainText(`${n + 1} / 3`);
      await piece(page, ids[(await page.locator('.q-name').textContent())!.trim()]).dispatchEvent('click');
    }
    await expect(page.locator('.results-title')).toBeVisible({ timeout: 15_000 });
    await page.locator('.results-actions').getByRole('button', { name: 'Diploma' }).click();
    const sheet = page.getByRole('dialog', { name: 'Diploma' }).locator('.dip');
    await expect(sheet.locator('.dip-lead')).toHaveText(['This is to certify that', 'has completed']);
    await expect(sheet.locator('.dip-name')).toHaveText('Tom');
    await expect(sheet.locator('.dip-what')).toHaveText('Regions · Pin it');
    await expect(sheet.locator('.dip-result')).toHaveText(/^3 of 3 right first time · in \d+:\d\d$/);
    await expect(sheet.locator('.dip-field')).toHaveText(['18 November 2026Date', /Signature$/]);
  });
});

test.describe('the diploma on a phone', () => {
  test('fits the screen, sheet and all @movil', async ({ page }) => {
    await playLux(page);
    await page.locator('.results-actions').getByRole('button', { name: 'Diploma' }).click();
    const dialog = page.getByRole('dialog', { name: 'Diploma' });
    await expect(dialog).toBeVisible();
    const view = page.viewportSize()!;
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(view.width);
    const sheet = (await dialog.locator('.dip').boundingBox())!;
    expect(sheet.x).toBeGreaterThanOrEqual(box.x);
    expect(sheet.x + sheet.width).toBeLessThanOrEqual(box.x + box.width);
    // Wider than tall, as the paper it is.
    expect(sheet.width / sheet.height).toBeCloseTo(250 / 178, 1);
    await expect(dialog.getByRole('button', { name: 'Imprimir' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
