import { expect, test, type Page } from '@playwright/test';
import { open, seed, start } from './helpers';

/** The bingo of the provinces of Spain: fifty and two cities, 52 pieces. */
const PROVINCES = { section: 'regions', mode: 'bingo', countries: ['ES'], levels: { ES: 'f' } };
/** What follows the number in the address of its cards of 4 × 4. */
const KEY = '4/regiones/ES:f';
/** Card 7 of that bingo, row after row: the same in every browser, and on a sheet printed last year. */
const SEVEN = ['Huesca', 'Asturias', 'Guipúzcoa', 'Murcia', 'Orense', 'Guadalajara', 'Santa Cruz de Tenerife', 'La Rioja', 'Ávila', 'La Coruña', 'Tarragona', 'Barcelona', 'Burgos', 'Madrid', 'Navarra', 'Vizcaya'];
const SEVEN_IDS = ['ES-HU', 'ES-O', 'ES-SS', 'ES-MU', 'ES-OR', 'ES-GU', 'ES-TF', 'ES-LO', 'ES-AV', 'ES-C', 'ES-T', 'ES-B', 'ES-BU', 'ES-M', 'ES-NA', 'ES-BI'];
/** Every province, as the map calls them. */
const ALL = 'A AB AL AV B BA BI BU C CA CC CE CO CR CS CU GC GI GR GU H HU J L LE LO LU M MA ML MU NA O OR P PM PO S SA SE SG SO SS T TE TF TO V VA VI Z ZA'.split(' ').map((code) => `ES-${code}`);

interface Kept {
  set: { how: string; size: number } | null;
  draws: Record<string, { how: string; size: number; out: string[]; shown: boolean }>;
  marks: Record<string, number[]>;
  own: Record<string, number>;
}
const kept = (page: Page): Promise<Kept | null> => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:bingo') ?? 'null'));
/** The game of the screen that calls, once it has drawn its first piece. */
const outOf = async (page: Page): Promise<string[]> => Object.values((await kept(page))!.draws)[0].out;

