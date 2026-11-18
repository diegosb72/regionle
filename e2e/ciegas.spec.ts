import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, seed, start } from './helpers';

const COMMUNITIES = { section: 'regions', countries: ['ES'], levels: { ES: 'g1' } };

const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { stats: Record<string, number[]>; sessions: { mode: string; total: number; ok: number; warn: number; bad: number }[]; best: Record<string, number> });
const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`);

/**
 * A click on the map at the middle of the box of a piece, moved by some pixels. The piece is in the page
 * even when the map does not tell it apart; and for a group of islands the middle may fall in the sea.
 */
async function clickBy(page: Page, id: string, dx = 0, dy = 0): Promise<void> {
  const box = (await piece(page, id).first().boundingBox())!;
  await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
}

/** A click at a place of the map given as fractions of its box. */
async function clickAt(page: Page, fx: number, fy: number): Promise<void> {
  const box = (await page.locator('.map-svg').boundingBox())!;
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

test.describe('placing blind, on a map of regions', () => {
  test('hides the borders, takes a click inside as right and measures a miss to the edge', async ({ page }) => {
    await start(page, { ...COMMUNITIES, mode: 'blind', only: ['ES-CL', 'ES-AN'] });
    await expect(page.locator('.play-title strong')).toHaveText('Situar a ciegas');
    await expect(page.locator('.map-svg')).toHaveClass(/blind/);
    await expect(page.locator('.hud-main')).toHaveText('1 / 2');
    await expect(page.locator('.q-how')).toHaveText('Haz clic dentro de donde creas que está. Puedes acercar el mapa para afinar.');
    // The pieces are the land of the map, with no border between them and no name to be read off them.
    const border = await piece(page, 'ES-CL').evaluate((el) => getComputedStyle(el).stroke === getComputedStyle(el).fill);
    expect(border).toBe(true);
    await piece(page, 'ES-CL').hover();
    await expect(page.locator('.map-tip')).toHaveCSS('opacity', '0');
    await expect(page.locator('.map-tip')).toHaveText('');
    const lit = await piece(page, 'ES-CL').evaluate((el) => getComputedStyle(el).fill === getComputedStyle(document.querySelector('.map-svg [data-id="ES-AN"]')!).fill);
    expect(lit).toBe(true);

    const first = ((await page.locator('.q-name').textContent()) ?? '').trim();
    const [hit, other] = first === 'Castilla y León' ? ['ES-CL', 'ES-AN'] : ['ES-AN', 'ES-CL'];
    await clickBy(page, hit);
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.verdict')).toContainText('¡Dentro!');
    // Right first time: the game goes on by itself, and what was placed stays on the map with its border.
    await expect(page.locator('.hud-main')).toHaveText('2 / 2');
    await expect(piece(page, hit)).toHaveClass(/st-ok/);

    // The other one is put in Galicia, far from both.
    await clickBy(page, 'ES-GA');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.verdict')).toContainText(/Lejos: a \d+ km de su borde/);
    await expect(piece(page, other)).toHaveClass(/st-target/);

    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(page.locator('.results-title')).toHaveText(/^Error medio: \d+ km$/);
    await expect(page.locator('.results-group.g-ok .row-name small')).toHaveText('dentro');
    await expect(page.locator('.results-group.g-bad .row-name small')).toHaveText(/^\d+ km$/);
    const state = await kept(page);
    expect(state.stats[`loc:${hit}`].slice(0, 3)).toEqual([1, 1, 1]);
    expect(state.stats[`loc:${other}`].slice(0, 3)).toEqual([1, 0, 0]);
    expect(state.sessions[0]).toMatchObject({ mode: 'blind', total: 2, ok: 1, warn: 0, bad: 1 });
  });

  test('takes a click near enough for a piece too small to hit, and a near miss as close', async ({ page }) => {
    await start(page, { ...COMMUNITIES, mode: 'blind', only: ['ES-CE'] });
    await expect(page.locator('.q-name')).toHaveText('Ceuta');
    await expect(page.locator('.q-how')).toHaveText(/Haz clic donde creas que está\. Ocupa tan poco en este mapa que cuenta como acierto a menos de \d+ km\.$/);
    // Nothing on the map gives the speck away.
    await expect(page.locator('.map-svg .m-ring:visible')).toHaveCount(0);
    // A few kilometres out at sea.
    await clickBy(page, 'ES-CE', 5, 0);
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.verdict')).toContainText(/¡En el sitio! a \d+ km de su borde/);
  });

  test('is in the menus of regions, countries and physical geography, next to hot and cold', async ({ page }) => {
    for (const [route, about] of [
      ['/regiones', 'El mapa no enseña las fronteras'],
      ['/paises', 'El mapa no enseña las fronteras'],
      ['/fisica', 'El mapa no enseña ríos, mares ni montañas'],
      ['/ciudades', 'Sin puntos en el mapa'],
    ]) {
      await open(page, route);
      const map = page.getByRole('group', { name: 'En el mapa' });
      await map.getByRole('button', { name: /^Situar a ciegas/ }).click();
      await expect(page.locator('.mode-about')).toContainText(about);
      await map.getByRole('button', { name: /^Caliente y frío/ }).click();
      await expect(page.locator('.mode-about')).toContainText('con seis clics para cada cosa');
    }
  });
});

test.describe('placing blind, on a physical map', () => {
  test('leaves rivers off the map until they are answered, and measures to their course', async ({ page }) => {
    await start(page, { section: 'physical', mode: 'blind', countries: ['river', 'in:ES'], only: ['r:ebro'] });
    await expect(page.locator('.q-name')).toHaveText('Ebro');
    await expect(page.locator('.q-how')).toHaveText(/Haz clic sobre su curso\. Cuenta como acierto a menos de \d+ km\./);
    await expect(page.locator('.map-svg [data-id]')).toHaveCount(0);
    // Out in the Atlantic.
    await clickAt(page, 0.08, 0.3);
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.verdict')).toContainText(/Lejos: a [\d.]+ km de su curso/);
    await expect(page.locator('.map-svg path.ln[data-id="r:ebro"]')).toBeVisible();
  });

  test('takes a sea with the seas that are part of it', async ({ page }) => {
    await start(page, { section: 'physical', mode: 'blind', countries: ['sea', 'in:ES'], only: ['s:mediterranean-sea'] });
    await expect(page.locator('.q-name')).toHaveText('Mar Mediterráneo');
    await expect(page.locator('.map-svg [data-id]')).toHaveCount(0);
    // Between Valencia and Ibiza: the Balearic Sea, which this map draws apart from the Mediterranean.
    await clickAt(page, 0.76, 0.55);
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.verdict')).toContainText('¡Dentro!');
    await expect(page.locator('.verdict-part')).toHaveText('Esa parte tiene nombre propio: Mar Balear.');
    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(page.locator('.results-group.g-ok .row-name small')).toHaveText('dentro');
  });

  test('does not take one sea for another', async ({ page }) => {
    await start(page, { section: 'physical', mode: 'blind', countries: ['sea', 'in:ES'], only: ['s:mediterranean-sea'] });
    // Out in the Atlantic, off Portugal.
    await clickAt(page, 0.04, 0.5);
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.verdict')).toContainText(/Lejos: a [\d.]+ km de su borde/);
    await expect(page.locator('.verdict-part')).toHaveCount(0);
  });
});

test.describe('hot and cold', () => {
  test('says how warm each miss was and whether it got closer, until the piece is found', async ({ page }) => {
    await start(page, { ...COMMUNITIES, mode: 'hotcold', only: ['ES-CL'] });
    await expect(page.locator('.play-title strong')).toHaveText('Caliente y frío');
    await expect(page.locator('.kicker').first()).toHaveText('Busca en el mapa');
    await expect(page.locator('.q-name')).toHaveText('Castilla y León');
    await expect(page.locator('.q-how')).toContainText('Tienes 6 intentos.');
    const heat = page.locator('.heat');

    // The Canaries: as far as this map goes.
    await clickBy(page, 'ES-CN');
    await expect(heat.locator('.heat-now b')).toHaveText('Helado');
    await expect(heat.locator('.heat-now span')).toHaveCount(0);
    await expect(heat.locator('.heat-left-text')).toHaveText('Te quedan 5 intentos.');
    await expect(page.locator('.map-svg .m-mark')).toHaveCount(1);
    await expect(page.locator('.map-svg .m-mark-heat-0')).toHaveCount(1);

    // Andalusia, then Madrid, which touches it: warmer each time.
    await clickBy(page, 'ES-AN');
    await expect(heat.locator('.heat-now b')).toHaveText(/^(Templado|Caliente)$/);
    await expect(heat.locator('.heat-now span')).toHaveText('más cerca que antes');
    await clickBy(page, 'ES-MD');
    await expect(heat.locator('.heat-now b')).toHaveText('¡Te quemas!');
    await expect(heat.locator('.heat-now span')).toHaveText('más cerca que antes');
    // And back to Andalusia: colder.
    await clickBy(page, 'ES-AN', 10, 10);
    await expect(heat.locator('.heat-now span')).toHaveText('más lejos que antes');
    await expect(heat.locator('.heat-left-text')).toHaveText('Te quedan 2 intentos.');
    await expect(heat.locator('.heat-trail li:not(.heat-left)')).toHaveCount(4);
    await expect(heat.locator('.heat-trail li.heat-left')).toHaveCount(2);
    await expect(page.locator('.map-svg .m-mark')).toHaveCount(4);
    // Nothing of the piece has been shown yet.
    await expect(piece(page, 'ES-CL')).not.toHaveClass(/st-/);

    await clickBy(page, 'ES-CL');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-warn/);
    await expect(page.locator('.verdict')).toContainText('¡Ahí está! En 5 intentos');
    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(page.locator('.results-title')).toHaveText('Has encontrado 1 de 1');
    await expect(page.locator('.results-group.g-warn .row-name small')).toHaveText('en 5 intentos');
    const state = await kept(page);
    expect(state.stats['loc:ES-CL'].slice(0, 3)).toEqual([1, 0, 0]);
    expect(state.sessions[0]).toMatchObject({ mode: 'hotcold', total: 1, ok: 0, warn: 1, bad: 0 });
    // A search leaves no record of kilometres.
    expect(Object.keys(state.best).filter((k) => k.startsWith('blind:'))).toEqual([]);
  });

  test('is right with the first click, and shows where it was when the clicks run out', async ({ page }) => {
    await start(page, { ...COMMUNITIES, mode: 'hotcold', only: ['ES-AN'] });
    await clickBy(page, 'ES-AN');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.verdict')).toContainText('¡Ahí está! A la primera');
    await expect(page.locator('.results-title')).toHaveText('Has encontrado 1 de 1', { timeout: 10_000 });
    await expect(page.locator('.results-group.g-ok .row-name small')).toHaveText('a la primera');

    await page.getByRole('button', { name: /Otra/ }).first().click();
    await expect(page.locator('.q-name')).toHaveText('Andalucía', { timeout: 30_000 });
    for (let i = 0; i < 6; i++) await clickBy(page, 'ES-GA', i * 3, 0);
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.verdict')).toContainText('Estaba aquí: Andalucía');
    await expect(piece(page, 'ES-AN')).toHaveClass(/st-target/);
    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(page.locator('.results-group.g-bad .row-name small')).toHaveText('sin encontrar');
  });

  test('can be given up, and is played among cities too', async ({ page }) => {
    await start(page, { section: 'cities', mode: 'hotcold', countries: ['ES'], opts: { cityPick: 'top', cityCount: 10 } });
    await expect(page.locator('.play-title strong')).toHaveText('Caliente y frío');
    await expect(page.locator('.map-svg .m-dot')).toHaveCount(0);
    await clickAt(page, 0.2, 0.85);
    await expect(page.locator('.heat .heat-now b')).toBeVisible();
    await page.getByRole('button', { name: 'Me rindo' }).click();
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.map-svg .m-dot')).toHaveCount(1);
  });
});

test.describe('hot and cold, in English', () => {
  test('speaks English', async ({ page }) => {
    await seed(page, { lang: 'en', game: { nonce: 1, ...COMMUNITIES, mode: 'hotcold', only: ['ES-CL'], opts: OPTS } });
    await page.goto('./#/jugar');
    await expect(page.locator('.play-loading')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('.play-title strong')).toHaveText('Hot and cold');
    await expect(page.locator('.kicker').first()).toHaveText('Find it on the map');
    await clickBy(page, 'ES-CN');
    await expect(page.locator('.heat .heat-now b')).toHaveText('Freezing');
    await expect(page.locator('.heat .heat-left-text')).toHaveText('You have 5 tries left.');
    await clickBy(page, 'ES-MD');
    await expect(page.locator('.heat .heat-now b')).toHaveText('Burning!');
    await expect(page.locator('.heat .heat-now span')).toHaveText('closer than before');
    await page.getByRole('button', { name: 'I give up' }).click();
    await expect(page.locator('.verdict')).toContainText('It was here: Castile and León');
  });
});

test.describe('placing with a keyboard', () => {
  test('moves a cross with the arrows and marks the spot with Enter', async ({ page }) => {
    await start(page, { ...COMMUNITIES, mode: 'hotcold', only: ['ES-CN'] });
    await expect(page.locator('.q-name')).toHaveText('Canarias');
    await page.locator('.map-svg').focus();
    await expect(page.locator('.map-svg .m-cross')).toHaveCount(0);
    // The first arrow only brings the cross out, in the middle of what is on screen.
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.map-svg .m-cross')).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(page.locator('.heat .heat-left-text')).toHaveText('Te quedan 5 intentos.');
    await expect(page.locator('.map-svg .m-mark')).toHaveCount(1);
    // The Canaries lie to the south-west of that.
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
    for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    await expect(page.locator('.heat .heat-left-text')).toHaveText('Te quedan 4 intentos.');
    await expect(page.locator('.heat .heat-now span')).toHaveText('más cerca que antes');
    await expect(page.locator('.map-svg .m-mark')).toHaveCount(2);
  });
});

test.describe('placing with a finger @movil', () => {
  test('a tap on the map is the answer, and the heat of a miss fits the screen', async ({ page }) => {
    await start(page, { ...COMMUNITIES, mode: 'blind', only: ['ES-CL'] });
    await expect(page.locator('.q-name')).toHaveText('Castilla y León');
    const box = (await piece(page, 'ES-CL').boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.verdict')).toContainText('¡Dentro!');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('says how warm a tap was without pushing the map off the screen', async ({ page }) => {
    await start(page, { ...COMMUNITIES, mode: 'hotcold', only: ['ES-CL'] });
    const far = (await piece(page, 'ES-AN').boundingBox())!;
    await page.touchscreen.tap(far.x + far.width / 2, far.y + far.height / 2);
    await expect(page.locator('.heat .heat-now b')).toBeVisible();
    await expect(page.locator('.heat .heat-left-text')).toHaveText('Te quedan 5 intentos.');
    await expect(page.getByRole('button', { name: 'Me rindo' })).toBeInViewport();
    // The map is still there to be tapped again.
    const map = (await page.locator('.map-svg').boundingBox())!;
    expect(map.height).toBeGreaterThan(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
