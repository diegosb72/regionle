/**
 * How the game is read: a larger letter, more contrast and a typeface for readers with dyslexia, chosen in
 * the footer and kept. Each one is an attribute on the page that the stylesheet reads (src/lib/reading.ts).
 */
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, seed, start } from './helpers';

const prefs = (page: Page) => page.locator('.foot-prefs');
const sizes = (page: Page) => prefs(page).getByRole('radiogroup', { name: 'Tamaño de la letra' });
const root = (page: Page) => page.locator('html');
/** A switch of the footer, by its name: the box is hidden under its drawing, so it is asked without looking. */
const toggle = (page: Page, name: string) => prefs(page).getByRole('checkbox', { name });
const flip = (page: Page, name: string) => prefs(page).locator('label.toggle').filter({ hasText: name }).click();
/** The size of the letter of something, in pixels, as the browser has worked it out. */
const sizeOf = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

/** How far apart the ink of something and the paper under it are, from 1 to 21. */
async function contrastOf(page: Page, selector: string, paper: string): Promise<number> {
  return page.evaluate(
    ([sel, bg]) => {
      const rgb = (css: string) => (/rgba?\(([^)]+)\)/.exec(css)?.[1] ?? '').split(/[ ,/]+/).slice(0, 3).map(Number);
      const lum = (c: number[]) => {
        const [r, g, b] = c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const ink = lum(rgb(getComputedStyle(document.querySelector(sel)!).color));
      const under = lum(rgb(getComputedStyle(document.querySelector(bg)!).backgroundColor));
      return (Math.max(ink, under) + 0.05) / (Math.min(ink, under) + 0.05);
    },
    [selector, paper] as const,
  );
}

const EVERYTHING = { textSize: 'xl', contrast: true, dyslexia: true };

test.describe('the size of the letter', () => {
  test('is chosen in the footer among three, enlarges every text, and is kept', async ({ page }) => {
    await seed(page);
    await open(page);
    await expect(sizes(page).getByRole('radio')).toHaveText(['Normal', 'Grande', 'Muy grande']);
    await expect(sizes(page).getByRole('radio', { checked: true })).toHaveText('Normal');
    await expect(root(page)).not.toHaveAttribute('data-text');
    const usual = { body: await sizeOf(page, 'body'), title: await sizeOf(page, '.hero-title'), nav: await sizeOf(page, '.nav a'), hint: await sizeOf(page, '.toggle-text small') };
    expect(usual.body).toBe(16);

    await sizes(page).getByRole('radio', { name: 'Grande', exact: true }).click();
    await expect(root(page)).toHaveAttribute('data-text', 'l');
    expect(await sizeOf(page, 'body')).toBeCloseTo(16 * 1.15, 2);

    await sizes(page).getByRole('radio', { name: 'Muy grande' }).click();
    await expect(root(page)).toHaveAttribute('data-text', 'xl');
    for (const [what, selector] of [
      ['body', 'body'],
      ['title', '.hero-title'],
      ['nav', '.nav a'],
      ['hint', '.toggle-text small'],
    ] as const)
      expect(await sizeOf(page, selector), what).toBeCloseTo(usual[what] * 1.3, 1);

    await page.reload();
    await expect(root(page)).toHaveAttribute('data-text', 'xl');
    await expect(sizes(page).getByRole('radio', { checked: true })).toHaveText('Muy grande');
    expect(await sizeOf(page, 'body')).toBeCloseTo(20.8, 2);

    await sizes(page).getByRole('radio', { name: 'Normal' }).click();
    await expect(root(page)).not.toHaveAttribute('data-text');
    expect(await sizeOf(page, 'body')).toBe(16);
  });

  test('is on the page before the game arrives: nothing jumps when it does', async ({ page }) => {
    await seed(page, EVERYTHING);
    // The scripts of the game are held back: what is on the page is what index.html alone has put there.
    await page.route(/\/assets\/.*\.js$/, () => undefined);
    await page.goto('./', { waitUntil: 'commit' });
    await expect(root(page)).toHaveAttribute('data-text', 'xl');
    await expect(root(page)).toHaveAttribute('data-contrast', 'more');
    await expect(root(page)).toHaveAttribute('data-font', 'dyslexia');
  });

  test('enlarges the names on the map, and the question of a game', async ({ page }) => {
    const game = { section: 'regions', mode: 'learn', countries: ['ES'], levels: { ES: 'g1' } };
    await start(page, game);
    const label = page.locator('.map-svg .m-lbl').first();
    await expect(label).toBeVisible({ timeout: 30_000 });
    expect(await sizeOf(page, '.map-svg .m-lbl')).toBeCloseTo(13, 1);
    const question = await sizeOf(page, '.panel h2');

    await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('regionle:v1')!) as { state: Record<string, unknown> };
      saved.state.textSize = 'xl';
      localStorage.setItem('regionle:v1', JSON.stringify(saved));
    });
    await page.reload();
    await expect(label).toBeVisible({ timeout: 30_000 });
    expect(await sizeOf(page, '.map-svg .m-lbl')).toBeCloseTo(13 * 1.3, 1);
    expect(await sizeOf(page, '.panel h2')).toBeCloseTo(question * 1.3, 1);
  });
});

