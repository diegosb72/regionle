import fs from 'node:fs';
import { expect, test, type Locator } from '@playwright/test';
import { open, seed } from './helpers';

/** The list of flags the site is built with: what the gallery shows is counted against it. */
const FLAGS = JSON.parse(fs.readFileSync('public/data/flags.json', 'utf8')) as {
  regions: Record<string, [string, number, string, string, string, number, string?][]>;
  capitals: [string, string, ...unknown[]][];
  cities: Record<string, [string, string, ...unknown[]][]>;
  past: Record<string, [string, number, number, number, string?][]>;
  gone: [string, string, string, string, number, number, number, string?][];
  organisations: unknown[];
  peoples: unknown[];
  signals: [string, string, ...unknown[]][];
};
const SPAIN = FLAGS.regions.ES;
const count = (lists: Record<string, unknown[]>): number => Object.values(lists).reduce((sum, list) => sum + list.length, 0);

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
    // By the name the page had when it held nothing else.
    await open(page, '/banderas/capitales');
    await expect(page.getByRole('radio', { name: /^Ciudades/ })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.fg-pick select')).toHaveValue('');
    await expect(page.locator('.fg-pick option').first()).toHaveText(`Las capitales de los países (${FLAGS.capitals.length})`);
    await expect(page.locator('.fg-tile')).toHaveCount(FLAGS.capitals.length);
    const rome = page.locator('.fg-tile').filter({ hasText: /^Roma\s*Italia$/ });
    await expect(rome).toHaveCount(1);
    await rome.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.fg-what')).toHaveText('Capital · Italia');
    await expect(dialog.getByRole('link', { name: 'Flag of Rome.svg' })).toBeVisible();
  });

  test('shows the flags of the cities of a country, its capital first, and looks through them all', async ({ page }) => {
    const spain = FLAGS.cities.ES;
    expect(spain.length, 'cities of Spain with a flag').toBeGreaterThan(10);
    await seed(page);
    await open(page, '/banderas/ciudades');
    const pick = page.locator('.fg-pick select');
    await pick.selectOption('ES');
    await expect(page).toHaveURL(/#\/banderas\/ciudades\/ES$/);
    const groups = page.locator('.fg-group');
    await expect(groups).toHaveCount(2);
    await expect(groups.nth(0).locator('h2')).toHaveText(/^Capital\s*1$/);
    await expect(groups.nth(0).locator('.fg-tile')).toHaveText(['Madrid']);
    await expect(groups.nth(1).locator('h2')).toHaveText(new RegExp(`^Otras ciudades\\s*${spain.length}$`));
    await expect(groups.nth(1).locator('.fg-tile')).toHaveCount(spain.length);
    const countries = new Set([...Object.keys(FLAGS.cities), ...FLAGS.capitals.map((row) => row[1])]);
    await expect(page.locator('.fg-count')).toHaveText(`${countries.size} países con banderas de sus ciudades`);
    // The option of each country counts its capital with the rest.
    await expect(pick.locator('option:checked')).toHaveText(`España (${spain.length + 1})`);

    const [, name] = spain[0];
    await groups.nth(1).locator('.fg-tile').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(name);
    await expect(dialog.locator('.fg-what')).toHaveText('Ciudad · España');
    await expect(dialog.locator('.fg-big img')).toHaveAttribute('alt', `Bandera de ${name}`);
    await page.keyboard.press('Escape');

    // With something typed, the cities of every country, capitals and all, each with its country.
    await page.getByRole('searchbox').fill('roma');
    await expect(page.locator('.fg-tile').filter({ hasText: /^Roma\s*Italia$/ })).toHaveCount(1);
    await expect(page.locator('.fg-pick')).toHaveCount(0);
    await page.getByRole('searchbox').fill('');
    await expect(pick).toHaveValue('ES');
    // Back to the capitals of them all.
    await pick.selectOption('');
    await expect(page).toHaveURL(/#\/banderas\/ciudades$/);
    await expect(page.locator('.fg-tile')).toHaveCount(FLAGS.capitals.length);
    // A country with no flag of a city is not in the list: the capitals are shown.
    await open(page, '/banderas/ciudades/ZZ');
    await expect(pick).toHaveValue('');
  });

  test('shows the flags of other times: what is no more with its years, and those each country flew, by country', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/historicas');
    await expect(page.getByRole('radio', { name: /^Históricas/ })).toHaveAttribute('aria-checked', 'true');
    const groups = page.locator('.fg-group');
    await expect(groups).toHaveCount(2);
    await expect(groups.nth(0).locator('h2')).toHaveText(new RegExp(`^Países y territorios que ya no existen\\s*${FLAGS.gone.length}$`));
    await expect(groups.nth(1).locator('h2')).toHaveText(new RegExp(`^Banderas anteriores de los países de hoy\\s*${count(FLAGS.past)}$`));
    await expect(groups.nth(0).locator('.fg-tile')).toHaveCount(FLAGS.gone.length);
    // The last to end, first.
    const ends = await groups.nth(0).locator('.fg-tile small').evaluateAll((all) => all.slice(0, 12).map((el) => Number((el.textContent ?? '').slice(-4))));
    expect(ends).toEqual([...ends].sort((a, b) => b - a));

    const ussr = groups.nth(0).locator('.fg-tile').filter({ hasText: /^Unión Soviética\s*1922–1991$/ });
    await expect(ussr).toHaveCount(1);
    await ussr.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Unión Soviética');
    await expect(dialog.locator('.fg-what')).toHaveText('País o territorio que ya no existe · 1922–1991');
    await expect(dialog.getByRole('link', { name: 'Flag of the Soviet Union.svg' })).toBeVisible();
    await page.keyboard.press('Escape');

    // Those of a country are under its name, each under its years, the oldest first.
    const spain = page.locator('.fg-land').filter({ has: page.locator('h3', { hasText: /^España/ }) });
    await expect(spain.locator('h3')).toHaveText(new RegExp(`^España\\s*${FLAGS.past.ES.length}$`));
    await expect(spain.locator('.fg-tile')).toHaveCount(FLAGS.past.ES.length);
    await expect(spain.locator('.fg-tile').filter({ hasText: /^1931–1939$/ })).toHaveCount(1);
    await spain.locator('.fg-tile').filter({ hasText: /^1931–1939$/ }).click();
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('España');
    await expect(dialog.locator('.fg-what')).toHaveText('Bandera anterior · España · 1931–1939');
    await expect(dialog.locator('.fg-big img')).toHaveAttribute('alt', 'Bandera de España (1931–1939)');
    await page.keyboard.press('Escape');

    // A search looks through both: the name of what is no more, and that of the country.
    await page.getByRole('searchbox').fill('yugoslavia');
    await expect(groups).toHaveCount(1);
    await expect(page.locator('.fg-tile').filter({ hasText: /^Yugoslavia\s*1918–1992$/ })).toHaveCount(1);
    await page.getByRole('searchbox').fill('españa');
    await expect(page.locator('.fg-land h3')).toHaveText([new RegExp('^España')]);
    await expect(page.locator('.crash')).toHaveCount(0);
  });

  test('shows the flags of organisations and of peoples, and the signals with what each says', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/otras');
    await expect(page.getByRole('radio', { name: /^Otras/ })).toHaveAttribute('aria-checked', 'true');
    const signals = (group: string) => FLAGS.signals.filter((row) => row[1] === group).length;
    await expect(page.locator('.fg-group h2')).toHaveText([
      new RegExp(`^Organizaciones\\s*${FLAGS.organisations.length}$`),
      new RegExp(`^Pueblos y Estados sin reconocimiento general\\s*${FLAGS.peoples.length}$`),
      new RegExp(`^Código internacional de señales\\s*${signals('sea')}$`),
      new RegExp(`^Carreras de motor\\s*${signals('race')}$`),
      new RegExp(`^Otras banderas sin país\\s*${signals('other')}$`),
    ]);
    await expect(page.locator('.fg-tile')).toHaveCount(FLAGS.organisations.length + FLAGS.peoples.length + FLAGS.signals.length);

    const dialog = page.getByRole('dialog');
    await page.locator('.fg-tile').filter({ hasText: /^Unión Europea$/ }).click();
    await expect(dialog.locator('.fg-what')).toHaveText('Organización');
    await expect(dialog.getByRole('link', { name: 'Flag of Europe.svg' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('.fg-tile').filter({ hasText: /^Samis$/ }).click();
    await expect(dialog.locator('.fg-what')).toHaveText('Pueblo, o Estado sin reconocimiento general');
    await page.keyboard.press('Escape');

    // A signal says something: «A» is a diver down.
    await page.locator('.fg-tile').filter({ hasText: /^A · Alfa$/ }).click();
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('A · Alfa');
    await expect(dialog.locator('.fg-what')).toHaveText('Señal · Código internacional de señales');
    await expect(dialog.locator('.fg-means')).toHaveText(/^Izada sola, dice: .*buzo sumergido/);
    await expect(dialog.locator('.fg-big img')).toHaveAttribute('alt', 'A · Alfa');
    await expect(dialog.getByRole('link', { name: 'ICS Alfa.svg' })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('searchbox').fill('cuadros');
    await expect(page.locator('.fg-tile')).toHaveText(['Bandera a cuadros']);
    await expect(page.locator('.fg-group h2')).toHaveText([/^Carreras de motor\s*1$/]);
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

  test('moves between its five pages, each with its own address', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas');
    await page.getByRole('radio', { name: /^Regiones/ }).click();
    // The regions with no country named are those of the country of the language; a country that is chosen is in the address.
    await expect(page).toHaveURL(/#\/banderas\/regiones$/);
    await expect(page.locator('.fg-pick select')).toHaveValue('ES');
    await page.locator('.fg-pick select').selectOption('JP');
    await expect(page).toHaveURL(/#\/banderas\/regiones\/JP$/);
    await page.getByRole('radio', { name: /^Ciudades/ }).click();
    await expect(page).toHaveURL(/#\/banderas\/ciudades$/);
    await page.getByRole('radio', { name: /^Históricas/ }).click();
    await expect(page).toHaveURL(/#\/banderas\/historicas$/);
    await page.getByRole('radio', { name: /^Otras/ }).click();
    await expect(page).toHaveURL(/#\/banderas\/otras$/);
    await page.getByRole('radio', { name: /^Países/ }).click();
    await expect(page).toHaveURL(/#\/banderas$/);
    // Each tab says how many flags it has.
    await expect(page.getByRole('radio', { name: /^Ciudades/ })).toContainText(String(FLAGS.capitals.length + count(FLAGS.cities)));
    await expect(page.getByRole('radio', { name: /^Históricas/ })).toContainText(String(FLAGS.gone.length + count(FLAGS.past)));
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
    expect(await all.locator('li').count()).toBeGreaterThan(3000);
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

  test('fits a phone: five tabs on two lines at most and nothing wider than the screen @movil', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/regiones/ES');
    await expect(page.locator('.fg-tile').first()).toBeVisible();
    // The five of the gallery: the switch of languages, above, is made of buttons of the same kind.
    const tabs = await page
      .getByRole('radiogroup', { name: 'Qué banderas' })
      .getByRole('radio')
      .evaluateAll((buttons) => buttons.map((b) => ({ top: Math.round(b.getBoundingClientRect().top), right: b.getBoundingClientRect().right })));
    expect(tabs).toHaveLength(5);
    expect(new Set(tabs.map((tab) => tab.top)).size).toBeLessThanOrEqual(2);
    for (const tab of tabs) expect(tab.right).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    // The other pages are no wider: the long names of what is no more, the years, the signals.
    for (const route of ['/banderas/historicas', '/banderas/otras', '/banderas/ciudades/ES']) {
      await open(page, route);
      await expect(page.locator('.fg-tile').first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), route).toBeLessThanOrEqual(0);
    }
    await open(page, '/banderas/regiones/ES');
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
