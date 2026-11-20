/**
 * Painting the map by hand, in Explore: a colour is picked, the pieces that are tapped take it, each colour
 * can be said to stand for something, and the painting — kept in the browser, one for each map — is saved as
 * a picture.
 */
import fs from 'node:fs';
import { expect, test, type Download, type Page } from '@playwright/test';
import { OPTS, restart, seed, start } from './helpers';

// The clock of these tests is set by hand, and so is where it is read: their days are Madrid's, whatever
// E2E_ZONE says (playwright.config.ts).
test.use({ timezoneId: 'Europe/Madrid' });
const NOW = new Date('2026-11-20T12:00:00+01:00');

const WORLD = { section: 'countries', mode: 'explore', countries: ['ES', 'BR', 'FR', 'PT', 'IT', 'PL', 'MT', 'RU'] };
/** How the game keeps the map of those eight countries. */
const WORLD_KEY = 'c:BR,ES,FR,IT,MT,PL,PT,RU';
const SPAIN = { section: 'regions', mode: 'explore', countries: ['ES'], levels: { ES: 'g1' } };
// The colours, by their number: orange, light blue, green, yellow, blue and pink.
const HEX = ['#e69f00', '#56b4e9', '#009e73', '#f0e442', '#0072b2', '#cc79a7'];
const RGB = ['rgb(230, 159, 0)', 'rgb(86, 180, 233)', 'rgb(0, 158, 115)', 'rgb(240, 228, 66)', 'rgb(0, 114, 178)', 'rgb(204, 121, 167)'];

const piece = (page: Page, id: string) => page.locator(`.map-svg .m-items [data-id="${id}"]`).first();
const box = (page: Page) => page.locator('.hand');
const say = (page: Page) => page.locator('.hand-say');
const rows = (page: Page) => page.locator('.hand-legend li');
const toggle = (page: Page, name = 'Pintar el mapa') => page.locator('label.toggle', { hasText: name });
const flip = (page: Page, name = 'Pintar el mapa') => toggle(page, name).click();
const pick = (page: Page, id: string) => piece(page, id).dispatchEvent('click');
const fromList = (page: Page, name: string) => page.locator('.index button', { hasText: new RegExp(`^${name}$`) }).click();
const colour = (page: Page, name: string) => box(page).getByRole('radio', { name, exact: true });
const save = (page: Page) => box(page).getByRole('button', { name: 'Guardar imagen' });
const preview = (page: Page) => page.locator('.hand img.pic');
/** The count and the line of each row of the legend: "2 He estado". */
const legend = (page: Page): Promise<string[]> => rows(page).evaluateAll((list) => list.map((li) => `${li.querySelector('b')!.textContent} ${li.querySelector('input')!.value}`.trim()));
/** What the browser keeps of the paintings. */
const kept = (page: Page): Promise<Record<string, { f: Record<string, number>; l: Record<string, string> }>> =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('regionle:v1')!) as { state: { hand: Record<string, { f: Record<string, number>; l: Record<string, string> }> } }).state.hand);
/** The painted pieces of the map on screen, each with the class that paints it: "ES:st-h1". */
const paintedOnMap = (page: Page): Promise<string[]> =>
  page.locator('.map-svg .m-items path[data-id][class*="st-h"]').evaluateAll((list) => [...new Set(list.map((el) => `${(el as SVGElement).dataset.id}:${/st-h\d/.exec(el.getAttribute('class')!)![0]}`))].sort());

/** The map of the eight countries, with something already kept in the browser: what is seeded is written once, the game with it. */
async function startWith(page: Page, keptBefore: Record<string, unknown>): Promise<void> {
  await seed(page, { ...keptBefore, game: { levels: {}, nonce: 1, ...WORLD, opts: OPTS } });
  await page.goto('./#/jugar');
  await expect(piece(page, 'ES')).toBeVisible({ timeout: 30_000 });
}

