/**
 * The special days of the year: each has a challenge that opens on its day for a week, the same for everyone,
 * and whose result is kept the first time it is played to the end. The rest of the year the calendar plays
 * the same game for practice, which is a game like any other.
 */
import { expect, test, type Page } from '@playwright/test';
import { asAnother, card, finish, giveUp, hud, note, percent, subtitle, title } from './dated';
import { OPTS, open, seed } from './helpers';

// The clock of these tests is set by hand, and so is where it is read: their days are Madrid's, whatever
// E2E_ZONE says (playwright.config.ts).
test.use({ timezoneId: 'Europe/Madrid' });

/** Any hour of a day in Madrid. */
const at = (day: string, hour = '12:00'): Date => new Date(`${day}T${hour}:00+01:00`);
/** A day of November with no challenge open: the next one is that of 6 December. */
const QUIET = at('2026-11-18');
/** The day of the Spanish Constitution: its challenge, the nineteen communities and cities, opens. */
const OPENING = at('2026-12-06');
const NAME = 'Día de la Constitución Española';

interface Kept {
  occasions: Record<string, { y: number; s: number; ok: number; n: number; ms: number; t: number }>;
  game: { occasion?: { id: string; year: number }; challenge?: { seed: number }; section: string; mode: string; countries: string[]; levels: Record<string, string>; opts: Record<string, unknown> } | null;
  sessions: { total: number }[];
  recent: unknown[];
  weekly: Record<string, unknown>;
  zones: Record<string, unknown>;
}
const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as Kept);

/** The part of the card of the special days, the row of one that is open, and the next one to come. */
const dates = (page: Page) => page.locator('.more-dates');
const row = (page: Page, id: string) => page.locator(`.more-day[data-occasion="${id}"]`);
const next = (page: Page) => page.locator('.more-next');
/** The calendar, and the line of a day in it. */
const calendar = (page: Page) => page.locator('dialog.dates-dialog');
const line = (page: Page, id: string) => calendar(page).locator(`.dates-row[data-occasion="${id}"]`);
const openCalendar = async (page: Page): Promise<void> => {
  await dates(page).getByRole('button', { name: 'Ver el calendario' }).click();
  await expect(calendar(page)).toBeVisible();
};
/** What the parts of the card are, in the order they come. */
const parts = (page: Page) => page.locator('.more > *').evaluateAll((all) => all.map((el) => el.className.split(' ')[0]));
const record = (y: number, s: number, ok: number, n: number, t = 1_780_000_000_000) => ({ y, s, ok, n, ms: 190_000, t });

