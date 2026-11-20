/**
 * A game inside another page: the button that gives the code, and what that code shows where it is pasted.
 * The other page is a made-up one, served to the browser by the test itself, with the game in a box.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test, type FrameLocator, type Page } from '@playwright/test';
import { OPTS, PIN_SPAIN, open, seed } from './helpers';

/**
 * The other page, served by a little server of this test. It lives at `localhost` while the game under test
 * lives at `127.0.0.1`: two sites for the browser, so that what it keeps for the box is not what it keeps for
 * the game, and both on this machine (a page from out there may not reach into the machine it is seen on).
 */
let server: http.Server;
let OTHER = '';
test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const asked = new URL(req.url ?? '/', 'http://localhost');
    const quoted = (text: string): string => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html lang="es"><meta charset="utf-8"><title>La web de la clase</title><body style="margin:0;padding:16px">
      <h1 id="suya">Las provincias, para el jueves</h1>
      <iframe src="${quoted(asked.searchParams.get('src') ?? '')}" title="Regionle" width="${quoted(asked.searchParams.get('w') ?? '100%')}" height="${quoted(asked.searchParams.get('h') ?? '640')}" style="border:0;max-width:100%" allow="fullscreen; clipboard-write" allowfullscreen></iframe>
    </body></html>`);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  OTHER = `http://localhost:${(server.address() as AddressInfo).port}/`;
});
test.afterAll(async () => {
  await new Promise((done) => server.close(done));
});

/** A page of another site with a box in it, and the game in the box. */
async function pageWith(page: Page, src: string, { width = '100%', height = 640 }: { width?: string; height?: number } = {}): Promise<FrameLocator> {
  await page.goto(`${OTHER}?src=${encodeURIComponent(src)}&w=${encodeURIComponent(width)}&h=${height}`);
  await expect(page.locator('#suya')).toBeVisible();
  return page.frameLocator('iframe');
}

