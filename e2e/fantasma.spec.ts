/**
 * «Contra tu fantasma»: the best game of each map is kept question by question, and the same questions can be
 * played again with that game moving alongside. What is kept and when, where a game against it is offered,
 * what is seen during one and how it ends.
 *
 * The map is Luxembourg, which has three districts: a game is three clicks. A ghost is made here the way a
 * player makes one, by playing, and written over afterwards where a test needs it to be another.
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, restart, seed } from './helpers';

// The clock of these tests is set by hand, and so is where it is read: their days are Madrid's, whatever
// E2E_ZONE says (playwright.config.ts).
test.use({ timezoneId: 'Europe/Madrid' });

const NOW = new Date('2026-11-18T12:00:00+01:00');
/** Every district, as the setup leaves it when all the questions are chosen: a ghost is of a game with its options. */
const ALL = { ...OPTS, length: 'all' };
const LUX = { section: 'regions', countries: ['LU'], mode: 'pin', levels: {}, opts: ALL };
/** The districts by the name they are asked with, in either language. */
const ID: Record<string, string> = { Diekirch: 'LU-D', Grevenmacher: 'LU-G', Luxemburgo: 'LU-L', Luxembourg: 'LU-L' };

interface Ghost {
  k: number;
  h: number;
  t: number;
  q: number[];
  d: number;
}
type Kept = [key: string, ghost: Ghost];

