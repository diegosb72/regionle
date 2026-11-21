/**
 * What the tests of the challenges with a date share (retos.spec.ts, fechas.spec.ts): where their card and
 * their game say things, and how a game is played to its end without knowing the answers.
 */
import { expect, type Page } from '@playwright/test';

/** The card of the first page that holds them. */
export const card = (page: Page) => page.locator('.more');
export const hud = (page: Page) => page.locator('.hud-main');
/** Under the name of the game, what it is: "Reto de la semana · Mundo". */
export const subtitle = (page: Page) => page.locator('.play-title > span');
export const title = (page: Page) => page.locator('.play-title > strong');
export const note = (page: Page) => page.locator('.results-note');
export const percent = (page: Page) => page.locator('.results .donut-text strong');

/** Gives up the question on screen, says what the answer was, and moves on. */
export async function giveUp(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'No lo sé' }).click();
  const answer = (await page.locator('.verdict-head').textContent()) ?? '';
  await page.getByRole('button', { name: 'Siguiente' }).click();
  return answer;
}

/**
 * Answers the question on screen any way it can, without knowing the answer: the options in turn where there
 * are options, and giving up where the answer goes on the map. Then moves on to the next.
 *
 * All of it inside the page, in one go: an answer right at the first go moves on by itself in about a second,
 * and a test that looked from outside, one step at a time, could find the next question where it expected the
 * verdict of this one on a machine that stopped for a moment.
 */
export async function answerAny(page: Page): Promise<void> {
  const how = await page.evaluate(async () => {
    const pause = (ms: number) => new Promise((go) => setTimeout(go, ms));
    const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => !b.disabled && (b.textContent ?? '').trim().startsWith(text));
    // A wrong option may leave another try: the verdict comes when the question is settled.
    for (let tries = 0; tries < 40 && !document.querySelector('.verdict'); tries++) {
      (document.querySelector<HTMLButtonElement>('.choices .choice:not(:disabled)') ?? button('No lo sé'))?.click();
      await pause(100);
    }
    const verdict = document.querySelector('.verdict');
    if (!verdict) return 'unanswered';
    // An answer right at the first go moves on by itself.
    if (verdict.classList.contains('verdict-ok')) return 'right';
    button('Siguiente')?.click();
    return 'settled';
  });
  expect(how).not.toBe('unanswered');
}

/** Plays `total` questions to the end from the one on screen (`from`), the first `trying` of them for real, and stops at the results. */
export async function finish(page: Page, total: number, trying = 0, from = 1): Promise<void> {
  for (let n = from; n <= total; n++) {
    await expect(hud(page)).toHaveText(`${n} / ${total}`);
    if (n <= trying) await answerAny(page);
    else await giveUp(page);
  }
  // What was missed is asked again: the challenge is whole by now, and the game can be ended there.
  await expect(page.locator('.results, .q-round').first()).toBeVisible();
  if (await page.locator('.q-round').count()) await page.getByRole('button', { name: 'Terminar' }).click();
  await expect(page.locator('.results')).toBeVisible();
}

/**
 * Leaves the game for the first page and opens it again as another player would find it: with other options
 * of their own, and whatever else is changed in what the browser keeps.
 */
export async function asAnother(page: Page, opts: Record<string, unknown>, patch: Record<string, unknown> = {}): Promise<void> {
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(card(page)).toBeVisible();
  // Changed while the first page is still, which writes nothing, and read again at once.
  await page.evaluate(
    ([o, p]) => {
      const saved = JSON.parse(localStorage.getItem('regionle:v1')!) as { state: Record<string, unknown> };
      saved.state = { ...saved.state, ...p, opts: { ...(saved.state.opts as Record<string, unknown>), ...o }, game: null };
      localStorage.setItem('regionle:v1', JSON.stringify(saved));
    },
    [opts, patch] as const,
  );
  await page.reload();
  await expect(card(page)).toBeVisible();
}
