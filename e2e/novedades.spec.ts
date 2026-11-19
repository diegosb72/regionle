import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { OPTS, open, seed } from './helpers';

const DAY = 864e5;
const NOW = Date.now();

/** What the browser keeps of the game, as it stands now. */
const kept = (page: import('@playwright/test').Page): Promise<Record<string, unknown>> => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1') ?? '{}').state);

test.describe('the first page brings back what was being played', () => {
  const recent = [
    // A moment ago: an hour back is already yesterday for whoever plays just after midnight.
    { t: NOW - 1000, section: 'regions', mode: 'pin', countries: ['ES'], levels: { ES: 'f' }, o: { format: 'normal' }, ok: 40, total: 52 },
    { t: NOW - 2 * DAY, section: 'countries', mode: 'flag', countries: ['FR', 'IT'], levels: {}, o: { format: 'timed' }, ok: 9, total: 12 },
  ];

  test('shows the maps played lately and starts one again as the game it was', async ({ page }) => {
    await seed(page, { recent, opts: { ...OPTS, wiki: false } });
    await open(page);
    const block = page.locator('.recent');
    await expect(block.getByRole('heading', { level: 2 })).toHaveText('Sigue donde lo dejaste');
    const cards = block.locator('.recent-list button');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('Regiones · Señalar');
    await expect(cards.nth(0)).toContainText('España · provincias');
    await expect(cards.nth(0)).toContainText('40 de 52 a la primera · hoy');
    await expect(cards.nth(1)).toContainText('Países · Banderas · contrarreloj');
    await expect(cards.nth(1)).toContainText('Francia, Italia');

    await cards.nth(0).click();
    await expect(page).toHaveURL(/#\/jugar$/);
    await expect(page.locator('.map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    const state = await kept(page);
    expect(state.game).toMatchObject({ section: 'regions', mode: 'pin', countries: ['ES'], levels: { ES: 'f' } });
    // The menus of the section are left as they were for that game.
    expect((state.sel as Record<string, string[]>).regions).toEqual(['ES']);
    expect((state.levels as Record<string, string>).ES).toBe('f');
  });

  test('opens a saved selection in its section', async ({ page }) => {
    await seed(page, { favs: [{ name: 'Mis islas', section: 'regions', ids: ['JP', 'ID', 'PH'] }] });
    await open(page);
    await expect(page.locator('.recent').getByRole('heading', { level: 2 })).toHaveText('Tus selecciones guardadas');
    await page.locator('.recent-favs').getByRole('button', { name: /Mis islas/ }).click();
    await expect(page).toHaveURL(/#\/regiones$/);
    expect(((await kept(page)).sel as Record<string, string[]>).regions).toEqual(['JP', 'ID', 'PH']);
  });

  test('shows nothing of the kind to whoever has played nothing yet', async ({ page }) => {
    await seed(page);
    await open(page);
    await expect(page.locator('.hero-title')).toBeVisible();
    await expect(page.locator('.recent')).toHaveCount(0);
  });
});

test.describe('keys that work on any screen', () => {
  test('open the sections, the challenge and the progress, and stand aside in a field', async ({ page }) => {
    await seed(page);
    await open(page);
    await page.keyboard.press('2');
    await expect(page).toHaveURL(/#\/paises$/);
    await page.keyboard.press('p');
    await expect(page).toHaveURL(/#\/progreso$/);
    await page.keyboard.press('1');
    await expect(page).toHaveURL(/#\/regiones$/);
    // In the search box of the picker a key is a letter.
    const search = page.locator('input[type="search"], input[type="text"]').first();
    await search.click();
    await page.keyboard.type('p2');
    await expect(search).toHaveValue('p2');
    await expect(page).toHaveURL(/#\/regiones$/);
  });

  test('show themselves with "?", and can be turned off', async ({ page }) => {
    await seed(page);
    await open(page);
    await page.keyboard.press('?');
    const panel = page.locator('dialog.keys-dialog');
    await expect(panel.getByRole('heading', { level: 2 })).toHaveText('Atajos de teclado');
    await expect(panel).toContainText('1 Regiones, 2 Países, 3 Ciudades, 4 Física, 5 Cifras');
    // The keys of the games are there as well: the cross where a spot is marked, the options, and what Enter does where.
    await expect(panel).toContainText('Donde se marca un punto (Situar a ciegas, Caliente y frío, Coordenadas, la regla de Explorar) mueven una cruz; con Mayús, a pasos cortos.');
    await expect(panel).toContainText('Eligen entre las cuatro opciones, cuando la respuesta no se escribe.');
    await expect(panel).toContainText('En «Marca el grupo», en el mapa marca o desmarca la pieza y, fuera de él, comprueba lo marcado.');
    // While it is open, a digit goes nowhere.
    await page.keyboard.press('3');
    await expect(page).not.toHaveURL(/#\/ciudades$/);
    await panel.locator('.keys-switch .toggle').click();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    expect((await kept(page)).hotkeys).toBe(false);
    await page.keyboard.press('3');
    await page.keyboard.press('?');
    await expect(page).not.toHaveURL(/#\/ciudades$/);
    await expect(panel).toHaveCount(0);
    // The footer still opens the list, to turn them on again.
    await page.getByRole('button', { name: 'Atajos de teclado' }).click();
    await expect(panel).toBeVisible();
  });

  test('do not take anyone out of a game', async ({ page }) => {
    await seed(page, { game: { section: 'regions', mode: 'pin', countries: ['ES'], levels: { ES: 'g1' }, opts: OPTS, nonce: 1 } });
    await page.goto('./#/jugar');
    await expect(page.locator('.map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('2');
    await page.keyboard.press('r');
    await expect(page).toHaveURL(/#\/jugar$/);
    await page.keyboard.press('?');
    await expect(page.locator('dialog.keys-dialog')).toBeVisible();
  });
});

test.describe('sounds when answering', () => {
  test('are off until asked for, and the choice is kept', async ({ page }) => {
    await seed(page);
    await open(page);
    expect((await kept(page)).sound ?? false).toBe(false);
    const toggle = page.locator('.foot-prefs .toggle', { hasText: 'Sonidos al responder' });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect.poll(async () => (await kept(page)).sound).toBe(true);
    await page.reload();
    await expect(page.locator('.foot-prefs .toggle', { hasText: 'Sonidos al responder' }).locator('input')).toBeChecked();
  });
});

test.describe('the menus say how big a game is and how it goes', () => {
  const sessions = [1, 2].map((n) => ({ t: NOW - n * 1000, section: 'regions', mode: 'pin', label: 'España', total: 20, ok: 15, warn: 2, bad: 3, ms: 100_000 }));
  const menus = { sel: { regions: ['ES'] }, levels: { ES: 'f' }, mode: { regions: 'pin' }, opts: { ...OPTS, length: 'all', cityCount: 25 } };

  test('with a general figure before the first game', async ({ page }) => {
    await seed(page, menus);
    await open(page, '/regiones');
    const facts = page.locator('.mode-facts li');
    await expect(facts).toHaveCount(1);
    await expect(facts.first()).toHaveText('Unos 6 min · 52 preguntas');
  });

  test('with the pace and the results of the player after it', async ({ page }) => {
    await seed(page, { ...menus, sessions });
    await open(page, '/regiones');
    const facts = page.locator('.mode-facts li');
    await expect(facts).toHaveCount(2);
    await expect(facts.nth(0)).toHaveText('Unos 4 min · 52 preguntas a tu ritmo');
    await expect(facts.nth(1)).toHaveText('Aciertas el 75 % a la primera en 2 partidas');
  });
});

test.describe('the progress page', () => {
  const st = (seen: number, ok: number, run: number): number[] => [seen, ok, run, NOW - DAY];
  const progress = {
    stats: { 'loc:ES-ZA': st(7, 2, 0), 'loc:ES-GU': st(4, 1, 1), 'loc:ES-M': st(6, 6, 6), 'flag:TD': st(5, 1, 0) },
    where: { 'ES-ZA': 'r|ES|f', 'ES-GU': 'r|ES|f', 'ES-M': 'r|ES|f', TD: 'c' },
    sessions: [{ t: NOW - DAY, section: 'regions', mode: 'pin', label: 'España', total: 10, ok: 6, warn: 1, bad: 3, ms: 60_000 }],
    tot: { g: 1, q: 10, ok: 6, warn: 1, ms: 60_000 },
    opts: OPTS,
  };

  test('lists what is missed most by name, map by map, and practises it', async ({ page }) => {
    await seed(page, progress);
    await open(page, '/progreso');
    const block = page.locator('.miss');
    await expect(block.getByRole('heading', { level: 2 })).toHaveText('Lo que más fallas');
    const spain = block.locator('.miss-list > li').first();
    await expect(spain.locator('.miss-head')).toContainText('España');
    // The names are read from the map: the id stands in only until it arrives.
    await expect(spain.locator('.miss-items li').first()).toHaveText(/^Zamora\s*5 de 7$/, { timeout: 30_000 });
    await expect(spain.locator('.miss-items li')).toHaveCount(2);
    await expect(block).not.toContainText('Madrid');
    await spain.locator('.miss-head button').click();
    await expect(page).toHaveURL(/#\/jugar$/);
    await expect(page.locator('.map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    const game = (await kept(page)).game as { only?: string[]; review?: boolean };
    expect([...(game.only ?? [])].sort()).toEqual(['ES-GU', 'ES-ZA']);
  });

  test('downloads the review as a table that a spreadsheet opens', async ({ page }) => {
    await seed(page, progress);
    await open(page, '/progreso');
    const saving = page.waitForEvent('download');
    await page.locator('.fc-file button').first().click();
    const file = await saving;
    expect(file.suggestedFilename()).toMatch(/^regionle-repaso-\d{4}-\d{2}-\d{2}\.csv$/);
    const bytes = fs.readFileSync((await file.path())!);
    // The mark that tells a spreadsheet the accents are UTF-8.
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = bytes.toString('utf8').replace(/^\uFEFF/, '').split('\r\n').filter(Boolean);
    expect(lines[0].split(';').slice(0, 3)).toEqual(['Nombre', 'Capital', 'Mapa']);
    expect(lines).toHaveLength(5);
    expect(lines.some((l) => l.startsWith('Zamora;'))).toBe(true);
    expect(lines.some((l) => l.startsWith('Chad;'))).toBe(true);
  });
});
