/**
 * The wildcards of the daily challenge: one is won every seven days in a row, and when a day is missed it is
 * spent by itself the next time the challenge is finished, so that the days in a row go on.
 */
import { expect, test, type Page } from '@playwright/test';
import { open, seed } from './helpers';

/** Noon of Wednesday 18 November 2026 in Madrid: the day every test here is played on. */
const NOW = new Date('2026-11-18T12:00:00+01:00');
const TODAY = '2026-11-18';
const day = (k: number): string => new Date(Date.parse(`${TODAY}T12:00:00Z`) + k * 86_400_000).toISOString().slice(0, 10);
const done = (date: string) => ({ p: [20, 16, 13, 8, 4], k: [1, 4, 2, 3, 1], t: Date.parse(`${date}T19:00:00+01:00`) });
/** Days finished on their day, from `from` to `to` days from today. */
const run = (from: number, to: number) => Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [day(from + i), done(day(from + i))]));
const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { daily: Record<string, { j?: number; t?: number }>; best: Record<string, number> });
const meta = (page: Page) => page.locator('.d-card-meta .d-streak');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test.describe('a wildcard of the days in a row', () => {
  test('is shown on the first page once it is won', async ({ page }) => {
    await seed(page, { daily: run(-7, -1), best: { 'daily:streak': 7 } });
    await open(page);
    await expect(meta(page)).toHaveText(['7 días seguidos', '1 comodín']);
    await expect(meta(page).nth(1)).toHaveAttribute('title', 'Cada 7 días seguidos ganas un comodín, y guardas hasta 2. Si un día no juegas, se gasta solo y la racha sigue.');
  });

  test('is not there before a week in a row', async ({ page }) => {
    await seed(page, { daily: run(-6, -1) });
    await open(page);
    await expect(meta(page)).toHaveText(['6 días seguidos']);
  });

  test('says on the first page that it can save the days in a row when yesterday was missed', async ({ page }) => {
    await seed(page, { daily: run(-8, -2), best: { 'daily:streak': 7 } });
    await open(page);
    await expect(meta(page)).toHaveText(['Juega hoy y un comodín salva tu racha de 7 días', '1 comodín']);
    await expect(meta(page).first()).toHaveClass(/\bon\b/);
  });

  test('cannot save them when more days were missed than there are wildcards', async ({ page }) => {
    await seed(page, { daily: run(-9, -3), best: { 'daily:streak': 7 } });
    await open(page);
    await expect(meta(page)).toHaveText(['Empieza hoy tu racha', '1 comodín']);
  });

  test('is spent by itself when the challenge of today is finished, and the days in a row go on', async ({ page }) => {
    // Yesterday was missed; of today's challenge only the last test is left.
    await seed(page, { daily: { ...run(-8, -2), [TODAY]: { p: [20, 16, 13, 8, null], k: [1, 4, 2, 3, null] } }, best: { 'daily:streak': 7 } });
    await page.goto('./#/reto');
    await page.getByRole('button', { name: 'Seguir: prueba 5' }).click();
    // Five quick questions, answered with the first option each: whatever they score, the challenge ends.
    for (let n = 1; n <= 5; n++) {
      await expect(page.locator('.d-quick .kicker')).toContainText(`${n} / 5`);
      await page.keyboard.press('1');
    }
    await page.getByRole('button', { name: 'Ver resultado' }).click();

    await expect(page.locator('.d-streakline .d-streak').first()).toHaveText('8 días seguidos');
    await expect(page.locator('.d-streakline')).toContainText('Mejor racha: 8');
    // The only wildcard went on yesterday: none is left to show.
    await expect(page.locator('.d-streakline .d-streak')).toHaveCount(1);
    await expect(page.locator('.d-joker-note')).toContainText('Un comodín ha cubierto el día de ayer: tu racha sigue.');
    await expect(page.locator('.d-joker-note')).toContainText('Te faltan 6 días para el siguiente.');

    const state = await kept(page);
    expect(state.daily[day(-1)]).toMatchObject({ j: 1 });
    expect(state.daily[day(-1)].t).toBeUndefined();
    expect(state.best['daily:streak']).toBe(8);

    // In the calendar, yesterday is a day held by a wildcard; it can still be played, late.
    const yesterday = page.locator(`.d-cal a[href="#/reto/${day(-1)}"]`);
    await expect(yesterday).toHaveClass(/\bjoker\b/);
    await expect(yesterday).toHaveAttribute('aria-label', /cubierto por un comodín$/);
    // Today's day stands in line with the rest of its week.
    const today = page.locator(`.d-cal a[href="#/reto/${TODAY}"]`);
    await expect(today).toHaveClass(/\bis-today\b/);
    const [a, b] = [(await yesterday.boundingBox())!, (await today.boundingBox())!];
    expect(Math.round(b.y)).toBe(Math.round(a.y));
    expect(Math.round(b.height)).toBe(Math.round(a.height));

    // And the first page counts the same.
    await open(page);
    await expect(meta(page)).toHaveText(['8 días seguidos']);
  });

  test('is told in English too', async ({ page }) => {
    await seed(page, { lang: 'en', daily: run(-8, -2), best: { 'daily:streak': 7 } });
    await open(page);
    await expect(meta(page)).toHaveText(['Play today and a wildcard saves your 7-day streak', '1 wildcard']);
  });
});
