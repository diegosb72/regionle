import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, seed, start, type } from './helpers';

/** The countries of Europe that the game offers as such: forty-four, with some eighty borders among them. */
const EUROPE_IDS = 'AL AD AT BY BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB'.split(' ');
const EUROPE = { section: 'countries', mode: 'border', countries: EUROPE_IDS, opts: { answer: 'choice' } };
/** The nineteen autonomous communities of Spain, with the two names typed. */
const COMMUNITIES = { section: 'regions', mode: 'border', countries: ['ES'], levels: { ES: 'g1' } };

const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { sessions: { mode: string; label: string; total: number; ok: number; warn: number; bad: number }[]; stats: Record<string, unknown> });
const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`).first();
const options = (page: Page) => page.locator('.border-choices .choice');
const option = (page: Page, text: string) => options(page).filter({ has: page.locator('span', { hasText: new RegExp(`^${text}$`) }) });
const trace = (page: Page) => page.locator('.map-svg .m-trace');
const sides = (page: Page) => page.locator('.border-sides .border-side');
const lost = (page: Page) => page.locator('.nb-lives i.off');
const labels = (page: Page) => page.locator('.map-svg text.m-lbl');
type Box = { x: number; y: number; width: number; height: number };
/**
 * The box the border takes on screen, in pixels, once the map has stopped moving. Measured on the line as it
 * is drawn, without its stroke: the stroke of a border that is being asked beats, and its box with it.
 */
async function traceBox(page: Page): Promise<Box> {
  const read = () =>
    trace(page)
      .first()
      .evaluate((el) => {
        const path = el as SVGPathElement;
        const b = path.getBBox();
        const m = path.getScreenCTM()!;
        return { x: Math.round(b.x * m.a + m.e), y: Math.round(b.y * m.d + m.f), width: Math.round(b.width * m.a), height: Math.round(b.height * m.d) };
      });
  let last: Box = { x: 0, y: 0, width: -1, height: -1 };
  await expect
    .poll(async () => {
      const now = await read();
      const still = JSON.stringify(now) === JSON.stringify(last);
      last = now;
      return still;
    })
    .toBe(true);
  return last;
}

test.describe('the border game with four options', () => {
  test('lights a border up on a map without names and offers four borders', async ({ page }) => {
    await start(page, EUROPE);
    await expect(page.locator('.play-title strong')).toHaveText('Fronteras');
    await expect(page.locator('.kicker')).toHaveText('La frontera marcada');
    await expect(page.locator('.q-ask')).toHaveText('¿Qué dos países separa?');
    await expect(page.locator('.hud-main')).toHaveText('1 / 10');
    // With this game the first border is that of Albania and Montenegro. One wrong option shares Montenegro,
    // another Albania, and the third neither: no name gives the answer away by being there twice.
    await expect(options(page).locator('span')).toHaveText(['Albania – Montenegro', 'Bosnia y Herzegovina – Montenegro', 'Bosnia y Herzegovina – Serbia', 'Albania – Macedonia del Norte']);
    await expect(trace(page)).toHaveCount(1);
    await expect(trace(page)).toHaveClass(/st-ask/);
    // Nothing is named or painted while the border is open, and the map says nothing under the pointer.
    await expect(labels(page)).toHaveCount(0);
    await expect(page.locator('.map-svg [data-id][class*="st-ok"], .map-svg [data-id][class*="st-target"]')).toHaveCount(0);
    await piece(page, 'AL').hover({ force: true });
    await expect(page.locator('.map-tip')).toHaveText('');

    await option(page, 'Albania – Montenegro').click();
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.verdict-head')).toHaveText('¡Eso es!');
    await expect(page.locator('.border-answer')).toHaveText('Es la frontera entre Albania y Montenegro.');
    await expect(option(page, 'Albania – Montenegro')).toHaveClass(/right/);
    await expect(options(page).first()).toBeDisabled();
    await expect(trace(page)).toHaveClass(/st-ok/);
    await expect(piece(page, 'AL')).toHaveClass(/st-ok/);
    await expect(piece(page, 'ME')).toHaveClass(/st-ok/);
    // Both sides are named now, and only they.
    await expect(labels(page)).toHaveCount(2);
    await expect(page.locator('.map-svg text.m-lbl', { hasText: 'Albania' })).toHaveCount(1);
    await expect(page.locator('.map-svg text.m-lbl', { hasText: 'Montenegro' })).toHaveCount(1);
    // A border between two countries has an article of its own to look for.
    await expect(page.locator('.verdict .links a')).toHaveAttribute('href', `https://es.wikipedia.org/w/index.php?search=${encodeURIComponent('Frontera entre Albania y Montenegro')}`);
  });

  test('marks a wrong border, shows the right one, and goes on with the keys', async ({ page }) => {
    await start(page, EUROPE);
    await expect(options(page)).toHaveCount(4);
    await page.keyboard.press('2');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.verdict-head')).toHaveText('No era esa');
    await expect(page.locator('.border-answer')).toHaveText('Es la frontera entre Albania y Montenegro.');
    await expect(option(page, 'Bosnia y Herzegovina – Montenegro')).toHaveClass(/wrong/);
    await expect(option(page, 'Albania – Montenegro')).toHaveClass(/right/);
    await expect(trace(page)).toHaveClass(/st-bad/);
    await expect(piece(page, 'AL')).toHaveClass(/st-target/);
    await expect(piece(page, 'ME')).toHaveClass(/st-target/);
    // Bosnia was in the option picked, but it is no side of this border: it stays as it was.
    await expect(piece(page, 'BA')).not.toHaveClass(/st-/);
    // A second key does not answer twice.
    await page.keyboard.press('1');
    await expect(page.locator('.verdict-head')).toHaveText('No era esa');

    await page.keyboard.press('Enter');
    await expect(page.locator('.hud-main')).toHaveText('2 / 10');
    await expect(page.locator('.verdict')).toHaveCount(0);
    await expect(options(page).locator('span')).toHaveText(['Alemania – Francia', 'Bélgica – Luxemburgo', 'Alemania – Luxemburgo', 'Bélgica – Francia']);
    await expect(trace(page)).toHaveClass(/st-ask/);
    await expect(labels(page)).toHaveCount(0);
    await expect(piece(page, 'AL')).not.toHaveClass(/st-/);
    await page.keyboard.press('2');
    await expect(page.locator('.verdict-head')).toHaveText('¡Eso es!');
    await expect(page.locator('.border-answer')).toHaveText('Es la frontera entre Bélgica y Luxemburgo.');
  });

  test('keeps the game as a session, lists the borders and repeats the ones that were missed', async ({ page }) => {
    await start(page, EUROPE);
    await option(page, 'Albania – Montenegro').click();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await option(page, 'Alemania – Francia').click();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.locator('.hud-main')).toHaveText('3 / 10');
    await option(page, 'Croacia – Serbia').click();
    await expect(page.locator('.border-answer')).toHaveText('Es la frontera entre Bosnia y Herzegovina y Montenegro.');
    await page.getByRole('button', { name: 'Terminar' }).click();

    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('.donut')).toContainText('1 de 3');
    await expect(page.locator('.results-stats')).toContainText('Mejor racha1');
    // Each border is a row: one side, then the other, as the options were written.
    await expect(page.locator('.results-group.g-bad .row-name')).toHaveText(['Bélgica– Luxemburgo', 'Bosnia y Herzegovina– Montenegro']);
    await expect(page.locator('.results-group.g-ok .row-name')).toHaveText(['Albania– Montenegro']);
    // The whole map again, with its names and no border marked.
    await expect(trace(page)).toHaveCount(0);
    await expect(page.locator('.map-svg text.m-lbl', { hasText: 'España' })).toHaveCount(1);

    const state = await kept(page);
    expect(state.sessions.at(-1)).toMatchObject({ mode: 'border', label: 'Europa · 44 países', total: 3, ok: 1, warn: 0, bad: 2 });
    // A border is no piece: nothing is noted against Albania or Belgium.
    expect(state.stats ?? {}).toEqual({});

    await page.getByRole('button', { name: 'Repasar 2 fallos' }).click();
    await expect(page.locator('.hud-main')).toHaveText('1 / 2');
    const missed = /^(Bélgica – Luxemburgo|Bosnia y Herzegovina – Montenegro)$/;
    for (const n of [1, 2]) {
      await expect(page.locator('.hud-main')).toHaveText(`${n} / 2`);
      // Four options still: the wrong ones come from the whole map.
      await expect(options(page)).toHaveCount(4);
      const right = options(page).filter({ has: page.locator('span', { hasText: missed }) });
      await expect(right).toHaveCount(1);
      await right.click();
      await expect(page.locator('.verdict-head')).toHaveText('¡Eso es!');
      await page.getByRole('button', { name: n === 2 ? 'Ver resultado' : 'Siguiente' }).click();
    }
    await expect(page.locator('.results-title')).toHaveText('¡Todas las fronteras!');
    await expect(page.locator('.results-group.g-ok .row-name')).toHaveCount(2);
    await expect(page.getByRole('button', { name: /^Repasar/ })).toHaveCount(0);
  });

  test('asks about provinces as well, each pair written in the order of the alphabet', async ({ page }) => {
    await start(page, { section: 'regions', mode: 'border', countries: ['ES'], levels: { ES: 'f' }, opts: { answer: 'choice' } });
    await expect(page.locator('.q-ask')).toHaveText('¿Qué dos provincias separa?');
    await expect(options(page).locator('span')).toHaveText(['Burgos – Soria', 'La Rioja – Soria', 'Álava – La Rioja', 'Burgos – Valladolid']);
    await page.keyboard.press('1');
    await expect(page.locator('.verdict-head')).toHaveText('¡Eso es!');
    await expect(page.locator('.border-answer')).toHaveText('Es la frontera entre Burgos y Soria.');
    // Provinces have no article about each border: no link to look for one.
    await expect(page.locator('.verdict .links')).toHaveCount(0);
  });

  test('asks, on a custom list, the borders among its pieces', async ({ page }) => {
    await start(page, { ...EUROPE, only: ['ES', 'PT', 'FR', 'IS'], list: 'Mi lista' });
    // Spain with France and Spain with Portugal: France and Portugal do not touch, and Iceland touches nothing.
    await expect(page.locator('.hud-main')).toHaveText('1 / 2');
    const asked: string[] = [];
    for (const n of [1, 2]) {
      await expect(page.locator('.hud-main')).toHaveText(`${n} / 2`);
      await expect(options(page)).toHaveCount(4);
      const right = options(page).filter({ has: page.locator('span', { hasText: /^España – (Francia|Portugal)$/ }) });
      // The other border of the list may be among the wrong options: the right one is the one not asked yet.
      const texts = (await right.locator('span').allTextContents()).filter((t) => !asked.includes(t));
      expect(texts.length).toBeGreaterThan(0);
      const now = n === 1 && texts.length > 1 ? null : texts[0];
      if (now) {
        await option(page, now).click();
        asked.push(now);
      } else {
        // Both are offered in the first question: any of them settles it, right or wrong.
        await option(page, texts[0]).click();
        const answer = (await page.locator('.border-answer').textContent()) ?? '';
        asked.push(answer.includes('Francia') ? 'España – Francia' : 'España – Portugal');
      }
      await expect(page.locator('.verdict')).toBeVisible();
      await page.getByRole('button', { name: n === 2 ? 'Ver resultado' : 'Siguiente' }).click();
    }
    expect(asked.sort()).toEqual(['España – Francia', 'España – Portugal']);
    await expect(page.locator('.results-title')).toBeVisible();
    expect((await kept(page)).sessions.at(-1)).toMatchObject({ mode: 'border', label: 'Europa · 44 países · Mi lista', total: 2 });
  });

  test('says so where the map has no borders to ask', async ({ page }) => {
    await start(page, { section: 'countries', mode: 'border', countries: ['IS', 'MT', 'CY'], opts: { answer: 'choice' } });
    await expect(page.locator('.results-title')).toHaveText('Sin preguntas');
    await expect(page.locator('.results-note')).toHaveText(
      'En este mapa no hay fronteras que preguntar: hacen falta países que se toquen. En un mapa de varios países solo cuentan las fronteras de dentro de cada uno.',
    );
    await expect(page.getByRole('button', { name: 'Otra vez' })).toHaveCount(0);
    expect((await kept(page)).sessions ?? []).toEqual([]);
  });

  test('comes closer to a border that would be too short to make out', async ({ page }) => {
    // Norway and Russia meet for some two hundred kilometres: with all of Russia in view the line would be a speck.
    await start(page, { section: 'countries', mode: 'border', countries: ['NO', 'RU'], opts: { answer: 'choice' } });
    await expect(page.locator('.hud-main')).toHaveText('1 / 1');
    await expect(options(page).locator('span')).toHaveText(['Noruega – Rusia']);
    const line = await traceBox(page);
    const size = Math.max(line.width, line.height);
    expect(size).toBeGreaterThanOrEqual(40);
    expect(size).toBeLessThan(60);
    const map = (await page.locator('.map-svg').boundingBox())!;
    // In the middle of the map, give or take: the border is what the view is about.
    expect(Math.abs(line.x + line.width / 2 - (map.x + map.width / 2))).toBeLessThan(map.width * 0.15);
    expect(Math.abs(line.y + line.height / 2 - (map.y + map.height / 2))).toBeLessThan(map.height * 0.15);
  });
});

