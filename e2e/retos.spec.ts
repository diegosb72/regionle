/**
 * More challenges on the first page: the one of the week, a long game that is the same for everyone from
 * Monday to Sunday, and those of the day of a continent or a country, ten questions each. Each is a game
 * like any other; its result is kept the first time it is played to the end.
 */
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, seed } from './helpers';

// The clock of these tests is set by hand, and so is where it is read: their days are Madrid's, whatever
// E2E_ZONE says (playwright.config.ts).
test.use({ timezoneId: 'Europe/Madrid' });

/** Noon of Wednesday 18 November 2026 in Madrid: its week, from the 16th to the 22nd, asks a medley of the world. */
const NOW = new Date('2026-11-18T12:00:00+01:00');
const TODAY = '2026-11-18';
const WEEK = '2026-11-16';
const TOMORROW = new Date('2026-11-19T12:00:00+01:00');

interface Kept {
  weekly: Record<string, { s: number; ok: number; n: number; ms: number; t: number }>;
  zones: Record<string, { d: string; s: number; ok: number; n: number; ms: number; run: number }>;
  game: { weekly?: string; zone?: { id: string; date: string }; levels: Record<string, string>; opts: Record<string, unknown> } | null;
}
const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as Kept);

const card = (page: Page) => page.locator('.more');
const chip = (page: Page, zone: string) => page.locator(`.more-chip[data-zone="${zone}"]`);
/** The list of the countries that are not in sight, and the button that plays the one chosen in it. */
const other = (page: Page) => card(page).getByRole('combobox', { name: 'Otro país' });
const playOther = (page: Page) => card(page).locator('.more-other button');
const hud = (page: Page) => page.locator('.hud-main');
/** Under the name of the game, what it is: "Reto de la semana · Mundo". */
const subtitle = (page: Page) => page.locator('.play-title > span');
const title = (page: Page) => page.locator('.play-title > strong');
const note = (page: Page) => page.locator('.results-note');
const percent = (page: Page) => page.locator('.results .donut-text strong');

/** Gives up the question on screen, says what the answer was, and moves on. */
async function giveUp(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'No lo sé' }).click();
  const answer = (await page.locator('.verdict-head').textContent()) ?? '';
  await page.getByRole('button', { name: 'Siguiente' }).click();
  return answer;
}

/**
 * Answers the question on screen any way it can, without knowing the answer: the options in turn where there
 * are options, and giving up where the answer goes on the map. Then moves on to the next.
 */
async function answerAny(page: Page): Promise<void> {
  const option = page.locator('.choices .choice:not(:disabled)');
  const verdict = page.locator('.verdict');
  if (await option.count()) {
    // A wrong option may leave another try: the verdict comes when the question is settled.
    for (let tries = 0; tries < 4 && !(await verdict.count()); tries++) await option.first().click();
  } else await page.getByRole('button', { name: 'No lo sé' }).click();
  await expect(verdict).toBeVisible();
  // An answer right at the first go moves on by itself.
  if (!(await page.locator('.verdict-ok').count())) await page.getByRole('button', { name: 'Siguiente' }).click();
}

