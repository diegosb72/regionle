import { expect, test } from '@playwright/test';
import { open, seed, start, type } from './helpers';

/** The eight the games about countries are played with here: by people, Germany, France, Italy, Spain, Poland, the Netherlands, Belgium, Portugal. */
const EIGHT = ['ES', 'FR', 'DE', 'IT', 'PT', 'NL', 'BE', 'PL'];

test.describe('true or false', () => {
  test('makes a statement, takes the answer from the keyboard and says why', async ({ page }) => {
    await start(page, { section: 'pops', mode: 'truefalse', countries: EIGHT, opts: { length: 10 } });
    const said = page.locator('.tf-text');
    await expect(said).toHaveText(/\.$/);
    await expect(page.locator('.hud-main')).toHaveText('1 / 10');
    const first = await said.textContent();

    await page.keyboard.press('v');
    const verdict = page.locator('.verdict');
    await expect(verdict).toContainText(/¡Correcto!|Era falso\./);
    // The fact behind it is always told: that is what is learnt.
    await expect(verdict.locator('.tf-why')).toHaveText(/\S{3,}/);
    await expect(page.getByRole('button', { name: 'Verdadero' })).toBeDisabled();

    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.locator('.hud-main')).toHaveText('2 / 10');
    await expect(said).not.toHaveText(first ?? '');
  });

  test('ends when asked to, with what was missed to read again', async ({ page }) => {
    await start(page, { section: 'pops', mode: 'truefalse', countries: EIGHT, opts: { length: 10 } });
    let wrong = 0;
    for (let i = 0; i < 4; i++) {
      await expect(page.locator('.hud-main')).toHaveText(`${i + 1} / 10`);
      await page.getByRole('button', { name: 'Falso' }).click();
      const verdict = page.locator('.verdict');
      await expect(verdict).toBeVisible();
      if (await verdict.evaluate((el) => el.classList.contains('verdict-bad'))) wrong++;
      // A right answer moves on by itself after a moment, a wrong one waits: the button does both.
      await page.getByRole('button', { name: 'Siguiente' }).click();
    }
    await expect(page.locator('.hud-main')).toHaveText('5 / 10');
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results')).toContainText(`${4 - wrong} de 4`);
    await expect(page.locator('.tf-review li')).toHaveCount(wrong);
  });

  test('is in the menu of the figures, with its number of statements', async ({ page }) => {
    await seed(page, { mode: { pops: 'truefalse' } });
    await open(page, '/poblaciones');
    await expect(page.locator('.mode.on')).toContainText('Verdadero o falso');
    const lengths = page.getByRole('radiogroup', { name: 'Número de preguntas' });
    // Ten, twenty, fifty or no end; twenty where nothing has been chosen.
    await expect(lengths.getByRole('radio')).toHaveText(['10', '20', '50', '']);
    await expect(lengths.getByRole('radio', { checked: true })).toHaveText('20');
    await expect(lengths.getByRole('radio').last().locator('svg')).toHaveAttribute('aria-label', 'Sin fin');
  });
});

