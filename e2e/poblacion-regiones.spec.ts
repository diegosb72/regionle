/**
 * The people of the regions: the number games of a map of regions can be played by how many live in each,
 * or how thickly, where the data vouch for the figures of every region of the map.
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { open, seed, start, type } from './helpers';

interface Piece {
  id: string;
  properties: { n: { es: string }; pop?: number; py?: number; ar: number; m?: string[] };
}
const spain = JSON.parse(fs.readFileSync('public/data/r/ES.json', 'utf8')) as { objects: Record<string, { geometries: Piece[] }> };
/** The names of a level of Spain, from the most people to the fewest. */
const byPeople = (level: string): string[] => [...spain.objects[level].geometries].sort((a, b) => b.properties.pop! - a.properties.pop!).map((g) => g.properties.n.es);

const PROVINCES = { section: 'regions', countries: ['ES'], levels: { ES: 'f' } };
const figure = (page: Page) => page.getByRole('radiogroup', { name: 'Cifra' });
const kicker = (page: Page) => page.locator('.kicker').first();

test.describe('the menu of a map of regions', () => {
  test('offers their people and how thickly they live next to their size, which stays the one chosen', async ({ page }) => {
    await seed(page, { mode: { regions: 'hilo' } });
    await open(page, '/regiones');
    await expect(figure(page).getByRole('radio')).toHaveText(['Superficie', 'Población', 'Densidad']);
    await expect(figure(page).getByRole('radio', { name: 'Superficie' })).toBeChecked();
    // Nothing is said of the figures until one of people is chosen.
    await expect(page.locator('.opt-hint', { hasText: 'Wikidata' })).toHaveCount(0);

    await figure(page).getByRole('radio', { name: 'Población' }).click();
    await expect(page.locator('.opt-hint', { hasText: 'Wikidata' })).toHaveText(/^Cifras de Wikidata, de 20\d\d: cada una dice su año\.$/);
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(kicker(page)).toHaveText('¿Más o menos habitantes?');
    // The figure on show says the year it is of.
    await expect(page.locator('.pcard-value').first()).toHaveText(/habitantes \(20\d\d\)$/);
  });

  test('plays them by how thickly they are peopled', async ({ page }) => {
    await seed(page, { mode: { regions: 'hilo' } });
    await open(page, '/regiones');
    await figure(page).getByRole('radio', { name: 'Densidad' }).click();
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(kicker(page)).toHaveText('¿Más o menos densidad de población?');
    await expect(page.locator('.pcard-value').first()).toHaveText(/habitantes por km² \(20\d\d\)$/);
  });

  test('says that a map is played by its size where the figures of a country cannot be relied on', async ({ page }) => {
    // Every district of Portugal carries in Wikidata the people of its capital.
    await seed(page, { mode: { regions: 'hilo' }, sel: { regions: ['PT'] }, opts: { regionFig: 'pop' } });
    await open(page, '/regiones');
    await expect(figure(page)).toHaveCount(0);
    await expect(page.locator('.opt-hint', { hasText: 'superficie' })).toHaveText('Se juega con la superficie: de Portugal no hay cifras de población de fiar.');
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(kicker(page)).toHaveText('¿Más o menos superficie?');
  });

  test('needs the figures of every country of a map of several', async ({ page }) => {
    await seed(page, { mode: { regions: 'hilo' }, sel: { regions: ['ES', 'PT'] } });
    await open(page, '/regiones');
    await expect(figure(page)).toHaveCount(0);
    await expect(page.locator('.opt-hint', { hasText: 'superficie' })).toContainText('de Portugal no hay cifras');
  });

  test('says nothing of figures in a game that has none', async ({ page }) => {
    await seed(page, { mode: { regions: 'pin' } });
    await open(page, '/regiones');
    await expect(figure(page)).toHaveCount(0);
    await expect(page.locator('.opt-hint', { hasText: 'superficie' })).toHaveCount(0);
  });
});

