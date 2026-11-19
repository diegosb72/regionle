import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, seed, start, type } from './helpers';

/** The communities of Spain: with this game the first riddle is Castile and León, and the second Murcia. */
const COMMUNITIES = { section: 'regions', countries: ['ES'], levels: { ES: 'g1' }, mode: 'whoami' };
/** Eleven countries of western Europe: the first riddle is the Netherlands, and the second Luxembourg. */
const WEST = { section: 'countries', countries: ['ES', 'PT', 'FR', 'DE', 'IT', 'CH', 'AT', 'BE', 'NL', 'LU', 'AD'], mode: 'whoami' };

const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { sessions: { mode: string; total: number; ok: number; warn: number; bad: number }[]; stats?: Record<string, unknown> });
const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`).first();
const clues = (page: Page) => page.locator('.clues .clue');
const another = (page: Page) => page.getByRole('button', { name: 'Otra pista' });

test.describe('who am I?', () => {
  test('gives a clue at a time, each worth a point less, and takes the name when it is typed', async ({ page }) => {
    await start(page, COMMUNITIES);
    await expect(page.locator('.play-title strong')).toHaveText('¿Quién soy?');
    await expect(page.locator('.hud-main')).toHaveText('1 / 10');
    await expect(page.locator('.kicker')).toHaveText('¿Qué comunidad autónoma soy?');
    await expect(page.locator('.whoami-count')).toHaveText('Pista 1 de 6 · vale 6');
    await expect(clues(page)).toHaveText([/^1Mido 94\.\d{3} km²: por tamaño soy la mayor de las 19 de este mapa\.$/]);
    // The map names nothing, and says nothing of what the pointer rests on.
    await expect(page.locator('.map-svg .m-lbl')).toHaveCount(0);
    await piece(page, 'ES-CL').hover();
    await expect(page.locator('.map-tip')).toHaveText('');

    await another(page).click();
    await expect(page.locator('.whoami-count')).toHaveText('Pista 2 de 6 · vale 5');
    await expect(clues(page)).toHaveCount(2);
    await expect(clues(page).nth(1)).toHaveText('2Estoy hacia el norte del mapa.');
    await expect(clues(page).nth(1)).toHaveClass(/fresh/);
    await another(page).click();
    await expect(clues(page).nth(2)).toHaveText('3Limito por tierra con 9 de las comunidades autónomas de este mapa.');
    // A clue that names another piece lights it up on the map.
    await another(page).click();
    await expect(clues(page).nth(3)).toHaveText('4Una de mis vecinas es Comunidad de Madrid.');
    await expect(piece(page, 'ES-MD')).toHaveClass(/st-near/);
    await expect(page.locator('.map-svg .m-lbl')).toHaveText(['Comunidad de Madrid']);
    // Then its outline, and at last how its name starts: there is no clue after that.
    await another(page).click();
    await expect(clues(page).nth(4)).toHaveText('5Esta es mi silueta.');
    await expect(clues(page).nth(4).locator('svg.clue-shape path')).toHaveAttribute('d', /^M/);
    await another(page).click();
    await expect(clues(page).nth(5)).toHaveText('6Mi nombre empieza por «C» y tiene 13 letras, en 3 palabras.');
    await expect(page.locator('.whoami-count')).toHaveText('Pista 6 de 6 · vale 1');
    await expect(another(page)).toBeDisabled();

    await type(page, 'castilla y leon');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-warn/);
    await expect(page.locator('.verdict-head')).toContainText('¡Eso es! Castilla y León');
    await expect(page.locator('.whoami-score')).toHaveText('Con 6 pistas: 1 punto.');
    await expect(piece(page, 'ES-CL')).toHaveClass(/st-warn/);

    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.locator('.hud-main')).toHaveText('2 / 10');
    await expect(clues(page)).toHaveCount(1);
    await expect(page.locator('.map-svg .m-lbl')).toHaveCount(0);
    // With a clue or two and no wrong name, it is right first time; the rest of the clues are shown then.
    await another(page).click();
    await type(page, 'murcia');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.verdict-head')).toContainText('¡Eso es! Región de Murcia');
    await expect(page.locator('.whoami-score')).toHaveText('Con 2 pistas: 5 puntos.');
    await expect(clues(page)).toHaveCount(6);

    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('.results-stats')).toContainText('Puntos6 de 12');
    await expect(page.locator('.results-group.g-warn .row-name')).toHaveText(['Castilla y Leóncon 6 pistas · 1 punto']);
    await expect(page.locator('.results-group.g-ok .row-name')).toHaveText(['Región de Murciacon 2 pistas · 5 puntos']);
    const state = await kept(page);
    expect(state.sessions.at(-1)).toMatchObject({ mode: 'whoami', total: 2, ok: 1, warn: 1, bad: 0 });
    // Nothing goes into the review: a riddle is not a question about one thing of the piece.
    expect(Object.keys(state.stats ?? {})).toHaveLength(0);
  });

  test('answers a wrong name with the next clue, and ends when there are no clues left', async ({ page }) => {
    await start(page, COMMUNITIES);
    await type(page, 'galicia');
    await expect(page.locator('.q-note')).toHaveText('No soy Galicia. Ahí va otra pista.');
    await expect(clues(page)).toHaveCount(2);
    await expect(page.locator('.answer-input')).toHaveValue('');
    // The same wrong name again, or something that is no piece, costs nothing.
    await type(page, 'galicia');
    await expect(page.locator('.q-note')).toHaveText('Galicia: ya has probado con esa.');
    await type(page, 'zzzz');
    await expect(page.locator('.q-note')).toHaveText('No coincide con nada de este mapa.');
    await expect(clues(page)).toHaveCount(2);

    // Right after a wrong name: right with help, however few the clues.
    await type(page, 'castilla y león');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-warn/);
    await expect(page.locator('.whoami-score')).toHaveText('Con 2 pistas y 1 nombre equivocado: 5 puntos.');
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // Murcia: five wrong names bring the six clues, and the sixth one ends it.
    for (const [i, name] of ['galicia', 'asturias', 'cantabria', 'aragón', 'canarias'].entries()) {
      await type(page, name);
      await expect(clues(page)).toHaveCount(i + 2);
    }
    await type(page, 'andalucía');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.verdict-head')).toContainText('Era Región de Murcia');
    await expect(page.locator('.whoami-score')).toHaveText('Sin puntos esta vez.');
    await expect(piece(page, 'ES-MC')).toHaveClass(/st-bad/);

    // Giving up is the same end.
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByRole('button', { name: 'Me rindo' }).click();
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.verdict-head')).toContainText('Era Comunidad Valenciana');
    // And one at the first clue, for six points.
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await type(page, 'castilla la mancha');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.whoami-score')).toHaveText('Con 1 pista: 6 puntos.');
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-stats')).toContainText('Puntos11 de 24');
    await expect(page.locator('.results-group.g-bad .row-name small')).toHaveText(['sin adivinar', 'sin adivinar']);
    expect((await kept(page)).sessions.at(-1)).toMatchObject({ mode: 'whoami', total: 4, ok: 1, warn: 1, bad: 2 });

    // What was not right first time can be asked again by itself.
    await page.getByRole('button', { name: /^Repasar/ }).click();
    await expect(page.locator('.hud-main')).toHaveText('1 / 3');
    await expect(clues(page)).toHaveCount(1);
  });

  test('tells a country by its size, its part of the world, its borders, a neighbour, its capital and its flag', async ({ page }) => {
    await start(page, WEST);
    await expect(page.locator('.kicker')).toHaveText('¿Qué país soy?');
    await expect(page.locator('.whoami-count')).toHaveText('Pista 1 de 7 · vale 6');
    for (let i = 0; i < 5; i++) await another(page).click();
    await expect(clues(page)).toHaveText([
      /^1Tengo 1\d,\d millones de habitantes y mido 41\.\d{3} km²\.$/,
      '2Estoy en Europa Occidental.',
      '3Tengo costa y limito con 2 países.',
      '4Uno de mis vecinos es Alemania.',
      '5Mi capital empieza por «Á».',
      '6Esta es mi bandera.',
    ]);
    await expect(piece(page, 'DE')).toHaveClass(/st-near/);
    await expect(clues(page).nth(5).locator('img.clue-flag')).toHaveAttribute('src', /flags\/nl\.svg$/);
    // From the sixth clue on, a clue is worth one point.
    await expect(page.locator('.whoami-count')).toHaveText('Pista 6 de 7 · vale 1');
    await type(page, 'holanda');
    await expect(page.locator('.verdict-head')).toContainText('¡Eso es! Países Bajos');
    await expect(page.locator('.verdict')).toContainText('Capital: Ámsterdam');
  });

  test('tells a city by its size, where it lies and how far it is from the largest one', async ({ page }) => {
    await start(page, { section: 'cities', countries: ['ES'], mode: 'whoami', opts: { cityPick: 'top', cityCount: 25 } });
    await expect(page.locator('.kicker')).toHaveText('¿Qué ciudad soy?');
    for (let i = 0; i < 4; i++) await another(page).click();
    await expect(clues(page)).toHaveText([
      /^1Tengo \d{3}\.000 habitantes en mi área urbana: soy la 4\.ª de las 25 de este mapa\.$/,
      '2Estoy hacia el norte del mapa.',
      '3No soy capital de mi país ni de una región.',
      '4Mi comunidad autónoma es País Vasco.',
      '5Estoy a unos 320 km al norte de Madrid.',
    ]);
    // The city it is measured from is named on the map.
    await expect(page.locator('.map-svg .m-lbl')).toHaveText(['Madrid']);
    await type(page, 'bilbao');
    await expect(page.locator('.verdict-head')).toContainText('¡Eso es! Bilbao');
  });

  test('is offered among the facts of regions, countries and cities', async ({ page }) => {
    await seed(page);
    for (const [route, about] of [
      ['/paises', 'Un país habla de sí mismo'],
      ['/ciudades', 'Una ciudad habla de sí misma'],
      ['/regiones', 'Una pieza habla de sí misma'],
    ]) {
      await open(page, route);
      await page.getByRole('group', { name: 'Datos' }).getByRole('button', { name: /^¿Quién soy\?/ }).click();
      await expect(page.locator('.mode-about'), route).toContainText(about);
    }
    await open(page, '/fisica');
    await expect(page.getByRole('button', { name: /^¿Quién soy\?/ })).toHaveCount(0);

    await open(page, '/regiones');
    await page.getByRole('group', { name: 'Datos' }).getByRole('button', { name: /^¿Quién soy\?/ }).click();
    await expect(page.getByRole('radiogroup', { name: 'Preguntas' }).getByRole('radio')).toHaveText(['Todo', '10', '20', '50']);
    await page.getByRole('button', { name: /Empezar/ }).click();
    await expect(page.locator('.play-title strong')).toHaveText('¿Quién soy?');
    await expect(clues(page)).toHaveCount(1);
  });

  test('speaks English', async ({ page }) => {
    await seed(page, { lang: 'en', game: { levels: {}, nonce: 1, ...WEST, opts: OPTS } });
    await page.goto('./#/jugar');
    await expect(page.locator('.play-loading')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('.play-title strong')).toHaveText('Who am I?');
    await expect(page.locator('.kicker')).toHaveText('Which country am I?');
    await expect(page.locator('.whoami-count')).toHaveText('Clue 1 of 7 · worth 6');
    await expect(clues(page)).toHaveText([/^1I have 1\d\.\d million people and cover 41,\d{3} km²\.$/]);
    await type(page, 'belgium');
    await expect(page.locator('.q-note')).toHaveText('I am not Belgium. Here is another clue.');
    await expect(clues(page).nth(1)).toHaveText('2I am in Western Europe.');
    await page.getByRole('button', { name: 'Another clue' }).click();
    await expect(clues(page).nth(2)).toHaveText('3I have a coast and border 2 countries.');
    await type(page, 'netherlands');
    await expect(page.locator('.verdict-head')).toContainText('That is it! Netherlands');
    await expect(page.locator('.whoami-score')).toHaveText('With 3 clues and 1 wrong name: 4 points.');
  });
});

test.describe('who am I? on a phone @movil', () => {
  test('keeps the box to type in within sight as the clues pile up', async ({ page }) => {
    await start(page, COMMUNITIES);
    await expect(page.locator('.answer-input')).toBeInViewport();
    for (let i = 0; i < 5; i++) await another(page).tap();
    await expect(clues(page)).toHaveCount(6);
    await expect(page.locator('.answer-input')).toBeInViewport();
    await type(page, 'castilla y leon');
    await expect(page.locator('.verdict')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