test.describe('more contrast', () => {
  test('darkens the inks and the lines, in the light theme and in the dark one', async ({ page }) => {
    await seed(page);
    await open(page);
    await expect(toggle(page, 'Alto contraste')).not.toBeChecked();
    // The faintest ink of the game, as it ships: under five to one on its paper.
    expect(await contrastOf(page, '.toggle-text small', 'body')).toBeLessThan(5);

    await flip(page, 'Alto contraste');
    await expect(toggle(page, 'Alto contraste')).toBeChecked();
    await expect(root(page)).toHaveAttribute('data-contrast', 'more');
    expect(await contrastOf(page, '.toggle-text small', 'body')).toBeGreaterThanOrEqual(7);
    expect(await contrastOf(page, '.hero-title', 'body')).toBeGreaterThanOrEqual(15);
    expect(await contrastOf(page, '.hero .kicker', 'body')).toBeGreaterThanOrEqual(7);
    const line = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--line-2').trim());
    expect(line).toBe('#645b49');

    // The dark theme has its own.
    await page.getByRole('button', { name: /Cambiar$/ }).click();
    await page.getByRole('button', { name: /Cambiar$/ }).click();
    await expect(root(page)).toHaveAttribute('data-theme', 'dark');
    expect(await contrastOf(page, '.toggle-text small', 'body')).toBeGreaterThanOrEqual(7);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--line-2').trim())).toBe('#86a2ae');

    await page.reload();
    await expect(root(page)).toHaveAttribute('data-contrast', 'more');
    await expect(toggle(page, 'Alto contraste')).toBeChecked();
    await flip(page, 'Alto contraste');
    await expect(root(page)).not.toHaveAttribute('data-contrast');
  });

  test('is given to a device that asks for it, whatever is chosen here', async ({ page }) => {
    await page.emulateMedia({ contrast: 'more' });
    await seed(page);
    await open(page);
    await expect(root(page)).toHaveAttribute('data-contrast', 'more');
    const box = toggle(page, 'Alto contraste');
    await expect(box).toBeChecked();
    await expect(box).toBeDisabled();
    await expect(prefs(page).locator('label.toggle').filter({ hasText: 'Alto contraste' })).toContainText('Tu dispositivo pide más contraste, y el juego lo sigue.');
    expect(await contrastOf(page, '.toggle-text small', 'body')).toBeGreaterThanOrEqual(7);
    // Nothing was chosen here, and nothing is kept: when the device stops asking, the game stops too.
    await page.emulateMedia({ contrast: 'no-preference' });
    await expect(root(page)).not.toHaveAttribute('data-contrast');
    await expect(box).not.toBeChecked();
    await expect(box).toBeEnabled();
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem('regionle:v1')))!).state.contrast).not.toBe(true);
  });

  test('keeps the colours for the colour-blind theirs: blue for a right answer', async ({ page }) => {
    await seed(page, { cb: true, contrast: true });
    await open(page);
    await expect(root(page)).toHaveAttribute('data-cb', '1');
    await expect(root(page)).toHaveAttribute('data-contrast', 'more');
    const ok = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ok').trim());
    expect(ok).toBe('#005a8e');
  });
});

