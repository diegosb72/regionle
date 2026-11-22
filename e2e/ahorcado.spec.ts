/**
 * «Ahorcado»: a name of the map is hidden and found letter by letter. Each letter that is not in it puts out
 * a point of the compass rose, and the eighth loses the name; the map says which piece it is when it is asked
 * to, and then the name no longer counts as right first time.
 */
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, restart, seed, start } from './helpers';

/** The provinces of Spain: with this game the first name is León, and the second Teruel. */
const PROVINCES = { section: 'regions', countries: ['ES'], levels: { ES: 'f' }, mode: 'hangman' };

const kept = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { sessions: { mode: string; label: string; total: number; ok: number; warn: number; bad: number }[]; stats?: Record<string, unknown> });
const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`).first();
const key = (page: Page, letter: string) => page.locator('.hang-key').filter({ hasText: new RegExp(`^${letter}$`) });
const word = (page: Page) => page.locator('.hang-word');
const count = (page: Page) => page.locator('.hang-count');
/** What the last letter did, as it is read; the line it is in says the rest to whoever hears the game. */
const said = (page: Page) => page.locator('.hang-said');
const note = (page: Page) => page.locator('.q-note');
/** The points of the rose that have gone out. */
const out = (page: Page) => page.locator('.hang-pt.out');
const next = (page: Page) => page.getByRole('button', { name: 'Siguiente' });
/** The name as it stands: its letters in sight, and a dot for each one still covered. */
const shown = (page: Page): Promise<string> =>
  page.locator('.hang-w').evaluateAll((words) => words.map((w) => [...w.querySelectorAll('.hang-c')].map((c) => (c.textContent ?? '').trim() || '·').join('')).join(' '));
/** Letters typed one after another on the keyboard. */
async function press(page: Page, letters: string): Promise<void> {
  for (const letter of letters) await page.keyboard.press(letter);
}

test.describe('hangman', () => {
  test('hides a name and shows each letter that is tried wherever it is; one that is not there puts out a point of the rose', async ({ page }) => {
    await start(page, PROVINCES);
    await expect(page.locator('.play-title strong')).toHaveText('Ahorcado');
    await expect(page.locator('.play-title span')).toHaveText('España · provincias');
    await expect(page.locator('.hud-main')).toHaveText('1 / 10');
    await expect(page.locator('.kicker')).toHaveText('¿Qué provincia es?');
    await expect(count(page)).toHaveText('Fallos: 0 de 8');
    await expect(said(page)).toHaveText('Prueba una letra. También vale el teclado.');
    await expect(note(page).locator('.sr-only')).toHaveCount(0);
    expect(await shown(page)).toBe('····');
    await expect(word(page)).toHaveAttribute('aria-label', 'El nombre: hueco hueco hueco hueco');
    // The letters of the Spanish alphabet, the Ñ among them, and the whole rose lit.
    expect((await page.locator('.hang-key').allTextContents()).join('')).toBe('ABCDEFGHIJKLMNÑOPQRSTUVWXYZ');
    await expect(page.locator('.hang-pt')).toHaveCount(8);
    await expect(out(page)).toHaveCount(0);
    // The map names nothing, lights nothing, and says nothing of what the pointer rests on.
    await expect(page.locator('.map-svg .m-lbl')).toHaveCount(0);
    await expect(page.locator('.map-svg [class*="st-"]')).toHaveCount(0);
    await piece(page, 'ES-LE').hover();
    await expect(page.locator('.map-tip')).toHaveText('');

    await page.keyboard.press('e');
    await expect(said(page)).toHaveText('La E está.');
    expect(await shown(page)).toBe('·e··');
    // The letter that has just been found is the one that comes up with a little jump.
    await expect(page.locator('.hang-c.fresh')).toHaveText(['e']);
    await expect(key(page, 'E')).toHaveClass(/hit/);
    await expect(key(page, 'E')).toHaveAttribute('aria-disabled', 'true');
    await expect(key(page, 'E')).toHaveAttribute('aria-label', 'E: está');
    await expect(count(page)).toHaveText('Fallos: 0 de 8');

    await page.keyboard.press('a');
    await expect(said(page)).toHaveText('No hay ninguna A.');
    await expect(note(page)).toHaveClass(/hang-no/);
    // Whoever hears the game is told the count and how the name stands, which the others see.
    await expect(note(page).locator('.sr-only')).toHaveText('Fallos: 1 de 8. hueco E hueco hueco.');
    await expect(count(page)).toHaveText('Fallos: 1 de 8');
    await expect(key(page, 'A')).toHaveClass(/miss/);
    await expect(key(page, 'A')).toHaveAttribute('aria-label', 'A: no está');
    await expect(out(page)).toHaveCount(1);
    expect(await shown(page)).toBe('·e··');
    await expect(page.locator('.hang-c.fresh')).toHaveCount(0);
    // A letter that was tried is not tried again, by the keyboard or by its button.
    await press(page, 'aAeE');
    await key(page, 'A').dispatchEvent('click');
    await expect(count(page)).toHaveText('Fallos: 1 de 8');
    await expect(said(page)).toHaveText('No hay ninguna A.');

    // By its button; and the O uncovers the Ó.
    await key(page, 'O').click();
    await expect(said(page)).toHaveText('La O está.');
    await expect(note(page)).not.toHaveClass(/hang-no/);
    await expect(note(page).locator('.sr-only')).toHaveText('Fallos: 1 de 8. hueco E Ó hueco.');
    expect(await shown(page)).toBe('·eó·');
    await expect(word(page)).toHaveAttribute('aria-label', 'El nombre: hueco E Ó hueco');
    await key(page, 'L').click();
    await key(page, 'N').click();

    // The last letter ends the round: the name is said, and the map shows where it is.
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.verdict-head')).toContainText('¡Eso es! León');
    await expect(page.locator('.hang-how')).toHaveText('Con 1 letra fallada.');
    expect(await shown(page)).toBe('León');
    await expect(word(page)).toHaveAttribute('aria-label', 'El nombre: León');
    await expect(page.locator('.hang-key')).toHaveCount(0);
    await expect(piece(page, 'ES-LE')).toHaveClass(/st-ok/);
    await expect(page.locator('.map-svg .m-lbl')).toHaveText(['León']);
    await expect(out(page)).toHaveCount(1);

    // Enter goes on to the next name, which starts with everything covered and the rose whole.
    await expect(next(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.hud-main')).toHaveText('2 / 10');
    expect(await shown(page)).toBe('······');
    await expect(count(page)).toHaveText('Fallos: 0 de 8');
    await expect(out(page)).toHaveCount(0);
    await expect(page.locator('.hang-key.hit, .hang-key.miss')).toHaveCount(0);
    await expect(page.locator('.map-svg .m-lbl')).toHaveCount(0);
    // The piece that was played keeps its colour and gives its name; the one in hand gives nothing away.
    await expect(piece(page, 'ES-LE')).toHaveClass(/st-ok/);
    await expect(piece(page, 'ES-TE')).not.toHaveClass(/st-/);
    // The letters have the focus the button had: the keyboard goes on from them.
    await expect(page.locator('.hang-keys')).toBeFocused();
    await page.keyboard.press('e');
    await expect(said(page)).toHaveText('La E está 2 veces.');
    expect(await shown(page)).toBe('·e··e·');
  });

  test('loses the name with the eighth letter that is not in it, and shows what it was', async ({ page }) => {
    await start(page, PROVINCES);
    // Giving up shows the name at once.
    await page.getByRole('button', { name: 'Me rindo' }).click();
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.verdict-head')).toContainText('Era León');
    await expect(page.locator('.hang-how')).toHaveText('Te has rendido.');
    expect(await shown(page)).toBe('León');
    await expect(page.locator('.hang-c.late')).toHaveCount(4);
    await expect(piece(page, 'ES-LE')).toHaveClass(/st-bad/);
    await next(page).click();

    await press(page, 'qwxkjy');
    await expect(count(page)).toHaveText('Fallos: 6 de 8');
    await expect(count(page)).not.toHaveClass(/low/);
    await expect(said(page)).toHaveText('No hay ninguna Y.');
    await page.keyboard.press('h');
    // One more and it is lost: the count says so, and the north is the only point still lit.
    await expect(count(page)).toHaveText('Fallos: 7 de 8');
    await expect(count(page)).toHaveClass(/low/);
    await expect(said(page)).toHaveText('No hay ninguna H. Un fallo más y pierdes el norte.');
    await expect(out(page)).toHaveCount(7);
    await expect(page.locator('.hang-pt.north')).not.toHaveClass(/out/);
    // A letter that is there costs nothing, however near the end is.
    await page.keyboard.press('e');
    await expect(count(page)).toHaveText('Fallos: 7 de 8');
    expect(await shown(page)).toBe('·e··e·');

    await page.keyboard.press('z');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.verdict-head')).toContainText('Era Teruel');
    await expect(page.locator('.hang-how')).toHaveText('Has perdido el norte: ocho letras que no estaban.');
    await expect(count(page)).toHaveText('Fallos: 8 de 8');
    await expect(out(page)).toHaveCount(8);
    // The whole name is in sight, and the letters that were not found are told apart.
    expect(await shown(page)).toBe('Teruel');
    await expect(page.locator('.hang-c.late')).toHaveText(['T', 'r', 'u', 'l']);
    await expect(piece(page, 'ES-TE')).toHaveClass(/st-bad/);
    await expect(page.locator('.map-svg .m-lbl')).toHaveText(['Teruel']);
    // Letters typed now are for nobody.
    await press(page, 'tr');
    await expect(page.locator('.verdict-head')).toContainText('Era Teruel');

    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('.results-stats')).toContainText('Letras falladas8');
    await expect(page.locator('.results-group.g-bad .row-name')).toHaveText(['Leónsin adivinar', 'Teruelsin adivinar']);
    // With nothing right there is nothing to tell the misses apart from: no repeat of them is offered.
    await expect(page.getByRole('button', { name: /^Repasar/ })).toHaveCount(0);
    const state = await kept(page);
    expect(state.sessions.at(-1)).toMatchObject({ mode: 'hangman', label: 'España · provincias', total: 2, ok: 0, warn: 0, bad: 2 });
    // Nothing goes into the review: a name found by its letters says little of what is known of the piece.
    expect(Object.keys(state.stats ?? {})).toHaveLength(0);
  });

  test('shows the piece on the map when it is asked to, and the name then counts as found with help', async ({ page }) => {
    await start(page, PROVINCES);
    const hint = page.getByRole('button', { name: 'Ver en el mapa' });
    await hint.click();
    await expect(piece(page, 'ES-LE')).toHaveClass(/st-target/);
    await expect(said(page)).toHaveText('Mira el mapa: ahí está. Ya no cuenta como a la primera.');
    await expect(hint).toBeDisabled();
    // The button can be pressed once: the focus it had goes to the letters.
    await expect(page.locator('.hang-keys')).toBeFocused();
    // It is lit, not named.
    await expect(page.locator('.map-svg .m-lbl')).toHaveCount(0);
    await piece(page, 'ES-LE').hover();
    await expect(page.locator('.map-tip')).toHaveText('');
    await press(page, 'leon');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-warn/);
    await expect(page.locator('.hang-how')).toHaveText('Sin fallar una letra, y con el mapa.');
    await expect(piece(page, 'ES-LE')).toHaveClass(/st-warn/);
    await next(page).click();

    // Without the map, and whatever the letters missed on the way, it is right first time.
    await expect(hint).toBeEnabled();
    await press(page, 'aterul');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.hang-how')).toHaveText('Con 1 letra fallada.');
    await expect(page.locator('.hud-streak')).toHaveCount(0);

    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('.results-note')).toHaveText('A la primera: el nombre adivinado solo con las letras. Con ayuda: después de pedir el mapa. Las letras falladas no restan.');
    await expect(page.locator('.results-stats')).toContainText('Letras falladas1');
    await expect(page.locator('.results-stats')).toContainText('Mejor racha1');
    await expect(page.locator('.results-group.g-warn .row-name')).toHaveText(['Leóncon el mapa · sin fallar una letra']);
    await expect(page.locator('.results-group.g-ok .row-name')).toHaveText(['Teruel1 letra fallada']);
    expect((await kept(page)).sessions.at(-1)).toMatchObject({ mode: 'hangman', total: 2, ok: 1, warn: 1, bad: 0 });

    // The repeat is of the names that needed help, and of nothing else.
    await page.getByRole('button', { name: 'Repasar la que no salió a la primera' }).click();
    await expect(page.locator('.hud-main')).toHaveText('1 / 1');
    expect(await shown(page)).toBe('····');
    await press(page, 'leon');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(page.locator('.results-title')).toHaveText('¡Ni una se te resiste!');
    // «Otra vez» is another game of the same names.
    await page.getByRole('button', { name: 'Otra vez' }).click();
    await expect(page.locator('.hud-main')).toHaveText('1 / 1');
    expect(await shown(page)).toBe('····');
  });

  test('has the Ñ as a letter of its own, shows what is no letter from the start, and plays the whole of a list', async ({ page }) => {
    await start(page, { ...PROVINCES, only: ['ES-C'], list: 'Con eñe' });
    await expect(page.locator('.play-title span')).toHaveText('España · provincias · Con eñe');
    await expect(page.locator('.hud-main')).toHaveText('1 / 1');
    // Two words, each on its own.
    expect(await shown(page)).toBe('·· ······');
    await expect(page.locator('.hang-w')).toHaveCount(2);
    await page.keyboard.press('n');
    await expect(said(page)).toHaveText('No hay ninguna N.');
    // The key of a Spanish keyboard, which the keyboard of the tests has not.
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ñ', bubbles: true, cancelable: true })));
    await expect(said(page)).toHaveText('La Ñ está.');
    expect(await shown(page)).toBe('·· ····ñ·');
    await expect(key(page, 'Ñ')).toHaveClass(/hit/);
    await expect(key(page, 'N')).toHaveClass(/miss/);
    await press(page, 'lacoru');
    await expect(page.locator('.verdict-head')).toContainText('¡Eso es! La Coruña');
    // The only name of the list was the last one.
    await expect(page.getByRole('button', { name: 'Ver resultado' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.results-title')).toHaveText('¡Ni una se te resiste!');
    expect((await kept(page)).sessions.at(-1)).toMatchObject({ mode: 'hangman', label: 'España · provincias · Con eñe', total: 1, ok: 1 });
  });

  test('keeps a hyphen in sight, and lets a long name go on after it in the next line', async ({ page }) => {
    await start(page, { section: 'regions', countries: ['DE'], mode: 'hangman', only: ['DE-MV'], list: 'Larga' });
    await expect(page.locator('.kicker')).toHaveText('¿Qué estado es?');
    // «Mecklemburgo-Pomerania Occidental»: the hyphen is there from the start, and has no dash under it.
    expect(await shown(page)).toBe('············-········· ··········');
    await expect(page.locator('.hang-c.fixed')).toHaveText(['-']);
    // It was never hidden: it does not come up as a letter that has just been found does.
    await expect(page.locator('.hang-c.fresh')).toHaveCount(0);
    await expect(page.locator('.hang-w')).toHaveCount(2);
    await expect(page.locator('.hang-p')).toHaveCount(3);
    // Every stretch is on one line, and nothing is wider than the panel.
    const laid = await page.locator('.hang-p').evaluateAll((parts) => parts.map((p) => new Set([...p.querySelectorAll('.hang-c')].map((c) => Math.round(c.getBoundingClientRect().top))).size));
    expect(laid).toEqual([1, 1, 1]);
    expect(await page.locator('.panel').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(word(page)).toHaveAttribute('aria-label', /^El nombre: (hueco ){12}- (hueco ){8}hueco, (hueco ){9}hueco$/);
  });

  test('asks for a river, a country or a city by what it is', async ({ page }) => {
    await start(page, { section: 'physical', mode: 'hangman', countries: ['river', 'in:ES'], only: ['r:ebro'] });
    await expect(page.locator('.kicker')).toHaveText('¿Qué río es?');
    expect(await shown(page)).toBe('····');
    await press(page, 'ebro');
    await expect(page.locator('.verdict-head')).toContainText('¡Eso es! Ebro');
    await expect(piece(page, 'r:ebro')).toHaveClass(/st-ok/);

    await restart(page, { section: 'countries', mode: 'hangman', countries: ['ES', 'PT', 'FR', 'IT', 'CI', 'GW'], only: ['GW'] });
    await expect(page.locator('.kicker')).toHaveText('¿Qué país es?');
    expect(await shown(page)).toBe('······-·····');
    await press(page, 'guineabs');
    await expect(page.locator('.verdict-head')).toContainText('¡Eso es! Guinea-Bisáu');
    await expect(piece(page, 'GW')).toHaveClass(/st-ok/);

    // The ten largest cities of Spain: the first name of this game is Valencia.
    await restart(page, { section: 'cities', mode: 'hangman', countries: ['ES'], nonce: 1, opts: { cityPick: 'top', cityCount: 10 } });
    await expect(page.locator('.kicker')).toHaveText('¿Qué ciudad es?');
    await expect(page.locator('.hud-main')).toHaveText('1 / 10');
    expect(await shown(page)).toBe('········');
    await press(page, 'valenci');
    await expect(page.locator('.verdict-head')).toContainText('¡Eso es! Valencia');
  });

  test('is offered among the word games of every section with a map, and says how long a game is', async ({ page }) => {
    await seed(page);
    for (const route of ['/paises', '/ciudades', '/fisica', '/regiones']) {
      await open(page, route);
      await page
        .getByRole('group', { name: 'Juegos de palabras' })
        .getByRole('button', { name: /^Ahorcado/ })
        .click();
      await expect(page.locator('.mode-about'), route).toContainText('Un nombre del mapa, escondido: prueba letras hasta dar con él.');
    }
    await open(page, '/cifras');
    await expect(page.getByRole('button', { name: /^Ahorcado/ })).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Juegos de palabras' })).toHaveCount(0);

    await open(page, '/regiones');
    await page.getByRole('button', { name: /^Ahorcado/ }).click();
    // As many names as are asked for, and never without end: a list of names has one.
    await expect(page.getByRole('radiogroup', { name: 'Preguntas' }).getByRole('radio')).toHaveText(['Todo', '10', '20', '50']);
    // The map is Spain by its nineteen communities: all of them, or the ten that are asked for.
    await page.getByRole('radiogroup', { name: 'Preguntas' }).getByRole('radio', { name: 'Todo' }).click();
    await expect(page.locator('.mode-facts')).toContainText('19 nombres');
    await page.getByRole('radiogroup', { name: 'Preguntas' }).getByRole('radio', { name: '10' }).click();
    await expect(page.locator('.mode-facts')).toContainText('10 nombres');
    await page.getByRole('button', { name: /Empezar/ }).click();
    await expect(page.locator('.play-title strong')).toHaveText('Ahorcado');
    await expect(page.locator('.hud-main')).toHaveText('1 / 10');
    await expect(page.locator('.kicker')).toHaveText('¿Qué comunidad autónoma es?');
  });

  test('tells how it is played, and takes no letter while that is being read', async ({ page }) => {
    await start(page, PROVINCES);
    await page.locator('.play-help').click();
    const panel = page.locator('dialog[open]');
    await expect(panel).toContainText('Cada letra que no está apaga una punta de la rosa de los vientos.');
    await expect(panel).toContainText('«Ver en el mapa» ilumina la pieza');
    await press(page, 'ae');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(count(page)).toHaveText('Fallos: 0 de 8');
    expect(await shown(page)).toBe('····');
    // Once it is closed, the keyboard is the game's again.
    await page.keyboard.press('e');
    expect(await shown(page)).toBe('·e··');
  });

  test('leaves a letter that was tried where the keyboard found it: its button keeps the focus', async ({ page }) => {
    await start(page, PROVINCES);
    await key(page, 'A').focus();
    await page.keyboard.press('Enter');
    await expect(count(page)).toHaveText('Fallos: 1 de 8');
    await expect(key(page, 'A')).toBeFocused();
    // Pressed again it does nothing, and Tab goes on to the next letter.
    await page.keyboard.press('Enter');
    await expect(count(page)).toHaveText('Fallos: 1 de 8');
    await page.keyboard.press('Tab');
    await expect(key(page, 'B')).toBeFocused();
    // With the focus on a button, a letter of the keyboard is still that letter.
    await page.keyboard.press('e');
    expect(await shown(page)).toBe('·e··');
    await expect(key(page, 'B')).toBeFocused();
    await expect(key(page, 'B')).not.toHaveClass(/hit|miss/);
  });

  test('speaks English, where the Ñ is found with the N', async ({ page }) => {
    await seed(page, { lang: 'en', game: { nonce: 1, ...PROVINCES, only: ['ES-C'], list: 'One', opts: OPTS } });
    await page.goto('./#/jugar');
    await expect(page.locator('.play-loading')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('.play-title strong')).toHaveText('Hangman');
    await expect(page.locator('.kicker')).toHaveText('Which province is it?');
    await expect(count(page)).toHaveText('Misses: 0 of 8');
    await expect(said(page)).toHaveText('Try a letter. The keyboard works too.');
    expect((await page.locator('.hang-key').allTextContents()).join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(await shown(page)).toBe('· ······');
    await expect(word(page)).toHaveAttribute('aria-label', 'The name: blank, blank blank blank blank blank blank');
    await page.keyboard.press('n');
    await expect(said(page)).toHaveText('N is in the name.');
    expect(await shown(page)).toBe('· ····ñ·');
    await page.keyboard.press('a');
    await expect(said(page)).toHaveText('A is in the name 2 times.');
    await page.keyboard.press('x');
    await expect(said(page)).toHaveText('There is no X.');
    await expect(count(page)).toHaveText('Misses: 1 of 8');
    await page.getByRole('button', { name: 'Show on the map' }).click();
    await expect(said(page)).toHaveText('Look at the map: there it is. It no longer counts as first time.');
    await press(page, 'coru');
    await expect(page.locator('.verdict-head')).toContainText('That is it! A Coruña');
    await expect(page.locator('.hang-how')).toHaveText('With 1 wrong letter, and with the map.');
  });
});

test.describe('hangman on a phone @movil', () => {
  test('fits the name, the letters and what they said over the map, with keys a finger can hit', async ({ page }) => {
    await start(page, PROVINCES);
    await expect(page.locator('.hang-key')).toHaveCount(27);
    const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(await fits()).toBe(true);
    for (const letter of ['A', 'Ñ', 'Z']) await expect(key(page, letter)).toBeInViewport({ ratio: 1 });
    const sizes = await page.locator('.hang-key').evaluateAll((keys) => keys.map((k) => k.getBoundingClientRect()).map((r) => [Math.round(r.width), Math.round(r.height)]));
    for (const [w, h] of sizes) {
      expect(w).toBeGreaterThanOrEqual(28);
      expect(h).toBeGreaterThanOrEqual(34);
    }
    await key(page, 'E').tap();
    await key(page, 'A').tap();
    await expect(said(page)).toHaveText('No hay ninguna A.');
    await expect(said(page)).toBeInViewport();
    expect(await shown(page)).toBe('·e··');
    // Nobody types on the keyboard of a phone here: the note does not speak of one.
    await expect(page.locator('.hang-desk')).toBeHidden();
    await page.getByRole('button', { name: 'Ver en el mapa' }).tap();
    await expect(piece(page, 'ES-LE')).toHaveClass(/st-target/);
    await expect(piece(page, 'ES-LE')).toBeInViewport();
    for (const letter of ['L', 'O', 'N']) await key(page, letter).tap();
    await expect(page.locator('.verdict')).toBeVisible();
    await expect(next(page)).toBeInViewport();
    expect(await fits()).toBe(true);
  });

  test('writes a long name smaller rather than cutting a word', async ({ page }) => {
    await start(page, { section: 'regions', countries: ['DE'], mode: 'hangman', only: ['DE-MV'], list: 'Larga' });
    await expect(page.locator('.hang-p')).toHaveCount(3);
    const laid = await page.locator('.hang-p').evaluateAll((parts) => parts.map((p) => new Set([...p.querySelectorAll('.hang-c')].map((c) => Math.round(c.getBoundingClientRect().top))).size));
    expect(laid).toEqual([1, 1, 1]);
    expect(await page.locator('.panel').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const letter of ['A', 'Z']) await expect(key(page, letter)).toBeInViewport({ ratio: 1 });
  });
});
