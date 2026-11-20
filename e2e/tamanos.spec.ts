/**
 * The size comparer of Explore: two pieces of the map one on top of the other, at the same scale, with their
 * surfaces and how much larger one is than the other.
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { OPTS, seed, start } from './helpers';

interface Fact {
  id: string;
  n: { es: string; en?: string };
  ar?: number;
}
const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as { countries: Fact[] };
const byId = new Map(index.countries.map((c) => [c.id, c]));
const km2 = (id: string): number => byId.get(id)!.ar!;

const WORLD = { section: 'countries', mode: 'explore', countries: ['ES', 'BR', 'FR', 'PT', 'IT', 'PL', 'MT', 'RU'] };
const piece = (page: Page, id: string) => page.locator(`.map-svg .m-items [data-id="${id}"]`).first();
const sizes = (page: Page) => page.locator('.sizes');
const art = (page: Page) => page.locator('.sizes-art');
const flip = (page: Page, name: string) => page.locator('label.toggle', { hasText: name }).click();
const pick = (page: Page, id: string) => piece(page, id).dispatchEvent('click');
const fromList = (page: Page, name: string) => page.locator('.index button', { hasText: new RegExp(`^${name}$`) }).click();
/**
 * How much of the drawing each of the two shapes takes up, counted point by point: each is filled on a
 * sheet of its own, four times as fine as the drawing.
 */
const inked = (page: Page): Promise<{ a: number; b: number }> =>
  art(page).evaluate((svg) => {
    const count = (d: string): number => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 960;
      const pen = canvas.getContext('2d')!;
      pen.scale(4, 4);
      pen.fill(new Path2D(d));
      const { data } = pen.getImageData(0, 0, 960, 960);
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 127) n++;
      return n;
    };
    return { a: count(svg.querySelector('path.sizes-a')!.getAttribute('d')!), b: count(svg.querySelector('path.sizes-b')!.getAttribute('d')!) };
  });

