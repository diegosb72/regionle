/**
 * The figures of the daily challenge, under its result and on its first screen: how many were finished,
 * the average, how the totals are spread and how each of the five tests goes.
 */
import { expect, test, type Page } from '@playwright/test';
import { open, seed } from './helpers';

// The clock of these tests is set by hand, and so is where it is read: their days are Madrid's, whatever
// E2E_ZONE says (playwright.config.ts).
test.use({ timezoneId: 'Europe/Madrid' });

/** Noon of Wednesday 18 November 2026 in Madrid: the day every test here is played on. */
const NOW = new Date('2026-11-18T12:00:00+01:00');
const TODAY = '2026-11-18';
const day = (k: number): string => new Date(Date.parse(`${TODAY}T12:00:00Z`) + k * 86_400_000).toISOString().slice(0, 10);
const rec = (date: string, p: number[], extra: Record<string, unknown> = {}) => ({ p, k: [1, 4, 2, 3, 1], t: Date.parse(`${date}T19:00:00+01:00`), ...extra });

/**
 * Four challenges finished, the second of them after its day. Totals 100, 27, 68 and today's 61: 256 points,
 * 64 on average. By test: 80, 60, 53, 31 and 32 points, that is 20, 15, 13.25, 7.75 and 8 on average.
 */
