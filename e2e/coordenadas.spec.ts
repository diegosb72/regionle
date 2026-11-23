import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, restart, seed, start } from './helpers';

/** The nineteen autonomous communities of Spain: a map small enough for tenths of a degree. */
const COMMUNITIES = { section: 'regions', mode: 'coords', countries: ['ES'], levels: { ES: 'g1' } };
/** The countries of Europe that the game offers as such: a map large enough for whole degrees. */
const EUROPE_IDS = 'AL AD AT BY BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB'.split(' ');
const EUROPE = { section: 'countries', mode: 'coords', countries: EUROPE_IDS };

const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { sessions: { mode: string; label: string; total: number; ok: number; warn: number; bad: number }[]; stats: Record<string, unknown> });
const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`).first();
const gridNames = (page: Page) => page.locator('.map-svg .m-grid-lbl');

/** A click on the map at the middle of the box of a piece. */
async function clickBy(page: Page, id: string): Promise<void> {
  const box = (await piece(page, id).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** The kilometres a verdict or a row speaks of. */
const kmOf = (text: string | null): number => Number(/(\d[\d.]*) km/.exec(text ?? '')?.[1].replace('.', '') ?? NaN);

/**
 * Every degree written on the map lies inside it, and reads as a latitude or a longitude. The names are
 * written again a moment after the map has stopped moving, and until then they go wherever the map takes
 * them: what is looked at is where they come to rest.
 */
async function expectGridNamed(page: Page): Promise<string[]> {
  await expect(gridNames(page).first()).toBeVisible();
  let texts: string[] = [];
  await expect(async () => {
    const map = (await page.locator('.map-svg').boundingBox())!;
    const names = await gridNames(page).evaluateAll((els) => els.map((el) => ({ text: el.textContent ?? '', box: el.getBoundingClientRect().toJSON() as { left: number; right: number; top: number; bottom: number } })));
    for (const n of names) {
      expect(n.text).toMatch(/^(0°|180°|\d+(,\d)?° [NSEO])$/);
      expect(n.box.left, n.text).toBeGreaterThanOrEqual(map.x);
      expect(n.box.right, n.text).toBeLessThanOrEqual(map.x + map.width);
      expect(n.box.top, n.text).toBeGreaterThanOrEqual(map.y);
      expect(n.box.bottom, n.text).toBeLessThanOrEqual(map.y + map.height);
    }
    texts = names.map((n) => n.text);
  }).toPass({ timeout: 10_000 });
  return texts;
}

test.describe('the coordinates game', () => {
  test('gives a latitude and a longitude on a map with its grid, and judges the click by how far it falls', async ({ page }) => {
    await start(page, COMMUNITIES);
    await expect(page.locator('.play-title strong')).toHaveText('Coordenadas');
    await expect(page.locator('.kicker')).toHaveText('Marca en el mapa');
    await expect(page.locator('.hud-main')).toHaveText('1 / 10');
    // With this game the first point lies in Castile and León.
    await expect(page.locator('.coords-ask')).toHaveText('41,8° N · 4,7° O');
    await expect(page.locator('.coords-ask')).toHaveAttribute('aria-label', '41,8 grados norte, 4,7 grados oeste');
    await expect(page.locator('.coords-words')).toHaveText('41,8° al norte del ecuador · 4,7° al oeste de Greenwich');
    await expect(page.locator('.q-how')).toContainText('Haz clic en ese punto. Las líneas del mapa van de 2° en 2°. Cuenta como acierto a menos de 75 km; puedes acercar el mapa para afinar.');

    // The grid: a line every two degrees, the meridian of Greenwich marked among them, and each one with its degrees.
    await expect(page.locator('.map-svg .m-grid-line').first()).toBeAttached();
    expect(await page.locator('.map-svg .m-grid-line').count()).toBeGreaterThan(20);
    await expect(page.locator('.map-svg .m-grid-line.zero')).toHaveCount(1);
    // The faint grid that every map has under its land gives way to this one.
    await expect(page.locator('.map-svg .m-grat')).toHaveAttribute('d', '');
    const names = await expectGridNamed(page);
    expect(names).toEqual(expect.arrayContaining(['40° N', '36° N', '4° O', '0°']));
    // The pieces are drawn with their borders, but nothing is named: not on the map, not under the pointer.
    await expect(page.locator('.map-svg text.m-lbl')).toHaveCount(0);
    await piece(page, 'ES-CL').hover();
    await expect(page.locator('.map-tip')).toHaveText('');
    await expect(page.locator('.map-svg .m-mark')).toHaveCount(0);

    await clickBy(page, 'ES-CL');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.verdict-head')).toHaveText(/^¡En el sitio! a \d+ km$/);
    expect(kmOf(await page.locator('.verdict-head').textContent())).toBeLessThanOrEqual(75);
    // What was there is said once the point is settled.
    await expect(page.locator('.coords-answer')).toHaveText('En ese punto: Castilla y León.');
    await expect(piece(page, 'ES-CL')).toHaveClass(/st-ok/);
    // The point that was asked and the click, with a line between them.
    await expect(page.locator('.map-svg .m-mark-spot')).toHaveCount(1);
    await expect(page.locator('.map-svg .m-mark-guess')).toHaveCount(1);
    await expect(page.locator('.map-svg .m-links line')).toHaveCount(1);
    await expect(page.locator('.q-how')).toHaveCount(0);
    // A second click answers nothing.
    await clickBy(page, 'ES-AN');
    await expect(page.locator('.map-svg .m-mark-guess')).toHaveCount(1);

    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.locator('.hud-main')).toHaveText('2 / 10');
    await expect(page.locator('.verdict')).toHaveCount(0);
    await expect(page.locator('.map-svg .m-mark')).toHaveCount(0);
    await expect(piece(page, 'ES-CL')).not.toHaveClass(/st-/);
    await expect(page.locator('.coords-ask')).not.toHaveText('41,8° N · 4,7° O');
    await expect(page.locator('.coords-ask')).toHaveText(/^\d+(,\d)?° N · \d+(,\d)?° [OE]$/);
  });

  test('tells a near miss from a far one, and shows the point to those who do not know', async ({ page }) => {
    await start(page, COMMUNITIES);
    // Madrid is some hundred and sixty kilometres from the point: more than counts as right, less than a miss.
    await clickBy(page, 'ES-MD');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-warn/);
    await expect(page.locator('.verdict-head')).toHaveText(/^Cerca: a \d+ km$/);
    const near = kmOf(await page.locator('.verdict-head').textContent());
    expect(near).toBeGreaterThan(75);
    expect(near).toBeLessThanOrEqual(196);
    await expect(piece(page, 'ES-CL')).toHaveClass(/st-warn/);
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // Whatever the second point is, the Canaries and Catalonia cannot both be close to it.
    const asked = (await page.locator('.coords-ask').textContent()) ?? '';
    await clickBy(page, asked.startsWith('28,') ? 'ES-CT' : 'ES-CN');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.verdict-head')).toHaveText(/^Lejos: a [\d.]+ km$/);
    expect(kmOf(await page.locator('.verdict-head').textContent())).toBeGreaterThan(196);
    await expect(page.locator('.map-svg [data-id][class*="st-target"]')).not.toHaveCount(0);
    await page.getByRole('button', { name: 'Siguiente' }).click();

    await expect(page.locator('.hud-main')).toHaveText('3 / 10');
    await page.getByRole('button', { name: 'No lo sé' }).click();
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.verdict-head')).toHaveText('Era aquí');
    await expect(page.locator('.coords-answer')).toHaveText(/^En ese punto: .+\.$/);
    // The point alone: there was no click to draw.
    await expect(page.locator('.map-svg .m-mark-spot')).toHaveCount(1);
    await expect(page.locator('.map-svg .m-mark-guess')).toHaveCount(0);
    await expect(page.locator('.map-svg .m-links line')).toHaveCount(0);

    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-title')).toHaveText(/^Error medio: [\d.]+ km$/);
    await expect(page.locator('.results-note')).toHaveText('A la primera: a menos de 75 km del punto. Con ayuda: a menos de 196 km.');
    await expect(page.locator('.donut')).toContainText('0 de 3');
    // Each row is the piece that was there, with its coordinates and how far the click fell.
    await expect(page.locator('.results-group.g-warn .row-name')).toHaveText(/^Castilla y León41,8° N · 4,7° O · \d+ km$/);
    await expect(page.locator('.results-group.g-bad .row-name')).toHaveCount(2);
    await expect(page.locator('.results-group.g-bad .row-name', { hasText: /° [OE] · [\d.]+ km$/ })).toHaveCount(1);
    await expect(page.locator('.results-group.g-bad .row-name', { hasText: /° [OE] · sin marcar$/ })).toHaveCount(1);
    // The whole map, named, with its grid still on.
    await expect(page.locator('.map-svg text.m-lbl', { hasText: 'Andalucía' })).toHaveCount(1);
    await expectGridNamed(page);

    const state = await kept(page);
    expect(state.sessions.at(-1)).toMatchObject({ mode: 'coords', label: 'España · comunidades autónomas', total: 3, ok: 0, warn: 1, bad: 2 });
    // Missing a point says nothing about knowing the piece: nothing is noted against it.
    expect(state.stats ?? {}).toEqual({});
  });

  test('goes over the points that were missed', async ({ page }) => {
    const POINTS: Record<string, string> = { '41,8° N · 4,7° O': 'ES-CL', '37,5° N · 4,7° O': 'ES-AN' };
    await start(page, { ...COMMUNITIES, only: ['ES-CL', 'ES-AN'] });
    await expect(page.locator('.hud-main')).toHaveText('1 / 2');
    const first = ((await page.locator('.coords-ask').textContent()) ?? '').trim();
    expect(Object.keys(POINTS)).toContain(first);
    await clickBy(page, POINTS[first]);
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await page.getByRole('button', { name: 'Siguiente' }).click();
    const second = ((await page.locator('.coords-ask').textContent()) ?? '').trim();
    expect(Object.keys(POINTS).filter((p) => p !== first)).toEqual([second]);
    await page.getByRole('button', { name: 'No lo sé' }).click();
    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(page.locator('.donut')).toContainText('1 de 2');
    await expect(page.locator('.results-stats')).toContainText('Mejor racha1');

    await page.getByRole('button', { name: 'Repasar 1 fallo' }).click();
    await expect(page.locator('.hud-main')).toHaveText('1 / 1');
    await expect(page.locator('.coords-ask')).toHaveText(second);
    await clickBy(page, POINTS[second]);
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(page.locator('.donut')).toContainText('1 de 1');
    await expect(page.getByRole('button', { name: /^Repasar/ })).toHaveCount(0);
  });

  test('asks a country by whole degrees, a small one by tenths, and leaves out what is too small for either', async ({ page }) => {
    await start(page, EUROPE);
    await expect(page.locator('.coords-ask')).toHaveText('52° N · 6° E');
    await expect(page.locator('.coords-words')).toHaveText('52° al norte del ecuador · 6° al este de Greenwich');
    await expect(page.locator('.q-how')).toContainText('Las líneas del mapa van de 5° en 5°.');
    const names = await expectGridNamed(page);
    expect(names).toEqual(expect.arrayContaining(['50° N', '0°', '10° E']));
    await clickBy(page, 'NL');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.coords-answer')).toHaveText('En ese punto: Países Bajos.');
  });

  test('asks, on a custom list, the points of its pieces', async ({ page }) => {
    await start(page, { ...EUROPE, only: ['AD', 'NL', 'MC', 'SM'], list: 'Mi lista' });
    // Monaco and San Marino are smaller than a tenth of a degree: two points are left.
    await expect(page.locator('.hud-main')).toHaveText('1 / 2');
    const asked: string[] = [];
    for (const n of [1, 2]) {
      await expect(page.locator('.hud-main')).toHaveText(`${n} / 2`);
      asked.push(((await page.locator('.coords-ask').textContent()) ?? '').trim());
      await page.getByRole('button', { name: 'No lo sé' }).click();
      await page.getByRole('button', { name: n === 2 ? 'Ver resultado' : 'Siguiente' }).click();
    }
    // Andorra would be missed by a whole degree: it is given in tenths on the same map.
    expect(asked.sort()).toEqual(['42,5° N · 1,6° E', '52° N · 6° E']);
    await expect(page.locator('.results-group.g-bad .row-name')).toHaveCount(2);
    await expect(page.locator('.results-group.g-bad .row-name', { hasText: 'Andorra42,5° N · 1,6° E · sin marcar' })).toHaveCount(1);
    expect((await kept(page)).sessions.at(-1)).toMatchObject({ mode: 'coords', label: 'Europa · 44 países · Mi lista', total: 2, bad: 2 });
  });

  test('says so where no piece can be pointed at', async ({ page }) => {
    await start(page, { ...EUROPE, only: ['MC', 'SM'] });
    await expect(page.locator('.results-title')).toHaveText('Sin preguntas');
    await expect(page.locator('.results-note')).toHaveText('Aquí no hay coordenadas que preguntar: estas piezas son demasiado pequeñas para señalarlas con décimas de grado, o quedan fuera del mapa.');
    await expect(page.getByRole('button', { name: 'Otra vez' })).toHaveCount(0);
    expect((await kept(page)).sessions ?? []).toEqual([]);
  });

  test('asks where a city is without showing any, and names it over its dot afterwards', async ({ page }) => {
    await start(page, { section: 'cities', mode: 'coords', countries: ['ES'], opts: { cityCount: 25 } });
    await expect(page.locator('.play-title strong')).toHaveText('Coordenadas');
    // With this game the first city is Bilbao.
    await expect(page.locator('.coords-ask')).toHaveText('43,3° N · 2,9° O');
    // The dots would be the answer: none is on the map until its point is settled.
    await expect(page.locator('.map-svg .m-dot')).toHaveCount(0);
    await expectGridNamed(page);
    const map = (await page.locator('.map-svg').boundingBox())!;
    await page.mouse.click(map.x + map.width * 0.5, map.y + map.height * 0.3);
    await expect(page.locator('.verdict')).toBeVisible();
    await expect(page.locator('.coords-answer')).toHaveText('En ese punto: Bilbao.');
    await expect(page.locator('.map-svg .m-dot')).toHaveCount(1);
    await expect(page.locator('.map-svg text.m-lbl')).toHaveText(['Bilbao']);
    await page.getByRole('button', { name: 'Siguiente' }).click();
    // Settled, the city stays on the map; the rest are still out of it.
    await expect(page.locator('.map-svg .m-dot')).toHaveCount(1);
    await expect(page.locator('.map-svg text.m-lbl')).toHaveCount(0);
  });

  test('writes the degrees again at the edges of what is in view when the map is moved', async ({ page }) => {
    await start(page, COMMUNITIES);
    const before = await expectGridNamed(page);
    await page.locator('.map-svg').focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('+');
    // Closer, fewer lines cross the view: fewer names, each still at an edge of it.
    await expect.poll(async () => (await gridNames(page).allTextContents()).join(' ')).not.toBe(before.join(' '));
    const after = await expectGridNamed(page);
    expect(after.length).toBeGreaterThan(1);
    expect(after.length).toBeLessThan(before.length);
    await page.keyboard.press('0');
    await expect.poll(async () => (await gridNames(page).allTextContents()).join(' ')).toBe(before.join(' '));
  });

  test('is played with the keys: a cross moved with the arrows, and Enter to mark', async ({ page }) => {
    await start(page, COMMUNITIES);
    await page.locator('.map-svg').focus();
    await expect(page.locator('.map-svg .m-cross')).toHaveCount(0);
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('.map-svg .m-cross')).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(page.locator('.verdict')).toBeVisible();
    await expect(page.locator('.map-svg .m-mark-guess')).toHaveCount(1);
    await expect(page.locator('.coords-answer')).toHaveText('En ese punto: Castilla y León.');
    // The focus stays on the map: Enter again is the next point, and the arrows bring the cross back for it.
    await expect(page.locator('.map-svg')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.hud-main')).toHaveText('2 / 10');
    await expect(page.locator('.verdict')).toHaveCount(0);
    await expect(page.locator('.map-svg')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.map-svg .m-cross')).toHaveCount(1);
    await page.keyboard.press(' ');
    await expect(page.locator('.verdict')).toBeVisible();
    await page.keyboard.press(' ');
    await expect(page.locator('.hud-main')).toHaveText('3 / 10');
  });

  test('is offered where the pieces have a place, as one round of the map', async ({ page }) => {
    await seed(page);
    const mode = () => page.getByRole('group', { name: 'Vecinos y posición' }).getByRole('button', { name: /^Coordenadas/ });
    for (const [route, about] of [
      ['/regiones', 'Cada punto cae dentro de una pieza del mapa.'],
      ['/paises', 'Cada punto cae dentro de una pieza del mapa.'],
      ['/ciudades', 'Cada punto es una ciudad.'],
    ]) {
      await open(page, route);
      await mode().click();
      await expect(page.locator('.mode-about'), route).toContainText('Te damos una latitud y una longitud y marcas el punto en el mapa, que lleva dibujados sus paralelos y meridianos.');
      await expect(page.locator('.mode-about'), route).toContainText(about);
    }
    // A river has no point of its own, and a figure no place.
    for (const route of ['/fisica', '/poblaciones']) {
      await open(page, route);
      await expect(page.getByRole('button', { name: /^Coordenadas/ }), route).toHaveCount(0);
    }
    await open(page, '/regiones');
    await mode().click();
    await expect(page.getByRole('radiogroup', { name: 'Preguntas' }).getByRole('radio')).toHaveText(['Todo', '10', '20', '50']);
    await page.getByRole('button', { name: /Empezar/ }).click();
    await expect(page.locator('.play-title strong')).toHaveText('Coordenadas');
    await expect(page.locator('.coords-ask')).toHaveText(/^\d+(,\d)?° N · \d+(,\d)?° [OE]$/);
    await expect(page.locator('.map-svg .m-grid-line').first()).toBeAttached();
  });

  test('reads in English, with a W for the west', async ({ page }) => {
    await seed(page, { lang: 'en', game: { nonce: 1, ...COMMUNITIES, opts: OPTS } });
    await page.goto('./#/jugar');
    await expect(page.locator('.play-loading')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('.play-title strong')).toHaveText('Coordinates');
    await expect(page.locator('.kicker')).toHaveText('Mark on the map');
    await expect(page.locator('.coords-ask')).toHaveText('41.8° N · 4.7° W');
    await expect(page.locator('.coords-ask')).toHaveAttribute('aria-label', '41.8 degrees north, 4.7 degrees west');
    await expect(page.locator('.coords-words')).toHaveText('41.8° north of the equator · 4.7° west of Greenwich');
    await expect(page.locator('.q-how')).toContainText('Click on that point. The lines of the map are 2° apart. Within 75 km counts as right; you can zoom in to be more precise.');
    await expect(gridNames(page).first()).toBeVisible();
    expect(await gridNames(page).allTextContents()).toEqual(expect.arrayContaining(['40° N', '4° W', '0°']));
    await clickBy(page, 'ES-CL');
    await expect(page.locator('.verdict-head')).toHaveText(/^Spot on! \d+ km away$/);
    await expect(page.locator('.coords-answer')).toHaveText('At that point: Castile and León.');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.locator('.results-title')).toHaveText(/^Mean error: \d+ km$/);
    await expect(page.locator('.results-note')).toHaveText('First time: within 75 km of the point. With help: within 196 km.');
    await expect(page.locator('.results-group.g-ok .row-name')).toHaveText(/^Castile and León41\.8° N · 4\.7° W · \d+ km$/);
  });

  test('fits a phone: the question, the grid and a tap for an answer @movil', async ({ page }) => {
    await start(page, COMMUNITIES);
    const view = page.viewportSize()!;
    await expect(page.locator('.coords-ask')).toHaveText('41,8° N · 4,7° O');
    const ask = (await page.locator('.coords-ask').boundingBox())!;
    expect(ask.x + ask.width).toBeLessThanOrEqual(view.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(view.width);
    // The map is in sight under the question, with its degrees at its edges.
    await expect(page.locator('.map-svg')).toBeInViewport();
    const names = await expectGridNamed(page);
    expect(names.length).toBeGreaterThan(4);
    const box = (await piece(page, 'ES-CL').boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.coords-answer')).toHaveText('En ese punto: Castilla y León.');
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeInViewport();
  });
});

test.describe('reading the coordinates of a point', () => {
  const READ = { ...COMMUNITIES, opts: { coordsAsk: 'read' } };
  const COORD = /^\d+(,\d)?° [NS] · \d+(,\d)?° [OE]$/;
  const choices = (page: Page) => page.locator('.coords-choices .choice');
  /** The coordinates on offer, without the key that chooses each. */
  const offered = async (page: Page): Promise<string[]> => (await choices(page).locator('span').allTextContents()).map((t) => t.trim());
  /** The middle of a mark on the screen. */
  const markAt = async (page: Page, kind: string): Promise<{ x: number; y: number }> => {
    const box = (await page.locator(`.map-svg .m-mark-${kind} .m-mark-ring`).boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };

  test('marks a point on the map and offers four coordinates for it', async ({ page }) => {
    await start(page, READ);
    await expect(page.locator('.play-title strong')).toHaveText('Coordenadas');
    await expect(page.locator('.kicker')).toHaveText('Lee en el mapa');
    await expect(page.locator('.coords-read')).toHaveText('¿Qué coordenadas tiene el punto marcado?');
    await expect(page.locator('.q-how')).toContainText('Mira entre qué líneas cae: van de 2° en 2° y llevan su valor en el borde del mapa. Primero la latitud, luego la longitud.');
    // The coordinates are not given away: they are among the options, and nowhere else.
    await expect(page.locator('.coords-ask')).toHaveCount(0);
    await expectGridNamed(page);

    // The point is marked from the start, inside the piece it stands for, which is not told apart.
    await expect(page.locator('.map-svg .m-mark-ask')).toHaveCount(1);
    const at = await markAt(page, 'ask');
    const land = (await piece(page, 'ES-CL').boundingBox())!;
    expect(at.x).toBeGreaterThan(land.x);
    expect(at.x).toBeLessThan(land.x + land.width);
    expect(at.y).toBeGreaterThan(land.y);
    expect(at.y).toBeLessThan(land.y + land.height);
    await expect(page.locator('.map-svg [class*="st-"]')).toHaveCount(0);
    await expect(page.locator('.map-svg text.m-lbl')).toHaveCount(0);

    const four = await offered(page);
    expect(four).toHaveLength(4);
    expect(new Set(four).size).toBe(4);
    for (const text of four) expect(text).toMatch(COORD);
    expect(four.filter((t) => t === '41,8° N · 4,7° O')).toHaveLength(1);
    // Nothing to count: every option has as much in common with the other three.
    const shared = four.map((t) => four.filter((o) => o.split(' · ')[0] === t.split(' · ')[0]).length + four.filter((o) => o.split(' · ')[1] === t.split(' · ')[1]).length);
    expect(new Set(shared).size).toBe(1);
    await expect(choices(page).first()).toHaveAttribute('aria-label', /^\d+(,\d)? grados (norte|sur), \d+(,\d)? grados (este|oeste)$/);

    // The map is there to be read: a click on it answers nothing.
    await clickBy(page, 'ES-AN');
    await expect(page.locator('.verdict')).toHaveCount(0);

    await choices(page).filter({ hasText: '41,8° N · 4,7° O' }).click();
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.verdict-head')).toHaveText('¡Eso es!');
    await expect(page.locator('.coords-answer')).toHaveText('41,8° al norte del ecuador · 4,7° al oeste de Greenwich. En ese punto: Castilla y León.');
    await expect(page.locator('.coords-said')).toHaveCount(0);
    await expect(page.locator('.coords-choices .choice.right')).toHaveText(/41,8° N · 4,7° O$/);
    await expect(page.locator('.coords-choices .choice.wrong')).toHaveCount(0);
    for (const c of await choices(page).all()) await expect(c).toBeDisabled();
    // The point stays where it was, now as the answer, and its piece is painted.
    await expect(page.locator('.map-svg .m-mark-ask')).toHaveCount(0);
    await expect(page.locator('.map-svg .m-mark-spot')).toHaveCount(1);
    await expect(page.locator('.map-svg .m-mark-guess')).toHaveCount(0);
    await expect(piece(page, 'ES-CL')).toHaveClass(/st-ok/);
    const spot = await markAt(page, 'spot');
    expect(Math.abs(spot.x - at.x)).toBeLessThan(3);
    expect(Math.abs(spot.y - at.y)).toBeLessThan(3);

    // The button that goes on has the focus: Enter is the next point.
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.hud-main')).toHaveText('2 / 10');
    await expect(page.locator('.verdict')).toHaveCount(0);
    await expect(page.locator('.map-svg .m-mark-ask')).toHaveCount(1);
    expect(await offered(page)).not.toEqual(four);
  });

  test('shows where the coordinates chosen by mistake are, or says that they are off the map', async ({ page }) => {
    await start(page, READ);
    // A first round without answering, to learn which of the four is right each time.
    const right: string[] = [];
    for (let q = 1; q <= 10; q++) {
      await expect(page.locator('.hud-main')).toHaveText(`${q} / 10`);
      await page.getByRole('button', { name: 'No lo sé' }).click();
      await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
      await expect(page.locator('.verdict-head')).toHaveText('Eran estas');
      await expect(page.locator('.coords-said')).toHaveCount(0);
      await expect(page.locator('.coords-choices .choice.right')).toHaveCount(1);
      await expect(page.locator('.coords-choices .choice.wrong')).toHaveCount(0);
      await expect(page.locator('.map-svg .m-mark-spot')).toHaveCount(1);
      await expect(page.locator('.map-svg .m-mark-guess')).toHaveCount(0);
      right.push(((await page.locator('.coords-choices .choice.right span').textContent()) ?? '').trim());
      await page.getByRole('button', { name: q < 10 ? 'Siguiente' : 'Ver resultado' }).click();
    }
    expect(right[0]).toBe('41,8° N · 4,7° O');
    expect(new Set(right).size).toBe(10);
    // No distances to average: the result is a count.
    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('.results-note')).toHaveCount(0);
    await expect(page.locator('.donut')).toContainText('0 de 10');
    const unanswered = await page.locator('.results-group.g-bad .row-name').allTextContents();
    expect(unanswered).toHaveLength(10);
    for (const row of unanswered) expect(row).toMatch(/° [NS] · [\d,]+° [OE] · sin responder$/);
    expect(unanswered).toContain('Castilla y León41,8° N · 4,7° O · sin responder');

    // The same game again, now taking a wrong option each time.
    await restart(page, { ...READ, nonce: 1 });
    const map = (await page.locator('.map-svg').boundingBox())!;
    const parse = (text: string) => {
      const m = /^([\d,]+)° ([NS]) · ([\d,]+)° ([OE])$/.exec(text)!;
      return { lat: Number(m[1].replace(',', '.')) * (m[2] === 'S' ? -1 : 1), lon: Number(m[3].replace(',', '.')) * (m[4] === 'O' ? -1 : 1) };
    };
    const seen = { cross: 0, off: 0 };
    const picked: string[] = [];
    for (let q = 1; q <= 10; q++) {
      await expect(page.locator('.hud-main')).toHaveText(`${q} / 10`);
      const four = await offered(page);
      expect(four).toContain(right[q - 1]);
      const wrong = four.filter((t) => t !== right[q - 1]);
      const said = wrong[(q - 1) % 3];
      picked.push(said);
      await choices(page).filter({ hasText: said }).click();
      await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
      await expect(page.locator('.verdict-head')).toHaveText('No eran esas');
      await expect(page.locator('.coords-choices .choice.wrong')).toHaveText(new RegExp(`${said}$`));
      await expect(page.locator('.coords-choices .choice.right')).toHaveText(new RegExp(`${right[q - 1]}$`));
      await expect(page.locator('.map-svg .m-mark-spot')).toHaveCount(1);
      // The piece is shown as one that was missed.
      await expect(page.locator('.map-svg .st-target')).not.toHaveCount(0);
      const told = ((await page.locator('.coords-said').textContent()) ?? '').trim();
      expect(told).toMatch(new RegExp(`^Las que elegiste, ${said}, quedan a [\\d.]+ km de ahí(: donde está la cruz|, fuera de este mapa)\\.$`));
      const a = parse(right[q - 1]);
      const b = parse(said);
      const km = kmOf(told);
      if (told.endsWith('donde está la cruz.')) {
        seen.cross++;
        await expect(page.locator('.map-svg .m-mark-guess')).toHaveCount(1);
        await expect(page.locator('.map-svg .m-links line')).toHaveCount(1);
        const cross = await markAt(page, 'guess');
        const spot = await markAt(page, 'spot');
        expect(cross.x).toBeGreaterThan(map.x);
        expect(cross.x).toBeLessThan(map.x + map.width);
        expect(cross.y).toBeGreaterThan(map.y);
        expect(cross.y).toBeLessThan(map.y + map.height);
        // A line of the grid away at the least: never on top of the point.
        expect(Math.hypot(cross.x - spot.x, cross.y - spot.y), told).toBeGreaterThan(40);
        // The cross is where the coordinates say: north of the point when their latitude is greater, east when their longitude is.
        if (Math.abs(b.lat - a.lat) >= 2 && b.lon === a.lon) expect(Math.sign(spot.y - cross.y), told).toBe(Math.sign(b.lat - a.lat));
        if (Math.abs(b.lon - a.lon) >= 2 && b.lat === a.lat) expect(Math.sign(cross.x - spot.x), told).toBe(Math.sign(b.lon - a.lon));
      } else {
        seen.off++;
        await expect(page.locator('.map-svg .m-mark-guess')).toHaveCount(0);
        await expect(page.locator('.map-svg .m-links line')).toHaveCount(0);
      }
      // The other side of the equator is on no map of Spain; a place between Galicia and the Balearics always is.
      if (b.lat < 0) expect(told, told).toContain('fuera de este mapa');
      if (b.lat >= 36.5 && b.lat <= 43 && b.lon >= -9 && b.lon <= 3) {
        expect(told, told).toContain('donde está la cruz');
        expect(km).toBeGreaterThan(100);
        expect(km).toBeLessThan(1300);
      }
      await page.getByRole('button', { name: q < 10 ? 'Siguiente' : 'Ver resultado' }).click();
    }
    expect(seen.cross).toBeGreaterThan(0);
    expect(seen.off).toBeGreaterThan(0);

    // Each miss keeps what was read instead.
    const rows = await page.locator('.results-group.g-bad .row-name').allTextContents();
    expect(rows).toHaveLength(10);
    expect(rows).toContain(`Castilla y León41,8° N · 4,7° O · no ${picked[0]}`);
    for (let q = 0; q < 10; q++) expect(rows.filter((r) => r.endsWith(`${right[q]} · no ${picked[q]}`)), right[q]).toHaveLength(1);
    const state = await kept(page);
    expect(state.sessions).toHaveLength(2);
    for (const session of state.sessions) expect(session).toMatchObject({ mode: 'coords', label: 'España · comunidades autónomas', total: 10, ok: 0, warn: 0, bad: 10 });
    // Reading a point wrong says nothing about knowing the piece.
    expect(state.stats ?? {}).toEqual({});
  });

  test('is played with the keys 1 to 4, on the whole map every time', async ({ page }) => {
    await start(page, READ);
    const whole = await expectGridNamed(page);
    // Closer, to read a point better.
    await page.getByRole('button', { name: 'Acercar' }).click();
    await page.getByRole('button', { name: 'Acercar' }).click();
    await expect.poll(async () => (await gridNames(page).allTextContents()).join(' ')).not.toBe(whole.join(' '));
    await page.keyboard.press('7');
    await expect(page.locator('.verdict')).toHaveCount(0);
    const four = await offered(page);
    await page.keyboard.press('2');
    await expect(page.locator('.verdict')).toBeVisible();
    // The second of the four is the one that was taken.
    const second = choices(page).nth(1);
    await expect(second).toHaveClass(/right|wrong/);
    await expect(second).toContainText(four[1]);
    // A key pressed again changes nothing.
    await page.keyboard.press('1');
    await expect(page.locator('.coords-choices .choice.right')).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(page.locator('.hud-main')).toHaveText('2 / 10');
    // The next point may be anywhere: the whole map is back for it, and the point in sight.
    await expect.poll(async () => (await gridNames(page).allTextContents()).join(' ')).toBe(whole.join(' '));
    const map = (await page.locator('.map-svg').boundingBox())!;
    const at = await markAt(page, 'ask');
    expect(at.x).toBeGreaterThan(map.x);
    expect(at.x).toBeLessThan(map.x + map.width);
    expect(at.y).toBeGreaterThan(map.y);
    expect(at.y).toBeLessThan(map.y + map.height);
    await page.keyboard.press('3');
    await expect(page.locator('.verdict')).toBeVisible();
    await page.keyboard.press(' ');
    await expect(page.locator('.hud-main')).toHaveText('3 / 10');
  });

  test('reads a city, a country by whole degrees, and goes over the misses', async ({ page }) => {
    await start(page, { section: 'cities', mode: 'coords', countries: ['ES'], opts: { cityPick: 'top', cityCount: 25, coordsAsk: 'read' } });
    // No city is drawn but the point, which is one.
    await expect(page.locator('.map-svg .m-dot')).toHaveCount(0);
    await expect(page.locator('.map-svg .m-mark-ask')).toHaveCount(1);
    await choices(page).filter({ hasText: '43,3° N · 2,9° O' }).click();
    await expect(page.locator('.coords-answer')).toHaveText('43,3° al norte del ecuador · 2,9° al oeste de Greenwich. En ese punto: Bilbao.');
    await expect(page.locator('.map-svg .m-dot')).toHaveCount(1);
    await expect(page.locator('.map-svg text.m-lbl')).toHaveText(['Bilbao']);

    await restart(page, { ...EUROPE, only: ['NL', 'AD'], opts: { coordsAsk: 'read' } });
    await expect(page.locator('.hud-main')).toHaveText('1 / 2');
    await expect(page.locator('.q-how')).toContainText('van de 5° en 5°');
    const POINTS: Record<string, string> = { '52° N · 6° E': 'Países Bajos', '42,5° N · 1,6° E': 'Andorra' };
    let first = '';
    for (let q = 0; q < 2; q++) {
      const four = await offered(page);
      const right = four.filter((t) => t in POINTS);
      expect(right, four.join(' / ')).toHaveLength(1);
      // A small country is read to the tenth, and so are the options it comes with.
      for (const t of four) expect(/,/.test(t)).toBe(/,/.test(right[0]));
      if (q === 0) {
        first = right[0];
        await page.getByRole('button', { name: 'No lo sé' }).click();
      } else {
        await choices(page).filter({ hasText: right[0] }).click();
        await expect(page.locator('.coords-answer')).toContainText(`En ese punto: ${POINTS[right[0]]}.`);
      }
      await page.getByRole('button', { name: /^(Siguiente|Ver resultado)$/ }).click();
    }
    await expect(page.locator('.donut')).toContainText('1 de 2');
    await page.getByRole('button', { name: 'Repasar 1 fallo' }).click();
    // The same point, read again: still a reading game.
    await expect(page.locator('.hud-main')).toHaveText('1 / 1');
    await expect(page.locator('.coords-read')).toBeVisible();
    expect(await offered(page)).toContain(first);
  });

  test('is one of the two questions of the game, kept apart on the first page', async ({ page }) => {
    await seed(page);
    await open(page, '/regiones');
    await page.getByRole('group', { name: 'Vecinos y posición' }).getByRole('button', { name: /^Coordenadas/ }).click();
    await expect(page.locator('.mode-about')).toContainText('O al revés: el mapa marca un punto y eliges sus coordenadas.');
    const ask = page.getByRole('radiogroup', { name: 'Qué se pregunta' });
    await expect(ask.getByRole('radio')).toHaveText(['Marcar el punto', 'Leer el punto']);
    await expect(ask.getByRole('radio', { name: 'Marcar el punto' })).toBeChecked();
    await expect(page.locator('.opt-hint', { hasText: 'Te damos las coordenadas y haces clic en el punto; cuenta lo cerca que caigas.' })).toBeVisible();
    await ask.getByRole('radio', { name: 'Leer el punto' }).click();
    await expect(page.locator('.opt-hint', { hasText: 'El mapa marca un punto y eliges sus coordenadas entre cuatro.' })).toBeVisible();
    await page.getByRole('button', { name: /Empezar/ }).click();
    await expect(page.locator('.coords-read')).toBeVisible();
    await expect(choices(page)).toHaveCount(4);
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { game: { mode: string; opts: { coordsAsk: string } } });
    expect(state.game).toMatchObject({ mode: 'coords', opts: { coordsAsk: 'read' } });

    // A game of each, and the first page offers both again, told apart.
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-title')).toBeVisible();
    await restart(page, COMMUNITIES);
    await page.getByRole('button', { name: 'No lo sé' }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-title')).toBeVisible();
    await open(page, '/');
    await expect(page.locator('.recent-list .recent-what')).toHaveText(['Regiones · Coordenadas', 'Regiones · Coordenadas · leer el punto']);
    await page.locator('.recent-list li').nth(1).getByRole('button').click();
    await expect(page.locator('.coords-read')).toBeVisible();
  });

  test('reads in English', async ({ page }) => {
    await seed(page, { lang: 'en', game: { nonce: 1, ...COMMUNITIES, opts: { ...OPTS, coordsAsk: 'read' } } });
    await page.goto('./#/jugar');
    await expect(page.locator('.play-loading')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('.kicker')).toHaveText('Read on the map');
    await expect(page.locator('.coords-read')).toHaveText('What are the coordinates of the marked point?');
    await expect(page.locator('.q-how')).toContainText('See which lines it falls between: they are 2° apart, with their value at the edge of the map. Latitude first, then longitude.');
    const four = await offered(page);
    for (const text of four) expect(text).toMatch(/^\d+(\.\d)?° [NS] · \d+(\.\d)?° [WE]$/);
    expect(four).toContain('41.8° N · 4.7° W');
    await expect(choices(page).filter({ hasText: '41.8° N · 4.7° W' })).toHaveAttribute('aria-label', '41.8 degrees north, 4.7 degrees west');
    const wrong = four.find((t) => t !== '41.8° N · 4.7° W' && / N · .* W$/.test(t))!;
    await choices(page).filter({ hasText: wrong }).click();
    await expect(page.locator('.verdict-head')).toHaveText('Not those');
    await expect(page.locator('.coords-answer')).toHaveText('41.8° north of the equator · 4.7° west of Greenwich. At that point: Castile and León.');
    await expect(page.locator('.coords-said')).toHaveText(new RegExp(`^The ones you chose, ${wrong.replace(/\./g, '\\.')}, are [\\d,]+ km from there: where the cross is\\.$`));
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: "I don't know" }).click();
    await expect(page.locator('.verdict-head')).toHaveText('It was these');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.locator('.results-title')).toHaveText('Game over');
    const rows = await page.locator('.results-group.g-bad .row-name').allTextContents();
    expect(rows.some((r) => r === `Castile and León41.8° N · 4.7° W · not ${wrong}`)).toBe(true);
    expect(rows.some((r) => / · not answered$/.test(r))).toBe(true);
  });

  test('fits a phone: four coordinates side by side, and the way on in sight after a long answer @movil', async ({ page }) => {
    await start(page, { ...EUROPE, opts: { coordsAsk: 'read' } });
    const view = page.viewportSize()!;
    await expect(choices(page)).toHaveCount(4);
    for (const c of await choices(page).all()) {
      const box = (await c.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(view.width);
      // No coordinate is cut in two lines.
      expect(box.height).toBeLessThan(60);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(view.width);
    await expect(page.locator('.map-svg .m-mark-ask')).toBeInViewport();
    const wrong = (await offered(page)).find((t) => t !== '52° N · 6° E')!;
    await choices(page).filter({ hasText: wrong }).tap();
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.coords-said')).toContainText(`Las que elegiste, ${wrong}, quedan a`);
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeInViewport();
    await expect(page.locator('.map-svg .m-mark-spot')).toBeInViewport();
  });
});
