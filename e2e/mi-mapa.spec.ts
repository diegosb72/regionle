/**
 * "My map of the world": the map of what is known, in Progress, as a picture to save or to send. It is drawn
 * in the browser with each piece in the colour of how well it is known, as the map of the page paints it.
 */
import fs from 'node:fs';
import { expect, test, type Download, type Page } from '@playwright/test';
import { open, seed } from './helpers';

// The clock of these tests is set by hand, and so is where it is read: their days are Madrid's, whatever
// E2E_ZONE says (playwright.config.ts).
test.use({ timezoneId: 'Europe/Madrid' });

const NOW = new Date('2026-11-20T12:00:00+01:00');
const HOUR = 3_600_000;
type Stat = [number, number, number, number];
/** Right first time twice in a row, an hour ago: known. */
const KNOWN: Stat = [2, 2, 2, NOW.getTime() - HOUR];
/** Seen once and missed: being learnt. */
const LEARNING: Stat = [1, 0, 0, NOW.getTime() - HOUR];
/** Known more than a year ago: due for a review. */
const DUE: Stat = [3, 3, 2, NOW.getTime() - 400 * 24 * HOUR];

/** Six countries known (Malta is a speck on the map), two being learnt and one due, all by placing them. */
const WORLD = {
  stats: { 'loc:ES': KNOWN, 'loc:FR': KNOWN, 'loc:PT': KNOWN, 'loc:IT': KNOWN, 'loc:DE': KNOWN, 'loc:MT': KNOWN, 'loc:MA': LEARNING, 'loc:DZ': LEARNING, 'loc:BR': DUE },
  where: { ES: 'c', FR: 'c', PT: 'c', IT: 'c', DE: 'c', MT: 'c', MA: 'c', DZ: 'c', BR: 'c' },
};

/** Where to leave the pictures to look at them, when asked to (`PICS=/tmp/x npx playwright test …`). */
const keep = async (download: Download, name: string) => {
  if (process.env.PICS) await download.saveAs(`${process.env.PICS}/${name}`);
};
/** What a PNG file says of itself: its size in pixels. */
function sizeOf(png: Buffer): [number, number] {
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}
const foot = (page: Page) => page.locator('.know-foot');
const legend = (page: Page) => page.locator('.know-legend li');
const save = (page: Page) => foot(page).getByRole('button', { name: 'Guardar imagen' });
const preview = (page: Page) => page.locator('.know img.pic');
/** How many pieces the map on the page has, as its foot says: "198 países". */
const total = async (page: Page): Promise<number> => Number(/\d+/.exec((await page.locator('.know-what').textContent())!)![0]);
/**
 * The colours of the map on the picture, as the page shows it, read back point by point: every fourth point
 * of every fourth line of the box of the map.
 */