const DAILY = {
  [day(-3)]: rec(day(-3), [20, 20, 20, 20, 20]),
  [day(-2)]: rec(day(-2), [20, 4, 0, 3, 0], { late: 1 }),
  [day(-1)]: rec(day(-1), [20, 20, 20, 0, 8]),
  [TODAY]: rec(TODAY, [20, 16, 13, 8, 4]),
};
const tiles = (page: Page) => page.locator('.d-tiles > div');
const tile = (page: Page, name: string | RegExp) => tiles(page).filter({ hasText: name }).locator('dd');
const bands = (page: Page) => page.locator('.d-dist li');
const means = (page: Page) => page.locator('.d-means li');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test.describe('the statistics of the daily challenge', () => {
  test('are under the result: what was finished, the average, the best and the days in a row', async ({ page }) => {
    await seed(page, { daily: DAILY, best: { 'daily:streak': 2 } });
    await open(page, '/reto');
    await expect(page.locator('.d-history.d-wide h3')).toHaveText('Tus estadísticas');
    await expect(tiles(page).locator('dt')).toHaveText(['Retos terminados', 'Media', 'Mejor resultado', 'Racha', 'Mejor racha']);
    await expect(tile(page, 'Retos terminados')).toHaveText('4');
    await expect(tile(page, 'Media')).toHaveText('64de 100');
    await expect(tile(page, 'Mejor resultado')).toHaveText('10015 de noviembre');
    // The day before yesterday was finished late: the days in a row are yesterday and today.
    await expect(tile(page, /^Racha/)).toHaveText('2días');
    await expect(tile(page, 'Mejor racha')).toHaveText('2días');
    await expect(page.locator('.d-stats > .d-hint')).toHaveText('Cuentan los retos terminados, también el que jugaste después de su día.');
  });

  test('sort the totals into five bands and mark the one of the day on screen', async ({ page }) => {
    await seed(page, { daily: DAILY });
    await open(page, '/reto');
    await expect(bands(page).locator('span')).toHaveText(['80–100', '60–79', '40–59', '20–39', '0–19']);
    await expect(bands(page).locator('b')).toHaveText(['1', '2', '0', '1', '0']);
    await expect(page.locator('.d-dist li.on')).toHaveCount(1);
    await expect(page.locator('.d-dist li.on span')).toHaveText('60–79');
    await expect(bands(page).first()).toHaveAttribute('aria-label', '80–100 puntos: 1 vez');
    await expect(bands(page).nth(1)).toHaveAttribute('aria-label', '60–79 puntos: 2 veces');
    // The longest bar fills its track, an empty band draws nothing.
    const widths = await bands(page).evaluateAll((list) => list.map((li) => Math.round((li.querySelector('i > i')!.getBoundingClientRect().width / li.querySelector('i')!.getBoundingClientRect().width) * 100)));
    expect(widths).toEqual([50, 100, 0, 50, 0]);

    // The result of another day marks its own band.
    await open(page, `/reto/${day(-2)}`);
    await expect(page.locator('.d-total strong')).toHaveText('27');
    await expect(page.locator('.d-dist li.on span')).toHaveText('20–39');
  });

  test('say how each test goes, and which goes best and worst', async ({ page }) => {
    await seed(page, { daily: DAILY });
    await open(page, '/reto');
    await expect(means(page).locator('.d-row-name')).toHaveText(['Regionle', 'Señalar', 'Ruta', '¿Qué país?', 'Banderas y capitales']);
    await expect(means(page).locator('b')).toHaveText(['20', '15', '13,3', '7,8', '8']);
    await expect(means(page).locator('.d-row-what')).toHaveText(['la que mejor se te da', '20 puntos 2 veces', '20 puntos 2 veces', 'la que más te cuesta', '20 puntos 1 vez']);
    await expect(page.locator('.d-means li.best .d-row-name')).toHaveText('Regionle');
    await expect(page.locator('.d-means li.worst .d-row-name')).toHaveText('¿Qué país?');
  });

  test('wait folded on the first screen of a challenge, and are not there with nothing finished', async ({ page }) => {
    const { [TODAY]: _today, ...before } = DAILY;
    await seed(page, { daily: before });
    await open(page, '/reto');
    const stats = page.locator('details.d-history.d-wide');
    await expect(stats.locator('summary')).toHaveText('Tus estadísticas');
    await expect(page.locator('.d-tiles')).toBeHidden();
    await stats.locator('summary').click();
    await expect(tile(page, 'Retos terminados')).toHaveText('3');
    // Today has no result yet: no band is marked.
    await expect(page.locator('.d-dist li.on')).toHaveCount(0);

    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeVisible();
    await expect(page.locator('details.d-history')).toHaveCount(1);
    await expect(page.locator('.d-stats')).toHaveCount(0);
  });

  test('average the last seven apart once there are more, and count the days a wildcard held', async ({ page }) => {
    // Sixteen days in a row but for the day before yesterday, which a wildcard held.
    const daily: Record<string, unknown> = {};
    for (let k = -16; k <= 0; k++) daily[day(k)] = rec(day(k), k >= -6 ? [20, 20, 20, 20, 20] : [10, 10, 10, 10, 10]);
    daily[day(-2)] = { p: [null, null, null, null, null], k: [null, null, null, null, null], j: 1 };
    await seed(page, { daily, best: { 'daily:streak': 16 } });
    await open(page, '/reto');
    await expect(tile(page, 'Retos terminados')).toHaveText('16');
    await expect(tile(page, /^Racha/)).toHaveText('16días');
    // Ten at 50 and six at 100: 68.75 on average; the last seven, six at 100 and one at 50.
    await expect(tile(page, 'Media')).toHaveText('68,8de 100');
    await expect(page.locator('.d-stats > .d-hint')).toHaveText('En los últimos 7 retos, 92,9 puntos de media. Cuentan los retos terminados; los que se dejan a medias, no. Un día lo cubrió un comodín.');
  });

  test('are told in English, with its figures written its way', async ({ page }) => {
    await seed(page, { lang: 'en', daily: DAILY });
    await open(page, '/reto');
    await expect(page.locator('.d-history.d-wide h3')).toHaveText('Your statistics');
    await expect(tiles(page).locator('dt')).toHaveText(['Challenges finished', 'Average', 'Best result', 'Streak', 'Best streak']);
    await expect(tile(page, 'Best result')).toHaveText('10015 November');
    await expect(means(page).locator('b')).toHaveText(['20', '15', '13.3', '7.8', '8']);
    await expect(means(page).locator('.d-row-what')).toHaveText(['your best', '20 points twice', '20 points twice', 'your hardest', '20 points once']);
    await expect(page.locator('.d-stats > .d-hint')).toHaveText('Every finished challenge counts, the one you played after its day too.');
  });

  test('fit a phone, three figures above and two below @movil', async ({ page }) => {
    await seed(page, { daily: DAILY });
    await open(page, '/reto');
    await expect(tiles(page)).toHaveCount(5);
    const boxes = await tiles(page).evaluateAll((list) => list.map((el) => el.getBoundingClientRect()).map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), right: Math.round(r.right) })));
    expect(new Set(boxes.slice(0, 3).map((b) => b.y)).size).toBe(1);
    expect(boxes[3].y).toBeGreaterThan(boxes[0].y);
    expect(boxes[4].y).toBe(boxes[3].y);
    const width = await page.evaluate(() => document.documentElement.clientWidth);
    for (const b of boxes) expect(b.right).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    // Which test goes best is said under its name, where there is no room beside it.
    await expect(page.locator('.d-means li.best .d-row-what')).toBeVisible();
    await expect(means(page).nth(1).locator('.d-row-what')).toBeHidden();
  });
});
