import { expect, test, type Page } from '@playwright/test';
import { start, type } from './helpers';

/** Noon of Wednesday 18 November 2026 in Madrid, where the browser of these tests is. */
const NOW = new Date('2026-11-18T12:00:00+01:00');
const DAY = 24 * 3_600_000;
const ago = (days: number, minutes = 0): number => NOW.getTime() - days * DAY - minutes * 60_000;

const COMMUNITIES = { section: 'regions', countries: ['ES'], levels: { ES: 'g1' } };
const ANDALUSIA = 'La grande de abajo: ocho provincias, de Huelva a Almería.';

/** What the game has kept in the browser. */
const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { notes: Record<string, string> });
/** The piece of the list of Explore with that name. */
const listed = (page: Page, name: string) => page.locator('.index li', { has: page.getByText(name, { exact: true }) });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test.describe('notes of your own', () => {
  test('are written on the card of a piece, kept, and marked in the list', async ({ page }) => {
    await start(page, { ...COMMUNITIES, mode: 'explore' });
    await listed(page, 'Andalucía').getByRole('button').click();
    const box = page.getByLabel('Tus apuntes');
    await expect(box).toHaveValue('');
    await expect(box).toHaveAttribute('placeholder', /Un truco para acordarte/);
    await expect(listed(page, 'Andalucía').locator('.noted')).toHaveCount(0);

    // What is typed stays in the box: "?" opens the list of keys anywhere else.
    await box.click();
    await page.keyboard.type('  ¿La grande   de abajo?  ');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // Leaving the box writes it down, on one line and without the spaces at its ends.
    await page.locator('.card-item .q-name').click();
    await expect(box).toHaveValue('¿La grande de abajo?');
    await expect.poll(async () => (await kept(page)).notes).toEqual({ 'ES-AN': '¿La grande de abajo?' });
    await expect(listed(page, 'Andalucía').locator('.noted')).toHaveCount(1);

    // Each piece has its own, and it is there when its card is opened again.
    await listed(page, 'Aragón').getByRole('button').click();
    await expect(page.locator('.card-item .q-name')).toContainText('Aragón');
    await expect(box).toHaveValue('');
    await listed(page, 'Andalucía').getByRole('button').click();
    await expect(box).toHaveValue('¿La grande de abajo?');
    await page.reload();
    await listed(page, 'Andalucía').getByRole('button').click();
    await expect(box).toHaveValue('¿La grande de abajo?');

    // Emptied, it is gone.
    await box.fill('');
    await page.locator('.card-item .q-name').click();
    await expect.poll(async () => (await kept(page)).notes).toEqual({});
    await expect(listed(page, 'Andalucía').locator('.noted')).toHaveCount(0);
  });

  test('show after an answer, where they can be changed without the game moving on', async ({ page }) => {
    await start(page, { ...COMMUNITIES, mode: 'identify', only: ['ES-AN', 'ES-CL'] });
    await page.evaluate((text) => {
      const saved = JSON.parse(localStorage.getItem('regionle:v1')!);
      saved.state.notes = { 'ES-AN': text };
      localStorage.setItem('regionle:v1', JSON.stringify(saved));
    }, ANDALUSIA);
    await page.reload();
    await expect(page.locator('.map-svg path.st-target[data-id]')).toHaveCount(1, { timeout: 30_000 });

    for (let n = 1; n <= 2; n++) {
      await expect(page.locator('.hud-main')).toHaveText(`${n} / 2`);
      const id = (await page.locator('.map-svg path.st-target[data-id]').getAttribute('data-id'))!;
      // Nothing of the note is said while the question stands.
      await expect(page.locator('.note, .note-add')).toHaveCount(0);
      await type(page, id === 'ES-AN' ? 'Andalucía' : 'Castilla y León');
      const verdict = page.locator('.verdict');
      await expect(verdict).toBeVisible();

      if (id === 'ES-AN') {
        await expect(verdict.locator('.note')).toHaveText(`Tu apunte: ${ANDALUSIA}`);
        // Escape leaves it as it was.
        await verdict.getByRole('button', { name: 'Cambiar el apunte' }).click();
        await expect(page.getByLabel('Tu apunte')).toHaveValue(ANDALUSIA);
        await expect(page.getByLabel('Tu apunte')).toBeFocused();
        await page.keyboard.type(' Y más.');
        await page.keyboard.press('Escape');
        await expect(verdict.locator('.note')).toHaveText(`Tu apunte: ${ANDALUSIA}`);
        expect((await kept(page)).notes['ES-AN']).toBe(ANDALUSIA);
      } else {
        // A piece without one offers to write it. Enter writes it down, and is not the Enter that moves on.
        await expect(verdict.locator('.note')).toHaveCount(0);
        await verdict.getByRole('button', { name: 'Añadir un apunte' }).click();
        await expect(page.getByLabel('Tu apunte')).toBeFocused();
        await page.keyboard.type('La más grande de todas');
        await page.keyboard.press('Enter');
        await expect(verdict.locator('.note')).toHaveText('Tu apunte: La más grande de todas');
        await expect(page.locator('.hud-main')).toHaveText(`${n} / 2`);
        await expect.poll(async () => (await kept(page)).notes['ES-CL']).toBe('La más grande de todas');
        // Changed with the button, too.
        await verdict.getByRole('button', { name: 'Cambiar el apunte' }).click();
        await page.getByLabel('Tu apunte').fill('La más grande: nueve provincias');
        await verdict.getByRole('button', { name: 'Guardar' }).click();
        await expect(verdict.locator('.note')).toHaveText('Tu apunte: La más grande: nueve provincias');
      }
      await page.getByRole('button', { name: /Siguiente|Ver resultados/ }).click();
    }
    await expect(page.locator('.results')).toBeVisible();
    expect((await kept(page)).notes).toEqual({ 'ES-AN': ANDALUSIA, 'ES-CL': 'La más grande: nueve provincias' });
  });

  test('are on the back of a flashcard, not on its face', async ({ page }) => {
    await start(page, { ...COMMUNITIES, mode: 'cards', only: ['ES-AN'] });
    await page.evaluate((text) => {
      const saved = JSON.parse(localStorage.getItem('regionle:v1')!);
      saved.state.notes = { 'ES-AN': text };
      localStorage.setItem('regionle:v1', JSON.stringify(saved));
    }, ANDALUSIA);
    await page.reload();
    await expect(page.locator('.fcard')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.play-body')).not.toContainText('ocho provincias');
    await page.getByRole('button', { name: 'Ver la respuesta' }).click();
    await expect(page.locator('.fcard-back .note')).toHaveText(`Tu apunte: ${ANDALUSIA}`);
  });
});

test.describe('the history of a piece', () => {
  test('is on its card: how each question has gone, when it comes back and what it is taken for', async ({ page }) => {
    await start(page, { ...COMMUNITIES, mode: 'explore' });
    await page.evaluate(
      ({ stats, mix }) => {
        const saved = JSON.parse(localStorage.getItem('regionle:v1')!);
        Object.assign(saved.state, { stats, mix, where: { 'ES-AN': 'r|ES|g1', 'ES-AR': 'r|ES|g1' } });
        localStorage.setItem('regionle:v1', JSON.stringify(saved));
      },
      {
        stats: {
          // Placed seven times, right twice running by now, two days ago: learnt, back in a day.
          'loc:ES-AN': [7, 5, 2, ago(2)],
          // Named three times and missed a minute ago: back within minutes.
          'name:ES-AN': [3, 2, 0, ago(0, 1)],
          // Its capital, learnt a month ago: due.
          'cap:ES-AN': [4, 4, 3, ago(30)],
          'loc:ES-AR': [1, 1, 1, ago(1)],
        },
        mix: { 'loc:ES-AN>ES-EX': [3, ago(1)], 'loc:ES-EX>ES-AN': [1, ago(1)], 'name:ES-AN>ES-MC': [1, ago(0, 1)] },
      },
    );
    await page.reload();
    await listed(page, 'Andalucía').getByRole('button').click();

    const rows = page.locator('.history-list li');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toHaveText(/^En el mapa\s*Lo sabes\s*7 veces, 5 a la primera · la última vez, hace 2 días · vuelve mañana$/);
    await expect(rows.nth(1)).toHaveText(/^Su nombre\s*Aprendiendo\s*3 veces, 2 a la primera · la última vez, hoy · vuelve hoy$/);
    await expect(rows.nth(2)).toHaveText(/^Su capital\s*Toca repaso\s*4 veces, 4 a la primera · la última vez, hace 30 días$/);
    await expect(page.locator('.history-mix')).toHaveText('Se te confunde con Extremadura (4 veces) y Región de Murcia (1 vez).');

    // A piece asked once, and one never asked.
    await listed(page, 'Aragón').getByRole('button').click();
    await expect(rows).toHaveText([/^En el mapa\s*Aprendiendo\s*1 vez, 1 a la primera · la última vez, ayer · vuelve hoy$/]);
    await expect(page.locator('.history-mix')).toHaveCount(0);
    await listed(page, 'Galicia').getByRole('button').click();
    await expect(rows).toHaveCount(0);
    await expect(page.locator('.history')).toContainText('Todavía no ha salido en ninguna pregunta.');
  });

  test('is said in English', async ({ page }) => {
    await start(page, { ...COMMUNITIES, mode: 'explore' });
    await page.evaluate((t) => {
      const saved = JSON.parse(localStorage.getItem('regionle:v1')!);
      Object.assign(saved.state, { lang: 'en', stats: { 'loc:ES-AN': [7, 5, 2, t] }, mix: { 'loc:ES-AN>ES-EX': [1, t] } });
      localStorage.setItem('regionle:v1', JSON.stringify(saved));
    }, ago(2));
    await page.reload();
    await listed(page, 'Andalusia').getByRole('button').click();
    await expect(page.locator('.history-list li')).toHaveText([/^On the map\s*You know it\s*7 times, 5 right first time · last asked 2 days ago · back tomorrow$/]);
    await expect(page.locator('.history-mix')).toHaveText('You mix it up with Extremadura (once).');
    await expect(page.getByLabel('Your notes')).toHaveAttribute('placeholder', /A trick to remember it by/);
  });
});
