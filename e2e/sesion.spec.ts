/**
 * The session of the day: over the review of the day, the first page proposes what to do today in the
 * order that helps most — what is due, what keeps being missed, a new lesson — and each step leads to the next.
 */
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, seed, type } from './helpers';

const DAY = 86_400_000;
const NAMES: Record<string, string> = { 'ES-AN': 'Andalucía', 'ES-AR': 'Aragón', 'ES-AS': 'Asturias', 'ES-GA': 'Galicia', 'ES-CL': 'Castilla y León' };
const idOf = (name: string): string => Object.keys(NAMES).find((id) => NAMES[id] === name)!;
const kicker = (page: Page) => page.locator('.q-prompt .kicker');
const plan = (page: Page) => page.locator('.day-plan');
const steps = (page: Page) => plan(page).locator('.day-step > span:not(.sr-only)');
const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1') ?? '{}').state as { dayPlan: { day: string; done: string[] }; recent: { left?: number }[] });
/** The day it is where the game is played, as the game writes it. */
const dayOf = (page: Page) => page.evaluate(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`);

/** Where Galicia is, learnt ten days ago and due again. */
const due = (now: number) => ({ stats: { 'loc:ES-GA': [3, 3, 2, now - 10 * DAY] }, where: { 'ES-GA': 'r|ES|g1' } });
/** The lessons of the communities of Spain, begun yesterday: three new pieces each, by their names. */
const lessons = (now: number) => ({ opts: { ...OPTS, lessonSize: 3, lessonOrder: 'abc' }, recent: [{ t: now - DAY, section: 'regions', mode: 'learn', countries: ['ES'], levels: { ES: 'g1' }, o: {}, ok: 10, total: 13, left: 17 }] });
/** All of it, and the name of Castilla y León missed twice a moment ago: a day with three things to do. */
function player(now = Date.now()): Record<string, unknown> {
  const d = due(now);
  return { ...lessons(now), stats: { ...d.stats, 'name:ES-CL': [3, 1, 1, now - 60_000] }, where: { ...d.where, 'ES-CL': 'r|ES|g1' } };
}

/** Takes the lesson on screen to its end without a miss: the three new pieces, and then every question about them. */
async function learn(page: Page): Promise<void> {
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Empezar a practicar' }).click();
  for (let i = 0; i < 40; i++) {
    const text = (await kicker(page).textContent()) ?? '';
    if (!text.includes(' · ')) break;
    if (text.includes('identifica')) {
      const name = NAMES[(await page.locator('.map-svg path[data-id].st-target').first().getAttribute('data-id'))!];
      // The first time a name is asked it is chosen among a few; after that it is written.
      if (await page.locator('.answer-input').count()) await type(page, name);
      else await page.locator('.choices .choice', { hasText: new RegExp(`^\\d?${name}$`) }).click();
    } else await page.locator(`.map-svg [data-id="${idOf(((await page.locator('.q-name').textContent()) ?? '').trim())}"]`).click();
    // A right answer moves on by itself: once what it said is gone, the next question is on screen, or the end.
    await expect(page.locator('.verdict')).toHaveCount(0);
  }
}

test.describe('the session of the day', () => {
  test('proposes what is due, what is missed most and a new lesson, and leads from each to the next', async ({ page }) => {
    await seed(page, player());
    await open(page);
    await expect(plan(page).locator('h2')).toHaveText('Tres pasos para hoy');
    await expect(steps(page)).toHaveText(['Repasar lo que toca', 'Lo que más fallas', 'Una lección nueva']);
    await expect(plan(page).locator('.day-step b')).toHaveText(['1', '1']);
    // Each step says its map to whoever cannot see the strip, and can be done on its own.
    await expect(plan(page).getByRole('button', { name: 'Paso 1: Repasar lo que toca, 1 respuesta. España · comunidades autónomas · Señalar' })).toBeVisible();
    await expect(plan(page).getByRole('button', { name: 'Paso 3: Una lección nueva. España · comunidades autónomas' })).toBeVisible();

    // First what is due: where Galicia is.
    await plan(page).getByRole('button', { name: 'Empezar la sesión' }).click();
    await expect(page.locator('.q-name')).toHaveText('Galicia', { timeout: 30_000 });
    await page.locator('.map-svg [data-id="ES-GA"]').click();
    const next = page.locator('.day-next');
    await expect(next).toContainText('Sesión de hoy: hecho 1 paso de 3. Ahora, lo que más fallas.');
    await expect(next.getByRole('button', { name: 'Siguiente paso' })).toBeFocused();
    expect((await kept(page)).dayPlan).toEqual({ day: await dayOf(page), done: ['review'] });

    // Then what keeps being missed: what Castilla y León is called.
    await next.getByRole('button', { name: 'Siguiente paso' }).click();
    await expect(page.locator('.map-svg path[data-id].st-target')).toHaveAttribute('data-id', 'ES-CL');
    await type(page, 'Castilla y León');
    await expect(next).toContainText('Sesión de hoy: hechos 2 pasos de 3. Ahora, una lección nueva.');

    // And, to finish, something new: the lesson that comes next on the map that was being learnt.
    await next.getByRole('button', { name: 'Siguiente paso' }).click();
    await expect(kicker(page)).toHaveText('Lección 1 · nueva 1 de 3');
    await expect(page.locator('.q-name')).toHaveText('Andalucía');
    await learn(page);
    await expect(page.locator('.q-ask')).toHaveText('¡Lección completada!');
    await expect(next).toHaveText('Sesión de hoy completada. Mañana habrá otra.');
    // With no step left, Enter does what it does at the end of any lesson.
    await expect(page.getByRole('button', { name: 'Siguiente lección' })).toBeFocused();
    const saved = await kept(page);
    expect(saved.dayPlan.done).toEqual(['review', 'hard', 'new']);
    // What the lessons have left to teach is written down with the lesson.
    expect(saved.recent[0].left).toBe(16);

    // The first page says so for the rest of the day.
    await open(page);
    await expect(plan(page).locator('h2')).toHaveText('Completada');
    await expect(plan(page).locator('.day-step.done')).toHaveCount(3);
    await expect(plan(page).getByRole('button')).toHaveCount(0);
    await expect(plan(page)).toContainText('Mañana habrá otra.');
  });

  test('does not take for done a step left with nothing answered', async ({ page }) => {
    await seed(page, player());
    await open(page);
    await plan(page).getByRole('button', { name: 'Empezar la sesión' }).click();
    await expect(page.locator('.q-name')).toHaveText('Galicia', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Terminar', exact: true }).click();
    await expect(page.locator('.results-title')).toBeVisible();
    await expect(page.locator('.day-next')).toHaveCount(0);
    await open(page);
    await expect(plan(page).locator('h2')).toHaveText('Tres pasos para hoy');
    await expect(plan(page).locator('.day-step.done')).toHaveCount(0);
  });

  test('comes with the page, and does not push down a moment later what was already on it', async ({ page }) => {
    await seed(page, player());
    // Where the review is the first time it is on the page: the strip goes above it, and its code comes apart.
    await page.addInitScript(() => {
      const w = window as Window & { __first?: number };
      new MutationObserver(() => {
        const review = document.querySelector('.review');
        if (review && w.__first == null) w.__first = review.getBoundingClientRect().top;
      }).observe(document, { childList: true, subtree: true });
    });
    await open(page);
    await expect(plan(page)).toBeVisible();
    const first = await page.evaluate(() => (window as Window & { __first?: number }).__first);
    const now = await page.locator('.review').evaluate((el) => el.getBoundingClientRect().top);
    // The strip is some seventy pixels tall where it is lowest: a letter that arrives late moves a line far less.
    expect(Math.abs(first! - now)).toBeLessThan(20);
    expect(now).toBeGreaterThan(await plan(page).evaluate((el) => el.getBoundingClientRect().bottom));
  });

  test('is for a day with two things to do or more: one alone is what the review already offers', async ({ page }) => {
    await seed(page, due(Date.now()));
    await open(page);
    await expect(page.locator('.review h2')).toHaveText('1 respuesta por repasar');
    await expect(plan(page)).toHaveCount(0);
  });

  test('starts from none another day, and goes on from where it was left on the same one', async ({ page }) => {
    const now = Date.now();
    await seed(page, { ...due(now), ...lessons(now), dayPlan: { day: '2026-01-01', done: ['review'] } });
    await open(page);
    // What was done another day is not done today.
    await expect(plan(page).locator('h2')).toHaveText('Dos pasos para hoy');
    await expect(steps(page)).toHaveText(['Repasar lo que toca', 'Una lección nueva']);

    await page.evaluate((day) => {
      const saved = JSON.parse(localStorage.getItem('regionle:v1')!) as { state: Record<string, unknown> };
      saved.state.dayPlan = { day, done: ['review'] };
      localStorage.setItem('regionle:v1', JSON.stringify(saved));
    }, await dayOf(page));
    await page.reload();
    await expect(plan(page).locator('h2')).toHaveText('Te queda un paso');
    await expect(plan(page).locator('.day-step.done')).toHaveText('Repasar lo que toca (hecho)');
    // The button takes it up at the first step that is left.
    await plan(page).getByRole('button', { name: 'Seguir la sesión' }).click();
    await expect(kicker(page)).toHaveText('Lección 1 · nueva 1 de 3', { timeout: 30_000 });
  });

  test('stops offering the lessons of a map that has nothing left to teach', async ({ page }) => {
    const now = Date.now();
    // The three districts of Luxembourg, placed and named: lessons taken before the game wrote down what was left.
    const known = Object.fromEntries(['LU-D', 'LU-G', 'LU-L'].flatMap((id) => [`loc:${id}`, `name:${id}`]).map((key) => [key, [2, 2, 2, now - 3600_000]]));
    const d = due(now);
    await seed(page, {
      opts: OPTS,
      stats: { ...d.stats, ...known },
      where: { ...d.where, 'LU-D': 'r|LU|f', 'LU-G': 'r|LU|f', 'LU-L': 'r|LU|f' },
      recent: [{ t: now - DAY, section: 'regions', mode: 'learn', countries: ['LU'], levels: { LU: 'f' }, o: {}, ok: 6, total: 6 }],
    });
    await open(page);
    await expect(steps(page)).toHaveText(['Repasar lo que toca', 'Una lección nueva']);
    await plan(page).getByRole('button', { name: /^Paso 2: Una lección nueva\. Luxemburgo/ }).click();
    // Nothing to teach: the lessons say so, and write it down.
    await expect(page.locator('.hud-main')).toHaveText('3 / 3', { timeout: 30_000 });
    await expect.poll(async () => (await kept(page)).recent[0].left).toBe(0);
    // With one thing left to do, and no step done, there is no session: the review of the day is enough.
    await open(page);
    await expect(page.locator('.review h2')).toHaveText('1 respuesta por repasar');
    await expect(plan(page)).toHaveCount(0);
  });
});