/** The same, on a page of the site of the game itself: there the box and the game share what the browser keeps. */
async function ownPageWith(page: Page, src: string, baseURL: string | undefined): Promise<FrameLocator> {
  const host = `${baseURL}la-misma-web.html`;
  await page.route(host, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="es"><meta charset="utf-8"><body><h1 id="suya">La misma web</h1><iframe src="${src}" title="Regionle" width="100%" height="640"></iframe></body></html>` }));
  await page.goto(host);
  await expect(page.locator('#suya')).toBeVisible();
  return page.frameLocator('iframe');
}

/** The address of the game alone, as the code has it. */
const src = (baseURL: string | undefined, rest: string, lang = 'es'): string => `${baseURL}${lang}.html#/incrustar/${rest}`;
/** Nothing of the whole game around it: no header, no menus, no foot. */
async function alone(box: FrameLocator): Promise<void> {
  await expect(box.locator('main#contenido')).toBeVisible();
  await expect(box.locator('header.top')).toHaveCount(0);
  await expect(box.locator('.nav')).toHaveCount(0);
  await expect(box.locator('footer.foot')).toHaveCount(0);
  await expect(box.locator('.embed-foot a')).toBeVisible();
}

test.describe('the code to put a game inside another page', () => {
  test('is given next to the link of the map, with the game as it is set', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await seed(page, { opts: { ...OPTS, answer: 'choice', length: 10 } });
    await open(page, '/regiones/ES:f/identify');
    await page.locator('.maplink').getByRole('button', { name: 'Incrustar' }).click();
    const panel = page.getByRole('dialog', { name: 'Incrustar en otra web' });
    await expect(panel.locator('.embed-what')).toHaveText('España · provincias · Identificar');
    const code = panel.getByRole('textbox', { name: 'Código para incrustar' });
    const address = src(baseURL, 'regiones/ES:f/identify/answer=choice;length=10');
    const written = (height: number) =>
      `<iframe src="${address}" title="Regionle: España · provincias · Identificar" width="100%" height="${height}" style="border:0;max-width:100%" loading="lazy" allow="fullscreen; clipboard-write" allowfullscreen></iframe>`;
    await expect(code).toHaveValue(written(640));
    // The height of the box is chosen; its width is that of where it is put.
    const heights = panel.getByRole('radiogroup', { name: 'Alto del recuadro' });
    await expect(heights.getByRole('radio')).toHaveText(['480 px', '640 px', '800 px']);
    await heights.getByRole('radio', { name: '800 px' }).click();
    await expect(code).toHaveValue(written(800));
    // Copied as it is read, and said so.
    await panel.getByRole('button', { name: 'Copiar código' }).click();
    await expect(panel.getByRole('button', { name: 'Código copiado' })).toBeVisible();
    await expect(panel.locator('.embed-note')).toHaveText('Copiado: pégalo donde tu web deja poner HTML.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(written(800));
    // Another height is another code: it has not been copied yet.
    await heights.getByRole('radio', { name: '480 px' }).click();
    await expect(panel.getByRole('button', { name: 'Copiar código' })).toBeVisible();
    // The way to see it before pasting it anywhere.
    await expect(panel.getByRole('link', { name: 'Ver cómo queda' })).toHaveAttribute('href', address);
    await expect(panel.getByRole('link', { name: 'Ver cómo queda' })).toHaveAttribute('target', '_blank');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
  });

  test('is not offered for what cannot be played, nor for a sheet to print', async ({ page }) => {
    const embed = page.locator('.maplink').getByRole('button', { name: 'Incrustar' });
    await seed(page, {});
    await open(page, '/regiones/ES:f/pin');
    await expect(embed).toBeVisible();
    await expect(page.locator('.maplink .opt-hint')).toContainText('«Incrustar» da el código para ponerlo dentro de otra web.');
    // The sheet is for paper.
    await open(page, '/regiones/ES:f/print');
    await expect(page.locator('.maplink').getByRole('button', { name: 'Código QR' })).toBeVisible();
    await expect(embed).toHaveCount(0);
    await expect(page.locator('.maplink .opt-hint')).not.toContainText('Incrustar');
    // "Conexiones" with three countries is no game.
    await open(page, '/poblaciones/ES+FR+PT/connect');
    await expect(page.locator('.problem')).toBeVisible();
    await expect(embed).toHaveCount(0);
    await open(page, '/poblaciones/ES+FR+PT/hilo');
    await expect(embed).toBeVisible();
  });

  test('is given for a custom list too, with the game chosen', async ({ page, baseURL }) => {
    const list = { id: 'l1', name: 'Las del jueves', section: 'regions', countries: ['ES'], levels: { ES: 'f' }, ids: ['ES-M', 'ES-B', 'ES-V'] };
    await seed(page, { lists: [list], listOn: { regions: 'l1' }, mode: { regions: 'identify' }, opts: { ...OPTS, answer: 'choice' } });
    await open(page, '/regiones');
    await page.locator('.listcard').getByRole('button', { name: 'Incrustar' }).click();
    const panel = page.getByRole('dialog', { name: 'Incrustar en otra web' });
    await expect(panel.locator('.embed-what')).toHaveText('Las del jueves · Identificar');
    const code = await panel.getByRole('textbox', { name: 'Código para incrustar' }).inputValue();
    const address = /src="([^"]+)"/.exec(code)![1];
    expect(address).toMatch(new RegExp(`^${baseURL}es\\.html#/incrustar/lista/[A-Za-z0-9_-]+/identify/answer=choice;length=10$`));
    expect(code).toContain('title="Regionle: Las del jueves · Identificar"');
    await page.keyboard.press('Escape');

    // Pasted into another page: the name of the list, and only its three pieces are asked about.
    const box = await pageWith(page, address);
    await alone(box);
    await expect(box.locator('.embed-box h1')).toHaveText('Las del jueves');
    await expect(box.locator('.embed-box .kicker')).toHaveText('Identificar');
    await box.getByRole('button', { name: 'Empezar' }).click();
    await expect(box.locator('.hud-main')).toHaveText('1 / 3', { timeout: 30_000 });
    await expect(box.locator('.choices .choice')).toHaveCount(4);
    // The way to the whole of the game is the link of the list.
    await expect(box.locator('.embed-foot a')).toHaveAttribute('href', address.replace('es.html#/incrustar/', '#/').replace(/\/identify\/.*$/, ''));
  });
});