test.describe('the special days on the first page', () => {
  test('say which one comes next, at the foot of the card, while none is open', async ({ page }) => {
    await page.clock.setFixedTime(QUIET);
    await seed(page, { opts: OPTS });
    await open(page);
    await expect(dates(page)).toBeVisible();
    expect(await parts(page)).toEqual(['more-part', 'more-part', 'more-dates']);
    await expect(dates(page).getByRole('heading', { level: 2 })).toHaveText('Fechas señaladas');
    await expect(next(page)).toHaveText(`Próxima: ${NAME}, el 6 de diciembre (dentro de 18 días). Las comunidades y ciudades autónomas de España: el reto se abre ese día y dura una semana.`);
    // Nothing to play here until then.
    await expect(page.locator('.more-day')).toHaveCount(0);
    await expect(dates(page).getByRole('button')).toHaveText(['Ver el calendario']);

    // The eve of the day.
    await page.clock.setFixedTime(at('2026-12-05'));
    await page.reload();
    await expect(next(page)).toContainText(`Próxima: ${NAME}, el 6 de diciembre (mañana).`);
    // After the last one of the year, the first of the next.
    await page.clock.setFixedTime(at('2026-12-28'));
    await page.reload();
    await expect(next(page)).toHaveText('Próxima: Año Nuevo, el 1 de enero (dentro de 4 días). Los países de Oceanía, los primeros en estrenar el año: el reto se abre ese día y dura una semana.');
  });

  test('come first while a challenge is open, with what it asks, how long it lasts and its button', async ({ page }) => {
    await page.clock.setFixedTime(OPENING);
    await seed(page, { opts: OPTS });
    await open(page);
    await expect(row(page, 'constitution')).toBeVisible();
    expect(await parts(page)).toEqual(['more-dates', 'more-part', 'more-part']);
    await expect(page.locator('.more-day')).toHaveCount(1);
    await expect(row(page, 'constitution').getByRole('heading', { level: 3 })).toHaveText(NAME);
    // The national day of a country goes with its flag.
    await expect(row(page, 'constitution').locator('.more-day-name img')).toHaveAttribute('src', /flags\/.*es/i);
    await expect(row(page, 'constitution').locator('.more-text')).toHaveText('Las comunidades y ciudades autónomas de España: 19 preguntas, las mismas para todo el mundo.');
    await expect(row(page, 'constitution').locator('.more-meta')).toHaveText('Hoy · Abierto hasta el 12 de diciembre');
    await expect(row(page, 'constitution').getByRole('button')).toHaveText('Jugar');
    await expect(row(page, 'constitution').getByRole('button')).toHaveAccessibleName(`Jugar: ${NAME}`);
    // The one to come is not told while there is one to play.
    await expect(next(page)).toHaveCount(0);
    // The week and the continents are still there, under it.
    await expect(card(page).getByRole('button', { name: 'Jugar el reto de la semana' })).toBeVisible();

    // Five days later another one opens: the latest first, each with its dates.
    await page.clock.setFixedTime(at('2026-12-11'));
    await page.reload();
    await expect(page.locator('.more-day')).toHaveCount(2);
    await expect(page.locator('.more-day-name')).toHaveText(['Día Internacional de las Montañas', NAME]);
    await expect(page.locator('.more-day .more-meta')).toHaveText(['Hoy · Abierto hasta el 17 de diciembre', '6 de diciembre · Abierto hasta el 12 de diciembre']);
    // An international day has no flag, nor the room of one.
    await expect(row(page, 'mountains').locator('.flag')).toHaveCount(0);
    await expect(row(page, 'mountains').locator('.more-text')).toHaveText('Cordilleras y picos del mundo: 20 preguntas, las mismas para todo el mundo.');

    // The seventh day is the last one; on the eighth it is gone.
    await page.clock.setFixedTime(at('2026-12-12', '23:30'));
    await page.reload();
    await expect(row(page, 'constitution').locator('.more-meta')).toHaveText('6 de diciembre · Último día');
    await page.clock.setFixedTime(at('2026-12-13', '00:30'));
    await page.reload();
    await expect(page.locator('.more-day-name')).toHaveText(['Día Internacional de las Montañas']);
  });

  test('speak English to whoever plays in English', async ({ page }) => {
    await page.clock.setFixedTime(OPENING);
    await seed(page, { opts: OPTS, lang: 'en' });
    await open(page);
    await expect(dates(page).getByRole('heading', { level: 2 })).toHaveText('Special days');
    await expect(row(page, 'constitution').getByRole('heading', { level: 3 })).toHaveText('Spain’s Constitution Day');
    await expect(row(page, 'constitution').locator('.more-text')).toHaveText('The autonomous communities and cities of Spain: 19 questions, the same for everybody.');
    await expect(row(page, 'constitution').locator('.more-meta')).toHaveText('Today · Open until 12 December');
    await dates(page).getByRole('button', { name: 'See the calendar' }).click();
    await expect(calendar(page).getByRole('heading', { level: 2 })).toHaveText('Special days');
    await expect(line(page, 'europe').getByRole('button')).toHaveAccessibleName('Practise: Europe Day');
    await expect(line(page, 'constitution').locator('.dates-tag')).toHaveText('Open until 12 December');
    await expect(line(page, 'mountains').locator('.dates-tag')).toHaveText('Next: in 5 days');
    await line(page, 'constitution').getByRole('button', { name: 'Play: Spain’s Constitution Day' }).click();
    await expect(subtitle(page)).toHaveText('Spain’s Constitution Day');
    await expect(hud(page)).toHaveText('1 / 19');
    await page.getByRole('button', { name: "I don't know" }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(hud(page)).toHaveText('2 / 19');
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(note(page)).toHaveText('Spain’s Constitution Day: you left it before the end, so nothing goes on record. You can start it again.');
  });
});

test.describe('the challenge of a special day', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(OPENING);
  });

  test('is a game on the map of its day whose result goes on record, and the first page shows it', async ({ page }) => {
    await seed(page, { opts: OPTS });
    await open(page);
    await row(page, 'constitution').getByRole('button', { name: `Jugar: ${NAME}` }).click();
    await expect(page).toHaveURL(/#\/jugar$/);
    await expect(title(page)).toHaveText('Popurrí');
    await expect(subtitle(page)).toHaveText(NAME);
    expect((await kept(page)).game).toMatchObject({ section: 'regions', mode: 'mix', countries: ['ES'], levels: { ES: 'g1' }, occasion: { id: 'constitution', year: 2026 } });
    // Some answered for real, the rest given up: whatever it scores, it is what goes on record.
    await finish(page, 19, 5);
    const score = (await percent(page).textContent())!;
    expect(score).toMatch(/^\d+ %$/);
    await expect(note(page)).toHaveText(`${NAME}: queda apuntado tu ${score}.`);
    const mine = (await kept(page)).occasions.constitution;
    expect(mine).toMatchObject({ y: 2026, s: Number.parseInt(score, 10), n: 19 });
    expect(Object.keys((await kept(page)).occasions)).toEqual(['constitution']);
    // It counts as a game like any other; it is none of the business of the week or of the continents; and
    // it is not a map to come back to among those played lately: it is offered here, on its day.
    expect((await kept(page)).sessions).toMatchObject([{ total: 19 }]);
    expect((await kept(page)).weekly).toEqual({});
    expect((await kept(page)).zones).toEqual({});
    expect((await kept(page)).recent).toEqual([]);
    // Like any game, it can be sent to someone with its questions.
    await expect(page.locator('.duel').getByRole('button', { name: 'Retar a alguien' })).toBeVisible();

    // Leaving it goes back to the first page, which is where it was started.
    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(row(page, 'constitution').locator('.more-score')).toHaveText(score);
    await expect(row(page, 'constitution').locator('.more-text')).toContainText(`${mine.ok} de 19 a la primera`);
    await expect(row(page, 'constitution').locator('.more-text')).toContainText('Las comunidades y ciudades autónomas de España.');
    await expect(row(page, 'constitution').locator('.more-meta')).toHaveText('Hoy · Otra vez ya no cuenta');
    // It is kept in the browser: there when the page is opened again; and the calendar has it done.
    await page.reload();
    await expect(row(page, 'constitution').locator('.more-score')).toHaveText(score);
    expect((await kept(page)).occasions.constitution).toEqual(mine);
    await openCalendar(page);
    await expect(line(page, 'constitution').locator('.dates-tag')).toHaveText(`Hecho: ${score}`);
    await expect(calendar(page).locator('.dates-sum')).toHaveText('En 2026 has jugado 1 de las 32 fechas.');
    await page.keyboard.press('Escape');
    await expect(calendar(page)).toHaveCount(0);

    // Played again, it is the same game and changes nothing: the first time is the one that counts.
    await row(page, 'constitution').getByRole('button', { name: `Jugar otra vez: ${NAME}` }).click();
    await expect(subtitle(page)).toHaveText(NAME);
    await expect(hud(page)).toHaveText('1 / 19');
    await giveUp(page);
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(note(page)).toHaveText(`${NAME}: ya tenías apuntado un ${score}. Cuenta la primera vez que se termina.`);
    expect((await kept(page)).occasions.constitution).toEqual(mine);
    // From here, again is a game like any other, with questions of its own and nothing to write down.
    await page.getByRole('button', { name: 'Otra vez' }).click();
    await expect(hud(page)).toHaveText('1 / 19');
    await expect(subtitle(page)).toHaveText('España · comunidades autónomas');
    expect((await kept(page)).game?.occasion).toBeUndefined();
    expect((await kept(page)).game?.challenge).toBeUndefined();
  });

  test('is not written down when it is left before the end, and again is the same challenge', async ({ page }) => {
    await seed(page, { opts: OPTS });
    await open(page);
    await row(page, 'constitution').getByRole('button').click();
    await expect(hud(page)).toHaveText('1 / 19');
    const first = [await giveUp(page), await giveUp(page)];
    await expect(hud(page)).toHaveText('3 / 19');
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(note(page)).toHaveText(`${NAME}: lo has dejado antes del final y no se apunta. Puedes empezarlo otra vez.`);
    expect((await kept(page)).occasions).toEqual({});

    await page.getByRole('button', { name: 'Otra vez' }).click();
    await expect(subtitle(page)).toHaveText(NAME);
    await expect(hud(page)).toHaveText('1 / 19');
    expect((await kept(page)).game?.occasion).toEqual({ id: 'constitution', year: 2026 });
    // The same questions, in the same order.
    expect([await giveUp(page), await giveUp(page)]).toEqual(first);

    // "Salir" leaves it for the first page, where it is still to be played.
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(row(page, 'constitution').getByRole('button')).toHaveAccessibleName(`Jugar: ${NAME}`);
    await expect(row(page, 'constitution').locator('.more-score')).toHaveCount(0);
  });

  test('asks everyone the same, whatever each player has set for their own games, and other things the year after', async ({ page }) => {
    await seed(page, { opts: OPTS });
    await open(page);
    await row(page, 'constitution').getByRole('button').click();
    await expect(hud(page)).toHaveText('1 / 19');
    const mine = [await giveUp(page), await giveUp(page), await giveUp(page), await giveUp(page)];
    expect(new Set(mine).size).toBe(4);

    // Another player: answers typed, ten questions, flags to point at, outlines turned, three lives.
    await asAnother(page, { answer: 'type', length: 10, pinBy: 'flag', turned: true, flagLook: 'grey', format: 'lives' });
    await row(page, 'constitution').getByRole('button').click();
    await expect(hud(page)).toHaveText('1 / 19');
    await expect(page.locator('.answer-input')).toHaveCount(0);
    expect([await giveUp(page), await giveUp(page), await giveUp(page), await giveUp(page)]).toEqual(mine);
    // Their own options are as they left them.
    expect((await kept(page)).game?.opts).toMatchObject({ answer: 'choice', length: 'all', pinBy: 'name', turned: false, flagLook: 'plain', format: 'normal' });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state.opts)).toMatchObject({ answer: 'type', length: 10, pinBy: 'flag', turned: true, flagLook: 'grey', format: 'lives' });

    // The same day of 2027: the same map, asked in another order.
    await page.clock.setFixedTime(at('2027-12-06'));
    await asAnother(page, {});
    await row(page, 'constitution').getByRole('button').click();
    await expect(hud(page)).toHaveText('1 / 19');
    expect((await kept(page)).game?.occasion).toEqual({ id: 'constitution', year: 2027 });
    expect([await giveUp(page), await giveUp(page), await giveUp(page), await giveUp(page)]).not.toEqual(mine);
  });

  test('is another one each year: the one of last year stays in the calendar, and this year is to be played', async ({ page }) => {
    await page.clock.setFixedTime(at('2027-12-07'));
    await seed(page, { opts: OPTS, occasions: { constitution: record(2026, 86, 16, 19), europe: record(2027, 70, 19, 27), water: record(2027, 55, 11, 20) } });
    await open(page);
    // Last year's result is not this year's: the challenge is open and still to be played.
    await expect(row(page, 'constitution').locator('.more-score')).toHaveCount(0);
    await expect(row(page, 'constitution').locator('.more-meta')).toHaveText('6 de diciembre · Abierto hasta el 12 de diciembre');
    await openCalendar(page);
    await expect(calendar(page).locator('.dates-sum')).toHaveText('En 2027 has jugado 2 de las 32 fechas.');
    await expect(line(page, 'constitution').locator('.dates-tag')).toHaveText('Abierto hasta el 12 de diciembre');
    await expect(line(page, 'europe').locator('.dates-tag')).toHaveText('70 % en 2027');
    await line(page, 'constitution').getByRole('button', { name: `Jugar: ${NAME}` }).click();
    await finish(page, 19);
    await expect(note(page)).toHaveText(`${NAME}: queda apuntado tu 0 %.`);
    // Of each day the last year is kept: 2027 takes the place of 2026.
    expect((await kept(page)).occasions.constitution).toMatchObject({ y: 2027, s: 0, n: 19 });
    expect(Object.keys((await kept(page)).occasions).sort()).toEqual(['constitution', 'europe', 'water']);
  });
});

