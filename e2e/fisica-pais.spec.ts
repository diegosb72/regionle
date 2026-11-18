import { expect, test, type Page } from '@playwright/test';
import { open, seed, start } from './helpers';

const MIN = 60_000;
/** A click on a river: in the middle of its course, where the line is. */
async function clickLine(page: Page, id: string, at = 0.5): Promise<void> {
  const point = await page.locator(`.map-svg path.ln-hit[data-id="${id}"]`).evaluate((el, share) => {
    const path = el as SVGPathElement;
    const p = path.getPointAtLength(path.getTotalLength() * share).matrixTransform(path.getScreenCTM()!);
    return { x: p.x, y: p.y };
  }, at);
  await page.mouse.click(point.x, point.y);
}

test.describe('the physical map of a country', () => {
  test('is chosen in the setup: Spain first, any other from the list', async ({ page }) => {
    await seed(page, { sel: { physical: ['river', 'EU'] }, mode: { physical: 'pin' } });
    await open(page, '/fisica');
    const kinds = page.locator('.phys .frow').first();
    const places = page.locator('.phys .frow').nth(1);
    const lands = page.locator('.phys .frow').nth(2);
    // On a continent: no capes yet, and Europe has no deserts to offer.
    await expect(kinds.getByRole('button', { name: /Cabos/ })).toHaveCount(0);
    await expect(kinds.getByRole('button', { name: /Desiertos/ })).toHaveCount(0);
    await expect(places.getByRole('button', { name: 'Europa' })).toHaveAttribute('aria-pressed', 'true');

    await lands.getByRole('button', { name: /España/ }).click();
    await expect(lands.getByRole('button', { name: /España/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(places.getByRole('button', { name: 'Europa' })).toHaveAttribute('aria-pressed', 'false');
    await expect(kinds.getByRole('button', { name: /Cabos/ })).toBeVisible();
    await expect(kinds.getByRole('button', { name: /Mesetas y llanuras/ })).toBeVisible();
    const list = page.locator('.phys-list');
    // The rivers every pupil is asked to place; the rest come with «Todos».
    await expect(list).toContainText('Tajo');
    await expect(list).toContainText('Nalón');
    await expect(list).not.toContainText('Manzanares');
    await page.getByRole('radio', { name: 'Todos' }).click();
    await expect(list).toContainText('Manzanares');
    await expect(page.locator('.startbar')).toContainText('Ríos · España');

    await kinds.getByRole('button', { name: /Cabos/ }).click();
    await expect(list).toContainText('Cabo de Gata');

    // Another country, with what the maps of the continents have of it.
    await page.getByLabel('Otro país').selectOption('FR');
    await expect(lands.getByRole('button', { name: /España/ })).toHaveAttribute('aria-pressed', 'false');
    await expect(list).toContainText('Sena');
    await expect(list).toContainText('Loira');
    await expect(list).not.toContainText('Tajo');
    // France has no capes on its map: the kind stays while it is chosen, and says so.
    await kinds.getByRole('button', { name: /Cabos/ }).click();
    await expect(kinds.getByRole('button', { name: /Cabos/ })).toHaveCount(0);

    // Back to a continent: the country lets go.
    await places.getByRole('button', { name: 'Todo el mundo' }).click();
    await expect(page.getByLabel('Otro país')).toHaveValue('');
    await expect(list).toContainText('Nilo');
  });

  test('draws Spain with its rivers, ranges, plains and capes, and asks about them', async ({ page }) => {
    await start(page, { section: 'physical', mode: 'pin', countries: ['river', 'range', 'plain', 'cape', 'in:ES'], only: ['r:segura'] });
    await expect(page.locator('.play-title span')).toContainText('España');
    const map = page.locator('.map-svg');
    await expect(map.locator('path.ln[data-id="r:tagus"]')).toBeVisible({ timeout: 30_000 });
    await expect(map.locator('path.k-range[data-id="r:central-system"]')).toBeVisible();
    await expect(map.locator('path.k-plain')).toHaveCount(4);
    // A cape is a diamond on the tip of the land; ten of them are among the best known.
    await expect(map.locator('.m-dot.k-cape')).toHaveCount(10);
    // What is only asked with «Todos» is not on this map, nor what belongs to the map of France.
    await expect(map.locator('[data-id="r:manzanares"]')).toHaveCount(0);
    await expect(map.locator('[data-id="r:seine"]')).toHaveCount(0);

    await expect(page.locator('.q-name')).toHaveText(/Segura/);
    await clickLine(page, 'r:segura');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    // Learnt on the map of Spain: that is where it will come back.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1') ?? '{}').state.where['r:segura'])).toBe('p|ES');
  });

  test('tells a river from the one next to it', async ({ page }) => {
    await start(page, { section: 'physical', mode: 'pin', countries: ['river', 'in:ES'], only: ['r:jucar'] });
    await expect(page.locator('.q-name')).toHaveText(/Júcar/);
    await clickLine(page, 'r:segura');
    await expect(page.locator('.q-note')).toHaveText('Eso es Segura.');
  });

  test('brings a review back on the map of the country it was learnt on', async ({ page }) => {
    const now = Date.now();
    await seed(page, {
      stats: { 'loc:r:jarama': [2, 0, 0, now - 90 * MIN], 'loc:c:cape-gata': [1, 0, 0, now - 80 * MIN], 'loc:r:nile': [1, 0, 0, now - 70 * MIN] },
      where: { 'r:jarama': 'p|ES', 'c:cape-gata': 'p|ES', 'r:nile': 'p' },
    });
    await open(page, '/');
    const card = page.locator('.review');
    await expect(card).toContainText('España · ríos, mares y montañas');
    await expect(card).toContainText('Ríos, mares y montañas');
    await card.getByRole('button', { name: /España · ríos, mares y montañas/ }).click();
    await expect(page.locator('.play-title span')).toContainText('España', { timeout: 30_000 });
    await expect(page.locator('.hud-main')).toHaveText('1 / 2');
    // The Jarama is not among the best known: the map holds it because the review asks for it.
    await expect(page.locator('.map-svg path.ln[data-id="r:jarama"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.map-svg .m-dot.k-cape[data-id="c:cape-gata"]')).toBeVisible();
    await expect(page.locator('.map-svg [data-id="r:nile"]')).toHaveCount(0);
  });

  test('gives the Strait of Gibraltar a shape that can be clicked', async ({ page }) => {
    await start(page, { section: 'physical', mode: 'pin', countries: ['sea', 'EU'], only: ['s:strait-of-gibraltar'] });
    await expect(page.locator('.q-name')).toHaveText(/Estrecho de Gibraltar/);
    const strait = page.locator('.map-svg path[data-id="s:strait-of-gibraltar"]').first();
    await expect(strait).toBeVisible({ timeout: 30_000 });
    const box = (await strait.boundingBox())!;
    // The source has it as four specks along the coast; here it is the water between the two shores.
    expect(box.width * box.height).toBeGreaterThan(20);
  });

  test('fits a phone, country and all @movil', async ({ page }) => {
    await seed(page, { sel: { physical: ['river', 'range', 'cape', 'in:ES'] }, mode: { physical: 'pin' } });
    await open(page, '/fisica');
    await expect(page.locator('.phys-list')).toContainText('Tajo');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const select = page.getByLabel('Otro país');
    const box = (await select.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
});
