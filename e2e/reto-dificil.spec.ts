/**
 * The hard way of the daily challenge: the same five tests of the day with fewer aids, chosen before the
 * first one is played.
 *
 * The day of these tests is 18 November 2026: Iraq, whose mystery governorate is Di Car; the ones to
 * point at start with Nayaf and Cadisia; the country to guess is Costa Rica; and the five questions are
 * the flags of Italy, Chile and Sudan and the capitals of Bhutan and Canada.
 */
import { expect, test, type Page } from '@playwright/test';
import { open, seed, type } from './helpers';

const NOW = new Date('2026-11-18T12:00:00+01:00');
const TODAY = '2026-11-18';
const PAST = '2026-11-12';
const done = (date: string, extra: Record<string, unknown> = {}) => ({ p: [20, 16, 13, 8, 4], k: [1, 4, 2, 3, 1], t: Date.parse(`${date}T19:00:00+01:00`), ...extra });
/** A day begun the hard way, with its first `n` tests scored. */
const begun = (n: number) => ({ p: [12, 8, 13, 9].slice(0, n).concat(Array(5 - n).fill(null)), k: [3, 2, 2, 4].slice(0, n).concat(Array(5 - n).fill(null)), h: 1 });
const kept = (page: Page) => page.evaluate((day) => JSON.parse(localStorage.getItem('regionle:v1')!).state.daily[day] as { p: (number | null)[]; h?: number; t?: number }, TODAY);
const way = (page: Page, name: string) => page.getByRole('radiogroup', { name: 'Cómo lo juegas' }).getByRole('radio', { name });
const steps = (page: Page) => page.locator('.d-list li span');
const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`);

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test.describe('the hard way of the daily challenge', () => {
  test('is chosen before the first test, and the screen says what changes', async ({ page }) => {
    await seed(page, {});
    await open(page, '/reto');
    await expect(way(page, 'Normal')).toBeChecked();
    await expect(steps(page).first()).toContainText('por la silueta, en seis intentos.');
    await expect(page.locator('.d-mode .d-hint')).toHaveText('¿Te sabe a poco? En difícil son las mismas pruebas con menos ayudas.');

    await way(page, 'Difícil').click();
    await expect(way(page, 'Difícil')).toBeChecked();
    await expect(page.locator('.d-mode .d-hint')).toHaveText('Las mismas cinco pruebas con menos ayudas. Los puntos se cuentan igual: cuesta más llegar.');
    await expect(steps(page)).toContainText([
      'por la silueta, girada y en cuatro intentos.',
      'Señala cinco en el mapa, con un solo intento cada una.',
      'por el camino más corto, sin pistas.',
      'por su población, sin saber el continente.',
      'escribiendo la respuesta.',
    ]);
    // Nothing is kept until a test is scored: the choice can be taken back.
    await way(page, 'Normal').click();
    await expect(steps(page).nth(1)).toHaveText('SeñalarSeñala cinco en el mapa.');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state.daily ?? {})).toEqual({});
  });

  test('turns the outline and gives four tries at it', async ({ page }) => {
    await seed(page, {});
    await open(page, '/reto');
    await way(page, 'Difícil').click();
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page.locator('.q-note')).toHaveText('Tienes 4 intentos. Cada fallo te dice a qué distancia y hacia dónde está. La silueta está girada: el norte no queda arriba.');
    const turned = await page.locator('.d-shape path').getAttribute('d');

    await type(page, 'Bagdad');
    await expect(page.locator('.q-note')).toHaveText('Te quedan 3 intentos.');
    await type(page, 'Basora');
    await type(page, 'Erbil');
    await expect(page.locator('.q-note')).toHaveText('Te queda 1 intento.');
    await type(page, 'Kirkuk');
    // The fourth miss ends it: with six tries there would be two to go.
    await expect(page.locator('.verdict')).toContainText('Era Di Car');
    await expect(page.locator('.d-points')).toHaveText('+0 puntos');
    await expect(page.locator('.d-guesses li')).toHaveCount(4);
    // Once it is over the outline is shown north up.
    const upright = await page.locator('.d-shape path').getAttribute('d');
    expect(upright).not.toBe(turned);
    expect(await kept(page)).toMatchObject({ p: [0, null, null, null, null], h: 1 });

    // From here on the day is hard: the first screen says so and there is nothing left to choose.
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page.locator('.d-hardline')).toHaveText('DifícilLo estás jugando en difícil.');
    await expect(page.getByRole('radiogroup', { name: 'Cómo lo juegas' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Seguir: prueba 2' })).toBeVisible();
  });

  test('shows the same outline north up, with six tries, the plain way', async ({ page }) => {
    await seed(page, {});
    await open(page, '/reto');
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page.locator('.q-note')).toHaveText('Tienes 6 intentos. Cada fallo te dice a qué distancia y hacia dónde está.');
    const plain = await page.locator('.d-shape path').getAttribute('d');
    for (const name of ['Bagdad', 'Basora', 'Erbil', 'Kirkuk']) await type(page, name);
    await expect(page.locator('.q-note')).toHaveText('Te quedan 2 intentos.');
    await type(page, 'Di Car');
    await expect(page.locator('.verdict')).toContainText('Correcto, en 5 intentos: Di Car');
    // Nothing was turned: the outline is the one it was.
    expect(await page.locator('.d-shape path').getAttribute('d')).toBe(plain);
    expect((await kept(page)).h).toBeUndefined();
  });

  test('gives one try at each piece to point at', async ({ page }) => {
    await seed(page, { daily: { [TODAY]: begun(1) } });
    await open(page, '/reto');
    await page.getByRole('button', { name: 'Seguir: prueba 2' }).click();
    await expect(page.locator('.q-name')).toHaveText('Nayaf');
    await expect(page.locator('.q-how')).toHaveText('Haz clic en la gobernación. Tienes un solo intento.');
    // Basra is not Najaf, and there is no second try.
    await piece(page, 'IQ-BA').dispatchEvent('click');
    await expect(page.locator('.verdict')).toContainText('Era aquí: Nayaf');
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.locator('.q-name')).toHaveText('Cadisia');
    await piece(page, 'IQ-QA').dispatchEvent('click');
    await expect(page.locator('.q-how')).toContainText('¡Correcto!');
    await expect(page.locator('.q-name')).toHaveText('Ambar');
  });

  test('has no hints for the route', async ({ page }) => {
    await seed(page, { daily: { [TODAY]: begun(2) } });
    await open(page, '/reto');
    await page.getByRole('button', { name: 'Seguir: prueba 3' }).click();
    await expect(page.getByRole('button', { name: 'Me rindo' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Pista' })).toHaveCount(0);
  });

  test('keeps the hint of the route the plain way', async ({ page }) => {
    await seed(page, { daily: { [TODAY]: { p: [12, 8, null, null, null], k: [3, 2, null, null, null] } } });
    await open(page, '/reto');
    await page.getByRole('button', { name: 'Seguir: prueba 3' }).click();
    await expect(page.getByRole('button', { name: 'Me rindo' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Pista' })).toBeVisible();
  });

  test('does not tell the continent of the country to guess until the third miss', async ({ page }) => {
    await seed(page, { daily: { [TODAY]: begun(3) } });
    await open(page, '/reto');
    await page.getByRole('button', { name: 'Seguir: prueba 4' }).click();
    await expect(page.locator('.d-clues')).toHaveText('Sin más pistas que la cifra.');
    await expect(page.locator('.q-note')).toHaveText('Cada intento te dice si te pasas o te quedas corto. Te quedan 6; al tercer fallo sabrás en qué continente está.');
    await type(page, 'Francia');
    await type(page, 'Islandia');
    await expect(page.locator('.d-clues')).toHaveText('Sin más pistas que la cifra.');
    await type(page, 'Portugal');
    await expect(page.locator('.d-clues')).toHaveText('Está en América.');
    await expect(page.locator('.q-note')).toHaveText('Cada intento te dice si te pasas o te quedas corto. Te quedan 3.');
    await type(page, 'Costa Rica');
    await expect(page.locator('.verdict')).toContainText('Correcto, en 4 intentos: Costa Rica');
    // The area is never told the hard way.
    await expect(page.locator('.d-clues')).not.toContainText('mide');
  });

  test('asks for the last five answers typed, and ends with a result marked as hard', async ({ page }) => {
    await seed(page, { daily: { [TODAY]: begun(4) } });
    await open(page, '/reto');
    await page.getByRole('button', { name: 'Seguir: prueba 5' }).click();
    const quick = page.locator('.d-quick');
    await expect(quick.locator('.kicker')).toHaveText('¿De qué país es esta bandera? · 1 / 5');
    await expect(quick.locator('.choice')).toHaveCount(0);
    await expect(quick.locator('.q-note')).toHaveText('Un solo intento: escribe la respuesta y pulsa Intro.');

    // Italy, and a hit moves on by itself.
    await type(page, 'Italia');
    await expect(quick.locator('.d-typed-said')).toHaveText('¡Correcto! Italia');
    await expect(quick.locator('.kicker')).toContainText('2 / 5');
    // A slip of the finger is forgiven, as in any typed answer.
    await type(page, 'chille');
    await expect(quick.locator('.d-typed-said')).toHaveText('¡Correcto! Chile');
    await expect(quick.locator('.kicker')).toContainText('3 / 5');
    // A miss says what it was and waits.
    await type(page, 'Egipto');
    await expect(quick.locator('.d-typed-said')).toHaveText('Era Sudán');
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(quick.locator('.kicker')).toHaveText('¿Cuál es la capital de…? · 4 / 5');
    await expect(quick.locator('.d-country')).toContainText('Bután');
    await type(page, 'Timbu');
    await expect(quick.locator('.d-typed-said')).toHaveText('¡Correcto! Timbu');
    await expect(quick.locator('.d-country')).toContainText('Canadá');
    await page.getByRole('button', { name: 'No lo sé' }).click();
    await expect(quick.locator('.d-typed-said')).toHaveText('Era Ottawa');
    await page.getByRole('button', { name: 'Ver puntos' }).click();
    await expect(quick.locator('.bigfig')).toHaveText('3 de 5');
    await expect(quick.locator('.d-points')).toHaveText('+12 puntos');
    await page.getByRole('button', { name: 'Ver resultado' }).click();

    // 12 + 8 + 13 + 9 before, and 12 now.
    await expect(page.locator('.d-total strong')).toHaveText('54');
    await expect(page.locator('.d-summary .d-hard')).toHaveText('Difícil');
    const text = await page.locator('.d-share textarea').inputValue();
    expect(text).toContain('Reto difícil del 18 de noviembre de 2026');
    expect(text).toContain('54/100 ★');
    expect(text).toMatch(new RegExp(`#/reto/${TODAY}/c8d9cx$`));
    const rec = await kept(page);
    expect(rec).toMatchObject({ p: [12, 8, 13, 9, 12], h: 1 });
    expect(rec.t).toBeGreaterThan(0);
  });

  test('is offered first to whoever finished the last challenge that way', async ({ page }) => {
    await seed(page, { daily: { [PAST]: done(PAST, { h: 1 }) } });
    await open(page, '/reto');
    await expect(way(page, 'Difícil')).toBeChecked();
    await expect(steps(page).first()).toContainText('girada y en cuatro intentos');
    // The result of that day carries its mark; one played the plain way does not.
    await open(page, `/reto/${PAST}`);
    await expect(page.locator('.d-summary .d-hard')).toHaveText('Difícil');
  });

  test('is marked in the calendar, counted in the statistics and told apart in the comparison', async ({ page }) => {
    await seed(page, { daily: { [PAST]: done(PAST, { h: 1 }), '2026-11-13': done('2026-11-13'), [TODAY]: done(TODAY) } });
    // Ana sends a hard result of today's: 73 points.
    await page.goto(`./#/reto/${TODAY}/gkdccx.QW5h`);
    await expect(page.locator('.d-summary .d-hard')).toHaveCount(0);
    await expect(page.locator('.d-vs-verdict')).toHaveText('Gana Ana por 12 puntos');
    const rows = page.locator('.d-vs tbody tr');
    await expect(rows.nth(0).locator('.d-vs-hard')).toHaveAttribute('aria-label', 'en difícil');
    await expect(rows.nth(1).locator('.d-vs-hard')).toHaveCount(0);
    await expect(page.locator('.d-vs .d-hint')).toContainText('Con estrella, quien lo jugó en difícil: las mismas pruebas con menos ayudas.');

    await expect(page.locator('.d-cal-day.is-hard')).toHaveCount(1);
    await expect(page.locator('.d-cal-day.is-hard')).toHaveAttribute('aria-label', /^12 de noviembre · .+ · 61\/100 · en difícil$/);
    await expect(page.locator('.d-stats > .d-hint')).toContainText('Uno lo jugaste en difícil.');
  });

  test('is told in English', async ({ page }) => {
    await seed(page, { lang: 'en', daily: { [PAST]: done(PAST, { h: 1 }) } });
    await open(page, '/reto');
    const group = page.getByRole('radiogroup', { name: 'How you play it' });
    await expect(group.getByRole('radio', { name: 'Hard' })).toBeChecked();
    await expect(steps(page)).toContainText(['turned and in four tries.', 'with one try at each.', 'with no hints.', 'without its continent.', 'typing the answer.']);
    await open(page, `/reto/${PAST}`);
    await expect(page.locator('.d-summary .d-hard')).toHaveText('Hard');
    expect(await page.locator('.d-share textarea').inputValue()).toContain('Hard challenge of 12 November 2026');
  });

  test('fits a phone: the choice, and the typed questions @movil', async ({ page }) => {
    await seed(page, {});
    await open(page, '/reto');
    await way(page, 'Difícil').click();
    const width = await page.evaluate(() => document.documentElement.clientWidth);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const seg = (await page.getByRole('radiogroup', { name: 'Cómo lo juegas' }).boundingBox())!;
    expect(seg.x).toBeGreaterThanOrEqual(0);
    expect(seg.x + seg.width).toBeLessThanOrEqual(width);

    await page.evaluate((day) => {
      const saved = JSON.parse(localStorage.getItem('regionle:v1')!);
      saved.state.daily = { [day]: { p: [12, 8, 13, 9, null], k: [3, 2, 2, 4, null], h: 1 } };
      localStorage.setItem('regionle:v1', JSON.stringify(saved));
    }, TODAY);
    await page.reload();
    await page.getByRole('button', { name: 'Seguir: prueba 5' }).click();
    await expect(page.locator('.d-quick .answer-input')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await type(page, 'Italia');
    await expect(page.locator('.d-quick .kicker')).toContainText('2 / 5');
  });
});
