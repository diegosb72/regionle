import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, seed, start, type } from './helpers';

/** The nineteen autonomous communities of Spain: fifteen of them hang together by land. */
const COMMUNITIES = { section: 'regions', countries: ['ES'], levels: { ES: 'g1' }, mode: 'chain' };

const kept = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { best: Record<string, number>; sessions: { mode: string; total: number; ok: number; warn: number; bad: number; note?: string }[] });
const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`);
const links = (page: Page) => page.locator('.chain-links li');

test.describe('a chain of neighbours', () => {
  test('starts on a piece of a map without borders and grows with each neighbour that is named', async ({ page }) => {
    await start(page, COMMUNITIES);
    await expect(page.locator('.play-title strong')).toHaveText('Cadena de vecinos');
    await expect(page.locator('.kicker')).toHaveText('La cadena empieza en');
    // With this game the lot falls on Murcia: Andalusia, Castile-La Mancha and Valencia border it.
    await expect(page.locator('.q-name')).toHaveText('Región de Murcia');
    await expect(page.locator('.nb-count')).toContainText('3salidas desde aquí');
    await expect(page.locator('.hud-main')).toHaveText('1 / 15');
    await expect(page.locator('.map-svg')).toHaveClass(/blind/);
    await expect(piece(page, 'ES-MC')).toHaveClass(/st-sel/);
    await expect(page.locator('.map-svg .m-lbl')).toHaveText(['Región de Murcia']);

    await type(page, 'andalucia');
    await expect(page.locator('.kicker')).toHaveText('La cadena va por');
    await expect(page.locator('.q-name')).toHaveText('Andalucía');
    await expect(page.locator('.hud-main')).toHaveText('2 / 15');
    // Murcia is behind: two ways on are left, Extremadura and Castile-La Mancha.
    await expect(page.locator('.nb-count strong')).toHaveText('2');
    await expect(piece(page, 'ES-AN')).toHaveClass(/st-sel/);
    await expect(piece(page, 'ES-MC')).toHaveClass(/st-ok/);
    // The newest link first, each with its place in the chain.
    await expect(links(page)).toHaveText(['2Andalucía', '1Región de Murcia']);
    await expect(links(page).first()).toHaveClass(/now/);
    await expect(page.locator('.answer-input')).toHaveValue('');
  });

  test('tells a wrong name from one that does not count, and ends at the third miss', async ({ page }) => {
    await start(page, COMMUNITIES);
    await type(page, 'andalucia');
    const lost = page.locator('.nb-lives i.off');

    await type(page, 'galicia');
    await expect(page.locator('.q-note')).toHaveText('Galicia no limita con Andalucía. Te quedan 2 fallos.');
    await expect(lost).toHaveCount(1);
    // None of these is a miss: a piece that is in the chain, the one it stands on, and what is no piece at all.
    await type(page, 'murcia');
    await expect(page.locator('.q-note')).toHaveText('Región de Murcia ya está en la cadena: no se pasa dos veces por el mismo sitio.');
    await type(page, 'andalucía');
    await expect(page.locator('.q-note')).toHaveText('En Andalucía está ahora la cadena.');
    await type(page, 'zzzz');
    await expect(page.locator('.q-note')).toHaveText('No coincide con nada de este mapa.');
    await expect(lost).toHaveCount(1);
    await expect(page.locator('.q-name')).toHaveText('Andalucía');

    await type(page, 'asturias');
    await expect(page.locator('.q-note')).toHaveText('Asturias no limita con Andalucía. Te queda 1 fallo.');
    await type(page, 'galicia');
    await expect(page.locator('.results-title')).toHaveText('Tres fallos');
    await expect(page.locator('.results-note')).toContainText('Cadena de 2, de Región de Murcia a Andalucía.');
    await expect(page.locator('.results-note')).toContainText('Desde Andalucía se podía seguir por Extremadura y Castilla-La Mancha.');
    // The game has a chain of its own from the same start to compare with.
    await expect(page.locator('.results-note')).toContainText('Desde Región de Murcia hemos encontrado una de 15.');
    // Named wrongly twice, Galicia is one row.
    await expect(page.locator('.results-group.g-bad .row-name')).toHaveText(['Galiciano limita con Andalucía', 'Asturiasno limita con Andalucía']);
    await expect(page.locator('.results-group.g-ok .row-name')).toHaveText(['Andalucía2.º · desde Región de Murcia']);
    // The map shows the borders again, and where the chain could have gone on.
    await expect(page.locator('.map-svg')).not.toHaveClass(/blind/);
    await expect(piece(page, 'ES-EX')).toHaveClass(/st-target/);
    await expect(piece(page, 'ES-CM')).toHaveClass(/st-target/);
    await expect(piece(page, 'ES-AN')).toHaveClass(/st-from/);

    const state = await kept(page);
    expect(state.sessions.at(-1)).toMatchObject({ mode: 'chain', total: 4, ok: 1, warn: 0, bad: 3 });
    expect(state.best['chain:r:ES.g1']).toBe(2);
  });

  test('ends in a dead end when nothing new borders the last piece', async ({ page }) => {
    await start(page, COMMUNITIES);
    for (const name of ['castilla-la mancha', 'castilla y león', 'asturias']) await type(page, name);
    await expect(page.locator('.q-name')).toHaveText('Asturias');
    await expect(page.locator('.nb-count')).toContainText('2salidas desde aquí');
    // Galicia borders Asturias and Castile and León, and the chain has been through both.
    await type(page, 'galicia');
    await expect(page.locator('.results-title')).toHaveText('Sin salida');
    await expect(page.locator('.results-note')).toContainText('Cadena de 5, de Región de Murcia a Galicia.');
    await expect(page.locator('.results-note')).toContainText('Galicia no limita con nada por donde no hayas pasado.');
    await expect(page.locator('.results-stats')).toContainText('Cadena5');
    await expect(page.locator('.results-stats')).toContainText('Récord del mapa5 ¡nuevo!');
  });

  test('can go through the whole map, and keeps the longest chain of each map', async ({ page }) => {
    await start(page, COMMUNITIES);
    const way = ['andalucía', 'extremadura', 'castilla-la mancha', 'madrid', 'castilla y león', 'galicia', 'asturias', 'cantabria', 'país vasco', 'la rioja', 'navarra', 'aragón', 'cataluña', 'comunidad valenciana'];
    for (const name of way) await type(page, name);
    await expect(page.locator('.results-title')).toHaveText('¡El mapa entero!');
    await expect(page.locator('.results-note')).toHaveText('Cadena de 15, de Región de Murcia a Comunidad Valenciana. No queda por tierra ninguna por la que no hayas pasado. ');
    await expect(page.locator('.results-stats')).toContainText('A la primera14');
    await expect(page.locator('.results-stats')).toContainText('Récord del mapa15 ¡nuevo!');
    expect((await kept(page)).best['chain:r:ES.g1']).toBe(15);

    // Another chain starts from scratch, and a shorter one leaves the record as it was.
    await page.getByRole('button', { name: 'Otra cadena' }).click();
    await expect(page.locator('.kicker')).toHaveText('La cadena empieza en');
    await expect(page.locator('.hud-main')).toHaveText('1 / 15');
    await expect(links(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Me planto' }).click();
    await expect(page.locator('.results-title')).toHaveText('Te has plantado');
    await expect(page.locator('.results-note')).toContainText('La cadena no ha salido de');
    await expect(page.locator('.results-stats')).toContainText('Cadena1');
    // The record of the map is the one that was there.
    await expect(page.locator('.results-stats')).toContainText('Récord del mapa15');
    expect((await kept(page)).best['chain:r:ES.g1']).toBe(15);

    // The record is told in the progress, by its map.
    await open(page, '/progreso');
    await expect(page.locator('.records li', { hasText: 'Cadena de vecinos' })).toHaveText('Cadena de vecinos · Españacadena de 15');
  });

  test('spells a way on letter by letter, and counts that link as helped', async ({ page }) => {
    await start(page, COMMUNITIES);
    await page.getByRole('button', { name: 'Pista' }).click();
    const letters = page.locator('.q-letters');
    await expect(letters).toHaveText(/^[AC] /);
    // Two of the three ways on from Murcia start with C: a second letter tells them apart.
    await page.getByRole('button', { name: 'Otra letra' }).click();
    const shown = ((await letters.textContent()) ?? '').replace(/[\s_-]/g, '');
    const name = shown === 'An' ? 'Andalucía' : shown === 'Ca' ? 'Castilla-La Mancha' : 'Comunidad Valenciana';
    expect(['An', 'Ca', 'Co']).toContain(shown);
    await type(page, name);
    await expect(page.locator('.q-name')).toHaveText(name);
    await expect(letters).toHaveCount(0);
    // The link says that it came with a hint.
    await expect(links(page).first()).toHaveText(`2${name}`);
    await expect(links(page).first().locator('svg')).toHaveCount(1);
    await page.getByRole('button', { name: 'Me planto' }).click();
    await expect(page.locator('.results-stats')).toContainText('Con ayuda1');
    expect((await kept(page)).sessions.at(-1)).toMatchObject({ mode: 'chain', total: 1, ok: 0, warn: 1, bad: 0 });
  });

  test('says why a country that is not on the map does not count', async ({ page }) => {
    await start(page, { section: 'countries', countries: ['ES', 'PT', 'FR', 'AD'], mode: 'chain' });
    await expect(page.locator('.hud-main')).toHaveText('1 / 4');
    const at = ((await page.locator('.q-name').textContent()) ?? '').trim();
    expect(['España', 'Francia', 'Andorra']).toContain(at);
    await type(page, 'alemania');
    await expect(page.locator('.q-note')).toHaveText('Alemania no está en este mapa: solo cuentan los países elegidos.');
    await expect(page.locator('.nb-lives i.off')).toHaveCount(0);
  });

  test('is offered where pieces have borders, and not with a list', async ({ page }) => {
    await seed(page);
    for (const route of ['/regiones', '/paises']) {
      await open(page, route);
      await page.getByRole('group', { name: 'Vecinos y posición' }).getByRole('button', { name: /^Cadena de vecinos/ }).click();
      await expect(page.locator('.mode-about'), route).toContainText('sin pasar dos veces por la misma');
    }
    for (const route of ['/ciudades', '/fisica']) {
      await open(page, route);
      await expect(page.getByRole('button', { name: /^Cadena de vecinos/ }), route).toHaveCount(0);
    }
    await open(page, '/regiones');
    await page.getByRole('group', { name: 'Vecinos y posición' }).getByRole('button', { name: /^Cadena de vecinos/ }).click();
    await page.getByRole('button', { name: /Empezar/ }).click();
    await expect(page.locator('.play-title strong')).toHaveText('Cadena de vecinos');
    await expect(page.locator('.kicker')).toHaveText('La cadena empieza en');
  });

  test('speaks English', async ({ page }) => {
    await seed(page, { lang: 'en', game: { nonce: 1, ...COMMUNITIES, opts: OPTS } });
    await page.goto('./#/jugar');
    await expect(page.locator('.play-loading')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('.play-title strong')).toHaveText('Neighbour chain');
    await expect(page.locator('.kicker')).toHaveText('The chain starts in');
    await expect(page.locator('.nb-count')).toContainText('3ways on from here');
    await type(page, 'galicia');
    await expect(page.locator('.q-note')).toHaveText('Galicia does not border Region of Murcia. You have 2 misses left.');
    await type(page, 'andalusia');
    await expect(page.locator('.kicker')).toHaveText('The chain has reached');
    await page.getByRole('button', { name: 'I stop here' }).click();
    await expect(page.locator('.results-title')).toHaveText('You stopped');
    await expect(page.locator('.results-note')).toContainText('A chain of 2, from Region of Murcia to Andalusia.');
    await expect(page.locator('.results-note')).toContainText('From Andalusia it could go on to Extremadura and Castilla–La Mancha.');
  });
});

test.describe('a chain of neighbours on a phone @movil', () => {
  test('keeps the box to type in and the chain in sight above the map', async ({ page }) => {
    await start(page, COMMUNITIES);
    await expect(page.locator('.answer-input')).toBeInViewport();
    await type(page, 'andalucia');
    await expect(page.locator('.q-name')).toHaveText('Andalucía');
    await expect(page.locator('.answer-input')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