/** The screen that calls, with the first piece out. */
async function calling(page: Page, game: Record<string, unknown> = PROVINCES): Promise<void> {
  await start(page, game);
  await expect(page.locator('.q.bingo')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Sacar la primera' }).click();
  await expect(page.locator('.q.bingo .kicker')).toHaveText(/^Pieza 1 de \d+$/);
}

/**
 * The game as it would stand with these pieces out, in this order: what the screen keeps is rewritten, and
 * the page opened again. What comes out is drawn at random, and a test cannot wait for a line to turn up.
 */
async function withOut(page: Page, out: string[]): Promise<void> {
  await page.evaluate((ids) => {
    const all = JSON.parse(localStorage.getItem('regionle:bingo')!) as { draws: Record<string, { out: string[] }> };
    Object.values(all.draws)[0].out = ids;
    localStorage.setItem('regionle:bingo', JSON.stringify(all));
  }, out);
  await page.reload();
  await expect(page.locator('.q.bingo .kicker')).toHaveText(new RegExp(`^Pieza ${out.length} de \\d+$`), { timeout: 30_000 });
}

async function check(page: Page, n: string): Promise<void> {
  await page.locator('#bingo-n').fill(n);
  await page.getByRole('button', { name: 'Comprobar' }).click();
}

test.describe('the bingo of a map: where it is started', () => {
  test('is in the menu with what is there for a class, and opens the screen that calls', async ({ page }) => {
    await seed(page, { sel: { regions: ['ES'] }, levels: { ES: 'f' } });
    await open(page, '/regiones');
    const mode = page.locator('.mode').filter({ hasText: 'Bingo' });
    await expect(mode).toContainText('en grupo');
    // The sheet to print is the one that is on paper.
    await expect(page.locator('.mode').filter({ hasText: 'Mapa mudo' })).toContainText('en papel');
    await mode.click();
    await expect(page.locator('.mode.on')).toContainText('Bingo');
    // Nothing of a game of one player: no format, no number of questions, no homework.
    await expect(page.getByRole('radiogroup', { name: 'Formato de la partida' })).toHaveCount(0);
    await expect(page.getByRole('radiogroup', { name: 'Número de preguntas' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Poner de tarea' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Incrustar' })).toHaveCount(0);
    await expect(page.locator('.startbar-info b')).toHaveText('Bingo');

    await page.getByRole('button', { name: 'Abrir el bingo' }).click();
    await expect(page.locator('.q.bingo .q-ask')).toHaveText('Prepara la partida', { timeout: 30_000 });
    await expect(page.locator('.play-title')).toContainText('España · provincias');
    await expect(page.locator('.map-svg [data-id]').first()).toBeVisible();
    // Nothing has come out: no game is kept, and nothing is painted.
    expect((await kept(page))?.draws ?? {}).toEqual({});
    await expect(page.locator('.map-svg .st-ok, .map-svg .st-target')).toHaveCount(0);
  });

  test('is not offered on a map with too few pieces for a card', async ({ page }) => {
    // The eight states and territories of Australia: fewer than the twelve the smallest card asks for.
    await seed(page, { sel: { regions: ['AU'] }, mode: { regions: 'bingo' } });
    await open(page, '/regiones');
    await expect(page.locator('.mode.on')).toContainText('Bingo');
    await expect(page.locator('.startbar-info b')).toHaveText('El bingo pide un mapa con al menos 12 piezas.');
    await expect(page.getByRole('button', { name: 'Abrir el bingo' })).toBeDisabled();
    // Another game on the same map has nothing against it.
    await page.locator('.mode').filter({ hasText: 'Señalar' }).click();
    await expect(page.locator('.startbar-info b')).toHaveText('Señalar');
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeEnabled();
  });

  test('says so when it is reached with too few pieces all the same', async ({ page }) => {
    await start(page, { section: 'regions', mode: 'bingo', countries: ['AU'] });
    await expect(page.locator('main')).toContainText('Pocas piezas para un bingo');
    await expect(page.locator('main')).toContainText('Aquí hay 8');
    await expect(page.getByRole('button', { name: 'Sacar la primera' })).toHaveCount(0);
  });

  test('explains itself behind the question mark, and leaves nothing in the progress', async ({ page }) => {
    await calling(page);
    await page.getByRole('button', { name: 'Sacar otra' }).click();
    await page.locator('.play-help').click();
    const help = page.locator('.dlg-box');
    await expect(help).toContainText('Imprimir cartones');
    await expect(help).toContainText('Línea es una fila, una columna o una diagonal entera');
    await page.keyboard.press('Escape');
    await expect(help).toHaveCount(0);

    await page.getByRole('button', { name: 'Salir' }).click();
    await open(page, '/progreso');
    const state = await page.evaluate(() => (JSON.parse(localStorage.getItem('regionle:v1')!) as { state: { sessions?: unknown[]; recent?: unknown[] } }).state);
    expect(state.sessions ?? []).toHaveLength(0);
    expect(state.recent ?? []).toHaveLength(0);
  });
});

test.describe('the bingo of a map: the screen that calls', () => {
  test('offers the ways its map can be called, and the sizes it has pieces for', async ({ page }) => {
    await start(page, PROVINCES);
    const ways = page.getByRole('radiogroup', { name: 'Cómo salen las piezas' });
    await expect(ways.getByRole('radio')).toHaveText(['En el mapa', 'Capital', 'Silueta', 'Nombre']);
    await expect(ways.getByRole('radio', { checked: true })).toHaveText('En el mapa');
    const sizes = page.getByRole('radiogroup', { name: 'Tamaño del cartón' });
    await expect(sizes.getByRole('radio')).toHaveText(['3 × 3', '4 × 4', '5 × 5']);
    await expect(sizes.getByRole('radio', { checked: true })).toHaveText('4 × 4');
    await expect(page.locator('.q.bingo .options')).toContainText('Cada cartón lleva 16 de las 52 provincias que pueden salir.');
    await sizes.getByRole('radio', { name: '5 × 5' }).click();
    await expect(page.locator('.q.bingo .options')).toContainText('Cada cartón lleva 25 de las 52 provincias');
  });

  test('offers a small card alone on a small map, and the flags where the pieces are countries', async ({ page }) => {
    // Nineteen communities: enough for 3 × 3 (twelve), not for 4 × 4 (twenty-two).
    await start(page, { ...PROVINCES, levels: { ES: 'g1' } });
    await expect(page.getByRole('radiogroup', { name: 'Tamaño del cartón' }).getByRole('radio')).toHaveText(['3 × 3']);
    await expect(page.locator('.bingo-deal a[target="_blank"]')).toHaveAttribute('href', '#/bingo/1-30/3/regiones/ES:g1');
  });

  test('calls countries by their flags too', async ({ page }) => {
    const europe = ['AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'UA', 'GB'];
    await start(page, { section: 'countries', mode: 'bingo', countries: europe });
    const ways = page.getByRole('radiogroup', { name: 'Cómo salen las piezas' });
    await expect(ways.getByRole('radio')).toHaveText(['En el mapa', 'Bandera', 'Capital', 'Silueta', 'Nombre']);
    await ways.getByRole('radio', { name: 'Bandera' }).click();
    await page.getByRole('button', { name: 'Sacar la primera' }).click();
    await expect(page.locator('.q.bingo .q-flag')).toBeVisible();
    await expect(page.locator('.q.bingo')).toContainText('Quien tenga el país de esta bandera, lo marca.');
    // The flag is all there is to go by: the country is not lit until its name is asked for.
    await expect(page.locator('.map-svg .st-target')).toHaveCount(0);
    await page.getByRole('button', { name: 'Ver el nombre' }).click();
    await expect(page.locator('.bingo-name')).not.toBeEmpty();
    await expect(page.locator('.map-svg .st-target').first()).toBeVisible();
  });

  test('draws the pieces one by one, each once, and counts them', async ({ page }) => {
    await calling(page);
    await expect(page.locator('.q.bingo .q-ask')).toContainText('La provincia que está iluminada en el mapa');
    // The one that has come out is lit, and not named.
    const lit = page.locator('.map-svg path.st-target, .map-svg .m-ring.st-target');
    await expect(lit.first()).toBeVisible();
    const first = await lit.first().getAttribute('data-id');
    expect(ALL).toContain(first);
    expect(await outOf(page)).toEqual([first]);
    await expect(page.locator('.bingo-name')).toBeEmpty();
    await expect(page.locator('.bingo-out summary')).toHaveText('Ha salido 1: ver cuál');

    await page.getByRole('button', { name: 'Ver el nombre' }).click();
    await expect(page.locator('.bingo-name')).not.toBeEmpty();
    await expect(page.getByRole('button', { name: 'Ver el nombre' })).toHaveCount(0);
    const name = await page.locator('.bingo-name').textContent();

    await page.getByRole('button', { name: 'Sacar otra' }).click();
    await expect(page.locator('.q.bingo .kicker')).toHaveText('Pieza 2 de 52');
    // The first one stays painted as out, and another is lit; its name is hidden again.
    await expect(page.locator(`.map-svg [data-id="${first}"].st-ok`).first()).toBeVisible();
    await expect(page.locator('.bingo-name')).toBeEmpty();
    await expect(page.getByRole('button', { name: 'Ver el nombre' })).toBeVisible();
    const out = await outOf(page);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(first);
    expect(out[1]).not.toBe(first);
    expect(ALL).toContain(out[1]);

    // What has come out, the latest first: the one in hand is not named before its name is asked for.
    await page.locator('.bingo-out summary').click();
    await expect(page.locator('.bingo-out li')).toHaveText(['…', name!]);
    for (let i = 3; i <= 12; i++) {
      await page.getByRole('button', { name: 'Sacar otra' }).click();
      await expect(page.locator('.q.bingo .kicker')).toHaveText(`Pieza ${i} de 52`);
    }
    const twelve = await outOf(page);
    expect(new Set(twelve).size).toBe(12);
    await expect(page.locator('.bingo-out li')).toHaveCount(12);
  });

  test('goes on where it was when the page is opened again, and stops when everything has come out', async ({ page }) => {
    await calling(page);
    const first = (await outOf(page))[0];
    await page.reload();
    await expect(page.locator('.q.bingo .kicker')).toHaveText('Pieza 1 de 52', { timeout: 30_000 });
    expect(await outOf(page)).toEqual([first]);

    // All but one out: the last one is the one that is left.
    await withOut(page, ALL.slice(0, 51));
    await expect(page.locator('.map-svg path.st-ok[data-id]')).not.toHaveCount(0);
    await page.getByRole('button', { name: 'Sacar otra' }).click();
    await expect(page.locator('.q.bingo .kicker')).toHaveText('Pieza 52 de 52');
    expect((await outOf(page))[51]).toBe(ALL[51]);
    await expect(page.getByRole('button', { name: 'Han salido todas' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Sacar otra' })).toHaveCount(0);
  });

  test('checks a card by its number: not yet, a line, bingo', async ({ page }) => {
    await calling(page);
    const said = page.locator('#bingo-said');

    // One piece of card 7 out, and one that is not on it.
    await withOut(page, ['ES-HU', 'ES-Z']);
    await check(page, '7');
    await expect(said).toHaveClass(/is-none/);
    await expect(said.locator('strong')).toHaveText('Todavía no');
    await expect(said).toContainText('El cartón 7 no tiene ninguna línea completa: lleva 1 de 16 casillas.');
    // The card is shown as it is dealt, with what has come out marked on it.
    await expect(said.locator('.bcell-name')).toHaveText(SEVEN);
    await expect(said.locator('.bcell.on .bcell-name')).toHaveText(['Huesca']);

    // Its first row.
    await withOut(page, ['ES-Z', ...SEVEN_IDS.slice(0, 4)]);
    await check(page, '7');
    await expect(said).toHaveClass(/is-line/);
    await expect(said.locator('strong')).toHaveText('¡Línea!');
    await expect(said.locator('.bcell.in-line .bcell-name')).toHaveText(SEVEN.slice(0, 4));
    // Another card has no line with the same pieces.
    await check(page, '8');
    await expect(said.locator('strong')).toHaveText('Todavía no');

    // A diagonal counts as well: cells 0, 5, 10 and 15.
    await withOut(page, [0, 5, 10, 15].map((cell) => SEVEN_IDS[cell]));
    await check(page, '7');
    await expect(said.locator('strong')).toHaveText('¡Línea!');
    await expect(said.locator('.bcell.in-line .bcell-name')).toHaveText([0, 5, 10, 15].map((cell) => SEVEN[cell]));

    // The whole card.
    await withOut(page, [...SEVEN_IDS].reverse());
    await check(page, '7');
    await expect(said).toHaveClass(/is-bingo/);
    await expect(said.locator('strong')).toHaveText('¡Bingo!');
    await expect(said.locator('.bcell.on')).toHaveCount(16);

    // What is not the number of a card is said, and judges nothing.
    for (const bad of ['0', 'siete', '']) {
      await check(page, bad);
      await expect(said).toContainText('El número de un cartón va del 1 al 99999.');
      await expect(said.locator('strong')).toHaveCount(0);
      await expect(page.locator('#bingo-n')).toHaveAttribute('aria-invalid', 'true');
    }
    // The numbers the phones give themselves are cards too.
    await check(page, '48213');
    await expect(said.locator('strong')).toHaveText(/Todavía no|¡Línea!/);
    await expect(said.locator('.bcell')).toHaveCount(16);
  });

  test('forgets a check when another piece comes out', async ({ page }) => {
    await calling(page);
    await check(page, '7');
    await expect(page.locator('#bingo-said strong')).toBeVisible();
    await page.getByRole('button', { name: 'Sacar otra' }).click();
    await expect(page.locator('.q.bingo .kicker')).toHaveText('Pieza 2 de 52');
    await expect(page.locator('#bingo-said strong')).toHaveCount(0);
  });

  test('calls by the capital, by the outline or by the name, and the way can change half way', async ({ page }) => {
    await start(page, PROVINCES);
    const ways = page.getByRole('radiogroup', { name: 'Cómo salen las piezas' });
    await ways.getByRole('radio', { name: 'Capital' }).click();
    await page.getByRole('button', { name: 'Sacar la primera' }).click();
    await expect(page.locator('.q.bingo .bingo-lead')).toHaveText('Su capital es');
    await expect(page.locator('.q.bingo .q-name')).not.toBeEmpty();
    // Not given away by a colour on the map.
    await expect(page.locator('.map-svg .st-target')).toHaveCount(0);
    expect((await kept(page))!.set).toEqual({ how: 'capital', size: 4 });

    await page.locator('.bingo-more summary').click();
    await ways.getByRole('radio', { name: 'Silueta' }).click();
    await expect(page.locator('.outline-stage svg path')).toBeVisible();
    await expect(page.locator('.q.bingo .q-ask')).toContainText('La provincia que tiene esta silueta');
    await page.getByRole('button', { name: 'Ver el nombre' }).click();
    // Its name is said, and the map comes back with the piece lit.
    await expect(page.locator('.outline-stage')).toHaveCount(0);
    await expect(page.locator('.bingo-name')).not.toBeEmpty();
    await expect(page.locator('.map-svg .st-target').first()).toBeVisible();

    await ways.getByRole('radio', { name: 'Nombre' }).click();
    await page.getByRole('button', { name: 'Sacar otra' }).click();
    await expect(page.locator('.q.bingo .kicker')).toHaveText('Pieza 2 de 52');
    // By its name there is nothing to ask for: it is in sight, and so is the piece.
    await expect(page.locator('.q.bingo .q-name')).not.toBeEmpty();
    await expect(page.getByRole('button', { name: 'Ver el nombre' })).toHaveCount(0);
    await expect(page.locator('.map-svg .st-target').first()).toBeVisible();
    // The cards are the same whatever the way: the link to them has not changed.
    await expect(page.locator('.bingo-deal a[target="_blank"]')).toHaveAttribute('href', `#/bingo/1-30/${KEY}`);
    expect((await kept(page))!.set).toEqual({ how: 'name', size: 4 });
  });

  test('says how many pieces cannot come up the way that was chosen', async ({ page }) => {
    // Japan: forty-seven prefectures, and a few of them without a capital in the data.
    await start(page, { section: 'regions', mode: 'bingo', countries: ['JP'] });
    const ways = page.getByRole('radiogroup', { name: 'Cómo salen las piezas' });
    await ways.getByRole('radio', { name: 'Capital' }).click();
    await expect(page.locator('.q.bingo .options')).toContainText(/Hay \d+ piezas que no pueden salir así: salen por su nombre\./);
    await ways.getByRole('radio', { name: 'En el mapa' }).click();
    await expect(page.locator('.q.bingo .options')).not.toContainText('no pueden salir así');
  });

  test('starts again only when it is asked twice', async ({ page }) => {
    await calling(page);
    await page.getByRole('button', { name: 'Sacar otra' }).click();
    await page.locator('.bingo-more summary').click();
    await page.getByRole('button', { name: 'Empezar de nuevo' }).click();
    await expect(page.locator('.bingo-more .confirm')).toContainText('Se borra lo que ha salido');
    await page.getByRole('button', { name: 'No', exact: true }).click();
    await expect(page.locator('.q.bingo .kicker')).toHaveText('Pieza 2 de 52');

    await page.getByRole('button', { name: 'Empezar de nuevo' }).click();
    await page.getByRole('button', { name: 'Sí, empezar' }).click();
    await expect(page.locator('.q.bingo .q-ask')).toHaveText('Prepara la partida');
    await expect(page.locator('.map-svg .st-ok, .map-svg .st-target')).toHaveCount(0);
    // The game is gone; how it was set up stays for the next one.
    const now = await kept(page);
    expect(now!.draws).toEqual({});
    expect(now!.set).toEqual({ how: 'map', size: 4 });
  });

  test('hands out the cards: a link for the phones, a code to point at, a sheet for the printer', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await start(page, PROVINCES);
    const deal = page.locator('.bingo-deal');
    await expect(deal.locator('h3')).toHaveText('Reparte los cartones');
    await deal.getByRole('button', { name: 'Copiar el enlace' }).click();
    await expect(deal.getByRole('button', { name: 'Enlace copiado' })).toBeVisible();
    // A card for whoever opens it: the address names no number.
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${baseURL}#/bingo/-/${KEY}`);

    const sheet = deal.locator('a[target="_blank"]');
    await expect(sheet).toHaveText('Imprimir cartones');
    await expect(sheet).toHaveAttribute('href', `#/bingo/1-30/${KEY}`);
    await deal.locator('.bingo-count input').fill('12');
    await expect(sheet).toHaveAttribute('href', `#/bingo/1-12/${KEY}`);
    // No more than a sheet takes.
    await deal.locator('.bingo-count input').fill('500');
    await expect(sheet).toHaveAttribute('href', `#/bingo/1-60/${KEY}`);
    // Another size is another set of cards.
    await page.getByRole('radiogroup', { name: 'Tamaño del cartón' }).getByRole('radio', { name: '5 × 5' }).click();
    await expect(sheet).toHaveAttribute('href', '#/bingo/1-60/5/regiones/ES:f');

    await deal.getByRole('button', { name: 'Código QR' }).click();
    const qr = page.locator('.qr-dialog');
    await expect(qr).toBeVisible();
    await expect(qr).toContainText('España · provincias');
    await page.keyboard.press('Escape');
    await expect(qr).toHaveCount(0);

    // Once the game is on they are still at hand, folded away.
    await page.getByRole('button', { name: 'Sacar la primera' }).click();
    await expect(deal).toBeHidden();
    await page.locator('.bingo-more summary').click();
    await expect(deal.locator('h3')).toHaveText('Los cartones de esta partida');
    await expect(deal.locator('a[target="_blank"]')).toHaveAttribute('href', '#/bingo/1-60/5/regiones/ES:f');
  });

  test('works on a list of one’s own, with cards of the list alone', async ({ page }) => {
    const only = ALL.slice(0, 14);
    await start(page, { ...PROVINCES, only, list: 'Las del examen' });
    await expect(page.locator('.play-title')).toContainText('Las del examen');
    await expect(page.getByRole('radiogroup', { name: 'Tamaño del cartón' }).getByRole('radio')).toHaveText(['3 × 3']);
    await expect(page.locator('.q.bingo .options')).toContainText('Cada cartón lleva 9 de las 14 provincias');
    const href = await page.locator('.bingo-deal a[target="_blank"]').getAttribute('href');
    expect(href).toMatch(/^#\/bingo\/1-30\/3\/lista\/[\w-]+$/);

    await page.getByRole('button', { name: 'Sacar la primera' }).click();
    await expect(page.locator('.q.bingo .kicker')).toHaveText('Pieza 1 de 14');
    expect(only).toContain((await outOf(page))[0]);

    // The cards of that address are of the list: nine names, all among its fourteen.
    await open(page, href!.slice(1).replace('1-30', '5'));
    await expect(page.locator('.bingo-page h1')).toHaveText('Cartón 5');
    await expect(page.locator('.bingo-page .kicker')).toHaveText('Bingo · Las del examen');
    await expect(page.locator('.bcell')).toHaveCount(9);
    const provinces = ['Alicante', 'Albacete', 'Almería', 'Ávila', 'Barcelona', 'Badajoz', 'Vizcaya', 'Burgos', 'La Coruña', 'Cádiz', 'Cáceres', 'Ceuta', 'Córdoba', 'Ciudad Real'];
    for (const name of await page.locator('.bcell-name').allTextContents()) expect(provinces).toContain(name);
  });

  test('fits a phone: the button that draws stays at hand @movil', async ({ page }) => {
    await start(page, PROVINCES);
    const first = page.getByRole('button', { name: 'Sacar la primera' });
    await expect(first).toBeInViewport();
    await first.click();
    await expect(page.getByRole('button', { name: 'Sacar otra' })).toBeInViewport();
    await expect(page.locator('.map-svg .st-target').first()).toBeVisible();
    // What a check says is brought into sight, however short the panel.
    await check(page, '7');
    await expect(page.locator('#bingo-said strong')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});

test.describe('a card of the bingo', () => {
  test('has the names its number deals it, and the screen that calls deals it the same', async ({ page }) => {
    await seed(page);
    await open(page, `/bingo/7/${KEY}`);
    await expect(page.locator('.bingo-page h1')).toHaveText('Cartón 7');
    await expect(page.locator('.bingo-page .kicker')).toHaveText('Bingo · España · provincias');
    await expect(page.locator('.bcard')).toHaveAttribute('aria-label', 'Cartón 7');
    await expect(page.locator('.bcell-name')).toHaveText(SEVEN, { timeout: 30_000 });
    await expect(page).toHaveTitle(/Bingo/);

    // Another number is another card, of the same pieces.
    await open(page, `/bingo/8/${KEY}`);
    await expect(page.locator('.bingo-page h1')).toHaveText('Cartón 8');
    const eight = await page.locator('.bcell-name').allTextContents();
    expect(eight).toHaveLength(16);
    expect(new Set(eight).size).toBe(16);
    expect(eight).not.toEqual(SEVEN);

    // And another size, another one again.
    await open(page, '/bingo/7/3/regiones/ES:f');
    await expect(page.locator('.bcell')).toHaveCount(9);
    await open(page, '/bingo/7/5/regiones/ES:f');
    await expect(page.locator('.bcell')).toHaveCount(25);
  });

  test('is in the language of whoever opens it, with the same pieces in the same places', async ({ page }) => {
    await seed(page, { lang: 'en' });
    await open(page, `/bingo/7/${KEY}`);
    await expect(page.locator('.bingo-page h1')).toHaveText('Card 7');
    await expect(page.locator('.bcell-name')).toHaveText(['Huesca', 'Asturias', 'Gipuzkoa', 'Murcia', 'Ourense', 'Guadalajara', 'Santa Cruz de Tenerife', 'La Rioja', 'Ávila', 'A Coruña', 'Tarragona', 'Barcelona', 'Burgos', 'Madrid', 'Navarre', 'Biscay']);
    await expect(page.locator('.bingo-status')).toHaveText('Tap a name to mark it, and again to take the mark away.');
  });

  test('is marked by tapping, says line and bingo, and keeps its marks @movil', async ({ page }) => {
    await seed(page);
    await open(page, `/bingo/7/${KEY}`);
    const cell = (name: string) => page.locator('.bcell', { hasText: new RegExp(`^${name}$`) });
    const status = page.locator('.bingo-status');
    await expect(status).toHaveText('Toca un nombre para marcarlo, y otra vez para quitarle la marca.');
    await expect(page.getByRole('button', { name: 'Borrar las marcas' })).toBeDisabled();
    // The whole card is in sight, with no need to move sideways.
    await expect(page.locator('.bcard')).toBeInViewport({ ratio: 0.99 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await cell('Huesca').click();
    await expect(cell('Huesca')).toHaveAttribute('aria-pressed', 'true');
    await expect(status).toHaveText('Llevas 1 de 16. Una fila, una columna o una diagonal entera es línea.');
    // A second tap takes the mark away.
    await cell('Huesca').click();
    await expect(cell('Huesca')).toHaveAttribute('aria-pressed', 'false');
    await expect(status).toContainText('Toca un nombre');

    for (const name of SEVEN.slice(0, 4)) await cell(name).click();
    await expect(status).toHaveClass(/is-line/);
    await expect(status).toHaveText('¡Línea! Tienes la fila 1. Cántala y di tu número: el 7.');
    await expect(page.locator('.bcell.in-line')).toHaveCount(4);
    expect((await kept(page))!.marks).toEqual({ [await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('regionle:bingo')!).marks)[0])]: [0, 1, 2, 3] });

    // The marks are there when the page is opened again.
    await page.reload();
    await expect(page.locator('.bcell.on')).toHaveCount(4, { timeout: 30_000 });
    await expect(status).toContainText('¡Línea!');
    // …and they are those of this card alone.
    await open(page, `/bingo/8/${KEY}`);
    await expect(page.locator('.bcell').first()).toBeVisible();
    await expect(page.locator('.bcell.on')).toHaveCount(0);
    await open(page, `/bingo/7/${KEY}`);
    await expect(page.locator('.bcell.on')).toHaveCount(4);

    for (const name of SEVEN.slice(4)) await cell(name).click();
    await expect(status).toHaveClass(/is-bingo/);
    await expect(status).toHaveText('¡Bingo! Cántalo y di tu número: el 7.');
    await expect(page.locator('.bcell.on')).toHaveCount(16);

    await page.getByRole('button', { name: 'Borrar las marcas' }).click();
    await expect(page.locator('.bcell.on')).toHaveCount(0);
    await expect(status).toContainText('Toca un nombre');
    expect(await kept(page)).toBeNull();
  });

  test('gives a number of its own to whoever opens the link of the game, and keeps it', async ({ page }) => {
    await seed(page);
    await open(page, `/bingo/-/${KEY}`);
    await expect(page).toHaveURL(new RegExp(`#/bingo/\\d{4,5}/${KEY}$`));
    const n = Number(/bingo\/(\d+)\//.exec(page.url())![1]);
    expect(n).toBeGreaterThanOrEqual(1000);
    expect(n).toBeLessThanOrEqual(99999);
    await expect(page.locator('.bingo-page h1')).toHaveText(`Cartón ${n}`);
    await expect(page.locator('.bcell')).toHaveCount(16);
    const names = await page.locator('.bcell-name').allTextContents();

    // The same card when the page is opened again, and when the link of the game is.
    await page.reload();
    await expect(page.locator('.bingo-page h1')).toHaveText(`Cartón ${n}`, { timeout: 30_000 });
    await expect(page.locator('.bcell-name')).toHaveText(names);
    await open(page, `/bingo/-/${KEY}`);
    await expect(page).toHaveURL(new RegExp(`#/bingo/${n}/${KEY}$`));
    // Another size is another bingo: another number.
    expect((await kept(page))!.own).toEqual({ [Object.keys((await kept(page))!.own)[0]]: n });

    // Another card is a clean one: the marks of the first stay with the first.
    await page.locator('.bcell').first().click();
    await expect(page.locator('.bcell.on')).toHaveCount(1);
    await page.getByRole('button', { name: 'Otro cartón' }).click();
    await expect(page.locator('.bingo-page h1')).not.toHaveText(`Cartón ${n}`);
    await expect(page.locator('.bcell')).toHaveCount(16);
    await expect(page.locator('.bcell.on')).toHaveCount(0);
    const other = Number(/bingo\/(\d+)\//.exec(page.url())![1]);
    expect(other).not.toBe(n);
    expect(other).toBeGreaterThanOrEqual(1000);
    // …and that is the one it has from now on.
    await open(page, `/bingo/-/${KEY}`);
    await expect(page).toHaveURL(new RegExp(`#/bingo/${other}/${KEY}$`));
  });
});

test.describe('the sheet of cards to print', () => {
  test('has the cards that were asked for, six to a page, each with its number', async ({ page }) => {
    await seed(page);
    await open(page, `/bingo/1-30/${KEY}`);
    await expect(page.locator('.bingo-tools h1')).toHaveText('Cartones del 1 al 30');
    await expect(page.locator('.bingo-tools .lead')).toContainText('De 4 × 4, 6 por hoja: 5 hojas.');
    await expect(page.locator('.bingo-slip')).toHaveCount(30, { timeout: 30_000 });
    await expect(page.locator('.bingo-paper')).toHaveCount(5);
    await expect(page.locator('.bingo-paper').first().locator('.bingo-slip')).toHaveCount(6);
    await expect(page).toHaveTitle('Bingo — España · provincias — cartones 1 a 30');
    // The seventh is the card 7 of the phones and of the screen that calls.
    const seventh = page.locator('.bingo-slip').nth(6);
    await expect(seventh).toContainText('Cartón 7');
    await expect(seventh).toContainText('España · provincias');
    await expect(seventh.locator('.bcell-name')).toHaveText(SEVEN);
    // Cards to write on: nothing to press.
    await expect(page.locator('.bingo-slip button')).toHaveCount(0);
  });

  test('changes how many there are, and goes on with the ones that follow', async ({ page }) => {
    await seed(page);
    await open(page, `/bingo/1-30/${KEY}`);
    await expect(page.locator('.bingo-slip')).toHaveCount(30, { timeout: 30_000 });
    await page.locator('.bingo-tools .bingo-count input').fill('8');
    await page.getByRole('button', { name: 'Cambiar', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#/bingo/1-8/${KEY}$`));
    await expect(page.locator('.bingo-tools h1')).toHaveText('Cartones del 1 al 8');
    await expect(page.locator('.bingo-slip')).toHaveCount(8);
    await expect(page.locator('.bingo-paper')).toHaveCount(2);
    await expect(page.locator('.bingo-tools .lead')).toContainText('2 hojas');

    await page.getByRole('link', { name: 'Los siguientes: del 9 al 16' }).click();
    await expect(page.locator('.bingo-tools h1')).toHaveText('Cartones del 9 al 16');
    await expect(page.locator('.bingo-slip').first()).toContainText('Cartón 9');
    await expect(page.locator('.bingo-slip')).toHaveCount(8);

    // One card alone, and an address that asks for too many.
    await open(page, `/bingo/5-5/${KEY}`);
    await expect(page.locator('.bingo-tools h1')).toHaveText('Cartón 5');
    await expect(page.locator('.bingo-slip')).toHaveCount(1);
    await open(page, `/bingo/1-500/${KEY}`);
    await expect(page.locator('.bingo-tools h1')).toHaveText('Cartones del 1 al 60');
    await expect(page.locator('.bingo-slip')).toHaveCount(60);
  });

  test('sends nothing but the cards to the printer, each page on a sheet', async ({ page }) => {
    await seed(page);
    await open(page, `/bingo/1-12/${KEY}`);
    await expect(page.locator('.bingo-slip')).toHaveCount(12, { timeout: 30_000 });
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.bingo-tools')).toBeHidden();
    await expect(page.locator('header.top')).toBeHidden();
    await expect(page.locator('footer.foot')).toBeHidden();
    await expect(page.locator('.bingo-slip').first()).toBeVisible();
    await expect(page.locator('.bingo-slip').last()).toBeVisible();
    // Black on white, whatever the colours of the screen; and every name inside its cell.
    const look = await page.locator('.bingo-slip .bcell').first().evaluate((el) => ({ color: getComputedStyle(el).color, breakAfter: getComputedStyle(el.closest('.bingo-paper')!).breakAfter }));
    expect(look.color).toBe('rgb(17, 17, 17)');
    expect(look.breakAfter).toBe('page');
    const spills = await page.locator('.bingo-slip .bcell').evaluateAll((cells) => cells.filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).length);
    expect(spills).toBe(0);
    await page.emulateMedia({ media: 'screen' });
    await expect(page.locator('.bingo-tools')).toBeVisible();
  });

  test('prints cards of 5 × 5 with every name whole', async ({ page }) => {
    await seed(page);
    await open(page, '/bingo/1-12/5/regiones/ES:f');
    await expect(page.locator('.bingo-slip')).toHaveCount(12, { timeout: 30_000 });
    await expect(page.locator('.bingo-slip').first().locator('.bcell')).toHaveCount(25);
    await page.emulateMedia({ media: 'print' });
    const spills = await page.locator('.bingo-slip .bcell').evaluateAll((cells) => cells.filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).map((el) => el.textContent));
    expect(spills).toEqual([]);
  });
});

test.describe('the addresses of the bingo', () => {
  test('say how it is played when they name no card', async ({ page }) => {
    await seed(page);
    // The front page leads there: the game itself is one more in the menu of a map, and nothing else tells of it.
    await open(page, '/');
    await page.getByRole('link', { name: 'Cómo se juega al bingo' }).click();
    await expect(page).toHaveURL(/#\/bingo$/);
    await expect(page.locator('.duel-page h1')).toHaveText('Bingo de mapas');
    await expect(page.locator('.how-steps li')).toHaveCount(4);
    await expect(page.locator('.duel-page')).toContainText('al menos 12 piezas');
    await page.getByRole('link', { name: 'Elegir el mapa' }).click();
    await expect(page).toHaveURL(/#\/regiones$/);
  });

  test('say so when they are broken, or when the map is too small for the card', async ({ page }) => {
    await seed(page);
    for (const broken of ['/bingo/7', '/bingo/7/4', '/bingo/7/9/regiones/ES', '/bingo/0/4/regiones/ES', '/bingo/7/map4/regiones/ES:f', '/bingo/7/4/regiones/ZZ', '/bingo/7/4/lista/abc']) {
      await open(page, broken);
      await expect(page.locator('.duel-page h1'), broken).toHaveText('Este enlace no lleva a ningún cartón');
    }
    await page.getByRole('link', { name: 'Cómo se juega al bingo' }).click();
    await expect(page.locator('.duel-page h1')).toHaveText('Bingo de mapas');

    // Nineteen communities do not give for cards of 5 × 5, nor of 4 × 4.
    for (const size of [5, 4]) {
      await open(page, `/bingo/7/${size}/regiones/ES:g1`);
      await expect(page.locator('.duel-page h1')).toHaveText('Este mapa no da para estos cartones', { timeout: 30_000 });
    }
    await open(page, '/bingo/3/3/regiones/ES:g1');
    await expect(page.locator('.bcell-name')).toHaveText(['Asturias', 'Canarias', 'La Rioja', 'Comunidad Valenciana', 'Ceuta', 'Islas Baleares', 'Cataluña', 'Galicia', 'Extremadura'], { timeout: 30_000 });
  });

  test('give cards of cities and of rivers, as of anything a map has', async ({ page }) => {
    await seed(page);
    await open(page, '/bingo/1/3/ciudades/ES/bingo/top50');
    await expect(page.locator('.bingo-page h1')).toHaveText('Cartón 1', { timeout: 30_000 });
    await expect(page.locator('.bcell')).toHaveCount(9);
    await open(page, '/bingo/1/3/fisica/river+EU');
    await expect(page.locator('.bingo-page h1')).toHaveText('Cartón 1', { timeout: 30_000 });
    await expect(page.locator('.bcell')).toHaveCount(9);
  });
});