const colours = (page: Page): Promise<string[]> =>
  preview(page).evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1080;
    const pen = canvas.getContext('2d')!;
    pen.drawImage(img, 0, 0);
    const seen = new Set<string>();
    const { data } = pen.getImageData(64, 266, 952, 452);
    for (let y = 0; y < 452; y += 4) for (let x = 0; x < 952; x += 4) seen.add(`#${[0, 1, 2].map((c) => data[(y * 952 + x) * 4 + c].toString(16).padStart(2, '0')).join('')}`);
    return [...seen];
  });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test.describe('the picture of the map of what is known', () => {
  test('is saved from the map of the world, with each country in the colour of how well it is known', async ({ page }) => {
    await seed(page, WORLD);
    await open(page, '/progreso');
    await expect(page.locator('.know .map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    const all = await total(page);
    expect(all).toBeGreaterThan(190);
    await expect(legend(page)).toHaveText(['6 sabidos', '2 aprendiendo', '1 toca repasar', `${all - 9} sin ver`]);

    // After the button that was there, which stays where it was.
    await expect(foot(page).getByRole('button')).toHaveText(['Practicar este mapa', 'Guardar imagen']);
    const [download] = await Promise.all([page.waitForEvent('download'), save(page).click()]);
    expect(download.suggestedFilename()).toBe('regionle-mi-mapa-2026-11-20.png');
    const png = fs.readFileSync(await download.path());
    expect(sizeOf(png)).toEqual([1080, 1080]);
    // The whole world is drawn in it.
    expect(png.length).toBeGreaterThan(60_000);
    await keep(download, 'mundo.png');

    await expect(page.locator('.know .pic-note')).toHaveText('Imagen guardada en tus descargas.');
    await expect(preview(page)).toBeVisible();
    await expect(preview(page)).toHaveAttribute('alt', `Imagen de tu mapa. Mi mapa del mundo: 6 sabidos, 2 aprendiendo, 1 toca repasar y ${all - 9} sin ver.`);
    expect(await preview(page).evaluate((img: HTMLImageElement) => img.decode().then(() => img.naturalWidth))).toBe(1080);
    // The sea; what is known, what is being learnt and what is due; what has not been seen; and the land that is never asked.
    const seen = await colours(page);
    for (const colour of ['#d8e6e3', '#8fd1a9', '#f3cf6f', '#f19a55', '#fdf6e3', '#ebe4d5']) expect(seen, colour).toContain(colour);
    // Nothing in the colours of a miss, nor in those of the palette for colour blindness.
    for (const colour of ['#f0957c', '#74b9ea', '#cc79a7']) expect(seen, colour).not.toContain(colour);
  });

  test('is of what is looked at, and is not offered where nothing has been seen', async ({ page }) => {
    // Spain is known by its place and by its capital; France, by its place only.
    await seed(page, { stats: { 'loc:ES': KNOWN, 'loc:FR': KNOWN, 'cap:ES': KNOWN, 'cap:PT': LEARNING }, where: { ES: 'c', FR: 'c', PT: 'c' } });
    await open(page, '/progreso');
    await expect(page.locator('.know .map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    const all = await total(page);
    const what = page.getByRole('radiogroup', { name: 'Qué se mira' });
    // With everything: Portugal is being learnt, which is its worst side.
    await expect(legend(page)).toHaveText(['2 sabidos', '1 aprendiendo', '0 toca repasar', `${all - 3} sin ver`]);
    const [first] = await Promise.all([page.waitForEvent('download'), save(page).click()]);
    await keep(first, 'todo.png');
    await expect(preview(page)).toHaveAttribute('alt', `Imagen de tu mapa. Mi mapa del mundo: 2 sabidos, 1 aprendiendo, 0 toca repasar y ${all - 3} sin ver.`);

    // The capitals alone: another map, and the picture of the one before is not left under it.
    await what.getByRole('radio', { name: 'Capitales' }).click();
    await expect(legend(page)).toHaveText(['1 sabido', '1 aprendiendo', '0 toca repasar', `${all - 2} sin ver`]);
    await expect(preview(page)).toHaveCount(0);
    await expect(page.locator('.know .pic-note')).toBeEmpty();
    const [second] = await Promise.all([page.waitForEvent('download'), save(page).click()]);
    expect(second.suggestedFilename()).toBe('regionle-mi-mapa-2026-11-20.png');
    await keep(second, 'capitales.png');
    await expect(preview(page)).toHaveAttribute('alt', `Imagen de tu mapa. Mi mapa del mundo (capitales): 1 sabido, 1 aprendiendo, 0 toca repasar y ${all - 2} sin ver.`);

    // No flag has been asked: there is no map to send, and the button that practises the map is still there.
    await what.getByRole('radio', { name: 'Banderas' }).click();
    await expect(legend(page)).toHaveText(['0 sabidos', '0 aprendiendo', '0 toca repasar', `${all} sin ver`]);
    await expect(save(page)).toHaveCount(0);
    await expect(preview(page)).toHaveCount(0);
    await expect(foot(page).getByRole('button')).toHaveText(['Practicar este mapa']);
    // And back.
    await what.getByRole('radio', { name: 'Todo' }).click();
    await expect(save(page)).toBeVisible();
  });

  test('is of the regions of a country too, with its name and what they are', async ({ page }) => {
    await seed(page, {
      stats: { 'loc:ES-AN': KNOWN, 'loc:ES-GA': KNOWN, 'loc:ES-MD': DUE, 'loc:ES': KNOWN },
      where: { 'ES-AN': 'r|ES|g1', 'ES-GA': 'r|ES|g1', 'ES-MD': 'r|ES|g1', ES: 'c' },
    });
    await open(page, '/progreso');
    await expect(page.locator('.know .map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    await page.locator('.know-scopes').getByRole('tab', { name: 'España' }).click();
    await expect(page.locator('.know-what')).toHaveText('España · 19 comunidades autónomas');
    await expect(legend(page)).toHaveText(['2 sabidas', '0 aprendiendo', '1 toca repasar', '16 sin ver']);
    const [download] = await Promise.all([page.waitForEvent('download'), save(page).click()]);
    expect(sizeOf(fs.readFileSync(await download.path()))).toEqual([1080, 1080]);
    await keep(download, 'espana.png');
    await expect(preview(page)).toHaveAttribute('alt', 'Imagen de tu mapa. España · comunidades autónomas: 2 sabidas, 0 aprendiendo, 1 toca repasar y 16 sin ver.');
    const seen = await colours(page);
    // Andalusia and Galicia, Madrid, the rest; and Portugal and France beside them, which are not asked.
    for (const colour of ['#8fd1a9', '#f19a55', '#fdf6e3', '#ebe4d5', '#d8e6e3']) expect(seen, colour).toContain(colour);
    expect(seen).not.toContain('#f3cf6f');
  });

  test('is told in English, and in the colours of the palette for colour blindness', async ({ page }) => {
    await seed(page, { ...WORLD, lang: 'en', cb: true });
    await open(page, '/progreso');
    await expect(page.locator('.know .map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    const all = await total(page);
    const button = foot(page).getByRole('button', { name: 'Save picture' });
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    expect(download.suggestedFilename()).toBe('regionle-my-map-2026-11-20.png');
    await keep(download, 'en.png');
    await expect(page.locator('.know .pic-note')).toHaveText('Picture saved to your downloads.');
    await expect(preview(page)).toHaveAttribute('alt', `Picture of your map. My map of the world: 6 known, 2 learning, 1 due for review and ${all - 9} not seen.`);
    const seen = await colours(page);
    for (const colour of ['#74b9ea', '#f0e442', '#cc79a7', '#fdf6e3']) expect(seen, colour).toContain(colour);
    for (const colour of ['#8fd1a9', '#f3cf6f', '#f19a55']) expect(seen, colour).not.toContain(colour);
  });

  test('fits a phone, where the maps of many countries scroll in their own row @movil', async ({ page }) => {
    // Regions of five countries: with the world, six maps to choose from, which is more than a phone is wide.
    const stats: Record<string, Stat> = { ...WORLD.stats };
    const where: Record<string, string> = { ...WORLD.where };
    for (const [id, origin] of [
      ['ES-AN', 'r|ES|g1'],
      ['FR-BRE', 'r|FR|g1'],
      ['IT-65', 'r|IT|g1'],
      ['DE-BY', 'r|DE|f'],
      ['PT-03', 'r|PT|f'],
    ]) {
      stats[`loc:${id}`] = KNOWN;
      where[id] = origin;
    }
    await seed(page, { stats, where });
    await open(page, '/progreso');
    await expect(page.locator('.know .map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    const maps = page.locator('.know-scopes [role="tab"]');
    expect(await maps.count()).toBeGreaterThanOrEqual(5);
    const wide = () => page.evaluate(() => ({ page: document.documentElement.scrollWidth - document.documentElement.clientWidth, row: (() => { const r = document.querySelector('.know-scopes')!; return r.scrollWidth - r.clientWidth; })() }));
    // The row of maps is wider than the screen, and scrolls; the page is not.
    expect((await wide()).row).toBeGreaterThan(0);
    expect((await wide()).page).toBeLessThanOrEqual(0);
    // The button, whatever it is called on this device (a phone hands the picture to another application), is in the screen.
    const button = foot(page).getByRole('button', { name: /^(Guardar|Compartir) imagen$/ });
    await button.scrollIntoViewIfNeeded();
    const box = (await button.boundingBox())!;
    const screen = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(screen.width);
    expect((await wide()).page).toBeLessThanOrEqual(0);
  });
});