test.describe('the typeface for dyslexia', () => {
  test('changes every text to Lexend, with more room and no italics, and its files come only then', async ({ page }) => {
    const fetched: string[] = [];
    page.on('request', (req) => {
      if (/lexend/i.test(req.url())) fetched.push(req.url());
    });
    await seed(page);
    await open(page);
    await expect(toggle(page, 'Tipografía para dislexia')).not.toBeChecked();
    expect(await page.locator('body').evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?DM Sans Variable/);
    expect(await page.locator('.hero-title em').evaluate((el) => getComputedStyle(el).fontStyle)).toBe('italic');
    await page.evaluate(() => document.fonts.ready);
    // Nobody who has not asked for it pays for it.
    expect(fetched).toEqual([]);

    await flip(page, 'Tipografía para dislexia');
    await expect(root(page)).toHaveAttribute('data-font', 'dyslexia');
    await expect.poll(() => fetched.length).toBeGreaterThan(0);
    expect(fetched[0]).toMatch(/assets\/lexend-latin-wght-normal-[\w-]+\.woff2$/);
    await page.waitForFunction(() => document.fonts.check('16px "Lexend Variable"'));
    for (const selector of ['body', '.hero-title', '.nav a', '.btn']) expect(await page.locator(selector).first().evaluate((el) => getComputedStyle(el).fontFamily), selector).toMatch(/^"?Lexend Variable/);
    const spaced = await page.locator('.hero p').first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { letter: parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize), word: parseFloat(cs.wordSpacing) / parseFloat(cs.fontSize) };
    });
    expect(spaced.letter).toBeCloseTo(0.05, 2);
    expect(spaced.word).toBeCloseTo(0.1, 2);
    // The title's italics are gone, and its tight spacing with them.
    const title = await page.locator('.hero-title em').evaluate((el) => ({ style: getComputedStyle(el).fontStyle, letter: parseFloat(getComputedStyle(el).letterSpacing) }));
    expect(title.style).toBe('normal');
    expect(title.letter).toBeGreaterThan(0);

    await page.reload();
    await expect(root(page)).toHaveAttribute('data-font', 'dyslexia');
    await expect(toggle(page, 'Tipografía para dislexia')).toBeChecked();
    await flip(page, 'Tipografía para dislexia');
    await expect(root(page)).not.toHaveAttribute('data-font');
    expect(await page.locator('body').evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?DM Sans Variable/);
  });

  test('leaves the blank map to print in its usual letter: it is laid out for it', async ({ page }) => {
    await seed(page, { ...EVERYTHING, game: { section: 'regions', mode: 'print', countries: ['ES'], levels: { ES: 'f' }, nonce: 1, opts: OPTS } });
    await page.goto('./#/jugar');
    const sheet = page.locator('.sheet[data-sheet="map"]');
    await expect(sheet).toBeVisible({ timeout: 30_000 });
    const paper = await sheet.evaluate((el) => {
      const of = (sel: string) => {
        const cs = getComputedStyle(el.querySelector(sel)!);
        return { family: cs.fontFamily.split(',')[0].replace(/"/g, ''), letter: cs.letterSpacing, word: cs.wordSpacing, size: cs.fontSize };
      };
      return { title: of('.sheet-head h2'), sub: of('.sheet-sub'), line: of('.sheet-list li') };
    });
    expect(paper.title.family).toBe('Fraunces Variable');
    expect(paper.sub).toMatchObject({ family: 'DM Sans Variable', letter: 'normal', word: '0px' });
    expect(paper.line).toMatchObject({ family: 'DM Sans Variable', letter: 'normal' });
    // Ten points, whatever the size of the letter on the screen.
    expect(parseFloat(paper.line.size)).toBeCloseTo((10 * 96) / 72, 1);
    // The buttons around the sheet are the game's, and follow the choice.
    expect(await page.locator('.play-title strong').evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?Lexend Variable/);
  });
});

test.describe('a larger letter on a phone', () => {
  test('fits the screen on every page, with everything turned on @movil', async ({ page }) => {
    await seed(page, { ...EVERYTHING, sel: { regions: ['ES'] } });
    for (const route of ['/', '/regiones', '/fisica', '/cifras', '/reto', '/progreso', '/configuracion', '/acerca']) {
      await open(page, route);
      await page.waitForFunction(() => document.fonts.check('16px "Lexend Variable"'));
      const wide = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, screen: window.innerWidth }));
      expect(wide.page, route).toBeLessThanOrEqual(wide.screen);
    }
  });

  test('shows the six links of the header, on as many rows as they need @movil', async ({ page }) => {
    await seed(page, EVERYTHING);
    await open(page);
    const links = page.locator('.nav a');
    await expect(links).toHaveCount(6);
    for (let i = 0; i < 6; i++) await expect(links.nth(i)).toBeInViewport({ ratio: 1 });
    const rows = new Set(await links.evaluateAll((all) => all.map((a) => Math.round(a.getBoundingClientRect().top))));
    expect(rows.size).toBeGreaterThan(1);
    // Several rows tall, the header goes away with the page instead of staying on top of it.
    expect(await page.locator('.top').evaluate((el) => getComputedStyle(el).position)).toBe('static');
  });

  test('keeps the question, the counters and the map of a game on the screen @movil', async ({ page }) => {
    await seed(page, { ...EVERYTHING, game: { section: 'regions', mode: 'identify', countries: ['ES'], levels: { ES: 'g1' }, nonce: 1, opts: OPTS } });
    await page.goto('./#/jugar');
    await expect(page.locator('.map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    const room = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, screen: window.innerWidth }));
    expect(room.page).toBeLessThanOrEqual(room.screen);
    // The title is whole, and the counters beside it or under it: never on top of it.
    await expect(page.locator('.play-title strong')).toHaveText('Identificar');
    expect(await page.locator('.play-title strong').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    const apart = async () => {
      const title = (await page.locator('.play-title strong').boundingBox())!;
      const word = await page.locator('.play-title strong').evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getBoundingClientRect().right;
      });
      const hud = (await page.locator('.hud').boundingBox())!;
      return { beside: hud.x >= word - 1, under: hud.y >= title.y + title.height - 1 };
    };
    const wide = await apart();
    expect(wide.beside || wide.under).toBe(true);
    // On a narrower phone there is no room beside it: the counters take a row of their own.
    await page.setViewportSize({ width: 340, height: 740 });
    const narrow = await apart();
    expect(narrow.under).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.setViewportSize({ width: 412, height: 839 });
    await expect(page.locator('.answer-input')).toBeInViewport();
    // The map still has a third of the screen or more.
    const map = (await page.locator('.stage').boundingBox())!;
    expect(map.height).toBeGreaterThan(page.viewportSize()!.height * 0.3);
  });
});
