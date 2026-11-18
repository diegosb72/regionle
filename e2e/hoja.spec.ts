import { expect, test } from '@playwright/test';
import { open, seed, start } from './helpers';

/** The sheet to print of the provinces of Spain: fifty and two cities. */
const PROVINCES = { section: 'regions', mode: 'print', countries: ['ES'], levels: { ES: 'f' } };

test.describe('the blank map to print', () => {
  test('is in the menu with what is there to study, and opens a sheet', async ({ page }) => {
    await seed(page, { sel: { regions: ['ES'] }, levels: { ES: 'g1' } });
    await open(page, '/regiones');
    const mode = page.locator('.mode').filter({ hasText: 'Mapa mudo' });
    await expect(mode).toContainText('en papel');
    await mode.click();
    await expect(page.locator('.mode.on')).toContainText('Mapa mudo');
    // Nothing to set: no format, no number of questions.
    await expect(page.getByRole('radiogroup', { name: 'Formato de la partida' })).toHaveCount(0);
    await expect(page.getByRole('radiogroup', { name: 'Número de preguntas' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Ver la hoja' }).click();
    const sheet = page.locator('.sheet[data-sheet="map"]');
    await expect(sheet).toBeVisible({ timeout: 30_000 });
    await expect(sheet.locator('.sheet-head h2')).toHaveText('España · comunidades autónomas');
    await expect(sheet.locator('.sheet-list li')).toHaveCount(19);
  });

  test('numbers every piece once and leaves a line for each name', async ({ page }) => {
    await start(page, PROVINCES);
    const sheet = page.locator('.sheet[data-sheet="map"]');
    await expect(sheet).toBeVisible({ timeout: 30_000 });
    const numbers = (await sheet.locator('.sheet-map .sm-num text').allTextContents()).map(Number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 52 }, (_, i) => i + 1));
    await expect(sheet.locator('.sheet-list li b')).toHaveText(numbers.map(String));
    // Lines to write on, and not a name in sight.
    await expect(sheet.locator('.sheet-list li i')).toHaveCount(52);
    await expect(sheet.locator('.sheet-list')).not.toContainText(/[a-z]/i);
    await expect(sheet.locator('.sheet-sub')).toContainText('Escribe el nombre que corresponde a cada número.');
    await expect(sheet.locator('.sheet-fields')).toContainText('Nombre');
    // The Canary Islands, far away, in a box of their own with its two numbers.
    await expect(sheet.locator('.sm-inset')).toHaveCount(1);
    await expect(sheet.locator('.sm-inset .sm-num text')).toHaveCount(2);
  });

  test('can be left without numbers, and can bring its answers', async ({ page }) => {
    await start(page, PROVINCES);
    const sheet = page.locator('.sheet[data-sheet="map"]');
    await expect(sheet).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.sheet')).toHaveCount(1);

    await page.getByText('Añadir las soluciones').click();
    const key = page.locator('.sheet[data-sheet="answers"]');
    await expect(key.locator('.sheet-sub')).toHaveText('Soluciones');
    await expect(key.locator('.sheet-list li')).toHaveCount(52);
    const names = await key.locator('.sheet-list li span').allTextContents();
    expect(new Set(names).size).toBe(52);
    for (const name of ['Madrid', 'Santa Cruz de Tenerife', 'Ceuta', 'La Coruña']) expect(names).toContain(name);
    // The same numbers on both sheets: the answers are read against the map handed out.
    const where = async (which: 'map' | 'answers') => page.locator(`.sheet[data-sheet="${which}"] .sheet-map .sm-num text`).allTextContents();
    expect((await where('answers')).map(Number).sort((a, b) => a - b)).toEqual((await where('map')).map(Number).sort((a, b) => a - b));

    await page.getByText('Números y líneas para los nombres').click();
    await expect(sheet.locator('.sheet-map .sm-num text')).toHaveCount(0);
    await expect(sheet.locator('.sheet-list')).toHaveCount(0);
    await expect(sheet.locator('.sheet-sub')).not.toContainText('Escribe');
    // The answers keep theirs.
    await expect(key.locator('.sheet-list li')).toHaveCount(52);
  });

  test('takes the title it is given and sends it to the printer', async ({ page }) => {
    await start(page, PROVINCES);
    await expect(page.locator('.sheet')).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveTitle('España · provincias — mapa mudo');
    await page.getByLabel('Título de la hoja').fill('Examen del jueves · 3.º B');
    await expect(page.locator('.sheet-head h2')).toHaveText('Examen del jueves · 3.º B');
    // The name the browser offers for the PDF.
    await expect(page).toHaveTitle('Examen del jueves · 3.º B — mapa mudo');

    await page.evaluate(() => {
      const w = window as unknown as { printed: number; print: () => void };
      w.printed = 0;
      w.print = () => void w.printed++;
    });
    await page.getByRole('button', { name: 'Imprimir' }).click();
    expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  });

  test('prints the sheets and nothing else, each on its page', async ({ page }) => {
    await start(page, PROVINCES);
    await expect(page.locator('.sheet')).toBeVisible({ timeout: 30_000 });
    await page.getByText('Añadir las soluciones').click();
    await expect(page.locator('.sheet')).toHaveCount(2);
    // Fifty-two lines beside a map wider than tall: the paper lies down.
    expect(await page.locator('.sheets style').textContent()).toContain('size: landscape');

    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.play-top')).toBeHidden();
    await expect(page.locator('.panel')).toBeHidden();
    const sheets = page.locator('.sheet');
    await expect(sheets.first()).toBeVisible();
    // At its real size: a sheet lying down is 250 mm of writing across, 945 px.
    const width = await sheets.first().evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.round(width)).toBe(945);
    expect(await sheets.first().evaluate((el) => getComputedStyle(el).breakAfter)).toBe('page');
    // Black on white whatever the theme of the screen.
    expect(await sheets.first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
  });

  test('fits a page: the map and its lines never run past the paper', async ({ page }) => {
    for (const game of [PROVINCES, { section: 'regions', mode: 'print', countries: ['PT'] }, { section: 'cities', mode: 'print', countries: ['ES'], opts: { cityPick: 'top', cityCount: 25 } }]) {
      await start(page, game);
      const sheet = page.locator('.sheet[data-sheet="map"]');
      await expect(sheet).toBeVisible({ timeout: 30_000 });
      // From the title to the credit, in millimetres of paper (the map says how wide it is in them),
      // against the 250 a page has to write on, or the 186 of one lying down.
      const fits = await sheet.evaluate((el) => {
        const map = el.querySelector<SVGElement>('.sheet-map')!;
        const mm = parseFloat(map.style.width) / map.getBoundingClientRect().width;
        const top = el.querySelector('.sheet-head')!.getBoundingClientRect().top;
        const bottom = el.querySelector('.sheet-foot')!.getBoundingClientRect().bottom;
        return { height: (bottom - top) * mm, room: el.classList.contains('sheet-wide') ? 186 : 250 };
      });
      expect(fits.height, JSON.stringify(game)).toBeGreaterThan(fits.room * 0.5);
      expect(fits.height, JSON.stringify(game)).toBeLessThanOrEqual(fits.room + 0.5);
    }
  });

  test('numbers only the pieces of a list of one\'s own', async ({ page }) => {
    await start(page, { ...PROVINCES, only: ['ES-M', 'ES-B', 'ES-A', 'ES-AB', 'ES-GC'], list: 'Examen del jueves' });
    const sheet = page.locator('.sheet[data-sheet="map"]');
    await expect(sheet).toBeVisible({ timeout: 30_000 });
    await expect(sheet.locator('.sheet-head h2')).toHaveText('España · provincias · Examen del jueves');
    expect((await sheet.locator('.sheet-map .sm-num text').allTextContents()).sort()).toEqual(['1', '2', '3', '4', '5']);
    await expect(sheet.locator('.sheet-list li')).toHaveCount(5);
    await expect(page.locator('.q-sub')).toContainText('5 provincias de tu lista');
  });

  test('leaves nothing behind: it is not a game played', async ({ page }) => {
    await start(page, PROVINCES);
    await expect(page.locator('.sheet')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Salir' }).click();
    await open(page, '/progreso');
    await expect(page.locator('.records')).toHaveCount(0);
    await expect(page.locator('.table-wrap')).toHaveCount(0);
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1') ?? '{}').state);
    expect(kept.sessions ?? []).toHaveLength(0);
    expect(kept.recent ?? []).toHaveLength(0);
  });

  test('is at hand on a phone, where the options take the panel @movil', async ({ page }) => {
    await start(page, PROVINCES);
    await expect(page.locator('.sheet')).toBeVisible({ timeout: 30_000 });
    // The button of the top bar, always in sight.
    await expect(page.locator('.play-top .sheet-print')).toBeVisible();
    await expect(page.locator('.play-top .sheet-print')).toHaveText('Imprimir');
    // The sheet is shrunk to the screen: nothing to scroll sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const sheet = await page.locator('.sheet').boundingBox();
    expect(sheet!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
});
