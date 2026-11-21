/**
 * More challenges on the first page: the one of the week, a long game that is the same for everyone from
 * Monday to Sunday, and those of the day of a continent or a country, ten questions each. Each is a game
 * like any other; its result is kept the first time it is played to the end.
 */
import { expect, test, type Page } from '@playwright/test';
import { OPTS, PIN_SPAIN, open, seed } from './helpers';

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
  sessions: { total: number }[];
  daily: Record<string, unknown>;
  recent: unknown[];
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
 *
 * All of it inside the page, in one go: an answer right at the first go moves on by itself in about a second,
 * and a test that looked from outside, one step at a time, could find the next question where it expected the
 * verdict of this one on a machine that stopped for a moment.
 */
async function answerAny(page: Page): Promise<void> {
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
async function finish(page: Page, total: number, trying = 0, from = 1): Promise<void> {
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
    // With nothing to study, it comes right under the challenge of the day.
    const order = await page.locator('.home > *').evaluateAll((all) => all.map((el) => el.className.split(' ')[0]));
    expect(order.indexOf('more')).toBe(order.indexOf('d-card') + 1);
  });

  test('come after what there is to study today: the goals, the session of the day and the review', async ({ page }) => {
    const now = NOW.getTime();
    const day = 86_400_000;
    await seed(page, {
      opts: OPTS,
      // A goal for the week after, Galicia due again and Castilla y León missed twice a moment ago: all three cards.
      goals: [{ id: 'g1', name: 'España · comunidades autónomas', section: 'regions', countries: ['ES'], levels: { ES: 'g1' }, ids: ['ES-AN', 'ES-AR', 'ES-GA'], skill: 'loc', date: '2026-11-26', made: now - day }],
      stats: { 'loc:ES-GA': [3, 3, 2, now - 10 * day], 'name:ES-CL': [3, 1, 1, now - 60_000] },
      where: { 'ES-GA': 'r|ES|g1', 'ES-CL': 'r|ES|g1' },
      days: { '2026-11-17': [1, 20, 15, 60_000, 1], [TODAY]: [1, 12, 9, 60_000, 0] },
    });
    await open(page);
    await expect(card(page)).toBeVisible();
    for (const above of ['.goals', '.day-plan', '.review', '.today']) await expect(page.locator(above)).toBeVisible();
    const order = await page.locator('.home > *').evaluateAll((all) => all.map((el) => el.className.split(' ')[0]));
    // What is due goes first; then what there is to play besides, and the rest of the page.
    expect(order.slice(order.indexOf('d-card'), order.indexOf('hero') + 1)).toEqual(['d-card', 'goals', 'day-plan', 'review', 'today', 'more', 'hero']);
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

  test('come to the newcomer who closes the welcome, without the page being taken away to wait for them', async ({ page }) => {
    await open(page);
    await expect(page.locator('.welcome')).toBeVisible();
    // The page as it is drawn is marked, and anything that takes its place is noticed.
    await page.evaluate(() => {
      const w = window as unknown as { taken: boolean };
      w.taken = false;
      document.querySelector<HTMLElement>('.hero-title')!.dataset.mark = 'mine';
      new MutationObserver(() => {
        if (!document.querySelector('.hero-title') || document.querySelector('#root .spinner')) w.taken = true;
      }).observe(document.getElementById('root')!, { childList: true, subtree: true });
      // The welcome is further down the page: that is where whoever closes it is.
      document.querySelector('.welcome')!.scrollIntoView({ block: 'center' });
    });
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
    await page.locator('.welcome-close').click();
    await expect(page.locator('.welcome')).toHaveCount(0);
    await expect(card(page)).toBeVisible();
    await expect(card(page).getByRole('button', { name: 'Jugar el reto de la semana' })).toBeVisible();
    const after = await page.evaluate(() => ({
      mark: document.querySelector<HTMLElement>('.hero-title')?.dataset.mark,
      taken: (window as unknown as { taken: boolean }).taken,
      top: window.scrollY === 0,
    }));
    // The same page, never out of sight, and not sent back to its top.
    expect(after).toEqual({ mark: 'mine', taken: false, top: false });
  });

  test('do not hold the first page for ever when their code neither comes nor fails: it is drawn without them', async ({ page }) => {
    // A download that stalls: the request is never answered.
    await page.route(/\/assets\/MoreChallenges-[^/]+\.js$/, () => undefined);
    await seed(page, { opts: OPTS });
    await page.goto('./#/');
    // The page waits for the card, to be drawn whole…
    await expect(page.locator('#root .spinner')).toBeVisible();
    await page.waitForTimeout(2000);
    expect(await page.locator('.hero-title').count()).toBe(0);
    // …and after five seconds it is drawn without it.
    await expect(page.locator('.hero-title')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.d-card')).toBeVisible();
    await expect(page.locator('#root .spinner')).toHaveCount(0);
    expect(await card(page).count()).toBe(0);
  });

  test('are those of the moment they are started at, on a page that has been open since the day before', async ({ page }) => {
    // Sunday night: the last day of the week of the 16th.
    await page.clock.setFixedTime(new Date('2026-11-22T23:50:00+01:00'));
    await seed(page, { opts: OPTS });
    await open(page);
    await expect(card(page).locator('.more-title')).toHaveText('Popurrí · Mundo');
    await expect(card(page).locator('.more-meta')).toHaveText('Último día');
    // The page is still there on Monday morning, saying what it said: the game it starts is the one of the new week.
    await page.clock.setFixedTime(new Date('2026-11-23T08:00:00+01:00'));
    await card(page).getByRole('button', { name: 'Jugar el reto de la semana' }).click();
    await expect(subtitle(page)).toHaveText('Reto de la semana · África');
    expect((await kept(page)).game?.weekly).toBe('2026-11-23');

    // Back on the first page, which is now that of Monday; and on Tuesday the challenge of Europe is Tuesday's.
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(card(page).locator('.more-title')).toHaveText('Identificar · África');
    await page.clock.setFixedTime(new Date('2026-11-24T08:00:00+01:00'));
    await chip(page, 'p:EU').click();
    await expect(subtitle(page)).toHaveText('Reto del día · Europa');
    expect((await kept(page)).game?.zone).toEqual({ id: 'p:EU', date: '2026-11-24' });
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
    // It counts as a game like any other, and it is none of the business of the challenge of the day.
    expect((await kept(page)).sessions).toMatchObject([{ total: 50 }]);
    expect((await kept(page)).daily).toEqual({});
    // Nor is it a map to come back to among those played lately: it is offered here, the one of each week.
    expect((await kept(page)).recent).toEqual([]);
    // Like any game, it can be sent to someone with its questions.
    await expect(page.locator('.duel').getByRole('button', { name: 'Retar a alguien' })).toBeVisible();

    // Leaving it goes back to the first page, which is where it was started.
    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(card(page).locator('.more-score')).toHaveText(score);
    await expect(card(page).locator('.more-text').first()).toContainText(`${week.ok} de 50 a la primera`);
    await expect(card(page).locator('.more-text').first()).toContainText('El lunes hay reto nuevo.');
    await expect(card(page).locator('.more-meta')).toHaveText('Otra vez ya no cuenta: es para practicar.');
    // It is kept in the browser: there when the page is opened again.
    await page.reload();
    await expect(card(page).locator('.more-score')).toHaveText(score);
    expect((await kept(page)).weekly[WEEK]).toEqual(week);

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

test.describe('a challenge left in the browser for another day', () => {
  test('becomes the one of the new day when its page comes back, and that is the day that goes on record', async ({ page }) => {
    await seed(page, { opts: OPTS });
    await open(page);
    await chip(page, 'p:EU').click();
    await expect(hud(page)).toHaveText('1 / 10');
    await giveUp(page);
    await expect(hud(page)).toHaveText('2 / 10');
    expect((await kept(page)).game?.zone).toEqual({ id: 'p:EU', date: TODAY });

    // The morning after, the phone brings back the page that was open: the game, at its address.
    await page.clock.setFixedTime(TOMORROW);
    await page.reload();
    await expect(subtitle(page)).toHaveText('Reto del día · Europa');
    await expect(hud(page)).toHaveText('1 / 10');
    expect((await kept(page)).game?.zone).toEqual({ id: 'p:EU', date: '2026-11-19' });
    await finish(page, 10);
    await expect(note(page)).toHaveText('Reto del día · Europa: queda apuntado tu 0 %.');
    expect((await kept(page)).zones).toEqual({ 'p:EU': expect.objectContaining({ d: '2026-11-19', run: 1 }) });
    // And the first page, which is that of the new day, has it done.
    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await expect(chip(page, 'p:EU')).toHaveClass(/\bmore-done\b/);
  });

  test('is the one of the new week, with its own theme, when it was the challenge of the week before', async ({ page }) => {
    await seed(page, { opts: OPTS });
    await open(page);
    await card(page).getByRole('button', { name: 'Jugar el reto de la semana' }).click();
    await expect(title(page)).toHaveText('Popurrí');
    await expect(subtitle(page)).toHaveText('Reto de la semana · Mundo');

    await page.clock.setFixedTime(new Date('2026-11-25T12:00:00+01:00'));
    await page.reload();
    await expect(title(page)).toHaveText('Identificar');
    await expect(subtitle(page)).toHaveText('Reto de la semana · África');
    await expect(hud(page)).toHaveText('1 / 50');
    expect((await kept(page)).game?.weekly).toBe('2026-11-23');
  });

  test('goes on record for the day it was started when midnight comes while it is played', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-18T23:58:00+01:00'));
    await seed(page, { opts: OPTS });
    await open(page);
    await chip(page, 'p:EU').click();
    for (let n = 1; n <= 4; n++) {
      await expect(hud(page)).toHaveText(`${n} / 10`);
      await giveUp(page);
    }
    // Five past midnight, with the game in sight: it is still the game that was started, whatever is drawn
    // again around it (the list of keys comes from the page that holds the game).
    await page.clock.setFixedTime(new Date('2026-11-19T00:05:00+01:00'));
    await expect(hud(page)).toHaveText('5 / 10');
    await page.locator('body').press('?');
    await expect(page.locator('dialog.keys-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.keys-dialog')).toHaveCount(0);
    expect((await kept(page)).game?.zone).toEqual({ id: 'p:EU', date: TODAY });
    await finish(page, 10, 0, 5);
    await expect(note(page)).toHaveText('Reto del día · Europa: queda apuntado tu 0 %.');
    expect((await kept(page)).zones).toEqual({ 'p:EU': expect.objectContaining({ d: TODAY, n: 10, run: 1 }) });
    // The first page is that of the new day, whose challenge is still to be played.
    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await expect(chip(page, 'p:EU')).toHaveAccessibleName('Jugar el reto del día de Europa.');
    await expect(page.locator('.more-done')).toHaveCount(0);
  });

  test('is not what the first page offers to go on with: its button is on the card, and starts the one of today', async ({ page }) => {
    // A game of the player's own is there to go on with.
    await seed(page, { opts: OPTS, game: PIN_SPAIN });
    await open(page);
    const buttons = page.locator('.hero-cta button');
    await expect(buttons).toHaveText(['Empezar con las regiones', 'Seguir: Señalar']);
    // A challenge takes its place as the game in course, and is not offered there.
    await chip(page, 'p:EU').click();
    await expect(subtitle(page)).toHaveText('Reto del día · Europa');
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(card(page)).toBeVisible();
    await expect(buttons).toHaveText(['Empezar con las regiones']);
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
  /** The card with a week done and countries of long names in sight, on the narrowest screen, read as `reading` says. */
  async function fits(page: Page, reading: Record<string, unknown>): Promise<void> {
    const rec = (d: string, run = 1) => ({ d, s: 100, ok: 10, n: 10, ms: 60_000, run });
    await seed(page, {
      opts: OPTS,
      ...reading,
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
      const over = [...document.querySelectorAll('.more *')].filter((el) => el.getBoundingClientRect().right > wide + 0.5).map((el) => el.getAttribute('class') || el.tagName);
      // A name that does not fit its button goes on to another line: none is cut short, nor spills out of it.
      const cut = [...document.querySelectorAll<HTMLElement>('.more-chip, .more-chip span, .more-other button')].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent);
      return { page: document.documentElement.scrollWidth - wide, stacked: parts[1].top >= parts[0].bottom, over, cut };
    });
    expect(fit).toEqual({ page: 0, stacked: true, over: [], cut: [] });
    // The longest name is read whole, on more than one line.
    const name = chip(page, 'c:CD').locator('.more-name > span');
    await expect(name).toHaveText('República Democrática del Congo');
    expect(await name.evaluate((el) => el.getBoundingClientRect().height > 1.5 * Number.parseFloat(getComputedStyle(el).lineHeight))).toBe(true);
  }

  test('fit a narrow screen with large text, one part under the other', ({ page }) => fits(page, { textSize: 'xl', dyslexia: true }));

  // With large text every button of the game lets its words go on to another line. With the text as it
  // comes none does, and the buttons of this card have to say so themselves.
  test('fit a narrow screen with the text as it comes too, a long name on two lines', ({ page }) => fits(page, {}));
});
