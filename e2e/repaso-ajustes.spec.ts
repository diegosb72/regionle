/**
 * The review as the player sets it, on the progress page: how far apart the answers come back and how many
 * questions a review game asks.
 */
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, seed } from './helpers';

const DAY = 86_400_000;
const IDS = ['AN', 'AR', 'AS', 'CB', 'CL', 'CM', 'CT', 'EX', 'GA', 'MD', 'MC', 'NC', 'PV', 'RI', 'VC'].map((x) => `ES-${x}`);

/**
 * The communities of Spain, each right twice in a row two and a half days ago: at the usual pace they come
 * back after three days, so nothing waits; set closer, after two, and all of them do.
 */
function player(now: number, extra: Record<string, unknown> = {}) {
  const stats: Record<string, number[]> = {};
  const where: Record<string, string> = {};
  for (const id of IDS) {
    stats[`loc:${id}`] = [2, 2, 2, now - 2.5 * DAY];
    where[id] = 'r|ES|g1';
  }
  return { stats, where, opts: OPTS, tot: { g: 1, q: 30, ok: 30, warn: 0, ms: 60_000 }, ...extra };
}
const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1') ?? '{}').state as Record<string, unknown>);
const pace = (page: Page) => page.locator('.fc-prefs').getByRole('radiogroup', { name: 'Ritmo del repaso' });
const size = (page: Page) => page.locator('.fc-prefs').getByRole('radiogroup', { name: 'Preguntas por repaso' });
const due = (page: Page) => page.locator('.fc-now strong');

test.describe('the settings of the review', () => {
  test('set how far apart the answers come back, and what is due moves with them', async ({ page }) => {
    await seed(page, player(Date.now()));
    await open(page, '/progreso');
    await expect(pace(page).getByRole('radio')).toHaveText(['Más seguido', 'Normal', 'Más espaciado']);
    await expect(pace(page).getByRole('radio', { checked: true })).toHaveText('Normal');
    await expect(due(page)).toHaveText('0');
    await expect(page.locator('.block', { has: page.locator('.fc') }).locator('.tip-line')).toContainText('1 día, 3, 7, 16, 35 y 75');

    await pace(page).getByRole('radio', { name: 'Más seguido' }).click();
    await expect(due(page)).toHaveText('15');
    await expect(page.locator('.block', { has: page.locator('.fc') }).locator('.tip-line')).toContainText('1 día, 2, 4, 8, 16 y 32');
    expect((await kept(page)).reviewPace).toBe('short');
    // Nothing that was answered is touched.
    expect(((await kept(page)).stats as Record<string, number[]>)['loc:ES-AN'].slice(0, 3)).toEqual([2, 2, 2]);

    // The first page counts the same, and says the waits of that pace.
    await open(page);
    await expect(page.locator('.review h2')).toContainText('15');
    await expect(page.locator('.review-text')).toContainText('al día siguiente, a los dos días, a los cuatro, a los ocho…');
    await page.locator('.review-text a').click();
    await expect(page).toHaveURL(/#\/progreso\?ver=repaso$/);
    await expect(pace(page).getByRole('radio', { checked: true })).toHaveText('Más seguido');

    await pace(page).getByRole('radio', { name: 'Más espaciado' }).click();
    await expect(due(page)).toHaveText('0');
    await expect(page.locator('.block', { has: page.locator('.fc') }).locator('.tip-line')).toContainText('2 días, 6, 14, 30, 60 y 120');
  });

  test('set how many questions a review game asks', async ({ page }) => {
    await seed(page, player(Date.now(), { reviewPace: 'short' }));
    await open(page, '/progreso');
    await expect(size(page).getByRole('radio')).toHaveText(['10', '20', '30', '50']);
    await expect(size(page).getByRole('radio', { checked: true })).toHaveText('30');
    await expect(due(page)).toHaveText('15');

    await size(page).getByRole('radio', { name: '10' }).click();
    expect((await kept(page)).reviewSize).toBe(10);
    await page.locator('.fc-now button').click();
    await expect(page).toHaveURL(/#\/jugar$/);
    await expect(page.locator('.hud-main')).toHaveText('1 / 10', { timeout: 30_000 });
    expect(((await kept(page)).game as { only: string[] }).only).toHaveLength(10);
  });

  test('are kept, and the game opens with them', async ({ page }) => {
    await seed(page, player(Date.now(), { reviewPace: 'short', reviewSize: 20 }));
    await open(page);
    // Counted at the pace that was kept from the first paint, not at the usual one.
    await expect(page.locator('.review h2')).toContainText('15');
    await open(page, '/progreso');
    await expect(pace(page).getByRole('radio', { checked: true })).toHaveText('Más seguido');
    await expect(size(page).getByRole('radio', { checked: true })).toHaveText('20');
  });
});