test.describe('the top ten', () => {
  test('puts each right name in its place and tells a wrong one where it stands', async ({ page }) => {
    await start(page, { section: 'pops', mode: 'topten', countries: EIGHT, opts: { metric: 'pop' } });
    // Eight countries: the top is its first half.
    await expect(page.locator('.q-ask')).toHaveText('Los 4 primeros, de más a menos habitantes');
    const slots = page.locator('.top-list li');
    await expect(slots).toHaveCount(4);

    await type(page, 'francia');
    await expect(slots.nth(1)).toContainText('Francia');
    await expect(slots.nth(1)).toHaveClass(/got/);
    await expect(page.locator('.hud-main')).toHaveText('1 / 4');

    await type(page, 'Portugal');
    await expect(page.locator('.q-note')).toHaveText('Portugal no está entre los 4 primeros: es el n.º 8.');
    await expect(page.locator('.top-wrong li')).toHaveText(['Portugal n.º 8']);
    await expect(page.locator('.hud-strikes svg.on')).toHaveCount(1);

    // Said twice, it is not a second miss.
    await type(page, 'Portugal');
    await expect(page.locator('.q-note')).toHaveText('Portugal: ya lo has dicho.');
    await expect(page.locator('.hud-strikes svg.on')).toHaveCount(1);

    for (const name of ['Alemania', 'España', 'Italia']) await type(page, name);
    await expect(page.locator('.results')).toContainText('¡Los tienes todos!');
    await expect(page.locator('.top-list li b')).toHaveText(['Alemania', 'Francia', 'Italia', 'España']);
  });

  test('ends at the fifth miss and shows the list', async ({ page }) => {
    await start(page, { section: 'regions', mode: 'topten', countries: ['ES'], levels: { ES: 'f' } });
    await expect(page.locator('.q-ask')).toHaveText('Los 10 primeros, de mayor a menor superficie');
    await type(page, 'Badajoz');
    await expect(page.locator('.top-list li').first()).toContainText('Badajoz');
    for (const name of ['Madrid', 'Guipúzcoa', 'Álava', 'Vizcaya', 'Ceuta']) await type(page, name);
    await expect(page.locator('.results')).toContainText('Cinco fallos: 1 de 10');
    await expect(page.locator('.top-list li.missed')).toHaveCount(9);
    await expect(page.locator('.top-list li b').nth(1)).toHaveText('Cáceres');
  });
});

test.describe('north to south', () => {
  test('deals five places and shows the right order when checked', async ({ page }) => {
    await start(page, { section: 'regions', mode: 'compass', countries: ['ES'], levels: { ES: 'f' }, opts: { axis: 'ns' } });
    await expect(page.locator('.q-ask')).toHaveText('Toca en orden, de norte a sur');
    const cards = page.locator('.rank-card');
    await expect(cards).toHaveCount(5);
    const check = page.getByRole('button', { name: 'Comprobar' });
    await expect(check).toBeDisabled();
    for (let i = 0; i < 5; i++) await cards.nth(i).click();
    await check.click();

    const values = await page.locator('.rank-value').allTextContents();
    expect(values).toHaveLength(5);
    // "42,3° N": the latitudes of the right order go down.
    const lats = values.map((v) => {
      const m = /([\d,]+)° ([NS])/.exec(v)!;
      return Number(m[1].replace(',', '.')) * (m[2] === 'S' ? -1 : 1);
    });
    for (let i = 1; i < lats.length; i++) expect(lats[i]).toBeLessThanOrEqual(lats[i - 1]);
    // The five are lit on the map.
    await expect(page.locator('.map-svg [data-id]').first()).toBeVisible();
  });

  test('goes from west to east when asked', async ({ page }) => {
    await start(page, { section: 'cities', mode: 'compass', countries: ['ES'], opts: { axis: 'we', cityPick: 'top', cityCount: 25 } });
    await expect(page.locator('.q-ask')).toHaveText('Toca en orden, de oeste a este');
  });
});

test.describe('what a piece belongs to', () => {
  test('asks for the community of a province and takes it typed', async ({ page }) => {
    await start(page, { section: 'regions', mode: 'parent', countries: ['ES'], levels: { ES: 'f' }, only: ['ES-TE', 'ES-SE'], opts: { answer: 'type' } });
    await expect(page.locator('.q .kicker')).toHaveText('¿A qué comunidad autónoma pertenece?');
    const name = (await page.locator('.q-name').textContent())!.trim();
    expect(['Teruel', 'Sevilla']).toContain(name);
    await type(page, name === 'Teruel' ? 'aragon' : 'andalucia');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
  });

  test('offers four communities to choose from', async ({ page }) => {
    await start(page, { section: 'regions', mode: 'parent', countries: ['ES'], levels: { ES: 'f' }, opts: { answer: 'choice' } });
    await expect(page.locator('.choices .choice')).toHaveCount(4);
    // None of them is the province asked about: where both are called the same, it is not asked.
    const name = (await page.locator('.q-name').textContent())!.trim();
    const options = await page.locator('.choices .choice').allTextContents();
    for (const o of options) expect(o).not.toContain(name);
  });

  test('explains itself where the map has no groups', async ({ page }) => {
    await start(page, { section: 'regions', mode: 'parent', countries: ['ES'], levels: { ES: 'g1' } });
    await expect(page.getByRole('heading', { name: 'Aquí todo pertenece a lo mismo' })).toBeVisible();
  });
});

