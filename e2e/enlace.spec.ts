import { expect, test, type Page } from '@playwright/test';
import { seed } from './helpers';

interface Kept {
  sel: Record<string, string[]>;
  levels: Record<string, string>;
  mode: Record<string, string>;
  opts: { cityPick: string; cityCount: number };
}
const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as Kept);
const notice = (page: Page) => page.locator('.linked');
const bar = (page: Page) => page.locator('.startbar-info');

/** Follows a link of the game, as if it had been clicked somewhere else. */
async function follow(page: Page, address: string): Promise<void> {
  await page.goto(`./#/${address}`);
  await expect(page.locator('main#contenido')).toBeVisible();
  await expect(page.locator('#root .spinner')).toHaveCount(0);
}

test.describe('a link to a map and a game', () => {
  test('opens the section with both chosen, says so, and leaves the plain address of the section', async ({ page }) => {
    await seed(page);
    await follow(page, 'regiones/ES:f+PT/capital');
    await expect(notice(page)).toHaveText('Has abierto un enlace: ya están elegidos el mapa y el juego que traía.');
    await expect(bar(page)).toContainText('2 países · 72 regiones');
    await expect(bar(page)).toContainText('Capitales');
    await expect(page).toHaveURL(/#\/regiones$/);
    const state = await kept(page);
    expect(state.sel.regions).toEqual(['ES', 'PT']);
    expect(state.levels.ES).toBe('f');
    expect(state.mode.regions).toBe('capital');
    // The notice goes when it is closed, and what was chosen stays.
    await notice(page).getByRole('button', { name: 'Cerrar el aviso' }).click();
    await expect(notice(page)).toHaveCount(0);
    await expect(bar(page)).toContainText('2 países · 72 regiones');
    // Ready to start: the game is the one of the link.
    await page.getByRole('button', { name: /Empezar/ }).click();
    await expect(page.locator('.play-title strong')).toHaveText('Capitales');
    // Going back does not land on the link again and again.
    await page.goBack();
    await expect(page).toHaveURL(/#\/regiones$/);
    await expect(notice(page)).toHaveCount(0);
  });

  test('says which cities, and what a physical map is made of', async ({ page }) => {
    await seed(page);
    await follow(page, 'ciudades/FR+IT/blind/caps');
    await expect(notice(page)).toBeVisible();
    await expect(bar(page)).toContainText('2 países · 2 capitales');
    await expect(bar(page)).toContainText('Situar a ciegas');
    expect((await kept(page)).opts.cityPick).toBe('caps');
    await follow(page, 'ciudades/ES/pin/top10');
    await expect(bar(page)).toContainText('España · 10 ciudades');
    expect(await kept(page)).toMatchObject({ sel: { cities: ['ES'] }, mode: { cities: 'pin' }, opts: { cityPick: 'top', cityCount: 10 } });

    await follow(page, 'fisica/river+lake+EU/identify');
    await expect(notice(page)).toBeVisible();
    await expect(bar(page)).toContainText('Identificar');
    expect((await kept(page)).sel.physical).toEqual(['river', 'lake', 'EU']);
    await expect(page).toHaveURL(/#\/fisica$/);
  });

  test('takes what the game has and leaves the rest', async ({ page }) => {
    await seed(page);
    // A country that is not, and a game that is not: the rest of the map is chosen.
    await follow(page, 'paises/ES+ZZ+FR/zzz');
    await expect(notice(page)).toHaveText('Has abierto un enlace: ya está elegido el mapa que traía.');
    let state = await kept(page);
    expect(state.sel.countries).toEqual(['ES', 'FR']);
    expect(state.mode.countries).toBe('pin');
    // A level the country does not have is not chosen: it keeps the one it had.
    await follow(page, 'regiones/ES:zz9/pin');
    expect((await kept(page)).levels.ES).toBeUndefined();
    await expect(bar(page)).toContainText('19 comunidades');
    // Only the game.
    await follow(page, 'paises/ZZ/flag');
    await expect(notice(page)).toHaveText('Has abierto un enlace: ya está elegido el juego que traía. Su mapa no está entre los de esta sección.');
    state = await kept(page);
    expect(state.sel.countries).toEqual(['ES', 'FR']);
    expect(state.mode.countries).toBe('flag');
    // A game of another section is no game here.
    await follow(page, 'ciudades/ES/flag');
    await expect(notice(page)).toHaveText('Has abierto un enlace: ya está elegido el mapa que traía.');
    // Nothing at all: said, and nothing touched.
    await follow(page, 'paises/ZZ/zzz');
    await expect(notice(page)).toHaveText('Ese enlace no trae nada que esta sección tenga: se queda lo que había elegido.');
    await expect(notice(page)).toHaveClass(/linked-none/);
    state = await kept(page);
    expect(state.sel.countries).toEqual(['ES', 'FR']);
    expect(state.mode.countries).toBe('flag');
    // And what is not written as a link is an address that is nothing, as it was.
    await follow(page, 'regiones/loquesea');
    await expect(page.locator('.linked')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Regiones, provincias y estados');
  });

  test('is copied from the setup, and opens what was on screen when it was', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await seed(page, { sel: { regions: ['ES', 'FR'], countries: ['ES'], pops: ['ES'], cities: ['ES'], physical: ['river', 'EU'] }, levels: { FR: 'f' }, mode: { regions: 'border', countries: 'pin', pops: 'hilo', cities: 'pin', physical: 'pin' } });
    await follow(page, 'regiones');
    await expect(notice(page)).toHaveCount(0);
    const copy = page.getByRole('button', { name: 'Copiar enlace a este mapa' });
    await copy.click();
    await expect(page.getByRole('button', { name: 'Enlace copiado' })).toBeVisible();
    const url = await page.evaluate(() => navigator.clipboard.readText());
    // Each country with the level it is at; the game last.
    expect(url).toMatch(/#\/regiones\/ES:g1\+FR:f\/border$/);
    expect(new URL(url).origin).toBe(new URL(page.url()).origin);

    // Another game is another link: the button offers to copy again.
    await page.getByRole('group', { name: 'En el mapa' }).getByRole('button', { name: /^Señalar/ }).click();
    await expect(copy).toBeVisible();
    await copy.click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/#\/regiones\/ES:g1\+FR:f\/pin$/);

    // Whoever opens it, with something else chosen, gets that map and that game.
    await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('regionle:v1')!);
      saved.state.sel.regions = ['US'];
      saved.state.levels = {};
      saved.state.mode.regions = 'explore';
      localStorage.setItem('regionle:v1', JSON.stringify(saved));
    });
    await page.reload();
    await expect(bar(page)).toContainText('Estados Unidos');
    await page.goto(url);
    await expect(notice(page)).toBeVisible();
    await expect(bar(page)).toContainText('2 países · 115 regiones');
    expect(await kept(page)).toMatchObject({ sel: { regions: ['ES', 'FR'] }, levels: { ES: 'g1', FR: 'f' }, mode: { regions: 'border' } });
  });

  test('is shown to be copied by hand where the browser will not copy, and speaks English', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('no')) }, configurable: true });
    });
    await seed(page, { lang: 'en' });
    await follow(page, 'ciudades');
    await page.getByRole('button', { name: 'Copy a link to this map' }).click();
    const field = page.getByRole('textbox', { name: 'Link to this map' });
    await expect(field).toHaveValue(/#\/ciudades\/ES\/pin\/top25$/);
    await expect(page.locator('.maplink .opt-hint')).toHaveText(
      'It opens the game with this map and this game already chosen: to send to someone, to keep as a bookmark or, with the QR code, to open in class from the board. “Embed” gives the code to put it inside another page.',
    );
    // In English the notice is in English.
    await follow(page, 'paises/ES+FR/flag');
    await expect(notice(page)).toHaveText('You have opened a link: the map and the game it brought are already chosen.');
  });
});
