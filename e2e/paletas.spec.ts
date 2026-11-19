/**
 * The colours of the maps, chosen in the footer, and the game in full screen, from the footer or from any
 * map. The browser of the tests is given a full screen of its own, which says what it was asked.
 */
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, seed, start } from './helpers';

const PIN = { section: 'regions', mode: 'pin', countries: ['ES'], levels: { ES: 'g1' } };
const palettes = (page: Page) => page.locator('.foot-prefs').getByRole('radiogroup', { name: 'Colores del mapa' });
const root = (page: Page) => page.locator('html');
/** What the page paints the sea with, as the browser has worked it out. */
const sea = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sea').trim());

/** A browser with a full screen that goes in and out when asked, and counts how often. */
async function withFullscreen(page: Page, enabled = true): Promise<void> {
  await page.addInitScript((can) => {
    const state = { el: null as Element | null, asked: 0 };
    (window as unknown as { __full: typeof state }).__full = state;
    const tell = () => document.dispatchEvent(new Event('fullscreenchange'));
    Object.defineProperty(document, 'fullscreenEnabled', { get: () => can, configurable: true });
    Object.defineProperty(document, 'fullscreenElement', { get: () => state.el, configurable: true });
    Element.prototype.requestFullscreen = function (this: Element) {
      state.asked += 1;
      state.el = this;
      tell();
      return Promise.resolve();
    };
    document.exitFullscreen = () => {
      state.el = null;
      tell();
      return Promise.resolve();
    };
  }, enabled);
}
const isFull = (page: Page) => page.evaluate(() => (window as unknown as { __full: { el: Element | null } }).__full.el === document.documentElement);

test.describe('the colours of the map', () => {
  test('are chosen in the footer among three, and kept', async ({ page }) => {
    await seed(page);
    await open(page);
    await expect(palettes(page).getByRole('radio')).toHaveText(['Papel', 'Océano', 'Pizarra']);
    await expect(palettes(page).getByRole('radio', { checked: true })).toHaveText('Papel');
    await expect(root(page)).not.toHaveAttribute('data-map');
    const paper = await sea(page);
    expect(paper).toBe('#d8e6e3');

    await palettes(page).getByRole('radio', { name: 'Océano' }).click();
    await expect(root(page)).toHaveAttribute('data-map', 'ocean');
    await expect(page.locator('.foot-pick small')).toHaveText('Mar azul y tierra clara, como en un atlas.');
    expect(await sea(page)).toBe('#b9d8ee');

    await page.reload();
    await expect(palettes(page).getByRole('radio', { checked: true })).toHaveText('Océano');
    await expect(root(page)).toHaveAttribute('data-map', 'ocean');

    await palettes(page).getByRole('radio', { name: 'Pizarra' }).click();
    await expect(root(page)).toHaveAttribute('data-map', 'slate');
    expect(await sea(page)).toBe('#dde1e4');

    await palettes(page).getByRole('radio', { name: 'Papel' }).click();
    await expect(root(page)).not.toHaveAttribute('data-map');
    expect(await sea(page)).toBe(paper);
  });

  test('paint the map of a game, in the dark theme too', async ({ page }) => {
    // One seed for the settings and the game: what is seeded is written once.
    await seed(page, { palette: 'ocean', theme: 'dark', game: { ...PIN, nonce: 1, opts: OPTS } });
    await page.goto('./#/jugar');
    await expect(page.locator('.map-svg [data-id="ES-CL"]').first()).toBeVisible();
    await expect(root(page)).toHaveAttribute('data-map', 'ocean');
    await expect(root(page)).toHaveAttribute('data-theme', 'dark');
    expect(await sea(page)).toBe('#0b2136');
    // The sea of the map is that colour, and the land another.
    const paint = await page.evaluate(() => {
      const fill = (sel: string) => getComputedStyle(document.querySelector(sel)!).fill;
      return { sea: fill('.map-svg .m-sphere'), land: fill('.map-svg [data-id="ES-CL"]') };
    });
    expect(paint.sea).toBe('rgb(11, 33, 54)');
    expect(paint.land).toBe('rgb(52, 82, 109)');
  });
});

test.describe('full screen', () => {
  test('is entered and left from the footer', async ({ page }) => {
    await withFullscreen(page);
    await seed(page);
    await open(page);
    const link = page.locator('.foot-full');
    await expect(link).toHaveText('Pantalla completa');
    await expect(link).toHaveAttribute('aria-pressed', 'false');
    await link.click();
    expect(await isFull(page)).toBe(true);
    await expect(link).toHaveText('Salir de pantalla completa');
    await expect(link).toHaveAttribute('aria-pressed', 'true');
    await link.click();
    expect(await isFull(page)).toBe(false);
    await expect(link).toHaveText('Pantalla completa');
  });

  test('is entered from the map of a game, stays with the question, and follows a way out that is not its button', async ({ page }) => {
    await withFullscreen(page);
    await start(page, PIN);
    const button = page.locator('.map-ctl .map-full');
    await expect(page.locator('.map-ctl button')).toHaveCount(4);
    await expect(button).toHaveAttribute('aria-label', 'Pantalla completa');
    await button.click();
    // The whole page, not the map: the question is still there.
    expect(await isFull(page)).toBe(true);
    await expect(page.locator('.q-name')).toBeVisible();
    await expect(button).toHaveAttribute('aria-label', 'Salir de pantalla completa');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    // Esc, or the gesture of a phone: the browser leaves by itself and says so.
    await page.evaluate(() => document.exitFullscreen());
    await expect(button).toHaveAttribute('aria-label', 'Pantalla completa');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  test('is not offered where the browser does not grant it', async ({ page }) => {
    await withFullscreen(page, false);
    await start(page, PIN);
    await expect(page.locator('.map-ctl button')).toHaveCount(3);
    await expect(page.locator('.map-full')).toHaveCount(0);
    await open(page);
    await expect(page.locator('.foot-about')).toBeVisible();
    await expect(page.locator('.foot-full')).toHaveCount(0);
  });
});