/** Plays `total` questions to the end, the first `trying` of them for real, and stops at the results. */
async function finish(page: Page, total: number, trying = 0): Promise<void> {
  for (let n = 1; n <= total; n++) {
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
async function asAnother(page: Page, opts: Record<string, unknown>, patch: Record<string, unknown> = {}): Promise<void> {
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

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test.describe('more challenges on the first page', () => {
  test('are offered to whoever has played before: the week, the five continents and a list of countries', async ({ page }) => {
    await seed(page, { opts: OPTS });
    await open(page);
    await expect(card(page)).toBeVisible();
    await expect(card(page).locator('.kicker')).toHaveText(['Reto de la semana · del 16 al 22 de noviembre', 'Retos del día por continente o país']);
    // Each part has its heading: what the week asks, and what the other part is.
    await expect(card(page).getByRole('heading', { level: 2 })).toHaveText(['Popurrí · Mundo', 'Retos del día por continente o país']);
    await expect(card(page).locator('.more-text').first()).toHaveText('Una partida larga, la misma para todo el mundo: 50 preguntas seguidas. Cuenta la primera vez que la terminas.');
    await expect(card(page).locator('.more-meta')).toHaveText('Quedan 5 días');
    await expect(page.locator('.more-chip')).toHaveText(['Europa', 'Asia', 'África', 'América', 'Oceanía']);
    await expect(chip(page, 'p:EU')).toHaveAccessibleName('Jugar el reto del día de Europa.');
    // The countries with a challenge, by continent; Luxembourg, with its three districts, has none.
    await expect(other(page).locator('optgroup')).toHaveCount(5);
    await expect(other(page).locator('option').first()).toHaveText('Otro país…');
    await expect(other(page).locator('option[value="c:ES"]')).toHaveText('España');
    await expect(other(page).locator('option[value="c:LU"]')).toHaveCount(0);
    // Nothing to play until one is chosen.
    await expect(playOther(page)).toHaveText('Jugar');
    await expect(playOther(page)).toBeDisabled();
    // It comes under the challenge of the day and above the rest.
    const order = await page.locator('.home > *').evaluateAll((all) => all.map((el) => el.className.split(' ')[0]));
    expect(order.indexOf('more')).toBe(order.indexOf('d-card') + 1);
  });

  test('are not shown to a newcomer, whose page does not even fetch them', async ({ page }) => {
    const fetched: string[] = [];
    page.on('request', (r) => fetched.push(r.url()));
    await open(page);
    await expect(page.locator('.welcome')).toBeVisible();
    await expect(page.locator('.hero-title')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await card(page).count()).toBe(0);
    expect(fetched.filter((url) => /MoreChallenges/.test(url))).toEqual([]);
  });

  test('speak English to whoever plays in English', async ({ page }) => {
    await seed(page, { opts: OPTS, lang: 'en' });
    await open(page);
    await expect(card(page).locator('.kicker')).toHaveText(['Weekly challenge · 16–22 November', 'Daily challenges by continent or country']);
    await expect(card(page).locator('.more-title')).toHaveText('Medley · World');
    await expect(card(page).locator('.more-meta')).toHaveText('5 days left');
    await expect(page.locator('.more-chip')).toHaveText(['Europe', 'Asia', 'Africa', 'Americas', 'Oceania']);
    await card(page).getByRole('button', { name: 'Play the weekly challenge' }).click();
    await expect(subtitle(page)).toHaveText('Weekly challenge · World');
  });
});

test.describe('the challenge of the week', () => {
  test('is a game of fifty questions whose result goes on record, and the first page shows it', async ({ page }) => {
    await seed(page, { opts: OPTS });
    await open(page);
    await card(page).getByRole('button', { name: 'Jugar el reto de la semana' }).click();
    await expect(page).toHaveURL(/#\/jugar$/);
    await expect(title(page)).toHaveText('Popurrí');
    await expect(subtitle(page)).toHaveText('Reto de la semana · Mundo');
    // Some answered for real, the rest given up: whatever it scores, it is what goes on record.
    await finish(page, 50, 6);
    const score = (await percent(page).textContent())!;
    expect(score).toMatch(/^\d+ %$/);
    await expect(note(page)).toHaveText(`Reto de la semana · Mundo: queda apuntado tu ${score}.`);
    const week = (await kept(page)).weekly[WEEK];
    expect(week).toMatchObject({ s: Number.parseInt(score, 10), n: 50 });
    expect(Object.keys((await kept(page)).weekly)).toEqual([WEEK]);

    // Leaving it goes back to the first page, which is where it was started.
    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(card(page).locator('.more-score')).toHaveText(score);
    await expect(card(page).locator('.more-text').first()).toContainText(`${week.ok} de 50 a la primera`);
    await expect(card(page).locator('.more-text').first()).toContainText('El lunes hay reto nuevo.');
    await expect(card(page).locator('.more-meta')).toHaveText('Otra vez ya no cuenta: es para practicar.');

    // Played again, it is the same game and changes nothing: the first time is the one that counts.
    await card(page).getByRole('button', { name: 'Jugarlo otra vez' }).click();
    await expect(subtitle(page)).toHaveText('Reto de la semana · Mundo');
    await expect(hud(page)).toHaveText('1 / 50');
    await giveUp(page);
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(note(page)).toHaveText(`Reto de la semana · Mundo: ya tenías apuntado un ${score}. Cuenta la primera vez que se termina.`);
    expect((await kept(page)).weekly[WEEK]).toEqual(week);
    // From here, again is a game like any other, with questions of its own and nothing to write down.
    await page.getByRole('button', { name: 'Otra vez' }).click();
    await expect(hud(page)).toHaveText('1 / 50');
    // Its name is that of its map, as in any game.
    await expect(subtitle(page)).not.toContainText('Reto');
    expect((await kept(page)).game?.weekly).toBeUndefined();
  });

  test('is not written down when it is left before the end, and again is the same challenge', async ({ page }) => {
    await seed(page, { opts: OPTS });
    await open(page);
    await card(page).getByRole('button', { name: 'Jugar el reto de la semana' }).click();
    await expect(hud(page)).toHaveText('1 / 50');
    const first = [await giveUp(page), await giveUp(page)];
    await expect(hud(page)).toHaveText('3 / 50');
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(note(page)).toHaveText('Reto de la semana · Mundo: lo has dejado antes del final y no se apunta. Puedes empezarlo otra vez.');
    expect((await kept(page)).weekly).toEqual({});

    await page.getByRole('button', { name: 'Otra vez' }).click();
    await expect(subtitle(page)).toHaveText('Reto de la semana · Mundo');
    await expect(hud(page)).toHaveText('1 / 50');
    expect((await kept(page)).game?.weekly).toBe(WEEK);
    // The same questions, in the same order.
    expect([await giveUp(page), await giveUp(page)]).toEqual(first);

    // "Salir" leaves it for the first page, where it is still to be played.
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(card(page).getByRole('button', { name: 'Jugar el reto de la semana' })).toBeVisible();
  });

  test('asks everyone the same, whatever each player has set for their own games', async ({ page }) => {
    await seed(page, { opts: OPTS });
    await open(page);
    await card(page).getByRole('button', { name: 'Jugar el reto de la semana' }).click();
    await expect(hud(page)).toHaveText('1 / 50');
    const mine = [await giveUp(page), await giveUp(page), await giveUp(page)];
    expect(new Set(mine).size).toBe(3);

    // Another player: answers typed, every piece of the map, flags to point at, outlines turned, three lives.
    await asAnother(page, { answer: 'type', length: 'all', pinBy: 'flag', turned: true, flagLook: 'grey', format: 'lives' });
    await card(page).getByRole('button', { name: 'Jugar el reto de la semana' }).click();
    await expect(hud(page)).toHaveText('1 / 50');
    await expect(page.locator('.answer-input')).toHaveCount(0);
    expect([await giveUp(page), await giveUp(page), await giveUp(page)]).toEqual(mine);
    // Their own options are as they left them.
    expect((await kept(page)).game?.opts).toMatchObject({ answer: 'choice', length: 50, pinBy: 'name', turned: false, flagLook: 'plain', format: 'normal' });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state.opts)).toMatchObject({ answer: 'type', length: 'all', pinBy: 'flag', turned: true, flagLook: 'grey', format: 'lives' });
  });

  test('is another one the week after, and the one of this week stays kept', async ({ page }) => {
    await seed(page, { opts: OPTS, weekly: { [WEEK]: { s: 86, ok: 41, n: 50, ms: 252_000, t: NOW.getTime() } } });
    await open(page);
    await expect(card(page).locator('.more-score')).toHaveText('86 %');
    await expect(card(page).locator('.more-text').first()).toHaveText('86 % 41 de 50 a la primera, en 4:12. El lunes hay reto nuevo.');

    // Monday 23 November: the week from the 23rd to the 29th asks another thing.
    await page.clock.setFixedTime(new Date('2026-11-23T09:00:00+01:00'));
    await page.reload();
    await expect(card(page).locator('.kicker').first()).toHaveText('Reto de la semana · del 23 al 29 de noviembre');
    await expect(card(page).locator('.more-title')).toHaveText('Identificar · África');
    await expect(card(page).locator('.more-meta')).toHaveText('Quedan 7 días');
    await expect(card(page).locator('.more-score')).toHaveCount(0);
    await card(page).getByRole('button', { name: 'Jugar el reto de la semana' }).click();
    await expect(title(page)).toHaveText('Identificar');
    await expect(subtitle(page)).toHaveText('Reto de la semana · África');
    await expect(hud(page)).toHaveText('1 / 50');
    expect((await kept(page)).weekly[WEEK].s).toBe(86);
  });
});

test.describe('the challenge of the day of a continent', () => {
  test('is ten questions whose result goes on the first page, and counts the days in a row', async ({ page }) => {
    await seed(page, { opts: OPTS });
    await open(page);
    await chip(page, 'p:EU').click();
    await expect(page).toHaveURL(/#\/jugar$/);
    await expect(subtitle(page)).toHaveText('Reto del día · Europa');
    await finish(page, 10, 10);
    const score = (await percent(page).textContent())!;
    await expect(note(page)).toHaveText(`Reto del día · Europa: queda apuntado tu ${score}.`);
    expect((await kept(page)).zones).toEqual({ 'p:EU': expect.objectContaining({ d: TODAY, s: Number.parseInt(score, 10), n: 10, run: 1 }) });
    expect((await kept(page)).weekly).toEqual({});

    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(chip(page, 'p:EU')).toHaveClass(/\bmore-done\b/);
    await expect(chip(page, 'p:EU')).toHaveText(`Europa${score}`);
    await expect(chip(page, 'p:EU')).toHaveAccessibleName(`Reto del día de Europa: hecho, ${score}. Jugarlo otra vez ya no cuenta.`);
    await expect(page.locator('.more-done')).toHaveCount(1);

    // Played again the same day, it changes nothing.
    await chip(page, 'p:EU').click();
    await expect(hud(page)).toHaveText('1 / 10');
    await giveUp(page);
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(note(page)).toHaveText(`Reto del día · Europa: ya tenías apuntado un ${score}. Cuenta la primera vez que se termina.`);

    // The day after it is there to be played again, and makes two days in a row.
    await page.clock.setFixedTime(TOMORROW);
    await page.goto('./#/');
    await page.reload();
    await expect(chip(page, 'p:EU')).not.toHaveClass(/\bmore-done\b/);
    await expect(chip(page, 'p:EU')).toHaveAccessibleName('Jugar el reto del día de Europa.');
    await chip(page, 'p:EU').click();
    await finish(page, 10);
    await expect(note(page)).toHaveText('Reto del día · Europa: queda apuntado tu 0 %. Llevas 2 días seguidos.');
    expect((await kept(page)).zones['p:EU']).toMatchObject({ d: '2026-11-19', s: 0, ok: 0, n: 10, run: 2 });
    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await expect(chip(page, 'p:EU')).toHaveText('Europa0 %2');
    await expect(chip(page, 'p:EU')).toHaveAccessibleName('Reto del día de Europa: hecho, 0 %. Llevas 2 días seguidos. Jugarlo otra vez ya no cuenta.');
  });

  test('asks other things each day, and the same to everyone on a day', async ({ page }) => {
    await seed(page, { opts: OPTS });
    await open(page);
    await chip(page, 'p:AF').click();
    await expect(subtitle(page)).toHaveText('Reto del día · África');
    /** The ten answers of the challenge on screen, each given up. */
    const ten = async (): Promise<string[]> => {
      const answers: string[] = [];
      for (let n = 1; n <= 10; n++) {
        await expect(hud(page)).toHaveText(`${n} / 10`);
        answers.push(await giveUp(page));
      }
      return answers;
    };
    const today = await ten();
    expect(new Set(today).size).toBe(10);

    // Another player, with other options of their own and nothing played: the same ten, in the same order.
    await asAnother(page, { answer: 'type', length: 20, format: 'exam' }, { zones: {} });
    await chip(page, 'p:AF').click();
    expect(await ten()).toEqual(today);

    // The day after, other ten.
    await page.clock.setFixedTime(TOMORROW);
    await asAnother(page, {}, { zones: {} });
    await chip(page, 'p:AF').click();
    expect(await ten()).not.toEqual(today);
  });
});

test.describe('the challenge of the day of a country', () => {
  test('is chosen in the list and played with the button next to it, on the map the country opens with, and stays on the first page', async ({ page }) => {
    // The player has Spain set to its provinces: the challenge is on the communities all the same.
    await seed(page, { opts: OPTS, levels: { ES: 'f' } });
    await open(page);
    // Walking the list with the keyboard starts nothing: a game would begin at every country on the way.
    await other(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await other(page).selectOption('c:ES');
    await expect(page).toHaveURL(/#\/$/);
    expect((await kept(page)).game ?? null).toBeNull();
    // The button next to the list says which country it plays.
    await expect(playOther(page)).toBeEnabled();
    await expect(playOther(page)).toHaveAccessibleName('Jugar el reto del día de España');

    await playOther(page).click();
    await expect(page).toHaveURL(/#\/jugar$/);
    await expect(subtitle(page)).toHaveText('Reto del día · España');
    expect((await kept(page)).game).toMatchObject({ zone: { id: 'c:ES', date: TODAY }, levels: { ES: 'g1' } });
    await finish(page, 10);
    await expect(note(page)).toHaveText('Reto del día · España: queda apuntado tu 0 %.');
    // The nineteen communities, not the fifty-two provinces.
    await expect(page.locator('.map-svg .m-items [data-id]')).toHaveCount(19);
    // What the player chose for their own games is as it was.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state.levels)).toEqual({ ES: 'f' });

    // Once played, the country has its button after the continents, with its flag, and leaves the list.
    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await expect(page.locator('.more-chip')).toHaveText(['Europa', 'Asia', 'África', 'América', 'Oceanía', 'España0 %']);
    await expect(chip(page, 'c:ES').locator('img.flag')).toHaveAttribute('src', /flags\/es\.svg$/);
    await expect(other(page)).toHaveValue('');
    await expect(playOther(page)).toBeDisabled();
    await expect(other(page).locator('option[value="c:ES"]')).toHaveCount(0);
    // It is there when the page is opened again.
    await page.reload();
    await expect(chip(page, 'c:ES')).toHaveClass(/\bmore-done\b/);
    await expect(other(page).locator('option[value="c:ES"]')).toHaveCount(0);
  });

  test('keeps in sight the countries played lately, by their names, and lets go of one left alone for a month', async ({ page }) => {
    const rec = (d: string, run = 1) => ({ d, s: 80, ok: 8, n: 10, ms: 60_000, run });
    await seed(page, { opts: OPTS, zones: { 'c:PT': rec('2026-11-17', 3), 'c:FR': rec(TODAY, 2), 'c:DE': rec('2026-10-25'), 'c:IT': rec('2026-10-19'), 'p:AS': rec('2026-09-01') } });
    await open(page);
    // Germany, France and Portugal by their names in Spanish; Italy was last played thirty days ago.
    await expect(page.locator('.more-chip')).toHaveText(['Europa', 'Asia', 'África', 'América', 'Oceanía', 'Alemania', 'Francia80 %2', 'Portugal3']);
    await expect(chip(page, 'c:FR')).toHaveClass(/\bmore-done\b/);
    // Portugal was played yesterday: its three days in a row can still go on. Germany's cannot.
    await expect(chip(page, 'c:PT')).toHaveAccessibleName('Jugar el reto del día de Portugal. Llevas 3 días seguidos.');
    await expect(chip(page, 'c:DE')).toHaveAccessibleName('Jugar el reto del día de Alemania.');
    // Italy is back in the list, to be chosen again.
    await expect(other(page).locator('option[value="c:IT"]')).toHaveText('Italia');
    await expect(other(page).locator('option[value="c:DE"]')).toHaveCount(0);
  });
});

test.describe('more challenges on a phone @movil', () => {
  test('fit a narrow screen with large text, one part under the other', async ({ page }) => {
    const rec = (d: string, run = 1) => ({ d, s: 100, ok: 10, n: 10, ms: 60_000, run });
    await seed(page, {
      opts: OPTS,
      textSize: 'xl',
      dyslexia: true,
      weekly: { [WEEK]: { s: 86, ok: 41, n: 50, ms: 252_000, t: NOW.getTime() }, '2026-11-09': { s: 92, ok: 44, n: 48, ms: 200_000, t: 1 } },
      zones: { 'p:EU': rec(TODAY, 12), 'c:BA': rec(TODAY, 30), 'c:CD': rec('2026-11-17', 2), 'c:GB': rec(TODAY), 'c:DO': rec('2026-11-10') },
    });
    await page.setViewportSize({ width: 320, height: 640 });
    await open(page);
    await expect(card(page)).toBeVisible();
    await expect(chip(page, 'c:CD')).toBeVisible();
    const fit = await page.evaluate(() => {
      const wide = document.documentElement.clientWidth;
      const parts = [...document.querySelectorAll('.more-part')].map((el) => el.getBoundingClientRect());
      const over = [...document.querySelectorAll('.more *')].filter((el) => el.getBoundingClientRect().right > wide + 0.5).map((el) => el.className || el.tagName);
      return { page: document.documentElement.scrollWidth - wide, stacked: parts[1].top >= parts[0].bottom, over };
    });
    expect(fit).toEqual({ page: 0, stacked: true, over: [] });
  });
});
