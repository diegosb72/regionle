import { expect, test } from '@playwright/test';
import { seed } from './helpers';

// Here the copy for playing without a connection is what is looked at.
test.use({ serviceWorkers: 'allow' });

test.describe('without a connection', () => {
  test('replaces the old cached tricolour with the new Afghan drawing, even offline', async ({ page, context }) => {
    await seed(page);
    await page.goto('./');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const [shell, pack] = await page.evaluate(async () => {
      const [worker, offline] = await Promise.all([fetch('./sw.js').then((r) => r.text()), fetch('./offline.json').then((r) => r.json() as Promise<{ files: string[] }>)]);
      return [JSON.parse(/const SHELL = (\[.*?\]);/s.exec(worker)![1]) as string[], offline.files] as const;
    });
    expect(shell).toContain('flags/af.svg');
    expect(pack).not.toContain('flags/af.svg');
    const flag = await page.evaluate(async () => {
      const old = await caches.open('regionle-data');
      await old.put('./flags/af.svg', new Response('<svg id="old-tricolour"/>', { headers: { 'Content-Type': 'image/svg+xml' } }));
      return fetch('./flags/af.svg').then((r) => r.text());
    });
    expect(flag).not.toContain('old-tricolour');
    expect(flag).toContain('width="1e3px" height="500px"');
    await context.setOffline(true);
    expect(await page.evaluate(() => fetch('./flags/af.svg').then((r) => r.text()))).toBe(flag);
  });

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
    await expect(page).toHaveTitle('Los países en cifras — Regionle ∞');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Los países en cifras');
    await expect(page.locator('.crash')).toHaveCount(0);

    // Nor is the page of the map of a country, and there are hundreds: the game in its language answers for
    // each of them too, opens that map and says of it what the page says.
    expect(await page.evaluate(() => caches.match('./map-es-spain.html').then((copy) => !!copy))).toBe(false);
    /** What the page that was given says for whoever runs no scripts: it tells which page answered the visit. */
    const unscripted = () => page.evaluate(() => document.querySelector('noscript')?.textContent ?? '');
    await page.goto('./map-es-spain.html');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.startbar')).toContainText('Spain · 52 provinces');
    await expect(page).toHaveTitle('Spain: provinces on the map — Regionle ∞');
    expect(new URL(page.url()).pathname.endsWith('/map-es-spain.html')).toBe(true);
    expect(await unscripted()).toContain('Regionle ∞ is a geography game');
    await page.goto('./mapa-gb-reino-unido.html');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('.startbar')).toContainText('Reino Unido · 232 condados y distritos');
    await expect(page).toHaveTitle('Reino Unido: condados y distritos en el mapa — Regionle ∞');
    expect(await unscripted()).toContain('Regionle ∞ es un juego de geografía');
    // Asked for without its extension, as some servers give it, it is the same page.
    await page.goto('./map-gb-united-kingdom');
    await expect(page.locator('.startbar')).toContainText('United Kingdom · 232 counties and districts');
    expect(await unscripted()).toContain('Regionle ∞ is a geography game');
    // A name that only looks like one of those is no page of the site: it gets the first page, as before.
    await page.goto('./mapa-espana.html');
    await expect(page.locator('.hero-title')).toBeVisible();
    await expect(page.locator('.crash')).toHaveCount(0);
  });
});
