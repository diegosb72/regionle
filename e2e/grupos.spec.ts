import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, seed, start } from './helpers';

/** The fifty-two provinces of Spain: with this game, the first set is Galicia and the second what borders Pontevedra. */
const PROVINCES = { section: 'regions', countries: ['ES'], levels: { ES: 'f' }, mode: 'group' };
/** Eleven countries of western Europe: the G20, what borders Italy, southern Europe… in that order. */
const WEST = { section: 'countries', countries: ['ES', 'PT', 'FR', 'DE', 'IT', 'CH', 'AT', 'BE', 'NL', 'LU', 'AD'], mode: 'group' };

const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { sessions: { mode: string; total: number; ok: number; warn: number; bad: number }[] });
const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`).first();
/** A click on a piece, wherever its shape leaves the middle of its box (Italy's is in the sea). */
const mark = async (page: Page, ...ids: string[]) => {
  for (const id of ids) await piece(page, id).dispatchEvent('click');
};
const count = (page: Page) => page.locator('.nb-count strong');
const check = (page: Page) => page.getByRole('button', { name: 'Comprobar' });

test.describe('marking a group', () => {
  test('names a set, takes marks on a map without names and checks them', async ({ page }) => {
    await start(page, PROVINCES);
    await expect(page.locator('.play-title strong')).toHaveText('Marca el grupo');
    await expect(page.locator('.hud-main')).toHaveText('1 / 10');
    await expect(page.locator('.kicker')).toHaveText('Marca sus provincias');
    await expect(page.locator('.q-name')).toHaveText('Galicia');
    await expect(page.locator('.q-prompt .q-sub')).toHaveText('comunidad autónoma');
    await expect(count(page)).toHaveText('0 / 4');
    await expect(page.locator('.nb-count')).toContainText('marcadas');
    await expect(check(page)).toBeDisabled();
    // Nothing on the map says which piece is which.
    await expect(page.locator('.map-svg .m-lbl')).toHaveCount(0);
    await piece(page, 'ES-LU').hover();
    await expect(page.locator('.map-tip')).toHaveText('');

    // A real click marks a piece, and another one unmarks it.
    await piece(page, 'ES-LU').click();
    await expect(count(page)).toHaveText('1 / 4');
    await expect(piece(page, 'ES-LU')).toHaveClass(/st-sel/);
    await piece(page, 'ES-LU').click();
    await expect(count(page)).toHaveText('0 / 4');
    await expect(piece(page, 'ES-LU')).not.toHaveClass(/st-sel/);

    await mark(page, 'ES-C', 'ES-LU', 'ES-OR', 'ES-PO');
    await expect(count(page)).toHaveText('4 / 4');
    await check(page).click();
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.verdict-head')).toContainText('¡Todas, y nada de más!');
    await expect(page.locator('.verdict .facts')).toHaveText('La Coruña, Lugo, Orense y Pontevedra');
    await expect(page.locator('.nb-count')).toHaveText('4 / 4bien marcadas');
    for (const id of ['ES-C', 'ES-LU', 'ES-OR', 'ES-PO']) await expect(piece(page, id)).toHaveClass(/st-ok/);
    // Now the names are on the map, and a click marks nothing.
    await expect(page.locator('.map-svg .m-lbl', { hasText: 'Lugo' })).toHaveCount(1);
    await expect(page.locator('.map-svg .m-lbl', { hasText: 'Orense' })).toHaveCount(1);
    await mark(page, 'ES-LE');
    await expect(piece(page, 'ES-LE')).not.toHaveClass(/st-/);

    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.locator('.hud-main')).toHaveText('2 / 10');
    // What borders a piece: that piece is the one in colour, and it is not marked itself.
    await expect(page.locator('.kicker')).toHaveText('Marca las provincias que limitan con');
    await expect(page.locator('.q-name')).toHaveText('Pontevedra');
    await expect(page.locator('.q-note')).toContainText('Pontevedra es la que está en color.');
    await expect(piece(page, 'ES-PO')).toHaveClass(/st-from/);
    await expect(page.locator('.map-svg .m-lbl')).toHaveText(['Pontevedra']);
    await mark(page, 'ES-PO');
    await expect(count(page)).toHaveText('0 / 3');
  });

  test('says what was missing and what was not in the set, and counts a slip in a large one as close', async ({ page }) => {
    await start(page, WEST);
    await expect(page.locator('.kicker')).toHaveText('Marca sus países');
    await expect(page.locator('.q-name')).toHaveText('G20');
    // Three of them: Germany, France and Italy. Spain is not, and Italy is left out.
    await mark(page, 'DE', 'FR', 'ES');
    await expect(count(page)).toHaveText('3 / 3');
    await check(page).click();
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.verdict-head')).toContainText('2 de 3');
    await expect(page.locator('.group-missed')).toHaveText('Faltaba: Italia');
    await expect(page.locator('.group-extra')).toHaveText('Sobraba: España');
    await expect(piece(page, 'DE')).toHaveClass(/st-ok/);
    await expect(piece(page, 'IT')).toHaveClass(/st-warn/);
    await expect(piece(page, 'ES')).toHaveClass(/st-bad/);
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // What borders Italy: Austria, Switzerland and France, all three.
    await expect(page.locator('.kicker')).toHaveText('Marca los países que limitan con');
    await expect(page.locator('.q-name')).toHaveText('Italia');
    await mark(page, 'AT', 'CH', 'FR');
    await check(page).click();
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.verdict-head')).toContainText('¡Todos, y nada de más!');
    // Enter moves on, as it checks while a set is being marked.
    await page.locator('.verdict').click();
    await page.keyboard.press('Enter');

    // Southern Europe: four here. One missing in a set of four is close.
    await expect(page.locator('.q-name')).toHaveText('Europa del Sur');
    await expect(count(page)).toHaveText('0 / 4');
    await mark(page, 'ES', 'PT', 'IT');
    await page.locator('.q-prompt').click();
    await page.keyboard.press('Enter');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-warn/);
    await expect(page.locator('.verdict-head')).toContainText('Casi');
    await expect(page.locator('.group-missed')).toHaveText('Faltaba: Andorra');
    await expect(page.locator('.group-extra')).toHaveCount(0);

    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('.results-note')).toContainText('Cuenta cada grupo');
    await expect(page.locator('.results-stats')).toContainText('A la primera1');
    await expect(page.locator('.results-stats')).toContainText('Con ayuda1');
    await expect(page.locator('.results-stats')).toContainText('Fallos1');
    await expect(page.locator('.results-stats')).toContainText('Piezas bien marcadas8 de 10');
    // The pieces that went wrong, each with the set it went wrong in.
    await expect(page.locator('.results-group.g-bad .row-name')).toHaveText(['Italiafaltaba en G20', 'Españasobraba en G20', 'Andorrafaltaba en Europa del Sur']);
    expect((await kept(page)).sessions.at(-1)).toMatchObject({ mode: 'group', total: 3, ok: 1, warn: 1, bad: 1 });
  });

  test('clears the marks, and asks as many sets as were chosen', async ({ page }) => {
    await start(page, { ...WEST, opts: { length: 20 } });
    // Fifteen sets can be told on this map: that is the game, however many were asked for.
    await expect(page.locator('.hud-main')).toHaveText('1 / 15');
    await mark(page, 'DE', 'FR');
    await expect(count(page)).toHaveText('2 / 3');
    await page.getByRole('button', { name: 'Borrar marcas' }).click();
    await expect(count(page)).toHaveText('0 / 3');
    await expect(piece(page, 'DE')).not.toHaveClass(/st-sel/);
    await expect(check(page)).toBeDisabled();
    // A game that is left with nothing checked leaves no trace.
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-title')).toHaveText('Sin grupos');
    expect((await kept(page)).sessions ?? []).toHaveLength(0);
  });

  test('asks for the cities of each country on a map of several', async ({ page }) => {
    await start(page, { section: 'cities', countries: ['ES', 'PT', 'FR'], mode: 'group', opts: { cityPick: 'top', cityCount: 25 } });
    await expect(page.locator('.hud-main')).toHaveText('1 / 3');
    await expect(page.locator('.kicker')).toHaveText('Marca sus ciudades');
    await expect(page.locator('.q-name')).toHaveText(/^(España|Portugal|Francia)$/);
    await expect(page.locator('.q-prompt .q-sub')).toHaveText('país');
    await expect(count(page)).toHaveText(/^0 \/ \d+$/);
    await page.locator('.map-svg .m-dot').first().dispatchEvent('click');
    await expect(count(page)).toHaveText(/^1 \/ \d+$/);
    await expect(page.locator('.map-svg .m-dot.st-sel')).toHaveCount(1);
    await check(page).click();
    await expect(page.locator('.verdict')).toBeVisible();
  });

  test('says so where a map has no groups', async ({ page }) => {
    // Three cities of one country with no regions in the game: nothing to tell them apart by.
    await start(page, { section: 'cities', countries: ['AD', 'MC'], mode: 'group', opts: { cityPick: 'top', cityCount: 10 } });
    await expect(page.locator('.results-title, .q-ask').first()).toBeVisible();
    await expect(page.locator('main#contenido')).toContainText(/no hay grupos que marcar|una sola pieza/);
  });

  test('is offered on the maps of regions, countries and cities, with the number of sets to choose', async ({ page }) => {
    await seed(page);
    for (const [route, about] of [
      ['/paises', 'la Unión Europea, los países sin mar'],
      ['/ciudades', 'marcas en el mapa todas sus ciudades'],
      ['/regiones', 'las provincias de una comunidad'],
    ]) {
      await open(page, route);
      await page.getByRole('group', { name: 'En el mapa' }).getByRole('button', { name: /^Marca el grupo/ }).click();
      await expect(page.locator('.mode-about'), route).toContainText(about);
    }
    await open(page, '/fisica');
    await expect(page.getByRole('button', { name: /^Marca el grupo/ })).toHaveCount(0);

    await open(page, '/regiones');
    await page.getByRole('group', { name: 'En el mapa' }).getByRole('button', { name: /^Marca el grupo/ }).click();
    const length = page.getByRole('radiogroup', { name: 'Preguntas' });
    await expect(length.getByRole('radio')).toHaveText(['Todo', '10', '20', '50']);
    await page.getByRole('button', { name: /Empezar/ }).click();
    await expect(page.locator('.play-title strong')).toHaveText('Marca el grupo');
    // The communities of Spain are a single level: the sets are what borders each one.
    await expect(page.locator('.kicker')).toHaveText('Marca las comunidades autónomas que limitan con');
    await expect(page.locator('.map-svg [class*="st-from"]')).toHaveCount(1);
  });

  test('speaks English', async ({ page }) => {
    await seed(page, { lang: 'en', game: { levels: {}, nonce: 1, ...WEST, opts: OPTS } });
    await page.goto('./#/jugar');
    await expect(page.locator('.play-loading')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('.play-title strong')).toHaveText('Mark the group');
    await expect(page.locator('.kicker')).toHaveText('Mark its countries');
    await expect(page.locator('.q-name')).toHaveText('G20');
    await expect(page.locator('.nb-count')).toHaveText('0 / 3marked');
    await mark(page, 'DE', 'ES');
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.locator('.verdict-head')).toContainText('1 of 3');
    await expect(page.locator('.group-missed')).toHaveText('Missing: France and Italy');
    await expect(page.locator('.group-extra')).toHaveText('Not in it: Spain');
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.locator('.results-group.g-bad .row-name')).toHaveText(['Francemissing from G20', 'Italymissing from G20', 'Spainnot in G20']);
  });
});

test.describe('marking a group on a phone @movil', () => {
  test('takes taps on the map and keeps the button to check in sight', async ({ page }) => {
    await start(page, PROVINCES);
    await expect(page.locator('.q-name')).toHaveText('Galicia');
    await piece(page, 'ES-LU').tap();
    await expect(count(page)).toHaveText('1 / 4');
    await expect(check(page)).toBeInViewport();
    await check(page).tap();
    await expect(page.locator('.verdict')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
