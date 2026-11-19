/**
 * The lessons of "Aprender", to the taste of whoever takes them: how many new pieces each one brings and
 * the order they come in.
 */
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, restart, seed, start } from './helpers';

const COMMUNITIES = { section: 'regions', mode: 'learn', countries: ['ES'], levels: { ES: 'g1' } };
const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1') ?? '{}').state as { opts: Record<string, unknown> });
const kicker = (page: Page) => page.locator('.q-prompt .kicker');
const option = (page: Page, label: string) => page.locator('.options .opt', { has: page.locator('.opt-label', { hasText: new RegExp(`^${label}$`) }) });

/** The names of the new pieces of the lesson on screen, in the order they are shown. */
async function shown(page: Page, count: number): Promise<string[]> {
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    await expect(kicker(page)).toContainText(`${i + 1} de ${count}`);
    names.push(((await page.locator('.q-name').textContent()) ?? '').trim());
    if (i < count - 1) await page.getByRole('button', { name: 'Siguiente' }).click();
  }
  return names;
}

test.describe('lessons to the taste of the player', () => {
  test('bring five new pieces, corner by corner of the map, unless told otherwise', async ({ page }) => {
    await start(page, { ...COMMUNITIES, opts: OPTS });
    await expect(kicker(page)).toHaveText('Lección 1 · nueva 1 de 5');
    // The largest piece of the map, and the ones around it.
    const names = await shown(page, 5);
    expect(names[0]).toBe('Castilla y León');
    expect(names).toContain('Comunidad de Madrid');
    await expect(page.getByRole('button', { name: 'Empezar a practicar' })).toBeVisible();
  });

  test('are as long as asked and in the order asked, and the choice is kept', async ({ page }) => {
    await seed(page, { sel: { regions: ['ES'] }, mode: { regions: 'learn' } });
    await open(page, '/regiones');
    const size = option(page, 'Piezas por lección');
    const order = option(page, 'Orden');
    await expect(size.getByRole('radio', { name: '5', exact: true })).toBeChecked();
    await expect(size.locator('.opt-hint')).toContainText('unas 16 preguntas');
    await expect(order.getByRole('radio')).toHaveText(['Por zonas', 'Por tamaño', 'Alfabético']);
    await expect(order.getByRole('radio', { name: 'Por zonas' })).toBeChecked();

    await size.getByRole('radio', { name: '3', exact: true }).click();
    await expect(size.locator('.opt-hint')).toContainText('unas 12 preguntas');
    await order.getByRole('radio', { name: 'Alfabético' }).click();
    await expect(order.locator('.opt-hint')).toContainText('Por sus nombres');
    expect((await kept(page)).opts).toMatchObject({ lessonSize: 3, lessonOrder: 'abc' });

    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(kicker(page)).toHaveText('Lección 1 · nueva 1 de 3', { timeout: 30_000 });
    expect(await shown(page, 3)).toEqual(['Andalucía', 'Aragón', 'Asturias']);
    // The questions of a lesson of three: where each is, what each is called, and the three again.
    await page.getByRole('button', { name: 'Empezar a practicar' }).click();
    await expect(kicker(page)).toHaveText('Lección 1 · señala en el mapa');
  });

  test('come from the largest to the smallest when asked by size', async ({ page }) => {
    await start(page, { ...COMMUNITIES, opts: { ...OPTS, lessonSize: 3, lessonOrder: 'size' } });
    expect(await shown(page, 3)).toEqual(['Castilla y León', 'Andalucía', 'Castilla-La Mancha']);
    // Eight at a time, the map of nineteen takes three lessons.
    await restart(page, { ...COMMUNITIES, opts: { ...OPTS, lessonSize: 8, lessonOrder: 'size' } });
    await expect(kicker(page)).toHaveText('Lección 1 · nueva 1 de 8');
  });

  test('offer each map the orders it has: cities by their people, and no size for rivers and peaks', async ({ page }) => {
    await seed(page, { sel: { cities: ['ES'], physical: ['river', 'EU'] }, mode: { cities: 'learn', physical: 'learn' } });
    await open(page, '/ciudades');
    const order = option(page, 'Orden');
    await expect(order.getByRole('radio')).toHaveText(['Por zonas', 'Por habitantes', 'Alfabético']);
    // Cities come by size unless told otherwise.
    await expect(order.getByRole('radio', { name: 'Por habitantes' })).toBeChecked();
    await expect(order.locator('.opt-hint')).toHaveText('Primero las ciudades con más habitantes.');
    await order.getByRole('radio', { name: 'Por zonas' }).click();
    expect((await kept(page)).opts.lessonOrder).toBe('near');

    await open(page, '/fisica');
    await expect(option(page, 'Orden').getByRole('radio')).toHaveText(['Por zonas', 'Alfabético']);
    await expect(option(page, 'Orden').getByRole('radio', { name: 'Por zonas' })).toBeChecked();
    // A game that is not made of lessons has neither option.
    await page.getByRole('button', { name: 'Señalar' }).click();
    await expect(option(page, 'Piezas por lección')).toHaveCount(0);
    await expect(option(page, 'Orden')).toHaveCount(0);
  });
});