const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`);
const title = (page: Page) => page.locator('.results-title');
const box = (page: Page) => page.locator('section.ghost-box');
/**
 * The line of the setup for a ghost that missed one of three. A pattern is read against the text as it is written:
 * the figure is tied to its sign by a space that does not break, and the short name of a month may end in a stop.
 */
const OFFER = /^Tu fantasma aquí: 67\s% en 0:00 · 18 nov\.?$/;
/** The two lanes under the header of a game against the ghost: the player's, and the ghost's. */
const lanes = (page: Page) => page.locator('.play-under .ghost-lanes');
const mine = (page: Page) => page.locator('.play-under .ghost-lane:not(.it)');
const its = (page: Page) => page.locator('.play-under .ghost-lane.it');
/** What the browser keeps of the ghosts, as it is written; null when it keeps nothing. */
const kept = (page: Page): Promise<Kept[] | null> => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:ghosts') ?? 'null') as Kept[] | null);
/** How each question of a ghost went: 0 right at once, 1 with help, 2 missed. */
const went = (ghost: Ghost): number[] => ghost.q.map((v) => v % 3);

/**
 * Plays the game on screen to its results: the first `misses` questions are never found (three wrong clicks
 * each) and the rest at once; what was missed is asked once more before the result, and found then. Returns
 * the names in the order they were asked.
 */
async function playLux(page: Page, misses = 0): Promise<string[]> {
  const name = page.locator('.q-name');
  const next = page.getByRole('button', { name: /^(Siguiente|Ver resultado)/ });
  const asked: string[] = [];
  await expect(name).toBeVisible({ timeout: 30_000 });
  await expect(piece(page, 'LU-D')).toBeVisible({ timeout: 30_000 });
  while (!(await title(page).isVisible())) {
    const now = ((await name.textContent()) ?? '').trim();
    const id = ID[now];
    expect(id, now).toBeTruthy();
    if (asked.length < misses) {
      const other = Object.values(ID).find((x) => x !== id)!;
      for (let i = 0; i < 3; i++) await piece(page, other).dispatchEvent('click');
      await next.click();
    } else await piece(page, id).dispatchEvent('click');
    asked.push(now);
    // The next question, or the result.
    await expect(async () => {
      const over = await title(page).isVisible();
      const then = over ? '' : ((await name.textContent({ timeout: 1000 })) ?? '').trim();
      expect(over || then !== now).toBe(true);
    }).toPass({ timeout: 15_000 });
  }
  return asked.slice(0, 3);
}

/** Someone who plays every district of Luxembourg, and their first game there: the ghost it leaves, and the order of its questions. */
async function firstGame(page: Page, misses = 0, state: Record<string, unknown> = {}): Promise<{ ghost: Ghost; key: string; order: string[] }> {
  await seed(page, { opts: ALL, ...state, game: { ...LUX, nonce: 1 } });
  await page.goto('./#/jugar');
  const order = await playLux(page, misses);
  await expect(box(page)).toBeVisible();
  const [[key, ghost]] = (await kept(page))!;
  return { ghost, key, order };
}

/**
 * How many times the page asks for the file of the ghosts, as it does: what settles a game against its ghost
 * and draws both comes in a file of its own (games/Ghost.tsx), and only when there is a ghost to show or to keep.
 */
function fetchedBy(page: Page): string[] {
  const names: string[] = [];
  page.on('request', (request) => {
    const file = /\/assets\/(Ghost-[^/]+\.js)$/.exec(request.url());
    if (file) names.push(file[1]);
  });
  return names;
}

/** Writes over the one ghost that is kept. The page has read it already: it is what the next page finds. */
async function reshape(page: Page, patch: Partial<Ghost>): Promise<void> {
  await page.evaluate((p) => {
    const list = JSON.parse(localStorage.getItem('regionle:ghosts')!) as [string, Record<string, unknown>][];
    Object.assign(list[0][1], p);
    localStorage.setItem('regionle:ghosts', JSON.stringify(list));
  }, patch);
}

test.describe('the ghost of a map', () => {
  test.beforeEach(async ({ page }) => {
    // The clock does not move: every game takes 0:00, and two games with the same score are a tie.
    await page.clock.setFixedTime(NOW);
  });

  test('is the best game played on it, kept question by question, and the results offer a game against it', async ({ page }) => {
    const { ghost, key } = await firstGame(page, 1);
    // The first game of a map is its ghost, whatever it was like.
    expect(key).toMatch(/^regions\|pin\|[0-9a-z]+$/);
    expect(went(ghost)).toEqual([2, 0, 0]);
    expect(ghost).toMatchObject({ t: NOW.getTime(), d: 0 });
    await expect(title(page)).not.toContainText('fantasma');
    await expect(box(page)).toHaveAttribute('data-how', 'first');
    await expect(box(page).locator('.ghost-head')).toHaveText('Tu fantasma');
    await expect(box(page).locator('.ghost-say')).toHaveText('Esta partida queda como tu fantasma aquí: 67 % en 0:00.');
    await expect(box(page).locator('.duel-how')).toHaveText('Contra tu fantasma juegas sus mismas preguntas, en el mismo orden, y lo ves avanzar a tu lado. Gana quien saca más porcentaje y, con el mismo, quien tarda menos.');
    // Nothing of a game against it: there was none.
    await expect(box(page).locator('.duel-vs')).toHaveCount(0);
    await expect(box(page).getByRole('button', { name: 'Contra tu fantasma' })).toBeVisible();

    // Another game like any other, and a better one: it takes the place of the ghost.
    await page.locator('.results-actions').getByRole('button', { name: 'Otra vez' }).click();
    await expect(page.locator('.hud-main')).toHaveText('1 / 3');
    await expect(page.locator('.play-under')).toHaveCount(0);
    await playLux(page);
    await expect(box(page)).toHaveAttribute('data-how', 'better');
    await expect(box(page).locator('.ghost-say')).toHaveText('Has mejorado tu fantasma, que era 67 % en 0:00: ahora lo es esta partida, con 100 % en 0:00.');
    const better = (await kept(page))!;
    expect(better).toHaveLength(1);
    expect(better[0][0]).toBe(key);
    expect(went(better[0][1])).toEqual([0, 0, 0]);
    // Its questions were dealt afresh: the ghost is of those.
    expect(better[0][1].k).not.toBe(ghost.k);

    // A worse one leaves it where it was.
    await page.locator('.results-actions').getByRole('button', { name: 'Otra vez' }).click();
    await expect(page.locator('.hud-main')).toHaveText('1 / 3');
    await playLux(page, 2);
    await expect(box(page)).toHaveAttribute('data-how', 'kept');
    await expect(box(page).locator('.ghost-say')).toHaveText('Tu fantasma aquí es tu partida de hoy: 100 % en 0:00.');
    await expect(box(page).getByRole('button', { name: 'Contra tu fantasma' })).toBeVisible();
    expect(await kept(page)).toEqual(better);
  });

  test('is played against with its own questions and both in sight, and the results open with who won', async ({ page }) => {
    const { ghost, key, order } = await firstGame(page, 1);
    await box(page).getByRole('button', { name: 'Contra tu fantasma' }).click();

    // Two lanes under the header, and the count of the game is the player's lane.
    await expect(lanes(page)).toBeVisible();
    await expect(page.locator('.play-under .ghost-who')).toHaveText(['Tú', 'Fantasma']);
    await expect(mine(page).locator('.ghost-n')).toHaveText('0 / 3');
    // The ghost took no time at all (the clock of these tests does not move): it is at its end already.
    await expect(its(page).locator('.ghost-n')).toHaveText('3 / 3');
    await expect(its(page).locator('.ghost-bar i')).toHaveClass(['bad', 'ok']);
    await expect(mine(page).locator('.ghost-bar i')).toHaveClass(['todo']);
    await expect(lanes(page)).toHaveAttribute('aria-label', 'Tú: 0 de 3 preguntas, 0 a la primera. Tu fantasma: 3 de 3, 2 a la primera.');
    await expect(page.locator('.hud-main')).toHaveCount(0);
    await expect(page.locator('.play-top .play-bar')).toHaveCount(0);

    // The same questions, in the same order.
    const again = await playLux(page);
    expect(again).toEqual(order);
    await expect(title(page)).toHaveText('¡Has ganado a tu fantasma!');
    await expect(page.locator('.results-note')).toHaveText('Tu fantasma: 67 % en 0:00.');
    await expect(box(page)).toHaveAttribute('data-how', 'won');
    const sides = box(page).locator('.duel-vs dl > div');
    await expect(sides).toHaveText(['Tú100 % 0:00', 'Tu fantasma67 % 0:00']);
    await expect(sides.nth(0)).toHaveClass(/best/);
    await expect(sides.nth(1)).not.toHaveClass(/best/);
    await expect(box(page).locator('.ghost-lanes')).toHaveAttribute('aria-label', 'Pregunta a pregunta. Tú: 3 a la primera, 0 con ayuda y 0 fallos. Tu fantasma: 2 a la primera, 0 con ayuda y 1 fallos.');
    await expect(box(page).locator('.ghost-say')).toHaveText('Esta partida pasa a ser tu fantasma aquí.');
    await expect(box(page).locator('.duel-how')).toHaveText('Gana quien saca más porcentaje y, con el mismo, quien tarda menos.');
    await expect(box(page).getByRole('button', { name: 'Contra tu fantasma' })).toHaveCount(0);
    // The game that won is the ghost now, and it is of the same questions.
    const won = (await kept(page))!;
    expect(won).toHaveLength(1);
    expect(won[0][0]).toBe(key);
    expect(went(won[0][1])).toEqual([0, 0, 0]);
    expect(won[0][1]).toMatchObject({ k: ghost.k, h: ghost.h });

    // «Otra vez» is another game against the ghost: the one the map has now. The same score in the same time is a tie.
    await page.locator('.results-actions').getByRole('button', { name: 'Otra vez' }).click();
    await expect(lanes(page)).toBeVisible();
    await expect(its(page).locator('.ghost-bar i')).toHaveClass(['ok']);
    expect(await playLux(page)).toEqual(order);
    await expect(title(page)).toHaveText('Empate con tu fantasma');
    await expect(page.locator('.results-note')).toHaveText('Tu fantasma: 100 % en 0:00.');
    await expect(box(page)).toHaveAttribute('data-how', 'tie');
    await expect(box(page).locator('.duel-vs dl > div.best')).toHaveCount(0);
    await expect(box(page).locator('.ghost-say')).toHaveText('Tu fantasma sigue siendo tu partida de hoy.');
    expect(await kept(page)).toEqual(won);
  });

  test('stays when it wins or the game is left before its end, and can be played without', async ({ page }) => {
    const { order } = await firstGame(page);
    const first = (await kept(page))!;
    await box(page).getByRole('button', { name: 'Contra tu fantasma' }).click();
    await expect(lanes(page)).toBeVisible();
    expect(await playLux(page, 1)).toEqual(order);
    await expect(title(page)).toHaveText('Gana tu fantasma');
    await expect(page.locator('.results-note')).toHaveText('Tu fantasma: 100 % en 0:00.');
    await expect(box(page)).toHaveAttribute('data-how', 'lost');
    const sides = box(page).locator('.duel-vs dl > div');
    await expect(sides).toHaveText(['Tú67 % 0:00', 'Tu fantasma100 % 0:00']);
    await expect(sides.nth(1)).toHaveClass(/best/);
    await expect(box(page).locator('.ghost-say')).toHaveText('Tu fantasma sigue siendo tu partida de hoy.');
    expect(await kept(page)).toEqual(first);

    // Left after one question: not a game to set beside the ghost.
    await page.locator('.results-actions').getByRole('button', { name: 'Otra vez' }).click();
    await expect(lanes(page)).toBeVisible();
    await piece(page, ID[order[0]]).dispatchEvent('click');
    await expect(mine(page).locator('.ghost-n')).toHaveText('1 / 3');
    await expect(mine(page).locator('.ghost-bar i')).toHaveClass(['ok', 'todo']);
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(title(page)).toBeVisible();
    await expect(title(page)).not.toContainText('fantasma');
    await expect(box(page)).toHaveAttribute('data-how', 'left');
    await expect(box(page).locator('.duel-vs')).toHaveCount(0);
    await expect(box(page).locator('.ghost-say')).toHaveText('Has dejado la partida antes del final, así que no cuenta: tu fantasma sigue siendo tu partida de hoy, con 100 % en 0:00.');
    expect(await kept(page)).toEqual(first);

    // Without the ghost: a game like any other, with questions of its own.
    await box(page).getByRole('button', { name: 'Jugar sin fantasma' }).click();
    await expect(page.locator('.hud-main')).toHaveText('1 / 3');
    await expect(page.locator('.play-under')).toHaveCount(0);
    await playLux(page);
    await expect(title(page)).not.toContainText('fantasma');
    await expect(box(page)).toHaveAttribute('data-how', 'kept');
    await expect(box(page).getByRole('button', { name: 'Contra tu fantasma' })).toBeVisible();
  });

  test('is not there in the round of what was missed, which is no game to keep', async ({ page }) => {
    const { order } = await firstGame(page);
    const first = (await kept(page))!;
    await box(page).getByRole('button', { name: 'Contra tu fantasma' }).click();
    await expect(lanes(page)).toBeVisible();
    await playLux(page, 1);
    await expect(title(page)).toHaveText('Gana tu fantasma');
    await page.getByRole('button', { name: 'Repasar 1 fallo' }).click();
    await expect(page.locator('.hud-main')).toHaveText('1 / 1');
    await expect(page.locator('.play-under')).toHaveCount(0);
    await expect(page.locator('.q-name')).toHaveText(order[0]);
    await piece(page, ID[order[0]]).dispatchEvent('click');
    await expect(title(page)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.results-actions')).toBeVisible();
    await expect(title(page)).not.toContainText('fantasma');
    await expect(box(page)).toHaveCount(0);
    expect(await kept(page)).toEqual(first);
  });

  test('is offered where the game is chosen: for that game on that map, as it is set', async ({ page }) => {
    const { ghost } = await firstGame(page, 1);
    await open(page, '/regiones/LU/pin');
    const offer = page.locator('.ghost-offer');
    await expect(offer.locator('p')).toHaveText(OFFER);
    // Another game of the same map has no ghost yet, and an exam never has one.
    await page.locator('.mode').filter({ hasText: 'Identificar' }).click();
    await expect(page.locator('.mode.on')).toContainText('Identificar');
    await expect(offer).toHaveCount(0);
    await page.locator('.mode').filter({ hasText: 'Señalar' }).click();
    await expect(offer).toBeVisible();
    const format = page.getByRole('radiogroup', { name: 'Formato de la partida' });
    await format.getByRole('radio', { name: 'Examen' }).click();
    await expect(page.locator('.startbar')).toContainText('examen');
    await expect(offer).toHaveCount(0);
    await format.getByRole('radio', { name: 'Normal' }).click();
    await expect(offer).toBeVisible();

    await offer.getByRole('button', { name: 'Contra tu fantasma' }).click();
    await expect(lanes(page)).toBeVisible();
    await expect(its(page).locator('.ghost-n')).toHaveText('3 / 3');
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state.game as { ghost?: { seed: number }; mode: string });
    expect(state).toMatchObject({ mode: 'pin', ghost: { seed: ghost.k } });
    // The button that starts a game starts one like any other.
    await open(page, '/regiones/LU/pin');
    await page.locator('.startbar').getByRole('button', { name: 'Empezar' }).click();
    await expect(page.locator('.hud-main')).toHaveText('1 / 3');
    await expect(page.locator('.play-under')).toHaveCount(0);
  });

  test('is offered and told of in English on the page of that language', async ({ page }) => {
    await firstGame(page, 1);
    await page.goto('./en.html#/regiones/LU/pin');
    const offer = page.locator('.ghost-offer');
    await expect(offer.locator('p')).toHaveText(/^Your ghost here: 67% in 0:00 · 18 Nov\.?$/);
    await offer.getByRole('button', { name: 'Against your ghost' }).click();
    await expect(page.locator('.play-under .ghost-who')).toHaveText(['You', 'Ghost']);
    await expect(lanes(page)).toHaveAttribute('aria-label', 'You: 0 of 3 questions, 0 right first time. Your ghost: 3 of 3, 2 right first time.');
    await playLux(page);
    await expect(title(page)).toHaveText('You beat your ghost!');
    await expect(page.locator('.results-note')).toHaveText('Your ghost: 67% in 0:00.');
    await expect(box(page).locator('.duel-vs dl > div')).toHaveText(['You100% 0:00', 'Your ghost67% 0:00']);
    await expect(box(page).locator('.ghost-say')).toHaveText('This game is now your ghost here.');
    await expect(box(page).getByRole('button', { name: 'Play without the ghost' })).toBeVisible();
    await expect(box(page).locator('.duel-how')).toHaveText('The higher percentage wins and, with the same one, the shorter time.');
  });

  test('of questions the map no longer deals cannot be played against, and the game that ends takes its place', async ({ page }) => {
    const { ghost, key, order } = await firstGame(page);
    // As if the map had changed since: the questions it deals to that seed are not the ones the ghost answered.
    await reshape(page, { h: ghost.h + 1, q: [2, 2, 2] });
    await restart(page, { ...LUX, ghost: { seed: ghost.k } });
    await expect(page.locator('.ghost-none')).toHaveText('Ya no se puede jugar contra ese fantasma: esta partida va sin él.');
    await expect(lanes(page)).toHaveCount(0);
    // With no lanes, the count of the game and its bar are where they always are.
    await expect(page.locator('.hud-main')).toHaveText('1 / 3');
    await expect(page.locator('.play-top .play-bar')).toHaveCount(1);
    expect(await playLux(page, 1)).toEqual(order);
    // Not a game against anyone: and though the ghost that was kept had a better score, this one is the ghost now.
    await expect(title(page)).not.toContainText('fantasma');
    await expect(box(page)).toHaveAttribute('data-how', 'first');
    await expect(box(page).locator('.ghost-say')).toHaveText('Esta partida queda como tu fantasma aquí: 67 % en 0:00.');
    const now = (await kept(page))!;
    expect(now).toHaveLength(1);
    expect(now[0][0]).toBe(key);
    expect(now[0][1]).toMatchObject({ k: ghost.k, h: ghost.h });
    expect(went(now[0][1])).toEqual([2, 0, 0]);
    // It was not a game against the ghost after all: the box offers one, as after any other game. And «Otra vez» is against it.
    await expect(box(page).getByRole('button', { name: 'Contra tu fantasma' })).toBeVisible();
    await expect(box(page).getByRole('button', { name: 'Jugar sin fantasma' })).toHaveCount(0);
    await page.locator('.results-actions').getByRole('button', { name: 'Otra vez' }).click();
    await expect(lanes(page)).toBeVisible();
    await expect(page.locator('.ghost-none')).toHaveCount(0);
  });

  test('comes in a file of its own, fetched half-way through a game and not before', async ({ page }) => {
    const fetched = fetchedBy(page);
    await seed(page, { opts: ALL, game: { ...LUX, nonce: 1 } });
    await page.goto('./#/jugar');
    await expect(piece(page, 'LU-D')).toBeVisible({ timeout: 30_000 });
    for (let n = 0; n < 2; n++) {
      await expect(page.locator('.hud-main')).toHaveText(`${n + 1} / 3`);
      // One answer of three is not half of them.
      expect(fetched, `before answer ${n + 1}`).toEqual([]);
      const name = ((await page.locator('.q-name').textContent()) ?? '').trim();
      await piece(page, ID[name]).dispatchEvent('click');
    }
    await expect.poll(() => fetched.length).toBe(1);
    await playLux(page);
    await expect(box(page)).toHaveAttribute('data-how', 'first');
    // Once here, it is not asked for again: not by the game against the ghost, nor by the setup that offers it.
    await box(page).getByRole('button', { name: 'Contra tu fantasma' }).click();
    await expect(lanes(page)).toBeVisible();
    await open(page, '/regiones/LU/pin');
    await expect(page.locator('.ghost-offer')).toBeVisible();
    expect(fetched).toHaveLength(1);
  });

  test('is not kept of an exam, nor offered after one, and nothing of the ghosts is fetched for it', async ({ page }) => {
    const fetched = fetchedBy(page);
    await seed(page, { opts: ALL, game: { ...LUX, opts: { ...ALL, format: 'exam' }, nonce: 1 } });
    await page.goto('./#/jugar');
    await expect(piece(page, 'LU-D')).toBeVisible({ timeout: 30_000 });
    for (let n = 0; n < 3; n++) {
      await expect(page.locator('.hud-main')).toHaveText(`${n + 1} / 3`);
      const name = ((await page.locator('.q-name').textContent()) ?? '').trim();
      await piece(page, ID[name]).dispatchEvent('click');
    }
    await expect(title(page)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.results-actions')).toBeVisible();
    await expect(box(page)).toHaveCount(0);
    expect(await kept(page)).toBeNull();
    // Nor does the setup of someone who has no ghost ask for what would show one.
    await open(page, '/regiones/LU/pin');
    await expect(page.locator('.startbar')).toBeVisible();
    await expect(page.locator('.mode.on')).toContainText('Señalar');
    await expect(page.locator('.ghost-offer')).toHaveCount(0);
    expect(fetched).toEqual([]);
  });

  test('travels in the backup, and goes with the progress when that is deleted', async ({ page }) => {
    const { ghost, key } = await firstGame(page, 1);
    await open(page, '/progreso');
    const block = page.locator('.backup-block');
    const saving = page.waitForEvent('download');
    await block.getByRole('button', { name: 'Exportar' }).click();
    const text = fs.readFileSync((await (await saving).path())!, 'utf8');
    const copy = JSON.parse(text) as { version: number; ghosts: Kept[] };
    expect(copy.version).toBe(4);
    expect(copy.ghosts).toEqual([[key, ghost]]);

    await block.getByRole('button', { name: 'Borrar progreso' }).click();
    await block.getByRole('button', { name: 'Sí, borrar' }).click();
    await expect(block.locator('.q-note')).toHaveText('Progreso borrado.');
    expect(await kept(page)).toBeNull();
    await open(page, '/regiones/LU/pin');
    await expect(page.locator('.startbar')).toBeVisible();
    await expect(page.locator('.ghost-offer')).toHaveCount(0);

    // The copy brings it back, and it is offered where it was.
    await open(page, '/progreso');
    await block.locator('input[type=file]').setInputFiles({ name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from(text) });
    await block.locator('.backup-in').getByRole('button', { name: 'Sustituir lo que hay aquí' }).click();
    await expect(block.locator('.q-note')).toContainText('Copia importada');
    expect(await kept(page)).toEqual([[key, ghost]]);
    await open(page, '/regiones/LU/pin');
    await expect(page.locator('.ghost-offer p')).toHaveText(OFFER);

    // A copy from before there were ghosts says nothing about them: the ones here stay.
    const old = JSON.parse(text) as Record<string, unknown>;
    delete old.ghosts;
    await open(page, '/progreso');
    await block.locator('input[type=file]').setInputFiles({ name: 'vieja.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(old)) });
    await block.locator('.backup-in').getByRole('button', { name: 'Sustituir lo que hay aquí' }).click();
    await expect(block.locator('.q-note')).toContainText('Copia importada');
    expect(await kept(page)).toEqual([[key, ghost]]);
  });

  test('is not kept of a game played in a box of another page', async ({ page, baseURL }) => {
    const fetched = fetchedBy(page);
    await seed(page, { opts: ALL });
    // A page of the site of the game itself: there the box and the game share what the browser keeps.
    const host = `${baseURL}la-misma-web.html`;
    await page.route(host, (route) =>
      route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="es"><meta charset="utf-8"><body><h1 id="suya">La misma web</h1><iframe src="${baseURL}es.html#/incrustar/regiones/LU/pin/length=all" title="Regionle" width="100%" height="640"></iframe></body></html>` }),
    );
    await page.goto(host);
    const frame = page.frameLocator('iframe');
    await frame.locator('.embed-box').getByRole('button', { name: 'Empezar' }).click();
    await expect(frame.locator('.hud-main')).toHaveText('1 / 3', { timeout: 30_000 });
    for (let n = 0; n < 3; n++) {
      await expect(frame.locator('.hud-main')).toHaveText(`${n + 1} / 3`);
      const name = ((await frame.locator('.q-name').textContent()) ?? '').trim();
      await frame.locator(`.map-svg [data-id="${ID[name]}"]`).dispatchEvent('click');
    }
    await expect(frame.locator('.results-title')).toBeVisible({ timeout: 15_000 });
    await expect(frame.locator('.results-actions')).toBeVisible();
    await expect(frame.locator('.ghost-box')).toHaveCount(0);
    expect(await kept(page)).toBeNull();
    expect(fetched).toEqual([]);
  });

  test('fits a phone: both lanes with the question, and who won in sight when the game ends @movil', async ({ page }) => {
    await firstGame(page, 1);
    // What the game leaves is in sight below the result, with its button.
    await box(page).getByRole('button', { name: 'Contra tu fantasma' }).click();
    await expect(lanes(page)).toBeVisible();
    await expect(lanes(page)).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.q-name')).toBeInViewport({ ratio: 1 });
    // Each lane is one line — who it is, the stretch and the count — and the two take two lines of small print.
    expect(await lanes(page).evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(36);
    for (const lane of [mine(page), its(page)]) {
      const tops = await lane.locator('.ghost-who, .ghost-bar, .ghost-n').evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => r.top + r.height / 2));
      expect(tops).toHaveLength(3);
      expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(4);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await playLux(page);
    await expect(title(page)).toHaveText('¡Has ganado a tu fantasma!');
    // Without scrolling: the title of the results is what says it.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(title(page)).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.results-note')).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // The two games side by side fit the width of the screen.
    await box(page).scrollIntoViewIfNeeded();
    const wide = await box(page).evaluate((el) => [el.scrollWidth, el.clientWidth]);
    expect(wide[0]).toBeLessThanOrEqual(wide[1]);
  });
});

