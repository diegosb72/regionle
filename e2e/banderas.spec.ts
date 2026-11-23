import fs from 'node:fs';
import { expect, test, type Locator } from '@playwright/test';
import { open, seed } from './helpers';

/** The list of flags the site is built with: what the gallery shows is counted against it. */
const FLAGS = JSON.parse(fs.readFileSync('public/data/flags.json', 'utf8')) as { regions: Record<string, [string, number, string, string, string, number, string?][]>; capitals: unknown[] };
const SPAIN = FLAGS.regions.ES;

/** Whether an image has arrived and is a picture. */
const drawn = (img: Locator): Promise<boolean> => img.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0);

test.describe('the gallery of flags', () => {
  test('shows the flags of the countries by continent, and finds one by its name', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas');
    await expect(page).toHaveTitle('Banderas del mundo — Regionle ∞');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Banderas del mundo');
    await expect(page.locator('nav.nav a[href="#/banderas"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('radio', { name: /^Países/ })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.fg-tile')).toHaveCount(249);
    await expect(page.locator('.fg-group h2').first()).toContainText('Europa');

    const search = page.getByRole('searchbox', { name: 'Buscar una bandera por su nombre' });
    await search.fill('fran');
    await expect(page.locator('.fg-tile').filter({ hasText: /^Francia$/ })).toHaveCount(1);
    expect(await page.locator('.fg-tile').count()).toBeLessThan(8);
    // Whatever its accents and its capitals.
    await search.fill('PERU');
    await expect(page.locator('.fg-tile')).toHaveText(['Perú']);
    await search.fill('zzzz');
    await expect(page.locator('.fg-none')).toHaveText('Ninguna bandera se llama así.');
    await expect(page.locator('.fg-tile')).toHaveCount(0);
    await expect(page.locator('.crash')).toHaveCount(0);
  });

  test('shows the flags of the regions of a country, the coarser level first, and of the country that is chosen', async ({ page }) => {
    await seed(page);
    // With no country in the address, that of the language.
    await open(page, '/banderas/regiones');
    const pick = page.locator('.fg-pick select');
    await expect(pick).toHaveValue('ES');
    const groups = page.locator('.fg-group');
    await expect(groups).toHaveCount(2);
    await expect(groups.nth(0).locator('h2')).toHaveText(/^Comunidades autónomas\s*19$/);
    const provinces = SPAIN.filter((row) => row[1] === 0).length;
    await expect(groups.nth(1).locator('h2')).toHaveText(new RegExp(`^Provincias\\s*${provinces} de 52$`));
    await expect(groups.nth(0).locator('.fg-tile')).toHaveCount(19);
    await expect(groups.nth(1).locator('.fg-tile')).toHaveCount(provinces);
    await expect(page.locator('.fg-count')).toHaveText(`${Object.keys(FLAGS.regions).length} países con banderas de sus regiones`);

    await pick.selectOption('JP');
    await expect(page).toHaveURL(/#\/banderas\/regiones\/JP$/);
    await expect(groups).toHaveCount(1);
    await expect(groups.locator('h2')).toHaveText(/^Prefecturas\s*47$/);
    await expect(page.locator('.fg-tile').filter({ hasText: /^Hiroshima$/ })).toHaveCount(1);
    // Back is the country that was there before.
    await page.goBack();
    await expect(pick).toHaveValue('ES');

    // A country that has no flags of its regions is not in the list: the one of the language is shown.
    await open(page, '/banderas/regiones/CN');
    await expect(pick).toHaveValue('ES');
  });

  test('shows a flag large, with whose its file is and where to say that it is wrong', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/regiones/ES');
    const tile = page.locator('.fg-tile').filter({ hasText: /^Andalucía$/ });
    await expect.poll(() => drawn(tile.locator('img'))).toBe(true);
    await tile.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Andalucía');
    await expect(dialog.locator('.fg-what')).toHaveText('Comunidad autónoma · España');
    const big = dialog.locator('.fg-big img');
    await expect(big).toHaveAttribute('alt', 'Bandera de Andalucía');
    await expect.poll(() => drawn(big)).toBe(true);
    // The flag fills its box across, and keeps its shape: three by two.
    const box = (await big.boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(1.5, 1);

    const file = dialog.getByRole('link', { name: 'Flag of Andalucía.svg' });
    await expect(file).toHaveAttribute('href', 'https://commons.wikimedia.org/wiki/File:Flag_of_Andaluc%C3%ADa.svg');
    await expect(dialog.locator('.fg-credit')).toContainText('Autor');
    await expect(dialog.getByRole('link', { name: /^CC BY-SA/ })).toHaveAttribute('href', /^https:\/\/creativecommons\.org\/licenses\/by-sa\//);
    await expect(dialog.locator('.fg-note')).toContainText('Tomada de Wikimedia Commons');
    const report = dialog.getByRole('link', { name: 'Avisar de un error en esta bandera' });
    const href = (await report.getAttribute('href'))!;
    expect(href).toContain('/issues/new?');
    const body = new URL(href).searchParams.get('body') ?? '';
    expect(body).toContain('Andalucía');
    expect(body).toContain('Flag of Andalucía.svg');

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // The flag of a country comes with the game: it says so, and names no file of Commons.
    await open(page, '/banderas');
    await page.locator('.fg-tile').filter({ hasText: /^España$/ }).click();
    await expect(dialog.locator('.fg-what')).toHaveText('País o territorio');
    await expect(dialog.locator('.fg-note')).toContainText('flag-icons');
    await expect(dialog.locator('.fg-credit')).toHaveCount(0);
  });

  test('shows a heavy drawing small by its picture, and large as the drawing it is', async ({ page }) => {
    const heavy = SPAIN.find((row) => row[6]);
    expect(heavy, 'a province of Spain whose flag is a heavy drawing').toBeDefined();
    const [, , name, , file, , small] = heavy!;
    expect(file).toMatch(/\.svg$/);
    expect(small).toMatch(/\.webp$/);
    await seed(page);
    await open(page, '/banderas/regiones/ES');
    const tile = page.locator('.fg-group').nth(heavy![1] === 0 ? 1 : 0).locator('.fg-tile').filter({ hasText: new RegExp(`^${name}$`) });
    await tile.scrollIntoViewIfNeeded();
    await expect(tile.locator('img')).toHaveAttribute('src', new RegExp(`flags/commons/${small}$`));
    await expect.poll(() => drawn(tile.locator('img'))).toBe(true);
    await tile.click();
    const big = page.getByRole('dialog').locator('.fg-big img');
    await expect(big).toHaveAttribute('src', new RegExp(`flags/commons/${file}$`));
    await expect.poll(() => drawn(big)).toBe(true);
    await expect(page.getByRole('dialog').locator('.fg-note')).toContainText('El dibujo se ha aligerado sin cambiar lo que se ve.');
  });

  test('fits every flag in a box of the same size, whatever its shape', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/regiones/ES');
    const sizes = await page.locator('.fg-box').evaluateAll((boxes) =>
      boxes.map((box) => {
        const frame = box.getBoundingClientRect();
        const img = box.querySelector('img')!.getBoundingClientRect();
        return { w: frame.width, h: frame.height, over: Math.max(img.width - frame.width, img.height - frame.height), fills: Math.min(frame.width - img.width, frame.height - img.height) };
      }),
    );
    expect(sizes.length).toBe(SPAIN.length);
    for (const size of sizes) {
      expect([size.w, size.h]).toEqual([104, 78]);
      // No flag is larger than its box (but for a hair, where its shape is rounded), and each one touches two of its sides.
      expect(size.over).toBeLessThan(1.5);
      expect(Math.abs(size.fills)).toBeLessThan(1.5);
    }
  });

  test('shows the flags of the capitals, each with its country', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/capitales');
    await expect(page.locator('.fg-tile')).toHaveCount(FLAGS.capitals.length);
    const rome = page.locator('.fg-tile').filter({ hasText: /^Roma\s*Italia$/ });
    await expect(rome).toHaveCount(1);
    await rome.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.fg-what')).toHaveText('Capital · Italia');
    await expect(dialog.getByRole('link', { name: 'Flag of Rome.svg' })).toBeVisible();
  });

  test('looks through the regions of every country when something is typed', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/regiones/ES');
    await page.getByRole('searchbox').fill('tokio');
    await expect(page.locator('.fg-tile')).toHaveText([/^Tokio\s*Japón$/]);
    await expect(page.locator('.fg-pick')).toHaveCount(0);
    await page.getByRole('searchbox').fill('');
    await expect(page.locator('.fg-pick select')).toHaveValue('ES');
  });

  test('moves between its three pages, each with its own address', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas');
    await page.getByRole('radio', { name: /^Regiones/ }).click();
    // The regions with no country named are those of the country of the language; a country that is chosen is in the address.
    await expect(page).toHaveURL(/#\/banderas\/regiones$/);
    await expect(page.locator('.fg-pick select')).toHaveValue('ES');
    await page.locator('.fg-pick select').selectOption('JP');
    await expect(page).toHaveURL(/#\/banderas\/regiones\/JP$/);
    await page.getByRole('radio', { name: /^Capitales/ }).click();
    await expect(page).toHaveURL(/#\/banderas\/capitales$/);
    await page.getByRole('radio', { name: /^Países/ }).click();
    await expect(page).toHaveURL(/#\/banderas$/);
    // The other ways of writing the address lead to the same place.
    await open(page, '/flags/regions/us');
    await expect(page).toHaveURL(/#\/banderas\/regions\/us$/);
    await expect(page.locator('.fg-pick select')).toHaveValue('US');
  });

  test('lists whose every file is, when asked', async ({ page }) => {
    await seed(page);
    let asked = 0;
    await page.route('**/data/flag-credits.json', (route) => {
      asked += 1;
      return route.continue();
    });
    await open(page, '/banderas/capitales');
    const all = page.locator('.fg-all');
    await expect(all.locator('summary')).toHaveText(/^Autores y licencias de los [\d.]+ archivos de Wikimedia Commons$/);
    // The list is not fetched until it is opened.
    expect(asked).toBe(0);
    await all.locator('summary').click();
    await expect(all.locator('li').first()).toBeVisible();
    expect(await all.locator('li').count()).toBeGreaterThan(2000);
    await expect(all.locator('li').filter({ hasText: 'Flag of Rome.svg' })).toHaveCount(1);
    expect(asked).toBe(1);
  });

  test('says so when the list of flags does not come, and tries again', async ({ page }) => {
    await seed(page);
    let fail = true;
    await page.route('**/data/flags.json', (route) => (fail ? route.abort() : route.continue()));
    await open(page, '/banderas/regiones/ES');
    await expect(page.getByRole('alert')).toContainText('No se han podido cargar las banderas');
    // The flags of the countries are still there: they came with the game.
    await page.getByRole('radio', { name: /^Países/ }).click();
    await expect(page.locator('.fg-tile')).toHaveCount(249);
    await page.getByRole('radio', { name: /^Regiones/ }).click();
    fail = false;
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.locator('.fg-pick select')).toHaveValue('ES');
  });

  test('opens in English from its own page, on the country of that language', async ({ page }) => {
    await seed(page);
    await page.goto('./flags.html');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle('Flags of the world — Regionle ∞');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Flags of the world');
    await page.getByRole('radio', { name: /^Regions/ }).click();
    await expect(page.locator('.fg-pick select')).toHaveValue('US');
    await expect(page.locator('.fg-group h2')).toHaveText(/^States\s*51$/);
    await page.locator('.fg-tile').filter({ hasText: /^Texas$/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.fg-what')).toHaveText('States · United States');
    await expect(dialog.getByRole('link', { name: 'Report a mistake in this flag' })).toBeVisible();
  });

  test('is one of the cards of the first page, which opens it without loading the game again', async ({ page }) => {
    await seed(page);
    await open(page);
    const card = page.locator('.sections a.scard').nth(5);
    await expect(card.getByRole('heading', { level: 2 })).toHaveText('Banderas');
    await expect(card).toHaveAttribute('href', 'banderas.html');
    await page.evaluate(() => ((window as unknown as { kept: number }).kept = 7));
    await card.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Banderas del mundo');
    expect(new URL(page.url()).hash).toBe('#/banderas');
    expect(await page.evaluate(() => (window as unknown as { kept?: number }).kept)).toBe(7);
  });

  test('fits a phone: three tabs on one line and nothing wider than the screen @movil', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/regiones/ES');
    await expect(page.locator('.fg-tile').first()).toBeVisible();
    // The three of the gallery: the switch of languages, above, is made of buttons of the same kind.
    const tabs = await page
      .getByRole('radiogroup', { name: 'Qué banderas' })
      .getByRole('radio')
      .evaluateAll((buttons) => buttons.map((b) => Math.round(b.getBoundingClientRect().top)));
    expect(tabs).toHaveLength(3);
    expect(new Set(tabs).size).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    // At least three flags to a row.
    const tops = await page.locator('.fg-group').first().locator('.fg-tile').evaluateAll((tiles) => tiles.slice(0, 3).map((t) => Math.round(t.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    await page.locator('.fg-tile').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
});