test.describe('the border game with the names typed', () => {
  test('takes the two names one at a time, in any order, and tells a miss from what does not count', async ({ page }) => {
    await start(page, COMMUNITIES);
    await expect(page.locator('.q-ask')).toHaveText('¿Qué dos comunidades autónomas separa?');
    await expect(options(page)).toHaveCount(0);
    await expect(sides(page)).toHaveText(['?', '?']);
    await expect(lost(page)).toHaveCount(0);
    await expect(page.locator('.answer-input')).toHaveAttribute('placeholder', 'A un lado…');
    await expect(page.locator('.q-note')).toContainText('Escribe los dos nombres, uno a uno y en cualquier orden');

    // With this game the first border is that of Asturias and Cantabria.
    await type(page, 'cantabria');
    await expect(sides(page)).toHaveText(['Cantabria', '?']);
    await expect(sides(page).first()).toHaveClass(/got/);
    await expect(piece(page, 'ES-CB')).toHaveClass(/st-ok/);
    await expect(labels(page)).toHaveText(['Cantabria']);
    await expect(page.locator('.answer-input')).toHaveValue('');
    await expect(page.locator('.answer-input')).toHaveAttribute('placeholder', 'Y al otro lado…');
    await expect(trace(page)).toHaveClass(/st-ask/);

    // None of these is a miss: the side already given and what is no piece of this map.
    await type(page, 'Cantabria');
    await expect(page.locator('.q-note')).toHaveText('Cantabria: ya la tienes.');
    await type(page, 'zzzz');
    await expect(page.locator('.q-note')).toHaveText('No coincide con nada de este mapa.');
    await expect(lost(page)).toHaveCount(0);
    // This one is: a piece of the map that is on neither side.
    await type(page, 'galicia');
    await expect(page.locator('.q-note')).toHaveText('Galicia no está a ningún lado de esta frontera.');
    await expect(lost(page)).toHaveCount(1);
    await expect(piece(page, 'ES-GA')).not.toHaveClass(/st-/);

    await type(page, 'asturias');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-warn/);
    await expect(page.locator('.verdict-head')).toHaveText('Las dos, con 1 fallo');
    await expect(page.locator('.border-answer')).toHaveText('Es la frontera entre Asturias y Cantabria.');
    // Settled, the sides read in the order of the alphabet, as everywhere else.
    await expect(sides(page)).toHaveText(['Asturias', 'Cantabria']);
    await expect(trace(page)).toHaveClass(/st-warn/);
    await expect(piece(page, 'ES-AS')).toHaveClass(/st-ok/);
    await expect(page.locator('.answer-input')).toHaveCount(0);
  });

  test('is right at once with both names and no miss, and shows the answer at the third miss', async ({ page }) => {
    await start(page, COMMUNITIES);
    await type(page, 'asturias');
    await type(page, 'cantabria');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.verdict-head')).toHaveText('¡Eso es!');
    await expect(trace(page)).toHaveClass(/st-ok/);
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.locator('.hud-main')).toHaveText('2 / 10');
    await expect(sides(page)).toHaveText(['?', '?']);
    await expect(labels(page)).toHaveCount(0);

    // Three names that are no side of the second border, whichever it is: the islands border nothing.
    await type(page, 'canarias');
    await expect(page.locator('.q-note')).toHaveText('Canarias no está a ningún lado de esta frontera.');
    await type(page, 'baleares');
    await expect(lost(page)).toHaveCount(2);
    await type(page, 'ceuta');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.verdict-head')).toHaveText('Tres fallos');
    await expect(lost(page)).toHaveCount(3);
    await expect(sides(page)).toHaveCount(2);
    await expect(page.locator('.border-sides .border-side.shown')).toHaveCount(2);
    await expect(trace(page)).toHaveClass(/st-bad/);
    await expect(page.locator('.map-svg [data-id][class*="st-target"]')).not.toHaveCount(0);
    await expect(labels(page)).toHaveCount(2);

    await page.getByRole('button', { name: 'Terminar' }).click();
    expect((await kept(page)).sessions.at(-1)).toMatchObject({ mode: 'border', label: 'España · comunidades autónomas', total: 2, ok: 1, warn: 0, bad: 1 });
  });

  test('spells a side out letter by letter, and counts the border as helped', async ({ page }) => {
    await start(page, COMMUNITIES);
    await type(page, 'asturias');
    // Only Cantabria is left: the hint is about it.
    await page.getByRole('button', { name: 'Pista' }).click();
    await expect(page.locator('.q-letters')).toHaveText('C _ _ _ _ _ _ _ _');
    await page.getByRole('button', { name: 'Otra letra' }).click();
    await expect(page.locator('.q-letters')).toHaveText('C a _ _ _ _ _ _ _');
    // The initial alone is no answer now that the hint has spelt it.
    await type(page, 'c');
    await expect(sides(page)).toHaveText(['Asturias', '?']);
    await expect(lost(page)).toHaveCount(0);
    await type(page, 'cantabria');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-warn/);
    await expect(page.locator('.verdict-head')).toHaveText('Las dos, con pista');
  });

  test('shows the answer when asked to, and keeps apart what was named and what was not', async ({ page }) => {
    await start(page, COMMUNITIES);
    await type(page, 'asturias');
    await page.getByRole('button', { name: 'Ver la respuesta' }).click();
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.verdict-head')).toHaveText('La respuesta');
    await expect(sides(page)).toHaveText(['Asturias', 'Cantabria']);
    await expect(sides(page).nth(0)).toHaveClass(/got/);
    await expect(sides(page).nth(1)).toHaveClass(/shown/);
    await expect(piece(page, 'ES-AS')).toHaveClass(/st-ok/);
    await expect(piece(page, 'ES-CB')).toHaveClass(/st-target/);
    await expect(labels(page)).toHaveCount(2);
  });
});

