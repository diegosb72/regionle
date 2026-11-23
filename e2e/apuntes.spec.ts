import { expect, test, type Page } from '@playwright/test';
import { start, type } from './helpers';

// The clock of these tests is set by hand, and so is where it is read: their days are Madrid's, whatever
// E2E_ZONE says (playwright.config.ts).
test.use({ timezoneId: 'Europe/Madrid' });

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

/** The clock of the page stands still at noon: what is dated is dated then, and the timers run as ever. */
const noon = async ({ page }: { page: Page }) => {
  await page.clock.setFixedTime(NOW);
};

/**
 * The clock of the page held by hand, once a game is on screen: nothing that waits for a moment happens
 * until the test lets that moment go by. A game moves on by itself a second after an answer that was right
 * at the first go, and a test that looked at what is in between could not be sure of getting there first.
 */
async function hold(page: Page): Promise<void> {
  await expect(page.locator('.map-svg path.st-target[data-id]')).toHaveCount(1, { timeout: 30_000 });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 5000));
}
const asked = async (page: Page): Promise<string> => (await page.locator('.map-svg path.st-target[data-id]').getAttribute('data-id'))!;
const NAMES: Record<string, string> = { 'ES-AN': 'Andalucía', 'ES-CL': 'Castilla y León', 'ES-AR': 'Aragón' };

test.describe('notes of your own', () => {
  test.beforeEach(noon);

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

test.describe('a note after an answer', () => {
  test('show after an answer, where they can be changed without the game moving on', async ({ page }) => {
    await page.clock.install({ time: NOW });
    await start(page, { ...COMMUNITIES, mode: 'identify', only: ['ES-AN', 'ES-CL'] });
    await page.evaluate((text) => {
      const saved = JSON.parse(localStorage.getItem('regionle:v1')!);
      saved.state.notes = { 'ES-AN': text };
      localStorage.setItem('regionle:v1', JSON.stringify(saved));
    }, ANDALUSIA);
    await page.reload();
    await hold(page);

    for (let n = 1; n <= 2; n++) {
      await expect(page.locator('.hud-main')).toHaveText(`${n} / 2`);
      const id = await asked(page);
      // Nothing of the note is said while the question stands.
      await expect(page.locator('.note, .note-add')).toHaveCount(0);
      await type(page, NAMES[id]);
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

  test('holds a game that moves on by itself, which goes on a moment after the note is put away', async ({ page }) => {
    await page.clock.install({ time: NOW });
    await start(page, { ...COMMUNITIES, mode: 'identify', only: ['ES-AN', 'ES-CL', 'ES-AR'] });
    await hold(page);
    const hud = page.locator('.hud-main');
    const verdict = page.locator('.verdict');
    const time = page.locator('.hud-chip[title="Tiempo"]');

    // Right at the first go: the answer is on screen for a second, and the next question takes its place.
    await type(page, NAMES[await asked(page)]);
    await expect(verdict).toHaveClass(/verdict-ok/);
    await page.clock.runFor(1000);
    await expect(verdict).toBeVisible();
    await expect(hud).toHaveText('1 / 3');
    await page.clock.runFor(200);
    await expect(hud).toHaveText('2 / 3');
    await expect(verdict).toHaveCount(0);

    // With a note begun in that second, the game waits for as long as the note takes: a minute, here.
    const id = await asked(page);
    await type(page, NAMES[id]);
    await page.clock.runFor(900);
    await verdict.getByRole('button', { name: 'Añadir un apunte' }).click();
    const before = await time.textContent();
    await page.clock.runFor(60_000);
    await expect(page.getByLabel('Tu apunte')).toBeFocused();
    await expect(hud).toHaveText('2 / 3');
    // Nor does the time of the game run meanwhile.
    await expect(time).toHaveText(before!);
    await page.keyboard.type('Me la sé');
    await page.keyboard.press('Enter');
    await expect(verdict.locator('.note')).toHaveText('Tu apunte: Me la sé');

    // Once it is written, the second starts over.
    await page.clock.runFor(1000);
    await expect(verdict.locator('.note')).toHaveText('Tu apunte: Me la sé');
    await expect(hud).toHaveText('2 / 3');
    await page.clock.runFor(200);
    await expect(hud).toHaveText('3 / 3');
    expect((await kept(page)).notes).toEqual({ [id]: 'Me la sé' });

    // A note that is left as it was holds the game no longer than it is open.
    await type(page, NAMES[await asked(page)]);
    await verdict.getByRole('button', { name: 'Añadir un apunte' }).click();
    await page.clock.runFor(5000);
    await expect(page.getByLabel('Tu apunte')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.results')).toHaveCount(0);
    await page.clock.runFor(1200);
    await expect(page.locator('.results')).toBeVisible();
  });

  /**
   * With the answer of the first of two questions on screen, right at the first go: a note begun there holds
   * the game for as long as it is open, and the game goes on by itself `ms` after it is written.
   */
  async function waitsForTheNote(page: Page, id: string, ms: number): Promise<void> {
    const verdict = page.locator('.verdict');
    const hud = page.locator('.hud-main');
    await expect(verdict).toHaveClass(/verdict-ok/);
    await verdict.getByRole('button', { name: 'Añadir un apunte' }).click();
    await page.clock.runFor(30_000);
    await expect(page.getByLabel('Tu apunte')).toBeFocused();
    await expect(hud).toHaveText('1 / 2');
    await page.keyboard.type('Para acordarme');
    await page.keyboard.press('Enter');
    await expect(verdict.locator('.note')).toHaveText('Tu apunte: Para acordarme');
    await page.clock.runFor(ms - 100);
    await expect(hud).toHaveText('1 / 2');
    await page.clock.runFor(200);
    await expect(hud).toHaveText('2 / 2');
    expect((await kept(page)).notes).toEqual({ [id]: 'Para acordarme' });
  }

  test('holds the game of placing blind after a click that fell inside', async ({ page }) => {
    await page.clock.install({ time: NOW });
    await start(page, { ...COMMUNITIES, mode: 'blind', only: ['ES-CL', 'ES-AN'] });
    await expect(page.locator('.q-name')).toHaveText(/\S/);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 5000));
    const hit = ((await page.locator('.q-name').textContent()) ?? '').trim() === 'Castilla y León' ? 'ES-CL' : 'ES-AN';
    const box = (await page.locator(`.map-svg [data-id="${hit}"]`).first().boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await waitsForTheNote(page, hit, 1300);
  });

  test('holds the game of bearings after the right one', async ({ page }) => {
    await page.clock.install({ time: NOW });
    await start(page, { section: 'countries', countries: ['PT', 'JP'], mode: 'bearing', opts: { bearingAsk: 'dir' } });
    await expect(page.locator('.q-name')).toHaveText(/\S/);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 5000));
    // Japan is east of Portugal, and Portugal west of Japan.
    const japan = ((await page.locator('.q-name').textContent()) ?? '').trim() === 'Japón';
    await page.locator('.rose').getByRole('button', { name: japan ? 'este' : 'oeste', exact: true }).click();
    await waitsForTheNote(page, japan ? 'JP' : 'PT', 2200);
  });
});

test.describe('the history of a piece', () => {
  test.beforeEach(noon);

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
