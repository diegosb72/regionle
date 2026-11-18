import { expect, test } from '@playwright/test';
import { PIN_SPAIN, open, play, seed } from './helpers';

const MIN = 60_000;
const stat = (run: number, ago: number, seen = Math.max(1, run)) => [seen, run, run, Date.now() - ago * MIN];

test.describe('what gets mixed up', () => {
  test('is written down when another piece is the answer, and said the second time', async ({ page }) => {
    await play(page, { ...PIN_SPAIN, opts: { ...PIN_SPAIN.opts, length: 'all' } });
    const asked = ((await page.locator('.q-name').textContent()) ?? '').trim();
    // Andalusia stands for the wrong answer, and Galicia when Andalusia is the right one.
    const [wrong, name] = asked === 'Andalucía' ? ['ES-GA', 'Galicia'] : ['ES-AN', 'Andalucía'];
    const piece = page.locator(`.map-svg [data-id="${wrong}"]`);
    await piece.click();
    await expect(page.locator('.q-note')).toHaveText(`Eso es ${name}.`);
    await piece.click();
    await expect(page.locator('.q-note')).toHaveText(`Eso es ${name}. Ya van 2 veces que confundes las dos.`);
    // The third miss settles the question.
    await piece.click();
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeVisible();

    await open(page, '/progreso');
    const block = page.locator('.mix');
    await expect(block.locator('h2')).toHaveText('Lo que confundes');
    await expect(block.locator('.miss-head')).toContainText('España · comunidades autónomas · Señalar');
    const pair = block.locator('.miss-items li');
    await expect(pair).toHaveCount(1);
    await expect(pair.locator('.mix-pair')).toContainText(asked);
    await expect(pair.locator('.mix-pair')).toContainText(name);
    await expect(pair.locator('small')).toHaveText('3 veces');
    await expect(block.getByRole('button', { name: 'Practicar las 2' })).toBeVisible();
  });

  test('is practised together, and leaves the list once it is told apart', async ({ page }) => {
    const now = Date.now();
    await seed(page, {
      stats: { 'loc:ES-HU': stat(0, 30, 3), 'loc:ES-TE': stat(0, 20, 2), 'loc:ES-CC': stat(2, 5, 4), 'loc:ES-BA': stat(1, 5, 2) },
      where: { 'ES-HU': 'r|ES|f', 'ES-TE': 'r|ES|f', 'ES-CC': 'r|ES|f', 'ES-BA': 'r|ES|f' },
      mix: { 'loc:ES-HU>ES-TE': [2, now - 30 * MIN], 'loc:ES-TE>ES-HU': [1, now - 20 * MIN], 'loc:ES-CC>ES-BA': [3, now - 50 * MIN] },
      sessions: [{ t: now - 10 * MIN, section: 'regions', mode: 'pin', label: 'España · provincias', total: 10, ok: 6, warn: 1, bad: 3, ms: 60000 }],
    });
    await open(page, '/progreso');
    const block = page.locator('.mix');
    // Cáceres has been got right twice in a row since it was taken for Badajoz: that pair is settled.
    const pair = block.locator('.miss-items li');
    await expect(pair).toHaveCount(1);
    await expect(pair.locator('.mix-pair')).toHaveText(/Huesca\s+Teruel/);
    await expect(pair.locator('small')).toHaveText('3 veces');
    await expect(block.locator('.tip-line').first()).toContainText('Una pareja que has tomado una por otra');

    await block.getByRole('button', { name: 'Practicar las 2' }).click();
    await expect(page.locator('.play-title strong')).toHaveText('Señalar', { timeout: 30_000 });
    await expect(page.locator('.hud-main')).toHaveText('1 / 2');
    expect(['Huesca', 'Teruel']).toContain(((await page.locator('.q-name').textContent()) ?? '').trim());
  });

  test('travels with the backup and goes with the progress', async ({ page }) => {
    const now = Date.now();
    await seed(page, {
      stats: { 'flag:SK': stat(0, 30, 3) },
      where: { SK: 'c', SI: 'c' },
      mix: { 'flag:SK>SI': [4, now - 30 * MIN], 'nope:x': [1, 1], 'flag:SK>SK': [2, 2] },
      sessions: [{ t: now - 10 * MIN, section: 'countries', mode: 'flag', label: 'Europa', total: 10, ok: 6, warn: 1, bad: 3, ms: 60000 }],
    });
    await open(page, '/progreso');
    await expect(page.locator('.mix .miss-head')).toContainText('Países · Banderas');
    await expect(page.locator('.mix .mix-pair')).toHaveText(/Eslovaquia\s+Eslovenia/);
    // What is not a mix-up was not read from storage.
    expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('regionle:v1') ?? '{}').state.mix))).toEqual(['flag:SK>SI']);

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar' }).click();
    const file = await (await download).path();
    const saved = JSON.parse(await (await import('node:fs/promises')).readFile(file, 'utf8'));
    expect(saved.mix).toEqual({ 'flag:SK>SI': [4, now - 30 * MIN] });
    expect(saved.goals).toEqual([]);

    await page.getByRole('button', { name: 'Borrar progreso' }).click();
    await page.getByRole('button', { name: 'Sí, borrar' }).click();
    await expect(page.locator('.mix')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1') ?? '{}').state.mix)).toEqual({});
  });
});