test.describe('a game inside another page', () => {
  test('waits on a card until it is started, is played there, and leaving it comes back to the card', async ({ page, baseURL }) => {
    // Whoever visits the other page has never been to the game: nothing is kept.
    const asked: string[] = [];
    page.on('request', (r) => asked.push(r.url()));
    const game = (what: RegExp) => asked.filter((url) => what.test(url)).length;
    const box = await pageWith(page, src(baseURL, 'regiones/ES:f/pin'));
    await alone(box);
    const card = box.locator('.embed-box');
    await expect(card.locator('.kicker')).toHaveText('Señalar');
    await expect(card.locator('h1')).toHaveText('España · provincias');
    await expect(card.locator('.embed-desc')).toHaveText('Te damos un nombre y lo buscas en el mapa.');
    await expect(card.locator('.embed-flags img')).toHaveCount(1);
    // Nothing has started, and whoever only reads the page has not been made to fetch the game: neither its
    // code, nor the outline of the world, nor the map of the country.
    await expect(box.locator('.map-svg')).toHaveCount(0);
    await expect(box.locator('.play-top')).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    expect(game(/\/data\/index\.json/)).toBe(1);
    expect(asked.filter((url) => /\/data\/(world|capitals|r\/)|\/assets\/Play-/.test(url))).toEqual([]);
    // The way to the whole of the game: the same map and game, in a tab of its own.
    const whole = box.locator('.embed-foot a');
    await expect(whole).toHaveText(/Regionle\s*Abrir en una pestaña nueva/);
    await expect(whole).toHaveAttribute('href', `${baseURL}#/regiones/ES:f/pin`);
    await expect(whole).toHaveAttribute('target', '_blank');
    await expect(whole).toHaveAttribute('rel', 'noopener');

    await card.getByRole('button', { name: 'Empezar' }).click();
    // The first time, the rules: this visitor has not played before.
    const rules = box.getByRole('dialog', { name: 'Cómo se juega' });
    await expect(rules).toBeVisible({ timeout: 30_000 });
    await rules.getByRole('button', { name: 'Empezar' }).click();
    await expect(rules).toHaveCount(0);
    await expect(box.locator('.map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    await expect(box.locator('.play-title strong')).toHaveText('Señalar');
    await expect(box.locator('.hud-main')).toHaveText('1 / 52');
    await expect(box.locator('.q')).toContainText('Te quedan 3 intentos');
    await alone(box);
    // Now it has come, and all of it from the site of the game: the box asks nothing of anyone else.
    expect(game(/\/data\/r\/ES\.json/)).toBe(1);
    expect(game(/\/data\/world\.json/)).toBe(1);
    expect(asked.filter((url) => /^https?:/.test(url) && !url.startsWith(baseURL!) && !url.startsWith(OTHER))).toEqual([]);
    // A click on the map is an answer: a miss leaves two tries, a hit moves on.
    await box.locator('.map-svg .m-items [data-id]').first().click();
    await expect.poll(async () => ((await box.locator('.q').textContent()) ?? '').includes('Te quedan 2 intentos') || (await box.locator('.hud-main').textContent()) !== '1 / 52').toBe(true);

    // The keys that go to other screens of the game go nowhere here.
    await box.locator('.play-title').click();
    await page.keyboard.press('2');
    await page.keyboard.press('p');
    await expect(box.locator('.play-top')).toBeVisible();
    await expect(box.locator('header.top')).toHaveCount(0);

    // Leaving comes back to the card, and the page around it has not moved.
    await box.getByRole('button', { name: 'Salir' }).click();
    await expect(card.getByRole('button', { name: 'Empezar' })).toBeVisible();
    await expect(box.locator('.play-top')).toHaveCount(0);
    await expect(page.locator('#suya')).toHaveText('Las provincias, para el jueves');
    expect(page.url().startsWith(OTHER)).toBe(true);
    // And it starts again, without the rules this time.
    await card.getByRole('button', { name: 'Empezar' }).click();
    await expect(box.locator('.q')).toContainText('Te quedan 3 intentos', { timeout: 30_000 });
    await expect(rules).toHaveCount(0);
  });

  test('is played as its author set it: the options travel in the address', async ({ page, baseURL }) => {
    await seed(page, {});
    const box = await pageWith(page, src(baseURL, 'regiones/ES:f/identify/answer=choice;length=10;labels=0'));
    await box.locator('.embed-box').getByRole('button', { name: 'Empezar' }).click();
    await expect(box.locator('.hud-main')).toHaveText('1 / 10', { timeout: 30_000 });
    await expect(box.locator('.choices .choice')).toHaveCount(4);
    // One question answered, whichever way it goes: a wrong choice may leave another try.
    for (let tries = 0; tries < 4 && !(await box.locator('.verdict').count()); tries++) {
      await box.locator('.choices .choice:not(:disabled)').first().click();
      await page.waitForTimeout(150);
    }
    await expect(box.locator('.verdict')).toBeVisible();
    // Played to the end, it offers itself again, and the card is one step away.
    await box.getByRole('button', { name: 'Terminar' }).click();
    const results = box.locator('.results');
    await expect(results).toBeVisible();
    await expect(results.locator('.results-title')).toBeVisible();
    await expect(results.getByRole('button', { name: 'Cambiar de juego' })).toBeVisible();
    // The result can be taken away as a picture, and it is that of this game, though it is not kept as the one in course.
    const [picture] = await Promise.all([page.waitForEvent('download'), results.getByRole('button', { name: 'Guardar imagen' }).click()]);
    expect(picture.suggestedFilename()).toMatch(/^regionle-identify-\d{4}-\d{2}-\d{2}\.png$/);
    // The first game anyone ends earns an achievement, and its notice leads to a screen that is not here: no
    // notice. Looked at once, a moment later: waiting for there to be none would outlast one that goes away.
    await page.waitForTimeout(900);
    expect(await box.locator('.toast').count()).toBe(0);
    await results.getByRole('button', { name: 'Otra vez' }).click();
    await expect(box.locator('.hud-main')).toHaveText('1 / 10');
    await expect(box.locator('.choices .choice')).toHaveCount(4);
    await alone(box);

    // Without options, the game opens as it does for someone new: typed, and the whole map.
    const plain = await pageWith(page, src(baseURL, 'regiones/ES:f/identify'));
    await plain.locator('.embed-box').getByRole('button', { name: 'Empezar' }).click();
    await expect(plain.locator('.hud-main')).toHaveText('1 / 52', { timeout: 30_000 });
    await expect(plain.locator('.answer-input')).toBeVisible();
    await expect(plain.locator('.choices .choice')).toHaveCount(0);
  });

  test('shows a map to explore at once, with no button to leave by', async ({ page, baseURL }) => {
    await seed(page, {});
    const box = await pageWith(page, src(baseURL, 'regiones/ES:g1/explore'));
    await alone(box);
    await expect(box.locator('.map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    await expect(box.locator('.play-title strong')).toHaveText('Explorar');
    await expect(box.locator('.play-title span').first()).toHaveText('España · comunidades autónomas');
    await expect(box.locator('.embed-box')).toHaveCount(0);
    await expect(box.getByRole('button', { name: 'Salir' })).toBeHidden();
    // What it says of a piece is there for the asking.
    await box.locator('.map-svg .m-items [data-id="ES-AN"]').first().click();
    await expect(box.locator('.panel')).toContainText('Andalucía');
    await expect(box.locator('.panel')).toContainText('Sevilla');
    await expect(box.locator('.embed-foot a')).toHaveAttribute('href', `${baseURL}#/regiones/ES:g1/explore`);
  });

  test('leaves the keyboard to the page around it until it is used, and then keeps it on what it shows', async ({ page, baseURL }) => {
    await seed(page, { helpAuto: false });
    /** Where the keyboard is, as the page around the box sees it and as the box does. */
    const outside = () => page.evaluate(() => document.activeElement?.tagName);
    const inside = (box: FrameLocator) =>
      box.locator('html').evaluate(() => {
        const at = document.activeElement;
        return !at || at === document.body ? null : at.id || at.tagName;
      });
    // A map that shows by itself and a card that waits: neither takes the keys of whoever is reading the page
    // (the space bar that moves down it, the arrows) as it comes up.
    let box = await pageWith(page, src(baseURL, 'regiones/ES:g1/explore'));
    await expect(box.locator('.map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500);
    expect(await outside()).toBe('BODY');
    expect(await box.locator('html').evaluate(() => document.hasFocus())).toBe(false);
    box = await pageWith(page, src(baseURL, 'regiones/ES:f/identify/answer=choice'));
    const start = box.locator('.embed-box').getByRole('button', { name: 'Empezar' });
    await expect(start).toBeVisible();
    await page.waitForTimeout(500);
    expect(await outside()).toBe('BODY');
    expect(await box.locator('html').evaluate(() => document.hasFocus())).toBe(false);

    // Started with the keyboard, the button goes away: the keyboard is at the top of the game, not nowhere.
    await start.focus();
    await page.keyboard.press('Enter');
    await expect(box.locator('.choices .choice')).toHaveCount(4, { timeout: 30_000 });
    expect(await outside()).toBe('IFRAME');
    expect(await inside(box)).toBe('contenido');
    // Left with the keyboard, the same: it is at the top of the card that comes back, one key away from its button.
    await box.getByRole('button', { name: 'Salir' }).focus();
    await page.keyboard.press('Enter');
    await expect(start).toBeVisible();
    expect(await inside(box)).toBe('contenido');
    await page.keyboard.press('Tab');
    await expect(start).toBeFocused();
  });

  test('offers no way into the whole of the game when the game breaks', async ({ page, baseURL }) => {
    await seed(page, { helpAuto: false });
    // The code of the games arrives broken: it fails as it starts.
    let asked = 0;
    await page.route('**/assets/Play-*.js', (route) => {
      asked += 1;
      return route.fulfill({ contentType: 'text/javascript', body: 'throw new Error("roto a propósito");' });
    });
    const box = await pageWith(page, src(baseURL, 'regiones/ES:f/pin'));
    const start = box.locator('.embed-box').getByRole('button', { name: 'Empezar' });
    await start.click();
    await expect.poll(() => asked, { message: 'the code of the games is asked for' }).toBeGreaterThan(0);
    /** What the box says, so that a failure here tells what was there instead. */
    const said = async () => (await box.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200);
    await expect.poll(said, { timeout: 30_000 }).toContain('Algo ha fallado');
    const crash = box.locator('.crash');
    await expect(crash).toContainText('Puedes volver a intentarlo o cargarlo de nuevo.');
    // The start of the game is not for a box, the page is not the game's to reload, and what is kept may be nothing.
    await expect(crash.getByRole('link')).toHaveCount(0);
    await expect(crash).not.toContainText('inicio');
    await expect(crash).not.toContainText('progreso');
    await expect(box.locator('header.top')).toHaveCount(0);
    // Its lines keep together at the top of the box: the button is a button, not a slab as tall as what is left over.
    const again = crash.getByRole('button', { name: 'Volver a cargar' });
    expect(await again.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(60);
    await expect(again).toBeInViewport({ ratio: 1 });
    // Loading it again, now that it arrives whole, brings the card back, and the game with it.
    await page.unroute('**/assets/Play-*.js');
    await again.click();
    await expect(page.locator('#suya')).toBeVisible();
    await start.click();
    await expect(box.locator('.q')).toContainText('Te quedan 3 intentos', { timeout: 30_000 });
  });

  test('says so when the address is that of no map, without anything of the game around', async ({ page, baseURL }) => {
    for (const rest of ['regiones/ZZ/pin', 'nada', 'lista/esto-no-es-una-lista/pin', '']) {
      const box = await pageWith(page, `${baseURL}es.html#/incrustar${rest ? `/${rest}` : ''}`);
      await alone(box);
      await expect(box.getByRole('alert')).toContainText('Esta dirección no es la de ningún mapa');
      await expect(box.locator('.embed-foot a')).toHaveText(/Regionle\s*Ir al juego/);
      await expect(box.locator('.embed-foot a')).toHaveAttribute('href', `${baseURL}#/`);
      await expect(box.getByRole('button', { name: 'Empezar' })).toHaveCount(0);
    }
  });

  test('does not write over the game left half-way in the whole of the game', async ({ page, baseURL }) => {
    // A page of the same site: there the box and the game share what the browser keeps. The game in course
    // is the same game as that of the box, on other countries.
    const mine = { section: 'pops', mode: 'truefalse', countries: ['US', 'CA', 'MX', 'BR', 'AR', 'CL'], levels: {}, opts: OPTS, nonce: 1 };
    await seed(page, { game: mine, helpAuto: false });
    const box = await ownPageWith(page, src(baseURL, 'poblaciones/ES+FR+DE+IT+PT+NL/truefalse'), baseURL);
    type Kept = { game: { mode: string; nonce: number; countries: string[] }; hosted?: unknown; sessions?: { mode: string }[]; recent?: { mode: string; countries: string[]; total: number }[] };
    const kept = () => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as Kept);
    await box.locator('.embed-box').getByRole('button', { name: 'Empezar' }).click();
    await expect(box.locator('.tf-btn')).toHaveCount(2);
    await box.locator('.tf-btn').first().click();
    await expect(box.locator('.verdict')).toBeVisible();
    await box.getByRole('button', { name: 'Terminar' }).click();
    await expect(box.locator('.results')).toBeVisible();
    // What was played in the box counts as played…
    await expect.poll(async () => (await kept()).sessions?.map((s) => s.mode)).toEqual(['truefalse']);
    // …it is the game of the box that goes among the maps played lately, not the one in course…
    expect((await kept()).recent?.map((r) => [...r.countries].sort().join('+'))).toEqual(['DE+ES+FR+IT+NL+PT']);
    // …and the game in course is the one that was. Which game is in the box is not kept at all.
    expect((await kept()).game).toMatchObject({ mode: 'truefalse', nonce: 1, countries: mine.countries });
    expect((await kept()).hosted).toBeUndefined();
  });

  test('ends as a game of its own where the game in course is a review', async ({ page, baseURL }) => {
    await seed(page, { game: { ...PIN_SPAIN, review: true, only: ['ES-AN', 'ES-AR'] }, helpAuto: false });
    const box = await ownPageWith(page, src(baseURL, 'poblaciones/ES+FR+DE+IT+PT+NL/truefalse'), baseURL);
    await box.locator('.embed-box').getByRole('button', { name: 'Empezar' }).click();
    await box.locator('.tf-btn').first().click();
    await expect(box.locator('.verdict')).toBeVisible();
    await box.getByRole('button', { name: 'Terminar' }).click();
    const results = box.locator('.results');
    await expect(results).toBeVisible();
    // Nothing of a review: no next one to go to, and the way out is back to the card.
    await expect(results.locator('.review-next')).toHaveCount(0);
    await expect(results.getByRole('button', { name: 'Volver al inicio' })).toHaveCount(0);
    await expect(results.getByRole('button', { name: 'Otra vez' })).toHaveClass(/btn-primary/);
    await results.getByRole('button', { name: 'Cambiar de juego' }).click();
    await expect(box.locator('.embed-box').getByRole('button', { name: 'Empezar' })).toBeVisible();
  });

  test('is played all the same where the browser keeps nothing for a box of another site', async ({ page, baseURL }) => {
    // What a browser that blocks the cookies of other sites does to a box: any look at what it keeps is refused.
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      if (window.top === window) return;
      const refuse = () => {
        throw new DOMException('Access is denied for this document.', 'SecurityError');
      };
      for (const name of ['localStorage', 'sessionStorage', 'indexedDB', 'caches'] as const) Object.defineProperty(window, name, { configurable: true, get: refuse });
    });
    const box = await pageWith(page, src(baseURL, 'regiones/ES:f/pin'));
    await alone(box);
    expect(await box.locator('html').evaluate(() => {
      try {
        return typeof window.localStorage;
      } catch (e) {
        return (e as Error).name;
      }
    })).toBe('SecurityError');
    await box.locator('.embed-box').getByRole('button', { name: 'Empezar' }).click();
    const rules = box.getByRole('dialog', { name: 'Cómo se juega' });
    await rules.getByRole('button', { name: 'Empezar' }).click();
    await expect(box.locator('.q')).toContainText('Te quedan 3 intentos', { timeout: 30_000 });
    await box.locator('.map-svg .m-items [data-id]').first().click();
    await expect.poll(async () => ((await box.locator('.q').textContent()) ?? '').includes('Te quedan 2 intentos') || (await box.locator('.hud-main').textContent()) !== '1 / 52').toBe(true);
    // To the end: the result is worked out and shown, though nothing of it can be kept.
    await box.getByRole('button', { name: 'Terminar' }).click();
    await expect(box.locator('.results')).toBeVisible();
    await box.getByRole('button', { name: 'Cambiar de juego' }).click();
    await expect(box.locator('.embed-box').getByRole('button', { name: 'Empezar' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('is in English on the page of that language', async ({ page, baseURL }) => {
    const box = await pageWith(page, src(baseURL, 'regiones/ES:f/pin', 'en'));
    const card = box.locator('.embed-box');
    await expect(card.locator('.kicker')).toHaveText('Pin it');
    await expect(card.locator('h1')).toHaveText('Spain · provinces');
    await expect(card.getByRole('button', { name: 'Start' })).toBeVisible();
    await expect(box.locator('.embed-foot a')).toHaveText(/Regionle\s*Open in a new tab/);
    const none = await pageWith(page, `${baseURL}en.html#/incrustar/regiones/ZZ`);
    await expect(none.getByRole('alert')).toContainText('This address is not that of any map');
    await expect(none.locator('.embed-foot a')).toHaveText(/Regionle\s*Go to the game/);
  });

  test('fits a narrow column, with the largest letter @movil', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 360, height: 760 });
    await seed(page, { textSize: 'xl', dyslexia: true, helpAuto: false });
    // Twelve countries, in a box as wide as a narrow column of a blog and not very tall.
    const box = await pageWith(page, src(baseURL, 'regiones/ES:f+PT+FR+IT+DE+GB+NL+BE+CH+AT+PL+SE/identify/answer=choice'), { width: '300', height: 560 });
    const inside = () =>
      box.locator('html').evaluate((html) => {
        const wide = html.scrollWidth - html.clientWidth;
        const tall = html.scrollHeight - html.clientHeight;
        const out = [...html.querySelectorAll('.embed-box > *, .embed-foot a, .play-top > *, .choice')].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.left < -0.5 || r.right > html.clientWidth + 0.5);
        });
        return { wide, tall, out: out.map((el) => el.className) };
      });
    /** The line under the box: in sight, on one line, and with nothing over it. */
    const foot = () =>
      box.locator('html').evaluate((html) => {
        const link = html.querySelector('.embed-foot a')!;
        const r = link.getBoundingClientRect();
        const brand = link.querySelector('.embed-brand')!.getBoundingClientRect();
        const over = html.ownerDocument.elementFromPoint(brand.left + brand.width / 2, brand.top + brand.height / 2);
        const stage = html.querySelector('.stage')?.getBoundingClientRect();
        return {
          seen: r.top >= 0 && r.bottom <= html.clientHeight + 0.5,
          clear: !!over && link.contains(over),
          oneLine: r.height < 2.2 * parseFloat(getComputedStyle(link).fontSize) + 16,
          under: !stage || stage.bottom <= r.top + 0.5,
        };
      });
    const fine = { seen: true, clear: true, oneLine: true, under: true };
    await expect(box.locator('.embed-box h1')).toBeVisible();
    // The title folds here: the dot between its two parts stays at the end of the first line.
    expect(await box.locator('.embed-box h1').evaluate((el) => el.textContent)).toBe('12 países\u00a0· regiones');
    await expect(box.locator('.embed-flags small')).toHaveText('+3');
    expect(await inside()).toEqual({ wide: 0, tall: 0, out: [] });
    expect(await foot()).toEqual(fine);
    // The button to start is in the box as it comes: nothing has to be moved to get to it.
    const start = box.locator('.embed-box').getByRole('button', { name: 'Empezar' });
    await expect(start).toBeInViewport({ ratio: 1 });
    await start.click();
    await expect(box.locator('.choices .choice')).toHaveCount(4, { timeout: 60_000 });
    expect(await inside()).toEqual({ wide: 0, tall: 0, out: [] });
    // The map gives up some of its height, and the line under the box is still there, uncovered.
    expect(await foot()).toEqual(fine);
    expect(await box.locator('.stage').evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(120);
  });
});

test.describe('a box in a page that someone is only reading', () => {
  // Here the copy that the game keeps of itself is what is looked at.
  test.use({ serviceWorkers: 'allow' });

  test('stores no copy of the game on their device, started or not', async ({ page, context, baseURL }) => {
    const box = await pageWith(page, src(baseURL, 'regiones/ES:g1/pin'));
    const workers = () => box.locator('html').evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
    await expect(box.locator('.embed-box').getByRole('button', { name: 'Empezar' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    expect(await workers()).toBe(0);
    expect(context.serviceWorkers()).toHaveLength(0);
    await box.locator('.embed-box').getByRole('button', { name: 'Empezar' }).click();
    await box.getByRole('dialog', { name: 'Cómo se juega' }).getByRole('button', { name: 'Empezar' }).click();
    await expect(box.locator('.q')).toContainText('Te quedan 3 intentos', { timeout: 30_000 });
    await page.waitForLoadState('networkidle');
    expect(await workers()).toBe(0);
    expect(context.serviceWorkers()).toHaveLength(0);

    // The whole of the game does keep its copy: that is what makes it open without a connection.
    await page.goto(baseURL!);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(1);
  });
});
