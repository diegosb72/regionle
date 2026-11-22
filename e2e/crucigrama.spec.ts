/**
 * «Crucigrama»: the names of some pieces of the map cross each other in a grid, and the map is the list of
 * clues: each word has a number, and its piece carries it. A word is written with the keyboard or with the
 * letters on the screen; written rightly, it stays, and its name comes up on the map.
 */
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, restart, seed, start } from './helpers';

/** The provinces of Spain: with this game the crossword has these ten words, by their numbers. */
const PROVINCES = { section: 'regions', countries: ['ES'], levels: { ES: 'f' }, mode: 'crossword' };
const WORDS: Record<number, { word: string; id: string; name: string; down: boolean }> = {
  1: { word: 'PONTEVEDRA', id: 'ES-PO', name: 'Pontevedra', down: true },
  2: { word: 'VIZCAYA', id: 'ES-BI', name: 'Vizcaya', down: false },
  3: { word: 'ZARAGOZA', id: 'ES-Z', name: 'Zaragoza', down: true },
  4: { word: 'TERUEL', id: 'ES-TE', name: 'Teruel', down: true },
  5: { word: 'TARRAGONA', id: 'ES-T', name: 'Tarragona', down: false },
  6: { word: 'ORENSE', id: 'ES-OR', name: 'Orense', down: true },
  7: { word: 'HUESCA', id: 'ES-HU', name: 'Huesca', down: true },
  8: { word: 'MELILLA', id: 'ES-ML', name: 'Melilla', down: true },
  9: { word: 'LASPALMAS', id: 'ES-GC', name: 'Las Palmas', down: false },
  10: { word: 'PALENCIA', id: 'ES-P', name: 'Palencia', down: false },
};
const IDS = Object.values(WORDS)
  .map((w) => w.id)
  .sort();

