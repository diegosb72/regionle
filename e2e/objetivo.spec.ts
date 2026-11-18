import { expect, test, type Page } from '@playwright/test';
import { open, seed } from './helpers';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
/** The day `n` days from now, as the game writes it ("2026-11-26"), in the time of the browser. */
const dayIn = (n: number): string => {
  const d = new Date(Date.now() + n * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** "jueves, 26 de noviembre", as the first page says it. */
const spoken = (day: string): string => {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date)}, ${new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(date)}`;
};

/** The nineteen autonomous communities and cities of Spain. */
const SPAIN = ['ES-AN', 'ES-AR', 'ES-AS', 'ES-CB', 'ES-CE', 'ES-CL', 'ES-CM', 'ES-CN', 'ES-CT', 'ES-EX', 'ES-GA', 'ES-IB', 'ES-MC', 'ES-MD', 'ES-ML', 'ES-NC', 'ES-PV', 'ES-RI', 'ES-VC'];
const goalOf = (patch: Record<string, unknown> = {}) => ({ id: 'g1', name: 'España · comunidades autónomas', section: 'regions', countries: ['ES'], levels: { ES: 'g1' }, ids: SPAIN, skill: 'loc', date: dayIn(8), made: Date.now() - DAY, ...patch });
/** Seen `seen` times, right `run` times in a row, the last time `ago` minutes ago. */
const stat = (run: number, ago: number, seen = Math.max(1, run)) => [seen, run, run, Date.now() - ago * MIN];
const goal = (page: Page) => page.locator('.goals .goal');

test.describe('a goal with a date', () => {
  test('is set from the map that is chosen and shows on the first page', async ({ page }) => {
    await seed(page, { sel: { regions: ['ES'] }, levels: { ES: 'g1' }, mode: { regions: 'identify' } });
    await open(page, '/');
    await expect(page.locator('.goals')).toHaveCount(0);

    await open(page, '/regiones');
    await page.getByRole('button', { name: 'Poner fecha' }).click();
    const what = page.getByRole('radiogroup', { name: 'Qué quieres saber' });
    await expect(what.getByRole('radio')).toHaveText(['Situar en el mapa', 'Nombrar', 'Capitales']);
    // The game that is chosen says what is wanted; it can be changed.
    await expect(what.getByRole('radio', { name: 'Nombrar' })).toHaveAttribute('aria-checked', 'true');
    await what.getByRole('radio', { name: 'Situar en el mapa' }).click();
    const day = dayIn(8);
    await page.getByLabel('Para cuándo').fill(day);
    await page.getByRole('button', { name: 'Fijar el objetivo' }).click();
    await expect(page.locator('.goalbar-made')).toContainText(`Objetivo fijado para el ${spoken(day)}: 19 piezas.`);

    await page.getByRole('button', { name: 'Verlo en la portada' }).click();
    await expect(goal(page)).toHaveCount(1);
    await expect(goal(page).locator('h3')).toHaveText('España · comunidades autónomas · Situar en el mapa');
    await expect(goal(page).locator('.goal-bar b')).toHaveText('0 de 19');
    // Eight days ahead, the eve kept for going over: nineteen among seven.
    await expect(goal(page).locator('.goal-plan')).toContainText(`Para el ${spoken(day)}: quedan 8 días. Hoy: 3 por aprender.`);
  });

  test('starts with lessons on its own map', async ({ page }) => {
    await seed(page, { goals: [goalOf()] });
    await open(page, '/');
    await goal(page).getByRole('button', { name: 'Empezar' }).click();
    await expect(page.locator('.play-title strong')).toHaveText('Aprender', { timeout: 30_000 });
    await expect(page.locator('.play-title span')).toContainText('España · comunidades autónomas');
    await expect(page.locator('.map-svg [data-id="ES-AN"]')).toBeVisible({ timeout: 30_000 });
  });

  test('brings back what is due before anything new', async ({ page }) => {
    const stats = { 'loc:ES-AN': stat(2, 60), 'loc:ES-AR': stat(2, 60), 'loc:ES-AS': stat(0, 30), 'loc:ES-CB': stat(0, 45), 'loc:ES-CE': stat(1, 5) };
    await seed(page, { goals: [goalOf({ mark: { day: dayIn(0), seen: 5 } })], stats });
    await open(page, '/');
    await expect(goal(page).locator('.goal-bar b')).toHaveText('2 de 19');
    // Fourteen were left this morning for seven days: two today. Two misses of a while ago are due.
    await expect(goal(page).locator('.goal-plan')).toContainText('Hoy: 2 por aprender y 2 por repasar.');
    await goal(page).getByRole('button', { name: 'Repasar 2' }).click();
    await expect(page.locator('.play-title strong')).toHaveText('Señalar', { timeout: 30_000 });
    await expect(page.locator('.hud-main')).toHaveText('1 / 2');
    const asked = ((await page.locator('.q-name').textContent()) ?? '').trim();
    expect(['Principado de Asturias', 'Cantabria', 'Asturias']).toContain(asked);
  });

  test('says when the day is done, and lets whoever wants to get ahead', async ({ page }) => {
    // Five seen this morning, and the three of today since.
    const stats = Object.fromEntries(SPAIN.slice(0, 8).map((id) => [`loc:${id}`, stat(2, 3)]));
    await seed(page, { goals: [goalOf({ mark: { day: dayIn(0), seen: 6 } })], stats });
    await open(page, '/');
    await expect(goal(page).locator('.goal-plan')).toContainText('Hecho por hoy. Mañana, 2 por aprender.');
    await expect(goal(page).getByRole('button', { name: 'Empezar' })).toHaveCount(0);
    await expect(goal(page).getByRole('button', { name: 'Seguir aprendiendo' })).toHaveCount(0);
    await expect(goal(page).getByRole('button', { name: 'Adelantar' })).toBeVisible();
  });

  test('offers a mock exam with every piece', async ({ page }) => {
    await seed(page, { goals: [goalOf()] });
    await open(page, '/');
    await goal(page).getByRole('button', { name: 'Examen de prueba' }).click();
    await expect(page.locator('.q-how')).toContainText('El primer clic es tu respuesta.', { timeout: 30_000 });
    await expect(page.locator('.hud-main')).toHaveText('1 / 19');
    await expect(page.getByRole('button', { name: 'Entregar' })).toBeVisible();
  });

  test('can be moved to another day, and taken away', async ({ page }) => {
    await seed(page, { goals: [goalOf()] });
    await open(page, '/');
    await goal(page).getByRole('button', { name: 'Cambiar la fecha' }).click();
    const day = dayIn(15);
    await page.getByLabel('Fecha nueva').fill(day);
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(goal(page).locator('.goal-plan')).toContainText(`Para el ${spoken(day)}: quedan 15 días. Hoy: 2 por aprender.`);
    await expect(page.getByLabel('Fecha nueva')).toHaveCount(0);

    // Two steps: the first click only asks.
    await goal(page).getByRole('button', { name: 'Quitar' }).click();
    await expect(goal(page)).toHaveCount(1);
    await goal(page).getByRole('button', { name: '¿Seguro? Quitar' }).click();
    await expect(page.locator('.goals')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1') ?? '{}').state.goals)).toEqual([]);
  });

  test('says how it ended once its day has passed, after the ones still running', async ({ page }) => {
    const stats = Object.fromEntries(SPAIN.slice(0, 12).map((id) => [`loc:${id}`, stat(2, 60 * 30)]));
    await seed(page, { goals: [goalOf({ date: dayIn(-2) }), goalOf({ id: 'g2', name: 'Las del jueves', skill: 'name', ids: SPAIN.slice(0, 6), date: dayIn(1) })], stats });
    await open(page, '/');
    await expect(goal(page)).toHaveCount(2);
    await expect(page.locator('.goals > .kicker')).toHaveText('Objetivos con fecha');
    await expect(goal(page).nth(0).locator('h3')).toHaveText('Las del jueves · Nombrar');
    await expect(goal(page).nth(0).locator('.goal-plan')).toContainText('es mañana. Hoy: 6 por aprender.');
    const over = goal(page).nth(1);
    await expect(over.locator('.goal-plan')).toContainText(`Era para el ${spoken(dayIn(-2))}. Llegaste a 12 de 19.`);
    await expect(over.getByRole('button', { name: 'Examen de prueba' })).toHaveCount(0);
    await expect(over.getByRole('button', { name: 'Cambiar la fecha' })).toBeVisible();
  });

  test('fits a phone without anything running off the side @movil', async ({ page }) => {
    await seed(page, { goals: [goalOf(), goalOf({ id: 'g2', name: 'Capitales de los países de Europa occidental', section: 'countries', countries: ['ES', 'FR', 'PT'], levels: {}, ids: ['ES', 'FR', 'PT'], skill: 'cap', date: dayIn(1) })] });
    await open(page, '/');
    await expect(goal(page)).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const b of await goal(page).first().getByRole('button').all()) {
      const box = await b.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
  });
});