test.describe('the size comparer of the map', () => {
  test('lays two countries one over the other at the same scale, and says how much larger one is', async ({ page }) => {
    await start(page, WORLD);
    await expect(piece(page, 'ES')).toBeVisible({ timeout: 30_000 });
    await expect(sizes(page)).toHaveCount(0);
    await flip(page, 'Comparar tamaños');
    await expect(sizes(page)).toHaveText('Elige un país en el mapa o en la lista.');
    await expect(sizes(page).getByRole('button', { name: 'Borrar' })).toHaveCount(0);

    // With the comparer out, a click is a piece to compare and not one to look up.
    await pick(page, 'ES');
    await expect(sizes(page).locator('.sizes-ask')).toHaveText('España. Ahora, otro país.');
    await expect(piece(page, 'ES')).toHaveClass(/\bst-from\b/);
    await expect(page.locator('.card-item')).toHaveCount(0);
    await expect(art(page)).toHaveCount(0);
    // The same one again is not another.
    await pick(page, 'ES');
    await expect(sizes(page).locator('.sizes-ask')).toHaveText('España. Ahora, otro país.');

    await pick(page, 'BR');
    await expect(art(page)).toBeVisible();
    await expect(art(page)).toHaveAccessibleName('España y Brasil, a la misma escala');
    await expect(piece(page, 'ES')).toHaveClass(/\bst-from\b/);
    await expect(piece(page, 'BR')).toHaveClass(/\bst-to\b/);
    // Each with its surface, in the order they were chosen and in the colour it has on the map.
    const rows = sizes(page).locator('.sizes-list li');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveClass(/\bsizes-ka\b/);
    await expect(rows.nth(0).locator('b')).toHaveText('España');
    await expect(rows.nth(0).locator('span')).toHaveText(/^50\d\.\d{3} km²$/);
    await expect(rows.nth(1)).toHaveClass(/\bsizes-kb\b/);
    await expect(rows.nth(1).locator('b')).toHaveText('Brasil');
    await expect(rows.nth(1).locator('span')).toHaveText('8,51 millones de km²');
    const times = km2('BR') / km2('ES');
    expect(times).toBeGreaterThan(16);
    expect(times).toBeLessThan(17.5);
    await expect(sizes(page).locator('.sizes-line')).toHaveText(`Brasil es ${Math.round(times)} veces más grande que España.`);

    // The drawing: both shapes, the smaller one on top, and as much larger one than the other as the figures say.
    await expect(art(page).locator('path.sizes-a, path.sizes-b')).toHaveCount(2);
    expect(await art(page).evaluate((svg) => [...svg.querySelectorAll('path.sizes-a, path.sizes-b')].map((p) => p.getAttribute('class')))).toEqual(['sizes-b', 'sizes-a']);
    const ink = await inked(page);
    expect(ink.a).toBeGreaterThan(500);
    expect(ink.b / ink.a).toBeGreaterThan(times * 0.88);
    expect(ink.b / ink.a).toBeLessThan(times * 1.12);
    // Neither is a speck beside the other: no ring. And a bar says how far it is across.
    await expect(art(page).locator('.sizes-ring')).toHaveCount(0);
    await expect(art(page).locator('.sizes-bar text')).toHaveText(/^(1000|2000) km$/);
    // The bar is as long as it says: Brazil is some 4300 km from north to south, and takes most of the drawing.
    const scale = await art(page).evaluate((svg) => {
      const bar = (svg.querySelector('.sizes-bar path') as SVGPathElement).getBBox().width;
      const km = Number(svg.querySelector('.sizes-bar text')!.textContent!.replace(/\D/g, ''));
      const brazil = (svg.querySelector('path.sizes-b') as SVGPathElement).getBBox();
      return (Math.max(brazil.height, brazil.width) * km) / bar;
    });
    expect(scale).toBeGreaterThan(3900);
    expect(scale).toBeLessThan(4700);

    // A third piece starts another comparison.
    await pick(page, 'PT');
    await expect(art(page)).toHaveCount(0);
    await expect(sizes(page).locator('.sizes-ask')).toHaveText('Portugal. Ahora, otro país.');
    await expect(piece(page, 'PT')).toHaveClass(/\bst-from\b/);
    await expect(piece(page, 'ES')).not.toHaveClass(/\bst-(from|to)\b/);
    await expect(piece(page, 'BR')).not.toHaveClass(/\bst-(from|to)\b/);
    // The other one, from the list: the map stays where it was, and the card is still not shown.
    await fromList(page, 'Francia');
    await expect(art(page)).toBeVisible();
    const more = km2('FR') / km2('PT');
    await expect(sizes(page).locator('.sizes-line')).toHaveText(`Francia es ${more.toFixed(1).replace('.', ',')} veces más grande que Portugal.`);
    await expect(page.locator('.card-item')).toHaveCount(0);
    // The larger one is the second here too: it is drawn first, under the other.
    expect(await art(page).evaluate((svg) => [...svg.querySelectorAll('path.sizes-a, path.sizes-b')].map((p) => p.getAttribute('class')))).toEqual(['sizes-b', 'sizes-a']);
    // And where the larger one is the first, it is the first that is drawn.
    await pick(page, 'FR');
    await pick(page, 'PT');
    await expect(sizes(page).locator('.sizes-line')).toHaveText(`Francia es ${more.toFixed(1).replace('.', ',')} veces más grande que Portugal.`);
    expect(await art(page).evaluate((svg) => [...svg.querySelectorAll('path.sizes-a, path.sizes-b')].map((p) => p.getAttribute('class')))).toEqual(['sizes-a', 'sizes-b']);

    await sizes(page).getByRole('button', { name: 'Borrar' }).click();
    await expect(sizes(page)).toHaveText('Elige un país en el mapa o en la lista.');
    await expect(page.locator('.map-svg .st-from, .map-svg .st-to')).toHaveCount(0);
  });

  test('says so when the two are nearly as large, or one little more than the other', async ({ page }) => {
    await start(page, WORLD);
    await expect(piece(page, 'ES')).toBeVisible({ timeout: 30_000 });
    await flip(page, 'Comparar tamaños');
    // Italy and Poland: within a tenth of each other.
    expect(km2('PL') / km2('IT')).toBeLessThan(1.1);
    await pick(page, 'IT');
    await pick(page, 'PL');
    await expect(sizes(page).locator('.sizes-line')).toHaveText('Italia y Polonia son casi igual de grandes.');
    const ink = await inked(page);
    expect(ink.b / ink.a).toBeGreaterThan(0.9);
    expect(ink.b / ink.a).toBeLessThan(1.2);
    // The other way round, «y» is «e» before Italia, in the sentence and in the name of the drawing.
    await pick(page, 'PL');
    await pick(page, 'IT');
    await expect(sizes(page).locator('.sizes-line')).toHaveText('Polonia e Italia son casi igual de grandes.');
    await expect(art(page)).toHaveAccessibleName('Polonia e Italia, a la misma escala');
    // France and Poland: so much per cent more.
    const more = Math.round((km2('FR') / km2('PL') - 1) * 100);
    expect(more).toBeGreaterThan(10);
    expect(more).toBeLessThan(100);
    await pick(page, 'FR');
    await pick(page, 'PL');
    await expect(sizes(page).locator('.sizes-line')).toHaveText(`Francia es un ${more} % más grande que Polonia.`);
  });

  test('puts a ring where the smaller one is when it is a speck beside the other', async ({ page }) => {
    await start(page, WORLD);
    await expect(piece(page, 'RU')).toBeVisible({ timeout: 30_000 });
    await flip(page, 'Comparar tamaños');
    await pick(page, 'RU');
    await fromList(page, 'Malta');
    await expect(sizes(page).locator('.sizes-line')).toHaveText(/^Rusia es 5\d\.000 veces más grande que Malta\.$/);
    const ring = art(page).locator('.sizes-ring');
    await expect(ring).toHaveCount(1);
    // In the colour of Malta, the second one, and in the middle of the drawing.
    await expect(ring).toHaveClass(/\bsizes-b\b/);
    expect(await ring.evaluate((c) => [c.getAttribute('cx'), c.getAttribute('cy')])).toEqual(['120', '120']);
    expect(await ring.evaluate((c) => getComputedStyle(c).fill)).toBe('none');
    // The other way round, the ring is of the first.
    await pick(page, 'MT');
    await pick(page, 'RU');
    await expect(art(page).locator('.sizes-ring')).toHaveClass(/\bsizes-a\b/);
  });

  test('is one tool at a time with the ruler, and is put away', async ({ page }) => {
    await start(page, WORLD);
    await expect(piece(page, 'ES')).toBeVisible({ timeout: 30_000 });
    const box = (name: string) => page.locator('label.toggle', { hasText: name }).locator('input');
    await flip(page, 'Comparar tamaños');
    await pick(page, 'ES');
    await pick(page, 'FR');
    await expect(art(page)).toBeVisible();
    // The ruler out: the comparer goes, with what it had painted.
    await flip(page, 'Regla para medir');
    await expect(box('Regla para medir')).toBeChecked();
    await expect(box('Comparar tamaños')).not.toBeChecked();
    await expect(sizes(page)).toHaveCount(0);
    await expect(page.locator('.ruler')).toBeVisible();
    await expect(page.locator('.map-svg .st-from, .map-svg .st-to')).toHaveCount(0);
    // And back: the ruler goes, and the comparer starts with nothing chosen.
    await flip(page, 'Comparar tamaños');
    await expect(box('Regla para medir')).not.toBeChecked();
    await expect(page.locator('.ruler')).toHaveCount(0);
    await expect(sizes(page)).toHaveText('Elige un país en el mapa o en la lista.');
    // Put away, the map looks pieces up again.
    await pick(page, 'IT');
    await flip(page, 'Comparar tamaños');
    await expect(sizes(page)).toHaveCount(0);
    await expect(page.locator('.map-svg .st-from, .map-svg .st-to')).toHaveCount(0);
    await pick(page, 'IT');
    await expect(page.locator('.card-item .q-name')).toContainText('Italia');
    await expect(piece(page, 'IT')).toHaveClass(/\bst-sel\b/);
  });

  test('compares the regions of a country, and what has a surface on a physical map; in English and in miles', async ({ page }) => {
    await start(page, { section: 'regions', mode: 'explore', countries: ['ES'], levels: { ES: 'f' } });
    await expect(piece(page, 'ES-BA')).toBeVisible({ timeout: 30_000 });
    await flip(page, 'Comparar tamaños');
    await expect(sizes(page)).toHaveText('Elige una provincia en el mapa o en la lista.');
    await pick(page, 'ES-BA');
    await expect(sizes(page).locator('.sizes-ask')).toHaveText('Badajoz. Ahora, otra provincia.');
    await pick(page, 'ES-SS');
    await expect(sizes(page).locator('.sizes-line')).toHaveText('Badajoz es 11 veces más grande que Guipúzcoa.');
    await expect(art(page).locator('.sizes-bar text')).toHaveText(/^(50|100) km$/);
    await expect(sizes(page).locator('.sizes-ask')).toHaveText('Para comparar otra vez, elige otra provincia.');

    // Rivers, lakes and islands of Europe, for somebody who reads in English and in miles.
    await page.evaluate(
      (next) => {
        const saved = JSON.parse(localStorage.getItem('regionle:v1')!) as { state: Record<string, unknown> };
        Object.assign(saved.state, { lang: 'en', miles: true, game: next });
        localStorage.setItem('regionle:v1', JSON.stringify(saved));
      },
      { section: 'physical', mode: 'explore', countries: ['river', 'lake', 'island', 'peninsula', 'EU'], levels: {}, nonce: 2, opts: OPTS },
    );
    await page.reload();
    await expect(page.locator('.index button', { hasText: /^Sicily$/ })).toBeVisible({ timeout: 30_000 });
    await flip(page, 'Compare sizes');
    await expect(sizes(page)).toHaveText('Choose a feature on the map or in the list.');
    // A river is a line: it has no surface.
    await fromList(page, 'Danube');
    await expect(sizes(page).locator('.sizes-ask')).toHaveText('That has no area to compare: choose another feature.');
    await expect(page.locator('.map-svg .st-from, .map-svg .st-to')).toHaveCount(0);
    await fromList(page, 'Sicily');
    await expect(sizes(page).locator('.sizes-ask')).toHaveText('Sicily. Now, another feature.');
    // Not a river in between: it is told, and Sicily is kept.
    await fromList(page, 'Rhine');
    await expect(sizes(page).locator('.sizes-ask')).toHaveText('That has no area to compare: choose another feature.');
    await fromList(page, 'Ireland');
    await expect(sizes(page).locator('.sizes-line')).toHaveText(/^Ireland: 3\.\d times the area of Sicily\.$/);
    await expect(sizes(page).locator('.sizes-ask')).toHaveText('To compare again, choose another feature.');
    // A river with the two on show: it is told under them, and they stay.
    await fromList(page, 'Volga');
    await expect(sizes(page).locator('.sizes-ask')).toHaveText('That has no area to compare: choose another feature.');
    await expect(sizes(page).locator('.sizes-line')).toHaveText(/^Ireland: 3\.\d times the area of Sicily\.$/);
    await expect(sizes(page).locator('.sizes-list span')).toHaveText([/^9,\d{3} sq mi$/, /^3\d,\d{3} sq mi$/]);
    await expect(art(page).locator('.sizes-bar text')).toHaveText(/^(50|100|200) mi$/);
    await expect(art(page)).toHaveAccessibleName('Sicily and Ireland, at the same scale');
    await expect(sizes(page).locator('.sizes-rough')).toHaveCount(0);

    // Where a peninsula ends is anybody's guess, and the game has no figure for it: both are measured on
    // their outlines, and told as the rough figures they are.
    await fromList(page, 'Sicily');
    await fromList(page, 'Iberian Peninsula');
    await expect(sizes(page).locator('.sizes-list span')).toHaveText([/^about 9,[5-9]00 sq mi$/, /^about 2[12]0,000 sq mi$/]);
    await expect(sizes(page).locator('.sizes-line')).toHaveText(/^Iberian Peninsula: about 2[234] times the area of Sicily\.$/);
    await expect(sizes(page).locator('.sizes-rough')).toHaveText('Rough figures: what each outline takes up on this map.');
  });

  test('is not offered on a map with no surfaces to compare', async ({ page }) => {
    await start(page, { section: 'cities', mode: 'explore', countries: ['ES'], opts: { cityPick: 'top', cityCount: 10 } });
    await expect(page.locator('.index button').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('label.toggle', { hasText: 'Regla para medir' })).toBeVisible();
    await expect(page.locator('label.toggle', { hasText: 'Comparar tamaños' })).toHaveCount(0);
  });

  test('fits a phone: the drawing and what is said of it are no wider than the screen @movil', async ({ page }) => {
    await seed(page, { textSize: 'xl', game: { levels: {}, nonce: 1, ...WORLD, opts: OPTS } });
    await page.goto('./#/jugar');
    await expect(piece(page, 'ES')).toBeVisible({ timeout: 30_000 });
    await flip(page, 'Comparar tamaños');
    await fromList(page, 'España');
    await fromList(page, 'Brasil');
    await expect(art(page)).toBeVisible();
    await expect(sizes(page).locator('.sizes-line')).toContainText('veces más grande que España.');
    // Both came from the list, which is under the box: what is on show goes back up, to as much of the box as fits.
    const missing = () =>
      page.evaluate(() => {
        const panel = document.querySelector('.panel')!.getBoundingClientRect();
        const box = document.querySelector('.sizes')!.getBoundingClientRect();
        const seen = Math.min(box.bottom, panel.bottom) - Math.max(box.top, panel.top);
        return Math.round(Math.min(box.height, panel.height) - seen);
      });
    await expect.poll(missing).toBeLessThanOrEqual(1);
    // The drawing, from its top.
    expect(await page.evaluate(() => document.querySelector('.sizes-art')!.getBoundingClientRect().top >= document.querySelector('.panel')!.getBoundingClientRect().top)).toBe(true);
    const fits = await page.evaluate(() => {
      const screen = document.documentElement.clientWidth;
      const within = (el: Element | null) => {
        const r = el!.getBoundingClientRect();
        return r.left >= 0 && r.right <= screen + 0.5 && r.width > 0;
      };
      return {
        wide: document.documentElement.scrollWidth - screen,
        art: within(document.querySelector('.sizes-art')),
        rows: [...document.querySelectorAll('.sizes-list li, .sizes-line, .sizes .btn')].every(within),
      };
    });
    expect(fits).toEqual({ wide: 0, art: true, rows: true });
  });
});