test.describe('each kind of special day', () => {
  const cases = [
    { id: 'water', day: '2026-03-22', name: 'Día Mundial del Agua', what: 'Los grandes ríos del mundo: 20 preguntas, las mismas para todo el mundo.', title: 'Popurrí', total: 20, game: { section: 'physical', mode: 'mix', countries: ['river'], levels: {} } },
    { id: 'deserts', day: '2026-06-17', name: 'Día contra la Desertificación y la Sequía', what: 'Los desiertos del mundo: 19 preguntas, las mismas para todo el mundo.', title: 'Popurrí', total: 19, game: { section: 'physical', mode: 'mix', countries: ['desert', 'all'] } },
    { id: 'un', day: '2026-10-24', name: 'Día de las Naciones Unidas', what: 'Las banderas de los países miembros: 20 preguntas, las mismas para todo el mundo.', title: 'Banderas', total: 20, game: { section: 'countries', mode: 'flag', levels: {} } },
    { id: 'europe', day: '2026-05-09', name: 'Día de Europa', what: 'Los países de la Unión Europea: 27 preguntas, las mismas para todo el mundo.', title: 'Popurrí', total: 27, game: { section: 'countries', mode: 'mix' } },
    { id: 'spain', day: '2026-10-12', name: 'Fiesta Nacional de España', what: 'Las provincias de España: 52 preguntas, las mismas para todo el mundo.', title: 'Popurrí', total: 52, game: { section: 'regions', mode: 'mix', countries: ['ES'], levels: { ES: 'f' } } },
  ];
  for (const c of cases) {
    test(`opens on its day with the map and the questions it says: ${c.id}`, async ({ page }) => {
      await page.clock.setFixedTime(at(c.day));
      await seed(page, { opts: OPTS });
      await open(page);
      await expect(row(page, c.id).getByRole('heading', { level: 3 })).toHaveText(c.name);
      await expect(row(page, c.id).locator('.more-text')).toHaveText(c.what);
      await row(page, c.id).getByRole('button', { name: `Jugar: ${c.name}` }).click();
      await expect(title(page)).toHaveText(c.title);
      await expect(subtitle(page)).toHaveText(c.name);
      // As many questions as the card said.
      await expect(hud(page)).toHaveText(`1 / ${c.total}`, { timeout: 30_000 });
      expect((await kept(page)).game).toMatchObject({ ...c.game, occasion: { id: c.id, year: 2026 } });
      // Four options, whatever the player has set, where the answer is not pointed at on the map.
      await expect(page.locator('.answer-input')).toHaveCount(0);
      const first = await giveUp(page);
      expect(first.length).toBeGreaterThan(0);
      await expect(hud(page)).toHaveText(`2 / ${c.total}`);
    });
  }
});