/** Where to leave the pictures to look at them, when asked to (`PICS=/tmp/x npx playwright test …`). */
const keep = async (download: Download, name: string) => {
  if (process.env.PICS) await download.saveAs(`${process.env.PICS}/${name}`);
};
/** What a PNG file says of itself: its size in pixels. */
function sizeOf(png: Buffer): [number, number] {
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}
/** The colours of the map on the picture, as the page shows it, read back point by point: every other point of every other line of where the map is. */
const colours = (page: Page): Promise<string[]> =>
  preview(page).evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1080;
    const pen = canvas.getContext('2d')!;
    pen.drawImage(img, 0, 0);
    const seen = new Set<string>();
    const { data } = pen.getImageData(64, 266, 952, 520);
    for (let y = 0; y < 520; y += 2) for (let x = 0; x < 952; x += 2) seen.add(`#${[0, 1, 2].map((c) => data[(y * 952 + x) * 4 + c].toString(16).padStart(2, '0')).join('')}`);
    return [...seen];
  });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test.describe('painting the map by hand', () => {
  test('paints the pieces that are tapped with the colour in the hand, and a second touch takes it off', async ({ page }) => {
    await start(page, WORLD);
    await expect(piece(page, 'ES')).toBeVisible({ timeout: 30_000 });
    await expect(box(page)).toHaveCount(0);
    await expect(toggle(page)).toContainText('Elige un color y toca las piezas');
    await flip(page);

    // Six colours and an eraser; the first colour is in the hand.
    await expect(box(page).getByRole('radiogroup', { name: 'Color con el que pintar' }).getByRole('radio')).toHaveCount(7);
    await expect(colour(page, 'Naranja')).toBeChecked();
    await expect(say(page)).toHaveText('Toca una pieza, en el mapa o en la lista, para pintarla de naranja.');
    await expect(rows(page)).toHaveCount(0);
    await expect(save(page)).toHaveCount(0);

    // With the colours out, a click paints: it does not open the card of the piece.
    await pick(page, 'ES');
    await expect(say(page)).toHaveText('España: naranja.');
    await expect(piece(page, 'ES')).toHaveClass(/\bst-h1\b/);
    await expect(piece(page, 'ES')).toHaveCSS('fill', RGB[0]);
    await expect(page.locator('.card-item')).toHaveCount(0);
    await fromList(page, 'Francia');
    await expect(say(page)).toHaveText('Francia: naranja.');
    expect(await legend(page)).toEqual(['2']);
    // In the list, each painted piece has a dot of its colour.
    await expect(page.locator('.index button', { hasText: /^Francia$/ }).locator('.hand-dot')).toHaveCSS('background-color', RGB[0]);
    await expect(page.locator('.index button', { hasText: /^Italia$/ }).locator('.hand-dot')).toHaveCount(0);

    // Another colour: a piece that had one changes to it.
    await colour(page, 'Verde').check();
    await expect(say(page)).toHaveText('Toca una pieza, en el mapa o en la lista, para pintarla de verde.');
    await pick(page, 'BR');
    await pick(page, 'FR');
    await expect(say(page)).toHaveText('Francia: verde.');
    await expect(piece(page, 'FR')).toHaveCSS('fill', RGB[2]);
    expect(await legend(page)).toEqual(['1', '2']);
    expect(await paintedOnMap(page)).toEqual(['BR:st-h3', 'ES:st-h1', 'FR:st-h3']);

    // The same colour again on a piece takes it off.
    await pick(page, 'BR');
    await expect(say(page)).toHaveText('Brasil: sin color.');
    await expect(piece(page, 'BR')).not.toHaveClass(/st-h/);
    expect(await legend(page)).toEqual(['1', '1']);

    // The eraser takes any colour off, and does nothing to a piece that has none.
    await colour(page, 'Goma').check();
    await expect(say(page)).toHaveText('Toca una pieza pintada para quitarle el color.');
    await pick(page, 'ES');
    await expect(say(page)).toHaveText('España: sin color.');
    await pick(page, 'IT');
    await expect(say(page)).toHaveText('Italia: sin color.');
    expect(await legend(page)).toEqual(['1']);
    expect(await paintedOnMap(page)).toEqual(['FR:st-h3']);
    expect((await kept(page))[WORLD_KEY].f).toEqual({ FR: 3 });
  });

  test('says what each colour stands for, and keeps the painting of each map in the browser', async ({ page }) => {
    await start(page, WORLD);
    await expect(piece(page, 'ES')).toBeVisible({ timeout: 30_000 });
    await flip(page);
    await pick(page, 'ES');
    await pick(page, 'PT');
    await colour(page, 'Azul').check();
    await pick(page, 'MT');
    await box(page).getByRole('textbox', { name: 'Qué significa el naranja' }).fill('He  estado');
    await box(page).getByRole('textbox', { name: 'Qué significa el azul' }).fill('x'.repeat(50));
    expect(await legend(page)).toEqual(['2 He estado', `1 ${'x'.repeat(30)}`]);
    await expect.poll(() => kept(page)).toEqual({ [WORLD_KEY]: expect.objectContaining({ f: { ES: 1, PT: 1, MT: 5 }, l: { 1: 'He estado', 5: 'x'.repeat(30) } }) });
    // Malta is a speck: it is its ring that takes the colour.
    await expect(page.locator('.map-svg .m-ring[data-id="MT"]')).toHaveCSS('fill', RGB[4]);

    // With the colours put away the map is the one of always: nothing painted, and a click opens a card.
    await flip(page);
    await expect(box(page)).toHaveCount(0);
    expect(await paintedOnMap(page)).toEqual([]);
    await expect(toggle(page)).toContainText('Tienes 3 países con color en este mapa.');
    await pick(page, 'IT');
    await expect(page.locator('.card-item h2')).toHaveText('Italia');
    await expect(piece(page, 'IT')).toHaveClass(/\bst-sel\b/);

    // Another map has a painting of its own: this one starts with none.
    await restart(page, SPAIN);
    await expect(piece(page, 'ES-AN')).toBeVisible({ timeout: 30_000 });
    await expect(toggle(page)).toContainText('Elige un color y toca las piezas');
    await flip(page);
    await expect(rows(page)).toHaveCount(0);
    await colour(page, 'Rosa').check();
    await pick(page, 'ES-AN');
    await expect(say(page)).toHaveText('Andalucía: rosa.');
    await expect.poll(async () => Object.keys(await kept(page)).sort()).toEqual([WORLD_KEY, 'r:ES.g1']);

    // And the first one is as it was left, after the page has been loaded again.
    await restart(page, WORLD);
    await expect(piece(page, 'ES')).toBeVisible({ timeout: 30_000 });
    await expect(toggle(page)).toContainText('Tienes 3 países con color en este mapa.');
    await flip(page);
    expect(await legend(page)).toEqual(['2 He estado', `1 ${'x'.repeat(30)}`]);
    expect(await paintedOnMap(page)).toEqual(['ES:st-h1', 'MT:st-h5', 'PT:st-h1']);
    // One piece with colour is one piece.
    await colour(page, 'Goma').check();
    await pick(page, 'ES');
    await pick(page, 'PT');
    await flip(page);
    await expect(toggle(page)).toContainText('Tienes 1 país con color en este mapa.');
  });

  test('saves the painting as a picture, with a legend of the colours in use', async ({ page }) => {
    await startWith(page, { hand: { [WORLD_KEY]: { f: { ES: 1, PT: 1, FR: 3, MT: 5 }, l: { 1: 'He estado', 5: 'Algún día' }, t: 1 } } });
    await flip(page);
    expect(await legend(page)).toEqual(['2 He estado', '1', '1 Algún día']);

    const [download] = await Promise.all([page.waitForEvent('download'), save(page).click()]);
    expect(download.suggestedFilename()).toBe('regionle-mapa-pintado-2026-11-20.png');
    const png = fs.readFileSync(await download.path());
    expect(sizeOf(png)).toEqual([1080, 1080]);
    expect(png.length).toBeGreaterThan(40_000);
    await keep(download, 'pintado.png');
    await expect(box(page).locator('.pic-note')).toHaveText('Imagen guardada en tus descargas.');
    await expect(preview(page)).toBeVisible();
    await expect(preview(page)).toHaveAttribute('alt', 'Imagen del mapa pintado. 8 países: 2 de naranja (He estado), 1 de verde, 1 de azul (Algún día).');
    // The sea, the land that has no colour and the land that is not of this map; the three colours in use, and none of the others.
    const seen = await colours(page);
    for (const hex of ['#d8e6e3', '#fdf6e3', '#ebe4d5', HEX[0], HEX[2], HEX[4]]) expect(seen, hex).toContain(hex);
    for (const hex of [HEX[1], HEX[3], HEX[5]]) expect(seen, hex).not.toContain(hex);

    // A change to the painting is a change to the picture: the one that was shown is not left under it.
    await colour(page, 'Rosa').check();
    await pick(page, 'IT');
    await expect(preview(page)).toHaveCount(0);
    await expect(box(page).locator('.pic-note')).toBeEmpty();
    const [second] = await Promise.all([page.waitForEvent('download'), save(page).click()]);
    await keep(second, 'pintado-2.png');
    await expect(preview(page)).toHaveAttribute('alt', 'Imagen del mapa pintado. 8 países: 2 de naranja (He estado), 1 de verde, 1 de azul (Algún día), 1 de rosa.');
    expect(await colours(page)).toContain(HEX[5]);
  });

  test('clears the whole painting only after asking', async ({ page }) => {
    await startWith(page, { hand: { [WORLD_KEY]: { f: { ES: 1, FR: 3 }, l: { 1: 'He estado' }, t: 1 } } });
    await flip(page);
    await box(page).getByRole('button', { name: 'Borrar todo' }).click();
    await expect(box(page).locator('.hand-ask')).toHaveText('¿Borrar todo lo pintado en este mapa?');
    await expect(save(page)).toHaveCount(0);
    await box(page).getByRole('button', { name: 'No', exact: true }).click();
    expect(await paintedOnMap(page)).toEqual(['ES:st-h1', 'FR:st-h3']);
    await expect(save(page)).toBeVisible();

    await box(page).getByRole('button', { name: 'Borrar todo' }).click();
    await box(page).getByRole('button', { name: 'Sí, borrar' }).click();
    expect(await paintedOnMap(page)).toEqual([]);
    await expect(rows(page)).toHaveCount(0);
    await expect(box(page).getByRole('button', { name: 'Borrar todo' })).toHaveCount(0);
    await expect(say(page)).toHaveText('Toca una pieza, en el mapa o en la lista, para pintarla de naranja.');
    await expect.poll(() => kept(page)).toEqual({});
  });

  test('gives way to the ruler and to the size comparer, and they to it', async ({ page }) => {
    await start(page, WORLD);
    await expect(piece(page, 'ES')).toBeVisible({ timeout: 30_000 });
    const on = (name: string) => toggle(page, name).locator('input');
    await flip(page);
    await pick(page, 'ES');
    await expect(on('Pintar el mapa')).toBeChecked();

    await flip(page, 'Comparar tamaños');
    await expect(on('Pintar el mapa')).not.toBeChecked();
    await expect(box(page)).toHaveCount(0);
    // A click is now a piece to compare: nothing is painted with it.
    await pick(page, 'FR');
    await expect(piece(page, 'FR')).toHaveClass(/\bst-from\b/);
    expect((await kept(page))[WORLD_KEY].f).toEqual({ ES: 1 });

    await flip(page);
    await expect(on('Comparar tamaños')).not.toBeChecked();
    await expect(page.locator('.sizes')).toHaveCount(0);
    await expect(piece(page, 'FR')).not.toHaveClass(/st-from/);
    expect(await paintedOnMap(page)).toEqual(['ES:st-h1']);

    await flip(page, 'Regla para medir');
    await expect(on('Pintar el mapa')).not.toBeChecked();
    await expect(box(page)).toHaveCount(0);
    await flip(page);
    await expect(on('Regla para medir')).not.toBeChecked();
    await expect(page.locator('.ruler')).toHaveCount(0);
  });

  test('is for maps of countries and of regions: a map of cities or of rivers has nothing to fill in', async ({ page }) => {
    await start(page, { section: 'cities', mode: 'explore', countries: ['ES'] });
    await expect(page.locator('.map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    await expect(toggle(page, 'Regla para medir')).toBeVisible();
    await expect(toggle(page)).toHaveCount(0);

    await restart(page, { section: 'physical', mode: 'explore', countries: ['river', 'sea', 'EU'] });
    await expect(page.locator('.map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    await expect(toggle(page, 'Regla para medir')).toBeVisible();
    await expect(toggle(page)).toHaveCount(0);

    await restart(page, SPAIN);
    await expect(piece(page, 'ES-AN')).toBeVisible({ timeout: 30_000 });
    await expect(toggle(page)).toBeVisible();
  });

  test('speaks English with whoever plays in English', async ({ page }) => {
    await startWith(page, { lang: 'en' });
    await flip(page, 'Paint the map');
    await expect(say(page)).toHaveText('Tap a piece, on the map or in the list, to paint it orange.');
    await pick(page, 'ES');
    await expect(say(page)).toHaveText('Spain: orange.');
    await box(page).getByRole('radio', { name: 'Light blue', exact: true }).check();
    await pick(page, 'ES');
    await expect(say(page)).toHaveText('Spain: light blue.');
    await pick(page, 'ES');
    await expect(say(page)).toHaveText('Spain: no colour.');
    await pick(page, 'MT');
    await box(page).getByRole('textbox', { name: 'What light blue stands for' }).fill('Next summer');
    const [download] = await Promise.all([page.waitForEvent('download'), box(page).getByRole('button', { name: 'Save picture' }).click()]);
    expect(download.suggestedFilename()).toBe('regionle-painted-map-2026-11-20.png');
    await keep(download, 'painted.png');
    await expect(preview(page)).toHaveAttribute('alt', 'Picture of the painted map. 8 countries: 1 in light blue (Next summer).');
    await box(page).getByRole('button', { name: 'Clear all' }).click();
    await expect(box(page).locator('.hand-ask')).toHaveText('Clear everything painted on this map?');
    await box(page).getByRole('button', { name: 'Yes, clear it' }).click();
    await expect(rows(page)).toHaveCount(0);
    await flip(page, 'Paint the map');
    await expect(toggle(page, 'Paint the map')).toContainText('Pick a colour and tap the pieces');
  });

  test('fits a phone: the colours come into view when they are taken out, and nothing is wider than the screen @movil', async ({ page }) => {
    // The narrowest phone, with the largest letter and the widest typeface: where a line to write in asks for the most room.
    await page.setViewportSize({ width: 320, height: 640 });
    await startWith(page, { textSize: 'xl', dyslexia: true, hand: { [WORLD_KEY]: { f: { ES: 1, PT: 2, FR: 3, IT: 4, PL: 5, MT: 6 }, l: { 1: 'Donde he estado alguna vez', 2: 'Quiero ir' }, t: 1 } } });
    // How much of the row of colours is out of sight in the panel, which on a phone scrolls on its own over the map.
    const hidden = () =>
      page.evaluate(() => {
        const panel = document.querySelector('.panel')!.getBoundingClientRect();
        const row = document.querySelector('.hand-palette')!.getBoundingClientRect();
        const seen = Math.min(row.bottom, panel.bottom) - Math.max(row.top, panel.top);
        return Math.round(row.height - Math.max(0, seen));
      });
    await page.locator('.panel').evaluate((el) => el.scrollTo(0, 0));
    await toggle(page).locator('.toggle-track').tap();
    await expect(box(page)).toBeVisible();
    await expect.poll(hidden).toBeLessThanOrEqual(1);
    expect(await legend(page)).toEqual(['1 Donde he estado alguna vez', '1 Quiero ir', '1', '1', '1', '1']);
    const fits = await page.evaluate(() => {
      const screen = document.documentElement.clientWidth;
      const hand = document.querySelector('.hand')!.getBoundingClientRect();
      const within = (el: Element) => {
        const r = el.getBoundingClientRect();
        return r.left >= hand.left - 0.5 && r.right <= hand.right + 0.5 && r.width > 0;
      };
      return {
        wide: document.documentElement.scrollWidth - screen,
        box: hand.left >= 0 && hand.right <= screen + 0.5,
        inside: [...document.querySelectorAll('.hand-swatch, .hand-say, .hand-legend li, .hand-legend input, .hand-acts .btn')].every(within),
        // Each colour is a target a finger can hit.
        swatch: Math.min(...[...document.querySelectorAll('.hand-swatch')].map((el) => Math.min(el.getBoundingClientRect().width, el.getBoundingClientRect().height))),
      };
    });
    expect(fits).toEqual({ wide: 0, box: true, inside: true, swatch: 40 });
    // A tap on the map paints.
    await colour(page, 'Rosa').check();
    await pick(page, 'RU');
    await expect(say(page)).toHaveText('Rusia: rosa.');
  });
});