const kept = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { sessions: { mode: string; label: string; total: number; ok: number; warn: number; bad: number }[]; stats?: Record<string, unknown> });
const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`).first();
/** The pieces of the map that are painted one way, by what they are. */
const painted = (page: Page, how: string): Promise<string[]> =>
  page.locator(`.map-svg .st-${how}`).evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute('data-id') ?? ''))].filter(Boolean).sort());
const grid = (page: Page) => page.locator('.cw-grid');
const clue = (page: Page) => page.locator('.cw-clue');
const said = (page: Page) => page.locator('.cw-said');
const count = (page: Page) => page.locator('.cw-count');
const cells = (page: Page, kind: string) => page.locator(`.cw-cell.${kind}`);
/** The cell in which the word of a number starts. */
const numbered = (page: Page, n: number) => page.locator('.cw-cell').filter({ has: page.locator('.cw-n', { hasText: new RegExp(`^${n}$`) }) });
/** The numbers the map carries on its pieces, in order. */
const tags = (page: Page): Promise<number[]> => page.locator('.map-svg .m-lbl-tag').evaluateAll((els) => els.map((el) => Number(el.textContent)).sort((a, b) => a - b));
/** The names the map writes: those of the pieces whose words are written. */
const named = (page: Page): Promise<string[]> => page.locator('.map-svg .m-lbl:not(.m-lbl-tag)').evaluateAll((els) => els.map((el) => el.textContent ?? '').sort());
/** Where the next letter goes: the row and the column of its cell. */
const cursor = (page: Page): Promise<string> => page.locator('.cw-cell.at').evaluate((el) => `${el.getAttribute('data-r')},${el.getAttribute('data-c')}`);
/** The word in hand, as it stands: its letters, with a dot for each cell that is empty. */
const inHand = (page: Page): Promise<string> => cells(page, 'in').evaluateAll((els) => els.map((el) => (el.querySelector('.cw-ch')?.textContent ?? '').trim() || '·').join(''));

/** A click on a river: in the middle of its course, where the line is. */
async function clickLine(page: Page, id: string): Promise<void> {
  const point = await page.locator(`.map-svg path.ln-hit[data-id="${id}"]`).evaluate((el) => {
    const path = el as SVGPathElement;
    const p = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM()!);
    return { x: p.x, y: p.y };
  });
  await page.mouse.click(point.x, point.y);
}

/** The word of a number is taken in hand: the cell that carries the number is pressed. */
async function choose(page: Page, n: number): Promise<void> {
  await numbered(page, n).click();
  await expect(page.locator('.cw-num')).toHaveText(String(n));
}

/** A word is written: the letters of its cells that are not settled yet, one key after another. */
async function write(page: Page, n: number, word: string = WORDS[n].word): Promise<void> {
  await choose(page, n);
  const todo = await cells(page, 'in').evaluateAll((els) => els.map((el) => !/\b(ok|warn|bad|given)\b/.test(el.className)));
  expect(todo, `the cells of word ${n}`).toHaveLength(word.length);
  for (let i = 0; i < word.length; i++) if (todo[i]) await page.keyboard.press(word[i]);
}

test.describe('crossword', () => {
  test('lays the names of ten pieces so that they cross, and the map carries the number of each word on its piece', async ({ page }) => {
    await start(page, PROVINCES);
    await expect(page.locator('.play-title strong')).toHaveText('Crucigrama');
    await expect(page.locator('.play-title span')).toHaveText('España · provincias');
    await expect(page.locator('.hud-main')).toHaveText('0 / 10');
    await expect(page.locator('.kicker')).toHaveText('¿Cómo se llaman?');
    await expect(count(page)).toHaveText('Llevas 0 de 10');
    await expect(said(page)).toHaveText('Cada palabra es el nombre de la provincia que lleva su número en el mapa. Elige una casilla y escribe.');
    await expect(grid(page)).toHaveAttribute('aria-label', /^Crucigrama de \d+ filas y \d+ columnas$/);
    // Ten words, each with a number of its own, and none of their letters in sight.
    await expect(page.locator('.cw-n')).toHaveText(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    expect((await page.locator('.cw-ch').allTextContents()).join('')).toBe('');
    // As many cells as the words have letters, less the ones they share: every word crosses another.
    const letters = Object.values(WORDS).reduce((n, w) => n + w.word.length, 0);
    const squares = await page.locator('.cw-cell').count();
    expect(squares).toBeLessThanOrEqual(letters - 9);
    expect(squares).toBeGreaterThan(letters - 20);
    // The first word is in hand: its cells are marked, and the line over the grid says which it is.
    await expect(clue(page)).toHaveText('1vertical · 10 letras');
    await expect(cells(page, 'in')).toHaveCount(10);
    await expect(cells(page, 'at')).toHaveCount(1);
    await expect(numbered(page, 1)).toHaveClass(/\bat\b/);
    await expect(numbered(page, 1)).toHaveAttribute('aria-label', '1 vertical, letra 1 de 10: vacía');

    // The map carries the ten numbers and no name; the piece of the word in hand is the one that stands out.
    expect(await tags(page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(await named(page)).toEqual([]);
    expect(await painted(page, 'target')).toEqual(['ES-PO']);
    expect(await painted(page, 'sel')).toEqual(IDS.filter((id) => id !== 'ES-PO'));
    await piece(page, 'ES-Z').hover();
    await expect(page.locator('.map-tip')).toHaveText('Palabra 3');
    // A piece that is in no word has nothing to say.
    await piece(page, 'ES-M').hover();
    await expect(page.locator('.map-tip')).toHaveCSS('opacity', '0');

    // Letters typed anywhere go into the word: the first one, wherever the focus is.
    await page.keyboard.type('pont');
    expect(await inHand(page)).toBe('PONT······');
    await expect(numbered(page, 1)).toHaveAttribute('aria-label', '1 vertical, letra 1 de 10: P');
    await page.keyboard.type('evedra');
    await expect(said(page)).toHaveText('¡Pontevedra! Quedan 9.');
    await expect(count(page)).toHaveText('Llevas 1 de 10');
    await expect(page.locator('.hud-main')).toHaveText('1 / 10');
    await expect(cells(page, 'ok')).toHaveCount(10);
    // Its piece is painted as written, with its name in the place of its number.
    await expect(piece(page, 'ES-PO')).toHaveClass(/st-ok/);
    expect(await named(page)).toEqual(['Pontevedra']);
    expect(await tags(page)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    await piece(page, 'ES-PO').hover();
    await expect(page.locator('.map-tip')).toHaveText('Pontevedra');
    // The writing goes on with the next word.
    await expect(clue(page)).toHaveText('2horizontal · 7 letras');
    expect(await painted(page, 'target')).toEqual(['ES-BI']);
    // A word that is written takes no more letters.
    await numbered(page, 1).click();
    await page.keyboard.type('zz');
    await expect(cells(page, 'ok')).toHaveCount(10);
    expect((await page.locator('.cw-cell.ok .cw-ch').allTextContents()).join('')).toBe('PONTEVEDRA');
  });

  test('gives the letters of a word that is written to the words that cross it, and the writing goes over them', async ({ page }) => {
    await start(page, PROVINCES);
    await write(page, 1);
    // Tarragona starts on the T of Pontevedra: that letter is there, and the next one is the one to write.
    await choose(page, 5);
    await expect(clue(page)).toHaveText('5horizontal · 9 letras');
    expect(await inHand(page)).toBe('T········');
    // The cell that was pressed has its letter for good: what is typed goes into the first one that has none.
    await expect(numbered(page, 5)).toHaveClass(/\bat\b/);
    await page.keyboard.type('arragona');
    await expect(said(page)).toHaveText('¡Tarragona! Quedan 8.');
    await expect(piece(page, 'ES-T')).toHaveClass(/st-ok/);
    // Teruel, Orense and Zaragoza have a letter each from it.
    await choose(page, 4);
    expect(await inHand(page)).toBe('··R···');
    await choose(page, 6);
    expect(await inHand(page)).toBe('O·····');
    await choose(page, 3);
    expect(await inHand(page)).toBe('···A····');
    // The letters that are missing are written one after another, over the one that is there.
    await page.keyboard.type('zarg');
    expect(await inHand(page)).toBe('ZARAG···');
    await page.keyboard.type('oza');
    await expect(said(page)).toHaveText('¡Zaragoza! Quedan 7.');
    await expect(count(page)).toHaveText('Llevas 3 de 10');
  });

  test('tells a word that is full and wrong, and counts it as written with help once it is put right', async ({ page }) => {
    await start(page, PROVINCES);
    await choose(page, 2);
    await page.keyboard.type('vizcayo');
    await expect(said(page)).toHaveText('La palabra 2 no es VIZCAYO. Revisa sus letras.');
    await expect(said(page)).toHaveClass(/cw-no/);
    await expect(cells(page, 'off')).toHaveCount(7);
    await expect(count(page)).toHaveText('Llevas 0 de 10');
    await expect(page.locator('.hud-main')).toHaveText('0 / 10');
    await expect(piece(page, 'ES-BI')).toHaveClass(/st-target/);
    // It stays red until a letter is changed; the key that goes back takes the last one out.
    await page.keyboard.press('Backspace');
    expect(await inHand(page)).toBe('VIZCAY·');
    await expect(cells(page, 'off')).toHaveCount(0);
    await page.keyboard.press('a');
    await expect(said(page)).toHaveText('¡Vizcaya! Quedan 9.');
    await expect(cells(page, 'warn')).toHaveCount(7);
    await expect(piece(page, 'ES-BI')).toHaveClass(/st-warn/);

    // A wrong letter in a cell that two words share is put right by the word that crosses there: the one
    // that was wrong is written then, and with help; the one that puts it right is still clean.
    await choose(page, 4);
    await page.keyboard.type('texuel');
    await expect(said(page)).toHaveText('La palabra 4 no es TEXUEL. Revisa sus letras.');
    await choose(page, 5);
    await page.keyboard.type('tar');
    await expect(said(page)).toHaveText('¡Teruel! Quedan 8.');
    await expect(piece(page, 'ES-TE')).toHaveClass(/st-warn/);
    await expect(clue(page)).toHaveText('5horizontal · 9 letras');
    await page.keyboard.type('ragona');
    await expect(said(page)).toHaveText('¡Tarragona! Quedan 7.');
    await expect(piece(page, 'ES-T')).toHaveClass(/st-ok/);
    // A cell that two words share is painted by the better of the two.
    await expect(cells(page, 'ok')).toHaveCount(9);
    await expect(cells(page, 'warn')).toHaveCount(7 + 5);

    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('.results-note')).toHaveText('A la primera: la palabra bien escrita sin pedir letras y sin haberla completado mal antes. Con ayuda: la que sale después de eso.');
    await expect(page.locator('.results-group.g-ok .row-name')).toHaveText(['TarragonaCataluña']);
    await expect(page.locator('.results-group.g-warn .row-name')).toHaveText(['Vizcayadespués de escribirla mal', 'Terueldespués de escribirla mal']);
    // The crossword was left half way: what was not written is not held against the player.
    await expect(page.locator('.results-group.g-bad')).toHaveCount(0);
    expect((await kept(page)).sessions.at(-1)).toMatchObject({ mode: 'crossword', label: 'España · provincias', total: 3, ok: 1, warn: 2, bad: 0 });
  });

  test('gives a letter when it is asked for, and the words that have it count as written with help', async ({ page }) => {
    await start(page, PROVINCES);
    const give = page.getByRole('button', { name: 'Dar una letra' });
    await give.click();
    await expect(said(page)).toHaveText('Ahí va una letra: la P. Esa palabra cuenta ya como «con ayuda».');
    await expect(cells(page, 'given')).toHaveCount(1);
    expect(await inHand(page)).toBe('P·········');
    // The letter that was given stays: the writing goes on from the next cell, and the key that goes back leaves it alone.
    await expect(numbered(page, 1)).not.toHaveClass(/\bat\b/);
    await page.keyboard.press('Backspace');
    expect(await inHand(page)).toBe('P·········');
    await page.keyboard.type('ontevedra');
    await expect(said(page)).toHaveText('¡Pontevedra! Quedan 9.');
    await expect(cells(page, 'warn')).toHaveCount(10);
    await expect(cells(page, 'given')).toHaveCount(0);
    await expect(piece(page, 'ES-PO')).toHaveClass(/st-warn/);

    // A letter given in a cell that two words share is of both.
    await choose(page, 3);
    await give.click();
    await expect(said(page)).toHaveText('Ahí va una letra: la Z. Las dos palabras que la llevan cuentan ya como «con ayuda».');
    await write(page, 2);
    await expect(piece(page, 'ES-BI')).toHaveClass(/st-warn/);
    // The last letter of a word can be the one that is given.
    await choose(page, 3);
    await page.keyboard.type('aragoz');
    expect(await inHand(page)).toBe('ZARAGOZ·');
    await give.click();
    await expect(said(page)).toHaveText('¡Zaragoza! Quedan 7.');
    await expect(piece(page, 'ES-Z')).toHaveClass(/st-warn/);

    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-group.g-warn .row-name')).toHaveText(['Pontevedracon letras pedidas', 'Vizcayacon letras pedidas', 'Zaragozacon letras pedidas']);
    await expect(page.locator('.results-stats')).toContainText('Letras pedidas3');
    await expect(page.locator('.results-stats')).not.toContainText('Crucigramas');
  });

  test('is written with the keyboard: the arrows go from cell to cell, Space turns to the word that crosses and Enter goes to the next one', async ({ page }) => {
    await start(page, PROVINCES);
    // One cell of the grid is in the order of the Tab key: the one that is written in.
    await expect(page.locator('.cw-cell[tabindex="0"]')).toHaveCount(1);
    await numbered(page, 1).click();
    await expect(numbered(page, 1)).toBeFocused();
    expect(await cursor(page)).toBe('0,0');
    await page.keyboard.press('ArrowDown');
    expect(await cursor(page)).toBe('1,0');
    await expect(page.locator('.cw-cell.at')).toBeFocused();
    await expect(page.locator('.cw-cell[tabindex="0"]')).toHaveCount(1);
    await expect(clue(page)).toHaveText('1vertical · 10 letras');
    // A letter goes into the cell, and the writing goes on to the next one.
    await page.keyboard.press('x');
    expect(await inHand(page)).toBe('·X········');
    expect(await cursor(page)).toBe('2,0');
    // The key that goes back takes out the letter before an empty cell; Delete, the one in the cell.
    await page.keyboard.press('Backspace');
    expect(await inHand(page)).toBe('··········');
    expect(await cursor(page)).toBe('1,0');
    await page.keyboard.press('y');
    await page.keyboard.press('Delete');
    expect(await inHand(page)).toBe('·Y········');
    expect(await cursor(page)).toBe('2,0');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Delete');
    expect(await inHand(page)).toBe('··········');
    expect(await cursor(page)).toBe('1,0');
    // Home and End go to the ends of the word.
    await page.keyboard.press('End');
    expect(await cursor(page)).toBe('9,0');
    await page.keyboard.press('ArrowDown');
    expect(await cursor(page)).toBe('9,0');
    await page.keyboard.press('Home');
    expect(await cursor(page)).toBe('0,0');
    // An arrow that leaves the word goes over the gaps to the next cell that way, and takes the word that goes that way.
    await page.keyboard.press('ArrowRight');
    await expect(clue(page)).toHaveText('2horizontal · 7 letras');
    await expect(numbered(page, 2)).toHaveClass(/\bat\b/);
    await expect(numbered(page, 2)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(clue(page)).toHaveText('1vertical · 10 letras');

    // Enter goes to the next word that is not written, and with Shift to the one before; round and round.
    await page.keyboard.press('Enter');
    await expect(clue(page)).toHaveText('2horizontal · 7 letras');
    await page.keyboard.press('Enter');
    await expect(clue(page)).toHaveText('3vertical · 8 letras');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.press('Shift+Enter');
    await expect(clue(page)).toHaveText('10horizontal · 8 letras');
    await page.keyboard.press('Enter');
    await expect(clue(page)).toHaveText('1vertical · 10 letras');

    // Space turns to the other word of a cell where two cross; where one goes through, nothing changes.
    await choose(page, 5);
    await expect(clue(page)).toHaveText('5horizontal · 9 letras');
    await page.keyboard.press('Space');
    await expect(clue(page)).toHaveText('1vertical · 10 letras');
    expect(await cursor(page)).toBe(await numbered(page, 5).evaluate((el) => `${el.getAttribute('data-r')},${el.getAttribute('data-c')}`));
    await page.keyboard.press('Space');
    await expect(clue(page)).toHaveText('5horizontal · 9 letras');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    await expect(clue(page)).toHaveText('5horizontal · 9 letras');
    await expect(count(page)).toHaveText('Llevas 0 de 10');
  });

  test('takes a word in hand by its cell or by its piece of the map', async ({ page }) => {
    await start(page, PROVINCES);
    // The cell that carries a number is the start of its word.
    await numbered(page, 5).click();
    await expect(clue(page)).toHaveText('5horizontal · 9 letras');
    expect(await painted(page, 'target')).toEqual(['ES-T']);
    // Pressed again, a cell where two words cross turns to the other one.
    await numbered(page, 5).click();
    await expect(clue(page)).toHaveText('1vertical · 10 letras');
    await numbered(page, 5).click();
    await expect(clue(page)).toHaveText('5horizontal · 9 letras');
    // Any other cell is of the word that goes through it the way of the one in hand, or the only one it has.
    await cells(page, 'in').nth(4).click();
    await expect(clue(page)).toHaveText('5horizontal · 9 letras');
    expect(await cursor(page)).toBe(await cells(page, 'in').nth(4).evaluate((el) => `${el.getAttribute('data-r')},${el.getAttribute('data-c')}`));

    // A piece of the map is its word.
    await piece(page, 'ES-HU').click();
    await expect(clue(page)).toHaveText('7vertical · 6 letras');
    await expect(numbered(page, 7)).toHaveClass(/\bat\b/);
    expect(await painted(page, 'target')).toEqual(['ES-HU']);
    await page.keyboard.type('huesca');
    await expect(said(page)).toHaveText('¡Huesca! Quedan 9.');
    // The writing went on to the next word; a piece that is in no word of the crossword is nothing to press.
    await expect(clue(page)).toHaveText('8vertical · 7 letras');
    await piece(page, 'ES-M').click();
    await expect(clue(page)).toHaveText('8vertical · 7 letras');
    expect(await painted(page, 'target')).toEqual(['ES-ML']);

    // A cell where a word that is written crosses one that is not stands for the one there is to write.
    await write(page, 1);
    await cells(page, 'ok').nth(8).click();
    await expect(clue(page)).toHaveText('1vertical · 10 letras');
    await numbered(page, 5).click();
    await expect(clue(page)).toHaveText('5horizontal · 9 letras');
    await numbered(page, 2).click();
    await numbered(page, 5).click();
    await expect(clue(page)).toHaveText('5horizontal · 9 letras');
  });

  test('says so when every word was written first time, and Enter goes on', async ({ page }) => {
    await start(page, PROVINCES);
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) await write(page, n);
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.verdict-head')).toContainText('¡Crucigrama completo!');
    await expect(page.locator('.verdict')).toContainText('Las 10, a la primera.');
    await expect(page.locator('.hud-main')).toHaveText('10 / 10');
    await expect(grid(page)).toHaveClass(/over/);
    await expect(cells(page, 'at')).toHaveCount(0);
    expect(await named(page)).toEqual(Object.values(WORDS).map((w) => w.name).sort());
    expect(await tags(page)).toEqual([]);
    expect(await painted(page, 'ok')).toEqual(IDS);
    // Letters typed now are for nobody.
    await page.keyboard.type('zz');
    await expect(page.locator('.verdict-head')).toContainText('¡Crucigrama completo!');
    await expect(page.getByRole('button', { name: 'Ver resultado' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.results-title')).toHaveText('¡Todas, y sin ayuda!');
    await expect(page.locator('.results-group.g-ok .row-name')).toHaveCount(10);
    const state = await kept(page);
    expect(state.sessions.at(-1)).toMatchObject({ mode: 'crossword', label: 'España · provincias', total: 10, ok: 10, warn: 0, bad: 0 });
    // Nothing goes into the review: a name written with the letters of the ones that cross it says little of what is known of the piece.
    expect(Object.keys(state.stats ?? {})).toHaveLength(0);
    // And it is no homework.
    await expect(page.getByRole('button', { name: 'Poner de tarea' })).toHaveCount(0);
  });

  test('writes the words that are missing when it is given up, and a game of twenty names is two crosswords', async ({ page }) => {
    await start(page, { ...PROVINCES, opts: { length: 20 } });
    await expect(page.locator('.kicker')).toHaveText('Crucigrama 1 de 2');
    await expect(page.locator('.hud-main')).toHaveText('0 / 20');
    await expect(count(page)).toHaveText('Llevas 0 de 10');
    const first = await painted(page, 'sel');
    const firstTarget = await painted(page, 'target');
    expect(first.length + firstTarget.length).toBe(10);
    // The first word is written, whatever it is: its letters are asked for.
    const give = page.getByRole('button', { name: 'Dar una letra' });
    const length = await cells(page, 'in').count();
    for (let i = 0; i < length; i++) await give.click();
    await expect(count(page)).toHaveText('Llevas 1 de 10');
    await page.getByRole('button', { name: 'Me rindo' }).click();
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.verdict-head')).toContainText('Te han faltado 9 palabras');
    await expect(page.locator('.verdict')).toContainText('Están escritas en el crucigrama, y en el mapa con su nombre.');
    // Every cell has its letter; what was not written is told apart, and the map names it.
    expect((await page.locator('.cw-ch').allTextContents()).every((ch) => /^[A-ZÑ]$/.test(ch))).toBe(true);
    await expect(cells(page, 'warn')).toHaveCount(length);
    expect(await cells(page, 'bad').count()).toBeGreaterThan(40);
    await expect(count(page)).toHaveText('Llevas 1 de 10');
    await expect(page.locator('.hud-main')).toHaveText('10 / 20');
    expect(await painted(page, 'bad')).toHaveLength(9);
    expect(await named(page)).toHaveLength(10);
    expect(await tags(page)).toEqual([]);
    // A crossword that is over takes no letters, and has no letters to write with.
    await page.keyboard.type('zz');
    await expect(page.locator('.cw-keys')).toHaveCount(0);
    const next = page.getByRole('button', { name: 'Siguiente crucigrama' });
    await expect(next).toBeFocused();
    await next.click();

    // Another crossword, with ten other names; its first cell has the focus the button had.
    await expect(page.locator('.kicker')).toHaveText('Crucigrama 2 de 2');
    await expect(count(page)).toHaveText('Llevas 0 de 10');
    await expect(page.locator('.cw-cell.at')).toBeFocused();
    await expect(clue(page)).toContainText(/^1(horizontal|vertical) · \d+ letras/);
    expect((await page.locator('.cw-ch').allTextContents()).join('')).toBe('');
    const second = [...(await painted(page, 'sel')), ...(await painted(page, 'target'))];
    expect(second).toHaveLength(10);
    expect(second.filter((id) => first.includes(id) || firstTarget.includes(id))).toEqual([]);
    // What the first crossword left stays painted on the map; its names give way to the numbers of this one.
    expect(await painted(page, 'bad')).toHaveLength(9);
    expect(await named(page)).toEqual([]);
    expect(await tags(page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('.results-stats')).toContainText('Crucigramas2 de 2');
    await expect(page.locator('.results-group.g-warn .row-name')).toHaveCount(1);
    await expect(page.locator('.results-group.g-bad .row-name')).toHaveCount(9);
    await expect(page.locator('.results-group.g-bad .row-name').first()).toContainText('sin escribir');
    expect((await kept(page)).sessions.at(-1)).toMatchObject({ mode: 'crossword', total: 10, ok: 0, warn: 1, bad: 9 });
  });

  test('is left before any word is written: a game that is over, with nothing in it to keep', async ({ page }) => {
    await start(page, PROVINCES);
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('.results-note')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Otra vez' })).toBeVisible();
    expect((await kept(page)).sessions ?? []).toHaveLength(0);
  });

  test('leaves out the names that do not fit a crossword, and says which', async ({ page }) => {
    // Bavaria and Berlin fit and cross; the thirty letters of Mecklenburg-Western Pomerania do not.
    await start(page, { section: 'regions', countries: ['DE'], mode: 'crossword', only: ['DE-MV', 'DE-BY', 'DE-BE'], list: 'Tres' });
    await expect(page.locator('.play-title span')).toHaveText('Alemania · estados federados · Tres');
    await expect(page.locator('.hud-main')).toHaveText('0 / 2');
    await expect(said(page)).toHaveText('Cada palabra es el nombre del estado que lleva su número en el mapa. Elige una casilla y escribe.');
    expect(await tags(page)).toEqual([1, 2]);
    await piece(page, 'DE-BY').click();
    await page.keyboard.type('baviera');
    await expect(said(page)).toHaveText('¡Baviera! Queda 1.');
    await piece(page, 'DE-BE').click();
    const rest = (await inHand(page)).split('').flatMap((ch, i) => (ch === '·' ? ['BERLIN'[i]] : []));
    expect(rest).toHaveLength(5);
    await page.keyboard.type(rest.join(''));
    await expect(page.locator('.verdict-head')).toContainText('¡Crucigrama completo!');
    await expect(page.locator('.verdict')).toContainText('Las 2, a la primera.');
    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(page.locator('.results-note')).toContainText('No cabe en el crucigrama y se queda fuera: Mecklemburgo-Pomerania Occidental. Entran los nombres de 3 a 13 letras.');
    await expect(page.locator('.results-group.g-ok .row-name')).toHaveText(['Baviera', 'Berlín']);

    // With no name that fits there is nothing to play with, and the game says why.
    await restart(page, { section: 'regions', countries: ['DE'], mode: 'crossword', only: ['DE-MV'], list: 'Larga' });
    await expect(page.locator('.results-title')).toHaveText('Sin nombres');
    await expect(page.locator('.results-note')).toHaveText('En este mapa no hay ningún nombre que quepa en un crucigrama: entran los de 3 a 13 letras.');
    await expect(grid(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Otra vez' })).toHaveCount(0);
  });

  test('is played with countries, whose names of two words are written as one and say how they are parted', async ({ page }) => {
    await start(page, { section: 'countries', mode: 'crossword', countries: ['ES', 'PT', 'FR', 'IT', 'CI', 'GW'], only: ['GW', 'FR'] });
    await expect(said(page)).toHaveText('Cada palabra es el nombre del país que lleva su número en el mapa. Elige una casilla y escribe.');
    await piece(page, 'GW').click();
    await expect(clue(page)).toContainText('· 11 letras (6 + 5)');
    await page.keyboard.type('guineabisau');
    await expect(said(page)).toHaveText('¡Guinea-Bisáu! Queda 1.');
    await expect(piece(page, 'GW')).toHaveClass(/st-ok/);
    await piece(page, 'FR').click();
    await expect(clue(page)).toContainText('· 7 letras');
    await expect(clue(page)).not.toContainText('(');
    const rest = (await inHand(page)).split('').flatMap((ch, i) => (ch === '·' ? ['FRANCIA'[i]] : []));
    await page.keyboard.type(rest.join(''));
    await expect(page.locator('.verdict-head')).toContainText('¡Crucigrama completo!');
  });

  test('is played with the cities of a country and with what a physical map has', async ({ page }) => {
    await start(page, { section: 'cities', mode: 'crossword', countries: ['ES'], opts: { cityPick: 'top', cityCount: 10 } });
    await expect(page.locator('.hud-main')).toHaveText('0 / 10');
    await expect(said(page)).toHaveText('Cada palabra es el nombre de la ciudad que lleva su número en el mapa. Elige una casilla y escribe.');
    // Ten dots, each with its number; the one of the word in hand is the one that stands out.
    expect(await tags(page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(await painted(page, 'target')).toHaveLength(1);
    expect(await painted(page, 'sel')).toHaveLength(9);

    await restart(page, { section: 'physical', mode: 'crossword', countries: ['river', 'in:ES'], only: ['r:ebro', 'r:tagus'] });
    await expect(said(page)).toHaveText('Cada palabra es el nombre del río que lleva su número en el mapa. Elige una casilla y escribe.');
    expect(await tags(page)).toEqual([1, 2]);
    await clickLine(page, 'r:ebro');
    await page.keyboard.type('ebro');
    await expect(said(page)).toHaveText('¡Ebro! Queda 1.');
    await expect(piece(page, 'r:ebro')).toHaveClass(/st-ok/);
    expect(await named(page)).toEqual(['Ebro']);
    await clickLine(page, 'r:tagus');
    // The two rivers cross on their last letter, which is there already.
    expect(await inHand(page)).toBe('···O');
    await page.keyboard.type('taj');
    await expect(page.locator('.verdict-head')).toContainText('¡Crucigrama completo!');
  });

  test('is offered among the word games of every section with a map, and says how long a game is', async ({ page }) => {
    await seed(page);
    for (const route of ['/paises', '/ciudades', '/fisica', '/regiones']) {
      await open(page, route);
      const words = page.getByRole('group', { name: 'Juegos de palabras' });
      await expect(words.getByRole('button'), route).toHaveText([/^Ahorcado/, /^Sopa de letras/, /^Crucigrama/]);
      await words.getByRole('button', { name: /^Crucigrama/ }).click();
      await expect(page.locator('.mode-about'), route).toContainText('Un crucigrama con las pistas en el mapa: cada palabra tiene un número');
    }
    await open(page, '/cifras');
    await expect(page.getByRole('button', { name: /^Crucigrama/ })).toHaveCount(0);

    await open(page, '/regiones');
    await page.getByRole('button', { name: /^Crucigrama/ }).click();
    // As many names as are asked for, and never without end.
    await expect(page.getByRole('radiogroup', { name: 'Preguntas' }).getByRole('radio')).toHaveText(['Todo', '10', '20', '50']);
    // A whole map may have names that do not fit a crossword: «up to» as many as it has.
    await page.getByRole('radiogroup', { name: 'Preguntas' }).getByRole('radio', { name: 'Todo' }).click();
    await expect(page.locator('.mode-facts')).toContainText('hasta 19 nombres');
    await page.getByRole('radiogroup', { name: 'Preguntas' }).getByRole('radio', { name: '10' }).click();
    await expect(page.locator('.mode-facts')).toContainText('10 nombres');
    await expect(page.locator('.mode-facts')).not.toContainText('hasta');
    // No clock, no lives and no exam: they belong to the games that ask one thing after another.
    await expect(page.getByRole('radiogroup', { name: 'Formato' })).toHaveCount(0);
    await page.getByRole('button', { name: /Empezar/ }).click();
    await expect(page.locator('.play-title strong')).toHaveText('Crucigrama');
    await expect(page.locator('.hud-main')).toHaveText('0 / 10');
    await expect(said(page)).toHaveText('Cada palabra es el nombre de la comunidad autónoma que lleva su número en el mapa. Elige una casilla y escribe.');
  });

  test('tells how it is played, and takes no letter while that is being read', async ({ page }) => {
    await start(page, PROVINCES);
    await page.locator('.play-help').click();
    const panel = page.locator('dialog[open]');
    await expect(panel).toContainText('Las pistas están en el mapa: cada palabra tiene un número, y ese número está escrito sobre su pieza.');
    await expect(panel).toContainText('«Dar una letra» escribe la letra de la casilla en la que estás.');
    await page.keyboard.type('po');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    expect(await inHand(page)).toBe('··········');
    // Once it is closed, the keyboard is the game's again.
    await page.keyboard.type('po');
    expect(await inHand(page)).toBe('PO········');
  });

  test('has letters on the screen to write with, for whoever asks for them', async ({ page }) => {
    await start(page, { ...PROVINCES, only: ['ES-C', 'ES-LE'], list: 'Dos' });
    await expect(page.locator('.cw-keys')).toHaveCount(0);
    const toggle = page.getByRole('button', { name: 'Letras en pantalla' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    // The letters as a keyboard lays them, the Ñ among them, and a key that goes back.
    expect((await page.locator('.cw-key:not(.cw-del)').allTextContents()).join('')).toBe('QWERTYUIOPASDFGHJKLÑZXCVBNM');
    const key = (letter: string) => page.locator('.cw-key').filter({ hasText: new RegExp(`^${letter}$`) });
    await piece(page, 'ES-C').click();
    await expect(clue(page)).toContainText('· 8 letras (2 + 6)');
    for (const letter of 'LACORUN') await key(letter).click();
    expect(await inHand(page)).toBe('LACORUN·');
    // A letter too many is taken back with the key for it.
    await page.getByRole('button', { name: 'Borrar' }).click();
    expect(await inHand(page)).toBe('LACORU··');
    await key('Ñ').click();
    await key('A').click();
    await expect(said(page)).toHaveText('¡La Coruña! Queda 1.');
    // They go when they are not wanted, and the keyboard goes on writing.
    await toggle.click();
    await expect(page.locator('.cw-keys')).toHaveCount(0);
    const rest = (await inHand(page)).split('').flatMap((ch, i) => (ch === '·' ? ['LEON'[i]] : []));
    await page.keyboard.type(rest.join(''));
    await expect(page.locator('.verdict-head')).toContainText('¡Crucigrama completo!');
  });

  test('speaks English, where the Ñ is written with the N', async ({ page }) => {
    await seed(page, { lang: 'en', game: { nonce: 1, ...PROVINCES, only: ['ES-C', 'ES-LE'], list: 'Two', opts: OPTS } });
    await page.goto('./#/jugar');
    await expect(page.locator('.play-loading')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('.play-title strong')).toHaveText('Crossword');
    await expect(page.locator('.kicker')).toHaveText('What are they called?');
    await expect(count(page)).toHaveText('Written 0 of 2');
    await expect(said(page)).toHaveText('Each word is the name of the province that carries its number on the map. Choose a cell and write.');
    await expect(grid(page)).toHaveAttribute('aria-label', /^Crossword of \d+ rows and \d+ columns$/);
    await piece(page, 'ES-C').click();
    await expect(clue(page)).toHaveText(/^\d(across|down) · 7 letters \(1 \+ 6\)$/);
    await page.keyboard.type('acorunx');
    await expect(said(page)).toHaveText(/^Word \d is not ACORUNX\. Check its letters\.$/);
    await page.keyboard.press('Backspace');
    await page.getByRole('button', { name: 'Give a letter' }).click();
    await expect(said(page)).toHaveText('A Coruña! 1 to go.');
    await expect(cells(page, 'warn')).toHaveCount(7);
    await page.getByRole('button', { name: 'Letters on the screen' }).click();
    expect((await page.locator('.cw-key:not(.cw-del)').allTextContents()).join('')).toBe('QWERTYUIOPASDFGHJKLZXCVBNM');
    await expect(page.getByRole('button', { name: 'Erase' })).toBeVisible();
    await page.getByRole('button', { name: 'I give up' }).click();
    await expect(page.locator('.verdict-head')).toContainText('1 word was left');
    await expect(page.locator('.verdict')).toContainText('It is written in the crossword, and on the map with its name.');
    await page.getByRole('button', { name: 'See the result' }).click();
    await expect(page.locator('.results-title')).toHaveText('Game over');
    await expect(page.locator('.results-group.g-warn .row-name')).toHaveText(['A Coruñawith letters given, and after writing it wrongly']);
    await expect(page.locator('.results-group.g-bad .row-name')).toHaveText(['Leónnot written']);
    await expect(page.locator('.results-stats')).toContainText('Letters given1');
  });

  test('gives the grid the room of the heading in a short window, and makes room for the letters on a tablet lying down', async ({ page }) => {
    const side = () => page.locator('.cw-cell').first().evaluate((el) => el.getBoundingClientRect().width);
    const still = () => page.locator('.panel').evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
    await page.setViewportSize({ width: 1366, height: 650 });
    await start(page, PROVINCES);
    // No heading over the grid, and one line for what is said: the cells are as large as on a tall screen.
    await expect(page.locator('.kicker')).toHaveCount(0);
    await expect(count(page)).toHaveCount(0);
    await expect(clue(page)).toHaveText('1vertical · 10 letras');
    await expect(said(page)).toHaveText('Cada número es una provincia del mapa.');
    await expect(grid(page)).toBeInViewport({ ratio: 1 });
    expect(await side()).toBeGreaterThanOrEqual(30);
    expect(await still()).toBe(true);
    // The map is beside the crossword, with its numbers; the buttons share a row.
    await expect(piece(page, 'ES-PO')).toBeInViewport();
    await expect(page.locator('.cw-tomap')).toHaveCount(0);
    const tops = await page.locator('.q-actions button').evaluateAll((buttons) => buttons.map((b) => Math.round(b.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);

    // A tablet lying down, with the letters on the screen: the grid gives way to them, and nothing has to be scrolled.
    await page.setViewportSize({ width: 1024, height: 698 });
    await page.getByRole('button', { name: 'Letras en pantalla' }).click();
    await expect(page.locator('.cw-key')).toHaveCount(28);
    await expect(grid(page)).toBeInViewport({ ratio: 1 });
    for (const name of ['Dar una letra', 'Me rindo', 'Terminar', 'Borrar']) await expect(page.getByRole('button', { name, exact: true }), name).toBeInViewport({ ratio: 1 });
    expect(await side()).toBeGreaterThanOrEqual(24);
    expect(await still()).toBe(true);
    expect(await page.locator('.cw-box').evaluate((el) => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await expect(piece(page, 'ES-PO')).toBeInViewport();
    // How the crossword went takes the place of the word in hand once it is over.
    await page.getByRole('button', { name: 'Me rindo' }).click();
    await expect(count(page)).toHaveText('Llevas 0 de 10');
    await expect(page.getByRole('button', { name: 'Ver resultado' })).toBeInViewport({ ratio: 1 });
    await expect(grid(page)).toBeInViewport({ ratio: 1 });
  });

  test('keeps the letters and the buttons on the screen with the largest text, and moves the grid inside its box when it has to', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 600 });
    await seed(page, { textSize: 'xl', game: { nonce: 1, ...PROVINCES, opts: OPTS } });
    await page.goto('./#/jugar');
    await expect(page.locator('.play-loading')).toHaveCount(0, { timeout: 30_000 });
    await expect(grid(page)).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Terminar' })).toBeInViewport({ ratio: 1 });
    expect(await page.locator('.panel').evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    // With the letters too there is no room for cells a finger can hit: the grid stays at that size, in a box that is moved.
    await page.getByRole('button', { name: 'Letras en pantalla' }).click();
    for (const name of ['Dar una letra', 'Me rindo', 'Terminar', 'Borrar']) await expect(page.getByRole('button', { name, exact: true }), name).toBeInViewport({ ratio: 1 });
    expect(await page.locator('.panel').evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    expect(await page.locator('.cw-cell').first().evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(22);
    expect(await page.locator('.cw-box').evaluate((el) => el.scrollHeight > el.clientHeight + 20)).toBe(true);
    // The cell that is written in is brought into sight: the last word lies at the foot of the grid.
    await numbered(page, 1).click();
    await page.keyboard.press('Shift+Enter');
    await expect(clue(page)).toHaveText('10horizontal · 8 letras');
    await expect(page.locator('.cw-cell.at')).toBeInViewport({ ratio: 1 });
    const box = (await page.locator('.cw-box').boundingBox())!;
    const at = (await page.locator('.cw-cell.at').boundingBox())!;
    expect(at.y + at.height).toBeLessThanOrEqual(box.y + box.height + 1);
    await page.keyboard.press('Enter');
    await expect(clue(page)).toHaveText('1vertical · 10 letras');
    const first = (await page.locator('.cw-cell.at').boundingBox())!;
    expect(first.y).toBeGreaterThanOrEqual(box.y - 1);
  });

  test('fits the box of another page', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    // Somebody who has played before: the rules are not shown again before the first crossword.
    await seed(page);
    await page.goto('./es.html#/incrustar/regiones/ES:f/crossword');
    await page.getByRole('button', { name: 'Empezar' }).click();
    // A box plays every name of its map: the fifty-one that fit, in six crosswords or so.
    await expect(page.locator('.hud-main')).toHaveText('0 / 51');
    await expect(said(page)).toHaveText(/^Crucigrama 1 de [67]\. Cada número es una provincia del mapa\.$/);
    await expect(page.locator('.embed-foot')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Dar una letra' })).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.cw-cell.at')).toBeInViewport({ ratio: 1 });
    // With a mouse and a keyboard the letters are not on the screen until they are asked for: the grid has their room.
    await expect(page.locator('.cw-keys')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Letras en pantalla' })).toBeVisible();
    await expect(grid(page)).toBeInViewport({ ratio: 1 });
    expect(await page.locator('.cw-cell').first().evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(30);
    // The box is narrow: the map takes turns with the crossword, as on a phone.
    await page.getByRole('button', { name: 'Ver el mapa' }).click();
    await expect(page.locator('.stage')).toBeVisible();
    expect((await tags(page)).length).toBeGreaterThanOrEqual(8);
    await page.getByRole('button', { name: 'Volver al crucigrama' }).click();
    await expect(page.locator('.cw-cell.at')).toBeInViewport({ ratio: 1 });
  });
});

test.describe('crossword on a phone @movil', () => {
  test('gives the grid and the letters to write with the whole screen, and the map takes turns with them', async ({ page }) => {
    await start(page, PROVINCES);
    const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(await fits()).toBe(true);
    // No heading over the grid: the word in hand and the button of the map share a line.
    await expect(page.locator('.kicker')).toHaveCount(0);
    await expect(clue(page)).toHaveText('1vertical · 10 letras');
    // What the numbers are, in one line: the room is for the grid.
    await expect(said(page)).toHaveText('Cada número es una provincia del mapa.');
    expect(await said(page).evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(26);
    const toMap = page.getByRole('button', { name: 'Ver el mapa' });
    await expect(toMap).toBeInViewport({ ratio: 1 });
    // The letters are there without being asked for, at the foot of the screen, with keys a finger can hit.
    await expect(page.locator('.cw-key')).toHaveCount(28);
    await expect(page.locator('.cw-kb')).toHaveCount(0);
    const key = (letter: string) => page.locator('.cw-key').filter({ hasText: new RegExp(`^${letter}$`) });
    for (const letter of ['Q', 'Ñ', 'M']) await expect(key(letter)).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Borrar' })).toBeInViewport({ ratio: 1 });
    const sizes = await page.locator('.cw-key').evaluateAll((keys) => keys.map((k) => k.getBoundingClientRect()).map((r) => [Math.round(r.width), Math.round(r.height)]));
    for (const [w, h] of sizes) {
      expect(w).toBeGreaterThanOrEqual(28);
      expect(h).toBeGreaterThanOrEqual(36);
    }
    // No cell under 22 pixels, and the one that is written in is in sight.
    const side = await page.locator('.cw-cell').first().evaluate((el) => Math.round(el.getBoundingClientRect().width));
    expect(side).toBeGreaterThanOrEqual(22);
    await expect(page.locator('.cw-cell.at')).toBeInViewport({ ratio: 1 });
    // The map is out of sight, a button away.
    await expect(page.locator('.stage')).toBeHidden();

    for (const letter of 'PONTEVEDRA') await key(letter).tap();
    await expect(said(page)).toHaveText('¡Pontevedra! Quedan 9.');
    await expect(said(page)).toBeInViewport();
    await expect(cells(page, 'ok')).toHaveCount(10);
    // A cell is taken with a finger, and the key that goes back takes a letter out.
    await numbered(page, 2).tap();
    await expect(clue(page)).toHaveText('2horizontal · 7 letras');
    for (const letter of 'VIX') await key(letter).tap();
    await page.getByRole('button', { name: 'Borrar' }).tap();
    expect(await inHand(page)).toBe('VI·····');

    await toMap.tap();
    await expect(page.locator('.stage')).toBeVisible();
    await expect(page.locator('.panel')).toBeHidden();
    const back = page.getByRole('button', { name: 'Volver al crucigrama' });
    await expect(back).toBeFocused();
    // The ten pieces of the crossword are in sight: nine with their numbers, and the one that is written with its name.
    for (const id of IDS) await expect(piece(page, id), id).toBeInViewport();
    expect(await tags(page)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(await named(page)).toEqual(['Pontevedra']);
    expect(await painted(page, 'target')).toEqual(['ES-BI']);
    // A piece that is touched is the word to write when the crossword comes back.
    await piece(page, 'ES-Z').tap();
    expect(await painted(page, 'target')).toEqual(['ES-Z']);
    await back.tap();
    await expect(page.locator('.stage')).toBeHidden();
    await expect(toMap).toBeFocused();
    await expect(clue(page)).toHaveText('3vertical · 8 letras');
    await expect(page.locator('.cw-cell.at')).toBeInViewport({ ratio: 1 });

    // The buttons share a row; the map is still a button away once the crossword is given up.
    const tops = await page.locator('.q-actions button').evaluateAll((buttons) => buttons.map((b) => Math.round(b.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    await page.getByRole('button', { name: 'Me rindo' }).tap();
    await expect(page.locator('.verdict')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver resultado' })).toBeInViewport();
    await expect(page.locator('.cw-keys')).toHaveCount(0);
    await expect(count(page)).toHaveText('Llevas 1 de 10');
    await toMap.tap();
    expect(await named(page)).toHaveLength(10);
    await page.getByRole('button', { name: 'Volver al crucigrama' }).tap();
    await page.getByRole('button', { name: 'Ver resultado' }).tap();
    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('.stage')).toBeVisible();
    expect(await fits()).toBe(true);
  });

  test('lays the grid beside the rest on a phone lying down', async ({ page }) => {
    await page.setViewportSize({ width: 740, height: 360 });
    await start(page, PROVINCES);
    await expect(grid(page)).toBeInViewport({ ratio: 1 });
    for (const name of ['Ver el mapa', 'Dar una letra', 'Me rindo', 'Terminar', 'Borrar']) await expect(page.getByRole('button', { name, exact: true }), name).toBeInViewport({ ratio: 1 });
    await expect(clue(page)).toBeInViewport({ ratio: 1 });
    // The grid on the left, and what goes with it on its right.
    const box = (await grid(page).boundingBox())!;
    const line = (await clue(page).boundingBox())!;
    const keys = (await page.locator('.cw-keys').boundingBox())!;
    expect(line.x).toBeGreaterThan(box.x + box.width);
    expect(keys.x).toBeGreaterThan(box.x + box.width);
    expect(await page.locator('.panel').evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const letter of 'PONTEVEDRA') await page.locator('.cw-key').filter({ hasText: new RegExp(`^${letter}$`) }).tap();
    await expect(said(page)).toHaveText('¡Pontevedra! Quedan 9.');
  });
});