test.describe('the ghost during a game', () => {
  test('moves as the clock of the game does, waits while the rules are open, and starts again with the page', async ({ page }) => {
    // The clock of the page runs by itself, and is moved on by hand when the wait would be long.
    await page.clock.install({ time: NOW });
    const { ghost, order } = await firstGame(page);
    // A ghost that found the first at once, the second after a minute and the last after eleven.
    await reshape(page, { q: [0, 600 * 3, 6000 * 3 + 1], d: 6600 });
    await restart(page, { ...LUX, ghost: { seed: ghost.k } });
    await expect(lanes(page)).toBeVisible();
    await expect(its(page).locator('.ghost-n')).toHaveText('1 / 3');
    await expect(its(page).locator('.ghost-bar i')).toHaveClass(['ok', 'todo']);
    await page.clock.fastForward(61_000);
    await expect(its(page).locator('.ghost-n')).toHaveText('2 / 3');
    await expect(lanes(page)).toHaveAttribute('aria-label', 'Tú: 0 de 3 preguntas, 0 a la primera. Tu fantasma: 2 de 3, 2 a la primera.');

    // The rules stop the clock of the game, and the ghost with it.
    await page.getByRole('button', { name: 'Cómo se juega' }).click();
    const rules = page.getByRole('dialog', { name: 'Cómo se juega' });
    await expect(rules).toBeVisible();
    await expect(rules).toContainText('Contra tu fantasma');
    await page.clock.fastForward(900_000);
    await rules.getByRole('button', { name: 'Seguir jugando' }).click();
    await expect(rules).toHaveCount(0);
    await page.clock.fastForward(2000);
    await expect(page.locator('.hud-chip[title="Tiempo"]')).toHaveText(/^1:0\d$/);
    await expect(its(page).locator('.ghost-n')).toHaveText('2 / 3');

    // The player moves in their own lane.
    await piece(page, ID[order[0]]).dispatchEvent('click');
    await expect(mine(page).locator('.ghost-n')).toHaveText('1 / 3');
    await page.clock.fastForward(600_000);
    await expect(its(page).locator('.ghost-n')).toHaveText('3 / 3');
    await expect(its(page).locator('.ghost-bar i')).toHaveClass(['ok', 'warn']);

    // The page opened again: the game starts again, and so does the ghost.
    await page.reload();
    await expect(lanes(page)).toBeVisible({ timeout: 30_000 });
    await expect(mine(page).locator('.ghost-n')).toHaveText('0 / 3');
    await expect(its(page).locator('.ghost-n')).toHaveText('1 / 3');
    await expect(page.locator('.q-name')).toHaveText(order[0]);
  });
});