test.describe('a special day left in the browser', () => {
  /** The challenge of the Constitution of a year, as the game leaves it in the browser while it is played. */
  const left = (year: number) => ({
    section: 'regions',
    mode: 'mix',
    countries: ['ES'],
    levels: { ES: 'g1' },
    opts: { ...OPTS, answer: 'choice', length: 'all', pinBy: 'name', turned: false, flagLook: 'plain', format: 'normal' },
    challenge: { seed: 1769514939 },
    occasion: { id: 'constitution', year },
    nonce: 1,
  });

  test('is still its challenge while its week lasts, and its result goes on record', async ({ page }) => {
    await page.clock.setFixedTime(at('2026-12-12', '22:00'));
    await seed(page, { opts: OPTS, game: left(2026) });
    await page.goto('./#/jugar');
    await expect(subtitle(page)).toHaveText(NAME);
    await expect(hud(page)).toHaveText('1 / 19');
    expect((await kept(page)).game?.occasion).toEqual({ id: 'constitution', year: 2026 });
    // Midnight comes while it is played: it is the game that was started, and it counts.
    await giveUp(page);
    await page.clock.setFixedTime(at('2026-12-13', '00:10'));
    await finish(page, 19, 0, 2);
    await expect(note(page)).toHaveText(`${NAME}: queda apuntado tu 0 %.`);
    expect((await kept(page)).occasions.constitution).toMatchObject({ y: 2026, n: 19 });
  });

  test('becomes the same game for practice when its page comes back after its week: nothing goes on record', async ({ page }) => {
    await page.clock.setFixedTime(at('2026-12-20'));
    await seed(page, { opts: OPTS, game: left(2026) });
    await page.goto('./#/jugar');
    await expect(hud(page)).toHaveText('1 / 19');
    await expect(title(page)).toHaveText('Popurrí');
    await expect(subtitle(page)).toHaveText('España · comunidades autónomas');
    const game = (await kept(page)).game;
    expect(game).toMatchObject({ section: 'regions', mode: 'mix', countries: ['ES'], levels: { ES: 'g1' } });
    expect(game?.occasion).toBeUndefined();
    expect(game?.challenge).toBeUndefined();
    await finish(page, 19);
    await expect(note(page)).toHaveCount(0);
    expect((await kept(page)).occasions).toEqual({});
    // A game like any other: it leaves for its section, and counts as one.
    await expect(page.getByRole('button', { name: 'Cambiar de juego' })).toBeVisible();
    expect((await kept(page)).sessions).toMatchObject([{ total: 19 }]);
  });

  test('becomes the challenge of this year when the one left is of the year before and its week is open again', async ({ page }) => {
    await page.clock.setFixedTime(at('2027-12-08'));
    await seed(page, { opts: OPTS, game: left(2026) });
    await page.goto('./#/jugar');
    await expect(subtitle(page)).toHaveText(NAME);
    await expect(hud(page)).toHaveText('1 / 19');
    const game = (await kept(page)).game;
    expect(game?.occasion).toEqual({ id: 'constitution', year: 2027 });
    expect(game?.challenge?.seed).not.toBe(1769514939);
  });

  test('is the game for practice, too, when the first page has been open since before its week ended', async ({ page }) => {
    await page.clock.setFixedTime(at('2026-12-12', '23:50'));
    await seed(page, { opts: OPTS });
    await open(page);
    await expect(row(page, 'constitution').locator('.more-meta')).toHaveText('6 de diciembre · Último día');
    // The page is still there the morning after, saying what it said.
    await page.clock.setFixedTime(at('2026-12-13', '08:00'));
    await row(page, 'constitution').getByRole('button').click();
    await expect(hud(page)).toHaveText('1 / 19');
    await expect(subtitle(page)).toHaveText('España · comunidades autónomas');
    expect((await kept(page)).game?.occasion).toBeUndefined();
    expect((await kept(page)).game?.challenge).toBeUndefined();
    // A game like any other leaves for its section, not for the first page.
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/#\/regiones$/);
    // The first page is now that of the 13th: only the mountains are open.
    await open(page);
    await expect(page.locator('.more-day-name')).toHaveText(['Día Internacional de las Montañas']);
  });

  test('is not what the first page offers to go on with: its button is on the card', async ({ page }) => {
    await page.clock.setFixedTime(OPENING);
    await seed(page, { opts: OPTS, game: left(2026) });
    await open(page);
    await expect(row(page, 'constitution')).toBeVisible();
    await expect(page.locator('.hero-cta button')).toHaveText(['Empezar con las regiones']);
  });
});

