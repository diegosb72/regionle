import { expect, test, type Page } from '@playwright/test';
import { open, restart, seed } from './helpers';

/** Noon of Wednesday 18 November 2026 in Madrid, where the browser of these tests is: the day every test here is played on. */
const NOW = new Date('2026-11-18T12:00:00+01:00');
const at = (day: string, hour = 12): number => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00+01:00`).getTime();

/**
 * Six days with something done. Three in a row up to today (the 15th is missing), three days that met their
 * target, one day last year, and what was learnt written down on the last three.
 */
const DAYS = {
  '2026-11-18': [1, 7, 6, 60_000, 0, 30],
  '2026-11-17': [2, 25, 20, 120_000, 1, 28],
  '2026-11-16': [1, 12, 9, 50_000, 0, 20],
  '2026-11-14': [1, 40, 30, 200_000, 1],
  '2026-10-30': [3, 64, 50, 300_000, 1],
  '2025-12-31': [1, 8, 8, 30_000, 0],
};
/** Thirty flags learnt, right twice running each: what the last day wrote down. */
const THIRTY = ['ES', 'FR', 'DE', 'IT', 'PT', 'NL', 'BE', 'PL', 'SE', 'NO', 'FI', 'DK', 'IE', 'GB', 'CH', 'AT', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR', 'HR', 'SI', 'RS', 'UA', 'LT', 'LV', 'EE', 'IS'];
const LEARNT = Object.fromEntries(THIRTY.map((id) => [`flag:${id}`, [2, 2, 2, at('2026-11-17')]]));
const PLAYER = { days: DAYS, dayGoal: 20, best: { 'study:streak': 9 }, tot: { g: 9, q: 156, ok: 123, warn: 10, ms: 760_000 }, stats: LEARNT };

/** What the game has kept in the browser. */
const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { days: Record<string, number[]>; dayGoal: number; best: Record<string, number> });
const tiles = (page: Page) => page.locator('.act-tiles > div');
const tile = (page: Page, name: string) => tiles(page).filter({ hasText: name }).locator('dd');
const day = (page: Page, date: string) => page.locator(`.cal .cal-day[data-day="${date}"]`);
const rows = (page: Page) => page.locator('.months-table tbody tr');
const cells = async (page: Page, n: number): Promise<string[]> => (await rows(page).nth(n).locator('th, td').allTextContents()).map((t) => t.trim());

test.beforeEach(async ({ page }) => {
  // The clock says the same day and hour throughout; timers run as ever.
  await page.clock.setFixedTime(NOW);
});

test.describe('what is done each day', () => {
  test('is on the Progress page: the days in a row, the target of today and the calendar', async ({ page }) => {
    await seed(page, PLAYER);
    await open(page, '/progreso');

    await expect(tiles(page).locator('dt')).toHaveText(['Días seguidos', 'Mejor racha', 'Días jugados', 'Respuestas hoy']);
    await expect(tile(page, 'Días seguidos')).toHaveText('3');
    // The longest run is the one written down, longer than any among the days kept.
    await expect(tile(page, 'Mejor racha')).toHaveText('9');
    await expect(tile(page, 'Días jugados')).toHaveText('6');
    await expect(tile(page, 'Respuestas hoy')).toHaveText('7');
    await expect(page.locator('.activity > .tip-line')).toContainText('Hoy ya cuenta: llevas 3 días seguidos jugando.');

    // The target: twenty answers a day unless something else is chosen.
    const goal = page.getByRole('radiogroup', { name: 'Respuestas al día' });
    await expect(goal.getByRole('radio')).toHaveText(['Sin meta', '10', '20', '50', '100']);
    await expect(goal.getByRole('radio', { name: '20' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.act-goal-text')).toHaveText('Hoy llevas 7 de 20: te faltan 13.');
    await expect(page.getByRole('img', { name: '7 de 20 respuestas hoy' })).toBeVisible();

    // The calendar: a square for each day of the last year, today marked, the days that met their target dotted.
    await expect(page.getByRole('img', { name: 'Calendario de actividad: 6 días con partidas en el último año.' })).toBeVisible();
    await expect(page.locator('.cal .cal-week')).toHaveCount(53);
    await expect(page.locator('.cal .cal-today')).toHaveAttribute('data-day', '2026-11-18');
    await expect(page.locator('.cal .cal-day:not(.lv-0)')).toHaveCount(6);
    await expect(page.locator('.cal .cal-met')).toHaveCount(3);
    await expect(day(page, '2026-11-18')).toHaveClass(/lv-1/);
    await expect(day(page, '2026-11-17')).toHaveClass(/lv-2/);
    await expect(day(page, '2026-11-14')).toHaveClass(/lv-3/);
    await expect(day(page, '2026-10-30')).toHaveClass(/lv-4/);
    // The rest of this week has not come: its squares are not there to be read.
    await expect(page.locator('.cal .cal-future')).toHaveCount(4);
    await expect(day(page, '2026-11-19')).toHaveCount(0);
    // A year of weeks fits the page, with squares of a size, and so does the key under it.
    const cal = (await page.locator('.cal').boundingBox())!;
    const wrap = (await page.locator('.cal-wrap').boundingBox())!;
    expect(cal.width).toBeGreaterThan(wrap.width * 0.9);
    expect(cal.width).toBeLessThanOrEqual(wrap.width);
    const key = await page.locator('.cal-legend .cal-day').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
    expect(key).toEqual([12, 12, 12, 12, 12, 12]);

    // A day says what was done on it.
    await expect(page.locator('.cal-detail')).toHaveText('Pasa el cursor por un día, o tócalo, para ver lo que hiciste.');
    await day(page, '2026-11-17').hover();
    await expect(page.locator('.cal-detail')).toHaveText('Martes, 17 de noviembre de 2026: 25 respuestas en 2 partidas, 20 a la primera, 2 min. Meta cumplida.');
    await expect(day(page, '2026-11-17')).toHaveClass(/cal-on/);
    await day(page, '2026-11-15').hover();
    await expect(page.locator('.cal-detail')).toHaveText('Domingo, 15 de noviembre de 2026: nada.');
    await day(page, '2026-11-18').click();
    await expect(page.locator('.cal-detail')).toHaveText('Miércoles, 18 de noviembre de 2026: 7 respuestas en 1 partida, 6 a la primera, 1 min.');

    // The longest run is among the records.
    await expect(page.locator('.records li', { hasText: 'Días seguidos jugando' })).toContainText('9 días');
  });

  test('has a target that is chosen and kept, and a day that met its own keeps it', async ({ page }) => {
    await seed(page, PLAYER);
    await open(page, '/progreso');
    const goal = page.getByRole('radiogroup', { name: 'Respuestas al día' });

    await goal.getByRole('radio', { name: '10', exact: true }).click();
    await expect(page.locator('.act-goal-text')).toHaveText('Hoy llevas 7 de 10: te faltan 3.');
    // The days that reached the twenty there was then are still dotted, and no other is.
    await expect(page.locator('.cal .cal-met')).toHaveCount(3);
    await expect(day(page, '2026-11-16')).not.toHaveClass(/cal-met/);

    await goal.getByRole('radio', { name: 'Sin meta' }).click();
    await expect(page.locator('.act-goal-now')).toHaveCount(0);
    await expect(page.locator('.act-goal-unit')).toHaveCount(0);
    expect((await kept(page)).dayGoal).toBe(0);

    // It is still what was chosen when the page is opened again, and the first page says the day without a target.
    await page.reload();
    await expect(goal.getByRole('radio', { name: 'Sin meta' })).toHaveAttribute('aria-checked', 'true');
    await open(page, '/');
    await expect(page.locator('.today')).toHaveText(/3 días seguidos\s*Hoy llevas 7 respuestas\./);
    await expect(page.locator('.today .bar')).toHaveCount(0);
  });

  test('draws how the weeks went and how what is learnt has grown', async ({ page }) => {
    await seed(page, PLAYER);
    await open(page, '/progreso');
    const charts = page.locator('.evolution .chart');
    await expect(charts).toHaveCount(2);

    // Twenty-six weeks, each a bar: all that was answered, and how much of it right first time.
    const weeks = charts.nth(0);
    await expect(weeks.getByRole('img')).toHaveAccessibleName('Respuestas por semana en las últimas 26 semanas: 148 respuestas, 78 % a la primera.');
    await expect(weeks.locator('.chart-col')).toHaveCount(26);
    await expect(weeks.locator('.chart-detail')).toHaveText('En 26 semanas: 148 respuestas, 78 % a la primera.');
    await weeks.locator('.chart-col').last().hover();
    await expect(weeks.locator('.chart-detail')).toHaveText('Semana del 16 de noviembre: 44 respuestas, 80 % a la primera, en 3 días.');
    await weeks.locator('.chart-col').first().hover();
    await expect(weeks.locator('.chart-detail')).toHaveText('Semana del 25 de mayo: 0 respuestas.');
    // The fullest week reaches the top line of its scale or stays under it; an empty one has no bar.
    const heights = await weeks.locator('.chart-col .bar-all').evaluateAll((bars) => bars.map((b) => b.getBoundingClientRect().height));
    const box = (await weeks.locator('.chart-bars').boundingBox())!;
    expect(Math.max(...heights)).toBeGreaterThan(box.height * 0.5);
    expect(Math.max(...heights)).toBeLessThanOrEqual(box.height + 0.5);
    expect(heights[0]).toBe(0);
    // The week of the 9th of November had forty answers, and that of the 26th of October, sixty-four: it is the taller.
    expect(heights[22]).toBeGreaterThan(heights[24]);
    expect(heights[24]).toBeGreaterThan(0);
    expect(heights[23]).toBe(0);

    // What is learnt, from the first day it was written down to what is learnt right now.
    const learnt = charts.nth(1);
    await expect(learnt.getByRole('img')).toHaveAccessibleName('Respuestas aprendidas: de 20 el 16 de noviembre de 2026 a 30 hoy.');
    await expect(learnt.locator('.chart-detail')).toContainText('De 20 a 30 en 2 días: 10 más.');
    await expect(learnt.locator('path.line-stroke')).toHaveAttribute('d', /^M0 \d/);
  });

  test('adds up each month and each year', async ({ page }) => {
    await seed(page, PLAYER);
    await open(page, '/progreso');
    const block = page.locator('.months');
    await expect(block.locator('.months-now')).toHaveText([
      'Este mes: 4 días de juego, 5 partidas y 84 respuestas, 77 % a la primera, en 7 min. El día más completo, el sábado, 14 de noviembre: 40 respuestas.',
      'En 2026: 5 días de juego, 8 partidas y 148 respuestas, 78 % a la primera, en 12 min. El día más completo, el viernes, 30 de octubre: 64 respuestas.',
    ]);
    await expect(block.locator('thead th')).toHaveText(['Mes', 'Días', 'Partidas', 'Respuestas', 'A la primera', 'Tiempo', 'Metas']);
    // The year first, then its months, the newest at the top: six of them to begin with.
    await expect(rows(page)).toHaveCount(7);
    expect(await cells(page, 0)).toEqual(['2026', '5', '8', '148', '78 %', '12 min', '3']);
    expect(await cells(page, 1)).toEqual(['Noviembre', '4', '5', '84', '77 %', '7 min', '2']);
    expect(await cells(page, 2)).toEqual(['Octubre', '1', '3', '64', '78 %', '5 min', '1']);
    expect(await cells(page, 3)).toEqual(['Septiembre', '—', '—', '—', '—', '—', '—']);

    // All of them, back to the oldest day kept: the year before has its own line.
    const more = block.getByRole('button', { name: 'Ver los 12 meses' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    await expect(rows(page)).toHaveCount(14);
    expect(await cells(page, 11)).toEqual(['Enero', '—', '—', '—', '—', '—', '—']);
    expect(await cells(page, 12)).toEqual(['2025', '1', '1', '8', '100 %', '1 min', '—']);
    expect(await cells(page, 13)).toEqual(['Diciembre', '1', '1', '8', '100 %', '1 min', '—']);
    await block.getByRole('button', { name: 'Ver solo los últimos meses' }).click();
    await expect(rows(page)).toHaveCount(7);
  });

  test('grows with every game that ends: its answers go to today and to the target', async ({ page }) => {
    await seed(page, {
      days: { '2026-11-17': [1, 12, 9, 50_000, 1], '2026-11-18': [1, 9, 7, 40_000, 0] },
      dayGoal: 10,
      // Andalusia was named right once before: once more and it is learnt.
      stats: { 'name:ES-AN': [1, 1, 1, at('2026-11-17')] },
    });
    await open(page, '/');
    await expect(page.locator('.today')).toHaveText(/2 días seguidos\s*Hoy llevas 9 de 10 respuestas\./);

    // Two cards, both known.
    await restart(page, { section: 'regions', countries: ['ES'], levels: { ES: 'g1' }, mode: 'cards', only: ['ES-AN', 'ES-CL'] });
    for (let i = 0; i < 2; i++) {
      await expect(page.locator('.hud-main')).toHaveText(`${i + 1} / 2`);
      await page.getByRole('button', { name: 'Ver la respuesta' }).click();
      await page.getByRole('button', { name: /Lo sabía/ }).click();
    }
    await expect(page.locator('.results')).toBeVisible();

    // Eleven answers today: the target of ten is met, and what is learnt by now is written down.
    const state = await kept(page);
    expect(state.days['2026-11-18'].slice(0, 3)).toEqual([2, 11, 9]);
    expect(state.days['2026-11-18'].slice(4)).toEqual([1, 1]);
    expect(state.days['2026-11-17']).toEqual([1, 12, 9, 50_000, 1]);
    expect(state.best['study:streak']).toBe(2);

    await open(page, '/');
    await expect(page.locator('.today')).toHaveText(/2 días seguidos\s*Meta de hoy cumplida: 11 respuestas\./);
    // The line opens Progress, where the day is.
    await page.locator('.today').click();
    await expect(page.locator('.act-goal-text')).toHaveText('Meta de hoy cumplida: 11 respuestas.');
    await expect(tile(page, 'Días seguidos')).toHaveText('2');
    await expect(tile(page, 'Respuestas hoy')).toHaveText('11');
    await expect(page.locator('.cal .cal-today')).toHaveClass(/cal-met/);
    await expect(page.locator('.cal .cal-met')).toHaveCount(2);
  });

  test('starts, for a player from before, with the games and the daily challenges that were kept', async ({ page }) => {
    const session = (t: number, total: number, ok: number) => ({ t, section: 'regions', mode: 'pin', label: 'España · comunidades autónomas', total, ok, warn: 0, bad: total - ok, ms: 60_000 });
    await seed(page, {
      sessions: [session(at('2026-11-17', 18), 10, 8), session(at('2026-11-17', 9), 19, 12), session(at('2026-11-10'), 5, 5)],
      // The challenge of the 16th, finished on the 16th with 70 points of 100: thirteen answers, nine of them right.
      daily: { '2026-11-16': { p: [20, 10, 20, 10, 10], t: at('2026-11-16', 20) } },
      tot: { g: 3, q: 34, ok: 25, warn: 0, ms: 180_000 },
    });
    await open(page, '/progreso');
    // Nothing yet today: the run that ended yesterday is still there to be kept.
    await expect(tile(page, 'Días seguidos')).toHaveText('2');
    await expect(tile(page, 'Días jugados')).toHaveText('3');
    await expect(tile(page, 'Respuestas hoy')).toHaveText('0');
    await expect(page.locator('.activity > .tip-line')).toContainText('Hoy todavía no has jugado: una partida mantiene la racha de 2 días.');
    await day(page, '2026-11-17').hover();
    await expect(page.locator('.cal-detail')).toHaveText('Martes, 17 de noviembre de 2026: 29 respuestas en 2 partidas, 20 a la primera, 2 min.');
    await day(page, '2026-11-16').hover();
    await expect(page.locator('.cal-detail')).toHaveText('Lunes, 16 de noviembre de 2026: 13 respuestas en 1 partida, 9 a la primera.');
    // There was no target then: no day is dotted, and choosing one now does not dot the days that would have met it.
    await expect(page.locator('.cal .cal-met')).toHaveCount(0);
    await page.getByRole('radiogroup', { name: 'Respuestas al día' }).getByRole('radio', { name: '10', exact: true }).click();
    await expect(page.locator('.act-goal-text')).toHaveText('Hoy llevas 0 de 10: te faltan 10.');
    await expect(page.locator('.cal .cal-met')).toHaveCount(0);
    // What was built is kept from then on.
    await expect.poll(async () => (await kept(page)).days).toEqual({ '2026-11-10': [1, 5, 5, 60_000, 0], '2026-11-16': [1, 13, 9, 0, 0], '2026-11-17': [2, 29, 20, 120_000, 0] });
    // No day has written down what was learnt yet: the chart of it waits, and says what there is today.
    await expect(page.locator('.evolution .chart')).toHaveCount(2);
    await expect(page.locator('.evolution .chart').nth(1)).toContainText('Hoy tienes 0 respuestas aprendidas. La cifra se apunta cada día que juegas');
    await expect(page.locator('.evolution .chart-line')).toHaveCount(0);

    await open(page, '/');
    await expect(page.locator('.today')).toHaveText(/2 días seguidos\s*Hoy llevas 0 de 10 respuestas\./);
  });

  test('shows nothing of it to whoever has not played yet', async ({ page }) => {
    await seed(page);
    await open(page, '/');
    await expect(page.locator('.today')).toHaveCount(0);
    await open(page, '/progreso');
    await expect(page.locator('.activity')).toHaveCount(0);
    await expect(page.locator('.evolution')).toHaveCount(0);
    await expect(page.locator('.months')).toHaveCount(0);
  });

  test('is said in English too', async ({ page }) => {
    await seed(page, { ...PLAYER, lang: 'en' });
    await open(page, '/progreso');
    await expect(tiles(page).locator('dt')).toHaveText(['Days in a row', 'Longest run', 'Days played', 'Answers today']);
    await expect(page.locator('.act-goal-text')).toHaveText('7 of 20 today: 13 to go.');
    await day(page, '2026-11-17').hover();
    // (Whether a comma follows the day of the week is up to the browser.)
    await expect(page.locator('.cal-detail')).toHaveText(/^Tuesday,? 17 November 2026: 25 answers in 2 games, 20 right first time, 2 min\. Target met\.$/);
    await expect(page.locator('.evolution .chart').nth(0).getByRole('img')).toHaveAccessibleName('Answers by week over the last 26 weeks: 148 answers, 78 % right first time.');
    await expect(page.locator('.months .months-now').first()).toHaveText(/^This month: 4 days of play, 5 games and 84 answers, 77 % right first time, in 7 min\. The fullest day, Saturday,? 14 November: 40 answers\.$/);
    expect(await cells(page, 1)).toEqual(['November', '4', '5', '84', '77 %', '7 min', '2']);
    await open(page, '/');
    await expect(page.locator('.today')).toHaveText(/3 days in a row\s*7 of 20 answers today\./);
  });

  test('fits a phone: fewer weeks, the latest ones, and nothing to scroll sideways @movil', async ({ page }) => {
    await seed(page, PLAYER);
    await open(page, '/progreso');
    // The calendar shows the weeks that fit, the last of them being this one.
    const weeks = page.locator('.cal .cal-week:visible');
    await expect(weeks).toHaveCount(18);
    await expect(weeks.last().locator('.cal-today')).toHaveCount(1);
    const cal = (await page.locator('.cal').boundingBox())!;
    const wrap = (await page.locator('.cal-wrap').boundingBox())!;
    expect(cal.width).toBeLessThanOrEqual(wrap.width + 0.5);
    // A square is big enough to be told from its neighbours, and a tap on it says its day.
    const square = (await day(page, '2026-11-17').boundingBox())!;
    expect(square.width).toBeGreaterThanOrEqual(12);
    await day(page, '2026-11-17').tap();
    await expect(page.locator('.cal-detail')).toHaveText('Martes, 17 de noviembre de 2026: 25 respuestas en 2 partidas, 20 a la primera, 2 min. Meta cumplida.');

    // The table of months keeps to what fits: no scrolling sideways, here or on the page.
    await expect(page.locator('.months-table thead th:visible')).toHaveText(['Mes', 'Días', 'Respuestas', 'A la primera']);
    const table = await page.locator('.months .table-wrap').evaluate((el) => [el.scrollWidth, el.clientWidth]);
    expect(table[0]).toBeLessThanOrEqual(table[1]);
    const doc = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(doc[0]).toBeLessThanOrEqual(doc[1]);
    // The two charts go one under the other.
    const [a, b] = await page.locator('.evolution .chart').evaluateAll((els) => els.map((el) => el.getBoundingClientRect()));
    expect(b.top).toBeGreaterThanOrEqual(a.bottom);

    // The line of the first page says the same in what room there is.
    await open(page, '/');
    await expect(page.locator('.today')).toHaveText(/3 días seguidos\s*Hoy llevas 7 de 20 respuestas\./);
    const line = (await page.locator('.today').boundingBox())!;
    expect(line.x + line.width).toBeLessThanOrEqual(doc[1]);
  });
});

test.describe('achievements', () => {
  const badge = (page: Page, name: string) => page.locator('.badges .badge', { hasText: name });
  const count = (page: Page) => page.locator('.block', { hasText: 'Nivel y logros' }).locator('.tip-line');

  test('are announced when they are earned, and stay on the board with their day', async ({ page }) => {
    // Ninety-nine cards gone through: one more is the hundredth.
    await seed(page, { tot: { g: 5, q: 99, ok: 80, warn: 0, ms: 600_000, cards: 99 }, badges: { first: at('2026-11-10') }, days: { '2026-11-17': [5, 99, 80, 600_000, 1] } });
    await open(page, '/progreso');
    await expect(count(page)).toContainText('Llevas 1 de 40 logros.');
    await expect(badge(page, 'Baraja gastada')).not.toHaveClass(/\bon\b/);
    await expect(badge(page, 'Baraja gastada').getByRole('img', { name: '99 de 100' })).toBeVisible();

    await restart(page, { section: 'regions', countries: ['ES'], levels: { ES: 'g1' }, mode: 'cards', only: ['ES-AN', 'ES-CL'] });
    await page.getByRole('button', { name: 'Ver la respuesta' }).click();
    await page.getByRole('button', { name: /Lo sabía/ }).click();
    const toast = page.locator('.toast');
    await expect(toast).toHaveText(/Logro conseguido\s*Baraja gastada/);

    // The notice opens the board, where the achievement is with the day it was earned.
    await toast.click();
    await expect(badge(page, 'Baraja gastada')).toHaveClass(/\bon\b/);
    await expect(badge(page, 'Baraja gastada').locator('.badge-when')).toHaveText('Conseguido el 18 nov 2026');
    await expect(count(page)).toContainText('Llevas 2 de 40 logros.');
    await expect(toast).toHaveCount(0);
    // The new ones are there to be worked for, each saying how far along it is.
    await expect(badge(page, 'Una semana sin faltar').getByRole('img', { name: '1 de 7' })).toBeVisible();
    await expect(badge(page, 'Diez metas').getByRole('img', { name: '1 de 10' })).toBeVisible();
    await expect(badge(page, 'Cinco mil respuestas').getByRole('img', { name: '99 de 5000' })).toBeVisible();
    await expect(badge(page, 'Tierra y mar').getByRole('img', { name: '0 de 11' })).toBeVisible();
    await expect(badge(page, 'Todas las capitales').getByRole('img', { name: '0 de 193' })).toBeVisible();
    for (const name of ['Todas las banderas', 'Un mes sin faltar', 'Matrícula de honor', 'De todo un poco', 'Buen oído']) await expect(badge(page, name)).toHaveCount(1);
  });

  test('are not taken back when what earned them is gone', async ({ page }) => {
    // A week without a miss back in March, of which the days kept say nothing now; and a custom list, deleted since.
    await seed(page, {
      badges: { first: at('2026-03-01'), study7: at('2026-03-07'), list: at('2026-03-08') },
      days: { '2026-11-18': [1, 7, 6, 60_000, 0] },
      tot: { g: 1, q: 7, ok: 6, warn: 0, ms: 60_000 },
      lists: [],
    });
    await open(page, '/progreso');
    await expect(tile(page, 'Mejor racha')).toHaveText('1');
    await expect(badge(page, 'Una semana sin faltar')).toHaveClass(/\bon\b/);
    await expect(badge(page, 'Una semana sin faltar').locator('.badge-when')).toHaveText('Conseguido el 7 mar 2026');
    await expect(badge(page, 'A tu medida')).toHaveClass(/\bon\b/);
    await expect(badge(page, 'A tu medida').locator('.badge-when')).toHaveText('Conseguido el 8 mar 2026');
    await expect(count(page)).toContainText('Llevas 3 de 40 logros.');
    // The month without a miss was never earned: it says how far the longest run got.
    await expect(badge(page, 'Un mes sin faltar')).not.toHaveClass(/\bon\b/);
    await expect(badge(page, 'Un mes sin faltar').getByRole('img', { name: '1 de 30' })).toBeVisible();
    await expect(page.locator('.toast')).toHaveCount(0);
  });
});
