import { expect, test } from '@playwright/test';
import { seed } from './helpers';

// Here the copy for playing without a connection is what is looked at.
test.use({ serviceWorkers: 'allow' });

test.describe('without a connection', () => {
  test('the game opens, in either language, and so do the screens not yet visited', async ({ page, context }) => {
    await seed(page);
    await page.goto('./');
    await expect(page.locator('.hero-title')).toBeVisible();
    // Stored and in charge of the page.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);

    // With the copy in charge, a file of the site is still answered as what it is, not as the game.
    const robots = await page.evaluate(() => fetch('./robots.txt').then((r) => r.text()));
    expect(robots).toMatch(/^User-agent: \*/);

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.hero-title')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');

    // A screen whose script had not been asked for yet.
    await page.goto('./#/acerca');
    await expect(page).toHaveTitle('Acerca de — Regionle ∞');
    await expect(page.locator('main')).toContainText('Versión');
    await page.goto('./#/regiones');
    await expect(page.locator('.setup-head h1')).toBeVisible();
    await expect(page.locator('.crash')).toHaveCount(0);

    // The page of the other language is its own page, not the first one.
    await page.goto('./en.html');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle('Regionle ∞ — Learn the regions of the world');
    await expect(page.locator('nav.nav a[href="#/regiones"]')).toHaveText(/Regions/);

    // The page of a screen is not stored one by one: a visit to it gets the game in its language, which
    // opens that screen by the address it was asked for.
    expect(await page.evaluate(() => caches.match('./regions.html').then((copy) => !!copy))).toBe(false);
    await page.goto('./regions.html');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle('Regions, provinces and states — Regionle ∞');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Regions, provinces and states');
    expect(new URL(page.url()).pathname.endsWith('/regions.html')).toBe(true);
    await page.goto('./cifras.html');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page).toHaveTitle('Población y superficie — Regionle ∞');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Población y superficie');
    await expect(page.locator('.crash')).toHaveCount(0);
  });
});