test.describe('the calendar of the special days', () => {
  test('lists the thirty-two days of the year and opens on the one that is on, which it plays as the challenge', async ({ page }) => {
    await page.clock.setFixedTime(OPENING);
    await seed(page, { opts: OPTS, occasions: { europe: record(2026, 86, 23, 27), water: record(2026, 70, 14, 20), spain: record(2025, 92, 48, 52) } });
    await open(page);
    await openCalendar(page);
    await expect(calendar(page).getByRole('heading', { level: 2 })).toHaveText('Fechas señaladas');
    await expect(calendar(page).locator('.dates-how')).toContainText('se abre ese día, dura una semana y cuenta la primera vez que lo terminas');
    await expect(calendar(page).locator('.dates-sum')).toHaveText('En 2026 has jugado 2 de las 32 fechas.');
    await expect(calendar(page).locator('.dates-row')).toHaveCount(32);
    // In the order of the year, each with its day.
    await expect(calendar(page).locator('.dates-row').first()).toContainText('Año Nuevo');
    await expect(calendar(page).locator('.dates-day').first()).toHaveText('1 de enero');
    await expect(calendar(page).locator('.dates-row').last()).toContainText('Día Mundial de la Lengua Árabe');
    await expect(line(page, 'spain').locator('small')).toHaveText('Las provincias de España · 52 preguntas');
    // The one that is open is in sight, with its button to play it; the rest are for practice.
    await expect(line(page, 'constitution')).toBeInViewport();
    await expect(line(page, 'constitution')).toHaveClass(/\bdates-open\b/);
    await expect(line(page, 'constitution').locator('.dates-tag')).toHaveText('Abierto hasta el 12 de diciembre');
    await expect(calendar(page).locator('.dates-open')).toHaveCount(1);
    await expect(calendar(page).getByRole('button', { name: /^Practicar: / })).toHaveCount(31);
    await expect(line(page, 'mountains').locator('.dates-tag')).toHaveText('Próxima: dentro de 5 días');
    // What was played of each: this year's, and the one of a year before.
    await expect(line(page, 'europe').locator('.dates-tag')).toHaveText('86 % en 2026');
    await expect(line(page, 'spain').locator('.dates-tag')).toHaveText('92 % en 2025');
    await expect(line(page, 'france').locator('.dates-tag')).toHaveCount(0);

    await line(page, 'constitution').getByRole('button', { name: `Jugar: ${NAME}` }).click();
    await expect(page).toHaveURL(/#\/jugar$/);
    await expect(calendar(page)).toHaveCount(0);
    await expect(subtitle(page)).toHaveText(NAME);
    expect((await kept(page)).game?.occasion).toEqual({ id: 'constitution', year: 2026 });
  });

  test('plays any day for practice out of its week: a game like any other, with nothing to keep', async ({ page }) => {
    await page.clock.setFixedTime(QUIET);
    await seed(page, { opts: OPTS });
    await open(page);
    await openCalendar(page);
    await expect(calendar(page).locator('.dates-sum')).toHaveText('En 2026 aún no has jugado ninguna de las 32 fechas.');
    // None is open: the calendar opens on the next one to come.
    await expect(calendar(page).locator('.dates-open')).toHaveCount(0);
    await expect(line(page, 'constitution')).toBeInViewport();
    await expect(line(page, 'constitution').locator('.dates-tag')).toHaveText('Próxima: dentro de 18 días');
    await expect(calendar(page).getByRole('button', { name: /^Practicar: / })).toHaveCount(32);

    await line(page, 'europe').getByRole('button', { name: 'Practicar: Día de Europa' }).click();
    await expect(page).toHaveURL(/#\/jugar$/);
    await expect(title(page)).toHaveText('Popurrí');
    await expect(hud(page)).toHaveText('1 / 27');
    await expect(subtitle(page)).not.toContainText('Día de Europa');
    const game = (await kept(page)).game;
    expect(game).toMatchObject({ section: 'countries', mode: 'mix', opts: { answer: 'choice', length: 'all' } });
    expect(game?.countries).toHaveLength(27);
    expect(game?.occasion).toBeUndefined();
    expect(game?.challenge).toBeUndefined();
    await finish(page, 27);
    await expect(note(page)).toHaveCount(0);
    expect((await kept(page)).occasions).toEqual({});
    await expect(page.getByRole('button', { name: 'Cambiar de juego' })).toBeVisible();
  });

  test('is put away with the key or its button, and the keyboard goes back to where it was', async ({ page }) => {
    await page.clock.setFixedTime(QUIET);
    await seed(page, { opts: OPTS });
    await open(page);
    const opener = dates(page).getByRole('button', { name: 'Ver el calendario' });
    await opener.focus();
    await page.keyboard.press('Enter');
    await expect(calendar(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(calendar(page)).toHaveCount(0);
    await expect(opener).toBeFocused();
    // And again, as many times as it is asked for.
    await opener.click();
    await expect(calendar(page)).toBeVisible();
    await calendar(page).getByRole('button', { name: 'Cerrar' }).click();
    await expect(calendar(page)).toHaveCount(0);
    await expect(page).toHaveURL(/#\/$/);
  });

  test('says so when its code does not come, with the way to have it: the page loaded again', async ({ page }) => {
    await page.clock.setFixedTime(QUIET);
    await seed(page, { opts: OPTS });
    await open(page);
    await expect(dates(page)).toBeVisible();
    let asked = 0;
    await page.route(/\/assets\/OccasionCalendar-[^/]+\.js$/, (route) => {
      asked += 1;
      return route.abort();
    });
    await dates(page).getByRole('button', { name: 'Ver el calendario' }).click();
    const alert = dates(page).getByRole('alert');
    await expect(alert.locator('p')).toHaveText('No se ha podido abrir el calendario. Suele ser la conexión, o que hay una versión nueva del juego: recarga la página y vuelve a intentarlo.');
    expect(asked).toBeGreaterThan(0);
    // The card is all there, and so is the page.
    await expect(next(page)).toBeVisible();
    await expect(card(page).getByRole('button', { name: 'Jugar el reto de la semana' })).toBeVisible();
    await expect(page.locator('.hero-title')).toBeVisible();
    // Asking again says the same, once: nothing piles up.
    await dates(page).getByRole('button', { name: 'Ver el calendario' }).click();
    await expect(alert).toHaveCount(1);
    await expect(calendar(page)).toHaveCount(0);

    // The connection is back: the page is loaded again from its button, and the calendar comes.
    await page.unroute(/\/assets\/OccasionCalendar-[^/]+\.js$/);
    await alert.getByRole('button', { name: 'Recargar la página' }).click();
    await expect(dates(page)).toBeVisible();
    await expect(dates(page).getByRole('alert')).toHaveCount(0);
    await openCalendar(page);
    await expect(calendar(page).locator('.dates-row')).toHaveCount(32);
  });

  test('is not fetched until it is asked for', async ({ page }) => {
    await page.clock.setFixedTime(OPENING);
    const fetched: string[] = [];
    page.on('request', (r) => fetched.push(r.url()));
    await seed(page, { opts: OPTS });
    await open(page);
    await expect(row(page, 'constitution')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(fetched.filter((url) => /OccasionCalendar/.test(url))).toEqual([]);
    await openCalendar(page);
    expect(fetched.filter((url) => /OccasionCalendar-[^/]+\.js$/.test(url)).length).toBeGreaterThan(0);
  });
});

test.describe('the special days on a phone @movil', () => {
  /** Three challenges open at once, one of them done, on the narrowest screen, read as `reading` says; then the calendar. */
  async function fits(page: Page, reading: Record<string, unknown>): Promise<void> {
    await page.clock.setFixedTime(at('2026-07-14'));
    await seed(page, { opts: OPTS, ...reading, occasions: { population: record(2026, 86, 26, 30), water: record(2026, 70, 14, 20) } });
    await page.setViewportSize({ width: 320, height: 640 });
    await open(page);
    await expect(page.locator('.more-day')).toHaveCount(3);
    await expect(page.locator('.more-day-name')).toHaveText(['Fiesta nacional de Francia', 'Día Mundial de la Población', 'Día de la Independencia de Argentina']);
    const fit = await page.evaluate(() => {
      const wide = document.documentElement.clientWidth;
      const over = [...document.querySelectorAll('.more-dates *')].filter((el) => el.getBoundingClientRect().right > wide + 0.5).map((el) => el.getAttribute('class') || el.tagName);
      // Words that do not fit go on to another line: none is cut short, nor spills out of its box.
      const cut = [...document.querySelectorAll<HTMLElement>('.more-dates button, .more-day-name, .more-dates .more-meta, .more-dates .more-text')].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent);
      // Each day under the one before, and its button under what it says.
      const rows = [...document.querySelectorAll('.more-day')].map((el) => el.getBoundingClientRect());
      const stacked = rows.every((r, i) => i === 0 || r.top >= rows[i - 1].bottom - 0.5);
      const under = [...document.querySelectorAll('.more-day')].every((el) => el.querySelector('.more-go')!.getBoundingClientRect().top >= el.querySelector('.more-day-what')!.getBoundingClientRect().bottom - 0.5);
      return { page: document.documentElement.scrollWidth - wide, over, cut, stacked, under };
    });
    expect(fit).toEqual({ page: 0, over: [], cut: [], stacked: true, under: true });

    await openCalendar(page);
    // It opens on the first of the three that are open, in the order of the year.
    await expect(line(page, 'argentina')).toBeInViewport();
    await expect(calendar(page).locator('.dates-open')).toHaveCount(3);
    const inside = await page.evaluate(() => {
      const box = document.querySelector('.dates-dialog .dlg-box')!;
      const { left, right } = box.getBoundingClientRect();
      const over = [...box.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().right > right + 0.5 || el.getBoundingClientRect().left < left - 0.5).map((el) => el.getAttribute('class') || el.tagName);
      const cut = [...box.querySelectorAll<HTMLElement>('button, .dates-name, .dates-tag, small, time')].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent);
      return { page: document.documentElement.scrollWidth - document.documentElement.clientWidth, sideways: box.scrollWidth - box.clientWidth, wide: right <= document.documentElement.clientWidth + 0.5, over, cut };
    });
    expect(inside).toEqual({ page: 0, sideways: 0, wide: true, over: [], cut: [] });
    // Every day can be reached with a finger: the list moves under it.
    await line(page, 'arabic').scrollIntoViewIfNeeded();
    await expect(line(page, 'arabic').getByRole('button')).toBeInViewport();
    await line(page, 'france').getByRole('button', { name: 'Jugar: Fiesta nacional de Francia' }).tap();
    await expect(subtitle(page)).toHaveText('Fiesta nacional de Francia');
    await expect(hud(page)).toHaveText('1 / 13');
  }

  test('fit a narrow screen with large text, each day under the one before, and so does the calendar', ({ page }) => fits(page, { textSize: 'xl', dyslexia: true }));

  test('fit a narrow screen with the text as it comes too', ({ page }) => fits(page, {}));
});