test.describe('the border game around the app', () => {
  test('is offered where the pieces have borders, with the choice of how to answer', async ({ page }) => {
    await seed(page);
    const mode = () => page.getByRole('group', { name: 'Vecinos y posición' }).getByRole('button', { name: /^Fronteras/ });
    for (const route of ['/regiones', '/paises']) {
      await open(page, route);
      await mode().click();
      await expect(page.locator('.mode-about'), route).toContainText('Se ilumina una frontera en el mapa sin nombres y dices qué dos piezas separa');
    }
    // Cities are dots, rivers are lines and figures are no map: nothing there has a border.
    for (const route of ['/ciudades', '/fisica', '/poblaciones']) {
      await open(page, route);
      await expect(page.getByRole('button', { name: /^Fronteras/ }), route).toHaveCount(0);
    }

    await open(page, '/regiones');
    await mode().click();
    const answer = page.getByRole('radiogroup', { name: 'Forma de responder' });
    await expect(answer.getByRole('radio')).toHaveText(['Cuatro opciones', 'Escribir']);
    // One round of the borders of the map: it cannot go on for ever.
    await expect(page.getByRole('radiogroup', { name: 'Preguntas' }).getByRole('radio')).toHaveText(['Todo', '10', '20', '50']);
    await answer.getByRole('radio', { name: 'Cuatro opciones' }).click();
    await page.getByRole('button', { name: /Empezar/ }).click();
    await expect(page.locator('.play-title strong')).toHaveText('Fronteras');
    await expect(options(page)).toHaveCount(4);
    await expect(trace(page)).toHaveCount(1);

    // And typed, with the list of suggestions for those who ask for it.
    await page.getByRole('button', { name: 'Salir' }).click();
    await mode().click();
    await answer.getByRole('radio', { name: 'Escribir' }).click();
    await expect(page.locator('.opt-hint', { hasText: 'No importan tildes ni mayúsculas' })).toBeVisible();
    await page.getByRole('button', { name: /Empezar/ }).click();
    await expect(sides(page)).toHaveText(['?', '?']);
    await expect(page.locator('.answer-input')).toBeVisible();
  });

  test('reads in English from end to end', async ({ page }) => {
    await seed(page, { lang: 'en', game: { levels: {}, nonce: 1, ...EUROPE, opts: { ...OPTS, answer: 'choice' } } });
    await page.goto('./#/jugar');
    await expect(page.locator('.play-loading')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('.play-title strong')).toHaveText('Borders');
    await expect(page.locator('.kicker')).toHaveText('The border marked');
    await expect(page.locator('.q-ask')).toHaveText('Which two countries does it lie between?');
    // The same border as in Spanish, with the names of this language in its own order.
    await expect(option(page, 'Albania – Montenegro')).toHaveCount(1);
    await expect(option(page, 'Bosnia and Herzegovina – Montenegro')).toHaveCount(1);
    await option(page, 'Albania – Montenegro').click();
    await expect(page.locator('.verdict-head')).toHaveText('That is it!');
    await expect(page.locator('.border-answer')).toHaveText('It is the border between Albania and Montenegro.');
    await expect(page.locator('.verdict .links a')).toHaveAttribute('href', `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent('Albania–Montenegro border')}`);
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.locator('.results-title')).toHaveText('Every border!');
    await expect(page.locator('.results-group.g-ok .row-name')).toHaveText(['Albania– Montenegro']);
  });

  test('fits a phone: the options, the border and the names typed @movil', async ({ page }) => {
    await start(page, EUROPE);
    await expect(options(page)).toHaveCount(4);
    const view = page.viewportSize()!;
    for (const box of await options(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as { left: number; right: number; height: number }))) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(view.width);
      // A finger's width at the least.
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(view.width);
    // The border is there to be seen, inside the map.
    const line = await traceBox(page);
    expect(Math.max(line.width, line.height)).toBeGreaterThanOrEqual(40);
    const map = (await page.locator('.map-svg').boundingBox())!;
    expect(line.x).toBeGreaterThanOrEqual(map.x);
    expect(line.x + line.width).toBeLessThanOrEqual(map.x + map.width);
    await options(page).first().tap();
    await expect(page.locator('.verdict-head')).toHaveText('¡Eso es!');
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeInViewport();
  });
});
