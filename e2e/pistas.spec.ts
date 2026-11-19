import { expect, test, type Page } from '@playwright/test';
import { play, restart, start, type } from './helpers';

const COMMUNITIES = { section: 'regions', countries: ['ES'], levels: { ES: 'g1' } };
/** Twelve countries of western Europe: enough for four options, and for more than one part of the continent. */
const TWELVE = ['ES', 'FR', 'PT', 'IT', 'DE', 'GB', 'IE', 'NL', 'BE', 'CH', 'AT', 'PL'];

const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`);
const menu = (page: Page) => page.locator('.q-more');
const said = (page: Page) => page.locator('.q-hints li');
const another = (page: Page) => page.getByRole('button', { name: 'Otra pista' });

test.describe('more kinds of hint', () => {
  test('are offered beside the hint of the game, each a fact about the piece, and each counts as help', async ({ page }) => {
    await play(page);
    // The question the seed deals first.
    await expect(page.locator('.q-name')).toContainText('Castilla y León');
    // The hint the game always had is still there, and beside it a menu of the others.
    await expect(page.getByRole('button', { name: 'Pista', exact: true })).toBeEnabled();
    await expect(another(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(menu(page)).toHaveCount(0);
    await another(page).click();
    await expect(another(page)).toHaveAttribute('aria-expanded', 'true');
    // A community named on screen and to be found: its size, where it lies, what it borders and its capital.
    await expect(menu(page).getByRole('button')).toHaveText(['Su tamaño', 'Dónde cae', 'Qué tiene cerca', 'Su capital']);
    await expect(menu(page)).toContainText('la respuesta cuenta como dada con ayuda');

    await menu(page).getByRole('button', { name: 'Su capital' }).click();
    await expect(said(page)).toHaveText(['Su capital es Valladolid.']);
    // Once said, the menu closes and no longer offers it.
    await expect(menu(page)).toHaveCount(0);
    await another(page).click();
    await expect(menu(page).getByRole('button')).toHaveText(['Su tamaño', 'Dónde cae', 'Qué tiene cerca']);
    await menu(page).getByRole('button', { name: 'Su tamaño' }).click();
    await menu(page).waitFor({ state: 'detached' });
    await another(page).click();
    await menu(page).getByRole('button', { name: 'Qué tiene cerca' }).click();
    await expect(said(page)).toHaveText(['Su capital es Valladolid.', 'Por tamaño es la mayor de las 19 del mapa.', /^Limita con .+ y 6 más\.$/]);
    // Nothing has been narrowed on the map: that is the other hint, which is still to be had.
    await expect(page.getByRole('button', { name: 'Pista', exact: true })).toBeEnabled();

    // Found at the first try, but with help.
    await piece(page, 'ES-CL').click();
    await expect(page.locator('.verdict')).toContainText('Bien, con ayuda');
    await page.getByRole('button', { name: 'Siguiente' }).click();
    // The next question starts clean.
    await expect(said(page)).toHaveCount(0);
    await expect(menu(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results')).toContainText('Con ayuda');
    await expect(page.locator('.results-stats .c-warn')).toHaveText('1');
  });

  test('take two of the four options away, and show the flag and the part of the world of a country', async ({ page }) => {
    await start(page, { section: 'countries', mode: 'identify', countries: TWELVE, opts: { answer: 'choice' } });
    const options = page.locator('.choice');
    await expect(options).toHaveCount(4);
    // With four options there is no hint of the old kind: the menu is the hint.
    await expect(page.getByRole('button', { name: 'Otra pista' })).toHaveCount(0);
    const hint = page.getByRole('button', { name: 'Pista', exact: true });
    await hint.click();
    // A country lit on the map: where it lies is in sight, so that is not offered.
    await expect(menu(page).getByRole('button')).toHaveText(['Su tamaño', 'A qué pertenece', 'Qué tiene cerca', 'Su capital', 'Su bandera', 'Quitar dos opciones']);

    await menu(page).getByRole('button', { name: 'Quitar dos opciones' }).click();
    await expect(page.locator('.choice.out')).toHaveCount(2);
    await expect(page.locator('.choice:disabled')).toHaveCount(2);
    await expect(page.locator('.choice:not(.out)')).toHaveCount(2);
    // The key of an option that is gone does nothing: the question is still open.
    const gone = await options.evaluateAll((list) => list.findIndex((el) => el.classList.contains('out')) + 1);
    await page.locator('body').press(String(gone));
    await expect(page.locator('.verdict')).toHaveCount(0);

    await hint.click();
    await expect(menu(page).getByRole('button', { name: 'Quitar dos opciones' })).toHaveCount(0);
    await menu(page).getByRole('button', { name: 'Su bandera' }).click();
    await expect(said(page)).toHaveText(['Esta es su bandera:']);
    await expect(said(page).locator('img.flag')).toHaveAttribute('src', /flags\/[a-z]{2}\.svg$/);
    await hint.click();
    await menu(page).getByRole('button', { name: 'A qué pertenece' }).click();
    await expect(said(page).nth(1)).toHaveText(/^Está en Europa (del Sur|Occidental|del Norte|Oriental)\.$/);

    // The flag names the country: one of the two options left is it.
    const code = (await said(page).locator('img.flag').getAttribute('src'))!.replace(/^.*flags\/([a-z]{2})\.svg$/, '$1').toUpperCase();
    const names: Record<string, string> = { ES: 'España', FR: 'Francia', PT: 'Portugal', IT: 'Italia', DE: 'Alemania', GB: 'Reino Unido', IE: 'Irlanda', NL: 'Países Bajos', BE: 'Bélgica', CH: 'Suiza', AT: 'Austria', PL: 'Polonia' };
    await page.locator('.choice:not(.out)', { hasText: names[code] }).click();
    await expect(page.locator('.verdict')).toContainText('Bien, con ayuda');
  });

  test('count the letters of what is typed, until a letter of it is in sight', async ({ page }) => {
    await start(page, { ...COMMUNITIES, mode: 'identify', only: ['ES-AR'] });
    await expect(page.locator('.q-letters')).toHaveCount(0);
    await another(page).click();
    await expect(menu(page).getByRole('button')).toHaveText(['Cuántas letras', 'Su tamaño', 'Qué tiene cerca', 'Su capital']);
    await menu(page).getByRole('button', { name: 'Cuántas letras' }).click();
    await expect(said(page)).toHaveText(['Tiene 6 letras.']);
    // The blanks, and not a letter.
    await expect(page.locator('.q-letters')).toHaveText('_ _ _ _ _ _');
    // An abbreviation still counts: no letter of the name is in sight.
    await page.getByRole('button', { name: 'Una letra' }).click();
    await expect(page.locator('.q-letters')).toHaveText('A _ _ _ _ _');
    await another(page).click();
    await expect(menu(page).getByRole('button')).toHaveText(['Su tamaño', 'Qué tiene cerca', 'Su capital']);
    await type(page, 'Aragón');
    await expect(page.locator('.verdict')).toContainText('Bien, con ayuda');
  });

  test('are given by their own button, without a menu, where a question has only one', async ({ page }) => {
    // A capital among four options: all there is to give is two options fewer.
    await start(page, { ...COMMUNITIES, mode: 'capital', opts: { answer: 'choice' } });
    await expect(page.locator('.choice')).toHaveCount(4);
    await expect(page.getByRole('button', { name: /[Pp]ista/ })).toHaveCount(0);
    const halve = page.getByRole('button', { name: 'Quitar dos opciones' });
    await expect(halve).not.toHaveAttribute('aria-expanded');
    await halve.click();
    await expect(menu(page)).toHaveCount(0);
    await expect(page.locator('.choice.out')).toHaveCount(2);
    // Given once: the button goes, and the keyboard is left on the options.
    await expect(halve).toHaveCount(0);
    await expect(page.locator('.choices')).toBeFocused();
    await page.locator('.choice:not(.out)').first().click();
    await expect(page.locator('.verdict')).toBeVisible();

    // The same capital typed: how many letters it has, beside the letter the game always gave.
    await restart(page, { ...COMMUNITIES, mode: 'capital', only: ['ES-CL'], opts: { answer: 'type' } });
    await expect(page.getByRole('button', { name: 'Una letra' })).toBeEnabled();
    await expect(page.getByRole('button', { name: /[Pp]ista/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Cuántas letras' }).click();
    await expect(menu(page)).toHaveCount(0);
    await expect(said(page)).toHaveText(['Tiene 10 letras.']);
    await expect(page.locator('.q-letters')).toHaveText('_ _ _ _ _ _ _ _ _ _');
    await expect(page.getByRole('button', { name: 'Cuántas letras' })).toHaveCount(0);
    await expect(page.locator('.answer-input')).toBeFocused();
    await type(page, 'Valladolid');
    await expect(page.locator('.verdict')).toContainText('Bien, con ayuda');
  });

  test('can be had from the keyboard, which is left where the answer is given', async ({ page }) => {
    // Typed: the menu opens on its first hint, Escape shuts it, and a hint taken leaves the field ready.
    await start(page, { ...COMMUNITIES, mode: 'identify', only: ['ES-AR'] });
    await another(page).focus();
    await page.keyboard.press('Enter');
    await expect(menu(page).getByRole('button').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu(page)).toHaveCount(0);
    await expect(another(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(said(page)).toHaveText(['Tiene 6 letras.']);
    await expect(page.locator('.answer-input')).toBeFocused();
    await page.keyboard.type('aragon');
    await page.keyboard.press('Enter');
    await expect(page.locator('.verdict')).toContainText('Bien, con ayuda');

    // Among options: the number keys answer straight after a hint, though it was a button that gave it.
    await restart(page, { section: 'countries', mode: 'identify', countries: TWELVE, opts: { answer: 'choice' } });
    await expect(page.locator('.choice')).toHaveCount(4);
    await page.getByRole('button', { name: 'Pista', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(menu(page).getByRole('button').first()).toBeFocused();
    await menu(page).getByRole('button', { name: 'Quitar dos opciones' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.choice.out')).toHaveCount(2);
    await expect(page.locator('.choices')).toBeFocused();
    const left = await page.locator('.choice').evaluateAll((list) => list.flatMap((el, i) => (el.classList.contains('out') ? [] : [i + 1])));
    expect(left).toHaveLength(2);
    await page.keyboard.press(String(left[0]));
    await expect(page.locator('.verdict')).toBeVisible();
  });

  test('are not to be had in an exam, against the clock or with lives', async ({ page }) => {
    await start(page, { ...COMMUNITIES, mode: 'pin', opts: { format: 'exam' } });
    await expect(page.locator('.q-name')).toBeVisible();
    await expect(page.getByRole('button', { name: /[Pp]ista/ })).toHaveCount(0);
    for (const format of ['timed', 'lives']) {
      await restart(page, { section: 'countries', mode: 'identify', countries: TWELVE, opts: { answer: 'choice', format } });
      await expect(page.locator('.choice')).toHaveCount(4);
      await expect(page.getByRole('button', { name: /[Pp]ista/ }), format).toHaveCount(0);
      await expect(page.locator('.q-said')).toHaveCount(0);
    }
  });

  test('fit on a phone, the menu under the buttons @movil', async ({ page }) => {
    await play(page);
    await another(page).tap();
    await expect(menu(page).getByRole('button')).toHaveCount(4);
    await menu(page).getByRole('button', { name: 'Dónde cae' }).tap();
    await expect(said(page)).toHaveText([/^Está (hacia el \S+|por el centro) del mapa\.$/]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const box = (await page.locator('.q-hints').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
});