test.describe('filling the map against a countdown', () => {
  test('stops when the time is up and counts what was written', async ({ page }) => {
    await start(page, { section: 'regions', mode: 'nameall', countries: ['ES'], levels: { ES: 'g1' }, opts: { countdown: 4 } });
    await expect(page.locator('.hud-clock')).toBeVisible();
    await type(page, 'Galicia');
    await expect(page.locator('.hud-main')).toHaveText('1 / 19');
    await expect(page.locator('.results')).toContainText('Se acabó el tiempo: 1 de 19', { timeout: 15_000 });
  });

  test('is chosen in the settings of the game', async ({ page }) => {
    await seed(page, { mode: { regions: 'nameall' } });
    await open(page, '/regiones');
    const time = page.getByRole('radiogroup', { name: 'Tiempo para rellenar el mapa' });
    await expect(time.getByRole('radio')).toHaveText(['Sin límite', '2 min', '5 min', '10 min', '15 min']);
    await time.getByRole('radio', { name: '5 min', exact: true }).click();
    await expect(time.getByRole('radio', { checked: true })).toHaveText('5 min');
    await expect(page.locator('.opt-hint').filter({ hasText: 'Cuenta atrás' })).toBeVisible();
  });
});

test.describe('figures of more than countries', () => {
  test('compares cities by their people and peaks by their height', async ({ page }) => {
    await start(page, { section: 'cities', mode: 'hilo', countries: ['ES'], opts: { cityPick: 'top', cityCount: 25 } });
    await expect(page.locator('.kicker').first()).toHaveText('¿Más o menos habitantes?');
    await expect(page.getByRole('button', { name: 'Más habitantes' })).toBeVisible();
  });

  test('offers the density of the countries next to their people and their size', async ({ page }) => {
    await seed(page, { mode: { pops: 'hilo' } });
    await open(page, '/poblaciones');
    const figure = page.getByRole('radiogroup', { name: 'Cifra' });
    await expect(figure.getByRole('radio')).toHaveText(['Población', 'Superficie', 'Densidad']);
    await figure.getByRole('radio', { name: 'Densidad' }).click();
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page.locator('.kicker').first()).toHaveText('¿Más o menos densidad de población?');
  });

  test('says what is missing on a map of rivers, which have no figure', async ({ page }) => {
    await seed(page, { mode: { physical: 'hilo' }, sel: { physical: ['river', 'EU'] } });
    await open(page, '/fisica');
    await expect(page.locator('.startbar')).toContainText('Las cifras piden picos, lagos, islas o mares');
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeDisabled();
  });
});

test.describe('the menus', () => {
  test('gather the games under headings', async ({ page }) => {
    await open(page, '/regiones');
    await expect(page.locator('.mode-group-name')).toHaveText(['Para estudiar', 'En el mapa', 'Por la forma', 'Vecinos y posición', 'Datos', 'Cifras', 'Juegos de palabras']);
  });

  test('pick whole groups of countries from "Más atajos"', async ({ page }) => {
    await open(page, '/paises');
    const more = page.getByRole('button', { name: 'Más atajos' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await page.locator('#mas-atajos').getByRole('button', { name: /^OTAN/ }).click();
    await expect(page.locator('.startbar')).toContainText('32 países');
  });
});
