/**
 * «Cómo se juega»: the rules of each game, shown by themselves the first time a game is opened and at hand
 * afterwards, in the game and where it is chosen. The other tests play as someone who has turned that off
 * (helpers.ts): these turn it on.
 */
import { expect, test, type Page } from '@playwright/test';
import { OPTS, PIN_SPAIN, open, play, restart, seed } from './helpers';

const panel = (page: Page) => page.getByRole('dialog', { name: 'Cómo se juega' });
const button = (page: Page) => page.getByRole('button', { name: 'Cómo se juega' });
const clock = (page: Page) => page.locator('.hud-chip[title="Tiempo"]');
const kept = (page: Page): Promise<Record<string, unknown>> => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1') ?? '{}').state);
const IDENTIFY = { ...PIN_SPAIN, mode: 'identify' };

/** A game opened by someone who is shown the rules of what is new. */
async function first(page: Page, game: Record<string, unknown>, state: Record<string, unknown> = {}): Promise<void> {
  await seed(page, { helpAuto: true, ...state, game });
  await page.goto('./#/jugar');
  await expect(page.locator('.play-loading')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('.play-top')).toBeVisible();
}

test.describe('how a game is played', () => {
  test('is shown the first time the game is opened, with its clock stopped, and not again', async ({ page }) => {
    await first(page, PIN_SPAIN);
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveText('Señalar');
    await expect(panel(page).locator('.help-lead')).toHaveText('Te damos un nombre y lo buscas en el mapa.');
    await expect(panel(page).locator('.help-steps li')).toHaveCount(3);
    await expect(panel(page).locator('.help-steps li').first()).toHaveText('Aparece un nombre: búscalo en el mapa y haz clic encima.');
    await expect(panel(page).locator('.help-more dt')).toHaveText(['Cómo cuenta', 'Las ayudas', 'Un consejo']);
    await expect(panel(page)).toContainText('El tiempo de la partida está parado mientras lees.');
    // Intro starts the game: the keyboard is on the button that goes on.
    const go = panel(page).getByRole('button', { name: 'Empezar' });
    await expect(go).toBeFocused();

    // The clock of the game does not run under the panel.
    await expect(page.locator('.map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    await expect(clock(page)).toHaveText('0:00');
    await page.waitForTimeout(1700);
    await expect(clock(page)).toHaveText('0:00');
    expect((await kept(page)).helpSeen).toEqual(['pin']);

    await page.keyboard.press('Enter');
    await expect(panel(page)).toHaveCount(0);
    await expect(clock(page)).not.toHaveText('0:00', { timeout: 5000 });

    // The same game again: it has been shown.
    await page.reload();
    await expect(page.locator('.q-name')).toBeVisible({ timeout: 30_000 });
    await expect(panel(page)).toHaveCount(0);
    // Another game is new, and is shown too.
    await restart(page, { section: 'regions', mode: 'identify', countries: ['ES'], levels: { ES: 'g1' } });
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveText('Identificar');
    expect((await kept(page)).helpSeen).toEqual(['pin', 'identify']);
  });

  test('is not shown for a game that is among the latest played, nor for one with no rules to get wrong', async ({ page }) => {
    const played = { t: Date.now() - 86_400_000, section: 'regions', mode: 'pin', label: 'España · comunidades autónomas', total: 10, ok: 8, warn: 1, bad: 1, ms: 60_000 };
    await first(page, PIN_SPAIN, { sessions: [played] });
    await expect(page.locator('.q-name')).toBeVisible({ timeout: 30_000 });
    await expect(panel(page)).toHaveCount(0);
    expect((await kept(page)).helpSeen ?? []).toEqual([]);
    // To explore there is nothing to be told beforehand; its rules are a button away all the same.
    await restart(page, { section: 'regions', mode: 'explore', countries: ['ES'], levels: { ES: 'g1' } });
    await expect(page.locator('.map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    await expect(panel(page)).toHaveCount(0);
    await button(page).click();
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveText('Explorar');
  });

  test('is a button away during a game, and the clock waits meanwhile', async ({ page }) => {
    await play(page);
    await expect(panel(page)).toHaveCount(0);
    await expect(clock(page)).not.toHaveText('0:00', { timeout: 5000 });
    await button(page).click();
    await expect(panel(page)).toBeVisible();
    // Asked for, it is not the first time: nothing about being shown again, and the way on is back to the game.
    await expect(panel(page).getByRole('button', { name: 'Seguir jugando' })).toBeFocused();
    await expect(panel(page).locator('.help-auto')).toHaveCount(0);
    const stopped = await clock(page).textContent();
    await page.waitForTimeout(1700);
    await expect(clock(page)).toHaveText(stopped!);
    // Escape closes it, and the keyboard goes back to the button.
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await expect(button(page)).toBeFocused();
    await expect(clock(page)).not.toHaveText(stopped!, { timeout: 5000 });
    // A key of the game pressed in the panel is not one for the game: the question is still the first.
    await button(page).click();
    await page.keyboard.press('Enter');
    await expect(panel(page)).toHaveCount(0);
    await expect(page.locator('.q')).toContainText('Te quedan 3 intentos');
    // Having asked for it is not having been shown it.
    expect((await kept(page)).helpSeen ?? []).toEqual([]);
  });

  test('can be told not to open by itself, from the panel and from the preferences', async ({ page }) => {
    await first(page, PIN_SPAIN);
    await expect(panel(page)).toBeVisible();
    await expect(panel(page)).toContainText('Para volver a verlo, pulsa el signo de interrogación de la parte de arriba.');
    await panel(page).getByLabel('No enseñármelo al estrenar un juego').check();
    await panel(page).getByRole('button', { name: 'Empezar' }).click();
    expect((await kept(page)).helpAuto).toBe(false);
    await restart(page, { section: 'regions', mode: 'identify', countries: ['ES'], levels: { ES: 'g1' } });
    await expect(page.locator('.q-ask')).toBeVisible({ timeout: 30_000 });
    await expect(panel(page)).toHaveCount(0);

    // The preferences at the foot of the page turn it back on.
    await open(page, '/');
    const toggle = page.locator('.foot-prefs label.toggle', { hasText: 'Enseñar cómo se juega' });
    await expect(toggle).toContainText('La primera vez que abres un juego, antes de la primera pregunta.');
    await expect(toggle.locator('input')).not.toBeChecked();
    await toggle.click();
    await expect(toggle.locator('input')).toBeChecked();
    expect((await kept(page)).helpAuto).toBe(true);
    // Back to the game that was opened with it off: it was not shown then, so it is now.
    await page.goto('./#/jugar');
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveText('Identificar');
    expect((await kept(page)).helpSeen).toEqual(['pin', 'identify']);
  });

  test('is told where a game is chosen, for the game that is chosen', async ({ page }) => {
    await seed(page, {});
    await open(page, '/regiones');
    const link = page.locator('.mode-about').getByRole('button', { name: 'Cómo se juega' });
    await link.click();
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveText('Señalar');
    // No game is being played: there is no clock to speak of, and the way on is just to close.
    await expect(panel(page)).not.toContainText('El tiempo de la partida');
    await panel(page).getByRole('button', { name: 'Entendido' }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(link).toBeFocused();

    await page.getByRole('button', { name: 'Cadena de vecinos' }).click();
    await link.click();
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveText('Cadena de vecinos');
    await expect(panel(page).locator('.help-steps li')).toHaveCount(4);
    await expect(panel(page)).toContainText('«Me planto»');
  });

  test('is written in English when the game is', async ({ page }) => {
    await first(page, PIN_SPAIN, { lang: 'en' });
    const english = page.getByRole('dialog', { name: 'How to play' });
    await expect(english.getByRole('heading', { level: 3 })).toHaveText('Pin it');
    await expect(english.locator('.help-steps li').first()).toHaveText('A name comes up: find it on the map and click it.');
    await expect(english.locator('.help-more dt')).toHaveText(['How it counts', 'The help', 'A tip']);
    await english.getByRole('button', { name: 'Start' }).click();
    await expect(english).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'How to play' })).toBeVisible();
  });

  test('is told for the games without a map too', async ({ page }) => {
    await first(page, { section: 'pops', mode: 'truefalse', countries: ['ES', 'FR', 'PT', 'IT', 'DE', 'GB'], levels: {}, opts: OPTS, nonce: 1 });
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveText('Verdadero o falso');
    await expect(panel(page)).toContainText('con las teclas V y F');
    // V is a key of this game: pressed in the panel, it answers nothing.
    await expect(page.locator('.tf-btn')).toHaveCount(2);
    await page.keyboard.press('v');
    await page.keyboard.press('f');
    await expect(page.locator('.tf-btn:disabled')).toHaveCount(0);
    await panel(page).getByRole('button', { name: 'Empezar' }).click();
    await expect(panel(page)).toHaveCount(0);
    await page.keyboard.press('v');
    await expect(page.locator('.tf-btn.picked')).toHaveCount(1);
  });

  test('a key pressed just as the panel closes is already one for the game', async ({ page }) => {
    await first(page, { section: 'pops', mode: 'truefalse', countries: ['ES', 'FR', 'PT', 'IT', 'DE', 'GB'], levels: {}, opts: OPTS, nonce: 1 });
    await expect(panel(page)).toBeVisible();
    await expect(page.locator('.tf-btn')).toHaveCount(2);
    // While the panel is open, a key that comes from one of its buttons stays in it.
    await page.evaluate(() => document.querySelector('dialog.help-dlg .btn-primary')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true })));
    await page.waitForTimeout(150);
    await expect(page.locator('.tf-btn:disabled')).toHaveCount(0);
    // The panel closes, and for a moment it is still in the page with the keyboard on the button that closed
    // it: a key pressed right then (someone quick, or a test) answers the question.
    const still = await page.evaluate(() => {
      const dialog = document.querySelector<HTMLDialogElement>('dialog.help-dlg')!;
      const button = dialog.querySelector('.btn-primary')!;
      dialog.close();
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', bubbles: true }));
      return document.contains(dialog);
    });
    expect(still).toBe(true);
    await expect(page.locator('.tf-btn.tf-true.picked')).toHaveCount(1);
    await expect(page.locator('dialog.help-dlg')).toHaveCount(0);
  });

  test('keeps the voice of the game quiet while it is read', async ({ page }) => {
    // A voice that says nothing and writes down what it was asked to say.
    await page.addInitScript(() => {
      const w = window as unknown as { __said: string[] };
      w.__said = [];
      window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => void w.__said.push(u.text);
      window.speechSynthesis.cancel = () => {};
    });
    const said = () => page.evaluate(() => (window as unknown as { __said: string[] }).__said);
    await first(page, { ...PIN_SPAIN, mode: 'listen' });
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveText('Oye y señala');
    await expect(page.locator('.map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(600);
    expect(await said()).toEqual([]);
    // Put away, the first name is said: it had been waiting.
    await panel(page).getByRole('button', { name: 'Empezar' }).click();
    await expect.poll(said).toHaveLength(1);
    // Read again in the middle of a question, the name is said once more on the way back.
    await button(page).click();
    await expect(panel(page)).toBeVisible();
    expect(await said()).toHaveLength(1);
    await page.keyboard.press('Escape');
    await expect.poll(said).toHaveLength(2);
    expect((await said())[1]).toBe((await said())[0]);
  });

  test('is not offered in the daily challenge, which says what each test is on its own screen', async ({ page }) => {
    await seed(page, { helpAuto: true });
    await open(page, '/reto');
    await page.getByRole('button', { name: /^Empezar/ }).first().click();
    await expect(page.locator('.play-top')).toBeVisible({ timeout: 30_000 });
    await expect(panel(page)).toHaveCount(0);
    await expect(button(page)).toHaveCount(0);
  });

  test('fits on a phone, where the title of the game is the way to it @movil', async ({ page }) => {
    await first(page, IDENTIFY);
    await expect(panel(page)).toBeVisible();
    // The way on is in sight without scrolling, however long the rules are.
    const go = panel(page).getByRole('button', { name: 'Empezar' });
    await expect(go).toBeInViewport({ ratio: 1 });
    const box = (await panel(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await go.tap();
    await expect(panel(page)).toHaveCount(0);

    // No button of its own in the header: the name of the game is not cut to make room for one.
    await expect(page.locator('.hud .play-help')).toBeHidden();
    const title = page.locator('.play-title strong');
    expect(await title.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await button(page).tap();
    await expect(panel(page).getByRole('button', { name: 'Seguir jugando' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
