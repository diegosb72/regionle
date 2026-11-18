import { expect, test, type Page } from '@playwright/test';
import { open, seed, start, type } from './helpers';

/** Eight countries and their capitals, by the name each one is asked with. */
const CAPITAL: Record<string, string> = { España: 'Madrid', Francia: 'París', Alemania: 'Berlín', Italia: 'Roma', Portugal: 'Lisboa', 'Países Bajos': 'Ámsterdam', Bélgica: 'Bruselas', Polonia: 'Varsovia' };
const CAPITALS = { section: 'countries', mode: 'capital', countries: ['ES', 'FR', 'DE', 'IT', 'PT', 'NL', 'BE', 'PL'], opts: { format: 'exam', answer: 'type' } };

const asked = async (page: Page) => ((await page.locator('.q-prompt h2').textContent()) ?? '').trim();
const hud = (page: Page) => page.locator('.hud-main');
/** The right answer to the question on screen, and the country it was about. */
async function answer(page: Page, n: number): Promise<string> {
  await expect(hud(page)).toHaveText(`${n} / 8`);
  const country = await asked(page);
  await type(page, CAPITAL[country]);
  return country;
}

test.describe('an exam', () => {
  test('takes each answer without a word about how it went', async ({ page }) => {
    await start(page, CAPITALS);
    await expect(hud(page)).toHaveText('1 / 8');
    await expect(page.getByRole('button', { name: 'Una letra' })).toHaveCount(0);
    await expect(page.locator('.hud')).not.toContainText('racha');

    await answer(page, 1);
    await expect(hud(page)).toHaveText('2 / 8');
    await expect(page.locator('.q-note')).toHaveText('Respuesta anotada.');
    await expect(page.locator('.verdict')).toHaveCount(0);

    // A wrong one goes by just the same.
    await type(page, 'Atlántida');
    await expect(hud(page)).toHaveText('3 / 8');
    await expect(page.locator('.q-note')).toHaveText('Respuesta anotada.');
    await expect(page.locator('.verdict')).toHaveCount(0);
    await expect(page.locator('.answer-input')).toHaveValue('');
  });

  test('is marked out of ten when it is handed in, with what was answered', async ({ page }) => {
    await start(page, CAPITALS);
    const right = await answer(page, 1);
    await expect(hud(page)).toHaveText('2 / 8');
    const wrong = await asked(page);
    await type(page, 'Atlántida');
    await expect(hud(page)).toHaveText('3 / 8');
    const blank = await asked(page);
    await page.getByRole('button', { name: 'Dejar en blanco' }).click();
    await expect(hud(page)).toHaveText('4 / 8');
    // The capital of another country, written anyhow: the marking calls it by its name.
    const mixed = await asked(page);
    const other = mixed === 'Italia' ? 'Madrid' : 'Roma';
    await type(page, ` ${other.toLowerCase()} `);
    await expect(hud(page)).toHaveText('5 / 8');

    await page.getByRole('button', { name: 'Entregar' }).click();
    // One of eight: a 1,25.
    await expect(page.locator('.results-title')).toHaveText('Nota: 1,3');
    await expect(page.locator('.results-note')).toHaveText('Entregaste con 4 preguntas sin responder, que cuentan como en blanco.');
    const rows = page.locator('.results-group li .row-name');
    await expect(rows).toHaveCount(4);
    await expect(rows.filter({ hasText: wrong })).toContainText(`${CAPITAL[wrong]} · respondiste «Atlántida»`);
    await expect(rows.filter({ hasText: blank })).toContainText(`${CAPITAL[blank]} · en blanco`);
    await expect(rows.filter({ hasText: mixed })).toContainText(`${CAPITAL[mixed]} · respondiste «${other}»`);
    await expect(rows.filter({ hasText: right })).toHaveText(`${right}${CAPITAL[right]}`);
    // The questions never reached are misses too.
    await expect(page.locator('.results-stats')).toContainText('Fallos7');
    // Nothing to challenge a friend with: a mark is one's own.
    await expect(page.locator('.challenge')).toHaveCount(0);
  });

  test('keeps the best mark of a map answered to the end', async ({ page }) => {
    await start(page, CAPITALS);
    for (let n = 1; n <= 8; n++) await answer(page, n);
    await expect(page.locator('.results-title')).toHaveText('Nota: 10');
    await expect(page.locator('.results-note')).toHaveText('8 de 8 bien. Es tu mejor nota en este mapa.');

    // A worse one afterwards leaves the record where it was.
    await page.getByRole('button', { name: 'Otra vez' }).click();
    for (let n = 1; n <= 7; n++) await answer(page, n);
    await expect(hud(page)).toHaveText('8 / 8');
    await page.getByRole('button', { name: 'Dejar en blanco' }).click();
    await expect(page.locator('.results-title')).toHaveText('Nota: 8,8');
    await expect(page.locator('.results-note')).toHaveText('7 de 8 bien. Tu mejor nota en este mapa: 10.');

    await open(page, '/progreso');
    const record = page.locator('.records li').filter({ hasText: 'Capitales · examen' });
    await expect(record).toHaveCount(1);
    await expect(record).toContainText('nota 10');
    await expect(page.locator('.table-wrap tbody tr').first()).toContainText('· examen');
  });

  test('leaves the map as blank as it found it until the end', async ({ page }) => {
    // "Sin fin" has an end in an exam: the whole map, once.
    await start(page, { section: 'regions', mode: 'pin', countries: ['ES'], levels: { ES: 'g1' }, opts: { format: 'exam', length: 'endless' } });
    const map = page.locator('.map-svg');
    await expect(map.locator('[data-id="ES-AN"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.q-how')).toContainText('El primer clic es tu respuesta.');
    await expect(hud(page)).toHaveText('1 / 19');

    // The same piece three times: an answer already given is still there to be given.
    const names: string[] = [];
    for (let n = 1; n <= 3; n++) {
      await expect(hud(page)).toHaveText(`${n} / 19`);
      names.push(((await page.locator('.q-name').textContent()) ?? '').trim());
      await map.locator('[data-id="ES-AN"]').click();
    }
    await expect(hud(page)).toHaveText('4 / 19');
    await expect(map.locator('.st-ok, .st-warn, .st-bad')).toHaveCount(0);
    await expect(map.locator('.m-lbl')).toHaveCount(0);

    await page.getByRole('button', { name: 'Entregar' }).click();
    await expect(page.locator('.results-title')).toHaveText(/^Nota: \d/);
    const missed = names.filter((n) => n !== 'Andalucía');
    await expect(page.locator('.results-group li .row-name').filter({ hasText: 'señalaste Andalucía' })).toHaveCount(missed.length);
    // Now the map says how it went.
    await expect(map.locator('.st-bad').first()).toBeVisible();
  });

  test('is a format of the settings, and says what it takes away', async ({ page }) => {
    await seed(page, { mode: { regions: 'pin' }, sel: { regions: ['ES'] } });
    await open(page, '/regiones');
    const format = page.getByRole('radiogroup', { name: 'Formato de la partida' });
    await expect(format.getByRole('radio')).toHaveText(['Normal', 'Contrarreloj', 'Supervivencia', 'Examen']);
    await expect(page.getByText('Dejar los nombres en el mapa')).toBeVisible();

    await format.getByRole('radio', { name: 'Examen' }).click();
    await expect(page.locator('.opt-hint').filter({ hasText: 'Como un examen' })).toBeVisible();
    await expect(page.locator('.startbar')).toContainText('Señalar · examen');
    // Names on the map and cards after a miss would be the answers.
    await expect(page.getByText('Dejar los nombres en el mapa')).toHaveCount(0);
    await expect(page.getByText('Ficha de Wikipedia al fallar')).toHaveCount(0);

    // As many questions as the settings say: ten of the nineteen.
    await page.getByRole('radiogroup', { name: 'Número de preguntas' }).getByRole('radio', { name: '10', exact: true }).click();
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page.locator('.q-how')).toContainText('El primer clic es tu respuesta.', { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Entregar' })).toBeVisible();
    await expect(hud(page)).toHaveText('1 / 10');
  });
});
