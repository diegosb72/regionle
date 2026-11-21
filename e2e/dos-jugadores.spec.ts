/**
 * «Dos jugadores»: two people share the device and answer by turns. Where such a game is set up and what
 * the two are called, how the turns and the points go, how it ends, and that nothing of it is written down
 * in the progress of whoever the browser belongs to.
 *
 * The map is the United Kingdom by its four nations: a game is four questions, two for each.
 */
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, seed } from './helpers';

const DUO = { ...OPTS, length: 'all', format: 'duo' };
const UK = { section: 'regions', countries: ['GB'], mode: 'pin', levels: { GB: 'g1' }, opts: DUO };
/** The nations by the name they are asked with, in either language. */
const ID: Record<string, string> = {
  Inglaterra: 'GB-ENG',
  England: 'GB-ENG',
  Escocia: 'GB-SCT',
  Scotland: 'GB-SCT',
  Gales: 'GB-WLS',
  Wales: 'GB-WLS',
  'Irlanda del Norte': 'GB-NIR',
  'Northern Ireland': 'GB-NIR',
};

const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`);
const title = (page: Page) => page.locator('.results-title');
const board = (page: Page) => page.locator('.play-under .duo-board');
const seats = (page: Page) => board(page).locator('.duo-seat');
const turn = (page: Page) => page.locator('.q .duo-turn');
const next = (page: Page) => page.getByRole('button', { name: /^(Siguiente|Next)/ });
/** The points on the scoreboard, as figures. */
const points = async (page: Page): Promise<number[]> => (await board(page).locator('.duo-pts').allTextContents()).map((t) => Number.parseInt(t, 10));
/** What the browser keeps of the game, as it is written. */
const state = (page: Page): Promise<Record<string, unknown>> => page.evaluate(() => (JSON.parse(localStorage.getItem('regionle:v1') ?? '{"state":{}}') as { state: Record<string, unknown> }).state);
/** What is kept of what was answered and played: all that a game writes down. */
const written = async (page: Page): Promise<string> => {
  const s = await state(page);
  return JSON.stringify(['stats', 'where', 'mix', 'sessions', 'recent', 'best', 'days', 'tot', 'badges', 'album'].map((k) => s[k]));
};

/** The names the two go by, kept before the page opens as the setup keeps them. */
async function called(page: Page, names: [string, string]): Promise<void> {
  await page.addInitScript((kept) => {
    if (!sessionStorage.getItem('duo')) localStorage.setItem('regionle:duo', JSON.stringify(kept));
    sessionStorage.setItem('duo', '1');
  }, names);
}

/** A game of two on screen: Ana and Luis, on the map given, ready for its first question. */
async function start(page: Page, game: Record<string, unknown> = UK, kept: Record<string, unknown> = {}, names: [string, string] | null = ['Ana', 'Luis']): Promise<void> {
  if (names) await called(page, names);
  await seed(page, { opts: DUO, ...kept, game: { ...game, nonce: 1 } });
  await page.goto('./#/jugar');
  await expect(page.locator('.map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.q .q-prompt')).toBeVisible({ timeout: 30_000 });
}

/**
 * A piece that is a wrong answer to the question about `id`: one that is still to be asked. (A click on a
 * piece that is already settled is no answer at all: the game says so and waits.)
 */
async function wrongOf(page: Page, id: string): Promise<string> {
  const open = await page.locator('.map-svg .m-items [data-id]:not([class*="st-"])').evaluateAll((els) => els.map((el) => el.getAttribute('data-id')!));
  const other = open.find((x) => x !== id);
  expect(other, `a piece still to be asked other than ${id}`).toBeTruthy();
  return other!;
}

/**
 * Answers the question on screen: `o` at once, `w` with a hint, `b` not at all («No lo sé»). Returns the
 * name that was asked. The next question, or the result, is there when it comes back.
 */
async function answer(page: Page, how: string): Promise<string> {
  const name = page.locator('.q-name');
  const now = ((await name.textContent()) ?? '').trim();
  const id = ID[now];
  expect(id, now).toBeTruthy();
  if (how === 'o') await piece(page, id).dispatchEvent('click');
  else if (how === 'w') {
    await page.getByRole('button', { name: /^(Pista|Hint)$/ }).click();
    await piece(page, id).dispatchEvent('click');
    await next(page).click();
  } else {
    await page.getByRole('button', { name: /^(No lo sé|I don't know)$/ }).click();
    await next(page).click();
  }
  await expect(async () => {
    const over = await title(page).isVisible();
    const then = over ? '' : ((await name.textContent({ timeout: 1000 })) ?? '').trim();
    expect(over || then !== now).toBe(true);
  }).toPass({ timeout: 15_000 });
  return now;
}

/** Plays a whole game, each question as said, and returns the names in the order they were asked. */
async function play(page: Page, hows: string): Promise<string[]> {
  const asked: string[] = [];
  for (const how of hows) asked.push(await answer(page, how));
  return asked;
}

/** How many times the page asks for the file that draws a game of two (games/Duo.tsx). */
function fetchedBy(page: Page): string[] {
  const asked: string[] = [];
  page.on('request', (req) => {
    if (/\/assets\/Duo-[\w-]+\.js$/.test(req.url())) asked.push(req.url());
  });
  return asked;
}

test.describe('a game of two players', () => {
  test('is a format of the setup, with a line for the name of each, which the browser keeps', async ({ page }) => {
    await seed(page, { opts: { ...OPTS, length: 'all' } });
    await open(page, '/regiones/GB:g1/pin');
    const format = page.getByRole('radiogroup', { name: 'Formato de la partida' });
    await expect(format.getByRole('radio')).toHaveText(['Normal', 'Contrarreloj', 'Supervivencia', 'Examen', 'Dos jugadores']);
    const names = page.locator('.duo-names');
    await expect(names).toHaveCount(0);
    await format.getByRole('radio', { name: 'Dos jugadores' }).click();
    await expect(format.getByRole('radio', { name: 'Dos jugadores' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.opt-hint').filter({ hasText: 'por turnos' })).toHaveText(
      'Dos personas con este dispositivo. Una pregunta para cada uno, por turnos. Acertar a la primera vale 2 puntos; con pista o tras un fallo, 1. Gana quien sume más. Lo que se falla no vuelve a salir, y la partida no cuenta para tu progreso.',
    );
    // How long it is, and what is each one's share.
    await expect(page.locator('.mode-facts')).toContainText('4 preguntas (2 para cada uno)');
    await expect(page.locator('.startbar')).toContainText('Señalar · dos jugadores');
    // A game against the ghost is one player's: it is not offered for this format.
    await expect(page.locator('.ghost-offer')).toHaveCount(0);
    // It has an end: "no end" is not among the lengths to choose from.
    await expect(page.getByRole('radiogroup', { name: 'Número de preguntas' }).getByRole('radio')).toHaveText(['Todo', '10', '20', '50']);

    await expect(names.getByRole('textbox')).toHaveCount(2);
    await expect(names.getByLabel('Jugador 1')).toHaveValue('');
    await names.getByLabel('Jugador 1').fill('Ana');
    await names.getByLabel('Jugador 2').fill('  Luis  ');
    expect(await page.evaluate(() => localStorage.getItem('regionle:duo'))).toBe('["Ana","Luis"]');
    // The names are not part of the game that is kept, nor of what a copy takes: they are kept apart.
    expect(JSON.stringify(await state(page))).not.toContain('Luis');

    await page.locator('.startbar').getByRole('button', { name: 'Empezar' }).click();
    await expect(seats(page).locator('.duo-name')).toHaveText(['Ana', 'Luis']);
    await expect(turn(page)).toHaveText('Turno de Ana');
    await expect(page.locator('.hud-main')).toHaveText('1 / 4');

    // Back on the setup, the format is the one that was chosen and the names are there.
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(format.getByRole('radio', { name: 'Dos jugadores' })).toHaveAttribute('aria-checked', 'true');
    await expect(names.getByLabel('Jugador 1')).toHaveValue('Ana');
    await expect(names.getByLabel('Jugador 2')).toHaveValue('Luis');
    // A game that is not played in formats has nobody to name, whatever format was left chosen.
    await page.locator('.mode').filter({ hasText: 'Explorar' }).click();
    await expect(page.locator('.mode.on')).toContainText('Explorar');
    await expect(names).toHaveCount(0);
    await expect(page.locator('.startbar')).not.toContainText('dos jugadores');
    await expect(page.locator('.startbar').getByRole('button', { name: 'Empezar' })).toBeEnabled();
    await page.locator('.mode').filter({ hasText: 'Señalar' }).click();
    await expect(names.getByLabel('Jugador 2')).toHaveValue('Luis');
    // With another format there is nobody to name either.
    await format.getByRole('radio', { name: 'Normal' }).click();
    await expect(names).toHaveCount(0);
    await expect(page.locator('.startbar')).not.toContainText('dos jugadores');
  });

  test('deals a question to each by turns, and adds two points, one or none to whoever answered', async ({ page }) => {
    await start(page);
    await expect(board(page)).toHaveAttribute('aria-label', 'Marcador');
    await expect(seats(page)).toHaveCount(2);
    expect(await points(page)).toEqual([0, 0]);
    await expect(turn(page)).toHaveText('Turno de Ana');
    await expect(seats(page).nth(0)).toHaveAttribute('aria-current', 'true');
    await expect(seats(page).nth(1)).not.toHaveAttribute('aria-current', 'true');
    await expect(page.locator('.hud-main')).toHaveText('1 / 4');

    // Ana, at once: two points, and the turn goes over by itself.
    await answer(page, 'o');
    expect(await points(page)).toEqual([2, 0]);
    await expect(turn(page)).toHaveText('Turno de Luis');
    await expect(seats(page).nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(seats(page).nth(0)).not.toHaveAttribute('aria-current', 'true');
    await expect(page.locator('.hud-main')).toHaveText('2 / 4');

    // Luis, after a wrong click: one point. The question stays his while its answer is on screen.
    const second = ((await page.locator('.q-name').textContent()) ?? '').trim();
    await piece(page, await wrongOf(page, ID[second])).dispatchEvent('click');
    await piece(page, ID[second]).dispatchEvent('click');
    await expect(page.locator('.verdict .duo-gain')).toHaveText('Luis suma 1 punto. Ahora le toca a Ana.');
    expect(await points(page)).toEqual([2, 1]);
    await expect(seats(page).nth(1)).toHaveAttribute('aria-current', 'true');
    await next(page).click();
    await expect(turn(page)).toHaveText('Turno de Ana');

    // Ana, never: nothing, and where it was is shown as in any game.
    const third = ((await page.locator('.q-name').textContent()) ?? '').trim();
    const other = await wrongOf(page, ID[third]);
    for (let i = 0; i < 3; i++) await piece(page, other).dispatchEvent('click');
    await expect(page.locator('.verdict .duo-gain')).toHaveText('Ana no suma. Ahora le toca a Luis.');
    expect(await points(page)).toEqual([2, 1]);
    await next(page).click();
    await expect(turn(page)).toHaveText('Turno de Luis');
    await expect(page.locator('.hud-main')).toHaveText('4 / 4');
    // A streak would be of both: there is none to show.
    await expect(page.locator('.hud-streak')).toHaveCount(0);

    // Luis, at once: the game is over with its fourth answer. What was missed is not asked again.
    await answer(page, 'o');
    await expect(title(page)).toHaveText('Gana Luis');
    await expect(page.locator('.results-note')).toHaveText('3 puntos a 2.');
  });

  test('ends with who won, what each got, and the map by who answered each piece', async ({ page }) => {
    await start(page);
    const asked = await play(page, 'owbo');
    await expect(title(page)).toHaveText('Gana Luis');
    await expect(page.locator('.results-note')).toHaveText('3 puntos a 2.');
    const cards = page.locator('.duo-final .duo-card');
    await expect(cards.locator('h3')).toHaveText(['Ana', 'Luis']);
    await expect(cards.locator('.duo-total')).toHaveText(['2 puntos', '3 puntos']);
    await expect(cards.nth(1)).toHaveClass(/\bwon\b/);
    await expect(cards.nth(0)).not.toHaveClass(/\bwon\b/);
    await expect(cards.nth(0).locator('dd')).toHaveText(['1', '0', '1']);
    await expect(cards.nth(1).locator('dd')).toHaveText(['1', '1', '0']);
    // What each answered, in the order it was asked.
    const lists = page.locator('.duo-list');
    await expect(lists.nth(0).locator('summary')).toHaveText('Ana 2 puntos');
    await expect(lists.nth(0).locator('li b')).toHaveText([asked[0], asked[2]]);
    await expect(lists.nth(0).locator('.duo-got')).toHaveText(['a la primera: +2', 'fallo: 0']);
    await expect(lists.nth(1).locator('summary')).toHaveText('Luis 3 puntos');
    await expect(lists.nth(1).locator('li b')).toHaveText([asked[1], asked[3]]);
    await expect(lists.nth(1).locator('.duo-got')).toHaveText(['con ayuda: +1', 'a la primera: +2']);
    // The map: a piece is of whoever got it, with help or without; what was missed is nobody's.
    await expect(piece(page, ID[asked[0]])).toHaveClass(/\bst-pa\b/);
    await expect(piece(page, ID[asked[1]])).toHaveClass(/\bst-pb\b/);
    await expect(piece(page, ID[asked[2]])).toHaveClass(/\bst-px\b/);
    await expect(piece(page, ID[asked[3]])).toHaveClass(/\bst-pb\b/);
    await expect(page.locator('.map-svg [data-id].st-ok, .map-svg [data-id].st-warn, .map-svg [data-id].st-bad')).toHaveCount(0);
    // Each of the two has a colour of its own, and what is nobody's has neither.
    const fills = await Promise.all([0, 1, 2].map((i) => piece(page, ID[asked[i]]).evaluate((el) => getComputedStyle(el).fill)));
    expect(new Set(fills).size).toBe(3);
    // What is for one player alone is not offered: the misses to play again, the picture, the diploma, a challenge to send.
    await expect(page.locator('.results-actions button')).toHaveText(['Otra vez', 'Cambiar de juego']);
    await expect(page.locator('.duel, .ghost-box, .results-score')).toHaveCount(0);
    // The keyboard is on the button that plays again.
    await expect(page.getByRole('button', { name: 'Otra vez' })).toBeFocused();
  });

  test('is a tie when both end with the same points', async ({ page }) => {
    await start(page);
    await play(page, 'woo');
    // The last answer, with a hint: it adds its point, and nobody is left to play next.
    const last = ((await page.locator('.q-name').textContent()) ?? '').trim();
    await page.getByRole('button', { name: 'Pista', exact: true }).click();
    await piece(page, ID[last]).dispatchEvent('click');
    await expect(page.locator('.verdict .duo-gain')).toHaveText('Luis suma 1 punto.');
    await next(page).click();
    await expect(title(page)).toHaveText('Empate');
    await expect(page.locator('.results-note')).toHaveText('Los dos acabáis con 3 puntos.');
    await expect(page.locator('.duo-card.won')).toHaveCount(0);
  });

  test('writes nothing down: not the answers, not the game, not a ghost of it', async ({ page }) => {
    await start(page);
    const before = await written(page);
    // One piece taken for another, which a game of one player would write down as a mix-up of the two.
    const first = ((await page.locator('.q-name').textContent()) ?? '').trim();
    await piece(page, await wrongOf(page, ID[first])).dispatchEvent('click');
    await expect(page.locator('.q-note')).toContainText('Eso es');
    await piece(page, ID[first]).dispatchEvent('click');
    await next(page).click();
    await play(page, 'wbo');
    await expect(title(page)).toBeVisible();
    expect(await written(page)).toBe(before);
    const kept = await state(page);
    expect(kept.sessions ?? []).toEqual([]);
    expect(kept.stats ?? {}).toEqual({});
    expect(kept.mix ?? {}).toEqual({});
    expect(await page.evaluate(() => localStorage.getItem('regionle:ghosts'))).toBeNull();
    // The first page has nothing to say of a game played: no review to do, nothing played lately.
    await open(page, '/');
    await expect(page.locator('main#contenido')).toBeVisible();
    await expect(page.locator('.recent, .review-main')).toHaveCount(0);
  });

  test('is opened by the other player the next time, and so on', async ({ page }) => {
    await start(page);
    await play(page, 'ooo');
    // Three in a row at the first go, and no streak on show: it would be of both.
    await expect(page.locator('.hud-main')).toHaveText('4 / 4');
    await expect(page.locator('.hud-streak')).toHaveCount(0);
    await play(page, 'o');
    await expect(page.locator('.duo-how').first()).toContainText('En la siguiente empieza Luis.');
    await page.getByRole('button', { name: 'Otra vez' }).click();
    await expect(turn(page)).toHaveText('Turno de Luis');
    await expect(seats(page).nth(1)).toHaveAttribute('aria-current', 'true');
    expect(await points(page)).toEqual([0, 0]);
    // A page read again starts the game again, with the same one opening it.
    await answer(page, 'o');
    await page.reload();
    await expect(turn(page)).toHaveText('Turno de Luis', { timeout: 30_000 });
    expect(await points(page)).toEqual([0, 0]);
    // The first answer is his now: the points go to the second seat, and the piece is painted his.
    const his = await answer(page, 'o');
    expect(await points(page)).toEqual([0, 2]);
    await expect(piece(page, ID[his])).toHaveClass(/\bst-pb\b/);
    await expect(turn(page)).toHaveText('Turno de Ana');
    await play(page, 'bbb');
    await expect(title(page)).toHaveText('Gana Luis');
    await expect(page.locator('.duo-how').first()).toContainText('En la siguiente empieza Ana.');
    await page.getByRole('button', { name: 'Otra vez' }).click();
    await expect(turn(page)).toHaveText('Turno de Ana');
  });

  test('is nobody’s when it is ended early, and is settled by its whole rounds', async ({ page }) => {
    await start(page);
    const asked = await play(page, 'obo');
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(title(page)).toHaveText('Partida sin terminar');
    // Ana has answered twice and Luis once: her second answer is left out.
    await expect(page.locator('.results-note')).toHaveText('Iba ganando Ana: 2 puntos a 0 tras 1 ronda.');
    await expect(page.locator('.duo-total')).toHaveText(['2 puntos', '0 puntos']);
    await expect(page.locator('.duo-card.won')).toHaveCount(0);
    await expect(page.locator('.duo-extra')).toHaveText(`La última respuesta de Ana (${asked[2]}) no cuenta: Luis no llegó a tener ese turno.`);
    await expect(page.locator('.duo-list').nth(0).locator('li b')).toHaveText([asked[0]]);
    await expect(page.locator('.duo-list').nth(1).locator('li b')).toHaveText([asked[1]]);

    // Ended before the second player's first turn, there is no round to count.
    await page.getByRole('button', { name: 'Otra vez' }).click();
    await expect(turn(page)).toHaveText('Turno de Luis');
    await answer(page, 'o');
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(title(page)).toHaveText('Partida sin terminar');
    await expect(page.locator('.results-note')).toHaveText('No se ha completado ninguna ronda.');
    await expect(page.locator('.duo-list')).toHaveCount(0);
    // Ended before anything was answered, it is a game with no questions like any other.
    await page.getByRole('button', { name: 'Otra vez' }).click();
    await expect(turn(page)).toBeVisible();
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(title(page)).toHaveText('Sin preguntas');
  });

  test('is dealt in pairs of questions: a map of five pieces leaves one out', async ({ page }) => {
    await seed(page, { opts: DUO });
    await open(page, '/regiones/DK/pin');
    await expect(page.locator('.mode-facts')).toContainText('4 preguntas (2 para cada uno)');
    await page.locator('.startbar').getByRole('button', { name: 'Empezar' }).click();
    await expect(page.locator('.hud-main')).toHaveText('1 / 4', { timeout: 30_000 });
    // Without names, the two are the first player and the second.
    await expect(seats(page).locator('.duo-name')).toHaveText(['Jugador 1', 'Jugador 2']);
    await expect(turn(page)).toHaveText('Turno de Jugador 1');
  });

  test('takes two pieces at least: a list of one is no game for two, and the setup says so', async ({ page }) => {
    const list = { id: 'l1', name: 'Solo Madrid', section: 'regions', countries: ['ES'], levels: { ES: 'f' }, ids: ['ES-M'] };
    await seed(page, { opts: DUO, lists: [list], listOn: { regions: 'l1' }, mode: { regions: 'pin' } });
    await open(page, '/regiones');
    await expect(page.locator('.startbar .problem')).toHaveText('Una partida de dos pide al menos dos piezas.');
    await expect(page.locator('.startbar').getByRole('button', { name: 'Empezar' })).toBeDisabled();
    // One player alone can play it.
    await page.getByRole('radiogroup', { name: 'Formato de la partida' }).getByRole('radio', { name: 'Normal' }).click();
    await expect(page.locator('.startbar .problem')).toHaveCount(0);
    await expect(page.locator('.startbar').getByRole('button', { name: 'Empezar' })).toBeEnabled();
  });

  test('asks a list of the player whole, less one piece when its pieces are odd', async ({ page }) => {
    const list = { id: 'l1', name: 'Las del jueves', section: 'regions', countries: ['ES'], levels: { ES: 'f' }, ids: ['ES-M', 'ES-B', 'ES-V'] };
    await seed(page, { opts: { ...DUO, length: 10 }, lists: [list], listOn: { regions: 'l1' }, mode: { regions: 'pin' } });
    await open(page, '/regiones');
    await expect(page.locator('.mode-facts')).toContainText('2 preguntas (1 para cada uno)');
    await page.locator('.startbar').getByRole('button', { name: 'Empezar' }).click();
    await expect(page.locator('.hud-main')).toHaveText('1 / 2', { timeout: 30_000 });
    await expect(turn(page)).toHaveText('Turno de Jugador 1');
  });

  test('is played the same where the answer is chosen among four', async ({ page }) => {
    await start(page, { ...UK, mode: 'identify', opts: { ...DUO, answer: 'choice' } });
    // "Identify" has no name on screen: the piece that is lit is the question.
    const lit = page.locator('.map-svg [data-id].st-target');
    await expect(lit).toHaveCount(1, { timeout: 30_000 });
    await expect(turn(page)).toHaveText('Turno de Ana');
    const nameOf = (id: string) => Object.keys(ID).find((n) => ID[n] === id)!;
    // Ana picks the right one: two points.
    let id = (await lit.getAttribute('data-id'))!;
    await page.locator('.choices .choice').filter({ hasText: nameOf(id) }).click();
    await expect(turn(page)).toHaveText('Turno de Luis');
    expect(await points(page)).toEqual([2, 0]);
    // Luis picks a wrong one: among four there is one go, and it is a miss.
    id = (await lit.getAttribute('data-id'))!;
    await page.locator('.choices .choice').filter({ hasNotText: nameOf(id) }).first().click();
    await expect(page.locator('.verdict .duo-gain')).toHaveText('Luis no suma. Ahora le toca a Ana.');
    await next(page).click();
    await expect(turn(page)).toHaveText('Turno de Ana');
    expect(await points(page)).toEqual([2, 0]);
  });

  test('is told in English on the page of that language, and names nobody who gave no name', async ({ page }) => {
    await seed(page, { opts: DUO, lang: 'en', game: { ...UK, nonce: 1 } });
    await page.goto('./en.html#/jugar');
    await expect(page.locator('.q-name')).toBeVisible({ timeout: 30_000 });
    await expect(board(page)).toHaveAttribute('aria-label', 'Scoreboard');
    await expect(seats(page).locator('.duo-name')).toHaveText(['Player 1', 'Player 2']);
    await expect(turn(page)).toHaveText('Player 1’s turn');
    const first = ((await page.locator('.q-name').textContent()) ?? '').trim();
    const other = Object.values(ID).find((x) => x !== ID[first])!;
    await piece(page, other).dispatchEvent('click');
    await piece(page, ID[first]).dispatchEvent('click');
    await expect(page.locator('.verdict .duo-gain')).toHaveText('Player 1 scores 1 point. Player 2 plays next.');
    await next(page).click();
    await expect(turn(page)).toHaveText('Player 2’s turn');
    await play(page, 'ooo');
    await expect(title(page)).toHaveText('Player 2 wins');
    await expect(page.locator('.results-note')).toHaveText('4 points to 3.');
    await expect(page.locator('.results-actions button')).toHaveText(['Again', 'Change game']);
    await expect(page.locator('.duo-how').first()).toContainText('Player 2 starts the next one.');
    // The setup of that language offers it by its name there.
    await page.goto('./en.html#/regiones/GB:g1/pin');
    await expect(page.getByRole('radiogroup', { name: 'Format of the game' }).getByRole('radio', { name: 'Two players' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.duo-names').getByLabel('Player 1')).toBeVisible();
    await expect(page.locator('.startbar')).toContainText('Pin it · two players');
  });

  test('comes in a file of its own, fetched for such a game and where one is set up, and not before', async ({ page }) => {
    const fetched = fetchedBy(page);
    // A game like any other does not ask for it.
    await seed(page, { opts: { ...OPTS, length: 'all' }, game: { ...UK, opts: { ...OPTS, length: 'all' }, nonce: 1 } });
    await page.goto('./#/jugar');
    await expect(page.locator('.q-name')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.play-under')).toHaveCount(0);
    await play(page, 'oooo');
    await expect(title(page)).toBeVisible();
    expect(fetched).toEqual([]);
    // Nor does the setup, until that format is the one chosen.
    await open(page, '/regiones/GB:g1/pin');
    await expect(page.getByRole('radiogroup', { name: 'Formato de la partida' })).toBeVisible();
    expect(fetched).toEqual([]);
    await page.getByRole('radiogroup', { name: 'Formato de la partida' }).getByRole('radio', { name: 'Dos jugadores' }).click();
    await expect(page.locator('.duo-names')).toBeVisible();
    expect(fetched).toHaveLength(1);
  });

  test('goes on in plain words when that file does not come', async ({ page }) => {
    await page.route(/\/assets\/Duo-[\w-]+\.(js|css)$/, (route) => route.abort());
    await start(page);
    // No scoreboard to draw: after a moment, the same is said in words.
    await expect(page.locator('.play-under')).toHaveText('Ana 0 · Luis 0', { timeout: 10_000 });
    await expect(page.locator('.q [role="status"]').first()).toHaveText('Turno de Ana');
    const asked = await play(page, 'ob');
    await expect(page.locator('.play-under')).toHaveText('Ana 2 · Luis 0');
    await expect(page.locator('.q [role="status"]').first()).toHaveText('Turno de Ana');
    // The map is painted as in any game: there are no colours of the players to paint it with.
    await expect(piece(page, ID[asked[0]])).toHaveClass(/\bst-ok\b/);
    await expect(piece(page, ID[asked[1]])).toHaveClass(/\bst-bad\b/);
    await play(page, 'bw');
    // The result says who won where every result says how it went, and still offers nothing that is one player's.
    await expect(title(page)).toHaveText('Gana Ana');
    await expect(page.locator('.results-note')).toHaveText('2 puntos a 1.');
    await expect(page.getByRole('button', { name: /Repasar/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Otra vez' }).click();
    await expect(page.locator('.q [role="status"]').first()).toHaveText('Turno de Luis', { timeout: 10_000 });
    // Luis opens this one, and it is ended after his second answer: his first round is what counts.
    await play(page, 'obo');
    await expect(page.locator('.play-under')).toHaveText('Ana 0 · Luis 4');
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(title(page)).toHaveText('Partida sin terminar');
    await expect(page.locator('.results-note')).toHaveText('Iba ganando Luis: 2 puntos a 0 tras 1 ronda.');
  });

  test('is not what a review, a step of the day or a box in another page are played as', async ({ page, baseURL }) => {
    // What is one player's stays so, whatever format was left chosen: today's review…
    await start(page, { ...UK, review: true, only: ['GB-ENG', 'GB-SCT', 'GB-WLS'] }, {}, null);
    await expect(page.locator('.hud-main')).toHaveText('1 / 3');
    await expect(page.locator('.play-under')).toHaveCount(0);
    await expect(turn(page)).toHaveCount(0);
    // …a step of the session of the day…
    await page.evaluate((game) => {
      const saved = JSON.parse(localStorage.getItem('regionle:v1')!) as { state: Record<string, unknown> };
      saved.state.game = game;
      localStorage.setItem('regionle:v1', JSON.stringify(saved));
    }, { ...UK, step: 'new', nonce: 2 });
    await page.reload();
    await expect(page.locator('.hud-main')).toHaveText('1 / 4', { timeout: 30_000 });
    await expect(page.locator('.play-under')).toHaveCount(0);
    // …and a game inside another page, whatever its address says.
    await page.goto(`${baseURL}es.html#/incrustar/regiones/GB:g1/pin/length=all;format=duo`);
    await page.locator('.embed-box').getByRole('button', { name: 'Empezar' }).click();
    await expect(page.locator('.hud-main')).toHaveText('1 / 4', { timeout: 30_000 });
    await expect(page.locator('.play-under')).toHaveCount(0);
    await expect(turn(page)).toHaveCount(0);
  });

  test('fits a phone: the scoreboard and whose turn it is with the question, long names and all, and who won in sight at the end @movil', async ({ page }) => {
    await start(page, UK, {}, ['Maximiliano Jo', 'Wilhelmina Ant']);
    const width = page.viewportSize()!.width;
    const height = page.viewportSize()!.height;
    await expect(board(page)).toBeVisible();
    await expect(turn(page)).toHaveText('Turno de Maximiliano Jo');
    // Both seats are whole inside the screen, side by side, and the question is in sight under them.
    const boxes = await seats(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as { left: number; right: number; top: number; bottom: number }));
    expect(boxes).toHaveLength(2);
    for (const b of boxes) {
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(width);
    }
    expect(boxes[0].right).toBeLessThanOrEqual(boxes[1].left);
    expect(Math.abs(boxes[0].top - boxes[1].top)).toBeLessThan(2);
    await expect(page.locator('.q-name')).toBeInViewport({ ratio: 1 });
    await expect(turn(page)).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    await play(page, 'owbo');
    await expect(title(page)).toHaveText('Gana Wilhelmina Ant');
    // Who won is in sight, with the points of both: the keyboard goes to the button without the page moving to it.
    await expect(title(page)).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.results-note')).toBeInViewport({ ratio: 1 });
    const cards = await page.locator('.duo-final .duo-card').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as { left: number; right: number; top: number }));
    for (const c of cards) {
      expect(c.left).toBeGreaterThanOrEqual(0);
      expect(c.right).toBeLessThanOrEqual(width);
      expect(c.top).toBeLessThan(height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
});
