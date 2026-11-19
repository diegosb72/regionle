import { expect, test, type Locator } from '@playwright/test';
import { OPTS, open, seed, start } from './helpers';

const CAPITALS = { section: 'regions', mode: 'capital', countries: ['ES'], levels: { ES: 'g1' }, opts: { answer: 'choice' } };

/** What a link that reports a mistake opens: the title and the text of a new issue in the repository. */
async function issueOf(link: Locator): Promise<{ title: string; body: string }> {
  const url = new URL((await link.getAttribute('href'))!);
  expect(url.origin + url.pathname).toBe('https://github.com/diegosb72/regionle/issues/new');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
  return { title: url.searchParams.get('title')!, body: url.searchParams.get('body')! };
}

test.describe('telling of a mistake', () => {
  test('is a link under every answer, filled in with the piece, the map, the game and the version', async ({ page }) => {
    await start(page, CAPITALS);
    await expect(page.locator('.q-name')).toHaveText('Navarra');
    // No answer yet: nothing to report on.
    await expect(page.getByRole('link', { name: 'Avisar de un error' })).toHaveCount(0);
    await page.keyboard.press('1');
    const link = page.locator('.verdict').getByRole('link', { name: 'Avisar de un error' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('title', '¿Algo de Navarra está mal? Dilo en GitHub: el aviso se abre ya rellenado.');
    const issue = await issueOf(link);
    expect(issue.title).toMatch(/^Error en los datos: Navarra \(ES-[A-Z]+\)$/);
    const [ask, facts] = issue.body.split('\n---\n');
    expect(ask).toContain('**Qué está mal**');
    expect(facts.split('\n')).toEqual([expect.stringMatching(/^Pieza: Navarra · `ES-[A-Z]+` · comunidad autónoma \(ES\)$/), 'Mapa: `regions` · ES · ES:g1', 'Juego: `capital`', expect.stringMatching(/^Versión: \d+\.\d+\.\d+ · idioma: es$/)]);
    // It comes last, after the places to read more.
    await expect(page.locator('.verdict .links a')).toHaveText(['Wikipedia', 'Mapa', 'Vídeos', 'Avisar de un error']);

    // The list of results, with a row for each piece, does without it.
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-title')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Avisar de un error' })).toHaveCount(0);
  });

  test('is there too when a piece is looked up on the map, and on the page about the game', async ({ page }) => {
    await start(page, { ...CAPITALS, mode: 'explore' });
    await page.locator('.map-svg [data-id]').first().dispatchEvent('click');
    const link = page.getByRole('link', { name: 'Avisar de un error' });
    await expect(link).toBeVisible();
    const issue = await issueOf(link);
    expect(issue.title).toMatch(/^Error en los datos: .+ \(ES-[A-Z]+\)$/);
    expect(issue.body).toContain('Juego: `explore`');

    await open(page, '/acerca');
    const general = page.locator('.about-report').getByRole('link', { name: 'Avisar de un error' });
    const about = await issueOf(general);
    expect(about.title).toBe('Error en el juego: ');
    expect(about.body).not.toContain('Pieza');
    expect(about.body).toMatch(/Versión: \d+\.\d+\.\d+ · idioma: es$/);
    await expect(page.locator('.about-report')).toContainText('hace falta una cuenta');
  });

  test('is written in English for those who play in English', async ({ page }) => {
    await seed(page, { lang: 'en', game: { nonce: 1, ...CAPITALS, opts: { ...OPTS, answer: 'choice' } } });
    await page.goto('./#/jugar');
    await expect(page.locator('.play-loading')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('.q-name')).toHaveText('Navarre');
    await page.keyboard.press('1');
    const issue = await issueOf(page.locator('.verdict').getByRole('link', { name: 'Report a mistake' }));
    expect(issue.title).toMatch(/^Mistake in the data: Navarre \(ES-[A-Z]+\)$/);
    expect(issue.body).toContain('**What is wrong**');
    expect(issue.body).toMatch(/Version: \d+\.\d+\.\d+ · language: en$/);
  });
});
