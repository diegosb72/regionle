/**
 * «Sopa de letras»: the map lights up some pieces and their names are hidden in a square of letters. A name is
 * marked from its first letter to its last, by dragging, by pressing one and then the other, or with the
 * keyboard; the list of names is given when it is asked for, and what is found afterwards is found with help.
 */
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, restart, seed, start } from './helpers';

/**
 * The provinces of Spain: with this game the ten names of the square are those of Asturias, Cáceres, Huelva,
 * Jaén, León, Málaga, Melilla, Orense, Vizcaya and Zaragoza.
 */
const PROVINCES = { section: 'regions', countries: ['ES'], levels: { ES: 'f' }, mode: 'wordsearch' };
const TEN = ['ASTURIAS', 'CACERES', 'HUELVA', 'JAEN', 'LEON', 'MALAGA', 'MELILLA', 'ORENSE', 'VIZCAYA', 'ZARAGOZA'];
const TEN_IDS = ['ES-BI', 'ES-CC', 'ES-H', 'ES-J', 'ES-LE', 'ES-MA', 'ES-ML', 'ES-O', 'ES-OR', 'ES-Z'];

interface Cell {
  r: number;
  c: number;
}

const kept = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { sessions: { mode: string; label: string; total: number; ok: number; warn: number; bad: number }[]; stats?: Record<string, unknown> });
const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`).first();
/** The pieces of the map that are painted one way, by what they are. */
const painted = (page: Page, how: string): Promise<string[]> =>
  page.locator(`.map-svg .st-${how}`).evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute('data-id') ?? ''))].filter(Boolean).sort());
const grid = (page: Page) => page.locator('.ws-grid');
const cell = (page: Page, at: Cell) => page.locator(`.ws-cell[data-r="${at.r}"][data-c="${at.c}"]`);
const said = (page: Page) => page.locator('.ws-said');
const count = (page: Page) => page.locator('.ws-count');
const bars = (page: Page, kind: string) => page.locator(`.ws-bar.${kind}`);
const names = (page: Page) => page.locator('.ws-name');

/** The letters of the square, row by row. */
const letters = (page: Page): Promise<string[][]> =>
  grid(page).evaluate((el) => [...el.querySelectorAll('.ws-row')].map((row) => [...row.querySelectorAll('.ws-cell')].map((c) => (c.textContent ?? '').trim())));

/** Where a name is written in the square, from its first letter to its last: it is there once, and never backwards. */
async function where(page: Page, word: string): Promise<[Cell, Cell]> {
  const rows = await letters(page);
  const hits: [Cell, Cell][] = [];
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < rows.length; c++)
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
        [1, 1],
        [-1, 1],
      ]) {
        let ok = true;
        for (let i = 0; i < word.length && ok; i++) ok = rows[r + dr * i]?.[c + dc * i] === word[i];
        if (ok) hits.push([{ r, c }, { r: r + dr * (word.length - 1), c: c + dc * (word.length - 1) }]);
      }
  expect(hits, word).toHaveLength(1);
  return hits[0];
}

async function middle(page: Page, at: Cell): Promise<[number, number]> {
  const box = (await cell(page, at).boundingBox())!;
  return [box.x + box.width / 2, box.y + box.height / 2];
}

/** A mark drawn with the mouse from one cell to another. */
async function drag(page: Page, from: Cell, to: Cell): Promise<void> {
  const [x0, y0] = await middle(page, from);
  const [x1, y1] = await middle(page, to);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 3 });
  await page.mouse.move(x1, y1, { steps: 3 });
  await page.mouse.up();
}

/** A name of the square, marked from its first letter to its last. */
async function find(page: Page, word: string): Promise<void> {
  const [from, to] = await where(page, word);
  await drag(page, from, to);
}

/** The keyboard cursor taken from one cell to another, a step at a time. */
async function walk(page: Page, from: Cell, to: Cell): Promise<void> {
  for (let i = 0; i < Math.abs(to.r - from.r); i++) await page.keyboard.press(to.r > from.r ? 'ArrowDown' : 'ArrowUp');
  for (let i = 0; i < Math.abs(to.c - from.c); i++) await page.keyboard.press(to.c > from.c ? 'ArrowRight' : 'ArrowLeft');
}

test.describe('word search', () => {
  test('hides the names of the pieces the map lights up, and takes each one that is marked from end to end', async ({ page }) => {
    await start(page, PROVINCES);
    await expect(page.locator('.play-title strong')).toHaveText('Sopa de letras');
    await expect(page.locator('.play-title span')).toHaveText('España · provincias');
    await expect(page.locator('.hud-main')).toHaveText('0 / 10');
    await expect(page.locator('.kicker')).toHaveText('¿Cómo se llaman?');
    await expect(count(page)).toHaveText('Llevas 0 de 10');
    await expect(said(page)).toHaveText('Busca los nombres de las 10 provincias iluminadas en el mapa. Arrastra de la primera letra a la última.');
    await expect(grid(page)).toHaveAttribute('aria-label', 'Sopa de letras de 12 por 12');
    await expect(page.locator('.ws-cell')).toHaveCount(144);
    // Capital letters and nothing else: no accents, and no spaces.
    expect((await letters(page)).flat().join('')).toMatch(/^[A-ZÑ]{144}$/);
    // Every name is written once, and none of them backwards.
    for (const word of TEN) {
      await where(page, word);
      const back = [...word].reverse().join('');
      const rows = await letters(page);
      expect(rows.map((row) => row.join('')).join(' '), word).not.toContain(back);
    }
    // The map lights the ten pieces and names none of them, whatever the pointer rests on.
    expect(await painted(page, 'to')).toEqual(TEN_IDS);
    await expect(page.locator('.map-svg .m-lbl')).toHaveCount(0);
    await piece(page, 'ES-LE').hover();
    await expect(page.locator('.map-tip')).toHaveText('');
    await expect(names(page)).toHaveCount(0);

    await find(page, 'LEON');
    await expect(said(page)).toHaveText('¡León! Quedan 9.');
    await expect(count(page)).toHaveText('Llevas 1 de 10');
    await expect(page.locator('.hud-main')).toHaveText('1 / 10');
    await expect(bars(page, 'ok')).toHaveCount(1);
    // The piece is painted as found, and its name is written on it: that is where the name belongs.
    await expect(piece(page, 'ES-LE')).toHaveClass(/st-ok/);
    await expect(page.locator('.map-svg .m-lbl')).toHaveText(['León']);
    expect(await painted(page, 'to')).toEqual(TEN_IDS.filter((id) => id !== 'ES-LE'));
    await expect(names(page)).toHaveText(['León (encontrado)']);
    await expect(names(page).first()).toHaveClass(/ok/);

    // A name can be marked from either end.
    const [first, last] = await where(page, 'JAEN');
    await drag(page, last, first);
    await expect(said(page)).toHaveText('¡Jaén! Quedan 8.');
    await expect(bars(page, 'ok')).toHaveCount(2);
    // One that was found is not found twice.
    await find(page, 'LEON');
    await expect(said(page)).toHaveText('León: ese ya lo tenías.');
    await expect(count(page)).toHaveText('Llevas 2 de 10');

    // A mark where there is no name says what it spelled, and takes nothing off.
    const spelt = (await letters(page))[0].slice(0, 4).join('');
    expect(TEN, 'the first letters of the square').not.toContain(spelt);
    await drag(page, { r: 0, c: 0 }, { r: 0, c: 3 });
    await expect(said(page)).toHaveText(`«${spelt}» no es ninguno de los nombres.`);
    await expect(said(page)).toHaveClass(/ws-no/);
    await expect(count(page)).toHaveText('Llevas 2 de 10');
    await expect(page.locator('.hud-main')).toHaveText('2 / 10');
    await expect(bars(page, 'ok')).toHaveCount(2);
    await expect(page.locator('.hud-streak')).toHaveCount(0);
  });

  test('takes a name by its two ends, pressed one after the other', async ({ page }) => {
    await start(page, PROVINCES);
    const [first, last] = await where(page, 'HUELVA');
    await cell(page, first).click();
    await expect(said(page)).toHaveText('Primera letra: H. Marca ahora la última.');
    await expect(bars(page, 'anchor')).toHaveCount(1);
    await expect(cell(page, first)).toHaveAttribute('aria-selected', 'true');
    await cell(page, last).click();
    await expect(said(page)).toHaveText('¡Huelva! Quedan 9.');
    await expect(bars(page, 'anchor')).toHaveCount(0);
    await expect(bars(page, 'ok')).toHaveCount(1);

    // The same cell pressed twice is a mark taken back.
    await cell(page, { r: 0, c: 0 }).click();
    await expect(bars(page, 'anchor')).toHaveCount(1);
    await cell(page, { r: 0, c: 0 }).click();
    await expect(said(page)).toHaveText('Marca anulada.');
    await expect(bars(page, 'anchor')).toHaveCount(0);

    // Two cells that are not in line are no mark: the second one starts another.
    const rows = await letters(page);
    await cell(page, { r: 0, c: 0 }).click();
    await cell(page, { r: 1, c: 3 }).click();
    await expect(said(page)).toHaveText(`Esas dos letras no están en línea. Primera letra: ${rows[1][3]}.`);
    await expect(said(page)).toHaveClass(/ws-no/);
    await expect(bars(page, 'anchor')).toHaveCount(1);
    await expect(cell(page, { r: 1, c: 3 })).toHaveAttribute('aria-selected', 'true');
    await expect(count(page)).toHaveText('Llevas 1 de 10');
  });

  test('is played with the keyboard: the arrows go through the letters and Enter marks the two ends of a name', async ({ page }) => {
    await start(page, PROVINCES);
    // One cell of the square is in the order of the Tab key: the first one, until the arrows move from it.
    await expect(page.locator('.ws-cell[tabindex="0"]')).toHaveCount(1);
    await cell(page, { r: 0, c: 0 }).focus();
    const [first, last] = await where(page, 'LEON');
    await walk(page, { r: 0, c: 0 }, first);
    await expect(cell(page, first)).toBeFocused();
    await expect(cell(page, first)).toHaveAttribute('tabindex', '0');
    await expect(page.locator('.ws-cell[tabindex="0"]')).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(said(page)).toHaveText('Primera letra: L. Marca ahora la última.');
    await walk(page, first, last);
    await page.keyboard.press('Enter');
    await expect(said(page)).toHaveText('¡León! Quedan 9.');
    await expect(bars(page, 'ok')).toHaveCount(1);
    // The cursor stays where the name ended, ready for the next one.
    await expect(cell(page, last)).toBeFocused();

    // Esc takes back a first letter; Home and End go to the ends of the row; the edges stop the arrows.
    await page.keyboard.press('Space');
    await expect(bars(page, 'anchor')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(said(page)).toHaveText('Marca anulada.');
    await expect(bars(page, 'anchor')).toHaveCount(0);
    await page.keyboard.press('Home');
    await expect(cell(page, { r: last.r, c: 0 })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(cell(page, { r: last.r, c: 0 })).toBeFocused();
    await page.keyboard.press('End');
    await expect(cell(page, { r: last.r, c: 11 })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(cell(page, { r: last.r, c: 11 })).toBeFocused();
    await expect(count(page)).toHaveText('Llevas 1 de 10');
  });

  test('gives the list of names when it is asked for, and what is found from then on is found with help', async ({ page }) => {
    await start(page, PROVINCES);
    await find(page, 'LEON');
    const list = page.getByRole('button', { name: 'Ver los nombres' });
    await list.click();
    await expect(said(page)).toHaveText('Ahí tienes los nombres. Los que encuentres desde ahora cuentan como «con ayuda».');
    await expect(list).toBeDisabled();
    // The ten names by the alphabet, and the one that was found before the list keeps its mark.
    await expect(names(page)).toHaveText(['Asturias', 'Cáceres', 'Huelva', 'Jaén', 'León (encontrado)', 'Málaga', 'Melilla', 'Orense', 'Vizcaya', 'Zaragoza']);
    await expect(page.locator('.ws-names')).toHaveAttribute('aria-label', 'Los nombres de esta sopa');
    // The map goes on naming only what has been found.
    await expect(page.locator('.map-svg .m-lbl')).toHaveText(['León']);

    await find(page, 'ZARAGOZA');
    await expect(said(page)).toHaveText('¡Zaragoza! Quedan 8.');
    await expect(bars(page, 'ok')).toHaveCount(1);
    await expect(bars(page, 'warn')).toHaveCount(1);
    await expect(piece(page, 'ES-Z')).toHaveClass(/st-warn/);
    await expect(piece(page, 'ES-LE')).toHaveClass(/st-ok/);
    await expect(names(page).filter({ hasText: 'Zaragoza' })).toHaveClass(/warn/);
    await expect(names(page).filter({ hasText: 'Zaragoza' })).toHaveText('Zaragoza (encontrado con la lista)');

    // Given up: the names that were left show where they were, with a dashed line, and the map names them.
    await page.getByRole('button', { name: 'Me rindo' }).click();
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.verdict-head')).toContainText('Te han faltado 8 nombres');
    await expect(page.locator('.verdict')).toContainText('Están en la sopa con línea discontinua, y en el mapa con su nombre.');
    await expect(bars(page, 'bad')).toHaveCount(8);
    await expect(grid(page)).toHaveClass(/over/);
    await expect(page.locator('.hud-main')).toHaveText('10 / 10');
    expect(await painted(page, 'bad')).toEqual(TEN_IDS.filter((id) => id !== 'ES-LE' && id !== 'ES-Z'));
    expect(await painted(page, 'to')).toEqual([]);
    await expect(page.locator('.map-svg .m-lbl')).toHaveCount(10);
    await expect(names(page).filter({ hasText: 'Huelva' })).toHaveText('Huelva (sin encontrar)');
    // A square that is over takes no more marks.
    await find(page, 'HUELVA');
    await expect(bars(page, 'ok')).toHaveCount(1);
    await expect(page.locator('.verdict-head')).toContainText('Te han faltado 8 nombres');

    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('.results-note')).toHaveText('A la primera: el nombre encontrado solo con el mapa. Con ayuda: con la lista de nombres a la vista. Marcar donde no hay nada no resta.');
    // A name found with the map alone needs no note: its row says what the piece belongs to, as in every game.
    await expect(page.locator('.results-group.g-ok .row-name')).toHaveText(['LeónCastilla y León']);
    await expect(page.locator('.results-group.g-warn .row-name')).toHaveText(['Zaragozacon la lista de nombres']);
    await expect(page.locator('.results-group.g-bad .row-name')).toHaveCount(8);
    await expect(page.locator('.results-group.g-bad .row-name').first()).toContainText('sin encontrar');
    // One square: nothing to say of how many there were.
    await expect(page.locator('.results-stats')).not.toContainText('Sopas');
    const state = await kept(page);
    expect(state.sessions.at(-1)).toMatchObject({ mode: 'wordsearch', label: 'España · provincias', total: 10, ok: 1, warn: 1, bad: 8 });
    // Nothing goes into the review: a name found among letters says little of what is known of the piece.
    expect(Object.keys(state.stats ?? {})).toHaveLength(0);
    // And it is no homework: a square is not a question after another.
    await expect(page.getByRole('button', { name: 'Poner de tarea' })).toHaveCount(0);
  });

  test('ends a square when its last name is found, and a game of twenty names is two squares', async ({ page }) => {
    await start(page, { ...PROVINCES, opts: { length: 20 } });
    await expect(page.locator('.kicker')).toHaveText('Sopa 1 de 2');
    await expect(page.locator('.hud-main')).toHaveText('0 / 20');
    await expect(count(page)).toHaveText('Llevas 0 de 10');
    const firstTen = await painted(page, 'to');
    expect(firstTen).toHaveLength(10);
    for (const word of TEN) await find(page, word);
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.verdict-head')).toContainText('¡Sopa completa!');
    await expect(page.locator('.verdict')).toContainText('Los 10, solo con el mapa.');
    await expect(page.locator('.hud-main')).toHaveText('10 / 20');
    await expect(bars(page, 'ok')).toHaveCount(10);
    const next = page.getByRole('button', { name: 'Siguiente sopa' });
    await expect(next).toBeFocused();
    await next.click();

    // Another square, with ten other names; the first cell has the focus the button had.
    await expect(page.locator('.kicker')).toHaveText('Sopa 2 de 2');
    await expect(count(page)).toHaveText('Llevas 0 de 10');
    await expect(bars(page, 'ok')).toHaveCount(0);
    await expect(cell(page, { r: 0, c: 0 })).toBeFocused();
    await expect(said(page)).toContainText('Busca los nombres de las 10 provincias iluminadas en el mapa.');
    const secondTen = await painted(page, 'to');
    expect(secondTen).toHaveLength(10);
    expect(secondTen.filter((id) => firstTen.includes(id))).toEqual([]);
    // What the first square found stays painted on the map; its names give way to those of this one.
    expect(await painted(page, 'ok')).toEqual(firstTen);
    await expect(page.locator('.map-svg .m-lbl')).toHaveCount(0);
    // The list of names is asked for in each square.
    await expect(page.getByRole('button', { name: 'Ver los nombres' })).toBeEnabled();

    // Left half way: what was found counts, and the square in hand is not held against the player.
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('.results-stats')).toContainText('Sopas2 de 2');
    await expect(page.locator('.results-group.g-ok .row-name')).toHaveCount(10);
    expect((await kept(page)).sessions.at(-1)).toMatchObject({ mode: 'wordsearch', total: 10, ok: 10, warn: 0, bad: 0 });
  });

  test('says so when every name of the game was found with the map alone', async ({ page }) => {
    await start(page, { ...PROVINCES, only: ['ES-LE', 'ES-J'], list: 'Dos' });
    await expect(page.locator('.play-title span')).toHaveText('España · provincias · Dos');
    await expect(count(page)).toHaveText('Llevas 0 de 2');
    await expect(said(page)).toHaveText('Busca los nombres de las 2 provincias iluminadas en el mapa. Arrastra de la primera letra a la última.');
    expect(await painted(page, 'to')).toEqual(['ES-J', 'ES-LE']);
    await find(page, 'JAEN');
    await expect(said(page)).toHaveText('¡Jaén! Queda 1.');
    await find(page, 'LEON');
    await expect(page.locator('.verdict-head')).toContainText('¡Sopa completa!');
    await expect(page.locator('.verdict')).toContainText('Los 2, solo con el mapa.');
    // Enter goes on, as in every game.
    await expect(page.getByRole('button', { name: 'Ver resultado' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.results-title')).toHaveText('¡Todos, y sin mirar la lista!');
    await expect(page.locator('.results-group.g-ok .row-name')).toHaveText(['JaénAndalucía', 'LeónCastilla y León']);
    expect((await kept(page)).sessions.at(-1)).toMatchObject({ mode: 'wordsearch', label: 'España · provincias · Dos', total: 2, ok: 2, warn: 0, bad: 0 });
  });

  test('leaves out the names that do not fit the square, and says which', async ({ page }) => {
    // Bavaria and Berlin fit; the thirty letters of Mecklenburg-Western Pomerania do not.
    await start(page, { section: 'regions', countries: ['DE'], mode: 'wordsearch', only: ['DE-MV', 'DE-BY', 'DE-BE'], list: 'Tres' });
    await expect(page.locator('.hud-main')).toHaveText('0 / 2');
    expect(await painted(page, 'to')).toEqual(['DE-BE', 'DE-BY']);
    await find(page, 'BAVIERA');
    await find(page, 'BERLIN');
    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(page.locator('.results-note')).toContainText('No cabe en la sopa y se queda fuera: Mecklemburgo-Pomerania Occidental. Entran los nombres de 3 a 12 letras.');
    await expect(page.locator('.results-group.g-ok .row-name')).toHaveText(['Baviera', 'Berlín']);
  });

  test('says which names were left out when a game of so many names came out shorter', async ({ page }) => {
    // Germany has sixteen states, and the names of ten of them fit: a game of twenty is those ten.
    await start(page, { section: 'regions', countries: ['DE'], mode: 'wordsearch', opts: { length: 20 } });
    await expect(page.locator('.hud-main')).toHaveText('0 / 10');
    await expect(page.locator('.kicker')).toHaveText('¿Cómo se llaman?');
    await page.getByRole('button', { name: 'Me rindo' }).click();
    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(page.locator('.results-note')).toContainText('No caben en la sopa y se quedan fuera: Baden-Wurtemberg, Mecklemburgo-Pomerania Occidental, Renania del Norte-Westfalia y 3 más.');
    // A game of ten of them is whole: nothing was left out of it.
    await restart(page, { section: 'regions', countries: ['DE'], mode: 'wordsearch' });
    await expect(page.locator('.hud-main')).toHaveText('0 / 10');
    await page.getByRole('button', { name: 'Me rindo' }).click();
    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(page.locator('.results-note')).not.toContainText('se quedan fuera');
  });

  test('has nothing to play with when no name fits, and says why', async ({ page }) => {
    await start(page, { section: 'regions', countries: ['DE'], mode: 'wordsearch', only: ['DE-MV'], list: 'Larga' });
    await expect(page.locator('.results-title')).toHaveText('Sin nombres');
    await expect(page.locator('.results-note')).toHaveText('En este mapa no hay ningún nombre que quepa en la sopa: entran los de 3 a 12 letras.');
    await expect(grid(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Otra vez' })).toHaveCount(0);
    expect((await kept(page)).sessions ?? []).toHaveLength(0);
  });

  test('is left before any name is found: a game that is over, with nothing in it to keep', async ({ page }) => {
    await start(page, PROVINCES);
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('.results-note')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Otra vez' })).toBeVisible();
    expect((await kept(page)).sessions ?? []).toHaveLength(0);
  });

  test('is played with the countries of a list, whose names of two words are written as one', async ({ page }) => {
    await start(page, { section: 'countries', mode: 'wordsearch', countries: ['ES', 'PT', 'FR', 'IT', 'CI', 'GW'], only: ['GW', 'FR'] });
    await expect(said(page)).toHaveText('Busca los nombres de los 2 países iluminados en el mapa. Arrastra de la primera letra a la última.');
    await find(page, 'GUINEABISAU');
    await expect(said(page)).toHaveText('¡Guinea-Bisáu! Queda 1.');
    await expect(piece(page, 'GW')).toHaveClass(/st-ok/);
    await find(page, 'FRANCIA');
    await expect(page.locator('.verdict-head')).toContainText('¡Sopa completa!');
  });

  test('is played with the cities of a country', async ({ page }) => {
    await start(page, { section: 'cities', mode: 'wordsearch', countries: ['ES'], opts: { cityPick: 'top', cityCount: 10 } });
    await expect(count(page)).toHaveText('Llevas 0 de 10');
    await expect(said(page)).toHaveText('Busca los nombres de las 10 ciudades iluminadas en el mapa. Arrastra de la primera letra a la última.');
    expect(await painted(page, 'to')).toHaveLength(10);
    await find(page, 'MADRID');
    await expect(said(page)).toHaveText('¡Madrid! Quedan 9.');
    await expect(page.locator('.map-svg .m-lbl')).toHaveText(['Madrid']);
  });

  test('is played with what a physical map has', async ({ page }) => {
    await start(page, { section: 'physical', mode: 'wordsearch', countries: ['river', 'in:ES'], only: ['r:ebro', 'r:tagus'] });
    await expect(said(page)).toHaveText('Busca los nombres de los 2 ríos iluminados en el mapa. Arrastra de la primera letra a la última.');
    await find(page, 'EBRO');
    await expect(said(page)).toHaveText('¡Ebro! Queda 1.');
    await expect(piece(page, 'r:ebro')).toHaveClass(/st-ok/);
    await find(page, 'TAJO');
    await expect(page.locator('.verdict-head')).toContainText('¡Sopa completa!');
  });

  test('is offered among the word games of every section with a map, and says how long a game is', async ({ page }) => {
    await seed(page);
    for (const route of ['/paises', '/ciudades', '/fisica', '/regiones']) {
      await open(page, route);
      const words = page.getByRole('group', { name: 'Juegos de palabras' });
      await expect(words.getByRole('button'), route).toHaveText([/^Ahorcado/, /^Sopa de letras/, /^Crucigrama/]);
      await words.getByRole('button', { name: /^Sopa de letras/ }).click();
      await expect(page.locator('.mode-about'), route).toContainText('El mapa ilumina unas piezas y sus nombres están escondidos en una sopa de letras');
    }
    await open(page, '/cifras');
    await expect(page.getByRole('button', { name: /^Sopa de letras/ })).toHaveCount(0);

    await open(page, '/regiones');
    await page.getByRole('button', { name: /^Sopa de letras/ }).click();
    // As many names as are asked for, and never without end.
    await expect(page.getByRole('radiogroup', { name: 'Preguntas' }).getByRole('radio')).toHaveText(['Todo', '10', '20', '50']);
    // A whole map may have names that do not fit the square: «up to» as many as it has.
    await page.getByRole('radiogroup', { name: 'Preguntas' }).getByRole('radio', { name: 'Todo' }).click();
    await expect(page.locator('.mode-facts')).toContainText('hasta 19 nombres');
    await page.getByRole('radiogroup', { name: 'Preguntas' }).getByRole('radio', { name: '10' }).click();
    await expect(page.locator('.mode-facts')).toContainText('10 nombres');
    await expect(page.locator('.mode-facts')).not.toContainText('hasta');
    // No clock, no lives and no exam: they belong to the games that ask one thing after another.
    await expect(page.getByRole('radiogroup', { name: 'Formato' })).toHaveCount(0);
    await page.getByRole('button', { name: /Empezar/ }).click();
    await expect(page.locator('.play-title strong')).toHaveText('Sopa de letras');
    await expect(page.locator('.hud-main')).toHaveText('0 / 10');
    await expect(said(page)).toHaveText('Busca los nombres de las 10 comunidades autónomas iluminadas en el mapa. Arrastra de la primera letra a la última.');
  });

  test('tells how it is played, and lists its keys among the shortcuts', async ({ page }) => {
    await start(page, PROVINCES);
    await page.locator('.play-help').click();
    const panel = page.locator('dialog[open]');
    await expect(panel).toContainText('El mapa ilumina las piezas cuyos nombres están escondidos entre las letras');
    await expect(panel).toContainText('nunca al revés');
    await expect(panel).toContainText('«Ver los nombres» enseña la lista de lo que hay que buscar.');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(count(page)).toHaveText('Llevas 0 de 10');
  });

  test('speaks English, with the names as English writes them', async ({ page }) => {
    await seed(page, { lang: 'en', game: { nonce: 1, ...PROVINCES, opts: OPTS } });
    await page.goto('./#/jugar');
    await expect(page.locator('.play-loading')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('.play-title strong')).toHaveText('Word search');
    await expect(page.locator('.kicker')).toHaveText('What are they called?');
    await expect(count(page)).toHaveText('Found 0 of 10');
    await expect(said(page)).toHaveText('Find the names of the 10 provinces lit up on the map. Drag from the first letter to the last.');
    await expect(grid(page)).toHaveAttribute('aria-label', 'Word search grid, 12 by 12');
    // The same ten provinces, by the names they have in English.
    await find(page, 'BISCAY');
    await expect(said(page)).toHaveText('Biscay! 9 to go.');
    const rows = await letters(page);
    await cell(page, { r: 0, c: 0 }).click();
    await cell(page, { r: 1, c: 3 }).click();
    await expect(said(page)).toHaveText(`Those two letters are not in line. First letter: ${rows[1][3]}.`);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Show the names' }).click();
    await expect(said(page)).toHaveText('There are the names. The ones you find from now on count as “with help”.');
    await expect(names(page)).toContainText(['Asturias', 'Biscay', 'Cáceres']);
    await find(page, 'OURENSE');
    await expect(bars(page, 'warn')).toHaveCount(1);
    await page.getByRole('button', { name: 'I give up' }).click();
    await expect(page.locator('.verdict-head')).toContainText('8 names were left');
    await expect(page.locator('.verdict')).toContainText('They are in the grid with a dashed line, and on the map with their names.');
    await page.getByRole('button', { name: 'See the result' }).click();
    await expect(page.locator('.results-title')).toHaveText('Game over');
    await expect(page.locator('.results-group.g-warn .row-name')).toHaveText(['Ourensewith the list of names']);
  });

  test('fits the box of another page, with the line that goes under it', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    // Somebody who has played before: the rules are not shown again before the first square.
    await seed(page);
    await page.goto('./es.html#/incrustar/regiones/ES:f/wordsearch');
    await page.getByRole('button', { name: 'Empezar' }).click();
    // A box plays every name of its map: fifty that fit, in five squares.
    await expect(page.locator('.kicker')).toHaveText('Sopa 1 de 5');
    await expect(page.locator('.hud-main')).toHaveText('0 / 50');
    await expect(grid(page)).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.embed-foot')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Ver los nombres' })).toBeInViewport({ ratio: 1 });
    expect(await page.locator('.panel').evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    // The box is narrow: the map takes turns with the square, as on a phone.
    await page.getByRole('button', { name: 'Ver el mapa' }).click();
    await expect(page.locator('.stage')).toBeVisible();
    expect(await painted(page, 'to')).toHaveLength(10);
    await page.getByRole('button', { name: 'Volver a la sopa' }).click();
    await expect(grid(page)).toBeInViewport({ ratio: 1 });
  });

  test('fits a short window: the square is no taller than the screen leaves room for', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 600 });
    await start(page, PROVINCES);
    await expect(grid(page)).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Ver los nombres' })).toBeInViewport({ ratio: 1 });
    // The three buttons share a row, and the map is beside the square.
    const tops = await page.locator('.q-actions button').evaluateAll((buttons) => buttons.map((b) => Math.round(b.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    await expect(piece(page, 'ES-LE')).toBeInViewport();
    await expect(page.locator('.ws-tomap')).toHaveCount(0);
  });
});

test.describe('word search on a phone @movil', () => {
  test('gives the square the whole screen, and the map takes turns with it', async ({ page }) => {
    await start(page, PROVINCES);
    const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(await fits()).toBe(true);
    await expect(grid(page)).toBeInViewport({ ratio: 1 });
    await expect(said(page)).toBeInViewport();
    // Letters a finger can hit: no cell under 24 pixels.
    const size = await cell(page, { r: 0, c: 0 }).evaluate((el) => Math.round(el.getBoundingClientRect().width));
    expect(size).toBeGreaterThanOrEqual(24);
    // A finger on the letters marks them: it does not move the page.
    expect(await grid(page).evaluate((el) => getComputedStyle(el).touchAction)).toBe('none');
    // The map is out of sight, a button away.
    await expect(page.locator('.stage')).toBeHidden();
    const toMap = page.getByRole('button', { name: 'Ver el mapa' });
    await expect(toMap).toBeInViewport({ ratio: 1 });

    // A name by its two ends, with a finger.
    const [first, last] = await where(page, 'LEON');
    await cell(page, first).tap();
    await expect(said(page)).toHaveText('Primera letra: L. Marca ahora la última.');
    await cell(page, last).tap();
    await expect(said(page)).toHaveText('¡León! Quedan 9.');
    await expect(bars(page, 'ok')).toHaveCount(1);
    // And one dragged over.
    await find(page, 'JAEN');
    await expect(said(page)).toHaveText('¡Jaén! Quedan 8.');
    await expect(said(page)).toBeInViewport();

    await toMap.tap();
    await expect(page.locator('.stage')).toBeVisible();
    await expect(page.locator('.panel')).toBeHidden();
    const back = page.getByRole('button', { name: 'Volver a la sopa' });
    await expect(back).toBeFocused();
    // The ten pieces of the square are in sight, with the names of the two that were found.
    for (const id of TEN_IDS) await expect(piece(page, id), id).toBeInViewport();
    await expect(page.locator('.map-svg .m-lbl')).toHaveText(['Jaén', 'León']);
    expect(await painted(page, 'to')).toHaveLength(8);
    await back.tap();
    await expect(page.locator('.stage')).toBeHidden();
    await expect(grid(page)).toBeInViewport({ ratio: 1 });
    await expect(toMap).toBeFocused();
    await expect(count(page)).toHaveText('Llevas 2 de 10');

    // The three buttons share a row; the map is still a button away once the square is given up.
    const tops = await page.locator('.q-actions button').evaluateAll((buttons) => buttons.map((b) => Math.round(b.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    await page.getByRole('button', { name: 'Me rindo' }).tap();
    await expect(page.locator('.verdict')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver resultado' })).toBeInViewport();
    // Nothing is left to mark: a finger on the letters moves the page again.
    expect(await grid(page).evaluate((el) => getComputedStyle(el).touchAction)).toBe('auto');
    await toMap.tap();
    await expect(page.locator('.map-svg .m-lbl')).toHaveCount(10);
    await page.getByRole('button', { name: 'Volver a la sopa' }).tap();
    await page.getByRole('button', { name: 'Ver resultado' }).tap();
    // The results are those of every game: the map over them, and nothing wider than the screen.
    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('.stage')).toBeVisible();
    expect(await fits()).toBe(true);
  });

  test('lays the square beside the rest on a phone lying down', async ({ page }) => {
    await page.setViewportSize({ width: 740, height: 360 });
    await start(page, PROVINCES);
    await expect(grid(page)).toBeInViewport({ ratio: 1 });
    for (const name of ['Ver el mapa', 'Ver los nombres', 'Me rindo', 'Terminar']) await expect(page.getByRole('button', { name, exact: true }), name).toBeInViewport({ ratio: 1 });
    await expect(said(page)).toBeInViewport({ ratio: 1 });
    // The square on the left, and what goes with it on its right.
    const box = (await grid(page).boundingBox())!;
    const text = (await said(page).boundingBox())!;
    expect(text.x).toBeGreaterThan(box.x + box.width);
    expect(await page.locator('.panel').evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await find(page, 'LEON');
    await expect(said(page)).toHaveText('¡León! Quedan 9.');
  });
});