test.describe('the number games of a map of regions, by its people', () => {
  test('name the ten provinces of Spain with the most people', async ({ page }) => {
    await start(page, { ...PROVINCES, mode: 'topten', opts: { regionFig: 'pop' } });
    await expect(page.locator('.q-ask')).toHaveText('Los 10 primeros, de más a menos habitantes');
    const [first, second, third] = byPeople('f');
    expect([first, second]).toEqual(['Madrid', 'Barcelona']);
    // Out of order: each goes to its place.
    await type(page, third);
    await type(page, first);
    await type(page, second);
    await expect(page.locator('.top-list li b')).toHaveText([first, second, third]);
    // A name that is not among them is told its place: only Ceuta and Melilla have fewer people than Soria.
    expect(byPeople('f').indexOf('Soria')).toBe(49);
    await type(page, 'Soria');
    await expect(page.locator('.q-note')).toHaveText('Soria no está entre los 10 primeros: es el n.º 50.');
  });

  test('give a community the people of its provinces', async ({ page }) => {
    await start(page, { ...PROVINCES, levels: { ES: 'g1' }, mode: 'topten', opts: { regionFig: 'pop' } });
    await expect(page.locator('.q-ask')).toHaveText('Los 9 primeros, de más a menos habitantes');
    const [first, second, third] = byPeople('g1');
    expect(first).toBe('Andalucía');
    for (const name of [first, second, third]) await type(page, name);
    await expect(page.locator('.top-list li b')).toHaveText([first, second, third]);
  });

  test('ask for the figure of the year it is of, and show it with the year', async ({ page }) => {
    await start(page, { ...PROVINCES, mode: 'exact', opts: { regionFig: 'pop', length: 10 } });
    await expect(kicker(page)).toHaveText(/^¿Cuántos habitantes tiene\? \(en 20\d\d\)$/);
    await page.getByLabel('Cifra', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Comprobar' }).click();
    await expect(page.locator('.pcard-value')).toHaveText(/habitantes \(20\d\d\)$/);
    // The card of the piece says how many live there as well.
    await expect(page.locator('.facts')).toContainText(/habitantes \(20\d\d\) · /);
  });

  test('are played by its size when the game asks for the people of a map that has none', async ({ page }) => {
    await start(page, { section: 'regions', countries: ['PT'], levels: { PT: 'f' }, mode: 'hilo', opts: { regionFig: 'pop' } });
    await expect(kicker(page)).toHaveText('¿Más o menos superficie?');
    await expect(page.locator('.pcard-value').first()).toHaveText(/km²$/);
  });

  test('are played by its size, as ever, when the game says nothing', async ({ page }) => {
    await start(page, { ...PROVINCES, mode: 'hilo' });
    await expect(kicker(page)).toHaveText('¿Más o menos superficie?');
  });

  test('are told apart, among the games played lately, from the same game by its size', async ({ page }) => {
    await start(page, { ...PROVINCES, mode: 'exact', opts: { regionFig: 'pop', length: 10 } });
    await page.getByLabel('Cifra', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Comprobar' }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results')).toBeVisible();
    await open(page, '/');
    await expect(page.locator('.recent-list li').first()).toContainText('población');
  });
});

test.describe('a game started where the map has no figures of people', () => {
  test('is a game by size, whatever was chosen on another map: it is kept and named as one', async ({ page }) => {
    // Population was the figure chosen the last time, on a map that had it.
    await seed(page, { mode: { regions: 'exact' }, sel: { regions: ['PT'] }, opts: { regionFig: 'pop', length: 10 } });
    await open(page, '/regiones');
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(kicker(page)).toHaveText('¿Qué superficie tiene?');
    const game = await page.evaluate(() => (JSON.parse(localStorage.getItem('regionle:v1')!) as { state: { game: { opts: { regionFig: string } } } }).state.game.opts.regionFig);
    expect(game).toBe('area');
    await page.getByLabel('Cifra', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Comprobar' }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results')).toBeVisible();
    await open(page, '/');
    await expect(page.locator('.recent-list li').first()).toContainText('Portugal');
    await expect(page.locator('.recent-list li').first()).not.toContainText('población');
    // What was chosen is still chosen for the maps that have it.
    const kept = await page.evaluate(() => (JSON.parse(localStorage.getItem('regionle:v1')!) as { state: { opts: { regionFig: string } } }).state.opts.regionFig);
    expect(kept).toBe('pop');
  });
});

test.describe('the card of a region', () => {
  test('says how many people live there, and the year, where the map has the figures', async ({ page }) => {
    await start(page, { ...PROVINCES, mode: 'explore' });
    await page.locator('.map-svg .m-items [data-id="ES-M"]').first().dispatchEvent('click');
    const people = page.locator('dl div', { has: page.locator('dt', { hasText: /^Población$/ }) });
    await expect(people.locator('dd')).toHaveText(/millones de habitantes \(20\d\d\)$/);
  });

  test('says nothing of people where it has none', async ({ page }) => {
    await start(page, { section: 'regions', countries: ['PT'], levels: { PT: 'f' }, mode: 'explore' });
    await page.locator('.map-svg .m-items [data-id="PT-11"]').first().dispatchEvent('click');
    await expect(page.locator('dl dt', { hasText: /^Superficie$/ })).toBeVisible();
    await expect(page.locator('dl dt', { hasText: /^Población$/ })).toHaveCount(0);
  });
});
