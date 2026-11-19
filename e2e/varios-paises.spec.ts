/**
 * Short forms on a map with regions of several countries: a type-in that pieces of two countries have
 * («Capital» is the Australian Capital Territory and Islamabad) names neither until it is known which
 * country is meant.
 */
import { expect, test } from '@playwright/test';
import { start, type } from './helpers';

const MAP = { section: 'regions', countries: ['AU', 'PK'] };

test.describe('a type-in that two countries have', () => {
  test('fills nothing in on its own, and fills the piece that is pointed at', async ({ page }) => {
    await start(page, { ...MAP, mode: 'nameall' });
    await expect(page.locator('.hud-main')).toHaveText('0 / 16');
    await type(page, 'capital');
    await expect(page.locator('.q-note')).toHaveText('«CAPITAL» puede ser más de un nombre de este mapa: escríbelo entero. Si tocas antes la pieza en el mapa, vale la abreviatura de su país.');
    await expect(page.locator('.hud-main')).toHaveText('0 / 16');
    // What only one of the two countries has is taken as ever.
    await type(page, 'Sindh');
    await expect(page.locator('.hud-main')).toHaveText('1 / 16');
    // With the piece marked, its country is known.
    await page.locator('.map-svg [data-id="AU-ACT"]').first().dispatchEvent('click');
    await expect(page.locator('.q-note')).toContainText('Escribe el nombre de la que has marcado');
    await type(page, 'capital');
    await expect(page.locator('.hud-main')).toHaveText('2 / 16');
    await expect(page.locator('.found li').first()).toHaveText('Territorio de la Capital Australiana');
  });

  test('is taken for the piece that is asked about', async ({ page }) => {
    await start(page, { ...MAP, mode: 'identify', only: ['PK-IS'], opts: { answer: 'type' } });
    await expect(page.locator('.answer-input')).toBeVisible();
    await type(page, 'capital');
    await expect(page.locator('.verdict')).toContainText('Islamabad');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
  });
});
